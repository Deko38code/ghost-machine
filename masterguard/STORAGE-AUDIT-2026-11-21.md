# MASTERGUARD — PARROT STORAGE & MASTER-ROTATION AUDIT

**Date:** 2026-11-21 (UTC) · **Host:** parrot (10.0.0.251, Parrot 7.0.13, kernel 7.0.13+parrot7-amd64)
**Mode:** READ-ONLY audit and planning. Nothing was created, moved, deleted, restarted, remounted or reconfigured. No Dell/Mint changes.
**Outcome:** PARTIALLY VERIFIED — all capacity and inventory figures below were measured; filesystem integrity, decrypt-verification and recovery tests could not be completed without the owner.

---

## 1. Internal disk — capacity and free space

| Item | Value |
|---|---|
| Device / fs | `/dev/sda2`, btrfs, subvols `/@` (/) and `/@home` (/home) |
| UUID | `87d61cfc-8a5d-4ed0-b7f0-3afa5dd72f0a` |
| Size | 226 G (225.24 GiB) |
| Used | 176 G (174.87 GiB) — **79 %** |
| Free | **48 G** (`df` 47.88 GiB; btrfs estimated min 45.88 GiB) |
| Swap | 8.2 G partition + `/swapvol/swapfile2`, 16 G total, **9.3 G used** |
| RAM | 3.7 GiB total, 3.1 GiB used, **627 MiB available** |
| Load | 1.65 / 2.15 / 2.29 (up 6 d 18 h) |

Previous baseline in CLAUDE.md §12 said ~9.8 G free. It is now 48 G free — a ~38 G change since 2026-11-18 that this audit did not cause and cannot attribute from current state. Flagged for the owner; re-baseline.

**Most urgent non-disk finding:** `/tmp` is a **1.9 G tmpfs and is 100 % full (16 M free)**. It is RAM-backed, so it both consumes memory and makes any `/tmp` write fail with ENOSPC. Combined with 9.3 G of swap in use, this is a stability risk, not a storage-space issue. Nothing was cleared.

## 2. External SSD — capacity and free space

| Item | Value |
|---|---|
| Device / fs | `/dev/sdb1`, NTFS, mounted via `fuseblk` (ntfs-3g) |
| UUID | `5B99E2CD75766F50` |
| Mount | `/mnt/parrot-work-ssd` (systemd unit `mnt-parrot\x2dwork\x2dssd.mount`, active) |
| Size | 233 G |
| Used | 230 G — **99 %** |
| Free | **3.2 G** |
| Inodes | 1.4 M of 4.6 M (31 %) |
| fstab | `UUID=5B99E2CD75766F50 … uid=1000,gid=1003,umask=0077,nofail,x-systemd.device-timeout=10s` |
| `/proc` pressure | `io some avg10=1.63`, `full avg10=1.44`; `du` over the SSD took minutes — it is slow under load |

## 3. SSD mount and filesystem verification

**Verified:** the mounted device is `/dev/sdb1`; its UUID matches the fstab entry; the systemd mount unit is active; the mount is `rw`; capacity and inode figures are live; the mountpoint shows the NTFS volume's own directory entries (so it is a real mount, not an empty directory on the internal disk).

**Not verified (needs approval):**
- **Writable test** — not performed (a write would be a change).
- **Filesystem health** — `fsck` needs the volume unmounted (Level 2, mount change); `smartctl` is not installed, so S.M.A.R.T. health is unknown.
- **Data integrity** — an 8.5 MB SHA-256 manifest exists for the 2026-11-17 master set (52,561 entries) but was not re-hashed (NTFS is slow; a full check is a multi-hour job).
- **Underlying-directory emptiness** — cannot be proven without an unmount.

**Hazard (report only):** the mount has **`nofail`**. If the SSD fails to mount at boot, the 10 home symlinks below dangling-link into `/mnt/parrot-work-ssd`, and any writer through them creates directories on the **internal** btrfs instead — silently consuming internal disk. Relocating those 10 paths:

```
phantom_snapshots, SecLists, text-generation-webui, claw-code, .vscode-oss,
metasploit-framework, .rustup, Downloads, kirocli, llama.cpp, .omp
```
None of them is a production path: Junkalot (`/home/ghost694/junkalot`) and PhantomIDE (`/home/ghost694/phantomide`) are real directories on the internal disk, and the services serving 5006 and 4000 run from them. Verified.

## 4. Largest safe cleanup candidates (measured, none approved)

Internal disk `/home/ghost694` (61 G) and `/var` (2.6 G):

