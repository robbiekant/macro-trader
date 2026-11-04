"""Dashboard v2 datasets: history for every desk's charts, the regime path, IBKR-priced tickets,
implied-vol ranks, risk budget. Re-runs compute.py (deterministic) to reuse its loaded series."""
from __future__ import annotations

import contextlib
import io
import json
import runpy
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data" / "run0"
OUT = D / "dashboard"
with contextlib.redirect_stdout(io.StringIO()):
    G = runpy.run_path(str(ROOT / "scripts" / "run0" / "compute.py"))
F, E = G["F"], G["E"]
END = pd.Timestamp("2026-11-02")
START2Y = END - pd.DateOffset(years=2)


def w(name, rows):
    (OUT / f"{name}.json").write_text(json.dumps(rows, separators=(",", ":")))
    print(name, len(rows), "rows", (OUT / f"{name}.json").stat().st_size // 1024, "KB")


# ------------------------------------------------------------------ series (long format)
rows = []
def add(sid, label, s, freq="W-FRI", start=START2Y, rebase=False, scale=1.0, nd=2):
    s = s.dropna()
    s = s[s.index >= start]
    if freq:
        s = s.resample(freq).last().dropna()
    if rebase and len(s):
        s = s / s.iloc[0] * 100
    for d, v in s.items():
        rows.append({"series": sid, "label": label, "date": d.date().isoformat(), "value": round(float(v) * scale, nd)})

add("net_liquidity", "US net liquidity ($bn)", G["netliq"], nd=0)
add("tga", "Treasury cash ($bn)", F["WTREGEN"] / 1000, nd=0)
add("usd_broad", "Broad dollar index", F["DTWEXBGS"])
add("fed_funds", "Fed funds", F["DFF"]); add("t2y", "2-year", F["DGS2"]); add("t10y", "10-year", F["DGS10"])
add("real10y", "10-year real", F["DFII10"]); add("hy_oas", "High-yield spread", F["BAMLH0A0HYM2"])
add("core_cpi_yoy", "Core CPI y/y", G["core_cpi_yoy"], freq=None); add("core_cpi_3m", "Core CPI 3m annualized", G["core_cpi_3m"], freq=None)
add("cpi_yoy", "Headline CPI y/y", G["cpi_yoy"], freq=None)
add("payrolls_3m", "Payrolls 3m avg (k)", G["pay_3m"], freq=None, nd=0); add("claims_4w", "Initial claims 4w (k)", G["claims_4w"] / 1000, nd=0)
add("gpr_30d", "Geopolitical risk (30d)", G["gpr30"], nd=1); add("epu_30d", "Policy uncertainty (30d)", G["epu30"], nd=0)
add("gscpi", "Supply-chain pressure", G["gscpi"], freq=None, start=END - pd.DateOffset(years=5))
add("wti", "WTI", F["DCOILWTICO"]); add("brent", "Brent", F["DCOILBRENTEU"]); add("henry_hub", "Henry Hub", F["DHHNGSP"])
add("crude_stocks", "US crude stocks (mb)", G["crude"] / 1000, freq=None, nd=1); add("ng_storage", "Natgas storage (bcf)", G["ngs"], freq=None, nd=0)
for t in ("GLD", "SLV", "SPY", "QQQ", "IWM", "EFA", "EEM", "FEZ", "EWJ", "FXI", "INDA", "USO", "TLT"):
    add(f"px_{t}", t, E[t], start=END - pd.DateOffset(years=1), rebase=True, nd=1)
add("vix", "VIX", F["VIXCLS"]); add("vix3m", "VIX 3-month", F["VXVCLS"]); add("ovx", "OVX (oil vol)", F["OVXCLS"])
add("gvz", "GVZ (gold vol)", F["GVZCLS"]); add("vxeem", "VXEEM (EM vol)", F["VXEEMCLS"])
add("cape", "Shiller CAPE", G["pe10"], freq=None, start=pd.Timestamp("2003-01-01"))
rows.append({"series": "cape_now", "label": "Shiller CAPE (Oct 2026, published)", "date": "2026-10-01", "value": 41.07})
w("series", rows)

# ------------------------------------------------------------------ regime path (monthly, last 18 months)
gp, ip, score_at = G["growth_parts"], G["infl_parts"], G["score_at"]
path = []
for m in range(18, -1, -1):
    gl, il = score_at(gp, m), score_at(ip, m)
    gl3, il3 = score_at(gp, m + 3), score_at(ip, m + 3)
    path.append({"month": (END - pd.DateOffset(months=m)).strftime("%Y-%m"), "growth": round(gl + 0.5 * (gl - gl3), 3),
                 "inflation": round(il + 0.5 * (il - il3), 3)})
w("regime_path", path)

# ------------------------------------------------------------------ IBKR implied vol ranks
S = json.loads((D / "ibkr" / "snapshot_2026-11-04.json").read_text())
S0 = json.loads((D / "ibkr" / "snapshot_2026-11-02.json").read_text())
w("ivs", [{"underlying": u, "iv": round(v["iv"] * 100, 1), "hv30": round(v["hv30"] * 100, 1),
           "premium": round((v["iv"] - v["hv30"]) * 100, 1), "iv_pct_52w": round(v["iv_pctile_52w"] * 100),
           "iv_pct_13w": round(v["iv_pctile_13w"] * 100), "status": v["status"]} for u, v in S["underlyings"].items()])

# ------------------------------------------------------------------ tickets: model estimate vs IBKR market
PI4 = {t["id"]: t for t in json.loads((D / "proposals_ibkr_2026-11-04.json").read_text())["tickets"]}
PI2 = json.loads((D / "proposals_ibkr.json").read_text())["tickets"]
PI = [PI4["T1"], PI4["T3"]] + [dict(t, quote_status="Nov 2 pre-market (not re-priced)") for t in PI2 if t["id"] in ("T2", "T4")]
P1 = {t["id"]: t for t in json.loads((D / "proposals_if_policy_change.json").read_text())["tickets"]}
SPOT = {u: v["last"] for u, v in S["underlyings"].items()}
tk = []
for t in PI:
    base = t["id"][:2]
    strikes = {}
    for part in t["legs"].split(" / "):
        sell, buy = part.split(" · ")
        r = sell[-1]
        strikes[f"{'put' if r == 'P' else 'call'}_short"] = float(sell.split()[1][:-1])
        strikes[f"{'put' if r == 'P' else 'call'}_long"] = float(buy.split()[1][:-1])
    tk.append({"id": t["id"], "instrument": t["instrument"], "structure": t["structure"], "legs": t["legs"],
               "short_deltas": t["short_deltas"], "model_credit_pct": P1.get(base, {}).get("credit_pct_width"),
               "ibkr_credit_pct": t["credit_pct_width"], "credit": t["credit_per_unit"], "width": t["width"],
               "spot": SPOT[t["instrument"]], **{k: strikes.get(k) for k in ("put_short", "put_long", "call_short", "call_long")},
               "quantity": t["quantity"] if t["passes_10pct"] else 0, "credit_total": t["credit_total"] if t["passes_10pct"] else None,
               "max_loss_total": t["max_loss_total"] if t["passes_10pct"] else None,
               "passes_20pct": "yes" if t["passes_20pct"] else "no", "passes_10pct": "yes" if t["passes_10pct"] else "no",
               "issues": t["issues"], "quote_status": t["quote_status"]})
w("tickets", tk)

# ------------------------------------------------------------------ risk budget (config/risk_policy.yaml)
pol = yaml.safe_load((ROOT / "config" / "risk_policy.yaml").read_text())
NAMES = {"us_equity_index": "US equity index", "intl_equity": "International equity", "energy": "Energy",
         "precious_metals": "Precious metals", "rates": "Rates (TLT)", "opportunistic": "Opportunistic", "reserve": "Reserve (never used)"}
w("budget", [{"sleeve": NAMES[k], "risk_budget": round(v["risk_budget"] * 100)} for k, v in pol["sleeves"].items()])

# ------------------------------------------------------------------ checks: every policy check (pass and fail) + IBKR + red team
P0 = json.loads((D / "proposals.json").read_text())
REP = json.loads((D / "reports.json").read_text())
ck = []
for i, p in enumerate(P0["policy_checks"], 1):
    ck.append({"id": f"P{i}", "kind": "Risk engine", "item": p["rule_id"].replace("_", " "), "detail": p["message"],
               "outcome": "Pass" if p["passed"] else ("Block" if p["severity"] == "block" else "Warning")})
ck.append({"id": f"P{len(ck) + 1}", "kind": "Risk engine", "item": "min credit pct of width",
           "detail": "Single 8-20 delta spreads collect about 8-12% of width; the 20% rule implies about 25-delta strikes",
           "outcome": "Decision"})
for t in PI:
    ck.append({"id": f"Q-{t['id']}", "kind": "IBKR re-price", "item": f"{t['instrument']} {t['legs']}",
               "detail": f"credit {t['credit_pct_width']}% of width; {t['issues']}",
               "outcome": "Pass" if t["passes_10pct"] else "Block"})
for i, rt in enumerate(REP["committee"]["red_team"], 1):
    ck.append({"id": f"R{i}", "kind": "Red team", "item": rt["challenge"], "detail": rt["fix"], "outcome": "Answered: " + rt["cio_response"]})
w("checks", ck)

# ------------------------------------------------------------------ agents: refresh implementation summaries for the IBKR step
ag = json.loads((OUT / "agents.json").read_text())
for a in ag:
    if a["agent_id"] == "data_steward":
        a["summary"] += " Option quotes, Greeks and implied-vol ranks came from Interactive Brokers (read-only market-data tools): 26 quotes Monday pre-market, 10 more at Tuesday's close."
    if a["agent_id"] == "options_structurer":
        a["stance_label"] = "Re-priced on IBKR quotes"
        a["summary"] = ("Re-priced on IBKR quotes. USO fell, so the spread moved to 130/120: 12.4% of width at 13 delta with tight quotes. "
                        "Real put skew leaves XSP at 9.2% and TLT at 7.8% of width (Monday quotes). EEM after-hours quotes were too wide to price.")
    if a["agent_id"] == "risk_manager":
        a["stance_label"] = "1 trade ready if rule changes"
        a["summary"] = ("Election blackout has lifted. Under the current 20% minimum credit no ticket qualifies. USO 130/120 passes every check under "
                        "the proposed 10% rule: credit, delta cap, quote width, size (max loss $11,382, 1.1% of NAV). Re-check at the open before any fill.")
w("agents", ag)

# ------------------------------------------------------------------ provenance: add IBKR
pv = json.loads((OUT / "provenance.json").read_text())
pv = [p for p in pv if p["kind"] != "IBKR"]
for u, v in S["underlyings"].items():
    n = sum(1 for o in S["options"] if o["u"] == u)
    n0 = sum(1 for o in S0["options"] if o["u"] == u)
    pv.append({"id": f"ibkr:{u}", "kind": "IBKR", "last_obs": "2026-11-03", "age_days": 1,
               "detail": f"{v['status']}; {n} option quotes Nov 3 close + {n0} Nov 2 pre-market; Dec-18 expiry"})
w("provenance", pv)
