import json, io, datetime, os

root = "/home/ghost694/junkalot"
now = datetime.datetime.utcnow()
build = "o32lkDZFawx2Fj5VaiPxQ"
entry = {
    "date": now.strftime("%Y-%m-%d"),
    "time_utc": now.strftime("%H:%M:%S"),
    "project": "junkalot.co",
    "kind": "fix",
    "title": (
        "Susie's admin no longer carries the developer's name: the security quick action is "
        "'Email my developer' (composer heading, placeholder and aria labels included), the "
        "payments-intent copy and the invoice pill say PhantomIDE / your developer, the remote-access "
        "quick action and sign-in empty state no longer name the developer, and Mr Ed is told to call "
        "him 'your developer' when speaking to Susie while still addressing him as Deke on his own account"
    ),
    "builds": [build],
    "verified": "live",
}

jsonl = os.path.join(root, "data/invoice-worklog.jsonl")
with io.open(jsonl, "a", encoding="utf-8") as f:
    f.write(json.dumps(entry) + "\n")

section = (
    "## 2. Owner name removed from Susie's admin — FIX\n"
    "**Build:** `" + build + "` (" + now.strftime("%H:%M") + " UTC)\n"
    "- Security quick action is now “\U0001F4E7 Email my developer”; composer heading, placeholder, title and aria labels match. The command key changed to `email my developer` so the server's existing “my developer” recipient detector still sends it.\n"
    "- Payments intent copy: “PhantomIDE connects Stripe with you…” / “PhantomIDE will set Stripe up with you…”.\n"
    "- Pay PhantomIDE pill subtitle now “PhantomIDE · Server care”.\n"
    "- Remote-access quick action and the “no sign-ins yet” empty state no longer print the developer's name.\n"
    "- Mr Ed: system prompt now says never to use the developer's name when speaking to Susie — call him “your developer”; his name is used only when his own account is signed in. The static email replies and prompt button references use the new wording.\n"
    "  - Verified: build " + build + " answering on port 5006 (/api/version), junkalot.co 200, and the compiled security page chunk carries the new strings.\n"
)

md_path = os.path.join(root, "data/invoice-worklog-%s.md" % now.strftime("%Y-%m-%d"))
try:
    with io.open(md_path, "r", encoding="utf-8") as f:
        md = f.read()
    marker = "## Totals"
    idx = md.rfind(marker)
    md = (md[:idx] + section + "\n" + md[idx:]) if idx >= 0 else (md + "\n" + section)
    with io.open(md_path, "w", encoding="utf-8") as f:
        f.write(md)
    print("md updated:", md_path)
except FileNotFoundError:
    with io.open(md_path, "w", encoding="utf-8") as f:
        f.write("## Junkalot invoice worklog — %s\n\n" % now.strftime("%Y-%m-%d"))
        f.write(section)
        f.write("\n## Totals\n\nRates and amounts are the owner's to set. Nothing here is billed automatically.\n")
    print("md created:", md_path)

print("jsonl appended:", entry["date"], entry["time_utc"])
