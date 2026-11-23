/* topreels-customer-ads.js — paid customer ads in the shared rotation.
 *
 * Guarantees:
 *  - Placement needs a verified signed-in customer with an active paid plan and
 *    a zero unpaid Stripe balance (the same entitlement rule as the rest of the
 *    paid surface). No entitlement, no ad.
 *  - The destination must belong to that customer (a published, paid, HTTP 200,
 *    identity-verified build, or one of their own verified migration jobs), and
 *    the customer has to supply text that actually appears on the page.
 *  - Every destination is re-probed over HTTPS before activation, and again on
 *    owner approval. A failing check keeps the ad out of the feed.
 *  - One stable UUID per ad, reused forever. Updates never create a second ad or
 *    a duplicate campaign: the rotation row is keyed by `topreels-customer-<id>`.
 *  - Editing a live ad drops it back to pending verification and pauses the
 *    rotation entry until the owner approves the new creative.
 *  - Nothing here measures or invents performance: impressions/clicks come from
 *    the existing network_ad_events tracking, untouched by this module.
 */

export function ensureTopReelsCustomerAdTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topreels_customer_ads (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      site_url TEXT NOT NULL,
      site_ref TEXT NOT NULL DEFAULT '',
      identity_text TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      headline TEXT NOT NULL,
      support TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL DEFAULT 'VIEW SITE',
      image TEXT NOT NULL,
      href TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_verification','active','paused','rejected')),
      verification TEXT NOT NULL DEFAULT '{}',
      verified_on TEXT,
      network_campaign_id INTEGER,
      review_note TEXT NOT NULL DEFAULT '',
      created_on TEXT NOT NULL DEFAULT (datetime('now')),
      updated_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_customer_ads_user ON topreels_customer_ads(user_id, created_on DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_topreels_customer_ads_campaign ON topreels_customer_ads(network_campaign_id) WHERE network_campaign_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS topreels_ad_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id TEXT NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '{}',
      created_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_ad_audit_ad ON topreels_ad_audit(ad_id, id);
  `);
}

const LIMITS = { title: 90, headline: 140, support: 200, cta: 24, identity: 120 };
const CAMPAIGN_PREFIX = "topreels-customer-";

function hostOf(raw) {
  try { return new URL(String(raw)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}
function httpsUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    u.hash = "";
    return u.href;
  } catch { return null; }
}
function clean(value, max) { return String(value || "").trim().slice(0, max); }

export function registerTopReelsCustomerAds(ctx) {
  const {
    app, db, crypto, getTopReelsCustomer, topReelsCustomerCors, topReelsCustomerEntitlement,
    isTopReelsOwner, probe, TOPREELS_HOST = "", now = () => new Date(),
  } = ctx;
  const json = (res, status, body) => res.status(status).set("Cache-Control", "no-store, private").json(body);
  const stamp = () => now().toISOString().replace("T", " ").slice(0, 19);
  const audit = (adId, userId, action, detail = {}) => {
    db.prepare("INSERT INTO topreels_ad_audit (ad_id,user_id,action,detail) VALUES (?,?,?,?)")
      .run(String(adId), userId ?? null, String(action).slice(0, 60), JSON.stringify(detail).slice(0, 2000));
  };
  const limiter = new Map();
  const limited = (key, max, windowMs) => {
    const nowMs = Date.now(), prior = limiter.get(key);
    if (prior && nowMs - prior.at < windowMs && prior.count >= max) return true;
    const entry = prior && nowMs - prior.at < windowMs ? prior : { at: nowMs, count: 0 };
    entry.at = nowMs; entry.count++; limiter.set(key, entry);
    return false;
  };

  /* ── the destination must be this customer's own verified site ── */
  function resolveOwnedSite(user, siteUrl) {
    const host = hostOf(siteUrl);
    if (!host) return null;
    if (TOPREELS_HOST && host === TOPREELS_HOST) return { ref: "topreels" };
    try {
      const builds = db.prepare(`SELECT id,published_url AS url FROM topreels_site_build_requests
        WHERE lower(requester_email)=lower(?) AND status='published' AND payment_verified=1
          AND final_http_status=200 AND identity_verified=1`).all(user.email);
      for (const build of builds) if (hostOf(build.url) === host) return { ref: "build:" + build.id };
    } catch { /* table absent in some deployments */ }
    const migrations = db.prepare(`SELECT id,source_url AS url,status FROM site_migrations
      WHERE user_id=? AND status IN ('verified','crawling','requested')`).all(user.id);
    for (const job of migrations) if (hostOf(job.url) === host) return { ref: "migration:" + job.id };
    return null;
  }

  function feedState(ad) {
    const key = CAMPAIGN_PREFIX + ad.id;
    const row = db.prepare("SELECT id,status FROM network_campaigns WHERE event_key=?").get(key);
    return {
      campaignKey: key,
      networkCampaignId: row?.id ?? ad.network_campaign_id ?? null,
      inFeed: Boolean(row && row.status === "active"),
    };
  }

  const shape = (ad) => ({
    id: ad.id,
    siteUrl: ad.site_url,
    siteRef: ad.site_ref,
    title: ad.title,
    headline: ad.headline,
    support: ad.support,
    cta: ad.cta,
    image: ad.image,
    href: ad.href,
    status: ad.status,
    verification: safeJson(ad.verification),
    verifiedOn: ad.verified_on,
    reviewNote: ad.review_note,
    createdOn: ad.created_on,
    updatedOn: ad.updated_on,
    ...feedState(ad),
  });

  function publishToRotation(ad) {
    const key = CAMPAIGN_PREFIX + ad.id;
    db.prepare(`INSERT INTO network_campaigns (event_key,source,title,headline,support,image,href,cta,status)
      VALUES (?,?,?,?,?,?,?,?,'active')
      ON CONFLICT(event_key) DO UPDATE SET title=excluded.title,headline=excluded.headline,support=excluded.support,
        image=excluded.image,href=excluded.href,cta=excluded.cta,status='active',updated_on=datetime('now')`)
      .run(key, "topreels-customer", ad.title, ad.headline, ad.support, ad.image, ad.href, ad.cta);
    return Number(db.prepare("SELECT id FROM network_campaigns WHERE event_key=?").get(key).id);
  }

  function validateBody(body) {
    const siteUrl = httpsUrl(body?.siteUrl);
    if (!siteUrl) return { error: "Enter your live site as an HTTPS URL." };
    const identityText = clean(body?.identityText, LIMITS.identity);
    if (identityText.length < 3) return { error: "Add text that actually appears on your site (3+ characters) so the destination can be verified." };
    const title = clean(body?.title, LIMITS.title);
    const headline = clean(body?.headline, LIMITS.headline);
    if (title.length < 3 || headline.length < 5) return { error: "Campaign title (3+) and headline (5+) are required." };
    const image = httpsUrl(body?.image);
    if (!image) return { error: "Creative image must be a public HTTPS URL." };
    const href = httpsUrl(body?.href || siteUrl);
    if (!href) return { error: "The ad destination must be an HTTPS URL." };
    if (hostOf(href) !== hostOf(siteUrl)) return { error: "The ad must point at the same hostname as the verified site." };
    return {
      values: {
        siteUrl, identityText, title, headline,
        support: clean(body?.support, LIMITS.support),
        cta: clean(body?.cta, LIMITS.cta) || "VIEW SITE",
        image, href,
      },
    };
  }

  async function verifyDestination(siteUrl, identityText) {
    if (typeof probe !== "function") return { ok: false, reason: "verification_unavailable", checkedOn: stamp() };
    const result = await probe(siteUrl, identityText);
    return {
      ok: Boolean(result?.ok),
      httpStatus: result?.status ?? null,
      reason: result?.reason || "unknown",
      checkedOn: stamp(),
      hostname: hostOf(siteUrl),
    };
  }

  /* ── customer: create ── */
  app.post("/api/topreels/customer/ads", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const entitlement = await topReelsCustomerEntitlement(user);
    if (!entitlement.active) return json(res, 403, { ok: false, error: "An active paid plan with no unpaid Stripe balance is required for ad placement.", entitlement });
    if (limited("customer-ad:" + user.id, 10, 3600000)) return json(res, 429, { ok: false, error: "Too many ad submissions this hour. Try again later." });

    const parsed = validateBody(req.body);
    if (parsed.error) return json(res, 400, { ok: false, error: parsed.error });
    const v = parsed.values;
    const site = resolveOwnedSite(user, v.siteUrl);
    if (!site) return json(res, 404, { ok: false, error: "That site is not one of your published, verified sites. Only your own site can be advertised." });

    const verification = await verifyDestination(v.siteUrl, v.identityText);
    if (!verification.ok) {
      return json(res, 409, {
        ok: false,
        error: "The destination did not pass its HTTPS content check, so no ad was created.",
        verification,
      });
    }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO topreels_customer_ads
        (id,user_id,site_url,site_ref,identity_text,title,headline,support,cta,image,href,status,verification,verified_on)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, user.id, v.siteUrl, site.ref, v.identityText, v.title, v.headline, v.support, v.cta, v.image, v.href,
        "pending_verification", JSON.stringify(verification), stamp());
    audit(id, user.id, "created", { siteRef: site.ref, verification });
    const ad = db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(id);
    return json(res, 201, {
      ok: true,
      ad: shape(ad),
      note: "Your ad has one stable ad ID. It enters the shared rotation only after owner approval, and placement is not a performance claim.",
    });
  });

  /* ── customer: list ── */
  app.get("/api/topreels/customer/ads", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const rows = db.prepare("SELECT * FROM topreels_customer_ads WHERE user_id=? ORDER BY created_on DESC LIMIT 40").all(user.id);
    return json(res, 200, {
      ok: true,
      ads: rows.map(shape),
      note: "Statuses are server state. 'active' means the entry is live in the shared feed; editing an active ad pauses it until owner re-approval.",
    });
  });

  /* ── customer: update (same ad ID, re-verification when the offer changes) ── */
  app.patch("/api/topreels/customer/ads/:id", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const ad = db.prepare("SELECT * FROM topreels_customer_ads WHERE id=? AND user_id=?").get(String(req.params.id), user.id);
    if (!ad) return json(res, 404, { ok: false, error: "Ad not found." });
    const entitlement = await topReelsCustomerEntitlement(user);
    if (!entitlement.active) return json(res, 403, { ok: false, error: "An active paid plan with no unpaid Stripe balance is required.", entitlement });

    const parsed = validateBody({
      siteUrl: req.body?.siteUrl ?? ad.site_url,
      identityText: req.body?.identityText ?? ad.identity_text,
      title: req.body?.title ?? ad.title,
      headline: req.body?.headline ?? ad.headline,
      support: req.body?.support ?? ad.support,
      cta: req.body?.cta ?? ad.cta,
      image: req.body?.image ?? ad.image,
      href: req.body?.href ?? ad.href,
    });
    if (parsed.error) return json(res, 400, { ok: false, error: parsed.error });
    const v = parsed.values;
    const site = resolveOwnedSite(user, v.siteUrl);
    if (!site) return json(res, 404, { ok: false, error: "That site is not one of your published, verified sites." });

    const offerChanged = v.siteUrl !== ad.site_url || v.href !== ad.href || v.identityText !== ad.identity_text;
    let verification = safeJson(ad.verification);
    if (offerChanged || ad.status !== "active") {
      verification = await verifyDestination(v.siteUrl, v.identityText);
      if (!verification.ok) return json(res, 409, { ok: false, error: "The updated destination did not pass its HTTPS content check. Nothing changed.", verification });
    }
    const nextStatus = ad.status === "active" || ad.status === "pending_verification" ? "pending_verification" : ad.status;
    db.prepare(`UPDATE topreels_customer_ads SET site_url=?,site_ref=?,identity_text=?,title=?,headline=?,support=?,cta=?,image=?,href=?,
        status=?,verification=?,verified_on=?,updated_on=? WHERE id=? AND user_id=?`)
      .run(v.siteUrl, site.ref, v.identityText, v.title, v.headline, v.support, v.cta, v.image, v.href,
        nextStatus, JSON.stringify(verification), stamp(), stamp(), ad.id, user.id);
    if (ad.status === "active") {
      db.prepare("UPDATE network_campaigns SET status='paused',updated_on=datetime('now') WHERE event_key=?").run(CAMPAIGN_PREFIX + ad.id);
      audit(ad.id, user.id, "paused_for_reapproval", { offerChanged });
    }
    audit(ad.id, user.id, "updated", { offerChanged, nextStatus });
    return json(res, 200, { ok: true, ad: shape(db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(ad.id)) });
  });

  /* ── customer: pause / resume ── */
  app.post("/api/topreels/customer/ads/:id/pause", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const ad = db.prepare("SELECT * FROM topreels_customer_ads WHERE id=? AND user_id=?").get(String(req.params.id), user.id);
    if (!ad) return json(res, 404, { ok: false, error: "Ad not found." });
    if (!["active", "paused"].includes(ad.status)) return json(res, 409, { ok: false, error: "Only an approved ad can be paused." });
    db.prepare("UPDATE topreels_customer_ads SET status='paused',updated_on=? WHERE id=?").run(stamp(), ad.id);
    db.prepare("UPDATE network_campaigns SET status='paused',updated_on=datetime('now') WHERE event_key=?").run(CAMPAIGN_PREFIX + ad.id);
    audit(ad.id, user.id, "paused", {});
    return json(res, 200, { ok: true, ad: shape(db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(ad.id)) });
  });

  app.post("/api/topreels/customer/ads/:id/resume", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const ad = db.prepare("SELECT * FROM topreels_customer_ads WHERE id=? AND user_id=?").get(String(req.params.id), user.id);
    if (!ad) return json(res, 404, { ok: false, error: "Ad not found." });
    if (ad.status !== "paused") return json(res, 409, { ok: false, error: "Only a paused, already-approved ad can be resumed." });
    if (!ad.network_campaign_id) return json(res, 409, { ok: false, error: "Owner approval is still required before this ad can run." });
    db.prepare("UPDATE topreels_customer_ads SET status='active',updated_on=? WHERE id=?").run(stamp(), ad.id);
    db.prepare("UPDATE network_campaigns SET status='active',updated_on=datetime('now') WHERE event_key=?").run(CAMPAIGN_PREFIX + ad.id);
    audit(ad.id, user.id, "resumed", {});
    return json(res, 200, { ok: true, ad: shape(db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(ad.id)) });
  });

  /* ── owner review: the only path into the public feed ── */
  app.get("/api/admin/topreels/customer-ads", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return json(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const rows = db.prepare(`SELECT a.*,u.email FROM topreels_customer_ads a JOIN users u ON u.id=a.user_id ORDER BY a.created_on DESC LIMIT 200`).all();
    return json(res, 200, { ok: true, ads: rows.map((row) => ({ ...shape(row), ownerEmail: row.email })) });
  });

  app.post("/api/admin/topreels/customer-ads/:id/review", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return json(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    const decision = String(req.body?.decision || "").toLowerCase();
    if (!["approve", "reject"].includes(decision)) return json(res, 400, { ok: false, error: "Decision must be approve or reject." });
    const ad = db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(String(req.params.id));
    if (!ad) return json(res, 404, { ok: false, error: "Ad not found." });
    const note = clean(req.body?.note, 300);

    if (decision === "reject") {
      db.prepare("UPDATE topreels_customer_ads SET status='rejected',review_note=?,updated_on=? WHERE id=?").run(note, stamp(), ad.id);
      db.prepare("UPDATE network_campaigns SET status='paused',updated_on=datetime('now') WHERE event_key=?").run(CAMPAIGN_PREFIX + ad.id);
      audit(ad.id, null, "owner_rejected", { note });
      return json(res, 200, { ok: true, ad: shape(db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(ad.id)) });
    }

    if (!["pending_verification", "paused"].includes(ad.status)) {
      return json(res, 409, { ok: false, error: "Only an ad awaiting verification or re-approval can be approved." });
    }
    const verification = await verifyDestination(ad.site_url, ad.identity_text);
    if (!verification.ok) {
      db.prepare("UPDATE topreels_customer_ads SET verification=?,updated_on=? WHERE id=?").run(JSON.stringify(verification), stamp(), ad.id);
      audit(ad.id, null, "owner_approve_blocked", { verification });
      return json(res, 409, {
        ok: false,
        error: "The destination failed its HTTPS content check, so the ad stays out of the rotation.",
        verification,
      });
    }
    const campaignId = publishToRotation(ad);
    db.prepare(`UPDATE topreels_customer_ads SET status='active',network_campaign_id=?,verification=?,verified_on=?,review_note=?,updated_on=? WHERE id=?`)
      .run(campaignId, JSON.stringify(verification), stamp(), note, stamp(), ad.id);
    audit(ad.id, null, "owner_approved", { networkCampaignId: campaignId, verification });
    return json(res, 200, {
      ok: true,
      ad: shape(db.prepare("SELECT * FROM topreels_customer_ads WHERE id=?").get(ad.id)),
      note: "Published to the shared rotation with the same stable ad ID. Verify it in the public feed before reporting placement.",
    });
  });
}

function safeJson(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}
