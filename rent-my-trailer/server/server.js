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
import { autoVerifyId } from "./kyc-auto.js";
import { isOllamaUp, pickModel } from "./ad-agent.js";
import { archiveNetworkAdCampaigns, archivedCreativeUrl } from "./network-ads-archive.js";
import { scanWebsite, verifyOwnership, discoverSitemap, fetchPageSnapshot, fetchRobotsTxt, captureOmpPage } from "./site-migration.js";
import { createLinkLedger, mountTopReelsLinks } from "./topreels-links.js";
import { registerTopReelsGiveaway } from "./topreels-giveaway.js";
import { ensureTopReelsToolTables, registerTopReelsTools } from "./topreels-tools.js";
import { applyStripeConversion } from "./topreels-conversions.js";
import { ensureTopReelsWalletTables, registerTopReelsWallet } from "./topreels-wallet.js";
import { ensureTopReelsCrawlTables, createMigrationCrawler, registerTopReelsMigrationCrawl } from "./topreels-migration-crawl.js";
import { ensureTopReelsCustomerAdTables, registerTopReelsCustomerAds } from "./topreels-customer-ads.js";
import { ensureTopReelsSocialTables, registerTopReelsSocialPublish } from "./topreels-social-publish.js";

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
const TOPREELS_HOST = "topreels-3230f40cc3.haksterai.com";

const app = express();
app.set("trust proxy", true); /* cloudflared fronts us: honour X-Forwarded-Proto/Host */
/* Community feed storage — isolated from the sponsored-ad rotation/feed. */
db.exec(`
  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    created_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS community_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS community_likes (
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_on TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (post_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(id DESC);
  CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, id);
  CREATE TABLE IF NOT EXISTS network_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT UNIQUE,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    headline TEXT NOT NULL,
    support TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL,
    cta TEXT NOT NULL DEFAULT 'LEARN MORE',
    status TEXT NOT NULL DEFAULT 'active',
    created_on TEXT NOT NULL DEFAULT (datetime('now')),
    updated_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_network_campaigns_feed ON network_campaigns(status,id DESC);
  CREATE TABLE IF NOT EXISTS network_ad_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE,
    campaign_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('impression','click')),
    site TEXT NOT NULL,
    slot_index INTEGER NOT NULL DEFAULT 0,
    created_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_network_ad_events_campaign_type ON network_ad_events(campaign_id,event_type);
  CREATE TABLE IF NOT EXISTS site_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    source_url TEXT NOT NULL,
    project_name TEXT NOT NULL,
    business_type TEXT NOT NULL DEFAULT 'website',
    status TEXT NOT NULL DEFAULT 'ownership_required',
    verification_token TEXT NOT NULL,
    scan_json TEXT NOT NULL DEFAULT '{}',
    owner_authorized INTEGER NOT NULL DEFAULT 0,
    admin_note TEXT NOT NULL DEFAULT '',
    created_on TEXT NOT NULL DEFAULT (datetime('now')),
    updated_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_site_migrations_owner ON site_migrations(user_id,id DESC);
  CREATE INDEX IF NOT EXISTS idx_site_migrations_status ON site_migrations(status,id DESC);
`);

const DIST = process.env.RMT_DIST || path.join(__dirname, "..", "app", "dist");
const JWT_SECRET = process.env.RMT_JWT_SECRET;
if (!JWT_SECRET) throw new Error("RMT_JWT_SECRET missing from server/.env");
ensureTopReelsToolTables(db);
ensureTopReelsWalletTables(db);
ensureTopReelsCrawlTables(db);
ensureTopReelsCustomerAdTables(db);
ensureTopReelsSocialTables(db);
const securityHeaders = (_req, res, next) => {
 if (_req.secure) {
   res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
 }
 const networkAdWidget = ["/api/network-ads/widget", "/api/public/card-frame"].includes(_req.path);
 const isTopReelsHost = String(_req.hostname || "").toLowerCase() === TOPREELS_HOST;
 if (!networkAdWidget) res.setHeader("X-Frame-Options", "DENY");
 res.setHeader("X-Content-Type-Options", "nosniff");
 res.setHeader("Referrer-Policy", "same-origin");
 res.setHeader("Content-Security-Policy", [
   "default-src 'self'",
   "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://unpkg.com https://static.cloudflareinsights.com",
   "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
   "font-src 'self' https://fonts.gstatic.com",
   "img-src 'self' data: blob: https:",
   isTopReelsHost ? "connect-src 'self' https://rmt.haksterai.com https://nominatim.openstreetmap.org https://api.coingecko.com" : "connect-src 'self' https://nominatim.openstreetmap.org",
   isTopReelsHost ? "frame-src 'self' https://rmt.haksterai.com https://www.openstreetmap.org https://calendar.google.com https://phantomide.com" : "frame-src 'self' https://www.openstreetmap.org https://calendar.google.com https://phantomide.com",
   "worker-src 'self'",
   "form-action 'self'",
   "base-uri 'self'",
   "object-src 'none'",
   networkAdWidget ? "frame-ancestors 'self' file: http://10.0.0.210 http://localhost http://127.0.0.1 https://rmt.haksterai.com https://haksterai.com https://*.haksterai.com https://phantomide.com https://flixchill.link https://www.flixchill.link" : "frame-ancestors 'none'",
 ].join("; "));
 next();
};
app.use(securityHeaders);
const rawBodyJson = (req, _res, buf) => { if (Buffer.isBuffer(buf)) req.rawBody = buf; };
app.use(express.json({
 limit: "1mb",
 verify: (req, _res, buf) => { if (Buffer.isBuffer(buf)) req.rawBody = buf; },
}));

/* TopReels is owner-only while it is listed for sale. Google auth is started
   on the RMT origin, then its signed HttpOnly cookie is shared with the
   TopReels wildcard subdomain. Set TOPREELS_OWNER_ONLY=0 after the sale. */
const TOPREELS_SITE_PATH = "/apps/sites/topreels-3230f40cc3";
/* Google accounts allowed to unlock the TopReels owner preview: the RMT admin
   email plus any publisher emails (e.g. the PhantomIDE build owner) via env. */
const TOPREELS_OWNER_EMAILS = new Set(
  (process.env.TOPREELS_OWNER_EMAILS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    .concat([(process.env.RMT_ADMIN_EMAIL || "").toLowerCase()])
);
function requestCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").filter(Boolean).map((c) => {
    const i = c.indexOf("=");
    return i < 0 ? [c.trim(), ""] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
  }));
}
function isTopReelsOwner(req) {
  const token = requestCookies(req).topreels_owner;
  if (!token || TOPREELS_OWNER_EMAILS.size === 0) return false;
  try {
    const p = jwt.verify(token, JWT_SECRET);
    return p.purpose === "topreels-owner" && TOPREELS_OWNER_EMAILS.has(String(p.email || "").toLowerCase());
  } catch { return false; }
}
/* Tracked redirects + append-only event ledger (referrals, ads, bounties).
   Link creation and stats are owner-only; conversions require provider evidence. */
const topReelsLinkLedger = createLinkLedger(db);
mountTopReelsLinks(app, {
  ledger: topReelsLinkLedger,
  isOwner: isTopReelsOwner,
  publicBase: "https://" + TOPREELS_HOST,
  allowedOrigins: ["https://" + TOPREELS_HOST],
});
/* Giveaway status + entries. Public status is origin-gated inside the module;
   everything that writes requires a verified customer or the owner. */
registerTopReelsGiveaway({ app, db, isTopReelsOwner, getTopReelsOwnerEmail, getTopReelsCustomer, topReelsCustomerCors, sendMail, emailShell, probeIdentity: topReelsProbeIdentity });
function getTopReelsOwnerEmail(req) {
  const token = requestCookies(req).topreels_owner;
  if (!token || TOPREELS_OWNER_EMAILS.size === 0) return "";
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    const email = String(claims.email || "").toLowerCase();
    return claims.purpose === "topreels-owner" && TOPREELS_OWNER_EMAILS.has(email) ? email : "";
  } catch { return ""; }
}
app.get("/api/topreels/youtube-key", (req, res) => {
  const hostname = String(req.hostname || "").toLowerCase().replace(/\.$/, "");
  const isTopReelsPage = hostname === TOPREELS_HOST || req.path === TOPREELS_SITE_PATH || req.path.startsWith(TOPREELS_SITE_PATH + "/");
  if (!isTopReelsPage || !isTopReelsOwner(req)) return res.status(403).set("Cache-Control", "no-store").json({ error: "TopReels owner sign-in required" });
  const key = String(process.env.TOPREELS_YOUTUBE_API_KEY || "").trim();
  if (!key) return res.status(503).set("Cache-Control", "no-store").json({ error: "YouTube API key is not configured" });
  res.set("Cache-Control", "no-store, private").json({ key });
});
db.exec(`
  CREATE TABLE IF NOT EXISTS topreels_inventory (
    id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, slug TEXT NOT NULL,
    hostname TEXT NOT NULL UNIQUE, zone TEXT NOT NULL, retired_hostnames TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'available', server_locked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, sold_at TEXT, sold_domain TEXT, buyer_email TEXT, sold_by TEXT,
    lock_changed_at TEXT, lock_changed_by TEXT, zone_verified_at TEXT
  );
  CREATE TABLE IF NOT EXISTS topreels_sales (
    id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE, buyer_email TEXT, sold_at TEXT NOT NULL, sold_by TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_topreels_inventory_status ON topreels_inventory(status,sku);
  CREATE INDEX IF NOT EXISTS idx_topreels_sales_sold_at ON topreels_sales(sold_at DESC);
  CREATE TABLE IF NOT EXISTS topreels_marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, site_url TEXT NOT NULL, owner_name TEXT NOT NULL, owner_email TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('sale','bids')), ask_price_cents INTEGER, description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', source_build_request_id INTEGER UNIQUE, created_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS topreels_marketplace_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL REFERENCES topreels_marketplace_listings(id), bidder_name TEXT NOT NULL,
    bidder_email TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=9900), status TEXT NOT NULL DEFAULT 'pending', created_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS topreels_site_build_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, access_hash TEXT NOT NULL, requester_name TEXT NOT NULL, requester_email TEXT NOT NULL,
    project_name TEXT NOT NULL, description TEXT NOT NULL, marketplace_mode TEXT NOT NULL CHECK(marketplace_mode IN ('sale','bids')),
    status TEXT NOT NULL DEFAULT 'pending_quote', quote_cents INTEGER, stripe_session_id TEXT, checkout_url TEXT,
    payment_verified INTEGER NOT NULL DEFAULT 0, published_url TEXT, final_http_status INTEGER, identity_verified INTEGER NOT NULL DEFAULT 0,
    created_on TEXT NOT NULL DEFAULT (datetime('now')), updated_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS topreels_domain_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, access_hash TEXT NOT NULL, requester_name TEXT NOT NULL, requester_email TEXT NOT NULL,
    domain TEXT NOT NULL, destination_url TEXT NOT NULL, verification_token TEXT NOT NULL, ownership_verified INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending_dns', quote_cents INTEGER, stripe_session_id TEXT, checkout_url TEXT,
    payment_verified INTEGER NOT NULL DEFAULT 0, final_http_status INTEGER, identity_verified INTEGER NOT NULL DEFAULT 0,
    created_on TEXT NOT NULL DEFAULT (datetime('now')), updated_on TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS topreels_marketplace_receipts (
    kind TEXT NOT NULL, request_id INTEGER NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', resend_id TEXT,
    created_on TEXT NOT NULL DEFAULT (datetime('now')), sent_on TEXT, PRIMARY KEY(kind,request_id)
  );
  CREATE INDEX IF NOT EXISTS idx_topreels_marketplace_active ON topreels_marketplace_listings(status,created_on DESC);
  CREATE INDEX IF NOT EXISTS idx_topreels_build_status ON topreels_site_build_requests(status,created_on DESC);
  CREATE INDEX IF NOT EXISTS idx_topreels_domain_status ON topreels_domain_migrations(status,created_on DESC);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS topreels_hosting_requests (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    build_request_id INTEGER NOT NULL REFERENCES topreels_site_build_requests(id),
    hostname TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ownership_pending',
    created_on TEXT NOT NULL DEFAULT (datetime('now')),
    updated_on TEXT NOT NULL DEFAULT (datetime('now')),
    ownership_verified_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_topreels_hosting_user ON topreels_hosting_requests(user_id,created_on DESC);
  CREATE INDEX IF NOT EXISTS idx_topreels_hosting_status ON topreels_hosting_requests(status,created_on DESC);
`);
db.prepare(`INSERT INTO topreels_marketplace_listings(title,site_url,owner_name,owner_email,mode,ask_price_cents,description,status)
  SELECT 'TopReels','https://rmt.haksterai.com/apps/sites/topreels-3230f40cc3/','HaksterAI',?,'bids',NULL,
  'TopReels product and site. Indicative asset-only appraisal: $4,900. Private bids start at $99; submissions are owner-reviewed and do not complete a sale.','active'
  WHERE NOT EXISTS (SELECT 1 FROM topreels_marketplace_listings WHERE title='TopReels' AND site_url='https://rmt.haksterai.com/apps/sites/topreels-3230f40cc3/')`)
  .run(process.env.RMT_ADMIN_EMAIL || 'dekekenneth840@gmail.com');
