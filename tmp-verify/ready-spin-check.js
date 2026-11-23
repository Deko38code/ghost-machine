// Verifies the "getting ready" spinner: before the first frame the ring spins
// and the static dot is hidden; after the first frame the ring is gone.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const snap = {
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 500, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  stability: { state: 'STABLE', reason: 'no failing check for 95s', window: { configuredSec: 90, approved: true, remainingSec: 0 }, timestamps: { lastCheckAt: new Date().toISOString() }, evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 }, watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-ready-spin',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const u = req.url();
    if (u.includes('/api/version')) {
      // Hold the version answer so the card is genuinely "getting ready".
      await new Promise((r) => setTimeout(r, 2500));
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2026-11-20T16:00:00.000Z', server: { build: 'x', pending: 0 } }) });
    }
    if (u.includes('/api/applet/status')) {
      await new Promise((r) => setTimeout(r, 2500));
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap) });
    }
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 500));
  const before = await page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const ring = document.getElementById('psa-load-ring');
    const icon = document.getElementById('psa-icon');
    const rb = ring ? getComputedStyle(ring, '::before') : null;
    return {
      ready: root && root.dataset.ready,
      ringDisplay: ring ? getComputedStyle(ring).display : null,
      ringAnim: rb ? rb.animationName : null,
      ringTopColor: rb ? rb.borderTopColor : null,
      iconDisplay: icon ? getComputedStyle(icon).display : null,
      tabActive: (document.getElementById('psa-tab') || {}).dataset?.active,
    };
  });
  await page.screenshot({ path: '/home/ghost/tmp-verify/ready-spin-before.png' });
  await new Promise((r) => setTimeout(r, 5000));
  const after = await page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const ring = document.getElementById('psa-load-ring');
    const icon = document.getElementById('psa-icon');
    return { ready: root && root.dataset.ready, ringDisplay: ring ? getComputedStyle(ring).display : null, iconDisplay: icon ? getComputedStyle(icon).display : null };
  });
  await page.screenshot({ path: '/home/ghost/tmp-verify/ready-spin-after.png' });
  console.log(JSON.stringify({ before, after }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
