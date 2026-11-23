#!/usr/bin/env python3
import io, sys

PAGE = "/home/ghost694/junkalot/src/app/admin/analytics/page.tsx"
with io.open(PAGE, "r", encoding="utf-8") as f:
    src = f.read()

old_head = '              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-2">Work on Junkalot</h2>'
new_head = """              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Work on Junkalot</h2>
                {work && (() => {
                  const verdict = workStatus(work)
                  const tone = verdict.tone === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : verdict.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-red-300 bg-red-50 text-red-800'
                  return (
                    <span className={'rounded-full border px-2.5 py-1 text-[11px] font-bold ' + tone} title={verdict.hint}>
                      {verdict.label}
                    </span>
                  )
                })()}
              </div>"""

if old_head not in src:
    sys.exit("FAIL: work heading anchor not found")
src = src.replace(old_head, new_head, 1)

HELPER = """

// Owner (2026-11-20): "when work hrs are low will tell us needs more work,
// improving, doing fantastic". The verdict is a plain rule over real recorded
// spans from the invoice worklog — no invented score. Thresholds are shown in
// the tooltip so the number can be checked against the log itself.
function workStatus(work: WorkStats): { label: string; tone: 'red' | 'amber' | 'emerald'; hint: string } {
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
}
"""
src = src.rstrip("\n") + HELPER

with io.open(PAGE, "w", encoding="utf-8") as f:
    f.write(src)
print("PATCHED verdict")
