#!/usr/bin/env bash
# snaprestore — list or restore snapshots captured by snapsave.
#   snaprestore <app>                → list available snapshots (newest first)
#   snaprestore <app> <n>            → print what snap #n contains (dry run)
#   snaprestore <app> <n> --go       → actually restore into /home/ghost
# After any --go restore of rmt/haksterai:  pm2 restart rmt haksterai
set -euo pipefail
SNAPDIR=/home/ghost/snapshots
APP="${1:?usage: snaprestore <app> [n [--go]]}"
DIR="$SNAPDIR/$APP"
[ -d "$DIR" ] || { echo "no snapshots for $APP"; exit 2; }
mapfile -t LIST < <(ls -1t "$DIR"/*.tar.gz 2>/dev/null)
[ ${#LIST[@]} -gt 0 ] || { echo "empty"; exit 2; }
for i in "${!LIST[@]}"; do echo "$((i + 1))  $(basename "${LIST[$i]}")"; done
[ $# -ge 2 ] || exit 0
N=$2
[ "$N" -ge 1 ] && [ "$N" -le "${#LIST[@]}" ] || { echo "bad index"; exit 2; }
SEL="${LIST[$((N - 1))]}"
echo "--- contents of $(basename "$SEL") ---"
tar tzf "$SEL" | head -20
if [ "${3:-}" = "--go" ]; then
  tar xzf "$SEL" -C /home/ghost
  echo "RESTORED from $(basename "$SEL") into /home/ghost"
  echo "→ now: pm2 restart rmt haksterai   (and sudo systemctl restart cinevault if needed)"
else
  echo "(dry run — add --go to restore)"
fi