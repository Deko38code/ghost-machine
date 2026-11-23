const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const snap = {
  type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: new Date().toISOString(),
  server: { status: 'online', uptimeSec: 500, node: 'v24' },
  build: { id: '2026-11-20T16:00:00.000Z', builtAt: '2026-11-20T16:00:00.000Z', ageSec: 60 },
  job: { state: 'RUNNING', label: 'Building', percent: 42, indeterminate: false, buildId: 'B-3', stage: { id: 'build', label: 'Astro build' }, stages: [{ id: 'dependencies', status: 'done' }, { id: 'build', status: 'running' }, { id: 'health', status: 'pending' }], elapsedSec: 192, etaSec: 250, etaBasis: 'median of 9 builds' },
  pattern: { sampledBuilds: 9, medianTotalMs: 8306, slowestStage: { id: 'build', medianMs: 7687 }, trend: 'faster' },
  stability: { state: 'DEGRADED', reason: 'failing: resources (mem available 54.6% · load 2.85/core · disk free 30.8%)',
    window: { configuredSec: 90, approved: true, remainingSec: 60 }, timestamps: { lastCheckAt: new Date().toISOString() },
    evidence: { checks: 11, passing: 9, measured: 11, ratio: 0.82, evidenceRatio: 1 },
    heal: { policy: 'retry + record only', attemptsPerCheck: 2, healed: ['health-endpoint'], escalated: ['resources'] },
    watchdog: { stale: false, evidenceAgeSec: 2 },
    checks: [{ id: 'resources', status: 'fail', detail: 'mem available 54.6% · load 2.85/core · disk free 30.8%' }, { id: 'error-rate', status: 'fail', detail: '12 lines/60s' }] },
};
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-d360-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 640 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/') && !u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'text/event-stream', body: '' });
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: null, server: { build: null, pending: 0 } }) });
    if (u.includes('/api/applet/status')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(snap) });
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2000));
  const out = await page.evaluate(() => {
    if (document.getElementById('phantom-server-applet').dataset.mode !== 'card') document.getElementById('psa-tab').click();
    document.getElementById('psa-stab').click();
    const root = document.getElementById('phantom-server-applet');
    const dbg = document.getElementById('psa-debug');
    const body = document.getElementById('psa-debug-body');
    const r = dbg.getBoundingClientRect();
    return { vw: innerWidth, mode: root.dataset.mode, dbg: { l: r.left, r: r.right, w: r.width, h: r.height },
      bodyScrollW: body.scrollWidth, bodyClientW: body.clientWidth, docScrollW: document.documentElement.scrollWidth,
      text: body.textContent };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