| Path | Size | Class | Note |
|---|---|---|---|
| `junkalot/.next-*` — 196 build dirs | **9.4 G** total | A (mostly) | live dir is `.next-junkalot-update-20261121T003954Z` (66 M); 83 dirs touched since 11-18, 41 older than 11-08. Deployment sets `distDir` in `next.config.js` |
| `junkalot/backups/learning` | **6.2 G** | B | 25,149 snapshot files since 10-28, ~341/day; written every few minutes |
| `.config/google-chrome` + `-headless` | **4.0 G** | B | browser profiles; user data |
| `.phantom-backups` | 3.6 G | B | 883 PhantomIDE snapshot files, newest 11-20 |
| `.local/share/claude/versions` | 1.4 G | A/B | 4 versions (2.1.325–328), ~350 M each |
| `junkalot-master-verify-*` (3 dirs) | 1.5 G | B | 11-16 verification copies |
| `.junkalot-build-pay-button-hardlinks-20261031` | 970 M | B | 10-31 hardlink set |
| `.cache` | 904 M | A | reproducible |
| `junkalot/backups/deploy` | 919 M | B | 3 × ~300 M pre-change tarballs (10-28) |
| `.npm` | 112 M | A | cache |
| `.pm2` | 227 M | B | logs |
| `/var/cache/apt` + `/var/lib/apt/lists` | 257 M | A | package cache/lists |
| `/var/log/journal` | 195 M | B | journal |
| `/tmp` | 1.9 G | A | tmpfs (RAM), agent scratch — full |

Also large but not deletion candidates: `workspace` 4.7 G (per-account agent working copies incl. two Junkalot copies), `.hermes` 2.9 G, `.hermes_bypass` 2.2 G, `.codex` 1.3 G, `.nvm` 1.2 G, `phantom-dashboard` 549 M, Parrot copies of `miniforge` 688 M / `haksterAi` 535 M / `hackbot` 498 M (haksterAi Parrot copy has no `.git`; it is a copy, not the service — the service runs on the Dell).

**Measured total of the internal candidates above: ≈ 30 G.** Only a subset is Class A. Nothing is verified-safe until each item's rollback references are checked (§6 of the rulebook).

## 5. Current master backup inventory

**Two independent copies exist, both older than the latest Junkalot work:**

1. **Dell internal disk — `/home/ghost/masterguard/backups/2026-11-18/` (3.3 G).** Per project (junkalot-master, junkalot-editing, phantomide, haksterai, cinevault-live): git bundle, bundle.gpg, dirty.patch, dirty.patch.gpg, untracked.tar.gz, untracked.tar.gz.gpg, ignored.txt, refs.txt, sha256.txt, status.txt, gpg.log, restore.log. Plus `/home/ghost/masterguard/restore-test/` (1.4 G) with five extracted restore trees dated 11-17 — a real extraction happened.
   **Gap:** every `gpg.log` and `restore.log` in the set is **0 bytes** — the restore was performed but no pass/fail or checksum comparison was recorded.

2. **Parrot SSD — `current-masters-20261117T060500Z`** (4 projects, 52,561 files, plus an 8.5 MB SHA-256 manifest). Dated 11-17, on the same SSD failure domain.

**Staleness:** Junkalot's newest build is `.next-junkalot-update-20261121T003954Z` (11-21 00:42 UTC) and the working tree has **140 dirty entries** (HEAD `58fa9df`, 11-16). PhantomIDE HEAD `5e2ce27`, 18 dirty. **No independent copy exists for the 11-19 → 11-21 Junkalot work.**

Other historical families on the SSD (all prior to 11-17): `junkalot-backup` **57 G**, `junkalot-backups-20261108T065735Z` **49 G**, `parrot-archive-…junkalot-learning` **9.9 G** (40 ~275 M source-master tarballs, 11-07 → 11-16), `mint-disk-recovery-20261108T155911Z` 3.7 G, `phantom-snapshots-relocated` 2.7 G, `Parrot-vault` 2.6 G, `Junkalot-master-src-of-truth-20261104` 785 M, `Parrot-preserved` 708 M, `phantomide-backups` 58 M.

## 6. Missing or unverified backups

- **No current (11-19 → 11-21) independent master for Junkalot** — the largest gap.
- **GPG recovery test: BLOCKED.** `~/.gnupg` holds 2 files (trustdb only, no private key), so the bundles are passphrase-encrypted. Decryption must be tested with the owner's passphrase entered through `/home/ghost/bin/secret-add` (never in chat, §23).
- **Production secret files** are not present as an encrypted artifact in the 11-18 set; `ignored.txt` lists names only. §4 of the rulebook is not satisfied for secrets.
- **SSD filesystem integrity and S.M.A.R.T.** — unverified (see §3).
- **SSD manifest** — exists but never re-verified since 11-17.
- **Rotation** — only a single dated set (11-18) on the Dell; no daily/weekly/monthly history, so "previous verified master" does not exist as a distinct, independent copy.

## 7. Proposed SSD migrations

