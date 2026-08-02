#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
SERVER_PID_FILE="$RUNTIME_DIR/cinevault-server.pid"
TUNNEL_PID_FILE="$RUNTIME_DIR/cinevault-tunnel.pid"
URL_FILE="$RUNTIME_DIR/cinevault-public-url.txt"
PORT="${PORT:-8080}"

show_pid_state() {
  local pid_file="$1"
  local label="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "$label: not tracked"
    return
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "$label: running (PID $pid)"
  else
    echo "$label: stale pid file ($pid)"
  fi
}

show_pid_state "$SERVER_PID_FILE" "server"
show_pid_state "$TUNNEL_PID_FILE" "tunnel"

if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  echo "http: healthy on 127.0.0.1:${PORT}"
else
  echo "http: not responding on 127.0.0.1:${PORT}"
fi

if [[ -s "$URL_FILE" ]]; then
  echo "public_url: $(cat "$URL_FILE")"
else
  echo "public_url: not captured yet"
fi
