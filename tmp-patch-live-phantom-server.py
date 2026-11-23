#!/usr/bin/env python3
import io, sys

REPO = "/home/ghost694/phantomide/phantom-server.js"
LIVE = "/home/ghost694/phantom-server.js"
START = "// Owner (2026-11-20): the owner's PhantomIDE dashboard shows how much work has"
END = "app.get('/api/admin/pending-payments', async (req, res) => {"

repo = io.open(REPO, encoding="utf-8").read()
live = io.open(LIVE, encoding="utf-8").read()

si = repo.find(START)
ei = repo.find(END)
if si < 0 or ei < 0 or ei <= si:
    sys.exit("FAIL: could not extract route from repo copy")
route = repo[si:ei]

if "junkalot-work" in live:
    print("SKIP: live already has the route")
    sys.exit(0)
if END not in live:
    sys.exit("FAIL: live anchor not found")

live = live.replace(END, route + END, 1)
io.open(LIVE, "w", encoding="utf-8").write(live)
print("PATCHED live server, route bytes:", len(route))
