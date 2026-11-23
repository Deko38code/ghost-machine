# I-1 — OS-LEVEL ISOLATION DESIGN (PREPARATION ONLY)

**Status: NOT IMPLEMENTED — READ-ONLY PREPARATION. Awaiting explicit owner approval.**
**Evidence base:** `/home/ghost/masterguard/ISOLATION-AUDIT-2026-11-18.md`, refreshed 2026-11-18 against live Parrot.
**Scope:** PhantomIDE.com on Parrot `10.0.0.251`. Junkalot.co and HaksterAI.com are not touched by this design.

---

## 1. Finding I-1 — CRITICAL

**Owning project:** PhantomIDE.com. **Host:** Parrot. **Process:** PM2 app `phantom`, pid 1294653, fork mode, `exec cwd=/home/ghost694`, `script=/home/ghost694/phantom-server.js`, online 29 h, 13 restarts.

**Verified evidence (re-read this run):**

| # | Evidence | Location |
|---|---|---|
| 1 | Owner sessions resolve `root = HOME_DIR` (`/home/ghost694`) | `phantom-server.js:2738` |
| 2 | Path resolver allows anything under that root; denylist is only dotfiles, `.env`, own binaries | `:2743-2751` |
| 3 | `PUT /api/files/*` writes with `fs.writeFileSync` | `:2779` |
| 4 | `DELETE` correctly returns 403 | `:2782` |
| 5 | Terminal API `spawn('bash',['-c',…])` with `cwd: workDir` | `:2842`, `:2861` |
| 6 | Language code-exec API `spawn(lang.cmd, …)` | `:2814` |
| 7 | `pm2 jlist` read for the health panel (whole fleet) | `:9078` |
| 8 | Junkalot bridge key read; Junkalot agent uploads root | `:39-42`, `:49` |
| 9 | `ProtectHome` analogue already used per-command via `bwrap --ro-bind / / --unshare-pid` | `:3785` |

**Why the current state is unsafe:** the IDE and Junkalot run as the **same UNIX user** (`ghost694`). `/home/ghost694` is `700`, which stops *other* users — it stops nothing that runs as `ghost694`. `/home/ghost694/junkalot` is `775 ghost694:ghost694`, so every code path in the IDE that reaches the filesystem — file API, terminal, language runner, agent shell — reaches Junkalot's production tree, including `data/` and `next.config.js`.

**Policy note honoured:** an application-level allowlist is explicitly *not* proposed as the fix. It appears below only as defence-in-depth at Layer 3.

---

## 2. What the IDE actually needs (measured, not assumed)

The IDE is deliberately multi-project: OMP projects resolve as `<per-user workspace>/<name>` for `junkalot`, `topreels`, `cinevault`, `miniforge`, `whop-intel`, `whop-scraper` (`:3626-3634`). It edits **working copies**, not the production master. Nothing in the code reads or writes `/home/ghost694/junkalot` itself.

Home-root paths it touches (from `path.join(HOME_DIR, …)` call sites):

- `workspace/` — editing copies (rw) — **this is where the Junkalot working copy lives**
- `phantomide/` — app assets, house-ads, walls, logs, publisher sites (rw)
- `phantom-ide.html`, `phantom-server.js`, `phantom-cli.js`, `phantom-chat.js`, `agents-with-skills.json`, `agent-dashboard.html`, `agents-callers.html` (rw, all in `OWNER_FILE_ALLOWLIST` `:2729`)
- `Desktop/phantom-ide.html` (rw)
- `Pictures/` (ro), `.omp/`, `.phantom-publisher/`, `.phantom-backups/`, `.phantom-admin-key`, `.phantom-social-vault.json`, `.config/phantom-db-url` (rw)
- `.config/junkalot-omp-ads-bridge.key` (ro), `.local/share/junkalot-omp-ads-agent` (rw)
- `/home/ghost694/node_modules` (ro) — **required to start**; the server has no local tree
- `.pm2/` — only for the health panel's `pm2 jlist`
- `~/.ssh` — only if the owner's terminal sessions use ssh
- Network: `127.0.0.1:4000` (cloudflared ingress), `127.0.0.1:11434` (Ollama), outbound HTTPS

**Must never be reachable:** `/home/ghost694/junkalot`, `/home/ghost694/junkalot-releases`.

---

## 3. Proposed correction — three layers

### Layer 1 (recommended first): mount-namespace confinement

Give the PhantomIDE process a private view of `$HOME` containing only the paths above. `bash`, the CLI runner and nested `bwrap` children all inherit the namespace, so the terminal and code-exec APIs become confined as well — without changing a single line of application code.

Two vehicles, same bind set:

**A1 — systemd system unit with `ProtectHome=tmpfs` + `BindPaths`**
`User=ghost694` keeps file ownership as-is. Sandboxing directives require a system unit (root-installed), so this replaces PM2 as supervisor for `phantom`.

