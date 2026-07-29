#!/bin/bash
cd /home/ghost
python3 -c 'import py_compile; py_compile.compile("claude-code-proxy/minimal_proxy.py", doraise=True)' && echo "SYNTAX_OK" || echo "SYNTAX_FAIL"
pm2 delete claude-proxy 2>/dev/null
pm2 start claude-code-proxy/minimal_proxy.py --name claude-proxy --cwd /home/ghost
sleep 5
pm2 list | grep claude-proxy
echo "---HEALTH---"
curl -s http://localhost:8082/health
echo ""
echo "---TEST_SIMPLE---"
curl -s -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":100,"messages":[{"role":"user","content":"Write a hello world in Python"}]}'
echo ""
echo "---TEST_TOOLS---"
curl -s -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":200,"messages":[{"role":"user","content":"Read the file /etc/hostname"}],"tools":[{"name":"read_file","description":"Read a file from disk","input_schema":{"type":"object","properties":{"path":{"type":"string","description":"File path to read"}},"required":["path"]}}]}'
echo ""
echo "---TEST_STREAM---"
curl -s -N -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":50,"stream":true,"messages":[{"role":"user","content":"Say hi"}]}' | head -20
echo ""
echo "---DONE---"