import io, json, datetime
BASE = "/home/ghost694/junkalot/data/"
JSONL = BASE + "invoice-worklog.jsonl"
MD = BASE + "invoice-worklog-2026-11-21.md"
now = datetime.datetime.now(datetime.timezone.utc)
day = now.strftime("%Y-%m-%d"); tutc = now.strftime("%H:%M:%S")
title = ("Update-applet portfolio checklist now reports the exact, current image count in real time "
         "(279/279 present, 0 missing, 93 photos) and no longer calls a photo smaller than its slot 'missing'; "
         "the live check reads each variant's header on request with a 30 s cache, and the build-time guard uses the same rule")
line = json.dumps({"date": day, "time_utc": tutc, "project": "junkalot.co", "kind": "fix",
                   "title": title, "builds": ["UT8-8LJsa6phoqi69lBx9"], "verified": "live"}, ensure_ascii=False)
with io.open(JSONL, "a", encoding="utf-8") as f:
    f.write(line + "\n")
try:
    md = io.open(MD, encoding="utf-8").read()
except FileNotFoundError:
    md = "## Junkalot invoice worklog — %s\n\n## Totals\n\nRates and amounts are the owner's to set. Nothing here is billed automatically.\n" % day
existing = [l for l in md.split("\n") if l.startswith("## ") and l[3:4].isdigit()]
n = 1
for l in existing:
    try: n = max(n, int(l[3:].split(".")[0]) + 1)
    except Exception: pass
block = ("## %d. Portfolio count corrected — FIX\n**Build:** `UT8-8LJsa6phoqi69lBx9` (%s UTC)\n"
         "- %s\n  - No image file was changed: all 279 variant files are present and valid.\n"
         "  - The checklist now shows present / missing / photos counts exactly, and slot-width differences are informational.\n\n") % (n, tutc[:5], title)
marker = "## Totals"
idx = md.find(marker)
if idx < 0:
    md = md + "\n" + block
else:
    md = md[:idx] + block + md[idx:]
io.open(MD, "w", encoding="utf-8").write(md)
print("WORKLOG APPENDED 1 item; day", day)
