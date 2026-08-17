#!/bin/bash
# security_agent.sh Security assessment wrapper (v3: hackbots FIRST to eat credits)
# Usage: ./security_agent.sh <target-domain> [mode]
# Modes: quick, full, web, osint
# Priority: OSINT hackbot → web vuln hackbot (19k credits) → nmap → Codex → Ollama

TARGET="$1"
MODE="${2:-quick}"

if [ -z "$TARGET" ]; then
 echo "Usage: $0 <target-domain> [quick|full|web|osint]"
 echo "Example: $0 example.com full"
 exit 1
fi

echo "🛡️ SECURITY AGENT v3 (hackbots first → Codex → Ollama)"
echo "🎯 Target: $TARGET"
echo "📊 Mode: $MODE"
echo ""

# 1. OSINT via hackbot FIRST (eat credits)
if [ "$MODE" = "osint" ] || [ "$MODE" = "full" ]; then
 if curl -s --max-time 3 http://localhost:5555/api/health >/dev/null 2>&1; then
   echo "[hackbot] Running OSINT Framework Browser (credit pool)..."
   OSINT_RESP=$(curl -s --max-time 60 -X POST http://localhost:5555/api/chat \
     -H "Content-Type: application/json" \
     -d "{\"message\": \"Gather OSINT on: $TARGET. Categories: domains, IPs, emails, social, breach data.\"}" 2>&1)
   if [ -n "$OSINT_RESP" ]; then
     echo "$OSINT_RESP"
     echo ""
   fi
 fi
fi

# 2. Web vulnerability scan via hackbot (eat credits)
if [ "$MODE" = "web" ] || [ "$MODE" = "full" ] || [ "$MODE" = "quick" ]; then
 if curl -s --max-time 3 http://localhost:5555/api/health >/dev/null 2>&1; then
   echo "[hackbot] Running web vulnerability scanner (credit pool)..."
   VULN_RESP=$(curl -s --max-time 60 -X POST http://localhost:5555/api/chat \
     -H "Content-Type: application/json" \
     -d "{\"message\": \"Scan http://$TARGET for CVE, OWASP Top 10, CWE vulnerabilities. Detailed report.\"}" 2>&1)
   if [ -n "$VULN_RESP" ]; then
     echo "$VULN_RESP"
     echo ""
   fi
 fi
fi

# 3. nmap vulnerability scan (local, no credits)
if [ "$MODE" = "quick" ] || [ "$MODE" = "full" ]; then
 echo "[nmap] Running vulnerability scan..."
 nmap --script vuln -p 80,443,22,8080 "$TARGET" 2>&1
 echo ""
fi

# 4. Codex fallback (local proxy, no credits)
if command -v codex &>/dev/null; then
 echo "[codex] Fallback: security analysis with Codex..."
 CODEX_OUTPUT=$(timeout 60 codex exec "Security assessment of $TARGET. Mode: $MODE. Identify risks and remediation." 2>&1)
 if [ $? -eq 0 ] && [ -n "$CODEX_OUTPUT" ]; then
   echo "$CODEX_OUTPUT"
 fi
fi

# 5. Ollama last resort
if command -v ollama &>/dev/null; then
 echo "[ollama] Last resort: Ollama..."
 ollama run kimi-k2.7-code:cloud "Security assessment of $TARGET. Mode: $MODE. Identify attack surface, risks, remediation." 2>&1
fi

echo ""
echo "✅ Security assessment complete"