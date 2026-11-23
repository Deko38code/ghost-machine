// Safe display state for the Junkalot Mr Ed lesson view.
//
// Owner specs (2026-11-22, "Fix Mr Ed refresh flicker" + "Fix Mr Ed scroll position on
// resume"): after confirming the signed-in learner, a versioned localStorage entry scoped
// to that learner may restore *display* state only - the visible section, an unsent draft,
// the chosen memory bank (the lesson scope), the first visible message and its pixel offset
// in the lesson panel, and the panel/page position. Answers, progress, transcripts and
// tokens never live here; the database is authoritative for all of them. A stale entry
// (wrong learner, wrong version, older than the TTL) is ignored, and sign-out clears it.
export type CoachViewTab = 'overview' | 'events' | 'ips' | 'audit' | 'meter' | 'ai' | 'settings'

export type CoachViewState = {
  version: 2
  learner: string
  savedAt: string
  tab?: CoachViewTab
  draft?: string
  // The memory bank is this learner's lesson record; the scroll position is valid only
  // for the bank it was saved with.
  bankId?: string
  scrollY?: number
  panelScrollTop?: number
  // Stable server record id of the first visible message, and how many pixels of that
  // message sit above the panel's top edge (0 = its top edge is exactly at the panel top).
  scrollItemId?: string
  scrollOffset?: number
}

export const COACH_VIEW_PREFIX = 'junkalot:coach-view-v2:'
// The old checkpoint stored conversation lines and answers. It is no longer written or
// read, and is removed on sign-out so nothing conversational lingers in browser storage.
export const LEGACY_COACH_SESSION_PREFIX = 'junkalot-ai-coach-session-v1:'
const VIEW_TTL_MS = 12 * 60 * 60 * 1000
const TABS: CoachViewTab[] = ['overview', 'events', 'ips', 'audit', 'meter', 'ai', 'settings']

export function coachViewKey(email: string) {
  return COACH_VIEW_PREFIX + email.trim().toLowerCase()
}

export function readCoachViewState(email: string): CoachViewState | null {
  if (typeof window === 'undefined' || !email) return null
  try {
    const raw = window.localStorage.getItem(coachViewKey(email))
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<CoachViewState> | null
    const learner = email.trim().toLowerCase()
    if (!saved || saved.version !== 2) return null
    if (String(saved.learner || '').toLowerCase() !== learner) return null
    const savedAt = Date.parse(String(saved.savedAt || ''))
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > VIEW_TTL_MS) return null
    const out: CoachViewState = { version: 2, learner, savedAt: String(saved.savedAt) }
    if (typeof saved.tab === 'string' && TABS.includes(saved.tab as CoachViewTab)) out.tab = saved.tab as CoachViewTab
    if (typeof saved.draft === 'string') out.draft = saved.draft.slice(0, 4000)
    if (typeof saved.bankId === 'string') out.bankId = saved.bankId.slice(0, 120)
    if (typeof saved.scrollY === 'number' && Number.isFinite(saved.scrollY) && saved.scrollY >= 0) out.scrollY = saved.scrollY
    if (typeof saved.panelScrollTop === 'number' && Number.isFinite(saved.panelScrollTop) && saved.panelScrollTop >= 0) out.panelScrollTop = saved.panelScrollTop
    if (typeof saved.scrollItemId === 'string' && saved.scrollItemId) out.scrollItemId = saved.scrollItemId.slice(0, 64)
    if (typeof saved.scrollOffset === 'number' && Number.isFinite(saved.scrollOffset)) out.scrollOffset = saved.scrollOffset
    return out
  } catch {
    return null
  }
}

export function writeCoachViewState(email: string, state: {
  tab?: CoachViewTab
  draft?: string
  bankId?: string
  scrollY?: number
  panelScrollTop?: number
  scrollItemId?: string
  scrollOffset?: number
}) {
  if (typeof window === 'undefined' || !email) return
  try {
    const learner = email.trim().toLowerCase()
    window.localStorage.setItem(coachViewKey(learner), JSON.stringify({
      version: 2,
      learner,
      savedAt: new Date().toISOString(),
      tab: state.tab,
      draft: (state.draft || '').slice(0, 4000),
      bankId: state.bankId || '',
      scrollY: Number.isFinite(state.scrollY) ? state.scrollY : 0,
      panelScrollTop: Number.isFinite(state.panelScrollTop) ? state.panelScrollTop : 0,
      scrollItemId: state.scrollItemId || '',
      scrollOffset: Number.isFinite(state.scrollOffset) ? state.scrollOffset : 0,
    }))
  } catch {
    // Browser storage can be unavailable or full; the lesson still works.
  }
}

export function clearCoachViewCaches() {
  if (typeof window === 'undefined') return
  try {
    const doomed: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && (key.startsWith(COACH_VIEW_PREFIX) || key.startsWith(LEGACY_COACH_SESSION_PREFIX))) doomed.push(key)
    }
    for (const key of doomed) window.localStorage.removeItem(key)
  } catch {
    // Nothing to clear, or storage is blocked.
  }
}
