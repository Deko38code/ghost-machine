#!/bin/bash
# coder_agent.sh Coding assistant wrapper (v4: hackbots FIRST to eat credits, Codex/Ollama fallback)
# Usage: ./coder_agent.sh <task> [file]
# Priority: Miniforge hack-coder (19k credits) → Codex → Ollama → Crush

TASK="$1"
FILE="${2:-.}"

if [ -z "$TASK" ]; then
 echo "Usage: $0 <task-description> [file-or-dir]"
 echo "Example: $0 'Fix the auth bug in login.js' /path/to/project"
 exit 1
fi

echo "🔧 CODER AGENT v4 (hackbots first → Codex → Ollama)"
echo "📋 Task: $TASK"
echo "📁 Target: $FILE"
echo ""

# 1. Miniforge hack-coder bot FIRST (eat the 19k credits pool)
if curl -s --max-time 3 http://localhost:5555/api/health >/dev/null 2>&1; then
 echo "[coder] Using Miniforge hack-coder (credit pool)..."
 if [ -f "$FILE" ]; then
   FILE_CONTENT=$(cat "$FILE" 2>/dev/null | head -500)
   HACK_RESP=$(curl -s --max-time 60 -X POST http://localhost:5555/api/chat \
     -H "Content-Type: application/json" \
     -d "{\"message\": \"CODING TASK: $TASK. File content: $FILE_CONTENT\"}" 2>&1)
 else
   HACK_RESP=$(curl -s --max-time 60 -X POST http://localhost:5555/api/chat \
     -H "Content-Type: application/json" \
     -d "{\"message\": \"CODING TASK: $TASK\"}" 2>&1)
 fi
 if [ -n "$HACK_RESP" ] && echo "$HACK_RESP" | grep -qv "error"; then
   echo "$HACK_RESP"
   echo ""
   echo "✅ Hackbot completed the task"
   exit 0
 fi
 echo "[coder] Hackbot failed, falling through..."
fi

# 2. Codex CLI fallback (local proxy, no credits used)
if command -v codex &>/dev/null; then
 echo "[coder] Fallback: Codex CLI..."
 CODEX_OUTPUT=$(timeout 60 codex exec "$TASK" 2>&1)
 if [ $? -eq 0 ] && [ -n "$CODEX_OUTPUT" ]; then
   echo "$CODEX_OUTPUT"
   exit 0
 fi
 echo "[coder] Codex failed, falling through..."
fi

# 3. Ollama fallback (local, free)
if command -v ollama &>/dev/null; then
 echo "[coder] Fallback: Ollama..."
 if [ -f "$FILE" ]; then
   FILE_CONTENT=$(cat "$FILE" 2>/dev/null | head -500)
   ollama run kimi-k2.7-code:cloud "You are a coding assistant. Task: $TASK. File content: $FILE_CONTENT" 2>&1
 else
   ollama run kimi-k2.7-code:cloud "You are a coding assistant. Task: $TASK" 2>&1
 fi
 exit $?
fi

# 4. Final fallback: Crush
if command -v crush &>/dev/null; then
 echo "[coder] Last resort: Crush..."
 crush "$TASK" 2>&1
 exit $?
fi

echo "❌ All coding backends failed"
exit 1