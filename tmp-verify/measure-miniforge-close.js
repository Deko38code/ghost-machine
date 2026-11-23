// Measure the no-update close: wait for state=live, open card, time to tuck.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const mode = (p) => p.evaluate(() => document.getElementById('phantom-server-applet')?.dataset.mode);
const st = (p) => p.evaluate(() => document.getElementById('phantom-server-applet')?.dataset.state);
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-fast-' + Date.now() });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.goto('https://haksterai.com/miniforge/app/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  // wait up to 70s for the applet to settle to live/restored
  let s = '', waited = 0;
  while (waited < 70000) { s = await st(p); if (s === 'live' || s === 'restored') break; await new Promise(r => setTimeout(r, 2000)); waited += 2000; }
  const settledState = s;
  if (s !== 'live' && s !== 'restored') { console.log(JSON.stringify({ settledState, note: 'did not settle within 70s — timing unverified' })); await b.close(); return; }
  // open the card and measure how long until it leaves card mode
  await p.evaluate(() => document.getElementById('psa-tab')?.click());
  const t0 = Date.now();
  let m = await mode(p);
  while (m === 'card' && Date.now() - t0 < 12000) { await new Promise(r => setTimeout(r, 250)); m = await mode(p); }
  console.log(JSON.stringify({ settledState, afterClickMode: 'card', dockedTo: m, msToTuck: Date.now() - t0 }));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
