#!/usr/bin/env python3
import io, sys

PAGE = "/home/ghost694/junkalot/src/app/admin/analytics/page.tsx"
with io.open(PAGE, "r", encoding="utf-8") as f:
    src = f.read()

def must(old, label):
    if old not in src:
        sys.exit("FAIL: " + label)
    return old

IFACE = """interface WorkStats {
  generatedAt: string
  last24h: { items: number; builds: number; byKind: Record<string, number>; firstAt: string | null; lastAt: string | null; spanMinutes: number }
  rate: { activeDays7: number; items7: number; builds7: number; itemsPerActiveDay: number | null; buildsPerActiveDay: number | null }
  byDay: { day: string; items: number; builds: number; spanMinutes: number }[]
  lastItem: { title: string; at: string; kind: string } | null
}

"""

# 1. interface before the component
must("export default function AdminAnalyticsPage() {", "component anchor")
src = src.replace("export default function AdminAnalyticsPage() {", IFACE + "export default function AdminAnalyticsPage() {", 1)

# 2. state
must("  const [error, setError] = useState('')", "state anchor")
src = src.replace(
    "  const [error, setError] = useState('')",
    "  const [error, setError] = useState('')\n  const [work, setWork] = useState<WorkStats | null>(null)",
    1
)

# 3. fetch
old_fetch = """      const [res, surveyRes] = await Promise.all([
        fetch('/api/admin/analytics', { cache: 'no-store' }),
        fetch('/api/admin/surveys', { cache: 'no-store' }).catch(() => null),
      ])"""
new_fetch = """      const [res, surveyRes, workRes] = await Promise.all([
        fetch('/api/admin/analytics', { cache: 'no-store' }),
        fetch('/api/admin/surveys', { cache: 'no-store' }).catch(() => null),
        fetch('/api/admin/worklog', { cache: 'no-store' }).catch(() => null),
      ])"""
must(old_fetch, "fetch anchor")
src = src.replace(old_fetch, new_fetch, 1)

old_survey_tail = """        setSurveyError(surveyRes ? `Feedback failed to load (${surveyRes.status}).` : 'Feedback could not be reached.')
      }"""
must(old_survey_tail, "survey tail anchor")
src = src.replace(
    old_survey_tail,
    old_survey_tail + "\n      if (workRes && workRes.ok) setWork(await workRes.json())",
    1
)

# 4. max helper
must("  const maxViews = data ? Math.max(1, ...data.byDay.map(day => day.views)) : 1", "maxViews anchor")
src = src.replace(
    "  const maxViews = data ? Math.max(1, ...data.byDay.map(day => day.views)) : 1",
    "  const maxViews = data ? Math.max(1, ...data.byDay.map(day => day.views)) : 1\n  const maxWorkItems = work ? Math.max(1, ...work.byDay.map(day => day.items)) : 1",
    1
)

# 5. the card, inserted first inside the data block
CARD = """            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2">Work on Junkalot</h2>
              {work ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Items · last 24h" value={work.last24h.items} hint="logged work entries" />
                    <Stat label="Builds · last 24h" value={work.last24h.builds} hint="verified builds" />
                    <Stat label="Active days · 7" value={work.rate.activeDays7} hint="days with work" />
                    <Stat label="Items / active day" value={work.rate.itemsPerActiveDay === null ? '—' : work.rate.itemsPerActiveDay} hint="7-day average" />
                    <Stat label="Builds / active day" value={work.rate.buildsPerActiveDay === null ? '—' : work.rate.buildsPerActiveDay} hint="7-day average" />
                    <Stat label="Work span · 24h" value={work.last24h.spanMinutes ? fmtSpan(work.last24h.spanMinutes) : '—'} hint="first → last entry" />
                  </div>
                  <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">Last logged work item</p>
                      <p className="truncate text-xs text-slate-500">{work.lastItem ? work.lastItem.title : 'Nothing logged yet.'}</p>
                    </div>
                    {work.lastItem && (
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Time since</p>
                        <p className="font-mono text-lg font-bold text-brand-dark tabular-nums"><WorkClock since={work.lastItem.at} /></p>
                      </div>
                    )}
                  </div>
                  <div className={card}>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Daily work · last 14 days</h3>
                    <ul className="space-y-1.5">
                      {work.byDay.map(day => (
                        <li key={day.day} className="flex items-center gap-2 text-xs">
                          <span className="w-16 shrink-0 font-mono text-slate-500">{day.day.slice(5)}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                            <span className="block h-full bg-brand-gold" style={{ width: `${Math.round((day.items / maxWorkItems) * 100)}%` }} />
                          </span>
                          <span className="w-16 shrink-0 text-right text-slate-700">{day.items} item{day.items === 1 ? '' : 's'}</span>
                          <span className="w-16 shrink-0 text-right text-slate-500">{day.builds} build{day.builds === 1 ? '' : 's'}</span>
                          <span className="w-14 shrink-0 text-right text-slate-400">{day.spanMinutes ? fmtSpan(day.spanMinutes) : '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className={`${card} text-center py-6`}>
                  <p className="text-xs text-slate-500">Work stats could not be loaded. Nothing is guessed.</p>
                </div>
              )}
            </div>

"""
must('          <div className="space-y-6">', "data block anchor")
src = src.replace('          <div className="space-y-6">\n', '          <div className="space-y-6">\n' + CARD, 1)

# 6. helpers at the end of the file
HELPERS = """

function fmtSpan(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes < 60) return `${minutes}m`
  return `${Math.round((minutes / 60) * 10) / 10}h`
}

// A real, live counter: ticks once a second from the timestamp the server sent.
function WorkClock({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const start = Date.parse(since)
  if (!Number.isFinite(start)) return <span>—</span>
  const total = Math.max(0, Math.floor((now - start) / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const label = (days > 0 ? days + 'd ' : '') + hours + 'h ' + String(mins).padStart(2, '0') + 'm ' + String(secs).padStart(2, '0') + 's'
  return <span>{label}</span>
}
"""
src = src.rstrip("\n") + HELPERS

with io.open(PAGE, "w", encoding="utf-8") as f:
    f.write(src)
print("PATCHED analytics page")
