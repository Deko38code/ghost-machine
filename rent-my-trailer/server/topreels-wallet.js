/* topreels-wallet.js — authenticated wallet payment proxy + server-confirmed history.
 *
 * Money rules enforced here:
 *  - A wallet credit exists only after a Stripe webhook whose signature this
 *    server verified, AND after the server re-read the Checkout Session from
 *    Stripe. Browser state, success redirects, and metadata amounts are never
 *    trusted: the credited amount is the session's own `amount_total`.
 *  - Event IDs and (provider, provider_ref, kind) are idempotency keys, so
 *    retries and duplicate deliveries can never double-credit.
 *  - Transactions are read from `topreels_wallet_txns` only. Nothing in the
 *    browser is ever rendered as a charge, balance or payment history.
 *  - Withdrawals are deliberately NOT created here: they go through the
 *    human-reviewed payout queue, so a deposit can never be paid out directly.
 *  - Checkout is created server-side for one configured, verified Stripe Price;
 *    if that is not configured the route returns 503 and takes no payment.
 *  - Link conversions are forwarded to the existing conversion ledger so a
 *    referral credit still requires signed provider evidence.
 */

import crypto from "node:crypto";
import { applyStripeConversion } from "./topreels-conversions.js";

/* ─── schema ─── */
export function ensureTopReelsWalletTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topreels_wallet_txns (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL CHECK(kind IN ('deposit','withdrawal','refund','adjustment')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','failed','reversed')),
      amount_cents INTEGER NOT NULL CHECK(amount_cents <> 0),
      currency TEXT NOT NULL DEFAULT 'usd',
      provider TEXT NOT NULL DEFAULT 'stripe',
      provider_ref TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'stripe_webhook',
      created_on TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_on TEXT,
      UNIQUE(provider, provider_ref, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_wallet_txns_user ON topreels_wallet_txns(user_id, created_on DESC);
    CREATE TABLE IF NOT EXISTS topreels_stripe_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT '',
      processed_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/* ─── signature verification (no SDK, matching this server's fetch-based Stripe use) ─── */
export function verifyStripeSignature(rawBody, signatureHeader, secret, { tolerance = 300, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!secret) return { ok: false, reason: "webhook_secret_not_configured" };
  const header = String(signatureHeader || "");
  if (!header) return { ok: false, reason: "missing_signature_header" };
  let timestamp = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (!Number.isSafeInteger(timestamp) || !signatures.length) return { ok: false, reason: "malformed_signature_header" };
  if (Math.abs(now - timestamp) > tolerance) return { ok: false, reason: "signature_outside_tolerance" };
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  const expected = crypto_hmac(secret, `${timestamp}.${payload.toString("utf8")}`);
  const match = signatures.some((sig) => timingEqual(sig, expected));
  return match ? { ok: true, reason: "verified", timestamp } : { ok: false, reason: "signature_mismatch" };
}

function crypto_hmac(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}
function timingEqual(a, b) {
  const x = Buffer.from(String(a), "utf8"), y = Buffer.from(String(b), "utf8");
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/* ─── wallet event application ─── */
const CREDIT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

function usdCentsFromPrice(price) {
  if (!price || price.active !== true || price.type !== "one_time") return 0;
  if (String(price.currency || "").toLowerCase() !== "usd") return 0;
  const cents = Number(price.unit_amount);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : 0;
}

/**
 * Apply one already-signature-verified Stripe event to the wallet.
 * `retrieveSession(id)` must return the authoritative Stripe Checkout Session
 * (or throw). Without it nothing is credited.
 */
export async function applyStripeWalletEvent(evt, { db, retrieveSession, ledger = null } = {}) {
  if (!db || !evt || !evt.type) return { handled: false, reason: "not a Stripe event" };
  const type = String(evt.type);
  const eventId = String(evt.id || "").trim();
  if (!/^evt_[A-Za-z0-9_]{4,120}$/.test(eventId)) return { handled: false, reason: "unusable event id" };

  const prior = db.prepare("SELECT event_id,outcome FROM topreels_stripe_events WHERE event_id=?").get(eventId);
  if (prior) return { handled: true, duplicate: true, type, outcome: prior.outcome };

  if (!CREDIT_EVENTS.has(type)) {
    const conversion = ledger ? applyStripeConversion(evt, ledger) : { handled: false, reason: "no ledger" };
    recordEvent(db, eventId, type, `ignored:${conversion.reason || "not a wallet credit"}`);
    return { handled: false, type, reason: "not a wallet credit", conversion };
  }

  const object = evt.data && evt.data.object ? evt.data.object : null;
  const sessionId = String(object?.id || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    recordEvent(db, eventId, type, "ignored:no checkout session id");
    return { handled: false, type, reason: "no checkout session id" };
  }

  const pending = db.prepare("SELECT * FROM topreels_wallet_txns WHERE provider='stripe' AND provider_ref=? AND kind='deposit'").get(sessionId);
  if (!pending) {
    // Not one of our top-ups (marketplace quote, creator plan, etc.). Never invent a credit.
    const conversion = ledger ? applyStripeConversion(evt, ledger) : { handled: false, reason: "no ledger" };
    recordEvent(db, eventId, type, "ignored:no matching pending top-up");
    return { handled: false, type, reason: "no matching pending top-up", conversion };
  }

  if (typeof retrieveSession !== "function") {
    recordEvent(db, eventId, type, "deferred:session retrieval unavailable");
    return { handled: false, type, reason: "session retrieval unavailable", pendingTxnId: pending.id };
  }
  let session;
  try {
    session = await retrieveSession(sessionId);
  } catch (error) {
    recordEvent(db, eventId, type, "deferred:stripe retrieval failed");
    return { handled: false, type, reason: "stripe retrieval failed", pendingTxnId: pending.id };
  }

  if (String(session?.id || "") !== sessionId) {
    recordEvent(db, eventId, type, "rejected:session id mismatch");
    return { handled: false, type, reason: "session id mismatch", pendingTxnId: pending.id };
  }
  if (String(session.payment_status || "") !== "paid" || !["complete", "processing"].includes(String(session.status || "")) || String(session.mode || "") !== "payment") {
    recordEvent(db, eventId, type, `rejected:session not a completed payment (${session.payment_status || "unknown"}/${session.status || "unknown"})`);
    return { handled: false, type, reason: "session not paid", pendingTxnId: pending.id };
  }
  if (String(session.metadata?.topreels_wallet_topup || "") !== "1") {
    recordEvent(db, eventId, type, "rejected:session not tagged as a wallet top-up");
    return { handled: false, type, reason: "not a wallet top-up session", pendingTxnId: pending.id };
  }
  if (Number(session.metadata?.topreels_user_id) !== Number(pending.user_id) || Number(session.client_reference_id) !== Number(pending.user_id)) {
    recordEvent(db, eventId, type, "rejected:session user mismatch");
    return { handled: false, type, reason: "session user mismatch", pendingTxnId: pending.id };
  }
  const paidCents = Number(session.amount_total);
  if (!Number.isSafeInteger(paidCents) || paidCents <= 0 || String(session.currency || "").toLowerCase() !== "usd") {
    recordEvent(db, eventId, type, "rejected:unusable paid amount");
    return { handled: false, type, reason: "unusable paid amount", pendingTxnId: pending.id };
  }

  const update = db.prepare(`UPDATE topreels_wallet_txns
      SET status='confirmed', amount_cents=?, currency='usd', confirmed_on=datetime('now'),
          description=? WHERE id=? AND status='pending'`)
    .run(paidCents, `Wallet top-up confirmed by Stripe (session ${sessionId})`, pending.id);

  recordEvent(db, eventId, type, update.changes ? "wallet_credited" : "duplicate:already confirmed");
  /* Attribution runs on the object this server just read back from Stripe, so a
     referral link id must exist in the verified session — not only in the payload. */
  const verifiedEvent = { ...evt, data: { ...(evt.data || {}), object: { ...(evt.data?.object || {}), ...session, metadata: session.metadata || {} } } };
  const conversion = ledger ? applyStripeConversion(verifiedEvent, ledger) : { handled: false, reason: "no ledger" };
  return {
    handled: true,
    type,
    credited: update.changes > 0,
    duplicate: update.changes === 0,
    amountCents: paidCents,
    txnId: pending.id,
    conversion,
  };
}

function recordEvent(db, eventId, type, outcome) {
  db.prepare("INSERT OR IGNORE INTO topreels_stripe_events (event_id,type,outcome) VALUES (?,?,?)").run(eventId, String(type).slice(0, 80), String(outcome).slice(0, 200));
}

/* ─── routes ─── */
export function registerTopReelsWallet(ctx) {
  const {
    app, db, crypto, getTopReelsCustomer, topReelsCustomerCors, topReelsCustomerEntitlement,
    TOPREELS_HOST, ledger = null, retrieveSession = defaultRetrieveSession,
  } = ctx;

  const json = (res, status, body) => res.status(status).set("Cache-Control", "no-store, private").json(body);
  const topupPriceId = /^price_[A-Za-z0-9]+$/.test(String(process.env.TOPREELS_WALLET_TOPUP_PRICE_ID || "")) ? String(process.env.TOPREELS_WALLET_TOPUP_PRICE_ID) : "";
  const configured = () => Boolean(String(process.env.STRIPE_SECRET_KEY || "").trim() && topupPriceId && String(process.env.STRIPE_WEBHOOK_SECRET || "").trim());
  const key = () => String(process.env.STRIPE_SECRET_KEY || "").trim();

  const limiter = new Map();
  const limited = (limitKey, max, windowMs) => {
    const now = Date.now(), prior = limiter.get(limitKey);
    if (prior && now - prior.at < windowMs && prior.count >= max) return true;
    const entry = prior && now - prior.at < windowMs ? prior : { at: now, count: 0 };
    entry.at = now; entry.count++; limiter.set(limitKey, entry);
    return false;
  };

  const balanceOf = (userId) => {
    const sums = db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN status='confirmed' AND kind IN ('deposit','refund','adjustment') THEN amount_cents ELSE 0 END),0) AS credits,
        COALESCE(SUM(CASE WHEN status='confirmed' AND kind='withdrawal' THEN amount_cents ELSE 0 END),0) AS debits,
        COALESCE(SUM(CASE WHEN status='pending' AND kind='deposit' THEN amount_cents ELSE 0 END),0) AS pending
      FROM topreels_wallet_txns WHERE user_id=?`).get(userId);
    const available = Math.max(0, Number(sums.credits || 0) - Math.abs(Number(sums.debits || 0)));
    return { availableCents: available, pendingCents: Math.max(0, Number(sums.pending || 0)), confirmedCents: Number(sums.credits || 0), currency: "usd" };
  };

  app.get("/api/topreels/customer/balance", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req);
    if (!u) return json(res, 401, { ok: false, error: "Sign in first." });
    const entitlement = await topReelsCustomerEntitlement(u);
    return json(res, 200, {
      ok: true,
      ...balanceOf(u.id),
      depositsEnabled: configured(),
      entitlement,
      source: "topreels_wallet_txns",
      note: "Balance counts only Stripe-confirmed deposits recorded server-side. Withdrawals go through the human-reviewed payout queue; this balance is not a payout guarantee.",
    });
  });

  app.get("/api/topreels/customer/transactions", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req);
    if (!u) return json(res, 401, { ok: false, error: "Sign in first." });
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const rows = db.prepare(`SELECT id,kind,status,amount_cents AS amountCents,currency,provider,provider_ref AS providerRef,
        description,source,created_on AS createdOn,confirmed_on AS confirmedOn
      FROM topreels_wallet_txns WHERE user_id=? ORDER BY created_on DESC, rowid DESC LIMIT ?`).all(u.id, limit);
    return json(res, 200, {
      ok: true,
      transactions: rows,
      source: "topreels_wallet_txns",
      note: "Only server-recorded, provider-confirmed records appear here. A pending row is not money received.",
    });
  });

  app.post("/api/topreels/customer/deposit", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const u = getTopReelsCustomer(req);
    if (!u) return json(res, 401, { ok: false, error: "Sign in first." });
    if (!configured()) return json(res, 503, { ok: false, error: "Wallet deposits are not configured with a confirmed Stripe price and webhook secret. No payment was taken." });
    if (limited("wallet-deposit:" + u.id, 5, 3600000)) return json(res, 429, { ok: false, error: "Too many deposit attempts. Try again later." });
    if (limited("wallet-deposit-ip:" + String(req.ip || ""), 12, 3600000)) return json(res, 429, { ok: false, error: "Too many deposit attempts. Try again later." });
    try {
      const priceResponse = await fetch("https://api.stripe.com/v1/prices/" + encodeURIComponent(topupPriceId), {
        headers: { Authorization: "Bearer " + key() }, signal: AbortSignal.timeout(12000),
      });
      const price = await priceResponse.json().catch(() => ({}));
      const cents = priceResponse.ok ? usdCentsFromPrice(price) : 0;
      if (!cents) return json(res, 503, { ok: false, error: "The configured Stripe top-up price is not an active one-time USD price. No payment was taken." });
      const txnId = crypto.randomUUID();
      const form = new URLSearchParams({
        mode: "payment",
        customer_email: u.email,
        client_reference_id: String(u.id),
        success_url: "https://" + TOPREELS_HOST + "/?wallet=processing#wallet",
        cancel_url: "https://" + TOPREELS_HOST + "/?wallet=cancelled#wallet",
        "line_items[0][price]": topupPriceId,
        "line_items[0][quantity]": "1",
        "metadata[topreels_wallet_topup]": "1",
        "metadata[topreels_user_id]": String(u.id),
        "metadata[topreels_wallet_txn]": txnId,
      });
      const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: "Bearer " + key(), "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(12000),
      });
      const session = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(session.id || "") || !/^https:\/\//.test(session.url || "")) {
        throw new Error("stripe checkout not created");
      }
      db.prepare(`INSERT INTO topreels_wallet_txns (id,user_id,kind,status,amount_cents,currency,provider,provider_ref,description,source)
        VALUES (?,?,'deposit','pending',?,'usd','stripe',?,?,'stripe_checkout')`)
        .run(txnId, u.id, cents, session.id, "Wallet top-up started (awaiting Stripe confirmation)");
      return json(res, 200, {
        ok: true,
        checkoutUrl: session.url,
        status: "awaiting_payment",
        txnId,
        amountCents: cents,
        message: "Credits are added only after the signed Stripe webhook and a server-side session check. The success redirect alone credits nothing.",
      });
    } catch (error) {
      console.warn("[topreels-wallet] deposit failed:", String(error?.message || error).slice(0, 120));
      return json(res, 503, { ok: false, error: "Secure checkout could not be created. No payment was taken." });
    }
  });

  /* Signed webhook: the only path that can credit a wallet or a conversion. */
  app.post("/api/stripe/webhook", async (req, res) => {
    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (!secret) return res.status(503).json({ ok: false, error: "Webhook verification is not configured." });
    const raw = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
    if (!raw) return res.status(400).json({ ok: false, error: "Raw body unavailable for signature verification." });
    const signature = verifyStripeSignature(raw, req.get("stripe-signature"), secret);
    if (!signature.ok) {
      console.warn("[topreels-wallet] webhook rejected:", signature.reason);
      return res.status(400).json({ ok: false, error: "Invalid Stripe signature.", reason: signature.reason });
    }
    let evt;
    try { evt = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ ok: false, error: "Malformed JSON body." }); }
    try {
      const out = await applyStripeWalletEvent(evt, { db, retrieveSession, ledger });
      return res.status(200).json({ ok: true, received: true, ...out });
    } catch (error) {
      console.error("[topreels-wallet] webhook handler failed:", String(error?.message || error).slice(0, 160));
      // 500 makes Stripe retry; nothing was credited.
      return res.status(500).json({ ok: false, error: "Webhook could not be processed; no credit was recorded." });
    }
  });
}

/* Authoritative session read: the credited amount and paid state come from Stripe,
   never from the event payload or the browser. */
export async function defaultRetrieveSession(sessionId) {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Stripe is not configured");
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId), {
    headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Stripe session retrieval failed with HTTP " + response.status);
  return response.json();
}
