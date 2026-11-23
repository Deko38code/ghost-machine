#!/usr/bin/env python3
"""Additive patch: mount <JunkToastStack /> in the Junkalot root layout, both copies."""
import sys, shutil, time

COPIES = [
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot/src/app/layout.tsx',
    '/home/ghost694/junkalot/src/app/layout.tsx',
]

EDITS = [
    (
        "import UpdateToast from '@/components/UpdateToast'\n",
        "import UpdateToast from '@/components/UpdateToast'\n"
        "import JunkToastStack from '@/components/JunkToastStack'\n",
    ),
    (
        "          <UpdateToast />\n",
        "          <UpdateToast />\n"
        "          <JunkToastStack />\n",
    ),
]

def apply(path):
    src = open(path, encoding='utf-8').read()
    for i, (old, new) in enumerate(EDITS, 1):
        n = src.count(old)
        if n != 1:
            print(f'FAIL {path}: edit {i} matched {n} time(s)')
            return False
        src = src.replace(old, new)
    open(path, 'w', encoding='utf-8').write(src)
    print(f'PATCHED {path}')
    return True

ok = True
for p in COPIES:
    bak = p + '.bak-toaststack-mount-20261117T' + time.strftime('%H%M%SZ', time.gmtime())
    shutil.copy2(p, bak)
    print('backup', bak)
    ok = apply(p) and ok
sys.exit(0 if ok else 1)