```
ProtectHome=tmpfs
BindReadWritePaths=/home/ghost694/workspace /home/ghost694/phantomide …
BindReadOnlyPaths=/home/ghost694/node_modules /home/ghost694/.pm2 …
PrivateTmp=yes  ProtectSystem=full  RestrictSUIDSGID=yes
```

**A2 — keep PM2, wrap the command in `bwrap`** (already installed and already used at `:3785`)
`pm2 start /usr/bin/bwrap -- --die-with-parent --unshare-pid --tmpfs /home/ghost694 --bind … --ro-bind / /`. PM2 supervision, logging and the dump format stay untouched; only this one app definition changes.

| | A1 systemd | A2 bwrap under PM2 |
|---|---|---|
| Changes | new unit + stop the PM2 app | one PM2 app definition |
| Robustness | sandbox enforced by the service manager | enforced by the wrapper; a PM2 edit could drop it |
| Recovery | `systemctl stop`, `pm2 start phantom` | restore the previous app definition |
| Effort | ~1–2 h + verification | ~1 h |

**Recommendation: A1**, with A2 as the fallback if PM2 supervision is to be preserved. Both are additive and reversible; neither changes file ownership or permissions.

### Layer 2 (durable): dedicated UNIX user

Run PhantomIDE as user `phantom` with its own home and its own PM2 daemon. The existing `700` on `/home/ghost694` then does the work at the OS level, independent of any mount configuration. Cost: the shared workspace must move to a group-shared directory (`ide` group, setgid) so the IDE can still edit working copies, the bridge key needs a group-readable copy, and PM2 must be re-homed. This is the change that would survive a future mount or unit mistake.

### Layer 3 (defence-in-depth): narrow the file API

Restrict the owner root to `phantomide/` + `workspace/` + the existing allowlist, and require an explicit opt-in for the terminal. Not sufficient alone — required by policy — but it removes the everyday foot-gun.

### Optional (strongest): container / systemd-nspawn

Only if Layers 1–2 prove insufficient. Highest effort, hardest rollback.

---

## 4. Cross-project impact

- **Junkalot:** none in Layer 1 (no file, permission, service or build change). Layer 2 would require relocating the Junkalot **working copy** that lives under `workspace/` — a Junkalot-owned directory, so it needs its own approval and its own verified snapshot.
- **HaksterAI:** unaffected by any layer. Its write into `phantomide/data` (I-2) continues until I-2 is handled separately.
- **Tunnels:** unchanged. `cloudflared` connects to `127.0.0.1:4000` from outside the namespace.
- **Ollama:** unchanged; same host, loopback.

---

## 5. Backup and rollback readiness

| Requirement | State |
|---|---|
| phantomide repo snapshot | VERIFIED — bundle `5e2ce279`, isolated restore, 99 files (2026-11-18) |
| junkalot both copies | VERIFIED — `58fa9dfb` (245 files), `e62f6c77` (225 files) |
| workspace untracked files | NOT INDEPENDENTLY SNAPSHOTTED — the 2026-11-18 set covers repositories, not the whole `workspace/` tree. **A workspace snapshot is a prerequisite for Layer 2**, and advisable before Layer 1. |
| encrypted `.gpg` recovery | UNVERIFIED — still needs the owner's passphrase |
| Layer 1 rollback | stop the unit, `pm2 start phantom`; no permissions changed |
| Layer 2 rollback | `chown` back plus PM2 re-home; needs its own verified snapshot first |

---

## 6. Pre-implementation checks (policy step 4) — open items

1. `lsof` snapshot of pid 1294653 to confirm the actual open-file set matches the bind list.
2. Confirm the restart path is `process.exit` (`:1304-1305`) so the IDE's self-update survives losing `pm2` CLI access.
3. Decide whether the pm2 health panel may degrade (no `~/.pm2`) or is bound read-only.
4. Decide whether owner terminal sessions need `~/.ssh` (if yes, bind it read-only).
5. Verify nested `bwrap` works inside the outer namespace.
6. Test the namespace on an alternate port before switching the live app.

---

## 7. Required reporting block

| Field | Value |
|---|---|
| Finding ID / severity | I-1 / CRITICAL |
| Owning project | PhantomIDE.com (host Parrot) |
| Verified evidence | §1 table, all re-read this run |
| Proposed correction | §3 — Layer 1 now (A1), Layer 2 as the durable fix |
| Cross-project impact | §4 — Junkalot unaffected at Layer 1; Layer 2 touches the shared workspace |
| Backup / rollback | §5 — repo snapshots verified; workspace snapshot outstanding; gpg unverified |
| Authorization status | **NOT AUTHORIZED** |
| Implementation status | **NONE — nothing changed** |
| Live verification | PhantomIDE online 29 h on :4000; Junkalot serving :5006; state identical to audit time |

**Final rule:** when uncertain, stop, preserve data and request authorization.
