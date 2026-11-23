/* topreels-links.js — tracked redirect links + append-only event ledger.
 *
 * Scope: server-issued stable link IDs, server-side redirects, idempotent
 * impression/click/conversion events, bot filtering, and stats that always
 * separate total from unique and human from bot.
 *
 * This module never invents conversions, commission rates, or payouts. Only a
 * provider-verified event can later be marked converted, and that is a separate
 * human-reviewed step.
 */
import crypto from "node:crypto";

const MAX_URL = 2048;
const BOT_UA = /(bot|crawler|spider|crawling|slurp|bingpreview|google-inspectiontool|headlesschrome|lighthouse|curl\/|wget\/|python-requests|python-urllib|node-fetch|axios\/|go-http-client|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|semrushbot|ahrefsbot|mj12bot|yandexbot|baiduspider|petalbot|applebot)/i;

export function isBotUa(ua) {
  const s = String(ua || "").trim();
  if (!s) return true; // no UA at all is treated as non-human traffic
  if (BOT_UA.test(s)) return true;
  if (s.length < 18) return true; // truncated/garbage UA
  return false;
}

export function newLinkId() {
  // 22 chars of base32 lower-case: stable, URL-safe, non-sequential.
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = crypto.randomBytes(22);
  let out = "";
  for (let i = 0; i < 22; i++) out += alphabet[bytes[i] % 32];
  return out;
}

export function visitorHash(ip, ua, dayBucket) {
  return crypto.createHash("sha256").update(`${ip || "-"}|${ua || "-"}|${dayBucket || ""}`).digest("hex").slice(0, 32);
}

function safeHttpsUrl(raw) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null; // never carry credentials in a tracked link
  if (!u.hostname.includes(".")) return null;
  const s = u.toString();
  if (s.length > MAX_URL) return null;
  return s;
}

