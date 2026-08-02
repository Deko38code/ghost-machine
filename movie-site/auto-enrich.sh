#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CineVault Auto-Enrich — Daily scraper + cover art filler
# Runs via cron, no human input needed
# ═══════════════════════════════════════════════════════════
set -euo pipefail
cd /home/ghost/movie-site
DATA_DIR="./data"
mkdir -p "$DATA_DIR"
LOG="$DATA_DIR/enrich.log"
echo "[$(date)] Auto-enrich starting" >> "$LOG"

# ── 1. SCRAPE TMDB TRENDING (no key needed for /trending) ──
echo "[$(date)] Scraping TMDB trending..." >> "$LOG"
for endpoint in "movie/popular" "tv/popular" "trending/all/day" "trending/all/week" "movie/top_rated" "tv/top_rated"; do
  curl -s "https://api.themoviedb.org/3/${endpoint}?api_key=&language=en-US&page=1" \
    -o "$DATA_DIR/tmdb_${endpoint//\//_}.json" 2>/dev/null || true
  # Also try without API key (some public endpoints work)
  curl -s "https://api.themoviedb.org/3/${endpoint}?language=en-US&page=1" \
    -o "$DATA_DIR/tmdb_${endpoint//\//_}_nokey.json" 2>/dev/null || true
done

# ── 2. SCRAPE CINEMETA (Stremio metadata — IMDB↔TMDB bridge) ──
echo "[$(date)] Scraping Cinemeta catalogs..." >> "$LOG"
curl -sL "https://v3-cinemeta.strem.io/catalog/movie/top/imdb.json" -o "$DATA_DIR/cinemeta_movies.json" 2>/dev/null || true
curl -sL "https://v3-cinemeta.strem.io/catalog/series/top/imdb.json" -o "$DATA_DIR/cinemeta_series.json" 2>/dev/null || true

# ── 3. SCRAPE CINEMETA DETAIL PAGES (IMDB→TMDB reverse mapping) ──
# For each top item, fetch detail to get tmdb_id
echo "[$(date)] Scraping Cinemeta detail pages..." >> "$LOG"
DETAIL_QUEUE="/home/ghost/movie-site/data/cinemeta_detail_queue.txt"
echo "" > "$DETAIL_QUEUE"
for fname in cinemeta_movies.json cinemeta_series.json; do
  python3 -c "
import json, sys
try:
  with open('$DATA_DIR/$fname') as f: data = json.load(f)
  for item in data.get('metas', [])[:50]:
    imdb_id = item.get('imdb_id') or item.get('id', '')
    mtype = 'series' if 'series' in fname else 'movie'
    if imdb_id.startswith('tt'):
      print(f'{imdb_id}|{mtype}')
except: pass
" >> "$DETAIL_QUEUE" 2>/dev/null
done

# Fetch detail pages to get TMDB IDs
echo "[$(date)] Resolving TMDB IDs via Cinemeta detail..." >> "$LOG"
CINEMETA_MAP="/home/ghost/movie-site/data/cinemeta_tmdb_map.json"
python3 << 'PYDETAIL'
import json, urllib.request, time, os
DATA = "/home/ghost/movie-site/data"
queue_file = f"{DATA}/cinemeta_detail_queue.txt"
result = {}
try:
    with open(queue_file) as f:
        lines = [l.strip() for l in f if '|' in l]
    for line in lines:
        parts = line.split('|')
        if len(parts) != 2: continue
        imdb_id, mtype = parts
        url = f"https://v3-cinemeta.strem.io/meta/{mtype}/{imdb_id}.json"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CineVault/1.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read())
            meta = data.get("meta", {})
            tmdb_id = str(meta.get("tmdb_id", ""))
            name = meta.get("name", "")
            if tmdb_id.isdigit():
                result[tmdb_id] = imdb_id
                result[imdb_id] = imdb_id
        except:
            pass
        time.sleep(0.3)  # Rate limit
except Exception as e:
    pass
with open(f"{DATA}/cinemeta_tmdb_map.json", "w") as f:
    json.dump(result, f, indent=2)
print(f"Cinemeta detail: resolved {len(result)} TMDB/IMDB pairs")
PYDETAIL

# ── 4. SCRAPE KITSU (anime metadata) ──
curl -s "https://kitsu.io/api/edge/anime?page%5Blimit%5D=50&sort=popularityRank" -o "$DATA_DIR/kitsu_anime.json" 2>/dev/null || true

# ── 5. RESOLVE TMDB→IMDB FOR CURATED IDs VIA CINEMETA + OMDb ──
# Build the map from cinemeta data + OMDb batch
python3 << 'PYEOF'
import json, os, re, time, urllib.request, urllib.error

DATA = "/home/ghost/movie-site/data"
LOG = f"{DATA}/enrich.log"
SERVER_JS = "/home/ghost/movie-site/server.js"
CURATED_JS = "/home/ghost/movie-site/js/curated.js"

def log(msg):
    with open(LOG, "a") as f:
        f.write(f"[enrich-py] {msg}\n")

