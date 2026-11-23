#!/usr/bin/env python3
import io, json, sys, datetime

BASE = "/home/ghost694/junkalot/data/"
JSONL = BASE + "invoice-worklog.jsonl"
MD = BASE + "invoice-worklog-2026-11-20.md"

now = datetime.datetime.now(datetime.timezone.utc)
day = now.strftime("%Y-%m-%d")
tutc = now.strftime("%H:%M:%S")

items = [
    ("fix",
     "Security audit replies now parse: the agent is asked for a compact report that fits the reply budget, an unparsable or truncated reply is treated as a provider outage instead of being saved as a report, and the first real parsed audit came back with 3 findings",
     "Audit replies parse again",
     "i8M1kIe9NMtU3woFU12-U",
     ["Before this, every audit reply was stored as raw JSON text with zero findings, which left permanent open rows nothing could clear.",
      "Provider, model and token budget are unchanged; only the request wording and the failure classification changed."]),
    ("fix",
     "Auto-heal counter double-counted every resolution (the same close was written to the append-only log twice); logging is now single-write and the tile counts distinct reports, so 'Reports resolved' reads 6 where the raw log has 12 rows",
     "Resolve counter corrected",
     "btiT0dAX31SVLgVUTauRY",
     ["Nothing was deleted: the historical duplicate rows stay in the log, and the count is taken by distinct report id.",
      "Live state after the fix: 6 reports resolved on measured evidence, 2 genuine warnings still open."]),
]

lines = []
for kind, title, _short, build, notes in items:
    lines.append(json.dumps({
        "date": day,
        "time_utc": tutc,
        "project": "junkalot.co",
        "kind": kind,
        "title": title,
        "builds": [build],
        "verified": "live",
    }, ensure_ascii=False))

with io.open(JSONL, "a", encoding="utf-8") as f:
    for line in lines:
        f.write(line + "\n")

md = io.open(MD, encoding="utf-8").read()
existing = [l for l in md.split("\n") if l.startswith("## ") and l[3:4].isdigit()]
next_no = 1
for l in existing:
    try:
        next_no = max(next_no, int(l[3:].split(".")[0]) + 1)
    except Exception:
        pass

KIND_LABEL = {"addon": "ADD-ON", "fix": "FIX", "fix+addon": "FIX + ADD-ON", "content": "CONTENT", "owner-change": "OWNER-DIRECTED CHANGE"}
stamp = tutc[:5] + " UTC"

blocks = []
for kind, title, short, build, notes in items:
    block = "## %d. %s — %s\n**Build:** `%s` (%s)\n" % (next_no, short, KIND_LABEL.get(kind, kind.upper()), build, stamp)
    next_no += 1
    block += "- %s\n" % title
    for n in notes:
        block += "  - %s\n" % n
    blocks.append(block)

marker = "## Totals"
idx = md.find(marker)
if idx < 0:
    sys.exit("FAIL: totals marker")
md = md[:idx] + "\n".join(blocks) + "\n" + md[idx:]

counts = {}
total = 0
for l in io.open(JSONL, encoding="utf-8").read().split("\n"):
    l = l.strip()
    if not l:
        continue
    try:
        v = json.loads(l)
    except Exception:
        continue
    counts[v.get("kind", "other")] = counts.get(v.get("kind", "other"), 0) + 1
    total += 1

table = ("## Totals\n\n"
         "| Kind | Items |\n| --- | --- |\n"
         "| Add-ons | %d |\n"
         "| Fix + add-on | %d |\n"
         "| Fixes | %d |\n"
         "| Content | %d |\n"
         "| Owner-directed changes | %d |\n"
         "| **Total** | **%d lines in `data/invoice-worklog.jsonl` for %s** |\n" % (
             counts.get("addon", 0), counts.get("fix+addon", 0), counts.get("fix", 0),
             counts.get("content", 0), counts.get("owner-change", 0), total, day))

tail_anchor = "Rates and amounts are the owner's to set. Nothing here is billed automatically."
ti = md.find(marker)
end = md.find(tail_anchor)
if ti < 0 or end < 0:
    sys.exit("FAIL: md anchors")
md = md[:ti] + table + "\n" + md[end:]

io.open(MD, "w", encoding="utf-8").write(md)
print("WORKLOG APPENDED", len(items), "items; total lines", total)
