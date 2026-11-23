'use client'
import { useEffect } from 'react'
import { UPDATES_SEEN_KEY, UPDATES_QUEUE_KEY } from './UpdatesBadge'

// Opening the update log marks what is on it as seen for this browser. The stamp
// from the visit before this one is kept under UPDATES_QUEUE_KEY so the queued
// list on this page can show exactly what arrived while the counter was up.
//
// 2026-11-22 (Codex review): this used to stamp `new Date().toISOString()` — the
// browser's own clock. The Security Center's "Mark all read" stamps the newest
// record time from the server, so a browser running a few minutes fast would write
// a future stamp here and silently hide every update written until the clock
// caught up. Both writers now stamp the same value: the newest record in the log.
// If the read fails, nothing is stamped and the counter keeps its honest number.
export default function UpdatesSeenMarker() {
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const res = await fetch('/api/admin/updates-count', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const latest = typeof data?.latest === 'string' ? data.latest : ''
        if (!latest || !alive) return
        try {
          const previous = localStorage.getItem(UPDATES_SEEN_KEY) || ''
          if (previous) localStorage.setItem(UPDATES_QUEUE_KEY, previous)
          localStorage.setItem(UPDATES_SEEN_KEY, latest)
        } catch { /* private mode: nothing stored */ }
      } catch { /* offline: the counter keeps counting rather than claiming it was read */ }
    }
    void run()
    return () => { alive = false }
  }, [])
  return null
}
