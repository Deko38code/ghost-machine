#!/usr/bin/env python3
"""Append-only brain entry (both Junkalot copies): Phantom status service."""
import time

ENTRY = """

## 2026-11-17 — Deployment status service (SSE) running as a pm2 app

Owner supplied a status service ("Junkalot.co — Live customers": SSE /events, token-gated
POST /update, state persisted atomically) and asked for a strong token plus a separate pm2 app.

- File: `scripts/phantom-status-service.js` (identical in BOTH copies). Kept as supplied —
  token required and >=32 chars with a constant-time compare, 4 KiB body cap, integer percent
  0-100, phase <= 60 chars, message <= 200 chars, `data:` SSE frames with a 20 s heartbeat,
  temp-write + rename persistence. One read-only `GET /state` snapshot was added for pages that
  cannot hold an SSE connection open.
- Running: pm2 app `phantom-status` (id 4), pid 1892994, `127.0.0.1:3002`, fork mode, restarts=1.
- Two deviations, both forced by the existing box and reported to the owner:
  * PORT — the owner's snippet used 3001, which is already held by the earlier Junkalot toast
    service (node pid 1887575). This service therefore runs on `PHANTOM_STATUS_PORT=3002`.
  * STATE PATH — the snippet used `/var/lib/phantom/status.json`, which needs root on this box
    and does not exist. State lives at `/home/ghost694/.phantom/status.json` (mode 600) via
    `PHANTOM_STATE_FILE`, with the directory at 700.
- Token: `/home/ghost694/.phantom-token`, 48 random chars, mode 600, value never printed,
  committed or documented. Rotate by replacing the file and restarting `phantom-status` with
  the new value. No `pm2 save` was run (owner config).
- Verified end to end: `GET /state` answers; `POST /update` without/wrong token -> 401; with
  token -> 200; percent 150, non-integer percent, phase > 60 chars, message > 200 chars -> 400;
  a live `/events` client received the initial state and then the published one; state landed on
  disk mode 600; and after `pm2 restart phantom-status` (pid changed, restarts=1) the service
  answered with the persisted state — that is the restart-resume path. Status was then reset to
  idle so customers never see a stale 75 % bar.
- Not publicly routed yet: nothing sends `junkalot.co` traffic to :3002, and no tunnel or config
  was touched. The owner's standing instruction is to leave the tunnel exactly as it is.
"""

for p in (
    '/home/ghost694/junkalot/docs/junkalot-brain-current.md',
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/docs/junkalot-brain-current.md',
):
    open(p, 'a', encoding='utf-8').write(ENTRY)
    print('APPENDED', p, time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
