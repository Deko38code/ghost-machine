'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const LATER_KEY = 'junkalot-update-later-until'
const HEALTH_TIMEOUT_MS = 2500
const MAX_TRIES = 10
const RETRY_MS = 3000
// 2026-11-16 (owner): the pill has to show as soon as a build is ready, so the
// poll is fast while the tab is visible. /api/version is a small no-store JSON
// read and this only runs for visible tabs.
// 2026-11-18 (owner): "widget isnt firing open on update need to always show fast" —
// a tiny no-store JSON read every 2s is cheap and means a build is seen within two
// seconds instead of ten.
const POLL_MS = 2000
// 2026-11-17 (owner): the reload countdown a stale page runs before it picks up
// the served build. Named so the live bar measures against the same number.
const AUTO_SECS = 8
// Waiting for a ready build to come up after the service is handed to systemd.
const AUTO_TRIES = 15
const AUTO_RETRY_MS = 2000

// The bar label follows the actual step, so it reads as live progress rather
// than a timed animation.
// A /api/version that does not answer at all means the service, the tunnel, or
// Cloudflare is between the browser and the app. Two misses (~20s) is past a
// normal restart blip, so the pill starts reporting it.
// 2026-11-20 (owner): "says cant connect ... for like 2 sec then updates when it does catch".
// The deploy handoff measured 12:14:10-16 UTC, so two misses landed inside a normal restart.
// Third miss is past a blip; while a deploy is in flight the widget already knows a restart is due.
const OFFLINE_AFTER = 3
const OFFLINE_AFTER_DEPLOYING = 15
const RESTART_MS_KEY = 'junkalot-restart-ms'
// 2026-11-16 (owner): when the answer is simply "up to date", the pill docks to
// a small chip after ten seconds instead of sitting over the page. It never docks
// while a build is ready, while it is applying, or while the progress bar is
// running — those stay open until the bar is done.
const DOCK_AFTER_MS = 10000
// 2026-11-16 (owner): and then it tucks away into the right corner after the chip
// has had its time on screen, staying there — a slim tab with just a dot — until
// a new update is fetched, when the full card comes back out by itself.
const HIDE_AFTER_MS = 20000
// 2026-11-17 (owner): "if update is starting it shows but make to right bottom"
// and "make the update applet auto hide after update progress is done". While the
// bar runs the card parks in the bottom-right corner; once the bar reaches the end
// it leaves on its own, and the page it reloads into does not throw the full card
// back over the page.
// 2026-11-18 (owner, deployment applet spec): collapse five seconds after success.
const DONE_HIDE_MS = 5000
const RELOAD_HIDE_MS = 2500
const DONE_MARK_KEY = 'junkalot-update-done-at'

// Only ever quotes a real estimate: the measured restart time on this browser,
// or the ETA the maintenance file publishes. It never invents one.
function restartEstimate(): number | null {
  try {
    const ms = Number(localStorage.getItem(RESTART_MS_KEY) || 0)
    if (Number.isFinite(ms) && ms > 1000 && ms < 120000) return Math.round(ms / 1000)
  } catch {}
  return null
}

function rememberRestart(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 1 || seconds > 300) return
  try {
    const previous = Number(localStorage.getItem(RESTART_MS_KEY) || 0)
    // Keep the slower of the two so the estimate does not promise the best case.
    const ms = previous > 0 ? Math.max(previous, seconds * 1000) : seconds * 1000
    localStorage.setItem(RESTART_MS_KEY, String(Math.round(ms)))
  } catch {}
}

function etaLine(m: MaintenanceInfo): string {
  if (m.etaMinutes == null) return 'No restore estimate has been published yet.'
  const started = Date.parse(m.startedAt)
  const remaining = Number.isFinite(started)
    ? Math.max(0, Math.round((started + m.etaMinutes * 60000 - Date.now()) / 60000))
    : m.etaMinutes
  return remaining <= 0 ? 'Restore is due now.' : 'Estimated restore in about ' + remaining + ' min.'
}

function downLine(seconds: number, deploying = false): string {
  if (deploying) {
    return 'Applying the new build — junkalot.co is restarting. It answers again in a few seconds.'
  }
  const estimate = restartEstimate()
  const where = 'junkalot.co has not answered for ' + seconds + 's — the server is restarting, or the ' +
    'Cloudflare tunnel is not routing.'
  return estimate
    ? where + ' The last restart here took about ' + estimate + 's, so expect it back around then.'
    : where + ' No restore estimate is available yet.'
}

const STAGE_ICON: Record<string, string> = {
  checking: '●',
  current: '●',
  ready: '●',
  live: '✓',
  restored: '✓',
  maintenance: '⚙',
  offline: '⚠',
}

const STAGE_TITLE: Record<string, string> = {
  checking: 'junkalot.co — checking',
  current: 'junkalot.co is up to date',
  ready: 'Update queued',
  live: 'Update available',
  restored: 'junkalot.co is answering again',
  maintenance: 'junkalot.co is under construction',
  offline: 'junkalot.co is not answering',
}

const PHASE_LABEL: Record<string, string> = {
  ready: 'Update queued — starting the handoff',
  handoff: 'Handing the build to systemd',
  restart: 'Service restarting on the new build',
  answering: 'Waiting for the new build to answer',
  done: 'Update live — reloading into it',
  reload: 'Reloading into the new build',
}

type PendingInfo = { build: string; builtAt?: string; dir?: string; note?: string }
// 2026-11-18 (owner): deployment events from /api/deploy/events (SSE). Statuses the
// pipeline does not perform today — uploading, rolling_back, rolled_back — are part of
// the shared vocabulary but are never emitted by this box, so nothing here shows a
// transfer or a rollback that did not happen.
type DeployEvent = {
  deploymentId: string
  sequence: number
  status: string
  target?: string
  bytesTransferred?: number | null
  bytesTotal?: number | null
  timestamp?: string
  message?: string
}
const DEPLOY_WORKING: string[] = ['queued', 'installing', 'testing', 'building', 'uploading', 'verifying', 'deploying', 'rolling_back']
const SPIN_CSS = '@keyframes phantom-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.phantom-spin{animation:none !important}}' +
  // 2026-11-20 (owner): "updates smooth as butter". The widget is re-mounted for each mode, so a
  // short rise-and-fade makes the card, chip and tab arrive softly instead of snapping over the
  // page. Decorative only: it never delays a click, and reduced-motion viewers get no motion.
  '@keyframes jl-toast-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
  '#junkalot-update-toast{animation:jl-toast-rise .22s cubic-bezier(.2,.8,.2,1);will-change:transform,opacity}' +
  '@media (prefers-reduced-motion: reduce){#junkalot-update-toast{animation:none !important}}' +
  // 2026-11-20 (codex vision review): 32 px read too small from couch distance and the
  // caption repeated the number, so the ring carries the count alone and sizes itself:
  // 40 px on phones, 48 px from 1024 px wide up (desktop and TV).
  '.jl-ring{position:relative;display:inline-block;flex:none;width:40px;height:40px;line-height:1}' +
  '.jl-ring>svg{display:block;width:100%;height:100%}' +
  '.jl-ring>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#00ff41;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}' +
  '.jl-ring-tab{width:30px;height:30px}.jl-ring-tab>span{font-size:11px}' +
  '.jl-ring-chip{width:20px;height:20px}.jl-ring-chip>span{font-size:9px}' +
  '@media (min-width:1024px){.jl-ring{width:48px;height:48px}.jl-ring>span{font-size:18px}}' +
  // 2026-11-20 (codex vision review, ten-foot): at 1920x1080 the 48 px ring and
  // 11.5 px checklist were too small from a couch, and the panel sat hard against
  // the screen edges. 64 px ring, 16 px checklist, 14 px inset from 1600 px up.
  '.jl-check{font-size:11.5px;line-height:1.7}' +
  '@media (min-width:1600px){.jl-ring{width:64px;height:64px}.jl-ring>span{font-size:24px}.jl-check{font-size:16px;line-height:1.6}}' +
  '@media (min-width:1024px){#junkalot-update-toast{right:14px !important;bottom:14px !important}}'
