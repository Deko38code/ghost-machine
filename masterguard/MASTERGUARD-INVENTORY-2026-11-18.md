# Phantom MasterGuard — production recovery audit
**Run:** 2026-11-18 · **Agent:** Claude Code on `ghost-Inspiron-7348` (Dell) · **Boxes read:** Dell + `parrot` (10.0.0.251)
**Mode:** backup-first, default-deny. No deletions, no overwrites, no prune, no reset, no force-push, no service restart, no deploy. Nothing was removed from either box.

> Note on the requested filename: no file named `/home/ghost/maRY-2026-11-18.md` exists. This document is at
> `/home/ghost/masterguard/MASTERGUARD-INVENTORY-2026-11-18.md` and is the report being maintained.

## Status vocabulary

| State | Meaning |
|---|---|
| **Inventory complete** | counted from the live filesystem this run |
| **Backup verified** | archive written, SHA-256 re-checked, isolated clone compared to source |
| **Backup pending** | produced but not yet verified |
| **Blocked** | cannot be completed by an agent; needs the owner |
| **Not built** | does not exist on any box |

**SyncGuard overall: NOT BUILT.** No private Git server, no mirror, no branch protection, no lag monitor, no dashboard section. What exists after this run is a verified one-off snapshot set plus an inventory.

---

## 1. Background shell status (step 1)

| Shell | PID | Elapsed | State | Detail |
|---|---|---|---|---|
| `backup-run.sh` (protected repos) | 842308 | 10 min | **completed, exit 0** | all five repositories transferred, verified, encrypted |
| FIFO probe (abandoned experiment) | 839716 | 13 min | **hung / inert** | remote side `cat /tmp/mg-probe.fifo` (pid 2112490, 0 % CPU) waits on a FIFO nothing will ever write. It holds no data, no lock, and no CPU. **Left running — stopping processes needs your word.** |

No duplicate transfer was started. Note: an unrelated routine `tar` of `rent-my-trailer` (including `server/.env`) into `/home/ghost/snapshots/rmt/` was running on the Dell at 04:55; not mine, not touched.

---

## 2. Protected-repository inventory (step 1 of the correction)

### 2.1 Owner repositories with GitHub remotes

| Repository | Box | Branch | HEAD | `origin/main` | Remote state |
|---|---|---|---|---|---|
| `/home/ghost/haksterAi` | Dell | main | `fa710f03` | `fa710f03` | in sync |
| `/home/ghost/cine-vault-live` | Dell | main | `95d53175` | `95d53175` | in sync |
| `/home/ghost694/junkalot` | Parrot | main | `58fa9dfb` | `58fa9dfb` | in sync |
| `/home/ghost694/phantomide` | Parrot | main | `5e2ce279` | `0788f893` | **14 commits ahead, unpushed** |
| `/home/ghost694/HAKSTERAI` | Parrot | `ui-lessons` | `44200f8` | branch exists | last commit 2026-07-25 |
| `/home/ghost694/junkalot` editing copy | Parrot | master | `e62f6c77` | **none** | **never pushed** |

Remote connectivity and permissions were verified read-only with `git ls-remote` on every owner repo (all answered; no write was attempted).

### 2.2 Owner repositories with no remote at all — history lives on one disk

`miniforge`, `topreels`, `phantom`, `claude_agents`, `work/parrot-ide`, `workspace/hakterm`, `workspace/ads-agent`, `workspace/live-preview-extension`, `workspace/ads-agent/cinevault`, `phantomide-clean-2026-10-22`, plus the Parrot workspace trees below.

### 2.3 Repositories with zero commits (unborn) — no Git protection whatsoever

`/home/ghost694/workspace/sites/rmt`, `/…/sites/flixchill-link`, `/…/sites/haksterai-com`, `/…/dekekenneth840@gmail.com/whop-intel`, `/home/ghost694/phantom-ide`, `/home/ghost694/workspace/ads-agent/cinevault`, `/home/ghost694/claude-code-chat`.

### 2.4 Third-party / vendored (re-clonable, not client data)

