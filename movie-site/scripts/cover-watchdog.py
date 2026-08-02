#!/usr/bin/env python3
"""
CineVault Cover Art Watchdog
Checks all curated movie/TV IDs for missing cover art.
Uses Cinemeta (public, no API key needed) + TMDB (if key available).
Runs as a cron job, reports missing covers.
"""
import json, sys, time, os, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

SERVER = os.environ.get("CINEVAULT_SERVER", "http://localhost:8080")
TMDB_KEY = os.environ.get("TMDB_API_KEY", "")
TIMEOUT = 10
CINEMETA_BASE = "https://v3-cinemeta.strem.io"

# ═══ All curated TMDB IDs ═══
# Movies
MOVIE_IDS = sorted(set([
    8,9,10,11,12,13,21,22,24,26,58,62,85,86,87,89,93,98,120,121,
    122,1429,155,165,194,200,2001,2002,2003,2004,2105,218,238,2396,2397,
    2398,2399,2402,24428,245891,24637,2478,254,26,263,266,268,272,274,278,
    278154,284052,287,2899,290859,293660,302694,303,324549,324552,326291,
    326473,329,329869,330,331,335,335784,337339,338,338761,351286,
    345912,346,361197,361743,366,367,368,369,3691,3692,370913,37854,383498,
    385687,399,40011,407201,408529,408826,414,41421,419,420818,429617,438799,
    43964,440922,4470,447365,457078,457232,458156,46610,471574,48883,49026,
    49051,4935,4951,495764,496243,4971,497698,500,50619,508439,508943,51439,
    522404,527771,531908,533535,53423,53647,55316,557,558,559,566525,568124,
    572,577922,580489,584,585,594,603,604,605,608,609,610,616037,624860,
    634649,637,64688,650,653346,659,66732,668460,67158,679,680,681,686,687,
    68721,693,695,697,700,70160,70162,70163,705861,707,710,714166,71663,
    71912,722,76338,769,77169,809,810,812,824,82674,8587,8588,8589,87101,
    89826,88396,91314,920,921,93484,94555,947,948,9483,954,956,957,958,9476,
    10023,102610,102611,10340,104281,10721,10764,10766,10778,1100,11574,135397,
    1396,1399,1622,1668,181808,181812,1891,1892,1893,1894,1895,202250,2287,
    22862,281338,299534,299536,299537,302694,330459,348,348350,366,367,368,
    369,372658,424,539,550,594,631,748822,82819,82856,85968,9061,9058,102022,
    125141,1434,157336,168259,45793,4614,2316,46260,31911,57243,
    1585,10702,2615,2734,4087,590,48891,70548,1434,1668,60625,62104,
    60573,70536,82856,66732,67915,82856,4626
]))

TV_IDS = sorted(set([
    76479,4626,55316,2287,102022,1396,60059,1399,66732,67915,82856,2190,
    60625,2316,45793,67158,71663,85968,89826,94555,4087,2615,2734,1100,4614,
    202250,1622,2478,71912,82819,70536,60573,71446,46260,103516,57243,
    48891,70548,1434,1668,37854,12971,1429,100283,125141,104281,31911,326473
]))


