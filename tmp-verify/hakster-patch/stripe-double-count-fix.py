import io, os, hashlib, datetime, sys

ROOT = "/home/ghost/haksterAi"
PATH = os.path.join(ROOT, "server/src/index.js")
STAMP = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")

pairs = [
    # 1. Helpers for the newer Stripe API field locations.
    (
        "app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {",
        """// Stripe's newer API moved two fields this server depends on: the billing
// period lives on subscription items, and an invoice's subscription lives under
// parent.subscription_details. Read both locations so a purchase is never
// recorded with null dates or without its subscription link.
function stripePeriod(sub) {
  if (!sub) return { start: null, end: null };
  const item = sub.items && sub.items.data && sub.items.data[0];
  return {
    start: sub.current_period_start ?? (item && item.current_period_start) ?? null,
    end: sub.current_period_end ?? (item && item.current_period_end) ?? null,
  };
}

function invoiceSubscriptionId(invoice) {
  if (!invoice) return null;
  return invoice.subscription
    || (invoice.parent && invoice.parent.subscription_details && invoice.parent.subscription_details.subscription)
    || null;
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {""",
        1,
    ),
    # 2. Checkout handler: read the period once.
    (
        "          let firstApplication = true;\n          db.transaction(() => {",
        "          let firstApplication = true;\n          const subPeriod = stripePeriod(sub);\n          db.transaction(() => {",
        1,
    ),
    (
        "                .run(planId, billingCycle, sub.current_period_start, sub.current_period_end,",
        "                .run(planId, billingCycle, subPeriod.start, subPeriod.end,",
        1,
    ),
    (
        "                .run(subId, userId, planId, billingCycle, sub.current_period_start, sub.current_period_end, subId,",
        "                .run(subId, userId, planId, billingCycle, subPeriod.start, subPeriod.end, subId,",
        1,
    ),
    # 3. payment_failed: resolve the subscription from either API location.
    (
        """          const invoice = event.data.object;
          const user = db.prepare('SELECT id, plan FROM users WHERE stripe_customer_id = ?').get(invoice.customer);
          if (user) {
            db.prepare("UPDATE subscriptions SET status = 'past_due' WHERE provider_sub_id = ?").run(invoice.subscription);""",
        """          const invoice = event.data.object;
          const invoiceSubId = invoiceSubscriptionId(invoice);
          const user = db.prepare('SELECT id, plan FROM users WHERE stripe_customer_id = ?').get(invoice.customer);
          if (user) {
            db.prepare("UPDATE subscriptions SET status = 'past_due' WHERE provider_sub_id = ?").run(invoiceSubId);""",
        1,
    ),
    # 4. payment_succeeded: resolve subscription, suppress the initial invoice
    #    that checkout already recorded.
    (
        """        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            db.prepare("UPDATE subscriptions SET status = 'active' WHERE provider_sub_id = ? AND status = 'past_due'").run(invoice.subscription);
          }""",
        """        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const invoiceSubId = invoiceSubscriptionId(invoice);
          // The first invoice (billing_reason 'subscription_create') is the
          // same money as the checkout session handled above, which already
          // wrote a payments row. Recording it again as a renewal doubled
          // revenue and the payment count (seen on the 2026-11-20 lite
          // purchase). Suppress only when that checkout row really exists
          // for this subscription, so a missed checkout event still records.
          const initialInvoiceAlreadyRecorded = invoice.billing_reason === 'subscription_create' && invoiceSubId
            ? db.prepare("SELECT id FROM payments WHERE status = 'completed' AND description = 'Stripe checkout' AND metadata LIKE ?")
                .get('%"stripe_subscription_id":"' + invoiceSubId + '"%')
            : null;
          if (invoiceSubId) {
            db.prepare("UPDATE subscriptions SET status = 'active' WHERE provider_sub_id = ? AND status = 'past_due'").run(invoiceSubId);
          }""",
        1,
    ),
    (
        "              const sub = invoice.subscription ? db.prepare('SELECT * FROM subscriptions WHERE provider_sub_id = ?').get(invoice.subscription) : null;",
        "              const sub = invoiceSubId ? db.prepare('SELECT * FROM subscriptions WHERE provider_sub_id = ?').get(invoiceSubId) : null;",
        1,
    ),
    (
        """              const ownerId = user?.id || sub?.user_id;
              if (ownerId) {
                const inserted = db.prepare(`INSERT INTO payments (id, user_id, amount, currency, plan, billing_cycle, status, payment_method, provider_id, description, metadata, completed_at)""",
        """              const ownerId = user?.id || sub?.user_id;
              if (ownerId) {
                if (initialInvoiceAlreadyRecorded) {
                  logStripeEvent(db, {
                    eventId: event.id, eventType: event.type, outcome: 'initial-invoice-covered',
                    userId: ownerId, plan: sub?.plan || user?.plan || 'unknown',
                    amountCents: invoice.amount_paid || 0,
                    message: `initial invoice ${invoice.id} already recorded by checkout ${initialInvoiceAlreadyRecorded.id}; not counted twice`,
                  });
                }
                const inserted = initialInvoiceAlreadyRecorded ? { changes: 0 } : db.prepare(`INSERT INTO payments (id, user_id, amount, currency, plan, billing_cycle, status, payment_method, provider_id, description, metadata, completed_at)""",
        1,
    ),
    (
        "                      stripe_subscription_id: invoice.subscription || null,",
        "                      stripe_subscription_id: invoiceSubId,",
        1,
    ),
    # 5. subscription.updated: period comes from the item on newer APIs.
    (
        """              const mappedStatus = STATUS_MAP[sub.status] || 'past_due';
              db.prepare("UPDATE subscriptions SET status = ?, current_period_start = ?, current_period_end = ? WHERE provider_sub_id = ?")
                .run(mappedStatus, sub.current_period_start, sub.current_period_end, sub.id);""",
        """              const mappedStatus = STATUS_MAP[sub.status] || 'past_due';
              const subPeriod = stripePeriod(sub);
              db.prepare("UPDATE subscriptions SET status = ?, current_period_start = ?, current_period_end = ? WHERE provider_sub_id = ?")
                .run(mappedStatus, subPeriod.start, subPeriod.end, sub.id);""",
        1,
    ),
]

text = io.open(PATH, encoding="utf-8").read()
original = text
for old, new, count in pairs:
    got = text.count(old)
    if got != count:
        print("MISS: expected %d, found %d -> %r" % (count, got, old[:90]))
        sys.exit(1)
    text = text.replace(old, new)

backup = PATH + ".bak-stripe-double-count-" + STAMP
io.open(backup, "w", encoding="utf-8").write(original)
io.open(PATH, "w", encoding="utf-8").write(text)

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

print("PATCHED", PATH)
print("backup", backup)
print("before", sha(backup))
print("after ", sha(PATH))
