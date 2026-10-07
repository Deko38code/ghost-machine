import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.RMT_DB || path.join(__dirname, "rentmytrailer.db");

export const db = new DatabaseSync(DB_PATH);

/* ─── MIG: ensure missing columns on existing db files ── */
const __COLS = "";
try {
  for (const [table, cols] of [
    ["users", ["ref", "picture", "bio", "avatar_file", "phone", "phone_verified", "phone_code", "promo_rank", "paid_until", "ref_code", "kyc_state", "kyc_files", "duo_enabled", "token_ver", "google_sub", "login_log"]],
    ["bookings", ["credit_applied", "rental_paid_cents", "deposit_paid_cents", "rental_paid_at", "deposit_paid_at", "pay_method", "coupon_code"]],
  ]) {
    const have = db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((r) => r.name);
    for (const c of cols) if (!have.includes(c)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${c} TEXT NOT NULL DEFAULT ''`);
    }
  }
} catch (ex) { console.error("MIG:", String(ex).slice(0, 140)); }
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',      -- free | paid
  role TEXT NOT NULL DEFAULT 'renter',    -- renter | owner | admin
  created_on TEXT NOT NULL DEFAULT (datetime('now')),
  ref TEXT DEFAULT '',
  picture TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_file TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  phone_verified INTEGER DEFAULT 0,
  phone_code TEXT DEFAULT '',
  promo_rank INTEGER DEFAULT 0,
  paid_until TEXT DEFAULT '',
  ref_code TEXT DEFAULT '',
  kyc_state TEXT DEFAULT 'none',
  kyc_files TEXT DEFAULT '',
  duo_enabled INTEGER DEFAULT 0,
  token_ver INTEGER DEFAULT 0,
  google_sub TEXT DEFAULT '',
  login_log TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS trailers (
  id INTEGER PRIMARY KEY,                    -- scraped ids >=1 ; posted ids >9e8
  owner_id INTEGER REFERENCES users(id),
  src TEXT NOT NULL DEFAULT 'snapshot',      -- snapshot | user
  title TEXT NOT NULL,
  cat TEXT,
  daily REAL, weekly REAL, monthly REAL,
  city TEXT, state TEXT, st TEXT, zip TEXT,
  lat REAL, lng REAL,
  img TEXT, images_json TEXT,               -- JSON array of urls
  hitch TEXT, dims TEXT, weight TEXT, deposit REAL,
  delivery INTEGER DEFAULT 0, delivery_radius REAL DEFAULT 15,
  year NUMERIC, make TEXT, model TEXT,
  desc TEXT,
  pics_json TEXT,
  status TEXT NOT NULL DEFAULT 'live',      -- live | paused | deleted
  created_on TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  trailer_id INTEGER NOT NULL REFERENCES trailers(id),
  start_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  base REAL NOT NULL, discount REAL DEFAULT 0,
  total REAL NOT NULL,
  deposit REAL DEFAULT 0,
  payment_state TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | failed
  deposit_state TEXT NOT NULL DEFAULT 'pending',   -- pending | held | released
  coupon_code TEXT,
  created_on TEXT NOT NULL DEFAULT (datetime('now')),
  credit_applied REAL DEFAULT 0,
  rental_paid_cents INTEGER DEFAULT 0,
  deposit_paid_cents INTEGER DEFAULT 0,
  rental_paid_at TEXT DEFAULT '',
  deposit_paid_at TEXT DEFAULT '',
  pay_method TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  percent INTEGER NOT NULL,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,                            -- NULL = unlimited
  created_by INTEGER REFERENCES users(id),
  created_on TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS deposit_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  role TEXT NOT NULL,                          -- renter | owner
  stage TEXT NOT NULL,                         -- dropoff | pickup
  slot TEXT NOT NULL,                          -- hitch | tires | corners | extras
  file TEXT NOT NULL,
  taken_on TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(booking_id, role, stage, slot)
);
CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trailer_id INTEGER NOT NULL REFERENCES trailers(id),
  renter_id INTEGER NOT NULL REFERENCES users(id),
  clearance TEXT NOT NULL DEFAULT 'approved',  -- approved | requested | pending
  updated_on TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES threads(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  sent_on TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trailers_state ON trailers(state);
CREATE INDEX IF NOT EXISTS idx_trailers_cat ON trailers(cat);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);

CREATE TABLE IF NOT EXISTS booking_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  event TEXT NOT NULL,            -- created | cancelled | deposit-held | deposit-pending-release | receipt-issued
  detail TEXT,
  actor TEXT,                     -- user email or 'system'
  logged_on TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  deposit REAL DEFAULT 0,
  coupon_code TEXT,
  issued_to TEXT NOT NULL,        -- email
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | emailed | send-failed
  email_subject TEXT, email_body TEXT, email_error TEXT,
  created_on TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(booking_id)
);
CREATE TABLE IF NOT EXISTS extension_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  added_days INTEGER NOT NULL,
  reason TEXT,
  extra_total REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | denied
  requested_by INTEGER NOT NULL REFERENCES users(id),
  decided_by INTEGER REFERENCES users(id),
  requested_on TEXT NOT NULL DEFAULT (datetime('now')),
  decided_on TEXT
);
CREATE TABLE IF NOT EXISTS damage_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  filed_by INTEGER NOT NULL REFERENCES users(id),
  party TEXT NOT NULL DEFAULT 'renter',      -- renter | owner
  description TEXT NOT NULL,
  claimed_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',       -- open | resolved | denied
  resolution TEXT,
  filed_on TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_on TEXT
);

`);

export const seedCoupons = [
  { code: "HAULMORE", percent: 10, note: "10% off any rental over $100" },
  { code: "FIRSTTOW", percent: 15, note: "15% off your first booking" },
  { code: "WEEKENDHAUL", percent: 5, note: "5% off 3+ day weekends" },
  { code: "FLEETFIX", percent: 20, note: "20% off 7+ day rentals" },
];
const cnt = db.prepare("SELECT COUNT(*) c FROM coupons").get();
if (cnt.c === 0) {
  const ins = db.prepare("INSERT OR IGNORE INTO coupons (code, percent, note) VALUES (?,?,?)");
  for (const c of seedCoupons) ins.run(c.code, c.percent, c.note);
}

export const OWNER_POOL_EMAIL = "owners@rentmytrailer.local";

export function ensureOwnerPool() {
  const u = db.prepare("SELECT id FROM users WHERE email=?").get(OWNER_POOL_EMAIL);
  if (u) return u.id;
  const r = db.prepare("INSERT INTO users (email, pass_hash, display_name, tier, role) VALUES (?,?,?,?,?)")
    .run(OWNER_POOL_EMAIL, bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10), "RMT Owner Services", "paid", "owner");
  return Number(r.lastInsertRowid);
}

const STATE_ABBR = { Alabama:"AL", Alaska:"AK", Arizona:"AZ", Arkansas:"AR", California:"CA", Colorado:"CO", Connecticut:"CT", Delaware:"DE", Florida:"FL", Georgia:"GA", Hawaii:"HI", Idaho:"ID", Illinois:"IL", Indiana:"IN", Iowa:"IA", Kansas:"KS", Kentucky:"KY", Louisiana:"LA", Maine:"ME", Maryland:"MD", Massachusetts:"MA", Michigan:"MI", Minnesota:"MN", Mississippi:"MS", Missouri:"MO", Montana:"MT", Nebraska:"NE", Nevada:"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", Ohio:"OH", Oklahoma:"OK", Oregon:"OR", Pennsylvania:"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", Tennessee:"TN", Texas:"TX", Utah:"UT", Vermont:"VT", Virginia:"VA", Washington:"WA", "West Virginia":"WV", Wisconsin:"WI", Wyoming:"WY", "District of Columbia":"DC" };
const IMAGE_BASE = process.env.RMT_IMAGE_BASE || "https://neighborstrailer.com";
function normTrailer(d) {
  const pics = Array.isArray(d.pics) ? d.pics
    : Array.isArray(d.attachments) ? d.attachments.map(a => { const dir = a?.directory || ""; return /^https?:/.test(dir) ? dir : IMAGE_BASE + dir; }).filter(Boolean)
    : [];
  return {
    id: d.id, title: d.title, cat: d.cat ?? d.categoryTitle ?? null,
    daily: d.daily ?? d.dailyPrice ?? null,
    weekly: d.weekly ?? d.weeklyPrice ?? null,
    monthly: d.monthly ?? d.monthlyPrice ?? null,
    city: d.city || (d.location ? String(d.location).slice(0, 60) : null), state: d.state || null,
    st: d.st || (STATE_ABBR[d.state] ?? null), zip: d.zip ?? d.postalCode ?? null,
    lat: d.lat ?? d.locLat ?? null, lng: d.lng ?? d.locLng ?? null,
    img: d.img || (pics[0] ?? null), hitch: d.hitch ?? d.hitchTitle ?? null,
    dims: d.dims ?? d.trialerDimension ?? null, weight: d.weight ?? d.weightCapicity ?? null,
    deposit: d.deposit ?? d.refundableCashDeposit ?? null,
    delivery: d.delivery ?? d.isDeliveryAvailable ?? 0,
    year: d.year ?? null, make: d.make || null, model: d.model || null,
    desc: d.desc ?? d.description ?? null, pics
  };
}
export function seedTrailers() {
  const jsonl = process.env.RMT_SEED || path.join(__dirname, "..", "data", "trailers.jsonl");
  if (!fs.existsSync(jsonl)) return -1;
  const ownerId = ensureOwnerPool();
  const ins = db.prepare(`INSERT OR REPLACE INTO trailers
    (id, owner_id, src, title, cat, daily, weekly, monthly, city, state, st, zip, lat, lng, img, hitch, dims, weight, deposit, delivery, year, make, model, desc, pics_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let n = 0, err = 0, firstErr = null;
  let rows;
  const raw = fs.readFileSync(jsonl, "utf8");
  if (raw.trim().startsWith("[")) rows = JSON.parse(raw);
  else {
    rows = [];
    for (const line of raw.split("\n")) if (line.trim()) try { rows.push(JSON.parse(line)); } catch { err++; }
  }
  db.exec("BEGIN");
  try {
    for (const d of rows) {
      try {
        const t = normTrailer(d);
        ins.run(
          t.id, ownerId, "snapshot", t.title || "", t.cat || null,
          t.daily, t.weekly, t.monthly,
          t.city, t.state, t.st, t.zip,
          t.lat, t.lng, t.img,
          t.hitch, t.dims, t.weight, t.deposit,
          t.delivery ? 1 : 0, t.year, t.make, t.model,
          t.desc,
          t.pics.length ? JSON.stringify(t.pics.slice(0, 10)) : null
        );
        n++;
      } catch (e) {
        err++;
        if (!firstErr) firstErr = String(e).slice(0, 200);
      }
    }
  } finally {
    db.exec("COMMIT");
  }
  if (err) console.error(`[seed] ${err} rows failed${firstErr ? " — " + firstErr : ""}`);
  return n;
}
/* phone verification + founding-rank cols (textbee SMS)*/
