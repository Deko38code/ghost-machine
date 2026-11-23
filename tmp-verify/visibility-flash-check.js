// Verifies the red "?" tab no longer flashes when returning to a tab whose
// feed went stale while hidden — and that a genuinely dead feed still turns it
// red once the page is visible again.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const snap = () => ({
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 500, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  stability: { state: 'STABLE', reason: 'no failing check for 95s',
    window: { configuredSec: 90, approved: true, remainingSec: 0 },
    timestamps: { lastCheckAt: new Date().toISOString(), buildFirstStableAt: '2026-11-21T01:10:42.000Z', stableForSec: 95 },
    evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 }, watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-visibility' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  let feedOk = true;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2026-11-20T16:00:00.000Z', server: { build: 'x', pending: 0 } }) });
    if (u.includes('/api/applet/stream')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    if (u.includes('/api/applet/status')) {
      if (!feedOk) return req.respond({ status: 502, contentType: 'application/json', body: '{"error":"down"}' });
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap()) });
    }
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 4000));
  const read = () => page.evaluate(() => ({
    tab: (document.getElementById('psa-tab-pct') || {}).textContent,
    rootState: document.getElementById('phantom-server-applet').dataset.state,
    title: (document.getElementById('psa-title') || {}).textContent,
  }));
  const first = await read();
  // Feed dies, tab hidden for 40 s (simulating background timer throttling).
  feedOk = false;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise((r) => setTimeout(r, 40000));
  const whileHidden = await read();
  // Return to the tab; feed still down for a moment.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise((r) => setTimeout(r, 700));
  const justReturned = await read();
  await new Promise((r) => setTimeout(r, 3000));
  const threeSecAfterReturn = await read();
  // Feed stays down past the 5 s grace: the watchdog must still fire.
  await new Promise((r) => setTimeout(r, 9000));
  const stillDown = await read();
  // Feed recovers.
  feedOk = true;
  await new Promise((r) => setTimeout(r, 3000));
  const recovered = await read();
  console.log(JSON.stringify({ first, whileHidden, justReturned, threeSecAfterReturn, stillDown, recovered }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
