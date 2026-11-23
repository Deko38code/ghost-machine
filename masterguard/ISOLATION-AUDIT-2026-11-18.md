# MASTERGUARD — STRICT PROJECT ISOLATION AUDIT

**Date:** 2026-11-18
**Hosts inspected:** Dell `ghost-Inspiron-7348` (10.0.0.x, user `ghost`) and Parrot `10.0.0.251` (user `ghost694`)
**Mode:** READ-ONLY. No file, service, config, tunnel, PM2, cron or DNS change was made.
**Result label:** PARTIALLY VERIFIED — everything below was read from the live systems; two items cannot be closed without Cloudflare zone access (I-6) and owner decision (I-5).

---

## 1. Application map (verified this run)

| App | Box | Supervisor | Path | Port | Public hostnames |
|---|---|---|---|---|---|
| Junkalot.co | Parrot | systemd `junkalot.service` | `/home/ghost694/junkalot` (`next start -p 5006`) | 5006 | junkalot.co, www.junkalot.co, junkalotjunkremoval.com, www.junkalotjunkremoval.com |
| PhantomIDE.com | Parrot | PM2 app `phantom` (id 0) | `/home/ghost694/phantom-server.js`, cwd `/home/ghost694` | 4000 | phantomide.com, www.phantomide.com, dash.phantomide.com (:5173 — nothing listening) |
| HaksterAI.com | Dell | PM2 app `hakster` | `/home/ghost/haksterAi/server/src/index.js` | 3579 | haksterai.com, www, topreels‑3230f40cc3.haksterai.com |
| RMT / CineVault / Miniforge / TopReels | Dell | PM2 | own dirs | 8112 / 8081 / … | rmt.haksterai.com, rentmytrailer.haksterai.com, flixchill.link |

Parrot PM2 roster: `phantom` (online, 29 h), `phantom-status` (online, 16 h), `miniforge` (stopped), `email-monitor` (stopped, 351 restarts), `kiro-wrapper` (stopped).
Dell PM2 roster: 21 apps; the only ones touching these three products are `hakster`, `haksterai-dell-tunnel`, `tunnel-watchdog`, `ensure-up`.

**No PM2/systemd double-management of any one app.** Junkalot is systemd-only; PhantomIDE is PM2-only; HaksterAI is PM2-only. That part of the isolation question is clean.

---

## 2. Findings

### I-1 — CRITICAL — PhantomIDE owner file API spans the entire home directory
`/home/ghost694/phantom-server.js:2738` gives **owner** sessions `root = HOME_DIR` (`/home/ghost694`); `:2745-2751` resolves any path under that root with only a dotfile/`.env`/binary denylist; `PUT /api/files/*` writes it (`:2779`); `DELETE` is correctly 403-disabled (`:2782`). PhantomIDE also exposes a code-execution API (`LANG_CMD`).

**Consequence:** an owner PhantomIDE session can write `/home/ghost694/junkalot/**` — pages, `next.config.js`, `data/*.db` — or run arbitrary code as `ghost694`. Both apps run as the same UNIX user, so there is no OS-level boundary behind the file-path check.

**Recommended correction (not implemented):** pin the owner root to `/home/ghost694/phantomide` and extend `OWNER_FILE_ALLOWLIST` for the handful of home files the IDE legitimately edits; or move Junkalot to its own UNIX user. Requires approval — it changes PhantomIDE behaviour.

### I-2 — HIGH — HaksterAI (Dell) writes into both Parrot projects
`haksterAi/server/src/fleetLog.js:41-42` targets `/home/ghost694/junkalot/data` and `/home/ghost694/phantomide/data`; `:308` builds `mkdir -p "$dir"; T=$(mktemp …); cat >` over SSH. This is what authors `junkalot/data/fleet-snapshot.json` (and explains the 20,603 → 20,626 byte drift already documented in the backup run). Read paths at `:130-136` pull Junkalot guard/apply/ops/lessons files.

**Consequence:** a HaksterAI defect can corrupt Junkalot production data; a Junkalot file lives under another project's authorship.

**Recommended correction:** invert the flow — Junkalot already exposes `/api/fleet-log`; have Junkalot push, or write snapshots to a neutral directory outside both trees. Requires approval.

