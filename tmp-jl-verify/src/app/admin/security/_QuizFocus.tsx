'use client'

// A questionnaire as its own full page, opened from the course in a pop-out window.
// Owner (2026-11-21): "pop out window full pages quizes" · "make pages neat organized not
// sloppy the questions etc nice icons avatars etc".
//
// It reads and writes the same browser store as the in-page version
// ('junkalot:course-extras'), and listens for 'storage' so an answer given in one
// window shows in the other. Nothing is sent anywhere; the coach still verifies badges.

import { useEffect, useRef, useState } from 'react'
import { CHECKPOINT_QUIZZES, QUIZ_PASS_PERCENT } from '@/lib/training-curriculum'
import { celebrate } from './_Celebration'
import CoachAvatar from './_CoachAvatar'

const STORE = 'junkalot:course-extras'
const CELEBRATED = 'junkalot:celebrated-quizzes'
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function readStore(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORE)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// The coach's mark: a small monogram avatar, used wherever Mr Ed speaks on a page.

function BackButton({ compact = false }: { compact?: boolean }) {
  // Opened by our own window.open → close it. Any other way in → back to the course.
  function back() {
    try {
      if (window.opener && !window.opener.closed) { window.close(); return }
    } catch { /* opener unreadable — fall through */ }
    window.location.href = '/admin/security'
  }
  return (
    <button
      type="button"
      onClick={back}
      className={"inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/70 font-semibold text-gray-300 hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold " +
        (compact ? 'min-h-11 px-2.5 py-1 text-[12px]' : 'min-h-11 px-3 py-1.5 text-[12px]')}
    >
      <span aria-hidden="true">←</span> Back to the course
    </button>
  )
}

