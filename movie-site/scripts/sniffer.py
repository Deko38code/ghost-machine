#!/usr/bin/env python3
"""
CineVault Sniffer — auto-discovers new movies/TV + cover art
Runs on cron every 20 min. Checks:
  1. OMDB for upcoming Star Wars releases
  2. TMDB trending/now_playing/airing_today
  3. Fills missing cover art in cover_bank.json
  4. Reports NEW findings only (state file tracks what we've seen)
"""

import json, os, sys, urllib.request, urllib.parse, urllib.error, ssl, datetime, time, re

# ── Config ──────────────────────────────────────────
MOVIE_SITE    = "/home/ghost/movie-site"
FRANCHISES_JS = f"{MOVIE_SITE}/scripts/flix-ai.js"
COVER_BANK    = f"{MOVIE_SITE}/data/cover_bank.json"
STATE_FILE    = f"{MOVIE_SITE}/data/sniffer_state.json"
OMDB_KEY      = "trilogy"
REPORT_FILE   = f"{MOVIE_SITE}/data/sniffer_report.json"

# Star Wars IMDB IDs we already track
SW_KNOWN = {
  'tt0076759','tt0080684','tt0086190','tt0120915','tt0121765','tt0121766',
  'tt2488496','tt3748528','tt3778644','tt2527338','tt2527336',
  'tt8111088','tt13622776','tt12591082','tt12758562','tt13291336',
  'tt15475710','tt13622786','tt0187430','tt0458290','tt14132716',
  'tt15691788','tt15155558',
}

# Search terms to sniff
SNIFF_TERMS = [
  "Star Wars", "Star Wars Rey", "Star Wars New Jedi Order",
  "Mandalorian movie", "Ahsoka season 2", "Andor season 2",
]

# TMDB now playing / trending endpoints (no key needed for public API if we scrape discover)
TMDB_FRANCHISE_IDS = {
  "Star Wars": 7,  # TMDB collection ID
}

# ── Helpers ─────────────────────────────────────────
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_json(url, retries=2):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                'Accept': 'application/json',
            })
            with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                return None

def fetch_html(url, retries=2):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                'Accept': 'text/html',
            })
            with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
                return r.read().decode('utf-8', errors='replace')
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                return None

def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except:
        return {}

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def metahub_poster(imdb_id):
    return f"https://images.metahub.space/poster/small/{imdb_id}/img"

def omdb_search(title, year=None):
    params = f"?apikey={OMDB_KEY}&s={urllib.parse.quote(title)}&type=movie,series"
    if year:
        params += f"&y={year}"
    data = fetch_json(f"https://www.omdbapi.com/{params}")
    if data and data.get('Response') == 'True':
        return data.get('Search', [])
    return []

def omdb_detail(imdb_id):
    data = fetch_json(f"https://www.omdbapi.com/?apikey={OMDB_KEY}&i={imdb_id}")
    if data and data.get('Response') == 'True':
        return data
    return None

# ── TMDB scraping (no API key — scrape OG image) ────
def tmdb_movie_ids_from_collection(collection_id):
    """Scrape TMDB collection page for movie IDs"""
    html = fetch_html(f"https://www.themoviedb.org/collection/{collection_id}")
    if not html:
        return []
    # Find movie links like /movie/11-star-wars
    ids = re.findall(r'/movie/(\d+)[\-\w]*-star-wars', html, re.I)
    if not ids:
        ids = re.findall(r'/movie/(\d+)', html)
    return list(set(ids))

def tmdb_movie_detail(tmdb_id):
    """Get movie info from TMDB page"""
    html = fetch_html(f"https://www.themoviedb.org/movie/{tmdb_id}")
    if not html:
        return None
    info = {}
    # Extract title
    m = re.search(r'<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)', html)
    if m:
        info['title'] = m.group(1).strip()
    # Extract release date
    m = re.search(r'release_date.*?(\d{4}-\d{2}-\d{2})', html)
    if m:
        info['release_date'] = m.group(1)
    # Extract IMDB ID
    m = re.search(r'imdb\.com/title/(tt\d+)', html)
    if m:
        info['imdb_id'] = m.group(1)
    # Extract poster
    m = re.search(r'image">\s*<img[^>]*src="([^"]+)"', html)
    if m:
        info['poster'] = m.group(1)
    # Extract overview
    m = re.search(r'<div[^>]*class="[^"]*overview[^"]*"[^>]*>\s*<p>([^<]+)', html)
    if m:
        info['overview'] = m.group(1).strip()[:200]
    return info if info.get('title') else None

