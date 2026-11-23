// Read-only: list every active Stripe product + its active prices, and match
// them against the HaksterAI catalog's stripeProductName values.
const fs = require('fs');
const ENV = '/home/ghost/haksterAi/.env';
const raw = fs.readFileSync(ENV, 'utf8');
const KEY = (raw.split('\n').find(l => l.startsWith('STRIPE_SECRET_KEY=')) || '').slice('STRIPE_SECRET_KEY='.length).trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.log('BLOCKED: no key'); process.exit(2); }
const H = { Authorization: 'Bearer ' + KEY };

async function api(p, q) {
  const u = new URL('https://api.stripe.com' + p);
  if (q) for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: H });
  const j = await r.json();
  if (!r.ok) throw new Error(p + ' HTTP ' + r.status + ' ' + (j.error && j.error.message));
  return j;
}

// What the code expects (server/src/index.js PRICING_CATALOG)
const CATALOG = [
  { id: 'free', name: 'HaksterAI Free' },
  { id: 'lite', name: 'HaksterAI Lite' },
  { id: 'starter', name: 'HaksterAI Starter' },
  { id: 'starter_plus', name: 'HaksterAI Starter Plus' },
  { id: 'pro', name: 'HaksterAI Pro' },
  { id: 'enterprise', name: 'HaksterAI Enterprise' },
];

(async () => {
  const prods = [];
  let starting_after;
  do {
    const page = await api('/v1/products', { active: 'true', limit: '100', ...(starting_after ? { starting_after } : {}) });
    prods.push(...page.data);
    starting_after = page.has_more ? page.data[page.data.length - 1].id : null;
  } while (starting_after);

  console.log('active products in the account: ' + prods.length);
  const byName = new Map(prods.map(p => [p.name.trim().toLowerCase(), p]));

  console.log('\n--- catalog expects -> what exists in Stripe ---');
  for (const c of CATALOG) {
    const hit = byName.get(c.name.trim().toLowerCase());
    console.log('  ' + c.name.padEnd(24) + (hit ? ' -> MATCH ' + hit.id : ' -> NO PRODUCT WITH THAT NAME'));
  }

  const wanted = new Set(CATALOG.map(c => byName.get(c.name.trim().toLowerCase())).filter(Boolean).map(p => p.id));

  console.log('\n--- active prices on the matched products ---');
  for (const pid of wanted) {
    const pr = prods.find(p => p.id === pid);
    const prices = await api('/v1/prices', { product: pid, active: 'true', limit: '100' });
    console.log('  ' + (pr.name || '?') + ' (' + pid + ')');
    if (!prices.data.length) console.log('    (no active prices)');
    for (const p of prices.data) {
      console.log('    ' + p.id + ' | ' + (p.nickname || '(no nickname)') + ' | ' +
        (p.currency || '').toUpperCase() + ' ' + ((p.unit_amount || 0) / 100).toFixed(2) + '/' + ((p.recurring && p.recurring.interval) || 'once') +
        ' | plan=' + ((p.metadata && p.metadata.plan) || '-') + ' | lookup=' + (p.lookup_key || '-'));
    }
  }

  console.log('\n--- active products NOT referenced by the catalog (name + price count) ---');
  for (const p of prods.filter(x => !wanted.has(x.id))) {
    const prices = await api('/v1/prices', { product: p.id, active: 'true', limit: '100' });
    console.log('  ' + p.id + ' | ' + JSON.stringify(p.name) + ' | active prices: ' + prices.data.length);
  }
})().catch(e => { console.log('FAILED: ' + e.message); process.exit(1); });
