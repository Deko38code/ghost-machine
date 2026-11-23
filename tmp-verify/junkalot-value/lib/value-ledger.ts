// Owner-only client value ledger — "is the client getting more than $249 worth
// of usage a month?"  Owner (2026-11-21): "its just for our records and for to
// know if client gets more then 249$ usage worth monthly test", and "never show
// junkalot what we make only what they save".
//
// Read-only over Junkalot's own coach usage file (data/mred-usage.jsonl). It
// appends ONE snapshot line per UTC day to data/value-ledger.jsonl — append-only,
// never rewritten — so the month-over-month pattern is measured rather than
// remembered. Accounting only: nothing here charges an account, changes a plan
// or edits a provider (CLAUDE.md §19), and it never writes outside Junkalot.
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.JUNKALOT_DATA_DIR || path.join(process.cwd(), 'data')
const USAGE_FILE = process.env.MRED_USAGE_FILE || path.join(DATA_DIR, 'mred-usage.jsonl')
const LEDGER_FILE = path.join(DATA_DIR, 'value-ledger.jsonl')
const TERMS_FILE = path.join(DATA_DIR, 'value-terms.json')

export type ValueTerms = {
  planUsdMonth: number
  benchmarkInPerM: number
  benchmarkOutPerM: number
  rateNote: string
}

// The comparison rate is a published list price, not our cost. Our own lanes
// (DeepSeek peer, local GLM) are unmetered, so "what it cost us" is a separate,
// internal number; this one answers "what would this coach cost the client
// elsewhere". The owner can edit data/value-terms.json without a rebuild.
const DEFAULT_TERMS: ValueTerms = {
  planUsdMonth: 249,
  benchmarkInPerM: 3.0,
  benchmarkOutPerM: 15.0,
  rateNote:
    'Frontier list-price benchmark at $3.00 per million input tokens and $15.00 per million output tokens. ' +
    'It is a comparison figure for this record, never a bill and never our cost.',
}

export function readValueTerms(): ValueTerms {
  try {
    const raw = JSON.parse(fs.readFileSync(TERMS_FILE, 'utf8')) as Partial<ValueTerms>
    const num = (value: unknown, fallback: number) => (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback)
    return {
      planUsdMonth: num(raw.planUsdMonth, DEFAULT_TERMS.planUsdMonth),
      benchmarkInPerM: num(raw.benchmarkInPerM, DEFAULT_TERMS.benchmarkInPerM),
      benchmarkOutPerM: num(raw.benchmarkOutPerM, DEFAULT_TERMS.benchmarkOutPerM),
      rateNote: typeof raw.rateNote === 'string' && raw.rateNote.trim() ? raw.rateNote : DEFAULT_TERMS.rateNote,
    }
  } catch {
    return DEFAULT_TERMS
  }
}

type UsageRow = {
  at: string
  account?: string
  surface?: string
  provider?: string
  mode?: string
  inTokens?: number
  outTokens?: number
}

function readUsage(): UsageRow[] {
  let text = ''
  try {
    text = fs.readFileSync(USAGE_FILE, 'utf8')
  } catch {
    return []
  }
  const rows: UsageRow[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed) as UsageRow
      if (!row || typeof row.at !== 'string') continue
      if (Number.isNaN(new Date(row.at).getTime())) continue
      rows.push(row)
    } catch {
      // A torn line is skipped, never repaired or rewritten.
    }
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at))
}

export type DayValue = { day: string; turns: number; inTokens: number; outTokens: number; valueUsd: number }
export type MonthValue = {
  month: string
  turns: number
  inTokens: number
  outTokens: number
  valueUsd: number
  activeDays: number
  firstAt: string | null
  lastAt: string | null
  lanes: { provider: string; turns: number; tokens: number }[]
}
export type LedgerLine = { day: string; month: string; valueUsd: number; inTokens: number; outTokens: number; turns: number; planUsd: number; verdict: string }

export type ValueReport = {
  generatedAt: string
  terms: ValueTerms
  monthKey: string
  monthLabel: string
  month: MonthValue
  monthToDate: DayValue[]
  previousMonth: MonthValue | null
  plan: { priceUsd: number; utilisationPct: number; surplusUsd: number; shortfallUsd: number; verdict: string }
  projection: { elapsedDays: number; daysInMonth: number; projectedValueUsd: number; projectedTurns: number } | null
  patterns: { label: string; value: string; note: string }[]
  ledger: LedgerLine[]
  allTime: { turns: number; tokens: number; valueUsd: number; firstAt: string | null; lastAt: string | null }
  source: { usageFile: string; ledgerFile: string; rows: number }
}

