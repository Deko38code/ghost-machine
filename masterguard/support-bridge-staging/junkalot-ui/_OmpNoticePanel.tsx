'use client'

// The live OMP panel for notices and messages from PhantomIDE.
//
// Owner (2026-11-23): "we should be able to render a live omp panel for notifications
// that will show from us" · "scrollable readable replyable" · "it has to have
// adjusttable panels to work" · "we nee a bridge between 2 same panels witn inbound
// outbound messages" · "from us to her".
//
// Two panes with a drag divider between them: messages on one side, the live snapshot
// of her own service on the other. Both scroll on their own, so a long message never
// pushes the snapshot out of reach. The split is remembered in this browser only.
//
// Inbound messages come from PhantomIDE through the bridge (POST /api/internal/
// panel-bridge on our side); her reply is posted back as outbound and lives here for
// PhantomIDE to pull. The panel only says a reply was mailed when the mail API
// actually accepted it, and it never claims to have sent what it did not.
//
// Nothing here reads another project or shows our cost, margin, provider or key data
// (CLAUDE.md 16, 25, 30). It is her service, in her own words.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import HeroLogo from './_HeroLogo'
import SupportCall from './_SupportCall'

type Notice = { at: string; kind: string; title: string; detail: string }
type Message = { id: string; at: string; title?: string; body: string }
type InboxItem = { id: string; kind: 'booking' | 'message'; title: string; detail: string; at: string; href: string; status?: string; ref?: string; caller?: string; email?: string }
type Feed = {
  at: string
  notices: Notice[]
  messages: Message[]
  replies: Message[]
  inbox?: InboxItem[]
  snapshot: { build: string; appliedAt: string; waiting: boolean; youAreActive: boolean; lines: string[] }
  maxReply?: number
  isOwner?: boolean
  unseen?: { total: number; messages: number; site: number; latestTitle: string; latestAt: string; youRepliedAt: string }
}

const SPLIT_KEY = 'junkalot:omp-split'

// Owner (2026-11-23): "will have her bookings our messages from us to her there all
// messaging services in dropdown menu" — one dropdown chooses what the panel shows,
// never a row of tabs (the admin's own rule: multi-option controls are a dropdown).
type View = 'all' | 'bookings' | 'messages' | 'fromUs' | 'notices' | 'plugins'
const VIEW_KEY = 'junkalot:omp-view'
// The workspace title follows whatever the panel's own dropdown is showing, so an
// expanded list is never labelled something other than what it contains.
const VIEW_TITLE: Record<View, string> = {
  all: 'Everything', bookings: 'Bookings', messages: 'Contact messages',
  fromUs: 'From PhantomIDE', notices: 'Notices', plugins: 'Plugins',
}

// The bar at the top of a full-window workspace: what it is, and one clear way back.
function WorkspaceHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[#00ff41]/25 bg-[#07100b] px-5 py-2">
      <p className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#00ff41]">{title}</p>
      <span className="hidden shrink-0 font-mono text-[10px] text-gray-500 sm:block">Esc to close</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the expanded panel"
        title="Close"
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/25 px-2.5 font-mono text-[11px] font-bold text-gray-200 hover:bg-white/10"
        style={{ minHeight: 36 }}
      >
        <span aria-hidden="true">⤡</span> Close
      </button>
    </div>
  )
}

// Live plugins and services she may use, each a real address that opens in a new tab
// (owner, 2026-11-23: "add live plugins to the tabs list in panel with real links
// wordpress etc"). Only the link is ours: no password, no token and nothing of another
// project's data is carried, stored or read here (CLAUDE.md 9, 16, 25).
type PluginLink = { name: string; does: string; href: string; tag: string }
const PLUGINS: PluginLink[] = [
  { name: 'WordPress', does: 'Write, publish and manage a WordPress site', href: 'https://wordpress.com/', tag: 'Site' },
  { name: 'Gmail', does: 'Your business mailbox', href: 'https://mail.google.com/', tag: 'Mail' },
  { name: 'Google Business Profile', does: 'Your listing, hours, photos and reviews', href: 'https://business.google.com/', tag: 'Listing' },
  { name: 'Google Search Console', does: 'How your site shows up in Google search', href: 'https://search.google.com/search-console', tag: 'SEO' },
  { name: 'Google Analytics', does: 'Visitors and traffic reports', href: 'https://analytics.google.com/', tag: 'Stats' },
  { name: 'Google Calendar', does: 'Your schedule and job appointments', href: 'https://calendar.google.com/', tag: 'Jobs' },
  { name: 'Canva', does: 'Design flyers, posts and photos', href: 'https://www.canva.com/', tag: 'Design' },
  { name: 'Meta Business Suite', does: 'Facebook and Instagram pages and messages', href: 'https://business.facebook.com/', tag: 'Social' },
  { name: 'Zapier', does: 'Connect apps together without code', href: 'https://zapier.com/', tag: 'Automation' },
]

