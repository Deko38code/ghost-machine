// Confirms the debug strip shows the pattern row with real numbers.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 500, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
  pattern: { sampledBuilds: 9, medianTotalMs: 8306, fastestMs: 5631, slowestMs: 17128, lastMs: 17128,
    slowestStage: { id: 'build', medianMs: 7687 }, trend: 'faster', basis: 'medians of the last 9 successful recorded builds',
    at: new Date().toISOString() },
  stability: { state: 'STABLE', reason: 'no failing check for 95s',
    window: { configuredSec: 90, approved: true, remainingSec: 0, elapsedSec: 90 },
    timestamps: { lastCheckAt: new Date().toISOString(), buildFirstStableAt: '2026-11-21T01:10:42.000Z', stableForSec: 95 },
    evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 },
    watchdog: { stale: false, evidenceAgeSec: 2 },
    checks: [{ id: 'pm2-state', status: 'pass' }] },
};
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-pattern' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2026-11-20T16:00:00.000Z', server: { build: 'x', pending: 0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap) });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 3000));
  const out = await page.evaluate(() => {
    document.getElementById('psa-tab').click();
    document.getElementById('psa-stab').click();
    const txt = document.getElementById('psa-debug-body').textContent;
    const stab = document.querySelector('.psa-stability') || document.body;
    return { full: txt, stableLine: (txt.split('\n').find((l) => /^pattern/.test(l)) || null), stabText: document.getElementById('psa-stab').textContent };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