const TOPREELS_STARTERS = [
  ["tr-build-001","TR-SITE-001","TapLocal","taplocal","snapnest"],
  ["tr-build-002","TR-SITE-002","BookBloom","bookbloom","brightpop"],
  ["tr-build-003","TR-SITE-003","CartDash","cartdash","clickbloom"],
  ["tr-build-004","TR-SITE-004","MenuMingle","menumingle","sparkdeck"],
  ["tr-build-005","TR-SITE-005","EventNest","eventnest","glowgrid"],
  ["tr-build-006","TR-SITE-006","GearGlow","gearglow","mintwave"],
  ["tr-build-007","TR-SITE-007","HomeSpark","homespark","poppilot"],
  ["tr-build-008","TR-SITE-008","StayScout","stayscout","vividnest"],
  ["tr-build-009","TR-SITE-009","CreatorKit","creatorkit","launchloom"],
  ["tr-build-010","TR-SITE-010","ClassPop","classpop","sunnybyte"],
];
const seedTopreelsItem = db.prepare("INSERT OR IGNORE INTO topreels_inventory (id,sku,name,slug,hostname,zone,status,server_locked,created_at) VALUES (?,?,?,?,?,?,'available',0,?)");
const topReelsSeededAt = new Date().toISOString();
for (const [id,sku,name,slug,host] of TOPREELS_STARTERS) seedTopreelsItem.run(id,sku,name,slug,host+".haksterai.com","haksterai.com",topReelsSeededAt);
const topReelsItem = db.prepare("SELECT id,sku,name,slug,hostname,zone,retired_hostnames AS retiredHostnames,status,server_locked AS serverLocked,created_at AS createdAt,sold_at AS soldAt,sold_domain AS soldDomain,buyer_email AS buyerEmail,sold_by AS soldBy,lock_changed_at AS lockChangedAt,lock_changed_by AS lockChangedBy,zone_verified_at AS zoneVerifiedAt FROM topreels_inventory WHERE sku=?");
const topReelsItems = db.prepare("SELECT id,sku,name,slug,hostname,zone,retired_hostnames AS retiredHostnames,status,server_locked AS serverLocked,created_at AS createdAt,sold_at AS soldAt,sold_domain AS soldDomain,buyer_email AS buyerEmail,sold_by AS soldBy,lock_changed_at AS lockChangedAt,lock_changed_by AS lockChangedBy,zone_verified_at AS zoneVerifiedAt FROM topreels_inventory ORDER BY sku");
app.get("/api/admin/topreels/inventory", (req,res) => {
  if (!isTopReelsOwner(req)) return res.status(403).json({error:"TopReels owner sign-in required"});
  try {
    res.set("Cache-Control","no-store, private");
    res.json({version:1,items:topReelsItems.all(),sales:db.prepare("SELECT id,inventory_id AS inventoryId,sku,name,domain,buyer_email AS buyerEmail,sold_at AS soldAt,sold_by AS soldBy FROM topreels_sales ORDER BY sold_at DESC").all()});
  } catch { res.status(500).json({error:"Inventory could not be loaded"}); }
});
app.patch("/api/admin/topreels/inventory/:sku/lock", (req,res) => {
  if (!isTopReelsOwner(req)) return res.status(403).json({error:"TopReels owner sign-in required"});
  if (typeof req.body?.locked !== "boolean") return res.status(400).json({error:"Set locked to true or false."});
  const sku=String(req.params.sku||"").toUpperCase(), item=topReelsItem.get(sku);
  if (!item) return res.status(404).json({error:"SKU not found"});
  const email=getTopReelsOwnerEmail(req), at=new Date().toISOString();
  db.prepare("UPDATE topreels_inventory SET server_locked=?,lock_changed_at=?,lock_changed_by=? WHERE sku=?").run(req.body.locked?1:0,at,email,sku);
  res.set("Cache-Control","no-store, private").json({ok:true,item:topReelsItem.get(sku)});
});
app.patch("/api/admin/topreels/inventory/:sku/zone", async (req,res) => {
  if (!isTopReelsOwner(req)) return res.status(403).json({error:"TopReels owner sign-in required"});
  const zone=String(req.body?.zone||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/\.$/,"");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(zone)||zone.endsWith(".haksterai.com")) return res.status(400).json({error:"Enter a root domain zone, not a HaksterAI subdomain."});
  const sku=String(req.params.sku||"").toUpperCase(),item=topReelsItem.get(sku);
  if (!item) return res.status(404).json({error:"SKU not found"});
  if (item.status!=="available") return res.status(409).json({error:"Only unsold builds can switch zones."});
  if (item.serverLocked) return res.status(423).json({error:"Enable the server before switching zones."});
  const hostname=String(item.hostname).split(".")[0]+"."+zone;
  try {
    const probe=await fetch("https://"+hostname+"/",{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(7000)});
    const type=String(probe.headers.get("content-type")||"").toLowerCase(),html=(await probe.text()).slice(0,150000);
    const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"";
    if (probe.status!==200||!type.includes("text/html")||!title.toLowerCase().includes(item.name.toLowerCase())) return res.status(409).json({error:"Zone switch rejected: exact HTTPS host must return HTTP 200 with this build identity.",httpStatus:probe.status});
    const retired=[...new Set([...(JSON.parse(item.retiredHostnames||"[]")),item.hostname].filter(x=>x&&x!==hostname))];
    db.prepare("UPDATE topreels_inventory SET hostname=?,zone=?,retired_hostnames=?,zone_verified_at=? WHERE sku=?").run(hostname,zone,JSON.stringify(retired),new Date().toISOString(),sku);
    res.set("Cache-Control","no-store, private").json({ok:true,item:topReelsItem.get(sku)});
  } catch { res.status(409).json({error:"Zone switch rejected: hostname could not be verified over HTTPS."}); }
});
app.post("/api/admin/topreels/inventory/:sku/sales", (req,res) => {
  if (!isTopReelsOwner(req)) return res.status(403).json({error:"TopReels owner sign-in required"});
  const sku=String(req.params.sku||"").toUpperCase();
  const domain=String(req.body?.domain||"").trim().toLowerCase().replace(/^https?:\/\//,"").split(/[\/?#]/)[0];
  const buyerEmail=String(req.body?.buyerEmail||"").trim().toLowerCase().slice(0,254);
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)||domain.endsWith(".haksterai.com")) return res.status(400).json({error:"Enter the buyer registered domain, not a HaksterAI subdomain."});
  if (buyerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return res.status(400).json({error:"Enter a valid buyer email or leave it blank."});
  const item=topReelsItem.get(sku);
  if (!item) return res.status(404).json({error:"SKU not found"});
  if (item.status==="sold") return res.status(409).json({error:"This SKU is already marked sold."});
  if (item.serverLocked) return res.status(423).json({error:"This site is server-locked and cannot be sold until enabled."});
  const soldAt=new Date().toISOString(),id=crypto.randomUUID(),soldBy=getTopReelsOwnerEmail(req)||"owner";
  try {
    db.exec("BEGIN IMMEDIATE");
    const current=topReelsItem.get(sku);
    if (!current||current.status!=="available"||current.serverLocked) throw new Error("This SKU is no longer available.");
    db.prepare("INSERT INTO topreels_sales (id,inventory_id,sku,name,domain,buyer_email,sold_at,sold_by) VALUES (?,?,?,?,?,?,?,?)").run(id,current.id,current.sku,current.name,domain,buyerEmail||null,soldAt,soldBy);
    const result=db.prepare("UPDATE topreels_inventory SET status='sold',sold_at=?,sold_domain=?,buyer_email=?,sold_by=? WHERE sku=? AND status='available' AND server_locked=0").run(soldAt,domain,buyerEmail||null,soldBy,sku);
    if (!result.changes) throw new Error("This SKU is no longer available.");
    db.exec("COMMIT");
    const event={id,inventoryId:current.id,sku:current.sku,name:current.name,domain,buyerEmail:buyerEmail||null,soldAt,soldBy};
    res.status(201).set("Cache-Control","no-store, private").json({ok:true,event,item:topReelsItem.get(sku)});
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    const message=String(error?.message||"");
    if (message.includes("UNIQUE constraint failed: topreels_sales.domain")) return res.status(409).json({error:"That registered domain is already recorded in the sale log."});
    if (message.includes("no longer available")) return res.status(409).json({error:message});
    res.status(500).json({error:"Sale could not be recorded"});
  }
});
const topReelsMarketRate = new Map();
function topReelsMarketLimit(req,res){const key=String(req.ip||req.socket.remoteAddress||'unknown'),now=Date.now(),prior=topReelsMarketRate.get(key);if(prior&&now-prior.at<600000&&prior.count>=10){res.status(429).json({ok:false,error:'Too many marketplace requests. Try again later.'});return false;}const entry=prior&&now-prior.at<600000?prior:{at:now,count:0};entry.at=now;entry.count++;topReelsMarketRate.set(key,entry);return true;}
function topReelsMarketUrl(raw){try{const u=new URL(String(raw||''));return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:null;}catch{return null;}}
function topReelsMarketEmail(raw){const e=String(raw||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e:'';}
function topReelsMarketHash(raw){return crypto.createHash('sha256').update(String(raw||'')).digest('hex');}
async function topReelsProbeIdentity(rawUrl, expected){
  try{const u=new URL(rawUrl);if(u.protocol!=='https:'||u.username||u.password)return {ok:false,status:null,reason:'https_required'};const dns=await import('node:dns/promises'),net=await import('node:net'),rows=await dns.lookup(u.hostname,{all:true,verbatim:true});const isPublic=(ip)=>{if(net.isIP(ip)===4){const a=ip.split('.').map(Number);return !(a[0]===10||a[0]===127||a[0]===0||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127)}if(net.isIP(ip)===6){const x=ip.toLowerCase();return !x.startsWith('::ffff:')&&(x.startsWith('2')||x.startsWith('3'))}return false};if(!rows.length||rows.some(r=>!isPublic(r.address)))return {ok:false,status:null,reason:'unsafe_dns'};const r=await fetch(u.href,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(9000),headers:{'user-agent':'RMT-TopReels-Marketplace/1.0'}});if(r.status!==200)return {ok:false,status:r.status,reason:'http_status'};const text=(await r.text()).slice(0,2_000_000);return text.toLowerCase().includes(String(expected||'').trim().toLowerCase())?{ok:true,status:200,reason:'verified'}:{ok:false,status:200,reason:'identity_mismatch'};}catch(e){return {ok:false,status:null,reason:/timeout|abort/i.test(String(e.message))?'timeout_or_tls_error':'dns_or_network_error'};}
}
async function topReelsStripeCheckout({email,amountCents,name,description,successUrl,cancelUrl,metadata}){
  const key=String(process.env.STRIPE_SECRET_KEY||'').trim();if(!key)throw new Error('Stripe checkout is not configured.');
  const fields=new URLSearchParams({mode:'payment',customer_email:email,success_url:successUrl,cancel_url:cancelUrl,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(amountCents),'line_items[0][price_data][product_data][name]':String(name).slice(0,120),'line_items[0][price_data][product_data][description]':String(description).slice(0,500)});
  for(const [k,v] of Object.entries(metadata||{}))fields.set('metadata['+k+']',String(v));const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},body:fields,signal:AbortSignal.timeout(12000)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.url||!d.id)throw new Error(d.error?.message||'Stripe could not create the checkout session.');return d;
}
async function topReelsSendMarketplaceReceipt(kind,id,email,amountCents){
  const existing=db.prepare('SELECT status,resend_id FROM topreels_marketplace_receipts WHERE kind=? AND request_id=?').get(kind,id);if(existing?.status==='sent')return {sent:true,id:existing.resend_id};
  db.prepare("INSERT OR IGNORE INTO topreels_marketplace_receipts(kind,request_id,email,status) VALUES(?,?,?,'pending')").run(kind,id,email);
  const receiptId=`topreels-${kind}-${id}`;try{await sendMail(email,`TopReels payment receipt — $${(amountCents/100).toFixed(2)}`,emailShell(`<h2>Payment receipt</h2><p>Stripe confirmed your payment of <b>$${(amountCents/100).toFixed(2)} USD</b>.</p><p>Reference: ${escapeHtml(receiptId)}</p><p>Work starts after verified payment. Site publication or domain authorization follows the required HTTPS HTTP 200 and site identity checks.</p>`));db.prepare("UPDATE topreels_marketplace_receipts SET status='sent',resend_id=?,sent_on=datetime('now') WHERE kind=? AND request_id=?").run(receiptId,kind,id);return {sent:true,id:receiptId};}catch(e){console.warn('[topreels-marketplace] receipt pending:',e.message);return {sent:false,id:null};}
}
app.get('/api/topreels/marketplace/listings',(_req,res)=>{try{const listings=db.prepare("SELECT id,title,site_url,mode,ask_price_cents,description,created_on FROM topreels_marketplace_listings WHERE status='active' ORDER BY created_on DESC LIMIT 50").all();res.set('Cache-Control','no-store').json({ok:true,listings});}catch{res.status(503).json({ok:false,error:'Marketplace is unavailable.'});}});
app.post('/api/topreels/marketplace/listings',(req,res)=>{if(!topReelsMarketLimit(req,res))return;const b=req.body||{},title=String(b.title||'').trim().slice(0,120),url=topReelsMarketUrl(b.site),name=String(b.name||'').trim().slice(0,100),email=topReelsMarketEmail(b.email),mode=b.mode==='bids'?'bids':'sale',ask=Number.isFinite(Number(b.askPrice))&&Number(b.askPrice)>0?Math.round(Number(b.askPrice)*100):null;if(!title||!url||!name||!email)return res.status(400).json({ok:false,error:'Provide a site name, HTTPS URL, your name, and valid email.'});try{const r=db.prepare("INSERT INTO topreels_marketplace_listings(title,site_url,owner_name,owner_email,mode,ask_price_cents,description,status) VALUES(?,?,?,?,?,?,?,'pending')").run(title,url,name,email,mode,ask,String(b.description||'').trim().slice(0,2000));res.status(201).json({ok:true,id:Number(r.lastInsertRowid),status:'pending'});}catch{res.status(503).json({ok:false,error:'Could not save the listing request.'});}});
app.post('/api/topreels/marketplace/listings/:id/bids',(req,res)=>{if(!topReelsMarketLimit(req,res))return;const id=Number(req.params.id),b=req.body||{},name=String(b.name||'').trim().slice(0,100),email=topReelsMarketEmail(b.email),cents=Math.round(Number(b.amount)*100);if(!Number.isSafeInteger(id)||id<1||!name||!email||!Number.isSafeInteger(cents)||cents<9900)return res.status(400).json({ok:false,error:'Bids start at $99. Add your name, email, and a valid bid.'});const listing=db.prepare("SELECT id FROM topreels_marketplace_listings WHERE id=? AND status='active' AND mode='bids'").get(id);if(!listing)return res.status(404).json({ok:false,error:'This bidding listing is not active.'});try{const r=db.prepare("INSERT INTO topreels_marketplace_bids(listing_id,bidder_name,bidder_email,amount_cents) VALUES(?,?,?,?)").run(id,name,email,cents);res.status(201).json({ok:true,bidId:Number(r.lastInsertRowid),status:'pending'});}catch{res.status(503).json({ok:false,error:'Bid could not be submitted.'});}});
app.post('/api/topreels/marketplace/domain-migrations',(req,res)=>{if(!topReelsMarketLimit(req,res))return;const b=req.body||{},name=String(b.name||'').trim().slice(0,100),email=topReelsMarketEmail(b.email),domain=String(b.domain||'').trim().toLowerCase().replace(/^https?:\/\//,'').split(/[\/?#]/)[0],site=topReelsMarketUrl(b.site);if(!name||!email||!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)||!site)return res.status(400).json({ok:false,error:'Provide your name, valid email, domain, and HTTPS destination.'});const token=crypto.randomBytes(24).toString('hex');try{const r=db.prepare("INSERT INTO topreels_domain_migrations(access_hash,requester_name,requester_email,domain,destination_url,verification_token) VALUES(?,?,?,?,?,?)").run(topReelsMarketHash(token),name,email,domain,site,token);res.status(201).json({ok:true,id:Number(r.lastInsertRowid),accessToken:token,status:'pending_dns',dns:{type:'TXT',name:'_phantom-site-verification.'+domain,value:token}});}catch{res.status(503).json({ok:false,error:'Domain migration request could not be saved.'});}});
app.post('/api/topreels/marketplace/domain-migrations/:id/verify',(req,res)=>{const id=Number(req.params.id),token=String(req.body?.accessToken||'');if(!Number.isSafeInteger(id)||id<1||token.length<32)return res.status(400).json({ok:false,error:'Request ID and migration token required.'});const row=db.prepare('SELECT * FROM topreels_domain_migrations WHERE id=? AND access_hash=?').get(id,topReelsMarketHash(token));if(!row)return res.status(404).json({ok:false,error:'Migration request not found.'});(async()=>{try{const dns=await import('node:dns/promises'),records=await dns.resolveTxt('_phantom-site-verification.'+row.domain),found=records.some(parts=>parts.join('')===row.verification_token);if(!found)return res.status(409).json({ok:false,verified:false,error:'TXT verification record was not found yet.'});db.prepare("UPDATE topreels_domain_migrations SET ownership_verified=1,status='pending_quote',updated_on=datetime('now') WHERE id=?").run(id);res.json({ok:true,verified:true,status:'pending_quote'});}catch{res.status(409).json({ok:false,verified:false,error:'TXT record is not visible yet.'});}})();});
app.post('/api/topreels/marketplace/site-builds',(req,res)=>{if(!topReelsMarketLimit(req,res))return;const b=req.body||{},name=String(b.name||'').trim().slice(0,100),email=topReelsMarketEmail(b.email),project=String(b.project||'').trim().slice(0,120),description=String(b.description||'').trim().slice(0,3000),mode=b.mode==='bids'?'bids':'sale';if(!name||!email||!project||description.length<20)return res.status(400).json({ok:false,error:'Provide your name, valid email, project name, and a site description of at least 20 characters.'});const token=crypto.randomBytes(24).toString('hex');try{const r=db.prepare('INSERT INTO topreels_site_build_requests(access_hash,requester_name,requester_email,project_name,description,marketplace_mode) VALUES(?,?,?,?,?,?)').run(topReelsMarketHash(token),name,email,project,description,mode);res.status(201).json({ok:true,id:Number(r.lastInsertRowid),accessToken:token,status:'pending_quote'});}catch{res.status(503).json({ok:false,error:'Site build request could not be saved.'});}});
app.get('/api/topreels/marketplace/payment-return',(req,res)=>res.type('html').status(200).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Verifying payment</title><p>Returning to TopReels to verify your payment…</p><script>location.replace('/apps/sites/topreels-3230f40cc3/index.html'+location.search)</script>`));
app.post('/api/topreels/marketplace/payments/verify',async(req,res)=>{const b=req.body||{},kind=b.kind==='domain'?'domain':'build',id=Number(b.id),token=String(b.accessToken||''),sessionId=String(b.sessionId||'');if(!Number.isSafeInteger(id)||id<1||token.length<32||!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId))return res.status(400).json({ok:false,error:'Valid payment verification details are required.'});const table=kind==='build'?'topreels_site_build_requests':'topreels_domain_migrations';const row=db.prepare(`SELECT * FROM ${table} WHERE id=? AND access_hash=?`).get(id,topReelsMarketHash(token));if(!row)return res.status(404).json({ok:false,error:'Payment request not found.'});if(row.payment_verified)return res.json({ok:true,verified:true,status:row.status});const key=String(process.env.STRIPE_SECRET_KEY||'').trim();if(!key)return res.status(503).json({ok:false,error:'Stripe verification is unavailable.'});try{const r=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId),{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)}),session=await r.json();const target=kind==='build'?session.metadata?.build_request_id:session.metadata?.domain_migration_id;if(!r.ok||session.payment_status!=='paid'||session.status!=='complete'||session.mode!=='payment'||String(session.currency).toLowerCase()!=='usd'||Number(session.amount_total)!==Number(row.quote_cents)||String(target)!==String(id)||session.id!==row.stripe_session_id)return res.status(409).json({ok:false,verified:false,error:'Stripe has not confirmed this exact quote as paid.'});const status=kind==='build'?'paid_build_pending':'paid_domain_pending';db.prepare(`UPDATE ${table} SET payment_verified=1,status=?,updated_on=datetime('now') WHERE id=?`).run(status,id);const email=kind==='build'?row.requester_email:row.requester_email,receipt=await topReelsSendMarketplaceReceipt(kind,id,email,Number(row.quote_cents));res.json({ok:true,verified:true,status,receiptSent:receipt.sent});}catch(e){console.warn('[topreels-marketplace] Stripe verify:',e.message);res.status(503).json({ok:false,error:'Stripe payment could not be verified right now.'});}});
app.get('/api/admin/topreels/marketplace/review',(req,res)=>{if(!isTopReelsOwner(req))return res.status(403).json({ok:false,error:'TopReels owner sign-in required'});try{res.set('Cache-Control','no-store, private').json({ok:true,listings:db.prepare("SELECT * FROM topreels_marketplace_listings WHERE status='pending' ORDER BY created_on").all(),bids:db.prepare("SELECT b.*,l.title FROM topreels_marketplace_bids b JOIN topreels_marketplace_listings l ON l.id=b.listing_id WHERE b.status='pending' ORDER BY b.created_on").all(),builds:db.prepare("SELECT * FROM topreels_site_build_requests WHERE status IN ('pending_quote','awaiting_payment','paid_build_pending') ORDER BY created_on").all(),migrations:db.prepare("SELECT * FROM topreels_domain_migrations WHERE status NOT IN ('authorized','rejected') ORDER BY created_on").all()});}catch{res.status(503).json({ok:false,error:'Marketplace review data is unavailable.'});}});
async function topReelsCreateQuote(req,res,kind){if(!isTopReelsOwner(req))return res.status(403).json({ok:false,error:'TopReels owner sign-in required'});const id=Number(req.params.id),amount=Number(req.body?.amount),cents=Math.round(amount*100),table=kind==='build'?'topreels_site_build_requests':'topreels_domain_migrations';if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(cents)||cents<100||cents>100000000)return res.status(400).json({ok:false,error:'Enter a quote between $1 and $1,000,000.'});const row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!row||row.payment_verified||!['pending_quote','pending_dns'].includes(row.status)||kind==='domain'&&!row.ownership_verified)return res.status(409).json({ok:false,error:'Request must be reviewed and domain ownership verified before quoting.'});if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM)return res.status(503).json({ok:false,error:'Configured Stripe and Resend services are required; no checkout was created.'});try{const success=`https://rmt.haksterai.com/api/topreels/marketplace/payment-return?kind=${kind}&id=${id}&session_id={CHECKOUT_SESSION_ID}`,cancel='https://rmt.haksterai.com/apps/sites/topreels-3230f40cc3/index.html#site-market',metadata=kind==='build'?{build_request_id:id}:{domain_migration_id:id},session=await topReelsStripeCheckout({email:row.requester_email,amountCents:cents,name:kind==='build'?'Custom site build':'Domain migration service',description:kind==='build'?row.project_name:row.domain,successUrl:success,cancelUrl:cancel,metadata});db.prepare(`UPDATE ${table} SET quote_cents=?,stripe_session_id=?,checkout_url=?,status='awaiting_payment',updated_on=datetime('now') WHERE id=?`).run(cents,session.id,session.url,id);await sendMail(row.requester_email,`TopReels ${kind==='build'?'site build':'domain migration'} quote`,emailShell(`<p>Your confirmed quote is <b>$${(cents/100).toFixed(2)} USD</b>.</p><p><a href="${escapeHtml(session.url)}">Pay securely with Stripe</a></p><p>We begin after Stripe confirms payment. Publication or domain authorization requires final HTTPS HTTP 200 and expected site identity checks.</p>`));res.json({ok:true,id,status:'awaiting_payment',checkoutUrl:session.url,emailSent:true});}catch(e){console.error('[topreels-marketplace] quote failed:',e.message);res.status(503).json({ok:false,error:'Could not create and email the secure quote.'});}}
app.post('/api/admin/topreels/marketplace/site-builds/:id/quote',(req,res)=>topReelsCreateQuote(req,res,'build'));
app.post('/api/admin/topreels/marketplace/domain-migrations/:id/quote',(req,res)=>topReelsCreateQuote(req,res,'domain'));
app.patch('/api/admin/topreels/marketplace/listings/:id',async(req,res)=>{if(!isTopReelsOwner(req))return res.status(403).json({ok:false,error:'TopReels owner sign-in required'});const id=Number(req.params.id),status=['active','rejected','sold'].includes(req.body?.status)?req.body.status:null;if(!Number.isSafeInteger(id)||id<1||!status)return res.status(400).json({ok:false,error:'Listing ID and valid status required.'});if(status==='active'){if(req.body?.ownershipVerified!==true)return res.status(400).json({ok:false,error:'Owner must confirm seller ownership.'});const row=db.prepare("SELECT site_url,title FROM topreels_marketplace_listings WHERE id=? AND status='pending'").get(id);if(!row)return res.status(404).json({ok:false,error:'Pending listing not found.'});const check=await topReelsProbeIdentity(row.site_url,req.body?.expectedText||row.title);if(!check.ok)return res.status(409).json({ok:false,error:'Listing needs HTTPS HTTP 200 and matching site identity before activation.',httpStatus:check.status,check:check.reason});}db.prepare('UPDATE topreels_marketplace_listings SET status=? WHERE id=?').run(status,id);res.json({ok:true,id,status,httpStatus:status==='active'?200:null});});
app.post('/api/admin/topreels/marketplace/site-builds/:id/publish',async(req,res)=>{if(!isTopReelsOwner(req))return res.status(403).json({ok:false,error:'TopReels owner sign-in required'});const id=Number(req.params.id),url=topReelsMarketUrl(req.body?.url),expected=String(req.body?.expectedText||'').trim().slice(0,120);const row=Number.isSafeInteger(id)&&id>0?db.prepare("SELECT * FROM topreels_site_build_requests WHERE id=? AND payment_verified=1 AND status='paid_build_pending'").get(id):null;if(!row||!url||expected.length<3)return res.status(409).json({ok:false,error:'A paid build, HTTPS URL, and expected site text are required.'});const check=await topReelsProbeIdentity(url,expected);if(!check.ok)return res.status(409).json({ok:false,error:'Final site must return HTTPS HTTP 200 with the expected identity. Listing stays locked.',httpStatus:check.status,check:check.reason});try{db.exec('BEGIN IMMEDIATE');db.prepare("UPDATE topreels_site_build_requests SET status='published',published_url=?,final_http_status=200,identity_verified=1,updated_on=datetime('now') WHERE id=? AND payment_verified=1").run(url,id);const listing=db.prepare("INSERT INTO topreels_marketplace_listings(title,site_url,owner_name,owner_email,mode,description,status,source_build_request_id) VALUES(?,?,?,?,?,?,'active',?)").run(row.project_name,url,row.requester_name,row.requester_email,row.marketplace_mode,'Paid build; published and HTTPS HTTP 200/content identity verified.',id);db.exec('COMMIT');res.json({ok:true,status:'published',url,listingId:Number(listing.lastInsertRowid),httpStatus:200,identityVerified:true});}catch(e){try{db.exec('ROLLBACK')}catch{}res.status(503).json({ok:false,error:'Could not publish the verified site listing.'});}});
app.post('/api/admin/topreels/marketplace/domain-migrations/:id/authorize',async(req,res)=>{if(!isTopReelsOwner(req))return res.status(403).json({ok:false,error:'TopReels owner sign-in required'});const id=Number(req.params.id),row=Number.isSafeInteger(id)&&id>0?db.prepare("SELECT * FROM topreels_domain_migrations WHERE id=? AND ownership_verified=1 AND payment_verified=1").get(id):null,expected=String(req.body?.expectedText||'').trim().slice(0,120);if(!row||expected.length<3)return res.status(409).json({ok:false,error:'Verified ownership, confirmed payment, and expected site identity are required.'});const check=await topReelsProbeIdentity('https://'+row.domain+'/',expected);if(!check.ok)return res.status(409).json({ok:false,error:'Domain is not ready: require HTTPS HTTP 200 and expected identity.',httpStatus:check.status,check:check.reason});db.prepare("UPDATE topreels_domain_migrations SET status='authorized',final_http_status=200,identity_verified=1,updated_on=datetime('now') WHERE id=?").run(id);res.json({ok:true,status:'authorized',domain:row.domain,httpStatus:200,identityVerified:true});});

const TOPREELS_CUSTOMER_PRICE_IDS = new Set(String(process.env.TOPREELS_CUSTOMER_PRICE_IDS || "").split(",").map(x=>x.trim()).filter(x=>/^price_[A-Za-z0-9]+$/.test(x)));
const TOPREELS_CREATOR_PRICE_ID = /^price_[A-Za-z0-9]+$/.test(String(process.env.TOPREELS_CREATOR_PRICE_ID||"")) ? String(process.env.TOPREELS_CREATOR_PRICE_ID) : "";
function topReelsCustomerCors(req,res){
  const origin=String(req.get("origin")||"");
  if(origin!=="https://"+TOPREELS_HOST)return false;
  res.set({"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin","Cache-Control":"no-store"});
  return true;
}
function getTopReelsCustomer(req){
  const raw=requestCookies(req).topreels_customer;if(!raw)return null;
  try{const c=jwt.verify(raw,JWT_SECRET);if(c.purpose!=="topreels-customer"||!Number.isSafeInteger(Number(c.uid)))return null;
    const user=db.prepare("SELECT id,email,display_name,tier,paid_until,stripe_customer,google_email_verified,token_ver FROM users WHERE id=?").get(Number(c.uid));
    if(!user||Number(user.token_ver||0)!==Number(c.ver||0)||Number(user.google_email_verified)!==1)return null;
    return user;
  }catch{return null;}
}
async function stripeCustomerList(resource,customer,key){
  const all=[];let cursor="";
  for(let page=0;page<20;page++){
    const q=new URLSearchParams({customer,limit:"100"});if(cursor)q.set("starting_after",cursor);
    const r=await fetch("https://api.stripe.com/v1/"+resource+"?"+q,{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(12000)});
    const d=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(d.data))throw new Error("Stripe billing lookup failed");
    all.push(...d.data);if(!d.has_more)return all;if(!d.data.length)throw new Error("Incomplete Stripe pagination");cursor=d.data[d.data.length-1].id;
  }throw new Error("Stripe verification limit reached");
}
async function topReelsCustomerEntitlement(user){
  const no={configured:false,active:false,planActive:false,amountDue:null,currency:"usd",reason:"billing_not_configured"};
  if(!user||Number(user.google_email_verified)!==1)return {...no,reason:"verified_profile_required"};
  const key=String(process.env.STRIPE_SECRET_KEY||"").trim(),customer=String(user.stripe_customer||"").trim();
  if(!key||!customer||!TOPREELS_CUSTOMER_PRICE_IDS.size)return no;
  try{
    const [subs,invoices]=await Promise.all([stripeCustomerList("subscriptions",customer,key),stripeCustomerList("invoices",customer,key)]);
    const now=Math.floor(Date.now()/1000);
    const sub=subs.find(x=>["active","trialing"].includes(x.status)&&Number(x.current_period_end||x.trial_end||0)>now&&(x.items?.data||[]).some(i=>TOPREELS_CUSTOMER_PRICE_IDS.has(i.price?.id)));
    const due=invoices.filter(x=>["open","uncollectible"].includes(x.status)&&Number(x.amount_remaining||0)>0);
    const amount=due.reduce((n,x)=>n+Number(x.amount_remaining||0),0);
    const currencies=new Set(due.map(x=>String(x.currency||"usd").toLowerCase()));
    return {configured:true,active:Boolean(sub)&&amount===0,planActive:Boolean(sub),amountDue:amount/100,currency:currencies.size===1?[...currencies][0]:currencies.size?"mixed":"usd",reason:Boolean(sub)&&amount===0?"active":"no_eligible_active_plan_or_balance_due"};
  }catch(e){console.warn("[topreels-entitlement] Stripe check failed:",String(e?.message||e).slice(0,120));return {...no,configured:true,reason:"billing_verification_unavailable"};}
}
app.options("/api/topreels/customer/*",(req,res)=>topReelsCustomerCors(req,res)?res.status(204).end():res.status(403).json({ok:false,error:"origin not allowed"}));
app.get("/api/topreels/customer/access",async(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  const u=getTopReelsCustomer(req);
  if(!u)return res.json({ok:true,authenticated:false,entitlement:{configured:Boolean(process.env.STRIPE_SECRET_KEY&&TOPREELS_CUSTOMER_PRICE_IDS.size),active:false,reason:"profile_required"}});
  res.json({ok:true,authenticated:true,profile:{email:u.email,name:u.display_name},entitlement:await topReelsCustomerEntitlement(u)});
});
app.post("/api/topreels/customer/creator-checkout",async(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  const u=getTopReelsCustomer(req);if(!u)return res.status(401).json({ok:false,error:"Sign in before checkout."});
  const key=String(process.env.STRIPE_SECRET_KEY||"").trim();
  const trialDays=Number(process.env.TOPREELS_CREATOR_TRIAL_DAYS||0);
  if(!key||!TOPREELS_CREATOR_PRICE_ID||!TOPREELS_CUSTOMER_PRICE_IDS.has(TOPREELS_CREATOR_PRICE_ID)||!Number.isInteger(trialDays)||trialDays<28||trialDays>31)return res.status(503).json({ok:false,error:"Creator checkout needs its confirmed Stripe Price, paid-access Price allowlist, and approved 28–31 day trial setting. No payment was taken."});
  try{
    let customer=String(u.stripe_customer||"");
    if(!/^cus_[A-Za-z0-9]+$/.test(customer)){
      const b=new URLSearchParams({email:u.email,name:u.display_name||u.email,"metadata[topreels_user_id]":String(u.id)});
      const cr=await fetch("https://api.stripe.com/v1/customers",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:b,signal:AbortSignal.timeout(12000)});
      const c=await cr.json().catch(()=>({}));if(!cr.ok||!/^cus_[A-Za-z0-9]+$/.test(c.id||""))throw new Error("Stripe customer creation failed");
      customer=c.id;db.prepare("UPDATE users SET stripe_customer=? WHERE id=? AND (stripe_customer IS NULL OR stripe_customer='')").run(customer,u.id);
    }
    const form=new URLSearchParams({mode:"subscription",customer,client_reference_id:String(u.id),success_url:"https://"+TOPREELS_HOST+"/?checkout=returned#settings",cancel_url:"https://"+TOPREELS_HOST+"/?checkout=cancelled#settings",payment_method_collection:"always","line_items[0][price]":TOPREELS_CREATOR_PRICE_ID,"line_items[0][quantity]":"1","subscription_data[trial_period_days]":String(trialDays),"subscription_data[metadata][topreels_user_id]":String(u.id)});
    /* Optional referral attribution: only an existing, non-revoked ledger link is attached. */
    const refLink=String(req.body?.link||"");
    if(/^[a-z2-7]{22}$/.test(refLink)){
      const l=topReelsLinkLedger.getLink(refLink);
      if(l&&!Number(l.revoked)){form.set("metadata[topreels_link_id]",refLink);form.set("subscription_data[metadata][topreels_link_id]",refLink);}
    }
    const r=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:form,signal:AbortSignal.timeout(12000)});
    const d=await r.json().catch(()=>({}));if(!r.ok||!d.url)throw new Error("Stripe checkout creation failed");res.json({ok:true,url:d.url});
  }catch(e){console.warn("[topreels-checkout] failed:",String(e?.message||e).slice(0,120));res.status(503).json({ok:false,error:"Secure checkout could not be created. No payment was taken."});}
});
app.get("/api/topreels/customer/sites",async(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  const u=getTopReelsCustomer(req);if(!u)return res.status(401).json({ok:false,error:"Sign in first."});
  const entitlement=await topReelsCustomerEntitlement(u);if(!entitlement.active)return res.status(403).json({ok:false,error:"An active paid plan with no unpaid Stripe balance is required.",entitlement});
  const sites=db.prepare("SELECT id,project_name AS name,published_url AS url FROM topreels_site_build_requests WHERE lower(requester_email)=lower(?) AND status='published' AND payment_verified=1 AND final_http_status=200 AND identity_verified=1 ORDER BY id DESC").all(u.email);
  res.json({ok:true,sites});
});
app.get("/api/topreels/customer/domain-requests",async(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  const u=getTopReelsCustomer(req);if(!u)return res.status(401).json({ok:false,error:"Sign in first."});
  const rows=db.prepare("SELECT id,build_request_id AS siteId,hostname,status,created_on AS createdOn,ownership_verified_at AS ownershipVerifiedAt FROM topreels_hosting_requests WHERE user_id=? ORDER BY created_on DESC LIMIT 50").all(u.id);res.json({ok:true,requests:rows});
});
app.post("/api/topreels/customer/domain-requests",async(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  const u=getTopReelsCustomer(req);if(!u)return res.status(401).json({ok:false,error:"Sign in first."});
  const entitlement=await topReelsCustomerEntitlement(u);if(!entitlement.active)return res.status(403).json({ok:false,error:"An active paid plan and zero unpaid balance are required.",entitlement});
  if(!topReelsMarketLimit(req,res))return;
  const site=db.prepare("SELECT id FROM topreels_site_build_requests WHERE id=? AND lower(requester_email)=lower(?) AND status='published' AND payment_verified=1 AND final_http_status=200 AND identity_verified=1").get(Number(req.body?.siteId),u.email);
  if(!site)return res.status(404).json({ok:false,error:"Choose a site published for this verified profile."});
  const host=String(req.body?.hostname||"").trim().toLowerCase().replace(/^https?:\/\//,"").split(/[\/?#]/)[0].replace(/\.$/,"");
  if(!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)||host.endsWith(".haksterai.com")||host==="haksterai.com"||host.endsWith(".phantomide.com")||host==="phantomide.com")return res.status(400).json({ok:false,error:"Enter a valid custom hostname you control."});
  const token=crypto.randomBytes(32).toString("hex"),id=crypto.randomUUID();
  try{db.prepare("INSERT INTO topreels_hosting_requests(id,user_id,build_request_id,hostname,token_hash) VALUES(?,?,?,?,?)").run(id,u.id,site.id,host,topReelsMarketHash(token));
    res.status(201).json({ok:true,id,status:"ownership_pending",dnsChallenge:{type:"TXT",name:"_topreels-verify."+host,value:token},message:"Add the TXT record and verify ownership. This does not change routing or move your current site."});
  }catch(e){if(String(e.message).includes("UNIQUE constraint"))return res.status(409).json({ok:false,error:"A request for this hostname already exists."});res.status(503).json({ok:false,error:"Could not save the domain request."});}
});
app.post("/api/topreels/customer/domain-requests/:id/verify",async(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  const u=getTopReelsCustomer(req);if(!u)return res.status(401).json({ok:false,error:"Sign in first."});
  const entitlement=await topReelsCustomerEntitlement(u);if(!entitlement.active)return res.status(403).json({ok:false,error:"An active paid plan and zero unpaid balance are required.",entitlement});
  const row=db.prepare("SELECT * FROM topreels_hosting_requests WHERE id=? AND user_id=?").get(String(req.params.id),u.id);if(!row)return res.status(404).json({ok:false,error:"Domain request not found."});
  if(row.status!=="ownership_pending")return res.json({ok:true,status:row.status,verified:!!row.ownership_verified_at});
  try{
    const dns=await import("node:dns/promises"),records=await dns.resolveTxt("_topreels-verify."+row.hostname);
    if(!records.flat().some(v=>topReelsMarketHash(v)===row.token_hash))return res.status(409).json({ok:false,verified:false,error:"TXT record was not found yet. Check its name/value and allow DNS to update."});
    db.prepare("UPDATE topreels_hosting_requests SET status='pending_owner_review',ownership_verified_at=datetime('now'),updated_on=datetime('now') WHERE id=? AND user_id=? AND status='ownership_pending'").run(row.id,u.id);
    res.json({ok:true,verified:true,status:"pending_owner_review",message:"Ownership verified. Owner review and hosting/TLS setup are still required; the existing site remains live."});
  }catch{return res.status(409).json({ok:false,verified:false,error:"TXT record is not visible yet. Check the DNS provider and try again."});}
});
app.get("/api/admin/topreels/customer-domain-requests",(req,res)=>{
  if(!topReelsCustomerCors(req,res))return res.status(403).json({ok:false,error:"origin not allowed"});
  if(!isTopReelsOwner(req))return res.status(403).json({ok:false,error:"TopReels owner sign-in required"});
  res.json({ok:true,requests:db.prepare("SELECT r.id,r.user_id AS userId,u.email,r.build_request_id AS siteId,b.project_name AS siteName,r.hostname,r.status,r.created_on AS createdOn,r.ownership_verified_at AS ownershipVerifiedAt FROM topreels_hosting_requests r JOIN users u ON u.id=r.user_id JOIN topreels_site_build_requests b ON b.id=r.build_request_id ORDER BY r.created_on DESC LIMIT 100").all()});
});
registerTopReelsTools({ app, db, crypto, JWT_SECRET, isTopReelsOwner, getTopReelsCustomer, getTopReelsOwnerEmail, topReelsCustomerCors, topReelsCustomerEntitlement, TOPREELS_HOST, scanWebsite, verifyOwnership, discoverSitemap });
/* Wallet: authenticated payment proxy + server-confirmed history. The Stripe
   webhook is the only route that can credit anything. */
