import json, io, datetime, os

root = "/home/ghost694/junkalot"
now = datetime.datetime.utcnow()
build = "CcFPQDfHIh5dzCsigzj3o"
entry = {
    "date": now.strftime("%Y-%m-%d"),
    "time_utc": now.strftime("%H:%M:%S"),
    "project": "junkalot.co",
    "kind": "fix+addon",
    "title": (
        "Mr Ed inbox no longer carries the developer's name: the greeting always says Susie "
        "(the signed-in Google profile is never used), a new client-record bubble shows her "
        "emails and last sign-in IP from the stored client-access log, saved inbox messages "
        "have the developer's name corrected as they are read, and the Pay PhantomIDE button "
        "question stays on the desk and in the Coach prompt until her confirmation is logged"
    ),
    "builds": [build],
    "verified": "live",
}

jsonl = os.path.join(root, "data/invoice-worklog.jsonl")
with io.open(jsonl, "a", encoding="utf-8") as f:
    f.write(json.dumps(entry) + "\n")

section = (
    "## 1. Mr Ed inbox greeting + client record — FIX + ADD-ON\n"
    "**Build:** `" + build + "` (" + now.strftime("%H:%M") + " UTC)\n"
    "- Greeting is always Susie: the signed-in Google profile is never used, so the developer's name can never appear in her admin.\n"
    "- New client-record bubble: her emails and the most recent sign-in IP, read from the stored client-access log "
    "(real values only; it says plainly when no address is recorded yet).\n"
    "- Saved inbox history is corrected at read time (developer's name scrubbed) — the append-only store itself is not rewritten.\n"
    "- The Pay PhantomIDE button question stays on the desk and in the Coach prompt, every session, until her confirmation is logged on the payments record.\n"
    "  - Verified: data/mred-inbox.jsonl reads \"Hi Susie\" with 0 rows naming the developer; build " + build + " answering on port 5006; junkalot.co 200.\n"
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
