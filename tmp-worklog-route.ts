import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin, isAdminEmail } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Owner (2026-11-20): "always log ... for invoices" (§20) and now "show a live
// counter of work done to Junkalot in the past 24 hours, with how long and hard
// we worked, on the Analytics tab". This reads the append-only invoice worklog
// and the verified build notes. Every number comes from a real recorded line —
// nothing is estimated and no rate, price or effort score is invented.
type WorkEntry = { ts: number; day: string; kind: string; title: string; verified: string }

export async function GET() {
  const session = await requireAdmin()
  const email = String(session?.user?.email || '')
  if (!email || !isAdminEmail(email)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const utcDay = (ts: number) => new Date(ts).toISOString().slice(0, 10)

  let entries: WorkEntry[] = []
  try {
    const text = await readFile(path.join(process.cwd(), 'data', 'invoice-worklog.jsonl'), 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const value = JSON.parse(trimmed)
        const day = String(value?.date || '')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
        const ts = Date.parse(day + 'T' + String(value?.time_utc || '00:00:00') + 'Z')
        if (!Number.isFinite(ts)) continue
        entries.push({
          ts,
          day,
          kind: String(value?.kind || 'other'),
          title: String(value?.title || ''),
          verified: String(value?.verified || ''),
        })
      } catch {
        // Skip a malformed line instead of failing the whole read.
      }
    }
  } catch {
    entries = []
  }

  let builds: { id: string; ts: number }[] = []
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'build-notes.json'), 'utf8')) || {}
    for (const [id, value] of Object.entries<any>(raw)) {
      const ts = Date.parse(String(value?.at || ''))
      if (Number.isFinite(ts)) builds.push({ id, ts })
    }
  } catch {
    builds = []
  }

  const items24 = entries.filter(entry => now - entry.ts <= DAY).sort((a, b) => a.ts - b.ts)
  const builds24 = builds.filter(build => now - build.ts <= DAY)
  const byKind: Record<string, number> = {}
  for (const entry of items24) byKind[entry.kind] = (byKind[entry.kind] || 0) + 1

  const spanMinutes = items24.length > 1
    ? Math.round((items24[items24.length - 1].ts - items24[0].ts) / 60000)
    : 0

  const byDay: { day: string; items: number; builds: number; spanMinutes: number }[] = []
  for (let i = 13; i >= 0; i -= 1) {
    const day = utcDay(now - i * DAY)
    const items = entries.filter(entry => entry.day === day).sort((a, b) => a.ts - b.ts)
    const buildCount = builds.filter(build => utcDay(build.ts) === day).length
    const span = items.length > 1 ? Math.round((items[items.length - 1].ts - items[0].ts) / 60000) : 0
    byDay.push({ day, items: items.length, builds: buildCount, spanMinutes: span })
  }

  const last7 = byDay.slice(-7)
  const activeDays = last7.filter(day => day.items > 0 || day.builds > 0).length
  const items7 = last7.reduce((sum, day) => sum + day.items, 0)
  const builds7 = last7.reduce((sum, day) => sum + day.builds, 0)
  const lastItem = entries.length ? entries.reduce((a, b) => (a.ts > b.ts ? a : b)) : null

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    last24h: {
      items: items24.length,
      builds: builds24.length,
      byKind,
      firstAt: items24.length ? new Date(items24[0].ts).toISOString() : null,
      lastAt: items24.length ? new Date(items24[items24.length - 1].ts).toISOString() : null,
      spanMinutes,
    },
    rate: {
      activeDays7: activeDays,
      items7,
      builds7,
      itemsPerActiveDay: activeDays ? Math.round((items7 / activeDays) * 10) / 10 : null,
      buildsPerActiveDay: activeDays ? Math.round((builds7 / activeDays) * 10) / 10 : null,
    },
    byDay,
    lastItem: lastItem ? { title: lastItem.title, at: new Date(lastItem.ts).toISOString(), kind: lastItem.kind } : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
