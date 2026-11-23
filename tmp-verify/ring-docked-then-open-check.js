// The applet must be visibly docked (tab) while the ring shows REAL progress,
// and only then open the card.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
let running = false;
const base = () => ({
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 900, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: running
    ? { state: 'RUNNING', label: 'Building', percent: 42, indeterminate: false, buildId: 'B-2', stage: { id: 'build', label: 'Astro build' }, stages: [{ id: 'build', status: 'running' }], elapsedSec: 60, etaSec: 90, etaBasis: 'median of 9 builds' }
    : { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  stability: { state: 'STABLE', reason: 'no failing check for 95s', window: { configuredSec: 90, approved: true, remainingSec: 0 },
    timestamps: { lastCheckAt: new Date().toISOString(), buildFirstStableAt: '2026-11-21T01:10:42.000Z', stableForSec: 95 },
    evidence: { checks: 11, passing: 11, measured: 11, ratio: 1, evidenceRatio: 1 }, heal: { healed: [], escalated: [], policy: 'x' },
    watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
});
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-dock-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/') && !u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: null, server: { build: null, pending: 0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(base()) });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const read = () => page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const ring = document.getElementById('psa-tab-ring');
    const ap = window.__phantomApplet ? window.__phantomApplet.snapshot() : null;
    const chipRing = document.getElementById('psa-chip-ring');
    return { mode: root.dataset.mode, tabProgress: ring ? ring.dataset.progress : null, tabP: ring ? ring.style.getPropertyValue('--p') : null,
      chipProgress: chipRing ? chipRing.dataset.progress : null, chipP: chipRing ? chipRing.style.getPropertyValue('--p') : null,
      chipTitle: (document.getElementById('psa-chip-title') || {}).textContent,
      chipVisible: getComputedStyle(document.getElementById('psa-chip')).display,
      tabVisible: getComputedStyle(document.getElementById('psa-tab')).display, ap };
  });
  await new Promise((r) => setTimeout(r, 23000));
  const docked = await read();
  running = true;
  const timeline = [];
  let firstProgress = null;
  let firstCard = null;
  for (let k = 0; k < 50; k += 1) {
    await new Promise((r) => setTimeout(r, 200));
    const st = await read();
    if (!firstProgress && (st.chipProgress === '1' || st.tabProgress === '1')) firstProgress = { k, ...st };
    if (!firstCard && st.mode === 'card') firstCard = { k, ...st };
    if (firstProgress && firstCard) break;
  }
  console.log(JSON.stringify({ docked, firstProgress, firstCard }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
