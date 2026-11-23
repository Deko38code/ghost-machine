#!/usr/bin/env python3
import io, json, sys, datetime

BASE = "/home/ghost694/junkalot/data/"
JSONL = BASE + "invoice-worklog.jsonl"
MD = BASE + "invoice-worklog-2026-11-20.md"
BUILD = "3z0CLEyCrCxofBas4uCr0"

now = datetime.datetime.now(datetime.timezone.utc)
day = now.strftime("%Y-%m-%d")
tutc = now.strftime("%H:%M:%S")

items = [
    ("fix",
     "Mr Ed desk greeting now greets whoever is signed in with the real name on their own account (profile name, then a per-account fallback); the hardcoded Deke/Susie split is gone",
     "Mr Ed · messages from PhantomIDE",
     ["Title is 'Mr Ed · messages from PhantomIDE' — the same name as its section — and the body reads as the Junkalot desk powered by PhantomIDE."]),
    ("addon",
     "Live unread message counts on every message tab: the Mr Ed launcher badge no longer zeroes when opened, the Inbox tab shows its saved total, the Security Center Mr Ed tab and the Bookings Messages/Spam toggle both show counts, all refreshing every 30 s",
     "Live unread counts",
     ["Launcher badge stays live; Inbox tab shows total saved; Security Center 'Mr Ed' tab and Bookings 'Messages / Spam' toggle carry the count."]),
    ("addon",
     "Analytics 'Work on Junkalot' tracker: live 24 h item and build counter, ticking time-since-last-work-item clock, 14-day daily stats, an 80 h per 2 weeks goal bar and a pace verdict (Needs more work / Improving / Doing fantastic)",
     "Work tracker + 80 h goal",
     ["Every number comes from the append-only invoice worklog and verified build notes; the verdict rule is written in the tooltip. Nothing is estimated."]),
]

lines = []
for kind, title, _short, notes in items:
    lines.append(json.dumps({
        "date": day,
        "time_utc": tutc,
        "project": "junkalot.co",
        "kind": kind,
        "title": title,
        "builds": [BUILD],
        "verified": "live",
    }, ensure_ascii=False))

with io.open(JSONL, "a", encoding="utf-8") as f:
    for line in lines:
        f.write(line + "\n")

# ---- readable mirror ----
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
    block = "## %d. %s — %s\n**Build:** `%s` (%s)\n" % (no, short, KIND_LABEL.get(kind, kind.upper()), BUILD, stamp)
    for n in notes:
        block += "- %s\n" % n
    blocks.append(block)

marker = "## Totals"
idx = md.find(marker)
if idx < 0:
    sys.exit("FAIL: totals marker not found in md")
insert = "\n".join(blocks) + "\n"
md = md[:idx] + insert + md[idx:]

# recompute totals from the jsonl we just appended to
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
if ti < 0:
    sys.exit("FAIL: totals marker lost")
end = md.find(tail_anchor)
if end < 0:
    sys.exit("FAIL: tail anchor lost")
md = md[:ti] + table + "\n" + md[end:]

io.open(MD, "w", encoding="utf-8").write(md)
print("WORKLOG APPENDED", len(items), "items; total lines", total)
