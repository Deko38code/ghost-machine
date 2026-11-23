#!/usr/bin/env node
const path = '/home/ghost/haksterAi';
require(path + '/server/node_modules/dotenv').config({ path: path + '/server/.env', quiet: true });
const Stripe = require(path + '/server/node_modules/stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const IDS = process.argv.slice(2);
(async () => {
  for (const id of IDS) {
    const s = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items.data.price'],
    });
    const li = s.line_items.data[0];
    const p = li && li.price;
    console.log('session', s.id);
    console.log('  mode', s.mode, '| status', s.status, '| amount_total', s.amount_total,
      '| trial_period_days', s.subscription_data ? s.subscription_data.trial_period_days : '-',
      '| pmc', s.payment_method_collection || '-');
    console.log('  line qty', li && li.quantity, '| unit', p && p.unit_amount, '| recurring', p && p.recurring && p.recurring.interval);
    console.log('  url', s.url);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
