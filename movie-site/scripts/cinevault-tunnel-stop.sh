#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
SERVER_PID_FILE="$RUNTIME_DIR/cinevault-server.pid"
TUNNEL_PID_FILE="$RUNTIME_DIR/cinevault-tunnel.pid"

stop_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "$label not tracked in this repo."
    return
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "Stopped $label PID $pid"
  else
    echo "$label PID file existed but process was not running."
  fi
  rm -f "$pid_file"
}

stop_pid_file "$TUNNEL_PID_FILE" "tunnel runner"

if [[ "${1:-}" == "--with-server" ]]; then
  stop_pid_file "$SERVER_PID_FILE" "CineVault server"
fi
