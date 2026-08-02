#!/bin/bash
# vlc-diag.sh — Run this to identify where your 45s is going
# Collects precise timing for every stage

STREAM_URL="$1"
if [ -z "$STREAM_URL" ]; then
  echo "Usage: $0 <stream-url>"
  echo "Get a stream URL from your portal first, then pass it here"
  exit 1
fi

echo "============================================"
echo "VLC STALKER BUFFER DIAGNOSTIC"
echo "Testing stream: ${STREAM_URL:0:80}..."
echo "============================================"
echo ""

# 1. DNS resolution time
echo "[1/5] DNS Resolution..."
START=$SECONDS
HOST=$(echo "$STREAM_URL" | sed -e 's|http://||' -e 's|https://||' -e 's|:.*||' -e 's|/.*||')
nslookup "$HOST" 2>&1 | tail -5
DNS_TIME=$(( SECONDS - START ))
echo "  → DNS took ${DNS_TIME}s"
echo ""

# 2. TCP connection time
echo "[2/5] TCP Handshake..."
START=$SECONDS
PORT=$(echo "$STREAM_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
[ -z "$PORT" ] && PORT=80
timeout 5 bash -c "echo > /dev/tcp/$HOST/$PORT" 2>/dev/null && echo "  → TCP connected in $(( SECONDS - START ))s" || echo "  → TCP FAILED (timeout)"
TCP_TIME=$(( SECONDS - START ))
echo ""

# 3. HTTP HEAD request (server response time)
echo "[3/5] HTTP Response Time..."
START=$SECONDS
curl -s -o /dev/null -w "  → HTTP status: %{http_code}\n  → Time to first byte: %{time_starttransfer}s\n  → Total time: %{time_total}s\n  → Speed: %{speed_download}B/s\n" --max-time 15 -I "$STREAM_URL" 2>&1
HTTP_TIME=$(( SECONDS - START ))
echo ""

# 4. First byte of actual stream data
echo "[4/5] First Byte of Stream Data..."
START=$SECONDS
timeout 10 curl -s -o /dev/null -w "  → First byte received: %{time_starttransfer}s\n  → Redirects: %{num_redirects}\n" --max-time 10 "$STREAM_URL" 2>&1
FIRST_BYTE=$(( SECONDS - START ))
echo ""

# 5. VLC direct launch timing
echo "[5/5] VLC Launch Timing (15s max)..."
START=$SECONDS
timeout 15 vlc "$STREAM_URL" \
  --network-caching=300 \
  --live-caching=100 \
  --no-audio \
  --play-and-exit \
  --intf=dummy \
  --no-video-title-show \
  --verbose=0 \
  vlc://quit 2>/dev/null &
VLC_PID=$!
sleep 3
# Check if VLC actually started playing or is stuck
kill $VLC_PID 2>/dev/null
VLC_TIME=$(( SECONDS - START ))
echo "  → VLC was killed after ${VLC_TIME}s (3s was enough to test)"
echo ""

echo "============================================"
echo "DIAGNOSTIC SUMMARY"
echo "============================================"
echo "DNS lookup:          ${DNS_TIME}s (should be < 0.5s)"
echo "TCP handshake:       ${TCP_TIME}s (should be < 1s)"
echo "HTTP first byte:     ${FIRST_BYTE}s (should be < 2s)"
echo "VLC startup window:  ~3s test"
echo ""
echo "IF ANY VALUE > 5s: That's your bottleneck"
echo "============================================"
