// Creates the live Stripe product + price for every low-budget card that was
// sold with inline price_data and therefore had no Stripe price object.
// Key is read from the server .env in-process and passed to the CLI via env,
// never argv, never printed. Read-only if the lookup key already resolves.
const { execFileSync } = require('child_process');
const fs = require('fs');

const ENV_FILE = '/home/ghost/haksterAi/server/.env';
const envText = fs.readFileSync(ENV_FILE, 'utf8');
const m = envText.match(/^STRIPE_SECRET_KEY=(.*)$/m);
if (!m) { console.error('no STRIPE_SECRET_KEY in server .env'); process.exit(1); }
const KEY = m[1].trim().replace(/^["']|["']$/g, '');
if (!KEY.startsWith('sk_')) { console.error('unexpected key prefix'); process.exit(1); }

const ENV = { ...process.env, STRIPE_API_KEY: KEY };
const stripe = (args) => {
  const out = execFileSync('/home/ghost/.stripe/bin/stripe', args, { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
};

const PLAN_NAMES = {
  micro_12: 'Micro Pack — 12 Calls', taster_20: 'Taster Pack — 20 Calls',
  sprout_26: 'Sprout Pack — 26 Calls', pocket_32: 'Pocket Pack — 32 Calls',
  starter_80: 'Starter Pack — 80 Calls', budget_145: 'Budget Pack — 145 Calls',
  steady_200: 'Steady Pack — 200 Calls', working_300: 'Working Pack — 300 Calls',
  token_pack_500: 'Token Pack — 500 Calls', heavy_700: 'Heavy Pack — 700 Calls',
  bulk_900: 'Bulk Pack — 900 Calls', volume_1500: 'Volume Pack — 1,500 Calls',
  wholesale_3000: 'Wholesale Pack — 3,000 Calls',
  low_income: 'HaksterAI Low Budget', try_me: 'Try Me Now',
};

(async () => {
  const http = require('http');
  const plans = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3579/api/stripe/plans', (res) => {
      let s = ''; res.on('data', d => s += d); res.on('end', () => resolve(JSON.parse(s).plans));
    }).on('error', reject);
  });

  const products = stripe(['products', 'list', '--limit', '100']).data;
  const byName = new Map(products.map(p => [p.name, p.id]));
  const results = [];
  for (const plan of plans) {
    if (!PLAN_NAMES[plan.id]) continue;
    for (const price of plan.prices) {
      const amount = Number(price.amount);
      if (!(amount > 0) || !(price.oneTime || price.inlineRecurring)) continue;
      const lookupKey = plan.id === 'low_income' ? 'haksterai_low_income_monthly'
        : plan.id === 'try_me' ? 'haksterai_try_me_monthly'
        : `haksterai_${plan.id}`;
      const existing = stripe(['prices', 'list', '--lookup-keys', lookupKey, '--limit', '1']).data;
      if (existing.length) {
        const e = existing[0];
        results.push({ plan: plan.id, lookupKey, priceId: e.id, amount: e.unit_amount, action: 'exists' });
        continue;
      }
      let productId = byName.get(PLAN_NAMES[plan.id]);
      if (!productId) {
        const product = stripe(['products', 'create', '-c', '--name', PLAN_NAMES[plan.id],
          '--description', String(plan.description || price.name || '').slice(0, 350),
          '-d', 'metadata[app]=haksterai', '-d', `metadata[plan]=${plan.id}`,
          '-d', 'metadata[created_by]=claude-code']);
        productId = product.id;
        byName.set(PLAN_NAMES[plan.id], productId);
      }
      const args = ['prices', 'create', '-c', '--product', productId, '--unit-amount', String(amount),
        '--currency', String(price.currency || 'usd').toLowerCase(),
        '--nickname', price.name, '-d', `lookup_key=${lookupKey}`,
        '-d', 'metadata[app]=haksterai', '-d', `metadata[plan]=${plan.id}`,
        '-d', `metadata[catalog_price]=${price.id}`];
      if (price.billingCycle !== 'one_time') args.push('--recurring.interval', price.billingCycle === 'yearly' ? 'year' : 'month');
      const created = stripe(args);
      // Read back through the lookup key: the write is only accepted if Stripe
      // resolves the exact amount we advertised (§23.5).
      const readBack = stripe(['prices', 'list', '--lookup-keys', lookupKey, '--limit', '1']).data[0];
      const ok = readBack && readBack.id === created.id && readBack.unit_amount === amount;
      results.push({ plan: plan.id, lookupKey, priceId: created.id, amount, action: ok ? 'created+verified' : 'CREATED-UNVERIFIED' });
      if (!ok) { console.error('read-back mismatch for', lookupKey); process.exit(2); }
    }
  }
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error('FAIL', e.message);
  if (e.stderr) console.error(String(e.stderr).slice(0, 400));
  process.exit(1);
});
