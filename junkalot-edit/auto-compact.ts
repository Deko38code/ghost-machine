// Automatic compaction for Junkalot's local state — SQLite WAL files and JSONL logs.
//
// Two kinds of growth are handled here, and nothing else:
//
//   • SQLite write-ahead logs. A WAL grows until something checkpoints it. Left
//     alone, security.db-wal, coach-memory.db-wal and training.db-wal each sit at
//     several MB indefinitely. A truncated checkpoint folds those pages back into
//     the database and takes the WAL down to zero — no row is read, written or
//     dropped.
//
//   • JSONL logs. Past the size threshold the whole file is gzipped into
//     data/log-archive/ and the live file is rewritten with only its most recent
//     entries. The compressed archive is the complete history; the live file is
//     the condensed working copy. Nothing is deleted.
//
// admin-sessions.jsonl is deliberately skipped: it has its own rotation, which
// has to carry still-live sessions forward to keep the admin cap honest.

import { mkdir, readdir, readFile, stat, statfs, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const ARCHIVE_DIR = path.join(DATA_DIR, 'log-archive')
const STATE_FILE = path.join(DATA_DIR, 'auto-compact-state.json')

const WAL_BYTES = 1024 * 1024        // checkpoint a database once its WAL passes 1 MiB
const LOG_BYTES = 1024 * 1024        // compact a JSONL log once it passes 1 MiB
const KEEP_LINES = 400               // most recent entries left in the live file
const MIN_INTERVAL_MS = 60 * 60 * 1000 // at most one automatic run an hour
const FIRST_RUN_DELAY_MS = 90 * 1000 // a first pass shortly after the server boots
const SKIP_LOGS = new Set(['admin-sessions.jsonl'])

// 2026-11-22 (owner): "add auto compact at 2% _7%". Disk pressure outranks the
// hourly schedule: at 7% free or less a pass may run every 5 minutes, and at 2%
// free or less every minute. Compaction never deletes anything — WAL pages fold
// back into their database and logs are gzipped into data/log-archive — and a
// nearly full disk gets the WAL checkpoint only, because writing a new archive
// is what could fail there.
const DISK_LOW_PERCENT = 7
const DISK_CRITICAL_PERCENT = 2
const PRESSURE_CHECK_MS = 2 * 60 * 1000 // how often the free-space percentage is read
const PRESSURE_MIN_INTERVAL_MS = 5 * 60 * 1000
const CRITICAL_MIN_INTERVAL_MS = 60 * 1000

export type DiskState = {
  totalBytes: number
  freeBytes: number
  freePercent: number
  level: 'ok' | 'low' | 'critical'
}

export type WalResult = { file: string; before: number; after: number; ok: boolean; note?: string }
export type LogResult = { file: string; before: number; after: number; archivedTo: string; entries: number; kept: number }

export type CompactReport = {
  at: string
  durationMs: number
  skipped?: boolean
  note?: string
  disk?: DiskState
  wal: WalResult[]
  logs: LogResult[]
  errors: string[]
}

// The volume that holds data/ — the same one Junkalot writes its logs, databases
// and archives to. A failure to read it leaves compaction exactly as it was.
async function readDiskState(): Promise<DiskState | null> {
  try {
    const s = await statfs(DATA_DIR)
    const totalBytes = Number(s.blocks) * Number(s.bsize)
    const freeBytes = Number(s.bavail) * Number(s.bsize)
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null
    const raw = (freeBytes / totalBytes) * 100
    return {
      totalBytes,
      freeBytes,
      freePercent: Math.round(raw * 10) / 10,
      level: raw <= DISK_CRITICAL_PERCENT ? 'critical' : raw <= DISK_LOW_PERCENT ? 'low' : 'ok',
    }
  } catch {
    return null
  }
}

function stampOf(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

async function sizeOf(file: string): Promise<number> {
  try {
    return (await stat(file)).size
  } catch {
    return 0
  }
}

async function lastRunAt(): Promise<number> {
  try {
    const raw = JSON.parse(await readFile(STATE_FILE, 'utf8'))
    const at = Date.parse(String(raw?.at || ''))
    return Number.isFinite(at) ? at : 0
  } catch {
    return 0
  }
}

async function saveReport(report: CompactReport): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(STATE_FILE, JSON.stringify(report, null, 2), 'utf8')
  } catch {
    // A failed report write must never fail a compaction.
  }
}

