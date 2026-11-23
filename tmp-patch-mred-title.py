#!/usr/bin/env python3
import io, sys

path = "/home/ghost694/junkalot/src/app/api/admin/mred-bubble/route.ts"
with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

old = """    title: 'PhantomIDE',
    body: `Hi ${person} — this is your PhantomIDE desk. Mr Ed brings you anything the server needs you to see, and tells you here when mail arrives.`,"""
new = """    title: 'Mr Ed · messages from PhantomIDE',
    body: `Hi ${person} — this is your Junkalot desk, powered by PhantomIDE. Mr Ed brings you anything the server needs you to see, and tells you here when mail arrives.`,"""

if old not in src:
    sys.exit("FAIL: greeting block not found")

src = src.replace(old, new, 1)
with io.open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("PATCHED OK")
