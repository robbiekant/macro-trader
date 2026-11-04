"""Run 0 deterministic metrics: parse stored raw payloads (data/run0/manifest.json) and compute
every number the agents are allowed to cite. Output: data/run0/metrics.json + data/run0/observations.csv.gz

No network access. No model judgment. Phase 1 replaces this with harness/data + research.derived_metric.
"""
from __future__ import annotations

import gzip
import io
import json
import math
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "run0"
import datetime as _dt
AS_OF = _dt.date.today().isoformat()

manifest = json.loads((OUT / "manifest.json").read_text())
PATHS: dict[str, list] = {}
for e in manifest:            # every successful payload per series, oldest first; later payloads win on overlap
    if e["ok"]:
        PATHS.setdefault(e["series_id"], []).append((e["path"], e["sha256"], e["fetched_at"]))


def raw(sid: str) -> bytes:
    return gzip.decompress((ROOT / PATHS[sid][-1][0]).read_bytes())


def raws(sid: str):
    for path, _, _ in PATHS[sid]:
        yield gzip.decompress((ROOT / path).read_bytes())


# ---------------------------------------------------------------- loaders
def fred(code: str) -> pd.Series:
    vals = {}
    for body in raws(f"fred:{code}"):
        for o in json.loads(body)["observations"]:
            if o["value"] not in (".", ""):
                vals[pd.Timestamp(o["date"])] = float(o["value"])
    s = pd.Series(vals)
    s.name = f"fred:{code}"
    return s.sort_index()


def eia(code: str) -> pd.Series:
    vals = {}
    for body in raws(f"eia:{code}"):
        for d in json.loads(body)["response"]["data"]:
            if d.get("value") is not None:
                vals[pd.Timestamp(d["period"])] = float(d["value"])
    s = pd.Series(vals)
    s.name = f"eia:{code}"
    return s.sort_index()


def etf(t: str) -> pd.Series:
    vals = {}
    for body in raws(f"massive:{t}"):
        for r in json.loads(body).get("results", []):
            vals[pd.Timestamp(r["t"], unit="ms").normalize()] = float(r["c"])
    s = pd.Series(vals)
    s.name = f"massive:{t}"
    return s.sort_index()


# ---------------------------------------------------------------- helpers
def last(s: pd.Series):
    s = s.dropna()
    return s.index[-1], float(s.iloc[-1])


def at_or_before(s: pd.Series, when: pd.Timestamp) -> float:
    s = s.dropna()
    s = s[s.index <= when]
    return float(s.iloc[-1]) if len(s) else float("nan")


def chg(s: pd.Series, days: int, pct: bool = False) -> float:
    d, v = last(s)
    prev = at_or_before(s, d - pd.Timedelta(days=days))
    if pct:
        return (v / prev - 1) * 100 if prev else float("nan")
    return v - prev


def pctile(s: pd.Series, years: int | None, value: float | None = None) -> float:
    s = s.dropna()
    d, v = last(s)
    if value is not None:
        v = value
    w = s if years is None else s[s.index > d - pd.DateOffset(years=years)]
    return float((w <= v).mean() * 100)


def zscore(s: pd.Series, years: int = 10, value: float | None = None) -> float:
    s = s.dropna()
    d, v = last(s)
    if value is not None:
        v = value
    w = s[s.index > d - pd.DateOffset(years=years)]
    sd = w.std()
    return float((v - w.mean()) / sd) if sd else float("nan")


def yoy(s: pd.Series, periods: int = 12) -> pd.Series:
    return (s / s.shift(periods) - 1) * 100


def ann3m(s: pd.Series) -> pd.Series:   # monthly index level -> 3-month annualized %
    return ((s / s.shift(3)) ** 4 - 1) * 100


def rv(px: pd.Series, n: int = 20) -> float:
    r = np.log(px).diff().dropna()
    return float(r.iloc[-n:].std() * math.sqrt(252) * 100)


def ma(px: pd.Series, n: int) -> float:
    return float(px.iloc[-n:].mean())


def r(x, nd=2):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(float(x), nd)


def ev(sid: str, s: pd.Series):   # evidence handle: series + last obs date + value
    d, v = last(s)
    return {"series_id": sid, "obs_date": d.date().isoformat(), "value": r(v, 4)}


M: dict = {"as_of": AS_OF, "evidence": {}, "freshness": []}


def put(key: str, value, evidence=None):
    M[key] = value
    if evidence:
        M["evidence"][key] = evidence