`freebuff`, `freebuff-src`, `hermes-agent` (both boxes), `pentest-agents` (×2), `MacAttack`, `stalkerhek`, `gnome-builder`, `stripe/ai`, `cursor/community-plugins` (×2), `Overture`, `hackbot`, `llama-cpp-python`, `kiro-gateway`, `LocalAGI`, `shannon`, `vim`, `nvm`, `vllm`, `open-webui`, `Qwen3-TTS`, `sqlmap`, `thc-hydra`, `repos/your-repo`.

### 2.5 Backup / mirror repositories

Dell `~/mint-backup/home/{cine-vault-live,haksterAi,kiro-gateway,movie-site}`; Dell `~/` = `Deko38code/ghost-machine` (11 GB `.git`, public home snapshot); Parrot `junkalot/backups/**` and `junkalot-master-verify-20261116T065032Z`.

**Totals:** 64 repository entries; 6 owner GitHub remotes; 4 in sync; 1 unpushed (phantomide, 14 commits); 1 with no remote; 7 unborn.

---

## 3. Dirty working trees — classification (step 2)

Counts are **entries**, not files or fixes.

| Tree | Modified tracked | Untracked | Staged | Secret-shaped paths | Nature |
|---|---|---|---|---|---|
| `junkalot` master | 26 (2,504 + / 128 −) | 18 source + `data/` (4.5 MB runtime) | 0 | none | real work: deploy pipeline, coach/payoff libs, UI components, `OWNERSHIP.md`, `CODEOWNERS` |
| `junkalot` editing copy | 22 (3,032 + / 128 −) | 17 source | 0 | none | same set; **not** a strict subset of master |
| `phantomide` | 3 (384 + / 2 −) | 8 `.bak.*` + `template-thumbs/` | 0 | none | 3 edits, the rest are safety backups |

Master alone carries modified `AGENTS.md`, `next.config.js`, `next-env.d.ts`, `tsconfig.json`, `src/data/training-db.ts`; the editing copy alone carries modified `package-lock.json`. Both were snapshotted separately for that reason.

**Ignored files** (junkalot master, 543 entries): 193 under `src/`, 74 under `docs/`, 24 under `data/`, 12 under `backups/`, plus `.env.local` and `.env.production.local`. Nothing ignored was included in a source archive — secrets are handled separately in §6.

---

## 4. Verified backup and restore-test report (steps 2–4)

### 4.1 Protected repositories — 5/5 verified

Destination: **Dell** `/home/ghost/masterguard/backups/2026-11-18` — a different physical machine from Parrot.

| Repo | Bundle | Tracked files in clone | HEAD source | HEAD clone | SHA-256 | `git bundle verify` | Restore |
|---|---|---|---|---|---|---|---|
| junkalot-master | 259 MB | 245 | `58fa9dfb` | `58fa9dfb` | all OK | is okay (3 refs) | **verified** |
| junkalot-editing | 256 MB | 225 | `e62f6c77` | `e62f6c77` | all OK | is okay (2 refs) | **verified** |
| phantomide | 14 MB | 99 | `5e2ce279` | `5e2ce279` | all OK | is okay (3 refs) | **verified** |
| haksterai | 11 MB | 350 | `fa710f03` | `fa710f03` | all OK | is okay (10 refs) | **verified** |
| cinevault-live | 73 MB | 405 | `95d53175` | `95d53175` | all OK | is okay (3 refs) | **verified** |

Each repo also has `*.dirty.patch` (every uncommitted change) and `*.untracked.tar.gz` (every untracked non-ignored file), each with its own encrypted `.gpg` and a `*.sha256.txt` covering all six files (6/6 OK on re-check).

**Archive fidelity:** untracked archives compared file-by-file against the source — junkalot-master 25 files/122,150 B, junkalot-editing 18/95,278 B, phantomide 27/9,452,164 B, haksterai 0, cinevault 0. All identical except `data/fleet-snapshot.json`, a live runtime file the status service rewrote between capture and comparison (20,603 → 20,626 B) — expected drift, not corruption.

**Patch fidelity:** `git apply --check --reverse` on junkalot-master's patch reproduces the working tree exactly, proving the captured diff is complete.

### 4.2 No-remote repositories — 16/16 snapshotted

All 16 (listed in §2.2/§2.3) now have a worktree archive plus, where history exists, a full-history bundle. **16/16 SHA-256 verified, 10/10 bundles "is okay".** Six are worktree-only by necessity: they have no commits to bundle.

