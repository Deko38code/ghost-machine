#!/usr/bin/env node
// Read-only: find the live HaksterAI Enterprise product and its yearly price.
const path = '/home/ghost/haksterAi';
require(path + '/server/node_modules/dotenv').config({ path: path + '/.env', quiet: true });
const Stripe = require(path + '/server/node_modules/stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const ent = products.data.filter(p => /enterprise/i.test(p.name || ''));
  for (const p of ent) console.log('product', p.id, JSON.stringify(p.name));
  for (const p of ent) {
    const prices = await stripe.prices.list({ product: p.id, active: true, limit: 100 });
    for (const pr of prices.data) {
      console.log('price', pr.id, 'amount', pr.unit_amount, pr.currency,
        'recurring', pr.recurring && pr.recurring.interval, 'lookup', pr.lookup_key || '-');
    }
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