# ---------------------------------------------------------------- load FRED
F = {}
for sid in PATHS:
    if sid.startswith("fred:"):
        F[sid[5:]] = fred(sid[5:])

for code, s in F.items():
    d, v = last(s)
    M["freshness"].append({"id": f"fred:{code}", "last_obs": d.date().isoformat(),
                           "age_days": (pd.Timestamp(AS_OF) - d).days})

# ---------------------------------------------------------------- liquidity
walcl = F["WALCL"] / 1000            # $bn (source in $mn)
tga = F["WTREGEN"] / 1000            # $bn (source in $mn)
rrp = F["RRPONTSYD"]                 # $bn
weekly = pd.DataFrame({"walcl": walcl, "tga": tga}).dropna()
rrp_w = rrp.reindex(weekly.index, method="ffill")
netliq = (weekly["walcl"] - weekly["tga"] - rrp_w).dropna()
netliq.name = "calc:us_net_liquidity"
nl_13w = netliq.diff(13)
liq = {
    "net_liquidity_bn": r(last(netliq)[1], 0), "net_liquidity_date": last(netliq)[0].date().isoformat(),
    "net_liq_chg_4w_bn": r(netliq.diff(4).iloc[-1], 0), "net_liq_chg_13w_bn": r(nl_13w.iloc[-1], 0),
    "net_liq_chg_52w_bn": r(netliq.diff(52).iloc[-1], 0),
    "net_liq_13w_impulse_z10y": r(zscore(nl_13w, 10)),
    "fed_assets_bn": r(last(walcl)[1], 0), "fed_assets_chg_13w_bn": r(walcl.diff(13).dropna().iloc[-1], 0),
    "tga_bn": r(last(tga)[1], 0), "rrp_bn": r(last(rrp)[1], 1),
    "reserves_bn": r(last(F["WRESBAL"])[1] / 1000, 0), "reserves_chg_13w_bn": r(chg(F["WRESBAL"], 91) / 1000, 0),
    "m2_yoy_pct": r(yoy(F["M2SL"]).iloc[-1]),
    "ecb_assets_chg_13w_pct": r(chg(F["ECBASSETSW"], 91, pct=True)),
    "boj_assets_chg_3m_pct": r(chg(F["JPNASSETS"], 92, pct=True)),
    "usd_broad": r(last(F["DTWEXBGS"])[1]), "usd_broad_chg_3m_pct": r(chg(F["DTWEXBGS"], 91, pct=True)),
    "usd_broad_chg_12m_pct": r(chg(F["DTWEXBGS"], 365, pct=True)), "usd_pctile_10y": r(pctile(F["DTWEXBGS"], 10), 0),
    "nfci": r(last(F["NFCI"])[1]), "nfci_chg_13w": r(chg(F["NFCI"], 91)),
    "usdjpy": r(last(F["DEXJPUS"])[1]), "usdjpy_chg_3m_pct": r(chg(F["DEXJPUS"], 91, pct=True)),
}
put("liquidity", liq, {"net_liquidity_bn": ev("calc:us_net_liquidity", netliq), "fed_assets": ev("fred:WALCL", F["WALCL"]),
                       "tga": ev("fred:WTREGEN", tga), "rrp": ev("fred:RRPONTSYD", rrp),
                       "usd_broad": ev("fred:DTWEXBGS", F["DTWEXBGS"]), "nfci": ev("fred:NFCI", F["NFCI"])})
liq_score = float(np.clip(0.6 * (liq["net_liq_13w_impulse_z10y"] or 0) - 0.5 * (liq["nfci"] or 0) * 2
                          - 0.15 * (liq["usd_broad_chg_3m_pct"] or 0), -3, 3))