async function checkpointWal(report: CompactReport): Promise<void> {
  let names: string[] = []
  try {
    names = await readdir(DATA_DIR)
  } catch {
    return
  }
  const databases = names.filter((name) => name.endsWith('.db'))
  if (databases.length === 0) return

  // Loaded lazily so a missing native module can never break a page render.
  let Database: any = null
  try {
    const mod: any = await import('better-sqlite3')
    Database = mod?.default || mod
  } catch (err: any) {
    report.errors.push('better-sqlite3 unavailable: ' + (err?.message || err))
    return
  }
  if (!Database) return

  for (const name of databases) {
    const wal = path.join(DATA_DIR, name + '-wal')
    const before = await sizeOf(wal)
    if (before < WAL_BYTES) continue
    const entry: WalResult = { file: name, before, after: before, ok: false, note: '' }
    let db: any = null
    try {
      db = new Database(path.join(DATA_DIR, name), { fileMustExist: true })
      const result: any = db.pragma('wal_checkpoint(TRUNCATE)')
      const row = Array.isArray(result) ? result[0] : result
      try { db.close() } catch {}
      db = null
      entry.after = await sizeOf(wal)
      entry.ok = !(row && row.busy)
      if (row && row.busy) entry.note = 'busy — a reader held the WAL; the next run retries'
    } catch (err: any) {
      entry.note = err?.message || String(err)
      try { db?.close() } catch {}
    }
    report.wal.push(entry)
  }
}

async function compactLogs(report: CompactReport, now: Date): Promise<void> {
  let names: string[] = []
  try {
    names = await readdir(DATA_DIR)
  } catch {
    return
  }
  for (const name of names) {
    if (!name.endsWith('.jsonl') || SKIP_LOGS.has(name)) continue
    const file = path.join(DATA_DIR, name)
    const before = await sizeOf(file)
    if (before < LOG_BYTES) continue
    try {
      const text = await readFile(file, 'utf8')
      const lines = text.split('\n').filter((line) => line.trim())
      if (lines.length <= KEEP_LINES) continue
      await mkdir(ARCHIVE_DIR, { recursive: true })
      const archived = path.join(ARCHIVE_DIR, name.replace(/\.jsonl$/, '') + '-' + stampOf(now) + '.jsonl.gz')
      await writeFile(archived, gzipSync(Buffer.from(text, 'utf8')))
      const kept = lines.slice(-KEEP_LINES)
      await writeFile(file, kept.join('\n') + '\n', 'utf8')
      report.logs.push({
        file: name,
        before,
        after: await sizeOf(file),
        archivedTo: path.relative(DATA_DIR, archived),
        entries: lines.length,
        kept: kept.length,
      })
      console.log('[auto-compact] ' + name + ': ' + before + ' -> ' + (await sizeOf(file)) + ' bytes, ' + lines.length + ' entries condensed to ' + kept.length + ', archive ' + archived)
    } catch (err: any) {
      report.errors.push(name + ': ' + (err?.message || err))
    }
  }
}

// When the last pass started (any pass). In-process only: the hourly schedule and
// the pressure watcher live in the same server process, and a restart simply makes
// the first pressure pass run at once.
let lastPressureRunAt = 0

