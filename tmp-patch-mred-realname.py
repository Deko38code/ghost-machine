#!/usr/bin/env python3
import io, sys

path = "/home/ghost694/junkalot/src/app/api/admin/mred-bubble/route.ts"
with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

old_decl = "const CLIENT_ACCOUNTS = new Set(['1junkalot@gmail.com', 'susanschlamp53@gmail.com'])"
new_decl = (
    "// Fallback first names, used only when the signed-in Google profile carries no name.\n"
    "const NAME_BY_EMAIL: Record<string, string> = {\n"
    "  '1junkalot@gmail.com': 'Susie',\n"
    "  'susanschlamp53@gmail.com': 'Susie',\n"
    "  'junkalotjunkremoval@gmail.com': 'Deke',\n"
    "  'dekekenneth840@gmail.com': 'Deke',\n"
    "  'kalilinuxneed@gmail.com': 'Deke',\n"
    "}"
)

old_person = "  const person = CLIENT_ACCOUNTS.has(email) ? 'Susie' : 'Deke'"
new_person = (
    "  // Greet whoever is signed in with the first name on their own account — never a\n"
    "  // hardcoded name that belongs to a different person.\n"
    "  const profileFirst = String(session?.user?.name || '').trim().split(/\\s+/)[0]\n"
    "  const person = profileFirst || NAME_BY_EMAIL[email] || 'there'"
)

if old_decl not in src:
    sys.exit("FAIL: declaration not found")
if old_person not in src:
    sys.exit("FAIL: person line not found")

src = src.replace(old_decl, new_decl, 1)
src = src.replace(old_person, new_person, 1)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("PATCHED OK")
