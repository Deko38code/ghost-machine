# Disk cleanup — Parrot — 2026-11-22

Host: `10.0.0.251`, user `ghost694`. All figures measured on this host, this session.
Nothing in `backups/`, `Parrot-vault`, `current-masters-*`, or any learning tarball was touched.

## Result

| Filesystem | Start of session | Now |
|---|---|---|
| `/dev/sda2` `/` (226 G) | 179 G used, **45 G free, 80 %** | 168 G used, **56 G free, 76 %** |
| `/dev/sdb1` SSD (233 G) | 230 G used, **3.1 G free, 99 %** | 212 G used, **22 G free, 91 %** |

**Freed: 11 GB on `/`, 19 GB on the SSD.**

## What was removed (all owner-approved)

1. **217 staged Junkalot builds — 11 GB.** `.next-junkalot-*` directories older than the newest 8.
   Before removing: the live `distDir` excluded, 0 open file handles, 0 PM2 references, no symlinks
   in the set. Every removal recorded in `junkalot/data/build-retention.jsonl` (218 records).
2. **Build retention in the pipeline.** `scripts/build-retention.mjs`, called from
   `scripts/stage-update.mjs` only after a new build is verified *and answering*. Keeps the newest 8,
   never touches the served build, never follows a symlink, logs each removal. Shipped through the
   widget as build `ZSIBaZutlek2y6xvMMY0z`.
3. **Arduino data on the SSD — ~7.2 GB.** `arduino-data-relocated-20261031T182432Z` (3.4 G),
   `arduino-data-staging-20261031T180142Z` (3.8 G), `arduino-uninstall-targets-…txt`, and the
   sketchbook `/home/ghost694/Arduino` (1 MB). Debian packages `arduino-builder`, `arduino-core-avr`,
   `arduino-ctags` remain installed — only 3 MB of data, and `sudo` needs your password.
4. **SecLists clone on the SSD — 4.6 GB.** `github.com/danielmiessler/SecLists` at
   `785809e87b9ac41fbfd33da20ab442473675219b`. Restore: `git clone https://github.com/danielmiessler/SecLists.git`.
5. **Four `.tmp` repo copies — 6.4 GB.** `metasploit-framework` (1.4 G, zero local edits — only file-mode
   noise), `llama.cpp` (438 M), `text-generation-webui` (2.34 G), `claw-code` (2.2 G).

   Before those four went, every locally-changed and untracked file was copied byte-for-byte to
   `/home/ghost694/ssd-tmp-preserved-20261122` — **533 MB, 2,177 files** — alongside each repo's
   remote, HEAD commit and a `git diff` patch. Counts: claw-code 9 changed + 8 untracked,
   claw-code's nested `rust/claw-code` 7 changed + 1 untracked, llama.cpp 51 changed,
   text-generation-webui 104 changed. One file could not be copied because it no longer exists in the
   source (`llama.cpp/benches/dgx-spark/run-aime-120b-t8-x8-high.log`) — nothing lost.
   Everything re-clones from upstream at the recorded commit and the local files drop back in.

## What was deliberately left alone

| Item | Size | Why |
|---|---|---|
| `junkalot-backup/` | **58 GB** | Full project copy from 2026-11-04; its `backups/` alone is 52.6 GB. Class C. |
| `junkalot-backups-20261108T065735Z/` | **50 GB** | 220 `learning-old` tarballs, 2026-10-28 → 2026-11-04. **Has a PENDING-DECISION.txt waiting on you** — see below. |
| `current-masters-20261117T060500Z/` | 5.0 GB | Your verified master set (haksterAi, junkalot, phantomide, workspace) with `.sha256.txt`. |
| `Parrot-vault/` | 2.7 GB | Pre-edit `.db` copies and source snapshots. |
| `Downloads.tmp/` | 965 MB | **Your apartment/garage cleanout job photos** and project zips. |
| `from-parrot-root-20261103/` | 2.5 GB | Root copy, not reviewed. |
| `mint-disk-recovery-20261108T155911Z/` | 3.8 GB | Recovery set, not reviewed. |
| `junkalot-builds/` | 4.2 GB | 12 live symlinks in the repo point at it — deleting leaves dangling links. |
| `kirocli.tmp/` | 576 MB | CLI install, not reviewed. |

## The thing you were already asked about — still open

`/mnt/parrot-work-ssd/junkalot-backups-20261108T065735Z/PENDING-DECISION.txt`,
generated 2026-11-16, is still unanswered. It reports 220 `learning-old` tarballs (48.83 GiB) on the
SSD and 176 local learning tarballs (44.79 GiB) that never fit, and offers four one-word choices:

- `PRUNE-HALF` → delete the oldest 110 SSD files (27.65 GiB), then move local learning across
- `PRUNE-ALL` → delete all 220 SSD files (48.83 GiB), then move local learning across
- `DELETE-LOCAL` → delete the local `learning/*` instead, SSD untouched
- `ABORT` → no changes

That decision was blocked because the SSD had only 19.43 GiB free. **It now has 22 G free, so
`PRUNE-HALF` is feasible.** Nothing has been deleted, moved or written in either location.

## Two observations worth your attention

1. **Production secrets sit in plain copies on the SSD.** `junkalot-backup/` contains
   `.env.local` and `.env.production.local`. The parent directory is mode `700`, so they are not
   world-readable, but they are unencrypted copies of production secrets on removable media
   (§9). No content was printed or read. If that copy is not a deliberate protected backup, it
   should be encrypted or removed — that is your call, and I have not touched it.
2. **The SSD is 108 GB of Junkalot learning tarballs** across those two directories. Free space on it
   will fall again as `learning-guard.sh` keeps writing. The `PRUNE-*` decision above is the lever.

## Verification

- `http://127.0.0.1:5006/` → **200**; `https://junkalot.co/` → **200**
- `/api/version` → `ZSIBaZutlek2y6xvMMY0z`, built `2026-11-22T12:29:22Z`
- `junkalot/data/build-retention.jsonl` → 218 records, 0 invalid
- `junkalot/data/invoice-worklog.jsonl` → 96 rows, 0 invalid
- No `du` scan left running; no background job left behind

Status: **VERIFIED** for everything removed. Everything left in place is **BLOCKED** on your decision.

---

## Owner's decision, 2026-11-22: ABORT

"the abort the rest" — the owner chose `ABORT` on the learning-backup decision and stopped the
cleanup. **Nothing further on the SSD or `/` is to be removed.** `junkalot-backup/`,
`junkalot-backups-20261108T065735Z/`, `Parrot-vault/`, `current-masters-*`, `Downloads.tmp`,
`from-parrot-root-*`, `mint-disk-recovery-*`, `junkalot-builds/` and `kirocli.tmp` all stay as they
are. The `PENDING-DECISION.txt` file itself was not edited.

Free space is now the working floor: **56 G on `/`, 22 G on the SSD.** Both are below the levels that
caused the outages of 2026-11-08 and 2026-11-18, and the build pipeline now retires its own old
generations, so `/` should not creep back at the old rate.
