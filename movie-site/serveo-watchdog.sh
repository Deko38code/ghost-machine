#!/usr/bin/env bash
# serveo-watchdog.sh — Auto-reconnect localhost.run tunnel + track current URL
# Writes current public URL to /tmp/serveo-current-url for the server to read

LOG="/tmp/serveo-tunnel.log"
URL_FILE="/tmp/serveo-current-url"
PID_FILE="/tmp/serveo-tunnel.pid"
RETRY_DELAY=5

cleanup() {
  [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "[$(date -Iseconds)] Watchdog shutting down" >> "$LOG"
}
trap cleanup EXIT

start_tunnel() {
  pkill -f 'ssh.*localhost.run\|ssh.*serveo' 2>/dev/null || true
  sleep 1
  > "$LOG"

  echo "[$(date -Iseconds)] Starting serveo.net tunnel..." >> "$LOG"
  ssh -o StrictHostKeyChecking=no \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -R 80:localhost:8081 serveo.net 2>&1 | tee -a "$LOG" &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  local waited=0
  while [ $waited -lt 30 ]; do
    sleep 2
    waited=$((waited + 2))
    local url
    url=$(grep -o 'https://[a-zA-Z0-9._-]*\.serveousercontent\.com' "$LOG" | tail -1 || true)
    if [ -n "$url" ]; then
      echo "$url" > "$URL_FILE"
      echo "[$(date -Iseconds)] TUNNEL LIVE: $url" >> "$LOG"
      echo "TUNNEL LIVE: $url"
      return 0
    fi
  done
  echo "[$(date -Iseconds)] Tunnel failed to get URL in 30s" >> "$LOG"
  return 1
}

check_alive() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

attempts=0
echo "[$(date -Iseconds)] Tunnel watchdog starting..." >> "$LOG"

while true; do
  if ! check_alive; then
    attempts=$((attempts + 1))
    echo "[$(date -Iseconds)] Tunnel down (attempt $attempts). Reconnecting in ${RETRY_DELAY}s..." >> "$LOG"
    sleep "$RETRY_DELAY"
    start_tunnel && attempts=0
  fi
  sleep 10
done
