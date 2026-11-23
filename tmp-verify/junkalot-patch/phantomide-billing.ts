// Pay PhantomIDE — button acknowledgement + the Mr Ed coach lock.
//
// 2026-11-20 (owner): "add to her next login ai coach session has she seen or
// view the new pay phantomide button ... when she confirms threw mr ed ai coach
// we logg it ... weekly lockout after no payments are recieved yet but she can
// still use booking recieve emails use her dash just not mr ed ... clicking that
// button prompts her to make a payment to phantomide pay past due bill which
// accumaulates starting jan 1".
//
// The MONEY is not computed here. payoff-gate.ts owns the single set of numbers
// (payments start, monthly rate, grace days, ledger). This module only:
//   1. records that the client has seen the Pay PhantomIDE button, and
//   2. exposes a coach-only availability flag derived from that same gate.
// Nothing here can lock the public site, bookings, email or any other admin
// page — the lock is enforced only in the AI Coach endpoint and its panel.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hostingGate } from '@/lib/payoff-gate'

export type ButtonCheck = {
  key: string
  acknowledgedAt: string
  by: string
  method: 'button' | 'coach'
}

export type BillingPayment = {
  at: string
  amount: number
  note: string
  recordedBy: string
}

export type BillingStore = {
  version: 1
  buttonChecks: ButtonCheck[]
  payments: BillingPayment[]
}

// Changing the button or its copy is a new question, so the key changes with it.
export const BUTTON_CHECK_KEY = 'pay-phantomide-button-2026-11'
export const CLIENT_EMAILS = ['1junkalot@gmail.com', 'susanschlamp53@gmail.com']

const STORE_FILE = process.env.PHANTOMIDE_BILLING_PATH || path.join(os.homedir(), '.phantomide-billing.json')
const LOG_FILE = process.env.PHANTOMIDE_BILLING_LOG || path.join(os.homedir(), '.phantomide-billing-log.jsonl')

const emptyStore = (): BillingStore => ({ version: 1, buttonChecks: [], payments: [] })

const clean = (value: unknown, max = 300): string =>
  typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : ''

const isEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export function isClientEmail(email: string): boolean {
  return CLIENT_EMAILS.includes(String(email || '').trim().toLowerCase())
}

// Read-only callers get the same empty store on a missing or unreadable file;
// the writer below is the only place that can create it.
export function readStore(): BillingStore {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ STORE_FILE, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyStore()
    const record = raw as Record<string, unknown>
    const buttonChecks = Array.isArray(record.buttonChecks)
      ? (record.buttonChecks as unknown[]).flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const row = item as Record<string, unknown>
          const key = clean(row.key, 80)
          const acknowledgedAt = clean(row.acknowledgedAt, 40)
          if (!key || !acknowledgedAt) return []
          return [{
            key,
            acknowledgedAt,
            by: clean(row.by, 200),
            method: row.method === 'coach' ? 'coach' as const : 'button' as const,
          }]
        })
      : []
    const payments = Array.isArray(record.payments)
      ? (record.payments as unknown[]).flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const row = item as Record<string, unknown>
          const amount = Number(row.amount)
          const at = clean(row.at, 40)
          if (!at || !Number.isFinite(amount) || amount <= 0) return []
          return [{ at, amount: Math.round(amount * 100) / 100, note: clean(row.note, 300), recordedBy: clean(row.recordedBy, 200) }]
        })
      : []
    return { version: 1, buttonChecks, payments }
  } catch {
    return emptyStore()
  }
}

