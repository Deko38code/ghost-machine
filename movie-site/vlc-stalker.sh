#!/bin/bash
# vlc-stalker.sh — Immortal VLC player for Stalker streams
# Features: heartbeat (prevents 42s kill), auto-reconnect, kill-proof, instant-fail detect
# Usage: vlc-stalker.sh <cache_ms> <stream_url> [extra_vlc_args...]
#        vlc-stalker.sh <cache_ms> <stream_url> --reconnect <api_url>

CACHE=${1:-300}
URL=${2}
shift 2
EXTRA_ARGS=("$@")

if [ -z "$URL" ]; then
    echo "Usage: $0 <cache_ms> <stream_url> [extra...]"
    echo "       $0 300 http://portal/stream.m3u8"
    echo "       $0 300 http://portal/stream --reconnect http://localhost:8081/api/channel/123"
    echo "       $0 300 http://portal/stream --headless"
    exit 1
fi

# --- Parse --reconnect and --headless flags from extra args ---
RECONNECT_API=""
HEADLESS=false
FINAL_ARGS=()
i=0
while [ $i -lt ${#EXTRA_ARGS[@]} ]; do
    arg="${EXTRA_ARGS[$i]}"
    if [ "$arg" = "--reconnect" ]; then
        i=$((i + 1))
        RECONNECT_API="${EXTRA_ARGS[$i]}"
    elif [ "$arg" = "--headless" ]; then
        HEADLESS=true
    else
        FINAL_ARGS+=("$arg")
    fi
    i=$((i + 1))
done

# --- Trap ALL kill signals — never die ---
# SIGKILL (9) / SIGSTOP: kernel enforced, cannot trap
trap '' HUP INT QUIT ABRT BUS FPE SEGV PIPE ALRM USR1 USR2 TERM
trap 'cleanup' EXIT

ATTEMPT=0
heartbeat_pid=""

cleanup() {
    if [ -n "$heartbeat_pid" ] && kill -0 "$heartbeat_pid" 2>/dev/null; then
        kill "$heartbeat_pid" 2>/dev/null
        wait "$heartbeat_pid" 2>/dev/null
    fi
    echo "[vlc-stalker] Clean exit after $ATTEMPT attempts" >&2
}

# --- Extract portal/MAC/token from the stream URL for heartbeat ---
extract_hb_params() {
    local url="$1"
    PORTAL_BASE=""
    HB_MAC=""
    HB_TOKEN=***
    if [[ "$url" =~ ^(https?://[^/]+)/stalker_portal ]]; then
        PORTAL_BASE="${BASH_REMATCH[1]}/stalker_portal/server/load.php"
        QUERY="${url#*\?}"
        IFS='&' read -ra PARAMS <<< "$QUERY"
        for param in "${PARAMS[@]}"; do
            key="${param%%=*}"
            val="${param#*=}"
            case "$key" in
                mac)   HB_MAC="$val" ;;
                token) HB_TOKEN=*** ;;
            esac
        done
    fi
}

start_heartbeat() {
    stop_heartbeat
    if [ -n "$PORTAL_BASE" ] && [ -n "$HB_MAC" ] && [ -n "$HB_TOKEN" ]; then
        echo "[vlc-stalker] Starting heartbeat for $HB_MAC (every 15s)..." >&2
        (
            while true; do
                sleep 15
                curl -s --max-time 5 \
                  -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 5 rev: 2116 Mobile Safari/533.3" \
                  -H "Authorization: Bearer $HB_TOKEN" \
                  -b "mac=$HB_MAC; token=$HB_TOKEN; stb_lang=en" \
                  "${PORTAL_BASE}?type=stb&action=get_events&JsHttpRequest=1-xml" >/dev/null 2>&1
            done
        ) &
        heartbeat_pid=$!
        disown $heartbeat_pid 2>/dev/null
        echo "[vlc-stalker] Heartbeat PID: $heartbeat_pid (disowned)" >&2
    fi
}

stop_heartbeat() {
    if [ -n "$heartbeat_pid" ] && kill -0 "$heartbeat_pid" 2>/dev/null; then
        kill "$heartbeat_pid" 2>/dev/null
        wait "$heartbeat_pid" 2>/dev/null
        heartbeat_pid=""
    fi
}

# --- Get fresh stream URL (for reconnect mode) ---
get_fresh_url() {
    if [ -n "$RECONNECT_API" ]; then
        local fresh=$(curl -s --max-time 10 "$RECONNECT_API")
        if [ -n "$fresh" ]; then
            echo "$fresh"
            return 0
        fi
    fi
    echo "$URL"
    return 0
}

# --- Pre-flight: quick HEAD check before spawning VLC ---
preflight_check() {
    local url="$1"
    # Only check http/https URLs, skip relay/local paths
    if [[ "$url" =~ ^https?:// ]]; then
        local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -I "$url")
        if [ "$code" -ge 500 ] 2>/dev/null || [ "$code" = "000" ]; then
            echo "[vlc-stalker] Pre-flight FAIL (status=$code)" >&2
            return 1
        fi
        echo "[vlc-stalker] Pre-flight OK (status=$code)" >&2
    fi
    return 0
}

# --- IMMORTAL LOOP: launch VLC, detect fast-fail, reconnect ---
while true; do
    ATTEMPT=$((ATTEMPT + 1))

    # Get stream URL (fresh each loop if reconnect API set)
    STREAM_URL=$(get_fresh_url)

    # Pre-flight check: skip dead URLs fast
    if ! preflight_check "$STREAM_URL"; then
        if [ -n "$RECONNECT_API" ]; then
            echo "[vlc-stalker] Preflight dead — getting fresh URL from API..." >&2
            STREAM_URL=$(curl -s --max-time 10 "$RECONNECT_API")
            if [ -z "$STREAM_URL" ]; then
                echo "[vlc-stalker] Fresh URL empty — waiting 3s" >&2
                sleep 3
                continue
            fi
            preflight_check "$STREAM_URL" || true  # try anyway
        else
            echo "[vlc-stalker] No reconnect API — retrying in 5s" >&2
            sleep 5
            continue
        fi
    fi

    # Re-extract heartbeat params from current URL
    extract_hb_params "$STREAM_URL"
    start_heartbeat

    echo "[vlc-stalker] Attempt #$ATTEMPT — playing $(echo "$STREAM_URL" | cut -c1-80)..." >&2

    START_TS=$(date +%s)

    vlc \
      --play-and-exit \
      $([ "$HEADLESS" = true ] && echo '--intf=dummy') \
      --ipv4-timeout=3000 \
      --no-playlist-autostart \
      --no-playlist-tree \
      --network-caching=300 \
      --live-caching=0 \
      --file-caching=50 \
      --http-caching=300 \
      --rtsp-tcp \
      --clock-synchro=0 \
      --no-drop-late-frames \
      --no-skip-frames \
      --avcodec-hw=any \
      --avcodec-threads=2 \
      --hds-fetch-bytes=100000 \
      --meta-title="Stalker Stream" \
      --no-video-title-show \
      --no-sub-autodetect-file \
      "${FINAL_ARGS[@]}" \
      "$STREAM_URL"

    VLC_RC=$?
    END_TS=$(date +%s)
    PLAYED_SECS=$((END_TS - START_TS))

    stop_heartbeat

    # VLC exited — why?
    if [ $PLAYED_SECS -le 3 ]; then
        # Fast-fail: bad URL or dead stream. Retry immediately.
        echo "[vlc-stalker] Fast-fail (${PLAYED_SECS}s, rc=$VLC_RC) — retrying immediately" >&2
        sleep 1
    elif [ $VLC_RC -ne 0 ]; then
        # VLC crashed or stream died after playing. Short backoff.
        echo "[vlc-stalker] Stream died after ${PLAYED_SECS}s (rc=$VLC_RC) — reconnecting in 2s" >&2
        sleep 2
    else
        # Clean VLC exit (user closed it). We're done.
        echo "[vlc-stalker] VLC closed cleanly after ${PLAYED_SECS}s" >&2
        exit 0
    fi
done
