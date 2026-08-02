#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
SERVER_PID_FILE="$RUNTIME_DIR/cinevault-server.pid"
TUNNEL_PID_FILE="$RUNTIME_DIR/cinevault-tunnel.pid"
SERVER_LOG="$RUNTIME_DIR/cinevault-server.log"
TUNNEL_LOG="$RUNTIME_DIR/cinevault-tunnel.log"
URL_FILE="$RUNTIME_DIR/cinevault-public-url.txt"
PORT="${PORT:-8080}"
TUNNEL_PROVIDER="${TUNNEL_PROVIDER:-serveo}"
SERVEO_SUBDOMAIN="${SERVEO_SUBDOMAIN:-cinevault}"

mkdir -p "$RUNTIME_DIR"

is_pid_live() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

wait_for_http() {
  local attempts=20
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if is_pid_live "$SERVER_PID_FILE"; then
  echo "CineVault server already tracked in this repo: PID $(cat "$SERVER_PID_FILE")"
elif curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  echo "Port ${PORT} is already serving HTTP. Leaving existing server untouched."
else
  echo "Starting CineVault server from $ROOT_DIR on port ${PORT}..."
  nohup bash -lc "cd '$ROOT_DIR' && exec node server.js" >>"$SERVER_LOG" 2>&1 &
  echo $! >"$SERVER_PID_FILE"
  if ! wait_for_http; then
    echo "Server failed to respond on port ${PORT}. Check $SERVER_LOG"
    exit 1
  fi
fi

if is_pid_live "$TUNNEL_PID_FILE"; then
  echo "Tunnel runner already active: PID $(cat "$TUNNEL_PID_FILE")"
else
  echo "Starting ${TUNNEL_PROVIDER} tunnel runner..."
  nohup bash -lc "cd '$ROOT_DIR' && TUNNEL_PROVIDER='$TUNNEL_PROVIDER' SERVEO_SUBDOMAIN='$SERVEO_SUBDOMAIN' exec '$ROOT_DIR/scripts/cinevault-tunnel-run.sh'" >>"$TUNNEL_LOG" 2>&1 &
  echo $! >"$TUNNEL_PID_FILE"
fi

echo "Waiting for public URL..."
for _ in $(seq 1 20); do
  if [[ -s "$URL_FILE" ]]; then
    echo "Public URL: $(cat "$URL_FILE")"
    exit 0
  fi
  sleep 1
done

echo "Tunnel started but no public URL detected yet. Check $TUNNEL_LOG"
