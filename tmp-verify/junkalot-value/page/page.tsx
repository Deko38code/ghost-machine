import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { isOwnerEmail } from '@/lib/auth'
import { appendLedgerSnapshot, buildValueReport } from '@/lib/value-ledger'

// Owner-only client value record. Owner (2026-11-21): "its just for our records
// and for to know if client gets more then 249$ usage worth monthly test" and
// "never show junkalot what we make only what they save".
// Any signed-in account that is not the owner gets a 404 — the page does not
// exist for the client. The gate is this server component, not a hidden link.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Client value record', robots: { index: false, follow: false } }

function money(value: number, digits = 2): string {
  return '$' + (Number(value) || 0).toFixed(digits)
}

function Wheel({ percent, label, caption, color }: { percent: number; label: string; caption: string; color: string }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  const circ = 2 * Math.PI * 34
  const dash = (p / 100) * circ
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
      <svg viewBox="0 0 84 84" className="h-24 w-24" role="img" aria-label={`${label} ${p.toFixed(1)} percent`}>
        <circle cx="42" cy="42" r="34" fill="none" stroke="#1f2937" strokeWidth="9" />
        <circle
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="47" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="15" fontWeight="700" fill="#f8fafc">
          {p >= 99.95 ? '100%' : p.toFixed(1) + '%'}
        </text>
      </svg>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</div>
      <div className="text-center text-[11px] leading-snug text-gray-400">{caption}</div>
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' }) {
  const valueClass = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-300' : 'text-white'
  return (
    <div className="min-w-0 rounded-2xl border border-gray-800 bg-gray-950/60 p-3">
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.11em] text-gray-500">{label}</div>
      <div className={`mt-1.5 break-words font-mono text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-gray-500">{sub}</div>
    </div>
  )
}

export default async function ClientValuePage() {
  const session = await getServerSession(authOptions)
  const email = String(session?.user?.email || '').toLowerCase()
  if (!isOwnerEmail(email)) notFound()

  const report = buildValueReport()
  const recorded = appendLedgerSnapshot(report)
  const { month, plan, projection, terms } = report

  const days = report.monthToDate
  const maxDayValue = Math.max(1, ...days.map((day) => day.valueUsd))
  const utilisation = Math.min(100, plan.utilisationPct)
  const projectedPct = projection && plan.priceUsd > 0 ? Math.min(100, (projection.projectedValueUsd / plan.priceUsd) * 100) : 0
  const elapsedPct = projection ? (projection.elapsedDays / projection.daysInMonth) * 100 : 0

  return (
    <div className="min-h-screen bg-brand-dark px-4 pb-24 pt-6 text-white sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Junkalot · owner only · internal record</p>
            <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Client value vs the plan</h1>
          </div>
          <div className="font-mono text-[11px] text-gray-500" role="status" aria-live="polite">
            Read {new Date(report.generatedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC · ledger {recorded.written ? 'updated' : 'already had today'}
          </div>
        </div>

        <p className="mb-6 max-w-3xl text-sm leading-relaxed text-gray-400">
          This page answers one question for our own records: is the client receiving more than the plan price in usage value each month?
          It reads the coach usage file this site already writes, prices those tokens at {money(terms.benchmarkInPerM)} /M input and{' '}
          {money(terms.benchmarkOutPerM)} /M output as a published-rate <em>benchmark</em>, and compares that with the plan price. It is accounting only —
          it never charges, never changes a plan and never edits a provider. The client never sees this page.
        </p>

        <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">The answer, from the rows that exist</p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
            {report.monthLabel}: <strong className="text-white">{money(month.valueUsd)}</strong> of benchmark usage value on a{' '}
            <strong className="text-white">{money(plan.priceUsd, 0)}</strong> plan
            {projection ? <> — at this pace the month lands near <strong className="text-white">{money(projection.projectedValueUsd)}</strong>.</> : null}{' '}
            {plan.surplusUsd > 0 ? `That is ${money(plan.surplusUsd)} of client surplus so far.` : `Still ${money(plan.shortfallUsd)} below the plan price so far.`}{' '}
            Every figure is measured from recorded tokens, so it reads whatever it truly is — nothing here assumes it reaches any particular number.
          </p>
        </div>

        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Wheels</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Wheel
              percent={utilisation}
              label="Plan utilisation"
              caption={`${money(month.valueUsd)} benchmark value against the ${money(plan.priceUsd)} plan`}
              color="#34d399"
            />
            <Wheel
              percent={projectedPct}
              label="Projected month"
              caption={projection ? `${money(projection.projectedValueUsd)} projected by month end at this pace` : 'No elapsed days yet'}
              color="#fbbf24"
            />
            <Wheel
              percent={elapsedPct}
              label="Month elapsed"
              caption={projection ? `Day ${projection.elapsedDays} of ${projection.daysInMonth}` : '—'}
              color="#60a5fa"
            />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Grid — {report.monthLabel}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <Tile label="Usage value (month)" value={money(month.valueUsd)} sub={`${terms.rateNote.split('.')[0]}`} />
            <Tile
              label="Plan price"
              value={money(plan.priceUsd, 0)}
              sub={`buys ${Math.round((plan.priceUsd / terms.benchmarkInPerM) * 1e6 / 1000).toLocaleString('en-US')}k input or ${Math.round((plan.priceUsd / terms.benchmarkOutPerM) * 1e6 / 1000).toLocaleString('en-US')}k output tokens at benchmark rates`}
            />
            <Tile
              label="Value per $1 paid"
              value={plan.priceUsd > 0 ? money(month.valueUsd / plan.priceUsd) : '—'}
              sub={`so far this month · ${plan.priceUsd > 0 ? money(projection ? projection.projectedValueUsd / plan.priceUsd : 0) : '—'} projected`}
              tone={plan.priceUsd > 0 && month.valueUsd > plan.priceUsd ? 'warn' : undefined}
            />
            <Tile
              label={plan.surplusUsd > 0 ? 'Client surplus' : 'Under plan by'}
              value={money(plan.surplusUsd > 0 ? plan.surplusUsd : plan.shortfallUsd)}
              sub={plan.surplusUsd > 0 ? 'value received above what was paid' : 'still covered by the plan this month'}
              tone={plan.surplusUsd > 0 ? 'warn' : 'good'}
            />
            <Tile label="Turns recorded" value={String(month.turns)} sub={`${month.activeDays} active day(s)`} />
            <Tile label="Input tokens" value={month.inTokens.toLocaleString('en-US')} sub="measured, from the coach usage file" />
            <Tile label="Output tokens" value={month.outTokens.toLocaleString('en-US')} sub="measured, from the coach usage file" />
            <Tile
              label="Projected month end"
              value={projection ? money(projection.projectedValueUsd) : '—'}
              sub={projection ? `${projection.projectedTurns} turn(s) at this pace` : 'no days elapsed'}
            />
            <Tile label="Verdict" value={plan.utilisationPct >= 100 ? 'Over plan' : 'Within plan'} sub={plan.verdict} tone={plan.utilisationPct >= 100 ? 'warn' : 'good'} />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Daily value this month</h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-3">
            {days.length === 0 ? (
              <p className="text-xs text-gray-500">No coach turns recorded this month, so there is no daily bar to draw.</p>
            ) : (
              <div className="flex h-28 items-end gap-1 overflow-hidden">
                {days.map((day) => {
                  const height = day.valueUsd > 0 ? Math.max(6, (day.valueUsd / maxDayValue) * 92) : 3
                  return (
                    <div
                      key={day.day}
                      title={`${day.day} · ${day.turns} turn(s) · ${money(day.valueUsd)}`}
                      style={{ height: `${height}%` }}
                      className={`min-w-[6px] flex-1 rounded-t ${day.valueUsd > 0 ? 'bg-gradient-to-t from-emerald-700 to-emerald-400' : 'bg-gray-800'}`}
                    />
                  )
                })}
              </div>
            )}
            <div className="mt-2 flex justify-between font-mono text-[10px] text-gray-600">
              <span>{days.length ? days[0].day : '—'}</span>
              <span>{days.length ? days[days.length - 1].day : '—'}</span>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Patterns learned from the recorded rows</h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.patterns.map((pattern) => (
                <li key={pattern.label} className="min-w-0 border-b border-gray-800/70 pb-2 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{pattern.label}</span>
                    <span className="font-mono text-sm font-bold text-emerald-300">{pattern.value}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-gray-500">{pattern.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Recorded history</h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/60">
            {report.ledger.length === 0 ? (
              <p className="p-3 text-xs text-gray-500">Today&apos;s snapshot was written to data/value-ledger.jsonl — history builds from here.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-black/30 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Turns</th>
                    <th className="px-3 py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ledger.slice(-14).reverse().map((line) => (
                    <tr key={line.day} className="border-t border-gray-800/70">
                      <td className="px-3 py-1.5 font-mono text-gray-300">{line.day}</td>
                      <td className="px-3 py-1.5 font-mono text-emerald-300">{money(Number(line.valueUsd) || 0)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-400">{money(Number(line.planUsd) || 0, 0)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-300">{line.turns}</td>
                      <td className="px-3 py-1.5 text-gray-400">{line.verdict}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <p className="text-[11px] leading-relaxed text-gray-500">
          All-time on this site: {report.allTime.turns} coach turn(s), {report.allTime.tokens.toLocaleString('en-US')} tokens, {money(report.allTime.valueUsd)} benchmark value.
          Source rows: {report.source.rows} in the coach usage file. This page is owner-only and rendered on the server — a client account receives a 404.
          Usage is recorded, never billed; nothing here charges an account or changes a plan, a model or a route.
        </p>
      </div>
    </div>
  )
}