# ---------------------------------------------------------------- rates & credit
hy, ig = F["BAMLH0A0HYM2"], F["BAMLC0A0CM"]
rates = {
    "fed_funds_eff": r(last(F["DFF"])[1]), "fed_target_upper": r(last(F["DFEDTARU"])[1]), "sofr": r(last(F["SOFR"])[1]),
    "t3m": r(last(F["DGS3MO"])[1]), "t2y": r(last(F["DGS2"])[1]), "t10y": r(last(F["DGS10"])[1]), "t30y": r(last(F["DGS30"])[1]),
    "t2y_chg_3m_bp": r(chg(F["DGS2"], 91) * 100, 0), "t10y_chg_3m_bp": r(chg(F["DGS10"], 91) * 100, 0),
    "slope_10y3m_bp": r(last(F["T10Y3M"])[1] * 100, 0), "slope_10y2y_bp": r(last(F["T10Y2Y"])[1] * 100, 0),
    "slope_10y3m_chg_3m_bp": r(chg(F["T10Y3M"], 91) * 100, 0),
    "real_10y": r(last(F["DFII10"])[1]), "real_10y_chg_3m_bp": r(chg(F["DFII10"], 91) * 100, 0),
    "breakeven_10y": r(last(F["T10YIE"])[1]), "fwd_5y5y_infl": r(last(F["T5YIFR"])[1]),
    "hy_oas": r(last(hy)[1]), "hy_oas_chg_1m_bp": r(chg(hy, 30) * 100, 0), "hy_oas_pctile_10y": r(pctile(hy, 10), 0),
    "hy_oas_pctile_20y": r(pctile(hy, 20), 0), "ig_oas": r(last(ig)[1]), "ig_oas_pctile_10y": r(pctile(ig, 10), 0),
    "ecb_depo": r(last(F["ECBDFR"])[1]),
    "fed_funds_chg_6m_bp": r(chg(F["DFF"], 182) * 100, 0),
    "market_implied_path_bp_2y_minus_ff": r((last(F["DGS2"])[1] - last(F["DFF"])[1]) * 100, 0),
}
put("rates", rates, {k: ev(f"fred:{c}", F[c]) for k, c in
                     [("fed_funds_eff", "DFF"), ("t2y", "DGS2"), ("t10y", "DGS10"), ("real_10y", "DFII10"),
                      ("hy_oas", "BAMLH0A0HYM2"), ("ig_oas", "BAMLC0A0CM"), ("slope_10y3m", "T10Y3M"),
                      ("fwd_5y5y_infl", "T5YIFR")]})
stress_score = float(np.clip(zscore(hy, 10) * 0.6 + (liq["nfci"] or 0) * 2 * 0.4, -3, 3))

# ---------------------------------------------------------------- growth & inflation
core_cpi_3m = ann3m(F["CPILFESL"]); core_cpi_yoy = yoy(F["CPILFESL"]); cpi_yoy = yoy(F["CPIAUCSL"])
core_pce_3m = ann3m(F["PCEPILFE"]); core_pce_yoy = yoy(F["PCEPILFE"])
pay_3m = F["PAYEMS"].diff().rolling(3).mean()
claims_4w = F["ICSA"].rolling(4).mean()
claims_yoy = yoy(claims_4w, 52)
indpro_yoy = yoy(F["INDPRO"]); retail_yoy = yoy(F["RSAFS"])
growth_parts = {
    "payrolls_3m_avg_k": (pay_3m, +1), "claims_4w_yoy_pct": (claims_yoy, -1), "sahm": (F["SAHMREALTIME"], -1),
    "indpro_yoy_pct": (indpro_yoy, +1), "philly_fed": (F["GACDFSA066MSFRBPHI"], +1), "gdpnow": (F["GDPNOW"], +1),
    "retail_sales_yoy_pct": (retail_yoy, +1),
}
infl_parts = {
    "core_cpi_3m_ann": (core_cpi_3m, +1), "core_pce_yoy": (core_pce_yoy, +1), "breakeven_10y": (F["T10YIE"], +1),
    "umich_1y_expect": (F["MICH"], +1), "core_cpi_momentum": (core_cpi_3m - core_cpi_yoy, +1),
}


def score(parts):
    zs = {}
    for k, (s, sign) in parts.items():
        s = s.dropna()
        if len(s) > 24:
            zs[k] = sign * float(np.clip(zscore(s, 10), -3, 3))
    return float(np.mean(list(zs.values()))), zs


g_score, g_z = score(growth_parts)
i_score, i_z = score(infl_parts)
# momentum: same composite three months earlier
def score_at(parts, months_back):
    vals = []
    for k, (s, sign) in parts.items():
        s = s.dropna()
        if len(s) > 40:
            cut = s.index[-1] - pd.DateOffset(months=months_back)
            sb = s[s.index <= cut]
            if len(sb) > 24:
                vals.append(sign * float(np.clip(zscore(sb, 10), -3, 3)))
    return float(np.mean(vals)) if vals else float("nan")


g_prev, i_prev = score_at(growth_parts, 3), score_at(infl_parts, 3)
g_dir = g_score + 0.5 * (g_score - g_prev)      # level + momentum
i_dir = i_score + 0.5 * (i_score - i_prev)

