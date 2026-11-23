// Owner-approved 2026-11-21: every HaksterAI paid plan carries the 45c card
// processing fee, so each recurring Stripe price is re-created at +45c.
// Old prices are archived (not deleted) so existing subscribers keep their
// current price and the live list shows only what checkout will charge.
//
// Run with --apply to create/archive; without it, prints the intended change.
require('/home/ghost/haksterAi/server/node_modules/dotenv').config({ path: '/home/ghost/haksterAi/server/.env', quiet: true });
const Stripe = require('/home/ghost/haksterAi/server/node_modules/stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const FEE = 45;
const APPLY = process.argv.includes('--apply');

const OLD_IDS = [
  'price_1UcC82A0UrVsJMzeA3czYM9b', // Lite monthly           3.00
  'price_1TznPtA0UrVsJMzeEZMlhnP8', // Starter monthly        9.99
  'price_1UcBMQA0UrVsJMze36ws1SJe', // Starter Plus monthly  10.99
  'price_1UcBMQA0UrVsJMze38QbSofy', // Starter Plus yearly  109.99
  'price_1TznPtA0UrVsJMze9N3NdSPY', // Pro monthly           29.99
  'price_1TznPuA0UrVsJMzeOIyJB1jQ', // Pro yearly           299.99
  'price_1TznPuA0UrVsJMzesVMSUO0B', // Enterprise monthly    99.99
  'price_1TznPvA0UrVsJMze2cZl5vp8', // Enterprise yearly    999.99
];

(async () => {
  const made = [];
  for (const id of OLD_IDS) {
    const old = await stripe.prices.retrieve(id, { expand: ['product'] });
    if (!old.recurring) { console.log('skip non-recurring', id); continue; }
    const amount = old.unit_amount + FEE;
    const productId = typeof old.product === 'string' ? old.product : old.product.id;
    const productName = typeof old.product === 'object' ? old.product.name : productId;
    const line = `${productName} ${old.recurring.interval} ${old.unit_amount} -> ${amount}`;
    if (!APPLY) { console.log('would create:', line); continue; }
    const created = await stripe.prices.create({
      product: productId,
      currency: old.currency,
      unit_amount: amount,
      recurring: { interval: old.recurring.interval, interval_count: old.recurring.interval_count || 1 },
      nickname: old.nickname || undefined,
      ...(old.lookup_key ? { lookup_key: old.lookup_key, transfer_lookup_key: true } : {}),
    });
    await stripe.prices.update(id, { active: false });
    made.push({ plan: `${productName} ${old.recurring.interval}`, old: id, new: created.id, amount });
    console.log('created', created.id, '|', line, '| archived', id);
  }
  if (APPLY) console.log('\nJSON:', JSON.stringify(made, null, 1));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
