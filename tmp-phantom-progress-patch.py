#!/usr/bin/env python3
"""Additive patch: PhantomIDE live server progress panel, both copies."""
import sys, shutil, time

BLOCK = open('/home/ghost694/phantom-progress-block.html', encoding='utf-8').read()
COPIES = [
    '/home/ghost694/phantom-ide.html',
    '/home/ghost694/phantomide/phantom-ide.html',
]

ok = True
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
for p in COPIES:
    src = open(p, encoding='utf-8').read()
    if 'id="phantom-progress-dock"' in src:
        print('SKIP already patched', p)
        continue
    idx = src.rfind('</body>')
    if idx == -1:
        print('FAIL no </body> in', p)
        ok = False
        continue
    bak = p + '.bak-phantomprogress-' + stamp
    shutil.copy2(p, bak)
    print('backup', bak)
    open(p, 'w', encoding='utf-8').write(src[:idx] + BLOCK + src[idx:])
    print('PATCHED', p)
sys.exit(0 if ok else 1)
