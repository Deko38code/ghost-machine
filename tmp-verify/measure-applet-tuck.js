// Measure idle tuck: wait for live, open card, time to dock. URL from argv.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const URL = process.argv[2] || 'https://haksterai.com/';
const mode = (p) => p.evaluate(() => document.getElementById('phantom-server-applet')?.dataset.mode);
const st = (p) => p.evaluate(() => document.getElementById('phantom-server-applet')?.dataset.state);
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-tuck-' + Date.now() });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  let s = '', waited = 0;
  while (waited < 30000) { s = await st(p); if (s === 'live' || s === 'restored') break; await new Promise(r => setTimeout(r, 1000)); waited += 1000; }
  if (s !== 'live' && s !== 'restored') { console.log(JSON.stringify({ URL, settledState: s, note: 'did not settle within 30s — unverified' })); await b.close(); return; }
  await p.evaluate(() => document.getElementById('psa-tab')?.click());
  const t0 = Date.now(); let m = await mode(p);
  while (m === 'card' && Date.now() - t0 < 12000) { await new Promise(r => setTimeout(r, 200)); m = await mode(p); }
  console.log(JSON.stringify({ URL, settledState: s, afterClick: 'card', dockedTo: m, msToTuck: Date.now() - t0 }));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
