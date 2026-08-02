#!/usr/bin/env python3
"""CineVault Quick Enrich - One-shot map builder"""
import json, os, re, time, urllib.request

DATA = "/home/ghost/movie-site/data"
SERVER_JS = "/home/ghost/movie-site/server.js"
CURATED_JS = "/home/ghost/movie-site/js/curated.js"

# Load existing map from server.js
existing_map = {}
with open(SERVER_JS, "r") as f:
    content = f.read()
for m in re.finditer(r"'(\d+)':\s*'(tt\d+)'", content):
    existing_map[m.group(1)] = m.group(2)
print(f"Existing map: {len(existing_map)} entries")

# Collect curated IDs + names
curated_ids = set()
id_to_name = {}
with open(CURATED_JS, "r") as f:
    c = f.read()

# SHOW_DATABASE entries: {id:12345,name:'Name'}
for m in re.finditer(r"\{id:\s*(\d+),\s*name:\s*'([^']*)'", c):
    id_to_name[m.group(1)] = m.group(2)
    curated_ids.add(m.group(1))

# IDs in bracket arrays: [123, 456, 789]
for m in re.finditer(r'\[([\d,\s]+)\]', c):
    for n in re.finditer(r'(\d+)', m.group(1)):
        curated_ids.add(n.group(1))

# ID keys in objects: ids: [123, 456]
for m in re.finditer(r'ids:\s*\[([\d,\s]+)\]', c):
    for n in re.finditer(r'(\d+)', m.group(1)):
        curated_ids.add(n.group(1))

missing = curated_ids - set(existing_map.keys())
print(f"Curated: {len(curated_ids)}, Mapped: {len(set(existing_map.keys()) & curated_ids)}, Missing: {len(missing)}")

# TV show IDs (for OMDb type=series lookup)
TV_IDS = {
    "76479","1399","1396","66732","70536","82856","60573","67915","57243","2316",
    "45793","1668","1434","2190","60625","4626","55316","4614","1100","2615",
    "2734","37854","12971","1429","100283","125141","104281","31911","71446","46260",
    "67158","71663","71912","77169","82819","62104","62710","48891","70548","1622",
    "2478","67195","103516","85968","89826","94555","88396","85271","84958","70524",
    "100088","93405","618344","8592","202250","4087","60059","2287","102022","53647",
    "82674","70548"
}

# Resolve missing via OMDb (rate-limited)
OMDB_KEY = "trilogy"
resolved = 0
for tmdb_id in sorted(list(missing))[:40]:
    name = id_to_name.get(tmdb_id, "")
    if not name:
        continue
    mtype = "series" if tmdb_id in TV_IDS else "movie"
    url = f"https://www.omdbapi.com/?apikey={OMDB_KEY}&t={name.replace(' ', '+')}&type={mtype}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CineVault/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        imdb_id = data.get("imdbID", "")
        if imdb_id.startswith("tt"):
            existing_map[tmdb_id] = imdb_id
            resolved += 1
            print(f"  OK {tmdb_id} ({name}) -> {imdb_id}")
        else:
            print(f"  MISS {tmdb_id} ({name}) -> no IMDB ID")
    except Exception as e:
        print(f"  ERR {tmdb_id} ({name}) -> {e}")
    time.sleep(1.05)

print(f"\nResolved: {resolved} new, Total map: {len(existing_map)}")

# Save to data file
with open(os.path.join(DATA, "tmdb_imdb_map_full.json"), "w") as f:
    json.dump(existing_map, f, indent=2)

# Also write it into server.js
# Find the TMDB_TO_IMDB_MAP block and replace
start_marker = "const TMDB_TO_IMDB_MAP = {"
end_marker = "};"
start_idx = content.find(start_marker)
if start_idx != -1:
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        lines = [f"      // Auto-enriched TMDB->IMDB mapping (updated {time.strftime('%Y-%m-%d')})"]
        for tid in sorted(existing_map.keys(), key=lambda x: int(x)):
            iid = existing_map[tid]
            name = id_to_name.get(tid, "")
            comment = f"  // {name}" if name else ""
            lines.append(f"        '{tid}': '{iid}',{comment}")
        new_map = "\n".join(lines) + "\n      };"
        new_content = content[:start_idx] + start_marker + "\n" + new_map + content[end_idx + len(end_marker):]
        with open(SERVER_JS, "w") as f:
            f.write(new_content)
        print(f"Updated server.js with {len(existing_map)} mappings")

# Count blanks
blanks = [tid for tid in curated_ids if tid not in existing_map]
with open(os.path.join(DATA, "blank_covers.json"), "w") as f:
    json.dump(blanks, f, indent=2)
print(f"Blank covers remaining: {len(blanks)}")
print("DONE")