// Write-then-rename keeps a half-written file from ever being the live record.
// The previous version is copied aside first, so nothing is lost or replaced
// without a recovery copy. Returns the stored object for the caller to report.
function writeStore(next: BillingStore): BillingStore {
  fs.mkdirSync(path.dirname(/* turbopackIgnore: true */ STORE_FILE), { recursive: true, mode: 0o700 })
  const body = JSON.stringify(next, null, 2) + '\n'
  try {
    if (fs.existsSync(/* turbopackIgnore: true */ STORE_FILE)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      fs.copyFileSync(/* turbopackIgnore: true */ STORE_FILE, STORE_FILE + '.bak-' + stamp, fs.constants.COPYFILE_EXCL)
    }
  } catch { /* an unavailable backup copy must not block the real write */ }
  const tmp = STORE_FILE + '.tmp-' + process.pid + '-' + Date.now()
  fs.writeFileSync(/* turbopackIgnore: true */ tmp, body, { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(/* turbopackIgnore: true */ tmp, STORE_FILE)
  return next
}

function logEvent(event: Record<string, unknown>): void {
  try {
    fs.appendFileSync(/* turbopackIgnore: true */ LOG_FILE, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n', { encoding: 'utf8', mode: 0o600 })
  } catch { /* the confirmation is still stored in the main file */ }
}

export function buttonStatus(): ButtonCheck | null {
  const store = readStore()
  for (let i = store.buttonChecks.length - 1; i >= 0; i -= 1) {
    if (store.buttonChecks[i].key === BUTTON_CHECK_KEY) return store.buttonChecks[i]
  }
  return null
}

export function listPayments(): BillingPayment[] {
  return readStore().payments
}

export type AcknowledgementResult = { check: ButtonCheck; already: boolean; logWritten: boolean }

// Idempotent: the first confirmation stands, later ones are reported without
// creating a second record. `method` records whether she tapped the card or
// told Mr Ed in the chat.
export function acknowledgeButton(email: string, method: 'button' | 'coach'): AcknowledgementResult {
  const by = String(email || '').trim().toLowerCase()
  if (!isEmail(by)) throw new Error('A signed-in account is required to log the button confirmation.')
  const existing = buttonStatus()
  if (existing) return { check: existing, already: true, logWritten: false }
  const check: ButtonCheck = { key: BUTTON_CHECK_KEY, acknowledgedAt: new Date().toISOString(), by, method }
  const store = readStore()
  writeStore({ ...store, buttonChecks: [...store.buttonChecks, check] })
  logEvent({ event: 'button-acknowledged', key: BUTTON_CHECK_KEY, by, method, acknowledgedAt: check.acknowledgedAt })
  return { check, already: false, logWritten: true }
}

export type RecordedPaymentResult = { payment: BillingPayment; totalRecorded: number }

// Owner-only in the API layer. Recording here cannot double-count the invoice
// ledger, because payoff-gate adds these payments on top of its paid-invoice
// count — record a payment in exactly one of the two places, never both.
export function recordPayment(email: string, amount: number, note: string): RecordedPaymentResult {
  const by = String(email || '').trim().toLowerCase()
  if (!isEmail(by)) throw new Error('A signed-in owner account is required to record a payment.')
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error('Enter a payment amount between $0.01 and $100,000.')
  const payment: BillingPayment = {
    at: new Date().toISOString(),
    amount: Math.round(amount * 100) / 100,
    note: clean(note, 300),
    recordedBy: by,
  }
  const store = readStore()
  const payments = [...store.payments, payment]
  writeStore({ ...store, payments })
  logEvent({ event: 'payment-recorded', amount: payment.amount, note: payment.note, recordedBy: by, at: payment.at })
  return { payment, totalRecorded: Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100 }
}

// ── Which account, and from where ────────────────────────────────────────────
//
// 2026-11-20 (owner): "make billing know her ips and logg them to know when to
// prompt her when she uses her 1junkalot email and susie email so it know who to
// prompt for payments" and "server runs from my box parrot and serves her site
// pages so it dosent block our parrot box ... she only logs in from her machine
// to my box".
//
// The money gate is per ACCOUNT (email) — see payoff-gate.ts. This part only
// answers "which account, from which address": addresses the client accounts
// sign in from are remembered so the owner can see her devices, and any request
// that arrives from the hosting box itself is never treated as a client request,
// so the server that serves the site pages can never pause itself.
export type ClientDevice = { ip: string; firstSeen: string; lastSeen: string; count: number; where: string; box: boolean }
export type ClientAccess = { email: string; lastSeen: string; devices: ClientDevice[] }
export type ClientAccessStore = { version: 1; clients: Record<string, ClientAccess> }

const ACCESS_FILE = process.env.PHANTOMIDE_CLIENT_IP_LOG || path.join(os.homedir(), '.phantomide-client-ips.json')
const MAX_DEVICES = 20

// One accepted spelling of an address: no port, no brackets, no IPv4-mapped prefix.
export function cleanIp(value: unknown): string {
  let ip = typeof value === 'string' ? value.trim().toLowerCase() : ''
  ip = ip.replace(/^\[|\]$/g, '').split(',')[0].trim()
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  const v4 = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.exec(ip)
  if (v4) ip = ip.split(':')[0]
  if (!ip || ip.length > 64 || !/^[0-9a-f:.]+$/.test(ip)) return ''
  return ip
}

// Addresses that mean "this hosting box": loopback, every address bound to this
// machine (so Parrot's own LAN address counts too) and link-local.
export function boxAddresses(): string[] {
  const list = ['127.0.0.1', '::1', '0.0.0.0', '::']
  try {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) {
        const ip = cleanIp(entry && entry.address)
        if (ip) list.push(ip)
      }
    }
  } catch { /* an interface read failure only leaves more addresses unknown */ }
  for (const extra of String(process.env.PHANTOMIDE_BOX_IPS || '').split(',')) {
    const ip = cleanIp(extra)
    if (ip) list.push(ip)
  }
  return list
}

export function isBoxAddress(value: string): boolean {
  const ip = cleanIp(value)
  if (!ip) return false
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0' || ip === '::') return true
  if (ip.startsWith('fe80:')) return true
  return boxAddresses().includes(ip)
}

// Cloudflare first, then the origin proxy headers, then the direct connection.
export function clientIpFrom(headers: Headers): string {
  const read = (name: string) => cleanIp(headers.get(name))
  return read('cf-connecting-ip') || read('x-real-ip') || read('x-forwarded-for') || ''
}

// A client is prompted only for her own account, and never from the box itself.
export function promptEligible(email: string, ip: string): boolean {
  return isClientEmail(email) && !!cleanIp(ip) && !isBoxAddress(ip)
}

export function readClientAccess(): ClientAccessStore {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ ACCESS_FILE, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { version: 1, clients: {} }
    const record = raw as Record<string, unknown>
    const source = record.clients && typeof record.clients === 'object' && !Array.isArray(record.clients)
      ? record.clients as Record<string, unknown>
      : {}
    const clients: Record<string, ClientAccess> = {}
    for (const [email, value] of Object.entries(source)) {
      if (!isEmail(email) || !isClientEmail(email) || !value || typeof value !== 'object') continue
      const row = value as Record<string, unknown>
      const devices = Array.isArray(row.devices)
        ? (row.devices as unknown[]).flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const d = item as Record<string, unknown>
            const ip = cleanIp(d.ip)
            const firstSeen = clean(d.firstSeen, 40)
            const lastSeen = clean(d.lastSeen, 40)
            if (!ip || !firstSeen || !lastSeen) return []
            return [{ ip, firstSeen, lastSeen, count: Math.max(1, Math.min(100000, Number(d.count) || 1)), where: clean(d.where, 60), box: d.box === true }]
          })
        : []
      clients[email] = { email, lastSeen: clean(row.lastSeen, 40), devices }
    }
    return { version: 1, clients }
  } catch {
    return { version: 1, clients: {} }
  }
}

