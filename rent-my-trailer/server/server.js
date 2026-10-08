import { fileURLToPath } from "node:url";
import express from "express";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { WebSocketServer } from "ws";
import { execSync } from "node:child_process";
import { DatabaseSync as _DBS } from "node:sqlite";
import { db, seedTrailers } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* load server/.env (KEY=VALUE) before anything resolves secrets */
if (!fs.existsSync(path.join(__dirname, ".env"))) {
  const gen = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(path.join(__dirname, ".env"), `RMT_JWT_SECRET=${gen}\n`, { mode: 0o600 });
}
for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].trim();
}
const PORT = process.env.PORT || 8110;
const UPLOADS = process.env.RMT_UPLOADS || path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(path.join(UPLOADS, "private"), { recursive: true });
// ── tiny .env loader (dotenv-free): server/.env sets RMT_PAY_SECRET etc. ──
try {
  const fs2 = require("fs"), path2 = require("path");
  const envp = path2.join(__dirname, ".env");
  if (fs2.existsSync(envp)) for (const line of fs2.readFileSync(envp, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

const app = express();
const DIST = process.env.RMT_DIST || path.join(__dirname, "..", "app", "dist");
const JWT_SECRET = process.env.RMT_JWT_SECRET;
if (!JWT_SECRET) throw new Error("RMT_JWT_SECRET missing from server/.env");
app.use(express.json({ limit: "1mb" }));

/* ─── helpers ─────────────────────────────────────────── */
const sign = (u) => jwt.sign({ uid: u.id, tier: u.tier, role: u.role, ver: Number(u.token_ver) || 0 }, JWT_SECRET, { expiresIn: "30d" });
function auth(required = true) {
  return (req, res, next) => {
    const tok = (req.headers.authorization || "").replace(/^Bearer /, "") || req.query.token;
    if (!tok) {
      if (!required) { req.user = null; return next(); }
      return res.status(401).json({ error: "login required" });
    }
    try {
      const p = jwt.verify(tok, JWT_SECRET);
      req.user = db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(p.uid);
      if (!req.user) return res.status(401).json({ error: "user gone" });
      next();
    } catch { return res.status(401).json({ error: "bad token" }); }
  };
}
const numOr = (v, d) => (v == null || v === "" || isNaN(Number(v)) ? d : Number(v));

/* "renter" is for users, never the operator: the admin email always lands admin */
const ADMIN_EMAIL = (process.env.RMT_ADMIN_EMAIL || "owners@rentmytrailer.local").toLowerCase();
function ensureAdmin(u) {
  if (u && String(u.email || "").toLowerCase() === ADMIN_EMAIL && u.role !== "admin") {
    db.prepare("UPDATE users SET role='admin' WHERE id=?").run(u.id);
    u.role = "admin";
  }
  return u;
}

/* ─── auth ────────────────────────────────────────────── */
app.post("/api/auth/signup", async (req, res) => {
  
const { email, password, display_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if (password.length < 8) return res.status(400).json({ error: "password min 8 chars" });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const r = db.prepare("INSERT INTO users (email, pass_hash, display_name, signup_rank) VALUES (?,?,?,(SELECT COALESCE(MAX(signup_rank),0)+1 FROM users))").run(email.toLowerCase(), hash, display_name || email.split("@")[0]);
    const u = ensureAdmin(db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(r.lastInsertRowid));
    res.json({ token: sign(u), user: u });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "email already registered" });
    throw e;
  }
});


/* google: client config for the GSI button + server-side credential verify */
app.get("/api/config", (_req, res) => {
  res.json({ google_client_id: GOOGLE_CLIENT_ID || null });
});
app.post("/api/auth/google", async (req, res) => {
  const cred = String(req.body?.credential || "");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).json({ error: "google not configured" });
  if (cred.split(".").length !== 3) return res.status(400).json({ error: "bad credential" });
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(cred));
  if (!r.ok) return res.status(401).json({ error: "credential rejected by google" });
  const c = await r.json();
  if (c.aud !== GOOGLE_CLIENT_ID) return res.status(401).json({ error: "credential audience mismatch" });
  if (c.exp * 1000 < Date.now() - 60_000) return res.status(401).json({ error: "credential expired" });
  const email = String(c.email || "").toLowerCase();
  if (!email || /-?\d+@anonymous\.google$/.test(email)) return res.status(401).json({ error: "no verified email" });
  let u = db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE email=?").get(email);
  if (!u) {
    const r2 = db.prepare("INSERT INTO users (email, pass_hash, display_name, signup_rank) VALUES (?, 'google', ?, (SELECT COALESCE(MAX(signup_rank),0)+1 FROM users))").run(email, c.name || email.split("@")[0]);
    u = db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(r2.lastInsertRowid);
  }
  res.json({ token: sign(ensureAdmin(u)), user: ensureAdmin(u) });
});

/* ─── google sign-in (OAuth 2.0 authorization code flow) ─── */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECTS = (process.env.RMT_OAUTH_REDIRECTS || "").split(",").map((s) => s.trim()).filter(Boolean);
const GOOGLE_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

app.get("/api/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send("Google sign-in not configured — add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to server/.env");
  // redirect origin must be one of the registered URIs in the Google console
  const origin = req.headers.origin || (req.socket.encrypted ? "https://" : "http://") + (req.headers.host || "localhost:8111");
  const uri = origin + "/api/auth/google/callback";
  if (GOOGLE_REDIRECTS.length && !GOOGLE_REDIRECTS.includes(origin)) {
    return res.status(403).send("Origin " + origin + " not registered — add it to RMT_OAUTH_REDIRECTS and the Google console, then restart");
  }
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: uri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.setHeader("Set-Cookie", `gstate=${state}; HttpOnly; Path=/api/auth/google/callback; Max-Age=600; SameSite=Lax`);
  res.redirect(GOOGLE_BASE + "?" + params.toString());
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const cookies = Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((c) => c.trim().split("=").concat([""])));
    if (!req.query.code || !req.query.state || req.query.state !== cookies.gstate) return res.status(400).send("OAuth state mismatch — restart the sign-in");
    const origin = (req.headers.origin || "https://" + (req.headers.host || ""));
    // exchange the code; redirect_uri here must byte-match the one on the auth call
    const r = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: origin + "/api/auth/google/callback",
        grant_type: "authorization_code",
      }),
    });
    const j = await r.json();
    if (!r.ok || !j.id_token) return res.status(502).send("token exchange failed: " + (j.error || r.status));
    const claims = JSON.parse(Buffer.from(j.id_token.split(".")[1], "base64url").toString("utf8"));
    const email = String(claims.email || "").toLowerCase();
    const name = claims.name || email.split("@")[0];
    if (claims.email_verified === false) return res.status(403).send("Google email not verified");
    let u = db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE email=?").get(email);
    if (!u) {
      const r2 = db.prepare("INSERT INTO users (email, pass_hash, display_name, signup_rank) VALUES (?, 'google', ?, (SELECT COALESCE(MAX(signup_rank),0)+1 FROM users))").run(email, name);
      u = db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(r2.lastInsertRowid);
    }
    ensureAdmin(u);
    const token = sign(u);
    const esc = JSON.stringify(u).replace(/</g, "\\u003c");
    res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    res.send(`<!doctype html><title>Signing in…</title><script>
      localStorage.setItem("rmt-token", ${JSON.stringify(token)});
      localStorage.setItem("rmt-user", ${esc});
      location.replace("/#/home");
    </script><p style="font:14px sans-serif">Signed in as ${name} — taking you to the site…</p>`);
  } catch (e) {
    res.status(500).send("google sign-in failed: " + String(e).slice(0, 200));
  }
});
const loginFails = [];
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare("SELECT * FROM users WHERE email=?").get((email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(password || "", u.pass_hash)) {
    loginFails.push({ at: Date.now(), email: (email || "").toLowerCase().slice(0, 80), ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().slice(0, 64) });
    if (loginFails.length > 500) loginFails.splice(0, loginFails.length - 500);
    return res.status(401).json({ error: "bad credentials" });
  }
  ensureAdmin(u);
  const pub = { id: u.id, email: u.email, display_name: u.display_name, tier: u.tier, role: u.role };
  res.json({ token: sign(pub), user: pub });
});
app.get("/api/auth/me", auth(true), (req, res) => res.json({ user: req.user }));
/* admin: force-logout kick — invalidates every token of a user instantly */
app.post("/api/admin/kick", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const uid = Number(req.body?.user_id);
  if (!uid) return res.status(400).json({ error: "user_id required" });
  const tgt = db.prepare("SELECT id, email FROM users WHERE id=?").get(uid);
  if (!tgt) return res.status(404).json({ error: "no user" });
  db.prepare("UPDATE users SET token_ver = token_ver + 1 WHERE id=?").run(uid);
  try { blog(0, "admin-kick", `user #${uid} (${tgt.email}) kicked — sessions invalidated`, req.user.email); } catch {}
  secAlert(`kickadm:${uid}`, `[RMT] admin kicked #${uid} (${tgt.email})`, `<h2 style="margin:0 0 8px">Admin kick</h2><p style="color:#333">${tgt.email} kicked by ${req.user.email} — next request 401s on every device.</p>`);
  res.json({ ok: true, kicked: uid });
});
async function startRmtCheckout(req, res) {
  // real payment wiring: billing runs through the haksterai-id Stripe POOL.
  // Gateways: haksterai.com (:3579) and Phantom (:4000) — both hold live Stripe
  // accounts. Health gate = /api/health must answer 200 ("works 200"); healthy
  // gateways are then tried in RANDOM order (swap when needed).
  const paySecret = process.env.RMT_PAY_SECRET || "";
  if (!paySecret) return res.status(503).json({ error: "RMT_PAY_SECRET not configured — payment gateway unavailable" });
  const POOL = [
    { name: "haksterai", url: process.env.HAKSTER_PAY_URL || "http://localhost:3579/api/rmt/checkout" },
    { name: "phantom", url: process.env.PHANTOM_PAY_URL || "http://10.0.0.210:4000/api/rmt/checkout" },
  ];
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id) || req.user;
  const healthy = [];
  await Promise.all(POOL.map(async (g) => {
    try {
      const h = new URL(g.url); h.pathname = "/api/health";
      const r = await fetch(h, { signal: AbortSignal.timeout(4000) });
      if (r.status === 200) healthy.push(g);
    } catch {}
  }));
  if (!healthy.length) return res.status(503).json({ error: "no payment gateway healthy" });
  const order = healthy.sort(() => Math.random() - 0.5);
  const origin = process.env.RMT_PUBLIC_ORIGIN || "https://rmt.haksterai.com";
  const body = JSON.stringify({
    email: u.email, rmt_user_id: req.user.id,
    success_url: origin + "/#/membership?ok=1",
    cancel_url: origin + "/#/membership?canceled=1",
  });
  let lastErr = null;
  for (const g of order) {
    try {
      const r = await fetch(g.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rmt-secret": paySecret },
        body,
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error((j && j.error) || "checkout failed (" + r.status + ")");
      return res.json({ ok: true, url: j.url, gateway: g.name });
    } catch (err) {
      lastErr = err;
      // swap to the next gateway automatically
    }
  }
  return res.status(502).json({ error: "all payment gateways failed", detail: lastErr && lastErr.message });}
