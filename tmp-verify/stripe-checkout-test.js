// Full checkout verification WITHOUT taking money: creates a real Checkout
// Session for every priced plan through the live website endpoint, reads the
// session back from Stripe to confirm the amount and mode, then expires it.
// Sessions never charge; expiring them leaves nothing behind. No secret printed.
const fs = require('fs');
const raw = fs.readFileSync('/home/ghost/haksterAi/.env', 'utf8');
const KEY = (raw.split('\n').find(l => l.startsWith('STRIPE_SECRET_KEY=')) || '').slice('STRIPE_SECRET_KEY='.length).trim().replace(/^["']|["']$/g, '');
const H = { Authorization: 'Bearer ' + KEY };

async function api(p) {
  const r = await fetch('https://api.stripe.com' + p, { headers: H });
  const j = await r.json();
  if (!r.ok) throw new Error(p + ' HTTP ' + r.status + ' ' + (j.error && j.error.message));
  return j;
}

(async () => {
  const plans = await (await fetch('https://haksterai.com/api/stripe/plans')).json();
  let fail = 0, made = 0;

  for (const plan of plans.plans || []) {
    for (const pr of plan.prices || []) {
      if (!pr.priceId) { console.log('  SKIP ' + plan.id + ' / ' + pr.id + ' (no Stripe price — free tier)'); continue; }

      const res = await fetch('https://haksterai.com/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://haksterai.com' },
        body: JSON.stringify({ priceId: pr.priceId, planId: plan.id, returnTo: '/plans' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.sessionId) {
        console.log('  FAIL ' + plan.id + ' / ' + pr.name + ' -> HTTP ' + res.status + ' ' + (body.error || '') + ' ' + (body.details || ''));
        fail++; continue;
      }
      made++;

      // Read the session back from Stripe: this is the authoritative check that
      // the price, mode and discount are what the buyer will actually see.
      const s = await api('/v1/checkout/sessions/' + body.sessionId);
      const expect = Number(pr.amount || 0);
      const total = Number(s.amount_total || 0);
      const introOk = pr.introAmount ? total === Number(pr.introAmount) : total === expect;
      const ok = s.mode === 'subscription' && introOk && s.status === 'open';
      console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + plan.id.padEnd(13) + ' ' + String(pr.name).padEnd(24) +
        ' session ' + String(s.id).slice(0, 18) + '… mode=' + s.mode + ' total=$' + (total / 100).toFixed(2) +
        ' expected=$' + ((pr.introAmount ? Number(pr.introAmount) : expect) / 100).toFixed(2) +
        (pr.introAmount ? ' (intro coupon applied)' : '') + ' status=' + s.status +
        ' url=' + (s.url ? 'yes' : 'none'));
      if (!ok) fail++;

      await api('/v1/checkout/sessions/' + body.sessionId + '/expire')
        .then(() => console.log('       expired ' + String(s.id).slice(0, 18) + '… (no charge, nothing left open)'))
        .catch(e => { console.log('       expire failed: ' + e.message); fail++; });
    }
  }

  console.log('\n' + (fail ? fail + ' problem(s)' : 'all ' + made + ' checkout sessions created, priced and expired correctly'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED: ' + e.message); process.exit(1); });