def _fetch(url):
    """Fetch URL and return parsed JSON or None."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CineVault-Watchdog/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        return None


def _tmdb_to_imdb(tmdb_id, media_type):
    """Try to convert TMDB ID → IMDB ID via TMDB API."""
    if not TMDB_KEY:
        return None
    endpoint = "tv" if media_type == "tv" else "movie"
    url = f"https://api.themoviedb.org/3/{endpoint}/{tmdb_id}?api_key={TMDB_KEY}"
    data = _fetch(url)
    if data and data.get("imdb_id"):
        return data["imdb_id"]
    return None


def check_via_cinemeta(imdb_id, media_type):
    """Check if Cinemeta has a poster for an IMDB ID."""
    if not imdb_id:
        return None, None
    url = f"{CINEMETA_BASE}/catalog/{media_type}/top/{imdb_id}.json"
    # Cinemeta search doesn't work that way; try detail endpoint
    url = f"{CINEMETA_BASE}/stream/{media_type}/{imdb_id}.json"
    data = _fetch(url)
    if data and data.get("stream", {}).get("poster"):
        return data["stream"]["poster"], data["stream"].get("name")
    # Try the catalog/meta approach
    url2 = f"{CINEMETA_BASE}/meta/{media_type}/{imdb_id}.json"
    data2 = _fetch(url2)
    if data2 and data2.get("meta", {}).get("poster"):
        return data2["meta"]["poster"], data2["meta"].get("name")
    return None, None


def check_via_server(tmdb_id, media_type):
    """Check poster via CineVault server auto-enrich endpoint."""
    url = f"{SERVER}/api/auto-enrich?id={tmdb_id}&type={media_type}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CineVault-Watchdog/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        poster = data.get("poster", "")
        title = data.get("title") or data.get("name") or f"#{tmdb_id}"
        if poster and "placehold.co" not in poster and "no-poster" not in poster:
            return "ok", title, poster
        return "missing", title, poster
    except Exception as e:
        return "error", f"#{tmdb_id}", str(e)


def check_via_tmdb(tmdb_id, media_type):
    """Check poster via TMDB API directly."""
    if not TMDB_KEY:
        return "skip", f"#{tmdb_id}", "no_api_key"
    endpoint = "tv" if media_type == "tv" else "movie"
    url = f"https://api.themoviedb.org/3/{endpoint}/{tmdb_id}?api_key={TMDB_KEY}"
    data = _fetch(url)
    if data is None:
        return "error", f"#{tmdb_id}", "fetch_failed"
    title = data.get("title") or data.get("name") or f"#{tmdb_id}"
    poster_path = data.get("poster_path")
    if poster_path:
        return "ok", title, f"https://image.tmdb.org/t/p/w500{poster_path}"
    return "missing", title, ""


def check_item(item):
    """Check a single item. Returns dict with status, title, poster."""
    tmdb_id, media_type = item
    
    # Strategy 1: Hit the CineVault server (uses all sources)
    status, title, poster = check_via_server(tmdb_id, media_type)
    if status != "error":
        return {"id": tmdb_id, "type": media_type, "status": status, "title": title, "poster": poster}
    
    # Strategy 2: TMDB API directly
    status, title, poster = check_via_tmdb(tmdb_id, media_type)
    if status != "skip":
        return {"id": tmdb_id, "type": media_type, "status": status, "title": title, "poster": poster}
    
    # Strategy 3: Just report unknown
    return {"id": tmdb_id, "type": media_type, "status": "unknown", "title": f"#{tmdb_id}", "poster": ""}


def main():
    # Build deduplicated work items
    tv_set = set(TV_IDS)
    work = []
    seen = set()
    for mid in MOVIE_IDS:
        if mid not in seen:
            work.append((mid, "tv" if mid in tv_set else "movie"))
            seen.add(mid)
    for tid in TV_IDS:
        if tid not in seen:
            work.append((tid, "tv"))
            seen.add(tid)
    
    total = len(work)
    print(f"═══ CineVault Cover Art Watchdog ═══")
    print(f"Checking {total} titles ({len(MOVIE_IDS)-len(tv_set & set(MOVIE_IDS))} movies + {len(TV_IDS)} TV)...")
    print(f"Server: {SERVER}")
    if TMDB_KEY:
        print(f"TMDB key: ...{TMDB_KEY[-4:]}")
    print()
    
    found = 0
    missing = []
    errors = []
    
    # Parallel check with 5 workers
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(check_item, item): item for item in work}
        done = 0
        for future in as_completed(futures):
            done += 1
            result = future.result()
            if result["status"] == "ok":
                found += 1
            elif result["status"] == "missing":
                missing.append(result)
            else:
                errors.append(result)
            # Progress
            if done % 20 == 0 or done == total:
                print(f"  [{done}/{total}] checked...")
    
    print()
    print(f"═══ Cover Art Report ═══")
    print(f"✅ Found:    {found}/{total}")
    print(f"❌ Missing:  {len(missing)}")
    if errors:
        print(f"⚠️  Errors:   {len(errors)}")
    print()
    
    if missing:
        movies_missing = [m for m in missing if m["type"] == "movie"]
        tv_missing = [m for m in missing if m["type"] == "tv"]
        
        if movies_missing:
            print(f"🎬 Movies missing covers ({len(movies_missing)}):")
            for m in sorted(movies_missing, key=lambda x: x["id"]):
                print(f"  ❌ TMDB #{m['id']} — {m['title']}")
            print()
        if tv_missing:
            print(f"📺 TV shows missing covers ({len(tv_missing)}):")
            for m in sorted(tv_missing, key=lambda x: x["id"]):
                print(f"  ❌ TMDB #{m['id']} — {m['title']} (TV)")
            print()
        print(f"🚨 {len(missing)} covers need attention!")
    else:
        print("🎉 All covers present! Library is fully stocked.")
    
    # Write report file
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": total,
        "found": found,
        "missing": [{"id": m["id"], "type": m["type"], "title": m["title"]} for m in missing],
        "errors": [{"id": e["id"], "type": e["type"], "title": e["title"]} for e in errors],
    }
    report_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, "cover_watchdog_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: {report_path}")
    
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main()