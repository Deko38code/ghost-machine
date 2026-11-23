#!/bin/bash
# Free Lanes verification — prints statuses, never prints a raw key.
set -u
B=http://127.0.0.1:4199
D=/home/ghost694/free-lanes-data

echo "1) no key, anthropic:";   curl -s -o /dev/null -w "   %{http_code}\n" -X POST $B/v1/messages -H 'content-type: application/json' -d '{"max_tokens":8,"messages":[{"role":"user","content":"hi"}]}'
echo "2) no key, openai:";      curl -s -o /dev/null -w "   %{http_code}\n" -X POST $B/v1/chat/completions -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}'
echo "3) admin disabled:";      curl -s -o /dev/null -w "   %{http_code}\n" -X POST $B/admin/keys -H 'content-type: application/json' -d '{}'

KEY=$(DATA_DIR=$D node /home/ghost694/free-lanes-server.js --issue "verify-$(date +%H%M%S)" 2>/dev/null | awk '{print $NF}')
if [ -z "$KEY" ] || [ "${KEY:0:3}" != "pi_" ]; then echo "ISSUE FAILED"; exit 1; fi
echo "4) issued key prefix: ${KEY:0:11}…"

echo "5) openai non-stream:"
curl -s --max-time 60 -X POST $B/v1/chat/completions -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"system","content":"be terse"},{"role":"user","content":"reply with exactly: LANE OK"}],"max_tokens":40}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("   model:",j.model,"| finish:",j.choices[0].finish_reason,"| text:",JSON.stringify(String(j.choices[0].message.content).trim().slice(0,60)),"| usage:",JSON.stringify(j.usage))})'

echo "6) anthropic non-stream:"
curl -s --max-time 60 -X POST $B/v1/messages -H "x-api-key: $KEY" -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' \
  -d '{"model":"claude-sonnet-5-5","max_tokens":40,"messages":[{"role":"user","content":"reply with exactly: LANE OK"}]}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const t=(j.content||[]).map(b=>b.type+":"+(b.text||b.thinking||"").slice(0,40)).join(" | ");console.log("   type:",j.type,"| model:",j.model,"| stop:",j.stop_reason,"| blocks:",t,"| usage:",JSON.stringify(j.usage))})'

echo "7) model pin (asks for a different lane):"
curl -s --max-time 20 -o /tmp/pin.json -w "   http %{http_code} " -X POST $B/v1/chat/completions -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"model":"glm-5.3-flash:cloud","messages":[{"role":"user","content":"hi"}]}'; node -e 'const j=require("/tmp/pin.json");console.log("|",(j.error&&j.error.message)||JSON.stringify(j).slice(0,80))'; rm -f /tmp/pin.json

echo "8) anthropic stream:"
curl -s --max-time 60 -N -X POST $B/v1/messages -H "x-api-key: $KEY" -H 'content-type: application/json' \
  -d '{"model":"deepseek-v4.1-flash:cloud","max_tokens":40,"stream":true,"messages":[{"role":"user","content":"count 1 2 3"}]}' \
  | head -c 1200 | tr -d '\r' | grep -E '^(event|data: \{"type":"(content_block_delta|message_stop|message_delta))' | head -8 | sed 's/^/   /'

echo "9) openai stream:"
curl -s --max-time 60 -N -X POST $B/v1/chat/completions -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"stream":true,"max_tokens":40,"messages":[{"role":"user","content":"count 1 2 3"}]}' \
  | tail -4 | tr -d '\r' | sed 's/^/   /'

echo "10) usage:"
curl -s --max-time 10 $B/usage -H "authorization: Bearer $KEY" | sed 's/^/   /'
echo
echo "11) ledger tail:"
tail -3 $D/usage.jsonl | sed 's/^/   /'
echo "12) key list:"
DATA_DIR=$D node /home/ghost694/free-lanes-server.js --list | tail -3 | sed 's/^/   /'
