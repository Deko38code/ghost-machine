// Repro: does the card stay open after the condition that opened it goes away?
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const PB = '2026-11-21T22:03:25.906Z';

const state = (page) => page.evaluate(() => {
  const root = document.getElementById('phantom-server-applet');
  if (!root) return { has: false };
  const c = document.querySelector('.psa-card');
  const cs = c ? getComputedStyle(c) : null; const r = c ? c.getBoundingClientRect() : null;
  return { mode: root.dataset.mode, state: root.dataset.state, card: !!cs && cs.display !== 'none' && r.width > 0,
    detail: document.getElementById('psa-detail')?.textContent?.trim().slice(0, 70) };
});

function mock(page, ctrl) {
  page.setRequestInterception(true);
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
        stability: { state: 'STABLE', reason: 'ok', window: { configuredSec: 90, approved: true, remainingSec: 0 },
          timestamps: { lastCheckAt: now, deployedBuildId: ctrl.build }, evidence: { checks: 5, passing: 5, ratio: 1 },
          watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [] },
      }) });
    }
    if (u.includes('/api/version')) {
      return req.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ build: ctrl.build, server: { build: ctrl.build, applying: ctrl.applying, stale: ctrl.stale, pending: ctrl.pending || 0 } }) });
    }
    req.continue();
  });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-repro-' + Date.now() });

  // Scenario A: update applies, then finishes -> card should dock/close
  const a = await browser.newPage(); await a.setViewport({ width: 1440, height: 900 });
  const ca = { build: PB, applying: true, stale: false };
  mock(a, ca);
  await a.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const a1 = await state(a); // while applying
  await new Promise((r) => setTimeout(r, 2500));
  const a2 = await state(a);
  ca.applying = false; // update finishes
  await new Promise((r) => setTimeout(r, 9000)); // give dock(10s)/close timers a chance... poll is 2s
  const a3 = await state(a);
  await new Promise((r) => setTimeout(r, 12000));
  const a4 = await state(a);
  await a.close();

  // Scenario B: server build ahead of page build (newerBuild) -> does card open and stay?
  const b = await browser.newPage(); await b.setViewport({ width: 1440, height: 900 });
  const cb = { build: PB + '-NEW', applying: false, stale: false };
  mock(b, cb);
  await b.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 4000));
  const b1 = await state(b);
  await new Promise((r) => setTimeout(r, 12000));
  const b2 = await state(b);
  await b.close();

  console.log(JSON.stringify({ A_applying_open: a1, A_after2s: a2, A_after_finish_9s: a3, A_after_finish_21s: a4, B_newer_4s: b1, B_newer_16s: b2 }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