# ── Load existing TMDB_TO_IMDB_MAP from server.js ──
existing_map = {}
try:
    with open(SERVER_JS, "r") as f:
        content = f.read()
    for m in re.finditer(r"'(\d+)':\s*'(tt\d+)'", content):
        existing_map[m.group(1)] = m.group(2)
    log(f"Loaded {len(existing_map)} existing TMDB→IMDB mappings from server.js")
except Exception as e:
    log(f"Error loading existing map: {e}")

# ── Load Cinemeta detail TMDB map ──
cinemeta_detail_map = {}
try:
    with open(os.path.join(DATA, "cinemeta_tmdb_map.json"), "r") as f:
        cinemeta_detail_map = json.load(f)
    log(f"Loaded {len(cinemeta_detail_map)} entries from cinemeta detail map")
except:
    pass

# ── Collect all TMDB IDs from curated.js ──
curated_ids = set()
try:
    with open(CURATED_JS, "r") as f:
        for m in re.finditer(r'id:\s*(\d+)', f.read()):
            curated_ids.add(m.group(1))
    log(f"Found {len(curated_ids)} unique TMDB IDs in curated.js")
except Exception as e:
    log(f"Error reading curated IDs: {e}")

# ── Extract IMDB IDs from Cinemeta catalogs ──
cinemeta_map = {}
for fname in ["cinemeta_movies.json", "cinemeta_series.json"]:
    fpath = os.path.join(DATA, fname)
    if not os.path.exists(fpath):
        continue
    try:
        with open(fpath, "r") as f:
            data = json.load(f)
        for item in data.get("metas", []):
            imdb_id = item.get("imdb_id") or item.get("id", "")
            if not imdb_id.startswith("tt"):
                continue
            # Extract TMDB ID from popularities or other fields
            tmdb_id = None
            pops = item.get("popularities", {})
            if pops and "moviedb" in pops:
                # Need to look up TMDB via Cinemeta detail endpoint later
                pass
            # Check for tmdb_id in item directly
            if "tmdb_id" in item:
                tmdb_id = str(item["tmdb_id"])
            # Try to extract from slug like "movie/the-matrix-1333" or "series/the-boys-1190634"
            if not tmdb_id:
                slug = item.get("slug", "")
                # slug format: "movie/NAME-TMDBID"
                parts = slug.rsplit("-", 1)
                if len(parts) == 2:
                    candidate = parts[-1]
                    if candidate.isdigit():
                        tmdb_id = candidate
            if tmdb_id and tmdb_id.isdigit():
                cinemeta_map[tmdb_id] = imdb_id
            # Also store by imdb_id for OMDb skip
            if imdb_id:
                cinemeta_map[imdb_id] = imdb_id
        log(f"Extracted {len(cinemeta_map)} mappings from {fname}")
    except Exception as e:
        log(f"Error parsing {fname}: {e}")

# ── OMDb resolution for curated IDs missing IMDB mapping ──
OMDB_KEY = "trilogy"
missing_ids = curated_ids - set(existing_map.keys()) - set(cinemeta_map.keys())
omdb_map = {}
log(f"Resolving {len(missing_ids)} missing IDs via OMDb (rate-limited)")

# We need title names for OMDb search - extract from curated.js
id_to_name = {}
try:
    with open(CURATED_JS, "r") as f:
        content = f.read()
    # Match {id:NUMBER,name:'NAME'} patterns from SHOW_DATABASE
    for m in re.finditer(r"id:\s*(\d+),\s*name:\s*'([^']*)'", content):
        id_to_name[m.group(1)] = m.group(2)
except:
    pass

resolved_count = 0
for tmdb_id in list(missing_ids)[:50]:  # Cap at 50 per run to stay under daily limit
    name = id_to_name.get(tmdb_id, "")
    if not name:
        continue
    mtype = "series" if tmdb_id in ["76479","1399","1396","66732","70536","82856","60573","67915","57243","2316","45793","1668","1434","2190","60625","4626","55316","4614","1100","2615","2734","37854","12971","1429","100283","125141","104281","31911","71446","46260","67158","71663","71912","77169","82819","62104","62710","48891","70548","1622","2478","67195","103516","85968","89826","94555","88396","85271","84958","70524","100088","93405","618344","8592","202250","4087","60059","2287","102022"] else "movie"
    url = f"https://www.omdbapi.com/?apikey={OMDB_KEY}&t={urllib.parse.quote(name)}&type={mtype}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CineVault/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        imdb_id = data.get("imdbID", "")
        if imdb_id.startswith("tt"):
            omdb_map[tmdb_id] = imdb_id
            resolved_count += 1
    except:
        pass
    time.sleep(1.1)  # Rate limit: ~55 req/min

log(f"OMDb resolved {resolved_count} new IDs")

# ── Merge all maps ──
merged = {**existing_map, **cinemeta_map, **cinemeta_detail_map, **omdb_map}
log(f"Total TMDB→IMDB mappings: {len(merged)}")

# Write full map to JSON data file
with open(os.path.join(DATA, "tmdb_imdb_map_full.json"), "w") as f:
    json.dump(merged, f, indent=2)
