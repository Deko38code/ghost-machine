#!/usr/bin/env node
// Archives ONLY the old below-5:1 Enterprise Yearly price. Reversible; no
// subscription is cancelled and no price is deleted.
const path = '/home/ghost/haksterAi';
require(path + '/server/node_modules/dotenv').config({ path: path + '/.env', quiet: true });
const Stripe = require(path + '/server/node_modules/stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
(async () => {
  const p = await stripe.prices.update('price_1UdxxRA0UrVsJMzeb1SfxBGS', { active: false });
  console.log('archived', p.id, 'active', p.active, 'amount', p.unit_amount);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
