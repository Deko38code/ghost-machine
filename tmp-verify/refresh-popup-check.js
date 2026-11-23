// On refresh: pop once if an update is ready; never for up-to-date or offline.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = () => ({
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 900, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  stability: { state: 'STABLE', reason: 'no failing check for 95s', window: { configuredSec: 90, approved: true, remainingSec: 0 },
    timestamps: { lastCheckAt: new Date().toISOString(), buildFirstStableAt: '2026-11-21T01:10:42.000Z', stableForSec: 95 },
    evidence: { checks: 11, passing: 11, measured: 11, ratio: 1, evidenceRatio: 1 }, heal: { healed: [], escalated: [], policy: 'x' },
    watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
});
async function open(mode) { // mode: 'ready' | 'offline'
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-rp-' + Date.now() + Math.random().toString(16).slice(2) });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/') && !u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    if (u.includes('/api/version')) {
      if (mode === 'offline') return req.respond({ status: 502, contentType: 'application/json', body: '{}' });
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2099-01-01T00:00:00.000Z', server: { build: '2099-01-01T00:00:00.000Z', pending: 0 } }) });
    }
    if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap()) });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  return { browser, page };
}
const modeOf = (page) => page.evaluate(() => {
  const r = document.getElementById('phantom-server-applet');
  return r.dataset.mode + '|' + r.dataset.state + '|' + (document.getElementById('psa-chip-title') || {}).textContent;
});
(async () => {
  const ready = await open('ready');
  const readyModes = [];
  for (let k = 0; k < 16; k += 1) { await new Promise((r) => setTimeout(r, 1000)); readyModes.push(await modeOf(ready.page)); }
  await ready.browser.close();
  const offline = await open('offline');
  const offlineModes = [];
  for (let k = 0; k < 36; k += 1) { await new Promise((r) => setTimeout(r, 1000)); offlineModes.push(await modeOf(offline.page)); }
  await offline.browser.close();
  console.log(JSON.stringify({ readyModes, offlineModes }, null, 1));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
