#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/components/UpdateToast.tsx"
src = io.open(P, encoding="utf-8").read()

pairs = [
    ("    const id = window.setInterval(() => { if (!document.hidden) force((n) => n + 1) }, 1000)",
     "    // 100 ms ticks with a tenths value: the 2 s poll no longer snaps the clock\n    // between 2s and 0s (codex review 2026-11-20).\n    const id = window.setInterval(() => { if (!document.hidden) force((n) => n + 1) }, 100)"),
    ("  const left = Math.max(0, Math.ceil((POLL_MS - (Date.now() - lastPollAt)) / 1000))\n  return <>next check in {left}s</>",
     "  const left = Math.max(0, (POLL_MS - (Date.now() - lastPollAt)) / 1000)\n  return <>next check in {left.toFixed(1)}s</>"),
    ("// Time to the next version check, straight from the poll's own timestamp (2 s cadence).",
     "  // Time to the next version check, straight from the poll's own timestamp (2 s cadence), shown to a tenth so it eases down instead of flickering."),
]

for i, (old, new) in enumerate(pairs):
    if old not in src:
        sys.exit("FAIL anchor %d" % i)
    src = src.replace(old, new, 1)

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED UpdateToast")
