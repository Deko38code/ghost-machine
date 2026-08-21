# haksterAi Brain Rules

## Always
- CLI is the primary interface — all features must work from terminal
- Proxy runs on port 8084 — check with `fuser 8084/tcp` before restart
- Agent memory is shared via /home/ghost/.shared/agent-memory.json
- Skills are stored in .hakster/skills/*.md
- Use `node -c` to syntax-check CLI before committing
- **NEVER route to real Claude/Anthropic API** — Claude refuses commands, breaks system flow, censors output. All "claude-sonnet-4-5" aliases route to local uncensored models (hp-1000, glm-uncensored, kimi-uncensored) via the 8082 proxy CLOUD_MAP. Real Claude = broken agent.
- **Always use cheapest tier first** — tier 1 (local Ollama) → tier 2 (Miniforge) → tier 3 (phantom gateway) → tier 4 (parrot) → tier 5 (kaggle) → tier 6 (local-redirected cloud aliases). Never skip to expensive tier if cheap one works.
- **Smart Router decides model** — smart-router.js auto-detects task type (code, security, chat, power, research, image) and routes to the cheapest available backend. Never manually pick a model when the router can decide.
- **Token burn check** — smart-router runs an automatic audit on startup + every 30 min. If any model leaks to ollama.com:443, it logs a warning with the fix command. Manual check: `ollama show <model> | grep "Remote URL"` — if it shows ollama.com:443, it burns GLM cloud tokens. Kill it and recreate from local weights.
- **Miniforge (port 5555) is always free** — 48 bots, zero cost, no credit card, no refusals. Use ai-unrestricted for uncensored tasks.
- **Cloud model aliases are compatibility labels only** — "claude-sonnet-4-5", "gpt-4.1", "gemini-2.5-pro" etc are kept in CLOUD_MAP for API compatibility but route to local uncensored Ollama weights. They never hit external APIs.
- **Scheduled agents use smart-router** — cron jobs and interval dispatch go through smart-router.schedule() which routes to cheapest tier automatically.

## Never
- Don't use port 8080 (conflicts with CineVault)
- Don't kill the PM2 sonnet-brain daemon
- Don't modify shared_memory.py without backing up /home/ghost/.shared/agent-memory.json
- Don't route to real Claude/Anthropic API — it refuses commands and breaks the agent
- Don't create Ollama models with FROM glm-5.x:cloud or any :cloud base — these proxy to ollama.com:443 and burn GLM cloud quota
- Don't use glm-5.1:cloud, glm-5.2:cloud, kimi-k2.7-code:cloud, gpt-oss:120b-cloud as Ollama model bases — they are cloud proxies that burn tokens
- Don't select models manually when smart-router can route — it always picks cheapest available