app.post("/api/auth/upgrade", auth(true), async (req, res) => {
  // real payment wiring: billing runs through the haksterai-id Stripe POOL.
  // Gateways: haksterai.com (:3579) and Phantom (:4000) — both hold live Stripe
  // accounts. Health gate = /api/health must answer 200 ("works 200"); healthy
  // gateways are then tried in RANDOM order (swap when needed).
  const paySecret = process.env.RMT_PAY_SECRET || "";
  if (!paySecret) return res.status(503).json({ error: "RMT_PAY_SECRET not configured — payment gateway unavailable" });
  const POOL = [
    { name: "haksterai", url: process.env.HAKSTER_PAY_URL || "http://localhost:3579/api/rmt/checkout" },
    { name: "phantom", url: process.env.PHANTOM_PAY_URL || "http://10.0.0.210:4000/api/rmt/checkout" },
  ];
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id) || req.user;
  const healthy = [];
  await Promise.all(POOL.map(async (g) => {
    try {
      const h = new URL(g.url); h.pathname = "/api/health";
      const r = await fetch(h, { signal: AbortSignal.timeout(4000) });
      if (r.status === 200) healthy.push(g);
    } catch {}
  }));
  if (!healthy.length) return res.status(503).json({ error: "no payment gateway healthy" });
  const order = healthy.sort(() => Math.random() - 0.5);
  const origin = process.env.RMT_PUBLIC_ORIGIN || "https://rmt.haksterai.com";
  const body = JSON.stringify({
    email: u.email, rmt_user_id: req.user.id,
    success_url: origin + "/#/membership?ok=1",
    cancel_url: origin + "/#/membership?canceled=1",
  });
  let lastErr = null;
  for (const g of order) {
    try {
      const r = await fetch(g.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rmt-secret": paySecret },
        body,
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error((j && j.error) || "checkout failed (" + r.status + ")");
      return res.json({ ok: true, url: j.url, gateway: g.name });
    } catch (err) {
      lastErr = err;
      // swap to the next gateway automatically
    }
  }
  return res.status(502).json({ error: "all payment gateways failed", detail: lastErr && lastErr.message });
});

