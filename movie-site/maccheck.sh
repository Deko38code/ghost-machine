#!/bin/bash
# maccheck.sh — Test if a MAC works on a Stalker portal
# Usage: ./maccheck.sh <mac> [portal_url]

MAC="${1}"
PORTAL="${2:-http://www.streamtv.to:8080}"

if [ -z "$MAC" ]; then
    echo "Usage: $0 <mac_address> [portal_url]"
    echo "       $0 00:1A:79:XX:XX:XX"
    echo "       $0 00:1A:79:XX:XX:XX http://other.portal:8080"
    exit 1
fi

echo "[*] Checking MAC: $MAC"
echo "[*] Portal:      $PORTAL"

RESPONSE=$(curl -s --max-time 5 \
  -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 5 rev: 2116 Mobile Safari/533.3" \
  -b "mac=$MAC; sn=$(openssl rand -hex 7 | tr '[:lower:]' '[:upper:]'); stb_lang=en" \
  "$PORTAL/stalker_portal/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml")

TOKEN=$(echo "$RESPONSE" | grep -oP '"Token":"\K[^"]+' | head -1)
if [ -z "$TOKEN" ]; then
    TOKEN=$(echo "$RESPONSE" | grep -oP '"token":"\K[^"]+' | head -1)
fi

if [ -n "$TOKEN" ]; then
    echo "[+] MAC VALID — token: ${TOKEN:0:24}..."
else
    echo "[-] MAC INVALID or portal down"
    echo "$RESPONSE" | head -c 300
fi
