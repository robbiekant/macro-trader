"""Re-price Run 0 tickets on real IBKR quotes (data/run0/ibkr/snapshot_2026-11-02.json).

Deterministic: mid prices, IBKR deltas, the same delta caps and minimum-credit rule as structure.py.
A leg whose bid/ask spread is wider than 10% of mid (policy max_bid_ask_pct_of_mid) is not tradable.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import os
SNAP = os.environ.get("SNAP", "2026-11-02")
S = json.loads((ROOT / f"data/run0/ibkr/snapshot_{SNAP}.json").read_text())
Q = {(o["u"], o["right"], o["strike"]): o for o in S["options"]}
NAV, MAX_SPREAD = 1_000_000, 0.10
CANDS_1104 = [
    ("T1", "USO", "put credit spread", [("P", 130, 120)], {"P": 0.15}, 12000),
    ("T3", "EEM", "iron condor", [("P", 54, 52), ("C", 67, 68)], {"P": 0.16, "C": 0.16}, 8000),
]
CANDS = [  # (id, underlying, structure, legs [(right, short, long)], delta caps, max-loss budget)
    ("T1", "USO", "put credit spread", [("P", 135, 125)], {"P": 0.15}, 12000),
    ("T1b", "USO", "put credit spread", [("P", 138, 128)], {"P": 0.15}, 12000),
    ("T2", "XSP", "iron condor", [("P", 690, 680), ("C", 820, 830)], {"P": 0.12, "C": 0.16}, 15000),
    ("T3", "EEM", "iron condor", [("P", 55, 53), ("C", 70, 72)], {"P": 0.16, "C": 0.16}, 8000),
    ("T4", "TLT", "call credit spread", [("C", 86, 88)], {"C": 0.20}, 6000),
    ("T4b", "TLT", "call credit spread", [("C", 85, 87)], {"C": 0.20}, 6000),
]


def mid(o):
    if o.get("bid") is None or o.get("ask") is None:
        return None, None
    m = (o["bid"] + o["ask"]) / 2
    return m, (o["ask"] - o["bid"]) / m if m else None


rows = []
for cid, u, struct, legs, caps, budget in (CANDS_1104 if SNAP == "2026-11-04" else CANDS):
    credit, width, notes, deltas, ok_quotes, wide = 0.0, 0.0, [], [], True, []
    for right, ks, kl in legs:
        qs, ql = Q.get((u, right, ks)), Q.get((u, right, kl))
        ms, ss = mid(qs) if qs else (None, None)
        ml, sl = mid(ql) if ql else (None, None)
        if ms is None or ml is None:
            ok_quotes = False; notes.append(f"{right}{ks}/{kl}: no two-sided quote"); continue
        for k, spr in ((ks, ss), (kl, sl)):
            if spr is not None and spr > MAX_SPREAD:
                wide.append(f"{right}{k} bid-ask {spr:.0%} of mid")
        credit += ms - ml
        width = max(width, abs(ks - kl))
        deltas.append((right, qs.get("delta")))
    over_cap = [f"{r} short delta {abs(d):.2f} > cap {caps[r]}" for r, d in deltas if d is not None and abs(d) > caps[r]]
    tradable = ok_quotes and not wide
    cpw = credit / width * 100 if width and ok_quotes else None
    ml1 = (width - credit) * 100 if cpw is not None else None
    qty = int(budget // ml1) if ml1 else 0
    rows.append({
        "id": cid, "instrument": u, "structure": struct,
        "legs": " / ".join(f"Sell {ks}{r} · Buy {kl}{r}" for r, ks, kl in legs),
        "short_deltas": ", ".join(f"{r} {abs(d):.3f}" if d is not None else f"{r} n/a" for r, d in deltas),
        "credit_per_unit": round(credit, 3) if ok_quotes else None, "width": width,
        "credit_pct_width": round(cpw, 1) if cpw is not None else None,
        "quantity": qty if tradable else 0, "credit_total": round(credit * 100 * qty) if tradable and qty else None,
        "max_loss_total": round(ml1 * qty) if tradable and qty else None,
        "passes_20pct": bool(tradable and cpw is not None and cpw >= 20 and not over_cap),
        "passes_10pct": bool(tradable and cpw is not None and cpw >= 10 and not over_cap),
        "issues": "; ".join(notes + wide + over_cap) or "none",
        "quote_status": S["underlyings"][u]["status"],
    })
out = {"source": S["source"], "fetched_at": S["fetched_at"], "expiry": S["expiry"], "tickets": rows}
(ROOT / ("data/run0/proposals_ibkr.json" if SNAP == "2026-11-02" else f"data/run0/proposals_ibkr_{SNAP}.json")).write_text(json.dumps(out, indent=1))
for r in rows:
    print(r["id"], r["instrument"], r["legs"], "| cr", r["credit_per_unit"], "cr%w", r["credit_pct_width"], "| qty", r["quantity"],
          "credit$", r["credit_total"], "maxloss$", r["max_loss_total"], "| 20%:", r["passes_20pct"], "10%:", r["passes_10pct"], "|", r["issues"])