The SSD has **3.2 G free — it cannot receive data until it is cleaned and verified.** Therefore no migration is proposed in this phase. Once the two historical Junkalot backup trees are resolved (with approval), the candidates in priority order would be:
1. `junkalot/backups/learning` (6.2 G, write-heavy — needs an application-aware plan, not a live move).
2. `junkalot/.next-*` historical builds (9.4 G, cold).
3. `.phantom-backups` (3.6 G, cold).
Each requires: owner/process check, space check, copy preserving mode/owner/mtime, independent verification, a test read of the destination, a rollback note, and approval before the active path changes. No symlink replacement will be done automatically.

## 8. Proposed rotation schedule (subject to approval)

Layout: `<root>/<project>/<YYYY-MM-DDTHHMMSSZ>/` containing bundle + dirty.patch + untracked.tar.gz + encrypted copies + `MANIFEST.json` + `SHA256SUMS` + `VERIFIED.json`; `current` and `previous` pointers per project.

Retention: **7 daily, 4 weekly, 3 monthly**, chosen by *verified recovery point*, never by file age.
Two failure domains minimum: Parrot internal (live master) and Dell internal (independent). SSD is a third copy, never the only copy.

Deletion of a recovery point is permitted only when all five hold: (1) a newer complete set exists, (2) its integrity was verified, (3) a restore test succeeded, (4) an independent copy exists outside the same failure domain, (5) the owner explicitly approved that specific deletion.

## 9. Estimated reclaimable space (measured, unverified, unapproved)

- Internal disk: **≈ 30 G** of candidates listed in §4 — realistically **≈ 8–12 G** after excluding browser profiles, agent workspaces and anything with a rollback dependency.
- SSD: **106 G** in the two historical Junkalot backup trees + **≈ 6 G** by applying the rotation to the 40 tarballs — up to **≈ 112 G**, taking the SSD from 3.2 G to ~115 G free. Every gigabyte requires the five-condition gate in §8 first.
- `/tmp` 1.9 G is RAM, not disk — reclaiming it helps memory, not btrfs.

## 10. Exact commands proposed for approval (NOT RUN)

```bash
# A. Re-hash the 11-17 SSD master manifest (read-only, slow, ~hours)
cd /mnt/parrot-work-ssd/current-masters-20261117T060500Z
sha256sum -c ../current-masters-20261117T060500Z.sha256.txt | tee /tmp/master-verify-$(date -u +%FT%TZ).log

# B. Filesystem health of the SSD (requires unmount — Level 2)
sudo umount /mnt/parrot-work-ssd && sudo ntfsfix -n /dev/sdb1 && sudo mount /mnt/parrot-work-ssd

# C. Verified re-hash of one historical backup tree before any retention action
sha256sum -c /mnt/parrot-work-ssd/junkalot-backup/sha256.txt | tail -5

# D. Package/journal housekeeping (each with owner approval, one at a time)
sudo apt-get clean
sudo journalctl --vacuum-size=100M

# E. Learning-snapshot retention (write a manifest first, archive to Dell, then prune)
find /home/ghost694/junkalot/backups/learning -type f -mtime +30 | wc -l   # count only, first
```

No `rm`, `find -delete`, `rsync --delete`, `git clean` or mount change will be run without a fresh approval naming the exact target list.

## 11. Risks, rollback, production impact

| Risk | Mitigation |
|---|---|
| SSD at 99 % — any large write fails; ntfs-3g fragmentation grows | no writes until cleaned; monitoring alert at 95 % |
| `nofail` mount + 10 home symlinks | document recovery; propose removing `nofail` (mount change, Level 2) |
| `/tmp` tmpfs 100 % + 9.3 G swap | identify the writer before clearing; do not delete scratch an agent may still be using |
| Restoring an old bundle would lose 11-19→11-21 work | never restore over the live tree; the 11-18 set is stale evidence only |
| Two cloudflared instances (pid 1620 systemd + 1778 userland) | untouched; §17 tunnel freeze |
| Deleting historical backups destroys the only copy | five-condition gate; Dell copy first, then verify, then approval |
| Monitoring adding load to a 1.65-load box | 5-minute cached read-only probe, no full scans; reuse the `network-guard` pattern |

**Production impact of this audit: none.** Read-only commands only; Junkalot on 5006 and PhantomIDE on 4000 kept serving; no PM2, systemd, tunnel or mount action was taken.

## Observations (report only, no action)

- Failed units: `cpupower-gui`, `hostapd-wpe`, `isc-dhcp-server`, `ollama-warm` (points at 10.0.0.210), `sslh`.
- PM2 on Parrot: `phantom`, `phantom-status`, `free-lanes` online; `miniforge`, `email-monitor`, `kiro-wrapper` stopped. The live Miniforge service is on the Dell (port 5555).
- Junkalot service: `systemd` `junkalot`, `WorkingDirectory=/home/ghost694/junkalot`, `next start -p 5006`, pid 3108868 started 11-20 19:42 local, live build `…20261121T003954Z`.
- Junkalot `build-notes.json` holds 65 entries; the rulebook's §6 build `JQsjl1oODOL8uNdHv6IlD` / `…20261117T195448Z` is **stale** — a new baseline should be recorded after approval.