function emptyMonth(month: string): MonthValue {
  return { month, turns: 0, inTokens: 0, outTokens: 0, valueUsd: 0, activeDays: 0, firstAt: null, lastAt: null, lanes: [] }
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function valueUsd(inTokens: number, outTokens: number, terms: ValueTerms): number {
  return (inTokens / 1e6) * terms.benchmarkInPerM + (outTokens / 1e6) * terms.benchmarkOutPerM
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function verdictFor(value: number, plan: number): string {
  if (plan <= 0) return 'no plan price set'
  if (value >= plan) return 'over plan — client is receiving more value than the plan price'
  if (value >= plan * 0.75) return 'near plan — within 25% of the plan price'
  if (value >= plan * 0.25) return 'within plan'
  return 'well under plan — usage is a small share of what the plan includes'
}

export function buildValueReport(now = new Date()): ValueReport {
  const terms = readValueTerms()
  const rows = readUsage()
  const monthKey = now.toISOString().slice(0, 7)
  const prevKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)

  const month = emptyMonth(monthKey)
  const previous = emptyMonth(prevKey)
  const dayMap = new Map<string, DayValue>()
  const laneMap = new Map<string, { provider: string; turns: number; tokens: number }>()
  const monthDays = new Set<string>()
  const prevDays = new Set<string>()
  let allIn = 0
  let allOut = 0
  let allTurns = 0
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const row of rows) {
    const inTokens = Number(row.inTokens) || 0
    const outTokens = Number(row.outTokens) || 0
    const at = row.at
    const key = dayKey(at)
    const rowMonth = key.slice(0, 7)

    allIn += inTokens
    allOut += outTokens
    allTurns += 1
    if (!firstAt || at < firstAt) firstAt = at
    if (!lastAt || at > lastAt) lastAt = at

    const target = rowMonth === monthKey ? month : rowMonth === prevKey ? previous : null
    if (target) {
      target.turns += 1
      target.inTokens += inTokens
      target.outTokens += outTokens
      if (!target.firstAt || at < target.firstAt) target.firstAt = at
      if (!target.lastAt || at > target.lastAt) target.lastAt = at
    }
    if (rowMonth === monthKey) monthDays.add(key)
    if (rowMonth === prevKey) prevDays.add(key)

    if (rowMonth === monthKey) {
      const day = dayMap.get(key) || { day: key, turns: 0, inTokens: 0, outTokens: 0, valueUsd: 0 }
      day.turns += 1
      day.inTokens += inTokens
      day.outTokens += outTokens
      dayMap.set(key, day)
      const provider = String(row.provider || 'unknown')
      const lane = laneMap.get(provider) || { provider, turns: 0, tokens: 0 }
      lane.turns += 1
      lane.tokens += inTokens + outTokens
      laneMap.set(provider, lane)
    }
  }

  month.activeDays = monthDays.size
  previous.activeDays = prevDays.size
  month.valueUsd = round2(valueUsd(month.inTokens, month.outTokens, terms))
  previous.valueUsd = round2(valueUsd(previous.inTokens, previous.outTokens, terms))
  month.lanes = [...laneMap.values()].sort((a, b) => b.tokens - a.tokens)

  const monthToDate = [...dayMap.values()]
    .map((day) => ({ ...day, valueUsd: round2(valueUsd(day.inTokens, day.outTokens, terms)) }))
    .sort((a, b) => a.day.localeCompare(b.day))

  const planPrice = terms.planUsdMonth
  const utilisationPct = planPrice > 0 ? round2((month.valueUsd / planPrice) * 100) : 0
  const surplusUsd = round2(Math.max(0, month.valueUsd - planPrice))
  const shortfallUsd = round2(Math.max(0, planPrice - month.valueUsd))

  const elapsedDays = now.getUTCDate()
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const projection =
    elapsedDays > 0
      ? {
          elapsedDays,
          daysInMonth,
          projectedValueUsd: round2((month.valueUsd / elapsedDays) * daysInMonth),
          projectedTurns: Math.round((month.turns / elapsedDays) * daysInMonth),
        }
      : null

  // Patterns are arithmetic over the rows above — nothing is inferred beyond them.
  const patterns: { label: string; value: string; note: string }[] = []
  patterns.push({
    label: 'Active days',
    value: `${month.activeDays} of ${elapsedDays}`,
    note: month.activeDays ? `Coach was used on ${month.activeDays} day(s) so far this month.` : 'No coach turns recorded this month yet.',
  })
  if (month.activeDays > 0) {
    patterns.push({
      label: 'Turns per active day',
      value: (month.turns / month.activeDays).toFixed(2),
      note: `${month.turns} recorded turn(s) across ${month.activeDays} day(s).`,
    })
  }
  if (month.lanes.length) {
    const top = month.lanes[0]
    const share = month.turns ? Math.round((top.turns / month.turns) * 100) : 0
    patterns.push({
      label: 'Dominant lane',
      value: `${top.provider} · ${share}%`,
      note: `${top.turns} of ${month.turns} turn(s) went through ${top.provider}; ${top.tokens.toLocaleString('en-US')} tokens.`,
    })
  }
  const weekdayTurns = new Map<number, number>()
  for (const day of monthToDate) {
    const wd = new Date(day.day + 'T00:00:00Z').getUTCDay()
    weekdayTurns.set(wd, (weekdayTurns.get(wd) || 0) + day.turns)
  }
  if (weekdayTurns.size) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const best = [...weekdayTurns.entries()].sort((a, b) => b[1] - a[1])[0]
    patterns.push({ label: 'Busiest day', value: `${names[best[0]]} · ${best[1]} turn(s)`, note: 'Weekday with the most coach turns this month.' })
  }
  if (previous.turns > 0) {
    const delta = month.valueUsd - previous.valueUsd
    const pct = previous.valueUsd > 0 ? Math.round((delta / previous.valueUsd) * 100) : null
    patterns.push({
      label: 'Month over month',
      value: pct === null ? `${delta >= 0 ? '+' : ''}$${round2(delta)}` : `${pct >= 0 ? '+' : ''}${pct}%`,
      note: `Last month $${previous.valueUsd} benchmark value over ${previous.turns} turn(s).`,
    })
  } else {
    patterns.push({ label: 'Month over month', value: 'no prior month', note: 'No coach usage recorded last month, so there is nothing to compare yet.' })
  }

  return {
    generatedAt: now.toISOString(),
    terms,
    monthKey,
    monthLabel: new Date(monthKey + '-01T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    month,
    monthToDate,
    previousMonth: previous.turns ? previous : null,
    plan: { priceUsd: planPrice, utilisationPct, surplusUsd, shortfallUsd, verdict: verdictFor(month.valueUsd, planPrice) },
    projection,
    patterns,
    ledger: readLedger(),
    allTime: { turns: allTurns, tokens: allIn + allOut, valueUsd: round2(valueUsd(allIn, allOut, terms)), firstAt, lastAt },
    source: { usageFile: USAGE_FILE, ledgerFile: LEDGER_FILE, rows: rows.length },
  }
}

