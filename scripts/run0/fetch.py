"""Run 0 Data Steward: a minimal, cache-first fetcher for the first manual weekly run.

- Reads API keys from environment variables; never prints or stores them (URLs are redacted).
- Content-addressed raw store: data/raw/<source>/<sha256>.<ext>.gz
- Manifest with provenance: data/run0/manifest.json (request hash, redacted URL, time, status, sha256, bytes)
- Cache: a request whose hash already succeeded today is skipped (no second download).

Phase 1 replaces this with harness/data/steward.py writing to Supabase.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "run0" / "manifest.json"
TODAY = datetime.now(timezone.utc).date().isoformat()
SECRET_NAMES = ["FRED_API_KEY", "EIA_API_KEY", "MASSIVE_API_KEY"]
UA = {"User-Agent": "macro-trader-run0/0.1 (research; contact: repo owner)"}

FRED_SERIES = [
    # liquidity & dollar
    "WALCL", "WTREGEN", "RRPONTSYD", "WRESBAL", "M2SL", "ECBASSETSW", "JPNASSETS", "DTWEXBGS", "NFCI", "DEXJPUS",
    # rates & credit
    "DFF", "DFEDTARU", "SOFR", "DGS3MO", "DGS2", "DGS10", "DGS30", "T10Y3M", "T10Y2Y", "DFII10", "T10YIE",
    "T5YIFR", "BAMLH0A0HYM2", "BAMLC0A0CM", "ECBDFR",
    # growth, labor, inflation
    "CPIAUCSL", "CPILFESL", "PCEPILFE", "UNRATE", "SAHMREALTIME", "ICSA", "CCSA", "PAYEMS", "INDPRO", "GDPNOW",
    "MICH", "RSAFS", "GACDFSA066MSFRBPHI",
    # supply chain, policy uncertainty
    "ISRATIO", "USEPUINDXD",
    # energy & vol & equity
    "DCOILWTICO", "DCOILBRENTEU", "DHHNGSP", "VIXCLS", "VXVCLS", "OVXCLS", "GVZCLS", "VXEEMCLS", "SP500",
]
EIA_SERIES = ["PET.WCESTUS1.W", "PET.W_EPC0_SAX_YCUOK_MBBL.W", "PET.WCRFPUS2.W", "NG.NW2_EPG0_SWO_R48_BCF.W"]
ETFS = ["SPY", "QQQ", "IWM", "EFA", "EEM", "FEZ", "EWJ", "FXI", "INDA", "EWZ",
        "GLD", "SLV", "USO", "UNG", "XLE", "TLT", "HYG"]
OPTION_UNDERLYINGS = ["SPY", "QQQ", "IWM", "EFA", "EEM", "FXI", "EWJ", "GLD", "SLV", "USO", "UNG", "XLE", "TLT"]
OPTION_EXPIRY = "2026-12-18"   # third Friday of December: 46 days from 2026-11-02
MASSIVE_HOSTS = ["https://api.massive.com", "https://api.polygon.io"]


def redact(url: str) -> str:
    for name in SECRET_NAMES:
        val = os.environ.get(name)
        if val:
            url = url.replace(val, "***")
    return url


def load_manifest() -> list[dict]:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return []


def save_manifest(entries: list[dict]) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(entries, indent=1))


def fetch(entries: list[dict], source: str, series_id: str, url: str, ext: str, timeout: int = 60) -> dict | None:
    red = redact(url)
    req_hash = hashlib.sha256(f"{source}|{red}".encode()).hexdigest()
    for e in entries:
        if e["request_hash"] == req_hash and e["ok"] and e["fetched_at"][:10] == TODAY:
            return e  # cache hit: never download the same thing twice
    entry = {"source": source, "series_id": series_id, "url": red, "request_hash": req_hash,
             "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "ok": False}
    try:
        r = requests.get(url, headers=UA, timeout=timeout)
        entry["http_status"] = r.status_code
        body = r.content
        if r.status_code == 200 and body:
            sha = hashlib.sha256(body).hexdigest()
            path = RAW / source / f"{sha}.{ext}.gz"
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_bytes(gzip.compress(body))
            entry.update(ok=True, sha256=sha, bytes=len(body), path=str(path.relative_to(ROOT)))
        else:
            entry["error"] = redact(body[:300].decode("utf-8", "replace"))
    except Exception as exc:  # network errors are recorded, not fatal
        entry["error"] = redact(str(exc))[:300]
    entries.append(entry)
    return entry


def massive_get(entries, series_id, path_and_query, ext="json"):
    key = os.environ.get("MASSIVE_API_KEY", "")
    sep = "&" if "?" in path_and_query else "?"
    for host in MASSIVE_HOSTS:
        e = fetch(entries, "massive", series_id, f"{host}{path_and_query}{sep}apiKey={key}", ext)
        if e and e["ok"]:
            return e
    return e


def last_obs(entries: list[dict], sid: str) -> str | None:
    """Latest observation date already stored for a series (any earlier successful payload)."""
    best = None
    for e in entries:
        if e["series_id"] != sid or not e["ok"]:
            continue
        body = json.loads(gzip.decompress((ROOT / e["path"]).read_bytes()))
        if sid.startswith("fred:"):
            dates = [o["date"] for o in body.get("observations", [])]
        elif sid.startswith("eia:"):
            dates = [d["period"] for d in body.get("response", {}).get("data", [])]
        elif sid.startswith("massive:"):
            dates = [datetime.fromtimestamp(r["t"] / 1000, timezone.utc).date().isoformat() for r in body.get("results", [])]
        else:
            dates = []
        if dates:
            best = max(best or "", max(dates))
    return best


def since(day: str | None, back_days: int, default: str) -> str:
    if not day:
        return default
    return (datetime.fromisoformat(day) - timedelta(days=back_days)).date().isoformat()


def stored_within(entries: list[dict], sid: str, days: int) -> bool:
    now = datetime.now(timezone.utc)
    return any(e["series_id"] == sid and e["ok"] and now - datetime.fromisoformat(e["fetched_at"]) < timedelta(days=days) for e in entries)


def main() -> None:
    entries = load_manifest()
    fred_key = os.environ.get("FRED_API_KEY", "")
    eia_key = os.environ.get("EIA_API_KEY", "")

    for s in FRED_SERIES:
        start = since(last_obs(entries, f"fred:{s}"), 120, "2003-01-01")   # delta + revision window
        url = (f"https://api.stlouisfed.org/fred/series/observations?series_id={s}&file_type=json"
               f"&observation_start={start}&api_key={fred_key}")
        fetch(entries, "fred", f"fred:{s}", url, "json")
        time.sleep(0.15)

    for s in EIA_SERIES:
        fetch(entries, "eia", f"eia:{s}", f"https://api.eia.gov/v2/seriesid/{s}?length={12 if last_obs(entries, f'eia:{s}') else 600}&api_key={eia_key}", "json")

    for t in ETFS:   # owner's Massive plan allows ~5 calls/minute: pace the calls
        done = any(e["series_id"] == f"massive:{t}" and e["ok"] and e["fetched_at"][:10] == TODAY for e in entries)
        start = since(last_obs(entries, f"massive:{t}"), 7, "2016-01-01")
        massive_get(entries, f"massive:{t}",
                    f"/v2/aggs/ticker/{t}/range/1/day/{start}/{TODAY}?adjusted=true&sort=asc&limit=50000")
        if not done:
            time.sleep(13)

    if os.environ.get("RUN0_OPTIONS") == "1":   # plan is not entitled to options data (403 on 2026-11-02)
        for u in OPTION_UNDERLYINGS:
            for side in ("put", "call"):
                massive_get(entries, f"massive:opt:{u}:{OPTION_EXPIRY}:{side}",
                            f"/v3/snapshot/options/{u}?expiration_date={OPTION_EXPIRY}&contract_type={side}&limit=250")

    fetch(entries, "gpr", "gpr:daily", "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls", "xls")
    if not stored_within(entries, "gpr:monthly", 25):
        fetch(entries, "gpr", "gpr:monthly", "https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls", "xls")
    if not stored_within(entries, "nyfed:GSCPI", 25):
        fetch(entries, "nyfed", "nyfed:GSCPI",
          "https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx", "xlsx")
    # Cboe CDN and multpl/Shiller hosts are blocked by the cloud network policy; VIX3M comes from FRED (VXVCLS).
    if not stored_within(entries, "datahub:sp500_pe10", 365):
        fetch(entries, "datahub", "datahub:sp500_pe10",
          "https://raw.githubusercontent.com/datasets/s-and-p-500/main/data/data.csv", "csv")

    save_manifest(entries)
    todays = [e for e in entries if e["fetched_at"][:10] == TODAY]
    ok = [e for e in todays if e["ok"]]
    print(f"requests today: {len(todays)}  ok: {len(ok)}  failed: {len(todays) - len(ok)}")
    for e in todays:
        if not e["ok"]:
            print("FAILED", e["series_id"], e.get("http_status"), (e.get("error") or "")[:120])


if __name__ == "__main__":
    sys.exit(main())