# ── Main sniffer logic ─────────────────────────────
def sniff_star_wars():
    """Hunt for new Star Wars content"""
    findings = []
    current_year = datetime.datetime.now().year

    # 1. OMDB search for Star Wars movies/series this year + next year
    for year in [current_year, current_year + 1]:
        for term in SNIFF_TERMS:
            results = omdb_search(term, year=year)
            if not results:
                continue
            for r in results:
                imdb_id = r.get('imdbID', '')
                if imdb_id in SW_KNOWN:
                    continue
                title = r.get('Title', '')
                # Broad match — anything Star Wars related
                title_low = title.lower()
                if not any(kw in title_low for kw in ['star wars', 'mandalorian', 'ahsoka', 'andor', 'obi', 'boba', 'grogu', 'jedi', 'sith', 'maul', 'clone', 'rebels', 'skeleton']):
                    continue
                # New find!
                detail = omdb_detail(imdb_id)
                findings.append({
                    'franchise': 'Star Wars',
                    'imdb_id': imdb_id,
                    'title': title,
                    'year': r.get('Year', ''),
                    'type': r.get('Type', ''),
                    'poster': r.get('Poster', metahub_poster(imdb_id)),
                    'plot': detail.get('Plot', '') if detail else '',
                    'found_at': datetime.datetime.now().isoformat(),
                })
            time.sleep(1)  # OMDB rate limit

    # 2. TMDB collection scrape — find movies not in our list
    try:
        tmdb_ids = tmdb_movie_ids_from_collection(7)  # SW collection = 7
        for tid in tmdb_ids:
            tid = int(tid)
            # Check if we already have this TMDB ID
            detail = tmdb_movie_detail(tid)
            if not detail:
                continue
            imdb_id = detail.get('imdb_id', '')
            if imdb_id and imdb_id not in SW_KNOWN:
                findings.append({
                    'franchise': 'Star Wars',
                    'tmdb_id': tid,
                    'imdb_id': imdb_id,
                    'title': detail.get('title', ''),
                    'release_date': detail.get('release_date', ''),
                    'type': 'movie',
                    'poster': detail.get('poster', ''),
                    'overview': detail.get('overview', ''),
                    'found_at': datetime.datetime.now().isoformat(),
                })
            time.sleep(1)
    except Exception as e:
        pass  # TMDB scrape may fail due to CF, that's ok

    # 3. Check OMDB for Star Wars Rey / New Jedi Order specifically
    for specific in ["Star Wars Rey", "Star Wars New Jedi Order", "Star Wars 2026", "Star Wars 2027"]:
        detail = omdb_detail("")  # search by title
        results = omdb_search(specific)
        for r in (results or []):
            imdb_id = r.get('imdbID', '')
            if imdb_id and imdb_id not in SW_KNOWN:
                d = omdb_detail(imdb_id)
                findings.append({
                    'franchise': 'Star Wars',
                    'imdb_id': imdb_id,
                    'title': r.get('Title', ''),
                    'year': r.get('Year', ''),
                    'type': r.get('Type', ''),
                    'poster': r.get('Poster', metahub_poster(imdb_id)),
                    'plot': d.get('Plot', '') if d else '',
                    'found_at': datetime.datetime.now().isoformat(),
                })
        time.sleep(1)

    return findings

