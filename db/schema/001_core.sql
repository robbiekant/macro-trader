-- =====================================================================
-- Macro Trader v2 — system-of-record schema (PostgreSQL 15+ / Supabase)
-- Status: DESIGN DRAFT (not yet applied). Moves to supabase/migrations
-- once the design is approved.
--
-- Six schemas, one per harness layer:
--   ref       reference data: sources, series catalog, instruments, calendar
--   raw       every external request + immutable, content-addressed payloads
--   mkt       point-in-time market & macro observations, option chains
--   research  agent reports, signals, evidence (citations), falsifiable views
--   pm        portfolio management: regime, targets, proposals, risk, orders
--   ops       harness telemetry: runs, agent steps, tool calls, evals, memory
--
-- Golden rules encoded here:
--   * Nothing is downloaded twice: raw.fetch_log.request_hash + series TTL
--     gate every fetch; raw.blob is keyed by sha256 so identical payloads
--     are stored once.
--   * Point-in-time correctness: mkt.observation keeps every vintage, so a
--     replay "as of" any past date never sees data published later.
--   * Every claim an agent makes must point at evidence (research.evidence).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS mkt;
CREATE SCHEMA IF NOT EXISTS research;
CREATE SCHEMA IF NOT EXISTS pm;
CREATE SCHEMA IF NOT EXISTS ops;

