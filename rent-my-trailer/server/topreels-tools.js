/* TopReels customer tools — workspace prototype; NOT live until deployed and
   owner-verified on the real RMT runtime. All money logic is truthful:
   no rates are invented, commission amounts enter only through owner-recorded
   verified provider reports, a payout request is never a payout, and "paid"
   requires a payment-provider transaction the server itself verified.
   Meta tokens are stored encrypted per user, never returned to the browser. */

/* ─── schema ─── */
export function ensureTopReelsToolTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topreels_ref_links (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL DEFAULT '', target_url TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_ref_links_user ON topreels_ref_links(user_id, created_on DESC);
    CREATE TABLE IF NOT EXISTS topreels_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK(kind IN ('link_created','redirect_click','conversion_verified','payout_requested','payout_approved','payout_rejected','payout_paid','meta_connected','meta_disconnected','migration_scan','migration_verified','migration_requested','reel_generated','reel_exported','reel_shared')),
      event_key TEXT NOT NULL UNIQUE,
      user_id INTEGER, link_id TEXT, visitor_hash TEXT, is_bot INTEGER NOT NULL DEFAULT 0,
      provider TEXT, provider_ref TEXT, provider_status TEXT,
      currency TEXT, amount_cents INTEGER, period_start TEXT, period_end TEXT, correlation TEXT,
      detail TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT 'server',
      created_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_events_user_kind ON topreels_events(user_id, kind);
    CREATE INDEX IF NOT EXISTS idx_topreels_events_link ON topreels_events(link_id, kind);
    CREATE TABLE IF NOT EXISTS topreels_payout_requests (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      amount_cents INTEGER NOT NULL CHECK(amount_cents >= 100), currency TEXT NOT NULL DEFAULT 'usd',
      verified_balance_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'requested'
        CHECK(status IN ('requested','approved','rejected','paid')),
      requested_on TEXT NOT NULL DEFAULT (datetime('now')),
      reviewer_email TEXT, reviewed_on TEXT, approved_amount_cents INTEGER,
      provider TEXT, provider_ref TEXT, provider_destination TEXT, provider_verified_on TEXT,
      note TEXT NOT NULL DEFAULT '', updated_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_payout_requests_user ON topreels_payout_requests(user_id, requested_on DESC);
    CREATE INDEX IF NOT EXISTS idx_topreels_payout_requests_status ON topreels_payout_requests(status, requested_on);
    CREATE TABLE IF NOT EXISTS topreels_oauth_states (
      state TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), purpose TEXT NOT NULL,
      created_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS topreels_meta_links (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      page_id TEXT NOT NULL, page_name TEXT NOT NULL,
      token_ct TEXT NOT NULL, token_iv TEXT NOT NULL, token_tag TEXT NOT NULL,
      scopes TEXT NOT NULL, connected_on TEXT NOT NULL, updated_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS topreels_migration_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_id INTEGER NOT NULL REFERENCES site_migrations(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL, source_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_scanned' CHECK(status IN ('ok','failed','not_scanned')),
      http_status INTEGER, title TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      text_chars INTEGER, image_count INTEGER, link_count INTEGER,
      error TEXT NOT NULL DEFAULT '', reviewed INTEGER NOT NULL DEFAULT 0, review_note TEXT NOT NULL DEFAULT '',
      UNIQUE(migration_id, source_url)
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_migration_pages ON topreels_migration_pages(migration_id, seq);
    CREATE TABLE IF NOT EXISTS topreels_migration_token_orders (
      order_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), stripe_session_id TEXT NOT NULL UNIQUE,
      stripe_price_id TEXT NOT NULL, tokens INTEGER NOT NULL CHECK(tokens > 0), amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','failed')),
      created_on TEXT NOT NULL DEFAULT (datetime('now')), paid_on TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tr_migration_token_orders_user ON topreels_migration_token_orders(user_id,created_on DESC);
    CREATE TABLE IF NOT EXISTS topreels_migration_token_ledger (
      event_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), delta INTEGER NOT NULL CHECK(delta<>0),
      reference TEXT NOT NULL, reason TEXT NOT NULL CHECK(reason IN ('purchase','migration_scan','refund')),
      migration_id INTEGER, created_on TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(reference,reason)
    );
    CREATE INDEX IF NOT EXISTS idx_tr_migration_token_ledger_user ON topreels_migration_token_ledger(user_id,created_on DESC);
  `);
}

/* ─── limiters ─── */
const limiter = new Map();
function limit(key, max, windowMs) {
  const now = Date.now(), prior = limiter.get(key);
  if (prior && now - prior.at < windowMs && prior.count >= max) return false;
  const entry = prior && now - prior.at < windowMs ? prior : { at: now, count: 0 };
  entry.at = now; entry.count++; limiter.set(key, entry);
  return true;
}
const BOT_UA = /(facebookexternalhit|facebot|googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|ahrefs|semrush|mj12bot|petalbot|curl|wget|python-requests|python-urllib|go-http-client|apache-httpclient|headless|phantom|bot|crawl|spider|scan)/i;

export function registerTopReelsTools(ctx) {
  const { app, db, crypto, JWT_SECRET, isTopReelsOwner, getTopReelsCustomer, getTopReelsOwnerEmail, topReelsCustomerCors, topReelsCustomerEntitlement, TOPREELS_HOST, scanWebsite, verifyOwnership, discoverSitemap } = ctx;

  /* ─── helpers ─── */
  const sha = (s) => crypto.createHash("sha256").update(String(s || "")).digest("hex");
  const event = (kind, eventKey, fields = {}) => {
    db.prepare(`INSERT OR IGNORE INTO topreels_events
      (kind,event_key,user_id,link_id,visitor_hash,is_bot,provider,provider_ref,provider_status,currency,amount_cents,period_start,period_end,correlation,detail,source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(kind, String(eventKey).slice(0, 256), fields.userId ?? null, fields.linkId ?? null, fields.visitorHash ?? null,
        fields.isBot ? 1 : 0, fields.provider ?? null, fields.providerRef ?? null, fields.providerStatus ?? null,
        fields.currency ?? null, fields.amountCents ?? null, fields.periodStart ?? null, fields.periodEnd ?? null,
        fields.correlation ?? null, JSON.stringify(fields.detail ?? {}), fields.source || "server");
  };
  const metaKey = () => crypto.createHmac("sha256", JWT_SECRET).update("topreels-meta-token-v1").digest();
  function metaEncrypt(token) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", metaKey(), iv);
    const ct = Buffer.concat([cipher.update(String(token), "utf8"), cipher.final()]);
    return { ct: ct.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
  }
  const visitorHashOf = (req) => sha("rc|" + (req.ip || req.socket.remoteAddress || "") + "|" + String(req.get("user-agent") || "") + "|" + sha(JWT_SECRET + "|ref-visitor"));
  const isBot = (req) => BOT_UA.test(String(req.get("user-agent") || "")) || !String(req.get("accept") || "").includes("text/html");
  const topreelsJson = (res, status, body) => res.status(status).set("Cache-Control", "no-store, private").json(body);
  const migrationTokenPriceId = /^price_[A-Za-z0-9]+$/.test(String(process.env.TOPREELS_MIGRATION_TOKEN_PRICE_ID || "")) ? String(process.env.TOPREELS_MIGRATION_TOKEN_PRICE_ID) : "";
  const migrationTokensPerPackage = Number.isInteger(Number(process.env.TOPREELS_MIGRATION_TOKENS_PER_PACKAGE)) && Number(process.env.TOPREELS_MIGRATION_TOKENS_PER_PACKAGE) > 0 && Number(process.env.TOPREELS_MIGRATION_TOKENS_PER_PACKAGE) <= 100 ? Number(process.env.TOPREELS_MIGRATION_TOKENS_PER_PACKAGE) : 0;
  const migrationTokenBalance = userId => Number(db.prepare("SELECT COALESCE(SUM(delta),0) AS n FROM topreels_migration_token_ledger WHERE user_id=?").get(userId).n);
  const refundMigrationToken = debitId => { if (!debitId) return; const debit=db.prepare("SELECT user_id,migration_id FROM topreels_migration_token_ledger WHERE event_id=? AND reason='migration_scan'").get(debitId); if (!debit) return; db.prepare("INSERT OR IGNORE INTO topreels_migration_token_ledger(event_id,user_id,delta,reference,reason,migration_id) VALUES(?,?,1,?,'refund',?)").run(crypto.randomUUID(),debit.user_id,debitId,debit.migration_id); };

  /* ─── referral links (money-neutral: creation + click telemetry only) ─── */
  app.post("/api/topreels/customer/links", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    if (!limit("links:" + u.id, 10, 3600000)) return topreelsJson(res, 429, { ok: false, error: "Too many link requests this hour." });
    let target; try { target = new URL(String(req.body?.target || "")); } catch { return topreelsJson(res, 400, { ok: false, error: "A HTTPS target URL is required." }); }
    if (target.protocol !== "https:" || target.username || target.password) return topreelsJson(res, 400, { ok: false, error: "The target must be a plain HTTPS URL." });
    const label = String(req.body?.label || "").trim().slice(0, 80);
    const id = crypto.randomUUID(), slug = "tr" + crypto.randomBytes(5).toString("hex");
    try {
      db.prepare("INSERT INTO topreels_ref_links (id,user_id,slug,label,target_url) VALUES (?,?,?,?,?)").run(id, u.id, slug, label, target.href);
      event("link_created", sha("link_created|" + id), { userId: u.id, linkId: id, correlation: slug, detail: { label, target: target.href } });
      return topreelsJson(res, 201, { ok: true, link: { id, slug, label, target: target.href }, url: "https://" + TOPREELS_HOST + "/r/" + slug });
    } catch { return topreelsJson(res, 503, { ok: false, error: "The link could not be saved." }); }
  });
  app.get("/api/topreels/customer/links", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const links = db.prepare("SELECT id,slug,label,target_url AS target,active,created_on AS createdOn FROM topreels_ref_links WHERE user_id=? ORDER BY created_on DESC LIMIT 50").all(u.id);
    const rows = db.prepare(`SELECT link_id,
      COUNT(*) AS total, SUM(is_bot) AS bots, COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor_hash END) AS uniqueVisitors
      FROM topreels_events WHERE kind='redirect_click' AND link_id IN (SELECT id FROM topreels_ref_links WHERE user_id=?)
      GROUP BY link_id`).all(u.id);
    const byId = Object.fromEntries(rows.map((r) => [r.link_id, r]));
    return topreelsJson(res, 200, {
      ok: true,
      links: links.map((l) => ({ ...l, total: byId[l.id]?.total || 0, bots: byId[l.id]?.bots || 0, uniqueVisitors: byId[l.id]?.uniqueVisitors || 0 })),
      note: "total = deduped click events per visitor-hour; uniqueVisitors = distinct human visitors; scanner traffic is logged separately and never counted as clicks",
    });
  });
  app.get(/^\/r\/([A-Za-z0-9_-]{8,40})$/, (req, res) => {
    const link = db.prepare("SELECT * FROM topreels_ref_links WHERE slug=? AND active=1").get(req.params[0]);
    if (!link) return res.status(404).set("Cache-Control", "no-store").send("Link not found or retired.");
    const visitor = visitorHashOf(req), bot = isBot(req);
    const hour = new Date().toISOString().slice(0, 13);
    event("redirect_click", "rc|" + link.id + "|" + visitor + "|" + hour, { userId: link.user_id, linkId: link.id, visitorHash: visitor, isBot: bot, source: bot ? "scanner" : "server" });
    res.set("Cache-Control", "no-store, private").redirect(302, link.target_url);
  });

  /* ─── earnings ledger: owner-recorded verified provider reports only ─── */
  app.post("/api/admin/topreels/earnings/reports", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return topreelsJson(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const b = req.body || {}, provider = String(b.provider || "").trim().slice(0, 60);
    const reportId = String(b.reportId || "").trim().slice(0, 120), txn = String(b.transactionId || "").trim().slice(0, 120);
    const cents = Math.round(Number(b.amountCents)), currency = String(b.currency || "usd").toLowerCase().slice(0, 3);
    const status = String(b.status || "verified");
    const user = db.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").get(String(b.email || "").trim().toLowerCase());
    if (!user || !provider || !reportId || !txn || !Number.isSafeInteger(cents) || cents <= 0 || !/^[a-z]{3}$/.test(currency) || !["verified", "reversed"].includes(status))
      return topreelsJson(res, 400, { ok: false, error: "Provide provider, reportId, transactionId, email, positive amountCents, 3-letter currency, and status verified|reversed — exactly as the provider report shows." });
    event("conversion_verified", "conv|" + provider + "|" + txn, {
      userId: user.id, provider, providerRef: txn, providerStatus: status, currency,
      amountCents: cents, periodStart: b.periodStart || null, periodEnd: b.periodEnd || null,
      correlation: reportId, source: "owner_record", detail: { recordedBy: getTopReelsOwnerEmail(req) || "owner" },
    });
    return topreelsJson(res, 201, { ok: true, note: "Duplicate reports for the same provider+transaction are ignored (idempotent)." });
  });
  app.get("/api/topreels/customer/earnings", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const conversions = db.prepare(`SELECT provider,provider_ref AS providerRef,provider_status AS status,currency,
      amount_cents AS amountCents,period_start AS periodStart,period_end AS periodEnd,correlation AS reportId,created_on AS recordedOn
      FROM topreels_events WHERE kind='conversion_verified' AND user_id=? AND provider_status IN ('verified','reversed')
      ORDER BY id DESC LIMIT 100`).all(u.id);
    const sum = db.prepare(`SELECT COALESCE(SUM(CASE WHEN provider_status='verified' THEN amount_cents WHEN provider_status='reversed' THEN -amount_cents END),0) AS cents,
      COALESCE(SUM(CASE WHEN provider_status='reversed' THEN 1 ELSE 0 END),0) AS reversals
      FROM topreels_events WHERE kind='conversion_verified' AND user_id=? AND currency='usd'`).get(u.id);
    const reserved = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS cents FROM topreels_payout_requests
      WHERE user_id=? AND currency='usd' AND status IN ('requested','approved','paid')`).get(u.id);
    const state = db.prepare(`SELECT kind,status,provider,provider_ref AS providerRef,provider_status AS providerStatus,
      currency,amount_cents AS amountCents,correlation,created_on AS createdOn FROM topreels_events
      WHERE user_id=? AND kind IN ('payout_requested','payout_approved','payout_rejected','payout_paid','link_created')
      ORDER BY id DESC LIMIT 200`).all(u.id);
    return topreelsJson(res, 200, {
      ok: true,
      verifiedCents: sum.cents, reversals: sum.reversals, reservedCents: reserved.cents, availableCents: sum.cents - reserved.cents,
      conversions, state,
      commissionRates: null,
      note: "USD totals include only USD-denominated owner-recorded verified provider reports; non-USD conversions remain in history and are excluded from the USD payout balance. No commission rate is configured, and a payout request is not a payment.",
    });
  });

  /* ─── payout queue: human approval required; only a server-verified provider transaction can mark paid ─── */
  app.post("/api/topreels/customer/payout-requests", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const entitlement = await topReelsCustomerEntitlement(u);
    if (!entitlement.active) return topreelsJson(res, 403, { ok: false, error: "An active paid plan and zero unpaid Stripe balance are required before requesting a payout.", entitlement });
    const cents = Math.round(Number(req.body?.amountCents));
    if (!Number.isSafeInteger(cents) || cents < 1000) return topreelsJson(res, 400, { ok: false, error: "Request at least $10.00 (amountCents)." });
    const sum = db.prepare(`SELECT COALESCE(SUM(CASE WHEN provider_status='verified' THEN amount_cents WHEN provider_status='reversed' THEN -amount_cents END),0) AS cents
      FROM topreels_events WHERE kind='conversion_verified' AND user_id=? AND currency='usd'`).get(u.id);
    const reserved = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS cents FROM topreels_payout_requests
      WHERE user_id=? AND currency='usd' AND status IN ('requested','approved','paid')`).get(u.id);
    const available = sum.cents - reserved.cents;
    if (cents > available) return topreelsJson(res, 409, { ok: false, error: "The request exceeds your verified, unreserved earnings.", verifiedCents: sum.cents, reservedCents: reserved.cents, availableCents: available });
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO topreels_payout_requests (id,user_id,amount_cents,verified_balance_cents) VALUES (?,?,?,?)").run(id, u.id, cents, sum.cents);
    event("payout_requested", "payout|" + id + "|requested", { userId: u.id, correlation: id, currency: "usd", amountCents: cents, detail: { verifiedBalanceCents: sum.cents } });
    return topreelsJson(res, 201, {
      ok: true, id, status: "requested",
      note: "Recorded for human owner review. Nothing is paid by this request; payout requires named human approval and a payment-provider transaction verified by the server.",
    });
  });
  app.get("/api/topreels/customer/payout-requests", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const rows = db.prepare(`SELECT id,amount_cents AS amountCents,currency,status,requested_on AS requestedOn,
      reviewer_email AS reviewerEmail,reviewed_on AS reviewedOn,approved_amount_cents AS approvedAmountCents,
      provider,provider_ref AS providerRef,provider_destination AS providerDestination,provider_verified_on AS providerVerifiedOn,note
      FROM topreels_payout_requests WHERE user_id=? ORDER BY requested_on DESC LIMIT 50`).all(u.id);
    return topreelsJson(res, 200, { ok: true, requests: rows });
  });
  app.get("/api/admin/topreels/payout-requests", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return topreelsJson(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const rows = db.prepare(`SELECT r.id,u.email,r.amount_cents AS amountCents,r.currency,r.status,r.requested_on AS requestedOn,
      r.approved_amount_cents AS approvedAmountCents,r.reviewer_email AS reviewerEmail,r.reviewed_on AS reviewedOn,
      r.verified_balance_cents AS verifiedBalanceCents,r.provider,r.provider_ref AS providerRef,r.note
      FROM topreels_payout_requests r JOIN users u ON u.id=r.user_id
      ORDER BY CASE r.status WHEN 'requested' THEN 0 ELSE 1 END, r.requested_on LIMIT 200`).all();
    return topreelsJson(res, 200, { ok: true, requests: rows, rule: "Approve with a named human decision; mark paid only after this server verifies the provider transaction." });
  });
  app.patch("/api/admin/topreels/payout-requests/:id", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return topreelsJson(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const row = db.prepare("SELECT * FROM topreels_payout_requests WHERE id=?").get(String(req.params.id));
    if (!row) return topreelsJson(res, 404, { ok: false, error: "Payout request not found." });
    if (row.status !== "requested") return topreelsJson(res, 409, { ok: false, error: "Only a requested payout can be approved or rejected. A changed amount or new evidence always requires its own fresh approval." });
    const reviewer = getTopReelsOwnerEmail(req);
    if (!reviewer) return topreelsJson(res, 403, { ok: false, error: "A named reviewer identity is required." });
    const note = String(req.body?.note || "").slice(0, 500), action = String(req.body?.action || "");
    if (action === "reject") {
      db.prepare(`UPDATE topreels_payout_requests SET status='rejected',reviewer_email=?,reviewed_on=datetime('now'),note=?,updated_on=datetime('now') WHERE id=? AND status='requested'`).run(reviewer, note, row.id);
      event("payout_rejected", "payout|" + row.id + "|rejected", { userId: row.user_id, correlation: row.id, amountCents: row.amount_cents, currency: row.currency, source: "human_review", detail: { reviewer, note } });
      return topreelsJson(res, 200, { ok: true, status: "rejected" });
    }
    if (action === "approve") {
      const approved = Number.isSafeInteger(Number(req.body?.approvedAmountCents)) ? Math.round(Number(req.body.approvedAmountCents)) : row.amount_cents;
      if (approved < 100 || approved > row.amount_cents) return topreelsJson(res, 400, { ok: false, error: "approvedAmountCents must be between $1 and the requested amount." });
      db.prepare(`UPDATE topreels_payout_requests SET status='approved',approved_amount_cents=?,reviewer_email=?,reviewed_on=datetime('now'),note=?,updated_on=datetime('now') WHERE id=? AND status='requested'`).run(approved, reviewer, note, row.id);
      event("payout_approved", "payout|" + row.id + "|approved", { userId: row.user_id, correlation: row.id, amountCents: approved, currency: row.currency, source: "human_review", detail: { reviewer, note, requested: row.amount_cents } });
      return topreelsJson(res, 200, { ok: true, status: "approved", approvedAmountCents: approved, next: "Create the Stripe transfer out-of-band only after verifying the recipient's Stripe Connect onboarding and eligibility; then submit the transfer ID to the pay endpoint." });
    }
    return topreelsJson(res, 400, { ok: false, error: "action must be approve or reject." });
  });
  app.post("/api/admin/topreels/payout-requests/:id/pay", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return topreelsJson(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const row = db.prepare("SELECT * FROM topreels_payout_requests WHERE id=?").get(String(req.params.id));
    if (!row) return topreelsJson(res, 404, { ok: false, error: "Payout request not found." });
    if (row.status === "paid") return topreelsJson(res, 200, { ok: true, status: "paid", providerRef: row.provider_ref });
    if (row.status !== "approved") return topreelsJson(res, 409, { ok: false, error: "Only an approved payout can be marked paid." });
    const provider = String(req.body?.provider || "stripe").toLowerCase(), transferId = String(req.body?.transactionId || "").trim();
    if (provider !== "stripe" || !/^tr_[A-Za-z0-9]+$/.test(transferId)) return topreelsJson(res, 400, { ok: false, error: "A Stripe transfer ID (tr_…) is required; the server verifies it before recording payment." });
    const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
    if (!key) return topreelsJson(res, 503, { ok: false, error: "Stripe verification is unavailable; payment stays unrecorded." });
    try {
      const r = await fetch("https://api.stripe.com/v1/transfers/" + encodeURIComponent(transferId), { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(12000) });
      const t = await r.json().catch(() => ({}));
      if (!r.ok || t.object !== "transfer") return topreelsJson(res, 409, { ok: false, error: "Stripe did not return this transfer; payment stays unrecorded." });
      if (Number(t.amount) !== Number(row.approved_amount_cents)) return topreelsJson(res, 409, { ok: false, error: "The transfer amount does not match the approved amount; payment stays unrecorded.", transferAmount: Number(t.amount), approvedAmountCents: Number(row.approved_amount_cents) });
      if (String(t.currency || "").toLowerCase() !== String(row.currency || "usd").toLowerCase()) return topreelsJson(res, 409, { ok: false, error: "The transfer currency does not match; payment stays unrecorded." });
      if (t.metadata?.topreels_payout_request !== row.id) return topreelsJson(res, 409, { ok: false, error: 'The transfer metadata must include topreels_payout_request="' + row.id + '" so this exact approval is provably covered.' });
      const destination = String(t.destination || "");
      db.prepare(`UPDATE topreels_payout_requests SET status='paid',provider='stripe',provider_ref=?,provider_destination=?,provider_verified_on=datetime('now'),updated_on=datetime('now') WHERE id=? AND status='approved'`).run(transferId, destination, row.id);
      event("payout_paid", "payout|" + row.id + "|paid", { userId: row.user_id, provider, providerRef: transferId, providerStatus: "verified", correlation: row.id, amountCents: row.approved_amount_cents, currency: row.currency, source: "server_verified", detail: { destination } });
      return topreelsJson(res, 200, { ok: true, status: "paid", providerRef: transferId, providerDestination: destination });
    } catch (e) {
      console.warn("[topreels-payout] verification failed:", String(e?.message || e).slice(0, 120));
      return topreelsJson(res, 503, { ok: false, error: "The provider transaction could not be verified right now; payment stays unrecorded." });
    }
  });

  /* ─── Meta OAuth: server-side code exchange, encrypted per-user token, no token leaves the server ─── */
  const META_DOCS = "https://developers.facebook.com/docs/pages-api/";
  const metaConfigured = () => Boolean(String(process.env.META_APP_ID || "").trim() && String(process.env.META_APP_SECRET || "").trim());
  const GRAPH_V = "v21.0";
  app.get("/api/topreels/customer/meta/status", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const row = db.prepare("SELECT page_id,page_name,scopes,connected_on,updated_on FROM topreels_meta_links WHERE user_id=?").get(u.id);
    return topreelsJson(res, 200, {
      ok: true, configured: metaConfigured(), connected: Boolean(row),
      page: row ? { id: row.page_id, name: row.page_name } : null,
      scopes: row ? String(row.scopes).split(",").filter(Boolean) : [],
      connectedOn: row?.connected_on || null, updatedAt: row?.updated_on || null,
      docUrl: META_DOCS,
      note: row ? "One Page token stored encrypted server-side; connect an Instagram professional account by reconnecting with purpose=instagram after Page grants." : "Secure server-side OAuth activates once the owner adds META_APP_ID and META_APP_SECRET.",
    });
  });
  app.get("/api/topreels/customer/meta/connect", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    if (!metaConfigured()) return topreelsJson(res, 503, { ok: false, error: "Meta OAuth is not configured yet — no authorization was requested.", docUrl: "https://developers.facebook.com/docs/development/create-an-app/" });
    const purpose = String(req.query.purpose || "page") === "instagram" ? "instagram" : "page";
    const scope = purpose === "instagram"
      ? "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"
      : "pages_show_list,pages_read_engagement,pages_manage_posts";
    const state = crypto.randomBytes(32).toString("hex");
    db.prepare("DELETE FROM topreels_oauth_states WHERE user_id=? AND purpose=?").run(u.id, purpose);
    db.prepare("INSERT INTO topreels_oauth_states (state,user_id,purpose) VALUES (?,?,?)").run(state, u.id, purpose);
    const params = new URLSearchParams({
      client_id: String(process.env.META_APP_ID), redirect_uri: "https://rmt.haksterai.com/api/topreels/meta/callback",
      state, scope, response_type: "code",
    });
    res.set("Cache-Control", "no-store, private").redirect(302, "https://www.facebook.com/" + GRAPH_V + "/dialog/oauth?" + params.toString());
  });
  app.get("/api/topreels/meta/callback", (req, res) => {
    const state = String(req.query.state || ""), code = String(req.query.code || "");
    const fail = (msg) => res.status(400).type("html").send(htmlPage("Connection not completed", escapeHtml(msg)));
    if (!state || !code) return fail("The Facebook response was incomplete. Start the connection again from TopReels.");
    const row = db.prepare("SELECT s.*,u.email FROM topreels_oauth_states s JOIN users u ON u.id=s.user_id WHERE s.state=?").get(state);
    if (!row) return fail("This authorization request was already used or is unknown. Start it again from TopReels.");
    if (Date.parse(row.created_on || "") < Date.now() - 600000) return fail("This authorization request expired. Start it again from TopReels.");
    (async () => {
      try {
        const short = await graphPost("https://graph.facebook.com/" + GRAPH_V + "/oauth/access_token", new URLSearchParams({
          client_id: String(process.env.META_APP_ID), client_secret: String(process.env.META_APP_SECRET),
          redirect_uri: "https://rmt.haksterai.com/api/topreels/meta/callback", code,
        }));
        const long = await graphPost("https://graph.facebook.com/" + GRAPH_V + "/oauth/access_token", new URLSearchParams({
          grant_type: "fb_exchange_token", client_id: String(process.env.META_APP_ID),
          client_secret: String(process.env.META_APP_SECRET), fb_exchange_token: String(short.access_token || ""),
        }));
        const token = String(long.access_token || "");
        const pages = token ? await graphGet("me/accounts?fields=id,name&limit=3", token) : null;
        const list = Array.isArray(pages?.data) ? pages.data : [];
        const chosen = list.find((p) => String(p.id) === String(req.query.page || "")) || null;
        if (!chosen) {
          return res.status(200).type("html").send(list.length === 0
            ? htmlPage("Choose the Page to connect", "No Facebook Page is attached to your account. Create a Page (or convert to a professional account) first, then connect again from TopReels.")
            : htmlPage("Choose the Page to connect", list.map((p) =>
              `<p><a href="/api/topreels/meta/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}&page=${encodeURIComponent(String(p.id))}">Connect “${escapeHtml(String(p.name))}”</a></p>`).join("") +
              `<p class="hint">Connecting grants TopReels least-privilege, server-side access to exactly one Page for publishing workflows. You can disconnect anytime in TopReels.</p>`));
        }
        const perms = await graphGet("me/permissions", token);
        const scopes = (perms?.data || []).filter((p) => p.status === "granted").map((p) => p.permission).join(",");
        const enc = metaEncrypt(token);
        db.prepare(`INSERT INTO topreels_meta_links (user_id,page_id,page_name,token_ct,token_iv,token_tag,scopes,connected_on,updated_on)
          VALUES (?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET page_id=excluded.page_id,page_name=excluded.page_name,token_ct=excluded.token_ct,
            token_iv=excluded.token_iv,token_tag=excluded.token_tag,scopes=excluded.scopes,updated_on=excluded.updated_on`)
          .run(row.user_id, String(chosen.id), String(chosen.name), enc.ct, enc.iv, enc.tag, scopes, new Date().toISOString());
        db.prepare("DELETE FROM topreels_oauth_states WHERE state=?").run(state);
        event("meta_connected", "meta|" + row.user_id + "|" + chosen.id, { userId: row.user_id, correlation: "meta:" + chosen.id, detail: { page: chosen.name, scopes } });
        return res.status(200).type("html").send(htmlPage("Page connected",
          "“" + escapeHtml(String(chosen.name)) + "” is connected for publishing workflows. The access token is stored encrypted on the server — never in the browser. Return to TopReels."));
      } catch (e) {
        console.warn("[topreels-meta] oauth failed:", String(e?.message || e).slice(0, 160));
        return fail("Meta blocked or rejected this authorization. No connection was stored. Official docs: " + META_DOCS);
      }
    })();
  });
  app.post("/api/topreels/customer/meta/disconnect", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const row = db.prepare("SELECT page_id,page_name FROM topreels_meta_links WHERE user_id=?").get(u.id);
    if (!row) return topreelsJson(res, 404, { ok: false, error: "No Meta connection to remove." });
    db.prepare("DELETE FROM topreels_meta_links WHERE user_id=?").run(u.id);
    event("meta_disconnected", "meta_out|" + u.id + "|" + new Date().toISOString().slice(0, 16), { userId: u.id, correlation: "meta:" + row.page_id, detail: { page: row.page_name } });
    return topreelsJson(res, 200, { ok: true });
  });
  async function graphGet(path, token) {
    const r = await fetch("https://graph.facebook.com/" + path + (path.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(token), { signal: AbortSignal.timeout(12000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error?.message || "graph_get_failed");
    return d;
  }
  async function graphPost(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(12000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error?.message || "graph_post_failed");
    return d;
  }

  /* ─── reel maker events: per-generator durable logging (no media upload; blob stays client-side) ─── */
  app.post("/api/topreels/customer/reels", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const stage = String(req.body?.stage || "");
    if (!["generated", "exported", "shared"].includes(stage)) return topreelsJson(res, 400, { ok: false, error: "stage must be generated, exported, or shared." });
    if (!limit("reels:" + u.id, 60, 3600000)) return topreelsJson(res, 429, { ok: false, error: "Too many reel-event submissions this hour." });
    const kind = "reel_" + stage;
    const hooks = String(req.body?.hook || "").slice(0, 140), cta = String(req.body?.cta || "").slice(0, 40);
    const art = String(req.body?.art || "").slice(0, 60), platform = stage === "shared" ? String(req.body?.platform || "").slice(0, 30) : null;
    const postId = stage === "shared" ? String(req.body?.postId || "").slice(0, 64) : null;
    const hasAudio = req.body?.hasAudio ? 1 : 0;
    const corr = String(req.body?.corr || "").slice(0, 64) || sha("reel|" + u.id + "|" + stage + "|" + hooks + "|" + new Date().toISOString().slice(0, 16));
    event(kind, kind + "|" + corr + "|" + stage + "|" + new Date().toISOString().slice(0, 16), {
      userId: u.id, correlation: corr,
      detail: { hook: hooks, cta, art, hasAudio: Boolean(hasAudio), platform, postId },
    });
    return topreelsJson(res, 201, { ok: true, note: "Generation, export, and share events are logged append-only; a share lists the platform and external post ID." });
  });
  app.get("/api/topreels/customer/reels", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const rows = db.prepare(`SELECT kind,correlation,detail,created_on AS createdOn FROM topreels_events
      WHERE user_id=? AND kind LIKE 'reel_%' ORDER BY id DESC LIMIT 100`).all(u.id);
    return topreelsJson(res, 200, { ok: true, events: rows.map((r) => ({ ...r, detail: JSON.parse(r.detail || "{}") })) });
  });

  /* ─── migration access and one-time token package ─── */
  app.get("/api/topreels/customer/migration-credits", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u=getTopReelsCustomer(req); if(!u)return topreelsJson(res,401,{ok:false,error:"Sign in first."});
    const entitlement=await topReelsCustomerEntitlement(u);
    const latestOrder=db.prepare("SELECT status,tokens,created_on AS createdOn FROM topreels_migration_token_orders WHERE user_id=? ORDER BY created_on DESC LIMIT 1").get(u.id)||null;
    return topreelsJson(res,200,{ok:true,balance:migrationTokenBalance(u.id),paidAccess:entitlement.active,latestOrder,package:{configured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET&&migrationTokenPriceId&&migrationTokensPerPackage),tokens:migrationTokensPerPackage||null,priceIdConfigured:Boolean(migrationTokenPriceId)}});
  });
  app.post("/api/topreels/customer/migration-token-checkout", async (req,res) => {
    if(!topReelsCustomerCors(req,res))return topreelsJson(res,403,{ok:false,error:"origin not allowed"});
    const u=getTopReelsCustomer(req);if(!u)return topreelsJson(res,401,{ok:false,error:"Sign in first."});
    const entitlement=await topReelsCustomerEntitlement(u);if(Number(entitlement.amountDue||0)>0)return topreelsJson(res,403,{ok:false,error:"Pay the outstanding Stripe balance before buying migration tokens."});if(entitlement.active)return topreelsJson(res,409,{ok:false,error:"Your active paid plan already includes migration access. No checkout was created."});
    if(!limit("migration-token-checkout:"+u.id,3,3600000))return topreelsJson(res,429,{ok:false,error:"Migration token checkout is rate-limited. Try again later."});
    const key=String(process.env.STRIPE_SECRET_KEY||"").trim();if(!key||!process.env.STRIPE_WEBHOOK_SECRET||!migrationTokenPriceId||!migrationTokensPerPackage)return topreelsJson(res,503,{ok:false,error:"Migration token checkout is not configured with a confirmed Stripe price and package size. No payment was taken."});
    try{
      const pr=await fetch("https://api.stripe.com/v1/prices/"+encodeURIComponent(migrationTokenPriceId),{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(12000)}),price=await pr.json().catch(()=>({}));
      if(!pr.ok||price.id!==migrationTokenPriceId||price.active!==true||price.type!=="one_time"||String(price.currency).toLowerCase()!=="usd"||!Number.isSafeInteger(Number(price.unit_amount))||Number(price.unit_amount)<50)return topreelsJson(res,503,{ok:false,error:"Configured Stripe migration token price is not an active one-time USD price. No payment was taken."});
      const orderId=crypto.randomUUID(),form=new URLSearchParams({mode:"payment",client_reference_id:String(u.id),customer_email:u.email,success_url:"https://"+TOPREELS_HOST+"/?migration_tokens=processing#studio",cancel_url:"https://"+TOPREELS_HOST+"/#studio","line_items[0][price]":migrationTokenPriceId,"line_items[0][quantity]":"1","metadata[topreels_migration_token_order]":orderId,"metadata[topreels_user_id]":String(u.id),"metadata[token_count]":String(migrationTokensPerPackage),"metadata[price_id]":migrationTokenPriceId});
      const sr=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:form,signal:AbortSignal.timeout(12000)}),session=await sr.json().catch(()=>({}));
      if(!sr.ok||session.mode!=="payment"||!/^cs_(test|live)_[A-Za-z0-9]+$/.test(session.id||"")||!/^https:\/\//.test(session.url||""))throw new Error("Stripe checkout could not be created");
      db.prepare("INSERT INTO topreels_migration_token_orders(order_id,user_id,stripe_session_id,stripe_price_id,tokens,amount_cents) VALUES(?,?,?,?,?,?)").run(orderId,u.id,session.id,migrationTokenPriceId,migrationTokensPerPackage,Number(price.unit_amount));
      return topreelsJson(res,200,{ok:true,checkoutUrl:session.url,status:"awaiting_payment",tokens:migrationTokensPerPackage,message:"Migration credits are added only after the signed Stripe webhook confirms payment."});
    }catch(e){console.warn("[topreels-migration-tokens] checkout failed:",String(e?.message||e).slice(0,120));return topreelsJson(res,503,{ok:false,error:"Secure token checkout could not be created. No payment was taken."});}
  });

  /* ─── customer-scoped migration jobs: sitemap+link discovery, per-page truthful records ─── */
  app.post("/api/topreels/customer/migrations", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const entitlement = await topReelsCustomerEntitlement(u);
    let debitId=null;
    if(Number(entitlement.amountDue||0)>0)return topreelsJson(res,403,{ok:false,error:"Pay the outstanding Stripe balance before using migration tools."});
    if(entitlement.reason==="billing_verification_unavailable")return topreelsJson(res,503,{ok:false,error:"Stripe access could not be verified. Migration scan remains pending; no token was used."});
    if (!entitlement.active) {
      try { db.exec("BEGIN IMMEDIATE"); if(migrationTokenBalance(u.id)<1){db.exec("ROLLBACK");return topreelsJson(res,402,{ok:false,error:"An active paid plan or one migration token is required. Buy a token pack to continue.",balance:0,packageConfigured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET&&migrationTokenPriceId&&migrationTokensPerPackage)});} debitId=crypto.randomUUID(); db.prepare("INSERT INTO topreels_migration_token_ledger(event_id,user_id,delta,reference,reason) VALUES(?,?,-1,?,'migration_scan')").run(debitId,u.id,debitId); db.exec("COMMIT"); }
      catch(e){try{db.exec("ROLLBACK")}catch{}return topreelsJson(res,503,{ok:false,error:"Migration credit could not be reserved. No scan was started."});}
    }
    if (req.body?.authorized !== true) { refundMigrationToken(debitId); return topreelsJson(res, 400, { ok: false, error: "Confirm you own this site or are authorized to migrate it." }); }
    if (!limit("migrate:" + u.id, 5, 3600000)) { refundMigrationToken(debitId); return topreelsJson(res, 429, { ok: false, error: "Five migration scans per hour, max. Try again later." }); }
    const projectName = String(req.body?.projectName || "").trim().slice(0, 100);
    if (!projectName) { refundMigrationToken(debitId); return topreelsJson(res, 400, { ok: false, error: "Give the site a project name." }); }
    try {
      const scan = await scanWebsite(String(req.body?.sourceUrl || ""));
      const sitemap = (await discoverSitemap(scan.sourceUrl).catch(() => [])) || [];
      const token = "hakster-migrate=" + crypto.randomBytes(18).toString("hex");
      db.exec("BEGIN IMMEDIATE");
      const result = db.prepare(`INSERT INTO site_migrations (user_id,source_url,project_name,business_type,status,verification_token,scan_json,owner_authorized)
        VALUES (?,?,?,?,?,?,?,1)`).run(u.id, scan.sourceUrl, projectName, "website", "ownership_required", token, JSON.stringify({ ...scan, sitemapDiscovered: sitemap }));
      const migrationId = Number(result.lastInsertRowid);
      let seq = 0;
      for (const page of scan.pages) {
        seq++;
        db.prepare(`INSERT OR IGNORE INTO topreels_migration_pages (migration_id,seq,source_url,status,http_status,title,description,text_chars,image_count,link_count)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(migrationId, seq, page.url, "ok", 200, String(page.title || "").slice(0, 300), String(page.description || "").slice(0, 400), String(page.text || "").length, (page.images || []).length, (page.links || []).length);
      }
      for (const url of [...new Set([...(scan.pageLinks || []), ...sitemap])]) {
        if (scan.pages.some((p) => p.url === url)) continue;
        seq++;
        db.prepare("INSERT OR IGNORE INTO topreels_migration_pages (migration_id,seq,source_url,status) VALUES (?,?,?,?)").run(migrationId, seq, url, "not_scanned");
      }
      if(debitId)db.prepare("UPDATE topreels_migration_token_ledger SET migration_id=? WHERE event_id=?").run(migrationId,debitId);
      event("migration_scan", "migration_scan|" + migrationId, { userId: u.id, correlation: String(migrationId), detail: { domain: scan.domain, scanned: scan.pages.length, discovered: seq } });
      db.exec("COMMIT");
      return topreelsJson(res, 201, { ok: true, id: migrationId, status: "ownership_required", verificationToken: token, scannedPages: scan.pages.length, discoveredPages: seq, sitemapFound: sitemap.length });
    } catch (e) { try{db.exec("ROLLBACK")}catch{} refundMigrationToken(debitId); return topreelsJson(res, 400, { ok: false, error: e.message || "Unable to scan this website." }); }
  });
  app.get("/api/topreels/customer/migrations", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const rows = db.prepare(`SELECT id,source_url AS sourceUrl,project_name AS projectName,status,verification_token AS verificationToken,admin_note AS adminNote,created_on AS createdOn,updated_on AS updatedOn
      FROM site_migrations WHERE user_id=? ORDER BY id DESC LIMIT 30`).all(u.id);
    const counts = db.prepare(`SELECT p.migration_id, SUM(p.status='ok') AS ok, SUM(p.status='not_scanned') AS notScanned, SUM(p.status='failed') AS failed
      FROM topreels_migration_pages p JOIN site_migrations m ON m.id=p.migration_id WHERE m.user_id=? GROUP BY p.migration_id`).all(u.id);
    const byId = Object.fromEntries(counts.map((c) => [c.migration_id, c]));
    return topreelsJson(res, 200, { ok: true, migrations: rows.map((r) => ({ ...r, pages: { ok: byId[r.id]?.ok || 0, notScanned: byId[r.id]?.notScanned || 0, failed: byId[r.id]?.failed || 0 } })) });
  });
  app.post("/api/topreels/customer/migrations/:id/verify", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const row = db.prepare("SELECT * FROM site_migrations WHERE id=? AND user_id=?").get(Number(req.params.id), u.id);
    if (!row) return topreelsJson(res, 404, { ok: false, error: "Migration job not found." });
    if (row.status !== "ownership_required") return topreelsJson(res, 409, { ok: false, error: "This job is not waiting for verification anymore." });
    try {
      if (!(await verifyOwnership(row.source_url, row.verification_token))) return topreelsJson(res, 400, { ok: false, error: "Verification file did not match the token yet." });
      db.prepare("UPDATE site_migrations SET status='verified',updated_on=datetime('now') WHERE id=?").run(row.id);
      event("migration_verified", "migration_verified|" + row.id, { userId: u.id, correlation: String(row.id), detail: { source: row.source_url } });
      return topreelsJson(res, 200, { ok: true, status: "verified", verifyUrl: new URL("/.well-known/hakster-migration.txt", row.source_url).href });
    } catch (e) { return topreelsJson(res, 400, { ok: false, error: e.message || "Could not verify the domain." }); }
  });
  app.post("/api/topreels/customer/migrations/:id/start", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const row = db.prepare("SELECT id,status,source_url FROM site_migrations WHERE id=? AND user_id=?").get(Number(req.params.id), u.id);
    if (!row) return topreelsJson(res, 404, { ok: false, error: "Migration job not found." });
    if (row.status !== "verified") return topreelsJson(res, 409, { ok: false, error: "Verify control of the source domain first." });
    db.prepare("UPDATE site_migrations SET status='requested',updated_on=datetime('now') WHERE id=? AND status='verified'").run(row.id);
    event("migration_requested", "migration_requested|" + row.id, { userId: u.id, correlation: String(row.id), detail: { source: row.source_url } });
    return topreelsJson(res, 200, { ok: true, status: "requested", note: "Owner review and the actual rebuild happen off-platform — this job does not claim to have been migrated." });
  });
  app.get("/api/topreels/customer/migrations/:id/pages", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req); if (!u) return topreelsJson(res, 401, { ok: false, error: "Sign in first." });
    const job = db.prepare("SELECT id FROM site_migrations WHERE id=? AND user_id=?").get(Number(req.params.id), u.id);
    if (!job) return topreelsJson(res, 404, { ok: false, error: "Migration job not found." });
    const pages = db.prepare(`SELECT id,seq,source_url AS sourceUrl,status,http_status AS httpStatus,title,description,
      text_chars AS textChars,image_count AS imageCount,link_count AS linkCount,error,reviewed,review_note AS reviewNote
      FROM topreels_migration_pages WHERE migration_id=? ORDER BY seq`).all(job.id);
    return topreelsJson(res, 200, { ok: true, pages, note: "ok = content extracted; not_scanned = discovered but not read yet; review states come from owner review." });
  });
  app.get("/api/admin/topreels/migrations", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return topreelsJson(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const rows = db.prepare(`SELECT m.id,u.email,m.source_url AS sourceUrl,m.project_name AS projectName,m.status,m.admin_note AS adminNote,m.created_on AS createdOn
      FROM site_migrations m JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 100`).all();
    return topreelsJson(res, 200, { ok: true, migrations: rows });
  });
  app.patch("/api/admin/topreels/migrations/:id/pages/:pageId", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return topreelsJson(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return topreelsJson(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const result = db.prepare("UPDATE topreels_migration_pages SET reviewed=?,review_note=? WHERE id=?").run(req.body?.reviewed ? 1 : 0, String(req.body?.note || "").slice(0, 300), Number(req.params.pageId));
    if (!result.changes) return topreelsJson(res, 404, { ok: false, error: "Page row not found." });
    return topreelsJson(res, 200, { ok: true });
  });

  /* ─── AI ad maker: real model, no canned storyboard ───
     The model is instructed to use only facts the visitor supplied. No stats,
     prices, review counts or testimonials are ever invented here, and a model
     failure returns an explicit error instead of a template dressed as AI. */
  const aiAdHits = new Map();
  app.post("/api/topreels/ad-maker", async (req, res) => {
    const ip = String(req.headers["cf-connecting-ip"] || req.ip || "unknown").slice(0, 64);
    const now = Date.now();
    const recent = (aiAdHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (recent.length >= 12) return topreelsJson(res, 429, { ok: false, error: "Too many ad generations from this connection. Try again in a few minutes." });
    recent.push(now);
    aiAdHits.set(ip, recent);
    if (aiAdHits.size > 5000) aiAdHits.clear();

    const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
    const product = clip(req.body?.product, 80);
    const desc = clip(req.body?.desc, 400);
    const audience = clip(req.body?.audience, 120);
    const offer = clip(req.body?.offer, 120);
    const tone = ["bold", "funny", "luxury", "ugc"].includes(req.body?.tone) ? req.body.tone : "bold";
    const length = [15, 30, 60].includes(Number(req.body?.length)) ? Number(req.body.length) : 15;
    if (!product || !desc) return topreelsJson(res, 400, { ok: false, error: "Product name and description are required." });

    const beats = length === 15 ? 4 : 5;
    const model = process.env.RMT_AI_MODEL || "glm-5.3:cloud";
    const sys = `You are a short-form vertical ad director writing a ${length}-second ${tone} ad.
Return ONLY valid JSON, no markdown fences, exactly this shape:
{"hook":"one line","scenes":[{"t":"0-4s","tag":"Hook","cap":"on-screen text","sub":"optional support line","vis":"shot direction","cta":false}]}
Rules: exactly ${beats} scenes; first scene tag "Hook"; final scene cta true; cap under 90 characters; sub under 60 characters or empty; vis is a concrete camera direction.
ABSOLUTE HONESTY RULE: never invent statistics, percentages, dollar amounts, review counts, awards, testimonials, or customer numbers. Use only facts in the user's message. If no offer or proof was supplied, do not create one — write a benefit or invitation beat instead.`;
    const userMsg = `Product: ${product}\nWhat it does: ${desc}\nAudience: ${audience || "(not specified)"}\nOffer: ${offer || "(none supplied - do not invent one)"}\nTone: ${tone}\nLength: ${length}s`;

    let raw = "";
    try {
      const base = process.env.RMT_OLLAMA || "http://10.0.0.131:11434";
      const r = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model, stream: false, keep_alive: "2h",
          /* glm-5.3:cloud is a reasoning model — it spends output budget on
             thinking before the JSON body. A small budget returns empty
             content, so this must stay generous. */
          options: { temperature: 0.75, num_predict: 2600 },
          messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }]
        }),
        signal: AbortSignal.timeout(90000)
      });
      if (!r.ok) throw new Error(`model ${r.status}`);
      const j = await r.json();
      raw = String(j?.message?.content || "").trim();
    } catch (e) {
      console.error("[topreels-ad-maker] model failed:", e.message);
      return topreelsJson(res, 502, { ok: false, error: "The ad model is unavailable right now, so nothing was generated. Try again shortly." });
    }

    /* Pull the first balanced JSON object out of the model's text. The model
       sometimes wraps it in prose or code fences; a greedy regex would swallow
       trailing braces and fail to parse. */
    const firstJsonObject = (text) => {
      const start = String(text || "").indexOf("{");
      if (start < 0) return "";
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
      }
      return "";
    };

    let parsed = null;
    try { parsed = JSON.parse(firstJsonObject(raw) || "null"); } catch { parsed = null; }
    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.slice(0, 6).map((s) => ({
      t: clip(s?.t, 16), tag: clip(s?.tag, 24), cap: clip(s?.cap, 120),
      sub: clip(s?.sub, 90), vis: clip(s?.vis, 140), cta: !!s?.cta
    })).filter((s) => s.cap) : [];
    if (!scenes.length) return topreelsJson(res, 502, { ok: false, error: "The ad model returned an unusable storyboard, so nothing was generated. Try again." });
    return topreelsJson(res, 200, { ok: true, model, hook: clip(parsed?.hook, 140), tone, length, scenes });
  });
}

/* escapeHtml + tiny page shell for the OAuth chooser/notice screen */
function escapeHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function htmlPage(title, bodyHtml) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · TopReels</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b10;color:#f4f6fa;font:16px system-ui,sans-serif}.card{max-width:520px;padding:32px;border:1px solid #2a3040;border-radius:20px;background:#11151e}h1{font-size:24px;margin:0 0 10px}a{color:#b6ff2e}p{color:#aeb7c8;line-height:1.55}.hint{font-size:12.5px;margin-top:16px;color:#8f99ac}</style></head><body><div class="card"><h1>${escapeHtml(title)}</h1>${bodyHtml}</div></body></html>`;
}
