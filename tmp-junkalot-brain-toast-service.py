#!/usr/bin/env python3
"""Append-only brain entry (both Junkalot copies) for the toast/progress service."""
import time

ENTRY = """

## 2026-11-17 — Live toast + progress notifications (service built, not yet public)

Owner supplied an express + ws toast service, a top-right toast stack, and a bottom-right
"Junkalot Live Update" progress panel, then asked for them to be wired up.

Verified on this box (Parrot) this session:

- `scripts/toast-service.js` (new, identical in `/home/ghost694/junkalot` and the editing copy)
  is the owner-supplied express + ws server: `GET /healthz`, `POST /api/toast`, ws
  `ws://127.0.0.1:3001/ws/status`. Publishing is fail-closed — no `TOAST_API_KEY` in the
  service environment means every publish is 401. Valid events are `info|success|warning|error`
  (`title` ≤100, `message` ≤500) and `progress` (`percent` 0–100, `message` ≤500).
- It runs as its own process, not inside the Next app: pid 1887575, `setsid nohup` from
  `/home/ghost694/junkalot`, bound to `127.0.0.1:3001`, log `/home/ghost694/junkalot-toast.log`.
  The API key lives in `/home/ghost694/.junkalot-toast-key` (mode 600); the value is never
  printed or committed. Change that file and restart this one service to rotate it.
- Dependency note: the running service resolves `express`/`ws` from `/home/ghost694/node_modules`
  (owner-level tree), because the master tree does not yet own them. `npm install express ws
  --save` was run in the EDITING COPY only (express ^5.3.0, ws ^8.23.0) so the live tree's
  dependencies are untouched. At deploy time the same two packages should be installed into the
  master tree so the service does not depend on the parent directory.
- Verified end to end: `/healthz` → `{ok:true,publishArmed:true}`; publish with no key → 401;
  wrong key → 401; ws handshake → "Server Online"; valid toast → 200 and delivered to the socket;
  `{"type":"progress","percent":75,"message":"Deploying Junkalot update..."}` → 200 and delivered;
  `percent: 180` → 400; unknown type → 400.
- `src/components/JunkToastStack.tsx` (new) renders the supplied top-right `#junk-toast-stack`,
  exposes `window.JunkToast({type,title,message,duration})`, auto-dismisses at 6 s, caps at 5.
- `src/components/JunkProgress.tsx` (new) renders the supplied `⚡ Junkalot Live Update` panel
  bottom-right, hidden until the first `progress` event, green "Completed!" at 100 %, auto-hides
  8 s later, exposes `window.JunkProgress(percent, message)`.
- Both components open a socket ONLY when the page advertises
  `<meta name="junkalot-toast-ws" content="wss://…">`. No endpoint advertised = inert, so a page
  never loops against a socket this origin does not serve.
- `src/app/layout.tsx` imports and renders both alongside `<UpdateToast />`. `node --check` on
  both service copies and `npx tsc --noEmit` in BOTH trees pass with no output.

NOT live yet — explicitly pending, do not claim otherwise:

1. `wss://junkalot.co/ws/status` does not resolve publicly. Parrot's tunnel route
   (`~/.cloudflared/config.yml`) sends `junkalot.co`, `www.junkalot.co`, and the
   junkalotjunkremoval.com names to `127.0.0.1:5006` only; nothing reaches :3001. Public exposure
   needs a path-scoped ingress rule for `^/ws/` → `http://127.0.0.1:3001` ahead of the existing
   hostname rules, plus a cloudflared reload. Tunnel config is owner-frozen, so it was NOT
   changed and no tunnel was restarted.
2. The `<meta name="junkalot-toast-ws">` tag is intentionally NOT in the layout yet, for the same
   reason: advertising an endpoint that does not answer would show "Connection Lost" toasts.
3. The toast stack, progress panel, and the earlier update-applet auto-hide are source-only in
   both trees — no build, no deploy, no restart (owner: "no server restarts until i say").
"""

for p in (
    '/home/ghost694/junkalot/docs/junkalot-brain-current.md',
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/docs/junkalot-brain-current.md',
):
    open(p, 'a', encoding='utf-8').write(ENTRY)
    print('APPENDED', p, time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
