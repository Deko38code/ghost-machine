#!/usr/bin/env python3
import io, sys

P = "/home/ghost694/junkalot/src/components/UpdateToast.tsx"
src = io.open(P, encoding="utf-8").read()

def sub(old, new, label):
    global src
    if old not in src:
        sys.exit("FAIL anchor: " + label)
    src = src.replace(old, new, 1)

# 1. TV sizes + checklist class + a little inset from the screen edges on big screens
sub(
"""  '@media (min-width:1024px){.jl-ring{width:48px;height:48px}.jl-ring>span{font-size:18px}}'""",
"""  '@media (min-width:1024px){.jl-ring{width:48px;height:48px}.jl-ring>span{font-size:18px}}' +
  // 2026-11-20 (codex vision review, ten-foot): at 1920x1080 the 48 px ring and
  // 11.5 px checklist were too small from a couch, and the panel sat hard against
  // the screen edges. 64 px ring, 16 px checklist, 14 px inset from 1600 px up.
  '.jl-check{font-size:11.5px;line-height:1.7}' +
  '@media (min-width:1600px){.jl-ring{width:64px;height:64px}.jl-ring>span{font-size:24px}.jl-check{font-size:16px;line-height:1.6}}' +
  '@media (min-width:1024px){#junkalot-update-toast{right:14px !important;bottom:14px !important}}'""",
"css")

# 2. use the class instead of the inline font size
sub(
"""          <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.7 }} role="group" aria-label="Update checklist">""",
"""          <span className="jl-check" style={{ display: 'block' }} role="group" aria-label="Update checklist">""",
"checklist class")

io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED TV tuning")
