#!/usr/bin/env python3
import io, sys

PAGE = "/home/ghost694/junkalot/src/app/admin/analytics/page.tsx"
with io.open(PAGE, "r", encoding="utf-8") as f:
    src = f.read()

# --- 1. goal block inside the work card -------------------------------------
old = """                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Items · last 24h" """
new = """                <div className="space-y-3">
                  {(() => {
                    const hours14 = Math.round((work.byDay.reduce((sum, day) => sum + day.spanMinutes, 0) / 60) * 10) / 10
                    const pct = Math.min(100, Math.round((hours14 / 80) * 100))
                    return (
                      <div className={card}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Goal · 80 h per 2 weeks</h3>
                          <span className="text-xs font-semibold tabular-nums text-slate-700">{hours14} h recorded · {pct}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className={'h-full ' + (pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: pct + '%' }} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {hours14 >= 80
                            ? 'Goal reached — ' + Math.round((hours14 - 80) * 10) / 10 + ' h over target.'
                            : Math.round((80 - hours14) * 10) / 10 + ' h to go. Measured from the first-to-last recorded entry each day on the invoice worklog.'}
                        </p>
                      </div>
                    )
                  })()}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Items · last 24h" """

if old not in src:
    sys.exit("FAIL: goal insert anchor not found")
src = src.replace(old, new, 1)

# --- 2. verdict tied to the 80 h goal ---------------------------------------
old_fn = """function workStatus(work: WorkStats): { label: string; tone: 'red' | 'amber' | 'emerald'; hint: string } {
  const hours7 = work.byDay.slice(-7).reduce((sum, day) => sum + day.spanMinutes, 0) / 60
  if (work.rate.items7 === 0 || hours7 === 0) {
    return { label: 'Needs more work', tone: 'red', hint: 'no logged work in the last 7 days' }
  }
  if (hours7 < 3) {
    return { label: 'Needs more work', tone: 'amber', hint: 'under 3 h of recorded work span in the last 7 days' }
  }
  if (hours7 < 10) {
    return { label: 'Improving', tone: 'amber', hint: '3–10 h of recorded work span across ' + work.rate.activeDays7 + ' active day(s)' }
  }
  return { label: 'Doing fantastic', tone: 'emerald', hint: 'over 10 h of recorded work span across ' + work.rate.activeDays7 + ' active day(s)' }
}"""

new_fn = """function workStatus(work: WorkStats): { label: string; tone: 'red' | 'amber' | 'emerald'; hint: string } {
  const hours14 = Math.round((work.byDay.reduce((sum, day) => sum + day.spanMinutes, 0) / 60) * 10) / 10
  const share = hours14 / 80
  if (share >= 0.8) {
    return { label: 'Doing fantastic', tone: 'emerald', hint: hours14 + ' h of recorded work span in the last 14 days — at or above the 80 h goal' }
  }
  if (share >= 0.4) {
    return { label: 'Improving', tone: 'amber', hint: hours14 + ' h of recorded work span in the last 14 days — ' + Math.round(share * 100) + '% of the 80 h goal' }
  }
  return { label: 'Needs more work', tone: 'red', hint: hours14 + ' h of recorded work span in the last 14 days — under 40% of the 80 h goal' }
}"""

if old_fn not in src:
    sys.exit("FAIL: workStatus anchor not found")
src = src.replace(old_fn, new_fn, 1)

with io.open(PAGE, "w", encoding="utf-8") as f:
    f.write(src)
print("PATCHED goal")
