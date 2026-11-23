#!/usr/bin/env bash
# Restore Susie's Coach record from a verified snapshot.
#
#   ./scripts/restore-coach-memory.sh                  # list snapshots, verify each hash (read-only)
#   ./scripts/restore-coach-memory.sh --check <file>   # verify one snapshot and print its contents
#   ./scripts/restore-coach-memory.sh --apply <file>   # restore it (asks for confirmation)
#
# Snapshots live in data/backups/coach-memory/ and are written by src/lib/coach-backup.ts.
# --apply never overwrites blindly: it first saves the CURRENT database as a new snapshot
# (reason "pre-restore"), then copies the chosen file into place. Nothing is deleted.
# The service must be stopped before --apply, so the restore is not racing live writes.

set -euo pipefail
cd "$(dirname "$0")/.."

DIR="data/backups/coach-memory"
LIVE="data/coach-memory.db"

sha_of() { sha256sum "$1" | awk '{print $1}'; }

list() {
  echo "Verified snapshots in $DIR:"
  for f in "$DIR"/*.db; do
    [ -e "$f" ] || { echo "  (none yet)"; return; }
    want="$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sha256||"")}catch{}' "$f.json" 2>/dev/null || true)"
    got="$(sha_of "$f")"
    if [ -n "$want" ] && [ "$want" = "$got" ]; then state=OK; else state=UNVERIFIED; fi
    printf '  %-8s %-14s %10s  %s\n' "$state" "$(date -r "$f" -u +%Y-%m-%dT%H:%MZ)" "$(stat -c %s "$f")" "$f"
  done
}

verify_one() {
  local f="$1"
  [ -f "$f" ] || { echo "No such snapshot: $f" >&2; exit 1; }
  local want got
  want="$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sha256||"")}catch{}' "$f.json" 2>/dev/null || true)"
  got="$(sha_of "$f")"
  [ -n "$want" ] || echo "No sidecar hash for $f — checking the database itself instead."
  [ -z "$want" ] || [ "$want" = "$got" ] || { echo "Hash mismatch for $f — this copy is not trusted." >&2; exit 1; }
  node -e '
    const D = require("/home/ghost694/junkalot/node_modules/better-sqlite3");
    const db = new D(process.argv[1], { readonly: true, fileMustExist: true });
    const ok = db.pragma("integrity_check", { simple: true });
    const banks = db.prepare("SELECT COUNT(*) n FROM coach_memory_banks").get().n;
    const msgs = db.prepare("SELECT COUNT(*) n FROM coach_memory_messages").get().n;
    console.log("integrity:", ok, "| banks:", banks, "| messages:", msgs);
    db.close();
    process.exit(ok === "ok" ? 0 : 1);
  ' "$f"
  echo "Verified $f (sha256 $got)"
}

case "${1:-}" in
  "" ) list ;;
  --check ) verify_one "${2:?usage: --check <snapshot>}" ;;
  --apply )
    snap="${2:?usage: --apply <snapshot>}"
    verify_one "$snap"
    if pgrep -f "next-server" >/dev/null 2>&1; then
      echo "The site is running. Stop the service first, then run --apply again." >&2
      exit 1
    fi
    read -r -p "Restore $snap over $LIVE? The current database is saved first. Type RESTORE: " reply
    [ "$reply" = "RESTORE" ] || { echo "Cancelled."; exit 1; }
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    # Keep the current database exactly as it was, including any WAL beside it. The
    # service is stopped, so a clean shutdown has already checkpointed.
    cp -p "$LIVE" "$LIVE.before-restore-$stamp"
    [ -f "$LIVE-wal" ] && mv "$LIVE-wal" "$LIVE.before-restore-$stamp-wal"
    [ -f "$LIVE-shm" ] && mv "$LIVE-shm" "$LIVE.before-restore-$stamp-shm"
    cp "$snap" "$LIVE"
    verify_one "$LIVE"
    echo "Restored. Start the service, then confirm /api/version and that the Coach shows the conversations."
    ;;
  * ) echo "usage: $0 [--check <snapshot> | --apply <snapshot>]" >&2; exit 2 ;;
esac