registerTopReelsWallet({
  app, db, crypto, ledger: topReelsLinkLedger, TOPREELS_HOST,
  getTopReelsCustomer, topReelsCustomerCors, topReelsCustomerEntitlement,
});
/* Durable resumable crawl for verified migration jobs (one page per tick). */
const topReelsCrawler = createMigrationCrawler({
  db,
  fetchPage: fetchPageSnapshot,
  capturePage: captureOmpPage,
  fetchRobots: fetchRobotsTxt,
});
registerTopReelsMigrationCrawl({ app, db, crawler: topReelsCrawler, getTopReelsCustomer, topReelsCustomerCors, isTopReelsOwner });
if (process.env.TOPREELS_CRAWL_DISABLED !== "1") {
  setInterval(() => { topReelsCrawler.tick().catch((error) => console.warn("[topreels-crawl]", String(error?.message || error).slice(0, 140))); }, 2500);
}
/* Paid customer ads: entitlement-gated, destination-verified, stable ad IDs. */
registerTopReelsCustomerAds({
  app, db, crypto, TOPREELS_HOST,
  getTopReelsCustomer, topReelsCustomerCors, topReelsCustomerEntitlement,
  isTopReelsOwner, probe: topReelsProbeIdentity,
});
/* Server-side Meta publishing with the encrypted Page token from OAuth. */
registerTopReelsSocialPublish({
  app, db, crypto, JWT_SECRET,
  getTopReelsCustomer, topReelsCustomerCors,
});
app.use((req, res, next) => {
  const hostname = String(req.hostname || "").toLowerCase().replace(/\.$/, "");
  const isTopReels = hostname === TOPREELS_HOST || req.path === TOPREELS_SITE_PATH || req.path.startsWith(TOPREELS_SITE_PATH + "/");
  const topReelsCheckoutApi = isTopReels && req.method === "POST" && req.path === "/api/topreels/checkout";
  const topReelsContactApi = isTopReels && req.method === "POST" && req.path === "/api/topreels/contact";
  const topReelsMarketplaceApi = isTopReels && req.path.startsWith("/api/topreels/marketplace/");
  const topReelsMarketplaceOwnerApi = isTopReels && req.path.startsWith("/api/admin/topreels/marketplace/");
  const topReelsCustomerApi = isTopReels && (req.path.startsWith("/api/topreels/customer/") || req.path === "/api/admin/topreels/customer-domain-requests");
  const topReelsImageApi = isTopReels && req.path === "/api/image/generate" && ["OPTIONS", "POST"].includes(req.method);
  const topReelsCheckoutResult = isTopReels && req.method === "GET" && req.path === "/purchase-result";
  if (!isTopReels || process.env.TOPREELS_OWNER_ONLY === "0" || isTopReelsOwner(req) || topReelsCheckoutApi || topReelsContactApi || topReelsMarketplaceApi || topReelsMarketplaceOwnerApi || topReelsCustomerApi || topReelsImageApi || topReelsCheckoutResult) return next();
  // PWA plumbing is not site content: the manifest/icon/SW must stay fetchable
  // so the browser can offer install without weakening the preview gate.
  const pwaFile = /^(\/|\/apps\/sites\/topreels-3230f40cc3\/)?(manifest\.webmanifest|sw\.js|pwa-icon-512\.png)$/.test(req.path);
  if (req.method === "GET" && pwaFile) return next();
  forwardSecEvent("published-gate", "401 private-preview gate: " + String(req.hostname || "") + req.path + (req.get("user-agent") ? " · " + String(req.get("user-agent")).slice(0, 80) : ""));
  res.set("Cache-Control", "no-store, private").set("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET" || (req.path !== "/" && req.path !== TOPREELS_SITE_PATH && req.path !== TOPREELS_SITE_PATH + "/")) {
    return res.status(401).json({ error: "TopReels is temporarily private. Sign in with the owner Google account." });
  }
  res.type("html").status(401).send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TopReels · Private preview</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f4f6fa;font:16px system-ui,sans-serif}.card{width:min(440px,calc(100% - 32px));padding:36px;border:1px solid #2a3040;border-radius:24px;background:#11151e;text-align:center;box-shadow:0 24px 80px #0008}h1{margin:0 0 12px;font-size:30px}p{color:#aeb7c8;line-height:1.55}.btn{display:inline-block;margin-top:14px;padding:14px 20px;border-radius:12px;background:#b6ff2e;color:#111;font-weight:800;text-decoration:none}.hint{font-size:13px;margin-top:20px}</style><main class="card"><div aria-hidden="true" style="font-size:42px">🏆</div><h1>TopReels is in private preview</h1><p>This site is reserved for its owner while it is being prepared for sale.</p><a class="btn" href="https://rmt.haksterai.com/api/auth/google?topreels=1">Continue with Google</a><p class="hint">Use the owner’s Google account to continue.</p></main></html>`);
});

app.use((req,res,next)=>{
  const hostname=String(req.hostname||"").toLowerCase().replace(/\.$/,"");
  try {
    const rows=db.prepare("SELECT hostname,retired_hostnames,server_locked FROM topreels_inventory").all();
    for (const row of rows) {
      const retired=JSON.parse(row.retired_hostnames||"[]");
      if (retired.includes(hostname)&&!isTopReelsOwner(req)) return res.status(410).set("Cache-Control","no-store").send("This hostname is no longer assigned to this build.");
      if (row.hostname===hostname&&row.server_locked&&!isTopReelsOwner(req)) return res.status(423).set("Cache-Control","no-store").send("This site is temporarily locked by its owner.");
    }
  } catch { return res.status(503).send("Domain controls are temporarily unavailable."); }
  next();
});
app.get("/purchase-result", (req, res, next) => {
  if (String(req.hostname || "").toLowerCase().replace(/\.$/, "") !== TOPREELS_HOST) return next();
  const cancelled = req.query.status === "cancelled";
  const title = cancelled ? "Checkout cancelled" : "Payment received for verification";
  const message = cancelled
    ? "No payment was completed. You can return to TopReels and choose an offer any time."
    : "Stripe has returned you to TopReels. We will verify the payment before beginning the site handoff. This page alone is not proof of payment.";
  res.set("Cache-Control", "no-store, private").type("html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · TopReels</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f4f6fa;font:16px system-ui,sans-serif}.card{width:min(520px,calc(100% - 36px));padding:36px;border:1px solid #2a3040;border-radius:22px;background:#11151e;text-align:center}p{color:#aeb7c8;line-height:1.6}a{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:10px;background:#ffd166;color:#111;font-weight:800;text-decoration:none}</style><main class="card"><h1>${title}</h1><p>${message}</p><a href="https://${TOPREELS_HOST}/">Back to TopReels</a></main></html>`);
});

app.post("/api/topreels/checkout", async (req, res) => {
  res.status(409).json({ error: "TopReels accepts private acquisition bids from $99; this endpoint does not execute a sale or charge a buyer." });
});

/* TopReels contact form: messages go only to the configured site owner through Resend. */
const topReelsContactWindow = new Map();
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
app.post("/api/topreels/contact", async (req, res) => {
  const honeypot = String(req.body?.website || "").trim();
  if (honeypot) return res.status(200).json({ ok: true });
  const now = Date.now(), key = String(req.ip || "unknown");
  const prior = topReelsContactWindow.get(key);
  if (prior && now - prior.at < 10 * 60 * 1000 && prior.count >= 5) {
    return res.status(429).json({ error: "Please wait a few minutes before sending another message." });
  }
  if (topReelsContactWindow.size > 1000) {
    for (const [ip, item] of topReelsContactWindow) if (now - item.at > 10 * 60 * 1000) topReelsContactWindow.delete(ip);
  }
  const name = String(req.body?.name || "").trim().slice(0, 100);
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 254);
  const topic = String(req.body?.topic || "General question").trim().slice(0, 80);
  const message = String(req.body?.message || "").trim().slice(0, 5000);
  if (name.length < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
    return res.status(400).json({ error: "Add your name, a valid reply email, and a message of at least 10 characters." });
  }
  const entry = prior && now - prior.at < 10 * 60 * 1000 ? prior : { at: now, count: 0 };
  entry.at = now;
  entry.count++;
  topReelsContactWindow.set(key, entry);
  try {
    await sendMail(ADMIN_EMAIL, `[TopReels] ${topic}`, emailShell(
      `<h2 style="margin:0 0 8px">TopReels message</h2><p><b>From:</b> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p><b>Topic:</b> ${escapeHtml(topic)}</p><div style="white-space:pre-wrap;line-height:1.6;background:#fff;padding:16px;border-radius:10px">${escapeHtml(message)}</div><p style="color:#555">Reply directly to ${escapeHtml(email)}.</p>`
    ), email);
    res.set("Cache-Control", "no-store").json({ ok: true });
  } catch (error) {
    console.error("[topreels-contact] Resend delivery failed:", error.message);
    res.status(503).json({ error: "Email could not be sent right now. Please try again shortly." });
  }
});

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

