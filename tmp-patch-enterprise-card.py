import io, sys, shutil
P = "/home/ghost/haksterAi/server/src/index.js"
shutil.copyfile(P, P + ".bak-enterprise-card-20261121Z")
src = io.open(P, encoding="utf-8").read()
old = """    description: 'Team access, admin controls, and custom deployment support.',
    features: ['Team seats', 'Higher limits', 'Admin dashboard', 'Priority support'],"""
new = """    // Owner 2026-11-21: no paid plan includes the admin dashboard — it is
    // owner-gated behind the admin pin pad — so the card must not sell it.
    description: 'Team access, higher limits, and custom deployment support.',
    features: ['Team seats', 'Higher limits', 'Priority support'],"""
if old not in src:
    sys.exit("FAIL anchor")
io.open(P, "w", encoding="utf-8").write(src.replace(old, new, 1))
print("PATCHED", P)
