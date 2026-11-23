'use client'

// PWA install affordance + service-worker registration.
//
// Owner (2026-11-22): "make sure junkalots pwa install works on browsers etc".
// Android/Chrome/Edge fire `beforeinstallprompt`, which we capture and offer as a
// small chip; iOS Safari has no such event, so it gets a one-time "Add to Home
// Screen" hint instead. Nothing here is shown when the app is already installed.
//
// Layout (CLAUDE.md §18): the bottom-right corner belongs to the Phantom applet, so
// this sits bottom-left and lifts above the applet's published footprint
// (--phantom-applet-h) so it can never be covered on a phone.
import { useEffect, useState } from 'react'

type InstallPrompt = Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }

const DISMISS_KEY = 'junkalot-pwa-dismissed'

export default function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // Register the pass-through service worker (install support; nothing cached).
    //
    // 2026-11-22 (owner): "make sure updates get pushed to widget even with pwa
    // installs". An installed app can stay open for days and the browser only
    // re-checks /sw.js on its own schedule, so registration revalidates the
    // worker on every launch and every time the app is brought back to the
    // front. `updateViaCache: 'none'` keeps an HTTP-cached sw.js from winning.
    // sw.js itself caches no response and fetches navigations with no-store, so
    // the widget's reload always lands on the live build.
    if (!('serviceWorker' in navigator)) return
    let reg: ServiceWorkerRegistration | null = null
    let cancelled = false
    const refresh = () => { reg?.update().catch(() => {}) }
    const onResume = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    const register = () => {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((r) => {
          if (cancelled) return
          reg = r
          refresh()
        })
        .catch(() => {})
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('load', register)
    }
  }, [])

  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch { /* storage blocked */ }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone || dismissed) return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS Safari: no install prompt event, so offer the manual path once.
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/chrome|crios|fxios/i.test(window.navigator.userAgent)
    if (isIos && isSafari) setIosHint(true)

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    setIosHint(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* storage blocked */ }
  }

  const install = async () => {
    if (!prompt || typeof prompt.prompt !== 'function') return
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice && choice.outcome === 'accepted') dismiss()
    } catch { /* the browser declined; leave the chip up */ }
  }

  if (!show && !iosHint) return null

  return (
    <div
      className="fixed left-5 z-[60] max-w-[calc(100vw-2.5rem)] rounded-xl border border-brand-gold/40 bg-brand-dark/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur sm:max-w-xs"
      style={{ bottom: 'calc(0.75rem + var(--phantom-applet-h, 0px))' }}
      role="dialog"
      aria-label="Install the Junk-A-Lot app"
    >
      <div className="flex items-start gap-2">
        <img src="/pwa-192.png" alt="" aria-hidden="true" className="mt-0.5 h-8 w-8 flex-none rounded" />
        <div className="min-w-0">
          {show ? (
            <>
              <p className="font-semibold leading-5">Install the Junk-A-Lot app</p>
              <p className="mt-0.5 leading-4 text-white/70">One tap on your home screen, same site, no browser bar.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={install} className="rounded-lg bg-brand-gold px-3 py-1.5 font-semibold text-brand-dark">Install</button>
                <button onClick={dismiss} className="rounded-lg border border-white/20 px-3 py-1.5 text-white/80">Not now</button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold leading-5">Add Junk-A-Lot to your home screen</p>
              <p className="mt-0.5 leading-4 text-white/70">Tap Share, then “Add to Home Screen”.</p>
              <button onClick={dismiss} className="mt-2 rounded-lg border border-white/20 px-3 py-1.5 text-white/80">Got it</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