export function readLedger(): LedgerLine[] {
  let text = ''
  try {
    text = fs.readFileSync(LEDGER_FILE, 'utf8')
  } catch {
    return []
  }
  const lines: LedgerLine[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed) as LedgerLine
      if (row && row.day && row.month) lines.push(row)
    } catch {
      // Append-only: a torn line is skipped, never repaired in place.
    }
  }
  return lines
}

// One line per UTC day. The ledger is never rewritten: if today's line exists
// the function returns without touching the file.
export function appendLedgerSnapshot(report: ValueReport): { written: boolean; reason: string } {
  const day = new Date(report.generatedAt).toISOString().slice(0, 10)
  const existing = readLedger()
  if (existing.some((line) => line.day === day)) return { written: false, reason: 'today already recorded' }
  const line: LedgerLine = {
    day,
    month: report.monthKey,
    valueUsd: report.month.valueUsd,
    inTokens: report.month.inTokens,
    outTokens: report.month.outTokens,
    turns: report.month.turns,
    planUsd: report.terms.planUsdMonth,
    verdict: report.plan.verdict,
  }
  try {
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(line) + '\n', 'utf8')
    return { written: true, reason: 'appended' }
  } catch (error) {
    return { written: false, reason: 'ledger not writable: ' + (error instanceof Error ? error.message : 'unknown') }
  }
}
