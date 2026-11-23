// Apply display names + plan metadata to the LIVE Stripe prices so Stripe reads
// the same names the site sells. Amounts, currencies, intervals, IDs and
// active flags are NOT touched. Key stays in-process; nothing is printed.
const fs = require('fs');
const raw = fs.readFileSync('/home/ghost/haksterAi/.env', 'utf8');
const KEY = (raw.split('\n').find(l => l.startsWith('STRIPE_SECRET_KEY=')) || '').slice('STRIPE_SECRET_KEY='.length).trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.log('BLOCKED: no key'); process.exit(2); }
const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded' };

function form(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object') form(v, key, out);
    else if (v !== undefined && v !== null) out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
async function call(method, path, body) {
  const r = await fetch('https://api.stripe.com' + path, { method, headers: H, body: body ? form(body).join('&') : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(method + ' ' + path + ' -> HTTP ' + r.status + ' ' + (j.error && j.error.message));
  return j;
}

// id -> the name the site catalog shows for that exact price
const PRICES = [
  ['price_1UdxxOA0UrVsJMzeKh22sWDy', 'Lite Monthly',           'lite'],
  ['price_1UdxxOA0UrVsJMzemL7p2cLr', 'Starter Monthly',        'starter'],
  ['price_1UdxxPA0UrVsJMze3cRPHBpN', 'Starter Plus Monthly',   'starter_plus'],
  ['price_1UdxxPA0UrVsJMzeygh4cJcZ', 'Starter Plus Yearly',    'starter_plus'],
  ['price_1UdxxPA0UrVsJMzeVYrbLf7M', 'Pro Monthly',            'pro'],
  ['price_1UdxxQA0UrVsJMzecww56Fzj', 'Pro Yearly',             'pro'],
  ['price_1UdxxQA0UrVsJMzeJ5tSsm9m', 'Enterprise Monthly',     'enterprise'],
  ['price_1UdxxRA0UrVsJMzeb1SfxBGS', 'Enterprise Yearly',      'enterprise'],
];
const PRODUCTS = [
  ['prod_VdT47G4Sula1hi', 'lite'],
  ['prod_UzmzTbXzcyOCZz', 'starter'],
  ['prod_VdSGnALUh5gN0T', 'starter_plus'],
  ['prod_UzmzMDU84SpRRb', 'pro'],
  ['prod_UzmzIQ5aD7Qllb', 'enterprise'],
];

(async () => {
  let fail = 0;
  console.log('--- prices (nickname + metadata) ---');
  for (const [id, nickname, plan] of PRICES) {
    try {
      const before = await call('GET', '/v1/prices/' + id);
      const after = await call('POST', '/v1/prices/' + id, { nickname, metadata: { app: 'haksterai', plan } });
      const ok = after.nickname === nickname && after.metadata && after.metadata.plan === plan &&
                 after.unit_amount === before.unit_amount && after.active === before.active && after.currency === before.currency;
      console.log('  ' + (ok ? 'OK  ' : 'WARN') + ' ' + id + ' | ' + JSON.stringify(before.nickname) + ' -> ' + JSON.stringify(after.nickname) +
        ' | plan=' + (after.metadata && after.metadata.plan) + ' | $' + ((after.unit_amount || 0) / 100).toFixed(2) +
        '/' + ((after.recurring && after.recurring.interval) || 'once') + ' | active=' + after.active + ' | amount unchanged=' + (after.unit_amount === before.unit_amount));
      if (!ok) fail++;
    } catch (e) { console.log('  FAIL ' + id + ' -> ' + e.message); fail++; }
  }

  console.log('\n--- products (metadata only; names already match the catalog) ---');
  for (const [id, plan] of PRODUCTS) {
    try {
      const p = await call('POST', '/v1/products/' + id, { metadata: { app: 'haksterai', plan } });
      console.log('  OK   ' + id + ' | ' + JSON.stringify(p.name) + ' | plan=' + (p.metadata && p.metadata.plan) + ' | active=' + p.active);
    } catch (e) { console.log('  FAIL ' + id + ' -> ' + e.message); fail++; }
  }

  console.log('\nresult: ' + (fail ? fail + ' item(s) failed' : 'all writes applied'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED: ' + e.message); process.exit(1); });
