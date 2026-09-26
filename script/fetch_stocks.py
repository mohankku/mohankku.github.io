#!/usr/bin/env python3
"""Fetch sector-stock snapshots for the Stock Dashboard.

Tries sources in order -- TwelveData (if key), Yahoo Finance (no key),
Alpha Vantage (if key) -- and writes the same schema the dashboard reads:

  live (assets/stocks-live.json):
    {metadata, last_updated, fetched_at,
     top_gainers[12, pct > 0, desc], top_losers[12, pct < 0, most-negative first],
     tech_all[all, desc]}
  history (assets/stocks-history.json):
    {updated, points: {ticker: last 40 prices}}

Exits 0 after writing files, 1 when every source fails or yields too few
symbols (caller should keep the existing files in that case).
Stdlib only -- no third-party dependencies.
"""

import argparse
import datetime
import json
import os
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

DEFAULT_SYMBOLS = (
    "AAPL,MSFT,GOOGL,META,AMZN,NFLX,ADBE,CSCO,IBM,NOW,NVDA,AMD,AVGO,TSM,MU,"
    "INTC,ARM,SMCI,DELL,ON,ASML,LRCX,KLAC,AMAT,ENTG,TER,SNPS,CDNS,COHR,MKSI,"
    "QCOM,TXN,NXPI,MRVL,ANET,CIEN,CRDO,LITE,FFIV,EXTR,ORCL,CRM,PLTR,CRWD,"
    "TSLA,SNOW,DDOG,PANW,ZS,TEAM,MRNA,REGN,VRTX,AMGN,GILD,BIIB,LLY,NVO,"
    "PFE,MRK"
)

USER_AGENT = {"User-Agent": "Mozilla/5.0"}
OUTLIER_PCT = 50.0  # |daily move| above this is treated as a bad quote
MIN_OK = 45  # minimum symbols for a usable batch
MAX_HISTORY = 40  # rolling points kept per ticker
TOP_N = 12


def pct_of(rec):
    return float(rec["change_percentage"].replace("%", ""))


def fetch_yahoo(symbols, timeout=10, sleep=0.3):
    """Per-symbol chart meta from Yahoo Finance. Returns (results, dropped)."""
    results, dropped = [], []
    for sym in symbols:
        url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{sym}?interval=1d&range=1d"
        )
        for attempt in (1, 2):
            try:
                req = urllib.request.Request(url, headers=USER_AGENT)
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    meta = json.load(r)["chart"]["result"][0]["meta"]
                price = float(meta["regularMarketPrice"])
                prev = float(meta["chartPreviousClose"])
                if price <= 0 or prev <= 0:
                    raise ValueError(f"non-positive price {price}/{prev}")
                chg = price - prev
                pct = chg / prev * 100
                if abs(pct) > OUTLIER_PCT:
                    dropped.append(sym)
                    print(f"Yahoo outlier {sym} {price} {pct:.2f}% -- dropped")
                    break
                try:
                    mcap = int(meta.get("marketCap") or 0)
                except (TypeError, ValueError):
                    mcap = 0
                results.append(
                    {
                        "ticker": sym,
                        "price": f"{price:.2f}",
                        "change_amount": f"{chg:.2f}",
                        "change_percentage": f"{pct:.4f}%",
                        "volume": str(meta.get("regularMarketVolume", 0)),
                        "market_cap": mcap,
                    }
                )
                print(f"Yahoo {sym} {price} {pct:.2f}% mcap={mcap}")
                break
            except Exception as e:  # noqa: BLE001 -- log and try next source/symbol
                print(f"Yahoo failed {sym} (try {attempt}): {e}")
        time.sleep(sleep)
    return results, dropped


def fetch_twelvedata(symbols, api_key, timeout=10, sleep=1.0):
    """Per-symbol quotes from TwelveData. Returns results list."""
    results = []
    for sym in symbols:
        url = (
            "https://api.twelvedata.com/quote"
            f"?symbol={sym}&interval=1day&apikey={api_key}"
        )
        for attempt in (1, 2):
            try:
                req = urllib.request.Request(url, headers=USER_AGENT)
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    q = json.load(r)
                if "symbol" not in q:
                    raise ValueError(str(q)[:200])
                price = float(q["close"])
                chg = float(q["change"])
                pct = float(q["percent_change"])
                try:
                    mcap = int(float(q.get("market_cap") or 0))
                except (TypeError, ValueError):
                    mcap = 0
                results.append(
                    {
                        "ticker": sym,
                        "price": f"{price:.2f}",
                        "change_amount": f"{chg:.2f}",
                        "change_percentage": f"{pct:.4f}%",
                        "volume": str(q.get("volume", 0)),
                        "market_cap": mcap,
                    }
                )
                print(f"TwelveData {sym} {price} {pct:.2f}%")
                break
            except Exception as e:  # noqa: BLE001
                print(f"TwelveData failed {sym} (try {attempt}): {e}")
        time.sleep(sleep)
    return results


