import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null
function getDb() {
  if (db) return db
  db = new Database(path.join(process.cwd(), 'data', 'coach-memory.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS coach_memory_banks (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS coach_memory_banks_owner ON coach_memory_banks(owner_email);
    CREATE TABLE IF NOT EXISTS coach_memory_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id TEXT NOT NULL REFERENCES coach_memory_banks(id),
      fact TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(bank_id, fact_key)
    );
    CREATE TABLE IF NOT EXISTS coach_memory_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id TEXT NOT NULL REFERENCES coach_memory_banks(id),
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS coach_memory_messages_bank ON coach_memory_messages(bank_id,id);
  `)
  return db
}
const emailKey = (email: string) => String(email || '').trim().toLowerCase()
function ownedBank(owner: string, id: string) {
  return getDb().prepare('SELECT id FROM coach_memory_banks WHERE id=? AND owner_email=?').get(id, emailKey(owner))
}
export function listCoachMemoryBanks(owner: string) {
  const d=getDb(), e=emailKey(owner)
  let rows=d.prepare('SELECT b.id,b.name,b.created_at,(SELECT COUNT(*) FROM coach_memory_messages m WHERE m.bank_id=b.id) AS messages FROM coach_memory_banks b WHERE b.owner_email=? ORDER BY b.created_at,b.id').all(e) as any[]
  if (!rows.length) {
    const id='bank_'+crypto.randomUUID()
    d.prepare('INSERT INTO coach_memory_banks(id,owner_email,name) VALUES(?,?,?)').run(id,e,'General')
    rows=d.prepare('SELECT b.id,b.name,b.created_at,(SELECT COUNT(*) FROM coach_memory_messages m WHERE m.bank_id=b.id) AS messages FROM coach_memory_banks b WHERE b.owner_email=? ORDER BY b.created_at,b.id').all(e) as any[]
  }
  return rows
}
// Owner-only recovery helper, used by /api/admin/coach-backup's export. It returns every
// bank on the box with its owner so the admin recovery file carries the whole Coach
// record (the route itself is admin-only; no client-facing caller can reach this).
export function listAllCoachMemoryBanks() {
  return getDb().prepare('SELECT id,owner_email,name,created_at FROM coach_memory_banks ORDER BY created_at,id').all() as any[]
}
export function createCoachMemoryBank(owner:string,name:string) {
  const id='bank_'+crypto.randomUUID()
  getDb().prepare('INSERT INTO coach_memory_banks(id,owner_email,name) VALUES(?,?,?)').run(id,emailKey(owner),String(name).trim().slice(0,80)||'Client')
  return id
}
export function getCoachMemory(owner:string,id:string,options:{limit?:number}={}) {
  if (!ownedBank(owner,id)) return null
  const d=getDb()
  // 2026-11-22 (owner): "need all the chats back and output". The lesson panel shows
  // the bank's whole saved conversation, so the memory view asks for limit 0 (all).
  // The model prompt keeps its own window: ai-terminal calls this with no options and
  // still gets the most recent 24 messages.
  const limit = Number.isFinite(options.limit) ? Number(options.limit) : 24
  const messages = limit > 0
    ? d.prepare('SELECT id,role,content FROM coach_memory_messages WHERE bank_id=? ORDER BY id DESC LIMIT ?').all(id, limit).reverse()
    : d.prepare('SELECT id,role,content FROM coach_memory_messages WHERE bank_id=? ORDER BY id').all(id)
  return {
    facts:d.prepare('SELECT id,fact,created_at FROM coach_memory_facts WHERE bank_id=? ORDER BY id').all(id),
    messages
  }
}
// 2026-11-22 (owner): "use the 71 messages as inbox with live counter as chats grow" and
// "we will use chat count as recovery tool id per chat". A cheap count (no message text)
// so the panel's inbox counter can refresh without re-reading the whole transcript, and so
// a chat can be named by its place in the record.
export function countCoachMemoryMessages(owner:string,id:string) {
  if (!ownedBank(owner,id)) return null
  const row=getDb().prepare('SELECT COUNT(*) n, MAX(created_at) last, MAX(id) lastId FROM coach_memory_messages WHERE bank_id=?').get(id) as any
  return { count:Number(row?.n||0), lastAt:(row?.last||null) as string|null, lastId:Number(row?.lastId||0) }
}

// 2026-11-22 (owner): the unread badge has to equal the record on every device, so the read
// cursor is the last message id the account marked read. Ids are written in order; a clock
// reading is not (stored rows carry local time, the browser sends UTC), so counting by id
// removes the timezone mismatch that let the badge disagree with the saved record.
export function countCoachMessagesAfterId(owner:string,id:string,afterId:number) {
  if (!ownedBank(owner,id)) return 0
  const row=getDb().prepare('SELECT COUNT(*) n FROM coach_memory_messages WHERE bank_id=? AND id > ?').get(id,Math.max(0,Math.floor(Number(afterId)||0))) as any
  return Number(row?.n||0)
}

// 2026-11-22 (owner): "add updates tab to our live counter ... showing unread updates #".
// Counts the chats saved after a given moment, so the Updates tab's unread number is read
// from the record itself.
export function countCoachMessagesSince(owner:string,id:string,sinceISO:string) {
  if (!ownedBank(owner,id)) return 0
  const row=getDb().prepare('SELECT COUNT(*) n FROM coach_memory_messages WHERE bank_id=? AND created_at > ?').get(id,String(sinceISO||'')) as any
  return Number(row?.n||0)
}

export function addCoachMemoryFact(owner:string,id:string,fact:string) {
  if (!ownedBank(owner,id)) return false
  const value=String(fact||'').trim().slice(0,1200)
  if (!value) return false
  const key=value.toLowerCase().replace(/\s+/g,' ')
  getDb().prepare('INSERT OR IGNORE INTO coach_memory_facts(bank_id,fact,fact_key) VALUES(?,?,?)').run(id,value,key)
  return true
}
export function appendCoachMemoryMessage(owner:string,id:string,role:'user'|'assistant',content:string) {
  if (!ownedBank(owner,id)) return false
  // 2026-11-22 (owner): "need all the chats back and output". Long replies are kept in
  // full so the lesson panel can show them; the model prompt still trims each message
  // to 6,000 characters when it builds its context (ai-terminal), so the saved text can
  // be complete without ever making a request larger than before.
  getDb().prepare('INSERT INTO coach_memory_messages(bank_id,role,content) VALUES(?,?,?)').run(id,role,String(content||'').slice(0,60000))
  return true
}
