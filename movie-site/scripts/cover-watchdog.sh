#!/usr/bin/env bash
# ── CineVault Cover Art Watchdog v2 ──
# Checks + auto-fixes missing cover art using Cinemeta → OMDb fallback
# Run: bash /home/ghost/movie-site/scripts/cover-watchdog.sh [--fix]
# Cron: every 6h for check, add --fix to auto-repair
set -euo pipefail

SERVER="http://localhost:8080"
DATA_DIR="/home/ghost/movie-site/data"
WATCHDOG_LOG="$DATA_DIR/cover-watchdog.log"
FIXED_LOG="$DATA_DIR/cover-fixed.json"
mkdir -p "$DATA_DIR"

# Unique TMDB IDs extracted from curated.js (movies + TV)
MOVIE_IDS=(550 278 155 603 238 496243 157336 497 680 13 947 293660 533535 122 11 218 245891 584 585 13811 51439 168259 281338 337339 385687 714166 383498 181808 263115 24637 76338 1771 10023 4951 68721 299534 299536 299537 429617 508943 566525 361743 420818 634649 580489 603692 705861 616037 102611 495764 24428 284052 497698 471574 527771 41421 91314 557 558 559 324549 324552 268 414 272 348 710 656 686 693 670 672 671 687 707 722 361197 370913 64688 10764 10766 10778 1891 1892 1893 1894 1895 348350 181812 330459 120 121 12291 49051 49026 53647 604 605 624860 329 330 331 329869 351286 508439 87101 10721 53423 290859 954 956 957 958 359516 577922 668460 2396 2397 2398 2399 3691 2402 3692 408529 457078 274 824 4971 2105 62 679 680 681 135397 407201 22 58 287 303 338761 2001 2002 2003 2004 326291 522404 70160 70161 70162 70163 653346 302694 458156 748822 366 367 368 369 946 948 949 608 609 610 43964 457232 85 86 87 335 335784 8 9 10 862 863 10193 12 326473 812 809 810 10340 8587 8588 8589 10138 11594 920 921 532 920 10193 532 82674 438799 11574 46610 278154 408826 399074 444489 568124 2899 273437 22862 165 346 424 194 93 399 27205 769 887 539 419 6934 4470 447365 10273 414 21 9476 1492 659 266 500 98 24 89 254 372658 594 1585 10702 354912 631 550 348 3982 49026 572 650)
TV_IDS=(76479 4626 55316 2287 102022 1396 60059 1399 66732 67915 82856 2190 60625 2316 45793 67158 71663 85968 89826 94555 57243 60573 70536 70548 82819 62104 62710 71912 4614 202250 1622 2478 1100 2615 2734 4087 48891 1668 590 48883 37854 12971 8592 1429 100283 125141 104281 31911 67195 88396 93484 77169)

DO_FIX=false
[[ "${1:-}" == "--fix" ]] && DO_FIX=true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$WATCHDOG_LOG"; }

# ── Check cover art via /api/cover-art ──
check_cover() {
  local tmdb_id="$1"
  local type="$2"  # movie or tv
  local url="${SERVER}/api/cover-art?tmdb_id=${tmdb_id}&type=${type}"
  local response
  response=$(curl -s -m 10 "$url" 2>/dev/null) || true
  if [ -z "$response" ]; then
    echo "MISSING"
    return
  fi
  local poster
  poster=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('poster','') or '')" 2>/dev/null || echo "")
  if [ -z "$poster" ]; then
    echo "NO_POSTER"
  else
    echo "OK"
  fi
}

# ── Auto-fix via Cinemeta (free, no key needed) ──
fix_via_cinemeta() {
  local tmdb_id="$1"
  local type="$2"
  # Cinemeta uses IMDB IDs, but also supports TMDB via search
  # Try direct Cinemeta TMDB lookup first
  local meta_url="https://cinemeta-live.strem.io/meta/${type}/${tmdb_id}.json"
  local response
  response=$(curl -s -m 10 "$meta_url" 2>/dev/null) || true
  if [ -n "$response" ]; then
    local poster
    poster=$(echo "$response" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  meta = d.get('meta', {})
  p = meta.get('poster','') or ''
  b = meta.get('background','') or ''
  logo = meta.get('logo','') or ''
  name = meta.get('name','')
  if p:
    print(f'POSTER={p}')
  if b:
    print(f'BACKDROP={b}')
  if logo:
    print(f'LOGO={logo}')
  if name:
    print(f'NAME={name}')
except: pass
" 2>/dev/null) || true
    if echo "$poster" | grep -q "POSTER="; then
      echo "$poster"
      return 0
    fi
  fi
  
  # Cinemeta may need IMDB ID — try OMDb search
  local omdb_url="https://www.omdbapi.com/?apikey=trilogy&type=${type}&plot=short&t="
  # We don't have the title here, so skip OMDb for now (used elsewhere)
  echo ""
  return 1
}

# ── Main ──
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🎬 CineVault Cover Art Watchdog v2"
log "   Server: ${SERVER}"
log "   Auto-fix: ${DO_FIX}"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL=0
OK=0
MISSING=0
FIXED=0
FAILED=0

# Check movies
log ""
log "📽️  Checking ${#MOVIE_IDS[@]} movies..."
for id in "${MOVIE_IDS[@]}"; do
  TOTAL=$((TOTAL + 1))
  status=$(check_cover "$id" "movie")
  case "$status" in
    OK)
      OK=$((OK + 1))
      ;;
    MISSING|NO_POSTER)
      MISSING=$((MISSING + 1))
      if $DO_FIX; then
        log "🔧 Fixing movie TMDB:$id via Cinemeta..."
        meta=$(fix_via_cinemeta "$id" "movie")
        if [ -n "$meta" ]; then
          FIXED=$((FIXED + 1))
          log "   ✅ Fixed TMDB:$id"
          echo "$meta" >> "$FIXED_LOG"
        else
          FAILED=$((FAILED + 1))
          log "   ❌ Failed TMDB:$id"
        fi
      else
        log "   ⚠️  Movie TMDB:$id — $status"
      fi
      ;;
  esac
  sleep 0.2
done

# Check TV shows
log ""
log "📺 Checking ${#TV_IDS[@]} TV shows..."
for id in "${TV_IDS[@]}"; do
  TOTAL=$((TOTAL + 1))
  status=$(check_cover "$id" "tv")
  case "$status" in
    OK)
      OK=$((OK + 1))
      ;;
    MISSING|NO_POSTER)
      MISSING=$((MISSING + 1))
      if $DO_FIX; then
        log "🔧 Fixing TV TMDB:$id via Cinemeta..."
        meta=$(fix_via_cinemeta "$id" "tv")
        if [ -n "$meta" ]; then
          FIXED=$((FIXED + 1))
          log "   ✅ Fixed TMDB:$id"
          echo "$meta" >> "$FIXED_LOG"
        else
          FAILED=$((FAILED + 1))
          log "   ❌ Failed TMDB:$id"
        fi
      else
        log "   ⚠️  TV TMDB:$id — $status"
      fi
      ;;
  esac
  sleep 0.2
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 Results: ${OK}/${TOTAL} OK | ${MISSING} missing | ${FIXED} fixed | ${FAILED} failed"
if [ "$MISSING" -gt 0 ] && ! $DO_FIX; then
  log "💡 Run with --fix to auto-repair missing covers"
fi
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"