def sniff_general_new_releases():
    """Check OMDB for current box office / new releases"""
    findings = []
    current_year = datetime.datetime.now().year

    # Search for current year movies across genres
    searches = [
        f"new movies {current_year}",
        f"marvel {current_year}",
        f"dc {current_year}",
        f"horror {current_year}",
    ]
    for term in searches:
        results = omdb_search(term, year=current_year)
        if not results:
            continue
        for r in results:
            imdb_id = r.get('imdbID', '')
            if not imdb_id or imdb_id.startswith('tt0') and len(imdb_id) < 8:
                continue
            findings.append({
                'franchise': 'New Releases',
                'imdb_id': imdb_id,
                'title': r.get('Title', ''),
                'year': r.get('Year', ''),
                'type': r.get('Type', ''),
                'poster': r.get('Poster', metahub_poster(imdb_id)),
                'found_at': datetime.datetime.now().isoformat(),
            })
        time.sleep(1)

    return findings

def sniff_missing_covers():
    """Find entries in cover_bank missing posters and fill them"""
    bank = load_json(COVER_BANK)
    fixed = 0

    for key, entry in bank.items():
        if isinstance(entry, dict) and entry.get('imdbId'):
            poster = entry.get('poster', '')
            if not poster or 'placeholder' in str(poster).lower() or poster == '':
                imdb_id = entry['imdbId']
                # Try OMDB for poster
                detail = omdb_detail(imdb_id)
                if detail and detail.get('Poster') and detail['Poster'] != 'N/A':
                    entry['poster'] = detail['Poster']
                    fixed += 1
                else:
                    # Fallback to metahub
                    entry['poster'] = metahub_poster(imdb_id)
                    fixed += 1
                time.sleep(0.5)

    if fixed:
        save_json(COVER_BANK, bank)

    return fixed

def update_state(new_findings):
    """Track what we've seen so we only report NEW stuff"""
    state = load_json(STATE_FILE)
    if 'seen_ids' not in state:
        state['seen_ids'] = []
    if 'findings' not in state:
        state['findings'] = []
    if 'last_run' not in state:
        state['last_run'] = ''

    truly_new = []
    seen = set(state['seen_ids'])

    for f in new_findings:
        fid = f.get('imdb_id') or f.get('tmdb_id') or f.get('title', '')
        if fid and fid not in seen:
            truly_new.append(f)
            seen.add(fid)
            state['findings'].append(f)

    state['seen_ids'] = list(seen)
    state['last_run'] = datetime.datetime.now().isoformat()
    save_json(STATE_FILE, state)
    return truly_new

def write_report(truly_new, covers_fixed):
    """Write a report for the cron agent to read"""
    report = {
        'timestamp': datetime.datetime.now().isoformat(),
        'new_movies': len(truly_new),
        'covers_fixed': covers_fixed,
        'findings': truly_new,
        'status': 'OK',
    }
    save_json(REPORT_FILE, report)

# ── Run ─────────────────────────────────────────────
if __name__ == '__main__':
    print(f"[SNIFFER] {datetime.datetime.now().isoformat()} Starting...")

    all_findings = []

    # Star Wars specific
    print("[SNIFFER] Hunting Star Wars...")
    sw = sniff_star_wars()
    print(f"[SNIFFER] Star Wars: {len(sw)} new finds")
    all_findings.extend(sw)

    # General new releases
    print("[SNIFFER] Checking new releases...")
    gen = sniff_general_new_releases()
    print(f"[SNIFFER] General: {len(gen)} finds")
    all_findings.extend(gen)

    # Fix missing covers (rate limited — only fix a few per run)
    print("[SNIFFER] Patching missing covers...")
    covers_fixed = sniff_missing_covers()
    print(f"[SNIFFER] Covers fixed: {covers_fixed}")

    # Update state
    truly_new = update_state(all_findings)
    print(f"[SNIFFER] Truly new (not seen before): {len(truly_new)}")

    # Write report
    write_report(truly_new, covers_fixed)

    # Summary output for cron
    if truly_new:
        for f in truly_new:
            label = f.get('title', 'Unknown')
            fid = f.get('imdb_id') or f.get('tmdb_id', '?')
            ftype = f.get('type', '?')
            print(f"[SNIFFER] NEW: {label} ({fid}) [{ftype}]")
    else:
        print("[SNIFFER] Nothing new this run.")

    print(f"[SNIFFER] Done. Covers patched: {covers_fixed}")