-- ---------------------------------------------------------------------
-- ops.run is created first: almost everything is stamped with a run_id
-- ---------------------------------------------------------------------
CREATE TABLE ops.run (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type        text NOT NULL CHECK (run_type IN
                    ('daily','weekly_ic','monthly','event','backfill','replay','eval')),
  trigger         text NOT NULL,                 -- 'cron', 'event:vix_jump', 'manual:<user>'
  as_of           timestamptz NOT NULL,          -- the instant the run reasons about
  mode            text NOT NULL CHECK (mode IN ('research','paper','live')),
  status          text NOT NULL DEFAULT 'running' CHECK (status IN
                    ('running','succeeded','failed','halted','awaiting_approval')),
  git_sha         text,                          -- code + prompts version
  config_hash     text,                          -- hash of config/*.yaml
  policy_version  text,                          -- config/risk_policy.yaml policy_version
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  cost_usd        numeric(10,4) NOT NULL DEFAULT 0,
  notes           text
);

CREATE TABLE ops.kill_switch (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- single row
  engaged     boolean NOT NULL DEFAULT false,
  reason      text,
  engaged_by  text,
  engaged_at  timestamptz
);
INSERT INTO ops.kill_switch (id, engaged) VALUES (1, false);

-- =====================================================================
-- ref — reference data
-- =====================================================================
CREATE TABLE ref.data_source (
  source_id          text PRIMARY KEY,      -- 'fred','eia','cftc','massive','ibkr','shiller',...
  name               text NOT NULL,
  base_url           text,
  auth_type          text NOT NULL CHECK (auth_type IN ('none','api_key','oauth','broker','manual')),
  rate_limit_per_min integer,
  is_paid            boolean NOT NULL DEFAULT false,
  license_note       text,
  enabled            boolean NOT NULL DEFAULT true
);

CREATE TABLE ref.series (
  series_id        text PRIMARY KEY,        -- canonical: 'fred:DFF', 'eia:NG.NW2_EPG0_SWO_R48_BCF.W', 'calc:us_net_liquidity'
  source_id        text NOT NULL REFERENCES ref.data_source,
  source_code      text NOT NULL,           -- identifier at the source
  title            text NOT NULL,
  domain           text NOT NULL CHECK (domain IN
                     ('liquidity','rates','credit','growth','inflation','labor','energy','metals',
                      'equity','valuation','volatility','supply_chain','geopolitics','fx','positioning')),
  frequency        text NOT NULL CHECK (frequency IN
                     ('intraday','daily','weekly','monthly','quarterly','annual','irregular')),
  units            text,
  seasonal_adj     text,
  cache_ttl        interval NOT NULL,       -- never refetch inside this window
  release_lag      interval,                -- typical gap between obs date and publication
  has_vintages     boolean NOT NULL DEFAULT false,   -- source publishes revisions (ALFRED etc.)
  is_derived       boolean NOT NULL DEFAULT false,
  derivation       text,                    -- recipe for calc:* series, e.g. 'WALCL - WTREGEN - RRPONTSYD'
  first_obs        date,
  last_obs         date,
  last_fetched_at  timestamptz,
  next_due_at      timestamptz,             -- scheduler: fetch only when now() >= next_due_at
  critical         boolean NOT NULL DEFAULT false,   -- staleness of a critical series blocks trading
  active           boolean NOT NULL DEFAULT true,
  UNIQUE (source_id, source_code)
);
CREATE INDEX series_due_idx ON ref.series (next_due_at) WHERE active;

CREATE TABLE ref.instrument (
  instrument_id    text PRIMARY KEY,        -- 'SPX','XSP','EFA','EEM','GLD','SLV','/CL','/NG','TLT',...
  description      text NOT NULL,
  sleeve           text NOT NULL,           -- us_equity_index, intl_equity, energy, precious_metals, rates
  kind             text NOT NULL CHECK (kind IN ('index','etf','future','equity')),
  exchange         text,
  currency         text NOT NULL DEFAULT 'USD',
  multiplier       numeric NOT NULL,
  option_style     text CHECK (option_style IN ('american','european')),
  settlement       text CHECK (settlement IN ('cash','etf_shares','futures')),
  tax_1256         boolean NOT NULL DEFAULT false,   -- 60/40 tax treatment
  beta_proxy       text,                    -- symbol used for beta-weighting deltas
  min_option_oi    integer,
  max_spread_pct   numeric,                 -- max (ask-bid)/mid allowed to trade
  tradable         boolean NOT NULL DEFAULT true,
  phase            smallint NOT NULL DEFAULT 1,     -- rollout phase in which it becomes tradable
  notes            text
);

CREATE TABLE ref.calendar_event (
  event_id      bigserial PRIMARY KEY,
  event_type    text NOT NULL,              -- FOMC, CPI, NFP, PCE, ECB, BOJ, OPEC, EIA_STORAGE, ELECTION, ...
  scheduled_at  timestamptz NOT NULL,
  region        text NOT NULL DEFAULT 'US',
  importance    smallint NOT NULL CHECK (importance BETWEEN 1 AND 3),
  affects       text[] NOT NULL DEFAULT '{}',   -- sleeves / instrument_ids
  source_id     text REFERENCES ref.data_source,
  UNIQUE (event_type, scheduled_at, region)
);

-- =====================================================================
-- raw — the only door to the outside world
-- =====================================================================
CREATE TABLE raw.blob (
  sha256       char(64) PRIMARY KEY,        -- content address: same bytes are stored once
  storage_uri  text NOT NULL,               -- file://data/raw/fred/2026/11/<sha>.json.zst or storage bucket path
  media_type   text NOT NULL,
  bytes        bigint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE raw.fetch_log (
  fetch_id      bigserial PRIMARY KEY,
  source_id     text NOT NULL REFERENCES ref.data_source,
  series_id     text REFERENCES ref.series,
  request_hash  char(64) NOT NULL,          -- sha256(source|endpoint|sorted params): the dedupe key
  endpoint      text NOT NULL,
  params        jsonb NOT NULL DEFAULT '{}',
  requested_at  timestamptz NOT NULL DEFAULT now(),
  http_status   integer,
  ok            boolean NOT NULL,
  blob_sha256   char(64) REFERENCES raw.blob,
  rows_parsed   integer,
  rows_new      integer,                    -- 0 means the fetch added nothing: TTL tuning signal
  latency_ms    integer,
  error         text,
  run_id        uuid REFERENCES ops.run
);
CREATE INDEX fetch_log_dedupe_idx ON raw.fetch_log (request_hash, requested_at DESC);

-- =====================================================================
-- mkt — point-in-time market & macro data
-- =====================================================================
CREATE TABLE mkt.observation (
  series_id     text NOT NULL REFERENCES ref.series,
  obs_date      date NOT NULL,
  value         double precision,           -- NULL = source reported missing
  vintage_date  date NOT NULL,              -- when this value became known
  fetch_id      bigint REFERENCES raw.fetch_log,
  PRIMARY KEY (series_id, obs_date, vintage_date)
);

-- Latest known value for every observation date
CREATE VIEW mkt.observation_latest AS
SELECT DISTINCT ON (series_id, obs_date)
       series_id, obs_date, value, vintage_date
FROM mkt.observation
ORDER BY series_id, obs_date, vintage_date DESC;

-- What the world looked like on p_asof (no look-ahead): used by replays/backtests
CREATE FUNCTION mkt.observation_asof(p_series text, p_asof date)
RETURNS TABLE (obs_date date, value double precision)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (o.obs_date) o.obs_date, o.value
  FROM mkt.observation o
  WHERE o.series_id = p_series
    AND o.vintage_date <= p_asof
    AND o.obs_date <= p_asof
  ORDER BY o.obs_date, o.vintage_date DESC
$$;

CREATE TABLE mkt.price_bar (
  symbol      text NOT NULL,                -- any ticker, tradable or not (VIX, DXY, HG, ...)
  bar_interval text NOT NULL DEFAULT '1d',
  bar_date    date NOT NULL,
  open        double precision,
  high        double precision,
  low         double precision,
  close       double precision NOT NULL,
  volume      double precision,
  source_id   text NOT NULL REFERENCES ref.data_source,
  fetch_id    bigint REFERENCES raw.fetch_log,
  PRIMARY KEY (symbol, bar_interval, bar_date)
);

CREATE TABLE mkt.futures_curve_point (
  root            text NOT NULL,            -- CL, NG, GC, SI, ES, ZN, ZQ (fed funds)
  captured_on     date NOT NULL,
  contract_month  date NOT NULL,
  settle          double precision NOT NULL,
  open_interest   integer,
  source_id       text NOT NULL REFERENCES ref.data_source,
  fetch_id        bigint REFERENCES raw.fetch_log,
  PRIMARY KEY (root, captured_on, contract_month)
);

CREATE TABLE mkt.option_chain_snapshot (
  snapshot_id    bigserial PRIMARY KEY,
  underlying     text NOT NULL,
  captured_at    timestamptz NOT NULL,
  underlying_px  double precision NOT NULL,
  source_id      text NOT NULL REFERENCES ref.data_source,
  fetch_id       bigint REFERENCES raw.fetch_log,
  UNIQUE (underlying, captured_at)
);

CREATE TABLE mkt.option_quote (
  snapshot_id    bigint NOT NULL REFERENCES mkt.option_chain_snapshot ON DELETE CASCADE,
  expiry         date NOT NULL,
  strike         numeric NOT NULL,
  put_call       char(1) NOT NULL CHECK (put_call IN ('P','C')),
  bid            double precision,
  ask            double precision,
  last           double precision,
  iv             double precision,
  delta          double precision,
  gamma          double precision,
  theta          double precision,
  vega           double precision,
  open_interest  integer,
  volume         integer,
  PRIMARY KEY (snapshot_id, expiry, strike, put_call)
);

CREATE TABLE mkt.vol_metrics (
  underlying     text NOT NULL,
  as_of          date NOT NULL,
  atm_iv_30d     double precision,
  iv_rank_1y     double precision,          -- 0-100
  iv_pctile_1y   double precision,          -- 0-100
  rv_20d         double precision,
  rv_60d         double precision,
  vrp_30d        double precision,          -- implied minus realized: the premium we harvest
  skew_25d       double precision,          -- 25d put IV - 25d call IV
  term_slope     double precision,          -- IV(90d) - IV(30d); negative = backwardation/stress
  snapshot_id    bigint REFERENCES mkt.option_chain_snapshot,
  PRIMARY KEY (underlying, as_of)
);

-- =====================================================================
-- research — what the agents concluded, and why
-- =====================================================================
CREATE TABLE research.document (
  doc_id        bigserial PRIMARY KEY,
  url           text,
  url_hash      char(64) UNIQUE,            -- dedupe news/articles
  title         text,
  publisher     text,
  published_at  timestamptz,
  retrieved_at  timestamptz NOT NULL DEFAULT now(),
  blob_sha256   char(64) REFERENCES raw.blob,
  summary       text,
  entities      text[] NOT NULL DEFAULT '{}',
  topics        text[] NOT NULL DEFAULT '{}',
  trust_tier    smallint CHECK (trust_tier BETWEEN 1 AND 3)   -- 1 = primary source (central bank, EIA)
);

CREATE TABLE research.geo_event (
  geo_event_id      bigserial PRIMARY KEY,
  title             text NOT NULL,
  region            text,
  category          text NOT NULL CHECK (category IN
                      ('conflict','sanctions','trade_policy','election','chokepoint',
                       'energy_supply','monetary_politics','fiscal','other')),
  status            text NOT NULL CHECK (status IN
                      ('watch','active','escalating','de_escalating','resolved')),
  probability       double precision CHECK (probability BETWEEN 0 AND 1),
  severity          smallint CHECK (severity BETWEEN 1 AND 5),
  channels          text[] NOT NULL DEFAULT '{}',   -- oil_supply, shipping, semis, food, usd, risk_off
  affected_sleeves  text[] NOT NULL DEFAULT '{}',
  first_seen        date NOT NULL,
  last_updated      timestamptz NOT NULL DEFAULT now(),
  evidence_doc_ids  bigint[] NOT NULL DEFAULT '{}'
);

-- Deterministic calculations (CAPE percentiles, net liquidity z-scores, ...)
CREATE TABLE research.derived_metric (
  metric_id     text NOT NULL,              -- 'us_cape', 'acwi_xus_cape', 'us_excess_cape_yield', 'us_net_liquidity'
  as_of         date NOT NULL,
  code_version  text NOT NULL,
  value         double precision NOT NULL,
  pctile_10y    double precision,
  pctile_20y    double precision,
  pctile_full   double precision,
  z_10y         double precision,
  z_20y         double precision,
  inputs        jsonb NOT NULL,             -- series_ids + vintages used: full lineage
  run_id        uuid REFERENCES ops.run,
  PRIMARY KEY (metric_id, as_of, code_version)
);

CREATE TABLE research.report (
  report_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES ops.run,
  agent_id          text NOT NULL,
  as_of             timestamptz NOT NULL,
  contract_version  text NOT NULL,          -- contracts/research_report.schema.json version
  payload           jsonb NOT NULL,         -- the validated structured output
  summary           text NOT NULL,
  confidence        double precision CHECK (confidence BETWEEN 0 AND 1),
  status            text NOT NULL CHECK (status IN ('draft','validated','rejected','superseded')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, agent_id)
);

CREATE TABLE research.signal (
  report_id     uuid NOT NULL REFERENCES research.report ON DELETE CASCADE,
  signal_name   text NOT NULL,              -- 'us_net_liquidity_13w_impulse'
  sleeve        text,
  direction     smallint CHECK (direction IN (-1, 0, 1)),
  strength      double precision CHECK (strength BETWEEN -3 AND 3),
  horizon_days  integer,
  value         double precision,
  PRIMARY KEY (report_id, signal_name)
);

-- Citation ledger: every number in a report must resolve to stored data
CREATE TABLE research.evidence (
  evidence_id   bigserial PRIMARY KEY,
  report_id     uuid NOT NULL REFERENCES research.report ON DELETE CASCADE,
  claim         text NOT NULL,
  series_id     text REFERENCES ref.series,
  obs_date      date,
  cited_value   double precision,
  metric_id     text,
  doc_id        bigint REFERENCES research.document,
  verified      boolean,                    -- set by the citation checker
  verified_at   timestamptz,
  CHECK (series_id IS NOT NULL OR metric_id IS NOT NULL OR doc_id IS NOT NULL)
);

-- Falsifiable forecasts: the raw material for calibration and agent scorecards
CREATE TABLE research.view (
  view_id          bigserial PRIMARY KEY,
  report_id        uuid NOT NULL REFERENCES research.report,
  instrument_id    text REFERENCES ref.instrument,
  statement        text NOT NULL,
  direction        smallint CHECK (direction IN (-1, 0, 1)),
  probability      double precision NOT NULL CHECK (probability BETWEEN 0 AND 1),
  horizon_days     integer NOT NULL,
  resolve_on       date NOT NULL,
  resolution_rule  text NOT NULL,           -- machine-checkable, e.g. 'close(GLD, resolve_on) > 0.95*close(GLD, as_of)'
  outcome          boolean,
  resolved_at      timestamptz,
  brier            double precision
);
CREATE INDEX view_resolve_idx ON research.view (resolve_on) WHERE outcome IS NULL;

-- =====================================================================
-- pm — portfolio management
-- =====================================================================
CREATE TABLE pm.regime_assessment (
  assessment_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES ops.run,
  as_of               date NOT NULL,
  growth_score        double precision NOT NULL,   -- z-score, level + momentum
  inflation_score     double precision NOT NULL,
  liquidity_score     double precision NOT NULL,
  stress_score        double precision NOT NULL,
  p_goldilocks        double precision NOT NULL CHECK (p_goldilocks BETWEEN 0 AND 1),
  p_reflation         double precision NOT NULL CHECK (p_reflation  BETWEEN 0 AND 1),
  p_stagflation       double precision NOT NULL CHECK (p_stagflation BETWEEN 0 AND 1),
  p_deflation         double precision NOT NULL CHECK (p_deflation  BETWEEN 0 AND 1),
  dominant_regime     text GENERATED ALWAYS AS (
                        CASE GREATEST(p_goldilocks, p_reflation, p_stagflation, p_deflation)
                          WHEN p_goldilocks  THEN 'goldilocks'
                          WHEN p_reflation   THEN 'reflation'
                          WHEN p_stagflation THEN 'stagflation'
                          ELSE 'deflation'
                        END) STORED,
  regime_change_risk  double precision CHECK (regime_change_risk BETWEEN 0 AND 1),
  quant_prior         jsonb NOT NULL,             -- deterministic model output
  llm_adjustment      jsonb,                      -- bounded deltas (max ±15pp each) + justification
  report_id           uuid REFERENCES research.report,
  CHECK (abs(p_goldilocks + p_reflation + p_stagflation + p_deflation - 1) < 0.001)
);

CREATE TABLE pm.target_exposure (
  run_id                 uuid NOT NULL REFERENCES ops.run,
  sleeve                 text NOT NULL,
  direction              smallint NOT NULL CHECK (direction IN (-1, 0, 1)),
  conviction             double precision NOT NULL CHECK (conviction BETWEEN 0 AND 1),
  target_delta_pct_nav   double precision NOT NULL,   -- beta-weighted $delta / NAV
  max_bpr_pct_nav        double precision NOT NULL,
  risk_budget_pct        double precision NOT NULL,   -- share of the stress-loss budget
  rationale              text NOT NULL,
  red_team_response      text,
  PRIMARY KEY (run_id, sleeve)
);

CREATE TABLE pm.trade_proposal (
  proposal_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES ops.run,
  sleeve           text NOT NULL,
  instrument_id    text NOT NULL REFERENCES ref.instrument,
  action           text NOT NULL CHECK (action IN ('open','close','roll','adjust')),
  structure        text NOT NULL CHECK (structure IN
                     ('short_put','put_credit_spread','call_credit_spread',
                      'iron_condor','short_strangle','covered_call')),
  legs             jsonb NOT NULL,          -- [{put_call, strike, expiry, side, ratio}]
  quantity         integer NOT NULL CHECK (quantity > 0),
  credit_per_unit  numeric,
  max_loss         numeric,                 -- NULL only for naked structures (then stress_loss applies)
  stress_loss      numeric,                 -- loss in worst policy scenario
  bpr              numeric NOT NULL,        -- broker buying-power reduction
  pop              double precision,        -- probability of profit (model)
  delta_dollars    numeric,
  vega_dollars     numeric,
  theta_dollars    numeric,
  dte              integer,
  limit_price      numeric,
  rationale        text NOT NULL,
  report_ids       uuid[] NOT NULL DEFAULT '{}',   -- lineage back to research
  status           text NOT NULL DEFAULT 'proposed' CHECK (status IN
                     ('proposed','risk_blocked','risk_passed','approved','rejected',
                      'sent','filled','cancelled','expired')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pm.risk_check (
  check_id        bigserial PRIMARY KEY,
  run_id          uuid NOT NULL REFERENCES ops.run,
  proposal_id     uuid REFERENCES pm.trade_proposal,  -- NULL = portfolio-level check
  rule_id         text NOT NULL,                      -- key in config/risk_policy.yaml
  policy_version  text NOT NULL,
  passed          boolean NOT NULL,
  observed        double precision,
  limit_value     double precision,
  severity        text NOT NULL CHECK (severity IN ('info','warn','block')),
  message         text NOT NULL,
  checked_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pm.approval (
  approval_id  bigserial PRIMARY KEY,
  proposal_id  uuid NOT NULL REFERENCES pm.trade_proposal,
  decision     text NOT NULL CHECK (decision IN ('approved','rejected','modified')),
  decided_by   text NOT NULL,
  decided_at   timestamptz NOT NULL DEFAULT now(),
  comment      text
);

CREATE TABLE pm.order_ticket (
  order_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      uuid NOT NULL REFERENCES pm.trade_proposal,
  mode             text NOT NULL CHECK (mode IN ('paper','live')),
  broker           text NOT NULL,
  broker_order_id  text,
  idempotency_key  text NOT NULL UNIQUE,    -- a retried submit can never double-fill
  status           text NOT NULL CHECK (status IN
                     ('staged','submitted','working','partial','filled','cancelled','rejected')),
  payload          jsonb NOT NULL,
  submitted_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pm.fill (
  fill_id    bigserial PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES pm.order_ticket,
  filled_at  timestamptz NOT NULL,
  leg        jsonb NOT NULL,
  quantity   integer NOT NULL,
  price      numeric NOT NULL,
  fees       numeric NOT NULL DEFAULT 0
);

CREATE TABLE pm.position (
  position_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id    uuid REFERENCES pm.trade_proposal,
  instrument_id  text NOT NULL REFERENCES ref.instrument,
  sleeve         text NOT NULL,
  structure      text NOT NULL,
  legs           jsonb NOT NULL,
  quantity       integer NOT NULL,
  opened_at      timestamptz NOT NULL,
  open_credit    numeric NOT NULL,
  management     jsonb NOT NULL,            -- {take_profit_pct, time_exit_dte, stop_multiple, defend_delta}
  status         text NOT NULL CHECK (status IN ('open','closed','assigned','expired')),
  closed_at      timestamptz,
  close_debit    numeric,
  realized_pnl   numeric
);

CREATE TABLE pm.position_mark (
  position_id         uuid NOT NULL REFERENCES pm.position,
  as_of               date NOT NULL,
  mark                numeric NOT NULL,
  unrealized_pnl      numeric NOT NULL,
  pct_of_max_profit   double precision,
  delta_dollars       numeric,
  gamma_dollars       numeric,
  vega_dollars        numeric,
  theta_dollars       numeric,
  dte                 integer,
  short_strike_delta  double precision,
  triggers            text[] NOT NULL DEFAULT '{}',   -- 'take_profit','time_exit','stop','defend','event'
  PRIMARY KEY (position_id, as_of)
);

CREATE TABLE pm.nav_daily (
  as_of              date PRIMARY KEY,
  nav                numeric NOT NULL,
  collateral_value   numeric NOT NULL,      -- T-bills / money-market
  collateral_income  numeric NOT NULL,
  options_pnl        numeric NOT NULL,
  fees               numeric NOT NULL DEFAULT 0,
  bpr_used           numeric NOT NULL,
  fed_funds_rate     double precision NOT NULL,   -- hurdle (fred:DFF)
  ret_day            double precision NOT NULL,
  hurdle_ret_day     double precision NOT NULL,
  excess_ret_day     double precision GENERATED ALWAYS AS (ret_day - hurdle_ret_day) STORED,
  peak_nav           numeric NOT NULL,
  drawdown           double precision NOT NULL
);

-- =====================================================================
-- ops — harness telemetry, evals, memory
-- =====================================================================
CREATE TABLE ops.agent_step (
  step_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES ops.run,
  agent_id            text NOT NULL,
  parent_step_id      uuid REFERENCES ops.agent_step,
  attempt             smallint NOT NULL DEFAULT 1,
  status              text NOT NULL CHECK (status IN
                        ('running','succeeded','failed','retrying','skipped','timed_out')),
  model               text,
  effort              text,
  prompt_version      text NOT NULL,        -- git path@sha of the agent charter
  context_pack_hash   char(64),             -- exactly what the agent saw
  input_tokens        integer,
  output_tokens       integer,
  cache_read_tokens   integer,
  cache_write_tokens  integer,
  cost_usd            numeric(10,4),
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  error               text,
  output_report_id    uuid REFERENCES research.report
);
CREATE INDEX agent_step_run_idx ON ops.agent_step (run_id, agent_id);

CREATE TABLE ops.tool_call (
  call_id         bigserial PRIMARY KEY,
  step_id         uuid NOT NULL REFERENCES ops.agent_step,
  tool_name       text NOT NULL,
  input           jsonb NOT NULL,
  output_digest   char(64),
  output_rows     integer,
  allowed         boolean NOT NULL,         -- false = blocked by the permission layer
  blocked_reason  text,
  latency_ms      integer,
  called_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ops.validation_result (
  validation_id  bigserial PRIMARY KEY,
  step_id        uuid NOT NULL REFERENCES ops.agent_step,
  validator      text NOT NULL CHECK (validator IN
                   ('schema','freshness','citation','numeric_consistency','policy','redteam','human')),
  passed         boolean NOT NULL,
  details        jsonb,
  remediation    text,                      -- fed back to the agent on retry
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ops.lesson (
  lesson_id         bigserial PRIMARY KEY,
  agent_id          text,                   -- NULL = applies to all agents
  created_from_run  uuid REFERENCES ops.run,
  lesson            text NOT NULL,
  tags              text[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retired')),
  accepted_by       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ops.eval_case (
  case_id      text PRIMARY KEY,            -- 'covid_crash_2020_03_16', 'yen_unwind_2024_08_05'
  name         text NOT NULL,
  as_of        date NOT NULL,
  description  text NOT NULL,
  expected     jsonb NOT NULL,              -- e.g. {"risk_engine": "block_new_naked_puts"}
  tags         text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE ops.eval_result (
  case_id  text NOT NULL REFERENCES ops.eval_case,
  run_id   uuid NOT NULL REFERENCES ops.run,
  passed   boolean NOT NULL,
  score    double precision,
  details  jsonb,
  PRIMARY KEY (case_id, run_id)
);

CREATE TABLE ops.incident (
  incident_id  bigserial PRIMARY KEY,
  run_id       uuid REFERENCES ops.run,
  severity     text NOT NULL CHECK (severity IN ('sev1','sev2','sev3')),
  kind         text NOT NULL,               -- 'limit_breach','stale_critical_data','adapter_down','budget_exceeded'
  message      text NOT NULL,
  opened_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolution   text
);
