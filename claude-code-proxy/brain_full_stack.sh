#!/bin/bash
# Sonnet Brain Full Stack — PM2-managed loop
# Runs all layers every 5 minutes
cd /home/ghost/claude-code-proxy

while true; do
 # Layer 1: Aggregate all memories into brain file
 python3 fast_brain_bridge.py >> /tmp/brain_bridge.log 2>&1

 # Layer 5: Cross-agent teaching — propagate new lessons
 python3 cross_agent_teacher.py --sync >> /tmp/brain_teaching.log 2>&1

 # Layer 6: Curated system snapshot (auto-capture every 5 min)
 python3 curated_snapshot.py --quiet >> /tmp/brain_snapshots.log 2>&1

 # Keep only last 288 snapshots (24h at 5min intervals)
 ls -1t /home/ghost/.shared/snapshots/snapshot_*.json 2>/dev/null | tail -n +289 | xargs rm -f 2>/dev/null

 sleep 300
done