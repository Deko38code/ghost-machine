#!/usr/bin/env python3
"""Scrape neighborstrailer.com trailer listings from embedded Angular transfer-state JSON."""
import urllib.request, json, re, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed

SITEMAP = "https://neighborstrailer.com/sitemap.xml"
OUT = "/home/ghost/rent-my-trailer/data/trailers.jsonl"
OUT_FAIL = "/home/ghost/rent-my-trailer/data/failed.txt"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

os.makedirs(os.path.dirname(OUT), exist_ok=True)

done = set()
if os.path.exists(OUT):
    with open(OUT) as f:
        for line in f:
            try: done.add(json.loads(line)["id"])
            except: pass
print(f" Already have {len(done)} listings", flush=True)

sm = urllib.request.urlopen(urllib.request.Request(SITEMAP, headers={"User-Agent": UA}), timeout=30).read().decode()
urls = re.findall(r"<loc>(https://neighborstrailer\.com/trailer-detail/[^<]+)</loc>", sm)
urls = [u for u in urls if re.search(r"-(\d+)$", u)]
print(f" {len(urls)} detail urls total", flush=True)
todo = [u for u in urls if int(re.search(r"-(\d+)$", u).group(1)) not in done]
print(f" {len(todo)} to fetch", flush=True)

state = {"fails": 0, "ok": 0}
fout = open(OUT, "a")
ffail = open(OUT_FAIL, "a")

def extract_listing(html):
    m = re.search(r'"(\d+)":\{"b":\{"statusCode":200', html)
    if not m: return None
    start = html.index('{"' + m.group(1) + '"')
    depth = 0
    for i in range(start, len(html)):
        c = html[i]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                blob = html[start:i+1]
                break
    else:
        return None
    j = json.loads(blob)
    inner = j[m.group(1)]["b"]
    if inner.get("statusCode") != 200: return None
    return inner.get("data")

def fetch(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=20).read().decode("utf8", "replace")
            data = extract_listing(html)
            if data and data.get("id"):
                return url, data, None
            return url, None, "no-transfer-state"
        except Exception as e:
            if attempt == 2: return url, None, str(e)
            time.sleep(1.5 * (attempt + 1))

with ThreadPoolExecutor(max_workers=8) as pool:
    futs = [pool.submit(fetch, u) for u in todo]
    for i, fu in enumerate(as_completed(futs), 1):
        url, data, err = fu.result()
        if data:
            fout.write(json.dumps(data, default=str) + "\n")
            state["ok"] += 1
            if state["ok"] % 250 == 0: fout.flush(); print(f" ok={state['ok']} fails={state['fails']} ({i}/{len(todo)})", flush=True)
        else:
            state["fails"] += 1
            ffail.write(url + " :: " + (err or "") + "\n")
            if i % 250 == 0:
                fout.flush(); ffail.flush(); print(f" ok={state['ok']} fails={state['fails']} ({i}/{len(todo)})", flush=True)

fout.close(); ffail.close()
print("DONE ok=%s fails=%s" % (state["ok"], state["fails"]))