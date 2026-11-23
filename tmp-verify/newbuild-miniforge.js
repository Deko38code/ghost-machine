// Miniforge: new build mid-session -> announce card then dock to chip (not pin).
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const B1 = '2026-11-21T10:47:00.000Z', B2 = '2026-11-22T09:00:00.000Z';
const state = (p) => p.evaluate(() => { const r = document.getElementById('phantom-server-applet'); return { mode: r?.dataset.mode, state: r?.dataset.state }; });
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-nb-' + Date.now() });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  const ctrl = { build: B1 };
  await p.setRequestInterception(true);
  p.on('request', (req) => { if (/\/api\/version/.test(req.url())) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: ctrl.build, bots: { build: ctrl.build, count: 4 }, server: { build: ctrl.build, applying: false, stale: false, pending: 0, error: null } }) }); req.continue(); });
  await p.goto('https://haksterai.com/miniforge/app/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500)); await p.mouse.click(200, 300); await new Promise(r => setTimeout(r, 300));
  ctrl.build = B2;
  const seen = []; let last = 0;
  for (const ms of [30000, 45000, 62000, 68000, 74000, 82000]) { await new Promise(r => setTimeout(r, ms - last)); last = ms; seen.push({ at: ms, ...(await state(p)) }); }
  console.log(JSON.stringify(seen, null, 1));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
