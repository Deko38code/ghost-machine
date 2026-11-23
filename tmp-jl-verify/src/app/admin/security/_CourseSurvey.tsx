'use client'

// Owner (2026-11-20): "add survey for her to do after course every other one — ask her what
// did she like and want to have changed". Shown once a whole batch of lessons is complete.
// Answers are appended to data/course-surveys.jsonl and nothing else happens.

import { useEffect, useState } from 'react'

export default function CourseSurvey({ tierId, tierTitle, level }: { tierId: string; tierTitle: string; level: number }) {
  const [liked, setLiked] = useState('')
  const [change, setChange] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [alreadySent, setAlreadySent] = useState<string | null>(null)
  // Collapsed by default so the course page keeps its room (owner, 2026-11-21:
  // "declutter junkalot admin suveys questionerire in to dropdown all tabs for room").
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/course-survey?tierId=' + encodeURIComponent(tierId), { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (alive && data?.latest?.at) setAlreadySent(String(data.latest.at).slice(0, 16).replace('T', ' ')) })
      .catch(() => { /* offline: still let her write */ })
    return () => { alive = false }
  }, [tierId])

  async function send() {
    if (!liked.trim() && !change.trim()) {
      setState('error')
      setError('Write at least one of the two answers, then send.')
      return
    }
    setState('saving')
    setError('')
    try {
      const res = await fetch('/api/course-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, tierTitle, level, liked, change }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not send that yet.')
      setState('saved')
      setAlreadySent(String(data.at || '').slice(0, 16).replace('T', ' '))
    } catch (e: any) {
      setState('error')
      setError(String(e?.message || e).slice(0, 160))
    }
  }

  const done = state === 'saved'

  return (
    <section className="mt-4 rounded-2xl border border-amber-700/50 bg-amber-950/20 p-3 sm:p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-[15px] ring-1 ring-amber-500/30">💬</span>
        <h3 className="text-sm font-bold text-amber-200">Course feedback — {tierTitle}</h3>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">after the course</span>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="course-feedback-body"
          className="ml-auto min-h-11 rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {open ? 'Hide ▴' : done ? 'Sent ✓' : 'Open ▾'}
        </button>
      </div>
      {!open && (
        <p className="text-[11px] leading-5 text-gray-500">
          ✍️ Two questions, no wrong answers. {done ? 'Thank you — saved.' : alreadySent ? 'Last one sent ' + alreadySent + '.' : 'Open it whenever you like.'}
        </p>
      )}
      {open && (
      <div id="course-feedback-body">
      <p className="mb-2 text-[11px] leading-5 text-gray-400">
        That batch is finished. Two questions, no wrong answers: what did you like, and what would you change? Your answers are saved so the course can be improved.
        {alreadySent ? ' Last one sent ' + alreadySent + '.' : ''}
      </p>
      {done ? (
        <p className="rounded-lg bg-green-950/40 px-3 py-2 text-[12px] font-semibold text-green-200 ring-1 ring-green-700/40">Thank you — saved.</p>
      ) : (
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-gray-300">
            💚 What did you like?
            <textarea
              value={liked}
              onChange={e => setLiked(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-[12px] text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="The part that helped most…"
            />
          </label>
          <label className="block text-[11px] font-semibold text-gray-300">
            🛠 What would you change?
            <textarea
              value={change}
              onChange={e => setChange(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-[12px] text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Anything confusing, missing or too long…"
            />
          </label>
          {state === 'error' && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={state === 'saving'}
            className="min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-amber-500 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {state === 'saving' ? 'Sending…' : '✉️ Send feedback'}
          </button>
        </div>
      )}
      </div>
      )}
    </section>
  )
}