/** Create the ledger tables on the given database (idempotent). */
export function initLinkLedger(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS topreels_links (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT '',
      site_id TEXT NOT NULL DEFAULT '',
      asset_id TEXT NOT NULL DEFAULT '',
      hook_id TEXT NOT NULL DEFAULT '',
      campaign_id TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      external_post_id TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'referral',
      destination_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS topreels_link_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id TEXT NOT NULL REFERENCES topreels_links(id),
      event_key TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('impression','click','conversion')),
      visitor_hash TEXT NOT NULL DEFAULT '',
      is_bot INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'direct',
      amount_cents INTEGER,
      currency TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      provider_txn_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      meta TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_tre_events_link ON topreels_link_events(link_id, type);
    CREATE INDEX IF NOT EXISTS idx_tre_events_time ON topreels_link_events(received_at);
    CREATE INDEX IF NOT EXISTS idx_tre_links_owner ON topreels_links(owner_id, created_at);
  `);
  return database;
}

export function createLinkLedger(database) {
  initLinkLedger(database);
  const q = {
    insertLink: database.prepare(`INSERT INTO topreels_links
      (id, owner_id, site_id, asset_id, hook_id, campaign_id, platform, external_post_id, kind, destination_url)
      VALUES (?,?,?,?,?,?,?,?,?,?)`),
    getLink: database.prepare(`SELECT * FROM topreels_links WHERE id = ?`),
    insertEvent: database.prepare(`INSERT OR IGNORE INTO topreels_link_events
      (link_id, event_key, type, visitor_hash, is_bot, source, amount_cents, currency, provider, provider_txn_id, status, occurred_at, meta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`),
    eventType: database.prepare(`SELECT type FROM topreels_link_events WHERE link_id = ? AND event_key = ?`),
    statTotals: database.prepare(`SELECT type, COUNT(*) n FROM topreels_link_events WHERE link_id = ? GROUP BY type`),
    statUnique: database.prepare(`SELECT COUNT(DISTINCT visitor_hash) n FROM topreels_link_events WHERE link_id = ? AND type = 'click' AND is_bot = 0 AND visitor_hash <> ''`),
    statBot: database.prepare(`SELECT COUNT(*) n FROM topreels_link_events WHERE link_id = ? AND type = ? AND is_bot = 1`),
    statConverted: database.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) cents FROM topreels_link_events WHERE link_id = ? AND type = 'conversion' AND status = 'verified'`),
    statLast: database.prepare(`SELECT MAX(received_at) last FROM topreels_link_events WHERE link_id = ?`),
    listEvents: database.prepare(`SELECT id, type, is_bot, source, amount_cents, currency, provider, provider_txn_id, status, occurred_at, received_at FROM topreels_link_events WHERE link_id = ? ORDER BY id DESC LIMIT ?`),
  };

  function createLink(input = {}) {
    const destination = safeHttpsUrl(input.destination_url);
    if (!destination) return { ok: false, error: "destination_url must be a credential-free https URL" };
    const kind = ["referral", "ad", "affiliate"].includes(input.kind) ? input.kind : "referral";
    const id = newLinkId();
    q.insertLink.run(
      id,
      String(input.owner_id || "").slice(0, 64),
      String(input.site_id || "").slice(0, 80),
      String(input.asset_id || "").slice(0, 80),
      String(input.hook_id || "").slice(0, 80),
      String(input.campaign_id || "").slice(0, 80),
      String(input.platform || "").slice(0, 32),
      String(input.external_post_id || "").slice(0, 120),
      kind,
      destination,
    );
    return { ok: true, id, destination_url: destination, kind };
  }

  function getLink(id) {
    return q.getLink.get(String(id || "")) || null;
  }

  function recordEvent(linkId, event = {}) {
    const link = getLink(linkId);
    if (!link) return { ok: false, error: "unknown link" };
    if (Number(link.revoked)) return { ok: false, error: "link revoked" };
    const type = String(event.type || "");
    if (!["impression", "click", "conversion"].includes(type)) return { ok: false, error: "type must be impression, click, or conversion" };
    const eventKey = String(event.event_key || "").trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(eventKey)) return { ok: false, error: "event_key must be 8-128 chars (uuid-style)" };

    const ua = String(event.ua || "");
    const occurredAt = String(event.occurred_at || new Date().toISOString());
    if (!/^\d{4}-\d{2}-\d{2}T/.test(occurredAt)) return { ok: false, error: "occurred_at must be ISO-8601" };

    let amountCents = null;
    if (type === "conversion") {
      const n = Number(event.amount_cents);
      if (!Number.isInteger(n) || n < 0) return { ok: false, error: "conversion needs integer amount_cents" };
      if (event.status !== "verified") return { ok: false, error: "conversion can only be recorded as verified by the payment provider" };
      if (!String(event.provider || "").trim()) return { ok: false, error: "conversion needs provider" };
      if (!/^[A-Z]{3}$/.test(String(event.currency || ""))) return { ok: false, error: "conversion needs ISO-4217 currency" };
      amountCents = n;
    }

    const day = occurredAt.slice(0, 10);
    const vh = visitorHash(event.ip, ua, day);
    const isBot = isBotUa(ua) ? 1 : 0;
    const meta = JSON.stringify({
      ref: String(event.ref || "").slice(0, 300),
      path: String(event.path || "").slice(0, 300),
      country: String(event.country || "").slice(0, 8),
    });
    const r = q.insertEvent.run(
      link.id, eventKey, type, vh, isBot, String(event.source || "direct").slice(0, 64),
      amountCents, String(event.currency || "").toUpperCase(), String(event.provider || "").slice(0, 40),
      String(event.provider_txn_id || "").slice(0, 120), String(event.status || ""), occurredAt, meta,
    );
    if (Number(r.changes) === 1) return { ok: true, inserted: true, duplicate: false, type, is_bot: !!isBot };
    const seen = q.eventType.get(link.id, eventKey);
    return { ok: true, inserted: false, duplicate: true, type: seen ? seen.type : type, note: "idempotent retry — event already recorded" };
  }

  /** Records the click for a redirect, using a per-request event key. */
  function clickThrough(link, req = {}) {
    const eventKey = crypto.randomBytes(16).toString("hex");
    return recordEvent(link.id, {
      type: "click",
      event_key: eventKey,
      ip: req.ip,
      ua: req.ua,
      ref: req.ref,
      path: req.path,
      source: req.source || link.platform || "redirect",
      occurred_at: new Date().toISOString(),
    });
  }

  function stats(linkId, limit = 25) {
    const link = getLink(linkId);
    if (!link) return { ok: false, error: "unknown link" };
    const totals = Object.fromEntries(q.statTotals.all(link.id).map((r) => [r.type, r.n]));
    const bots = Object.fromEntries(["impression", "click", "conversion"].map((t) => [t, q.statBot.get(link.id, t).n]));
    const conv = q.statConverted.get(link.id);
    return {
      ok: true,
      link: {
        id: link.id, kind: link.kind, destination_url: link.destination_url, site_id: link.site_id,
        owner_id: link.owner_id, asset_id: link.asset_id, hook_id: link.hook_id,
        campaign_id: link.campaign_id, platform: link.platform, external_post_id: link.external_post_id,
        created_at: link.created_at, revoked: !!link.revoked,
      },
      totals: {
        impressions_total: totals.impression || 0,
        impressions_human: (totals.impression || 0) - bots.impression,
        clicks_total: totals.click || 0,
        clicks_human: (totals.click || 0) - bots.click,
        clicks_unique_human: q.statUnique.get(link.id).n,
        conversions_total: totals.conversion || 0,
      },
      bots: { impressions: bots.impression, clicks: bots.click },
      verified_conversions: { count: conv.n, amount_cents: conv.cents },
      last_event_at: q.statLast.get(link.id).last || null,
      source: "topreels_link_ledger",
      recent: q.listEvents.all(link.id, Math.min(Math.max(Number(limit) || 25, 1), 200)),
    };
  }

  return { createLink, getLink, recordEvent, clickThrough, stats };
}