### I-3 — HIGH — Junkalot self-heal executes from HaksterAI on a timer
`haksterAi/server/src/junkalotGuard.js:38-56` runs `HEAL_SCRIPT` on Parrot every 3 minutes (started from `server/src/index.js:11002`). It probes `https://junkalot.co/api/version` and, when `node_modules/next` is missing, executes `cp -a "$E/node_modules" "$M/node_modules"` (`:44`) — the editing copy → the production master.

**Consequence:** another project holds a write path into Junkalot's production tree. The script itself is copy-only, never restarts, never deletes — but the path exists and runs unattended.

**Recommended correction:** move the heal into Junkalot's own `scripts/` (it already has `learning-guard.sh`); leave HaksterAI with alerting only. Requires approval.

### I-4 — HIGH — PhantomIDE's status service is installed inside the Junkalot tree
Parrot PM2 id 4 `phantom-status`: `cwd=/home/ghost694/junkalot`, `script=/home/ghost694/junkalot/scripts/phantom-status-service.js` (4,441 B, Nov 16), online 16 h, writes a 0600 state file.

**Consequence:** a PhantomIDE component lives in Junkalot's repository and production directory. Junkalot builds, git operations and cleanup passes touch another project's file; it dirties the master copy's working tree.

**Recommended correction:** relocate to `/home/ghost694/phantomide/scripts/` and repoint the PM2 app (PM2 configuration change → Level 1 approval).

### I-5 — MEDIUM — Two different Cloudflare tunnels are configured for the same Parrot hostnames
- Running: `~/.cloudflared/config.yml`, tunnel `f9f970fe-212b-4faf-82fb-8523463c3a96` — phantomide.com/www → :4000, junkalot.co/www + junkalotjunkremoval.com/www → :5006, dash → :5173, email-monitor-…haksterai.com → :9191.
- Present but not run by the unit: `/etc/cloudflared/config.yml`, tunnel **`41222e05-…`** — phantomide.com/www → :4000, catch-all 404. Both carry credentials.

**Consequence:** if the `/etc` unit is ever enabled, PhantomIDE hostnames can be claimed by a second tunnel (split routing / 404 flapping). Parrot also runs **two** cloudflared processes on the same config (root 1620 + user 1778).

**Recommended correction:** owner decision only. Tunnel configuration is frozen; no change made. Recommend retiring or renaming the `/etc` copy after a verified backup, and consolidating the duplicate cloudflared instance.

### I-6 — MEDIUM — A wildcard ingress rule makes RMT the default owner of `*.haksterai.com`
`/home/ghost/.cloudflared/rmt-auth-dell.yml:8-9`: `*.haksterai.com → 127.0.0.1:8112`. HaksterAI's own tunnel claims `haksterai.com`, `www`, `topreels-3230f40cc3`; the Parrot tunnel claims `email-monitor-3230f40cc3`. Three projects share one DNS namespace across two boxes.

**Consequence:** any new haksterai.com subdomain lands on RMT's auth service unless explicitly claimed. Actual DNS routing not inspected — no zone access, and DNS commands against tunnels are prohibited.

**Recommended correction:** replace the wildcard with explicit hostnames, or document it as intentional. Owner + Cloudflare dashboard.

### I-7 — MEDIUM — Node resolves modules across the project boundary
`/home/ghost694/node_modules` (451 MB, drwxrwxr-x, ghost694, Oct 27) sits one level **above** `/home/ghost694/junkalot`. `/home/ghost694/phantomide/node_modules` does not exist, so PhantomIDE depends entirely on this home-root tree. Node walks up, so any module missing from Junkalot's local tree silently loads PhantomIDE's copy.

**Recommended correction:** give phantomide its own dependency tree; never `npm install` at `$HOME`. Do not delete the existing tree — it is PhantomIDE's runtime.

### I-8 — MEDIUM — `haksterAi/scripts` kills another project's process
`install-wire-freebuff.sh:17`, `restart-verify-remote.sh:10`, `redeploy-freebuff.sh:18`, `redeploy-freebuff-v2.sh:18`, `restore-remote.sh:9` all `kill -9` the pid listening on Parrot **:9191** (email-monitor; its PM2 entry is stopped yet a node pid still listens). None is scheduled — no cron entry invokes them.

