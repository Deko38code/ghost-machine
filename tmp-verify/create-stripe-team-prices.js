// Creates the live Stripe product + per-seat price for the four team cards.
// Team cards show the whole-team shelf price but charge unitAmount per seat,
// so the Stripe price is unit_amount = 1085 with quantity = seats.
const { execFileSync } = require('child_process');
const fs = require('fs');

const envText = fs.readFileSync('/home/ghost/haksterAi/server/.env', 'utf8');
const m = envText.match(/^STRIPE_SECRET_KEY=(.*)$/m);
if (!m) { console.error('no STRIPE_SECRET_KEY'); process.exit(1); }
const KEY = m[1].trim().replace(/^["']|["']$/g, '');
const ENV = { ...process.env, STRIPE_API_KEY: KEY };
const stripe = (args) => JSON.parse(execFileSync('/home/ghost/.stripe/bin/stripe', args, { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

const TEAMS = [
  { plan: 'team_3', product: 'Team 3', nickname: 'Team 3 Monthly', seats: 3, unit: 1085, lookupKey: 'haksterai_team_3_monthly',
    description: '3 team seats, 3,000 AI calls a month — $10.85 per seat.' },
  { plan: 'team_5', product: 'Team 5', nickname: 'Team 5 Monthly', seats: 5, unit: 1085, lookupKey: 'haksterai_team_5_monthly',
    description: '5 team seats, 5,000 AI calls a month — $10.85 per seat.' },
  { plan: 'team_10', product: 'Team 10', nickname: 'Team 10 Monthly', seats: 10, unit: 1085, lookupKey: 'haksterai_team_10_monthly',
    description: '10 team seats, 10,000 AI calls a month — $10.85 per seat.' },
  { plan: 'team_25', product: 'Team 25', nickname: 'Team 25 Monthly', seats: 25, unit: 1085, lookupKey: 'haksterai_team_25_monthly',
    description: '25 team seats, 25,000 AI calls a month — $10.85 per seat.' },
];

const products = stripe(['products', 'list', '--limit', '100']).data;
const byName = new Map(products.map(p => [p.name, p.id]));
const results = [];
for (const t of TEAMS) {
  const existing = stripe(['prices', 'list', '--lookup-keys', t.lookupKey, '--limit', '1']).data;
  if (existing.length) { results.push({ plan: t.plan, priceId: existing[0].id, action: 'exists' }); continue; }
  let productId = byName.get(t.product);
  if (!productId) {
    productId = stripe(['products', 'create', '-c', '--name', t.product, '--description', t.description,
      '-d', 'metadata[app]=haksterai', '-d', `metadata[plan]=${t.plan}`, '-d', 'metadata[created_by]=claude-code']).id;
    byName.set(t.product, productId);
  }
  const created = stripe(['prices', 'create', '-c', '--product', productId,
    '--unit-amount', String(t.unit), '--currency', 'usd', '--nickname', t.nickname,
    '--recurring.interval', 'month',
    '-d', `lookup_key=${t.lookupKey}`,
    '-d', 'metadata[app]=haksterai', '-d', `metadata[plan]=${t.plan}`,
    '-d', `metadata[seats]=${t.seats}`, '-d', 'metadata[per_seat]=true']);
  const readBack = stripe(['prices', 'list', '--lookup-keys', t.lookupKey, '--limit', '1']).data[0];
  const ok = readBack && readBack.id === created.id && readBack.unit_amount === t.unit && readBack.recurring && readBack.recurring.interval === 'month';
  results.push({ plan: t.plan, priceId: created.id, unit: t.unit, action: ok ? 'created+verified' : 'CREATED-UNVERIFIED' });
  if (!ok) { console.error('read-back mismatch', t.lookupKey); process.exit(2); }
}
console.log(JSON.stringify(results, null, 1));