macro = {
    "cpi_yoy": r(cpi_yoy.iloc[-1]), "core_cpi_yoy": r(core_cpi_yoy.iloc[-1]), "core_cpi_3m_ann": r(core_cpi_3m.iloc[-1]),
    "core_pce_yoy": r(core_pce_yoy.iloc[-1]), "core_pce_3m_ann": r(core_pce_3m.iloc[-1]),
    "cpi_date": last(F["CPILFESL"])[0].date().isoformat(), "pce_date": last(F["PCEPILFE"])[0].date().isoformat(),
    "unrate": r(last(F["UNRATE"])[1], 1), "unrate_chg_12m": r(chg(F["UNRATE"], 365), 1), "unrate_date": last(F["UNRATE"])[0].date().isoformat(),
    "sahm": r(last(F["SAHMREALTIME"])[1]), "payrolls_3m_avg_k": r(pay_3m.iloc[-1], 0), "payrolls_date": last(F["PAYEMS"])[0].date().isoformat(),
    "claims_4w_k": r(claims_4w.iloc[-1] / 1000, 0), "claims_4w_yoy_pct": r(claims_yoy.iloc[-1], 1),
    "claims_date": last(F["ICSA"])[0].date().isoformat(), "continuing_claims_k": r(last(F["CCSA"])[1] / 1000, 0),
    "indpro_yoy": r(indpro_yoy.iloc[-1]), "retail_sales_yoy": r(retail_yoy.iloc[-1]),
    "gdpnow": r(last(F["GDPNOW"])[1]), "gdpnow_date": last(F["GDPNOW"])[0].date().isoformat(),
    "umich_1y_expect": r(last(F["MICH"])[1], 1), "philly_fed": r(last(F["GACDFSA066MSFRBPHI"])[1], 1),
    "growth_score": r(g_score), "growth_score_3m_ago": r(g_prev), "growth_direction": r(g_dir),
    "inflation_score": r(i_score), "inflation_score_3m_ago": r(i_prev), "inflation_direction": r(i_dir),
    "growth_components_z": {k: r(v) for k, v in g_z.items()}, "inflation_components_z": {k: r(v) for k, v in i_z.items()},
}
put("macro", macro, {"core_cpi": ev("fred:CPILFESL", F["CPILFESL"]), "core_pce": ev("fred:PCEPILFE", F["PCEPILFE"]),
                     "unrate": ev("fred:UNRATE", F["UNRATE"]), "claims": ev("fred:ICSA", F["ICSA"]),
                     "gdpnow": ev("fred:GDPNOW", F["GDPNOW"]), "payrolls": ev("fred:PAYEMS", F["PAYEMS"]),
                     "sahm": ev("fred:SAHMREALTIME", F["SAHMREALTIME"])})

# regime prior: independent normal uncertainty around the two directions
from math import erf, sqrt
Phi = lambda x: 0.5 * (1 + erf(x / sqrt(2)))
SIG = 0.6
pg, pi = Phi(g_dir / SIG), Phi(i_dir / SIG)
prior = {"goldilocks": pg * (1 - pi), "reflation": pg * pi, "stagflation": (1 - pg) * pi, "deflation": (1 - pg) * (1 - pi)}
put("regime_prior", {k: r(v, 3) for k, v in prior.items()} | {"sigma": SIG, "p_growth_rising": r(pg, 3), "p_inflation_rising": r(pi, 3),
                     "liquidity_score": r(liq_score), "stress_score": r(stress_score)})

# ---------------------------------------------------------------- supply chain & geopolitics
gs = pd.read_excel(io.BytesIO(raw("nyfed:GSCPI")), "GSCPI Monthly Data")[["Date", "GSCPI"]].dropna()
gs["Date"] = pd.to_datetime(gs["Date"], format="%d-%b-%Y")
gscpi = gs.set_index("Date")["GSCPI"].astype(float); gscpi.name = "nyfed:GSCPI"
gpr = pd.read_excel(io.BytesIO(raw("gpr:daily")))
gpr["date"] = pd.to_datetime(gpr["date"])
gprd = gpr.set_index("date")["GPRD"].astype(float).dropna(); gprd.name = "gpr:GPRD"
gpr30 = gprd.rolling(30).mean().dropna()
epu30 = F["USEPUINDXD"].rolling(30).mean().dropna()
supply = {"gscpi": r(last(gscpi)[1]), "gscpi_date": last(gscpi)[0].date().isoformat(), "gscpi_chg_3m": r(chg(gscpi, 92)),
          "gscpi_pctile_20y": r(pctile(gscpi, 20), 0), "inventories_to_sales": r(last(F["ISRATIO"])[1]),
          "isratio_chg_12m": r(chg(F["ISRATIO"], 365))}
