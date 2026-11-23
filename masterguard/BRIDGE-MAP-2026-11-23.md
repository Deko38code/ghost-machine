# Junkalot OMP Snapshot ↔ PhantomIDE Support Bridge — read-only mapping

Date: 2026-11-23 · Status: **mapping only — no bridge code written, no production change**
Author: Claude Code · Hosts inspected read-only: Parrot (10.0.0.251) `/home/ghost694/junkalot`, `/home/ghost694/phantom-server.js`

## 1. What already exists (verified with line references)

### PhantomIDE side
| Piece | Where | Behaviour |
|---|---|---|
| Owner/paid helpers | `phantom-server.js:3361` `isPaidUser`, `:3365` `getSessionProfile`, `:40` `junkalotAdsBridgeAuthorized` | paid = role owner/admin/pro **or** plan monthly/intro/weekly/quarterly/yearly/lifetime/team/pro/daily |
| `users` table | `:441`, plan added `:540` (`TEXT DEFAULT 'free'`) | id, email (unique), name, role, plan; Postgres `phantom_ide_live` |
| Bridge-gated create | `POST /api/agents/remote-support/session` `:3710` | header `x-junkalot-ads-bridge` compared (timing-safe) against the 64-byte key file `~/.config/junkalot-omp-ads-bridge.key` (mode 600); `requested_by` must be in `JUNKALOT_ADS_USAGE_USERS` (`:50`) |
| Admin-panel create (activated today) | `POST /api/admin/support/video/session` `:3760` | owner-only, **paid customer checked in the DB** (`users` row + `isPaidUser`), behind `PHANTOM_OMP_VIDEO_SUPPORT` |
| Transport | `remote-assist.html`, `WS /ws/remote-assist` `:1232` | origin-locked upgrade; roles owner/client; 6-digit code SHA-256 compared, 5 failed codes ends it; 20 concurrent; 20-minute cap; invite 5–20 min |
| Lifecycle states | `:1245` close, `:1257` join, `:1279` accepted | created → owner joined → client joined (`client-waiting` to owner) → `accepted` starts the 20-min clock → ended with reason: `invite-expired`, `20-minute-session-limit`, `participant-ended`, `connection-lost`, `code-attempt-limit`, `owner-ended` |
| Audit | `ompAppsLog` `:3935` | append-only JSONL, metadata only: session id, requested_by, customer, invite/connection limits, reason. No token, code or media |
| Status query | **none** | state lives only in the in-memory Map and WS events |

### Junkalot side
| Piece | Where | Behaviour |
|---|---|---|
| Bridge call | `src/app/api/remote-support/session/route.ts` | admin-only (`getServerSession` + `isAdminEmail`), reads the same key file, POSTs to `http://127.0.0.1:4000/api/agents/remote-support/session`, 10 s timeout |
| Own support transport | `src/lib/support-sessions.ts`, `/api/admin/support-session` | Junkalot's *own* in-memory signalling (offer/answer/ice/bye/control-state), TTL 2 h, audit `data/support-audit.jsonl` |
| Support console | `src/app/admin/support/page.tsx` | polls its own signalling every 1.5 s |
| OMP Snapshot panel | `src/app/admin/security/_OmpNoticePanel.tsx` | polls its feed every 12 s (60 s notice sync) — this is the realtime mechanism a bridge status would ride on |

Media path today: browser ↔ PhantomIDE directly (WebRTC + STUN), never through Junkalot. **Already satisfies "media never proxied".**

## 2. Gap analysis against the requested design

| Requirement | Today | Gap |
|---|---|---|
| PhantomIDE is authority for customer + entitlement | bridge endpoint trusts `requested_by` from a hardcoded set | create must check the **customer's** `users` row + `isPaidUser` server-side (the admin-panel endpoint already does; the bridge endpoint does not) |
| PhantomIDE validates the **agent** | `JUNKALOT_ADS_USAGE_USERS` (`:50`) mixes owner and **client** addresses (`1junkalot@…`, `susanschlamp53@…`) | agent and customer are conflated; a client address can mint a session if the key is presented. Needs a separate owner-only agent allow-list |
| Short-lived, single-use, audience-bound tokens | one long-lived shared key, sent on every request | no expiry, no `jti`, no audience. Add a signed per-request token (below) |
| Never reuse Junkalot customer identity as PhantomIDE identity | Junkalot NextAuth accounts and PhantomIDE `users` rows are unrelated; nothing maps them | **the central missing piece** — see §4 |
| Status events in the OMP Snapshot (requested/waiting/connected/reconnecting/ended/failed) | no status endpoint at all | add bridge-authenticated `GET .../status` + Junkalot proxy route |
| Rate limiting | capacity cap of 20 sessions only | add per-caller (per agent email + IP) create/status limits |
| Audit trail, minimal | `ompAppsLog` metadata; Junkalot `support-audit.jsonl` | add `event: bridge-created / bridge-status-read` with token id, no values |
| Customer explicit accept, separate grants, visible stop | client page: consent checkbox, then browser share prompt; `Stop sharing` button; view-only, no input control, no recording | satisfied for screen share; **camera/mic/remote-control are not available** — `Permissions-Policy` denies camera+microphone globally (`phantom-server.js:1182`); enabling them is a separate approval |
| "reconnecting" state | server closes the session on WS close (`connection-lost`) | no grace window. Honest options in §5 |

## 3. Proposed API boundary (PhantomIDE owns it)

All bridge calls are **server-to-server from Junkalot on loopback**, never from a browser. Browser never sees a bridge credential; the customer link carries only the opaque invite token in the URL fragment.

