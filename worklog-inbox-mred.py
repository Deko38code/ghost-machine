import json, datetime

base = "/home/ghost694/junkalot/data/"
now = datetime.datetime.now(datetime.timezone.utc)
row = {
    "date": now.strftime("%Y-%m-%d"),
    "time_utc": now.strftime("%H:%M"),
    "project": "junkalot.co",
    "kind": "addon",
    "title": ("Panel bridge can include Mr Ed: with include=mred the shared panel channel merges the messages Mr Ed "
              "saved for her (read-only from her own inbox store, deduped by id and time) so PhantomIDE's mirrored "
              "owner inbox shows what Mr Ed told her alongside her replies; every existing bridge response is unchanged"),
    "builds": ["Izj5Dr58hzdCtL8E6sR5a"],
    "verified": "live",
}
with open(base + "invoice-worklog.jsonl", "a", encoding="utf-8") as f:
    f.write(json.dumps(row, ensure_ascii=False) + "\n")
with open(base + "invoice-worklog-%s.md" % row["date"], "a", encoding="utf-8") as f:
    f.write("- %s UTC · %s · **%s** · builds %s · verified live\n" % (
        row["time_utc"], row["kind"], row["title"], ", ".join(row["builds"])))
print("logged", row["time_utc"])