/**
 * Mounts the public redirect and the owner-only management endpoints.
 * `isOwner(req)` must be supplied by the caller (existing owner-session check).
 */
export function mountTopReelsLinks(app, { ledger, isOwner, rateLimit = 240, publicBase = "", allowedOrigins = [] }) {
  if (!ledger) throw new Error("ledger required");
  if (typeof isOwner !== "function") throw new Error("isOwner required");

  const origins = new Set(allowedOrigins.map((o) => String(o).replace(/\/+$/, "")));
  function setCors(req, res) {
    const origin = String(req.get("origin") || "").replace(/\/+$/, "");
    if (!origin || !origins.has(origin)) return false;
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    });
    return true;
  }
  app.options(["/api/topreels/links", "/api/topreels/links/:id/events", "/api/topreels/links/:id/stats"], (req, res) =>
    setCors(req, res) ? res.status(204).end() : res.status(403).json({ error: "origin not allowed" }));

  const hits = new Map();
  const allow = (ip) => {
    const now = Date.now();
    let e = hits.get(ip);
    if (!e || now - e.startedAt >= 60_000) { e = { startedAt: now, count: 0 }; hits.set(ip, e); }
    e.count++;
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.startedAt >= 60_000) hits.delete(k);
    return e.count <= rateLimit;
  };

  app.post("/api/topreels/links", (req, res) => {
    setCors(req, res);
    if (!isOwner(req)) return res.status(403).json({ error: "owner sign-in required" });
    const body = req.body || {};
    const created = ledger.createLink({ ...body, owner_id: body.owner_id || "owner" });
    if (!created.ok) return res.status(400).json({ error: created.error });
    const base = String(publicBase || "").replace(/\/+$/, "");
    res.set("Cache-Control", "no-store").json({ ...created, url: `${base}/r/${created.id}` });
  });

  app.get("/r/:id", (req, res) => {
    const link = ledger.getLink(req.params.id);
    if (!link || Number(link.revoked)) return res.status(404).type("text/plain").send("Link not found");
    if (!allow(String(req.ip || req.socket.remoteAddress || "unknown"))) return res.status(429).type("text/plain").send("Too many requests");
    ledger.clickThrough(link, {
      ip: req.ip,
      ua: req.get("user-agent") || "",
      ref: req.get("referer") || "",
      path: req.path,
      source: req.query.src ? String(req.query.src).slice(0, 64) : link.platform,
    });
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" }).redirect(302, link.destination_url);
  });

  app.post("/api/topreels/links/:id/events", (req, res) => {
    setCors(req, res);
    const link = ledger.getLink(req.params.id);
    if (!link) return res.status(404).json({ error: "unknown link" });
    const type = String(req.body?.type || "");
    if (type === "conversion" && !isOwner(req)) {
      return res.status(403).json({ error: "conversions are recorded server-side after provider verification" });
    }
    if (!allow(String(req.ip || req.socket.remoteAddress || "unknown"))) return res.status(429).json({ error: "rate limit reached" });
    const out = ledger.recordEvent(link.id, {
      ...req.body,
      type,
      ip: req.ip,
      ua: req.get("user-agent") || "",
      ref: req.get("referer") || "",
    });
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.set("Cache-Control", "no-store").json(out);
  });

  app.get("/api/topreels/links/:id/stats", (req, res) => {
    setCors(req, res);
    if (!isOwner(req)) return res.status(403).json({ error: "owner sign-in required" });
    const out = ledger.stats(req.params.id, Number(req.query.limit) || 25);
    if (!out.ok) return res.status(404).json({ error: out.error });
    res.set("Cache-Control", "no-store").json(out);
  });
}