**Recommended correction:** move them to the owning project or gate them behind an explicit confirmation.

### I-9 — MEDIUM — One project's supervisor restarts the whole fleet
`/home/ghost/bin/pm2-ensure-up.sh` runs as PM2 app `ensure-up` with `exec cwd=/home/ghost/haksterAi`; `REQUIRED=(hakster rmt cinevault miniforge haksterai-dell-tunnel rmt-auth-tunnel flixchill-tunnel hakterm claude-code-proxy)`; `SAVE=1` means it calls `pm2 save` and rewrites the PM2 dump when everything is green.

**Consequence:** fleet-wide start authority and boot-config writes live inside the HaksterAI project. It also collides with the standing "no pm2 save/dump" rule — pre-existing owner tooling, not an agent action.

### I-10 — LOW — Deliberate Junkalot↔PhantomIDE bridge assets live in PhantomIDE's home
`phantom-server.js:39-42, :49` — reads `~/.config/junkalot-omp-ads-bridge.key`, stores Junkalot agent uploads under `~/.local/share/junkalot-omp-ads-agent`; gates at `:3670, :3682, :3711`.

**Consequence:** PhantomIDE holds a Junkalot credential. By design; it means rotating or deleting one side silently breaks the other.

### I-11 — LOW — Junkalot's learning-guard writes at the home root
`junkalot/scripts/learning-guard.sh` (cron `*/5`) writes `/home/ghost694/shell-tripwire.log` and `.junkalot-tripwire.state`. Everything else it touches is inside `junkalot/`, `junkalot-releases/` and its own editing copy.

### I-12 — LOW — The SSD mount is cross-project by construction
`/mnt/parrot-work-ssd` is fuseblk `rw,user_id=0,group_id=0,default_permissions,allow_other` → NTFS ignores UNIX permissions; every local user can read/write everything on it. 98.15 % full (home 95.62 %, RAM 85.3 %, CPU 9.3 % at read time).

---

## 3. Verified negatives (isolation holds where it matters most)

