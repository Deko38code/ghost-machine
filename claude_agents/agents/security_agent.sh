#!/bin/bash
# security_agent.sh — Security assessment wrapper
# Usage: ./security_agent.sh <target-domain> [mode]
# Modes: quick (default), full, web
# Runs targeted security checks based on mode

TARGET="$1"
MODE="${2:-quick}"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 <target-domain> [quick|full|web]"
  echo "Example: $0 example.com full"
  exit 1
fi

TARGET=$(echo "$TARGET" | sed 's|https\?://||' | sed 's|/.*||')

echo "╔══════════════════════════════════════╗"
echo "║  SECURITY AGENT — $TARGET ($MODE)"
echo "╚══════════════════════════════════════╝"
echo ""

OUTPUT_DIR="/tmp/sec_${TARGET}_$(date +%s)"
mkdir -p "$OUTPUT_DIR"

case "$MODE" in
  quick)
    echo "[quick] Fast port scan + service detection..."
    nmap -sS -T4 -F --version-light -oN "$OUTPUT_DIR/quick_scan.txt" "$TARGET" 2>/dev/null
    cat "$OUTPUT_DIR/quick_scan.txt"
    ;;
  full)
    echo "[full] Comprehensive scan..."
    echo "  [1/3] Full port range..."
    nmap -sS -T4 -p- --min-rate 1000 -oN "$OUTPUT_DIR/all_ports.txt" "$TARGET" 2>/dev/null
    echo "  [2/3] Service + OS detection..."
    OPEN=$(grep -oP '^\d+/open' "$OUTPUT_DIR/all_ports.txt" | cut -d/ -f1 | tr '\n' ',' | sed 's/,$//')
    if [ -n "$OPEN" ]; then
      nmap -sV -sC -O -p "$OPEN" -oN "$OUTPUT_DIR/full_services.txt" "$TARGET" 2>/dev/null
    fi
    echo "  [3/3] Vulnerability scripts..."
    if [ -n "$OPEN" ]; then
      nmap --script vuln -p "$OPEN" -oN "$OUTPUT_DIR/vulns.txt" "$TARGET" 2>/dev/null
    fi
    echo "  → All results in $OUTPUT_DIR/"
    ;;
  web)
    echo "[web] Web-focused security scan..."
    echo "  [1/2] Nikto web scanner..."
    nikto -h "$TARGET" -o "$OUTPUT_DIR/nikto.txt" 2>/dev/null
    echo "  [2/2] Directory brute-force (common)..."
    if command -v ffuf &>/dev/null; then
      ffuf -u "https://$TARGET/FUZZ" -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302,403 -o "$OUTPUT_DIR/ffuf.json" 2>/dev/null
    elif command -v gobuster &>/dev/null; then
      gobuster dir -u "https://$TARGET" -w /usr/share/wordlists/dirb/common.txt -o "$OUTPUT_DIR/gobuster.txt" 2>/dev/null
    else
      echo "  → ffuf/gobuster not installed, skipping"
    fi
    echo "  → Results in $OUTPUT_DIR/"
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: $0 <target> [quick|full|web]"
    exit 1
    ;;
esac

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  SECURITY AGENT — COMPLETE"
echo "╚══════════════════════════════════════╝"