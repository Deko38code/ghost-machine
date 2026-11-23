#!/usr/bin/env python3
"""UpdateToast card: always bottom-right (was top-centre except while busy)."""
import shutil, sys, time

COPIES = [
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/src/components/UpdateToast.tsx',
    '/home/ghost694/junkalot/src/components/UpdateToast.tsx',
]

OLD = """        position: 'fixed',
        // 2026-11-17 (owner): "if update is starting it shows but make to right
        // bottom" — while the bar runs the card parks in the bottom-right corner.
        ...(busy || phase === 'done'
          ? { right: 16, bottom: 16, width: 'min(420px, calc(100vw - 32px))' }
          : { top: 14, left: '50%', transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 28px))' }),
        zIndex: 90,
"""

NEW = """        position: 'fixed',
        // 2026-11-17 (owner): "we just need to make card show in bottom right
        // instead of top middle" — the card sits in the bottom-right corner at
        // all times, not only while an update is running.
        right: 16,
        bottom: 16,
        width: 'min(420px, calc(100vw - 32px))',
        zIndex: 90,
"""

ok = True
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
for p in COPIES:
    src = open(p, encoding='utf-8').read()
    n = src.count(OLD)
    if n != 1:
        print(f'FAIL {p}: anchor matched {n} time(s)')
        ok = False
        continue
    bak = p + '.bak-bottomright-' + stamp
    shutil.copy2(p, bak)
    open(p, 'w', encoding='utf-8').write(src.replace(OLD, NEW))
    print(f'PATCHED {p} (backup {bak})')
sys.exit(0 if ok else 1)
