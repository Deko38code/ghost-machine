#!/usr/bin/env python3
import io, sys

BASE = "/home/ghost694/junkalot/"

def load(rel):
    with io.open(BASE + rel, "r", encoding="utf-8") as f:
        return f.read()

def save(rel, text):
    with io.open(BASE + rel, "w", encoding="utf-8") as f:
        f.write(text)

def patch(rel, pairs):
    src = load(rel)
    for i, (old, new) in enumerate(pairs):
        if src.count(old) < 1:
            sys.exit("FAIL %s: anchor %d not found" % (rel, i))
        src = src.replace(old, new, 1 if src.count(old) == 1 else src.count(old))
    save(rel, src)
    print("PATCHED", rel)

# --- A: inbox data module: add a total counter -------------------------------
DATA = "src/data/mred-inbox.ts"
src = load(DATA)
anchor = """// Idempotent: a message id is saved once."""
add = """// Total messages ever saved — used for the live Inbox count on every tab.
export async function countMrEdMessages(): Promise<number> {
  try {
    const text = await readFile(FILE, 'utf8')
    let n = 0
    for (const line of text.split('\\n')) if (line.trim()) n += 1
    return n
  } catch {
    return 0
  }
}

"""
if anchor not in src:
    sys.exit("FAIL data: anchor not found")
src = src.replace(anchor, add + anchor, 1)
save(DATA, src)
print("PATCHED", DATA)

# --- B: inbox API returns the total ----------------------------------------
patch("src/app/api/admin/mred-inbox/route.ts", [
    ("import { readMrEdInbox } from '@/data/mred-inbox'",
     "import { readMrEdInbox, countMrEdMessages } from '@/data/mred-inbox'"),
    ("""  const messages = await readMrEdInbox(Number.isFinite(limit) ? limit : 200)
  return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } })""",
     """  const messages = await readMrEdInbox(Number.isFinite(limit) ? limit : 200)
  const total = await countMrEdMessages()
  return NextResponse.json({ messages, total }, { headers: { 'Cache-Control': 'no-store' } })"""),
])

# --- C: MrEdBubble — live count that never zeroes, Inbox count, faster poll --
BUB = "src/components/MrEdBubble.tsx"
src = load(BUB)
pairs = [
    ("  const [badge, setBadge] = useState(0)",
     "  const [badge, setBadge] = useState(0)\n  const [inboxTotal, setInboxTotal] = useState<number | null>(null)"),
    ("""      setBadge(next.filter(bubble => bubble.kind === 'mail' || bubble.kind === 'todo').length)""",
     """      setBadge(next.filter(bubble => bubble.kind === 'mail' || bubble.kind === 'todo').length)
      // Live Inbox total, so the Inbox tab always shows how many messages are kept.
      try {
        const countRes = await fetch('/api/admin/mred-inbox?limit=1', { cache: 'no-store' })
        if (countRes.ok) {
          const countData = await countRes.json()
          if (typeof countData.total === 'number') setInboxTotal(countData.total)
        }
      } catch { /* the count is optional */ }"""),
    ("""    if (!open) return
    setBadge(0)""",
     """    if (!open) return"""),
    ("}, 60_000)", "}, 30_000)"),
    ("""                    {name === 'new' && badge > 0 ? ' (' + badge + ')' : ''}""",
     """                    {name === 'new' && badge > 0 ? ' (' + badge + ')' : ''}
                    {name === 'inbox' && inboxTotal !== null && inboxTotal > 0 ? ' (' + inboxTotal + ')' : ''}"""),
    ("""                  {name === 'new' && badge > 0 ? ' (' + badge + ')' : ''}""",
     """                  {name === 'new' && badge > 0 ? ' (' + badge + ')' : ''}
                  {name === 'inbox' && inboxTotal !== null && inboxTotal > 0 ? ' (' + inboxTotal + ')' : ''}"""),
]
for i, (old, new) in enumerate(pairs):
    if old not in src:
        sys.exit("FAIL bubble: anchor %d not found" % i)
    src = src.replace(old, new, 1)
save(BUB, src)
print("PATCHED", BUB)

# --- D: Security Center Mr Ed tab shows the live count ----------------------
SEC = "src/app/admin/security/page.tsx"
patch(SEC, [
    ("  const [mredUsage, setMredUsage] = useState<any>(null)",
     "  const [mredUsage, setMredUsage] = useState<any>(null)\n  // Live unread count on the Mr Ed tab (owner 2026-11-20: every message tab shows it).\n  const [mredUnread, setMredUnread] = useState(0)"),
    ("""  useEffect(() => {
    try { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'ai' || t === 'audit' || t === 'settings' || t === 'meter') setTab(t) } catch { }
  }, [])""",
     """  useEffect(() => {
    try { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'ai' || t === 'audit' || t === 'settings' || t === 'meter') setTab(t) } catch { }
  }, [])
  useEffect(() => {
    let alive = true
    const pull = async () => {
      try {
        const res = await fetch('/api/admin/mred-bubble', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data.bubbles) ? data.bubbles : []
        if (alive) setMredUnread(list.filter((b: any) => b.kind === 'mail' || b.kind === 'todo').length)
      } catch { /* the count is optional */ }
    }
    void pull()
    const timer = window.setInterval(() => { if (!document.hidden) void pull() }, 45_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])"""),
    ("t === 'ai' ? '🎓 Mr Ed'",
     "t === 'ai' ? '🎓 Mr Ed' + (mredUnread > 0 ? ' (' + mredUnread + ')' : '')"),
])

# --- E: Bookings Messages / Spam toggle shows the live count ----------------
BOOK = "src/app/admin/bookings/page.tsx"
patch(BOOK, [
    ("  const [view, setView] = useState<'bookings' | 'messages'>('bookings')",
     "  const [view, setView] = useState<'bookings' | 'messages'>('bookings')\n  // Live unread contact messages on the Messages / Spam tab (owner 2026-11-20).\n  const [messageCount, setMessageCount] = useState<number | null>(null)"),
    ("""  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [showArchived, view])""",
     """  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [showArchived, view])

  useEffect(() => {
    let alive = true
    const pull = async () => {
      try {
        const res = await fetch('/api/bookings?view=messages&limit=50', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data.messages) ? data.messages : []
        if (alive) setMessageCount(list.filter((m: any) => m.status !== 'spam').length)
      } catch { /* the count is optional */ }
    }
    void pull()
    const timer = window.setInterval(() => { if (!document.hidden) void pull() }, 30_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])"""),
    ("{v === 'bookings' ? 'Bookings' : 'Messages / Spam'}",
     "{v === 'bookings' ? 'Bookings' : 'Messages / Spam' + (messageCount !== null && messageCount > 0 ? ' (' + messageCount + ')' : '')}"),
])

print("ALL PATCHED OK")