type MaintenanceInfo = { active: boolean; message: string; etaMinutes: number | null; startedAt: string }
type LastApplyInfo = { at: string; build: string; attempts: number }
// The server's own progress state (src/lib/update-state.ts). The same numbers
// feed the haksterai.com and phantomide.com admin bars, so when this is present
// it wins over anything this tab has worked out for itself.
export type SharedUpdateState = {
  phase: string
  progress: number
  label: string
  target: string | null
  attempts: number
  at: string | null
  message: string
  checkedAt: string
  // 2026-11-17 (owner): real size of the build on disk, measured server-side
  // from its own files. Never a guess, and never counted as a download.
  bytes?: number | null
}
// Owner (2026-11-20): the result of the portfolio image guard, written on this
// box at build time by scripts/portfolio-guard.mjs. Read, never recomputed here.
type PortfolioGuard = {
  checkedAt: string
  status: 'ok' | 'fail'
  entries: number
  variantsExpected: number
  variantsPresent: number
  // Exact counts from the checker (2026-11-21). The arrays below are capped for
  // display; these numbers always describe the whole set.
  variantsMissing?: number
  variantsUnreadable?: number
  variantsSmallerThanSlot?: number
  missing?: string[]
  unreadable?: string[]
  smallerThanSlot?: string[]
  // Older build-time snapshots used wrongWidth for the same fact.
  wrongWidth?: string[]
}
type VersionInfo = {
  build: string
  builtAt?: string
  // 2026-11-18 (owner): what the build is for, written when it was staged.
  note?: string
  pending?: PendingInfo | null
  maintenance?: MaintenanceInfo | null
  lastApply?: LastApplyInfo | null
  update?: SharedUpdateState | null
  portfolio?: PortfolioGuard | null
}
type Action = 'seen' | 'later' | 'update' | 'reload' | 'waiting' | 'ready'

// "Later" postpones for 30 minutes, but only for the build it was pressed on:
// a newer build still announces itself. Older stored values are a bare
// timestamp and keep working.
function laterUntil(buildId: string): number {
  try {
    const raw = localStorage.getItem(LATER_KEY) || ''
    if (!raw) return 0
    if (raw.charAt(0) === '{') {
      const v = JSON.parse(raw)
      const until = Number(v?.until || 0)
      if (!Number.isFinite(until)) return 0
      if (v?.build && buildId && v.build !== buildId) return 0
      return until
    }
    const until = Number(raw)
    return Number.isFinite(until) ? until : 0
  } catch {
    return 0
  }
}

function setLater(buildId: string) {
  try {
    localStorage.setItem(LATER_KEY, JSON.stringify({ until: Date.now() + 30 * 60 * 1000, build: buildId }))
  } catch {}
}

