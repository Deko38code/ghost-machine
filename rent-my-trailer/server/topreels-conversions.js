/* topreels-conversions.js — map signed Stripe events to verified ledger conversions.
 *
 * Rules enforced here:
 *  - Only completed + paid checkouts / paid invoices become conversions.
 *  - The link must come from Stripe metadata (`topreels_link_id`).
 *  - The Stripe event id is the idempotency key, so retries and duplicate
 *    deliveries can never double-count.
 *  - Refunds and failures are never silently reversed; they are reported for
 *    the human-reviewed payout workflow.
 *  - Unknown or unrelated events are ignored, never guessed at.
 */

const LINK_META_KEYS = ["topreels_link_id", "referral_link_id"];
const CONVERSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "invoice.paid",
]);

function pickLinkId(meta) {
  for (const k of LINK_META_KEYS) {
    const v = meta && meta[k];
    if (typeof v === "string" && /^[a-z2-7]{22}$/.test(v)) return v;
  }
  return null;
}

function amountFromCheckout(session) {
  const total = Number(session.amount_total);
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  return total;
}

function amountFromInvoice(invoice) {
  const paid = Number(invoice.amount_paid);
  if (!Number.isSafeInteger(paid) || paid <= 0) return null;
  return paid;
}

/**
 * @param {object} evt   parsed Stripe event (signature already verified by caller)
 * @param {object} ledger createLinkLedger() instance
 * @returns {{handled:boolean, recorded?:boolean, duplicate?:boolean, type?:string, reason?:string}}
 */
export function applyStripeConversion(evt, ledger) {
  if (!evt || !evt.type) return { handled: false, reason: "not a Stripe event" };
  const type = String(evt.type);

  if (type === "charge.refunded" || type === "charge.dispute.created" || type === "invoice.payment_failed") {
    return {
      handled: false,
      reason: `${type}: reversals and failures are never auto-applied to the ledger — they need human review in the payout workflow`,
    };
  }
  if (!CONVERSION_EVENTS.has(type)) return { handled: false, reason: "event type not a conversion" };

  const obj = evt.data && evt.data.object ? evt.data.object : null;
  if (!obj) return { handled: false, reason: "event has no object" };

  let linkId = null;
  let amountCents = null;
  let currency = "";
  let txnId = "";

  if (type.startsWith("checkout.session")) {
    if (obj.mode !== "payment" && obj.mode !== "subscription") return { handled: false, reason: `checkout mode ${obj.mode || "unknown"} is not a paid purchase` };
    if (obj.status !== "complete") return { handled: false, reason: `checkout status ${obj.status || "unknown"} is not complete` };
    if (obj.payment_status !== "paid") return { handled: false, reason: `payment_status ${obj.payment_status || "unknown"} is not paid` };
    linkId = pickLinkId(obj.metadata);
    amountCents = amountFromCheckout(obj);
    currency = String(obj.currency || "").toUpperCase();
    txnId = String(obj.payment_intent || obj.id || "");
  } else {
    // invoice.paid — subscription renewals
    if (obj.status !== "paid") return { handled: false, reason: `invoice status ${obj.status || "unknown"} is not paid` };
    linkId = pickLinkId(obj.metadata) || pickLinkId(obj.subscription_details && obj.subscription_details.metadata);
    amountCents = amountFromInvoice(obj);
    currency = String(obj.currency || "").toUpperCase();
    txnId = String(obj.payment_intent || obj.charge || obj.id || "");
  }

  if (!linkId) return { handled: false, reason: "no topreels_link_id in Stripe metadata" };
  if (amountCents == null) return { handled: false, reason: "paid amount is missing or not a positive integer" };
  if (!/^[A-Z]{3}$/.test(currency)) return { handled: false, reason: "currency missing or not ISO-4217" };
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(String(evt.id || ""))) return { handled: false, reason: "event id unusable as an idempotency key" };

  const occurredAt = new Date(Number(evt.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const out = ledger.recordEvent(linkId, {
    type: "conversion",
    event_key: `stripe_${evt.id}`,
    amount_cents: amountCents,
    currency,
    provider: "stripe",
    provider_txn_id: txnId,
    status: "verified",
    source: "stripe_webhook",
    occurred_at: occurredAt,
    meta: JSON.stringify({ stripe_event_type: type }),
  });

  if (!out.ok) return { handled: false, reason: out.error };
  return { handled: true, recorded: !!out.inserted, duplicate: !!out.duplicate, type, link_id: linkId };
}
