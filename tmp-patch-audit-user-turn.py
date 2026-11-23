#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/lib/security-audit.ts"
src = io.open(P, encoding="utf-8").read()

OLD = """            model: provider.model,
            messages: [{ role: 'system', content: prompt }],"""
NEW = """            model: provider.model,
            // 2026-11-20: every HTTP provider was answering 400 ("No user query
            // found") because the request carried a system message and no user
            // turn. The model choice, provider order and limits are untouched —
            // only the missing user message is added so the audit can run at all.
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: 'Audit the metrics above and reply with the JSON report only.' },
            ],"""

if OLD not in src:
    sys.exit("FAIL anchor: messages")
src = src.replace(OLD, NEW, 1)

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED audit user turn")