// One pass. `force` skips the throttle (the owner-run endpoint uses it).
export async function runAutoCompact(force = false): Promise<CompactReport> {
  const started = Date.now()
  const now = new Date()
  const disk = await readDiskState()
  const report: CompactReport = { at: now.toISOString(), durationMs: 0, wal: [], logs: [], errors: [], disk: disk ?? undefined }
  const g = globalThis as any

  // The hourly timer and the pressure watcher can wake at the same moment; a second
  // pass would race the first one's rewrites.
  if (g.__junkalotAutoCompactRunning) {
    report.skipped = true
    report.note = 'another pass is already running'
    report.durationMs = Date.now() - started
    return report
  }
  g.__junkalotAutoCompactRunning = true
  try {
    if (!force) {
      const previous = await lastRunAt()
      const sincePrevious = previous ? started - previous : Infinity
      let due = sincePrevious >= MIN_INTERVAL_MS
      if (disk?.level === 'critical') due = started - lastPressureRunAt >= CRITICAL_MIN_INTERVAL_MS
      else if (disk?.level === 'low') due = due || started - lastPressureRunAt >= PRESSURE_MIN_INTERVAL_MS
      if (!due) {
        report.skipped = true
        report.durationMs = Date.now() - started
        return report
      }
    }

    lastPressureRunAt = started

    await checkpointWal(report)
    if (disk?.level === 'critical') {
      // Folding the WALs back frees pages already on disk; writing a fresh gzip
      // archive on a 2%-free disk is the step that can fail, so logs wait.
      report.note = 'disk critical (' + disk.freePercent + '% free) — WAL checkpoint only, log archives deferred'
    } else {
      await compactLogs(report, now)
    }

    report.durationMs = Date.now() - started
    await saveReport(report)
    if (disk && disk.level !== 'ok') {
      console.warn('[auto-compact] disk pressure ' + disk.freePercent + '% free (' + disk.level + ') — wal ' + report.wal.length + ', logs ' + report.logs.length)
    }
    return report
  } finally {
    g.__junkalotAutoCompactRunning = false
  }
}

export async function readLastCompactReport(): Promise<CompactReport | null> {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8')) as CompactReport
  } catch {
    return null
  }
}

// Started once per server process. Timers are unref'd so a compaction schedule
// can never hold the process open.
export function startAutoCompactScheduler(intervalMs = MIN_INTERVAL_MS): void {
  const g = globalThis as any
  if (g.__junkalotAutoCompactScheduler) return
  const first = setTimeout(() => {
    void runAutoCompact().catch((err) => console.warn('[auto-compact] first pass failed:', err?.message || err))
  }, FIRST_RUN_DELAY_MS)
  const timer = setInterval(() => {
    void runAutoCompact().catch((err) => console.warn('[auto-compact] scheduled pass failed:', err?.message || err))
  }, intervalMs)
  // 2026-11-22 (owner): "add auto compact at 2% _7%". The hourly slot alone is too
  // slow for a disk that can fill in minutes, so the free percentage is read every
  // two minutes and a pass is requested at 7% free (5-minute floor) and 2% free
  // (1-minute floor). Reading statfs is cheap; the pass itself is still throttled.
  const pressure = setInterval(() => {
    void (async () => {
      const disk = await readDiskState()
      if (!disk || disk.level === 'ok') return
      await runAutoCompact().catch((err) => console.warn('[auto-compact] pressure pass failed:', err?.message || err))
    })()
  }, PRESSURE_CHECK_MS)
  try { first.unref?.() } catch {}
  try { timer.unref?.() } catch {}
  try { pressure.unref?.() } catch {}
  g.__junkalotAutoCompactScheduler = { first, timer, pressure }
  console.log('[auto-compact] scheduler armed (every ' + Math.round(intervalMs / 60000) + ' min, first pass in ' + Math.round(FIRST_RUN_DELAY_MS / 1000) + 's, disk check every ' + Math.round(PRESSURE_CHECK_MS / 60000) + ' min at ' + DISK_LOW_PERCENT + '% / ' + DISK_CRITICAL_PERCENT + '% free)')
}
