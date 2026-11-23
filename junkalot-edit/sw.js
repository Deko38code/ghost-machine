// Junk-A-Lot service worker — install support only.
//
// Owner (2026-11-22): "make sure junkalots pwa install works on browsers etc".
// Chrome, Edge and Android offer "Install app" when a service worker with a fetch handler
// exists. That is the only job this file has, and nothing may go wrong because of it.
//
// 2026-11-22 (owner): the debugger on /admin/security?tab=ai reported
//   "The FetchEvent for https://junkalot.co/admin/security?tab=ai resulted in a network
//    error response: the promise was rejected."
//   "sw.js:35  Uncaught (in promise) TypeError: Failed to fetch"
// The old handler rebuilt every navigation request with cache:'no-store' and re-fetched it.
// When that fetch rejected there was no fallback to the browser's own navigation, so the
// request failed outright and the installed app showed a dead page — which is exactly what
// "no chats, no output, no agent talkback" looked like.
//
// The handler is now a pure pass-through: it never calls respondWith, so every request
// (navigation, API, streaming reply, static file) is handled by the browser exactly as it
// would be with no worker at all. It cannot break a page.
//
// Installed apps still land on the live build: the admin HTML is served with
// Cache-Control no-store and revalidated on every navigation, and /admin/security reloads
// itself once when /api/version reports a build other than the one it is running.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // No respondWith: the browser handles every request itself.
})
