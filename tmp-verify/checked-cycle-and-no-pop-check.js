// A: "Checked" counts 0→10 s then restarts.
// B: a newer build updates the chip but does NOT pop the panel open.
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
async function run(versionBody) {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-cpc-' + Date.now() + Math.random().toString(16).slice(2) });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/') && !u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(versionBody) });
    if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap()) });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  return { browser, page };
}
(async () => {
  // A — checked cycle
  const a = await run({ build: null, server: { build: null, pending: 0 } });
  const checked = [];
  for (let k = 0; k < 14; k += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    checked.push(await a.page.evaluate(() => (document.getElementById('psa-checked') || {}).textContent));
  }
  await a.browser.close();
  // B — newer build must not pop the card
  const b = await run({ build: '2099-01-01T00:00:00.000Z', server: { build: '2099-01-01T00:00:00.000Z', pending: 0 } });
  const modes = [];
  for (let k = 0; k < 14; k += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    modes.push(await b.page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      return root.dataset.mode + '|' + (document.getElementById('psa-chip-title') || {}).textContent;
    }));
  }
  await b.browser.close();
  console.log(JSON.stringify({ checked, modes }, null, 1));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