function writeClientAccess(next: ClientAccessStore): void {
  fs.mkdirSync(path.dirname(/* turbopackIgnore: true */ ACCESS_FILE), { recursive: true, mode: 0o700 })
  try {
    if (fs.existsSync(/* turbopackIgnore: true */ ACCESS_FILE)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      fs.copyFileSync(/* turbopackIgnore: true */ ACCESS_FILE, ACCESS_FILE + '.bak-' + stamp, fs.constants.COPYFILE_EXCL)
    }
  } catch { /* an unavailable backup copy must not block the record */ }
  const tmp = ACCESS_FILE + '.tmp-' + process.pid + '-' + Date.now()
  fs.writeFileSync(/* turbopackIgnore: true */ tmp, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(/* turbopackIgnore: true */ tmp, ACCESS_FILE)
}

// Called from the authenticated endpoints. Only client addresses are stored, one
// row per address, newest first, capped so the file cannot grow without limit.
export function recordClientAccess(email: string, ip: string, where: string): ClientDevice | null {
  const by = String(email || '').trim().toLowerCase()
  if (!isClientEmail(by)) return null
  const address = cleanIp(ip)
  if (!address) return null
  const at = new Date().toISOString()
  const store = readClientAccess()
  const current = store.clients[by] || { email: by, lastSeen: at, devices: [] }
  const existing = current.devices.find((d) => d.ip === address)
  const device: ClientDevice = existing
    ? { ...existing, lastSeen: at, count: existing.count + 1, where: clean(where, 60) || existing.where, box: isBoxAddress(address) }
    : { ip: address, firstSeen: at, lastSeen: at, count: 1, where: clean(where, 60), box: isBoxAddress(address) }
  const devices = [device, ...current.devices.filter((d) => d.ip !== address)].slice(0, MAX_DEVICES)
  writeClientAccess({ version: 1, clients: { ...store.clients, [by]: { email: by, lastSeen: at, devices } } })
  logEvent({ event: 'client-access', email: by, ip: address, where: clean(where, 60), box: device.box })
  return device
}

export function listClientAccess(email?: string): ClientAccess[] {
  const store = readClientAccess()
  const wanted = String(email || '').trim().toLowerCase()
  return Object.values(store.clients)
    .filter((row) => !wanted || row.email === wanted)
    .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)))
}

export type CoachAvailability = {
  exempt: boolean
  blocked: boolean
  state: 'not-started' | 'current' | 'grace' | 'locked' | 'lien-sale' | 'paid-off' | 'unknown'
  totalDue: number
  overdueTotal: number
  overdueMonths: number
  unpaidMonths: number
  dueAt: string
  graceEndsAt: string
  checkoutUrl: string
  totalsKnown: boolean
  note: string
}