export default function QuizFocus({ quizId, verifiedLevel }: { quizId: string; verifiedLevel: number }) {
  const quiz = CHECKPOINT_QUIZZES.find(q => q.id === quizId)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const celebratedRef = useRef<Set<string> | null>(null)

  useEffect(() => { setPicks(readStore()) }, [])

  // Answers written in the other window land here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORE) setPicks(readStore()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // The pop-out window carries the quiz's own name in the tab title.
  useEffect(() => {
    if (!quiz) return
    const before = document.title
    document.title = quiz.title + ' — Junkalot'
    return () => { document.title = before }
  }, [quiz])

  const unlocked = !!quiz && verifiedLevel >= quiz.afterLevel
  const keys = quiz ? quiz.questions.map((_, qi) => quiz.id + ':' + qi) : []
  const answeredCount = keys.filter(k => typeof picks[k] === 'number').length
  const correctCount = quiz ? quiz.questions.reduce((n, q, qi) => (picks[quiz.id + ':' + qi] === q.answer ? n + 1 : n), 0) : 0
  const total = quiz ? quiz.questions.length : 0
  const percent = total ? Math.round(correctCount / total * 100) : 0
  const allAnswered = !!quiz && answeredCount === total
  const passed = allAnswered && percent >= QUIZ_PASS_PERCENT
  const answeredPct = total ? Math.round(answeredCount / total * 100) : 0

  function pick(key: string, index: number) {
    setPicks(prev => {
      const next = { ...prev, [key]: index }
      try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* view-only memory */ }
      return next
    })
  }

  function clearQuiz() {
    setPicks(prev => {
      const next = { ...prev }
      for (const k of keys) delete next[k]
      try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* view-only memory */ }
      return next
    })
  }

  // Celebrate a pass once, the same way the in-page version does — shared record, so
  // a quiz already celebrated in either window is not celebrated twice.
  useEffect(() => {
    if (!quiz || !unlocked || !passed) return
    let saved: string[] = []
    try { saved = JSON.parse(localStorage.getItem(CELEBRATED) || '[]') } catch { /* nothing saved */ }
    if (celebratedRef.current === null) {
      celebratedRef.current = new Set<string>(Array.isArray(saved) ? saved : [])
      if (celebratedRef.current.size === 0) {
        // Everything already passed before this browser had a record is history, not a new win.
        celebratedRef.current.add(quiz.id)
        try { localStorage.setItem(CELEBRATED, JSON.stringify([...celebratedRef.current])) } catch { /* view-only memory */ }
        return
      }
    }
    if (celebratedRef.current.has(quiz.id)) return
    celebratedRef.current.add(quiz.id)
    try { localStorage.setItem(CELEBRATED, JSON.stringify([...celebratedRef.current])) } catch { /* view-only memory */ }
    celebrate('quiz', quiz.title + ' — passed')
  }, [picks, quiz, unlocked, passed])

  return (
    <div className="min-h-screen bg-brand-dark px-5 pb-10 pt-5 text-gray-100 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">

        {/* ── Top bar ── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <BackButton />
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-gray-800 bg-gray-950/70 px-2.5 py-1 text-[10px] font-semibold text-gray-500">
            <span aria-hidden="true">🔒</span> Answers stay in this browser
          </span>
        </div>

        {!quiz ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
            <h1 className="text-lg font-bold text-brand-gold">That questionnaire was not found</h1>
            <p className="mt-2 text-[12px] leading-5 text-gray-400">The link names a questionnaire that is not in this course version. Open the course and pick one from the list.</p>
          </section>
        ) : !unlocked ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
            <div className="flex items-center gap-3">
              <CoachAvatar />
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Mr Ed · checkpoint</p>
                <h1 className="truncate text-lg font-bold text-brand-gold">{quiz.title}</h1>
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-[12px] leading-5 text-amber-200">
              🔒 This one opens after level {quiz.afterLevel}. You are at level {verifiedLevel} — finish the lessons before it and it unlocks here and on the course page.
            </p>
          </section>
        ) : (
          <>
            {/* ── Header card ── */}
            <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900/80 to-gray-950/80">
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-800/70 px-4 py-3 sm:px-5">
                <CoachAvatar />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Mr Ed · checkpoint</p>
                  <h1 className="text-base font-bold leading-tight text-brand-gold sm:text-lg">{quiz.title}</h1>
                </div>
                <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold text-green-300 ring-1 ring-green-500/30">
                  after level {quiz.afterLevel} · open
                </span>
              </div>

              <div className="px-4 py-3 sm:px-5">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
                  <span className="font-semibold text-gray-300">{answeredCount} of {total} answered</span>
                  <span className={passed ? 'font-bold text-green-300' : 'text-gray-500'}>
                    {correctCount} correct · {percent}%{passed ? ' · PASS' : ` · pass mark ${QUIZ_PASS_PERCENT}%`}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-800"
                  role="progressbar"
                  aria-label="Questions answered"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={answeredPct}
                >
                  <div className="h-full rounded-full bg-brand-gold transition-all duration-500" style={{ width: answeredPct + '%' }} />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-gray-500">Pick one answer per question. Each one tells you why it is right or not — nothing is sent anywhere.</p>
              </div>
            </section>

            {/* ── Questions ── */}
            <div className="mt-3 space-y-3">
              {quiz.questions.map((q, qi) => {
                const key = quiz.id + ':' + qi
                const chosen = picks[key]
                const answered = typeof chosen === 'number'
                const right = answered && chosen === q.answer
                return (
                  <section
                    key={qi}
                    className={"rounded-2xl border bg-gray-950/60 p-3 transition-colors sm:p-4 " +
                      (!answered ? 'border-gray-800' : right ? 'border-green-800/60' : 'border-amber-800/60')}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ring-1 " +
                          (!answered
                            ? 'bg-gray-900 text-gray-400 ring-gray-700'
                            : right
                              ? 'bg-green-500/15 text-green-300 ring-green-500/40'
                              : 'bg-amber-500/15 text-amber-300 ring-amber-500/40')}
                      >
                        {answered ? (right ? '✓' : '✕') : qi + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Question {qi + 1} of {total}</span>
                        </div>
                        <p className="mb-3 text-[13px] font-semibold leading-6 text-gray-100">{q.q}</p>

                        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={'Question ' + (qi + 1) + ': ' + q.q}>
                          {q.options.map((opt, oi) => {
                            const isChosen = chosen === oi
                            const isRight = q.answer === oi
                            return (
                              <button
                                key={oi}
                                type="button"
                                onClick={() => pick(key, oi)}
                                aria-pressed={isChosen}
                                className={"flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12px] leading-5 ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold " +
                                  (isChosen
                                    ? (isRight ? 'bg-green-500/15 text-green-100 ring-green-500/45' : 'bg-amber-500/15 text-amber-100 ring-amber-500/45')
                                    : 'bg-gray-900/70 text-gray-200 ring-gray-800 hover:bg-gray-900 hover:ring-gray-600')}
                              >
                                <span
                                  aria-hidden="true"
                                  className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold ring-1 " +
                                    (isChosen
                                      ? (isRight ? 'bg-green-500 text-black ring-green-400' : 'bg-amber-500 text-black ring-amber-400')
                                      : 'bg-gray-800 text-gray-400 ring-gray-700')}
                                >
                                  {isChosen ? (isRight ? '✓' : '✕') : (LETTERS[oi] || oi + 1)}
                                </span>
                                <span className="min-w-0 flex-1">{opt}</span>
                              </button>
                            )
                          })}
                        </div>

                        {answered && (
                          <p role="status" aria-live="polite" className={"mt-2.5 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] leading-5 " +
                            (right
                              ? 'border-green-800/50 bg-green-950/25 text-green-200'
                              : 'border-amber-800/50 bg-amber-950/25 text-amber-200')}>
                            <span aria-hidden="true" className="mt-0.5 shrink-0">{right ? '✅' : '💡'}</span>
                            <span className="min-w-0">{right ? 'Correct. ' : 'Not quite. '}{q.why}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            {/* ── Footer actions ── */}
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3">
              <p className={"text-[12px] " + (passed ? 'font-bold text-green-300' : allAnswered ? 'text-amber-300' : 'text-gray-400')}>
                {passed
                  ? '🎉 Passed — ' + correctCount + '/' + total + ' correct (' + percent + '%)'
                  : allAnswered
                    ? 'Needs ' + QUIZ_PASS_PERCENT + '% to pass — you are at ' + percent + '%. Try again whenever you like.'
                    : 'Answer all ' + total + ' questions to see your result.'}
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {answeredCount > 0 && (
                  <button
                    type="button"
                    onClick={clearQuiz}
                    className="min-h-11 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-[12px] font-semibold text-gray-300 hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                  >
                    ↻ Try again
                  </button>
                )}
                <BackButton compact />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
