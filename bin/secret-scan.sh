#!/usr/bin/env bash
# secret-scan.sh — one scanner behind every layer that can leak a credential.
#
# It prints the file, the line number, and the rule name. It never prints the
# matched value, never writes a value to disk, and never sends one anywhere.
#
#   secret-scan.sh --staged        added lines in the index (pre-commit hook)
#   secret-scan.sh --tree          every tracked file at HEAD (manual, cron)
#   secret-scan.sh --at REV        every tracked file at REV
#   secret-scan.sh --commits RANGE files changed in RANGE     (pre-push hook)
#   secret-scan.sh --deep          --tree plus exact match of live values in
#                                  ~/.secrets.env, so unknown key formats are
#                                  caught by value, not only by shape
#
#   --strict    treat SOFT findings as failures too
#   --quiet     only set the exit code
#
# Exit: 0 clean, 1 findings, 2 usage error.
#
# Env knobs:
#   SECRET_VALUES_FILE  default ~/.secrets.env  (read, never echoed)
#   SECRET_SCAN_ALLOW   default ~/bin/secret-scan.allow  (path regexes to skip)
#   SECRET_SCAN_SKIP=1  bypass entirely — prefer `git commit --no-verify`

set -uo pipefail

MODE=""; DEEP=0; STRICT=0; QUIET=0; RANGE=""; AT=""; PATHS=()
usage() { sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --staged)  MODE=staged ;;
    --tree)    MODE=tree ;;
    --at)      MODE=tree; AT="${2:-HEAD}"; [ -n "$AT" ] && shift ;;
    --commits) MODE=commits; RANGE="${2:-}"; [ -n "$RANGE" ] && shift ;;
    --deep)    DEEP=1 ;;
    --strict)  STRICT=1 ;;
    --quiet)   QUIET=1 ;;
    -h|--help) usage; exit 0 ;;
    --)        shift; PATHS+=("$@"); break ;;
    -*)        echo "secret-scan: unknown option $1" >&2; exit 2 ;;
    *)         PATHS+=("$1") ;;
  esac
  shift
done
[ -z "$MODE" ] && MODE=staged
[ "${SECRET_SCAN_SKIP:-0}" = "1" ] && exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "secret-scan: not a git repo" >&2; exit 2; }
VALUES="${SECRET_VALUES_FILE:-$HOME/.secrets.env}"
ALLOW="${SECRET_SCAN_ALLOW:-$HOME/bin/secret-scan.allow}"

say() { [ $QUIET -eq 1 ] || printf '%s\n' "$*"; }

# ---------------------------------------------------------------- rules ------
# name <TAB> tier <TAB> regex.  tier "hard" fails, "soft" only warns.
# Ordered: the first rule that matches a line owns that line.
T=$'\t'
RULES=(
  "private-key${T}hard${T}-----BEGIN [A-Z ]*PRIVATE KEY-----"
  "anthropic${T}hard${T}sk-ant-[A-Za-z0-9_-]{20,}"
  "openrouter${T}hard${T}sk-or-v1-[A-Za-z0-9]{20,}"
  "openai${T}hard${T}sk-(proj-)?[A-Za-z0-9_-]{32,}"
  "groq${T}hard${T}gsk_[A-Za-z0-9]{20,}"
  "nvidia${T}hard${T}nvapi-[A-Za-z0-9_-]{20,}"
  "google${T}hard${T}AIzaSy[A-Za-z0-9_-]{30,}"
  "aws${T}hard${T}(AKIA|ASIA)[0-9A-Z]{16}"
  "github${T}hard${T}(gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})"
  "slack${T}hard${T}xox[baprs]-[A-Za-z0-9-]{10,}"
  "stripe${T}hard${T}(sk|rk)_live_[A-Za-z0-9]{20,}"
  "telegram${T}hard${T}[0-9]{8,10}:[A-Za-z0-9_-]{35}"
  "cftunnel${T}hard${T}\"TunnelSecret\"[[:space:]]*:"
  "dburl${T}hard${T}(postgres|postgresql|mysql|mongodb|mongodb\\+srv|redis)://[A-Za-z0-9_.-]+:[^@/[:space:]]{6,}@"
  "jwt${T}hard${T}eyJ[A-Za-z0-9_-]{15,}\\.[A-Za-z0-9_-]{15,}\\.[A-Za-z0-9_-]{10,}"
  "bearer${T}soft${T}[Bb]earer[[:space:]]+[A-Za-z0-9._-]{25,}"
  "assignment${T}soft${T}(api[_-]?key|secret|token|password|passwd|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_./+=-]{16,}[\"']"
)

# Placeholder-looking lines are not credentials.
NOISE_LC='your[_-]?|example|placeholder|xxxx|changeme|replace[_-]?me|process\.env|dummy|sample|\.\.\.|\$\{[a-z_]+\}|<[a-z_-]+>|redacted'

rules_join() { local IFS=$'\n'; printf '%s\n' "${RULES[*]}"; }

