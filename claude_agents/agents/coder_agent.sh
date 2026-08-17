#!/bin/bash
# coder_agent.sh — Coding assistant wrapper
# Usage: ./coder_agent.sh <task> [file]
# Delegates coding tasks to the best available AI coding agent
# Priority: Codex (GPT-5.x) → Crush → Claude Code → Ollama (local)

TASK="$1"
FILE="${2:-.}"

if [ -z "$TASK" ]; then
  echo "Usage: $0 <task-description> [file-or-dir]"
  echo "Example: $0 'Fix the auth bug in login.js' /path/to/project"
  exit 1
fi

echo "╔══════════════════════════════════════╗"
echo "║  CODER AGENT"
echo "║  Task: $TASK"
echo "║  Target: $FILE"
echo "╚══════════════════════════════════════╝"
echo ""

# Try Codex first (strongest for complex coding)
if command -v codex &>/dev/null; then
  echo "[coder] Using Codex (GPT-5.x)..."
  codex --quiet --approval-policy never "$TASK" 2>&1
  exit $?
fi

# Fall back to Crush
if command -v crush &>/dev/null; then
  echo "[coder] Using Crush..."
  crush run --quiet "$TASK" 2>&1
  exit $?
fi

# Fall back to Claude Code
if command -v claude &>/dev/null; then
  echo "[coder] Using Claude Code..."
  echo "$TASK" | claude --print 2>&1
  exit $?
fi

# Last resort: Ollama local model
if command -v ollama &>/dev/null; then
  echo "[coder] Using Ollama (qwen2.5-coder)..."
  ollama run qwen2.5-coder "$TASK" 2>&1
  exit $?
fi

echo "[coder] No coding agents available!"
exit 1