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
---

# 🧠 Sonnet Brain System

## Overview
A multi-layer agent memory system that gives all AI agents on this machine shared persistent memory, active recall, and curated system snapshots. Inspired by Claude Code's memory features (CLAUDE.md, auto memory, path-scoped rules, `/context` inspect).

## 6 Layers (All Auto-Running via PM2 `sonnet-brain` daemon)

| Layer | What | Schedule | File |
|-------|------|----------|------|
| L1 Aggregation | Pulls from 5 memory sources → 4 agent brain files | Every 5 min | `fast_brain_bridge.py` |
| L2 Recall | BM25 search + dedup + project filtering | On-demand | `brain_recall.py` |
| L3 Injection | Node.js wrapper, `execFileSync`, null safety | On-demand | `brain_inject.js` |
| L4 Learning | Extracts lessons from corrections | Every 5 min | `cross_agent_teacher.py` |
| L5 Cross-Agent Teaching | Propagates lessons to all 4 agents | Every 5 min | `cross_agent_teacher.py --sync` |
| L6 Snapshots | System state capture + diff | Every 5 min | `curated_snapshot.py` |

## Claude Code Features Adopted

### 1. Path-Scoped Rules (`.brain-rules/`)
Each project has a `.brain-rules/rules.md` file with project-specific rules. The brain bridge reads all rule files and includes them in the brain output. During recall, entries can be tagged and filtered by project.

**Rule files:**
- `/home/ghost/cine-vault-live/.brain-rules/rules.md`
- `/home/ghost/haksterAi/.brain-rules/rules.md`
- `/home/ghost/miniforge/.brain-rules/rules.md`
- `/home/ghost/phantom/.brain-rules/rules.md`

**Project filtering:** `--project cinevault` boosts entries tagged `cinevault` by 30% per matching tag, penalizes non-matching entries by 30%.

### 2. `--inspect` Flag (like Claude Code's `/context`)
Shows exactly what memories would be injected — scores, sources, tags, token estimates — without modifying the prompt.

```bash
python3 brain_recall.py "port conflict 8084" --inspect
node brain_inject.js --prompt "port conflict 8084" --inspect
```

Output: table with # | Score | Source | Agent | Category | Tags | Text preview | ~Tokens

### 3. Hierarchical Brain Files (`.local-brain.md`)
Each project gets a `.local-brain.md` file with project-specific knowledge. When the brain bridge writes to each agent's brain file, it appends that project's local brain content.

**Local brain files:**
- `/home/ghost/cine-vault-live/.local-brain.md` (CineVault: TMDB, channels, streaming)
- `/home/ghost/haksterAi/.local-brain.md` (haksterAi: CLI, agents, proxy)
- `/home/ghost/miniforge/.local-brain.md` (Miniforge: bots, categories)
- `/home/ghost/phantom/.local-brain.md` (Phantom: IDE, workspace, AI providers)

## Curated Snapshots

### What it captures (in ~1.2s, zero parallelism):
- PM2 process list (names, statuses, PIDs)
- Listening ports (from `/proc/net/tcp` — no `ss` needed)
- Git status of 5 key repos (branch, dirty file count)
- Disk usage (from `os.statvfs`)
- RAM/swap (from `/proc/meminfo` — no `free` needed)
- Load average (from `/proc/loadavg`)
- MD5 checksums of 6 key files (change detection)

### Storage
- `/home/ghost/.shared/snapshots/snapshot_YYYYMMDD_HHMMSS.json`
- Auto-rotates: keeps last 288 snapshots (24h at 5-min intervals)
- Each snapshot ~2KB JSON

### Commands
```bash
python3 curated_snapshot.py                          # capture snapshot
python3 curated_snapshot.py --list                    # list recent snapshots
python3 curated_snapshot.py --diff <id1> <id2>        # diff two snapshots
python3 curated_snapshot.py --json                    # JSON output
python3 curated_snapshot.py --quiet                   # minimal output
```

### Speed Benefit
When something breaks, diff the last snapshot against a known-good one:
```
python3 curated_snapshot.py --diff 20260817_124945 20260817_120000
→ + Port 8084 opened
→ - PM2: sonnet-brain stopped
→ ~ File: brain_recall.py (modified)
→ ~ RAM: 34% → 51%
```
**1 tool call instead of 5** — instantly see what changed.

## Memory Sources (5)
1. **Shared Agent Bank** — `/home/ghost/.shared/agent-memory.json` (all agents read/write)
2. **Hakster Banks** — `/home/ghost/haksterAi/.hakster/memories/banks/{patterns,errors}.json`
3. **Hakster MEMORY.md** — `/home/ghost/haksterAi/.hakster/MEMORY.md`
4. **Phantom Knowledge** — `/home/ghost/phantom/phantom-knowledge.md`
5. **Claude Proxy Memories** — `/home/ghost/claude-code-proxy/memories/*.json`

## Brain Output Files (4 agents)
- `/home/ghost/haksterAi/.hakster/memory/shared_agent_brain.md`
- `/home/ghost/phantom/.phantom-shared-brain.md`
- `/home/ghost/miniforge/.miniforge-shared-brain.md`
- `/home/ghost/cine-vault-live/.cinevault-shared-brain.md`

Each file gets: global brain content + that project's `.local-brain.md` appended.

## PM2 Daemon
```bash
pm2 restart sonnet-brain    # restart after code changes
pm2 logs sonnet-brain       # view logs
# Runs: brain_full_stack.sh (5-min loop)
# Logs: /tmp/brain_bridge.log, /tmp/brain_teaching.log, /tmp/brain_snapshots.log
```

## Key Files
| File | Purpose |
|------|---------|
| `shared_memory.py` | Central memory store with tags, file locking, backup |
| `brain_recall.py` | BM25 active recall with project filtering + `--inspect` |
| `brain_inject.js` | Node.js wrapper for prompt injection |
| `fast_brain_bridge.py` | Aggregates 5 sources → 4 brain files |
| `curated_snapshot.py` | System state capture + diff |
| `brain_full_stack.sh` | PM2 daemon loop (5-min cycle) |
| `cross_agent_teacher.py` | Cross-agent lesson propagation |