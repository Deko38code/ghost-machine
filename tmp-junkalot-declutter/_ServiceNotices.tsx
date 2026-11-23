'use client'

// Owner (2026-11-20): "always inform client of updates · outages longer then 20 min without
// restorations get added to messages emails noti". This is the visible side of that rule.
//
// Owner (2026-11-21): "add better tiltle to notice dropdown" — the block was a flat section
// with a long sentence for a heading. It is now a titled dropdown: the header says plainly
// what it is and how many are on record, the newest notice is summarised on the closed bar
// so nothing important hides behind the toggle, and an outage opens it by itself.

import { useEffect, useState } from 'react'

type Notice = {
  at: string
  kind: 'update' | 'outage' | 'restored' | 'cert' | 'note'
  title: string
  detail: string
  minutes?: number
  visibleToClient: boolean
}

const KIND_STYLE: Record<string, string> = {
  update: 'bg-blue-500/10 text-blue-200 ring-blue-500/30',
  outage: 'bg-red-500/10 text-red-200 ring-red-500/30',
  restored: 'bg-green-500/10 text-green-200 ring-green-500/30',
  cert: 'bg-amber-500/10 text-amber-200 ring-amber-500/30',
  note: 'bg-gray-700/30 text-gray-300 ring-gray-600/40',
}

export default function ServiceNotices() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [rule, setRule] = useState('')
  const [open, setOpen] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/service-notices', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!alive || !data) return
        setNotices(Array.isArray(data.notices) ? data.notices : [])
        setRule(String(data.rule || ''))
      })
      .catch(() => { if (alive) setNotices([]) })
    return () => { alive = false }
  }, [])

  // If the newest thing on record is an outage that has not been restored, the dropdown
  // opens itself once — an active outage must never sit behind a collapsed control.
  // Decided from the real list, never a guess.
  useEffect(() => {
    if (autoOpened || !notices || notices.length === 0) return
    const newest = notices[0]
    if (newest && newest.kind === 'outage') setOpen(true)
    setAutoOpened(true)
  }, [notices, autoOpened])

  const counts = (notices || []).reduce<Record<string, number>>((acc, n) => {
    acc[n.kind] = (acc[n.kind] || 0) + 1
    return acc
  }, {})
  const summary = (notices || []).length
    ? ['outage', 'restored', 'update', 'cert', 'note']
        .filter(k => counts[k])
        .map(k => counts[k] + ' ' + (k === 'outage' ? (counts[k] === 1 ? 'outage' : 'outages') : k + (counts[k] === 1 ? '' : 's')))
        .join(' · ')
    : ''
  const newest = notices && notices.length ? notices[0] : null

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-950/50" data-tour="notices">
      <h2 className="sr-only">Service notices</h2>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="service-notices-body"
        className="flex min-h-[56px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
      >
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-[15px] ring-1 ring-brand-gold/25">🛎️</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-gray-100">Service notices</span>
          <span className="mt-0.5 block truncate text-[11px] text-gray-500">
            {notices === null
              ? 'Loading what the client is told…'
              : newest
                ? 'Newest · ' + newest.title
                : 'No notices yet — every update and long outage will appear here'}
          </span>
        </span>
        {notices && notices.length > 0 && (
          <span className="hidden shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-300 ring-1 ring-gray-700 sm:inline">{summary}</span>
        )}
        <span aria-hidden="true" className={"shrink-0 text-gray-500 transition-transform " + (open ? 'rotate-180' : '')}>▾</span>
      </button>

      <div id="service-notices-body" hidden={!open} className="space-y-2 border-t border-gray-800/70 px-3 pb-3 pt-2.5">
        <p className="text-[11px] leading-5 text-gray-500">{rule || 'Every update is announced. An outage is announced once it passes 20 minutes without restoration, and again when the site is back.'}</p>
        {notices === null ? (
          <p className="text-[11px] text-gray-600">Loading…</p>
        ) : notices.length === 0 ? (
          <p className="text-[11px] text-gray-600">No notices yet. The first update or long outage will appear here.</p>
        ) : (
          <ul className="space-y-1.5">
            {notices.map((n, i) => (
              <li key={n.at + ':' + i} className="rounded-lg border border-gray-800/70 bg-black/20 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 " + (KIND_STYLE[n.kind] || KIND_STYLE.note)}>{n.kind}</span>
                  <span className="text-[12px] font-semibold text-gray-200">{n.title}</span>
                  <span className="ml-auto text-[10px] text-gray-500">{n.at.slice(0, 16).replace('T', ' ')} UTC</span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">{n.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