### 4.3 Encryption — created, but **restore-by-decrypt is BLOCKED**

- Every archive has an OpenPGP counterpart encrypted to Deke's existing key `E2D1D1DD6F917C34`. **No new key or passphrase was created by an agent.**
- **Diagnosis (step 6):** the encryption subkey is `FD9D2D4E5A191E5B`; `gpg-connect-agent "KEYINFO --list"` reports the `P` flag for **both** secret keygrips → **passphrase-protected**. Non-interactive decrypt fails with `public key decryption failed: No passphrase given` / `Bad passphrase`. A `--pinentry-mode loopback` attempt without a passphrase fails identically.
- **Owner action needed (one command, one minute):**
  `gpg -o /tmp/verify.tar -d /home/ghost/masterguard/backups/2026-11-18/phantomide.bundle.gpg`
  then `sha256sum /tmp/verify.tar` should equal the bundle's recorded hash. Until that succeeds, every `.gpg` here is **encrypted but not decryption-verified**.
- No existing ciphertext was modified, rewritten or deleted.

### 4.4 Destination capacity (step 4)

`/home` `/dev/sda2` ext4 **457 G total, 285 G used, 150 G free (66 %)**. Backup set 3.3 G, isolated restore-test clones 1.4 G. Capacity is not a constraint for further copies.

### 4.5 Known gaps — still not covered

- **`.env` secrets** are excluded from every source archive by design (§6).
- **`~/mint-backup`** (4.4 G) and the **external SSD** (229 G used) are not in this set.
- **`/home/ghost` home repo (11 G)** — the public snapshot repo; derived, not backed up separately.
- The six **unborn** repos are captured as working trees only; they still have no Git history.

---

## 5. Production environment-secret files (step 5) — names and permissions only, no contents read

| Box | File | Mode | Owner | Size |
|---|---|---|---|---|
| Dell | `/home/ghost/haksterAi/server/.env` | 600 | ghost:ghost | 12,230 B |
| Dell | `/home/ghost/haksterAi/.env` | 600 | ghost:ghost | 2,562 B |
| Dell | `/home/ghost/cine-vault-live/.env` | 600 | ghost:ghost | 3,047 B |
| Dell | `/home/ghost/rent-my-trailer/server/.env` | 600 | ghost:ghost | 1,703 B |
| Parrot | `/home/ghost694/junkalot/.env.local` | **664** | ghost694:ghost694 | 1,203 B |
| Parrot | `/home/ghost694/junkalot/.env.production.local` | 600 | ghost694:ghost694 | 73 B |

**Finding:** `junkalot/.env.local` is mode **664** — readable by every local account. Tightening it to 600 is a one-character permission change on a secret file, so it is **proposed, not applied**; say the word and it is `chmod 600`.

Two backup archives already contain env files (encrypted, mode 600): `hakterm.worktree.tar.gz` → `./.env.bak2`, `miniforge.worktree.tar.gz` → `./.env`. A third match (`ws-phantom-ide` → `.env.example`) is a template, not a secret.

**Proposed secrets-backup procedure (not executed):**
1. On the owning box, build one archive per box from the exact six paths above, `umask 077`.
2. Encrypt to a key whose passphrase Deke holds, into a path readable only by its owner (`700` dir, `600` file).
3. Store the encrypted result on the *other* machine (Dell→Parrot, Parrot→Dell) so the plaintext and its ciphertext never share a disk.
4. Restore-test once by decrypting and diffing the file list (not the values).
5. Record the SHA-256 of the plaintext archive and the ciphertext, plus creation time, in the MasterGuard record.
6. Never print values; never place them in Git, chat, or logs.

---

## 6. Served build identity (step 7)

| Fact | Verified value |
|---|---|
| Public build | `JQsjl1oODOL8uNdHv6IlD` (`builtAt` 2026-11-17T19:56:21Z) — confirmed via `https://junkalot.co/api/version` |
| Service working dir | `/home/ghost694/junkalot` |
| Live build directory | `/home/ghost694/junkalot/.next-junkalot-update-20261117T195448Z` (46 MB, 1,063 files) |
| `distDir` in config | `process.env.JL_DIST_DIR \|\| '.next-junkalot-update-20261117T195448Z'` |
| `BUILD_ID` in that dir | `JQsjl1oODOL8uNdHv6IlD` |
| `data/latest-build.json` | `"build": "JQsjl1oODOL8uNdHv6IlD"`, `"verified": true`, staged 19:56:23Z |
| Listener | `next-server` pid 2109726 on `*:5006` |