function clearLater() {
  try { localStorage.removeItem(LATER_KEY) } catch {}
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// 2026-11-16 (owner): the install readout prints only measured numbers.
// NET_WINDOW_MS is the sliding window the transfer rate is taken over.
const NET_WINDOW_MS = 6000
function secsLabel(secs: number): string {
  const total = Math.max(0, Math.round(secs))
  if (total < 60) return total + 's'
  return Math.floor(total / 60) + 'm ' + pad(total % 60) + 's'
}
function bytesLabel(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return Math.round(n) + ' B'
}
function rateLabel(bytesPerSecond: number): string {
  return bytesLabel(bytesPerSecond) + '/s'
}

// Full local stamp, e.g. "2026-11-16 15:39:22 +0845".
function localStamp(d = new Date()) {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
}

function utcStamp(iso?: string) {
  const t = Date.parse(iso || '')
  if (!Number.isFinite(t)) return ''
  return new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

// 2026-11-17 (owner): the card spoke in shorthand ("7m ago" / "nothing newer
// on the server"). Same measured timestamps, said as plain words so the line
// reads like a sentence.
function agoWords(secs: number): string {
  if (secs < 10) return 'just now'
  if (secs < 60) return secs + ' seconds ago'
  if (secs < 3600) {
    const m = Math.round(secs / 60)
    return m + (m === 1 ? ' minute ago' : ' minutes ago')
  }
  if (secs < 86400) {
    const h = Math.round(secs / 3600)
    return h + (h === 1 ? ' hour ago' : ' hours ago')
  }
  const d = Math.round(secs / 86400)
  return d + (d === 1 ? ' day ago' : ' days ago')
}

function ago(iso?: string) {
  const t = Date.parse(iso || '')
  if (!Number.isFinite(t)) return ''
  return agoWords(Math.max(0, Math.round((Date.now() - t) / 1000)))
}

// 2026-11-18 (owner): the update card names the server it checks, so the line
// reads "Nothing pending from server phantomide.com" instead of "the server".
const UPDATE_SERVER = 'phantomide.com'

// The resting line: nothing pending, and what is served. It only states what
// the last /api/version answer reported — as a full sentence.
function upToDateLine(info: VersionInfo): string {
  const agoText = ago(info.builtAt)
  const built = utcStamp(info.builtAt)
  const when = agoText && built
    ? 'built ' + agoText + ', ' + built
    : built
      ? 'built ' + built
      : agoText
        ? 'built ' + agoText
        : ''
  return 'Nothing pending from server ' + UPDATE_SERVER +
    ' — this site is on the newest build (' + info.build.slice(0, 12) + ')' +
    (when ? ', ' + when : '') + '.'
}

  // Time to the next version check, straight from the poll's own timestamp (2 s cadence), shown to a tenth so it eases down instead of flickering.
let lastPollAt = 0
function NextCheckClock() {
  const [, force] = useState(0)
  useEffect(() => {
    // 100 ms ticks with a tenths value: the 2 s poll no longer snaps the clock
    // between 2s and 0s (codex review 2026-11-20).
    const id = window.setInterval(() => { if (!document.hidden) force((n) => n + 1) }, 100)
    return () => window.clearInterval(id)
  }, [])
  if (!lastPollAt) return <>checking…</>
  const left = Math.max(0, (POLL_MS - (Date.now() - lastPollAt)) / 1000)
  return <>next check in {left.toFixed(1)}s</>
}


// 2026-11-20 (owner, "add the ring under my ghost with real sec to update fires
// open ... when queing"): the ring is drawn from the same measured countdown the
// copy prints, so the arc and the number always agree. It only exists while an
// update is actually queued (countdown > 0) — never a decorative animation.
// 2026-11-20 (owner, "add the ring under my ghost with real sec to update fires
// open ... when queing"; then "have codex rweak it"): the ring is drawn from the
// same measured countdown the copy prints, so the arc and the number always agree.
// It only exists while an update is actually queued (countdown > 0) — never a
// decorative animation. Size comes from .jl-ring in SPIN_CSS so it grows on TV.
function CountdownRing({ countdown, variant = 'card' }: { countdown: number; variant?: 'card' | 'tab' | 'chip' }) {
  const total = Math.max(1, AUTO_SECS)
  const left = Math.max(0, Math.min(total, countdown))
  const circumference = 2 * Math.PI * 44
  const done = (total - left) / total
  return (
    <span aria-hidden="true" className={'jl-ring' + (variant === 'card' ? '' : ' jl-ring-' + variant)}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,255,65,.2)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#00ff41"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - done)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .35s linear' }}
        />
      </svg>
      <span>{left}</span>
    </span>
  )
}

export default function UpdateToast() {
  const [detail, setDetail] = useState('Connecting to junkalot.co…')
  // 2026-11-18 (owner): what the build on screen is for, straight from the note
  // written when it was staged. Empty when no note exists — never invented.
  const [buildNote, setBuildNote] = useState('')
  // 2026-11-18 (owner): the applet follows the deployment event stream. A snapshot is
  // sent on connect, so a reconnect restores the true state; (deploymentId, sequence)
  // dedupes a replayed event. The 2s version poll stays as the fallback.
  const [deploy, setDeploy] = useState<DeployEvent | null>(null)
  const deploySeen = useRef<Set<string>>(new Set())
  const deployAutoOpened = useRef('')
  const [busy, setBusy] = useState<'' | 'update' | 'waiting'>('')
  // checkUpdate owns the poll timer, so it reads the live install flag
  // through a ref instead of a stale closure capture.
  const busyRef = useRef<'' | 'update' | 'waiting'>('')
  // True while a deploy is genuinely in flight; a restart then is expected, not an outage.
  const deployingRef = useRef(false)
  // 2026-11-16 (owner): the widget has to be on screen all the time — at every
  // load and through every route change — not only when a refresh happens to
  // catch a new build. 'checking' is the first paint before any answer;
  // 'current' is the resting state (this page is on the served build and
  // nothing newer exists); 'ready' = a build is finished but not served yet;
  // 'live' = the server has switched to it, so a reload picks it up.
  const [stage, setStage] = useState<'checking' | 'current' | 'ready' | 'live' | 'restored' | 'maintenance' | 'offline'>('checking')
  const pageBuild = useRef('')
  const latestBuild = useRef('')
  const announced = useRef('')
  const readyCurrent = useRef('')
  const liveArmed = useRef('')
  const autoTimer = useRef<number | null>(null)
  const tickTimer = useRef<number | null>(null)
  const autoApplyRef = useRef<() => void>(() => {})
  const readyApplyRef = useRef<() => void>(() => {})
  const readyApplying = useRef(false)
  const gaveUp = useRef('')
  const misses = useRef(0)
  const downSince = useRef(0)
  // 2026-11-16 (owner): live install numbers — elapsed, and the bytes this
  // card really moved. The counters reset when an install starts.
  const busySince = useRef(0)
  const netTotals = useRef({ up: 0, down: 0 })
  const netSamples = useRef<{ at: number; up: number; down: number }[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [net, setNet] = useState({ up: 0, down: 0, upTotal: 0, downTotal: 0 })
  // Real size of the build that is being applied, as the server measured it.
  const [buildBytes, setBuildBytes] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [portfolio, setPortfolio] = useState<PortfolioGuard | null>(null)
  // 2026-11-18 (owner): "the auto update is stuck ... not counting down stuck on
  // 8 sec". The tick used to bail out whenever ANY text field had focus, and the
  // admin page autofocuses Mr Ed's prompt, so the countdown froze on its first
  // value and the card never said why. The pause is now explicit and named.
  const [autoPaused, setAutoPaused] = useState<'' | 'typing' | 'hidden'>('')
  const [progress, setProgress] = useState(0)
  // Which real step the bar is reporting — the label comes from this, never
  // from a timer.
  const [phase, setPhase] = useState<'' | 'ready' | 'handoff' | 'restart' | 'answering' | 'done' | 'reload'>('')
  // 'card' is the full pill, 'chip' the docked line in the bottom-right corner,
  // 'tab' the slim handle it tucks into at the right edge once it has had its
  // time on screen. The tab is only ever the resting "up to date" state; a new
  // update (or a problem) puts the full card back. hideArm re-arms both timers
  // after a manual expand, so it settles again but never while it is working.
  // 2026-11-17 (owner): "only on updates and etc it pops" — the applet starts
  // as the slim corner tab, and the full card opens itself only when there is
  // something to say.
  const [mode, setMode] = useState<'card' | 'chip' | 'tab'>('tab')
  // Set once someone clicks the tab, so the card they opened settles on the
  // normal schedule instead of snapping shut.
  const interacted = useRef(false)
  const [hideArm, setHideArm] = useState(0)
  // 2026-11-17 (owner): auto-hide once the update bar has finished.
  const [doneHidden, setDoneHidden] = useState(false)
  const wasBusy = useRef(false)

  // 2026-11-16 (owner): the update pill still shows, but the update is applied
  // on its own. A short visible countdown runs first, and it never reloads while
  // the tab is hidden or the person is typing in a field.
  const stopAuto = useCallback(() => {
    if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null }
    if (tickTimer.current !== null) { window.clearInterval(tickTimer.current); tickTimer.current = null }
    setCountdown(0)
    setAutoPaused('')
  }, [])

  // One sample per request that actually moves bytes; the ticker below turns
  // the trailing window into a rate. Totals are what this tab has moved.
  const netAdd = useCallback((up: number, down: number) => {
    netTotals.current.up += Math.max(0, up)
    netTotals.current.down += Math.max(0, down)
    netSamples.current.push({ at: Date.now(), up: netTotals.current.up, down: netTotals.current.down })
    if (netSamples.current.length > 60) netSamples.current.shift()
  }, [])

  // While an install is running, count the seconds and recompute the rate
  // once a second. Nothing here is a fake timer: the rate is the bytes this
  // card moved in the last NET_WINDOW_MS, and it resets with each install.
  useEffect(() => {
    busyRef.current = busy
    if (!busy) {
      busySince.current = 0
      netTotals.current = { up: 0, down: 0 }
      netSamples.current = []
      setElapsed(0)
      setNet({ up: 0, down: 0, upTotal: 0, downTotal: 0 })
      setBuildBytes(0)
      return
    }
    if (!busySince.current) busySince.current = Date.now()
    const tick = () => {
      const now = Date.now()
      setElapsed(Math.max(0, Math.round((now - busySince.current) / 1000)))
      const samples = netSamples.current
      const last = samples[samples.length - 1]
      const first = samples.find((s) => now - s.at <= NET_WINDOW_MS) || samples[0]
      const span = last && first ? (last.at - first.at) / 1000 : 0
      setNet({
        up: span > 0 && last && first ? (last.up - first.up) / span : 0,
        down: span > 0 && last && first ? (last.down - first.down) / span : 0,
        upTotal: netTotals.current.up,
        downTotal: netTotals.current.down,
      })
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [busy])

  // Mirror the page's build id into <meta name="junkalot-build"> so it is
  // visible to the toast and to anyone inspecting the page. A build-time-baked
  // value cannot be trusted with the per-deploy distDir workflow, so the first
  // successful /api/version response for this page defines it.
  const setMeta = useCallback((build: string) => {
    try {
      let el = document.querySelector('meta[name="junkalot-build"]') as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.name = 'junkalot-build'
        document.head.appendChild(el)
      }
      el.content = build
    } catch {
      // Head access can throw in unusual environments — the toast still works.
    }
  }, [])

  const log = useCallback((action: Action, buildOverride?: string) => {
    try {
      const body = JSON.stringify({
        action,
        build: buildOverride || latestBuild.current || '',
        from: pageBuild.current || '',
        path: location.pathname,
        atLocal: localStamp(),
      })
      netAdd(body.length, 0)
      fetch('/api/update-log', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Never let logging break the page.
    }
  }, [netAdd])

  const fetchVersion = useCallback(async (timeoutMs = 4000): Promise<VersionInfo | null> => {
    lastPollAt = Date.now()
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch('/api/version?t=' + Date.now(), {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: ctrl.signal,
      })
      if (!res.ok) return null
      const text = await res.text()
      netAdd(0, text.length)
      const data = JSON.parse(text)
      if (!data || !data.build) return null
      const pending = data.pending && data.pending.build
        ? {
            build: String(data.pending.build),
            builtAt: data.pending.builtAt ? String(data.pending.builtAt) : undefined,
            dir: data.pending.dir ? String(data.pending.dir) : undefined,
            note: data.pending.note ? String(data.pending.note).slice(0, 400) : undefined,
          }
        : null
      const maintenance = data.maintenance && data.maintenance.active
        ? {
            active: true,
            message: String(data.maintenance.message || 'Currently under construction.'),
            etaMinutes: Number.isFinite(Number(data.maintenance.etaMinutes))
              ? Number(data.maintenance.etaMinutes)
              : null,
            startedAt: String(data.maintenance.startedAt || ''),
          }
        : null
      return {
        build: String(data.build),
        builtAt: data.builtAt ? String(data.builtAt) : undefined,
        note: data.note ? String(data.note).slice(0, 400) : undefined,
        pending,
        maintenance,
        lastApply: data.lastApply && data.lastApply.at
          ? { at: String(data.lastApply.at), build: String(data.lastApply.build || ''), attempts: Number(data.lastApply.attempts) || 0 }
          : null,
        update: data.update && data.update.phase
          ? {
              phase: String(data.update.phase),
              progress: Math.max(0, Math.min(100, Number(data.update.progress) || 0)),
              label: String(data.update.label || ''),
              target: data.update.target ? String(data.update.target) : null,
              attempts: Number(data.update.attempts) || 0,
              at: data.update.at ? String(data.update.at) : null,
              message: String(data.update.message || ''),
              checkedAt: String(data.update.checkedAt || ''),
              bytes: Number.isFinite(Number(data.update.bytes)) ? Number(data.update.bytes) : null,
            }
          : null,
        // 2026-11-20: fetchVersion rebuilds the answer field by field, so the
        // portfolio guard result has to be carried through explicitly or the
        // checklist always reports "no build has run the guard yet".
        portfolio: data.portfolio && (data.portfolio.status === 'ok' || data.portfolio.status === 'fail')
          ? {
              checkedAt: String(data.portfolio.checkedAt || ''),
              status: data.portfolio.status === 'ok' ? 'ok' as const : 'fail' as const,
              entries: Number(data.portfolio.entries) || 0,
              variantsExpected: Number(data.portfolio.variantsExpected) || 0,
              variantsPresent: Number(data.portfolio.variantsPresent) || 0,
              variantsMissing: Number(data.portfolio.variantsMissing) || 0,
              variantsUnreadable: Number(data.portfolio.variantsUnreadable) || 0,
              variantsSmallerThanSlot: Number(data.portfolio.variantsSmallerThanSlot) || 0,
              missing: Array.isArray(data.portfolio.missing) ? data.portfolio.missing.slice(0, 20).map(String) : [],
              unreadable: Array.isArray(data.portfolio.unreadable) ? data.portfolio.unreadable.slice(0, 20).map(String) : [],
              smallerThanSlot: Array.isArray(data.portfolio.smallerThanSlot) ? data.portfolio.smallerThanSlot.slice(0, 20).map(String) : [],
              wrongWidth: Array.isArray(data.portfolio.wrongWidth) ? data.portfolio.wrongWidth.slice(0, 20).map(String) : [],
            }
          : null,
      }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }, [netAdd])

  // Capture the build this page is running now, then mirror it into the meta tag.
  useEffect(() => {
    let alive = true
    const hint = document.querySelector('meta[name="junkalot-build"]')?.getAttribute('content') || ''
    if (hint && hint !== 'pending') {
      pageBuild.current = hint
      setMeta(hint)
    }
    ;(async () => {
      const info = await fetchVersion()
      if (!alive || !info) return
      if (!pageBuild.current) pageBuild.current = info.build
      latestBuild.current = info.build
    setPortfolio(info.portfolio ?? null)
      setMeta(pageBuild.current)
    })()
    return () => {
      alive = false
    }
  }, [fetchVersion, setMeta])

  const checkUpdate = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    const info = await fetchVersion()

    // No answer at all: restart blip, tunnel, or Cloudflare. Nothing can be
    // asked, so the pill reports what it actually knows.
    if (!info) {
      misses.current += 1
      const offlineAfter = deployingRef.current ? OFFLINE_AFTER_DEPLOYING : OFFLINE_AFTER
      if (misses.current >= offlineAfter) {
        if (!downSince.current) downSince.current = Date.now()
        const secs = Math.round((Date.now() - downSince.current) / 1000)
        setStage('offline')
        setBusy('')
        setPhase('')
        setProgress(0)
        setDetail(downLine(secs, deployingRef.current))
        if (announced.current !== 'offline') {
          announced.current = 'offline'
          log('waiting')
        }
      }
      return
    }

    // Answering again after an outage: say so, then carry on.
    if (misses.current >= (deployingRef.current ? OFFLINE_AFTER_DEPLOYING : OFFLINE_AFTER) && downSince.current) {
      const secs = Math.max(1, Math.round((Date.now() - downSince.current) / 1000))
      rememberRestart(secs)
      setStage('restored')
      setDetail('junkalot.co is answering again after ' + secs + 's on build ' + info.build + '.')
      window.setTimeout(() => {
        // The pill never disappears — it settles back into the resting state.
        if (busy) return
        setStage('current')
        setDetail(upToDateLine(info))
      }, 9000)
    }
    misses.current = 0
    downSince.current = 0

    latestBuild.current = info.build
    setPortfolio(info.portfolio ?? null)
    // Cleared every check, and set again only where a note applies.
    setBuildNote('')

    // 2026-11-17 (owner): while an update is on screen the bar follows the
    // server's published stage — files on this box — not a timer in this tab.
    if (busyRef.current && info.update && !info.maintenance) {
      const ph = info.update.phase
      if (ph === 'handoff') { setPhase('handoff'); setProgress(info.update.progress) }
      else if (ph === 'restarting') { setPhase('restart'); setProgress(info.update.progress) }
      else if (ph === 'answering') { setPhase('answering'); setProgress(info.update.progress) }
      else if (ph === 'done') { setPhase('done'); setProgress(100) }
    }
    if (info.update && Number(info.update.bytes) > 0) setBuildBytes(Number(info.update.bytes))

    // Maintenance outranks everything: there is nothing to apply and reloading
    // would not help, so state it plainly with the published ETA.
    if (info.maintenance) {
      setStage('maintenance')
      stopAuto()
      setBusy('')
      setPhase('')
      setProgress(0)
      setDetail(info.maintenance.message + ' ' + etaLine(info.maintenance))
      return
    }

    // 2026-11-17 (owner): the first answer for a fresh page defines the page's
    // build and then keeps going, so a build that is already queued pops on
    // this same check instead of waiting out a whole poll.
    if (!pageBuild.current) {
      pageBuild.current = info.build
      setMeta(info.build)
    }

    // Stage 2 — a build is ready but the service has not switched to it yet.
    // Announce it and apply it on its own: no click, and a live progress bar
    // driven by real checks rather than a timer.
    if (info.build === pageBuild.current) {
      const ready = info.pending
      // Applied already and still on the old build: say what happened instead
      // of firing again.
      if (!ready || !ready.build) {
        if (busy) {
          setBusy('')
          setProgress(0)
          setStage('current')
          setDetail('The build did not take over after the restart. It will retry on the next check.')
          log('waiting')
        } else {
          setStage('current')
          setDetail(upToDateLine(info))
        }
        return
      }
      if (gaveUp.current === ready.build) return
      if (readyCurrent.current === ready.build && (busy || busyRef.current)) return
      if (readyCurrent.current !== ready.build) {
        readyCurrent.current = ready.build
        const readyBuilt = ready.build.slice(0, 12)
        const readyAgo = ago(ready.builtAt)
        stopAuto()
        if (Date.now() >= laterUntil(ready.build)) {
          setStage('ready')
          // 2026-11-17 (owner): "when update is ready want pill to fire
          // with live bar data". The bar opens the moment a build is
          // ready and follows the server's own stage numbers; the
          // rates, bytes and elapsed time under it are all measured.
          setBusy('waiting')
          setPhase('ready')
          setProgress(info.update && info.update.phase === 'ready' ? info.update.progress : 10)
          setDetail('Update queued from server ' + UPDATE_SERVER + ' — build ' + readyBuilt +
            ' finished ' + (readyAgo || 'just now') + '. It applies itself automatically, no click needed.')
          setBuildNote(ready.note || '')
        } else {
          // Postponed on purpose: the pill stays, in its resting state, and says so.
          setStage('current')
          setDetail('Update queued from server ' + UPDATE_SERVER + ' — build ' + readyBuilt +
            ' finished ' + (readyAgo || 'just now') + '; holding for the rest of the 30 minutes.')
        }
        log('ready', ready.build)
      }
      if (Date.now() >= laterUntil(ready.build)) readyApplyRef.current()
      return
    }

    // Stage 1 — the server is serving a newer build than this page.
    // 2026-11-17 (owner): the update this card was tracking has landed, so
    // finish the bar honestly (100 only when the server reports the new
    // build) and reload into it.
    if (busyRef.current) {
      setPhase('done')
      setProgress(100)
      setDetail('Update live: the server is serving the new build. Reloading into it now.')
      log('reload')
      // 2026-11-17 (owner): the page we reload into knows the update just finished,
      // so it docks instead of parking the full card over the page again.
      try { sessionStorage.setItem(DONE_MARK_KEY, String(Date.now())) } catch {}
      window.setTimeout(() => window.location.reload(), 900)
      return
    }
    const agoText = ago(info.builtAt)
    const seenLocal = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    setStage('live')
    setDetail('The server is serving a newer build (' + info.build.slice(0, 12) + ')' +
      (agoText ? ', built ' + agoText : '') + '. This page noticed at ' + seenLocal +
      ' and logged it to junkalot, phantomide and haksterai.')
    setBuildNote(info.note || '')

    if (readyCurrent.current !== info.build) readyCurrent.current = info.build
    const deferred = Date.now() < laterUntil(info.build)
    // Arm the countdown once per build. A re-poll (now every 10s) must not reset
    // a countdown that is already running, or it would never reach zero.
    if (!deferred && liveArmed.current !== info.build) {
      liveArmed.current = info.build
      stopAuto()
      const typing = () => {
        const a = document.activeElement as HTMLElement | null
        if (!a) return false
        const tag = (a.tagName || '').toUpperCase()
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable === true
      }
      // Deadline-based, so a missed or throttled tick cannot freeze the count.
      // 2026-11-18 (owner): "make sure the auto apply update always starts counts
      // down" — the number always runs. Zero is where it stops counting, not where
      // it stops working: if a text field has the cursor, or this tab is hidden, the
      // apply waits at zero and fires the moment that is no longer true.
      const deadline = Date.now() + AUTO_SECS * 1000
      setCountdown(AUTO_SECS)
      setAutoPaused('')
      tickTimer.current = window.setInterval(() => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        setCountdown(left)
        if (left > 0) { setAutoPaused(''); return }
        if (document.visibilityState !== 'visible') { setAutoPaused('hidden'); return }
        if (typing()) { setAutoPaused('typing'); return }
        setAutoPaused('')
        stopAuto()
        autoApplyRef.current()
      }, 1000)
    }

    if (announced.current !== info.build) {
      announced.current = info.build
      log('seen')
    }
  }, [fetchVersion, log, setMeta, stopAuto])

  useEffect(() => {
    // Check early and often so a fresh build shows its pill on every open tab
    // the moment it is ready. /api/version is a tiny no-store JSON read and the
    // poll only runs while the tab is visible, so 10s is cheap.
    // 2026-11-17 (owner): "make popout on startup" — the first check runs as
    // soon as the page is up, so a queued build pops on load.
    // 2026-11-18 (owner): "always show fast" — first check at 150ms, and a check
    // the moment the tab is focused or restored, so the card is never late.
    // 2026-11-22 (owner): "make sure updates get pushed to widget even with pwa
    // installs". An installed app is resumed rather than navigated, and its
    // timers can be frozen in the background; a check also runs on resume, when
    // the network returns, and when a new service worker takes control, so the
    // pill appears in the installed app the same way it does in a tab.
    const first = window.setTimeout(checkUpdate, 150)
    const interval = window.setInterval(checkUpdate, POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkUpdate()
    }
    const onController = () => checkUpdate()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    window.addEventListener('pageshow', onVisibility)
    window.addEventListener('resume', onVisibility)
    window.addEventListener('online', onVisibility)
    try { navigator.serviceWorker?.addEventListener('controllerchange', onController) } catch {}
    return () => {
      clearTimeout(first)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.removeEventListener('pageshow', onVisibility)
      window.removeEventListener('resume', onVisibility)
      window.removeEventListener('online', onVisibility)
      try { navigator.serviceWorker?.removeEventListener('controllerchange', onController) } catch {}
    }
  }, [checkUpdate])

  // Never reload blind: confirm the server answers before reloading, and poll
  // through a restart instead of landing on a dead page. The percentages are the
  // shared stage numbers from src/lib/update-state.ts (handoff 30, restarting 60,
  // answering 85, done 100) so this bar and the haksterai/phantomide admin bars
  // read the same value for the same stage.
  const updateNow = useCallback(async () => {
    if (busy) return
    stopAuto()
    setStage('live')
    setBusy('update')
    setPhase('handoff')
    setProgress(30)
    log('update')
    clearLater()

    const healthy = await fetchVersion(HEALTH_TIMEOUT_MS)
    if (healthy && healthy.build === latestBuild.current) {
      setPhase('reload')
      setProgress(100)
      log('reload')
      window.location.reload()
      return
    }

    setBusy('waiting')
    setPhase('restart')
    setProgress(60)
    log('waiting')
    for (let i = 0; i < MAX_TRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, RETRY_MS))
      const again = await fetchVersion(HEALTH_TIMEOUT_MS)
      if (again) {
        if (again.build !== pageBuild.current) {
          setPhase('reload')
          setProgress(100)
          log('reload')
          window.location.reload()
          return
        }
        // Answering, but still on the page's build: report the shared
        // 'answering' stage (85) and keep polling rather than claim 100.
        setPhase('answering')
        setProgress(again.update && again.update.phase === 'answering' ? again.update.progress : 85)
        continue
      }
      setPhase('restart')
      setProgress(60)
    }
    setBusy('')
    setPhase('')
    setProgress(0)
    setDetail('The server is still restarting — press Update now again in a moment.')
  }, [busy, fetchVersion, log, stopAuto])

  // Apply a ready build with no click. The service has Restart=always, so the
  // server hands itself back to systemd and comes up on the ready build; the
  // progress bar follows real checks and only reaches 100 when the new build is
  // the one actually answering.
  const autoApply = useCallback(async () => {
    const target = readyCurrent.current
    if (!target || readyApplying.current) return
    readyApplying.current = true
    stopAuto()
    setStage('ready')
    setBusy('update')
    setPhase('handoff')
    setProgress(30)
    setDetail('Build ' + target + ' is ready. Applying it now — no click needed.')
    log('update', target)

    let data: any = null
    try {
      const res = await fetch('/api/admin/apply-update', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      data = await res.json().catch(() => null)
      if (!res.ok || !data?.applied) {
        readyApplying.current = false
        // 2026-11-17 (owner): the build applies itself on the server, so a
        // visitor without the apply permission still gets the live bar — it
        // follows the handoff instead of starting it.
        if (res.status === 401) {
          setBusy('waiting')
          setPhase('ready')
          setProgress(10)
          setDetail('Update queued from server ' + UPDATE_SERVER + ' — build ' + target.slice(0, 12) + ' is ready; the server applies it on its own and this page is following it live.')
          log('waiting', target)
          return
        }
        setBusy('')
        setPhase('')
        setProgress(0)
        if (data?.reason === 'gave_up') {
          // Stop retrying this build from every tab; only a newer build resets it.
          gaveUp.current = target
          setDetail('Build ' + target + ' did not start after ' + (data.attempts || 3) +
            ' tries, so the service was left on the current build.')
        } else {
          setDetail('Build ' + target + ' is ready. The handoff is cooling down and retries on the next check.')
        }
        log('waiting', target)
        return
      }
    } catch {
      // The service may be mid-restart, which is exactly when the bar matters,
      // so keep following it instead of closing the card.
      readyApplying.current = false
      setBusy('waiting')
      setPhase('restart')
      setProgress(60)
      setDetail('Build ' + target.slice(0, 12) + ': the server is not answering this instant — following the handoff.')
      return
    }

    setBusy('waiting')
    setPhase('restart')
    setProgress(60)
    for (let i = 0; i < AUTO_TRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, AUTO_RETRY_MS))
      const info = await fetchVersion(HEALTH_TIMEOUT_MS)
      if (info && info.build === target) {
        setPhase('reload')
        setProgress(100)
        log('reload', target)
        window.location.reload()
        return
      }
      if (info) {
        // Answering but still not on the target: the shared 'answering' stage,
        // at the number the server itself reports when it has one.
        setPhase('answering')
        setProgress(info.update && info.update.target === target ? info.update.progress : 85)
        if (info.update?.message) setDetail(info.update.message)
        continue
      }
      // No answer this round: still inside the restart.
      setPhase('restart')
      setProgress(60)
    }
    readyApplying.current = false
    setBusy('')
    setPhase('')
    setProgress(0)
    setDetail('Build ' + target + ' is taking longer than expected to come up. This page keeps checking.')
  }, [fetchVersion, log, stopAuto])

  const later = useCallback(() => {
    stopAuto()
    // Postpone the build being announced, not every future one.
    setLater(stage === 'ready' ? (readyCurrent.current || latestBuild.current) : latestBuild.current)
    log('later')
    // Always rendered, so "Later" settles the pill back into its resting state
    // instead of making it disappear.
    setStage('current')
    setDetail('Update postponed for 30 minutes. This window keeps checking and the pill stays here.')
  }, [log, stage, stopAuto])

  useEffect(() => { autoApplyRef.current = updateNow }, [updateNow])
  useEffect(() => { readyApplyRef.current = autoApply }, [autoApply])
  useEffect(() => () => stopAuto(), [stopAuto])

  // Green for a build that is ready / live / just recovered, amber when the site
  // is being worked on or is not answering at all.
  const warn = stage === 'maintenance' || stage === 'offline'
  const accent = warn ? '#fbbf24' : '#00ff88'
  const accentBorder = warn ? 'rgba(251,191,36,.45)' : 'rgba(0,255,136,.45)'
  const accentBg = warn ? 'rgba(251,191,36,.14)' : 'rgba(0,255,136,.12)'
  const actionable = stage === 'ready' || stage === 'live' || stage === 'restored'
  // The resting state stays on screen but takes less room and less shadow, so a
  // permanent widget does not sit on top of the page like a notice.
  const resting = !actionable && !busy && (stage === 'current' || stage === 'checking')
  // Only "up to date" docks. Ready, live, restored, applying, maintenance and
  // offline all stay open — a new update is never hidden, and neither is a
  // problem — until the progress bar has run to the end.
  // 2026-11-17 (owner): 'checking' counts as resting too, so a page that loads
  // with nothing to report never flashes a full card before the first answer.
  const dockable = !actionable && !busy && (stage === 'current' || stage === 'checking')
  // 2026-11-17 (owner): "always with our live bar" — the bar belongs to the
  // popout in every active state, not only while the install is applying. In
  // the 'live' state it measures the real reload countdown; nothing here is
  // synthesized.
  const barVisible = !!busy || stage === 'ready' || stage === 'live'
  const barValue = busy
    ? progress
    : stage === 'live'
      ? (countdown > 0 || autoPaused !== ''
          ? Math.max(0, Math.min(100, Math.round(((AUTO_SECS - countdown) / AUTO_SECS) * 100)))
          : 0)
      : progress
  const barLabel = busy
    ? (PHASE_LABEL[phase] || 'Applying update')
    : stage === 'live'
      ? autoPaused === 'typing'
        ? 'Countdown done — waiting for the cursor to leave the field'
        : autoPaused === 'hidden'
          ? 'Countdown done — waiting for this tab to be visible'
          : (countdown > 0 ? 'Waiting for the reload' : 'Holding — update postponed')
      : (PHASE_LABEL[phase] || 'Update queued')
  // 2026-11-18 (owner, "real counts timers no fabs ever"): only the live reload countdown is
  // a real measurement. Every other bar state is indeterminate and shows no percentage —
  // the server's phase progress is a fixed constant per phase, not measured work.
  const barIndeterminate = stage !== 'live'
  const servedBuild = latestBuild.current || pageBuild.current || ''
  // Only a real measurement becomes a countdown: the last restart timed on
  // this browser. With none, the card says so instead of guessing.
  const restartSecs = busy ? restartEstimate() : null
  const etaText = restartSecs == null
    ? '⏳ no estimate yet'
    : elapsed < restartSecs
      ? '⏳ ≈ ' + secsLabel(restartSecs - elapsed) + ' left'
      : '⏳ past the ' + secsLabel(restartSecs) + ' estimate'

  // 2026-11-17 (owner): bottom-corner time tracking. Every value here is
  // measured, never synthesized: the armed auto-apply seconds the server's
  // build is counting down, or the elapsed and remaining time against the
  // last restart actually timed on this browser. With no measurement the
  // corner stays empty. The title says which measurement is in use.
  const cornerClock = busy
    ? restartSecs != null
      ? elapsed < restartSecs
        ? '⏳ ' + secsLabel(restartSecs - elapsed) + ' left'
        : '⏳ ' + secsLabel(elapsed) + ' elapsed'
      : '⏱ ' + secsLabel(elapsed)
    : autoPaused === 'typing'
      ? '⏸ ready — waiting for the field'
      : autoPaused === 'hidden'
        ? '⏸ ready — waiting for the tab'
        : countdown > 0
          ? '⏳ auto in ' + countdown + 's'
          : ''
  const cornerClockTitle = busy
    ? restartSecs != null
      ? 'Elapsed against the last restart timed on this browser (' + secsLabel(restartSecs) + ').'
      : 'No restart has been measured on this browser yet, so this is elapsed time only, not an estimate.'
    : 'Real countdown to the armed auto-apply. Later postpones 30 minutes.'

  useEffect(() => {
    if (!dockable) { setMode('card'); return }
    // 2026-11-17 (owner): "only on updates and etc it pops" — a resting page goes
    // straight to the corner tab. The card only opens for a queued build, a live
    // update, a recovery, maintenance, an outage, or a click on the tab.
    if (!interacted.current) { setMode('tab'); return }
    const toChip = window.setTimeout(() => setMode('chip'), DOCK_AFTER_MS)
    const toTab = window.setTimeout(() => setMode('tab'), DOCK_AFTER_MS + HIDE_AFTER_MS)
    return () => {
      window.clearTimeout(toChip)
      window.clearTimeout(toTab)
    }
  }, [dockable, hideArm])

  // 2026-11-17 (owner): "make the update applet auto hide after update progress is
  // done" — when the bar reaches the end the applet leaves on its own. A new build
  // or a problem brings the full card straight back; nothing else is hidden.
  const finished = !busy && (phase === 'done' || stage === 'restored')
  useEffect(() => {
    if (!finished) return
    const t = window.setTimeout(() => setDoneHidden(true), DONE_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [finished])
  useEffect(() => {
    if (busy) { wasBusy.current = true; setDoneHidden(false); return }
    if (!wasBusy.current) return
    wasBusy.current = false
    const t = window.setTimeout(() => setDoneHidden(true), DONE_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [busy])
  // A page that loads right after an update starts docked instead of covering the
  // page, and leaves again shortly after the build it reloaded into answers.
  useEffect(() => {
    try {
      const at = Number(sessionStorage.getItem(DONE_MARK_KEY) || 0)
      if (!at || Date.now() - at > 120000) return
      sessionStorage.removeItem(DONE_MARK_KEY)
      const t = window.setTimeout(() => setDoneHidden(true), RELOAD_HIDE_MS)
      return () => window.clearTimeout(t)
    } catch { return }
  }, [])
  useEffect(() => {
    // 2026-11-18 (owner): an update always opens the full card immediately — no dock
    // timer, no leftover hidden state can keep it shut once there is something to say.
    if (actionable || warn) {
      setDoneHidden(false)
      setMode('card')
    }
  }, [actionable, warn])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/deploy/events')
    } catch {
      return
    }
    const onDeploy = (event: Event) => {
      try {
        const next = JSON.parse(String((event as MessageEvent).data)) as DeployEvent
        if (!next || !next.deploymentId || typeof next.sequence !== 'number') return
        const key = next.deploymentId + ':' + next.sequence
        if (deploySeen.current.has(key)) return
        deploySeen.current.add(key)
        setDeploy(next)
      } catch {}
    }
    es.addEventListener('deploy', onDeploy)
    return () => { try { es?.close() } catch {} }
  }, [])

  const deployWorking = !!deploy && DEPLOY_WORKING.indexOf(deploy.status) !== -1
  useEffect(() => {
    deployingRef.current = deployWorking || busy === 'update' || busy === 'waiting'
  }, [deployWorking, busy])

  // A failed deployment reopens the applet and keeps it open (spec: "Failure: remain
  // expanded with error and rollback status"). Later acknowledges it.
  useEffect(() => {
    if (!deploy || deploy.status !== 'failed') return
    setDoneHidden(false)
    setMode('card')
  }, [deploy])

  // Auto-expand ONLY when a genuine transfer starts, once per deployment. Duplicate
  // events, reconnects and ordinary status updates never reopen the card.
  useEffect(() => {
    if (!deploy || deploy.status !== 'uploading') return
    if (deployAutoOpened.current === deploy.deploymentId) return
    deployAutoOpened.current = deploy.deploymentId
    setMode('card')
  }, [deploy])

  const expand = useCallback(() => {
    interacted.current = true
    setMode('card')
    setHideArm((n) => n + 1)
  }, [])

  if (mode === 'tab' && dockable) {
    return (
      <aside
        id="junkalot-update-toast"
        data-docked="tab"
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 0,
          bottom: 96,
          zIndex: 90,
          border: '1px solid rgba(0,255,65,.45)',
          borderRight: 0,
          borderRadius: '10px 0 0 10px',
          background: 'linear-gradient(135deg,#050508 0%,#0c0c18 100%)',
          color: '#d7ffe4',
          boxShadow: '0 6px 18px rgba(0,255,65,.18)',
          font: '12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <button
          type="button"
          onClick={expand}
          title={detail}
          aria-label={'junkalot.co is up to date. ' + detail + ' Open the update status.'}
          style={{
            all: 'unset',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '10px 6px',
            cursor: 'pointer',
            borderRadius: '10px 0 0 10px',
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ color: '#00ff41', fontSize: 11, display: 'inline-block' }}>👻</span>
          {countdown > 0 ? <CountdownRing countdown={countdown} variant="tab" /> : null}
          <span aria-hidden="true" style={{ color: '#64748b', fontSize: 10 }}>◂</span>
        </button>
      </aside>
    )
  }

  if (mode === 'chip' && dockable) {
    return (
      <aside
        id="junkalot-update-toast"
        data-docked="true"
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 6,
          bottom: 6,
          zIndex: 90,
          border: '1px solid rgba(0,255,65,.45)',
          borderRadius: 9999,
          background: 'linear-gradient(135deg,#050508 0%,#0c0c18 100%)',
          color: '#d7ffe4',
          boxShadow: '0 6px 18px rgba(0,255,65,.18)',
          font: '12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <button
          type="button"
          onClick={expand}
          title={detail}
          aria-label={'junkalot.co is up to date. ' + detail + ' Show the full update status.'}
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            cursor: 'pointer',
            borderRadius: 9999,
          }}
        >
          <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ color: '#00ff41', display: 'inline-block' }}>👻</span>
          {countdown > 0 ? <CountdownRing countdown={countdown} variant="chip" /> : null}
          <span style={{ fontWeight: 700, color: countdown > 0 ? '#00ff41' : '#d7ffe4' }}>
            {deployWorking && deploy
              ? 'Deployment ' + deploy.status
              : countdown > 0
                ? 'Update starts in ' + countdown + 's'
                : 'Up to date'}
          </span>
          {servedBuild ? (
            <span style={{ color: '#00cc33', fontVariantNumeric: 'tabular-nums' }}>{servedBuild.slice(0, 12)}</span>
          ) : null}
          <span aria-hidden="true" style={{ color: '#0f7a33' }}>▴</span>
        </button>
      </aside>
    )
  }

  // 2026-11-17 (owner): once the bar is done the applet is gone until something
  // real shows up again (a ready build, maintenance, or the site not answering).
  // 2026-11-18 (deployment applet spec): a failed deployment never hides — it stays
  // expanded until it is acknowledged with Later.
  if (doneHidden && !actionable && !warn && (!deploy || deploy.status !== 'failed')) return null

  return (
    <aside
      id="junkalot-update-toast"
      data-docked="false"
      onPointerDown={() => { interacted.current = true; setHideArm((n) => n + 1) }}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        // 2026-11-17 (owner): "we just need to make card show in bottom right
        // instead of top middle" — the card sits in the bottom-right corner at
        // all times, not only while an update is running.
        right: 6,
        bottom: 6,
        width: 'min(420px, calc(100vw - 12px))',
        zIndex: 90,
        border: '1px solid ' + (warn ? 'rgba(251,191,36,.55)' : 'rgba(0,255,65,.45)'),
        borderTop: '2px solid ' + (warn ? 'rgba(251,191,36,.7)' : '#00ff41'),
        borderRadius: 12,
        background: 'linear-gradient(135deg,#050508 0%,#0c0c18 100%)',
        color: '#d7ffe4',
        boxShadow: resting ? '0 8px 24px rgba(0,255,65,.16)' : '0 12px 42px rgba(0,255,65,.24)',
        padding: resting ? '8px 12px' : cornerClock ? '12px 14px 24px' : '12px 14px',
        font: '14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <style>{SPIN_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 190, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 2026-11-16 (owner): same header as the PhantomIDE invoice — black,
              neon green, the ghost — so an update reads as ours at a glance. */}
          <span style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 10px' }}>
            <span style={{ color: '#00ff41', fontSize: 13, fontWeight: 800, letterSpacing: 3, textShadow: '0 0 15px rgba(0,255,65,.8)' }}>
              <span aria-hidden="true" className={deployWorking ? 'phantom-spin' : undefined} style={{ display: 'inline-block' }}>👻</span> PHANTOM IDE
            </span>
            <span style={{ color: '#00cc33', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Update from PhantomIDE server
            </span>
          </span>
          {countdown > 0 ? <CountdownRing countdown={countdown} /> : null}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              background: accentBg,
              border: '1px solid ' + accentBorder,
              color: accent,
              borderRadius: 9999,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '.02em',
              boxShadow: '0 0 0 1px ' + accentBorder + ', 0 0 18px ' + accentBg,
            }}
          >
            <span aria-hidden="true">{STAGE_ICON[stage] || '✓'}</span>
            <span>{STAGE_TITLE[stage] || STAGE_TITLE.live}</span>
          </span>
          {/* Owner (2026-11-20): "add checklist to the update applet" — the
              portfolio guard's last real result, plus the two facts this applet
              measured for itself. Nothing is ticked that was not checked. */}
          <span className="jl-check" style={{ display: 'block' }} role="group" aria-label="Update checklist">
            {[
              {
                ok: Boolean(servedBuild),
                label: 'Build on disk',
                value: servedBuild ? servedBuild.slice(0, 12) : 'not reported yet',
              },
              { ok: true, label: 'Service answering', value: 'this check came back' },
              portfolio
                ? {
                    ok: portfolio.status === 'ok',
                    label: 'Portfolio images',
                    value: [
                      portfolio.variantsPresent + '/' + portfolio.variantsExpected + ' present',
                      (portfolio.variantsMissing ?? portfolio.missing?.length ?? 0) + ' missing',
                      ...((portfolio.variantsUnreadable ?? portfolio.unreadable?.length ?? 0) > 0
                        ? [(portfolio.variantsUnreadable ?? portfolio.unreadable?.length ?? 0) + ' unreadable']
                        : []),
                      ...((portfolio.variantsSmallerThanSlot ?? portfolio.smallerThanSlot?.length ?? 0) > 0
                        ? [(portfolio.variantsSmallerThanSlot ?? portfolio.smallerThanSlot?.length ?? 0) + ' smaller than slot (valid image)']
                        : []),
                      portfolio.entries + ' photos',
                    ].join(' · '),
                  }
                : { ok: false, label: 'Portfolio images', value: 'no build has run the guard yet' },
            ].map((row) => (
              <span key={row.label} style={{ display: 'block' }}>
                <span aria-hidden="true" style={{ color: row.ok ? '#00ff41' : '#ffb4b4', fontWeight: 800 }}>{row.ok ? '✓' : '✗'}</span>{' '}
                <span style={{ color: '#d7ffe4', fontWeight: 700 }}>{row.label}</span>{' '}
                <span style={{ color: row.ok ? '#9fe8b4' : '#ffb4b4', overflowWrap: 'anywhere' }}>— {row.value}</span>
              </span>
            ))}
            {portfolio?.checkedAt ? (
              <span style={{ display: 'block', color: '#64748b' }}>last checked {ago(portfolio.checkedAt)}</span>
            ) : null}
          </span>
          <span id="junkalot-update-detail" style={{ color: '#9fe8b4', fontSize: 12, overflowWrap: 'anywhere' }}>
            {stage === 'live' && autoPaused === 'typing' && !busy
              ? 'Countdown finished — the update applies the moment your cursor leaves the text field, so nothing you are typing is lost. Press Update now to do it immediately. Later postpones 30 minutes. '
              : stage === 'live' && autoPaused === 'hidden' && !busy
                ? 'Countdown finished — the update applies as soon as this tab is visible again. Later postpones 30 minutes. '
                : stage === 'live' && countdown > 0 && !busy
                  ? 'Auto-updating in ' + countdown + 's — Later postpones 30 minutes. '
                  : ''}
            {detail}
          </span>
          {deploy ? (
            <span
              style={{ display: 'block', color: deploy.status === 'failed' ? '#ffb4b4' : '#9fe8b4', fontSize: 12, overflowWrap: 'anywhere' }}
              data-deploy-status={deploy.status}
            >
              Deployment {deploy.status}
              {deploy.bytesTotal && deploy.bytesTransferred != null
                ? ' · ' + deploy.bytesTransferred + '/' + deploy.bytesTotal + ' bytes (' +
                  Math.floor((deploy.bytesTransferred / deploy.bytesTotal) * 100) + '%)'
                : ''}
              {deploy.message ? ' — ' + deploy.message : ''}
            </span>
          ) : null}
          {buildNote ? (
            <span
              style={{
                display: 'block',
                color: '#d7ffe4',
                fontSize: 12,
                lineHeight: 1.5,
                padding: '6px 9px',
                borderRadius: 8,
                background: 'rgba(0,255,65,.08)',
                border: '1px solid rgba(0,255,65,.25)',
                overflowWrap: 'anywhere',
              }}
            >
              <strong style={{ color: '#00ff41' }}>What this update does:</strong> {buildNote}
            </span>
          ) : null}
          {barVisible ? (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
              <style>{`.jl-fill{transition:width .45s cubic-bezier(.4,0,.2,1)}.jl-shine{animation:jl-shine 1.5s linear infinite}@keyframes jl-shine{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}.jl-indeterminate{animation:jl-pulse 1.4s ease-in-out infinite}@keyframes jl-pulse{0%,100%{opacity:.45}50%{opacity:.9}}@media (prefers-reduced-motion: reduce){.jl-shine{animation:none}.jl-indeterminate{animation:none;opacity:.7}}`}</style>
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={barIndeterminate ? undefined : barValue}
                aria-valuetext={barIndeterminate ? barLabel : barLabel + ' ' + barValue + '%'}
                aria-label="Update progress"
                style={{
                  position: 'relative',
                  display: 'block',
                  height: 8,
                  background: '#04120a',
                  borderRadius: 999,
                  overflow: 'hidden',
                  border: '1px solid rgba(0,255,65,.35)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,.6)',
                }}
              >
                <span
                  className={barIndeterminate ? 'jl-fill jl-indeterminate' : 'jl-fill'}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: barIndeterminate ? '100%' : barValue + '%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg,#00b83a,#00ff41 55%,#9dffb8)',
                    boxShadow: '0 0 14px rgba(0,255,65,.55)',
                  }}
                />
                <span
                  className="jl-shine"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '30%',
                    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)',
                    mixBlendMode: 'screen',
                  }}
                />
              </span>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, alignItems: 'baseline' }}>
                <span style={{ color: '#00ff41', fontWeight: 700 }}>{barLabel}</span>
                {barIndeterminate ? null : (
                  <span style={{ color: '#00cc33', fontVariantNumeric: 'tabular-nums' }}>{barValue}%</span>
                )}
              </span>
              {/* 2026-11-16 (owner): live install readout — elapsed, the
                  countdown from the last measured restart, and the bytes
                  this card actually moved. The build is applied on the
                  server, so these are update-check bytes, not a fake
                  download figure. */}
              {busy ? (<span style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: '4px 10px', fontSize: 11, color: '#7fd99a', fontVariantNumeric: 'tabular-nums' }}>
                <span title="Seconds since this card started the update">⏱ {secsLabel(elapsed)} elapsed</span>
                <span title={restartSecs == null ? 'No restart has been measured on this browser yet, so there is no honest estimate.' : 'From the last restart measured on this browser.'}>{etaText}</span>
                <span title="Live download rate this card measured for its own update requests.">↓ {rateLabel(net.down)}</span>
                <span title="Live upload rate this card measured for its own update requests.">↑ {rateLabel(net.up)}</span>
                <span title="Bytes this card actually moved during this update, counted request by request.">{bytesLabel(net.downTotal + net.upTotal)} moved</span>
                {buildBytes > 0 ? <span title="Size of the new build on the server, measured from its files. The build is assembled and applied on the server, so it never travels to this tab as a download.">{bytesLabel(buildBytes)} new build</span> : null}
              </span>) : null}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {actionable ? (
            <button
              type="button"
              onClick={stage === 'ready' ? () => { autoApply() } : updateNow}
              disabled={!!busy}
              style={{
                border: 0,
                background: '#00ff41',
                color: '#04120a',
                borderRadius: 9,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: busy ? 0.8 : 1,
              }}
            >
              {busy === 'waiting'
                ? 'Updating…'
                : busy === 'update'
                  ? 'Applying…'
                  : stage === 'ready'
                    ? 'Apply now'
                    : countdown > 0 || autoPaused !== '' ? 'Update now' : 'Update'}
            </button>
          ) : null}
          {actionable || busy ? (
            <button
              type="button"
              onClick={later}
              style={{
                border: '1px solid rgba(0,255,65,.35)',
                background: '#0b1410',
                color: '#b9ffd0',
                borderRadius: 9,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Later
            </button>
          ) : null}
        </div>
      </div>
      {/* 2026-11-20 (owner): "widget in right corner with the ghost under it ... countdown under
          the ghost when update is about to start". The ghost sits at the foot of the card and the
          countdown runs directly beneath it. It reads the card's own deadline timer, so it is blank
          until a build is actually armed and then counts down for real. */}
      <div
        data-update-ghost-dock="1"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 10, pointerEvents: 'none' }}
      >
        <span
          aria-hidden="true"
          className={deployWorking ? 'phantom-spin' : undefined}
          style={{ display: 'inline-block', fontSize: 26, lineHeight: 1, color: '#00ff41', textShadow: '0 0 18px rgba(0,255,65,.75)' }}
        >
          👻
        </span>
        <span
          role="status"
          aria-live="polite"
          style={{
            minHeight: 16,
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: countdown > 0 ? '#00ff41' : '#7fd99a',
            textAlign: 'center',
          }}
        >
          {countdown > 0
            ? 'Update starts in ' + countdown + 's'
            : !busy && autoPaused === 'typing'
              ? 'Countdown done — starts when your cursor leaves the text field'
              : !busy && autoPaused === 'hidden'
                ? 'Countdown done — starts when this tab is visible'
                : busy === 'update'
              ? 'Applying the new build…'
              : busy === 'waiting'
                ? 'Waiting for the new build…'
                : stage === 'ready'
                  ? 'Ready to start'
                  : <NextCheckClock />}
        </span>
      </div>
      {/* 2026-11-18 (owner): unobtrusive branding in the expanded applet footer. The
          link is a plain anchor — no script, no font, no image request. */}
      <div
        style={{
          marginTop: 8,
          paddingRight: cornerClock ? 74 : 0,
          fontSize: 11,
          color: '#7fd99a',
          textAlign: 'right',
        }}
      >
        <span>Junkalot · Powered by </span>
        <a
          href="https://phantomide.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#00ff41', fontWeight: 700, textDecoration: 'none' }}
        >
          PhantomIDE.com
        </a>
      </div>
      {cornerClock ? (
        <span
          title={cornerClockTitle}
          aria-label={'Time tracking: ' + cornerClockTitle}
          style={{
            position: 'absolute',
            right: 10,
            bottom: 5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(0,0,0,.62)',
            border: '1px solid rgba(0,255,65,.3)',
            color: '#7fd99a',
            borderRadius: 9999,
            padding: '1px 7px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {cornerClock}
        </span>
      ) : null}
    </aside>
  )
}
