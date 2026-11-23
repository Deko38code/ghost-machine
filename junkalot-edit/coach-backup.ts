// Independent, verified snapshots of Susie's Coach conversation record.
//
// Owner (2026-11-22): "her history must always be recoverable". The live store is
// data/coach-memory.db (SQLite, WAL). A WAL checkpoint keeps that file tidy but is not
// a backup: a corruption, a bad restore or an accidental overwrite would take every
// bank, fact and message with it. This module writes an online snapshot of the database
// (better-sqlite3's backup API — safe while the server is reading and writing), verifies
// the copy before it is trusted, and records its SHA-256 and row counts beside it.
//
// Nothing here deletes, trims or rewrites a snapshot: files accumulate under
// data/backups/coach-memory/ and each is a complete database that can be restored by
// copying it back over data/coach-memory.db with the service stopped.
//
// One snapshot is taken shortly after each server start (a deploy is exactly when the
// file is about to be exercised by new code) and one a day after that, unless the newest
// snapshot already holds the same message count from today.

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const SRC_DB = path.join(DATA_DIR, 'coach-memory.db')
const BACKUP_DIR = path.join(DATA_DIR, 'backups', 'coach-memory')
const FIRST_RUN_DELAY_MS = 60 * 1000
const DAILY_MS = 24 * 60 * 60 * 1000

export type CoachBackup = {
  at: string
  reason: string
  file: string
  bytes: number
  sha256: string
  messages: number
  banks: number
  integrity: string
}

type Counts = { messages: number; banks: number }

async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true } catch { return false }
}

async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256')
  hash.update(await readFile(file))
  return hash.digest('hex')
}

async function readCounts(file: string): Promise<{ counts: Counts; integrity: string } | null> {
  try {
    const mod: any = await import('better-sqlite3')
    const Database = mod?.default || mod
    const db = new Database(file, { readonly: true, fileMustExist: true })
    try {
      const integrity = String((db.pragma('integrity_check', { simple: true }) ?? '') || 'unknown')
      const messages = Number(db.prepare('SELECT COUNT(*) AS n FROM coach_memory_messages').get()?.n || 0)
      const banks = Number(db.prepare('SELECT COUNT(*) AS n FROM coach_memory_banks').get()?.n || 0)
      return { counts: { messages, banks }, integrity }
    } finally {
      try { db.close() } catch {}
    }
  } catch {
    return null
  }
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

// Writes one snapshot. Returns null when the live store does not exist yet (a fresh
// install) — that is not an error, there is simply nothing to copy.
export async function backupCoachMemory(reason = 'manual'): Promise<CoachBackup | null> {
  if (!(await exists(SRC_DB))) return null
  await mkdir(BACKUP_DIR, { recursive: true })
  const at = new Date()
  const name = 'coach-memory-' + stamp(at) + '-' + reason.replace(/[^a-z0-9-]+/gi, '') + '.db'
  const dest = path.join(BACKUP_DIR, name)

  const mod: any = await import('better-sqlite3')
  const Database = mod?.default || mod
  const src = new Database(SRC_DB, { readonly: true })
  try {
    await src.backup(dest)
  } finally {
    try { src.close() } catch {}
  }

  // A snapshot is not trusted until it opens, passes the integrity check and reports the
  // same rows the live store had. A failed check keeps the file (nothing is deleted) but
  // says so, so it is never mistaken for a good copy.
  const verified = await readCounts(dest)
  const live = await readCounts(SRC_DB)
  const bytes = (await stat(dest)).size
  const result: CoachBackup = {
    at: at.toISOString(),
    reason,
    file: path.relative(process.cwd(), dest),
    bytes,
    sha256: await sha256Of(dest),
    messages: verified?.counts.messages ?? -1,
    banks: verified?.counts.banks ?? -1,
    integrity: !verified
      ? 'unreadable'
      : verified.integrity !== 'ok'
        ? verified.integrity
        : live && (verified.counts.messages !== live.counts.messages || verified.counts.banks !== live.counts.banks)
          ? 'row-count-mismatch'
          : 'ok',
  }
  try {
    await writeFile(dest + '.json', JSON.stringify(result, null, 2), 'utf8')
  } catch {
    // The sidecar is bookkeeping; the database copy is the backup.
  }
  if (result.integrity !== 'ok') {
    console.warn('[coach-backup] ' + name + ' did not verify: ' + result.integrity)
  } else {
    console.log('[coach-backup] ' + name + ' ok — ' + result.messages + ' messages, ' + result.banks + ' banks, ' + result.bytes + ' bytes')
  }
  return result
}

export async function listCoachBackups(): Promise<CoachBackup[]> {
  let names: string[] = []
  try { names = await readdir(BACKUP_DIR) } catch { return [] }
  const out: CoachBackup[] = []
  for (const name of names) {
    if (!name.endsWith('.db')) continue
    try {
      const raw = JSON.parse(await readFile(path.join(BACKUP_DIR, name + '.json'), 'utf8'))
      out.push(raw as CoachBackup)
    } catch {
      // A snapshot without a sidecar is still listed by name and size.
      try {
        const s = await stat(path.join(BACKUP_DIR, name))
        out.push({ at: s.mtime.toISOString(), reason: 'unknown', file: path.relative(process.cwd(), path.join(BACKUP_DIR, name)), bytes: s.size, sha256: '', messages: -1, banks: -1, integrity: 'unverified' })
      } catch {}
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

// True when the newest verified snapshot is from today and already holds every message
// the live store has, so a scheduled run would only duplicate it.
async function alreadyCurrentToday(): Promise<boolean> {
  const list = await listCoachBackups()
  const newest = list.find((b) => b.integrity === 'ok')
  if (!newest) return false
  const live = await readCounts(SRC_DB)
  if (!live) return false
  const sameDay = newest.at.slice(0, 10) === new Date().toISOString().slice(0, 10)
  return sameDay && newest.messages === live.counts.messages
}

export function startCoachBackupScheduler(): void {
  const g = globalThis as any
  if (g.__junkalotCoachBackupScheduler) return
  const start = setTimeout(() => {
    void (async () => {
      try {
        if (await alreadyCurrentToday()) return
        await backupCoachMemory('startup')
      } catch (err: any) {
        console.warn('[coach-backup] startup snapshot failed:', err?.message || err)
      }
    })()
  }, FIRST_RUN_DELAY_MS)
  const daily = setInterval(() => {
    void (async () => {
      try {
        if (await alreadyCurrentToday()) return
        await backupCoachMemory('daily')
      } catch (err: any) {
        console.warn('[coach-backup] daily snapshot failed:', err?.message || err)
      }
    })()
  }, DAILY_MS)
  try { start.unref?.() } catch {}
  try { daily.unref?.() } catch {}
  g.__junkalotCoachBackupScheduler = { start, daily }
  console.log('[coach-backup] scheduler armed (first snapshot in ' + Math.round(FIRST_RUN_DELAY_MS / 1000) + 's, then daily)')
}
