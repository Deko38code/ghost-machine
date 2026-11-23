# PHANTOMIDE CUTOVER — READINESS REPORT

**Date:** 2026-11-18 · **Host:** Parrot 10.0.0.251 · **Authorization:** read-only verification
**Verdict: NOT READY — 2 critical gates FAIL, 1 UNKNOWN (B1 database blocker CLEARED 2026-11-17 20:55Z). Do not cut over.**
No production change was made by the agent. `phantom` is still pid 1294653, `:4000` 200, `https://phantomide.com` 200, and no `pm2 delete/restart/reload/save` was run. The only production change since this report was written is the owner-run `systemctl restart postgresql@17-main` recorded in §B1.

---

## Gate results

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Why the sandboxed instance reported "DB unavailable" | **PASS — cause established and cleared** | Log: `DB init: Error: connect ECONNREFUSED 127.0.0.1:5432`. `ECONNREFUSED` means the connect attempt left the process and was refused — the sandbox does not block the network. Host-side `pg_isready` → "no response"; no listener on 5432 — the database was down for **everyone**, not just the sandbox. Cluster restored by the owner at 20:54:37Z; see §B1 closure. |
| 2 | Script inspection | **FAIL** | No `rm`/`mv`/`cp`/`chmod`/`sudo`/`systemctl`/`cloudflared`/`pm2 save`/`kill` in either script (scan clean). But defects found: the installed wrapper lacks `--proc`, `--dev`, `--bind /run` and `--unshare-pid` (G22), and neither script sources nvm, so the restarted app would lose `NVM_*`/nvm `PATH` that the live process has (G2). |
| 3 | Original PM2 config restorable exactly | **PASS with caveat** | `script path=/home/ghost694/phantom-server.js`, `exec cwd=/home/ghost694`, `interpreter=node`, `args=N/A`, `fork_mode`, `watch=off`, logs `phantom-out/error.log`. `pm2 start /home/ghost694/phantom-server.js --name phantom --cwd /home/ghost694` reproduces all of it. Caveat: environment is *not* part of the definition — the restarting shell supplies it, so nvm must be sourced or `NVM_DIR/NVM_BIN/PATH` differ from today. |
| 4 | Masks Junkalot without blocking PhantomIDE's own needs | **FAIL as written / PASS as tested** | Installed wrapper: `/proc`, `/dev/shm`, `/run/postgresql` are **MISSING** inside the namespace (`--dev-bind / /` does not carry submounts). Hardened variant (`--dev /dev --proc /proc --bind /run /run`) shows all three present and the app serves **HTTP 200 in 4 s** on `:4100`. All other required paths (node_modules, workspace, phantomide, Desktop, Pictures, .omp, logs, `.config/phantom-db-url`, `.phantom-server.env`, `.phantom-admin-key`, `.cache`, /tmp) were present in both variants. |
| 5 | No alternate path to Junkalot | **PASS (hardened) / residual** | With `--unshare-pid`: only 4 pids visible; `/proc/1294653/root/…/junkalot` **NO**, `/proc/1/root/…` **NO**; mask shows 0 entries. Without it, `/proc` was absent, so the bypass was closed only by accident. 19 symlinks in home point into `junkalot` — all resolve through the masked path, so they are dead. **Residual:** `/mnt/parrot-work-ssd/junkalot-builds` (13 entries) remains readable/writable outside the mask. |
| 6 | Launcher does not interfere with phantom-status / Junkalot / HaksterAI | **PASS** | The wrapper only `exec`s bwrap for the `phantom` app; no pm2, tunnel, systemctl or signal calls; `--die-with-parent` scopes lifetime to its own process. `phantom-status` is a separate PM2 app and is untouched. `pgrep -f phantom-cpu-guard` (used at `phantom-server.js:5471`) finds 0 processes today, so the pid namespace changes no behaviour there. |
| 7 | Client connections / zero-downtime | **FAIL** | Cutover is stop→start: measured 4 s to first 200 under the sandbox, plus PM2 start overhead — roughly 5–8 s of Cloudflare 502s, and every websocket/socket.io session drops. Zero-downtime is **not feasible** without a port swap or tunnel/proxy change, and tunnels are frozen. |
| 8 | No pm2 delete/restart/reload/save | **PASS** | None executed. Live pid unchanged (1294653), local and public both 200. |
| 9 | No Cloudflare/DNS/credential/service change | **PASS** | No cloudflared, systemctl or DNS command was issued. |
| 10 | Verified rollback procedure | **PASS (designed, not executed)** | `pm2 delete phantom && pm2 start /home/ghost694/phantom-server.js --name phantom --cwd /home/ghost694` with nvm sourced; verify local 200, public 200, log shows normal startup; the PM2 dump is never saved, so a reboot independently returns the original definition. |

