// Proves the live page paints real ledger numbers: serves the built page locally
// with a stubbed owner API built from the actual hakster.db, then reads the DOM.
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const Database = require('/home/ghost/haksterAi/server/node_modules/better-sqlite3');
const DIST = '/home/ghost/haksterAi/dist';
const db = new Database('/home/ghost/haksterAi/data/hakster.db', { readonly: true });

const now = Math.floor(Date.now() / 1000);
const payments = db.prepare("SELECT amount, duplicate_of FROM payments WHERE status = 'completed'").all();
const real = payments.filter(p => !p.duplicate_of);
const cents = list => Math.round(list.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100);
const use = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(input_tokens),0) it, COALESCE(SUM(output_tokens),0) ot,
  COALESCE(SUM(cost),0) cost, MIN(created_at) f, MAX(created_at) l FROM user_token_usage`).get();
const byDay = db.prepare("SELECT date(created_at,'unixepoch') day, COUNT(*) calls FROM user_token_usage GROUP BY day ORDER BY day").all();
const byModel = db.prepare("SELECT provider, model, COUNT(*) calls FROM user_token_usage GROUP BY provider, model ORDER BY calls DESC").all();
const plans = db.prepare('SELECT plan, COUNT(*) c FROM users GROUP BY plan').all();
const subs = db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE status='active'").get().c;

const payload = {
  ok: true, generatedAt: new Date().toISOString(),
  hakster: {
    revenue: { allTimeCents: cents(real), month30Cents: 0, payments: real.length, activeSubs: subs, excludedDuplicateCents: 0, excludedDuplicateRows: payments.length - real.length },
    usage: { calls: use.c, inputTokens: use.it, outputTokens: use.ot, costCents: Math.round(use.cost * 100), firstDay: new Date(use.f * 1000).toISOString().slice(0, 10), lastDay: new Date(use.l * 1000).toISOString().slice(0, 10), byDay, byModel },
    people: { total: plans.reduce((n, p) => n + p.c, 0), plans, activity7d: 0 },
  },
  phantom: null, junkalot: null, junkalotValue: null, bridge: 'unavailable',
  note: 'Usage is recorded, never billed.',
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/admin/profit-live')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(payload)); }
  let f = path.join(DIST, req.url.split('?')[0]);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4399, '127.0.0.1', async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('hakster_api_key', 'test-owner-key'); } catch (e) {} });
  await p.goto('http://127.0.0.1:4399/admin/live-stats/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));
  const out = await p.evaluate(() => ({
    status: document.getElementById('ls-status').textContent,
    tiles: [...document.querySelectorAll('.ls-tile')].map(t => t.querySelector('.k').textContent + '=' + t.querySelector('.v').textContent),
    bars: document.querySelectorAll('.ls-bar').length,
    lanes: document.querySelectorAll('.ls-lane').length,
    people: document.getElementById('ls-people').textContent.trim().slice(0, 60),
  }));
  console.log('status:', out.status);
  console.log('tiles:', out.tiles.join(' | '));
  console.log('bars:', out.bars, 'lanes:', out.lanes, 'people:', out.people);
  console.log('expected calls:', use.c, 'tokens:', use.it, '/', use.ot, 'bars should be', byDay.length);
  console.log('JS errors:', errs.length ? errs.join('; ') : 'none');
  await b.close(); srv.close(); process.exit(errs.length ? 1 : 0);
});
