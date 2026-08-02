#!/usr/bin/env bash
# ── CineVault Cover Art AI Agent v4 ──
# Scans ALL curated library items for missing/broken cover art
# Strategy: use /api/auto-enrich (which resolves TMDB→title+poster)
# then verify via /api/cover-art with the resolved title
# Reports: missing count, fixed count, still-broken list
# Run: bash /home/ghost/movie-site/scripts/cover-agent.sh
set -euo pipefail

SERVER="http://localhost:8080"
DATA_DIR="/home/ghost/movie-site/data"
LOG="$DATA_DIR/cover-agent.log"
REPORT="$DATA_DIR/cover-report.json"
mkdir -p "$DATA_DIR"

# All TMDB IDs from curated.js
MOVIE_IDS=(550 278 155 603 238 496243 157336 497 680 13 947 293660 533535 122 11 218 245891 584 585 13811 51439 168259 281338 337339 385687 714166 383498 181808 263115 24637 76338 1771 10023 4951 68721 299534 299536 299537 429617 508943 566525 361743 420818 634649 580489 603692 705861 616037 102611 495764 24428 284052 497698 471574 527771 41421 91314 557 558 559 324549 324552 268 414 272 348 710 656 686 693 670 672 671 687 707 722 361197 370913 64688 10764 10766 10778 1891 1892 1893 1894 1895 348350 181812 330459 120 121 12291 49051 49026 53647 604 605 624860 329 330 331 329869 351286 508439 87101 10721 53423 290859 954 956 957 958 359516 577922 668460 2396 2397 2398 2399 3691 2402 3692 408529 457078 274 824 4971 2105 62 679 680 681 135397 407201 22 58 287 303 338761 2001 2002 2003 2004 326291 522404 70160 70161 70162 70163 653346 302694 458156 748822 366 367 368 369 946 948 949 608 609 610 43964 457232 85 86 87 335 335784 8 9 10 862 863 10193 12 326473 812 809 810 10340 8587 8588 8589 10138 11594 920 921 532 920 10193 532 82674 438799 11574 46610 278154 408826 399074 444489 568124 2899 273437 22862 165 346 424 194 93 399 27205 769 887 539 419 6934 4470 447365 10273 414 21 9476 1492 659 266 500 98 24 89 254 372658 594 1585 10702 354912 631 550 348 3982 49026 572 650)
TV_IDS=(76479 4626 55316 2287 102022 1396 60059 1399 66732 67915 82856 2190 60625 2316 45793 67158 71663 85968 89826 94555 57243 60573 70536 70548 82819 62104 62710 71912 4614 202250 1622 2478 1100 2615 2734 4087 48891 1668 590 48883 37854 12971 8592 1429 100283 125141 104281 31911 67195 88396 93484 77169)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

TOTAL=0; OK=0; MISSING=0; FIXED=0; FAILED=0
BROKEN_LIST=""

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🤖 CineVault Cover Art AI Agent v4"
log "   Server: ${SERVER}"
log "   Strategy: cover-art → auto-enrich fallback"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Check + fix one item ──
process_item() {
  local tmdb_id="$1"
  local type="$2"
  TOTAL=$((TOTAL + 1))

  # Step 1: Check cover-art with just tmdb_id (uses mapping table + Cinemeta)
  local response poster title
  response=$(curl -s -m 10 "${SERVER}/api/cover-art?tmdb_id=${tmdb_id}&type=${type}" 2>/dev/null) || true
  
  if [ -n "$response" ]; then
    poster=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('poster','') or '')" 2>/dev/null || echo "")
    title=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title','') or '')" 2>/dev/null || echo "")
  fi

  if [ -n "$poster" ]; then
    OK=$((OK + 1))
    return 0
  fi

  # Step 2: Missing! Try auto-enrich which resolves title + poster via OMDb/Cinemeta
  MISSING=$((MISSING + 1))
  log "🔍 Missing: ${type}/${tmdb_id} ${title:-???}"

  local enrich_response enrich_poster enrich_title
  enrich_response=$(curl -s -m 15 "${SERVER}/api/auto-enrich?id=${tmdb_id}&type=${type}" 2>/dev/null) || true
  
  if [ -n "$enrich_response" ]; then
    enrich_poster=$(echo "$enrich_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('poster','') or '')" 2>/dev/null || echo "")
    enrich_title=$(echo "$enrich_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title','') or '')" 2>/dev/null || echo "")
    
    if [ -n "$enrich_poster" ]; then
      FIXED=$((FIXED + 1))
      log "   ✅ Enriched: ${enrich_title:-???} → poster found"
      return 0
    fi
    
    # Step 3: If auto-enrich found title but no poster, retry cover-art WITH title
    if [ -n "$enrich_title" ]; then
      local retry_response retry_poster
      retry_response=$(curl -s -m 10 "${SERVER}/api/cover-art?title=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${enrich_title}'))")&type=${type}" 2>/dev/null) || true
      if [ -n "$retry_response" ]; then
        retry_poster=$(echo "$retry_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('poster','') or '')" 2>/dev/null || echo "")
        if [ -n "$retry_poster" ]; then
          FIXED=$((FIXED + 1))
          log "   ✅ Title retry: ${enrich_title} → poster found"
          return 0
        fi
      fi
    fi
  fi

  FAILED=$((FAILED + 1))
  BROKEN_LIST="${BROKEN_LIST}${type}/${tmdb_id} "
  log "   ❌ Still broken: ${type}/${tmdb_id}"
}

# ── Process all movies ──
log ""
log "📽️  Scanning ${#MOVIE_IDS[@]} movies..."
for id in "${MOVIE_IDS[@]}"; do
  process_item "$id" "movie"
  sleep 0.15
done

# ── Process all TV shows ──
log ""
log "📺 Scanning ${#TV_IDS[@]} TV shows..."
for id in "${TV_IDS[@]}"; do
  process_item "$id" "tv"
  sleep 0.15
done

# ── Report ──
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 REPORT: ${OK}/${TOTAL} OK | ${MISSING} missing | ${FIXED} auto-fixed | ${FAILED} still broken"
if [ -n "$BROKEN_LIST" ]; then
  log "💀 Still broken IDs: ${BROKEN_LIST}"
fi
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save JSON report
python3 -c "
import json, datetime
report = {
  'timestamp': datetime.datetime.now().isoformat(),
  'total': ${TOTAL}, 'ok': ${OK}, 'missing': ${MISSING},
  'fixed': ${FIXED}, 'failed': ${FAILED},
  'broken': '${BROKEN_LIST}'.strip().split() if '${BROKEN_LIST}'.strip() else []
}
with open('${REPORT}', 'w') as f:
  json.dump(report, f, indent=2)
print(json.dumps(report))
" 2>/dev/null | tee -a "$LOG"