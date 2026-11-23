// Verifies: startup shows only the ring; idle hides the applet entirely;
// a queued update brings the chip back.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

async function state(page) {
  return page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { display: cs.display, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0, w: Math.round(r.width), h: Math.round(r.height) };
    };
    const ring = document.getElementById('psa-start-ring');
    const before = ring ? getComputedStyle(ring, '::before') : null;
    return {
      mode: root.dataset.mode,
      state: root.dataset.state,
      rootDisplay: getComputedStyle(root).display,
      appletVar: getComputedStyle(document.documentElement).getPropertyValue('--phantom-applet-h').trim(),
      card: vis('.psa-card'),
      chip: vis('.psa-chip'),
      tab: vis('.psa-tab'),
      start: vis('.psa-start'),
      ringAnim: before ? before.animationName : null,
      chipTitle: document.getElementById('psa-chip-title')?.textContent || null,
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-startup-' + Date.now(),
  });

  // A: startup ring while the first check is still in flight, then idle → hidden
  const a = await browser.newPage();
  await a.setViewport({ width: 390, height: 844 });
  await a.setRequestInterception(true);
  a.on('request', async (req) => {
    const u = req.url();
    if (u.includes('/api/version')) {
      // Answer with the page's own build so this exercises the idle path.
      await new Promise((r) => setTimeout(r, 2500));
      const b = '2026-11-20T17:46:05.730Z';
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: b, server: { build: b, pending: 0, stale: false } }) });
    }
    req.continue();
  });
  await a.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 600));
  const during = await state(a);
  await a.screenshot({ path: '/home/ghost/tmp-verify/applet-startup-ring.png' });
  await new Promise((r) => setTimeout(r, 3500));
  const after = await state(a);

  // B: real page with a queued update -> the chip comes back
  const b = await browser.newPage();
  await b.setViewport({ width: 390, height: 844 });
  let build = '';
  const nowIso = new Date().toISOString();
  await b.setRequestInterception(true);
  b.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/stream')) return req.respond({ status: 503, body: '' });
    if (u.includes('/api/version')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: build + '-NEW', server: { build: build + '-NEW', pending: 0, stale: false } }) });
    }
    if (u.includes('/api/applet/status')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
        type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: nowIso,
        server: { status: 'online', uptimeSec: 100, node: 'v24' },
        build: { id: build + '-NEW', builtAt: nowIso, ageSec: 5 },
        job: { state: 'IDLE', label: 'Idle', percent: null, indeterminate: false },
        stability: { state: 'VERIFYING', reason: 'window in progress', window: { configuredSec: 90, approved: false, remainingSec: 40 },
          timestamps: { lastCheckAt: nowIso, deployedBuildId: build + '-NEW' }, evidence: { checks: 11, passing: 11, ratio: 1 }, watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
      }) });
    }
    req.continue();
  });
  await b.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  build = await b.evaluate(() => document.documentElement.dataset.haksterBuild || '');
  await new Promise((r) => setTimeout(r, 2500));
  const queued = await state(b);

  console.log(JSON.stringify({ during, after, queued }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
