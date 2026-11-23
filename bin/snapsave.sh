#!/usr/bin/env bash
# snapsave <app> [more apps] — snapshot working state of each app into
# /home/ghost/snapshots/<app>/ keeping the LAST 10. Fast, small, restorable.
# Usage:   snapsave rmt          (named bundle = server + src + dist + db + .env)
#          snapsave all
# Restore: snaprestore rmt 5    (unpack snap #5 into /home/ghost — dry-run first!)
set -euo pipefail
SNAPDIR=/home/ghost/snapshots
KEEP=10
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SNAPDIR"
log() { echo "[$(date '+%F %T')] $*" >> "$SNAPDIR/snapshots.log"; }

SNAP_RMT() {
  local base=/home/ghost
  tar czf "$SNAPDIR/rmt/rmt-$TS.tar.gz" \
    -C "$base" \
    rent-my-trailer/server/server.js rent-my-trailer/server/db.js \
    rent-my-trailer/server/.env rent-my-trailer/server/data \
    rent-my-trailer/app/src rent-my-trailer/app/dist 2>/dev/null
}
SNAP_HAKSTER() {
  tar czf "$SNAPDIR/haksterai/haksterai-$TS.tar.gz" \
    -C /home/ghost/haksterAi/server \
    src .env 2>/dev/null
}
SNAP_CINEVAULT() {
  tar czf "$SNAPDIR/cinevault/cinevault-$TS.tar.gz" \
    -C /home/ghost/cine-vault-live index.html server.js 2>/dev/null
}
SNAP_PROXY() {
  tar czf "$SNAPDIR/claude-proxy/claude-proxy-$TS.tar.gz" \
    -C /home/ghost/claude-code-proxy minimal_proxy.py 2>/dev/null
}

for app in "${@:-all}"; do
  case "$app" in
    rmt)       mkdir -p "$SNAPDIR/rmt";        SNAP_RMT;;
    haksterai) mkdir -p "$SNAPDIR/haksterai";  SNAP_HAKSTER;;
    cinevault) mkdir -p "$SNAPDIR/cinevault";  SNAP_CINEVAULT;;
    proxy)     mkdir -p "$SNAPDIR/claude-proxy"; SNAP_PROXY;;
    all)       mkdir -p "$SNAPDIR/rmt" "$SNAPDIR/haksterai" "$SNAPDIR/cinevault" "$SNAPDIR/claude-proxy"
               SNAP_RMT; SNAP_HAKSTER; SNAP_CINEVAULT; SNAP_PROXY;;
    *) echo "unknown app: $app"; exit 2;;
  esac
  # keep newest 10 per app
  ls -1t "$SNAPDIR/$app"/*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
  latest=$(ls -1t "$SNAPDIR/$app"/*.tar.gz 2>/dev/null | head -1)
  echo "$app → $(basename "$latest") ($(du -h "$latest" | cut -f1), $(ls -1 "$SNAPDIR/$app" | wc -l) kept)"
  log "saved $app $(basename "$latest")"
done