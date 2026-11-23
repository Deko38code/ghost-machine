import io, os, datetime, sys

ROOT = "/home/ghost/haksterAi"
STAMP = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")

OLD = """          <a href="/"><img src="/logo-192.png" alt="haksterAi" /></a>
          <a href="/"><span>hakster<span class="ai">Ai</span></span></a>"""
NEW = """          <a href="/"><img src="/logo-192.png" alt="haksterAi" /></a>
          <a href="/" style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.05"><span>hakster<span class="ai">Ai</span></span><span style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#64748b">a part of PhantomIDE</span></a>"""

patches = {
    "src/pages/hack.astro": [(OLD, NEW, 1)],
    "src/pages/terminal.astro": [(OLD, NEW, 1)],
    "src/pages/hakterm.astro": [(OLD, NEW, 1)],
    "src/pages/admin/license.astro": [(
        '<span>HaksterAI</span>\n          <span class="badge">Owner record · client copy supplied on request</span>',
        '<span>HaksterAI</span>\n          <span class="badge">a part of PhantomIDE</span>\n          <span class="badge">Owner record · client copy supplied on request</span>',
        1)],
}

for rel, pairs in patches.items():
    path = os.path.join(ROOT, rel)
    text = io.open(path, encoding="utf-8").read()
    original = text
    for old, new, count in pairs:
        got = text.count(old)
        if got != count:
            print("MISS %s: expected %d, found %d" % (rel, count, got))
            sys.exit(1)
        text = text.replace(old, new)
    backup = path + ".bak-brand-line-" + STAMP
    io.open(backup, "w", encoding="utf-8").write(original)
    io.open(path, "w", encoding="utf-8").write(text)
    print("PATCHED", rel)
print("OK")
