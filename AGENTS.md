# AGENTS.md

Map of this repository for humans and coding agents. Read this first, then follow the links; detail lives in the linked files, not here.

## What this is

Macro Trader v2: a harness of Claude agents that research global macro (liquidity, rates, growth/inflation, geopolitics, supply chain, energy, metals, US and international equities, valuation, volatility), classify the regime, and propose out-of-the-money short-option trades for a $1M book whose hurdle is the Fed funds rate. Code computes and enforces; models judge; a human approves every trade.

**Status:** design approval (Phase 0). v1 (React + Supabase questionnaire app in `src/` and `supabase/`) still runs and will be rebuilt as v2 lands.

## Where things live

| Need | Go to |
|---|---|
| The design and its rationale | [docs/design/DESIGN.md](docs/design/DESIGN.md) |
| How the harness works | [docs/design/HARNESS.md](docs/design/HARNESS.md) |
| Decisions waiting on the owner | [docs/design/OPEN_QUESTIONS.md](docs/design/OPEN_QUESTIONS.md) |
| Visual blueprint / dashboard of the plan | [docs/design/blueprint.html](docs/design/blueprint.html) |
| Agent registry (missions, tools, effort, outputs) | [config/agents.yaml](config/agents.yaml) |
| Runtime: Claude Code cloud on the Pro plan, schedules, secrets, network allow-list | [config/runtime.yaml](config/runtime.yaml) |
| Hard risk limits | [config/risk_policy.yaml](config/risk_policy.yaml) |
| Tradable universe | [config/universe.yaml](config/universe.yaml) |
| Data sources, TTLs, seed series | [config/data_sources.yaml](config/data_sources.yaml) |
| Output contracts | [contracts/](contracts) |
| Database schema (system of record) | [db/schema/001_core.sql](db/schema/001_core.sql) |

## Golden rules (never violate)

1. Models judge; code computes, controls the flow and enforces limits.
2. If it is not in the database with provenance, it does not exist.
3. Only the Data Steward calls external data APIs, and never downloads the same thing twice.
4. Every number in an agent's output cites stored evidence.
5. Outputs are typed contracts; invalid output is returned with a remediation message, never silently fixed.
6. Least-privilege tools; research agents are read-only; no model can reach the broker.
7. `config/risk_policy.yaml` changes only through a PR the owner approves. Agents never edit it.
8. Paper mode by default; every ticket needs human approval.
9. Replays are point-in-time (use `mkt.observation_asof`), never look-ahead.
10. Every step is logged with its context hash and cost.

## Working in this repo

- Schema changes: add a new numbered file in `db/schema/` (later `supabase/migrations/`); never edit an applied migration.
- New data series: add it to `config/data_sources.yaml` with a TTL and owner agent; the Steward picks it up.
- New agent or tool: register it in `config/agents.yaml`, add its contract to `contracts/`, add a golden eval case.
- Before proposing a PR: run the schema, contract and policy tests (commands arrive with the Phase 1 harness package).
