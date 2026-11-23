#!/usr/bin/env python3
import io, sys

SA = "/home/ghost694/junkalot/src/lib/security-audit.ts"
AH = "/home/ghost694/junkalot/src/lib/auto-heal.ts"

def sub(path, old, new, label):
    src = io.open(path, encoding="utf-8").read()
    if old not in src:
        sys.exit("FAIL anchor %s: %s" % (path, label))
    io.open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))
    print("PATCHED", path, "-", label)

# 1. ask for a compact report that fits the existing 900-token cap
sub(SA,
"""Provide your response in this EXACT JSON format (no markdown, no code fences):""",
"""Keep it compact: at most 3 findings, at most 3 recommendations, one sentence each
(under 120 characters), so the whole JSON fits the reply budget and never arrives
truncated. Owner (2026-11-20): truncated replies were being saved as reports with
no usable finding.

Provide your response in this EXACT JSON format (no markdown, no code fences):""",
"compact instruction")

# 2. an unparsable body is a provider failure, not a report
sub(SA,
"""      return shapeAudit({ severity: 'info', summary: content || 'AI audit returned no report text.', findings: [], recommendations: [], patches: [], risk_score: calculateRiskScore(stats), provider: provider.name }, stats)""",
"""      // 2026-11-20: a reply that is not parsable JSON carries no finding, so it is
      // an outage of that provider, not a security report. Saving it as a report is
      // what filled the dashboard with permanent "open issues" nothing could clear.
      errors.push(`${provider.name}: unparsable reply (${content.length} chars)`)
      continue""",
"unparsable = failure")

# 3. clear the junk rows already sitting there, with the reason recorded
sub(AH,
"""        } else if (findings !== null && findings.length === 0 && !String(report.summary || '').trim().startsWith('{')) {
          // A summary that is still raw JSON means the body never parsed, so an
          // empty findings list says nothing about the risk — never close on that.
          evidence = 'The audit recorded no findings'""",
"""        } else if (findings !== null && findings.length === 0 && String(report.summary || '').trim().startsWith('{')) {
          // The reply was truncated before it parsed, so the row records no usable
          // finding at all. Closing it names exactly that — it is not a claim that
          // the risk was cleared.
          evidence = 'The audit body arrived truncated and recorded no usable finding'
        } else if (findings !== null && findings.length === 0) {
          evidence = 'The audit recorded no findings'""",
"truncated rows")

print("ALL PATCHED")