The progress-honesty build is **deployed and serving**, not merely staged.

---

## 7. Storage recalculation and build-directory activity (step 8)

Parrot `/dev/sda2` btrfs: **214 G used / 226 G, 9.8 G free (96 %)**. `/tmp` = tmpfs 1.9 G (RAM — freeing it returns nothing to disk). SSD `/dev/sdb1` = separate disk, 229 G used, 4.4 G free (99 %).

| Build dirs | Count | Size |
|---|---|---|
| All `.next-*`, `.next.bak-*`, `.next-backup-*` | 114 | 6,385 MB |
| **Live distDir** (`.next-junkalot-update-20261117T195448Z`) | 1 | 46 MB |
| **Genuinely inactive** | **112** | **6,334 MB (6.19 GB)** |

**Activity evidence:** every running service process (`next-server` 2109726 plus three node pids) was checked through `/proc/<pid>/fd`. The only path they hold open is `/home/ghost694/junkalot/data`. **Zero open file handles exist inside any build directory**, and the config-referenced `distDir` is the live one by name. That is the evidence that the other 112 are inactive — not an age guess.

By era: 2026-09: 1 dir/315 MB · 2026-10: 35 dirs/2,749 MB · 2026-11: 76 dirs/3,270 MB.

---

## 8. Cleanup candidate list (step 9) — proposal only, nothing executed

Full machine-readable manifest with every path: **`/home/ghost/masterguard/cleanup-candidates-2026-11-18.tsv`** (columns: path, MB, files, mtime, live/inactive, open handles, recovery).

### Class A — superseded Next.js build output (112 dirs, 6,334 MB)

| Path | MB | Evidence | Recovery status |
|---|---|---|---|
| `.next-junkalot-automation-20261116T152422Z` | 349 | no handles, not `distDir` | rebuildable from source |
| `.next.bak-total-work-20261031T033852Z` | 349 | no handles, Oct backup copy | rebuildable |
| `.next.bak-readonly-invoice-20261031T032303Z` | 349 | no handles | rebuildable |
| `.next.bak-invoice-link-20261031T032701Z` | 349 | no handles | rebuildable |
| `.next.bak-inclusive-work-total-20261031T033953Z` | 349 | no handles | rebuildable |
| `.next.bak-admin-repair-20261031T030927Z` | 348 | no handles | rebuildable |
| `.next-backup-20260926` | 315 | no handles, oldest | rebuildable |
| `.next-junkalot-bookshelf-fix-20261106T143518Z` | 276 | no handles | rebuildable |
| `.next-junkalot-master-payoff-balance-20261102T0927Z` | 212 | no handles | rebuildable |
| `.next-junkalot-payoff-panel-20261104T022231Z-master` | 183 | no handles | rebuildable |
| … 102 further dirs, 41–153 MB each | | all in the manifest | rebuildable |

**Source of recovery:** Git `58fa9dfb` (verified bundle) + the verified dirty patch + untracked archive in this backup set. Regeneration path is `npm run build:update`.

**Excluded from Class A:** `.next-junkalot-update-20261117T195448Z` — the live production release. Excluded by name *and* by reading `distDir` at run time.

### Class B — package caches (owner approval, not automatic)
`~/.npm` 112 MB, `~/.cache` 847 MB. Refetchable; not part of any automatic mode.

### Class C — snapshot tree (owner-only, no agent action)
`junkalot/backups/learning` 52 GB / 24,685 files. This is a **backup repository**; the script fix is already live (268 MB → 3.6 MB per snapshot). Any retention cap is Deke's number to set.

### Permanently excluded from every allowlist
All `.git` directories, project roots, `public/`, `data/`, `backups/**`, `node_modules`, `~/mint-backup/**`, the external SSD, and anything held open by a running process. `git gc`/`prune` is explicitly rejected as space recovery.

