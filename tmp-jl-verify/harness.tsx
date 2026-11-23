// Verification harness: renders the REAL course components with the REAL production CSS,
// measures every box in a real browser, and writes the numbers into #report.
// Nothing here ships — it is a local check on the built pages.
import { createRoot } from 'react-dom/client'
import CourseExtras from './src/app/admin/security/_CourseExtras'
import CourseSurvey from './src/app/admin/security/_CourseSurvey'
import QuizFocus from './src/app/admin/security/_QuizFocus'

const params = new URLSearchParams(location.search)
const view = params.get('view') || 'extras'
const section = params.get('section') || ''
const only = params.get('only') || ''

// Seed the browser store so the screenshots show answered, half-answered and passing states.
try {
  localStorage.setItem('junkalot:course-extras', JSON.stringify({
    'quiz-5:0': 0, 'quiz-5:1': 0, 'quiz-5:2': 1,
    'quiz-10:0': 0,
    'dns:dns-basics:0': 0,
    'biz:biz-1:0': 1,
  }))
} catch { /* private window */ }

function App() {
  if (only === 'survey') {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-6"><CourseSurvey tierId="foundations" tierTitle="Foundations" level={5} /></div>
      </div>
    )
  }
  if (only === 'extras') {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-6"><CourseExtras verifiedLevel={16} /></div>
      </div>
    )
  }
  if (view === 'quiz') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <QuizFocus quizId={params.get('quiz') || 'quiz-5'} verifiedLevel={16} />
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Locked state</p>
          <QuizFocus quizId="quiz-20" verifiedLevel={16} />
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* The real dashboard container: max-w-7xl mx-auto px-6 py-6 (page.tsx) */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-3">
          <p className="text-sm font-bold text-brand-gold">Course panel (as it sits on her dashboard)</p>
        </div>
        <div className="mt-4">
          <CourseExtras verifiedLevel={16} />
          <CourseSurvey tierId="foundations" tierTitle="Foundations" level={5} />
        </div>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)

// ── measure ────────────────────────────────────────────────────────────────────
function measure() {
  const vw = window.innerWidth
  const de = document.documentElement
  const items: any[] = []
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('#root button, #root select, #root section, #root [class*="rounded-2xl"], #root [class*="rounded-xl"]'))
  let worst = { sel: '', r: 0 }
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const right = r.right
    const over = Math.max(0, Math.round(right - vw), Math.round(-r.left))
    if (over > worst.r) worst = { sel: (el.tagName + '.' + (el.className || '').toString().slice(0, 40)), r: over }
    items.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().split(' ').slice(0, 4).join(' ').slice(0, 46),
      left: Math.round(r.left), right: Math.round(right), w: Math.round(r.width), h: Math.round(r.height),
      over,
    })
  }
  const smallTargets = items.filter(i => (i.tag === 'button' || i.tag === 'select') && i.h > 0 && i.h < 36).length
  const report = {
    view,
    vw, vh: window.innerHeight,
    scrollW: de.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    overflow: de.scrollWidth > vw + 1,
    worstOverflow: worst,
    gutter: Math.round(Math.min(...items.filter(i => i.w > 200).map(i => i.left).concat([vw]))),
    smallTargets,
    count: items.length,
    items: items.filter(i => i.over > 0 || i.w > 140).slice(0, 40),
  }
  const pre = document.getElementById('report')!
  pre.textContent = JSON.stringify(report, null, 1)
}

setTimeout(() => {
  if (section) {
    const sel = document.querySelector<HTMLSelectElement>('#course-extras-section')
    if (sel) { sel.value = section; sel.dispatchEvent(new Event('change', { bubbles: true })) }
  }
  const open = params.get('open')
  if (open === 'survey') document.querySelector<HTMLButtonElement>('button[aria-controls="course-feedback-body"]')?.click()
  if (open === 'quiz') Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => (b.textContent || '').includes('Answer here'))?.click()
  setTimeout(measure, 400)
}, 250)
