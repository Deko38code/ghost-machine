'use client'

// Reading material that never gates the course, plus the questionnaires that open once the
// lessons they cover have been done. Everything is scored on this page: nothing is sent
// anywhere, and no pass is recorded — only the coach verifies a badge.
//
// Owner (2026-11-20): "can add more lessons about dns servers just to learn and maybe a few
// questionaires etc" · "after some good lessons".
//
// Owner (2026-11-21): "declutter junkalot admin suveys questionerire in to dropdown all tabs
// for room and pop out window full pages quizes" · "make pages neat organized not sloppy the
// questions etc nice icons avatars" — one dropdown instead of three stacked panels, the
// questionnaires listed as tidy cards, and each one can open as its own full window.

import { useEffect, useRef, useState } from 'react'
import { celebrate } from './_Celebration'
import CoachAvatar from './_CoachAvatar'
import { DNS_LESSONS, BUSINESS_LESSONS, CHECKPOINT_QUIZZES, QUIZ_PASS_PERCENT } from '@/lib/training-curriculum'

type Panel = 'questionnaires' | 'dns' | 'biz'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function readStore(): Record<string, number> {
  try {
    const raw = localStorage.getItem('junkalot:course-extras')
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// A questionnaire gets its own window: the whole page, at a readable size, centred.
// If the browser refuses the pop-up, the same view opens in this tab instead.
function openQuizWindow(quizId: string) {
  const url = '/admin/security?quiz=' + encodeURIComponent(quizId)
  try {
    const w = 980, h = 860
    const left = Math.max(0, Math.round((window.screen.width - w) / 2))
    const top = Math.max(0, Math.round((window.screen.height - h) / 2))
    const win = window.open(url, 'junkalot-quiz-' + quizId, `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
    if (win) { win.focus(); return }
  } catch { /* fall through to the same tab */ }
  window.location.href = url
}

export default function CourseExtras({ verifiedLevel }: { verifiedLevel: number }) {
  const [section, setSection] = useState<Panel>('questionnaires')
  const [openDns, setOpenDns] = useState<string | null>(null)
  const [openBiz, setOpenBiz] = useState<string | null>(null)
  const [inlineQuiz, setInlineQuiz] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, number>>({})

  useEffect(() => { setPicks(readStore()) }, [])

  // An answer given in a quiz's own window is the same answer here: keep them in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'junkalot:course-extras') setPicks(readStore()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function pick(key: string, index: number) {
    setPicks(prev => {
      const next = { ...prev, [key]: index }
      try { localStorage.setItem('junkalot:course-extras', JSON.stringify(next)) } catch { /* view-only memory */ }
      return next
    })
  }

  function clearQuiz(keys: string[]) {
    setPicks(prev => {
      const next = { ...prev }
      for (const k of keys) delete next[k]
      try { localStorage.setItem('junkalot:course-extras', JSON.stringify(next)) } catch { /* view-only memory */ }
      return next
    })
  }

  // ── Quiz celebration (2026-11-20) ──────────────────────────────────────────
  // Fires once, the first time a questionnaire reaches the real pass mark. Anything already
  // passed before this browser had a record is treated as history, not a new win.
  const celebratedRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (Object.keys(picks).length === 0) return // wait for the saved answers to load
    const passed = CHECKPOINT_QUIZZES.filter(quiz => {
      const keys = quiz.questions.map((_, qi) => quiz.id + ':' + qi)
      if (keys.some(k => typeof picks[k] !== 'number')) return false
      const correct = quiz.questions.reduce((n, q, qi) => (picks[quiz.id + ':' + qi] === q.answer ? n + 1 : n), 0)
      return Math.round(correct / quiz.questions.length * 100) >= QUIZ_PASS_PERCENT
    })
    if (celebratedRef.current === null) {
      let saved: string[] = []
      try { saved = JSON.parse(localStorage.getItem('junkalot:celebrated-quizzes') || '[]') } catch { /* nothing saved */ }
      const set = new Set<string>(Array.isArray(saved) ? saved : [])
      if (set.size === 0) for (const quiz of passed) set.add(quiz.id) // history, not a new win
      celebratedRef.current = set
      try { localStorage.setItem('junkalot:celebrated-quizzes', JSON.stringify([...set])) } catch { /* view-only memory */ }
      return
    }
    for (const quiz of passed) {
      if (celebratedRef.current.has(quiz.id)) continue
      celebratedRef.current.add(quiz.id)
      try { localStorage.setItem('junkalot:celebrated-quizzes', JSON.stringify([...celebratedRef.current])) } catch { /* view-only memory */ }
      celebrate('quiz', quiz.title + ' — passed')
    }
  }, [picks])

  const unlockedQuizzes = CHECKPOINT_QUIZZES.filter(q => verifiedLevel >= q.afterLevel).length

  return (
    <div className="space-y-4">
      {/* ── One dropdown instead of three stacked panels ── */}
      <div className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-[15px] ring-1 ring-brand-gold/25">🎓</span>
          <label htmlFor="course-extras-section" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Course extras</label>
          <select
            id="course-extras-section"
            value={section}
            onChange={e => setSection(e.target.value as Panel)}
            className="min-h-11 w-full max-w-xs rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-[12px] font-medium text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:min-h-0"
          >
            <option value="questionnaires">📝 Questionnaires ({unlockedQuizzes}/{CHECKPOINT_QUIZZES.length} open)</option>
            <option value="dns">🌐 DNS &amp; the internet — reading</option>
            <option value="biz">💼 Million-dollar company — business adviser</option>
          </select>
          <span className="hidden text-[11px] text-gray-600 sm:block">One at a time — pick from the list</span>
        </div>
      </div>

      {/* ── DNS, just to learn ── */}
      {section === 'dns' && (
      <div className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-3 sm:p-4">
        <div className="mb-3 flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-[15px] ring-1 ring-blue-500/25">🌐</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-brand-gold">DNS &amp; the internet — reading, not a test</h3>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300 ring-1 ring-blue-500/30">always open</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-5 text-gray-500">These never block a badge. Read them whenever you like; each one ends with a single question you can answer to check yourself.</p>
          </div>
        </div>
        <div className="space-y-2">
          {DNS_LESSONS.map(lesson => {
            const open = openDns === lesson.id
            const key = 'dns:' + lesson.id
            const chosen = picks[key]
            const answered = typeof chosen === 'number'
            return (
              <div key={lesson.id} className="overflow-hidden rounded-xl border border-gray-800/70 bg-black/20">
                <button
                  type="button"
                  onClick={() => setOpenDns(open ? null : lesson.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-gray-200 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                >
                  <span className="min-w-0">{lesson.title}</span>
                  <span aria-hidden="true" className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-800 text-[11px] text-gray-400 ring-1 ring-gray-700 transition " + (open ? 'rotate-180' : '')}>{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-gray-800/60 px-3 pb-3 pt-2.5">
                    {lesson.body.map((para, i) => (
                      <p key={i} className="text-[11px] leading-5 text-gray-400">{para}</p>
                    ))}
                    <div className="mt-2 rounded-xl border border-gray-800/70 bg-gray-900/60 p-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold text-gray-300">🔎 Check yourself: {lesson.check.q}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lesson.check.options.map((opt, i) => {
                          const isChosen = chosen === i
                          const isRight = lesson.check.answer === i
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => pick(key, i)}
                              aria-pressed={isChosen}
                              className={"min-h-11 rounded-full px-2.5 py-1 text-[11px] ring-1 transition " +
                                (isChosen
                                  ? (isRight ? 'bg-green-500/15 text-green-200 ring-green-500/40' : 'bg-amber-500/15 text-amber-200 ring-amber-500/40')
                                  : 'bg-gray-800/60 text-gray-300 ring-gray-700 hover:ring-gray-500')}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                      {answered && (
                        <p className={"mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-5 " +
                          (chosen === lesson.check.answer
                            ? 'border-green-800/50 bg-green-950/25 text-green-200'
                            : 'border-amber-800/50 bg-amber-950/25 text-amber-200')}>
                          <span aria-hidden="true" className="mt-0.5 shrink-0">{chosen === lesson.check.answer ? '✅' : '💡'}</span>
                          <span className="min-w-0">{chosen === lesson.check.answer ? 'Correct. ' : 'Not quite. '}{lesson.check.why}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* ── Business adviser, million-dollar company ── */}
      {section === 'biz' && (
      <div className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-3 sm:p-4">
        <div className="mb-3 flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-[15px] ring-1 ring-emerald-500/25">💼</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-brand-gold">Million-dollar company — business adviser</h3>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">always open</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-5 text-gray-500">Mr Ed teaches these alongside the technical course. Each one is arithmetic you can check on paper, never a promise — a million a year is a system to build, not a slogan. Each ends with one question to check yourself.</p>
          </div>
        </div>
        <div className="space-y-2">
          {BUSINESS_LESSONS.map(lesson => {
            const open = openBiz === lesson.id
            const key = 'biz:' + lesson.id
            const chosen = picks[key]
            return (
              <div key={lesson.id} className="overflow-hidden rounded-xl border border-gray-800/70 bg-black/20">
                <button
                  type="button"
                  onClick={() => setOpenBiz(open ? null : lesson.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-semibold text-gray-200 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                >
                  <span className="min-w-0">{lesson.title}</span>
                  <span aria-hidden="true" className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-800 text-[11px] text-gray-400 ring-1 ring-gray-700 transition " + (open ? 'rotate-180' : '')}>{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-gray-800/60 px-3 pb-3 pt-2.5">
                    {lesson.body.map((para, i) => (
                      <p key={i} className="text-[11px] leading-5 text-gray-400">{para}</p>
                    ))}
                    <div className="mt-2 rounded-xl border border-gray-800/70 bg-gray-900/60 p-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold text-gray-300">🔎 Check yourself: {lesson.check.q}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lesson.check.options.map((opt, i) => {
                          const isChosen = chosen === i
                          const isRight = lesson.check.answer === i
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => pick(key, i)}
                              aria-pressed={isChosen}
                              className={"min-h-11 rounded-full px-2.5 py-1 text-[11px] ring-1 transition " +
                                (isChosen
                                  ? (isRight ? 'bg-green-500/15 text-green-200 ring-green-500/40' : 'bg-amber-500/15 text-amber-200 ring-amber-500/40')
                                  : 'bg-gray-800/60 text-gray-300 ring-gray-700 hover:ring-gray-500')}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                      {typeof chosen === 'number' && (
                        <p className={"mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-5 " +
                          (chosen === lesson.check.answer
                            ? 'border-green-800/50 bg-green-950/25 text-green-200'
                            : 'border-amber-800/50 bg-amber-950/25 text-amber-200')}>
                          <span aria-hidden="true" className="mt-0.5 shrink-0">{chosen === lesson.check.answer ? '✅' : '💡'}</span>
                          <span className="min-w-0">{chosen === lesson.check.answer ? 'Correct. ' : 'Not quite. '}{lesson.check.why}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* ── Questionnaires, after some good lessons ── */}
      {section === 'questionnaires' && (
      <div className="rounded-2xl border border-gray-800/60 bg-gray-950/40 p-3 sm:p-4">
        <div className="mb-3 flex items-start gap-3">
          <CoachAvatar size={38} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-brand-gold">Questionnaires</h3>
            <p className="mt-0.5 text-[11px] leading-5 text-gray-500">Each one opens after the lessons it covers. You need {QUIZ_PASS_PERCENT}% or higher to pass. Your answers stay in this browser; a questionnaire never awards a badge on its own — the coach verifies badges.</p>
          </div>
        </div>

        <div className="space-y-2">
          {CHECKPOINT_QUIZZES.map(quiz => {
            const unlocked = verifiedLevel >= quiz.afterLevel
            const keys = quiz.questions.map((_, qi) => quiz.id + ':' + qi)
            const answeredCount = keys.filter(k => typeof picks[k] === 'number').length
            const correctCount = quiz.questions.reduce((n, q, qi) => (picks[quiz.id + ':' + qi] === q.answer ? n + 1 : n), 0)
            const percent = Math.round(correctCount / quiz.questions.length * 100)
            const passed = answeredCount === quiz.questions.length && percent >= QUIZ_PASS_PERCENT
            const answeredPct = Math.round(answeredCount / quiz.questions.length * 100)
            const expanded = inlineQuiz === quiz.id && unlocked
            return (
              <div key={quiz.id} className={"overflow-hidden rounded-xl border bg-black/20 " + (expanded ? 'border-gray-700' : 'border-gray-800/70')}>
                {/* ── card row: icon · title/progress · actions (actions drop to their own
                       row on phones so the title never gets squeezed) ── */}
                <div className="grid grid-cols-[2.25rem_1fr] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[2.25rem_1fr_auto]">
                  <span
                    aria-hidden="true"
                    className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] ring-1 " +
                      (passed ? 'bg-green-500/15 ring-green-500/35' : unlocked ? 'bg-brand-gold/10 ring-brand-gold/25' : 'bg-gray-900 ring-gray-800 opacity-60')}
                  >
                    {passed ? '🏅' : unlocked ? '📝' : '🔒'}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 text-[12px] font-semibold text-gray-200">{quiz.title}</span>
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 " +
                        (passed
                          ? 'bg-green-500/10 text-green-300 ring-green-500/30'
                          : unlocked
                            ? 'bg-gray-800 text-gray-300 ring-gray-700'
                            : 'bg-gray-900 text-gray-500 ring-gray-800')}>
                        {passed ? 'passed' : unlocked ? 'open · after level ' + quiz.afterLevel : 'unlocks after level ' + quiz.afterLevel}
                      </span>
                    </div>
                    {unlocked && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-gray-800" role="progressbar" aria-label={quiz.title + ' answered'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={answeredPct}>
                          <div className={"h-full rounded-full transition-all duration-500 " + (passed ? 'bg-green-500' : 'bg-brand-gold')} style={{ width: answeredPct + '%' }} />
                        </div>
                        <span className={"shrink-0 text-[10px] " + (passed ? 'font-bold text-green-300' : 'text-gray-500')}>
                          {answeredCount}/{quiz.questions.length}{answeredCount > 0 ? ' · ' + percent + '%' : ''}
                        </span>
                      </div>
                    )}
                    {!unlocked && (
                      <p className="mt-1 text-[11px] leading-5 text-gray-600">Finish the lessons up to level {quiz.afterLevel} first — it opens after them.</p>
                    )}
                  </div>

                  {unlocked && (
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => openQuizWindow(quiz.id)}
                        className="min-h-11 flex-1 rounded-lg bg-brand-gold px-3 py-1.5 text-[11px] font-bold text-black hover:bg-brand-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:flex-none"
                      >
                        Open full page ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineQuiz(expanded ? null : quiz.id)}
                        aria-expanded={expanded}
                        className="min-h-11 flex-1 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:flex-none"
                      >
                        {expanded ? 'Hide' : 'Answer here'}
                      </button>
                    </div>
                  )}
                </div>

                {/* ── inline answering (collapsed unless asked for) ── */}
                {expanded && (
                  <div className="space-y-3 border-t border-gray-800/60 px-3 pb-3 pt-3">
                    {quiz.questions.map((q, qi) => {
                      const key = quiz.id + ':' + qi
                      const chosen = picks[key]
                      const answered = typeof chosen === 'number'
                      const right = answered && chosen === q.answer
                      return (
                        <div key={qi} className={"rounded-xl border p-2.5 " + (!answered ? 'border-gray-800/70 bg-gray-950/40' : right ? 'border-green-800/50 bg-green-950/10' : 'border-amber-800/50 bg-amber-950/10')}>
                          <div className="flex items-start gap-2.5">
                            <span
                              aria-hidden="true"
                              className={"mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ring-1 " +
                                (!answered ? 'bg-gray-900 text-gray-400 ring-gray-700' : right ? 'bg-green-500/15 text-green-300 ring-green-500/40' : 'bg-amber-500/15 text-amber-300 ring-amber-500/40')}
                            >
                              {answered ? (right ? '✓' : '✕') : qi + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="mb-2 text-[11px] font-semibold leading-5 text-gray-200">{q.q}</p>
                              <div className="grid gap-1.5 sm:grid-cols-2" role="group" aria-label={'Question ' + (qi + 1) + ': ' + q.q}>
                                {q.options.map((opt, oi) => {
                                  const isChosen = chosen === oi
                                  const isRight = q.answer === oi
                                  return (
                                    <button
                                      key={oi}
                                      type="button"
                                      onClick={() => pick(key, oi)}
                                      aria-pressed={isChosen}
                                      className={"flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] leading-5 ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold " +
                                        (isChosen
                                          ? (isRight ? 'bg-green-500/15 text-green-100 ring-green-500/45' : 'bg-amber-500/15 text-amber-100 ring-amber-500/45')
                                          : 'bg-gray-900/70 text-gray-300 ring-gray-800 hover:ring-gray-600')}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={"flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ring-1 " +
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
                                <p role="status" aria-live="polite" className={"mt-1.5 flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-5 " +
                                  (right ? 'border-green-800/50 bg-green-950/25 text-green-200' : 'border-amber-800/50 bg-amber-950/25 text-amber-200')}>
                                  <span aria-hidden="true" className="mt-0.5 shrink-0">{right ? '✅' : '💡'}</span>
                                  <span className="min-w-0">{right ? 'Correct. ' : 'Not quite. '}{q.why}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={"text-[11px] " + (passed ? 'font-semibold text-green-300' : 'text-gray-500')}>
                        Answered {answeredCount}/{quiz.questions.length} · correct {correctCount}/{quiz.questions.length} · {percent}%
                        {answeredCount === quiz.questions.length && (passed ? ' · PASS' : ` · needs ${QUIZ_PASS_PERCENT}% to pass`)}
                      </p>
                      {answeredCount > 0 && (
                        <button
                          type="button"
                          onClick={() => clearQuiz(keys)}
                          className="ml-auto min-h-11 rounded-full bg-gray-800/70 px-2.5 py-1 text-[11px] text-gray-300 ring-1 ring-gray-700 hover:ring-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                        >
                          ↻ Try again
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}