**Approval phrase required before anything is removed:** naming class A (and optionally B) as the target. Nothing above has been deleted.

---

## 9. Staged SyncGuard plan — current status

| Stage | Deliverable | Status |
|---|---|---|
| 0 | Read-only inventory | **complete** |
| 1 | Dirty-tree classification + secret scan | **complete** |
| 2 | Snapshot writer + isolated restore tests | **complete for 21 repos** |
| 3 | Owner decrypts one archive | **blocked — needs Deke's passphrase** |
| 4 | Read-only collector + dashboard section | **not built** |
| 5 | Daily scheduled snapshots, off-box | **not built** |
| 6 | Cleanup engine, dry-run manifests only | **manifest produced manually; engine not built** |
| 7 | Approved execution (class A only) | **blocked on approval** |
| 8 | Private mirror + fix-to-commit automation | **not built** |

Constraints in force: GitHub stays the source remote; no remote rewritten; no force push; no automatic reset/clean/commit of unrelated dirty work; the 45/39/12 dirty entries remain exactly as they are.

---

## 10. What is *not* true

- SyncGuard is **not** built, and no dashboard shows any of this — the numbers here come from shell commands, not a product surface.
- The `.gpg` archives are **not** proven restorable until Deke decrypts one.
- GitHub is **not** a complete backup: phantomide is 14 commits ahead of it, the editing copy has no remote, seven repos have no commits, and 16 owner repos have no remote at all.
- No cleanup has run. Parrot still shows 9.8 G free, Dell 150 G.

---

# Addendum — Phase 1–6 execution, 2026-11-18 05:15 UTC

**Objective:** verify audit/backup evidence, secrets, GPG recovery, permissions, build cleanup and monitoring, read-only, stopping at the approval boundary.
**Host:** Dell `ghost-Inspiron-7348` (inspected + one rule file written earlier) and `parrot` (inspected only).
**Production impact:** none. No chmod, chown, rm, restart, deploy or config write.

## A1. Instruction conflicts found (Phase 1.1)

| # | `/home/ghost/AGENTS.md` says | `/home/ghost/CLAUDE.md` says | Resolution |
|---|---|---|---|
| 1 | "restart" spoken by Deke is pre-authorized; `pm2 restart` immediately | Level 2 + §11: restarting critical infrastructure needs separate approval | Deke's explicit spoken restart = the explicit approval CLAUDE.md requires; either way it needs his word, never an agent's judgement |
| 2 | Always publish live after every requested site change | Level 1: deploying builds requires approval; §7 zero-downtime procedure | CLAUDE.md wins for production sites: run the safe procedure, then publish — no silent deploy |
| 3 | `pm2 restart` after code changes is fine | §7 requires verified switch + rollback + post-verify | Verification steps are additive; the restart itself still needs the request |
| 4 | "DO NOT DELETE FILES" (absolute) | Class A cleanup permitted *with approval* | The stricter rule governs: nothing is removed without approval naming exact paths |

## A2. State refresh (Phase 1.2–1.6) — what was stale

| Earlier claim | Now |
|---|---|
| "progress-honesty build remains in staging" | **stale** — `JQsjl1oODOL8uNdHv6IlD` is live and serving |
| "backup pending" | **stale** — 5/5 protected + 16/16 no-remote verified, 20 min old |
| dirty counts 45 / 39 / 12 | still exact |
| FIFO process | still resident on Parrot, pid 2112490, ~30 min |
| haksterAi / cinevault clean | still clean |

Health: junkalot.co 200 (0.23 s) · phantomide.com 200 (0.73 s) · haksterai.com 200 (0.83 s) · `junkalot.service` active, `:5006` and `:4000` listening · Dell pm2 12 apps `online`.
Storage: Dell 150 G free (66 %); Parrot 9.8 G free (96 %); SSD `/dev/sdb1` 4.4 G free (99 %), mount healthy.

## A3. Build cleanup — REVALIDATED, one directory reclassified (Phase 5)

`scripts/deploy-release.sh --rollback <id>` restores `next.config.js` from a record in
`/home/ghost694/junkalot-releases` and then needs that record's **distDir to still exist** to serve.

- Release records present: **1** — `20261117T042810Z-1896561`
- Its rollback target: `.next-junkalot-update-20261117T042032Z` (42 MB) — **inside** the class-A list