---

## Blockers

**B1 — CLEARED 2026-11-17 20:55Z (owner-run restore). Database blocker is closed.**

`postgresql@17-main.service` had failed at 2026-11-17 19:36:32Z. The owner ran
`sudo systemctl restart postgresql@17-main` and it returned `active`. Verified read-only afterwards:

| Check | Result |
|---|---|
| `pg_lsclusters` | `17 main 5432 online postgres` |
| `pg_isready` | `127.0.0.1:5432 - accepting connections` (exit 0) |
| listener | `LISTEN 127.0.0.1:5432`, `[::1]:5432` |
| unit | `ActiveState=active`, `SubState=running`, `ExecMainStartTimestamp=2026-11-17 20:54:37Z`, `NRestarts=0` |
| database reachable | `CONNECT_OK db=phantom_ide_live public_tables=46` (read-only `SELECT`) |
| **`phantom` re-attached by itself** | backend pid 2134199, `client_port=45340`, state `idle`, `backend_start=20:55:03Z` — the same `45340` socket owned by live `phantom` pid 1294653 (`fd=22`) |

**No `phantom` restart was required and none was performed.** The process is still pid 1294653 with 13 restarts, holding an authenticated, idle backend. Because the process never restarted, no client connection was dropped by this restore.

**Still unknown:** why the cluster failed. `/var/log/postgresql/postgresql-17-main.log` is root-only and was not read. Disk was not the cause (9.8 GB free at the time). Non-root `journalctl -u postgresql@17-main` shows no entries, so the cause stays **UNKNOWN** rather than guessed at.

**B2 — The installed wrapper is the unhardened version.** It omits `--proc /proc`, `--dev /dev`, `--bind /run /run` and `--unshare-pid`. Missing `/dev/shm` breaks Chromium/Puppeteer features; missing `/proc` breaks process discovery; missing pid isolation leaves the `/proc/<pid>/root` bypass open the moment `/proc` *is* mounted.

**B3 — Environment parity.** Neither script sources nvm. The live process carries `NVM_DIR`, `NVM_BIN` and an nvm `PATH`; a restart from a plain shell would not.

**B4 — The cutover gate is weaker than this report.** It accepts `local 200 + public 200 + mask empty`; it does **not** require a database connection, so it would happily bless an instance that boots without Postgres.

---

## Required remediation before an approval request

1. Rewrite the wrapper with the hardened flag set (tested: 200 in 4 s, escapes closed).
2. Source nvm in both the cutover and the rollback paths; compare `NVM_*`/`PATH` after rollback.
3. ~~Bring Postgres back first~~ — **done, see B1 closure (20:55Z)**. Still open: add "DB connected" as a **hard** gate criterion; the current gate would still bless an instance that boots without Postgres.
4. Decide whether `/mnt/parrot-work-ssd/junkalot-builds` should also be masked (shared work disk — masking it may affect other projects).
5. Accept the ~5–8 s service interruption, or choose a maintenance window.

**Outcome: FAIL — readiness not established. No cutover approval is being requested.**