/* ─── access log: login + booking IPs ─────────────────── */
const TRUSTED_PROXY_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
function clientIp(req) {
  const clean = (v) => String(v).replace(/^::ffff:/, "").slice(0, 64);
  const sock = clean(req?.socket?.remoteAddress || req?.ip || "");
  /* attacker-supplied XFF comes first; a real proxy (cloudflared on loopback/LAN) appends
     the true client hop last. Trust XFF only when the TCP peer IS a local proxy —
     otherwise the header is forged and the socket address is the truth. */
  const parts = String(req?.headers?.["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const peerIsProxy = (parts.length > 0 && (TRUSTED_PROXY_RE.test(sock + ".") || sock === "::1"));
  return clean(peerIsProxy ? parts[parts.length - 1] : (sock || (parts.length ? parts[parts.length - 1] : "")));
}
function clientUa(req) { return String(req?.headers?.["user-agent"] || "").slice(0, 250); }
function logAccess(kind, req, user, detail) {
  try {
    db.prepare("INSERT INTO access_log (kind, user_id, email, ip, ua, ref, detail) VALUES (?,?,?,?,?,?,?)")
      .run(kind, user?.id ?? null, String(user?.email || "").slice(0, 200), clientIp(req), clientUa(req),
           String(req?.headers?.referer || "").slice(0, 250), String(detail || "").slice(0, 250));
  } catch (e) { console.error("ACCESSLOG:", String(e).slice(0, 140)); }
}
/* ─── auth ────────────────────────────────────────────── */
/* ─── IP auth security: one account per IP (found-rate farming guard) ─── */
function signupIpBlocked(req) {
  if (process.env.RMT_ONE_PER_IP === "0") return false;
  const ip = clientIp(req);
  if (!ip || ip.startsWith("127.") || ip === "localhost" || ip === "::1") return false;
  const prior = db.prepare("SELECT COUNT(DISTINCT COALESCE(email,'')) c FROM access_log WHERE ip=? AND (user_id IS NOT NULL OR email != '')").get(ip).c;
  return prior > 0 ? ip : false;
}
function onePerIpRefuse(req, email, res) {
  const ip = signupIpBlocked(req);
  if (!ip) return false;
  secAlert("one-per-ip", `signup blocked from ${ip} (IP already holds an account) — email ${String(email || "").slice(0, 60)}`, 2);
  logAccess("signup-blocked", req, null, "one account per IP violated");
  res.status(403).json({ error: "One account per IP is allowed on this network. Contact support if you share a household.", one_per_ip: true });
  return true;
}

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, display_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if (onePerIpRefuse(req, email, res)) return;
  if (password.length < 8) return res.status(400).json({ error: "password min 8 chars" });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const r = db.prepare("INSERT INTO users (email, pass_hash, display_name, signup_rank) VALUES (?,?,?,(SELECT COALESCE(MAX(signup_rank),0)+1 FROM users))").run(email.toLowerCase(), hash, display_name || email.split("@")[0]);
    const u = ensureAdmin(db.prepare("SELECT id, email, display_name, tier, role, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(r.lastInsertRowid));
    logAccess("signup", req, u, "password signup");
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
  if (!c.sub || ![true, "true"].includes(c.email_verified)) return res.status(401).json({ error: "verified Google profile required" });
  const email = String(c.email || "").toLowerCase().trim();
  if (!email || /-?\d+@anonymous\.google$/.test(email)) return res.status(401).json({ error: "no verified email" });
  const googleSub = String(c.sub).slice(0,255);
  const googleName = String(c.name || email.split("@")[0]).slice(0,160);
  let googlePicture = "";
  try {
    const photo = new URL(String(c.picture || ""));
    if (photo.protocol === "https:" && (photo.hostname === "googleusercontent.com" || photo.hostname.endsWith(".googleusercontent.com"))) googlePicture = photo.href.slice(0,1200);
  } catch {}
  let u = db.prepare("SELECT id, email, google_sub FROM users WHERE google_sub=? LIMIT 1").get(googleSub);
  if (u && String(u.email).toLowerCase() !== email) return res.status(409).json({ error: "Google account email changed; contact support to review account linking." });
  if (!u) u = db.prepare("SELECT id, email, google_sub FROM users WHERE email=?").get(email);
  if (u?.google_sub && u.google_sub !== googleSub) return res.status(409).json({ error: "This account is linked to a different Google account. Contact support to review the link." });
  if (!u) {
    if (onePerIpRefuse(req, email, res)) return;
    const r2 = db.prepare("INSERT INTO users (email, pass_hash, display_name, signup_rank, google_sub, google_profile_name, google_picture_url, google_email_verified, google_profile_updated_at, picture) VALUES (?, 'google', ?, (SELECT COALESCE(MAX(signup_rank),0)+1 FROM users), ?, ?, ?, 1, datetime('now'), ?)").run(email, googleName, googleSub, googleName, googlePicture, googlePicture);
    logAccess("signup", req, { id: r2.lastInsertRowid, email }, "google signup");
    u = { id: r2.lastInsertRowid, email };
  } else {
    db.prepare("UPDATE users SET google_sub=?, google_profile_name=?, google_picture_url=?, google_email_verified=1, google_profile_updated_at=datetime('now'), picture=CASE WHEN picture='' THEN ? ELSE picture END WHERE id=?").run(googleSub, googleName, googlePicture, googlePicture, u.id);
  }
  u = db.prepare("SELECT id, email, display_name, tier, role, picture, token_ver, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(u.id);
  logAccess("login", req, u, "google id_token");
  res.json({ token: sign(ensureAdmin(u)), user: ensureAdmin(u) });
});

/* ─── google sign-in (OAuth 2.0 authorization code flow) ─── */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECTS = (process.env.RMT_OAUTH_REDIRECTS || "").split(",").map((s) => s.trim()).filter(Boolean);
const GOOGLE_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
/* Behind cloudflared the request arrives as plain HTTP on :8111, but the browser's
   origin is https://rmt.haksterai.com. Derive the public origin from the proxy
   headers (trust proxy is on) so redirect_uri byte-matches Google's console. */
const PUBLIC_ORIGIN = (process.env.RMT_PUBLIC_ORIGIN || "").replace(/\/+$/, "");
function oauthOrigin(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() || (req.secure ? "https" : "http");
  const derived = host ? `${proto}://${host}` : "";
  // an explicit origin header (fetch from the SPA) wins; else derived; else env; else localhost
  return (req.headers.origin || derived || PUBLIC_ORIGIN || `http://localhost:${PORT}`).replace(/\/+$/, "");
}
app.get("/api/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(503).send("Google sign-in not configured — add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to server/.env");
  const topReelsOwnerFlow = req.query.topreels === "1";
  const topReelsCustomerFlow = req.query.topreels === "customer";
  const topReelsGiveawayFlow = req.query.topreels === "customer-giveaway";
  // redirect origin must be one of the registered URIs in the Google console
  const origin = oauthOrigin(req);
  const uri = origin + "/api/auth/google/callback";
  if (GOOGLE_REDIRECTS.length && !GOOGLE_REDIRECTS.includes(origin)) {
    return res.status(403).send("Origin " + origin + " not registered — add it to RMT_OAUTH_REDIRECTS and the Google console, then restart");
  }
  const topReelsAuthMode = topReelsOwnerFlow ? "topreels" : topReelsGiveawayFlow ? "topreels_customer_giveaway" : topReelsCustomerFlow ? "topreels_customer" : "standard";
  const state = crypto.randomBytes(16).toString("hex") + "." + topReelsAuthMode;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: uri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.setHeader("Set-Cookie", [
    `gstate=${state}; HttpOnly; Path=/api/auth/google/callback; Max-Age=600; SameSite=Lax; Secure`,
    `gmode=${topReelsAuthMode}; HttpOnly; Path=/api/auth/google/callback; Max-Age=600; SameSite=Lax; Secure`,
  ]);
  res.redirect(GOOGLE_BASE + "?" + params.toString());
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const cookies = requestCookies(req);
    if (!req.query.code || !req.query.state || req.query.state !== cookies.gstate) return res.status(400).send("OAuth state mismatch — restart the sign-in");
    const validGoogleModes = new Set(["topreels", "topreels_customer", "topreels_customer_giveaway", "standard"]);
    const stateMode = String(cookies.gstate || "").split(".").pop();
    const googleAuthMode = validGoogleModes.has(cookies.gmode) ? cookies.gmode : validGoogleModes.has(stateMode) ? stateMode : "standard";
    const origin = oauthOrigin(req);
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
    if (googleAuthMode === "topreels") {
      if (claims.aud !== GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) || Number(claims.exp) * 1000 < Date.now() || claims.email_verified !== true || !TOPREELS_OWNER_EMAILS.has(email)) {
        res.clearCookie("gstate", { path: "/api/auth/google/callback" });
        res.clearCookie("gmode", { path: "/api/auth/google/callback" });
        return res.status(403).send("This Google account is not the TopReels owner account.");
      }
      const token = jwt.sign({ purpose: "topreels-owner", email }, JWT_SECRET, { expiresIn: "30d" });
      res.cookie("topreels_owner", token, { httpOnly: true, secure: true, sameSite: "lax", domain: ".haksterai.com", path: "/", maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.clearCookie("gstate", { path: "/api/auth/google/callback" });
      res.clearCookie("gmode", { path: "/api/auth/google/callback" });
      return res.redirect(303, "https://" + TOPREELS_HOST + "/");
    }
    if (claims.aud !== GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) || Number(claims.exp) * 1000 < Date.now() || claims.email_verified !== true || !claims.sub || !email) return res.status(403).send("Verified Google identity required");
    const googleSub = String(claims.sub).slice(0,255);
    const googleName = String(name).slice(0,160);
    let googlePicture = "";
    try {
      const photo = new URL(String(claims.picture || ""));
      if (photo.protocol === "https:" && (photo.hostname === "googleusercontent.com" || photo.hostname.endsWith(".googleusercontent.com"))) googlePicture = photo.href.slice(0,1200);
    } catch {}
    let u = db.prepare("SELECT id, email, google_sub FROM users WHERE google_sub=? LIMIT 1").get(googleSub);
    if (u && String(u.email).toLowerCase() !== email) return res.status(409).send("Google account email changed; contact support to review account linking.");
    if (!u) u = db.prepare("SELECT id, email, google_sub FROM users WHERE email=?").get(email);
    if (u?.google_sub && u.google_sub !== googleSub) return res.status(409).send("This account is linked to a different Google account. Contact support to review the link.");
    if (!u) {
      if (signupIpBlocked(req)) {
        secAlert("one-per-ip", "google signup blocked from " + clientIp(req) + " (IP already holds an account) — " + email, 2);
        logAccess("signup-blocked", req, null, "one account per IP violated (google)");
        return res.status(403).send("<h2>Sign-up blocked</h2><p style=\"font:15px sans-serif\">One account per IP is allowed on this network. Contact support if you share a household.</p>");
      }
      const r2 = db.prepare("INSERT INTO users (email, pass_hash, display_name, signup_rank, google_sub, google_profile_name, google_picture_url, google_email_verified, google_profile_updated_at, picture) VALUES (?, 'google', ?, (SELECT COALESCE(MAX(signup_rank),0)+1 FROM users), ?, ?, ?, 1, datetime('now'), ?)").run(email, googleName, googleSub, googleName, googlePicture, googlePicture);
      logAccess("signup", req, { id: r2.lastInsertRowid, email }, "google signup");
      u = { id: r2.lastInsertRowid };
    } else {
      db.prepare("UPDATE users SET google_sub=?, google_profile_name=?, google_picture_url=?, google_email_verified=1, google_profile_updated_at=datetime('now'), picture=CASE WHEN picture='' THEN ? ELSE picture END WHERE id=?").run(googleSub, googleName, googlePicture, googlePicture, u.id);
    }
    u = db.prepare("SELECT id, email, display_name, tier, role, picture, token_ver, EXISTS(SELECT 1 FROM trailers tt WHERE tt.owner_id=users.id) AS owns_trailers FROM users WHERE id=?").get(u.id);
    ensureAdmin(u);
    if (googleAuthMode === "topreels_customer" || googleAuthMode === "topreels_customer_giveaway") {
      const customerToken = jwt.sign({ purpose: "topreels-customer", uid: Number(u.id), ver: Number(u.token_ver) || 0 }, JWT_SECRET, { expiresIn: "30d" });
      res.cookie("topreels_customer", customerToken, { httpOnly: true, secure: true, sameSite: "lax", domain: ".haksterai.com", path: "/", maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.clearCookie("gstate", { path: "/api/auth/google/callback" });
      res.clearCookie("gmode", { path: "/api/auth/google/callback" });
      logAccess("login", req, u, "topreels customer oauth");
      return res.redirect(303, googleAuthMode === "topreels_customer_giveaway"
        ? "https://" + TOPREELS_HOST + "/?account=connected#giveaway"
        : "https://" + TOPREELS_HOST + "/?account=connected#settings");
    }
    logAccess("login", req, u, "google oauth");
    const token = sign(u);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const nonce = crypto.randomBytes(16).toString("base64");
    // inline script writes the token then redirects — it MUST be allowed by CSP
    res.set("Content-Security-Policy", `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'`);
    res.send(`<!doctype html><meta charset="utf-8"><title>Signing in…</title><script nonce="${nonce}">
      try {
        localStorage.setItem("rmt-token", ${JSON.stringify(token)});
        localStorage.setItem("rmt-user", ${JSON.stringify(JSON.stringify(u)).replace(/</g, "\\u003c")});
        location.replace("/#/home");
      } catch (e) { document.body.textContent = "Sign-in failed: " + e.message; }
    </script><p style="font:14px sans-serif">Signed in as ${esc(name)} — taking you to the site…</p>`);
  } catch (e) {
    res.status(500).send("google sign-in failed: " + String(e).slice(0, 200));
  }
});
const loginFails = [];
const ownsTrailers = (uid) => !!db.prepare("SELECT 1 c FROM trailers WHERE owner_id=? LIMIT 1").get(uid)?.c;
/* every auth response must tell the client WHO this is: admin / owner / renter */
const pubAuthUser = (u) => ({ id: u.id, email: u.email, display_name: u.display_name, tier: u.tier, role: u.role, picture: u.picture || "", owns_trailers: ownsTrailers(u.id) });
/* ─── auth ping: server-side idle-tracker, logs to access_log ── */
app.post("/api/auth/ping", auth(true), (req, res) => {
  logAccess("ping", req, req.user, "idle-tracker beat");
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare("SELECT * FROM users WHERE email=?").get((email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(password || "", u.pass_hash)) {
    loginFails.push({ at: Date.now(), email: (email || "").toLowerCase().slice(0, 80), ip: clientIp(req) });
    if (loginFails.length > 500) loginFails.splice(0, loginFails.length - 500);
    logAccess("login_failed", req, { id: null, email: (email || "").toLowerCase() }, "bad credentials");
    return res.status(401).json({ error: "bad credentials" });
  }
  ensureAdmin(u);
  logAccess("login", req, u, u.duo_enabled ? "2fa challenge issued" : "password");
  if (u.duo_enabled) {
    const challenge = crypto.randomBytes(24).toString("hex");
    twoFaChallenges.set(challenge, { uid: u.id, at: Date.now() });
    return res.json({ need2fa: true, challenge });
  }
  const pub = pubAuthUser(u);
  res.json({ token: sign(pub), user: pub });
});
app.post("/api/auth/login/verify", (req, res) => {
  const { challenge, code } = req.body || {};
  const c = twoFaChallenges.get(challenge);
  if (!c || Date.now() - c.at > 5 * 60_000) { twoFaChallenges.delete(challenge); return res.status(401).json({ error: "challenge expired" }); }
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(c.uid);
  if (!u || !u.duo_enabled) return res.status(400).json({ error: "2fa not enabled" });
  if (totpVerify(u.duo_secret, String(code || ""))) { twoFaChallenges.delete(challenge); logAccess("login", req, u, "2fa verified"); const pub = pubAuthUser(u); return res.json({ token: sign(pub), user: pub }); }
  return res.status(401).json({ error: "bad 2fa code" });
});
app.post("/api/auth/change-password", auth(true), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!u) return res.status(404).json({ error: "user gone" });
  if (!bcrypt.compareSync(req.body?.current || "", u.pass_hash)) return res.status(401).json({ error: "current password wrong" });
  const next = String(req.body?.next || "");
  if (next.length < 8) return res.status(400).json({ error: "min 8 chars" });
  db.prepare("UPDATE users SET pass_hash=? WHERE id=?").run(bcrypt.hashSync(next, 10), u.id);
  db.prepare("UPDATE users SET token_ver = token_ver + 1 WHERE id=?").run(u.id);
  res.json({ ok: true });
});
app.post("/api/auth/forgot", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase();
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!u) return res.json({ ok: true }); // don't leak
  const token = crypto.randomBytes(16).toString("hex");
  resetTokens.set(token, { uid: u.id, at: Date.now() });
  const link = `${PUBLIC_ORIGIN || oauthOrigin(req)}/#/reset/${token}`;
  const DEV_LINKS = process.env.RMT_DEV_LINKS === "1";
  try { await sendMail(email, "Rent My Trailer — password reset", emailShell(`<h2 style="margin:0 0 8px">Reset your password</h2><p style="color:#333">Click below within 30 minutes:</p><p><a href="${link}" style="color:#f5b325;font-weight:700">${link}</a></p>`)); }
  catch (e) { console.error("[forgot] mail failed for " + email + ": " + String(e).slice(0, 160)); }
  // never hand a live reset token to an anonymous caller; only opt-in local/dev may inline it
  res.json(DEV_LINKS ? { ok: true, devLink: link } : { ok: true });
});
/* the landing page behind the emailed link: #/reset/<token> posts here */
app.post("/api/auth/reset", (req, res) => {
  const token = String(req.body?.token || "");
  const next = String(req.body?.password || "");
  const t = resetTokens.get(token);
  if (!t || Date.now() - t.at > 30 * 60_000) {
    resetTokens.delete(token);
    return res.status(400).json({ error: "reset link expired or already used — request a new one" });
  }
  if (next.length < 8) return res.status(400).json({ error: "min 8 chars" });
  // a reset also clears 2FA and kills every existing session
  db.prepare("UPDATE users SET pass_hash=?, duo_enabled=0, duo_secret='', token_ver = token_ver + 1 WHERE id=?")
    .run(bcrypt.hashSync(next, 10), t.uid);
  resetTokens.delete(token);
  logAccess("password-reset", req, { id: t.uid, email: "" }, "reset token used");
  res.json({ ok: true });
});
/* ─── 2FA (TOTP — Duo Mobile / any authenticator) ────── */
const twoFaChallenges = new Map();
const resetTokens = new Map();
const B32A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32(buf) { let b = 0, v = 0, o = ""; for (const x of buf) { v = (v << 8) | x; b += 8; while (b >= 5) { o += B32A[(v >>> (b - 5)) & 31]; b -= 5; } } if (b > 0) o += B32A[(v << (5 - b)) & 31]; return o; }
function totp(secret, t = Date.now()) {
  const ctr = Math.floor(t / 1000 / 30);
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(ctr));
  const h = crypto.createHmac("sha1", Buffer.from(secret, "base64")).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  return String(((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % 1_000_000).padStart(6, "0");
}
function totpVerify(secret, code) { const now = Date.now(); for (const dt of [0, -30_000, 30_000]) if (totp(secret, now + dt) === String(code).replace(/\D/g, "")) return true; return false; }
app.get("/api/2fa/status", auth(true), (req, res) => {
  const u = db.prepare("SELECT duo_enabled, duo_secret FROM users WHERE id=?").get(req.user.id);
  res.json({ enabled: !!u?.duo_enabled });
});
app.post("/api/2fa/setup", auth(true), (req, res) => {
  const secret = crypto.randomBytes(20);
  const b32s = b32(secret);
  const u = db.prepare("SELECT email FROM users WHERE id=?").get(req.user.id);
  const label = encodeURIComponent("Rent My Trailer:" + (u?.email || ""));
  const issuer = encodeURIComponent("Rent My Trailer");
  db.prepare("UPDATE users SET duo_secret=? WHERE id=?").run(secret.toString("base64"), req.user.id);
  res.json({ secret: b32s, otpauth: `otpauth://totp/${label}?secret=${b32s}&issuer=${issuer}` });
});
app.post("/api/2fa/enable", auth(true), (req, res) => {
  const u = db.prepare("SELECT duo_secret FROM users WHERE id=?").get(req.user.id);
  if (!u?.duo_secret) return res.status(400).json({ error: "run setup first" });
  if (!totpVerify(u.duo_secret, String(req.body?.code || ""))) return res.status(401).json({ error: "bad code" });
  db.prepare("UPDATE users SET duo_enabled=1 WHERE id=?").run(req.user.id);
  res.json({ ok: true });
});
app.post("/api/2fa/disable", auth(true), (req, res) => {
  const u = db.prepare("SELECT duo_secret, duo_enabled FROM users WHERE id=?").get(req.user.id);
  if (!u?.duo_enabled) return res.json({ ok: true });
  if (!totpVerify(u.duo_secret, String(req.body?.code || ""))) return res.status(401).json({ error: "bad code" });
  db.prepare("UPDATE users SET duo_enabled=0, duo_secret='' WHERE id=?").run(req.user.id);
  res.json({ ok: true });
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
  const rows = cat ? db.prepare(q).all(`%${cat}%`) : db.prepare(q).all();
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

/* ─── listing photos: real uploads, cover pick, removal ─── */
const photoUp = multer({ storage: multer.diskStorage({
  destination: (_req, _f, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(10).toString("hex") + path.extname(file.originalname || ".jpg")),
}), limits: { fileSize: 8 * 1024 * 1024, files: 8 } });
function picsOf(t) { try { return t?.pics_json ? JSON.parse(t.pics_json) : []; } catch { return []; } }
/* only the owner of a user listing (or an admin) may edit its photos */
function editableTrailer(id, u) {
  const t = db.prepare("SELECT id, owner_id, src, img, pics_json FROM trailers WHERE id=? AND status!='deleted'").get(Number(id));
  if (!t) return { error: [404, "trailer not found"] };
  if (!(u.role === "admin" || (t.owner_id && t.owner_id === u.id))) return { error: [403, "not your listing"] };
  return { t };
}
/* the ownership check MUST run before multer: multer writes files to disk as it
   parses, so checking afterwards leaves a non-owner's upload orphaned in UPLOADS
   (an authenticated stranger could fill the disk by posting to any listing). */
function ownTrailer(req, res, next) {
  const { t, error } = editableTrailer(req.params.id, req.user);
  if (error) return res.status(error[0]).json({ error: error[1] });
  req.trailer = t;
  next();
}
app.post("/api/trailers/:id/photos", auth(true), ownTrailer, photoUp.array("photos", 8), (req, res) => {
  const t = req.trailer;
  const added = (req.files || []).map((f) => "/uploads/" + f.filename);
  if (!added.length) return res.status(400).json({ error: "no photos uploaded" });
  const pics = picsOf(t).concat(added);
  // a real on-disk photo becomes the cover until the owner picks another
  const cover = String(t.img || "").startsWith("/uploads/") ? t.img : added[0];
  db.prepare("UPDATE trailers SET pics_json=?, img=? WHERE id=?").run(JSON.stringify(pics), cover, t.id);
  res.json({ ok: true, pics, img: cover, added: added.length });
});
app.post("/api/trailers/:id/cover", auth(true), (req, res) => {
  const { t, error } = editableTrailer(req.params.id, req.user);
  if (error) return res.status(error[0]).json({ error: error[1] });
  const url = String(req.body?.url || "");
  const pics = picsOf(t);
  if (!url || !pics.includes(url)) return res.status(400).json({ error: "pick a photo on this listing" });
  db.prepare("UPDATE trailers SET img=? WHERE id=?").run(url, t.id);
  res.json({ ok: true, img: url });
});
app.post("/api/trailers/:id/photos/remove", auth(true), (req, res) => {
  const { t, error } = editableTrailer(req.params.id, req.user);
  if (error) return res.status(error[0]).json({ error: error[1] });
  const url = String(req.body?.url || "");
  const pics = picsOf(t).filter((p) => p !== url);
  if (pics.length === picsOf(t).length) return res.status(404).json({ error: "photo not on this listing" });
  // never leave the listing without a cover
  const cover = t.img === url ? (pics.find((p) => String(p).startsWith("/uploads/")) || pics[0] || null) : t.img;
  db.prepare("UPDATE trailers SET pics_json=?, img=? WHERE id=?").run(JSON.stringify(pics), cover, t.id);
  // delete the file from disk when it is one of ours (library URLs are shared, keep those)
  if (String(url).startsWith("/uploads/")) {
    try { fs.unlinkSync(path.join(UPLOADS, path.basename(url))); } catch {}
  }
  res.json({ ok: true, pics, img: cover });
});

/* ─── coupons & pricing ───────────────────────────────── */
app.get("/api/coupons", (_req, res) => {
  res.json({ rows: db.prepare("SELECT code, percent, note FROM coupons WHERE active=1").all() });
});
/* real market averages per category — powers the "well-priced?" guidance on List Your Trailer.
   Published under the DB category name plus short aliases ("Car Hauler Trailer Rentals" ->
   "Car Hauler Trailer" -> "Car Hauler") so the poster-side category picker matches. */
app.get("/api/pricing/averages", (_req, res) => {
  const rows = db.prepare(`SELECT cat, AVG(daily) avg, COUNT(*) listings FROM trailers
    WHERE status='live' AND daily IS NOT NULL AND daily > 0 AND cat IS NOT NULL AND cat NOT LIKE '%,%'
    GROUP BY cat`).all();
  const acc = {};
  const add = (key, avg, n) => { if (!key) return; const a = acc[key] || (acc[key] = { w: 0, l: 0 }); a.w += avg * n; a.l += n; };
  for (const r of rows) {
    add(r.cat, r.avg, r.listings);
    const base = String(r.cat).replace(/ Rentals?$/, "");
    add(base, r.avg, r.listings);
    add(base.replace(/ Trailer$/, ""), r.avg, r.listings);
  }
  const cats = {};
  for (const [k, v] of Object.entries(acc)) cats[k] = { avg: Math.round(v.w / v.l), listings: v.l };
  res.json({ cats });
});
/* affiliate: trailer insurance quote (external, opens in a new tab) */
app.get("/api/aff/insurance", (req, res) => {
  const url = process.env.RMT_INSURANCE_URL || "https://www.roamly.com/trailer-insurance";
  logAccess("aff-insurance", req, null, "insurance affiliate click");
  res.redirect(302, url);
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
  const r = db.prepare(`INSERT INTO bookings (code, user_id, trailer_id, start_date, days, base, discount, total, deposit, coupon_code, tax_amount, tax_state, owner_payout, ip, ua)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, req.user.id, t.id, start_date, Number(days), q.base, q.discount, totalWithTax, numOr(t.deposit, 0), couponRow?.code || null, taxAmount, taxState, ownerPayout, clientIp(req), clientUa(req));
  if (couponRow) db.prepare("UPDATE coupons SET uses=uses+1 WHERE code=?").run(couponRow.code);
  // seed the thread between renter + owner (real messaging ties into booking)
  if (t.owner_id) {
    const ex = db.prepare("SELECT id FROM threads WHERE trailer_id=? AND renter_id=?").get(t.id, req.user.id);
    if (!ex) db.prepare("INSERT INTO threads (trailer_id, renter_id, clearance) VALUES (?,?, 'approved')").run(t.id, req.user.id);
  }
  blog(r.lastInsertRowid, "created", `booking ${code} · ${Number(days)}d from ${start_date} · total ${totalWithTax}${taxAmount ? " (incl. CA tax " + taxAmount.toFixed(2) + ")" : ""} · owner payout ${ownerPayout.toFixed(2)} (${feePct}%) · deposit ${numOr(t.deposit,0)}${couponRow ? " · coupon " + couponRow.code : ""}`, req.user.email);
  logAccess("booking", req, req.user, `booking ${code} · trailer ${t.id} · ${Number(days)}d · total ${totalWithTax}`);
  // Klaviyo: track booking creation for the renter
  klaviyoTrack("RMT Booking Created", { email: req.user.email }, {
    booking_code: code, trailer_title: t.title, days: Number(days), total: totalWithTax, start_date,
  }).catch(() => {});
  const row = db.prepare("SELECT * FROM bookings WHERE id=?").get(r.lastInsertRowid);
  res.json({ ok: true, booking: row, balance_due: q.total });
});
app.get("/api/bookings", auth(true), (req, res) => {
  const rows = db.prepare(`SELECT b.*, t.title, t.city, t.state, t.lat, t.lng, t.img, t.owner_id FROM bookings b JOIN trailers t ON t.id=b.trailer_id
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
  const b = db.prepare(`SELECT b.*, t.owner_id, t.title, t.cat, t.city, t.state, t.img, t.daily, t.lat, t.lng
    FROM bookings b JOIN trailers t ON t.id=b.trailer_id WHERE b.code=?`).get(code);
  return b;
}
app.get("/api/bookings/incoming", auth(true), (req, res) => {
  const rows = db.prepare(`SELECT b.*, t.title, t.img, u.display_name AS renter_name, u.email AS renter_email
    FROM bookings b JOIN trailers t ON t.id=b.trailer_id JOIN users u ON u.id=b.user_id
    WHERE t.owner_id=? AND b.payment_state!='cancelled' AND b.created_on > datetime('now','-30 days')
    ORDER BY b.id DESC LIMIT 100`).all(req.user.id);
  res.json({ ok: true, rows });
});
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

/* ─── Klaviyo: track events for SMS/email flow triggers ── */
async function klaviyoTrack(metric, profile, properties = {}) {
  const KK = process.env.KLAVIYO_API_KEY;
  if (!KK) return { ok: false, reason: "not configured" };
  try {
    const r = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Klaviyo-API-Key ${KK}`, revision: "2024-10-15" },
      body: JSON.stringify({ data: { type: "event", attributes: {
        metric: { data: { type: "metric", attributes: { name: metric } } },
        profile: { data: { type: "profile", attributes: { email: profile.email || "", phone_number: profile.phone || "" } } },
        properties,
      } } }),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}
/* ─── Outbound personal notifications: Telegram (free, via linked bot) first, SMS (Zavu/textbee) fallback ── */
/* Ops note: if RMT_ZAVU_API_KEY / RMT_TEXTBEE_API_KEY / RMT_TEXTBEE_DEVICE_ID are
   not set at runtime, SMS falls through to "no provider configured". Add these
   credentials in the environment rather than hard-coding them here. */
/*
 * SMS keys note: RMT_ZAVU_API_KEY / RMT_TEXTBEE_API_KEY / RMT_TEXTBEE_DEVICE_ID
 * are runtime credentials. When absent, delivery fails safely instead of leaking
 * provider access into source control.
 */
async function sendSms(to, text) {
  to = String(to || "").replace(/[^\d+]/g, "");
  if (to.length < 10) return { ok: false, reason: "bad number" };
  text = String(text).slice(0, 300);
  const at = new Date().toISOString().replace("T", " ").slice(0, 19);
  const log = (st) => { try { db.prepare("INSERT INTO sms_log (to_, text, state, at) VALUES (?,?,?,?)").run(to, text, st, at); } catch {}; return st; };

  // Provider 1: Zavu (free tier, no card) — real API SMS, no paired phone needed.
  const ZK = process.env.RMT_ZAVU_API_KEY;
  if (ZK) {
    try {
      const r = await fetch("https://api.zavu.dev/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZK}` },
        body: JSON.stringify({ to, channel: "sms", text }),
        signal: AbortSignal.timeout(10000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, provider: "zavu", data: j };
      console.warn(`[SMS] zavu failed ${r.status}:`, (j && j.message) || "");
      log("zavu-failed:" + r.status); // fall through to textbee
    } catch (e) { log("zavu-error"); console.warn("[SMS] zavu unreachable:", String(e).slice(0, 100)); }
  }

  // Provider 2: textbee gateway (own Android SIM) — fallback.
  const TBK = process.env.RMT_TEXTBEE_API_KEY, TBD = process.env.RMT_TEXTBEE_DEVICE_ID;
  if (TBK && TBD) {
    try {
      const r = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(TBD)}/send-sms`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": TBK },
        body: JSON.stringify({ recipients: [to], message: text }),
        signal: AbortSignal.timeout(8000),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, provider: "textbee", state: log(r.ok ? "sent" : "failed:" + r.status), data: j.data || null };
    } catch (e) { return { ok: false, provider: "textbee", reason: String(e).slice(0, 120), state: log("error") }; }
  }
  return { ok: false, reason: "no provider configured", state: log("unconfigured") };
}

/* ─── Telegram push (uses the linked fleet bot; user must have STARTed it) ── */
async function sendTg(telegramId, text) {
  const tk = String(process.env.RMT_TG_BOT_TOKEN || "").trim();
  if (!tk || !telegramId) return { ok: false, reason: "telegram not configured" };
  const at = new Date().toISOString().replace("T", " ").slice(0, 19);
  const log = (st) => { try { db.prepare("INSERT INTO sms_log (to_, text, state, at) VALUES (?,?,?,?)").run("tg:" + telegramId, String(text).slice(0, 300), st, at); } catch {} ; return st; };
  try {
    const r = await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(String(telegramId).replace(/[^0-9]/g, "")), text: String(text).slice(0, 3000) }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) return { ok: true, provider: "telegram", state: log("tg-sent"), data: j.result || null };
    log("tg-failed:" + (j.description || r.status));
    return { ok: false, provider: "telegram", reason: j.description || `telegram ${r.status}` };
  } catch (e) { return { ok: false, provider: "telegram", reason: String(e).slice(0, 120), state: log("tg-error") }; }
}
/* best-channel notify: verified Telegram when linked (free/unlimited), else verified-phone SMS */
async function notifyUser(usr, text) {
  if (usr?.telegram_verified && usr?.telegram_id) {
    const t = await sendTg(usr.telegram_id, text);
    if (t.ok) return t;
    console.warn("[notify] telegram delivery failed, trying SMS:", t.reason || "");
  }
  if (usr?.phone_verified && usr?.phone) return sendSms(usr.phone, text);
  return { ok: false, reason: "no verified telegram or phone on the account" };
}

/* ─── messaging (REST + ws) ──────────────────────── */
app.get("/api/messages/threads", auth(true), (req, res) => {
  const rows = db.prepare(`SELECT th.id, th.trailer_id, th.clearance, th.updated_on, t.title, t.owner_id,
    th.renter_read_id, th.owner_read_id,
    COALESCE((SELECT text FROM messages m WHERE m.thread_id=th.id ORDER BY m.id DESC LIMIT 1), '') last,
    (SELECT COUNT(*) FROM messages m WHERE m.thread_id=th.id) n,
    (SELECT COUNT(*) FROM messages m WHERE m.thread_id=th.id AND m.user_id<>?
       AND m.id > CASE WHEN t.owner_id=? THEN th.owner_read_id ELSE th.renter_read_id END) unread
    FROM threads th JOIN trailers t ON t.id=th.trailer_id
    WHERE th.renter_id=? OR t.owner_id=? ORDER BY th.updated_on DESC`).all(req.user.id, req.user.id, req.user.id, req.user.id);
  // clearances: 'requested'/'pending' gate applies to free tier on renter side
  res.json({ rows: rows.map((r) => ({ ...r, role: r.owner_id === req.user.id ? "owner" : "renter", title: r.title })) });
});
app.post("/api/messages/start/:trailerId", auth(true), (req, res) => {
  const tid = Number(req.params.trailerId);
  const t = db.prepare("SELECT id, owner_id, title FROM trailers WHERE id=? AND status!='deleted'").get(tid);
  if (!t) return res.status(404).json({ error: "trailer not found" });
  if (t.owner_id === req.user.id) return res.status(400).json({ error: "can't message your own listing" });
  if (!t.owner_id) return res.status(400).json({ error: "this listing has no owner inbox yet" });
  let th = db.prepare("SELECT id FROM threads WHERE trailer_id=? AND renter_id=?").get(tid, req.user.id);
  if (!th) {
    const clearance = req.user.tier === "paid" ? "approved" : "none";
    const r = db.prepare("INSERT INTO threads (trailer_id, renter_id, clearance) VALUES (?,?,?)").run(tid, req.user.id, clearance);
    th = { id: Number(r.lastInsertRowid) };
  }
  res.json({ ok: true, threadId: th.id });
});
function threadFor(id, u) {
  return db.prepare(`SELECT th.*, t.owner_id, t.title FROM threads th JOIN trailers t ON t.id=th.trailer_id WHERE th.id=?`).get(Number(id));
}
app.get("/api/messages/:threadId", auth(true), (req, res) => {
  const th = threadFor(req.params.threadId, req.user);
  if (!th) return res.status(404).json({ error: "no thread" });
  if (th.renter_id !== req.user.id && th.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "not your thread" });
  const rows = db.prepare("SELECT m.id, m.user_id, m.text, m.sent_on, u.display_name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.thread_id=? ORDER BY m.id ASC").all(th.id);
  // opening the thread marks the viewer's side read up to the newest message
  const newest = rows.length ? rows[rows.length - 1].id : 0;
  if (newest) db.prepare(`UPDATE threads SET ${th.owner_id === req.user.id ? "owner_read_id" : "renter_read_id"}=? WHERE id=?`).run(newest, th.id);
  res.json({ thread: { id: th.id, trailer_id: th.trailer_id, title: th.title, clearance: th.clearance, renter_id: th.renter_id, owner_id: th.owner_id, role: th.owner_id === req.user.id ? "owner" : "renter" }, rows });
});
app.post("/api/messages/:threadId", auth(true), (req, res) => {
  const th = threadFor(req.params.threadId);
  if (!th) return res.status(404).json({ error: "no thread" });
  if (th.renter_id !== req.user.id && th.owner_id !== req.user.id) return res.status(403).json({ error: "not your thread" });
  const text = String(req.body?.text || "").slice(0, 4000).trim();
  if (!text) return res.status(400).json({ error: "text required" });
  // phone-number exchange: free for the founding 1,000 (and premium members);
  // everyone past the 1,000-seat deadline keeps chatting on-platform until they upgrade
  if (PHONE_RE.test(text)) {
    const senderRow = db.prepare("SELECT signup_rank, promo_rank, tier FROM users WHERE id=?").get(req.user.id);
    if (!isFoundingMember(senderRow) && senderRow?.tier !== "paid") {
      return res.status(402).json({
        error: "Phone numbers are a founding-member perk — the first " + FEE.founderCap.toLocaleString() + " signups share theirs free (free first month, " + (100 - FEE.founderPct) + "% earnings). Past the first " + FEE.founderCap.toLocaleString() + " seats the platform fee is " + FEES.ownerPct + "% plus " + FEE.caTaxPct + "% CA sales tax on California rentals, and number-sharing is premium-only — until then keep chatting on-platform.",
        phone_locked: true,
      });
    }
  }
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
  // SMS + Klaviyo event notification to the other party
  const otherId = req.user.id === th.renter_id ? th.owner_id : th.renter_id;
  const other = db.prepare("SELECT email, phone, phone_verified, telegram_id, telegram_verified FROM users WHERE id=?").get(otherId);
  const me = db.prepare("SELECT display_name FROM users WHERE id=?").get(req.user.id);
  notifyUser(other, `[RMT] ${me?.display_name || "Someone"}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`).catch(() => {});
  // Klaviyo: track event so flows can trigger SMS/email to the recipient
  if (other?.email || other?.phone) {
    klaviyoTrack("RMT New Message", { email: other.email, phone: other.phone }, {
      sender: me?.display_name || "Someone", preview: text.slice(0, 200), thread_id: th.id, trailer_title: th.title,
    }).catch(() => {});
  }
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
/* ─── phone verification (SMS via textbee) ───────────── */
app.post("/api/phone/send", auth(true), async (req, res) => {
  const phone = String(req.body?.phone || "").replace(/[^\d+]/g, "");
  if (phone.length < 10) return res.status(400).json({ error: "valid phone number required" });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare("UPDATE users SET phone=?, phone_code=? WHERE id=?").run(phone, code, req.user.id);
  const r = await sendSms(phone, `Rent My Trailer verification code: ${code}`);
  if (!r.ok) {
    const u2 = db.prepare("SELECT telegram_id, telegram_verified FROM users WHERE id=?").get(req.user.id);
    const t = (u2?.telegram_verified && u2?.telegram_id) ? await sendTg(u2.telegram_id, `Rent My Trailer phone-verification code: ${code}`) : { ok: false };
    if (t.ok) return res.json({ ok: true, via: "telegram" });
    return res.status(503).json({ error: t.reason || r.reason || "SMS failed and no linked Telegram — see Settings → Telegram" });
  }
  res.json({ ok: true });
});
/* ─── telegram verification (via haksterAI bot fleet, free — no SMS needed) ──── */
const TG_BOT_USERNAME = process.env.RMT_TG_BOT_USERNAME || "Haksterbotbot";
app.post("/api/tg/verify/start", auth(true), (req, res) => {
  const code = crypto.randomBytes(4).toString("hex");
  db.prepare("UPDATE users SET tg_code=?, tg_code_exp=? WHERE id=?").run(code, Date.now() + 15 * 60 * 1000, req.user.id);
  res.json({ ok: true, url: `https://t.me/${TG_BOT_USERNAME}?start=rmt_${code}`, expires_in: 900 });
});
app.post("/api/tg/verify/complete", (req, res) => {
  const secret = process.env.RMT_PAY_SECRET || "";
  if (!secret || req.headers["x-rmt-secret"] !== secret) return res.status(403).json({ error: "forbidden" });
  const code = String(req.body?.code || "").trim();
  const tgId = String(req.body?.telegram_id || "").replace(/[^0-9]/g, "");
  if (!code || !tgId) return res.status(400).json({ error: "code + telegram_id required" });
  const u = db.prepare("SELECT id FROM users WHERE tg_code=? AND tg_code_exp IS NOT NULL AND tg_code_exp > ?").get(code, Date.now());
  if (!u) return res.status(404).json({ error: "invalid or expired code" });
  const dupe = db.prepare("SELECT id FROM users WHERE telegram_id=? AND telegram_id!='' AND id<>?").get(tgId, u.id);
  if (dupe) return res.status(409).json({ error: "this Telegram account is already linked to another Rent My Trailer account" });
  db.prepare("UPDATE users SET telegram_id=?, telegram_verified=1, tg_code='' WHERE id=?").run(tgId, u.id);
  console.log(`[tg-verify] linked rmt user #${u.id} ← telegram ${tgId}`);
  sendTg(tgId, "✅ Telegram linked to Rent My Trailer — booking and chat alerts will arrive here.").catch(() => {});
  res.json({ ok: true });
});
app.post("/api/phone/verify", auth(true), (req, res) => {
  const u = db.prepare("SELECT phone_code, phone FROM users WHERE id=?").get(req.user.id);
  if (!u?.phone) return res.status(400).json({ error: "send a code first" });
  if (String(req.body?.code || "") !== u.phone_code) return res.status(401).json({ error: "wrong code" });
  db.prepare("UPDATE users SET phone_verified=1, phone_code='' WHERE id=?").run(req.user.id);
  res.json({ ok: true, phone: u.phone });
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

/* Verified TopReels payment receipts are relayed from HaksterAI only after a
   Stripe-signed webhook. Resend and receipt state stay on the Dell RMT host. */
app.post("/api/stripe/topreels-receipt", express.json(), async (req, res) => {
  const paySecret = process.env.RMT_PAY_SECRET || "";
  if (!paySecret || req.headers["x-rmt-secret"] !== paySecret) return res.status(403).json({ error: "forbidden" });
  const { receipt_key, email, offer } = req.body || {};
  const receiptKey = String(receipt_key || "");
  const buyerEmail = String(email || "").trim().toLowerCase();
  const amountCents = Number(req.body?.amount_cents);
  const installmentNumber = Number(req.body?.installment_number || 0);
  if (!/^[a-zA-Z0-9_:-]{1,128}$/.test(receiptKey) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail) || !["outright", "installment"].includes(offer) || !Number.isSafeInteger(amountCents) || amountCents < 1) {
    return res.status(400).json({ error: "valid receipt details required" });
  }
  const resendKey = process.env.RESEND_API_KEY || "";
  const from = process.env.MAIL_FROM || "";
  if (!resendKey || !from) return res.status(503).json({ error: "receipt email is not configured" });
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS topreels_receipts (
      receipt_key TEXT PRIMARY KEY,
      buyer_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      resend_id TEXT,
      created_on TEXT NOT NULL DEFAULT (datetime('now')),
      sent_on TEXT
    )`);
    const saved = db.prepare("SELECT status, resend_id FROM topreels_receipts WHERE receipt_key=?").get(receiptKey);
    if (saved?.status === "sent") return res.json({ ok: true, duplicate: true, receipt_id: saved.resend_id });
    db.prepare("INSERT OR IGNORE INTO topreels_receipts (receipt_key,buyer_email,status) VALUES (?,?, 'pending')").run(receiptKey, buyerEmail);
    const amount = (amountCents / 100).toFixed(2);
    const offerLabel = offer === "outright" ? "TopReels full website — paid in full" : `TopReels full website — installment ${Math.min(Math.max(installmentNumber, 1), 10)} of 10`;
    const reference = receiptKey.replace(/[&<>"']/g, "");
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#171717"><h1 style="font-size:22px">TopReels payment receipt</h1><p>Stripe confirmed your payment.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px 0">Item</td><td style="padding:8px 0;text-align:right">${offerLabel}</td></tr><tr><td style="padding:8px 0">Amount paid</td><td style="padding:8px 0;text-align:right">$${amount} USD</td></tr><tr><td style="padding:8px 0">Stripe reference</td><td style="padding:8px 0;text-align:right;word-break:break-all">${reference}</td></tr></table><p>Site transfer begins after the purchase terms and payment are verified. Keep this email for your records.</p><p>Questions: dekekenneth840@gmail.com · (209) 936-0846</p></div>`;
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `topreels-sale-receipt-${receiptKey}` },
      body: JSON.stringify({ from, to: [buyerEmail], subject: `TopReels payment receipt — $${amount}`, html }),
      signal: AbortSignal.timeout(10000),
    });
    const emailResult = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok || !emailResult.id) throw new Error(emailResult.message || `Resend returned ${emailResponse.status}`);
    db.prepare("UPDATE topreels_receipts SET status='sent', resend_id=?, sent_on=datetime('now') WHERE receipt_key=?").run(emailResult.id, receiptKey);
    res.json({ ok: true, receipt_id: emailResult.id });
  } catch (err) {
    console.error("[topreels-pay] receipt send failed:", err.message);
    res.status(503).json({ error: "Receipt email is pending retry" });
  }
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
  const eventKey = "rmt:membership";
  db.prepare(`INSERT INTO network_campaigns (event_key,source,title,headline,support,image,href,cta,status)
    VALUES (?,?,?,?,?,?,?,?, 'active') ON CONFLICT(event_key) DO NOTHING`).run(
    eventKey, "rmt-membership", "Rent My Trailer", "Rent trailers from local owners.",
    "Browse local listings and book the trailer that fits your next haul.",
    "https://phantomide.com/house-ads/rmt-first-1000-promo.svg", "https://rmt.haksterai.com/#/browse", "BROWSE TRAILERS"
  );
  console.log(`[pay-relay] membership activated for #${uid} (${row.email}) until ${until}`);
  return res.json({ ok: true, tier: "paid", paid_until: until, subscription: subscription_id || null });
});

