#!/bin/bash
set -u
OUT=/home/ghost/masterguard/backups/2026-11-18/noremote
mkdir -p "$OUT"
KEY=E2D1D1DD6F917C34
TS=$(date -u +%Y%m%dT%H%M%SZ)
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a /home/ghost/masterguard/logs/noremote-$TS.log; }

# name|box|path   (owner repos with NO remote; includes unborn/zero-commit trees)
SPECS=(
 "miniforge|dell|/home/ghost/miniforge"
 "topreels|dell|/home/ghost/topreels"
 "phantom|dell|/home/ghost/phantom"
 "claude_agents|dell|/home/ghost/claude_agents"
 "parrot-ide-src|dell|/home/ghost/work/parrot-ide"
 "hakterm|dell|/home/ghost/workspace/hakterm"
 "ads-agent|dell|/home/ghost/workspace/ads-agent"
 "live-preview-ext|dell|/home/ghost/workspace/live-preview-extension"
 "cinevault-workspace|dell|/home/ghost/workspace/ads-agent/cinevault"
 "ws-sites-rmt|parrot|/home/ghost694/workspace/sites/rmt"
 "ws-sites-flixchill|parrot|/home/ghost694/workspace/sites/flixchill-link"
 "ws-sites-haksterai|parrot|/home/ghost694/workspace/sites/haksterai-com"
 "ws-whop-intel|parrot|/home/ghost694/workspace/dekekenneth840@gmail.com/whop-intel"
 "ws-phantom-ide|parrot|/home/ghost694/phantom-ide"
 "ws-cinevault|parrot|/home/ghost694/workspace/ads-agent/cinevault"
 "phantomide-snapshot|parrot|/home/ghost694/phantomide-clean-2026-10-22"
)

for spec in "${SPECS[@]}"; do
  IFS='|' read -r name box path <<<"$spec"
  if [ "$box" = "parrot" ]; then R() { ssh -o BatchMode=yes parrot "$@"; }; else R() { bash -c "$*"; }; fi
  has_head=$(R "git -C '$path' rev-parse --verify HEAD >/dev/null 2>&1 && echo yes || echo no")
  if [ "$has_head" = "yes" ]; then
    if [ "$box" = "parrot" ]; then
      R "git -C '$path' bundle create /tmp/mg-nr-$name.bundle --all >/dev/null 2>&1"; scp -o BatchMode=yes -q parrot:/tmp/mg-nr-$name.bundle "$OUT/$name.bundle"
    else
      git -C "$path" bundle create "$OUT/$name.bundle" --all >/dev/null 2>&1
    fi
    R "git -C '$path' diff HEAD" > "$OUT/$name.dirty.patch" 2>/dev/null
    kind=bundle
  else
    : > "$OUT/$name.bundle"   # unborn: no history to bundle
    kind=worktree-only
  fi
  # working tree (unborn repos have no other protection at all); excludes deps/build/git
  R "cd '$path' && tar --exclude='./node_modules' --exclude='./.next*' --exclude='./.git' --exclude='./backups' -czf - . 2>/dev/null" > "$OUT/$name.worktree.tar.gz"
  gpg --batch --yes --trust-model always -e -r "$KEY" -o "$OUT/$name.worktree.tar.gz.gpg" "$OUT/$name.worktree.tar.gz" 2>/dev/null
  [ -s "$OUT/$name.bundle" ] && gpg --batch --yes --trust-model always -e -r "$KEY" -o "$OUT/$name.bundle.gpg" "$OUT/$name.bundle" 2>/dev/null
  ( cd "$OUT" && sha256sum "$name".* > "$name.sha256.txt" 2>/dev/null )
  log "$name kind=$kind head=$(R "git -C '$path' rev-parse --short HEAD 2>/dev/null") wt=$(stat -c%s "$OUT/$name.worktree.tar.gz")B encrypted=$( [ -s "$OUT/$name.worktree.tar.gz.gpg" ] && echo yes || echo NO )"
done
log "NOREMOTE RUN COMPLETE"
