import io, os, hashlib, datetime, sys

ROOT = "/home/ghost/haksterAi"
STAMP = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")

patches = {
    "server/src/db.js": [
        # Fresh installs get the column.
        (
            "      metadata        TEXT,  -- JSON blob for extra context\n      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),",
            "      metadata        TEXT,  -- JSON blob for extra context\n      duplicate_of    TEXT,  -- receipt id this row duplicates; excluded from revenue\n      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),",
            1,
        ),
        # Existing databases get it added once.
        (
            "  } catch (e) { /* table may not exist yet */ }\n\n  // ── Migrate users.plan CHECK ──",
            """  } catch (e) { /* table may not exist yet */ }

  // ── Migrate payments.duplicate_of ──
  // A payment row that repeats an earlier one (the initial subscription
  // invoice after checkout already recorded it) is flagged here instead of
  // being deleted: history stays, revenue queries ignore it.
  try {
    const payCols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name);
    if (!payCols.includes('duplicate_of')) {
      db.prepare("ALTER TABLE payments ADD COLUMN duplicate_of TEXT").run();
      console.log('  [migration] Added duplicate_of column to payments');
    }
  } catch (e) { /* table may not exist yet */ }

  // ── Migrate users.plan CHECK ──""",
            1,
        ),
    ],
    "server/src/index.js": [
        # Admin billing list: never show the same money twice.
        (
            """        FROM payments p LEFT JOIN users u ON u.id = p.user_id
        ORDER BY COALESCE(p.completed_at, p.created_at) DESC LIMIT 50`).all();""",
            """        FROM payments p LEFT JOIN users u ON u.id = p.user_id
        WHERE COALESCE(p.duplicate_of, '') = ''
        ORDER BY COALESCE(p.completed_at, p.created_at) DESC LIMIT 50`).all();""",
            1,
        ),
        # Dashboard totals.
        (
            """          COALESCE(SUM(CASE WHEN completed_at >= unixepoch() - 2592000 THEN 1 ELSE 0 END), 0) AS count30d
        FROM payments WHERE status = 'completed'`).get() || {};""",
            """          COALESCE(SUM(CASE WHEN completed_at >= unixepoch() - 2592000 THEN 1 ELSE 0 END), 0) AS count30d
        FROM payments WHERE status = 'completed' AND COALESCE(duplicate_of, '') = ''`).get() || {};""",
            1,
        ),
        # Revenue cards.
        (
            """      COUNT(*) AS payments
    FROM payments WHERE status = 'completed'`).get(now - 30 * 86400, now - 30 * 86400);""",
            """      COUNT(*) AS payments
    FROM payments WHERE status = 'completed' AND COALESCE(duplicate_of, '') = ''`).get(now - 30 * 86400, now - 30 * 86400);""",
            1,
        ),
    ],
}

for rel, pairs in patches.items():
    path = os.path.join(ROOT, rel)
    text = io.open(path, encoding="utf-8").read()
    original = text
    for old, new, count in pairs:
        got = text.count(old)
        if got != count:
            print("MISS %s: expected %d, found %d -> %r" % (rel, count, got, old[:90]))
            sys.exit(1)
        text = text.replace(old, new)
    backup = path + ".bak-payments-dedup-" + STAMP
    io.open(backup, "w", encoding="utf-8").write(original)
    io.open(path, "w", encoding="utf-8").write(text)
    print("PATCHED", rel, "backup", backup)
print("OK")
