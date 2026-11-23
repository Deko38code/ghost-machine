'use client'

// Guided tour for the admin dashboard.
// Owner (2026-11-21): "add nav tour when we add feat for her to see · make them go houver then
// glow show etc" and "when she starts Mr Ed when we add buttons always".
//
// The tour is a spotlight over the real page: it never moves or restyles the feature itself,
// it draws a cut-out around the element marked data-tour="<key>", pulses a gold glow on it,
// and shows a small card beside it with Next / Back / Skip. Each new wave of features bumps
// the version in the storage key, so she sees it once per wave — not on every visit.

import { useCallback, useEffect, useRef, useState } from 'react'

export type TourStep = {
  /** value of the data-tour attribute on the element to spotlight */
  target: string
  title: string
  body: string
}

type Rect = { top: number; left: number; width: number; height: number }

function rectOf(key: string): Rect | null {
  try {
    const el = document.querySelector<HTMLElement>('[data-tour="' + key + '"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  } catch {
    return null
  }
}

export default function Tour({
  steps,
  open,
  onClose,
  storageKey,
}: {
  steps: TourStep[]
  open: boolean
  onClose: () => void
  storageKey: string
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const step = open ? steps[index] : null

  const measure = useCallback(() => {
    if (!step) { setRect(null); return }
    setRect(rectOf(step.target))
  }, [step])

  // Bring the target into view, then measure it — and keep measuring while the page moves.
  // The scroll is instant on purpose: a smooth scroll leaves the spotlight chasing a
  // moving target for half a second, which reads as a glitch in a guided tour.
  useEffect(() => {
    if (!open || !step) return
    try {
      const el = document.querySelector<HTMLElement>('[data-tour="' + step.target + '"]')
      if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' })
    } catch { /* older browser: measured where it sits */ }
    measure()
    const t = window.setTimeout(measure, 120)
    return () => window.clearTimeout(t)
  }, [open, step, measure])

  useEffect(() => {
    if (!open) return
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, measure])

  // Esc leaves the tour; the page is never trapped behind it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { finish(); return }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { next(); return }
      if (e.key === 'ArrowLeft') { back(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, steps.length])

  function remember() {
    try { localStorage.setItem(storageKey, '1') } catch { /* private window: shows again next visit */ }
  }

  function finish() {
    remember()
    setIndex(0)
    onClose()
  }

  function next() {
    if (index >= steps.length - 1) { finish(); return }
    setIndex(i => i + 1)
  }

  function back() {
    setIndex(i => Math.max(0, i - 1))
  }

  if (!open || !step) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const pad = 8
  const box = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : { top: vh / 2 - 40, left: vw / 2 - 120, width: 240, height: 80 }

  // Card placement: below the spotlight when there is room, otherwise above it.
  // Owner's §18 rule: a panel keeps a visible gutter — 20px under 480px wide,
  // 16px above it — so the card is clamped inside the viewport on every screen.
  const GUT = vw < 480 ? 20 : 16
  const CARD_W = Math.max(240, Math.min(360, vw - GUT * 2))
  const below = box.top + box.height + 190 < vh
  const cardTop = below ? box.top + box.height + 14 : Math.max(GUT, box.top - 14 - 172)
  const cardLeft = Math.max(GUT, Math.min(box.left + box.width / 2 - CARD_W / 2, vw - CARD_W - GUT))

  return (
    <div className="fixed inset-0 z-[2400]" role="dialog" aria-modal="true" aria-label="What's new tour">
      {/* The dim is the spotlight's own shadow, so the hole is always exact. */}
      <div className="pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-xl border-2 border-brand-gold transition-all duration-200"
        style={{
          top: box.top, left: box.left, width: box.width, height: box.height,
          boxShadow: '0 0 0 9999px rgba(3,3,6,.72), 0 0 26px rgba(201,168,64,.6), inset 0 0 18px rgba(201,168,64,.25)',
          animation: 'jl-tour-pulse 1.8s ease-in-out infinite',
        }}
      />
      <div
        ref={cardRef}
        className="absolute rounded-2xl border border-brand-gold/40 bg-gray-950/95 p-4 shadow-2xl backdrop-blur"
        style={{ top: cardTop, left: cardLeft, width: CARD_W, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-[13px] ring-1 ring-brand-gold/30">🧭</span>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">What&apos;s new · {index + 1} of {steps.length}</p>
          <button
            type="button"
            onClick={finish}
            aria-label="Close the tour"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
          >✕</button>
        </div>
        <h3 className="mt-2 text-sm font-bold text-brand-gold">{step.title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-gray-300">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={"h-1.5 w-1.5 rounded-full " + (i === index ? 'bg-brand-gold' : 'bg-gray-700')} />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={back} className="min-h-11 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-[12px] font-semibold text-gray-300 hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Back</button>
            )}
            <button type="button" onClick={finish} className="min-h-11 rounded-lg px-2 text-[12px] font-semibold text-gray-500 hover:text-gray-300">Skip</button>
            <button type="button" onClick={next} className="min-h-11 rounded-lg bg-brand-gold px-3.5 py-1.5 text-[12px] font-bold text-black hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
              {index >= steps.length - 1 ? 'Got it' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes jl-tour-pulse{0%,100%{box-shadow:0 0 0 9999px rgba(3,3,6,.72),0 0 22px rgba(201,168,64,.5),inset 0 0 14px rgba(201,168,64,.18)}50%{box-shadow:0 0 0 9999px rgba(3,3,6,.72),0 0 34px rgba(201,168,64,.85),inset 0 0 22px rgba(201,168,64,.32)}}
@media (prefers-reduced-motion: reduce){@keyframes jl-tour-pulse{0%,100%{box-shadow:0 0 0 9999px rgba(3,3,6,.72),0 0 24px rgba(201,168,64,.6)}}}`}</style>
    </div>
  )
}