log(f"Wrote tmdb_imdb_map_full.json ({len(merged)} entries)")

# ── Update server.js TMDB_TO_IMDB_MAP ──
if len(merged) > len(existing_map):
    # Build the replacement map text
    lines = ["      // Auto-enriched TMDB→IMDB mapping (updated " + time.strftime("%Y-%m-%d") + ")"]
    
    # Sort by TMDB ID (numeric)
    for tmdb_id in sorted(merged.keys(), key=lambda x: int(x)):
        imdb_id = merged[tmdb_id]
        # Try to find a name comment
        name = id_to_name.get(tmdb_id, "")
        comment = f"  // {name}" if name else ""
        lines.append(f"        '{tmdb_id}': '{imdb_id}',{comment}")
    
    new_map_text = "\n".join(lines) + "\n      "
    
    # Find and replace the TMDB_TO_IMDB_MAP block in server.js
    with open(SERVER_JS, "r") as f:
        content = f.read()
    
    # Find start/end of the map
    start_marker = "const TMDB_TO_IMDB_MAP = {"
    end_marker = "};"
    start_idx = content.find(start_marker)
    if start_idx != -1:
        # Find the closing };
        end_idx = content.find(end_marker, start_idx)
        if end_idx != -1:
            # Find if there's a "if (TMDB_TO_IMDB_MAP..." right after
            old_block = content[start_idx:end_idx + len(end_marker)]
            new_block = f"{start_marker}\n{new_map_text}\n      {end_marker}"
            content = content[:start_idx] + new_block + content[end_idx + len(end_marker):]
            
            with open(SERVER_JS, "w") as f:
                f.write(content)
            log(f"Updated server.js with {len(merged)} TMDB→IMDB mappings (was {len(existing_map)})")

# ── Find blank cover art spots ──
# Check which curated items have no poster by testing cover-art endpoint
blank_covers = []
for tmdb_id in sorted(curated_ids, key=lambda x: int(x)):
    if tmdb_id in merged:
        # Has IMDB mapping, likely has cover art from OMDb
        pass
    else:
        blank_covers.append(tmdb_id)

log(f"Items without TMDB→IMDB mapping (blank cover art risk): {len(blank_covers)}")
if blank_covers:
    with open(os.path.join(DATA, "blank_covers.json"), "w") as f:
        json.dump(blank_covers, f, indent=2)

# ── Scrape trending for NEW items to add ──
trending_new = []
for fname in ["cinemeta_movies.json", "cinemeta_series.json"]:
    fpath = os.path.join(DATA, fname)
    if not os.path.exists(fpath):
        continue
    try:
        with open(fpath, "r") as f:
            data = json.load(f)
        for item in data.get("metas", [])[:100]:  # Top 100
            imdb_id = item.get("id", "")
            if not imdb_id.startswith("tt"):
                continue
            name = item.get("name", "Unknown")
            # Only add if not already in our map
            if imdb_id not in merged.values():
                trending_new.append({
                    "imdb_id": imdb_id,
                    "name": name,
                    "year": item.get("year", ""),
                    "type": "series" if fname == "cinemeta_series.json" else "movie",
                    "poster": (item.get("poster") or "").replace("http://", "https://"),
                    "rating": item.get("beholderDaddyInfo", {}).get("imdbRating", ""),
                })
    except:
        pass

log(f"New trending items not in database: {len(trending_new)}")
with open(os.path.join(DATA, "trending_new.json"), "w") as f:
    json.dump(trending_new, f, indent=2)

# ── Cover art blank spot checker ──
# Hit the cover-art endpoint for items missing from the map
cover_needs_fetch = []
for tmdb_id in blank_covers[:20]:  # Cap per run
    cover_needs_fetch.append(tmdb_id)

log(f"Cover art fetches needed: {len(cover_needs_fetch)}")
with open(os.path.join(DATA, "cover_needs_fetch.json"), "w") as f:
    json.dump(cover_needs_fetch, f, indent=2)

print(f"ENRICHMENT COMPLETE: {len(merged)} total mappings, {len(blank_covers)} blanks, {len(trending_new)} new trending")
PYEOF

echo "[$(date)] Python enrichment done" >> "$LOG"

# ── 5. SYNC TO USB ──
echo "[$(date)] Syncing to USB..." >> "$LOG"
rsync -a --delete "/home/ghost/movie-site/" "/media/ghost/USB STICK1/movie-site/" 2>/dev/null || true
rsync -a "/home/ghost/movie-site/data/" "/media/ghost/USB STICK1/movie-site/data/" 2>/dev/null || true

# ── 6. RESTART SERVER IF RUNNING ──
if pgrep -f "node server.js" > /dev/null 2>&1; then
  # Send SIGHUP for graceful reload (if supported) or restart
  pkill -f "node server.js" 2>/dev/null || true
  sleep 2
  cd /home/ghost/movie-site && node server.js &
  disown
  echo "[$(date)] Server restarted" >> "$LOG"
fi

echo "[$(date)] Auto-enrich complete" >> "$LOG"