# Shared awk prelude: parse the rule table and the live-value file.
# Regexes go through ENVIRON, never through `awk -v`: -v runs its value through
# escape processing, which quietly turns "\." into "." and "\.\.\." into "..."
# — and "..." matches any three characters, so every line looked like noise.
AWK_PRELUDE='
BEGIN {
  rules = ENVIRON["SS_RULES"]; vf = ENVIRON["SS_VALUES"]; q = ENVIRON["SS_NOISE"]; tier = ENVIRON["SS_TIER"]
  n = split(rules, R, "\n")
  for (i = 1; i <= n; i++) {
    if (R[i] == "") continue
    split(R[i], P, "\t")
    m++
    nm[m] = P[1]; tr[m] = P[2]; rx[m] = P[3]
  }
  if (vf != "") {
    while ((getline l < vf) > 0) {
      if (l ~ /^[[:space:]]*#/) continue
      sub(/^[[:space:]]*export[[:space:]]+/, "", l)
      k = index(l, "=")
      if (k == 0) continue
      vn = substr(l, 1, k - 1); vv = substr(l, k + 1)
      gsub(/^["\047]/, "", vv); gsub(/["\047]$/, "", vv)
      sub(/[[:space:]]+$/, "", vv)
      if (length(vv) >= 12) { L++; LN[L] = vn; LV[L] = vv }
    }
    close(vf)
  }
}
'

# ------------------------------------------------------- staged diff mode ----
scan_staged() {
  git -C "$ROOT" diff --cached -U0 --no-color --no-ext-diff --diff-filter=ACM -- . \
      ':(exclude)*.lock' ':(exclude)package-lock.json' ':(exclude)*.min.js' \
      ':(exclude)*.map' ':(exclude)snapshots/**' ':(exclude)snapshots-rsync/**' \
      ':(exclude)backups/**' 2>/dev/null \
    | SS_RULES="$(rules_join)" SS_VALUES="$VALUES" SS_NOISE="$NOISE_LC" awk "$AWK_PRELUDE"'
        /^\+\+\+ b\// { f = substr($0, 7); ln = 0; next }
        /^\+\+\+ /    { f = ""; next }
        /^@@/ {
          split($0, h, "+"); split(h[2], c, ",")
          ln = c[1] - 1
          next
        }
        /^\+/ {
          if (f == "") next
          ln++
          line = substr($0, 2)
          if (tolower(line) ~ q) next
          hit = 0
          for (i = 1; i <= m; i++) {
            if (line ~ rx[i] || (tr[i] == "soft" && tolower(line) ~ rx[i])) {
              print tr[i] "\t" nm[i] "\t" f ":" ln; hit = 1; break
            }
          }
          if (hit) next
          for (i = 1; i <= L; i++) {
            if (index(line, LV[i]) > 0) { print "hard\tLIVE:" LN[i] "\t" f ":" ln; break }
          }
        }'
  return 0
}

# ------------------------------------------- scan a revision + pathspecs -----
scan_rev() {
  local rev="$1"; shift
  local raw="" pass i nm tr re
  local -a pats iflag
  # Two passes instead of one per rule: hard rules case-sensitive, soft rules
  # case-insensitive. Both read git objects, so files deleted from the working
  # tree but still tracked are still covered.
  for pass in hard soft; do
    pats=(); iflag=()
    for i in "${!RULES[@]}"; do
      IFS=$'\t' read -r nm tr re <<< "${RULES[$i]}"
      [ "$tr" = "$pass" ] || continue
      pats+=(-e "$re")
    done
    [ ${#pats[@]} -eq 0 ] && continue
    [ "$pass" = "soft" ] && iflag=(-i)
    raw+=$(git -C "$ROOT" grep -n -I -E "${iflag[@]}" "${pats[@]}" "$rev" -- "$@" 2>/dev/null \
      | SS_RULES="$(rules_join)" SS_NOISE="$NOISE_LC" SS_TIER="$pass" awk -F: "$AWK_PRELUDE"'
          {
            if (tolower($0) ~ q) next
            content = ""
            for (i = 4; i <= NF; i++) content = content (i > 4 ? ":" : "") $i
            for (i = 1; i <= m; i++) {
              if (tr[i] != tier) continue
              if (content ~ rx[i] || (tr[i] == "soft" && tolower(content) ~ rx[i])) {
                print tr[i] "\t" nm[i] "\t" $2 ":" $3
                break
              }
            }
          }')$'\n'
  done
  # One report per line, hard findings first.
  printf '%s\n' "$raw" | awk -F'\t' 'NF >= 3 && !seen[$3]++'
  return 0
}

# ------------------------------------------------ live-value sweep (deep) ----
scan_values_over() {
  local rev="$1"; shift
  [ -r "$VALUES" ] || return 0
  local LIST p
  local -a DISK=() MISS=()
  LIST=$(git -C "$ROOT" ls-tree -r -l "$rev" -- "$@" 2>/dev/null | awk -F'\t' '
    {
      split($1, a, " ")
      size = a[4]; p = $2
      if (size + 0 > 0 && size + 0 < 2000000 &&
          p ~ /\.(js|mjs|cjs|ts|jsx|tsx|json|env|md|txt|sh|bash|py|yml|yaml|conf|ini|cfg|toml|html|css|php|rb|go|java|xml|log|pem|key|bak)$/)
        print p
    }')
  [ -z "$LIST" ] && return 0

  # Tracked but deleted from the working tree is normal (git status 'D') — read
  # those from the object store instead of handing awk a path that isn't there.
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    if [ -e "$ROOT/$p" ]; then DISK+=("$p"); else MISS+=("$p"); fi
  done <<< "$LIST"

  if [ ${#DISK[@]} -gt 0 ]; then
    [ "${SS_DEBUG:-0}" = "1" ] && echo "deep: ${#DISK[@]} on disk, ${#MISS[@]} from objects" >&2
    printf '%s\n' "${DISK[@]}" | tr '\n' '\0' \
      | ( cd "$ROOT" && xargs -0 -r -n 200 env SS_VALUES="$VALUES" awk "$AWK_PRELUDE"'
          BEGIN { if (ENVIRON["SS_DEBUG"] == "1") print "deep: L=" L > "/dev/stderr" }
          {
            if (length($0) < 12) next
            for (i = 1; i <= L; i++) {
              if (index($0, LV[i]) > 0) {
                print "hard\tLIVE:" LN[i] "\t" FILENAME ":" FNR
                break
              }
            }
          }' )
  fi

  for p in "${MISS[@]}"; do
    git -C "$ROOT" show "$rev:$p" 2>/dev/null \
      | SS_VALUES="$VALUES" SS_PATH="$p" awk "$AWK_PRELUDE"'
          {
            if (length($0) < 12) next
            for (i = 1; i <= L; i++) {
              if (index($0, LV[i]) > 0) {
                print "hard\tLIVE:" LN[i] "\t" ENVIRON["SS_PATH"] ":" FNR
                break
              }
            }
          }'
  done
  return 0
}

# ------------------------------------------------------------------ main -----
FINDINGS=""
case "$MODE" in
  staged)
    FINDINGS=$(scan_staged)
    ;;
  tree)
    REV="${AT:-HEAD}"
    if [ ${#PATHS[@]} -gt 0 ]; then
      FINDINGS=$(scan_rev "$REV" -- "${PATHS[@]}")
    else
      FINDINGS=$(scan_rev "$REV")
    fi
    if [ $DEEP -eq 1 ]; then
      FINDINGS+=$'\n'$(scan_values_over "$REV")
    fi
    ;;
  commits)
    [ -z "$RANGE" ] && { echo "secret-scan: --commits needs a range" >&2; exit 2; }
    TIP=${RANGE##*..}; [ -z "$TIP" ] && TIP=HEAD
    mapfile -t CHANGED < <(git -C "$ROOT" diff --name-only --diff-filter=ACM "$RANGE" 2>/dev/null)
    if [ ${#CHANGED[@]} -gt 0 ]; then
      FINDINGS=$(scan_rev "$TIP" -- "${CHANGED[@]}")
      FINDINGS+=$'\n'$(scan_values_over "$TIP" -- "${CHANGED[@]}")
    fi
    ;;
  *) echo "secret-scan: bad mode $MODE" >&2; exit 2 ;;
esac

FINDINGS=$(printf '%s\n' "${FINDINGS:-}" | grep -v '^$' | sort -u || true)

# Allowlist: drop findings whose path matches a regex in $ALLOWS.
if [ -n "$FINDINGS" ] && [ -r "$ALLOW" ]; then
  KEPT=""
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    loc=${line##*$'\t'}
    path=${loc%:*}
    skip=0
    while IFS= read -r re; do
      case "$re" in ''|'#'*) continue ;; esac
      # shellcheck disable=SC2053
      if [[ "$path" =~ $re ]]; then skip=1; break; fi
    done < "$ALLOW"
    [ $skip -eq 1 ] || KEPT+="$line"$'\n'
  done <<< "$FINDINGS"
  FINDINGS=$(printf '%s' "$KEPT")
fi

if [ -z "$FINDINGS" ]; then
  say "secret-scan ($MODE): clean"
  exit 0
fi

HARD=$(printf '%s\n' "$FINDINGS" | grep -c '^hard' || true)
SOFT=$(printf '%s\n' "$FINDINGS" | grep -c '^soft' || true)
[ -z "$HARD" ] && HARD=0
[ -z "$SOFT" ] && SOFT=0

if [ $QUIET -eq 0 ]; then
  echo "🚫 secret-scan ($MODE): $HARD hard, $SOFT soft"
  printf '%s\n' "$FINDINGS" | while IFS=$'\t' read -r tier name loc; do
    mark='✗'
    [ "$tier" = "soft" ] && mark='·'
    printf '   %s %-16s %s\n' "$mark" "$name" "$loc"
  done
  echo
  echo "   Values are deliberately not shown. Open the line and move the value"
  echo "   to ~/.secrets.env (mode 600, gitignored) or an untracked .env."
  echo "   False positive: add its path regex to $ALLOW"
fi

if [ "$HARD" -gt 0 ]; then exit 1; fi
if [ $STRICT -eq 1 ] && [ "$SOFT" -gt 0 ]; then exit 1; fi
exit 0
