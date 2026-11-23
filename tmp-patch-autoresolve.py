#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/lib/auto-heal.ts"
src = io.open(P, encoding="utf-8").read()

def sub(old, new, label):
    global src
    if old not in src:
        sys.exit("FAIL anchor: " + label)
    src = src.replace(old, new, 1)

# ── 1. a faster agent pass when reports are sitting open ──────────────────────
sub(
"""const AI_HOT_INTERVAL_MS = 5 * 60_000""",
"""const AI_HOT_INTERVAL_MS = 5 * 60_000
// Owner (2026-11-20): "when it has ones sitting need auto agent audit to resolve
// open issues in dash" — while a report is still open, ask the agent again on a
// shorter beat instead of waiting out the full 15-minute cadence.
const AI_OPEN_ISSUE_INTERVAL_MS = 10 * 60_000""",
"interval constant")

# ── 2. resolving needs evidence, and says which evidence ─────────────────────
OLD_RESOLVE = """      // 3. Resolve reports whose issue has cleared. Resolving only changes a
      //    status flag; the report row itself is preserved.
      let resolved = 0
      for (const report of reports) {
        if (resolved >= MAX_RESOLVES_PER_CYCLE) break
        if (Number(report.resolved) === 1) continue
        if (report.report_type !== 'ai_audit') continue
        let healed = false
        if (report.severity === 'info') {
          const created = parseDbTime(report.created_at)
          healed = Number.isFinite(created) && Date.now() - created > 7 * 24 * 60 * 60_000
        } else if (typeof report.risk_score === 'number') {
          const newer = reports.find((r: any) => r.report_type === 'ai_audit' && Number(r.id) > Number(report.id) && typeof r.risk_score === 'number')
          healed = Boolean(newer && newer.risk_score <= report.risk_score - 10)
        }
        if (!healed) continue
        try {
          sec.resolveAuditReport(report.id)
          sec.insertAutoHealLog({ kind: 'fix', action: 'resolve_report', target: `report #${report.id}`, detail: 'Issue cleared in a newer audit — marked resolved' })
          actions.push({ action: 'resolve_report', target: `#${report.id}`, detail: 'Cleared in a newer audit' })
          resolved += 1
        } catch { /* ignore */ }
      }"""

NEW_RESOLVE = """      // 3. Resolve reports whose issue has verifiably cleared, and record WHAT
      //    cleared it. Owner (2026-11-20): "make system able to resolve issues and
      //    add to counter" / "when it has ones sitting need auto agent audit to
      //    resolve open issues in dash". Resolving only flips a status flag; the
      //    report row is preserved. Every close needs evidence measured in THIS
      //    cycle — a report that still describes a live problem stays open, because
      //    a fake close would make the counter a lie (CLAUDE.md §10).
      const hotNow = rows.reduce((sum: number, r: any) => sum + (r.severity === 'critical' || r.severity === 'warning' ? Number(r.count) || 0 : 0), 0)
      const providerFailure = (r: any) => {
        const summary = String(r?.summary || '')
        return summary.startsWith('AI audit unavailable') || summary.startsWith('AI audit returned no report text')
      }
      const findingsOf = (r: any): any[] | null => {
        try {
          const parsed = JSON.parse(String(r?.details || '[]'))
          return Array.isArray(parsed) ? parsed : null
        } catch { return null }
      }
      let resolved = 0
      for (const report of reports) {
        if (resolved >= MAX_RESOLVES_PER_CYCLE) break
        if (Number(report.resolved) === 1) continue
        if (report.report_type !== 'ai_audit') continue
        const created = parseDbTime(report.created_at)
        const ageMs = Number.isFinite(created) ? Date.now() - created : 0
        // Nothing settles in the first ten minutes: a report has to exist long
        // enough for the next cycle to disprove it.
        if (ageMs > 0 && ageMs < 10 * 60_000) continue
        const findings = findingsOf(report)
        let evidence = ''
        if (providerFailure(report)) {
          // The row is a provider outage, not a security finding.
          evidence = 'The audit run recorded no report text, so there was nothing to act on'
        } else if (findings !== null && findings.length === 0) {
          evidence = 'The audit recorded no findings'
        } else if (typeof report.risk_score === 'number') {
          const newer = reports.find((r: any) => r.report_type === 'ai_audit' && Number(r.id) > Number(report.id) && typeof r.risk_score === 'number' && !providerFailure(r))
          if (newer && newer.risk_score <= report.risk_score - 10) {
            evidence = 'A newer audit measured risk ' + report.risk_score + ' → ' + newer.risk_score
          }
        }
        if (!evidence && report.severity !== 'critical' && ageMs >= 24 * 60 * 60_000 && hotNow === 0) {
          evidence = 'No critical or warning events in the last 24 hours'
        }
        if (!evidence) continue
        try {
          sec.resolveAuditReport(report.id)
          sec.insertAutoHealLog({ kind: 'fix', action: 'resolve_report', target: `report #${report.id}`, detail: evidence })
          actions.push({ action: 'resolve_report', target: `#${report.id}`, detail: evidence })
          resolved += 1
        } catch { /* ignore */ }
      }"""
sub(OLD_RESOLVE, NEW_RESOLVE, "resolve block")

# ── 3. a provider outage is not a security report ────────────────────────────
sub(
"""    if (changed) {
      sec.insertAuditReport({""",
"""    // Owner (2026-11-20): "make system able to resolve issues" — a run where every
    // provider failed is an outage of the auditor, not a security report. Writing it
    // as a report is what left permanent "open issues" in the dashboard that nothing
    // could ever clear. The failure still reaches the panel through the summary and
    // recommendations, but it no longer becomes a fake report row.
    if (changed && result.provider) {
      sec.insertAuditReport({""",
"provider guard")

# ── 4. ask the agent sooner while anything is open ───────────────────────────
sub(
"""    if (enabled && !aiRunning && aiDue(row, score)) void runAiPass(reason)""",
"""    const openReports = reports.filter((r: any) => Number(r.resolved) !== 1).length
    const openDue = openReports > 0 && Date.now() - lastAiAttempt >= AI_OPEN_ISSUE_INTERVAL_MS
    if (enabled && !aiRunning && (openDue || aiDue(row, score))) {
      void runAiPass(openDue ? 'open issues sitting' : reason)
    }""",
"ai trigger")

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED auto-heal resolver")