geo = {"gpr_daily_last": r(last(gprd)[1], 1), "gpr_date": last(gprd)[0].date().isoformat(),
       "gpr_30d_avg": r(last(gpr30)[1], 1), "gpr_30d_pctile_10y": r(pctile(gpr30, 10), 0), "gpr_30d_pctile_20y": r(pctile(gpr30, 20), 0),
       "gpr_30d_chg_3m": r(chg(gpr30, 92), 1),
       "epu_30d_avg": r(last(epu30)[1], 0), "epu_30d_pctile_10y": r(pctile(epu30, 10), 0)}
put("supply_chain", supply, {"gscpi": ev("nyfed:GSCPI", gscpi), "isratio": ev("fred:ISRATIO", F["ISRATIO"])})
put("geopolitics", geo, {"gpr_30d": ev("calc:gpr_30d_avg", gpr30), "gpr_daily": ev("gpr:GPRD", gprd),
                         "epu_30d": ev("calc:epu_30d_avg", epu30)})

# ---------------------------------------------------------------- energy
wti, brent, hh = F["DCOILWTICO"], F["DCOILBRENTEU"], F["DHHNGSP"]
crude = eia("PET.WCESTUS1.W"); cush = eia("PET.W_EPC0_SAX_YCUOK_MBBL.W"); prod = eia("PET.WCRFPUS2.W"); ngs = eia("NG.NW2_EPG0_SWO_R48_BCF.W")


def vs_5y(s: pd.Series):
    d, v = last(s)
    wk = d.isocalendar().week
    hist = [at_or_before(s, d - pd.DateOffset(years=k)) for k in range(1, 6)]
    avg = float(np.nanmean(hist))
    return v, avg, (v / avg - 1) * 100


cv, cavg, cdev = vs_5y(crude); nv, navg, ndev = vs_5y(ngs); kv, kavg, kdev = vs_5y(cush)
energy = {"wti": r(last(wti)[1]), "wti_date": last(wti)[0].date().isoformat(), "wti_chg_1m_pct": r(chg(wti, 30, True)),
          "wti_chg_3m_pct": r(chg(wti, 91, True)), "wti_chg_12m_pct": r(chg(wti, 365, True)), "wti_pctile_10y": r(pctile(wti, 10), 0),
          "brent": r(last(brent)[1]), "brent_wti_spread": r(last(brent)[1] - last(wti)[1]),
          "henry_hub": r(last(hh)[1]), "hh_chg_3m_pct": r(chg(hh, 91, True)),
          "crude_stocks_mb": r(cv / 1000, 1), "crude_stocks_vs_5y_pct": r(cdev, 1), "crude_stocks_chg_4w_mb": r(crude.diff(4).iloc[-1] / 1000, 1),
          "crude_date": last(crude)[0].date().isoformat(), "cushing_mb": r(kv / 1000, 1), "cushing_vs_5y_pct": r(kdev, 1),
          "us_crude_prod_mbd": r(last(prod)[1] / 1000, 2), "us_prod_chg_12m_pct": r(chg(prod, 365, True), 1),
          "ng_storage_bcf": r(nv, 0), "ng_storage_vs_5y_pct": r(ndev, 1), "ng_date": last(ngs)[0].date().isoformat(),
          "ovx": r(last(F["OVXCLS"])[1]), "ovx_pctile_1y": r(pctile(F["OVXCLS"], 1), 0)}
put("energy", energy, {"wti": ev("fred:DCOILWTICO", wti), "brent": ev("fred:DCOILBRENTEU", brent), "henry_hub": ev("fred:DHHNGSP", hh),
                       "crude_stocks": ev("eia:PET.WCESTUS1.W", crude), "ng_storage": ev("eia:NG.NW2_EPG0_SWO_R48_BCF.W", ngs),
                       "cushing": ev("eia:PET.W_EPC0_SAX_YCUOK_MBBL.W", cush), "ovx": ev("fred:OVXCLS", F["OVXCLS"])})

