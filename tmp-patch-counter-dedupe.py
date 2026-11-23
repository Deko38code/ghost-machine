#!/usr/bin/env python3
import io, sys

AH = "/home/ghost694/junkalot/src/lib/auto-heal.ts"
DB = "/home/ghost694/junkalot/src/data/security-db.ts"

def sub(path, old, new, label):
    src = io.open(path, encoding="utf-8").read()
    if old not in src:
        sys.exit("FAIL anchor %s: %s" % (path, label))
    io.open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))
    print("PATCHED", path, "-", label)

# 1. stop writing the same resolution twice: the cycle already logs every action
sub(AH,
"""        try {
          sec.resolveAuditReport(report.id)
          sec.insertAutoHealLog({ kind: 'fix', action: 'resolve_report', target: `report #${report.id}`, detail: evidence })
          actions.push({ action: 'resolve_report', target: `#${report.id}`, detail: evidence })""",
"""        try {
          sec.resolveAuditReport(report.id)
          // Logged once, by the cycle's own action loop below. Writing it here too
          // is what doubled every resolve in the append-only log and inflated the
          // "Reports resolved" counter (2026-11-20).
          actions.push({ action: 'resolve_report', target: `#${report.id}`, detail: evidence })""",
"single log write")

# 2. count distinct targets, so a duplicated historical row cannot inflate a tile
sub(DB,
"""export function countAutoHealTotals(): { blocks: number; unblocks: number; resolves: number } {
  const db = getDb()
  const rows = db.prepare(
    "SELECT action, COUNT(*) AS c FROM auto_heal_log WHERE action IN ('block_ip','unblock_ip','resolve_report') GROUP BY action"
  ).all() as { action: string; c: number }[]
  const out = { blocks: 0, unblocks: 0, resolves: 0 }
  for (const r of rows) {
    if (r.action === 'block_ip') out.blocks = Number(r.c) || 0
    else if (r.action === 'unblock_ip') out.unblocks = Number(r.c) || 0
    else if (r.action === 'resolve_report') out.resolves = Number(r.c) || 0
  }
  return out
}""",
"""export function countAutoHealTotals(): { blocks: number; unblocks: number; resolves: number } {
  const db = getDb()
  // 2026-11-20 (owner, "add to counter"): counted by TARGET, not by row. The log is
  // append-only and older cycles wrote the same resolution twice ("#79" and
  // "report #79"), which made the tile read double the work actually done. A report
  // resolves once and an address is blocked once, so distinct targets is the true
  // lifetime number, and nothing already written had to be removed to fix it.
  const rows = db.prepare(
    "SELECT action, target FROM auto_heal_log WHERE action IN ('block_ip','unblock_ip','resolve_report')"
  ).all() as { action: string; target: string | null }[]
  const blocks = new Set<string>()
  const unblocks = new Set<string>()
  const resolves = new Set<string>()
  for (const r of rows) {
    const target = String(r.target || '')
    if (r.action === 'block_ip') blocks.add(target)
    else if (r.action === 'unblock_ip') unblocks.add(target)
    else if (r.action === 'resolve_report') {
      const id = target.match(/\\d+/)
      resolves.add(id ? id[0] : target)
    }
  }
  return { blocks: blocks.size, unblocks: unblocks.size, resolves: resolves.size }
}""",
"dedupe totals")

print("PATCHED counter dedupe")
