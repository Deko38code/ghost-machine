// Repro the "update available opens the card and it never closes" path.
// Timeline: load idle -> user engages (click) -> a NEW build appears -> watch if it docks.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const PB = '2026-11-21T22:03:25.906Z';
const PB2 = '2026-11-22T09:00:00.000Z';

const state = (page) => page.evaluate(() => {
  const root = document.getElementById('phantom-server-applet');
  if (!root) return { has: false };
  const c = document.querySelector('.psa-card');
  const cs = c ? getComputedStyle(c) : null; const r = c ? c.getBoundingClientRect() : null;
  return { mode: root.dataset.mode, state: root.dataset.state, card: !!cs && cs.display !== 'none' && r.width > 0,
    reason: root.dataset.openReason || '', detail: (document.getElementById('psa-detail')?.textContent || '').trim().slice(0, 60) };
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-pin-' + Date.now() });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  const ctrl = { build: PB, applying: false, stale: false };
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/stream')) return req.respond({ status: 503, body: '' });
    if (u.includes('/api/applet/status')) {
      const now = new Date().toISOString();
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
        type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: now,
        server: { status: 'online', uptimeSec: 500, node: 'v24' },
        build: { id: ctrl.build, builtAt: now, ageSec: 5 },
        job: { state: 'IDLE', label: 'Idle', percent: null, indeterminate: false },
        // VERIFYING (not STABLE) so auto-apply is NOT armed -> mimics the window where it should still auto-hide
        stability: { state: 'VERIFYING', reason: 'window', window: { configuredSec: 90, approved: false, remainingSec: 40 },
          timestamps: { lastCheckAt: now, deployedBuildId: ctrl.build }, evidence: { checks: 3, passing: 3, ratio: 1 },
          watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] } }) });
    }
    if (u.includes('/api/version')) return req.respond({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ build: ctrl.build, server: { build: ctrl.build, applying: ctrl.applying, stale: ctrl.stale, pending: 0 } }) });
    req.continue();
  });

  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2500));
  const idle = await state(page);
  // engage the page like a real visitor
  await page.mouse.click(200, 300); await new Promise((r) => setTimeout(r, 300));
  // a new build appears while the page is open
  ctrl.build = PB2;
  const t = [];
  let last = 0;
  for (const ms of [1500, 4000, 8000, 14000, 20000, 26000, 34000, 42000]) { await new Promise((r) => setTimeout(r, ms - last)); last = ms; t.push({ at: ms, ...(await state(page)) }); }
  console.log(JSON.stringify({ idle, afterNewBuild: t }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
