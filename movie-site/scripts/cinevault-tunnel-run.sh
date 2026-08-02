#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_FILE="$RUNTIME_DIR/cinevault-tunnel.log"
URL_FILE="$RUNTIME_DIR/cinevault-public-url.txt"
PORT="${PORT:-8080}"
TUNNEL_PROVIDER="${TUNNEL_PROVIDER:-cloudflared}"
SERVEO_HOST="${SERVEO_HOST:-serveo.net}"
SERVEO_SUBDOMAIN="${SERVEO_SUBDOMAIN:-}"

mkdir -p "$RUNTIME_DIR"
touch "$LOG_FILE"

start_cloudflared() {
  echo "[$(date -Is)] tunnel runner starting for cloudflared -> localhost:$PORT" >>"$LOG_FILE"
  while true; do
    stdbuf -oL -eL cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate 2>&1 | while IFS= read -r line; do
      printf '%s\n' "$line" >>"$LOG_FILE"
      url="$(printf '%s\n' "$line" | grep -Eo 'https?://[^ ]+\.trycloudflare\.com' | head -n 1 || true)"
      if [[ -n "$url" ]]; then
        printf '%s\n' "$url" >"$URL_FILE"
      fi
    done
    echo "[$(date -Is)] cloudflared dropped, retrying in 5s" >>"$LOG_FILE"
    sleep 5
  done
}

start_serveo() {
  remote_spec="80:localhost:${PORT}"
  if [[ -n "$SERVEO_SUBDOMAIN" ]]; then
    remote_spec="${SERVEO_SUBDOMAIN}:80:localhost:${PORT}"
  fi

  echo "[$(date -Is)] tunnel runner starting for $SERVEO_HOST -> localhost:$PORT" >>"$LOG_FILE"
  while true; do
    stdbuf -oL -eL ssh \
      -o ExitOnForwardFailure=yes \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o StrictHostKeyChecking=accept-new \
      -o TCPKeepAlive=yes \
      -R "$remote_spec" \
      "$SERVEO_HOST" 2>&1 | while IFS= read -r line; do
        printf '%s\n' "$line" >>"$LOG_FILE"
        url="$(printf '%s\n' "$line" | grep -Eo 'https?://[^ ]+' | head -n 1 || true)"
        if [[ -n "$url" ]]; then
          printf '%s\n' "$url" >"$URL_FILE"
        fi
      done

    echo "[$(date -Is)] serveo dropped, retrying in 5s" >>"$LOG_FILE"
    sleep 5
  done
}

case "$TUNNEL_PROVIDER" in
  cloudflared) start_cloudflared ;;
  serveo) start_serveo ;;
  *)
    echo "Unknown TUNNEL_PROVIDER=$TUNNEL_PROVIDER" >>"$LOG_FILE"
    exit 1
    ;;
esac
