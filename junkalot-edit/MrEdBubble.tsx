'use client'

// Mr Ed message bubble.
//
// One floating button on every admin page, parked bottom-left so the site's
// update card keeps the bottom-right corner. Tapping it opens a small overlay
// with two tabs:
//   New   — what the server has for her right now (mail connection, the Pay
//           PhantomIDE button, and a "You got mail" bubble per unread message)
//   Inbox — every message Mr Ed has already shown her, saved on the server, so
//           nothing disappears when the live list changes.
// Read-only: it never sends mail and never changes a record.
import { useCallback, useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { MredThemePicker, useMredTheme, mredGlassStyle } from './mredTheme'

type Bubble = {
  id: string
  kind: 'hello' | 'todo' | 'mail' | 'feedback' | 'update' | 'client'
  title: string
  body: string
  at?: string
  savedAt?: string
  href?: string
  action?: 'connect-gmail'
}

const LAUNCHER_BOTTOM = 'calc(16px + env(safe-area-inset-bottom, 0px) + var(--phantom-applet-h, 0px))'
const PANEL_BOTTOM = 'calc(84px + env(safe-area-inset-bottom, 0px) + var(--phantom-applet-h, 0px))'

function when(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function BubbleRow({ bubble }: { bubble: Bubble }) {
  const stamp = when(bubble.at || bubble.savedAt)
  return (
    <li className={'mred-row rounded-2xl border px-3 py-2.5 ' + (bubble.kind === 'mail' ? 'border-emerald-700/50 bg-emerald-950/40' : bubble.kind === 'feedback' ? 'border-[#C9A840]/40 bg-[#C9A840]/10' : '')}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-start gap-2 text-sm font-bold leading-5 mred-strong">
          <span aria-hidden="true">{bubble.kind === 'mail' ? '📬' : bubble.kind === 'todo' ? '📌' : bubble.kind === 'feedback' ? '📝' : bubble.kind === 'update' ? '📣' : bubble.kind === 'client' ? '👤' : '👋'}</span>
          <span className="min-w-0 break-words">{bubble.title}</span>
        </p>
        {stamp && <span className="mred-muted shrink-0 text-[10px] font-semibold">{stamp}</span>}
      </div>
      <p className="mred-muted mt-1 break-words text-xs leading-5">{bubble.body}</p>
      {bubble.href && (
        <a
          href={bubble.href}
          className="mt-2 inline-flex rounded-lg border border-[#C9A840] bg-[#C9A840]/15 px-3 py-1.5 text-xs font-bold mred-strong hover:bg-[#C9A840]/25"
          style={{ minHeight: 34 }}
        >
          Open
        </a>
      )}
    </li>
  )
}

export default function MrEdBubble({ embedded = false }: { embedded?: boolean } = {}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'new' | 'inbox'>('new')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [inbox, setInbox] = useState<Bubble[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [badge, setBadge] = useState(0)
  const [inboxTotal, setInboxTotal] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  // Owner (2026-11-22): "add theme prefrenece in mr ed tabs" and "the mr ed term color picker
  // theme selector". One preference, shared with the full-window terminal, stored in this
  // browser only: presets plus a colour picker. See src/components/mredTheme.tsx.
  const { theme: panelTheme, tint: panelTint, choose: choosePanelTheme, chooseTint: choosePanelTint } = useMredTheme()
  const panelTone = panelTheme === 'auto' ? '' : ' mred-tone-' + panelTheme
  const panelToneStyle = mredGlassStyle(panelTheme, panelTint)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/mred-bubble', { cache: 'no-store' })
      if (!response.ok) { setError('PhantomIDE could not be reached just now.'); return }
      const data = await response.json()
      const next: Bubble[] = Array.isArray(data.bubbles) ? data.bubbles : []
      setBubbles(next)
      setError('')
      // Badge is unread MAIL only — setup reminders must not inflate it (codex review 2026-11-20).
      setBadge(next.filter(bubble => bubble.kind === 'mail').length)
      // Live Inbox total, so the Inbox tab always shows how many messages are kept.
      try {
        const countRes = await fetch('/api/admin/mred-inbox?limit=1', { cache: 'no-store' })
        if (countRes.ok) {
          const countData = await countRes.json()
          if (typeof countData.total === 'number') setInboxTotal(countData.total)
        }
      } catch { /* the count is optional */ }
    } catch {
      setError('PhantomIDE could not be reached just now.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInbox = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/mred-inbox?limit=200', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      setInbox(Array.isArray(data.messages) ? data.messages : [])
    } catch {
      setInbox([])
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => { if (open && tab === 'inbox' && inbox === null) void loadInbox() }, [open, tab, inbox, loadInbox])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || launcherRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  function connectGmail() {
    void signIn('google', { callbackUrl: '/admin/security?tab=ai&gmail=connected' }, {
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      login_hint: '1junkalot@gmail.com',
      include_granted_scopes: 'true',
    })
  }

  const shown = tab === 'inbox' ? (inbox || []) : bubbles
  const newCount = bubbles.filter(bubble => bubble.kind === 'mail' || bubble.kind === 'todo').length

  // Owner (2026-11-20): "move the message bubble you added in left corner to this
  // section with mr ed". On the Security Center the floating corner button is not
  // drawn at all (see admin/layout.tsx); this same panel is rendered inline in the
  // Mr Ed tab instead. Everything else — polling, tabs, saved inbox — is identical.
  if (embedded) {
    return (
      <section aria-label="Mr Ed messages from PhantomIDE" style={panelToneStyle} className={'overflow-hidden rounded-2xl border border-[#C9A840]/60 text-white ' + (panelTheme === 'auto' ? 'mred-on-dark bg-[#1A1A2E]' : 'mred-glass' + panelTone)}>
        <div className="border-b border-white/10 px-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold mred-strong">Mr Ed · messages from PhantomIDE</p>
              <p className="mred-muted truncate text-[11px]">What the server has for you right now, newest first.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void (tab === 'inbox' ? loadInbox() : load())}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold mred-muted hover:bg-white/10"
                style={{ minHeight: 34 }}
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2 pb-3">
            {bubbles.some(bubble => bubble.action === 'connect-gmail') && (
              <button
                type="button"
                onClick={connectGmail}
                className="w-full rounded-lg border border-[#C9A840] bg-[#C9A840]/15 px-3 py-2 text-xs font-bold mred-strong hover:bg-[#C9A840]/25"
                style={{ minHeight: 38 }}
              >
                Connect business Gmail
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Mr Ed messages" className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-white/15">
                {(['new', 'inbox'] as const).map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={tab === name}
                    onClick={() => setTab(name)}
                    className={'flex-1 px-3 py-2 text-xs font-bold ' + (index > 0 ? 'border-l border-white/15 ' : '') + (tab === name ? 'bg-[#141428] text-[#F5E6B8]' : 'mred-muted hover:bg-white/5')}
                    style={{ minHeight: 38 }}
                  >
                    {name === 'new' ? 'New' : 'Inbox'}
                    {name === 'new' && newCount > 0 ? ' (' + newCount + ')' : ''}
                    {name === 'inbox' && inboxTotal !== null && inboxTotal > 0 ? ' (' + inboxTotal + ')' : ''}
                  </button>
                ))}
              </div>
              <MredThemePicker theme={panelTheme} tint={panelTint} onChange={choosePanelTheme} onTint={choosePanelTint} />
            </div>
          </div>
        </div>
        <div className={'max-h-[46vh] space-y-2 overflow-y-auto px-3 py-3 sm:max-h-[420px] ' + (panelTheme === 'auto' ? 'bg-[#141428]/60' : 'bg-transparent')}>
          {tab === 'new' && loading && bubbles.length === 0 && <p className="mred-muted px-1 text-xs">Loading…</p>}
          {tab === 'new' && error && <p role="alert" className="rounded-xl border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{error}</p>}
          {tab === 'inbox' && inbox === null && <p className="mred-muted px-1 text-xs">Loading the inbox…</p>}
          {tab === 'inbox' && inbox?.length === 0 && <p className="mred-muted px-1 text-xs">Nothing saved yet. Every message Mr Ed shows you is kept here.</p>}
          <ul className="space-y-2">
            {shown.map(bubble => <BubbleRow key={bubble.id} bubble={bubble} />)}
          </ul>
        </div>
      </section>
    )
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Mr Ed messages from PhantomIDE"
        className="fixed left-4 z-[70] flex items-center gap-2 rounded-full border border-[#C9A840] bg-[#1A1A2E] px-4 py-3 text-sm font-bold text-[#F5E6B8] shadow-xl transition hover:bg-[#24243e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A840]"
        style={{ bottom: LAUNCHER_BOTTOM, minHeight: 44 }}
      >
        <span aria-hidden="true" className="text-base leading-none">💬</span>
        <span>Mr Ed</span>
        {badge > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C9A840] px-1 text-[11px] font-bold text-[#1A1A2E]">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        // Owner (2026-11-22): "make her mr ed back ground transparent". The panel is a
        // see-through pane: theme-aware 55% glass with a blur and readable text.
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Messages from PhantomIDE"
          className={'mred-glass fixed left-5 right-5 z-[70] flex flex-col overflow-hidden rounded-2xl border border-[#C9A840]/60 shadow-2xl sm:left-4 sm:right-auto sm:w-[380px]' + panelTone}
          style={{ bottom: PANEL_BOTTOM, maxHeight: 'min(72vh, 540px)', ...panelToneStyle }}
        >
          <div className="border-b border-white/10 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold mred-strong">Mr Ed</p>
                <p className="mred-muted truncate text-[11px]">Messages from PhantomIDE</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void (tab === 'inbox' ? loadInbox() : load())}
                  className="mred-muted rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/10"
                  style={{ minHeight: 32 }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Mr Ed messages"
                  className="mred-muted rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/10"
                  style={{ minHeight: 32 }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Owner rule (2026-11-20): "always keep tab that belong close or
                with tabs grouped for declutter". Related tabs live in one
                segmented control; the action that belongs with them sits
                directly above it instead of in a second scattered row. */}
            <div className="mt-2 space-y-2">
              {bubbles.some(bubble => bubble.action === 'connect-gmail') && (
                <button
                  type="button"
                  onClick={connectGmail}
                  className="w-full rounded-lg border border-[#C9A840] bg-[#C9A840]/15 px-3 py-2 text-xs font-bold mred-strong hover:bg-[#C9A840]/25"
                  style={{ minHeight: 36 }}
                >
                  Connect business Gmail
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Mr Ed messages" className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-white/15">
                  {(['new', 'inbox'] as const).map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      role="tab"
                      aria-selected={tab === name}
                      onClick={() => setTab(name)}
                      className={'flex-1 px-3 py-2 text-xs font-bold ' + (index > 0 ? 'border-l border-white/15 ' : '') + (tab === name ? 'bg-[#141428] text-[#F5E6B8]' : 'mred-muted hover:bg-white/5')}
                      style={{ minHeight: 36 }}
                    >
                      {name === 'new' ? 'New' : 'Inbox'}
                      {name === 'new' && newCount > 0 ? ' (' + newCount + ')' : ''}
                      {name === 'inbox' && inboxTotal !== null && inboxTotal > 0 ? ' (' + inboxTotal + ')' : ''}
                    </button>
                  ))}
                </div>
                <MredThemePicker theme={panelTheme} tint={panelTint} onChange={choosePanelTheme} onTint={choosePanelTint} />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-transparent px-3 py-3">
            {tab === 'new' && loading && bubbles.length === 0 && <p className="mred-muted px-1 text-xs">Loading…</p>}
            {tab === 'new' && error && <p role="alert" className="rounded-xl border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{error}</p>}
            {tab === 'inbox' && inbox === null && <p className="mred-muted px-1 text-xs">Loading the inbox…</p>}
            {tab === 'inbox' && inbox?.length === 0 && <p className="mred-muted px-1 text-xs">Nothing saved yet. Every message Mr Ed shows you is kept here.</p>}
            <ul className="space-y-2">
              {shown.map(bubble => <BubbleRow key={bubble.id} bubble={bubble} />)}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5">
            <a href="/admin/security?tab=ai" className="text-xs font-semibold mred-strong underline underline-offset-2">
              Open Mr Ed in the Security Center
            </a>
          </div>
        </div>
      )}
    </>
  )
}