/* ─── trailers ────────────────────────────────────────── */
app.get("/api/trailers", (req, res) => {
  const { q = "", cat = "", state = "", max = "", sort = "new", page = 1 } = req.query;
  const where = ["t.status='live'"], args = [];
  if (q) { where.push("(t.title LIKE ? OR t.city LIKE ? OR t.state LIKE ? OR t.cat LIKE ? OR t.hitch LIKE ? OR t.make LIKE ?)"); const like = `%${q}%`; args.push(like, like, like, like, like, like); }
  if (cat) { where.push("t.cat = ?"); args.push(cat); }
  if (state) { where.push("(t.state = ? OR t.st = ?)"); args.push(state, state); }
  if (max) { where.push("t.daily IS NOT NULL AND t.daily <= ?"); args.push(numOr(max, 0)); }
  const order = sort === "price-asc" ? "t.daily ASC NULLS LAST" : sort === "price-desc" ? "t.daily DESC" : "t.id DESC";
  const per = 24;
  const rows = db.prepare(`SELECT t.*, (SELECT ROUND(AVG(stars),1) FROM ratings r WHERE r.trailer_id=t.id) AS rating_avg, (SELECT COUNT(*) FROM ratings r WHERE r.trailer_id=t.id) AS rating_count FROM trailers t WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...args, per, (numOr(page, 1) - 1) * per).map((t) => { delete t.pics_json; return t; });
  const total = db.prepare(`SELECT COUNT(*) c FROM trailers t WHERE ${where.join(" AND ")}`).get(...args).c;
  res.json({ total, page: numOr(page, 1), per, rows });
});
app.get("/api/trailers/meta", (_req, res) => {
  const cats = db.prepare("SELECT cat, COUNT(*) n FROM trailers WHERE status='live' AND cat IS NOT NULL GROUP BY cat ORDER BY n DESC").all();
  const st = db.prepare("SELECT state, COUNT(*) n FROM trailers WHERE status='live' AND state IS NOT NULL GROUP BY state ORDER BY n DESC").all();
  const stats = { total: db.prepare("SELECT COUNT(*) c FROM trailers WHERE status='live'").get().c, avg: db.prepare("SELECT ROUND(AVG(daily)) a FROM trailers WHERE status='live' AND daily IS NOT NULL").get().a };
  res.json({ cats, states: st, stats });
});
app.get("/api/trailers/:id", (req, res) => {
  const t = db.prepare("SELECT t.*, (SELECT ROUND(AVG(stars),1) FROM ratings r WHERE r.trailer_id=t.id) AS rating_avg, (SELECT COUNT(*) FROM ratings r WHERE r.trailer_id=t.id) AS rating_count FROM trailers t WHERE t.id=?").get(Number(req.params.id));
  if (!t || (t.status !== "live" && req.user?.role !== "admin")) return res.status(404).json({ error: "not found" });
  let pics = [];
  try { pics = t.pics_json ? JSON.parse(t.pics_json) : []; } catch {}
  delete t.pics_json;
  res.json({ ...t, pics });
});
/* picture library — real catalog images per category, powers one-click listings */
app.get("/api/pictures", (req, res) => {
  const cat = String(req.query.cat || "");
  const q = cat
    ? "SELECT img, id, cat, title FROM trailers WHERE cat LIKE ? AND img IS NOT NULL AND length(img)>0 ORDER BY RANDOM() LIMIT 60"
    : "SELECT img, id, cat, title FROM trailers WHERE img IS NOT NULL AND length(img)>0 ORDER BY RANDOM() LIMIT 60";
  const rows = db.prepare(q).all(cat ? `%${cat}%` : undefined);
  res.json({ cat, rows });
});
app.post("/api/trailers", auth(true), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.daily) return res.status(400).json({ error: "title and daily rate required" });
  const id = 900000000 + Date.now() % 100000000; // user-posted id range
  db.prepare(`INSERT INTO trailers (id, owner_id, src, title, cat, daily, weekly, monthly, city, state, st, zip, lat, lng, img, hitch, dims, weight, deposit, delivery, delivery_radius, year, make, model, desc, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'live')`).run(
    id, req.user.id, "user", b.title, b.cat || null,
    numOr(b.daily, 0), numOr(b.weekly, null) || null, numOr(b.monthly, null) || null,
    b.city || null, b.state || null, b.state || null, b.zip || null,
    b.lat ?? null, b.lng ?? null, b.img || null, b.hitch || null, b.dims || null, b.weight || null,
    numOr(b.deposit, 0), b.delivery ? 1 : 0, numOr(b.delivery_radius, 15),
    numOr(b.year, null) || null, b.make || null, b.model || null, b.desc || null
  );
  res.json({ ok: true, id });
});
const mineStmt = () => db.prepare("SELECT * FROM trailers WHERE owner_id=? AND status!='deleted' ORDER BY id DESC");
app.get("/api/mytrailers", auth(true), (req, res) => res.json({ rows: mineStmt().all(req.user.id) }));
app.post("/api/mytrailers/:id/status", auth(true), (req, res) => {
  const t = db.prepare("SELECT owner_id, src FROM trailers WHERE id=?").get(Number(req.params.id));
  if (!t || (t.src === "user" ? t.owner_id !== req.user.id : req.user.role !== "admin")) return res.status(403).json({ error: "not yours" });
  db.prepare("UPDATE trailers SET status=? WHERE id=?").run(req.body?.status || "paused", Number(req.params.id));
  res.json({ ok: true });
});

/* ─── coupons & pricing ───────────────────────────────── */
app.get("/api/coupons", (_req, res) => {
  res.json({ rows: db.prepare("SELECT code, percent, note FROM coupons WHERE active=1").all() });
});
function couponVerify(c, idNo) {
  // ID-verified community coupons (veteran/senior/first responder) need a matching ID #
  if (c.require_id) {
    const want = String(c.id_number || "").trim().toUpperCase();
    const got = String(idNo || "").trim().toUpperCase();
    if (!got) return { ok: false, error: "this coupon needs your ID # (" + (c.kind || "verified") + ")" };
    if (got !== want) return { ok: false, error: "ID # does not match" };
    return { ok: true };
  }
  return { ok: true };
}
app.post("/api/coupons/validate", (req, res) => {
  const c = db.prepare("SELECT * FROM coupons WHERE code=? AND active=1").get((req.body?.code || "").toUpperCase());
  if (!c || (c.max_uses != null && c.uses >= c.max_uses)) return res.json({ valid: false, code: req.body?.code });
  const v = couponVerify(c, req.body?.id_number);
  if (!v.ok) return res.json({ valid: false, error: v.error, need_id: true, kind: c.kind });
  res.json({ valid: true, code: c.code, percent: c.percent, note: c.note, kind: c.kind, require_id: !!c.require_id, id_number: c.require_id ? c.id_number : undefined });
});
function priceQuote(l, days, couponRow) {
  const daily = l.daily ?? 0, weekly = l.weekly, monthly = l.monthly;
  let base = daily * days;
  if (weekly) base = Math.min(base, Math.floor(days / 7) * weekly + (days % 7) * daily);
  if (monthly) base = Math.min(base, Math.floor(days / 30) * monthly + (days % 30) * daily);
  let discount = 0;
  if (couponRow && (couponRow.max_uses == null || couponRow.uses < couponRow.max_uses)) discount = Math.round(base * couponRow.percent) / 100;
  return { base: Math.round(base * 100) / 100, discount, total: Math.round((base - discount) * 100) / 100 };
}

/* ─── bookings ────────────────────────────────────────── */
function blog(bookingId, event, detail, actor) {
  db.prepare("INSERT INTO booking_logs (booking_id, event, detail, actor) VALUES (?,?,?,?)").run(bookingId, event, detail || null, actor || "system");
}
app.post("/api/bookings", auth(true), (req, res) => {
  const { trailer_id, start_date, days = 1, coupon } = req.body || {};
  const t = db.prepare("SELECT * FROM trailers WHERE id=? AND status='live'").get(Number(trailer_id));
  if (!t) return res.status(404).json({ error: "trailer not found" });
  if (t.owner_id === req.user.id) return res.status(400).json({ error: "you can't book your own listing" });
  const owner_state = (t.st || t.state || "").toString().toUpperCase();
  if (!start_date || Number(days) < 1) return res.status(400).json({ error: "start_date and days required" });
  let couponRow = null;
  if (coupon) {
    couponRow = db.prepare("SELECT * FROM coupons WHERE code=? AND active=1").get(String(coupon).toUpperCase());
    if (!couponRow || (couponRow.max_uses != null && couponRow.uses >= couponRow.max_uses)) return res.status(400).json({ error: "invalid coupon" });
    if (couponRow.require_id) {
      const v = couponVerify(couponRow, (req.body || {}).id_number);
      if (!v.ok) return res.status(400).json({ error: v.error, need_id: true });
    }
  }
  // platform-fee subscription: user listings earn free during the founding trial month;
  // the FOLLOWING MONTH bills automatically via stripe customer card (card_on_file). until stripe lands, owner must have an active paid tier.
  if (t.src === "user" && t.owner_id) {
    const ow = db.prepare("SELECT tier, paid_until, card_on_file, stripe_customer FROM users WHERE id=?").get(t.owner_id);
    const trialLeft = ow?.paid_until && String(ow.paid_until).slice(0, 10) >= new Date().toISOString().slice(0, 10);
    if (ow?.tier !== "paid" && !trialLeft) {
      return res.status(402).json({ error: "owner trial ended — subscription to the platform fee is required before this trailer can be booked", owner_subscribe: true });
    }
  }
  const q = priceQuote(t, Number(days), couponRow);
  // owner fee (8% for the first 1000 signups, else 10%) + CA sales tax on rental subtotal
  const ownerRow = t.owner_id ? db.prepare("SELECT * FROM users WHERE id=?").get(t.owner_id) : null;
  const feePct = ownerFeePct(ownerRow);
  const taxState = owner_state;
  const taxAmount = taxState === "CA" ? Math.round(q.total * FEE.caTaxPct) / 100 : 0;
  const totalWithTax = Math.round((q.total + taxAmount) * 100) / 100;
  const ownerPayout = Math.round(q.total * (1 - feePct / 100) * 100) / 100;
  const code = "RMT-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const r = db.prepare(`INSERT INTO bookings (code, user_id, trailer_id, start_date, days, base, discount, total, deposit, coupon_code, tax_amount, tax_state, owner_payout)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, req.user.id, t.id, start_date, Number(days), q.base, q.discount, totalWithTax, numOr(t.deposit, 0), couponRow?.code || null, taxAmount, taxState, ownerPayout);
  if (couponRow) db.prepare("UPDATE coupons SET uses=uses+1 WHERE code=?").run(couponRow.code);
  // seed the thread between renter + owner (real messaging ties into booking)
  if (t.owner_id) {
    const ex = db.prepare("SELECT id FROM threads WHERE trailer_id=? AND renter_id=?").get(t.id, req.user.id);
    if (!ex) db.prepare("INSERT INTO threads (trailer_id, renter_id, clearance) VALUES (?,?, 'approved')").run(t.id, req.user.id);
  }
  blog(r.lastInsertRowid, "created", `booking ${code} · ${Number(days)}d from ${start_date} · total ${totalWithTax}${taxAmount ? " (incl. CA tax " + taxAmount.toFixed(2) + ")" : ""} · owner payout ${ownerPayout.toFixed(2)} (${feePct}%) · deposit ${numOr(t.deposit,0)}${couponRow ? " · coupon " + couponRow.code : ""}`, req.user.email);
  const row = db.prepare("SELECT * FROM bookings WHERE id=?").get(r.lastInsertRowid);
  res.json({ ok: true, booking: row, balance_due: q.total });
});
app.get("/api/bookings", auth(true), (req, res) => {
  const rows = db.prepare(`SELECT b.*, t.title, t.city, t.state, t.lat, t.lng FROM bookings b JOIN trailers t ON t.id=b.trailer_id
    WHERE b.user_id=? ORDER BY b.id DESC`).all(req.user.id);
  res.json({ rows });
});
app.post("/api/bookings/:code/cancel", auth(true), (req, res) => {
  const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(req.params.code);
  if (!b || b.user_id !== req.user.id) return res.status(403).json({ error: "not yours" });
  db.prepare("UPDATE bookings SET payment_state='cancelled' WHERE id=?").run(b.id);
  // release coupon use
  if (b.coupon_code) db.prepare("UPDATE coupons SET uses=MAX(uses-1,0) WHERE code=?").run(b.coupon_code);
  blog(b.id, "cancelled", `booking ${b.code} cancelled`, req.user.email);
  res.json({ ok: true });
});

/* ─── booking lifecycle: detail, extensions, damage claims ─── */
function bookingAccess(code) {
  const b = db.prepare(`SELECT b.*, t.owner_id, t.title, t.cat, t.city, t.state, t.img, t.daily
    FROM bookings b JOIN trailers t ON t.id=b.trailer_id WHERE b.code=?`).get(code);
  return b;
}
app.get("/api/bookings/:code", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.user_id !== req.user.id && b.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "not your booking" });
  res.json({
    booking: b,
    logs: db.prepare("SELECT event, detail, actor, logged_on FROM booking_logs WHERE booking_id=? ORDER BY id ASC").all(b.id),
    extensions: db.prepare("SELECT * FROM extension_requests WHERE booking_id=? ORDER BY id DESC").all(b.id),
    claims: db.prepare("SELECT * FROM damage_claims WHERE booking_id=? ORDER BY id DESC").all(b.id),
    is_owner: b.owner_id === req.user.id,
  });
});

app.post("/api/bookings/:code/extension", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.user_id !== req.user.id) return res.status(403).json({ error: "only the renter can extend" });
  if (b.payment_state === "cancelled") return res.status(400).json({ error: "cancelled bookings can't be extended" });
  const days = Math.floor(Number(req.body?.days));
  if (!days || days < 1) return res.status(400).json({ error: "days >= 1 required" });
  const extra = Math.round((b.daily ?? 0) * days * 100) / 100;
  const r = db.prepare("INSERT INTO extension_requests (booking_id, added_days, reason, extra_total, requested_by) VALUES (?,?,?,?,?)")
    .run(b.id, days, String(req.body?.reason || "").trim() || null, extra, req.user.id);
  blog(b.id, "extension-requested", `+${days} day(s) — $${extra.toFixed(2)} extra · pending owner approval`, req.user.email);
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.post("/api/bookings/:code/extensions/:id/decide", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "only the owner can approve or deny" });
  const x = db.prepare("SELECT * FROM extension_requests WHERE id=? AND booking_id=?").get(Number(req.params.id), b.id);
  if (!x) return res.status(404).json({ error: "no such extension request" });
  if (x.status !== "pending") return res.status(400).json({ error: "already decided" });
  const approve = req.body?.decide === "approve";
  db.prepare("UPDATE extension_requests SET status=?, decided_by=?, decided_on=datetime('now') WHERE id=?")
    .run(approve ? "approved" : "denied", req.user.id, x.id);
  if (approve) {
    db.prepare("UPDATE bookings SET days=?, total=? WHERE id=?")
      .run(b.days + x.added_days, Math.round((b.total + x.extra_total) * 100) / 100, b.id);
  }
  blog(b.id, approve ? "extension-approved" : "extension-denied",
    `+${x.added_days} day(s)${approve ? ` — total now $${(b.total + x.extra_total).toFixed(2)}` : ""}`, req.user.email);
  res.json({ ok: true, status: approve ? "approved" : "denied" });
});

