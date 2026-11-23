import { createRoot } from 'react-dom/client'
import Tour, { type TourStep } from '../_Tour'

const STEPS: TourStep[] = [
  {
    target: 'sections',
    title: 'Everything lives in one list',
    body: 'Overview, Events, IP Management, AI Audit, Mr Ed and Settings all sit in this dropdown now — the page stays quiet until you pick one. ?tab= links and bookmarks still land on the right section.',
  },
  {
    target: 'overview-events',
    title: 'Any IP is one click away',
    body: 'Hover a row and it glows. Click any row in Recent Events and it opens IP Management with that address already filled in — ready to read, allow or block.',
  },
  {
    target: 'mred',
    title: 'Mr Ed has new buttons',
    body: 'New controls pulse gold until you have seen them once. Buttons keep a 44px touch target, so they are just as easy on a phone as on the desktop.',
  },
  {
    target: 'notices',
    title: 'Service notices',
    body: 'What the client is told about updates and outages. The newest notice shows on the closed bar, and an active outage opens the list by itself.',
  },
]

const root = document.getElementById('root')!
createRoot(root).render(
  <Tour steps={STEPS} open storageKey="harness" onClose={() => { /* stays open */ }} />,
)

function rectOf(el: Element | null) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }
}

declare global { interface Window { __report?: () => any } }

window.__report = () => {
  const scope = document.querySelector('[aria-label="What\'s new tour"]')
  const card = scope?.querySelector('.backdrop-blur') as HTMLElement | null
  const spot = scope?.querySelector('div[aria-hidden="true"]') as HTMLElement | null
  const btns = Array.from(scope?.querySelectorAll<HTMLElement>('button') || [])
  const heading = scope?.querySelector('h3')?.textContent || ''
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    heading,
    card: rectOf(card),
    spot: spot ? rectOf(spot) : null,
    minBtnHeight: btns.length ? Math.min(...btns.map(b => Math.round(b.getBoundingClientRect().height))) : null,
    btnCount: btns.length,
    hOverflow: document.scrollingElement!.scrollWidth - window.innerWidth,
  }
}
