#!/usr/bin/env python3
"""Append-only brain entry (both Junkalot copies): card pinned bottom-right."""
import time

ENTRY = """

## 2026-11-17 — Update card pinned bottom-right

Owner: "it sends updates fine we just need to make card show in bottom right instead of top
middle". The live-feed wiring (toast service, haksterai admin, PhantomIDE panels) is already in
place and is not changed by this entry.

Change: `src/components/UpdateToast.tsx` in BOTH copies — the card's fixed position is now
`right: 16; bottom: 16; width: min(420px, calc(100vw - 32px))` at all times. Previously it was
top-centre and only moved to the bottom-right while an update was busy or done. The dock-to-chip
and dock-to-tab modes are untouched (the tab still sits `right: 0; bottom: 96`). Backups:
`UpdateToast.tsx.bak-bottomright-20261117T035838Z` in both trees.

Checks: `npx tsc --noEmit` exit 0 in both trees. Source-only — no build and no restart was run
(owner has barred server restarts without an explicit go-ahead). It reaches the live site on the
next `npm run build:update` (scripts/stage-update.mjs), which hands the service to systemd.
"""

for p in (
    '/home/ghost694/junkalot/docs/junkalot-brain-current.md',
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/docs/junkalot-brain-current.md',
):
    open(p, 'a', encoding='utf-8').write(ENTRY)
    print('APPENDED', p, time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