// The coach lock is the gate minus everything that is not Mr Ed. The owner and
// the developer account are always exempt; an unreadable ledger never blocks.
export async function coachAvailability(email: string, now: Date = new Date()): Promise<CoachAvailability> {
  const gate = await hostingGate(email, now)
  return {
    exempt: gate.exempt,
    blocked: !gate.exempt && gate.blocked,
    state: gate.state,
    totalDue: gate.totalDue,
    overdueTotal: gate.overdueTotal,
    overdueMonths: gate.overdueMonths,
    unpaidMonths: gate.unpaidMonths,
    dueAt: gate.dueAt,
    graceEndsAt: gate.graceEndsAt,
    checkoutUrl: gate.checkoutUrl,
    totalsKnown: gate.totalsKnown,
    note: gate.note,
  }
}

export function coachLockMessage(status: CoachAvailability): string {
  const due = status.totalsKnown ? '$' + status.totalDue.toFixed(2) : 'the past-due balance'
  if (status.state === 'lien-sale') {
    return 'Mr Ed is paused on this account. The PhantomIDE Website & Booking Care payment is past due and the grace period has ended, so the balance is ' + due + ' and the account is in the lien notice window. Your bookings, email and dashboard still work normally — only the AI Coach is paused. Pay the past-due bill from the Invoices page to bring Mr Ed back.'
  }
  return 'Mr Ed is paused on this account. The PhantomIDE Website & Booking Care payment is past its 7-day grace period, so the past-due balance is ' + due + '. Your bookings, email and dashboard still work normally — only the AI Coach is paused. Pay the past-due bill from the Invoices page and the Coach comes back on the next request.'
}

// The deterministic answer detector for "yes, I have seen it". It needs BOTH
// the button topic AND a clear affirmative, so ordinary chat about an invoice
// or a lesson can never be mistaken for the confirmation.
const BUTTON_TOPIC = /\b(?:pay\s*phantomide|phantomide(?:'s)?\s+pay(?:\s+button)?|pay\s+button|new\s+button|green\s+button)\b/i
const AFFIRMATIVE = /\b(?:yes|yeah|yep|yup|i\s+did|i\s+have|i['’]ve|i\s+saw|i\s+seen|i\s+see\s+it|seen\s+it|viewed\s+it|i\s+found\s+it|it['’]s\s+there|its\s+there|got\s+it|already\s+seen|already\s+looked)\b/i

export function mentionsButtonConfirmation(message: string): boolean {
  const text = clean(message, 1200)
  if (!text || text.length > 600) return false
  return BUTTON_TOPIC.test(text) && AFFIRMATIVE.test(text)
}

// The server-side facts Mr Ed is given on every request. He is told the truth
// about the record and never asked to collect money by chat.
export function billingPromptBlock(check: ButtonCheck | null, status: CoachAvailability): string {
  const lines: string[] = ['PAY PHANTOMIDE BUTTON CHECK (server record — never guess):', '- The button is the green "Pay PhantomIDE" button at the top of her Invoices page (/admin/invoices).']
  if (check) {
    lines.push('- Confirmation: ALREADY LOGGED on ' + check.acknowledgedAt.slice(0, 10) + ' by ' + check.by + ' (' + check.method + '). Never ask about the button again.')
  } else {
    lines.push('- Confirmation: NOT YET LOGGED. Ask her at the start of every session — learning, review, or normal chat — warmly and briefly, whether she has seen the new Pay PhantomIDE button in her admin. If she says yes, tell her the Coach is logging that confirmation on the payments record. Keep asking at the start of each new session until the server record shows the confirmation; never stop asking just because she did not answer last time.')
  }
  if (status.state === 'not-started') {
    lines.push('- Plan status: the $249/month PhantomIDE Website & Booking Care plan begins January 1, 2027. Nothing is due today. Never ask her to pay early and never say billing is active.')
  } else if (status.state === 'unknown') {
    lines.push('- Plan status: the payment record could not be read just now. Do not quote a balance; say the record is unavailable and nothing is locked.')
  } else if (status.state === 'current' && status.totalsKnown) {
    lines.push('- Plan status: every month to date is covered. Next payment is due ' + status.dueAt.slice(0, 10) + '. Total owed today: $' + status.totalDue.toFixed(2) + '.')
  } else if (status.state === 'grace') {
    lines.push('- Plan status: the ' + status.dueAt.slice(0, 10) + ' payment is inside its 7-day grace period, so the Coach stays open. Amount owed: $' + status.totalDue.toFixed(2) + '. Remind her gently; do not threaten a lock.')
  } else if (status.blocked) {
    lines.push('- Plan status: the monthly payment is past due and the Coach is paused. Total due: $' + status.totalDue.toFixed(2) + '.')
  }
  return lines.join('\n')
}