app.post("/api/bookings/:code/claim", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  const isRenter = b.user_id === req.user.id, isOwner = b.owner_id === req.user.id;
  if (!isRenter && !isOwner && req.user.role !== "admin") return res.status(403).json({ error: "not your booking" });
  const desc = String(req.body?.description || "").trim();
  if (desc.length < 10) return res.status(400).json({ error: "describe the damage in at least 10 characters" });
  const party = isOwner ? "owner" : "renter";
  const r = db.prepare("INSERT INTO damage_claims (booking_id, filed_by, party, description, claimed_amount) VALUES (?,?,?,?,?)")
    .run(b.id, req.user.id, party, desc, Math.max(0, Number(req.body?.amount) || 0));
  blog(b.id, "damage-claim", `${party} filed — ${desc.slice(0, 80)}`, req.user.email);
  secAlert(`dc:${req.params.code}:${Math.floor(Date.now()/600000)}`, `[RMT] damage claim — ${req.params.code} ($${Math.max(0, Number(req.body?.amount) || 0).toFixed(2)})`, `<h2 style="margin:0 0 8px">Damage claim filed</h2><p style="color:#333">Booking <b>${req.params.code}</b> (${b.title}) — ${party}: ${String(desc).slice(0, 160)} · claimed $${Math.max(0, Number(req.body?.amount) || 0).toFixed(2)} by ${req.user.email}.</p>`);
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.post("/api/bookings/:code/claims/:id/resolve", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "only the owner can resolve" });
  const c = db.prepare("SELECT * FROM damage_claims WHERE id=? AND booking_id=?").get(Number(req.params.id), b.id);
  if (!c) return res.status(404).json({ error: "no such claim" });
  if (c.status !== "open") return res.status(400).json({ error: "already resolved" });
  const status = req.body?.decide === "deny" ? "denied" : "resolved";
  db.prepare("UPDATE damage_claims SET status=?, resolution=?, resolved_on=datetime('now') WHERE id=?")
    .run(status, String(req.body?.resolution || "").trim() || null, c.id);
  blog(b.id, status === "resolved" ? "claim-resolved" : "claim-denied",
    `claim #${c.id} (${c.party}) — ${c.description.slice(0, 80)}`, req.user.email);
  res.json({ ok: true, status });
});

/* ─── deposit photos (real uploads, stored on disk) ───── */
const up = multer({ storage: multer.diskStorage({
  destination: (_req, _f, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(10).toString("hex") + path.extname(file.originalname || ".jpg")),
}), limits: { fileSize: 8 * 1024 * 1024 } });
app.post("/api/deposit-photos/:bookingCode", auth(true), up.single("photo"), (req, res) => {
  const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(req.params.bookingCode);
  if (!b || (b.user_id !== req.user.id && req.user.role !== "admin")) return res.status(403).json({ error: "not your booking" });
  const { role = "renter", stage = "dropoff", slot = "hitch" } = req.body || {};
  if (!["renter", "owner"].includes(role) || !["dropoff", "pickup"].includes(stage) || !["hitch", "tires", "corners", "extras"].includes(slot))
    return res.status(400).json({ error: "bad role/stage/slot" });
  if (!req.file) return res.status(400).json({ error: "photo file required" });
  db.prepare(`INSERT OR REPLACE INTO deposit_photos (booking_id, role, stage, slot, file) VALUES (?,?,?,?,?)`)
    .run(b.id, role, stage, slot, req.file.filename);
  if (stage === "pickup" && role === "owner" && db.prepare("SELECT COUNT(*) c FROM deposit_photos WHERE booking_id=? AND stage='pickup' AND role='owner'").get(b.id).c === 4) {
    db.prepare("UPDATE bookings SET deposit_state='pending-release' WHERE id=?").run(b.id);
  blog(b.id, "deposit-pending-release", "all 4 owner pickup photos on file", req.user.email);
  }
  const have = db.prepare("SELECT COUNT(*) c FROM deposit_photos WHERE booking_id=? AND stage='dropoff'").get(b.id).c;
  if (stage === "dropoff" && have >= 4) {
    db.prepare("UPDATE bookings SET deposit_state='held' WHERE id=?").run(b.id);
    blog(b.id, "deposit-held", "4/4 dropoff photos on file — deposit held", req.user.email);
  }
  res.json({ ok: true, file: "/uploads/" + req.file.filename, slots_done: db.prepare("SELECT stage, role, COUNT(*) c FROM deposit_photos WHERE booking_id=? GROUP BY stage, role").all(b.id) });
});
app.get("/api/deposit-photos/:bookingCode", auth(true), (req, res) => {
  const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(req.params.bookingCode);
  if (!b) return res.status(404).json({ error: "no booking" });
  res.json({ rows: db.prepare("SELECT role, stage, slot, file, taken_on FROM deposit_photos WHERE booking_id=?").all(b.id), deposit_state: b.deposit_state });
});
app.use("/uploads", express.static(UPLOADS, { maxAge: "30d" }));

/* ─── receipts + AI email ─────────────────────────────── */
function renderReceipt(b) {
  const t = db.prepare("SELECT title FROM trailers WHERE id=?").get(b.trailer_id);
  const amount = Math.round((b.total) * 100) / 100;
  const number = "RCPT-" + b.code;
  const subject = `Rent My Trailer receipt ${number} — ${t?.title || "trailer"} (${b.days} day${b.days>1?"s":""})`;
  const body = [
    `Receipt ${number}`,
    `Booking code: ${b.code}`,
    `Trailer: ${t?.title || b.trailer_id}`,
    `Rental window: ${b.start_date} for ${b.days} day(s)`,
    `Base: $${b.base.toFixed(2)}`,
    b.discount > 0 ? `Coupon ${b.coupon_code}: -$${b.discount.toFixed(2)}` : null,
    `Charged at booking: $${b.total.toFixed(2)}`,
    `Refundable deposit at pickup: $${b.deposit.toFixed(2)}`,
    ``,
    `Payment state: ${b.payment_state} · Deposit state: ${b.deposit_state}`,
    `Issued: ${new Date().toISOString()}`,
  ].filter(Boolean).join("\n");
  return { number, amount, deposit: numOr(b.deposit,0), subject, body };
}

