#!/usr/bin/env python3
"""Revert the deepseek-cloud-2 provider from Junkalot's Mr Ed chain.

Owner 2026-11-21: "keep 1 we been using and new for the other 2" - the second
Ollama Cloud account belongs to haksterai.com and phantomide, not junkalot.co.
Exact-match removal: aborts unless the block appears exactly once.
"""
import datetime
import io
import sys

PATH = "/home/ghost694/junkalot/src/app/api/ai-terminal/route.ts"
STAMP = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

BLOCK = """  // Second Ollama Cloud account (its own fresh quota). Tried only after the peer
  // route above fails or runs out, so the cheap model keeps answering instead of
  // the reply jumping to a hosted or pricier fallback.
  if (process.env.OLLAMA_CLOUD_KEY_2) providers.push({ name: 'deepseek-cloud-2', url: 'https://ollama.com/v1/chat/completions', key: process.env.OLLAMA_CLOUD_KEY_2, model: process.env.OLLAMA_CLOUD_MODEL_2 || 'deepseek-v4.1-flash:cloud' })
"""

text = io.open(PATH, encoding="utf-8").read()
if text.count(BLOCK) != 1:
    print("ABORT: block found %d times" % text.count(BLOCK))
    sys.exit(1)
backup = PATH + ".bak-revert-cloud2-" + STAMP
io.open(backup, "w", encoding="utf-8").write(text)
out = text.replace(BLOCK, "")
io.open(PATH, "w", encoding="utf-8").write(out)
print("REVERTED", PATH)
print("BACKUP", backup)
print("providers:", out.count("providers.push("), "deepseek-cloud-2 present:", "deepseek-cloud-2" in out)
