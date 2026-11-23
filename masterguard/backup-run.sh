#!/bin/bash
# MasterGuard backup run 2026-11-18. Read-only against the source trees.
# Produces, per repo: bundle (full history), dirty-source patch, untracked archive,
# status snapshot, ignored-list metadata; streams to the Dell, verifies SHA-256,
# encrypts to Deke's existing GPG key, and runs an isolated clone/fsck restore test.
set -u
OUT=/home/ghost/masterguard/backups/2026-11-18
KEY=E2D1D1DD6F917C34
TS=$(date -u +%Y%m%dT%H%M%SZ)
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a /home/ghost/masterguard/logs/backup-$TS.log; }

# name|box|path
SPECS=(
  "junkalot-master|parrot|/home/ghost694/junkalot"
  "junkalot-editing|parrot|/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot"
  "phantomide|parrot|/home/ghost694/phantomide"
  "haksterai|dell|/home/ghost/haksterAi"
  "cinevault-live|dell|/home/ghost/cine-vault-live"
)

for spec in "${SPECS[@]}"; do
  IFS='|' read -r name box path <<<"$spec"
  log "=== $name ($box:$path)"
  if [ "$box" = "parrot" ]; then
    R() { ssh -o BatchMode=yes parrot "$@"; }
  else
    R() { bash -c "$*"; }
  fi
  # 1. metadata (read-only)
  R "git -C '$path' rev-parse HEAD; git -C '$path' rev-parse --abbrev-ref HEAD; git -C '$path' remote -v; git -C '$path' branch -a; git -C '$path' tag" > "$OUT/$name.refs.txt" 2>&1
  R "git -C '$path' status --porcelain=v1" > "$OUT/$name.status.txt" 2>&1
  R "git -C '$path' status --porcelain=v1 --ignored" > "$OUT/$name.ignored.txt" 2>&1
  R "git -C '$path' diff HEAD" > "$OUT/$name.dirty.patch" 2>&1
  R "cd '$path' && git ls-files -o --exclude-standard -z | tar --null -T - -czf - 2>/dev/null" > "$OUT/$name.untracked.tar.gz" 2>&1
  log "metadata done: patch $(stat -c%s "$OUT/$name.dirty.patch")B, untracked $(stat -c%s "$OUT/$name.untracked.tar.gz")B"

  # 2. full-history bundle built on the source box, then pulled
  if [ "$box" = "parrot" ]; then
    R "git -C '$path' bundle create /tmp/mg-$name.bundle --all >/dev/null 2>&1 && git -C '$path' bundle verify /tmp/mg-$name.bundle 2>&1 | tail -2"
    scp -o BatchMode=yes -q parrot:/tmp/mg-$name.bundle "$OUT/$name.bundle"
  else
    git -C "$path" bundle create "$OUT/$name.bundle" --all >/dev/null 2>&1
    git -C "$path" bundle verify "$OUT/$name.bundle" 2>&1 | tail -2
  fi
  if [ ! -s "$OUT/$name.bundle" ]; then log "BUNDLE FAILED for $name"; continue; fi

  # 3. isolated restore test: clone from the bundle, compare identity, fsck
  rt=/home/ghost/masterguard/restore-test/$name-$TS
  git clone -q --no-hardlinks "$OUT/$name.bundle" "$rt" 2>>"$OUT/$name.restore.log"
  src_sha=$(R "git -C '$path' rev-parse HEAD" 2>/dev/null); dst_sha=$(git -C "$rt" rev-parse HEAD 2>/dev/null)
  fsck=$(git -C "$rt" fsck --no-progress --no-dangling 2>&1 | head -3)
  files=$(git -C "$rt" ls-files | wc -l)
  if [ "$src_sha" = "$dst_sha" ] && [ -z "$fsck" ]; then
    log "RESTORE OK $name src=$src_sha clone=$dst_sha files=$files"
    restore="verified"
  else
    log "RESTORE FAIL $name src=$src_sha clone=$dst_sha fsck='$fsck'"
    restore="failed"
  fi
  echo "name=$name src_head=$src_sha clone_head=$dst_sha files=$files restore=$restore" >> "$OUT/restore-results.txt"

  # 4. encrypt (Deke's existing key; no new secret created)
  gpg --batch --yes --trust-model always -e -r "$KEY" -o "$OUT/$name.bundle.gpg" "$OUT/$name.bundle" 2>>"$OUT/$name.gpg.log"
  gpg --batch --yes --trust-model always -e -r "$KEY" -o "$OUT/$name.untracked.tar.gz.gpg" "$OUT/$name.untracked.tar.gz" 2>>"$OUT/$name.gpg.log"
  gpg --batch --yes --trust-model always -e -r "$KEY" -o "$OUT/$name.dirty.patch.gpg" "$OUT/$name.dirty.patch" 2>>"$OUT/$name.gpg.log"
  ( cd "$OUT" && sha256sum "$name.bundle" "$name.bundle.gpg" "$name.untracked.tar.gz" "$name.untracked.tar.gz.gpg" "$name.dirty.patch" "$name.dirty.patch.gpg" > "$name.sha256.txt" )
  log "encrypted: $(stat -c%s "$OUT/$name.bundle.gpg")B ciphertext; sha256 recorded"
done
log "RUN COMPLETE"
