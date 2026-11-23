#!/usr/bin/env python3
"""Additive patch: JunkProgress component + layout mount in both Junkalot copies."""
import sys, shutil, time

COPIES = [
    '/home/ghost694/workspace/dekekenneth840@gmail.com/junkalot',
    '/home/ghost694/junkalot',
]

def patch_layout(path):
    old = "import JunkToastStack from '@/components/JunkToastStack'\n"
    new = ("import JunkToastStack from '@/components/JunkToastStack'\n"
           "import JunkProgress from '@/components/JunkProgress'\n")
    old2 = "          <JunkToastStack />\n"
    new2 = "          <JunkToastStack />\n          <JunkProgress />\n"
    src = open(path, encoding='utf-8').read()
    for i, (o, n) in enumerate(((old, new), (old2, new2)), 1):
        c = src.count(o)
        if c != 1:
            print(f'FAIL {path}: edit {i} matched {c} time(s)')
            return False
        src = src.replace(o, n)
    open(path, 'w', encoding='utf-8').write(src)
    print('PATCHED', path)
    return True

ok = True
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
for root in COPIES:
    svc = root + '/scripts/toast-service.js'
    shutil.copy2(svc, svc + '.bak-progress-' + stamp)
    shutil.copyfile('/home/ghost694/toast-service.cjs', svc)
    print('service', svc)
    shutil.copyfile('/home/ghost694/JunkProgress.tsx', root + '/src/components/JunkProgress.tsx')
    lay = root + '/src/app/layout.tsx'
    shutil.copy2(lay, lay + '.bak-progress-mount-' + stamp)
    ok = patch_layout(lay) and ok
sys.exit(0 if ok else 1)