- **No shared credential values.** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENROUTER_API_KEY` appear by name in both `haksterAi/server/.env` and `junkalot/.env.local`, but comparing SHA-256 prefixes of the values shows all three **differ**. Names overlap; secrets do not. (No value was printed.)
- Junkalot is absent from every PM2 roster on both boxes; no double supervision.
- PhantomIDE's file API refuses `DELETE` outright (`:2782`) and blocks dotfiles, `.env`, and its own binaries.
- Junkalot's own scripts stay inside `junkalot/`, `junkalot-releases/` and the editing copy, except the two tripwire files (I-11).
- `junkalotGuard.js` never restarts, stops, kills or deletes; the heal is a copy into a missing directory.

---

## 4. Recommended corrections — ordered, none applied

| # | Correction | Blast radius | Approval |
|---|---|---|---|
| 1 | Confine PhantomIDE's owner file root to `phantomide/` + allowlist | PhantomIDE only | Level 1 |
| 2 | Relocate `phantom-status` out of the Junkalot tree; repoint PM2 | PM2 + PhantomIDE | Level 1 |
| 3 | Move Junkalot's dep-heal from HaksterAI into Junkalot's scripts | HaksterAI + Junkalot | Level 1 |
| 4 | Stop HaksterAI writing `fleet-snapshot.json` into Parrot project dirs | HaksterAI + both sites | Level 1 |
| 5 | Replace `*.haksterai.com` wildcard with explicit hostnames | DNS/tunnel | Level 2 + owner |
| 6 | Decide the `/etc/cloudflared/config.yml` duplicate tunnel | Tunnels | Level 2 + owner |
| 7 | Give phantomide its own `node_modules`; never install at `$HOME` | PhantomIDE | Level 1 |
| 8 | Move the freebuff kill-scripts under their owning project | None until run | Level 1 |
| 9 | Decide `SAVE=1` in `pm2-ensure-up.sh` and its `haksterAi` cwd | Fleet PM2 | Level 1 |

**Nothing in this table has been implemented. No file, service, tunnel, PM2 entry, cron entry or DNS record was changed during this audit.**

---

## 5. Remaining risks

1. PhantomIDE = shell-equivalent as `ghost694`, so I-1 is a trust boundary, not a bug — an owner-account compromise is a Junkalot compromise.
2. `dash.phantomide.com` is routed to `:5173` with nothing listening — an edge 502 waiting to be noticed.
3. `email-monitor` has 351 restarts and a stopped PM2 entry while a node process still holds `:9191`.
4. Home 95.62 % and SSD 98.15 % full; the audit's 111 Class-A build dirs (6,292 MB) remain the only safe reclaim, still awaiting approval.
5. The GPG recovery test remains BLOCKED on Deke's passphrase.

---

# 6. Completion record — 2026-11-18

**Audit state: COMPLETE. Correction state: NOT AUTHORISED. No production change was made at any point.**

## 6.1 Status of every finding

| ID | Audit evidence | Correction | State |
|---|---|---|---|
| I-1 PhantomIDE owner root spans `$HOME` | Verified against live code | Designed (bwrap namespace), rehearsed on `:4100`, readiness **FAIL** (DB blocker since cleared — B2/B3/B4 remain) | Open — see `/home/ghost/masterguard/CUTOVER-READINESS-2026-11-18.md` |
| I-2 HaksterAI writes into Parrot project data dirs | Verified (`fleetLog.js:308`) | Not proposed for execution | Open |
| I-3 Junkalot dep-heal runs from HaksterAI | Verified (`junkalotGuard.js:44`) | Not proposed | Open |
| I-4 phantom-status lives in the Junkalot tree | Verified (PM2 id 4) | Not proposed | Open |
| I-5 Two tunnels configured for Parrot hostnames | Verified | Frozen | Reported only |
| I-6 `*.haksterai.com` wildcard → RMT | Verified at origin (`foo.haksterai.com` → 404) | Frozen; zone records not inspected | UNKNOWN (DNS layer) |
| I-7 `$HOME/node_modules` shared upward | Verified (451 MB, PhantomIDE has no local tree) | Not proposed | Open |
| I-8 haksterAi scripts kill Parrot `:9191` | Verified, unscheduled | Not proposed | Open |
| I-9 `pm2-ensure-up.sh` starts the fleet + `pm2 save` | Verified | Not proposed | Open |
| I-10 Junkalot bridge key under `~/.config` | Verified, by design | Document only | Open |
| I-11 Junkalot tripwire files at home root | Verified | Document only | Open |
| I-12 SSD mount `allow_other` | Verified | Document only | Open |

## 6.2 Verification additions since the first report

- **Tunnel inventory** — `/home/ghost/masterguard/TUNNEL-INVENTORY-2026-11-18.md`. Five connectors documented; all left running; no tunnel, DNS or credential change.
- **`dash.phantomide.com`** — origin identified as the abandoned `phantom-dashboard` Vite prototype. **Owner decision: leave it.** Recorded in the tunnel inventory and in memory.
- **I-1 rehearsal** — hardened bwrap namespace (`--dev /dev --proc /proc --unshare-pid --bind /run /run`, masking `junkalot` and `junkalot-releases`) serves HTTP 200 in 4 s on `:4100`; `/proc/<pid>/root` escapes return NO; live `:4000` untouched throughout.
- **FIFO job** — see 6.3.
- **Database discrepancy** — see 6.4.

## 6.3 Background FIFO task — **STALLED**

| Question | Answer | Evidence |
|---|---|---|
| Is it transferring? | **No.** 0 bytes received locally after 50 minutes. | Local output `phantomide.probe.bundle` = 0 bytes, created at launch. |
| Is the status stale? | **No — the processes are alive and blocked forever.** | Remote pid 2112490 `cat /tmp/mg-probe.fifo`, state `S`, `wchan=wait_for_partner` (blocked in `open()`); local ssh pid 839718 still resident. |
| Root cause | `git bundle create` writes `<path>.lock` then **renames over the path**, replacing the FIFO with a regular file. The waiting `cat` is stuck on the now-unlinked FIFO inode; no writer can ever reach it. | `/tmp/mg-probe.fifo` is now `F=regular size=14,111,482`, and `git bundle list-heads` reports `5e2ce279… refs/heads/main`, `0788f893… refs/remotes/origin/main` — a valid, complete phantomide bundle nobody is reading. |

Left exactly as found: no kill, no deletion, no cleanup. The artifact at `/tmp/mg-probe.fifo` is a duplicate of the verified `phantomide.bundle` already in the 2026-11-18 backup set. Stopping pid 2112490 (Parrot) and the local ssh pid 839718 needs approval.

**Final state (task ended on its own at ~20:5xZ):** the background job reported `bytes=0` and `git bundle verify` rejected the empty file, then exited 0. Both processes are now gone — local ssh pid 839718 and Parrot pid 2112490 — with no bytes having crossed; the most likely cause is an idle connection drop raising SIGHUP on the remote shell, not an intervening kill (no evidence either way, and no agent action was taken). The 14,111,482-byte bundle remains at `/tmp/mg-probe.fifo` on Parrot, untouched. Live services verified afterwards: phantomide.com 200, junkalot.co 200, haksterai.com 200, `phantom` pid 1294653 unchanged.

## 6.4 Database discrepancy — **RESOLVED 2026-11-17 20:55Z (restored by the owner; root cause still UNKNOWN)**

The sandboxed instance logged `connect ECONNREFUSED 127.0.0.1:5432`. Investigation shows the failure is environmental, not sandbox-induced: `postgresql@17-main.service` **failed at 2026-11-17 14:36:32**, `pg_lsclusters` reports `down`, nothing listens on 5432, and `pg_isready` fails from the host as well. `ECONNREFUSED` (rather than `EPERM`/`ENETUNREACH`) proves the sandboxed process's connection attempt left the process normally.

**Why the cause stays UNKNOWN:** the cluster log `/var/log/postgresql/postgresql-17-main.log` is root-only, so the failure cause is not established, and I could not prove a sandboxed instance reaches Postgres *successfully* while Postgres was down. Disk is not the cause (9.8 GB free). Restoring the cluster required `sudo`, which on Parrot prompts for a password.

**Resolution (owner-run, 2026-11-17 20:55Z):** `sudo systemctl restart postgresql@17-main` → `active`. Verified read-only:

- `pg_lsclusters`: `17 main 5432 online postgres`
- `pg_isready`: `127.0.0.1:5432 - accepting connections` (exit 0); listeners on `127.0.0.1:5432` and `[::1]:5432`
- unit `ActiveState=active`, `SubState=running`, started `20:54:37Z`, `NRestarts=0`
- read-only `SELECT` against the app's own database: `CONNECT_OK db=phantom_ide_live public_tables=46`
- **`phantom` reconnected by itself without a restart** — backend pid 2134199, `client_port=45340`, state `idle`, `backend_start=20:55:03Z`, matching the socket held by live `phantom` pid 1294653 (`fd=22`). No client connection was dropped; the process is still pid 1294653 with 13 restarts.

The database blocker for the cutover is therefore cleared. The *failure cause* is still unrecorded — the root-only log was not read and non-root `journalctl -u postgresql@17-main` returns no entries.

**Production consequence:** PhantomIDE served from its file fallback between 2026-11-17 19:36Z and 20:55Z and is now backed by `phantom_ide_live` again. Redis remains unavailable (`falling back to file storage`) — a separate, pre-existing, non-critical condition.

## 6.5 Approvals required (none requested here)

| Action | Level | Blocker |
|---|---|---|
| ~~Restore `postgresql@17-main`~~ | production restart | **DONE 2026-11-17 20:55Z** — owner ran `sudo`; verified, see §6.4 |
| Cut PhantomIDE over to the hardened sandbox | Level 1 + restart | readiness FAIL until B1–B4 are cleared |
| Stop the stalled FIFO reader (Parrot pid 2112490 + local ssh 839718) | process stop | owner approval |
| Any Class A build cleanup (111 dirs / 6,292 MB) | Level 2 | owner approval |
| GPG recovery test | — | owner's passphrase |
| Tunnel / DNS corrections (I-5, I-6) | Level 2 | frozen |

**No correction has been implemented. All services, tunnels, backups and client connections are as they were at the start of the audit.**
