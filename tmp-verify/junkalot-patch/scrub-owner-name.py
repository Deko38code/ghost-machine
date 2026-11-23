import io, os, hashlib, datetime, sys

ROOT = "/home/ghost694/junkalot"
STAMP = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

edits = {
    "src/app/admin/security/page.tsx": [
        (
            "{ cmd: 'email Deke', label: '📧 Send email to Deke' },",
            "{ cmd: 'email my developer', label: '📧 Email my developer' },",
            1,
        ),
        (
            "{ cmd: 'how do I give deke remote access to my computer to show me things?', label: 'remote access' },",
            "{ cmd: 'how do I give my developer remote access to my computer to show me things?', label: 'remote access' },",
            1,
        ),
        (
            "No sign-ins recorded yet — the next time Susie or deke signs in, the time shows up here.",
            "No sign-ins recorded yet — the next time you sign in, the time shows up here.",
            1,
        ),
        ("q.cmd === 'email Deke'", "q.cmd === 'email my developer'", 3),
        (
            "title={q.cmd === 'email my developer' ? 'Open the email form for Deke' : undefined}",
            "title={q.cmd === 'email my developer' ? 'Open the email form for your developer' : undefined}",
            1,
        ),
        (
            "aria-label={q.cmd === 'email my developer' ? 'Send email to Deke with the Coach' : undefined}",
            "aria-label={q.cmd === 'email my developer' ? 'Email your developer with the Coach' : undefined}",
            1,
        ),
        ("termSend('Email Deke\\nSubject: '", "termSend('Email my developer\\nSubject: '", 1),
        ('<h3 className="text-sm font-bold text-emerald-200">Email Deke</h3>',
         '<h3 className="text-sm font-bold text-emerald-200">Email your developer</h3>', 1),
        ('placeholder="What would you like Deke to know?"',
         'placeholder="What would you like your developer to know?"', 1),
    ],
    "src/app/admin/security/_PaymentsIntent.tsx": [
        ("// Nothing here turns payments on — card payments are not live until Deke connects Stripe.",
         "// Nothing here turns payments on — card payments are not live until PhantomIDE connects Stripe.", 1),
        ("Deke connects Stripe with you, runs one real test payment",
         "PhantomIDE connects Stripe with you, runs one real test payment", 1),
        ("Deke will set Stripe up with you and run one real test",
         "PhantomIDE will set Stripe up with you and run one real test", 1),
    ],
    "src/app/admin/components/AdminInvoiceLinks.tsx": [
        ('sub="Deke Needem · Owner"', 'sub="PhantomIDE · Server care"', 1),
    ],
    "src/app/api/ai-terminal/route.ts": [
        (
            "dekekenneth840@gmail.com is Deke. Keep Deke’s tests separate from Susie’s learning and saved records.",
            "dekekenneth840@gmail.com is Deke. Keep Deke’s tests separate from Susie’s learning and saved records. When you speak to Susie, never use the developer’s name — call him “your developer”. Use his name only when the signed-in account is his own.",
            1,
        ),
        (
            "const ownerEmailPrompt = 'To email Deke, reply exactly in this format:'",
            "const ownerEmailPrompt = 'To email your developer, reply exactly in this format:'",
            1,
        ),
        (
            "content = 'Yes, I can email Deke for you. What subject and message should I send?\\n\\n'",
            "content = 'Yes, I can email your developer for you. What subject and message should I send?\\n\\n'",
            1,
        ),
        (
            "'Sure, what subject and message should I send to Deke?\\n\\n'",
            "'Sure, what subject and message should I send to your developer?\\n\\n'",
            1,
        ),
        ("the “Send email to Deke” button", "the “Email my developer” button", 1),
        ('with the "Send email to Deke" button', 'with the "Email my developer" button', 1),
        ('Offer the "Send email to Deke" button', 'Offer the "Email my developer" button', 1),
    ],
}

fail = False
for rel, pairs in edits.items():
    path = os.path.join(ROOT, rel)
    with io.open(path, "r", encoding="utf-8") as f:
        text = f.read()
    original = text
    for old, new, count in pairs:
        got = text.count(old)
        if got != count:
            print("MISS %s: expected %d, found %d -> %r" % (rel, count, got, old[:70]))
            fail = True
            continue
        text = text.replace(old, new)
    if text == original:
        continue
    backup = path + ".bak-" + STAMP
    with io.open(backup, "w", encoding="utf-8") as f:
        f.write(original)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(text)
    def sha(p):
        h = hashlib.sha256()
        with open(p, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    print("PATCHED", rel)
    print("  before", sha(backup))
    print("  after ", sha(path))

if fail:
    sys.exit(1)
print("OK")
