// Saved PhantomIDE → Junkalot messages.
//
// The Mr Ed bubble is live: it is rebuilt from the current server state on every
// request. This file is the Inbox — every message Mr Ed showed her is written
// once, kept forever, and readable later from the Inbox tab. Append-only, never
// trimmed, never deleted.
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DIR, 'mred-inbox.jsonl')
// Soft cap: stop appending rather than ever trimming history.
const MAX_BYTES = 10 * 1024 * 1024

export type MrEdInboxMessage = {
  id: string
  kind: 'hello' | 'todo' | 'mail' | 'feedback' | 'update' | 'client'
  title: string
  body: string
  at: string
  savedAt: string
  href?: string
  action?: 'connect-gmail'
}

// Her admin never carries the developer's name (owner, 2026-11-21: "no data
// with my name go in her admin"). Messages saved before that rule are
// corrected as they are read — the append-only store itself is never rewritten.
const OWNER_NAME = /\bDeke\b/gi
const scrub = (value: unknown): string =>
  typeof value === 'string' ? value.replace(OWNER_NAME, 'Susie') : ''

export async function readMrEdInbox(limit = 200): Promise<MrEdInboxMessage[]> {
  const max = Math.max(1, Math.min(500, Math.floor(Number(limit)) || 200))
  let text = ''
  try {
    text = await readFile(FILE, 'utf8')
  } catch {
    return []
  }
  const out: MrEdInboxMessage[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const value = JSON.parse(trimmed)
      if (value && typeof value === 'object' && value.id) {
        out.push({ ...value, title: scrub(value.title), body: scrub(value.body) } as MrEdInboxMessage)
      }
    } catch {
      // Skip a malformed line instead of failing the whole read.
    }
  }
  return out.slice(-max).reverse()
}

// Total messages ever saved — used for the live Inbox count on every tab.
export async function countMrEdMessages(): Promise<number> {
  try {
    const text = await readFile(FILE, 'utf8')
    let n = 0
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const value = JSON.parse(trimmed)
        if (value && typeof value === 'object' && value.id) n += 1
      } catch {
        // A malformed line is not a saved message, so it is not counted.
      }
    }
    return n
  } catch {
    return 0
  }
}

// Idempotent: a message id is saved once. Later visits refresh nothing, so the
// Inbox keeps the moment each message first appeared instead of being rewritten.
export type MrEdMessageDraft = Omit<MrEdInboxMessage, 'savedAt' | 'at'> & { at?: string }

export async function saveMrEdMessages(messages: MrEdMessageDraft[]): Promise<number> {
  if (!messages.length) return 0
  await mkdir(DIR, { recursive: true })
  try {
    const info = await stat(FILE)
    if (info.size > MAX_BYTES) return 0
  } catch {
    // No file yet — appendFile creates it.
  }
  let existing = new Set<string>()
  try {
    const text = await readFile(FILE, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const value = JSON.parse(trimmed)
        if (value?.id) existing.add(String(value.id))
      } catch { /* skip */ }
    }
  } catch {
    existing = new Set<string>()
  }
  const savedAt = new Date().toISOString()
  const fresh: MrEdInboxMessage[] = []
  const seen = new Set<string>()
  for (const message of messages) {
    const id = String(message.id || '').trim()
    if (!id || existing.has(id) || seen.has(id)) continue
    seen.add(id)
    fresh.push({ ...message, at: message.at || savedAt, savedAt })
  }
  if (!fresh.length) return 0
  await appendFile(FILE, fresh.map(message => JSON.stringify(message)).join('\n') + '\n', 'utf8')
  return fresh.length
}