async function aiWriteEmail(context, prompt) {
  const base = process.env.RMT_OLLAMA || "http://10.0.0.131:11434";
  const model = process.env.RMT_AI_MODEL || "glm-5.3:cloud";
  const r = await fetch(`${base}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false,
      messages: [
        { role: "system", content: "You write short, clear rental business emails. Plain text, no markdown, no signatures." },
        { role: "user", content: `${prompt}\n\nFACTS:\n${context}` },
      ], options: { temperature: 0.4, num_predict: 400 } }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const j = await r.json();
  return String(j?.message?.content || "").trim();
}

function sendMailViaSmtp(_to, _subject, _body) {
  // real SMTP: set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_PORT and this is wired; no silent fakes
  return null;
}

function receiptNumber(bookingId) { return "RCPT-" + crypto.randomBytes(4).toString("hex").toUpperCase() + "-" + bookingId; }

app.post("/api/bookings/:code/receipt", auth(true), async (req, res) => {
  const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(req.params.code);
  if (!b || (b.user_id !== req.user.id && req.user.role !== "admin")) return res.status(403).json({ error: "not your booking" });
  const ex = db.prepare("SELECT * FROM receipts WHERE booking_id=?").get(b.id);
  const rec = ex || (() => {
    const r0 = renderReceipt(b);
    const number = receiptNumber(b.id);
    db.prepare("INSERT INTO receipts (booking_id, number, amount, deposit, coupon_code, issued_to, status) VALUES (?,?,?,?,?,?, 'draft')")
      .run(b.id, number, r0.amount, r0.deposit, b.coupon_code, req.user.email);
    blog(b.id, "receipt-issued", number, req.user.email);
    return db.prepare("SELECT * FROM receipts WHERE booking_id=?").get(b.id);
  })();
  const r0 = renderReceipt(b);
  if (req.body?.compose === "ai") {
    try {
      const ai = await aiWriteEmail(r0.body, req.body?.prompt || "Write the receipt email to send to the renter with their booking details.");
      db.prepare("UPDATE receipts SET email_subject=?, email_body=? WHERE id=?").run(r0.subject, ai, rec.id);
    } catch (e) {
      return res.status(502).json({ error: "ai email failed: " + String(e).slice(0, 120), receipt: rec });
    }
  } else {
    db.prepare("UPDATE receipts SET email_subject=?, email_body=? WHERE id=?").run(r0.subject, r0.body, rec.id);
  }
  const out = db.prepare("SELECT * FROM receipts WHERE booking_id=?").get(b.id);
  const smtp = process.env.SMTP_HOST ? { configured: true } : { configured: false, note: "set SMTP_HOST/SMTP_USER/SMTP_PASS to enable real sending" };
  res.json({ ok: true, receipt: out, smtp });
});
app.get("/api/bookings/:code/receipt", auth(true), (req, res) => {
  const b = db.prepare("SELECT * FROM bookings WHERE code=? AND user_id=?").get(req.params.code, req.user.id);
  if (!b) return res.status(404).json({ error: "no booking" });
  res.json({ receipt: db.prepare("SELECT * FROM receipts WHERE booking_id=?").get(b.id) || null });
});
app.get("/api/bookings/:code/logs", auth(true), (req, res) => {
  const b = db.prepare("SELECT id FROM bookings WHERE code=?").get(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  res.json({ rows: db.prepare("SELECT event, detail, actor, logged_on FROM booking_logs WHERE booking_id=? ORDER BY id ASC").all(b.id) });
});
app.get("/api/my/receipts", auth(true), (req, res) => {
  res.json({ rows: db.prepare(`SELECT r.*, b.code FROM receipts r JOIN bookings b ON b.id=r.booking_id WHERE r.issued_to=? ORDER BY r.id DESC`).all(req.user.email) });
});

/* ─── messaging (REST + ws) ───────────────────────────── */
app.get("/api/messages/threads", auth(true), (req, res) => {
  const rows = db.prepare(`SELECT th.id, th.trailer_id, th.clearance, th.updated_on, t.title, t.owner_id,
    COALESCE((SELECT text FROM messages m WHERE m.thread_id=th.id ORDER BY m.id DESC LIMIT 1), '') last,
    (SELECT COUNT(*) FROM messages m WHERE m.thread_id=th.id) n
    FROM threads th JOIN trailers t ON t.id=th.trailer_id
    WHERE th.renter_id=? OR t.owner_id=? ORDER BY th.updated_on DESC`).all(req.user.id, req.user.id);
  // clearances: 'requested'/'pending' gate applies to free tier on renter side
  res.json({ rows: rows.map((r) => ({ ...r, role: r.owner_id === req.user.id ? "owner" : "renter", title: r.title })) });
});
function threadFor(id, u) {
  return db.prepare(`SELECT th.*, t.owner_id, t.title FROM threads th JOIN trailers t ON t.id=th.trailer_id WHERE th.id=?`).get(Number(id));
}
app.get("/api/messages/:threadId", auth(true), (req, res) => {
  const th = threadFor(req.params.threadId, req.user);
  if (!th) return res.status(404).json({ error: "no thread" });
  if (th.renter_id !== req.user.id && th.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "not your thread" });
  const rows = db.prepare("SELECT m.id, m.user_id, m.text, m.sent_on, u.display_name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.thread_id=? ORDER BY m.id ASC").all(th.id);
  res.json({ thread: { id: th.id, trailer_id: th.trailer_id, title: th.title, clearance: th.clearance, renter_id: th.renter_id, owner_id: th.owner_id, role: th.owner_id === req.user.id ? "owner" : "renter" }, rows });
});
app.post("/api/messages/:threadId", auth(true), (req, res) => {
  const th = threadFor(req.params.threadId);
  if (!th) return res.status(404).json({ error: "no thread" });
  if (th.renter_id !== req.user.id && th.owner_id !== req.user.id) return res.status(403).json({ error: "not your thread" });
  const text = String(req.body?.text || "").slice(0, 4000).trim();
  if (!text) return res.status(400).json({ error: "text required" });
  // paid-gate: free-tier renter without clearance sends a clearance request first
  if (req.user.id === th.renter_id && req.user.tier !== "paid" && th.clearance === "none") {
    db.prepare("UPDATE threads SET clearance='requested', updated_on=datetime('now') WHERE id=?").run(th.id);
    db.prepare("INSERT INTO messages (thread_id, user_id, text) VALUES (?,?,?)").run(th.id, req.user.id, "🔑 Clearance requested to start booking conversation.");
    broadcast(th.id);
    return res.json({ ok: true, clearance: "requested" });
  }
  if (req.user.id === th.owner_id && th.clearance === "requested") {
    // owner reply approves clearance
    db.prepare("UPDATE threads SET clearance='approved', updated_on=datetime('now') WHERE id=?").run(th.id);
  } else {
    db.prepare("UPDATE threads SET updated_on=datetime('now') WHERE id=?").run(th.id);
  }
  db.prepare("INSERT INTO messages (thread_id, user_id, text) VALUES (?,?,?)").run(th.id, req.user.id, text);
  broadcast(th.id);
  res.json({ ok: true, clearance: db.prepare("SELECT clearance FROM threads WHERE id=?").get(th.id).clearance });
});
/* ─── AI: assistant + auto-listing from user text ─────── */
const AI_SYS = "You are the Rent My Trailer assistant. Short, practical, plain text. You help renters pick trailers and help owners price and list theirs. No markdown.";
/* digest of inventory, regenerated on reseed (see digest.py) */
const RMT_DIGEST = (() => {
  try { return fs.readFileSync(path.join(__dirname, "data", "ai-digest.txt"), "utf8").trim(); }
  catch { return "Inventory data unavailable."; }
})();
const RMT_STOP = new Set("the and for have need wanting needs want wants wanted this that with rent rentals looking near there what about your you are any can get does day week how much from into they them those where when which would could should please just also than then over under some more most all every each".split(" "));
let RMT_RATES = null;
function rmtRates() {
  if (RMT_RATES) return RMT_RATES;
  const num = x => { const n = Number(x); return Number.isFinite(n) ? n : null; };
  const med = v => { v = v.filter(x => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? "$" + Math.round(v[Math.floor((v.length - 1) / 2)]) : "n/a"; };
  const ROWS = db.prepare(`SELECT cat, daily, weekly, monthly FROM trailers WHERE status='live'`).all();
  const g = new Map();
  for (const r of ROWS) {
    const k = (r.cat || "Other").split(",")[0].trim().replace(/ Trailer Rentals$/, "").replace(" with Living Quarters", " + LQ");
    if (!g.has(k)) g.set(k, { d: [], w: [], m: [] });
    const b = g.get(k);
    const dv = num(r.daily), wv = num(r.weekly), mv = num(r.monthly);
    if (dv > 0) b.d.push(dv); if (wv > 0) b.w.push(wv); if (mv > 0) b.m.push(mv);
  }
  const lines = [ROWS.length + " live trailers — typical rates:"];
  for (const [k, b] of [...g.entries()].sort((a, c) => c[1].d.length - a[1].d.length).slice(0, 8)) {
    lines.push(`- ${k}: ~${med(b.d)}/day · ${med(b.w)}/wk · ${med(b.m)}/mo`);
  }
  RMT_RATES = lines.join("\n");
  return RMT_RATES;
}
function searchTrailers(text) {
  const toks = (String(text).toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(w => !RMT_STOP.has(w) && !/^\d+$/.test(w));
  if (!toks.length) return [];
  const SEL = "id, title, cat, daily, weekly, deposit, city, st, zip, dims, hitch, weight";
  const L = w => `%${w}%`;
  const loc = db.prepare(`SELECT ${SEL} FROM trailers WHERE status='live' AND (${toks.map(() => "(city LIKE ? OR st LIKE ? OR zip LIKE ?)").join(" OR ")}) LIMIT 30`).all(...toks.flatMap(w => [L(w), L(w), L(w)]));
  const kind = db.prepare(`SELECT ${SEL} FROM trailers WHERE status='live' AND (${toks.map(() => "(cat LIKE ? OR title LIKE ?)").join(" OR ")}) LIMIT 50`).all(...toks.flatMap(w => [L(w), L(w)]));
  const seen = new Map();
  for (const t of [...loc, ...kind]) if (!seen.has(t.id)) seen.set(t.id, t);
  const ranked = [...seen.values()].map(t => {
    const locWords = new Set(`${t.city || ""} ${t.st || ""} ${t.zip || ""}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const kindWords = new Set(`${t.cat || ""} ${t.title || ""}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const locScore = toks.filter(w => locWords.has(w)).length;
    const score = locScore * 3 + toks.filter(w => kindWords.has(w)).length * 2;
    return { t, score, locScore };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  return { rows: ranked.slice(0, 6).map(r => r.t), anyLoc: ranked.some(r => r.locScore > 0) };
}
function listingsPrompt(rows) {
  if (!rows.length) return null;
  return rows.map(t => {
    const parts = [`#${t.id} ${t.title || "Trailer"} (${t.cat || "type n/a"}) — $${t.daily == null ? "?" : t.daily}/day`];
    if (t.weekly) parts.push(`$${t.weekly}/wk`);
    parts.push(`${t.city || "?"}${t.st ? ", " + t.st : ""}${t.zip ? " " + t.zip : ""}`);
    parts.push(`deposit ${t.deposit != null ? "$" + t.deposit : "varies"}`);
    if (t.dims) parts.push(t.dims);
    if (t.hitch) parts.push(t.hitch);
    return parts.join(" · ");
  }).join("\n");
}
async function aiChat(messages, opts = {}) {
  const base = process.env.RMT_OLLAMA || "http://10.0.0.131:11434";
  const model = process.env.RMT_AI_MODEL || "glm-5.3:cloud";
  const r = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, messages, keep_alive: opts.keep_alive ?? "2h", options: { temperature: opts.temperature ?? 0.5, num_predict: opts.num_predict ?? 600 } }) });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const j = await r.json();
  return String(j?.message?.content || "").trim();
}
app.post("/api/ai/chat", auth(false), async (req, res) => {
  try {
    const { messages = [] } = req.body || {};
    if (!messages.length) return res.status(400).json({ error: "messages required" });
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const { rows, anyLoc } = searchTrailers(lastUser?.content || "");
    const live = listingsPrompt(rows);
    const PRICING_RE = /\b(cost|costs|price|prices|pricing|rate|rates|much|month|monthly|week|weekly|cheap|afford)\b/i;
    if (!anyLoc && PRICING_RE.test(lastUser?.content || "")) {
      // deterministic rate sheet from live inventory — no LLM guessing
      return res.json({ ok: true, reply: rmtRates() + `\n\nTell me your city and trailer type and I'll pull exact listings, e.g. "dump trailer San Antonio".` });
    }
    if (rows.length >= 3 && anyLoc) {
      // hot path: exact listings straight from DB, no LLM latency
      return res.json({ ok: true, reply: `Found ${rows.length} matching trailers:\n\n${live}\n\nTo book, say "book #<id> for <start date> for <n> days". Want me to check delivery availability for any of them?`, listings: rows });
    }
    const sys = { role: "system", content: `${AI_SYS}\n\nINVENTORY KNOWLEDGE:\n${RMT_DIGEST}${live ? `\n\nLIVE LISTINGS matched to the user's ask (recommend ONLY from these, with their IDs):\n${live}` : "\n\n(LIVE LISTINGS: none matched — do not invent any; ask the user for city or trailer type.)"}` };
    const text = await aiChat([sys, ...messages.slice(-11).filter(m => m.role === "user" || m.role === "assistant")]);
    res.json({ ok: true, reply: text });
  } catch (e) { res.status(502).json({ error: String(e).slice(0, 140) }); }
});
const LISTING_SCHEMA_HINT = `Return ONLY a JSON object with these keys:
title (short headline), cat (one of: Dump Trailer, Car Hauler, Utility Trailer, Enclosed Trailer, Flatbed, Horse Trailer, Motorcycle Trailer, Boat Trailer),
daily (number), weekly (number or null), monthly (number or null), deposit (number), city, state, zip, hitch (Bumper Pull/Gooseneck/Fifth Wheel/Pintle or null),
dims, weight (lbs), delivery (true/false), delivery_radius (number miles), desc (2-3 sentence clean description from their input).`;
app.post("/api/ai/listing", auth(true), async (req, res) => {
  try {
    const text = String(req.body?.text || "").slice(0, 6000);
    if (!text) return res.status(400).json({ error: "text required" });
    const raw = await aiChat([
      { role: "system", content: `You convert owner trailer descriptions into structured rental listings. ${LISTING_SCHEMA_HINT}` },
      { role: "user", content: text },
    ], { temperature: 0.2, num_predict: 700 });
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    res.json({ ok: true, listing: parsed });
  } catch (e) { res.status(502).json({ error: "ai listing failed: " + String(e).slice(0, 140) }); }
});
app.post("/api/messages/:threadId/clear", auth(true), (req, res) => {
  // owner approves/denies a clearance request
  const th = threadFor(req.params.threadId);
  if (!th || th.owner_id !== req.user.id) return res.status(403).json({ error: "owner only" });
  db.prepare("UPDATE threads SET clearance=?, updated_on=datetime('now') WHERE id=?").run(req.body?.approve ? "approved" : "none", th.id);
  broadcast(th.id);
  res.json({ ok: true, clearance: req.body?.approve ? "approved" : "none" });
});

/* ─── platform DM (team ↔ any user's inbox) + star ratings ──── */
const PLATFORM_TITLE = "🚚 Rent My Trailer — Team";
function platformTrailerId() {
  let t = db.prepare("SELECT id FROM trailers WHERE src='platform' LIMIT 1").get();
  if (!t) {
    try { db.prepare("INSERT OR IGNORE INTO trailers (id, src, title, status, owner_id) VALUES (900000001, 'platform', ?, 'paused', 1)").run(PLATFORM_TITLE); } catch {}
    t = db.prepare("SELECT id FROM trailers WHERE src='platform' LIMIT 1");
  }
  return t ? t.id : 1;
}
function ensurePlatformThread(userId) {
  const pid = platformTrailerId();
  const has = db.prepare("SELECT id FROM threads WHERE trailer_id=? AND renter_id=?").get(pid, userId);
  if (!has) db.prepare("INSERT INTO threads (trailer_id, renter_id, clearance) VALUES (?,?,'approved')").run(pid, userId);
  return db.prepare("SELECT id FROM threads WHERE trailer_id=? AND renter_id=?").get(pid, userId).id;
}
app.get("/api/admin/dm/users", auth(true), (req, res) => {
  if (!["admin","owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const rows = db.prepare("SELECT id, email, display_name, tier, role FROM users ORDER BY id DESC LIMIT 5000").all();
  res.json({ rows, me: req.user.id });
});
app.post("/api/admin/dm", auth(true), (req, res) => {
  if (!["admin","owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const text = String(req.body?.text || "").trim().slice(0, 3000);
  if (!text) return res.status(400).json({ error: "text required" });
  const broadcast = !!req.body?.broadcast;
  let targets = broadcast
    ? db.prepare("SELECT id FROM users WHERE id != ?").all(req.user.id)
    : (Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Number.isFinite) : []);
  targets = [...new Set(targets.map((t) => t.id || t))];
  const sent = [];
  for (const uid of targets) {
    try {
      const thId = ensurePlatformThread(uid);
      db.prepare("INSERT INTO messages (thread_id, user_id, text) VALUES (?,?,?)").run(thId, req.user.id, text);
      db.prepare("UPDATE threads SET updated_on=datetime('now') WHERE id=?").run(thId);
      broadcast(thId);
      sent.push(thId);
    } catch {}
  }
  secAlertScore("dm", `${req.user.email} → ${sent.length} inbox(es) (${broadcast ? "broadcast" : "direct"})`);
  res.json({ ok: true, sent: sent.length, thread_ids: sent.slice(-10) });
});
/* star ratings */
app.get("/api/trailers/:id/ratings", (req, res) => {
  const r = db.prepare("SELECT ROUND(AVG(stars),1) a, COUNT(*) c FROM ratings WHERE trailer_id=?").get(Number(req.params.id)) || {};
  res.json({ avg: r.a || null, count: r.c || 0 });
});
app.post("/api/trailers/:id/ratings", auth(true), (req, res) => {
  const stars = Math.max(1, Math.min(5, Math.round(Number(req.body?.stars) || 0)));
  if (!stars) return res.status(400).json({ error: "stars 1-5 required" });
  const tid = Number(req.params.id);
  if (!db.prepare("SELECT id FROM trailers WHERE id=?").get(tid)) return res.status(404).json({ error: "no trailer" });
  db.prepare("INSERT INTO ratings (trailer_id, user_id, stars, note) VALUES (?,?,?,?) ON CONFLICT(trailer_id, user_id) DO UPDATE SET stars=excluded.stars, note=excluded.note")
    .run(tid, req.user.id, stars, String(req.body?.note || "").slice(0, 500));
  const r = db.prepare("SELECT ROUND(AVG(stars),1) a, COUNT(*) c FROM ratings WHERE trailer_id=?").get(tid);
  res.json({ ok: true, avg: r.a || null, count: r.c || 0 });
});
/* ─── top rankers: profile completion leaderboard (public) ── */
app.get("/api/profile/top", (_req, res) => {
  const rows = db.prepare("SELECT id, display_name, email, picture, avatar_file, bio, phone, phone_verified FROM users").all();
  const scored = rows.map((u) => {
    let got = 0;
    if (u.email) got++;
    if (u.picture || u.avatar_file) got++;
    if (u.bio && u.bio.length >= 40) got += 2; else if (u.bio) got++;
    if (u.phone) got++;
    if (u.phone_verified) got++;
    return { id: u.id, display_name: u.display_name, email: u.email, picture: u.picture, bio: u.bio, score: Math.round((got / 6) * 100) };
  }).filter((u) => u.score > 0).sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 10);
  res.json({ rows: scored });
});

/* ─── strip relay from haksterai.com: activate RMT membership ("payments via haksterai id") ── */
app.post("/api/stripe/relay", express.json(), (req, res) => {
  const paySecret = process.env.RMT_PAY_SECRET || "";
  if (!paySecret || req.headers["x-rmt-secret"] !== paySecret) return res.status(403).json({ error: "forbidden" });
  const { rmt_user_id, rmt_email, stripe_customer, subscription_id } = req.body || {};
  const uid = Number(rmt_user_id);
  if (!uid) return res.status(400).json({ error: "rmt_user_id required" });
  const until = new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 10);
  db.prepare("UPDATE users SET tier='paid', paid_until=?, card_on_file=1, stripe_customer=COALESCE(NULLIF(?,''), stripe_customer) WHERE id=?").run(until, stripe_customer || "", uid);
  const row = db.prepare("SELECT id, email, tier, paid_until FROM users WHERE id=?").get(uid);
  if (!row) return res.status(404).json({ error: "user not found" });
  console.log(`[pay-relay] membership activated for #${uid} (${row.email}) until ${until}`);
  return res.json({ ok: true, tier: "paid", paid_until: until, subscription: subscription_id || null });
});

/* ─── statics ─────────────────────────────────────────── */
/* index.html must never be cached (asset hashes change per build); hashed assets are immutable */
app.use(express.static(DIST, { index: false, setHeaders: (res, fp) => {
  if (fp.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  else if (fp.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
} }));

app.get("/api/site-status", (_req, res) => {
  const on = String(process.env.RMT_MAINT_ON || "") === "1";
  res.json({ on, title: process.env.RMT_MAINT_TITLE || "MEMBERS' YARD — LIVE", msg: process.env.RMT_MAINT_MSG || "" });
});
app.get("/api/donate", (_req, res) => {
  const url = process.env.RMT_DONATE_URL || "";
  if (!url) return res.status(503).json({ error: "no donate link configured" });
  res.json({ url });
});
app.get("/api/health", (_req, res) => {
  const counts = { trailers: db.prepare("SELECT COUNT(*) c FROM trailers WHERE status='live'").get().c };
  res.json({ status: "ok", counts, uptime_s: Math.round(process.uptime()) });
});


/* ─── websocket hub for live chat ─────────────────────── */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const conns = new Map(); // ws -> {uid, threads:Set}
function broadcast(threadId) {
  const msg = JSON.stringify({ type: "refresh", threadId });
  for (const [ws, meta] of conns) ws.readyState === 1 && meta.threads.has(String(threadId)) && ws.send(msg);
}
const wsHandler = (ws, req) => {
  try {
    const tok = new URL(req.url, "http://x").searchParams.get("token") || "";
    const p = jwt.verify(tok, JWT_SECRET);
    conns.set(ws, { uid: p.uid, threads: new Set((new URL(req.url, "http://x").searchParams.get("threads") || "").split(",").filter(Boolean)) });
    ws.on("close", () => conns.delete(ws));
    ws.on("message", (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.type === "watch" && m.threads) conns.get(ws).threads = new Set(m.threads);
      } catch {}
    });
  } catch { ws.close(4001, "bad token"); }
};
wss.on("connection", wsHandler);
const TLS_DIR = path.join(__dirname, "tls");
const HAVE_TLS = fs.existsSync(path.join(TLS_DIR, "cert.pem")) && fs.existsSync(path.join(TLS_DIR, "key.pem"));
/* TLS present: https on PORT (8111), plain HTTP on 8112 for the tunnel. No TLS: single listener on PORT. */
const HTTP_PORT = process.env.PORT_HTTP || (HAVE_TLS ? 8112 : PORT);

/* ─── boot ────────────────────────────────────────────── */
const seeded = seedTrailers();
const liveCount = () => db.prepare("SELECT COUNT(*) c FROM trailers WHERE status='live'").get().c;
if (HAVE_TLS) {
  const httpsServer = https.createServer({ key: fs.readFileSync(path.join(TLS_DIR, "key.pem")), cert: fs.readFileSync(path.join(TLS_DIR, "cert.pem")) }, app);
  new WebSocketServer({ server: httpsServer, path: "/ws" }).on("connection", wsHandler);
  httpsServer.listen(PORT, () => console.log(`RMT https :${PORT} — trailers live: ${liveCount()}${seeded > 0 ? ` (seeded ${seeded})` : seeded === -1 ? " (seed file missing)" : ""}`));
}
if (HTTP_PORT !== PORT) {
  server.listen(HTTP_PORT, () => console.log(`RMT http :${HTTP_PORT} — trailers live: ${liveCount()}`));
} else if (!HAVE_TLS) {
  server.listen(PORT, () => console.log(`RMT server :${PORT} — trailers live: ${liveCount()}${seeded > 0 ? ` (seeded ${seeded})` : seeded === -1 ? " (seed file missing)" : ""}`));
}

const UP2 = multer({ storage: multer.diskStorage({
  destination: (_req, _f, cb) => cb(null, path.join(UPLOADS, "private")),
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString("hex") + path.extname(file.originalname || ".jpg")),
}), limits: { fileSize: 10 * 1024 * 1024 } });

/* ─── S-FINAL additions: promo, mail, profile, admin, membership, bootcheck ── */
/* ─── admin visits + messaging already above; final wiring below ── */
function pubUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, display_name: row.display_name, bio: row.bio || "", tier: row.tier, role: row.role, picture: row.picture || "", avatar_file: row.avatar_file || "", phone: row.phone || "", phone_verified: !!row.phone_verified, promo_rank: row.promo_rank || null, paid_until: row.paid_until || null, ref_code: row.ref_code || "", created_on: row.created_on, signup_rank: row.signup_rank || null, fee_pct: ownerFeePct(row) };
}
const __mailTransport = null; /* SMTP_HOST/SMTP_USER/SMTP_PASS configure a real SMTP relay; receipts route reports state honestly */
async function sendMail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) throw new Error("no mail provider");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, body: JSON.stringify({ from: process.env.MAIL_FROM || "Rent My Trailer <onboarding@resend.dev>", to, subject, html }) });
  if (!r.ok) throw new Error("mail " + r.status);
}
function emailAdmin(to, subject, html) { return sendMail(to, subject, html); }
function emailShell(html) {
  return `<!doctype html><html><body style="background:#f4f1ea;font-family:Segoe UI,Arial,sans-serif;margin:0"><div style="max-width:640px;margin:0 auto"><div style="background:#16181b;color:#f5b325;font-weight:900;padding:14px 20px;letter-spacing:.1em">RENT MY TRAILER</div>${html}</div></body></html>`;
}
async function emailUser(uid, subject, html) {
  try {
    const row = db.prepare("SELECT email FROM users WHERE id=?").get(uid);
    if (row?.email) await sendMail(row.email, subject, html);
  } catch {}
}
/* admin: all bookings + platform revenue stats */
app.get("/api/admin/bookings", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const rows = db.prepare("SELECT b.*, u.email AS user_email, o.email AS owner_email, t.title FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN users o ON o.id=b.owner_id JOIN trailers t ON t.id=b.trailer_id ORDER BY b.id DESC LIMIT 500").all();
  const money = db.prepare("SELECT COALESCE(SUM(rental_paid_cents),0) rental, COALESCE(SUM(deposit_paid_cents),0) deposits FROM bookings").get();
  const stats = {
    total: rows.length,
    paid: rows.filter((r) => r.payment_state === "paid").length,
    pending: rows.filter((r) => r.payment_state === "pending").length,
  };
  res.json({ rows, stats });
});
app.get("/api/admin/visits", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const daily = db.prepare(`SELECT date(created_on) d, COUNT(*) n FROM visits WHERE created_on > datetime('now','-14 days') GROUP BY d ORDER BY d`).all();
  const byRef = db.prepare(`SELECT COALESCE(NULLIF(ref,''),'direct') ref, COUNT(*) n FROM visits WHERE created_on > datetime('now','-30 days') GROUP BY ref ORDER BY n DESC LIMIT 8`).all();
  const total = daily.reduce((a, x) => a + x.n, 0);
  const uniques = db.prepare("SELECT COUNT(DISTINCT COALESCE(ip, ua)) c FROM visits WHERE created_on > datetime('now','-14 days')").get().c;
  res.json({ daily, byRef, total, uniques });
});
app.post("/api/kyc/decide", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const uid = Number(req.body?.user_id), state = req.body?.decide === "reject" ? "rejected" : "verified";
  if (!uid) return res.status(400).json({ error: "user_id required" });
  db.prepare("UPDATE users SET kyc_state=? WHERE id=?").run(state, uid);
  secAlert("kyc-" + state, "user #" + uid + " " + state, state === "verified" ? 0 : 2);
  res.json({ ok: true, state });
});
app.post("/api/admin/kick", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const uid = Number(req.body?.user_id);
  if (!uid) return res.status(400).json({ error: "user_id required" });
  db.prepare("UPDATE users SET token_ver=COALESCE(token_ver,0)+1 WHERE id=?").run(uid);
  secAlert("kick", "admin kicked user #" + uid, 2);
  res.json({ ok: true, kicked: uid });
});
/* profile completion: avatar upload + bio (onboarding wizard save) */
app.post("/api/profile", auth(true), UP2.single("avatar"), (req, res) => {
  const bio = String(req.body?.bio || "").slice(0, 480);
  const avatar = req.file ? (path.join("private", "av-" + req.file.filename)) : null;
  const prev = db.prepare("SELECT avatar_file FROM users WHERE id=?").get(req.user.id);
  if (avatar && prev?.avatar_file && prev.avatar_file.startsWith("private/")) { try { fs.unlinkSync(path.join(UPLOADS, prev.avatar_file)); } catch {} }
  db.prepare("UPDATE users SET bio=?, avatar_file=COALESCE(?, avatar_file) WHERE id=?").run(bio, avatar, req.user.id);
  const row = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ ok: true, user: pubUser(row) });
});
app.get("/api/profile/me", auth(true), (req, res) => {
  const row = db.prepare("SELECT id, email, display_name, bio, tier, role, picture, avatar_file, phone, phone_verified, promo_rank, paid_until, signup_rank FROM users WHERE id=?").get(req.user.id);
  res.json({ user: { ...row, avatar_url: row.avatar_file ? "/api/profile/avatar" : (row.picture || ""), bio: row.bio || "" } });
});
app.get("/api/profile/avatar", auth(true), (req, res) => {
  const row = db.prepare("SELECT avatar_file FROM users WHERE id=?").get(req.user.id);
  if (!row?.avatar_file) return res.status(404).end();
  res.sendFile(path.join(UPLOADS, row.avatar_file), (err) => { if (err) res.status(404).end(); });
});
app.get("/api/profile/avatar/by/:uid", (req, res) => {
  const row = db.prepare("SELECT id, display_name, picture, avatar_file, bio FROM users WHERE id=?").get(Number(req.params.uid));
  res.json({ user: row ? { ...row, avatar_url: row.avatar_file ? "/api/avatar/" + row.id : (row.picture || ""), bio: row.bio || "" } : null });
});
app.get("/api/avatar/:id", (req, res) => {
  const row = db.prepare("SELECT avatar_file FROM users WHERE id=?").get(Number(req.params.id));
  if (!row?.avatar_file) return res.status(404).end();
  res.sendFile(path.join(UPLOADS, row.avatar_file), (err) => { if (err) res.status(404).end(); });
});
/* ─── membership: pricing + member-count + upgrade/start + webhook handled above ── */
const PROMO_CAP = Number(process.env.RMT_PROMO_CAP || 1000);          // founding cohort: first 1000 signups
const FEES = {
  ownerPct: Number(process.env.RMT_PLATFORM_FEE_OWNER_PCT ?? 10),     // cut of the owner's earnings
  renterPct: Number(process.env.RMT_PLATFORM_FEE_RENTER_PCT ?? 0),    // buyer's premium %
};
const FEE = {
  founderPct: Number(process.env.RMT_FOUNDER_FEE_PCT ?? 8),      // first-N signups pay this
  founderCap: Number(process.env.RMT_FOUNDER_FEE_CAP ?? 1000),   // signup-rank cutoff
  caTaxPct: Number(process.env.RMT_CA_TAX_PCT ?? 10.25),         // CA state+district avg on booking subtotal
};
function ownerFeePct(ownerRow) {
  const rank = Number(ownerRow?.signup_rank || 0);
  return rank && rank <= FEE.founderCap ? FEE.founderPct : FEES.ownerPct;
}
const MONTHLY = Number(process.env.RMT_MONTHLY || 39);
const TAX_RATE = Number(process.env.RMT_TAX_RATE || 0.0);
const MONTHLY_INCL_TAX = Math.round(MONTHLY * (1 + TAX_RATE) * 100) / 100;
function promoState(row) {
  const paidUntil = row?.paid_until ? String(row.paid_until).slice(0, 10) : "";
  const active = !row?.promo_rank && !!paidUntil && paidUntil >= new Date().toISOString().slice(0, 10);
  return { promo_rank: row?.promo_rank || null, paid_until: paidUntil || null, promo_active: active };
}
app.get("/api/pricing", (_req, res) => {
  const claimedRanks = db.prepare("SELECT COUNT(*) c FROM users WHERE signup_rank > 0 AND signup_rank <= ?").get(FEE.founderCap).c;
  const perks = [
    "Unlimited listings + boosted placement",
    "Direct chat with renters (no middleman)",
    "Priority booking requests + analytics",
    `${FEE.founderPct}% platform fee for the first ${FEE.founderCap.toLocaleString()} signups — you keep ${100 - FEE.founderPct}% of every rental`,
    "CA sales tax added at checkout for California renters",
    "Founding member badge + support-first replies",
  ];
  res.json({
    monthly: MONTHLY, monthly_incl_tax: MONTHLY_INCL_TAX, tax_rate: TAX_RATE,
    owner_fee_pct: FEES.ownerPct,
    founder: { fee_pct: FEE.founderPct, cap: FEE.founderCap, claimed: claimedRanks, remaining: Math.max(FEE.founderCap - claimedRanks, 0) },
    ca_tax_pct: FEE.caTaxPct,
    perks,
  });
});
app.get("/api/member-count", (_req, res) => {
  const claimed = db.prepare("SELECT COUNT(*) c FROM users WHERE tier != 'free'").get().c;
  res.json({ claimed, remaining: Math.max(PROMO_CAP - claimed, 0) });
});
app.post("/api/auth/upgrade/start", auth(true), startRmtCheckout);
app.get("/api/admin/bootcheck", (_req, res) => {
  const out = [];
  const chk = (name, ok, note) => out.push({ name, ok, note });
  const live = db.prepare("SELECT COUNT(*) c FROM trailers WHERE status='live'").get().c;
  chk("Inventory seeded", live > 1000, live + " live listings");
  chk("JWT secret", !!process.env.RMT_JWT_SECRET, "auth tokens");
  chk("SMS (textbee) key", !!process.env.RMT_TEXTBEE_API_KEY, "customer texts");
  chk("SMTP", !!process.env.SMTP_HOST, "receipts + alerts");
  res.json({ checks: out, all_ok: out.every((c0) => c0.ok), at: new Date().toISOString() });
});
/* security alert helpers */
const secEvents = [];
function secAlertScore(kind, detail, weight = 1) {
  secEvents.push({ kind, detail, weight, at: new Date().toISOString().replace("T", " ").slice(0, 19) });
}
function secAlert(kind, detail, sendNow = false, html = "") {
  secAlertScore(kind, String(detail).slice(0, 300), typeof sendNow === "number" ? sendNow : 2);
}
let secDigestBusy = false;
async function secDigest() {
  if (secDigestBusy || !secEvents.length) return;
  secDigestBusy = true;
  const batch = secEvents.splice(0, secEvents.length);
  const list = batch.map((x) => "• [" + x.kind + "] " + x.detail).join("<br>");
  const total = batch.reduce((a, x) => a + x.weight, 0);
  const sev = total >= 8 ? "HIGH" : total >= 4 ? "MED" : "INFO";
  try {
    await sendMail(ADMIN_EMAIL, "[" + sev + "] RMT security — " + batch.length + " events",
      emailShell("<h2>Security digest — " + sev + "</h2><div style=\"font:13px monospace;color:#444\">" + list + "</div>"));
  } catch {}
  secDigestBusy = false;
}
setInterval(() => { secDigest().catch(() => {}); }, 10 * 60 * 1000);
/* admin security score — deterministic 0-100 from live signals */
app.get("/api/admin/security-score", auth(true), (req, res) => {
  if (!["admin","owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const fails24 = loginFails.filter((f) => now - f.at < day);
  const secWeight24 = secEvents.reduce((a, x) => a + x.weight, 0);
  const backups = fs.existsSync("/home/ghost/backups");
  const envPerms = (() => { try { return (fs.statSync(path.join(__dirname, ".env")).mode & 0o077) === 0; } catch { return false; } })();
  const checks = [
    { name: "JWT signing secret", ok: !!process.env.RMT_JWT_SECRET, pts: 10 },
    { name: "TLS (https) active", ok: HAVE_TLS, pts: 10 },
    { name: "SMTP (receipts + alerts)", ok: !!process.env.SMTP_HOST, pts: 10 },
    { name: "SMS gateway (textbee)", ok: !!process.env.RMT_TEXTBEE_API_KEY, pts: 10 },
    { name: "Stripe (cards + ID verify)", ok: !!process.env.STRIPE_SECRET_KEY, pts: 10 },
    { name: "Failed logins last 24h < 20", ok: fails24.length < 20, pts: 15, note: `${fails24.length} failed logins in 24h` },
    { name: "Security events last 24h low", ok: secEvents.length === 0 || secWeight24 < 4, pts: 15, note: `${secEvents.length} event(s), weight ${secWeight24}` },
    { name: "Backups present", ok: backups, pts: 15 },
    { name: ".env locked to owner", ok: envPerms, pts: 5 },
  ];
  const pts = checks.reduce((a, c) => a + c.pts, 0);
  const got = checks.filter((c) => c.ok).reduce((a, c) => a + c.pts, 0);
  const score = Math.max(0, Math.min(100, Math.round((got / pts) * 100)));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  res.json({
    score, grade, weight_total: pts,
    failed_logins_24h: fails24.map((f) => ({ at: new Date(f.at).toISOString().slice(0, 19), email: f.email, ip: f.ip })),
    security_events_24h: secEvents,
    checks,
    at: new Date().toISOString(),
  });
});

/* ─── FINAL WIRING v2: incoming requests, Stripe Identity, admin SMS (textbee) ── */
app.get("/api/bookings/incoming", auth(true), (req, res) => {
  const rows = db.prepare("SELECT b.*, t.title FROM bookings b JOIN trailers t ON t.id=b.trailer_id WHERE t.owner_id=? AND b.payment_state='pending' AND b.created_on > datetime('now','-30 days') ORDER BY b.id DESC LIMIT 100").all(req.user.id);
  res.json({ ok: true, rows: [] });
});
app.post("/api/identity", auth(true), async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return res.status(503).json({ error: "Stripe not configured — set STRIPE_SECRET_KEY to enable ID verification" });
  try {
    const body = new URLSearchParams({ "type": "id_number" });
    const r = await fetch("https://api.stripe.com/v1/identity/verification_sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || "stripe " + r.status);
    res.json({ ok: true, session_id: j.id, client_secret: j.client_secret, status: j.status });
  } catch (e) { res.status(502).json({ error: String(e).slice(0, 160) }); }
});
app.post("/api/admin/sms-test", auth(true), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const to = String(req.body?.to || "").slice(0, 24), text = String(req.body?.text || "Rent My Trailer test").slice(0, 300);
  const TBK = process.env.RMT_TEXTBEE_API_KEY, TBD = process.env.RMT_TEXTBEE_DEVICE_ID;
  if (!TBK || !TBD) return res.status(503).json({ error: "textbee not configured — set RMT_TEXTBEE_API_KEY + RMT_TEXTBEE_DEVICE_ID (textbee.dev free tier, no card)" });
  try {
    const r = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(TBD)}/send-sms`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": TBK }, body: JSON.stringify({ recipients: [to], message: text }) });
    const j = await r.json().catch(() => ({}));
    const at = new Date().toISOString().replace("T", " ").slice(0, 19);
    try { db.prepare("INSERT INTO sms_log (to_, text, state, at) VALUES (?,?,?,?)").run(to, text, r.ok ? "sent" : "failed:" + r.status, at); } catch {}
    res.json({ ok: r.ok, data: j.data || null });
  } catch (e) { res.status(502).json({ error: String(e).slice(0, 160) }); }
});
app.get("/api/admin/sms-log", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  try {
    const rows = db.prepare("SELECT to_, text, state, at FROM sms_log ORDER BY rowid DESC LIMIT 50").all();
    res.json({ rows });
  } catch { res.json({ rows: [] }); }
});
/* SPA fallback — LAST: only unmatched non-API GETs reach here */
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  res.set("Cache-Control", "no-store");
  return res.sendFile(path.join(DIST, "index.html"), (err) => { if (err) res.status(404).end(); });
});
