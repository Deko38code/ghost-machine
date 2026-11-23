#!/usr/bin/env python3
import io, sys

JL = "/home/ghost694/junkalot/"

def patch(path, pairs):
    src = io.open(path, encoding="utf-8").read()
    for i, (old, new) in enumerate(pairs):
        if old not in src:
            sys.exit("FAIL %s: anchor %d" % (path, i))
        src = src.replace(old, new, 1)
    io.open(path, "w", encoding="utf-8").write(src)
    print("PATCHED", path)

# 1. badge = unread mail only; tab count = mail + todo
patch(JL + "src/components/MrEdBubble.tsx", [
    ("      setBadge(next.filter(bubble => bubble.kind === 'mail' || bubble.kind === 'todo').length)",
     "      // Badge is unread MAIL only — setup reminders must not inflate it (codex review 2026-11-20).\n      setBadge(next.filter(bubble => bubble.kind === 'mail').length)"),
    ("  const shown = tab === 'inbox' ? (inbox || []) : bubbles",
     "  const shown = tab === 'inbox' ? (inbox || []) : bubbles\n  const newCount = bubbles.filter(bubble => bubble.kind === 'mail' || bubble.kind === 'todo').length"),
    ("""                  {name === 'new' && badge > 0 ? ' (' + badge + ')' : ''}""",
     """                  {name === 'new' && newCount > 0 ? ' (' + newCount + ')' : ''}"""),
    ("""                    {name === 'new' && badge > 0 ? ' (' + badge + ')' : ''}""",
     """                    {name === 'new' && newCount > 0 ? ' (' + newCount + ')' : ''}"""),
])

# 2. count only well-formed records
src = io.open(JL + "src/data/mred-inbox.ts", encoding="utf-8").read()
old = """    const text = await readFile(FILE, 'utf8')
    let n = 0
    for (const line of text.split('\\n')) if (line.trim()) n += 1
    return n"""
new = """    const text = await readFile(FILE, 'utf8')
    let n = 0
    for (const line of text.split('\\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const value = JSON.parse(trimmed)
        if (value && typeof value === 'object' && value.id) n += 1
      } catch {
        // A malformed line is not a saved message, so it is not counted.
      }
    }
    return n"""
if old not in src:
    sys.exit("FAIL countMrEdMessages body")
io.open(JL + "src/data/mred-inbox.ts", "w", encoding="utf-8").write(src.replace(old, new, 1))
print("PATCHED", "src/data/mred-inbox.ts")

# 3. 24h window needs an upper bound (ignore future-dated rows)
patch(JL + "src/app/api/admin/worklog/route.ts", [
    ("  const items24 = entries.filter(entry => now - entry.ts <= DAY).sort((a, b) => a.ts - b.ts)",
     "  const items24 = entries.filter(entry => entry.ts <= now && now - entry.ts <= DAY).sort((a, b) => a.ts - b.ts)"),
    ("  const builds24 = builds.filter(build => now - build.ts <= DAY)",
     "  const builds24 = builds.filter(build => build.ts <= now && now - build.ts <= DAY)"),
])

# same for the PhantomIDE copy (live + repo)
for p in ("/home/ghost694/phantom-server.js", "/home/ghost694/phantomide/phantom-server.js"):
    s = io.open(p, encoding="utf-8").read()
    a = "const items24 = entries.filter(e=>now-e.ts<=DAY).sort((a,b)=>a.ts-b.ts);"
    b = "const builds24 = builds.filter(b=>now-b.ts<=DAY);"
    if a not in s or b not in s:
        sys.exit("FAIL phantom route anchor in " + p)
    s = s.replace(a, "const items24 = entries.filter(e=>e.ts<=now&&now-e.ts<=DAY).sort((a,b)=>a.ts-b.ts);", 1)
    s = s.replace(b, "const builds24 = builds.filter(b=>b.ts<=now&&now-b.ts<=DAY);", 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("PATCHED", p)

print("ALL FIXED")