**Correction:** that directory is a live rollback dependency, not a rebuildable artifact.
Class A is therefore **111 dirs / 6,292 MB**, not 112 / 6,334 MB. The manifest file still lists 112
rows; row for `…042032Z` must be read as *protected (rollback)*, not removable.

Per-candidate evidence, all 111: owner `ghost694:ghost694`; no open file handle in any build dir
(`/proc/<pid>/fd` across all four service pids shows only `junkalot/data`); not the `distDir`;
not referenced by any release record; source recoverable from the verified bundle at `58fa9dfb`
plus the verified dirty patch and untracked archive.

## A4. Permissions (Phase 4) — proposed, not executed

| Path | Now | Proposed | Reason | Impact | Rollback |
|---|---|---|---|---|---|
| `junkalot/.env.local` | 664 `ghost694:ghost694` | 600 | secret readable by group/other *if* traversal ever opens | none — service runs as ghost694 | `chmod 664` |
| `junkalot/data/` | 775 | 700 | runtime data root | none for the service | `chmod 775` |
| `junkalot/data/*.db` (bookings, security, training, coach-memory) | 644 | 600 | client data | service runs as owner | `chmod 644` |
| `junkalot/backups/learning/coach-memory-*.db` (260 of 260) | 644 | 600 | client conversation history | none (archive) | `chmod 644` |

**Mitigating fact, stated so the risk is not overstated:** `/home/ghost694` is mode **700**, the group
has **no members**, and `ghost694` is the only human account on the box. No other local user can
traverse to these files today; only root. Current exposure **LOW**; the modes are non-conforming
least-privilege and would matter if a second account, service user, or looser home mode appeared.

## A5. Secrets (Phase 2) — inventory complete, backups still missing

- Six production env files exist (§5); all but one are 600.
- **No deliberate encrypted secret backup exists.** Two worktree archives incidentally contain
  `.env` files (`hakterm`, `miniforge`, encrypted, mode 600) — incidental is not a plan.
- Recovery dependency: these files are gitignored, absent from every Git remote, absent from the
  source archives, and `junkalot/.env.local` exists on Parrot only.

Plan (approval needed to execute): per-box archive → encrypt to Deke's key → store on the *other*
machine → restore-test by file list only → record plaintext and ciphertext SHA-256, never values.

## A6. GPG recovery (Phase 3) — prepared, blocked on Deke

```
# Deke, in his own terminal (pinentry may prompt; nothing is printed to the terminal):
gpg -o /tmp/mg-verify.tar -d /home/ghost/masterguard/backups/2026-11-18/phantomide.bundle.gpg
sha256sum /tmp/mg-verify.tar        # must equal the value in phantomide.sha256.txt
git bundle verify /tmp/mg-verify.tar
```
Evidence recorded: exit status, the two hashes, and `git bundle verify` output — never plaintext.
Temporary `/tmp/mg-verify.tar` removal only under an approved procedure.

## A7. Monitoring design (Phase 6) — not deployed

| Signal | Source | HEALTHY | DEGRADED | FAILED | UNKNOWN |
|---|---|---|---|---|---|
| Junkalot live | `https://junkalot.co/api/version` + `systemctl is-active` | 200 and build == `distDir` build | 200 but build ≠ distDir, or >2 s | non-200 or unit inactive | no sample in 3 intervals |
| PhantomIDE | `https://phantomide.com/` | 200 < 1 s | 200 but > 2 s | non-200/timeout | probe error |
| HaksterAI | `https://haksterai.com/` + pm2 `hakster` | 200 and `online` | 200 but restarts rising | non-200 or `errored` | probe error |
| PM2 fleet | `pm2 jlist` | all `online` | any `restart_time` rising | any `errored`/`stopped` | pm2 unreachable |
| Parrot disk | `df -P /` | > 15 % free | 5–15 % | < 5 % | ssh fail |
| SSD mount | `findmnt -S UUID=…` | mounted, rw | mounted read-only | absent | — |
| Backup freshness | newest verified `*.sha256.txt` | < 24 h | 24–72 h | > 72 h | no set |
| Build progress | existing `deploy-status` snapshot | measured bytes only | — | `failed` | never a simulated % |


