// Read-only Stripe probe. Key is read from .env in-process and never printed,
// never placed in argv, never logged. Nothing is written to Stripe.
const fs = require('fs');
const path = require('path');

const ENV = process.env.ENV_FILE || '/home/ghost/haksterAi/.env';
const raw = fs.readFileSync(ENV, 'utf8');
function val(name) {
  const line = raw.split('\n').find(l => l.startsWith(name + '='));
  if (!line) return null;
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}
const KEY = val('STRIPE_SECRET_KEY');
if (!KEY) { console.log('BLOCKED: no STRIPE_SECRET_KEY in ' + ENV); process.exit(2); }

// Report only shape, never the value.
console.log('key loaded from ' + ENV + ' (mode: ' + (KEY.startsWith('sk_live_') ? 'LIVE' : KEY.startsWith('sk_test_') ? 'TEST' : 'unknown') + ')');

const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded' };

async function api(p, q) {
  const u = new URL('https://api.stripe.com' + p);
  if (q) for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: H });
  const j = await r.json();
  if (!r.ok) throw new Error(p + ' -> HTTP ' + r.status + ' ' + (j.error && j.error.message));
  return j;
}

(async () => {
  const acct = await api('/v1/account');
  console.log('account: ' + (acct.id || '?') + ' (' + (acct.settings && acct.settings.dashboard && acct.settings.dashboard.display_name || acct.business_profile && acct.business_profile.name || 'no display name') + ')');
  console.log('livemode: ' + acct.livemode);

  const wanted = ['STRIPE_PRICE_STARTER_MONTHLY', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY',
                  'STRIPE_PRICE_ENTERPRISE_MONTHLY', 'STRIPE_PRICE_ENTERPRISE_YEARLY', 'STRIPE_PRICE_FREE'];
  console.log('\nsite vars -> live Stripe (read back from the API, not the cached file):');
  const seenProducts = new Set();
  for (const v of wanted) {
    const id = val(v);
    if (!id) { console.log('  ' + v.padEnd(32) + ' -> (empty in .env)'); continue; }
    try {
      const p = await api('/v1/prices/' + id);
      const row = [
        '  ' + v.padEnd(32) + ' -> ' + id,
        (p.nickname || '(no nickname)'),
        (p.currency || '').toUpperCase() + ' ' + ((p.unit_amount || 0) / 100).toFixed(2) + '/' + ((p.recurring && p.recurring.interval) || 'once'),
        'plan=' + ((p.metadata && p.metadata.plan) || '-'),
        'product=' + (typeof p.product === 'string' ? p.product : p.product && p.product.id),
      ];
      console.log(row.join(' | '));
      if (typeof p.product === 'string') seenProducts.add(p.product);
    } catch (e) {
      console.log('  ' + v.padEnd(32) + ' -> ERROR ' + e.message);
    }
  }

  console.log('\nproducts behind those prices (current display names):');
  for (const pid of seenProducts) {
    try {
      const pr = await api('/v1/products/' + pid);
      console.log('  ' + pid + ' | ' + (pr.name || '(no name)') + ' | active=' + pr.active + ' | plan=' + ((pr.metadata && pr.metadata.plan) || '-'));
    } catch (e) { console.log('  ' + pid + ' -> ERROR ' + e.message); }
  }
})().catch(e => { console.log('FAILED: ' + e.message); process.exit(1); });
