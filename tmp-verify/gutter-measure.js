const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 500, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  stability: { state: 'STABLE', reason: 'no failing check for 166s', window: { configuredSec: 90, approved: true, remainingSec: 0 }, timestamps: { lastCheckAt: new Date().toISOString(), buildFirstStableAt: '2026-11-20T16:44:46.688Z', stableForSec: 100 }, evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 }, watchdog: { stale: false, evidenceAgeSec: 2 }, heal: { healed: [], escalated: [] }, checks: [] },
};
const VIEWS = [[360,640],[390,844],[414,896]];
(async () => {
  const out = [];
  for (const [w,h] of VIEWS) {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
      args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-gut-' + Date.now() + '-' + w });
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const u = req.url();
      if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2026-11-20T16:00:00.000Z', server: { build: 'x', pending: 0 } }) });
      if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap) });
      if (u.includes('/api/applet/stream')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
      req.continue();
    });
    await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 1500));
    // open the card by clicking the tab
    try { await page.click('#psa-tab', { delay: 40 }); } catch (_) {}
    await new Promise(r => setTimeout(r, 700));
    const m = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const card = document.getElementById('psa-card') || root.querySelector('.psa-card');
      const rb = card ? card.getBoundingClientRect() : null;
      return {
        mode: root.dataset.mode,
        vw: document.documentElement.clientWidth,
        cardLeft: rb ? Math.round(rb.left) : null,
        cardRight: rb ? Math.round(window.innerWidth - rb.right) : null,
        cardW: rb ? Math.round(rb.width) : null,
        bodyScrollW: document.body.scrollWidth,
        docScrollW: document.documentElement.scrollWidth,
      };
    });
    m.viewport = w + 'x' + h;
    out.push(m);
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
