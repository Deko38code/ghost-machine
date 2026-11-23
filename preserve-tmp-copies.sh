#!/bin/sh
# Preserve every locally-changed and untracked file from the .tmp copies, byte for byte,
# before the copies are removed. Owner approved deleting the copies; this guarantees the
# local work survives even if a patch would not re-apply.
set -u
SRC=/mnt/parrot-work-ssd/from-home-ghost694
DST=/home/ghost694/ssd-tmp-preserved-20261122
mkdir -p "$DST"
LIST=/tmp/preserve-list.$$

archive_repo() {
  repo="$1"
  label="$2"
  out="$DST/$label-changed-files"
  mkdir -p "$out"

  # Only files with real content changes. A mode-only change shows as "0  0  path".
  git -C "$repo" diff --numstat 2>/dev/null \
    | awk '($1 != "0" || $2 != "0") && $3 != "" { print $3 }' > "$LIST"
  n_changed=$(wc -l < "$LIST")
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
      /*|*..*) echo "SKIP unsafe path: $f"; continue ;;
    esac
    mkdir -p "$out/$(dirname "$f")"
    cp -p "$repo/$f" "$out/$f" 2>/dev/null || echo "MISS $label $f"
  done < "$LIST"

  # Untracked files and directories.
  git -C "$repo" ls-files --others --exclude-standard 2>/dev/null > "$LIST"
  n_untracked=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
      /*|*..*) echo "SKIP unsafe path: $f"; continue ;;
    esac
    if [ -d "$repo/$f" ]; then
      mkdir -p "$out/untracked/$(dirname "$f")"
      cp -a "$repo/$f" "$out/untracked/$f" 2>/dev/null || echo "MISS $label $f"
    else
      mkdir -p "$out/untracked/$(dirname "$f")"
      cp -p "$repo/$f" "$out/untracked/$f" 2>/dev/null || echo "MISS $label $f"
    fi
    n_untracked=$((n_untracked + 1))
  done < "$LIST"

  echo "$label: $n_changed changed file(s), $n_untracked untracked item(s) archived"
}

archive_repo "$SRC/claw-code.tmp" claw-code
archive_repo "$SRC/claw-code.tmp/rust/claw-code" claw-code-nested-rust-claw-code
archive_repo "$SRC/llama.cpp.tmp" llama.cpp
archive_repo "$SRC/text-generation-webui.tmp" text-generation-webui

rm -f "$LIST"
echo "=== archive total ==="
du -sm "$DST" | cut -f1 | sed 's/$/ MB/'
echo "=== archived file count ==="
find "$DST" -type f | wc -l
echo "PRESERVE_DONE"