/* ─── website migration: scan, prove domain control, and submit an explicit request ─── */
app.get("/api/migrations", auth(true), (req, res) => {
  const rows = db.prepare("SELECT id,source_url,project_name,business_type,status,verification_token,scan_json,admin_note,created_on,updated_on FROM site_migrations WHERE user_id=? ORDER BY id DESC LIMIT 30").all(req.user.id);
  res.json({ rows: rows.map((r) => ({ ...r, scan: JSON.parse(r.scan_json || "{}") })) });
});
app.post("/api/migrations/scan", auth(true), async (req, res) => {
  const sourceUrl = String(req.body?.source_url || "").trim();
  const projectName = String(req.body?.project_name || "").trim().slice(0,100);
  const businessType = String(req.body?.business_type || "website").slice(0,40);
  if (req.body?.authorized !== true) return res.status(400).json({ error: "Confirm that you own this site or have permission to migrate it." });
  const recentScans = db.prepare("SELECT COUNT(*) AS count FROM site_migrations WHERE user_id=? AND created_on > datetime('now','-1 hour')").get(req.user.id).count;
  if (recentScans >= 5) return res.status(429).json({ error: "You’ve reached the site scan limit. Try again in an hour." });
  if (!projectName) return res.status(400).json({ error: "Give the site a project name." });
  if (!/^(website|store|portfolio|community|service|other)$/.test(businessType)) return res.status(400).json({ error: "Choose a supported site type." });
  try {
    const scan = await scanWebsite(sourceUrl);
    const token = `hakster-migrate=${crypto.randomBytes(18).toString("hex")}`;
    const result = db.prepare(`INSERT INTO site_migrations (user_id,source_url,project_name,business_type,status,verification_token,scan_json,owner_authorized)
      VALUES (?,?,?,?,?,?,?,1)`).run(req.user.id, scan.sourceUrl, projectName, businessType, "ownership_required", token, JSON.stringify(scan));
    logAccess("site-migration-scan", req, req.user, `migration #${result.lastInsertRowid} ${scan.domain}`);
    return res.json({ id: Number(result.lastInsertRowid), status: "ownership_required", verification_token: token, scan });
  } catch (error) { return res.status(400).json({ error: error.message || "Unable to scan this website." }); }
});
app.post("/api/migrations/:id/verify", auth(true), async (req, res) => {
  const row = db.prepare("SELECT * FROM site_migrations WHERE id=? AND user_id=?").get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: "Migration request not found." });
  if (row.status !== "ownership_required") return res.status(409).json({ error: "This migration is no longer awaiting verification." });
  try {
    const ok = await verifyOwnership(row.source_url, row.verification_token);
    if (!ok) return res.status(400).json({ error: "Verification file did not match. Upload the exact token and try again." });
    db.prepare("UPDATE site_migrations SET status='verified',updated_on=datetime('now') WHERE id=?").run(row.id);
    logAccess("site-migration-verified", req, req.user, `migration #${row.id}`);
    return res.json({ ok: true, status: "verified" });
  } catch (error) { return res.status(400).json({ error: error.message || "Could not verify the domain." }); }
});
app.post("/api/migrations/:id/start", auth(true), (req, res) => {
  const row = db.prepare("SELECT * FROM site_migrations WHERE id=? AND user_id=?").get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: "Migration request not found." });
  if (row.status !== "verified") return res.status(409).json({ error: "Verify control of the source domain before requesting migration." });
  db.prepare("UPDATE site_migrations SET status='requested',updated_on=datetime('now') WHERE id=? AND status='verified'").run(row.id);
  logAccess("site-migration-requested", req, req.user, `migration #${row.id}`);
  res.json({ ok: true, status: "requested" });
});
app.get("/api/admin/migrations", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const rows = db.prepare(`SELECT m.id,m.user_id,m.source_url,m.project_name,m.business_type,m.status,m.scan_json,m.admin_note,m.created_on,m.updated_on,u.email,u.display_name
    FROM site_migrations m JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 200`).all();
  res.json({ rows: rows.map((r) => ({ ...r, scan: JSON.parse(r.scan_json || "{}") })) });
});
app.patch("/api/admin/migrations/:id", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const status = String(req.body?.status || "");
  const note = String(req.body?.admin_note || "").slice(0,2000);
  if (!/^(in_review|building|completed|declined)$/.test(status)) return res.status(400).json({ error: "Invalid migration status." });
  const result = db.prepare("UPDATE site_migrations SET status=?,admin_note=?,updated_on=datetime('now') WHERE id=?").run(status,note,Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Migration request not found." });
  res.json({ ok: true, status });
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
/* Ops note: MAIL_FROM in server/.env must use a domain verified in Resend.
   Resend rejects unverified senders, so update MAIL_FROM in the environment; do not commit or mirror secrets here. */
/*
 * MAIL_FROM note: Resend only accepts senders on a verified sending domain.
 * Ops must keep MAIL_FROM in server/.env pointed at a verified domain address.
 * Keep the secret itself out of repo files and sync it only through the intended
 * secret store.
 */
function verifiedSenderHint() {
  return process.env.MAIL_FROM || "Rent My Trailer <onboarding@resend.dev>";
}
async function sendMail(to, subject, html, replyTo) {
  if (!process.env.RESEND_API_KEY) throw new Error("no mail provider");
  const payload = { from: verifiedSenderHint(), to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, body: JSON.stringify(payload) });
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
  const rows = db.prepare("SELECT b.*, u.email AS user_email, u.id AS user_id, o.email AS owner_email, o.id AS owner_id, t.title FROM bookings b JOIN users u ON u.id=b.user_id JOIN trailers t ON t.id=b.trailer_id LEFT JOIN users o ON o.id=t.owner_id ORDER BY b.id DESC LIMIT 500").all();
  const money = db.prepare("SELECT COALESCE(SUM(rental_paid_cents),0) rental, COALESCE(SUM(deposit_paid_cents),0) deposits FROM bookings").get();
  const stats = {
    total: rows.length,
    paid: rows.filter((r) => r.payment_state === "paid").length,
    pending: rows.filter((r) => r.payment_state === "pending").length,
  };
  res.json({ rows, stats });
});


/* admin: user registry — ids, roles, tiers, kyc, per-user booking/listing counts */
app.get("/api/admin/users", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const q = String(req.query.q || "").toLowerCase().trim();
  const rows = db.prepare(`
    SELECT u.id, u.email, u.display_name, u.role, u.tier, u.kyc_state, u.created_on,
      (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id)      AS bookings_count,
      (SELECT COUNT(*) FROM bookings b JOIN trailers t ON t.id = b.trailer_id WHERE t.owner_id = u.id) AS hosting_count,
      (SELECT COUNT(*) FROM trailers t WHERE t.owner_id = u.id AND t.status = 'live') AS listings_count
    FROM users u ORDER BY u.id DESC LIMIT 500
  `).all();
  const filtered = q ? rows.filter((r) => `${r.id} ${r.email} ${r.display_name} ${r.role} ${r.tier} ${r.kyc_state}`.toLowerCase().includes(q)) : rows;
  res.json({ rows: filtered, total: filtered.length });
});

