#!/usr/bin/env python3
"""Additive ingress rules: /ws/ on junkalot.co + www.junkalot.co -> 127.0.0.1:3001.

Path rules are inserted BEFORE the existing hostname-only rules so they win.
Byte-identical timestamped backup first; anchored matches only; idempotent.
Run: python3 /home/ghost694/cf-junkalot-ws.py
"""
import hashlib, shutil, sys, time

CFG = '/home/ghost694/.cloudflared/config.yml'

src = open(CFG, encoding='utf-8').read()
if 'path: ^/ws/' in src:
    print('already applied — nothing written')
    sys.exit(0)

bak = CFG + '.bak-junkalot-ws-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
shutil.copy2(CFG, bak)
print('backup', bak)
print('sha256 before', hashlib.sha256(src.encode()).hexdigest())

RULES = [
    (
        "  - hostname: junkalot.co\n    service: http://127.0.0.1:5006\n",
        "  - hostname: junkalot.co\n"
        "    path: ^/ws/\n"
        "    service: http://127.0.0.1:3001\n"
        "  - hostname: junkalot.co\n    service: http://127.0.0.1:5006\n",
    ),
    (
        "  - hostname: www.junkalot.co\n    service: http://127.0.0.1:5006\n",
        "  - hostname: www.junkalot.co\n"
        "    path: ^/ws/\n"
        "    service: http://127.0.0.1:3001\n"
        "  - hostname: www.junkalot.co\n    service: http://127.0.0.1:5006\n",
    ),
]

for old, new in RULES:
    n = src.count(old)
    if n != 1:
        print(f'FAIL anchored block matched {n} time(s) — nothing written')
        sys.exit(1)
    src = src.replace(old, new)

open(CFG, 'w', encoding='utf-8').write(src)
print('patched', CFG)
print('sha256 after ', hashlib.sha256(src.encode()).hexdigest())
