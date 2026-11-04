"""Build the weekly dashboard's datasets from Run 0 outputs (no new numbers are created here)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data" / "run0"
OUT = D / "dashboard"
OUT.mkdir(exist_ok=True)
M = json.loads((D / "metrics.json").read_text())
REP = json.loads((D / "reports.json").read_text())
P0 = json.loads((D / "proposals.json").read_text())
P1 = json.loads((D / "proposals_if_policy_change.json").read_text())
VAL = {v["agent_id"]: v for v in json.loads((D / "validation.json").read_text()) if v["agent_id"] != "regime"}
MAN = json.loads((D / "manifest.json").read_text())
C = REP["committee"]


def w(name, rows):
    (OUT / f"{name}.json").write_text(json.dumps(rows, indent=1))
    print(name, len(rows), "rows")


# ---------------- kpi (headline figures)
L, Rt, Ma, En, V = M["liquidity"], M["rates"], M["macro"], M["energy"], M["volatility"]
w("kpi", [
    {"id": "hurdle", "label": "Fed funds (hurdle)", "value": Rt["fed_funds_eff"], "unit": "%", "note": "Effective rate, Oct 2026"},
    {"id": "wti", "label": "WTI crude", "value": En["wti"], "unit": "$", "note": f"+{En['wti_chg_12m_pct']}% in 12 months"},
    {"id": "brent", "label": "Brent crude", "value": En["brent"], "unit": "$", "note": "Seaborne benchmark"},
    {"id": "vix", "label": "VIX", "value": V["vix"], "unit": "", "note": "S&P 500 30-day implied vol"},
    {"id": "cape", "label": "US Shiller CAPE", "value": 41.07, "unit": "x", "note": "October 2026, published estimate"},
    {"id": "net_liq_13w", "label": "US net liquidity, 13 weeks", "value": L["net_liq_chg_13w_bn"], "unit": "$bn", "note": "Fed assets - TGA - reverse repo"},
    {"id": "t2y_minus_ff", "label": "2-year minus Fed funds", "value": Rt["market_implied_path_bp_2y_minus_ff"], "unit": "bp", "note": "Hikes priced"},
    {"id": "real_10y", "label": "10-year real yield", "value": Rt["real_10y"], "unit": "%", "note": "TIPS"},
    {"id": "gpr_pctile", "label": "Geopolitical risk percentile", "value": M["geopolitics"]["gpr_30d_pctile_10y"], "unit": "pct", "note": "30-day GPR vs 10 years"},
    {"id": "core_cpi_3m", "label": "Core CPI, 3-month annualized", "value": Ma["core_cpi_3m_ann"], "unit": "%", "note": "September"},
    {"id": "payrolls_3m", "label": "Payrolls, 3-month average", "value": Ma["payrolls_3m_avg_k"], "unit": "k", "note": "September"},
    {"id": "gscpi", "label": "Supply-chain pressure", "value": M["supply_chain"]["gscpi"], "unit": "sd", "note": "NY Fed GSCPI, September"},
])

# ---------------- regime
w("regime", [{"regime": k.capitalize(), "prior": round(C["regime"]["prior"][k] * 100, 1),
              "adjustment": round(C["regime"]["adjustment"][k] * 100, 1), "final": round(C["regime"]["final"][k] * 100, 1)}
             for k in ("goldilocks", "reflation", "stagflation", "deflation")])

# ---------------- agents (everything in the roster, with what happened this run)
NAMES = {"liquidity": "Global Liquidity & Dollar", "rates_credit": "Rates, Central Banks & Credit", "macro_cycle": "Growth & Inflation Nowcast",
         "geopolitics": "Geopolitics & Policy Risk", "supply_chain": "Global Supply Chain", "energy": "Crude Oil & Natural Gas",
         "metals": "Gold & Silver", "us_equity": "US Equities", "intl_equity": "International Equities", "valuation": "Valuation & CAPE",
         "volatility": "Volatility & Options Surface"}
KIND = {"valuation": "Hybrid", "volatility": "Hybrid"}
rows = []
ok = sum(e["ok"] for e in MAN)
rows.append({"agent_id": "data_steward", "name": "Data Steward", "layer": "Data", "kind": "Code", "status": "Ran",
             "stance_score": None, "stance_label": f"{ok} payloads stored", "confidence": None, "citations": None,
             "summary": "Monday: full history from FRED (49 series), EIA (4), Massive (17 ETFs), GPR, NY Fed GSCPI and CAPE. Wednesday: an incremental refresh, 71 requests asking only for data newer than what was stored. Keys read from the environment; raw payloads hashed and stored.",
             "findings": ""})
for r in REP["research"]:
    v = VAL[r["agent_id"]]
    rows.append({"agent_id": r["agent_id"], "name": NAMES[r["agent_id"]], "layer": "Research desk", "kind": KIND.get(r["agent_id"], "Claude"),
                 "status": "Ran · validated" if v["passed"] else "Ran · failed checks", "stance_score": r["stance"]["score"],
                 "stance_label": r["stance"]["label"], "confidence": r["confidence"], "citations": v["citations_checked"],
                 "summary": r["summary"], "findings": " | ".join(f["claim"] for f in r["key_findings"])})
rows += [
    {"agent_id": "regime", "name": "Regime Strategist", "layer": "Committee", "kind": "Hybrid", "status": "Ran", "stance_score": None,
     "stance_label": "Reflation / stagflation", "confidence": None, "citations": len(C["regime"]["evidence"]), "summary": C["regime"]["justification"], "findings": ""},
    {"agent_id": "cio", "name": "CIO / Portfolio Constructor", "layer": "Committee", "kind": "Claude", "status": "Ran", "stance_score": None,
     "stance_label": "Small, defined-risk premium sales", "confidence": None, "citations": None, "summary": C["cio_memo"], "findings": ""},
    {"agent_id": "red_team", "name": "Red Team", "layer": "Committee", "kind": "Claude", "status": "Ran", "stance_score": None,
     "stance_label": f"{len(C['red_team'])} challenges", "confidence": None, "citations": None,
     "summary": "Challenged the plan on ceasefire gap risk, crash correlation, EM momentum, estimated pricing and event timing; every challenge answered by the CIO.", "findings": ""},
    {"agent_id": "options_structurer", "name": "Options Structurer", "layer": "Implementation", "kind": "Hybrid", "status": "Ran", "stance_score": None,
     "stance_label": f"{len(P0['tickets'])} compliant, {len(P1['tickets'])} if policy changes", "confidence": None, "citations": None,
     "summary": "Code searched for the most out-of-the-money strikes that meet the minimum-credit rule within each sleeve's delta cap, using Black-Scholes and stored implied-vol indices.", "findings": ""},
    {"agent_id": "risk_manager", "name": "Risk Manager", "layer": "Implementation", "kind": "Hybrid", "status": "Ran", "stance_score": None,
     "stance_label": "Entries blocked until Nov 4", "confidence": None, "citations": None,
     "summary": "Policy engine passed position size, naked-call, buying-power, delta and crash-stress checks; blocked entries for the Nov 3 election blackout; flagged the minimum-credit rule as a policy conflict for the owner.", "findings": ""},
    {"agent_id": "execution_gateway", "name": "Execution Gateway", "layer": "Implementation", "kind": "Code", "status": "Waiting for your approval",
     "stance_score": None, "stance_label": "Paper mode", "confidence": None, "citations": None, "summary": "Fills only approved tickets, on or after Nov 4.", "findings": ""},
    {"agent_id": "position_monitor", "name": "Position Monitor", "layer": "Implementation", "kind": "Hybrid", "status": "Not run: no positions yet",
     "stance_score": None, "stance_label": "", "confidence": None, "citations": None, "summary": "Starts once the first paper fill exists.", "findings": ""},
    {"agent_id": "performance", "name": "Performance & Post-mortem", "layer": "Learning", "kind": "Hybrid", "status": "Not run: first week",
     "stance_score": None, "stance_label": "", "confidence": None, "citations": None, "summary": "Scores this week's falsifiable views at their December resolve date.", "findings": ""},
    {"agent_id": "janitor", "name": "Harness Janitor", "layer": "Learning", "kind": "Claude", "status": "Not run: monthly",
     "stance_score": None, "stance_label": "", "confidence": None, "citations": None, "summary": "First run on the 1st of next month.", "findings": ""},
]
w("agents", rows)

# ---------------- sleeves
ACT = {   # CIO targets (reports.json) mapped onto playbook sleeves
    "US equity index": (0, 0.4, "Stand aside: real XSP premium about half the minimum", "No trade"),
    "Intl developed equity": (0, 0.35, "Stand aside: neutral now, no implied-vol data for EFA/FEZ", "No trade"),
    "EM equity": (0, 0.45, "EEM iron condor: re-price at the open (quotes too wide)", "Re-price at open"),
    "Crude oil": (1, 0.5, "USO 130/120 put spread, 13 delta, 13 contracts", "Needs policy change"),
    "Natural gas": (0, 0.3, "Stand aside: desk bearish, playbook bullish", "No trade"),
    "Gold": (0, 0.4, "Stand aside: falling on real yields; vol too cheap to sell", "No trade"),
    "Silver": (0, 0.3, "Stand aside: 57% off its high, spreads only", "No trade"),
    "Treasuries (TLT)": (-1, 0.5, "Stand aside: real TLT premium below the minimum", "No trade"),
}
w("sleeves", [{"sleeve": s, "playbook_score": C["playbook_blend"][s], "after_modifiers": C["after_liquidity_modifier"][s],
               "direction": ACT[s][0], "conviction": ACT[s][1], "action": ACT[s][2], "status": ACT[s][3]} for s in ACT])

# ---------------- tickets (both books)
def legs_text(t):
    return " / ".join(f"{'Sell' if l['side'] == 'sell' else 'Buy'} {l['strike']:g}{l['put_call']}" for l in t["legs"])
trows = []
for book, P in (("Current policy", P0), ("If minimum credit is 10%", P1)):
    for t in P["tickets"]:
        trows.append({"book": book, "id": t["id"], "instrument": t["instrument"], "structure": t["structure"].replace("_", " "),
                      "legs": legs_text(t), "expiry": t["expiry"], "quantity": t["quantity"], "credit_total": t["credit_total"],
                      "max_loss_total": t["max_loss_total"], "credit_pct_width": t["credit_pct_width"],
                      "return_on_risk_pct": t["return_on_risk_pct"], "iv_used": t["iv_used"],
                      "status": "Staged for Nov 4 · needs your approval" if book == "Current policy" else "Needs policy change + approval"})
w("tickets", trows)

# ---------------- issues (risk engine + red team)
irows = []
for i, p in enumerate([p for p in P0["policy_checks"] if not p["passed"]], 1):
    irows.append({"id": f"P{i}", "kind": "Risk engine", "item": p["rule_id"].replace("_", " "), "detail": p["message"],
                  "response": "Final: blocks entry" if p["severity"] == "block" else "Warning for the owner", "severity": p["severity"]})
irows.append({"id": f"P{len(irows) + 1}", "kind": "Risk engine", "item": "min credit pct of width",
              "detail": "USO, XSP and TLT spreads collect 10-12% of width at 8-20 delta; policy requires 20%, which implies about 25-delta strikes",
              "response": "Policy conflict: owner decides (proposed: 10% for single spreads)", "severity": "decision"})
for i, rt in enumerate(C["red_team"], 1):
    irows.append({"id": f"R{i}", "kind": "Red team", "item": rt["challenge"], "detail": rt["fix"], "response": rt["cio_response"], "severity": "challenge"})
w("issues", irows)

# ---------------- etfs + vol
IV = {"SPY": ("VIX", V["vix"]), "USO": ("OVX", V["ovx"]), "GLD": ("GVZ", V["gvz"]), "EEM": ("VXEEM", V["vxeem"])}
w("etfs", [{"ticker": t, "close": e["close"], "ret_1m": e["ret_1m"], "ret_3m": e["ret_3m"], "ret_12m": e["ret_12m"],
            "vs_200dma": e["vs_200dma_pct"], "drawdown_52w": e["drawdown_52w_pct"], "rv20": e["rv20"],
            "implied_vol": IV.get(t, (None, None))[1], "vol_premium": round(IV[t][1] - e["rv20"], 1) if t in IV else None,
            "data_flag": "realized vol looks wrong: check price history" if t == "EWZ" else ""}
           for t, e in M["etfs"].items()])

# ---------------- provenance
prow = []
latest = {}
for e in MAN:
    if e["ok"]:
        latest[e["series_id"]] = e
for f in M["freshness"]:
    prow.append({"id": f["id"], "kind": "FRED series", "last_obs": f["last_obs"], "age_days": f["age_days"],
                 "detail": f"sha256 {latest[f['id']]['sha256'][:12]}, fetched {latest[f['id']]['fetched_at'][:16]}Z"})
for sid, e in latest.items():
    if not sid.startswith("fred:"):
        prow.append({"id": sid, "kind": e["source"].upper() if e["source"] in ("eia", "gpr") else e["source"].capitalize(),
                     "last_obs": None, "age_days": None, "detail": f"sha256 {e['sha256'][:12]}, fetched {e['fetched_at'][:16]}Z"})
for d in REP["documents"]:
    prow.append({"id": f"doc:{d['doc_id']}", "kind": "News / official", "last_obs": d["published"], "age_days": None,
                 "detail": f"{d['publisher']}: {d['summary']} ({d['url']})"})
w("provenance", prow)
