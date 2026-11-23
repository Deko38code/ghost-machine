'use client'

// 2026-11-17 (owner): "Junkalot Live Update" progress panel, built from the
// markup the owner supplied and fed by the `{ type: "progress", percent,
// message }` events the toast service broadcasts on /ws/status.
//
// It stays out of the page until the first progress event arrives, then docks
// bottom-right while the bar runs. At 100% it turns green, says "Completed!",
// and leaves on its own a few seconds later — the same rule the update applet
// follows, so a finished update does not park a panel over the site.
//
// The socket only opens for an endpoint the page actually advertises in
//   <meta name="junkalot-toast-ws" content="wss://…" />
// With nothing advertised the panel is inert instead of retrying a socket this
// origin does not serve.

import { useEffect, useState } from 'react'

type Progress = {
  percent: number
  message: string
}

const DONE_HIDE_MS = 8000

function readEndpoint(): string {
  try {
    const meta = document.querySelector('meta[name="junkalot-toast-ws"]')
    const value = meta ? String(meta.getAttribute('content') || '') : ''
    return /^wss?:\/\//i.test(value) ? value : ''
  } catch {
    return ''
  }
}

export default function JunkProgress() {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [hidden, setHidden] = useState(false)

  const done = !!progress && progress.percent >= 100

  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setHidden(true), DONE_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [done])

  useEffect(() => {
    const endpoint = readEndpoint()
    if (!endpoint) return

    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    let retry = 1000
    let closed = false

    const connect = () => {
      if (closed) return
      try {
        socket = new WebSocket(endpoint)
      } catch {
        return
      }
      socket.onopen = () => {
        retry = 1000
      }
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data))
          if (data && data.type === 'progress') {
            const n = Number(data.percent)
            if (!Number.isFinite(n)) return
            setHidden(false)
            setProgress({
              percent: Math.max(0, Math.min(100, n)),
              message: String(data.message || ''),
            })
          }
        } catch {
          // A malformed event must never break the page.
        }
      }
      socket.onclose = () => {
        if (closed) return
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
  }, [])

  // Same callable the supplied script exposed, for page code that wants to drive
  // the panel directly: window.JunkProgress(percent, 'message').
  useEffect(() => {
    const w = window as unknown as {
      JunkProgress?: (value: number | string, message?: string) => void
    }
    w.JunkProgress = (value, message) => {
      const n = Number(value)
      if (!Number.isFinite(n)) return
      setHidden(false)
      setProgress({
        percent: Math.max(0, Math.min(100, n)),
        message: String(message || ''),
      })
    }
    return () => {
      try {
        delete w.JunkProgress
      } catch {
        w.JunkProgress = undefined
      }
    }
  }, [])

  if (!progress || hidden) return null

  const percent = Math.round(progress.percent)
  const status = progress.message || (percent === 100 ? 'Completed!' : 'Processing...')

  return (
    <div id="junk-progress" role="status" aria-live="polite">
      <style>{`#junk-progress{position:fixed;bottom:24px;right:24px;width:min(380px,calc(100vw - 48px));background:#0c1424;color:#fff;padding:20px;border:1px solid #334155;border-radius:16px;box-shadow:0 15px 40px #0008;font-family:system-ui,sans-serif;z-index:99999}.junk-progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}#junk-progress .jp-percent{color:#38bdf8;font-size:26px;font-weight:800}#junk-progress .jp-percent.done{color:#22c55e}.jp-track{height:14px;background:#273449;border-radius:20px;overflow:hidden}.jp-fill{height:100%;width:0%;background:linear-gradient(90deg,#2563eb,#06b6d4);border-radius:20px;transition:width .35s ease}.jp-fill.done{background:#22c55e}.jp-status{margin-top:12px;color:#94a3b8;font-size:13px}@media (prefers-reduced-motion: reduce){.jp-fill{transition:none}}`}</style>
      <div className="junk-progress-header">
        <strong>⚡ Junkalot Live Update</strong>
        <span className={'jp-percent' + (done ? ' done' : '')}>{percent}%</span>
      </div>
      <div className="jp-track">
        <div className={'jp-fill' + (done ? ' done' : '')} style={{ width: percent + '%' }} />
      </div>
      <div className="jp-status">{status}</div>
    </div>
  )
}