/* admin: CSV export of the full registries (bookings + users) */
function csvOf(rows, cols) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => esc(c.h)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.k])).join(","))].join("\n") + "\n";
}
app.get("/api/admin/export/bookings.csv", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const rows = db.prepare("SELECT b.id, b.code, b.payment_state, b.start_date, b.days, b.total, b.deposit, b.coupon_code, b.deposit_state, b.checkout_at, b.checkin_at, b.created_on, b.user_id, u.email AS user_email, o.id AS owner_id, o.email AS owner_email, b.trailer_id, t.title FROM bookings b JOIN users u ON u.id=b.user_id JOIN trailers t ON t.id=b.trailer_id LEFT JOIN users o ON o.id=t.owner_id ORDER BY b.id").all();
  res.type("text/csv").attachment("rmt-bookings.csv").send(csvOf(rows, [
    { h: "booking_id", k: "id" }, { h: "code", k: "code" }, { h: "state", k: "payment_state" },
    { h: "start_date", k: "start_date" }, { h: "days", k: "days" }, { h: "total", k: "total" }, { h: "deposit", k: "deposit" },
    { h: "coupon", k: "coupon_code" }, { h: "deposit_state", k: "deposit_state" },
    { h: "checkout_at", k: "checkout_at" }, { h: "checkin_at", k: "checkin_at" }, { h: "created_on", k: "created_on" },
    { h: "user_id", k: "user_id" }, { h: "user_email", k: "user_email" },
    { h: "owner_id", k: "owner_id" }, { h: "owner_email", k: "owner_email" },
    { h: "trailer_id", k: "trailer_id" }, { h: "trailer_title", k: "title" },
  ]));
});
app.get("/api/admin/export/users.csv", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const rows = db.prepare(`
    SELECT u.id, u.email, u.display_name, u.role, u.tier, u.kyc_state, u.phone, u.phone_verified, u.created_on, u.signup_rank,
      (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id)  AS bookings_count,
      (SELECT COUNT(*) FROM bookings b JOIN trailers t ON t.id = b.trailer_id WHERE t.owner_id = u.id) AS hosting_count,
      (SELECT COUNT(*) FROM trailers t WHERE t.owner_id = u.id AND t.status = 'live') AS listings_count
    FROM users u ORDER BY u.id
  `).all();
  res.type("text/csv").attachment("rmt-users.csv").send(csvOf(rows, [
    { h: "user_id", k: "id" }, { h: "email", k: "email" }, { h: "display_name", k: "display_name" },
    { h: "role", k: "role" }, { h: "tier", k: "tier" }, { h: "kyc_state", k: "kyc_state" },
    { h: "phone", k: "phone" }, { h: "phone_verified", k: "phone_verified" },
    { h: "created_on", k: "created_on" }, { h: "signup_rank", k: "signup_rank" },
    { h: "bookings_count", k: "bookings_count" }, { h: "hosting_count", k: "hosting_count" }, { h: "listings_count", k: "listings_count" },
  ]));
});
/* admin/owner: cancel a booking from the dashboard (releases the coupon use) */
app.post("/api/admin/bookings/:code/cancel", auth(true), (req, res) => {
  if (!["admin", "owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  db.prepare("UPDATE bookings SET payment_state='cancelled' WHERE id=?").run(b.id);
  if (b.coupon_code) db.prepare("UPDATE coupons SET uses=MAX(uses-1,0) WHERE code=?").run(b.coupon_code);
  try { blog(b.id, "cancelled", `booking ${b.code} cancelled from admin by ${req.user.email}`, req.user.email); } catch {}
  logAccess("booking-cancel", req, req.user, `booking ${b.code} cancelled`);
  res.json({ ok: true });
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
  const row = db.prepare("SELECT id, email, display_name, bio, tier, role, picture, avatar_file, phone, phone_verified, telegram_id, telegram_verified, promo_rank, paid_until, signup_rank FROM users WHERE id=?").get(req.user.id);
  res.json({ user: { ...row, avatar_url: row.avatar_file ? "/api/profile/avatar" : (row.picture || ""), bio: row.bio || "", telegram_verified: !!Number(row.telegram_verified) } });
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
/* founding member = first FEE.founderCap signups (or an explicit promo seat):
   free first month, +2% earnings (8% fee vs 10%), and free phone-number exchange */
function isFoundingMember(row) {
  const rank = Number(row?.signup_rank || 0);
  return (rank > 0 && rank <= FEE.founderCap) || !!row?.promo_rank;
}
/* a phone number is 9+ digits with optional + ( ) . - spacing */
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
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
    `${FEE.founderPct}% platform fee for the first ${FEE.founderCap.toLocaleString()} signups — you keep ${100 - FEE.founderPct}% of every rental (+2% vs the standard ${FEES.ownerPct}%)`,
    `Free first month + free phone-number exchange — founding ${FEE.founderCap.toLocaleString()} only`,
    `After the founding seats fill: ${FEES.ownerPct}% platform fee + ${FEE.caTaxPct}% CA sales tax at checkout for California`,
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
  chk("Messaging (Telegram bot, SMS keys)", !!process.env.RMT_TG_BOT_TOKEN || !!process.env.RMT_ZAVU_API_KEY || !!process.env.RMT_TEXTBEE_API_KEY, "chat + phone alerts");
  chk("Email (Resend)", !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST), "receipts + alerts");
  chk("Klaviyo (SMS/email flows)", !!process.env.KLAVIYO_API_KEY, "event-triggered SMS + email campaigns");
  res.json({ checks: out, all_ok: out.every((c0) => c0.ok), at: new Date().toISOString() });
});
/* security alert helpers */
const secEvents = [];
function secAlertScore(kind, detail, weight = 1) {
  secEvents.push({ kind, detail, weight, at: new Date().toISOString().replace("T", " ").slice(0, 19) });
  forwardSecEvent(kind, detail);
}
/* Forward security events to the PhantomIDE security center (Parrot) so the
   admin panel sees a unified, detailed log across ALL wildcard-published sites.
   Fire-and-forget on the LAN; never blocks or throws. */
const SEC_INGEST_URL = process.env.PHANTOM_SEC_INGEST_URL || "http://10.0.0.251:4000/api/admin/security/ingest";
function forwardSecEvent(kind, detail) {
  try {
    let token = "";
    try { token = String(require("fs").readFileSync("/home/ghost/rent-my-trailer/server/.phantom-sec-ingest.json", "utf8") && JSON.parse(require("fs").readFileSync("/home/ghost/rent-my-trailer/server/.phantom-sec-ingest.json", "utf8")).token || ""); } catch { return; }
    if (!token) return;
    const payload = JSON.stringify({
      token,
      source: String(process.env.RMT_PUBLIC_ORIGIN || "rmt.haksterai.com"),
      events: [{ type: "rmt-" + kind, detail: String(detail || "").slice(0, 300), ts: new Date().toISOString() }],
    });
    const req = require("http").request(SEC_INGEST_URL, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }, timeout: 3000 }, () => {});
    req.on("timeout", () => req.destroy());
    req.on("error", () => {});
    req.write(payload); req.end();
  } catch {}
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
    { name: "Email (receipts + alerts)", ok: !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST), pts: 10 },
    { name: "Outbound messaging (Telegram bot / SMS key)", ok: !!(process.env.RMT_TG_BOT_TOKEN || process.env.RMT_ZAVU_API_KEY || process.env.RMT_TEXTBEE_API_KEY), pts: 10 },
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
/* ─── booking payment: Stripe checkout via haksterai gateway + in-person ── */
app.post("/api/bookings/:code/pay/start", auth(true), async (req, res) => {
  const b = db.prepare("SELECT b.*, t.owner_id, t.title FROM bookings b JOIN trailers t ON t.id=b.trailer_id WHERE b.code=?").get(req.params.code);
  if (!b) return res.status(404).json({ error: "booking not found" });
  if (b.user_id !== req.user.id) return res.status(403).json({ error: "not your booking" });
  if (b.payment_state === "paid" || b.payment_state === "paid_full") return res.json({ already: "already paid in full" });
  if (b.payment_state === "cancelled") return res.status(400).json({ error: "booking cancelled" });
  const paySecret = process.env.RMT_PAY_SECRET || "";
  if (!paySecret) return res.status(503).json({ error: "payment gateway not configured" });
  const u = db.prepare("SELECT email, stripe_customer FROM users WHERE id=?").get(req.user.id);
  const amountCents = Math.round((Number(b.total) + Number(b.deposit || 0)) * 100);
  const origin = process.env.RMT_PUBLIC_ORIGIN || "https://rmt.haksterai.com";
  const POOL = [
    { name: "haksterai", url: process.env.HAKSTER_PAY_URL || "http://localhost:3579/api/rmt/booking-checkout" },
    { name: "phantom", url: process.env.PHANTOM_PAY_URL || "http://10.0.0.210:4000/api/rmt/booking-checkout" },
  ];
  const healthy = [];
  await Promise.all(POOL.map(async (g) => {
    try { const h = new URL(g.url); h.pathname = "/api/health"; const r = await fetch(h, { signal: AbortSignal.timeout(4000) }); if (r.status === 200) healthy.push(g); } catch {}
  }));
  if (!healthy.length) return res.status(503).json({ error: "no payment gateway healthy", manual: true, note: "Pay at pickup", total_due: b.total + Number(b.deposit || 0) });
  let lastErr = null;
  for (const g of healthy.sort(() => Math.random() - 0.5)) {
    try {
      const r = await fetch(g.url, { method: "POST", headers: { "Content-Type": "application/json", "x-rmt-secret": paySecret },
        body: JSON.stringify({ email: u.email, rmt_user_id: req.user.id, booking_code: b.code, amount_cents: amountCents,
          success_url: `${origin}/#/confirmation/${b.code}?paid=1`, cancel_url: `${origin}/#/confirmation/${b.code}?canceled=1` }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "checkout failed");
      blog(b.id, "pay-started", `Stripe checkout via ${g.name} — $${(amountCents/100).toFixed(2)} (rental + deposit)`, req.user.email);
      return res.json({ ok: true, url: j.url, gateway: g.name });
    } catch (err) { lastErr = err; }
  }
  res.status(502).json({ error: "all gateways failed", detail: lastErr?.message, manual: true, note: "Pay at pickup", total_due: b.total + Number(b.deposit || 0) });
});
app.post("/api/bookings/pay/relay", express.json(), (req, res) => {
  const paySecret = process.env.RMT_PAY_SECRET || "";
  if (!paySecret || req.headers["x-rmt-secret"] !== paySecret) return res.status(403).json({ error: "forbidden" });
  const { booking_code, rmt_user_id, payment_intent, session_id } = req.body || {};
  if (!booking_code) return res.status(400).json({ error: "booking_code required" });
  const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(booking_code);
  if (!b) return res.status(404).json({ error: "booking not found" });
  db.prepare("UPDATE bookings SET payment_state='paid', rental_paid_cents=?, rental_paid_at=datetime('now'), pay_method='stripe' WHERE id=?").run(Math.round(Number(b.total) * 100), b.id);
  blog(b.id, "paid", `Stripe payment confirmed · session ${session_id || ""} · PI ${payment_intent || ""}`, "stripe-webhook");
  console.log(`[pay-relay] booking ${booking_code} paid via Stripe`);
  // Klaviyo: track payment confirmation
  const renter = db.prepare("SELECT email, phone FROM users WHERE id=?").get(b.user_id);
  if (renter) klaviyoTrack("RMT Booking Paid", { email: renter.email, phone: renter.phone }, {
    booking_code, total: b.total, deposit: b.deposit, trailer_title: b.trailer_id,
  }).catch(() => {});
  res.json({ ok: true });
});
app.post("/api/bookings/:code/pay", auth(true), (req, res) => {
  const b = db.prepare("SELECT b.*, t.owner_id FROM bookings b JOIN trailers t ON t.id=b.trailer_id WHERE b.code=?").get(req.params.code);
  if (!b) return res.status(404).json({ error: "booking not found" });
  const isOwner = b.owner_id === req.user.id;
  const isRenter = b.user_id === req.user.id;
  if (!isOwner && !isRenter && req.user.role !== "admin") return res.status(403).json({ error: "not authorized" });
  /* in-person payment can only be recorded by the OWNER of the listing or an admin.
     A renter claiming paid is exactly the bypass that opens the pickup gate for free. */
  if (!isOwner && req.user.role !== "admin") {
    secAlert("pay-bypass", `${req.user.email} (uid ${req.user.id}) tried to self-mark booking ${b.code} paid — blocked`, 3);
    logAccess("pay-bypass-attempt", req, req.user, `booking ${b.code} · blocked renter self-marking paid`);
    return res.status(403).json({ error: "only the trailer owner or support can record in-person payment" });
  }
  const method = String(req.body?.method || "in-person").slice(0, 30);
  db.prepare("UPDATE bookings SET payment_state='paid', rental_paid_at=datetime('now'), pay_method=? WHERE id=?").run(method, b.id);
  blog(b.id, "paid", `Payment recorded (${method}) by ${req.user.email}`, req.user.email);
  res.json({ ok: true });
});
/* ─── Stripe Identity (ID verification) ──────────────── */
app.post("/api/identity/start", auth(true), async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const code = String(req.body?.code || "");
  if (code) {
    const b = db.prepare("SELECT * FROM bookings WHERE code=?").get(code);
    if (b) db.prepare("UPDATE users SET kyc_state='pending' WHERE id=?").run(b.user_id);
  }
  if (!key) {
    // no direct Stripe key — redirect to KYC file upload path
    return res.json({ ok: false, fallback: "kyc-upload", status: "upload your ID via the KYC button below" });
  }
  try {
    const body = new URLSearchParams({ "type": "id_number" });
    const r = await fetch("https://api.stripe.com/v1/identity/verification_sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || "stripe " + r.status);
    res.json({ ok: true, session: j.id, status: j.status, url: `https://uploads.stripe.com/identity_verification_sessions/${j.id}` });
  } catch (e) { res.status(502).json({ error: String(e).slice(0, 160) }); }
});
app.get("/api/identity/check", auth(true), async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const sid = String(req.query?.session || "");
  if (!key || !sid) return res.json({ status: "unknown", verified: false });
  try {
    const r = await fetch(`https://api.stripe.com/v1/identity/verification_sessions/${sid}`, { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || "stripe " + r.status);
    const verified = j.status === "verified";
    if (verified) db.prepare("UPDATE users SET kyc_state='verified' WHERE id=?").run(req.user.id);
    res.json({ status: j.status, verified, url: j.url || null });
  } catch (e) { res.status(502).json({ error: String(e).slice(0, 160) }); }
});
/* ─── KYC: file upload + status ───────────────────────── */
app.get("/api/kyc/status", auth(true), (req, res) => {
  const u = db.prepare("SELECT kyc_state, kyc_files FROM users WHERE id=?").get(req.user.id);
  res.json({ state: u?.kyc_state || "none", files: u?.kyc_files ? JSON.parse(u.kyc_files) : [] });
});
const kycUp = multer({ storage: multer.diskStorage({
  destination: (_q, _f, cb) => cb(null, path.join(UPLOADS, "private")),
  filename: (_q, f, cb) => cb(null, "kyc-" + Date.now() + "-" + Math.round(Math.random()*1e6) + path.extname(f.originalname)),
}), limits: { fileSize: 10 * 1024 * 1024 } });
app.post("/api/kyc/submit", auth(true), kycUp.array("docs", 3), async (req, res) => {
  const files = (req.files || []).map((f) => f.filename);
  if (!files.length) return res.status(400).json({ error: "no files uploaded" });
  const existing = db.prepare("SELECT kyc_files FROM users WHERE id=?").get(req.user.id);
  const all = [...(existing?.kyc_files ? JSON.parse(existing.kyc_files) : []), ...files];
  // Auto-verify pass: run OCR on every file, take the best score
  let auto = null, result;
  for (const f of req.files || []) {
    try {
      result = autoVerifyId(f.path, { full_name: String(req.body?.full_name || req.user.display_name || req.user.email.split("@")[0]) });
      if (result && (auto === null || result.score > auto.score)) auto = result;
    } catch (e) { console.error("[kyc-auto]", e.message); }
  }
  const state = auto?.verified ? "verified" : "needs-review";
  db.prepare("UPDATE users SET kyc_state=?, kyc_files=? WHERE id=?").run(state, JSON.stringify(all), req.user.id);
  if (auto?.verified) {
    secAlert("kyc-auto-verified", `user #${req.user.id} auto-verified (score ${auto.score})`, 0);
  } else {
    secAlert("kyc-auto-review", `user #${req.user.id} needs review (score ${auto?.score || 0})`, 1);
  }
  logAccess("kyc-submit", req, req.user, `state=${state}·score=${auto?.score||0}·files=${files.length}`);
  notifyUser(req.user, auto?.verified
    ? "✅ [RMT] Your ID passed automatic verification — you're cleared to book."
    : "⚠️ [RMT] Your ID was submitted and is pending review. An admin will verify it shortly.").catch(() => {});
  res.json({
    state,
    files: all,
    auto: auto ? { verified: auto.verified, score: auto.score, checks: auto.checks, chars: auto.ocr_chars } : null,
  });
});
/* ─── booking ID photo upload + review ────────────────── */
app.post("/api/bookings/:code/id-photo", auth(true), kycUp.single("idphoto"), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.user_id !== req.user.id) return res.status(403).json({ error: "only the renter can upload" });
  if (!req.file) return res.status(400).json({ error: "no file" });
  db.prepare("UPDATE bookings SET id_photo_file=? WHERE id=?").run(req.file.filename, b.id);
  res.json({ ok: true, file: req.file.filename });
});
app.get("/api/bookings/:code/id-photo", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.owner_id !== req.user.id && b.user_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "not authorized" });
  if (!b.id_photo_file) return res.status(404).json({ error: "no ID on file" });
  res.sendFile(path.join(UPLOADS, "private", b.id_photo_file));
});
app.post("/api/bookings/:code/id-decide", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "owner or admin only" });
  const approve = req.body?.decide === "approve";
  db.prepare("UPDATE bookings SET id_verified=? WHERE id=?").run(approve ? 1 : -1, b.id);
  if (approve) db.prepare("UPDATE users SET kyc_state='verified' WHERE id=?").run(b.user_id);
  blog(b.id, approve ? "id-approved" : "id-rejected", `ID ${approve ? "verified" : "rejected"} by ${req.user.email}`, req.user.email);
  res.json({ ok: true, id_verified: approve ? 1 : -1 });
});
/* ─── GPS handover: checkout (pickup) + checkin (return) ─ */
/* ─── GPS handover: checkout (pickup) + checkin (return) ─ */
const haversineMi = (a, b) => {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
};
function fenceOf(gps, b) {
  const center = Number.isFinite(b.lat) && Number.isFinite(b.lng) ? { lat: b.lat, lng: b.lng } : null;
  if (!center) return { center: null, radius_mi: 0 };
  const distance_mi = haversineMi({ lat: Number(gps.lat), lng: Number(gps.lng) }, center);
  const radius_mi = Number(process.env.RMT_FENCE_MI) || 0.5;
  return { center, radius_mi, distance_mi, in_fence: distance_mi <= radius_mi };
}
app.post("/api/bookings/:code/checkout", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (!["paid", "paid_full"].includes(b.payment_state)) {
    secAlert("checkout-gate", `${req.user.email} (uid ${req.user.id}) tried to check out booking ${b.code} while payment_state='${b.payment_state}' — blocked`, 2);
    logAccess("checkout-gate-blocked", req, req.user, `booking ${b.code} · state ${b.payment_state}`);
    return res.status(402).json({ error: "payment required before pickup — pay the full total + deposit first" });
  }
  if (b.checkout_at) return res.status(400).json({ error: "already checked out" });
  const gps = req.body?.gps;
  if (!gps?.lat || !gps?.lng) return res.status(400).json({ error: "GPS coordinates required" });
  const at = new Date().toISOString().replace("T", " ").slice(0, 19);
  const fence = fenceOf(gps, b);
  db.prepare("UPDATE bookings SET checkout_at=?, checkout_gps=? WHERE id=?").run(at, JSON.stringify(gps), b.id);
  blog(b.id, "checkout", `Trailer picked up at ${gps.lat.toFixed(4)},${gps.lng.toFixed(4)} ±${Math.round(gps.acc||0)}m${fence.center ? ` · ${fence.in_fence ? "inside geofence" : "OUTSIDE geofence"} (${fence.distance_mi}mi)` : ""}`, req.user.email);
  res.json({ ok: true, at, gps, fence, in_fence: fence.in_fence, distance_mi: fence.distance_mi });
});
app.post("/api/bookings/:code/checkin", auth(true), (req, res) => {
  const b = bookingAccess(req.params.code);
  if (!b) return res.status(404).json({ error: "no booking" });
  if (b.user_id !== req.user.id && b.owner_id !== req.user.id) return res.status(403).json({ error: "not your booking" });
  if (!b.checkout_at) return res.status(400).json({ error: "not checked out yet" });
  if (b.checkin_at) return res.status(400).json({ error: "already checked in" });
  const gps = req.body?.gps;
  if (!gps?.lat || !gps?.lng) return res.status(400).json({ error: "GPS coordinates required" });
  const at = new Date().toISOString().replace("T", " ").slice(0, 19);
  const fence = fenceOf(gps, b);
  db.prepare("UPDATE bookings SET checkin_at=?, checkin_gps=? WHERE id=?").run(at, JSON.stringify(gps), b.id);
  blog(b.id, "checkin", `Trailer returned at ${gps.lat.toFixed(4)},${gps.lng.toFixed(4)} ±${Math.round(gps.acc||0)}m${fence.center ? ` · ${fence.in_fence ? "inside geofence" : "OUTSIDE geofence"} (${fence.distance_mi}mi)` : ""}`, req.user.email);
  res.json({ ok: true, at, gps, fence, in_fence: fence.in_fence, distance_mi: fence.distance_mi });
});
app.post("/api/admin/sms-test", auth(true), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const to = String(req.body?.to || ""), text = String(req.body?.text || "Rent My Trailer test");
  const r = String(req.body?.channel) === "telegram" ? await sendTg(to, text) : await sendSms(to, text);
  if (!r.ok) return res.status(503).json({ error: r.reason || "send failed" });
  res.json(r);
});
app.get("/api/admin/sms-log", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  try {
    const rows = db.prepare("SELECT to_, text, state, at FROM sms_log ORDER BY rowid DESC LIMIT 50").all();
    res.json({ rows, telegram: !!process.env.RMT_TG_BOT_TOKEN, sms: !!(process.env.RMT_ZAVU_API_KEY || process.env.RMT_TEXTBEE_API_KEY) });
  } catch { res.json({ rows: [] }); }
});
/* ─── admin access log: every login + booking with its IP ── */
app.get("/api/admin/access-log", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const kind = req.query?.kind ? String(req.query.kind).slice(0, 40) : null;
  const email = req.query?.email ? String(req.query.email).toLowerCase().slice(0, 200) : null;
  const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500);
  try {
    const where = [], args = [];
    if (kind) { where.push("kind = ?"); args.push(kind); }
    if (email) { where.push("email = ?"); args.push(email); }
    const sql = "SELECT * FROM access_log" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY id DESC LIMIT ?";
    res.json({ rows: db.prepare(sql).all(...args, limit) });
  } catch (e) { res.status(500).json({ error: String(e).slice(0, 140) }); }
});
app.get("/api/admin/access-log/ip/:ip", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  try {
    const ip = String(req.params.ip).slice(0, 64);
    const rows = db.prepare("SELECT * FROM access_log WHERE ip = ? ORDER BY id DESC LIMIT 200").all(ip);
    const users = db.prepare("SELECT DISTINCT user_id, email FROM access_log WHERE ip = ? AND user_id IS NOT NULL").all(ip);
    res.json({ ip, rows, users });
  } catch (e) { res.status(500).json({ error: String(e).slice(0, 140) }); }
});
/* ═══ Ad Studio: FB + IG organic post creator-agent with posting autopilot ═══ *
 *  Env: RMT_FB_PAGE_ID, RMT_FB_PAGE_TOKEN (long-lived page token), RMT_IG_USER_ID
 *  (IG business account id; same page token). Posting via Graph API v21.0.     */
const GRAPH = "https://graph.facebook.com/v21.0";
const adSetting = (k, dflt) => { try { const r = db.prepare("SELECT v FROM app_settings WHERE k=?").get("ads:" + k); return r?.v ?? dflt; } catch { return dflt; } };
const adSetSetting = (k, v) => db.prepare("INSERT INTO app_settings (k, v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run("ads:" + k, String(v));
const adCfg = () => ({
  fb: Boolean(process.env.RMT_FB_PAGE_ID && process.env.RMT_FB_PAGE_TOKEN),
  ig: Boolean(process.env.RMT_IG_USER_ID && process.env.RMT_FB_PAGE_TOKEN),
});

/* caption generator — 6 rotating templates, seeded per trailer */
const AD_TEMPLATES = [
  (t) => `🚚 ${t.title} — ready to haul in ${t.city || "your area"}${t.state ? ", " + t.state : ""}. From $${Math.round(Number(t.daily) || 0)}/day. GPS-verified handovers, refundable deposit, no guesswork. Book it: https://rmt.haksterai.com/#/detail/${t.id} #trailerrental #${(t.state || "USA").replace(/\s+/g, "")} #rentmytrailer`,
  (t) => `Need to move something big this weekend? ${t.title} in ${t.city || t.state || "your city"} rents from $${Math.round(Number(t.daily) || 0)}/day — deposit back in full after a clean handover. Reserve now: https://rmt.haksterai.com/#/detail/${t.id} #haul #trailerlife #rental`,
  (t) => `Founders keep 92% — renters pay from $${Math.round(Number(t.daily) || 0)}/day. ${t.title}, ${t.city || "the yard"}. Real booking, real trailer, GPS-verified pickup. → https://rmt.haksterai.com/#/detail/${t.id} #rentmytrailer #trailers`,
  (t) => `${t.title}: ${t.dims ? t.dims + " · " : ""}${t.delivery ? "can be delivered to you" : "pickup in " + (t.city || "your area")}. $${Math.round(Number(t.daily) || 0)}/day. Book in 2 minutes: https://rmt.haksterai.com/#/detail/${t.id} #trailerrental #movingday`,
  (t) => `Tow it, haul it, done. ${t.title} from $${Math.round(Number(t.daily) || 0)}/day in ${t.city || t.state || "the yard"}. Payment on file, deposit held against photos — everyone protected. → https://rmt.haksterai.com/#/detail/${t.id} #trailer #hauling`,
  (t) => `New on the yard: ${t.title} in ${t.city || t.state || "California"}. From $${Math.round(Number(t.daily) || 0)}/day — founding rate locked while slots last. https://rmt.haksterai.com/#/detail/${t.id} #rentmytrailer #${(t.state || "CA").replace(/\s+/g, "")}`,
];
function genCaption(trailer, i) {
  const tpl = AD_TEMPLATES[i % AD_TEMPLATES.length];
  return tpl(trailer).slice(0, 2100);
}

async function publishFacebook(img, caption) {
  const pageId = process.env.RMT_FB_PAGE_ID, tok = process.env.RMT_FB_PAGE_TOKEN;
  const r = await fetch(`${GRAPH}/${pageId}/photos`, {
    method: "POST",
    body: new URLSearchParams({ url: img, caption, access_token: tok }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "facebook photo post failed");
  return { post_id: j.post_id || j.id, url: `https://www.facebook.com/${j.post_id || j.id}` };
}
async function publishInstagram(img, caption) {
  const igId = process.env.RMT_IG_USER_ID, tok = process.env.RMT_FB_PAGE_TOKEN;
  const cRes = await fetch(`${GRAPH}/${igId}/media`, {
    method: "POST",
    body: new URLSearchParams({ image_url: img, caption, access_token: tok }),
  });
  const c = await cRes.json();
  if (!cRes.ok || !c.id) throw new Error(c?.error?.message || "ig container failed (image must be public jpg/png/webp)");
  const pRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: c.id, access_token: tok }),
  });
  const p = await pRes.json();
  if (!pRes.ok || !p.id) throw new Error(p?.error?.message || "ig publish failed");
  return { post_id: p.id, url: `https://www.instagram.com/p/${p.id}/` };
}
async function publishDraft(row) {
  const pub = row.channel === "instagram" ? publishInstagram : publishFacebook;
  try {
    const { post_id, url } = await pub(row.img, row.caption);
    db.prepare("UPDATE social_posts SET status='posted', post_url=?, error='', posted_at=datetime('now') WHERE id=?").run(url, row.id);
    logAccess("ad-post", null, { role: "system" }, `${row.channel} ${url}`);
    return { ok: true, url, post_id };
  } catch (e) {
    db.prepare("UPDATE social_posts SET status='failed', error=? WHERE id=?").run(String(e.message).slice(0, 300), row.id);
    return { ok: false, error: e.message };
  }
}