1. `POST /api/agents/remote-support/session` (existing endpoint, extended)
   body `{ customer_email, requested_by, invite_expires_minutes, jti, iat, exp, aud }`
   checks: token signature + `aud:"phantomide-support"` + `exp-iat ≤ 60 s` + `jti` unseen; agent in `PHANTOM_SUPPORT_AGENTS` (owner only); customer row exists and `isPaidUser` → else `402 {paid_required:true}`; rate limit 6/min/agent.
2. `GET /api/agents/remote-support/session/:id/status`
   returns `{ state, reason, invite_expires_at, connected_at, view_only:true, media:"webrtc-direct" }`, state one of `requested|waiting|connected|ended|failed`.
3. `POST /api/agents/remote-support/session/:id/end` — agent ends it; same token rules.
4. Token: HMAC-SHA256 over `aud|jti|iat|exp|action|session_id` with the existing 64-byte bridge key as the root secret (already mode 600, one per deployment pair). PhantomIDE keeps a 5-minute ring of seen `jti` values. No new long-lived secret, no credential in the browser, replay impossible after 60 s.

Nothing here writes into the other project's repo, DB or logs. Junkalot stores only its own session id ↔ PhantomIDE session id mapping in its own `data/support-audit.jsonl`.

## 4. The identity problem (needs an owner decision before any code)

The spec says: *never reuse Junkalot customer identity as PhantomIDE identity.* Today there is no mapping at all between a Junkalot client (NextAuth email) and a PhantomIDE `users` row. Options:

- **A (recommended): explicit mapping file in PhantomIDE.** `~/.config/phantom-support-customers.json` = `{ "junkalot client email": "phantomide users.email" }`, read server-side at session create. Client never authenticates to PhantomIDE, is never given a PhantomIDE identity, and PhantomIDE resolves **her** row before granting. Requires the owner to state her PhantomIDE account email(s) once.
- **B: Junkalot asks the customer to type her PhantomIDE email** each time; PhantomIDE looks it up and checks paid. No file, but the customer can be phished into naming any address, and it exposes that she has an account.
- **C: invite-only guest sessions** (no `users` row; entitlement checked on the Junkalot side only). **Rejected** — it contradicts "PhantomIDE is the authority for entitlement."

I recommend A. I need from the owner: the PhantomIDE account email that is the paid customer for her Junkalot work, and confirmation that only the owner account is a support agent.

## 5. The "reconnecting" question

`reconnecting` cannot be shown truthfully today: on WS close while connected the server ends the session (`:1297`). Two honest choices:

- **Report `ended` with reason `connection-lost`** (no transport change; recommended first release), or
- add a 30-second reconnect grace window in the transport — a change to the live remote-assist path used by the Junkalot bridge and the new admin panel, so it needs its own approval and a two-browser test.

I will not invent a `reconnecting` state that the server cannot produce.

## 6. Proposed per-repository changes (nothing written yet)

**PhantomIDE (`/home/ghost694/phantom-server.js`, repo copy mirrored by the same idempotent patch):**
- `PHANTOM_SUPPORT_AGENTS` = owner-only set (new), used instead of `JUNKALOT_ADS_USAGE_USERS` for the bridge agent check.
- Token verify helper + `jti` ring; extend `POST /api/agents/remote-support/session`; add `GET .../:id/status` and `POST .../:id/end`.
- Customer resolution via the mapping file (§4 A); `402` when not paid.
- Rate limiter reused from existing `checkRateLimit` pattern, keyed per agent + IP.
- `ompAppsLog` events: `bridge-session-created`, `bridge-status-read`, `bridge-ended` (ids only).
- Flag: `PHANTOM_SUPPORT_BRIDGE=1`, default **off**.

**Junkalot (`/home/ghost694/junkalot`, ships only via `npm run build:update`):**
- `src/app/api/admin/support-bridge/session/route.ts` — admin-only; mints the token server-side, calls PhantomIDE, stores its own mapping; rate-limited.
- `src/app/api/admin/support-bridge/status/route.ts` — admin-only, `no-store`, reads PhantomIDE status server-to-server; no browser credential.
- `_OmpNoticePanel.tsx` — a small status strip (requested → waiting → connected → ended) inside the existing panel; polls only while a bridge session is open (3 s), never in the background. No new panel, no layout change on the mobile card (§18 applies to the strip).
- `/admin/support` console gains a "PhantomIDE session" row linking to the same status.
- Ledger: worklog entry per §20 when it ships.

## 7. Rollout

1. Owner decides §4 and §5.
2. Stage both sides; produce diffs; owner reviews (as with today's video panel).
3. Restart PhantomIDE with `PHANTOM_SUPPORT_BRIDGE=1` (env-preserving restart as used today), verify status endpoint 200 owner / 403 non-owner / 402 unpaid.
4. Deploy Junkalot via `npm run build:update` (§27), verified by `/api/version`.
5. One real two-browser test: customer shares, agent sees, both status transitions observed, end from both sides.
6. Report per §13, including anything unmeasured.

## 8. Not verified in this mapping
- No live call placed through the bridge; no browser render of the proposed strip.
- `users.plan` values for her accounts were not read (would be client data); the paid check itself is code-verified only.
- Rate-limit budgets are proposals, not measurements.
- The mapping file does not exist yet; option A is unbuilt.

## 9. Blocked on owner decisions
- §4: which PhantomIDE account is the paid customer (A / B / C).
- §5: `ended/connection-lost` only, or a reconnect grace window.
- Confirm support agents = owner account only.
