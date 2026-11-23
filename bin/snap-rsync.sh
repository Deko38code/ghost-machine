#!/usr/bin/env bash
# snap-rsync.sh — hardlink snapshots of owner state.
#
# Replaces the git-as-backup layer for $HOME. Unchanged files are hardlinks to
# the previous snapshot, so a new generation costs only what actually changed.
# There is no object database, no gc, no packfiles, and nothing to prune —
# which is what made /home/ghost/.git grow to 11 GB and stall the disk for
# 18 minutes on 2026-11-15.
#
#   ./snap-rsync.sh                # plan only, touches nothing
#   ./snap-rsync.sh --apply        # write a new snapshot generation
#   ./snap-rsync.sh --apply --prune --keep 12
#
# Deletion policy: snapshots this script created may be rotated out ONLY with
# --prune. Source files are never modified, moved, or deleted, ever.
#
# Restore a single path:
#   rsync -a /home/ghost/snapshots-rsync/<ts>/haksterAi/server/src/ ~/haksterAi/server/src/
#
# Run it under ionice/nice so it never starves interactive work:
#   ionice -c3 nice -n19 ./snap-rsync.sh --apply

set -uo pipefail   # deliberately NOT -e: one unreadable path must not abort the run

SRC=/home/ghost
DEST=${SNAP_DEST:-/home/ghost/snapshots-rsync}
KEEP=${SNAP_KEEP:-12}
TS=$(date +%Y%m%d-%H%M%S)
CUR="$DEST/$TS"
LATEST="$DEST/latest"

APPLY=0; PRUNE=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --prune) PRUNE=1 ;;
    --keep)  shift; KEEP=${1:-12} ;;
    --keep=*) KEEP=${a#--keep=} ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
  esac
done

# What actually matters. Paths are relative to $SRC and use rsync's /./ marker
# so the archive keeps the same layout as the live tree.
INCLUDE=(
  ./haksterAi/server/src
  ./haksterAi/server/.env
  ./haksterAi/server/data
  ./haksterAi/docs
  ./haksterAi/public
  ./haksterAi/AGENTS.md
  ./haksterAi/CLAUDE.md
  ./haksterAi/HAKSTERAI-PHANTOM-MERGED.md
  ./haksterAi/.hakster
  ./rent-my-trailer/server/server.js
  ./rent-my-trailer/server/db.js
  ./rent-my-trailer/server/.env
  ./rent-my-trailer/server/data
  ./rent-my-trailer/server/rentmytrailer.db
  ./rent-my-trailer/server/uploads
  ./rent-my-trailer/app/src
  ./rent-my-trailer/app/dist
  ./cine-vault-live/index.html
  ./cine-vault-live/server.js
  ./cine-vault-live/package.json
  ./phantomide
  ./mine
  ./bin
  ./AGENTS.md
)
DOTFILES=(
  ./.bashrc ./.profile ./.gitconfig ./.gitignore
  ./.agents
  ./.claude/settings.json ./.claude/agents ./.claude/skills
  ./.config/systemd/user
  ./.pm2/dump.pm2
  ./.cloudflared
)

# Never archive these, wherever they appear.
EXCLUDES=(
  --exclude=node_modules/
  --exclude=.git/
  --exclude=__pycache__/
  --exclude=.venv/
  --exclude=.cache/
  --exclude=.npm/
  --exclude='*.tar.gz'
  --exclude='*.tar.zst'
  --exclude=.DS_Store
  --exclude=*.sock
  --exclude=snapshots/
  --exclude=backups/
  --exclude=snapshots-rsync/
  --exclude=.local/share/Trash/
  --exclude=.config/chromium/
  --exclude=.config/google-chrome/
  --exclude=.config/mozilla/
  --exclude=.mozilla/
  --exclude=.local/share/gvfs-metadata/
  --exclude=.local/share/kactivitymanagerd/
)

# Only paths that exist today, so a missing app never aborts the run.
EXISTING=(); MISSING=()
for p in "${INCLUDE[@]}" "${DOTFILES[@]}"; do
  rel=${p#./}
  if [ -e "$SRC/$rel" ]; then EXISTING+=("$p"); else MISSING+=("$rel"); fi
done

echo "snap-rsync  $(date '+%F %T')"
echo "  source      $SRC"
echo "  destination $CUR"
MODE_LABEL='PLAN (nothing written)'
[ $APPLY -eq 1 ] && MODE_LABEL=APPLY
echo "  mode        $MODE_LABEL"
echo "  paths       ${#EXISTING[@]} present, ${#MISSING[@]} missing"
[ ${#MISSING[@]} -gt 0 ] && printf '  skipped     %s\n' "${MISSING[*]}"

LINK_ARG=()
[ -d "$LATEST" ] && LINK_ARG=(--link-dest="$LATEST")

RSYNC_OPTS=(-a --relative "${LINK_ARG[@]}" "${EXCLUDES[@]}" --stats)
[ $APPLY -eq 1 ] || RSYNC_OPTS+=(--dry-run)

cd "$SRC" || exit 1
[ $APPLY -eq 1 ] && mkdir -p "$CUR"

START=$(date +%s)
OUT=$(rsync "${RSYNC_OPTS[@]}" "${EXISTING[@]}" "$CUR/" 2>&1)
RC=$?
END=$(date +%s)

echo "$OUT" | grep -E 'Number of files:|Number of created files:|Number of regular files transferred:|Total file size:|Total transferred file size:|Literal data:' | sed 's/^/  /'
echo "  rsync rc=$RC  elapsed=$((END-START))s"

if [ $APPLY -eq 0 ]; then
  echo "  PLAN ONLY — re-run with --apply to write"
  exit 0
fi

if [ $RC -ne 0 ] && [ $RC -ne 24 ]; then   # 24 = files vanished mid-run, harmless
  echo "  ERROR: rsync failed rc=$RC — snapshot left in place for inspection"
  exit $RC
fi

# Point latest at the new generation atomically.
ln -sfn "$CUR" "$LATEST.next" && mv -Tf "$LATEST.next" "$LATEST"

SIZE=$(du -sh "$CUR" 2>/dev/null | cut -f1)
ACTUAL=$(du -sh --apparent-size "$CUR" 2>/dev/null | cut -f1)
FILES=$(find "$CUR" -type f 2>/dev/null | wc -l)
echo "  wrote $CUR — $SIZE on disk ($ACTUAL apparent), $FILES files"

# Retention: only generations this script made, only with --prune.
if [ $PRUNE -eq 1 ] && [ "$KEEP" -gt 0 ]; then
  mapfile -t OLD < <(ls -1d "$DEST"/20*-* 2>/dev/null | sort | head -n -"$KEEP")
  for d in "${OLD[@]:-}"; do
    [ -n "$d" ] && [ "$d" != "$CUR" ] && echo "  prune  $d" && rm -rf -- "$d"
  done
fi

printf '%s  ok  %s  %s  %s files  rc=%s\n' "$(date '+%F %T')" "$TS" "$SIZE" "$FILES" "$RC" >> "$DEST/snap-rsync.log"
