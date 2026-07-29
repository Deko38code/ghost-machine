# Claude Code Proxy → Ollama

## Overview
A FastAPI proxy that translates Anthropic Messages API format to Ollama chat format.
Enables Claude Code CLI to work with local Ollama models instead of paid API keys.

**Cost: $0.00** — no API keys needed, runs entirely on local models.

## Architecture
```
Claude Code TUI (with 15 MCP servers + 2000+ skills)
    ↓ Anthropic API format (HTTP)
localhost:8082 (proxy — translates format)
    ↓ Ollama chat format (HTTP)
localhost:11434 (Ollama — runs the model)
    ↓
glm-5.2:cloud / kimi-k2.7-code:cloud / glm-5.1:cloud
```

## File
- **Proxy**: `/home/ghost/claude-code-proxy/minimal_proxy.py`
- **Config**: `~/.claude/settings.json` (`ANTHROPIC_BASE_URL=http://localhost:8082`)

## Model Routing
| Claude Code Requests | Routes To (Ollama) |
|---|---|
| `claude-sonnet-4-5` | `glm-5.2:cloud` |
| `claude-opus-4-5` | `kimi-k2.7-code:cloud` |
| `claude-haiku-3-5` | `glm-5.1:cloud` |
| `gpt-4.1` | `glm-5.2:cloud` |
| `gpt-4.1-mini` | `glm-5.1:cloud` |
| `gemini-2.5-pro` | `kimi-k2.7-code:cloud` |
| `gemini-2.5-flash` | `glm-5.1:cloud` |

## Features
- ✅ **Tool use support** — converts Anthropic tool definitions to Ollama prompts, parses tool_use blocks back
- ✅ **Streaming (SSE)** — emits proper Anthropic SSE events
- ✅ **Tool results** — handles tool_result content blocks from Claude Code
- ✅ **System prompts** — passes system + tool prompts to Ollama
- ✅ **All 7 model mappings** — claude/gpt/gemini all route to Ollama

## Management
```bash
# Restart proxy
pm2 restart claude-proxy

# Check status
pm2 list | grep claude-proxy

# Health check
curl http://localhost:8082/health

# Test request
curl -s -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'
```

## MCP Servers (15)
1. filesystem
2. sequential-thinking
3. memory
4. playwright
5. nmap
6. sqlite
7. hermes
8. claude-code
9. codex
10. kiro
11. subagents
12. bounty-platforms
13. writeup-search
14. miniforge-bridge
15. serena

## Why It Works Without API Keys
The intelligence comes from the system, not just the model:
- 15 MCP servers provide filesystem, code analysis, web search, security scanning, etc.
- 2000+ skills handle domain-specific tasks
- The model (GLM-5.2) just needs to pick the right tool and interpret results
- Tools do the heavy lifting — the model is the conductor, not the orchestra

## History
- Original proxy had broken indentation (line 187 IndentationError)
- OPENAI_API_KEY was a JWT token, not a real sk- key
- No ANTHROPIC_API_KEY or GOOGLE_API_KEY on system
- Rewrote proxy from scratch as clean 200-line FastAPI server
- Routes everything to local Ollama instead of paid APIs
- No TUI restart needed — HTTP is stateless, proxy is hot-swappable

## Tradeoffs
| | Claude Sonnet 4.5 (paid) | GLM-5.2 + 15 MCPs (free) |
|---|---|---|
| Coding | Excellent | Good (tools compensate) |
| Reasoning | Deep | Decent (sequential-thinking MCP helps) |
| Complex tasks | Multi-step | Tools handle complexity |
| Cost | $3-15 per 1M tokens | $0.00 forever |
| Privacy | Data sent to Anthropic | 100% local |