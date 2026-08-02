#!/bin/bash
# ════════════════════════════════════════════════════════
#  VLC Ultimate Buffer Timeout Bypass — CineVault Edition
#  Cuts 43s timeout → 1s, 10MB buffer, all network bypasses
#  Mac/Linux — Run: bash vlc_timeout_bypass.sh <stream_url>
# ════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

CACHE_TIME="30000"
BUFFER_SIZE="10485760"

# ── Detect VLC path ──
detect_vlc() {
  local paths=(
    "/Applications/VLC.app/Contents/MacOS/VLC"
    "/usr/local/bin/vlc"
    "/usr/bin/vlc"
    "/snap/bin/vlc"
    "/opt/homebrew/bin/vlc"
    "$(which vlc 2>/dev/null)"
  )
  for p in "${paths[@]}"; do
    if [ -x "$p" ]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

# ── Create optimized VLC config ──
create_vlc_config() {
  local config_dir="$HOME/.config/vlc"
  local config_file="$config_dir/vlcrc"
  local backup="$config_dir/vlcrc.cinevault-backup"

  mkdir -p "$config_dir"

  # Backup original if no backup exists
  if [ -f "$config_file" ] && [ ! -f "$backup" ]; then
    cp "$config_file" "$backup"
    echo -e "${GREEN}[+] Original VLC config backed up${NC}"
  fi

  cat > "$config_file" << 'VLC_CONFIG'
# CineVault VLC Timeout Bypass Config
[core]
network-caching=30000
file-caching=30000
live-caching=30000
disc-caching=30000
access-caching=30000
sout-mux-caching=30000
clock-jitter=10000
clock-synchro=1
network-synchro=1
input-fast-seek=1
input-repeat=0

[codec]
avcodec-hw=any
avcodec-fast=1
avcodec-skip-frame=0
avcodec-skip-idct=0
avcodec-skip-loop-filter=0

[network]
ipv4-timeout=60000
ipv6-timeout=60000
http-continuous=1
http-reconnect=1
rtsp-tcp=1

[stream_out]
cache-size=10485760
VLC_CONFIG

  echo -e "${GREEN}[+] VLC config written to $config_file${NC}"
}

# ── Launch VLC with all bypass flags ──
launch_vlc() {
  local stream_url="$1"
  local vlc_path

  vlc_path=$(detect_vlc)
  if [ -z "$vlc_path" ]; then
    echo -e "${RED}[!] VLC not found! Install VLC first.${NC}"
    echo -e "${YELLOW}    macOS:  brew install --cask vlc${NC}"
    echo -e "${YELLOW}    Linux:  sudo apt install vlc  /  sudo snap install vlc${NC}"
    return 1
  fi

  echo -e "${GREEN}[+] VLC detected: $vlc_path${NC}"
  create_vlc_config

  echo -e "${MAGENTA}[+] Launching VLC with timeout bypass...${NC}"

  "$vlc_path" \
    --no-qt-error-dialogs \
    --no-video-title-show \
    --no-embedded-video \
    --no-osd \
    --quiet \
    --network-caching="$CACHE_TIME" \
    --file-caching="$CACHE_TIME" \
    --live-caching="$CACHE_TIME" \
    --clock-jitter=10000 \
    --clock-synchro \
    --network-synchro \
    --ipv4-timeout=60000 \
    --tcp-timeout=60000 \
    --http-timeout=60000 \
    --rtsp-timeout=60000 \
    --rtp-timeout=60000 \
    --mms-timeout=60000 \
    --ftp-timeout=60000 \
    --cache-size="$BUFFER_SIZE" \
    --cr-average=100000 \
    --input-fast-seek \
    --http-continuous \
    --http-reconnect \
    --rtsp-tcp \
    --avcodec-hw=any \
    --avcodec-fast \
    --no-playlist-autostart \
    --no-metadata-network-access \
    "$stream_url" &

  local vlc_pid=$!
  echo -e "${GREEN}[+] VLC started — PID: $vlc_pid${NC}"
  echo -e "${CYAN}[*] Stream: $stream_url${NC}"
  echo -e "${YELLOW}[!] Close VLC window or kill $vlc_pid to stop${NC}"
}

# ── Banner ──
show_banner() {
  echo -e "${RED}"
  echo '╔══════════════════════════════════════════════════╗'
  echo '║     VLC ULTIMATE TIMEOUT BYPASS SYSTEM          ║'
  echo '║         43-Second Buffer Bypass                  ║'
  echo '║           CineVault Portal Edition              ║'
  echo '╚══════════════════════════════════════════════════╝'
  echo -e "${NC}"
}

# ── Main ──
show_banner

if [ -z "$1" ]; then
  echo -e "${YELLOW}Usage: bash vlc_timeout_bypass.sh <stream_url>${NC}"
  echo -e "${YELLOW}Example: bash vlc_timeout_bypass.sh http://192.168.1.100:8080/api/vlc-channel/1${NC}"
  echo ""
  echo -e "${CYAN}Options:${NC}"
  echo "  --config    Create VLC config only (no launch)"
  echo "  --detect    Detect VLC path only"
  echo ""
  if [ "$1" = "--config" ]; then
    create_vlc_config
    exit 0
  elif [ "$1" = "--detect" ]; then
    vlc_path=$(detect_vlc)
    if [ -n "$vlc_path" ]; then
      echo -e "${GREEN}[+] VLC found: $vlc_path${NC}"
    else
      echo -e "${RED}[!] VLC not found${NC}"
    fi
    exit 0
  fi
  exit 1
fi

launch_vlc "$1"