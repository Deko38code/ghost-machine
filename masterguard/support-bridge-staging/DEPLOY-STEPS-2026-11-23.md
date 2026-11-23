# Junkalot ⇄ PhantomIDE support bridge — prepared 2026-11-23, NOT DEPLOYED

Nothing here has been applied to production. No service restarted, no tunnel touched, no email sent,
no data deleted. All work sits in staging on the Dell (`/home/ghost/masterguard/support-bridge-staging/`)
and on Parrot (`/home/ghost694/support-bridge-staging-20261123/`).

## What it does

- Junkalot admin (owner only) asks PhantomIDE for one support session for one named client.
- The long-lived bridge key never travels on a request. Each call carries an HMAC-SHA256 token:
  `aud: "phantomide-support"`, 60-second expiry, unique `jti`, single action.
- PhantomIDE verifies signature, audience, action, expiry and consumes the `jti` atomically in
  Postgres (`support_bridge_jti`, `INSERT … ON CONFLICT DO NOTHING RETURNING`) — replay-safe across
  processes.
- Agent must be one of PhantomIDE's owner accounts.
- Presence gate: the bridge is open only while the client is signed in on Parrot (Junkalot's
  `data/admin-sessions.jsonl` or PhantomIDE's `.phantomide-client-ips.json`, read-only, 15-minute
  window). Otherwise `409 {client_not_present:true}` — the owner's rule of 2026-11-23.
- Entitlement: the mapped PhantomIDE `users` row is checked with `isPaidUser`. If there is no row
  (her case — her plan is metered on Junkalot's books, billing from 2027-01-01), the owner-recorded
  plan in `~/.config/phantom-support-customers.json` (`support:true`, `planUsdMonth:249`) entitles.
  No record → `402`. Nothing is inferred by code.
- Status feed: `requested` / `waiting` / `connected` / `ended` / `failed`. A closed socket is
  `ended` with a `connection-lost` reason — there is no `reconnecting` state.
- Media never passes through Junkalot: the session is PhantomIDE's own WebRTC transport, screen-share
  only, and the panel says so.

## Verified in staging

| Check | Result |
|---|---|
| Helper tests (`node --test support-bridge-lib.test.js`) | 12/12 pass, Dell and Parrot |
| Patched server syntax (`node --check`) | OK |
| Patched file vs live PhantomIDE server | patch applies to the live file byte-for-byte (sha256 `1f0a32b8…`) |
| Junkalot routes typecheck (`tsc` against the Junkalot config) | 0 errors |
| Real two-browser support call | **UNVERIFIED** |
| §18 viewports 360×640, 390×844, 414×896, 1920×1080, 1440×900 | **UNVERIFIED** |
| Panel reply path | **UNVERIFIED** (and no email may be sent) |

## Install — PhantomIDE (Parrot)

1. Confirm the client is signed out (§32/§33): `cd /home/ghost694/junkalot && node scripts/client-activity.mjs`
   and `data/admin-sessions.jsonl` shows no active client; record email + IP evidence.
2. `cp -p /home/ghost694/phantom-server.js /home/ghost694/phantom-server.js.bak-support-bridge-<UTC>`
3. `cp /home/ghost694/support-bridge-staging-20261123/support-bridge-lib.js /home/ghost694/`
4. `cp /home/ghost694/support-bridge-staging-20261123/phantom-server.js /home/ghost694/phantom-server.js`
5. `install -m 600 /home/ghost694/support-bridge-staging-20261123/phantom-support-customers.json ~/.config/phantom-support-customers.json`
6. Enable the flag without losing the existing env (preserve `/proc/<pid>/environ`, add
   `PHANTOM_SUPPORT_BRIDGE=1`; optional `PHANTOM_SUPPORT_PRESENCE_MINUTES=15`), `pm2 restart phantom --update-env`, then `pm2 save`.
7. Verify: `curl -s localhost:4000/api/health` OK; bridge routes answer `401 Bridge token required`
   without a token; with `PHANTOM_SUPPORT_BRIDGE` unset they answer `404`.

## Install — Junkalot (Parrot master copy `/home/ghost694/junkalot`)

Ship only through the widget (§27): `npm run build:update -- --label support-bridge --note "…" --public`
after copying the four files from `support-bridge-staging/junkalot/src/`:

- `src/lib/support-bridge-token.ts`
- `src/app/api/admin/support-bridge/session/route.ts`
- `src/app/api/admin/support-bridge/status/route.ts`
- `src/app/api/admin/support-bridge/end/route.ts`

The existing `/api/remote-support/session` route is left untouched; retire it in a later change once
the panel calls the new signed-token routes.

## Rollback

PhantomIDE: restore `phantom-server.js.bak-support-bridge-<UTC>`, remove `PHANTOM_SUPPORT_BRIDGE`
from the pm2 env and restart. The mapping file and `support_bridge_jti` table are inert without the
flag. Junkalot: previous build via the update widget.

## Still to build / decide

- The OMP Snapshot status strip UI (panel component reading `GET /api/admin/support-bridge/status`).
- Whether to retire `/api/remote-support/session`.
- Real-call test, viewport measurements, panel-reply check — all still unverified.

## DEPLOYED 2026-11-23T08:27Z (owner said "go")

- Pre-flight: `scripts/client-activity.mjs` → "no client active (owner accounts excluded)" at 08:23:51Z.
- PhantomIDE: live server backed up to `phantom-server.js.bak-pre-support-bridge-20261123T082400Z`
  (identical to the staging pristine file), `support-bridge-lib.js` installed, patched server installed,
  mapping file installed at `~/.config/phantom-support-customers.json` mode 600, phantom restarted with
  75 env keys preserved + `PHANTOM_SUPPORT_BRIDGE=1` + `PHANTOM_SUPPORT_PRESENCE_MINUTES=15`, `pm2 save` OK.
- Verified live (loopback): health 200; bridge routes 401 without a token; valid token + her email →
  409 `client_not_present` (presence gate, nothing created); replay → 401; expired / foreign audience /
  wrong action / tampered signature → 401; non-owner agent → 403; unknown session → 404;
  entitlement from the mapping → `plan-agreed` $249; unmapped → `no-account`.
- `support_bridge_jti` exists in Postgres and holds the consumed tokens (2 rows at 08:27:43Z).
- Public API on phantomide.com is behind the pre-existing trial/paywall middleware (402), same as the
  legacy agents route — server-to-server over loopback is the supported path and is unaffected.
- Junkalot: four files installed in the master copy, `tsc --noEmit` clean, shipped through the widget:
  build `E-DRaPaZNi2EO4vGrlNcQ`, dir `.next-junkalot-support-bridge-20261123T082537Z`, serving local +
  public; `/api/version` reports it; the three new routes answer 403 without an owner session; public
  home 200. Invoice worklog appended (§20) for that build.
- Still unverified: real two-browser support call, §18 viewports, panel-reply path. OMP Snapshot status
  strip UI not built yet.
