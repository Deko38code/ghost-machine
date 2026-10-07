import sqlite3, collections, sys
db = sqlite3.connect("/home/oem/rent-my-trailer/server/rentmytrailer.db")
rows = db.execute("SELECT cat, daily, weekly, monthly, deposit, city, st, title, hitch FROM trailers WHERE status=?", ("live",)).fetchall()
main = collections.defaultdict(lambda: {"d": [], "w": [], "m": []})
cities, hitch, deposits = collections.Counter(), collections.Counter(), []
zero = 0
for cat, daily, weekly, monthly, dep, city, st, title, ht in rows:
    first = (cat or "Other").split(",")[0].strip().replace(" Trailer Rentals", "").replace(" with Living Quarters", " + Living Quarters")
    if daily:
        main[first]["d"].append(daily)
        if weekly: main[first]["w"].append(weekly)
        if monthly: main[first]["m"].append(monthly)
    if daily == 0: zero += 1
    if dep: deposits.append(dep)
    if city: cities[city] += 1
    if ht: hitch[ht] += 1

def med(v):
    v = sorted(v); n = len(v)
    return v[(n - 1) // 2] if n else None

lines = [f"Inventory: {len(rows)} live trailers across {len(cities)} cities (US marketplace)."]
for k in sorted(main, key=lambda k: -len(main[k]["d"]))[:12]:
    v = main[k]
    d = sorted(v["d"]); ds = sorted(v["w"]); ms = sorted(v["m"])
    base = f"- {k} trailer: {len(d)} units, typical ${med(d)}/day (from ${d[0]} up to ${d[-1]})"
    if ds: base += f", weekly ${med(ds)}"
    if ms: base += f", monthly ${med(ms)}"
    lines.append(base)
if deposits:
    deps = sorted(deposits)
    lines.append(f"- Refundable deposits: typically ${med(deposits)} (from ${deps[0]} to ${deps[-1]})")
hitch_s = ", ".join(f"{h} x{n}" for h, n in hitch.most_common(4))
lines.append(f"- Hitches: {hitch_s}")
top = ", ".join(f"{c} ({n})" for c, n in cities.most_common(12))
lines.append(f"- Busiest areas: {top}")
lines.append(f"Note: {zero} listings show $0/day (incomplete data) — treat those prices as unknown.")
digest = "\n".join(lines)
open("/tmp/rmt_digest.txt", "w").write(digest)
print(digest)