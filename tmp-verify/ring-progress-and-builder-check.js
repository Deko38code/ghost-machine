// Verifies: (1) the little ring fills to the REAL percent while the panel is
// still docked, (2) the panel opens ~900 ms later, (3) the debug strip has a
// builder decoder row and both ratios.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = () => ({
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 800, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'RUNNING', label: 'Building', percent: 42, indeterminate: false, buildId: 'B-1',
    stage: { id: 'build', label: 'Astro build' },
    stages: [{ id: 'dependencies', status: 'done' }, { id: 'build', status: 'running' }, { id: 'health', status: 'pending' }],
    elapsedSec: 192, etaSec: 250, etaBasis: 'median of 9 builds' },
  stability: { state: 'VERIFYING', reason: 'observation window 30s of 90s',
    window: { configuredSec: 90, approved: true, remainingSec: 60 },
    timestamps: { lastCheckAt: new Date().toISOString() },
    evidence: { checks: 11, passing: 11, measured: 11, ratio: 1, evidenceRatio: 1 },
    heal: { policy: 'retry + record only', attemptsPerCheck: 2, healed: [], escalated: [] },
    watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
});
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-ring-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/') && !u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: '2026-11-20T16:00:00.000Z', server: { build: 'x', pending: 0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap()) });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const read = () => page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const ring = document.getElementById('psa-tab-ring');
    const cs = ring ? getComputedStyle(ring) : null;
    return {
      mode: root.dataset.mode,
      ringProgress: ring ? ring.dataset.progress : null,
      ringP: ring ? ring.style.getPropertyValue('--p') : null,
      ringBg: cs ? cs.backgroundImage.slice(0, 90) : null,
      ringSpin: ring ? getComputedStyle(ring, '::before').display : null,
      dbg: (document.getElementById('psa-debug-body') || {}).textContent || '',
    };
  });
  const early = await read();
  await new Promise((r) => setTimeout(r, 400));
  const mid = await read();
  await new Promise((r) => setTimeout(r, 1200));
  const late = await read();
  await page.evaluate(() => { document.getElementById('psa-stab').click(); });
  await new Promise((r) => setTimeout(r, 250));
  const dbgText = await page.evaluate(() => (document.getElementById('psa-debug-body') || {}).textContent || '');
  console.log(JSON.stringify({ early: { ...early, dbg: undefined }, mid: { ...mid, dbg: undefined }, late: { ...late, dbg: undefined },
    builderRow: (dbgText.split('\n').find((l) => l.startsWith('builder')) || null),
    healRow: (dbgText.split('\n').find((l) => l.startsWith('heal')) || null),
    evidenceRow: (dbgText.split('\n').find((l) => l.startsWith('evidence')) || null) }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
