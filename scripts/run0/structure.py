"""Run 0 options structurer + policy checks (deterministic).

The owner's Massive plan is not entitled to option chains, so strikes and premiums are
Black-Scholes ESTIMATES from stored implied-vol indices (OVX for USO, VIX for SPX/XSP,
VXEEM for EEM) or realized vol (TLT). Every ticket must be re-priced on a live chain before approval.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
M = json.loads((ROOT / "data" / "run0" / "metrics.json").read_text())
NAV = 1_000_000
R = M["rates"]["fed_funds_eff"] / 100
ENTRY, EXPIRY, DTE = "2026-11-04", "2026-12-18", 44   # entry after the Nov 3 election blackout
T = DTE / 365
N = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))


def bs(S, K, vol, kind):
    d1 = (math.log(S / K) + (R + vol * vol / 2) * T) / (vol * math.sqrt(T))
    d2 = d1 - vol * math.sqrt(T)
    if kind == "P":
        return K * math.exp(-R * T) * N(-d2) - S * N(-d1), N(d1) - 1
    return S * N(d1) - K * math.exp(-R * T) * N(d2), N(d1)


def strike_for_delta(S, vol, kind, target, step):
    best = None
    k = S
    for i in range(1, 4000):
        k = S - i * step if kind == "P" else S + i * step
        if k <= 0:
            break
        _, d = bs(S, k, vol, kind)
        if abs(d) <= target:
            best = round(k / step) * step
            break
    return best


def vertical(S, vol_short, vol_long, kind, delta, width, step):
    ks = strike_for_delta(S, vol_short, kind, delta, step)
    kl = ks - width if kind == "P" else ks + width
    ps, ds = bs(S, ks, vol_short, kind)
    pl, dl = bs(S, kl, vol_long, kind)
    return {"short_strike": ks, "long_strike": kl, "credit": ps - pl, "short_delta": ds, "net_delta": ds - dl}


E, V = M["etfs"], M["volatility"]
SPX_PROXY = E["SPY"]["close"]          # XSP trades near SPY's level; SPY used as the price proxy
CANDIDATES = [
    # delta caps come from the committee's modifiers: geopolitics (energy, lower delta), valuation (US puts <= 12 delta)
    dict(id="T1", sleeve="energy", instrument="USO", structure="put_credit_spread", spot=E["USO"]["close"],
         iv=V["ovx"] / 100, iv_src="fred:OVXCLS (OVX is USO's 30-day implied vol)", sides={"P": (0.15, [10, 5], 1.0)},
         budget=12000, conviction=0.55),
    dict(id="T2", sleeve="us_equity_index", instrument="XSP", structure="iron_condor", spot=SPX_PROXY,
         iv=V["vix"] / 100, iv_src="fred:VIXCLS (SPY close used as XSP price proxy)",
         sides={"P": (0.12, [10, 5], 1.0), "C": (0.16, [10, 5], 1.0)}, budget=15000, conviction=0.50, skew={"P": 0.03, "C": -0.015}),
    dict(id="T3", sleeve="intl_equity", instrument="EEM", structure="iron_condor", spot=E["EEM"]["close"],
         iv=V["vxeem"] / 100, iv_src="fred:VXEEMCLS (EEM 30-day implied vol)",
         sides={"P": (0.16, [3, 2], 0.5), "C": (0.16, [3, 2], 0.5)}, budget=8000, conviction=0.45, skew={"P": 0.03, "C": -0.015}),
    dict(id="T4", sleeve="rates", instrument="TLT", structure="call_credit_spread", spot=E["TLT"]["close"],
         iv=E["TLT"]["rv20"] * 1.15 / 100, iv_src="estimate: 1.15 x TLT 20-day realized vol (no TLT vol index stored)",
         sides={"C": (0.20, [3, 2], 0.5)}, budget=6000, conviction=0.60),
]
import os
MIN_CREDIT = float(os.environ.get("RUN0_MIN_CREDIT", "0.20"))   # policy: position_rules.min_credit_pct_of_width
OUTFILE = os.environ.get("RUN0_OUT", "proposals.json")


def best_structure(c):
    """Most out-of-the-money symmetric delta (<= each side's cap) whose total credit >= 20% of width."""
    for d100 in range(8, 26):
        d = d100 / 100
        if any(d > cap for cap, _, _ in c["sides"].values()):
            break
        for w in sorted({w for _, ws, _ in c["sides"].values() for w in ws}, reverse=True):
            legs, credit, net_delta = [], 0.0, 0.0
            for kind, (cap, ws, step) in c["sides"].items():
                sk = c.get("skew", {}).get(kind, 0)
                v = vertical(c["spot"], c["iv"] + sk, c["iv"] + sk + (0.01 if kind == "P" else -0.005), kind, d, w, step)
                legs += [{"put_call": kind, "side": "sell", "strike": v["short_strike"], "delta": round(v["short_delta"], 3)},
                         {"put_call": kind, "side": "buy", "strike": v["long_strike"]}]
                credit += v["credit"]; net_delta += -v["net_delta"]
            if credit >= MIN_CREDIT * w:
                return d, w, legs, credit, net_delta
    return None


tickets, stand_aside = [], []
for c in CANDIDATES:
    found = best_structure(c)
    if not found:
        stand_aside.append({"id": c["id"], "instrument": c["instrument"], "structure": c["structure"],
                            "reason": "no strike within the delta cap collects 20% of width; premium too thin for the risk"})
        continue
    d, w, legs, credit, net_delta_sh = found
    max_loss_1 = (w - credit) * 100
    qty = max(1, int(c["budget"] // max_loss_1))
    tickets.append({
        "id": c["id"], "sleeve": c["sleeve"], "instrument": c["instrument"], "structure": c["structure"],
        "entry_on_or_after": ENTRY, "expiry": EXPIRY, "dte_at_entry": DTE, "spot_ref": round(c["spot"], 2),
        "iv_used": round(c["iv"] * 100, 1), "iv_source": c["iv_src"], "short_delta_target": d, "width": w, "legs": legs,
        "quantity": qty, "credit_per_unit": round(credit, 2), "credit_pct_width": round(credit / w * 100, 1),
        "credit_total": round(credit * 100 * qty), "max_loss_total": round(max_loss_1 * qty), "bpr_est": round(max_loss_1 * qty),
        "delta_dollars": round(net_delta_sh * 100 * qty * c["spot"]),
        "return_on_risk_pct": round(credit * 100 / max_loss_1 * 100, 1),
        "conviction": c["conviction"], "pricing": "MODEL ESTIMATE - re-price on a live chain before approval",
    })

# ---------------------------------------------------------------- policy checks (subset of config/risk_policy.yaml)
pol = []
def check(rule, passed, observed, limit, severity, msg, ticket=None):
    pol.append({"rule_id": rule, "ticket": ticket, "passed": passed, "observed": observed, "limit": limit,
                "severity": "info" if passed else severity, "message": msg})

for t in tickets:
    check("max_loss_per_defined_risk_position_pct_nav", t["max_loss_total"] <= 0.02 * NAV, t["max_loss_total"], 0.02 * NAV, "block",
          f"{t['id']} max loss ${t['max_loss_total']:,}", t["id"])
    check("naked_short_calls", True, 0, 0, "block", f"{t['id']} has no naked calls (all calls are spread-protected)", t["id"])
    check("min_credit_pct_of_width", t["credit_pct_width"] >= MIN_CREDIT * 100, t["credit_pct_width"], MIN_CREDIT * 100, "block",
          f"{t['id']} collects {t['credit_pct_width']}% of width at {t['short_delta_target']} delta", t["id"])
bpr = sum(t["bpr_est"] for t in tickets)
check("bpr_utilization_hard_max", bpr <= 0.50 * NAV, bpr, 0.50 * NAV, "block", f"total buying power ${bpr:,} ({bpr / NAV:.1%} of NAV)")
check("bpr_utilization_target_range", 0.25 * NAV <= bpr <= 0.40 * NAV, bpr, "25-40% NAV", "warn",
      "below target range: with defined-risk spreads the stress budget binds first (design note)")
delta_total = sum(t["delta_dollars"] for t in tickets)
check("net_beta_weighted_delta_pct_nav", -0.30 * NAV <= delta_total <= 0.60 * NAV, delta_total, "-30%..+60% NAV", "block",
      f"net $delta about ${delta_total:,} (not beta-weighted in Run 0)")
# equity crash scenario: condor put sides + USO put spread (crude -15%) + TLT call spread (bonds rally) all at max loss
crash = sum(t["max_loss_total"] for t in tickets)
check("stress_equity_crash_20", crash <= 0.12 * NAV, crash, 0.12 * NAV, "block",
      f"worst case if every ticket hits max loss together: ${crash:,} ({crash / NAV:.1%} of NAV)")
check("event_blackout_ELECTION", False, "2026-11-03 US midterm elections", "72h before: no new short-vol risk, all sleeves", "block",
      "entries are blocked until 2026-11-04 09:45 ET; tickets are staged for that date")
check("event_blackout_NFP", True, "2026-11-06 October payrolls", "12h before: us_equity_index, rates", "warn",
      "enter XSP and TLT on Nov 4 or 5, or wait until after the release")
check("vix_35_breaker", V["vix"] < 35, V["vix"], 35, "block", "VIX below 35: naked puts would be allowed (none proposed)")
check("data_option_chains", False, "plan not entitled (HTTP 403)", "live chain required", "warn",
      "all strikes and credits are model estimates")

out = {"as_of": M["as_of"], "nav": NAV, "hurdle_ffr": M["rates"]["fed_funds_eff"], "tickets": tickets, "stand_aside": stand_aside, "policy_checks": pol,
       "totals": {"credit": sum(t["credit_total"] for t in tickets), "max_loss": crash, "bpr": bpr, "delta_dollars": delta_total}}
out["min_credit_pct_of_width"] = MIN_CREDIT
(ROOT / "data" / "run0" / OUTFILE).write_text(json.dumps(out, indent=1))
for t in tickets:
    print(t["id"], t["instrument"], t["structure"], "d", t["short_delta_target"], "w", t["width"], "cr%w", t["credit_pct_width"], [(l["side"][0] + l["put_call"] + str(l["strike"])) for l in t["legs"]],
          "qty", t["quantity"], "credit/u", t["credit_per_unit"], "credit$", t["credit_total"], "maxloss$", t["max_loss_total"],
          "RoR%", t["return_on_risk_pct"], "delta$", t["delta_dollars"])
print("totals", out["totals"]); print("stand aside", stand_aside)
for p in pol:
    if not p["passed"]:
        print("POLICY", p["severity"], p["rule_id"], p.get("ticket"), p["message"])
