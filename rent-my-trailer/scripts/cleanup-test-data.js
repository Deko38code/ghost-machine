/* Remove verification fixtures and their dependents (FK-safe order).
   Only touches users whose email matches the test patterns. */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const TEST_EMAIL_PATTERNS = ["uiverify-%", "gatetest-%", "dbg%@example.com", "trace%@example.com", "verify%@example.com", "%_%@example.com", "e2e-test%@example.com"];

export function cleanupTestData(dbPath = path.join(process.cwd(), "server", "rentmytrailer.db")) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys=OFF");
  const tables = (t) => { try { return db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).all(t).length > 0; } catch { return false; } };
  const del = (sql, ...args) => { try { return db.prepare(sql).run(...args).changes; } catch { return 0; } };

  const users = [];
  for (const p of TEST_EMAIL_PATTERNS) users.push(...db.prepare("SELECT id, email FROM users WHERE email LIKE ?").all(p));
  if (!users.length) { db.close(); return { users: 0, trailers: 0, bookings: 0 }; }

  let trailers = 0, bookings = 0;
  for (const { id } of users) {
    const mine = db.prepare("SELECT id FROM trailers WHERE owner_id=?").all(id).map((r) => r.id);
    const ths = db.prepare("SELECT id FROM threads WHERE renter_id=? OR trailer_id IN (SELECT id FROM trailers WHERE owner_id=?)").all(id, id).map((r) => r.id);
    const bks = db.prepare("SELECT id FROM bookings WHERE user_id=? OR trailer_id IN (SELECT id FROM trailers WHERE owner_id=?)").all(id, id).map((r) => r.id);
    for (const t of ths) del("DELETE FROM messages WHERE thread_id=?", t);
    for (const b of bks) {
      if (tables("deposit_photos")) del("DELETE FROM deposit_photos WHERE booking_id=?", b);
      if (tables("extension_requests")) del("DELETE FROM extension_requests WHERE booking_id=?", b);
      if (tables("damage_claims")) del("DELETE FROM damage_claims WHERE booking_id=?", b);
      if (tables("booking_logs")) del("DELETE FROM booking_logs WHERE booking_id=?", b);
      if (tables("receipts")) del("DELETE FROM receipts WHERE booking_id=?", b);
      bookings += del("DELETE FROM bookings WHERE id=?", b);
    }
    del("DELETE FROM threads WHERE renter_id=?", id);
    for (const t of mine) {
      if (tables("ratings")) del("DELETE FROM ratings WHERE trailer_id=?", t);
      del("DELETE FROM threads WHERE trailer_id=?", t);
      trailers += del("DELETE FROM trailers WHERE id=?", t);
    }
    if (tables("access_log")) del("DELETE FROM access_log WHERE user_id=?", id);
    del("DELETE FROM users WHERE id=?", id);
  }
  // keep founder ranks contiguous by real signup order (1,2,3,…) so the
  // "first 1,000" seat count reflects only genuine signups
  try {
    db.exec(`UPDATE users SET signup_rank = (SELECT COUNT(*) FROM users u2 WHERE u2.id <= users.id)`);
  } catch {}
  db.close();
  return { users: users.length, trailers, bookings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = cleanupTestData();
  console.log(`cleanup: ${r.users} test user(s), ${r.trailers} trailer(s), ${r.bookings} booking(s) removed`);
}
