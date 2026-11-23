const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-cpu-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const reqs = {};
  page.on('request', (r) => { const u = new URL(r.url()); const k = u.pathname; reqs[k] = (reqs[k] || 0) + 1; });
  const cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  await new Promise(r => setTimeout(r, 6000));           // settle: first checks + first frame
  for (const k of Object.keys(reqs)) delete reqs[k];
  const m0 = await cdp.send('Performance.getMetrics');
  const t0 = Date.now();
  await new Promise(r => setTimeout(r, 30000));          // idle 30 s
  const m1 = await cdp.send('Performance.getMetrics');
  const wall = (Date.now() - t0) / 1000;
  const get = (m, n) => (m.metrics.find(x => x.name === n) || {}).value || 0;
  const taskSec = get(m1, 'TaskDuration') - get(m0, 'TaskDuration');
  const scriptSec = get(m1, 'ScriptDuration') - get(m0, 'ScriptDuration');
  const layoutSec = get(m1, 'LayoutDuration') - get(m0, 'LayoutDuration');
  const domNodes = get(m1, 'Nodes');
  const applet = await page.evaluate(() => ({
    mode: document.getElementById('phantom-server-applet').dataset.mode,
    state: document.getElementById('phantom-server-applet').dataset.state,
    paused: document.getElementById('phantom-server-applet').dataset.paused || null,
  }));
  console.log(JSON.stringify({
    windowSec: wall,
    mainThreadBusySec: +taskSec.toFixed(3),
    mainThreadBusyPct: +(taskSec / wall * 100).toFixed(2),
    scriptSec: +scriptSec.toFixed(3),
    layoutSec: +layoutSec.toFixed(3),
    domNodes,
    requests30s: reqs,
    applet,
  }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