# ---------------------------------------------------------------- ETFs: trend, returns, vol
E = {t[8:]: etf(t[8:]) for t in PATHS if t.startswith("massive:") and not t.startswith("massive:opt")}
spy = E["SPY"]
etfs = {}
for t, px in E.items():
    d, v = last(px)
    hi52 = float(px[px.index > d - pd.DateOffset(years=1)].max())
    etfs[t] = {"close": r(v), "date": d.date().isoformat(), "ret_1m": r(chg(px, 30, True), 1), "ret_3m": r(chg(px, 91, True), 1),
               "ret_12m": r(chg(px, 365, True), 1), "vs_50dma_pct": r((v / ma(px, 50) - 1) * 100, 1),
               "vs_200dma_pct": r((v / ma(px, 200) - 1) * 100, 1), "drawdown_52w_pct": r((v / hi52 - 1) * 100, 1),
               "rv20": r(rv(px, 20), 1), "rv60": r(rv(px, 60), 1),
               "rel_3m_vs_spy": r(chg(px, 91, True) - chg(spy, 91, True), 1) if t != "SPY" else 0.0}
put("etfs", etfs, {t: ev(f"massive:{t}", px) for t, px in E.items()})

# ---------------------------------------------------------------- volatility
vix, vix3m, ovx, gvz, vxeem = F["VIXCLS"], F["VXVCLS"], F["OVXCLS"], F["GVZCLS"], F["VXEEMCLS"]
vol = {"vix": r(last(vix)[1]), "vix_pctile_1y": r(pctile(vix, 1), 0), "vix_pctile_10y": r(pctile(vix, 10), 0),
       "vix3m": r(last(vix3m)[1]), "vix_term_ratio": r(last(vix)[1] / last(vix3m)[1], 3),
       "gvz": r(last(gvz)[1]), "gvz_pctile_1y": r(pctile(gvz, 1), 0), "ovx": r(last(ovx)[1]), "ovx_pctile_1y": r(pctile(ovx, 1), 0),
       "vxeem": r(last(vxeem)[1]), "vxeem_pctile_1y": r(pctile(vxeem, 1), 0),
       "vrp_spy": r(last(vix)[1] - etfs["SPY"]["rv20"]), "vrp_gld": r(last(gvz)[1] - etfs["GLD"]["rv20"]),
       "vrp_uso": r(last(ovx)[1] - etfs["USO"]["rv20"]), "vrp_eem": r(last(vxeem)[1] - etfs["EEM"]["rv20"])}
put("volatility", vol, {"vix": ev("fred:VIXCLS", vix), "vix3m": ev("fred:VXVCLS", vix3m), "gvz": ev("fred:GVZCLS", gvz),
                        "ovx": ev("fred:OVXCLS", ovx), "vxeem": ev("fred:VXEEMCLS", vxeem)})

# ---------------------------------------------------------------- valuation (history to 2023-09; current from published source)
dh = pd.read_csv(io.BytesIO(raw("datahub:sp500_pe10")))
pe10 = dh[dh.PE10 > 0].set_index(pd.to_datetime(dh[dh.PE10 > 0]["Date"]))["PE10"].astype(float)
pe10.name = "datahub:PE10"
valuation = {"cape_history_last_date": last(pe10)[0].date().isoformat(), "cape_history_last": r(last(pe10)[1]),
             "cape_hist_mean_full": r(pe10.mean()), "cape_hist_mean_20y": r(pe10[pe10.index > last(pe10)[0] - pd.DateOffset(years=20)].mean()),
             "cape_hist_mean_10y": r(pe10[pe10.index > last(pe10)[0] - pd.DateOffset(years=10)].mean()),
             "cape_hist_max": r(pe10.max()), "cape_hist_max_date": pe10.idxmax().date().isoformat()}
put("valuation_history", valuation, {"pe10": ev("datahub:PE10", pe10)})
M["_pe10_series_for_percentiles"] = {d.date().isoformat(): round(float(v), 2) for d, v in pe10[pe10.index >= "2003-01-01"].items()}

# ---------------------------------------------------------------- write
(OUT / "metrics.json").write_text(json.dumps(M, indent=1, default=str))
obs_rows = []
for name, s in list(F.items()):
    for d, v in s[s.index >= "2016-01-01"].items():
        obs_rows.append((f"fred:{name}", d.date().isoformat(), v))
pd.DataFrame(obs_rows, columns=["series_id", "obs_date", "value"]).to_csv(OUT / "observations.csv.gz", index=False, compression="gzip")
import sys
show = sys.argv[1:] or [k for k in M if k not in ("evidence", "freshness", "_pe10_series_for_percentiles")]
for k in show:
    print(k, json.dumps(M.get(k), default=str))
stale = [f for f in M["freshness"] if f["age_days"] > 45]
print("STALE >45d:", [(f["id"], f["last_obs"]) for f in stale])
