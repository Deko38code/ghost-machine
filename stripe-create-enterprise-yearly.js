#!/usr/bin/env node
// Creates the 5:1 Enterprise Yearly price ($1,124.45/yr = 5.0:1 on
// 108,000 calls/yr at $0.00208). Additive only: no price is archived or deleted.
const path = '/home/ghost/haksterAi';
require(path + '/server/node_modules/dotenv').config({ path: path + '/.env', quiet: true });
const Stripe = require(path + '/server/node_modules/stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCT = 'prod_UzmzIQ5aD7Qllb';

(async () => {
  const price = await stripe.prices.create({
    product: PRODUCT,
    unit_amount: 112445,
    currency: 'usd',
    recurring: { interval: 'year' },
    nickname: 'Enterprise Yearly 5:1',
  });
  console.log('created', price.id, price.unit_amount, price.currency, price.recurring.interval, 'product', price.product);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