app.get("/api/admin/ads", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const rows = db.prepare("SELECT * FROM social_posts ORDER BY id DESC LIMIT 60").all();
  res.json({ rows, config: adCfg(), autopilot: { on: adSetting("on", "0") === "1", every_min: Number(adSetting("every_min", "120")), last_at: adSetting("last_at", "") } });
});

app.post("/api/admin/ad-agent/chat", auth(true), async (req, res) => {
  if (!['admin', 'owner'].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const clean = messages.slice(-12).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content || "").trim().slice(0, 2000),
  })).filter((m) => m.content);
  if (!clean.length) return res.status(400).json({ error: "message required" });
  if (!await isOllamaUp()) return res.status(503).json({ error: "Local ad model is offline; start Ollama on the Dell and try again." });
  const model = await pickModel();
  if (!model) return res.status(503).json({ error: "No local ad model is available." });
  const prompt = `You are the live ad assistant for the shared PhantomIDE house-ad feed displayed on PhantomIDE, HaksterAI, and Rent My Trailer. Help the admin inspect the network campaign setup, brainstorm copy, and plan image creatives. Be clear when you cannot verify something. You cannot publish, approve, delete, or modify campaigns; never claim you did. Keep replies concise.\n\nConversation:\n${clean.map((m) => `${m.role === "user" ? "Admin" : "Ad Assistant"}: ${m.content}`).join("\n")}\nAd Assistant:`;
  try {
    const answer = await fetch(`${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.65, top_p: 0.9 } }),
      signal: AbortSignal.timeout(85000),
    });
    const payload = await answer.json().catch(() => ({}));
    const reply = String(payload.response || "").trim();
    if (!answer.ok || !reply) return res.status(502).json({ error: "The local ad model did not return a reply." });
    res.json({ reply, model });
  } catch (e) {
    res.status(502).json({ error: e.name === "TimeoutError" ? "The ad model timed out. Try again." : "Could not reach the local ad model." });
  }
});

/* creator-agent: build drafts from live inventory */
app.post("/api/admin/ads/generate", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const count = Math.min(Math.max(Number(req.body?.count) || 2, 1), 8);
  const pool = db.prepare("SELECT id, title, daily, city, state, st, img, dims, delivery FROM trailers WHERE status='live' AND img IS NOT NULL AND img != '' ORDER BY RANDOM() LIMIT ?").all(count);
  if (!pool.length) return res.status(404).json({ error: "no live trailers with images" });
  const offset = Number(adSetting("tpl_offset", "0"));
  const ins = db.prepare("INSERT INTO social_posts (channel, trailer_id, caption, img) VALUES (?,?,?,?)");
  const made = pool.map((t, i) => ins.run(i % 2 ? "instagram" : "facebook", t.id, genCaption(t, offset + i), t.img));
  adSetSetting("tpl_offset", (offset + pool.length) % AD_TEMPLATES.length);
  res.json({ ok: true, created: made.length });
});

app.post("/api/admin/ads/:id/post", auth(true), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const row = db.prepare("SELECT *, null AS x FROM social_posts WHERE id=? AND status IN ('draft','failed')").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "no such draft" });
  const out = await publishDraft(row);
  if (!out.ok) return res.status(502).json(out);
  res.json(out);
});

app.post("/api/admin/ads/:id/update", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  db.prepare("UPDATE social_posts SET caption=? WHERE id=? AND status IN ('draft','failed')").run(String(req.body?.caption || "").slice(0, 2100), Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/ads/:id/delete", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  db.prepare("DELETE FROM social_posts WHERE id=? AND status IN ('draft','failed')").run(Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/ads/autopilot", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const on = req.body?.on ? "1" : "0";
  const every = Math.min(Math.max(Number(req.body?.every_min) || 120, 15), 10080);
  adSetSetting("on", on); adSetSetting("every_min", every);
  res.json({ ok: true, on: on === "1", every_min: every });
});

/* autopilot tick: every 60s, fires generate+publish when due (drafts stay clean if a channel is unconfigured) */
setInterval(async () => {
  if (adSetting("on", "0") !== "1") return;
  const everyMs = Number(adSetting("every_min", "120")) * 60_000;
  const last = Date.parse(adSetting("last_at", "") || "") || 0;
  if (Date.now() - last < everyMs) return;
  adSetSetting("last_at", new Date().toISOString());
  const cfg = adCfg();
  const take = db.prepare("SELECT * FROM social_posts WHERE status='draft' AND channel=? ORDER BY id LIMIT 1");
  for (const ch of ["facebook", "instagram"]) {
    if (!cfg[ch === "instagram" ? "ig" : "fb"]) continue;
    const d = take.get(ch);
    if (d) publishDraft(d).catch(() => {});
  }
  /* keep the queue fed: if either channel has no drafts, mint replacements from inventory */
  const dry = ["facebook", "instagram"].filter((ch) => cfg[ch === "instagram" ? "ig" : "fb"] && !take.get(ch));
  if (dry.length) {
    const pool = db.prepare("SELECT id, title, daily, city, state, st, img, dims, delivery FROM trailers WHERE status='live' AND img IS NOT NULL AND img != '' ORDER BY RANDOM() LIMIT ?").all(dry.length);
    const ins = db.prepare("INSERT INTO social_posts (channel, trailer_id, caption, img, autopilot) VALUES (?,?,?,?,1)");
    const off = Number(adSetting("tpl_offset", "0"));
    pool.forEach((t, i) => ins.run(dry[i], t.id, genCaption(t, off + i), t.img));
    adSetSetting("tpl_offset", (off + pool.length) % AD_TEMPLATES.length);
  }
}, 60_000).unref();
/* Public community reading; authenticated members can post, reply, react, and remove their own posts. */
app.get("/api/community/feed", auth(false), (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.user_id, p.text, p.link, p.created_on,
    COALESCE(u.display_name, 'Community member') AS display_name, COALESCE(u.picture, '') AS picture,
    (SELECT COUNT(*) FROM community_likes l WHERE l.post_id=p.id) AS likes,
    EXISTS(SELECT 1 FROM community_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
    FROM community_posts p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 60`).all(req.user?.id || 0);
  const comments = db.prepare(`SELECT c.id, c.post_id, c.text, c.created_on,
    COALESCE(u.display_name, 'Community member') AS display_name
    FROM community_comments c JOIN users u ON u.id=c.user_id
    WHERE c.post_id IN (${rows.length ? rows.map(() => "?").join(",") : "NULL"}) ORDER BY c.id ASC`).all(...rows.map((r) => r.id));
  const byPost = new Map();
  for (const c of comments) { if (!byPost.has(c.post_id)) byPost.set(c.post_id, []); byPost.get(c.post_id).push(c); }
  res.set("Cache-Control", "no-store");
  res.json({ rows: rows.map((r) => ({ ...r, liked: !!r.liked, comments: byPost.get(r.id) || [] })) });
});
app.post("/api/community/posts", auth(true), (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 1200);
  const rawLink = String(req.body?.link || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "Write something before posting." });
  let link = "";
  if (rawLink) {
    try { const u = new URL(rawLink); if (!['https:', 'http:'].includes(u.protocol)) throw new Error(); link = u.href; }
    catch { return res.status(400).json({ error: "Link must be a valid http or https URL." }); }
  }
  const result = db.prepare("INSERT INTO community_posts (user_id,text,link) VALUES (?,?,?)").run(req.user.id, text, link);
  res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
});
app.post("/api/community/posts/:id/comments", auth(true), (req, res) => {
  const postId = Number(req.params.id), text = String(req.body?.text || "").trim().slice(0, 500);
  if (!Number.isSafeInteger(postId) || !db.prepare("SELECT id FROM community_posts WHERE id=?").get(postId)) return res.status(404).json({ error: "Post not found." });
  if (!text) return res.status(400).json({ error: "Write a reply first." });
  const result = db.prepare("INSERT INTO community_comments (post_id,user_id,text) VALUES (?,?,?)").run(postId, req.user.id, text);
  res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
});
app.post("/api/community/posts/:id/like", auth(true), (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isSafeInteger(postId) || !db.prepare("SELECT id FROM community_posts WHERE id=?").get(postId)) return res.status(404).json({ error: "Post not found." });
  const existing = db.prepare("SELECT 1 FROM community_likes WHERE post_id=? AND user_id=?").get(postId, req.user.id);
  if (existing) db.prepare("DELETE FROM community_likes WHERE post_id=? AND user_id=?").run(postId, req.user.id);
  else db.prepare("INSERT INTO community_likes (post_id,user_id) VALUES (?,?)").run(postId, req.user.id);
  res.json({ ok: true, liked: !existing });
});
app.delete("/api/community/posts/:id", auth(true), (req, res) => {
  const postId = Number(req.params.id);
  const post = db.prepare("SELECT user_id FROM community_posts WHERE id=?").get(postId);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (post.user_id !== req.user.id && !["admin", "owner"].includes(req.user.role)) return res.status(403).json({ error: "You can only remove your own posts." });
  db.prepare("DELETE FROM community_posts WHERE id=?").run(postId);
  res.json({ ok: true });
});

/* Shared Dell-hosted campaign source. The widget feed is public and contains only active creatives. */
const NETWORK_AD_IMAGE_HOSTS = new Set(["phantomide.com", "haksterai.com", "rmt.haksterai.com"]);
// Parrot LAN host feeding the template assets (http on :4000) — allowed so the
// public image proxy can serve them; internet sites never touch it directly.
const NETWORK_AD_LAN_IMAGE = { protocol: "http:", hostname: "10.0.0.251", port: "4000" };
const isLanAdsImage = (url) => url.protocol === NETWORK_AD_LAN_IMAGE.protocol && url.hostname === NETWORK_AD_LAN_IMAGE.hostname && (!url.port || url.port === NETWORK_AD_LAN_IMAGE.port) && !url.username && !url.password;
function networkAdImageUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    if (((url.protocol === "https:" && NETWORK_AD_IMAGE_HOSTS.has(url.hostname) && !url.port) || isLanAdsImage(url)) && !url.username && !url.password) {
      return `https://rmt.haksterai.com/api/network-ads/image?src=${encodeURIComponent(url.href)}`;
    }
  } catch {}
  return String(raw || "");
}
app.get("/api/network-ads/image", async (req, res) => {
  let target;
  try { target = new URL(String(req.query.src || "")); }
  catch { return res.status(400).json({ error: "invalid image URL" }); }
  if ((!isLanAdsImage(target)) && (target.protocol !== "https:" || !NETWORK_AD_IMAGE_HOSTS.has(target.hostname) || target.port || target.username || target.password)) {
    return res.status(400).json({ error: "image host is not allowed" });
  }
  try {
    const upstream = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml" } });
    if (!upstream.ok || !upstream.body) return res.status(502).end();
    const contentType = String(upstream.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!/^image\/(avif|webp|png|jpeg|gif|svg\+xml)$/.test(contentType)) return res.status(415).end();
    const reader = upstream.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5 * 1024 * 1024) { await reader.cancel(); return res.status(413).end(); }
      chunks.push(Buffer.from(value));
    }
    res.set({ "Content-Type": contentType, "Content-Length": String(size), "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" });
    res.send(Buffer.concat(chunks, size));
  } catch { res.status(502).end(); }
});

/* Owner-only TopReels image generation bridge. The live published-site origin
   cannot reach the Parrot IDE API through Cloudflare, so RMT forwards the
   bounded request over the private LAN. */
