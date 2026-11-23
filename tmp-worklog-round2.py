#!/usr/bin/env python3
import io, json, sys, datetime

BASE = "/home/ghost694/junkalot/data/"
JSONL = BASE + "invoice-worklog.jsonl"
MD = BASE + "invoice-worklog-2026-11-20.md"
BUILDS = ["F1xtQDMtP-6-zNqob2kfq", "mAUIK3Mu7juaRfiZlNVaC"]

now = datetime.datetime.now(datetime.timezone.utc)
day = now.strftime("%Y-%m-%d")
tutc = now.strftime("%H:%M:%S")

items = [
    ("addon",
     "Countdown ring under the ghost in the update applet: real seconds left before a queued update fires, drawn from the same measured countdown the card prints; 40 px on phones, 48 px on desktop, 64 px on a TV, sized by two Codex vision reviews",
     "Update countdown ring",
     ["Ring appears only while an update is queued (countdown > 0); it is measured, never animated decoration.",
      "Codex vision review #1 enlarged it and removed the repeated caption; review #2 sized it for ten-foot viewing.",
      "Measured live at 360/390/414 (40 px), 1440 (48 px) and 1920x1080 (64 px); no horizontal overflow."]),
    ("fix",
     "Update applet refresh clock smoothed: tenths with 100 ms ticks, so the 2 s version poll no longer snaps the clock from 2s to 0s",
     "Smoother refresh clock",
     ["Poll cadence unchanged at 2 s so a new build is still seen within two seconds.",
      "Reviewed by Codex against the widget's timing code before shipping."]),
    ("fix+addon",
     "Auto-heal now resolves open audit reports on measured evidence and records every close, so 'Reports resolved' is a real counter (was stuck at 0); the agent audit re-runs while reports sit open, provider-outage rows no longer become permanent open issues, and audit requests now carry the user turn every provider was rejecting",
     "Auto-heal resolves and counts",
     ["Evidence rules: no recorded findings, a provider-outage row, a newer audit measuring risk down 10+, or 24 h with zero critical/warning events.",
      "Each close writes a resolve_report row into the append-only auto_heal_log; nothing is deleted and report rows are preserved.",
      "First live cycle closed 4 reports; report #75 stays open because no clean audit has disproved it yet."]),
    ("addon",
     "Portfolio image guard plus an update-applet checklist: every build now proves all 279 WebP variants exist and are real WebP at the width their name claims, and the applet shows the result (Build on disk / Service answering / Portfolio images) from the real check",
     "Portfolio image guard + checklist",
     ["Guard written to data/portfolio-guard.json on every build: 262/279 valid, 17 wrong width, 0 missing.",
      "The 17 are real: pool-before-1, pool-after and job15 …-1200 files are smaller than declared. Reported for the owner's decision — not edited.",
      "Guard is non-strict for now so unrelated fixes can still ship; flip to strict once the 17 are re-cut."]),
]

lines = []
for kind, title, _short, notes in items:
    lines.append(json.dumps({
        "date": day,
        "time_utc": tutc,
        "project": "junkalot.co",
        "kind": kind,
        "title": title,
        "builds": BUILDS,
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
for kind, title, short, notes in items:
    no = next_no
    next_no += 1
    block = "## %d. %s — %s\n**Builds:** `%s` (%s)\n" % (no, short, KIND_LABEL.get(kind, kind.upper()), "`, `".join(BUILDS), stamp)
    block += "- %s\n" % title
    for n in notes:
        block += "  - %s\n" % n
    blocks.append(block)

marker = "## Totals"
idx = md.find(marker)
if idx < 0:
    sys.exit("FAIL: totals marker not found in md")
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
    sys.exit("FAIL: md anchors lost")
md = md[:ti] + table + "\n" + md[end:]

io.open(MD, "w", encoding="utf-8").write(md)
print("WORKLOG APPENDED", len(items), "items; total lines", total)