function when(value?: string) {
  if (!value) return ''
  const ms = Date.parse(value || '')
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const KIND_TAG: Record<string, string> = {
  update: 'UPDATE',
  outage: 'OUTAGE',
  restored: 'RESTORED',
  cert: 'CERT',
  note: 'NOTICE',
}

export default function OmpNoticePanel({ maxHeight }: { maxHeight?: number }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState('')
  const [split, setSplit] = useState(42)
  const [wide, setWide] = useState(true)
  // On a phone the live snapshot is folded away to start with, so the list and the
  // composer get the screen; one press brings it back (Codex audit 2026-11-23).
  const [showSnapshot, setShowSnapshot] = useState(true)
  // The right pane carries either the live snapshot or the support call; the pane's size
  // never depends on which one is chosen (owner 2026-11-23: "the right panel").
  const [rightPane, setRightPane] = useState<'snapshot' | 'support'>('snapshot')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [view, setView] = useState<View>('all')
  // One-click reply to a caller from her own site (owner 2026-11-23: "client can email
  // straight from panel and reply live from there just one click reply system real
  // emails booking flow wired to her live booking emails" · "need it simple easy fast
  // one click reply"). ✉ on a row opens a three-line composer for that one caller; the
  // address is resolved on the server from the record, never typed here.
  const [mail, setMail] = useState<{ id: string; ref: string; name: string; email: string } | null>(null)
  const [mailSubject, setMailSubject] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [mailBusy, setMailBusy] = useState(false)
  const [mailNote, setMailNote] = useState('')
  const [mailKey, setMailKey] = useState('')
  const mailBox = useRef<HTMLTextAreaElement | null>(null)
  // What was waiting when she opened the panel, kept on screen for this visit so the
  // "you've got mail" line does not blink away the instant it is marked read.
  const [waitingAtOpen, setWaitingAtOpen] = useState<Feed['unseen'] | null>(null)
  const seenMarked = useRef('')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  // Owner (2026-11-23): "panels are too close together and dosent show real fullscreen".
  // ⤢ puts the whole panel in the browser's own fullscreen; when the browser refuses
  // (frame, permissions) the same button falls back to a fixed in-page sheet, so the
  // control always does something real and never claims a fullscreen it did not get.
  // Owner (2026-11-23): "Add full-window popouts for the panels and video area". One
  // workspace at a time — the panel's own list, its snapshot, or the support call —
  // expanded to the whole viewport. The content is the SAME mounted node, only its box
  // changes, so scroll position, form values, the chosen dropdown and a live support
  // call all survive expanding and closing. The tab chosen in the right pane is shared
  // state, so the workspace always shows whichever tab the embedded panel shows.
  const [workspace, setWorkspace] = useState<'list' | 'snapshot' | 'support' | null>(null)
  const [panelFull, setPanelFull] = useState(false)
  const [panelTheatre, setPanelTheatre] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const panelExpanded = panelFull || panelTheatre
  const togglePanelFullscreen = useCallback(async () => {
    const el = sectionRef.current
    if (!el) return
    if (document.fullscreenElement) { try { await document.exitFullscreen() } catch {} ; return }
    if (panelTheatre) { setPanelTheatre(false); return }
    try { await el.requestFullscreen() } catch { setPanelTheatre(true) }
  }, [panelTheatre])
  useEffect(() => {
    const sync = () => setPanelFull(document.fullscreenElement === sectionRef.current)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // A workspace closes first (the browser handles leaving real fullscreen itself).
      setWorkspace(null)
      setPanelTheatre(false)
    }
    document.addEventListener('fullscreenchange', sync)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('fullscreenchange', sync); window.removeEventListener('keydown', onKey) }
  }, [])

  // While a workspace covers the screen the page behind it must not scroll; whatever the
  // page had before is put back exactly on close (owner: "restore it when closed").
  useEffect(() => {
    if (!workspace) return
    const bodyOverflow = document.body.style.overflow
    const htmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = htmlOverflow
    }
  }, [workspace])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notice-feed', { cache: 'no-store' })
      if (!res.ok) { setError('PhantomIDE could not be reached just now.'); return }
      const data = (await res.json()) as Feed
      setFeed(data)
      setError('')
    } catch {
      setError('PhantomIDE could not be reached just now.')
    }
  }, [])

  // Real live, not a snapshot taken at load: the panel re-reads her own feed every 12 s
  // and the moment the tab comes back to the front, so a booking, a message from us or a
  // notice that landed while she was elsewhere is on screen when she looks at it
  // (owner 2026-11-23: "make sure the omp preview is real live the panel and inboxes").
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, 12_000)
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

  // What was waiting when she opened the panel is kept on screen for this visit, so the
  // "you've got mail" line does not blink away the instant it is marked read.
  useEffect(() => {
    if (!feed) return
    if (waitingAtOpen === null && feed.unseen && feed.unseen.total > 0) setWaitingAtOpen(feed.unseen)
  }, [feed, waitingAtOpen])

  // The divider is vertical on a wide screen and horizontal on a phone. The live
  // snapshot only starts open on a wide screen; at phone width it is folded away so the
  // list and the composer get the height, and the header button opens it (Codex audit
  // 2026-11-23 — 360×640 is the narrowest screen we verify).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => { setWide(mq.matches); setShowSnapshot(mq.matches) }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SPLIT_KEY) || 0)
      if (saved >= 22 && saved <= 78) setSplit(saved)
    } catch { /* private window: the default split is used */ }
  }, [])

  // The chosen view is remembered in this browser, so she lands on the same list.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY)
      if (saved === 'all' || saved === 'bookings' || saved === 'messages' || saved === 'fromUs' || saved === 'notices' || saved === 'plugins') setView(saved)
    } catch { /* private window: everything is shown */ }
  }, [])

  function chooseView(next: View) {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* private window */ }
  }

  // One click on ✉: the composer opens for that caller with the subject already written.
  function startReply(item: InboxItem) {
    if (!item.email) return
    const name = item.title.replace(/^(Booking|Message) · /, '')
    setMail({ id: item.id, ref: item.ref || '', name, email: item.email })
    setMailSubject(item.kind === 'booking'
      ? (item.ref ? 'Your booking ' + item.ref + ' — Junk-A-Lot' : 'Your booking — Junk-A-Lot')
      : 'Your message to Junk-A-Lot')
    setMailBody('')
    setMailNote('')
    // One key per composer: a retry or a double click can never mail the customer twice.
    setMailKey(Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8))
    window.setTimeout(() => mailBox.current?.focus(), 30)
  }

  function closeReply() {
    setMail(null)
    setMailSubject('')
    setMailBody('')
    setMailNote('')
  }

  async function sendMail() {
    if (!mail || mailBusy || !mailBody.trim()) return
    setMailBusy(true)
    setMailNote('Sending…')
    try {
      const res = await fetch('/api/admin/panel-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mail.id, subject: mailSubject, body: mailBody, clientKey: mailKey }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.mailed) {
        // Only what the server actually said; nothing is reported as sent unless it was.
        setMailNote(String(data?.error || 'Nothing was sent — the mail service did not accept it.'))
        setMailBusy(false)
        return
      }
      setMailNote('Sent to ' + mail.email + ' — a copy is in your booking inbox.')
      setMailBody('')
      setMailBusy(false)
      window.setTimeout(closeReply, 2200)
    } catch {
      setMailNote('Nothing was sent — the server could not be reached.')
      setMailBusy(false)
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* older browser */ }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return
    const raw = wide
      ? ((event.clientX - box.left) / box.width) * 100
      : ((event.clientY - box.top) / box.height) * 100
    setSplit(Math.max(22, Math.min(78, raw)))
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    try { localStorage.setItem(SPLIT_KEY, String(split)) } catch { /* private window */ }
  }

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setStatus('')
    try {
      const res = await fetch('/api/admin/notice-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        setStatus('Not sent — PhantomIDE could not be reached. Your reply is still in the box.')
        setSending(false)
        return
      }
      const data = await res.json()
      setText('')
      setStatus(data?.mailed
        ? 'Sent. PhantomIDE has your reply, and a copy went to their desk by email.'
        : 'Sent. PhantomIDE has your reply and will read it in their panel.')
      await load()
    } catch {
      setStatus('Not sent — PhantomIDE could not be reached. Your reply is still in the box.')
    } finally {
      setSending(false)
    }
  }

  const snapshot = feed?.snapshot
  const messages = (feed?.messages || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))
  const notices = feed?.notices || []
  const replies = feed?.replies || []
  const inbox = feed?.inbox || []
  const total = messages.length + notices.length
  const bookings = inbox.filter((item) => item.kind === 'booking')
  const contacts = inbox.filter((item) => item.kind === 'message')
  const showSite = view === 'all' || view === 'bookings' || view === 'messages'
  const siteItems = view === 'bookings' ? bookings : view === 'messages' ? contacts : inbox
  const showFromUs = view === 'all' || view === 'fromUs'
  const showNotices = view === 'all' || view === 'notices'
  const shown = (showSite ? siteItems.length : 0) + (showFromUs ? messages.length : 0) + (showNotices ? notices.length : 0)

  // Only mail the current view actually renders is marked seen, so a filter can never hide
  // an item that was never on screen; notices are left out because they are not "waiting
  // mail" and have their own acknowledgement. The marker only moves forward, and it is
  // recorded a few seconds after the rows are on screen (Codex audit 2026-11-23).
  const visibleThrough = (showSite ? siteItems.map((item) => item.at) : [])
    .concat(showFromUs ? messages.map((message) => message.at) : [])
    .filter(Boolean)
    .sort()
    .pop() || ''

  useEffect(() => {
    if (!feed || feed.isOwner || !visibleThrough) return
    if (visibleThrough <= seenMarked.current) return
    const through = visibleThrough
    const timer = window.setTimeout(() => {
      seenMarked.current = through
      void fetch('/api/admin/notice-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'panel-seen', through }),
      })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => { if (data?.recorded) void load(); else seenMarked.current = '' })
        .catch(() => { seenMarked.current = '' /* the badge stays and the mark is retried */ })
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [feed, visibleThrough, load])

  return (
    <section
      ref={sectionRef}
      aria-label="Live notices from PhantomIDE"
      className={'flex h-full min-h-0 flex-col overflow-hidden bg-[#04070a] text-gray-200 ' + (panelExpanded
        ? 'fixed inset-0 z-[300] h-[100dvh] w-screen rounded-none border-0'
        : 'rounded-xl border border-[#00ff41]/35')}
      style={panelExpanded ? undefined : { maxHeight }}
    >
      <div className="flex items-center gap-2 border-b border-[#00ff41]/25 bg-[#07100b] px-3 py-2">
        <HeroLogo size={24} />
        <span aria-hidden="true" className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[#00ff41] shadow-[0_0_8px_#00ff41]" />
        <p className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#00ff41]">
          Inbox · live
        </p>
        <p className="hidden shrink-0 font-mono text-[10px] text-gray-500 sm:block">
          {snapshot?.build ? snapshot.build + ' · ' : ''}{when(feed?.at) || 'connecting…'}
        </p>
        <button
          type="button"
          onClick={() => { setRightPane('support'); setShowSnapshot(true) }}
          aria-label="Open video support"
          title="Video support with PhantomIDE"
          className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-[13px] ' + (rightPane === 'support' && showSnapshot
            ? 'border-[#00ff41]/60 bg-[#00ff41]/15 text-[#00ff41]'
            : 'border-white/15 text-gray-300 hover:bg-white/10')}
          style={{ minHeight: 36, minWidth: 36 }}
        >
          🎥
        </button>
        {!wide && (
          <button
            type="button"
            onClick={() => setShowSnapshot((open) => !open)}
            aria-pressed={showSnapshot}
            aria-label={showSnapshot ? 'Hide the live snapshot' : 'Show the live snapshot'}
            title={showSnapshot ? 'Hide the live snapshot' : 'Show the live snapshot'}
            className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-[13px] font-bold ' + (showSnapshot
              ? 'border-[#00ff41]/50 text-[#00ff41]'
              : 'border-white/15 text-gray-300 hover:bg-white/10')}
            style={{ minHeight: 36, minWidth: 36 }}
          >
            i
          </button>
        )}
        <button
          type="button"
          onClick={() => void togglePanelFullscreen()}
          aria-pressed={panelExpanded}
          aria-label={panelExpanded ? 'Exit fullscreen panel' : 'Open the panel fullscreen'}
          title={panelExpanded ? 'Exit fullscreen' : 'Fullscreen'}
          className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-[13px] ' + (panelExpanded
            ? 'border-[#00ff41]/60 bg-[#00ff41]/15 text-[#00ff41]'
            : 'border-white/15 text-gray-300 hover:bg-white/10')}
          style={{ minHeight: 36, minWidth: 36 }}
        >
          {panelExpanded ? '⤡' : '⤢'}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh the panel"
          title="Refresh"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 font-mono text-[12px] text-gray-300 hover:bg-white/10"
          style={{ minHeight: 36, minWidth: 36 }}
        >
          ↻
        </button>
      </div>

      {error && (
        <p className="border-b border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">{error}</p>
      )}

      {/* Owner (2026-11-23): "like you got mail live banner update when ready to view" —
          one live line above both panes: what is waiting (and the newest of it) or that
          nothing is, plus when her last reply left the panel. It glows while waiting. */}
      <div
        role="status"
        aria-live="polite"
        className={'flex shrink-0 items-center gap-2 border-b px-3 py-1.5 font-mono text-[10px] ' + (waitingAtOpen && waitingAtOpen.total > 0
          ? 'border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41] shadow-[inset_0_0_16px_rgba(0,255,65,.15)]'
          : 'border-white/10 text-gray-500')}
      >
        <span aria-hidden="true" className={'inline-block h-2 w-2 shrink-0 rounded-full ' + (waitingAtOpen && waitingAtOpen.total > 0 ? 'animate-pulse bg-[#00ff41] shadow-[0_0_10px_#00ff41]' : 'bg-gray-700')} />
        <span className="min-w-0 flex-1 truncate">
          {waitingAtOpen && waitingAtOpen.total > 0
            ? '📬 You’ve got mail · ' + waitingAtOpen.total + ' waiting' + (waitingAtOpen.latestTitle ? ' — ' + waitingAtOpen.latestTitle : '')
            : feed
              ? '📭 Nothing waiting' + (feed.unseen?.youRepliedAt ? ' · your last reply ' + when(feed.unseen.youRepliedAt) : '')
              : 'Checking your mail…'}
        </span>
        {waitingAtOpen && waitingAtOpen.total > 0 && (
          <span className="shrink-0 uppercase tracking-widest">new</span>
        )}
      </div>

      <div ref={wrapRef} className={'flex min-h-0 flex-1 ' + (wide ? 'flex-row' : 'flex-col')}>
        <div
          className={'flex min-h-0 min-w-0 flex-col' + (!wide && !showSnapshot ? ' flex-1' : '') + (workspace === 'list'
            ? ' fixed inset-0 z-[300] h-[100dvh] w-screen bg-[#04070a]'
            : '')}
          style={workspace === 'list' ? undefined : wide ? { width: split + '%' } : showSnapshot ? { height: split + '%' } : undefined}
        >
          {workspace === 'list' && <WorkspaceHeader title={VIEW_TITLE[view]} onClose={() => setWorkspace(null)} />}
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-2 py-1.5">
            <label htmlFor="omp-view" className="sr-only">Choose what this panel shows</label>
            <select
              id="omp-view"
              value={view}
              onChange={(event) => chooseView(event.target.value as View)}
              className="min-w-0 flex-1 rounded-md border border-[#00ff41]/30 bg-black/60 px-2 py-1 font-mono text-[11px] text-gray-200 focus:border-[#00ff41]/70 focus:outline-none"
              style={{ minHeight: 34 }}
            >
              <option value="all">Everything · {inbox.length + total}</option>
              <option value="bookings">Bookings · {bookings.length}</option>
              <option value="messages">Contact messages · {contacts.length}</option>
              {/* Owner (2026-11-23): "make phantomide message tab in menu green" — the
                  PhantomIDE entry is the one row of this menu that is ours, so it carries
                  the panel's own green, in the list and when it is the one selected. */}
              <option value="fromUs" style={{ color: '#00ff41' }}>From PhantomIDE · {messages.length}</option>
              <option value="notices">Notices · {notices.length}</option>
              <option value="plugins">Plugins · {PLUGINS.length}</option>
            </select>
            <button
              type="button"
              onClick={() => setWorkspace(workspace === 'list' ? null : 'list')}
              aria-pressed={workspace === 'list'}
              aria-label={workspace === 'list' ? 'Close the expanded list' : 'Expand the list to the whole window'}
              title={workspace === 'list' ? 'Close' : 'Expand'}
              className="flex shrink-0 items-center justify-center rounded-md border border-white/20 font-mono text-[13px] text-gray-300 hover:bg-white/10"
              style={{ minHeight: 34, minWidth: 36 }}
            >
              {workspace === 'list' ? '⤡' : '⤢'}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {!feed && view !== 'plugins' && <p className="text-xs text-gray-500">Loading…</p>}
            {feed && view !== 'plugins' && shown === 0 && (
              <p className="text-xs text-gray-500">
                {view === 'bookings' ? 'No new bookings yet.'
                  : view === 'messages' ? 'No new contact messages yet.'
                  : view === 'fromUs' ? 'Nothing from PhantomIDE yet.'
                  : view === 'notices' ? 'No notices on record.'
                  : 'Nothing new yet.'}
              </p>
            )}
            {mail && (
              <div className="mb-2 rounded-lg border border-[#00ff41]/50 bg-[#07120c] p-2.5">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-widest text-[#00ff41]">
                    Reply · {mail.ref || mail.id}
                  </p>
                  <button
                    type="button"
                    onClick={closeReply}
                    aria-label="Close the reply"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
                  >✕</button>
                </div>
                <p className="truncate font-mono text-[10px] text-gray-400">To {mail.name} · {mail.email}</p>
                <label htmlFor="omp-mail-subject" className="sr-only">Subject</label>
                <input
                  id="omp-mail-subject"
                  value={mailSubject}
                  onChange={(event) => setMailSubject(event.target.value.slice(0, 200))}
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-[12px] text-gray-100 focus:border-[#00ff41]/70 focus:outline-none"
                  style={{ minHeight: 36 }}
                />
                <label htmlFor="omp-mail-body" className="sr-only">Your email</label>
                <textarea
                  id="omp-mail-body"
                  ref={mailBox}
                  value={mailBody}
                  onChange={(event) => setMailBody(event.target.value.slice(0, 6000))}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void sendMail() }
                  }}
                  rows={3}
                  placeholder="Write your email — Ctrl+Enter sends"
                  className="mt-1.5 w-full resize-y rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-[12px] text-gray-100 placeholder:text-gray-600 focus:border-[#00ff41]/70 focus:outline-none"
                />
                <div className="mt-1.5 flex items-center gap-2">
                  <p role="status" className="min-w-0 flex-1 break-words text-[10px] leading-4 text-gray-400">{mailNote}</p>
                  <button
                    type="button"
                    onClick={() => void sendMail()}
                    disabled={mailBusy || !mailBody.trim()}
                    className="shrink-0 rounded-lg border border-[#00ff41]/60 bg-[#00ff41]/20 px-3 font-mono text-[11px] font-bold text-[#00ff41] hover:bg-[#00ff41]/30 disabled:opacity-40"
                    style={{ minHeight: 44 }}
                  >{mailBusy ? 'Sending…' : 'Send email'}</button>
                </div>
              </div>
            )}
            <ul className="space-y-1.5">
              {showSite && siteItems.map((item) => (
                <li key={item.id} className="flex items-stretch gap-1.5">
                  <a
                    href={item.href}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#00ff41]/25 bg-[#00ff41]/5 px-2.5 py-1.5 hover:border-[#00ff41]/60 hover:bg-[#00ff41]/10 focus:border-[#00ff41] focus:outline-none"
                  >
                    <span className="shrink-0 rounded border border-[#00ff41]/40 px-1 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#00ff41]">
                      {item.kind === 'booking' ? 'Booking' : 'Message'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold leading-5 text-gray-100">{item.title}</span>
                      {item.caller && (
                        <span className="block truncate font-mono text-[10px] leading-4 text-[#9ff5bd]">{item.caller}</span>
                      )}
                      {item.detail && (
                        <span className="block truncate text-[10px] leading-4 text-gray-400">{item.detail}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[9px] font-bold text-gray-300">{item.ref || ''}</span>
                      <span className="block font-mono text-[9px] text-gray-500">{item.status || when(item.at)}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-[#00ff41]">&#8599;</span>
                  </a>
                  {item.email && (
                    <button
                      type="button"
                      onClick={() => startReply(item)}
                      title={'Email ' + (item.email || '')}
                      aria-label={'Reply by email to ' + item.title.replace(/^(Booking|Message) · /, '')}
                      className="flex w-11 shrink-0 items-center justify-center rounded-lg border border-[#00ff41]/35 bg-[#00ff41]/10 text-[15px] text-[#00ff41] hover:border-[#00ff41] hover:bg-[#00ff41]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff41]"
                      style={{ minHeight: 44 }}
                    >✉</button>
                  )}
                </li>
              ))}
              {showFromUs && messages.map((message) => (
                <li key={message.id} className="rounded-lg border border-[#00ff41]/30 bg-[#00ff41]/5 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-bold leading-5 text-gray-100">{message.title || 'Message from PhantomIDE'}</p>
                    <span className="shrink-0 font-mono text-[10px] text-gray-500">{when(message.at)}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[#00ff41]/70">FROM PHANTOMIDE</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-gray-300">{message.body}</p>
                </li>
              ))}
              {showNotices && notices.map((notice, index) => (
                <li key={String(notice.at) + index} className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-bold leading-5 text-gray-100">{notice.title}</p>
                    <span className="shrink-0 font-mono text-[10px] text-gray-500">{when(notice.at)}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[#00ff41]/70">
                    {KIND_TAG[notice.kind] || 'NOTICE'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-gray-400">{notice.detail}</p>
                </li>
              ))}
            </ul>
            {view === 'plugins' && (
              <ul className="space-y-1.5">
                {PLUGINS.map((plugin) => (
                  <li key={plugin.href}>
                    <a
                      href={plugin.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#00ff41]/25 bg-[#00ff41]/5 px-2.5 py-1.5 hover:border-[#00ff41]/60 hover:bg-[#00ff41]/10 focus:border-[#00ff41] focus:outline-none"
                    >
                      <span className="shrink-0 rounded border border-[#00ff41]/40 px-1 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#00ff41]">
                        {plugin.tag}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold leading-5 text-gray-100">{plugin.name}</span>
                        <span className="block truncate text-[10px] leading-4 text-gray-400">{plugin.does}</span>
                      </span>
                      <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-[#00ff41]">&#8599;</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {showSnapshot && (
          <>
            <div
              role="separator"
              aria-orientation={wide ? 'vertical' : 'horizontal'}
              aria-label="Drag to resize the panels"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={
                'group flex shrink-0 touch-none items-center justify-center bg-[#00ff41]/10 hover:bg-[#00ff41]/25 ' +
                (wide ? 'w-4 cursor-col-resize' : 'h-4 cursor-row-resize')
              }
            >
              <span aria-hidden="true" className="rounded-full bg-[#00ff41]/60 group-hover:bg-[#00ff41]" style={wide ? { width: 2, height: 26 } : { height: 2, width: 26 }} />
            </div>

            <div className={'flex min-h-0 min-w-0 flex-1 flex-col' + (workspace === 'snapshot' || workspace === 'support'
              ? ' fixed inset-0 z-[300] h-[100dvh] w-screen bg-[#04070a]'
              : '')}>
              {/* Owner (2026-11-23): "make it video and remote connection to phantomide
                  support" · "the right panel". The snapshot and the support call share this
                  right pane, one segmented control, same size whichever is chosen. */}
              {(workspace === 'snapshot' || workspace === 'support') && (
                <WorkspaceHeader
                  title={rightPane === 'support' ? 'Video support' : 'Snapshot · your service'}
                  onClose={() => setWorkspace(null)}
                />
              )}
              <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-2 py-2">
                {(['snapshot', 'support'] as const).map((pane) => (
                  <button
                    key={pane}
                    type="button"
                    onClick={() => {
                      setRightPane(pane)
                      // Inside a workspace the title and the video size follow the tab she
                      // picks, so the expanded pane and the embedded tab never disagree.
                      setWorkspace((open) => (open === 'snapshot' || open === 'support') ? pane : open)
                    }}
                    aria-pressed={rightPane === pane}
                    className={'min-h-[36px] flex-1 rounded border px-2 font-mono text-[11px] font-bold uppercase tracking-widest ' + (rightPane === pane
                      ? 'border-[#00ff41]/60 bg-[#00ff41]/15 text-[#00ff41]'
                      : 'border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300')}
                  >
                    {pane === 'snapshot' ? 'Snapshot' : 'Support'}
                  </button>
                ))}
                {/* One expand button for whichever tab is chosen; the workspace opens on
                    that same tab and the tab stays switchable inside it. */}
                <button
                  type="button"
                  onClick={() => setWorkspace(workspace === rightPane ? null : rightPane)}
                  aria-pressed={workspace === rightPane}
                  aria-label={(workspace === rightPane ? 'Close' : 'Expand') + ' ' + (rightPane === 'support' ? 'video support' : 'the snapshot')}
                  title={workspace === rightPane ? 'Close' : 'Expand'}
                  className="flex min-h-[36px] shrink-0 items-center justify-center rounded border border-white/20 px-2.5 font-mono text-[13px] text-gray-300 hover:bg-white/10"
                >
                  {workspace === rightPane ? '⤡' : '⤢'}
                </button>
              </div>
              {rightPane === 'support' ? (
                <SupportCall grown={workspace === 'support'} />
              ) : (
                <div className={'min-h-0 flex-1 overflow-y-auto px-3 py-3' + (workspace === 'snapshot'
                  ? ' mx-auto w-full max-w-[1100px]'
                  : '')}>
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-[#9ff5bd]">
                  {(snapshot?.lines || ['connecting…']).join('\n')}
                </pre>
                {replies.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Your replies</p>
                    <ul className="mt-1 space-y-1.5">
                      {replies.slice().reverse().map((reply) => (
                        <li key={reply.id} className="rounded-lg border border-[#00ff41]/20 bg-[#00ff41]/5 px-2.5 py-1.5">
                          <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-gray-300">{reply.body}</p>
                          <p className="mt-0.5 font-mono text-[9px] text-gray-500">{when(reply.at)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-white/10 bg-[#060b08] px-3 py-2">
        <label htmlFor="omp-notice-reply" className="sr-only">Reply to PhantomIDE</label>
        <textarea
          id="omp-notice-reply"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, feed?.maxReply || 2000))}
          rows={2}
          placeholder="Reply to PhantomIDE…"
          className="w-full resize-none rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-[12px] text-gray-100 placeholder:text-gray-600 focus:border-[#00ff41]/60 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 break-words text-[10px] leading-4 text-gray-500" role="status">{status}</p>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="shrink-0 rounded-lg border border-[#00ff41]/50 bg-[#00ff41]/15 px-3 py-1.5 font-mono text-[11px] font-bold text-[#00ff41] hover:bg-[#00ff41]/25 disabled:opacity-40"
            style={{ minHeight: 36 }}
          >
            {sending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </div>
    </section>
  )
}
