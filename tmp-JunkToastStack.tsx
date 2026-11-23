'use client'

// 2026-11-17 (owner): "add" — server notification toast stack for junkalot.co.
//
// Renders the top-right stack from the supplied markup and exposes the same API
// other page code can call: window.JunkToast({ type, title, message, duration }).
// Toasts auto-dismiss (default 6 s), can be dismissed by hand, and the stack keeps
// at most five.
//
// Live feed: a socket only opens when the page advertises a real endpoint in
//   <meta name="junkalot-toast-ws" content="wss://…" />
// Nothing is invented: with no advertised endpoint the stack stays silent instead
// of retrying a socket this server does not run. (The site currently has no
// /ws/status endpoint — `next start`, no custom server — so until one exists this
// is the reusable toast surface, not a live server feed.)

import { useCallback, useEffect, useRef, useState } from 'react'

type ToastType = 'info' | 'success' | 'warning' | 'error'

type ToastInput = {
  type?: ToastType
  title?: string
  message?: string
  duration?: number
}

type Toast = {
  id: number
  type: ToastType
  title: string
  message: string
}

const ALLOWED: ToastType[] = ['info', 'success', 'warning', 'error']
const DEFAULT_DURATION_MS = 6000
const MAX_TOASTS = 5

export default function JunkToastStack() {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((input: ToastInput = {}) => {
    const type: ToastType = ALLOWED.includes(input.type as ToastType)
      ? (input.type as ToastType)
      : 'info'
    const id = ++seq.current
    const duration = Number.isFinite(Number(input.duration)) ? Number(input.duration) : DEFAULT_DURATION_MS
    const toast: Toast = {
      id,
      type,
      title: String(input.title || 'Update'),
      message: String(input.message || ''),
    }
    setItems((prev) => [toast, ...prev].slice(0, MAX_TOASTS))
    if (duration > 0) {
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
    return id
  }, [])

  // Public API used by the supplied markup's callers.
  useEffect(() => {
    const w = window as unknown as { JunkToast?: (input?: ToastInput) => number }
    w.JunkToast = push
    return () => {
      try {
        delete w.JunkToast
      } catch {
        w.JunkToast = undefined
      }
    }
  }, [push])

  // Optional live feed — only for an endpoint the page actually advertises.
  useEffect(() => {
    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    let retry = 1000
    let closed = false

    let endpoint = ''
    try {
      const meta = document.querySelector('meta[name="junkalot-toast-ws"]')
      endpoint = meta ? String(meta.getAttribute('content') || '') : ''
    } catch {
      endpoint = ''
    }
    if (!/^wss?:\/\//i.test(endpoint)) return

    const connect = () => {
      if (closed) return
      try {
        socket = new WebSocket(endpoint)
      } catch {
        return
      }
      socket.onopen = () => {
        retry = 1000
        push({ type: 'success', title: 'Junkalot Connected', message: 'Live server updates are active.' })
      }
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data))
          push({ type: data.type, title: data.title, message: data.message })
        } catch {
          // A malformed event must never break the page.
        }
      }
      socket.onclose = () => {
        if (closed) return
        push({ type: 'warning', title: 'Connection Lost', message: 'Reconnecting to server updates...' })
        retryTimer = window.setTimeout(connect, retry)
        retry = Math.min(retry * 2, 30000)
      }
    }
    connect()

    return () => {
      closed = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      try {
        socket?.close()
      } catch {
        // Already closed.
      }
    }
  }, [push])

  return (
    <>
      <style>{`#junk-toast-stack{position:fixed;top:20px;right:20px;width:min(360px,calc(100vw - 32px));z-index:99999;display:grid;gap:10px;pointer-events:none}.junk-toast{pointer-events:auto;background:#101827;color:#fff;border:1px solid #334155;border-left:4px solid #38bdf8;border-radius:12px;padding:14px 16px;box-shadow:0 12px 32px #0006;animation:toastIn .3s ease-out;font:14px system-ui,sans-serif}.junk-toast.success{border-left-color:#22c55e}.junk-toast.error{border-left-color:#ef4444}.junk-toast.warning{border-left-color:#f59e0b}.junk-toast strong{display:block;margin-bottom:5px}.junk-toast p{margin:0;color:#cbd5e1}.junk-toast .junk-toast-close{float:right;color:#fff;background:transparent;border:0;cursor:pointer;font:inherit;line-height:1}@keyframes toastIn{from{opacity:0;transform:translateX(35px)}to{opacity:1;transform:translateX(0)}}@media (prefers-reduced-motion: reduce){.junk-toast{animation:none}}`}</style>
      <div id="junk-toast-stack" role="region" aria-label="Server notifications">
        {items.map((t) => (
          <div key={t.id} className={'junk-toast ' + t.type}>
            <button
              type="button"
              className="junk-toast-close"
              aria-label="Dismiss notification"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
            <strong>{t.title}</strong>
            <p>{t.message}</p>
          </div>
        ))}
      </div>
    </>
  )
}
