// Signed local replay of the real invoice.payment_succeeded event, to prove the
// double-count guard. Reads keys from the server .env; prints no secrets.
require('/home/ghost/haksterAi/server/node_modules/dotenv').config({ path: '/home/ghost/haksterAi/server/.env', quiet: true });
const Stripe = require('/home/ghost/haksterAi/server/node_modules/stripe');
const crypto = require('crypto');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  const evtId = 'evt_1UdxKBA0UrVsJMzeNAXIiPBu';
  const evt = await stripe.events.retrieve(evtId);
  const inv = evt.data.object;
  console.log(JSON.stringify({
    type: evt.type,
    id: evt.id,
    invoice_id: inv.id,
    billing_reason: inv.billing_reason,
    subscription: inv.subscription || null,
    parent_subscription: (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) || null,
    paid: inv.paid,
    amount_paid: inv.amount_paid,
    customer: inv.customer,
  }, null, 1));

  const payload = JSON.stringify(evt);
  const ts = Math.floor(Date.now() / 1000);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  const header = `t=${ts},v1=${sig}`;

  const res = await fetch('http://127.0.0.1:3579/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
  console.log('HTTP', res.status, await res.text());
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
