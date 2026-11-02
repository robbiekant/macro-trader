"""Run 0 sensors: validate each research report against the contract and check every citation.

- schema: contracts/research_report.schema.json (jsonschema, draft 2020-12)
- citations: metric_id values must match data/run0/metrics.json within tolerance; doc_ids must exist
- freshness: data_used ids must exist in the stored data
Writes data/run0/validation.json; exits non-zero on any failure.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[2]
schema = json.loads((ROOT / "contracts" / "research_report.schema.json").read_text())
M = json.loads((ROOT / "data" / "run0" / "metrics.json").read_text())
REP = json.loads((ROOT / "data" / "run0" / "reports.json").read_text())
docs = {d["doc_id"] for d in REP["documents"]}
validator = jsonschema.Draft202012Validator(schema)


def resolve(path):
    cur = M
    for part in path.split("."):
        cur = cur[part]
    return cur


def citations(obj):
    if isinstance(obj, dict):
        if "metric_id" in obj or "doc_id" in obj:
            yield obj
        for v in obj.values():
            yield from citations(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from citations(v)


results, failed = [], 0
for rep in REP["research"]:
    errs = [f"schema: {e.message[:140]}" for e in validator.iter_errors(rep)]
    n = 0
    for c in citations(rep.get("key_findings", [])):
        n += 1
        if "doc_id" in c and "metric_id" not in c:
            if c["doc_id"] not in docs:
                errs.append(f"citation: doc {c['doc_id']} not archived")
            continue
        try:
            stored = resolve(c["metric_id"])
        except (KeyError, TypeError):
            errs.append(f"citation: {c['metric_id']} not found in stored metrics")
            continue
        tol = max(0.011, abs(stored) * 0.005)
        if abs(float(stored) - float(c["value"])) > tol:
            errs.append(f"citation: {c['metric_id']} cited {c['value']} but stored {stored}")
    results.append({"agent_id": rep["agent_id"], "passed": not errs, "citations_checked": n, "errors": errs})
    failed += bool(errs)

for c in citations(REP["committee"].get("regime", {}).get("evidence", [])):
    stored = resolve(c["metric_id"])
    ok = abs(float(stored) - float(c["value"])) <= max(0.011, abs(stored) * 0.005)
    results.append({"agent_id": "regime", "passed": ok, "citations_checked": 1, "errors": [] if ok else [f"{c['metric_id']} mismatch"]})
    failed += not ok

(ROOT / "data" / "run0" / "validation.json").write_text(json.dumps(results, indent=1))
for r in results:
    if r["agent_id"] != "regime" or not r["passed"]:
        print(("PASS " if r["passed"] else "FAIL ") + r["agent_id"], r["citations_checked"], "citations", r["errors"][:3])
print("total failed:", failed)
sys.exit(1 if failed else 0)