def fetch_alpha(api_key, tech_set, timeout=15):
    """Alpha Vantage TOP_GAINERS_LOSERS, filtered to our symbols."""
    url = (
        "https://www.alphavantage.co/query"
        f"?function=TOP_GAINERS_LOSERS&apikey={api_key}"
    )
    req = urllib.request.Request(url, headers=USER_AGENT)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.load(r)
    if "Information" in data:
        raise ValueError(str(data["Information"])[:200])
    gainers = [x for x in data.get("top_gainers", []) if x.get("ticker") in tech_set]
    losers = [x for x in data.get("top_losers", []) if x.get("ticker") in tech_set]
    return gainers, losers


def build_output(results, source_label):
    """Split sorted results into the dashboard's live-file schema (no stamps)."""
    ordered = sorted(results, key=pct_of, reverse=True)
    pos = [r for r in ordered if pct_of(r) > 0][:TOP_N]
    neg = sorted(
        [r for r in ordered if pct_of(r) < 0], key=pct_of
    )[:TOP_N]
    return {
        "metadata": source_label,
        "top_gainers": pos,
        "top_losers": neg,
        "tech_all": ordered,
    }


def stamp(output):
    """Add fresh timestamps to a live-file payload."""
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_et = now_utc.astimezone(ZoneInfo("America/New_York"))
    output["last_updated"] = now_et.strftime("%Y-%m-%d %H:%M:%S US/Eastern")
    output["fetched_at"] = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    return output


def update_history(history_path, all_sorted, now_utc):
    """Append latest prices to the bounded rolling history; return payload."""
    hist = {}
    if os.path.exists(history_path):
        try:
            loaded = json.load(open(history_path))
            if isinstance(loaded.get("points"), dict):
                hist = loaded
        except Exception as e:  # noqa: BLE001 -- corrupt file, start fresh
            print(f"History unreadable, starting fresh: {e}")
    pts = hist.get("points", {})
    for r in all_sorted:
        try:
            px = float(r["price"])
        except (TypeError, ValueError):
            continue
        seq = pts.get(r["ticker"], [])
        if not seq or seq[-1] != px:
            seq.append(px)
        pts[r["ticker"]] = seq[-MAX_HISTORY:]
    return {"updated": now_utc, "points": pts}


def atomic_write(path, payload):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f, indent=2)
    os.replace(tmp, path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--symbols", default=DEFAULT_SYMBOLS)
    ap.add_argument("--live", default="assets/stocks-live.json")
    ap.add_argument("--history", default="assets/stocks-history.json")
    ap.add_argument("--min-ok", type=int, default=MIN_OK)
    args = ap.parse_args(argv)

    symbols = [s.strip() for s in args.symbols.split(",") if s.strip()]
    td_key = os.environ.get("TWELVEDATA_API_KEY", "")
    av_key = os.environ.get("ALPHAVANTAGE_API_KEY", "")
    output, label = None, ""

    if td_key:
        print(f"Fetching {len(symbols)} symbols via TwelveData...")
        res = fetch_twelvedata(symbols, td_key)
        if len(res) >= 5:
            output = build_output(res, "Sector stocks -- 6 sectors x 10")
            label = "TwelveData"
        else:
            print("TwelveData yielded too few symbols, falling through")

    if output is None:
        print(f"Fetching {len(symbols)} symbols via Yahoo...")
        res, dropped = fetch_yahoo(symbols)
        if len(res) >= args.min_ok:
            output = build_output(res, "Sector stocks -- 6 sectors x 10")
            label = "Yahoo"
            print(f"dropped outliers: {dropped or 'none'}")
        else:
            print(f"Yahoo insufficient ({len(res)} < {args.min_ok})")

    if output is None and av_key:
        print("Fetching Alpha Vantage TOP_GAINERS_LOSERS as last resort...")
        try:
            gainers, losers = fetch_alpha(av_key, set(symbols))
            if len(gainers) >= 3 and len(losers) >= 3:
                combined = sorted(
                    gainers + losers, key=pct_of, reverse=True
                )
                output = {
                    "metadata": "Sector stocks -- 6 sectors x 10 (Alpha filtered)",
                    "top_gainers": sorted(gainers, key=pct_of, reverse=True)[:TOP_N],
                    "top_losers": sorted(losers, key=pct_of)[:TOP_N],
                    "tech_all": combined,
                }
                label = "Alpha"
            else:
                print("Alpha filtered has insufficient tech symbols")
        except Exception as e:  # noqa: BLE001
            print(f"Alpha failed: {e}")

    if output is None:
        print("All sources failed -- keeping existing files", file=sys.stderr)
        return 1

    live = stamp(output)
    atomic_write(args.live, live)
    hist = update_history(args.history, live["tech_all"], live["fetched_at"])
    atomic_write(args.history, hist)
    print(
        f"{label} wrote {len(live['top_gainers'])} gainers, "
        f"{len(live['top_losers'])} losers, "
        f"{len(live['tech_all'])} total; history: {len(hist['points'])} tickers"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
