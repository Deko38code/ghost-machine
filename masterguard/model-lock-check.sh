#!/bin/bash
# PhantomIDE model configuration lock — read-only verifier.
#
# Checks that the Phantom Flash config is EXACTLY the pinned values, on this box and
# (with --remote) on the Parrot service. It never changes anything: drift is
# reported, never auto-corrected (§2/§11 — no silent config changes).
#
#   ./model-lock-check.sh              # local CLI env + relay
#   ./model-lock-check.sh --remote     # also the free-lanes service on Parrot
#
# Exit 0 = locked and matching · 1 = drift found · 2 = cannot verify.
set -u
LOCK=/home/ghost/masterguard/model-lock.json
[ -r "$LOCK" ] || { echo "BLOCKED: lock file unreadable: $LOCK"; exit 2; }

read_field() { node -e "const l=require('$LOCK');const k='$1'.split('.').reduce((o,p)=>o&&o[p],l);process.stdout.write(String(k===undefined?'':k))"; }

PUB=$(read_field public_name)
WIRE=$(read_field wire_model)
RELAY=$(read_field relay)
BAD=0

echo "model lock — name: $PUB   wire: $WIRE   relay: $RELAY"
echo

# 1) CLI environment, if this shell carries it
echo "CLI env:"
for k in ANTHROPIC_BASE_URL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL CLAUDE_CODE_AUTO_COMPACT_WINDOW; do
  want=$(read_field "cli_env.$k")
  got="${!k-<unset>}"
  if [ "$got" = "$want" ]; then
    echo "  OK     $k = $got"
  elif [ "$got" = "<unset>" ]; then
    echo "  WARN   $k unset in this shell (value outside a CLI session is expected)"
  else
    echo "  DRIFT  $k = $got   expected $want"
    BAD=1
  fi
done
echo

# 2) the relay must still answer with that exact model
echo "Relay $RELAY:"
if curl -s --max-time 6 "$RELAY/v1/models" | grep -q "\"$WIRE\""; then
  echo "  OK     $WIRE is offered"
else
  echo "  DRIFT  $WIRE not listed by the relay (may be a cloud lane not in local tags — probing)"
  R=$(curl -s --max-time 30 -X POST "$RELAY/v1/messages" -H 'content-type: application/json' \
      -d "{\"model\":\"$WIRE\",\"max_tokens\":8,\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}]}" 2>/dev/null)
  case "$R" in
    *'"type":"message"'*) echo "  OK     $WIRE answered a live probe" ;;
    *) echo "  DRIFT  $WIRE did not answer: ${R:0:120}"; BAD=1 ;;
  esac
fi
echo

# 3) the service must publish our name over that same lane
if [ "${1-}" = "--remote" ]; then
  HOST_=$(read_field service.host)
  echo "Service on $HOST_:"
  H=$(timeout 20 ssh -o BatchMode=yes -o ConnectTimeout=8 "ghost694@$HOST_" 'curl -s --max-time 5 http://127.0.0.1:4199/health' < /dev/null 2>/dev/null)
  if [ -z "$H" ]; then
    echo "  DRIFT  no health response"; BAD=1
  else
    for pair in "model:$(read_field service.expect_model)" "lane:$(read_field service.expect_lane)" "upstream:$(read_field service.expect_upstream)"; do
      k=${pair%%:*}; want=${pair#*:}
      got=$(printf '%s' "$H" | grep -o "\"$k\":\"[^\"]*\"" | head -1 | sed 's/.*:"//; s/"$//')
      if [ "$got" = "$want" ]; then echo "  OK     $k = $got"; else echo "  DRIFT  $k = $got  expected $want"; BAD=1; fi
    done
  fi
  echo
fi

if [ "$BAD" = "0" ]; then echo "RESULT: LOCKED — config matches, nothing altered."; exit 0; fi
echo "RESULT: DRIFT — report this to the owner; nothing was changed automatically."
exit 1
