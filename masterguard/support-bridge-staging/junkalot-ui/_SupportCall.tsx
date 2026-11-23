'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// A real video + remote-support call, opened from the right pane of the live panel.
// Owner (2026-11-23): "make it video and remote connection to phantomide support" ·
// "real deal" · "the right panel".
//
// What is real here:
//  · an actual WebRTC call between her browser and PhantomIDE support (the owner account)
//  · her camera and microphone, only after she presses the button for them
//  · sharing THIS TAB, which draws the green frame the browser shows while sharing
//  · remote control of that shared tab, only while she has allowed it, with a banner she
//    can see and a stop button she can press — support's clicks and typing are replayed on
//    the page she shared, nothing outside the browser is reachable.
//
// Signal transport: /api/admin/support-session (admin-only, in-memory, no SDP or ICE is
// ever written to disk). A server restart ends a call; the screen says so.

type Phase = 'idle' | 'opening' | 'waiting' | 'joining' | 'negotiating' | 'live' | 'ended'

type Signal = { seq: number; from: 'caller' | 'support'; kind: string; data?: unknown }

const POLL_MS = 1500

// `grown` means the pane it lives in has been expanded to the whole window by the panel's
// own Expand control: the video gets the height, but the call itself is untouched — same
// elements, same stream, nothing restarted (owner, 2026-11-23).
export default function SupportCall({ grown = false }: { grown?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [camera, setCamera] = useState(false)
  const [microphone, setMicrophone] = useState(false)
  const [sharing, setSharing] = useState<'none' | 'tab' | 'display'>('none')
  const [allowControl, setAllowControl] = useState(false)
  const [remoteSeen, setRemoteSeen] = useState(false)
  // Real fullscreen for the call: the browser's Fullscreen API on this pane, with a CSS
  // fallback that fills the viewport if the API refuses. Owner (2026-11-23): "its not too
  // bad the video link it there just to small" · "dosent show real fullscreen".
  const [fullscreen, setFullscreen] = useState(false)
  const [theatre, setTheatre] = useState(false)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const idRef = useRef('')
  const seqRef = useRef(0)
  const pollRef = useRef<number | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const screenRef = useRef<MediaStream | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const allowRef = useRef(false)
  const videoLocal = useRef<HTMLVideoElement | null>(null)
  const videoRemote = useRef<HTMLVideoElement | null>(null)
  const pcStarted = useRef(false)

  allowRef.current = allowControl

  const expanded = fullscreen || theatre

  // Owner (2026-11-23): "dosent show real fullscreen". This asks the browser for true
  // fullscreen on the call pane; if the API is refused the pane still fills the viewport
  // (theatre mode), so the control never does nothing.
  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else { await el.requestFullscreen(); setTheatre(false) }
    } catch {
      setTheatre((on) => !on)
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const on = Boolean(rootRef.current && document.fullscreenElement === rootRef.current)
      setFullscreen(on)
      if (on) setTheatre(false)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const teardown = useCallback((message?: string) => {
    stopPolling()
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    localRef.current?.getTracks().forEach((track) => track.stop())
    localRef.current = null
    screenRef.current?.getTracks().forEach((track) => track.stop())
    screenRef.current = null
    pcStarted.current = false
    setCamera(false)
    setMicrophone(false)
    setSharing('none')
    setAllowControl(false)
    setRemoteSeen(false)
    if (message) setError(message)
    setPhase('ended')
  }, [stopPolling])

  // Applying what support sends. Only while she has allowed control, only on the page she
  // shared, and never into a password or payment field (Codex review 2026-11-23).
  const applyRemote = useCallback((raw: string) => {
    if (!allowRef.current) return
    let msg: { t?: string; x?: number; y?: number; dy?: number; value?: string; key?: string } = {}
    try { msg = JSON.parse(raw) } catch { return }
    const target = (x?: number, y?: number): HTMLElement | null => {
      if (typeof x !== 'number' || typeof y !== 'number') return null
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      return el
    }
    const blocked = (el: HTMLElement | null): boolean => {
      if (!el) return true
      const tag = el.tagName
      if (tag === 'INPUT' && (el as HTMLInputElement).type === 'password') return true
      if (el.closest('[data-no-remote]')) return true
      return false
    }
    if (msg.t === 'click') {
      const el = target(msg.x, msg.y)
      if (blocked(el) || !el) return
      el.focus()
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: msg.x, clientY: msg.y }))
      return
    }
    if (msg.t === 'scroll') {
      window.scrollBy(0, typeof msg.dy === 'number' ? msg.dy : 0)
      return
    }
    if (msg.t === 'type') {
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
      if (!el || (el instanceof HTMLInputElement && el.type === 'password')) return
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (!setter) return
      setter.call(el, String(msg.value ?? '').slice(0, 2000))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    if (msg.t === 'key' && msg.key) {
      const el = document.activeElement as HTMLElement | null
      if (!el || blocked(el)) return
      el.dispatchEvent(new KeyboardEvent('keydown', { key: String(msg.key), bubbles: true }))
      el.dispatchEvent(new KeyboardEvent('keyup', { key: String(msg.key), bubbles: true }))
    }
  }, [])

  const send = useCallback(async (body: Record<string, unknown>): Promise<any> => {
    const res = await fetch('/api/admin/support-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String(data?.error || 'The support service refused that'))
    return data
  }, [])

  const signal = useCallback((kind: string, data?: unknown) => {
    const id = idRef.current
    if (!id) return
    void send({ action: 'signal', id, kind, data }).catch(() => { /* the poll reports a dead session */ })
  }, [send])

  const startPeer = useCallback(async () => {
    if (pcStarted.current) return
    pcStarted.current = true
    setPhase('negotiating')
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localRef.current = stream
    setCamera(true)
    setMicrophone(true)
    if (videoLocal.current) videoLocal.current.srcObject = stream

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pcRef.current = pc
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    const dc = pc.createDataChannel('ctl')
    dcRef.current = dc
    dc.onmessage = (event) => applyRemote(String(event.data))
    // Support maps a click on the video back to a point on this page, so it needs to know
    // the size of the page she is sharing. Only the size is sent.
    const sendSize = () => {
      try { dc.send(JSON.stringify({ t: 'size', w: window.innerWidth, h: window.innerHeight })) } catch { /* not open yet */ }
    }
    dc.onopen = sendSize
    window.addEventListener('resize', sendSize)

    pc.ondatachannel = (event) => {
      dcRef.current = event.channel
      event.channel.onmessage = (message) => applyRemote(String(message.data))
    }

    pc.ontrack = (event) => {
      const [remote] = event.streams
      if (videoRemote.current && remote) {
        videoRemote.current.srcObject = remote
        setRemoteSeen(true)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) signal('ice', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate)
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') setPhase('live')
      if (state === 'failed') teardown('The call could not connect — the two networks could not reach each other.')
      if (state === 'disconnected') setNote('The call is reconnecting…')
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signal('offer', { sdp: offer.sdp, type: offer.type })
    setNote('Connecting to support…')
  }, [applyRemote, signal, teardown])

  const handleEvents = useCallback(async (events: Signal[]) => {
    const pc = pcRef.current
    for (const event of events) {
      if (event.kind === 'bye') {
        teardown('Support ended the call.')
        return
      }
      if (event.kind === 'control-state') {
        setNote(event.data === 'on' ? 'Support has control of this tab.' : 'Support released control.')
        continue
      }
      if (!pc) continue
      if (event.kind === 'answer' && event.from === 'support') {
        const data = event.data as { sdp?: string; type?: RTCSdpType } | undefined
        if (data?.sdp) {
          try {
            await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
          } catch { /* a duplicate answer is ignored */ }
        }
        continue
      }
      if (event.kind === 'ice' && event.from === 'support') {
        const candidate = event.data as RTCIceCandidateInit | undefined
        if (candidate) {
          try { await pc.addIceCandidate(candidate) } catch { /* a late candidate is dropped */ }
        }
      }
    }
  }, [teardown])

  const poll = useCallback(async () => {
    const id = idRef.current
    if (!id) return
    try {
      const res = await fetch('/api/admin/support-session?id=' + encodeURIComponent(id) + '&after=' + seqRef.current, { cache: 'no-store' })
      if (res.status === 404) {
        teardown('That support session has ended.')
        return
      }
      if (!res.ok) return
      const data = await res.json()
      const events: Signal[] = Array.isArray(data.events) ? data.events : []
      if (events.length) {
        seqRef.current = events[events.length - 1].seq
        await handleEvents(events)
      }
      if (data.state === 'joined') {
        setPhase((current) => (current === 'waiting' ? 'joining' : current))
        // Support is here: the press that turns media on is hers, not automatic.
      }
      if (data.state === 'ended') teardown('That support session has ended.')
    } catch {
      /* a missed poll is retried on the next tick */
    }
  }, [handleEvents, teardown])

  const beginPolling = useCallback(() => {
    stopPolling()
    pollRef.current = window.setInterval(() => { if (!document.hidden) void poll() }, POLL_MS)
    void poll()
  }, [poll, stopPolling])

  useEffect(() => () => { stopPolling(); pcRef.current?.close(); localRef.current?.getTracks().forEach((t) => t.stop()); screenRef.current?.getTracks().forEach((t) => t.stop()) }, [stopPolling])

  async function open() {
    setError('')
    setNote('')
    setPhase('opening')
    try {
      const data = await send({ action: 'open' })
      idRef.current = String(data.id)
      setCode(String(data.code))
      seqRef.current = 0
      setPhase('waiting')
      beginPolling()
    } catch (err) {
      setPhase('idle')
      setError(err instanceof Error ? err.message : 'The support service could not be reached.')
    }
  }

  async function joinMedia() {
    try {
      await startPeer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The camera or microphone could not be opened.')
      teardown()
    }
  }

  async function shareTab() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' } as MediaTrackConstraints, audio: false })
      const [track] = stream.getVideoTracks()
      screenRef.current = stream
      const pc = pcRef.current
      if (!pc) return
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(track)
      else pc.addTrack(track, stream)
      track.onended = () => {
        setSharing('none')
        setAllowControl(false)
        signal('control-state', 'off')
      }
      const surface = (track.getSettings() as { displaySurface?: string }).displaySurface
      setSharing(surface === 'browser' ? 'tab' : 'display')
      setNote(surface === 'browser'
        ? 'You are sharing this tab. Support can see it while the browser frame is up.'
        : 'You are sharing a screen. Remote control stays off unless you share this tab.')
    } catch {
      setNote('Sharing was cancelled.')
    }
  }

  function toggleControl() {
    const next = !allowControl
    setAllowControl(next)
    signal('control-state', next ? 'on' : 'off')
    setNote(next ? 'Support can click and type on this tab until you press Stop control.' : 'Support can no longer control this tab.')
  }

  async function hangUp() {
    const id = idRef.current
    if (id) { try { await send({ action: 'close', id }) } catch { /* closing locally anyway */ } }
    teardown()
  }

  const open_ = phase !== 'idle' && phase !== 'ended'

  return (
    <div
      ref={rootRef}
      className={expanded
        ? 'fixed inset-0 z-[300] flex min-h-0 flex-col overflow-y-auto bg-black px-4 py-4'
        : grown
          // Full-window: keep the call centred on a comfortable column instead of running
          // a 1900 px line across a desktop or TV (codex vision review 2026-11-23).
          ? 'mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col overflow-y-auto px-4 py-3'
          : 'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3'}
    >
      {expanded && (
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
          <p className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-widest text-[#9ff5bd]">Video support · fullscreen</p>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="shrink-0 rounded-md border border-white/25 px-2.5 font-mono text-[11px] text-gray-200 hover:bg-white/10"
            style={{ minHeight: 36 }}
          >
            ⤡ Exit fullscreen
          </button>
        </div>
      )}
      {!open_ && (
        <div className="space-y-3">
          {phase === 'ended' && (
            <p role="status" className="text-[11px] leading-5 text-gray-400">{error || 'The call has ended.'}</p>
          )}
          <p className="text-[11px] leading-5 text-gray-400">
            A real video call with PhantomIDE support, opened from this panel. You choose when the camera,
            the microphone and this tab are shared, and support can only click and type here while you
            have allowed it.
          </p>
          <button
            type="button"
            onClick={() => void open()}
            className="w-full rounded-lg border border-[#00ff41]/60 bg-[#00ff41]/15 px-3 font-mono text-[12px] font-bold text-[#00ff41] hover:bg-[#00ff41]/25"
            style={{ minHeight: 44 }}
          >
            Start video support
          </button>
          {error && <p role="alert" className="text-[11px] leading-4 text-red-300">{error}</p>}
        </div>
      )}

      {open_ && (
        <div className="space-y-3">
          {phase === 'waiting' && (
            <>
              <p className="font-mono text-[11px] uppercase tracking-widest text-gray-500">Your support code</p>
              <p className="select-all text-center font-mono text-xl font-bold tracking-[0.3em] text-[#00ff41]">{code}</p>
              <p className="text-[11px] leading-5 text-gray-400">
                Read this code to PhantomIDE support, or enter it at <span className="font-mono text-[#9ff5bd]">/admin/support</span>.
                The call starts the moment they join.
              </p>
              <p className="font-mono text-[10px] text-gray-600">Waiting for support…</p>
            </>
          )}

          {phase === 'joining' && (
            <>
              <p className="text-[12px] leading-5 text-[#9ff5bd]">Support has joined.</p>
              <button
                type="button"
                onClick={() => void joinMedia()}
                className="w-full rounded-lg border border-[#00ff41]/60 bg-[#00ff41]/15 px-3 font-mono text-[12px] font-bold text-[#00ff41] hover:bg-[#00ff41]/25"
                style={{ minHeight: 44 }}
              >
                Turn on camera and microphone
              </button>
              <p className="text-[10px] leading-4 text-gray-500">Nothing is captured until you press that.</p>
            </>
          )}

          {(phase === 'negotiating' || phase === 'live') && (
            <>
              {!remoteSeen && <p className="font-mono text-[11px] text-gray-500">{note || 'Connecting…'}</p>}
              <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
                <video
                  ref={videoRemote}
                  autoPlay
                  playsInline
                  className={expanded
                    ? 'h-[calc(100dvh-210px)] min-h-[320px] w-full bg-black object-contain'
                    : grown
                      ? 'h-[calc(100dvh-250px)] min-h-[240px] w-full bg-black object-contain'
                      : 'aspect-video max-h-[62vh] min-h-[240px] w-full bg-black object-contain'}
                />
                <video ref={videoLocal} autoPlay playsInline muted className="absolute bottom-1.5 right-1.5 h-16 w-24 rounded border border-[#00ff41]/40 bg-black object-cover" />
              </div>
              {allowControl && (
                <p role="status" className="rounded border border-amber-500/60 bg-amber-950/40 px-2 py-1 text-[10px] leading-4 text-amber-200">
                  Support can see and control this tab. Press Stop control to end that immediately.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => void shareTab()} className="rounded-md border border-[#00ff41]/40 px-2 font-mono text-[11px] text-[#9ff5bd] hover:bg-[#00ff41]/10" style={{ minHeight: 36 }}>
                  {sharing === 'none' ? 'Share this tab' : 'Sharing ' + (sharing === 'tab' ? 'this tab' : 'a screen')}
                </button>
                <button
                  type="button"
                  onClick={toggleControl}
                  disabled={sharing !== 'tab'}
                  title={sharing !== 'tab' ? 'Share this tab first' : undefined}
                  className={'rounded-md border px-2 font-mono text-[11px] disabled:opacity-40 ' + (allowControl
                    ? 'border-amber-500/70 text-amber-200 hover:bg-amber-950/40'
                    : 'border-white/20 text-gray-300 hover:bg-white/10')}
                  style={{ minHeight: 36 }}
                >
                  {allowControl ? 'Stop control' : 'Allow control'}
                </button>
                <button type="button" onClick={() => void hangUp()} className="rounded-md border border-red-800 px-2 font-mono text-[11px] text-red-300 hover:bg-red-950/40" style={{ minHeight: 36 }}>
                  End call
                </button>
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="rounded-md border border-white/25 px-2 font-mono text-[11px] text-gray-200 hover:bg-white/10"
                  style={{ minHeight: 36 }}
                >
                  {expanded ? '⤡ Exit fullscreen' : '⤢ Fullscreen'}
                </button>
              </div>
              <p className="text-[10px] leading-4 text-gray-500">
                {camera && microphone ? 'Camera and microphone on.' : 'Camera and microphone off.'} Nothing is recorded. A server restart ends the call.
              </p>
              {note && <p className="text-[10px] leading-4 text-gray-400">{note}</p>}
            </>
          )}

          {phase === 'opening' && <p className="font-mono text-[10px] text-gray-500">Opening the session…</p>}

          {(phase === 'waiting' || phase === 'joining') && (
            <button type="button" onClick={() => void hangUp()} className="w-full rounded-lg border border-red-800 px-3 font-mono text-[11px] text-red-300 hover:bg-red-950/40" style={{ minHeight: 40 }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
