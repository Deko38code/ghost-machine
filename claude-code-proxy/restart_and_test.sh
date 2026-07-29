#!/bin/bash
pm2 delete claude-proxy 2>/dev/null
pm2 start /home/ghost/claude-code-proxy/minimal_proxy.py --name claude-proxy --cwd /home/ghost
sleep 5
pm2 list | grep claude-proxy
echo "---TEST---"
curl -s -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":50,"messages":[{"role":"user","content":"Say hello in 5 words"}]}'
echo ""
echo "---DONE---"