const TOPREELS_IMAGE_ORIGINS = new Set([`https://${TOPREELS_HOST}`]);
const topReelsImageRates = new Map();
let activeTopReelsImageJobs = 0;
function allowTopReelsImage(ip) {
  const now = Date.now();
  let entry = topReelsImageRates.get(ip);
  if (!entry || now - entry.startedAt >= 60_000) entry = { startedAt: now, count: 0 };
  entry.count++;
  topReelsImageRates.set(ip, entry);
  if (topReelsImageRates.size > 5000) {
    for (const [key, value] of topReelsImageRates) if (now - value.startedAt >= 60_000) topReelsImageRates.delete(key);
  }
  return entry.count <= 4;
}
function setTopReelsImageCors(req, res) {
  const origin = req.get("origin") || "";
  if (!TOPREELS_IMAGE_ORIGINS.has(origin)) return false;
  res.set({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  });
  return true;
}
app.options("/api/image/generate", (req, res) => {
  if (!setTopReelsImageCors(req, res)) return res.status(403).json({ error: "origin not allowed" });
  return res.status(204).end();
});
app.post("/api/image/generate", async (req, res) => {
  if (!setTopReelsImageCors(req, res)) return res.status(403).json({ error: "origin not allowed" });
  if (!isTopReelsOwner(req)) return res.status(403).set("Cache-Control", "no-store").json({ error: "TopReels owner sign-in required" });
  const prompt = String(req.body?.prompt || "").trim();
  const size = String(req.body?.size || "1024x1024");
  if (!prompt || prompt.length > 1200) return res.status(400).json({ error: "prompt must be 1–1200 characters" });
  if (size !== "1024x1024") return res.status(400).json({ error: "only 1024x1024 output is supported" });
  if (!allowTopReelsImage(String(req.ip || req.socket.remoteAddress || "unknown"))) return res.status(429).json({ error: "image generation rate limit reached; wait a minute and retry" });
  if (activeTopReelsImageJobs >= 2) return res.status(429).json({ error: "image generation is busy; retry shortly" });
  activeTopReelsImageJobs++;
  try {
    const upstream = await fetch("http://10.0.0.251:4000/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size }),
      signal: AbortSignal.timeout(125_000),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(502).set("Cache-Control", "no-store").json({ error: "Parrot image service returned HTTP " + upstream.status });
    if (!String(result.url || "").startsWith("data:image/")) return res.status(502).set("Cache-Control", "no-store").json({ error: "Parrot image service returned no image" });
    return res.set("Cache-Control", "no-store").json(result);
  } catch (error) {
    console.warn("[topreels-image] Parrot image proxy failed:", String(error?.message || error).slice(0, 120));
    return res.status(502).set("Cache-Control", "no-store").json({ error: "Parrot image service is unavailable; retry shortly" });
  } finally {
    activeTopReelsImageJobs--;
  }
});
app.get(["/api/media/:filename", "/api/public/file/:filename"], (req, res) => {
  const filename = String(req.params.filename || "");
  if (!/^[a-f0-9]{64}\.(avif|webp|png|jpg|gif|svg)$/.test(filename)) return res.status(400).end();
  const file = path.join("/home/ghost/backups/network-ads/assets", filename);
  if (!fs.existsSync(file)) return res.status(404).end();
  const contentType = ({ avif: "image/avif", webp: "image/webp", png: "image/png", jpg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" })[path.extname(filename).slice(1)];
  res.set({ "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }).sendFile(file);
});
const activeSharedAdIds = new Set();
const adEventRates = new Map();
const AD_TRACK_ORIGINS = new Map([
  ["https://phantomide.com", "phantomide.com"], ["https://www.phantomide.com", "phantomide.com"],
  ["https://haksterai.com", "haksterai.com"], ["https://www.haksterai.com", "haksterai.com"],
  ["https://rmt.haksterai.com", "rmt.haksterai.com"],
  ["https://topreels-3230f40cc3.haksterai.com", "topreels"],
]);
function sharedAdCounts() {
  return Object.fromEntries(db.prepare("SELECT campaign_id, SUM(event_type='impression') AS impressions, SUM(event_type='click') AS clicks FROM network_ad_events GROUP BY campaign_id").all()
    .map(row => [row.campaign_id, { impressions: Number(row.impressions || 0), clicks: Number(row.clicks || 0) }]));
}
function setAdTrackCors(req, res) {
  const origin = req.get("origin") || "";
  if (origin && !AD_TRACK_ORIGINS.has(origin)) return false;
  if (origin) {
    res.set({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" });
  }
  return true;
}
function allowAdEvent(ip) {
  const now = Date.now();
  let rate = adEventRates.get(ip);
  if (!rate || now - rate.start >= 60000) rate = { start: now, count: 0 };
  rate.count++;
  adEventRates.set(ip, rate);
  if (adEventRates.size > 5000) {
    for (const [key, value] of adEventRates) if (now - value.start >= 60000) adEventRates.delete(key);
  }
  return rate.count <= 120;
}
app.options("/api/network-ads/track", (req, res) => {
  if (!setAdTrackCors(req, res)) return res.status(403).json({ error: "origin not allowed" });
  return res.status(204).end();
});
app.post("/api/network-ads/track", express.json({ limit: "8kb" }), (req, res) => {
  if (!setAdTrackCors(req, res)) return res.status(403).json({ error: "origin not allowed" });
  if (!allowAdEvent(String(req.ip || req.socket.remoteAddress || "unknown"))) return res.status(429).json({ error: "ad event rate limit exceeded" });
  const type = String(req.body?.type || "");
  const campaignId = String(req.body?.campaign_id || "");
  const eventKey = String(req.body?.event_key || "");
  const site = String(req.body?.site || "");
  const origin = req.get("origin") || "";
  const originSite = origin ? AD_TRACK_ORIGINS.get(origin) : null;
  const slotIndex = Number(req.body?.slot_index);
  if (!["impression", "click"].includes(type) || !/^(?:network-campaign-\d+|phantom-[a-z0-9-]{1,80})$/i.test(campaignId) ||
      !/^[a-f0-9-]{36}$/i.test(eventKey) || !["phantomide.com", "haksterai.com", "rmt.haksterai.com", "topreels"].includes(site) ||
      // The shared embed widget is served from rmt.haksterai.com, so the iframe
      // request carries the RMT origin and cannot name the embedding site by
      // itself. Only that widget origin may attribute one of the allowlisted
      // embed sites; every other caller must still match origin and site.
      (originSite && originSite !== site && originSite !== "rmt.haksterai.com") || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 9999)
    return res.status(400).json({ error: "invalid ad event" });
  if (!activeSharedAdIds.has(campaignId)) return res.status(404).json({ error: "campaign is not active in the shared feed" });
  try {
    const result = db.prepare("INSERT OR IGNORE INTO network_ad_events (event_key,campaign_id,event_type,site,slot_index) VALUES (?,?,?,?,?)")
      .run(eventKey, campaignId, type, site, slotIndex);
    const counts = sharedAdCounts()[campaignId] || { impressions: 0, clicks: 0 };
    return res.status(result.changes ? 201 : 200).json({ ok: true, duplicate: !result.changes, ...counts });
  } catch { return res.status(500).json({ error: "ad event could not be recorded" }); }
});

app.get(["/api/network-ads/feed", "/api/public/cards"], async (_req, res) => {
  const rows = db.prepare("SELECT * FROM network_campaigns WHERE status='active' ORDER BY id DESC LIMIT 100").all();
  const ownedTemplates = rows.map((r) => ({
    id: `network-campaign-${r.id}`, title: r.title, host: (() => { try { return new URL(r.href).host; } catch { return ""; } })(),
    kind: r.source.toUpperCase(), image: networkAdImageUrl(r.image), href: r.href, headline: r.headline,
    support: r.support, cta: r.cta, status: "active", sources: [{ url: r.href, evidence: `Campaign source: ${r.source}` }],
  }));
  let existing = [];
  // Fetch the template feed over the LAN (Parrot box serves it on :4000) —
  // the public phantomide.com origin sits behind a Cloudflare challenge and
  // was silently failing from the Dell, strangling rotation to a single ad.
  try {
    const response = await fetch("http://10.0.0.251:4000/house-ads/campaign-templates.json", { cache: "no-store", signal: AbortSignal.timeout(4500) });
    if (response.ok) {
      const sourceFeed = await response.json();
      existing = (sourceFeed.templates || []).filter((a) => a.status === "active").map((a) => ({
        ...a,
        id: `phantom-${String(a.id || "campaign").replace(/[^a-z0-9-]/gi, "-")}`,
        image: networkAdImageUrl(a.image && !/^https:\/\//i.test(a.image) ? `http://10.0.0.251:4000/house-ads/${String(a.image).replace(/^\/+/, "")}` : a.image),
      }));
    }
  } catch { /* keep Dell campaigns available if the LAN feed is unreachable */ }
  const updated = rows[0]?.updated_on || rows[0]?.created_on || "empty";
  const templates = [...ownedTemplates, ...existing];
  activeSharedAdIds.clear();
  for (const campaign of templates) activeSharedAdIds.add(String(campaign.id));
  const eventCounts = sharedAdCounts();
  const renderedTemplates = templates.map((campaign) => {
    const localCreative = archivedCreativeUrl(campaign.id, campaign.image);
    const isJunkalot = String(campaign.host || "").toLowerCase().replace(/^www\./, "") === "junkalot.co";
    const social_links = isJunkalot ? [
      { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61574927846597" },
      { label: "Instagram", url: "https://www.instagram.com/junkalotjunkremoval/" },
      { label: "TikTok", url: "https://www.tiktok.com/@junkalotjunkremoval" },
      { label: "Yelp", url: "https://www.yelp.com/biz/junk-a-lot-walnut-creek-2" },
    ] : (Array.isArray(campaign.social_links) ? campaign.social_links : []);
    return { ...campaign, social_links, ...(eventCounts[campaign.id] || { impressions: 0, clicks: 0 }), ...(localCreative ? { image: localCreative } : {}) };
  });
  res.set({ "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }).json({ schema_version: 1, updated, rotation_seconds: 8, templates: renderedTemplates });
  archiveNetworkAdCampaigns(templates, { uploadsDirectory: UPLOADS }).then((failures) => {
    for (const failure of failures) console.warn(`[network-ad-archive] ${failure.id}: ${failure.error}`);
  }).catch((error) => console.error(`[network-ad-archive] ${error.message}`));
});
app.get(["/api/network-ads/widget", "/api/public/card-frame"], (_req, res) => {
  res.removeHeader("X-Frame-Options");
  res.set({ "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8" }).send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font:14px system-ui,sans-serif;background:#080b12;color:#f5f7fb}#root{width:100%;height:100%}.ad-card{display:flex;flex-direction:column;gap:4px;width:100%;height:100%;min-height:0;overflow:hidden}.creative{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,55%) minmax(0,1fr);gap:clamp(8px,2.5vw,14px);align-items:center;width:100%;padding:9px;color:inherit;text-decoration:none;border:1px solid #a78bfa70;border-radius:12px;background:linear-gradient(130deg,#171327,#0d111a);overflow:hidden}.art{width:100%;height:auto;min-height:0;max-height:220px;object-fit:contain;align-self:center;border-radius:8px;background:transparent}.art.slide{height:100%;max-height:none;object-fit:contain;background:#10131b}.art-poster{display:none;width:100%;min-height:120px;aspect-ratio:4/3;place-content:center;gap:12px;padding:12px;border:1px solid #ffd16670;border-radius:8px;text-align:center;background:radial-gradient(ellipse at 80% 15%,#8b5cf680,transparent 45%),linear-gradient(135deg,#10111f,#28200d);color:#fff}.art-poster b{font-size:clamp(15px,3vw,22px);line-height:1.1}.art-poster span{font-size:10px;color:#ffd166;font-weight:800}.art-health{display:none;position:absolute;top:12px;left:12px;z-index:3;border:1px solid #ffd16688;border-radius:999px;padding:5px 9px;background:#090b12eF;color:#ffd166;font-size:9px;font-weight:900}.copy{min-width:0;max-height:100%;overflow:hidden;display:flex;flex-direction:column;gap:6px}.eyebrow{font-size:clamp(8px,2vw,10px);letter-spacing:.12em;color:#c4b5fd;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:clamp(14px,4vw,21px);font-weight:900;margin:2px 0;line-height:1.12}.support{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:clamp(10px,2.6vw,12px);color:#c1c8d4;line-height:1.3}.domain{overflow:hidden;color:#e9d5ff;font-size:clamp(9px,2.2vw,11px);font-weight:700;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.cta{display:inline-block;align-self:flex-start;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px;border-radius:20px;background:#f5b325;color:#15171a;padding:6px 10px;font-size:9px;font-weight:900;letter-spacing:.05em}.dots{display:flex;gap:4px;margin-top:3px;overflow:hidden}.dot{flex:0 0 5px;width:5px;height:5px;background:#535866;border-radius:50%}.dot.on{background:#f5b325}.social-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:0 0 27px;padding:0 2px}.network-social-profiles{display:flex;flex:0 0 25px;align-items:center;justify-content:center;gap:6px;overflow-x:auto;white-space:nowrap;padding:0 4px}.social-profile-link{display:inline-flex;flex:0 0 auto;align-self:auto;margin:0;padding:2px 7px;border:1px solid #b6ff2e66;border-radius:999px;color:#d7ff8a;font-size:9px;font-weight:700;text-decoration:none}.social-button{display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:4px 9px;border:1px solid #ffffff2c;border-radius:999px;background:#12131c;color:#e9d5ff;font:700 9px/1 system-ui,sans-serif;text-decoration:none;cursor:pointer}.social-button:hover,.social-button:focus-visible{border-color:#c084fc;color:#fff;outline:2px solid #c084fc55;outline-offset:1px}@media(max-width:360px){.creative{grid-template-columns:minmax(0,55%) minmax(0,1fr);gap:8px;padding:7px}.title{font-size:14px}.support{-webkit-line-clamp:2}.cta{font-size:8px;padding:5px 8px}.social-actions{flex-basis:25px}.social-button{min-height:22px;padding:4px 8px;font-size:8px}}@media(max-width:360px) and (min-height:260px){.creative{grid-template-columns:minmax(0,1fr);grid-template-rows:clamp(86px,28vw,132px) minmax(0,1fr);gap:8px}.art{width:100%;height:100%;max-height:150px;object-fit:contain}.copy{padding:0 3px 2px}}
</style></head><body><div id="root" role="region" aria-label="Sponsored campaign"></div><script>
const FEED='/api/public/cards';const EMBED_SITES={topreels:'topreels','phantomide.com':'phantomide.com','haksterai.com':'haksterai.com','rmt.haksterai.com':'rmt.haksterai.com'};const EMBED_ORIGINS={'https://topreels-3230f40cc3.haksterai.com':'topreels','https://phantomide.com':'phantomide.com','https://www.phantomide.com':'phantomide.com','https://haksterai.com':'haksterai.com','https://www.haksterai.com':'haksterai.com','https://rmt.haksterai.com':'rmt.haksterai.com'};function embedSite(){try{const p=new URLSearchParams(location.search).get('site');if(p&&Object.prototype.hasOwnProperty.call(EMBED_SITES,p))return EMBED_SITES[p];}catch(e){}try{const o=new URL(document.referrer).origin;if(Object.prototype.hasOwnProperty.call(EMBED_ORIGINS,o))return EMBED_ORIGINS[o];}catch(e){}return '';}const TRACK_SITE=embedSite();function adEventKey(){try{return crypto.randomUUID();}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});}}function trackAd(campaignId,type,slotIndex){campaignId=String(campaignId||'');if(!TRACK_SITE)return;if(!/^(?:network-campaign-[0-9]+|phantom-[a-z0-9-]{1,80})$/i.test(campaignId))return;try{fetch('/api/network-ads/track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,campaign_id:campaignId,event_key:adEventKey(),site:TRACK_SITE,slot_index:Number(slotIndex)||0})}).catch(function(){});}catch(e){}}const cardSignature=items=>JSON.stringify(items.map(a=>({id:a.id,status:a.status,href:a.href,host:a.host,image:a.image,headline:a.headline,support:a.support,cta:a.cta,slides:a.slides||[],social_links:a.social_links||[]})));let paintVersion=0;function posterSvg(a){const escXml=v=>String(v||'').slice(0,64).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&apos;'}[c]));const title=escXml(a.headline||a.title||'Sponsored offer');return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"600\"><defs><linearGradient id=\"g\" x2=\"1\" y2=\"1\"><stop stop-color=\"#11121f\"/><stop offset=\"1\" stop-color=\"#30214d\"/></linearGradient></defs><rect width=\"800\" height=\"600\" fill=\"url(#g)\"/><rect x=\"24\" y=\"24\" width=\"752\" height=\"552\" rx=\"28\" fill=\"none\" stroke=\"#ffd166\" stroke-opacity=\".7\" stroke-width=\"3\"/><text x=\"64\" y=\"150\" fill=\"#ffd166\" font-family=\"Arial,sans-serif\" font-size=\"24\" font-weight=\"700\">SPONSORED · TOPREELS</text><text x=\"64\" y=\"300\" fill=\"#ffffff\" font-family=\"Arial,sans-serif\" font-size=\"38\" font-weight=\"800\">'+title+'</text><text x=\"64\" y=\"500\" fill=\"#b6ff2e\" font-family=\"Arial,sans-serif\" font-size=\"20\">Image restored for preview</text></svg>')};const FALLBACK={id:'network-fallback-junkalot',title:'Junkalot · Pool Cleanup',kind:'SPONSORED',headline:'A real pool cleanup, before & after',support:'See completed Junkalot customer work.',image:'https://rmt.haksterai.com/api/public/file/8cbcb4e1cb058f3aed353c44ca1cdaa678b35e1b83512be335ad9e32179072a6.png',href:'https://junkalot.co/portfolio',cta:'SEE REAL JOBS',status:'active'};let ads=[FALLBACK],seen=new Set(),impressed=new Set(),rotationIndex=0;const slideIndices=new Map();const $=document.getElementById('root');function safeUrl(s){try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}}function paint(){if(!ads.length){$.innerHTML='<div style="display:grid;place-items:center;height:100%;color:#aab1bf">Sponsored campaigns are loading…</div>';return}const slot=rotationIndex%ads.length,a=ads[slot],href=safeUrl(a.href),slides=(Array.isArray(a.slides)?a.slides:[]).filter(s=>safeUrl(s&&(s.src||s.url||s.image))),slide=slides.length?slides[(slideIndices.get(a.id)||0)%slides.length]:null,img=safeUrl(slide?(slide.src||slide.url||slide.image):a.image);let domain=a.host||'';try{domain=domain||new URL(href).hostname.replace(/^www\./i,'')}catch{}if(!href){ads.splice(slot,1);paint();return}const esc=(v)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const socialProfiles=(Array.isArray(a.social_links)?a.social_links:[]).filter(x=>x&&safeUrl(x.url));const profileLinks=socialProfiles.length?'<div class="network-social-profiles">'+socialProfiles.map(x=>'<a class="social-profile-link" href="'+safeUrl(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.label||'Social')+'</a>').join('')+'</div>':'';$.innerHTML='<div class="ad-card"><a class="creative" href="'+href+'" target="_blank" rel="noopener noreferrer sponsored"><img class="art'+(slide?' slide':'')+'" src="'+(img||FALLBACK.image)+'" alt="'+esc(a.title||'Sponsored campaign')+'" fetchpriority="high"><div class="art-poster" aria-hidden="true"><b>'+esc(a.headline||a.title||'Sponsored offer')+'</b><span>TOPREELS · IMAGE RESTORED</span></div><span class="art-health" role="status" aria-live="polite"></span><div class="copy"><div class="eyebrow">'+esc(a.kind||'Sponsored')+'</div><div class="title">'+esc(a.headline||a.title||'Explore')+'</div><div class="support">'+esc(a.support||'')+'</div><div class="domain">'+esc(domain)+'</div><span class="cta">'+esc(a.cta||'LEARN MORE')+' →</span><div class="dots">'+ads.map((_,i)=>'<i class="dot '+(i===slot?'on':'')+'"></i>').join('')+'</div></div></a><div class="social-actions"><a class="social-button" data-facebook href="https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(href)+'" target="_blank" rel="noopener noreferrer">f&nbsp; Facebook</a><button class="social-button" data-instagram type="button">◎&nbsp; Instagram</button></div>'+profileLinks+'</div>';const ig=$.querySelector('[data-instagram]');ig.addEventListener('click',async()=>{try{if(navigator.share){await navigator.share({title:a.title||'Sponsored offer',text:a.headline||'',url:href});}else if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(href);ig.textContent='Link copied';setTimeout(()=>{ig.textContent='◎ Instagram';},1800);}else{ig.textContent='Copy offer link';}}catch{}});const creative=$.querySelector('.creative');if(creative)creative.addEventListener('click',function(){trackAd(a.id,'click',slot)});const art=$.querySelector('.art'),poster=$.querySelector('.art-poster'),health=$.querySelector('.art-health');let retried=false,posterTried=false,paintId=++paintVersion;function recoverImage(){if(!retried&&art.src!==FALLBACK.image){retried=true;health.textContent='IMAGE AUTO-RESTORED';health.style.display='block';art.src=FALLBACK.image;return}if(!posterTried){posterTried=true;health.textContent='BRANDED IMAGE FALLBACK';health.style.display='block';art.src=posterSvg(a);return}art.style.display='none';poster.style.display='grid';health.textContent='IMAGE DEGRADED · POSTER SHOWN';health.style.display='block'}art.addEventListener('error',recoverImage);art.addEventListener('load',()=>{const box=art.getBoundingClientRect();if(!art.naturalWidth||!art.naturalHeight||box.width<2||box.height<2){recoverImage();return}if(!posterTried){health.style.display='none'}});setTimeout(()=>{if(paintId!==paintVersion)return;if(!art.complete||!art.naturalWidth)recoverImage()},8000);if(art.complete){if(art.naturalWidth)health.style.display='none';else recoverImage()}if(!seen.has(a.id))seen.add(a.id);if(!impressed.has(a.id)){impressed.add(a.id);trackAd(a.id,'impression',slot)}}async function load(){try{const r=await fetch(FEED,{cache:'no-store',mode:'cors'});if(!r.ok)throw Error();const j=await r.json();const next=(j.templates||[]).filter(a=>a.status==='active'&&safeUrl(a.href));if(next.length&&cardSignature(next)!==cardSignature(ads)){const currentId=ads[rotationIndex]?.id;ads=next;const preserved=ads.findIndex(item=>item.id===currentId);rotationIndex=preserved>=0?preserved:rotationIndex%ads.length;paint()}}catch{}}paint();load();setInterval(()=>{rotationIndex=(rotationIndex+1)%Math.max(ads.length,1);paint()},8000);setInterval(()=>{const a=ads[rotationIndex%Math.max(ads.length,1)];if(a&&Array.isArray(a.slides)&&a.slides.length){slideIndices.set(a.id,((slideIndices.get(a.id)||0)+1)%a.slides.length);paint()}},6000);setInterval(load,30000);
</script></body></html>`);
});
app.get("/api/admin/network-campaigns", auth(true), (req, res) => {
  if (!["admin", "owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const counts = sharedAdCounts();
  const rows = db.prepare("SELECT * FROM network_campaigns ORDER BY id DESC LIMIT 200").all().map(row => {
    const totals = counts[`network-campaign-${row.id}`] || { impressions: 0, clicks: 0 };
    return { ...row, ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions : 0 };
  });
  res.json({ rows });
});
app.post("/api/network-ads/events", express.json(), (req, res) => {
  const secret = process.env.RMT_PAY_SECRET || "";
  if (!secret || req.get("x-rmt-secret") !== secret) return res.status(403).json({ error: "forbidden" });
  const eventKey = String(req.body?.event_key || "").trim().slice(0, 180);
  const source = String(req.body?.source || "").trim().toLowerCase();
  const title = String(req.body?.title || "").trim().slice(0, 100);
  const headline = String(req.body?.headline || "").trim().slice(0, 160);
  const support = String(req.body?.support || "").trim().slice(0, 300);
  const cta = String(req.body?.cta || "LEARN MORE").trim().slice(0, 36);
  let href, image;
  try { href = new URL(String(req.body?.href || "")); }
  catch { return res.status(400).json({ error: "invalid campaign destination" }); }
  try { image = new URL(String(req.body?.image || "")); }
  catch { return res.status(400).json({ error: "invalid campaign image" }); }
  const allowedHosts = new Set(["haksterai.com", "phantomide.com", "rmt.haksterai.com"]);
  if (!eventKey || !["haksterai", "phantomide", "rmt"].includes(source) || !title || !headline || href.protocol !== "https:" || image.protocol !== "https:" || !allowedHosts.has(href.hostname) || !allowedHosts.has(image.hostname)) return res.status(400).json({ error: "invalid campaign event" });
  const result = db.prepare(`INSERT INTO network_campaigns (event_key,source,title,headline,support,image,href,cta,status)
    VALUES (?,?,?,?,?,?,?,?,'active') ON CONFLICT(event_key) DO NOTHING`).run(eventKey, source, title, headline, support, image.href, href.href, cta);
  const saved = db.prepare("SELECT * FROM network_campaigns WHERE event_key=?").get(eventKey);
  archiveNetworkAdCampaigns([saved], { uploadsDirectory: UPLOADS }).then((failures) => {
    for (const failure of failures) console.warn(`[network-ad-archive] ${failure.id}: ${failure.error}`);
  }).catch((error) => console.error(`[network-ad-archive] ${error.message}`));
  res.status(result.changes ? 201 : 200).json({ ok: true, created: !!result.changes });
});
app.post("/api/admin/network-campaigns", auth(true), (req, res) => {
  if (!["admin", "owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const title = String(req.body?.title || "").trim().slice(0, 100);
  const headline = String(req.body?.headline || "").trim().slice(0, 160);
  const support = String(req.body?.support || "").trim().slice(0, 300);
  const cta = String(req.body?.cta || "LEARN MORE").trim().slice(0, 36);
  const source = String(req.body?.source || "owner").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48) || "owner";
  let href, image;
  try { href = new URL(String(req.body?.href || "").trim()); if (!['https:', 'http:'].includes(href.protocol)) throw new Error(); }
  catch { return res.status(400).json({ error: "Campaign destination must be a valid http or https URL." }); }
  try { image = new URL(String(req.body?.image || "").trim()); if (image.protocol !== "https:") throw new Error(); }
  catch { return res.status(400).json({ error: "Creative image must use a public https URL." }); }
  if (!title || !headline) return res.status(400).json({ error: "Campaign title and headline are required." });
  const result = db.prepare(`INSERT INTO network_campaigns (source,title,headline,support,image,href,cta,status)
    VALUES (?,?,?,?,?,?,?,'active')`).run(source, title, headline, support, image.href, href.href, cta);
  const id = Number(result.lastInsertRowid);
  const saved = db.prepare("SELECT * FROM network_campaigns WHERE id=?").get(id);
  archiveNetworkAdCampaigns([saved], { uploadsDirectory: UPLOADS }).then((failures) => {
    for (const failure of failures) console.warn(`[network-ad-archive] ${failure.id}: ${failure.error}`);
  }).catch((error) => console.error(`[network-ad-archive] ${error.message}`));
  res.status(201).json({ ok: true, id });
});
app.patch("/api/admin/network-campaigns/:id", auth(true), (req, res) => {
  if (!["admin", "owner"].includes(req.user.role)) return res.status(403).json({ error: "admin only" });
  const status = req.body?.status;
  if (!['active', 'paused', 'draft'].includes(status)) return res.status(400).json({ error: "Status must be active, paused, or draft." });
  const result = db.prepare("UPDATE network_campaigns SET status=?,updated_on=datetime('now') WHERE id=?").run(status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Campaign not found." });
  const saved = db.prepare("SELECT * FROM network_campaigns WHERE id=?").get(Number(req.params.id));
  archiveNetworkAdCampaigns([saved], { uploadsDirectory: UPLOADS }).then((failures) => {
    for (const failure of failures) console.warn(`[network-ad-archive] ${failure.id}: ${failure.error}`);
  }).catch((error) => console.error(`[network-ad-archive] ${error.message}`));
  res.json({ ok: true });
});

/* public: latest posted social ad — powers the on-site ad popup */
app.get("/api/ads/popup", (req, res) => {
  try {
    const row = db.prepare("SELECT channel, caption, img, post_url, posted_at FROM social_posts WHERE status='posted' ORDER BY id DESC LIMIT 1").get();
    res.json({ post: row || null });
  } catch { res.json({ post: null }); }
});
/* admin messages console: platform-wide threads + reply as admin or as any participant */
app.get("/api/admin/threads", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const q = String(req.query.q || "").toLowerCase().trim();
  let rows = db.prepare(`
    SELECT th.id, th.trailer_id, th.renter_id, th.clearance, th.updated_on,
      r.email AS renter_email, th.trailer_id, t.owner_id, o.email AS owner_email, t.title,
      (SELECT text FROM messages m WHERE m.thread_id = th.id ORDER BY m.id DESC LIMIT 1) AS last_text,
      (SELECT sent_on FROM messages m WHERE m.thread_id = th.id ORDER BY m.id DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM messages m WHERE m.thread_id = th.id) AS msg_count
    FROM threads th JOIN users r ON r.id = th.renter_id JOIN trailers t ON t.id = th.trailer_id LEFT JOIN users o ON o.id = t.owner_id
    ORDER BY th.updated_on DESC LIMIT 300
  `).all();
  if (q) rows = rows.filter((r0) => `${r0.id} ${r0.renter_email} ${r0.owner_email || ""} ${r0.title} ${r0.last_text || ""}`.toLowerCase().includes(q));
  res.json({ rows });
});
app.get("/api/admin/threads/:id", auth(true), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const th = db.prepare("SELECT th.*, t.title, t.owner_id FROM threads th JOIN trailers t ON t.id = th.trailer_id WHERE th.id=?").get(Number(req.params.id));
  if (!th) return res.status(404).json({ error: "no thread" });
  const rows = db.prepare("SELECT m.id, m.user_id, m.text, m.sent_on, u.display_name, u.email FROM messages m JOIN users u ON u.id = m.user_id WHERE m.thread_id=? ORDER BY m.id ASC").all(th.id);
  res.json({ thread: th, rows });
});
app.post("/api/admin/threads/:id", auth(true), async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  const th = db.prepare("SELECT th.*, t.owner_id FROM threads th JOIN trailers t ON t.id = th.trailer_id WHERE th.id=?").get(Number(req.params.id));
  if (!th) return res.status(404).json({ error: "no thread" });
  const text = String(req.body?.text || "").slice(0, 4000).trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const asUserId = Number(req.body?.as_user_id) || null;
  /* impersonation must target a real participant of THIS thread */
  let senderId = req.user.id, impersonated = false;
  if (asUserId) {
    if (asUserId !== th.renter_id && asUserId !== th.owner_id) return res.status(400).json({ error: "as_user_id must be the renter or owner of this thread" });
    senderId = asUserId;
    impersonated = true;
    logAccess("impersonate-msg", req, req.user, `thread ${th.id} sent as user #${asUserId}`);
  }
  db.prepare("INSERT INTO messages (thread_id, user_id, text) VALUES (?,?,?)").run(th.id, senderId, text);
  db.prepare("UPDATE threads SET updated_on=datetime('now') WHERE id=?").run(th.id);
  const otherId = senderId === th.renter_id ? th.owner_id : th.renter_id;
  const other = db.prepare("SELECT email, phone, phone_verified, telegram_id, telegram_verified FROM users WHERE id=?").get(otherId);
  const sender = db.prepare("SELECT display_name FROM users WHERE id=?").get(senderId);
  notifyUser(other, `[RMT] ${sender?.display_name || "Someone"}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`).catch(() => {});
  if (other?.email || other?.phone) {
    klaviyoTrack("RMT New Message", { email: other.email, phone: other.phone }, { sender: sender?.display_name || "Someone", preview: text.slice(0, 200), thread_id: th.id, trailer_title: th.title }).catch(() => {});
  }
  /* both sides should see the injected message unread unless admin posted verbatim as them */
  db.prepare("UPDATE threads SET renter_read_id=renter_read_id, owner_read_id=owner_read_id WHERE id=?").run(th.id);
  broadcast(th.id);
  res.json({ ok: true, as: senderId, impersonated });
});
/* ─── Resend webhook: email delivery events ──────────── */
function verifySvixSignature(req, secret) {
  const id = String(req.headers["svix-id"] || "");
  const timestamp = Number(req.headers["svix-timestamp"] || 0);
  if (!id || !Number.isFinite(timestamp) || timestamp <= 0) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > 5 * 60) return false;

  const raw = req.rawBody;
  if (!raw) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64url");
  if (!key.length) return false;
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64url");
  const provided = String(req.headers["svix-signature"] || "")
    .split(",")
    .map((part) => part.trim().replace(/^v1\./, ""))
    .filter(Boolean);
  if (!provided.length) return false;

  // Each candidate is the same length as the computed digest, so timingSafeEqual is safe.
  try {
    const expectedBuf = Buffer.from(expected);
    return provided.some((candidate) => {
      const candidateBuf = Buffer.from(candidate);
      return candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);
    });
  } catch { return false; }
}
app.post("/api/resend/webhook", (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Resend webhook secret not configured" });
  if (!verifySvixSignature(req, secret)) return res.status(400).json({ error: "invalid webhook signature" });

  const evt = req.body || {};
  const type = evt.type || "unknown";
  const email = evt.data?.email_id || evt.data?.to || "?";
  console.log(`[resend] ${type} — ${email}`);
  res.json({ ok: true });
});
/* Legacy IDE paths (/ads, /house-ads) — reverse-proxied from the Parrot IDE
   server over LAN so the old phantomide.com ad links resolve on the live,
   un-challenged rmt.haksterai.com origin. */
app.use(["/ads", "/house-ads"], async (req, res, next) => {
  if (req.method !== "GET") return next();
  try {
    const up = await fetch("http://10.0.0.251:4000" + req.originalUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!up.ok) { res.status(up.status).json({ error: "not available" }); return; }
    res.status(up.status)
      .set("Content-Type", up.headers.get("content-type") || "text/html; charset=utf-8")
      .set("Cache-Control", "no-store")
      .send(Buffer.from(await up.arrayBuffer()));
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: "staged origin unreachable" });
  }
});
/* Published IDE build sites — reverse-proxied from the Parrot IDE server over
   LAN, so staged sites have a real public URL (rmt.haksterai.com has no
   Cloudflare challenge) for the ad rotation to point at. Kept BEFORE the SPA
   fallback; never handles /api or /uploads. */
/* Project subdomains use the exact staged site id as their first DNS label,
   e.g. example-a1b2c3d4e5.haksterai.com -> /apps/sites/example-a1b2c3d4e5/.
   The wildcard DNS record must point at this RMT origin before these links are live. */
app.use((req, _res, next) => {
  if (req.method !== "GET") return next();
  const hostname = String(req.hostname || "").toLowerCase().replace(/\.$/, "");
  const suffix = ".haksterai.com";
  if (!hostname.endsWith(suffix)) return next();
  const siteId = hostname.slice(0, -suffix.length);
  if (["www", "rmt", "api", "mail"].includes(siteId) || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(siteId)) return next();
  req.publishedSitePath = `/apps/sites/${siteId}${req.url === "/" ? "/" : req.url}`;
  req.url = req.publishedSitePath;
  next();
});
app.use("/apps/sites", async (req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.endsWith("__selftest")) { res.status(200).send("SELFTEST OK"); return; }
  const stagedPath = req.publishedSitePath || req.originalUrl;
  console.log(`[staged-site] enter headersSent=${res.headersSent} ${stagedPath}`);
  try {
    console.log(`[staged-site] proxying ${stagedPath}`);
    const up = await fetch("http://10.0.0.251:4000" + stagedPath, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const body = Buffer.from(await up.arrayBuffer());
    console.log(`[staged-site] upstream ${up.status} ${stagedPath} (${body.length}B)`);
    if (!up.ok) { res.status(up.status).json({ error: "staged site not available" }); return; }
    // Pure express response calls — raw res.writeHead() flips headersSent and
    // then express res.send() throws ERR_HTTP_HEADERS_SENT, which hung the
    // client forever (the guard then skipped the fallback response).
    res.status(up.status)
      .set("Content-Type", up.headers.get("content-type") || "text/html; charset=utf-8")
      .set("Cache-Control", "no-store")
      .send(body);
  } catch (e) {
    console.warn(`[staged-site] error ${stagedPath}: ${e.message}`);
    if (!res.headersSent) res.status(502).json({ error: "staged site origin unreachable" });
  }
});
/* SPA fallback — LAST: only unmatched non-API GETs reach here */
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  res.set("Cache-Control", "no-store");
  return res.sendFile(path.join(DIST, "index.html"), (err) => { if (err) res.status(404).end(); });
});
