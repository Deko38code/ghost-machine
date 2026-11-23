// Verifies the applet's four-point inspection: after an update, the little
// circle shows a ✓ only once all 4 checkpoints pass, one every 12 s.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const PAGE = 'https://haksterai.com/';

function snapFor(build, opts) {
  const now = new Date().toISOString();
  return {
    type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: now,
    server: { status: 'online', uptimeSec: 1234, node: 'v24' },
    build: { id: build, builtAt: build, ageSec: 60 },
    job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
    stability: {
      state: opts.state,
      reason: opts.state === 'STABLE' ? 'no failing check for 95s' : 'observation window in progress',
      window: { configuredSec: 90, approved: opts.state === 'STABLE', remainingSec: opts.state === 'STABLE' ? 0 : 40 },
      timestamps: { lastCheckAt: now, deployedBuildId: build, buildFirstStableAt: opts.state === 'STABLE' ? now : null, stableForSec: 95 },
      evidence: { checks: 11, passing: opts.passing, measured: 11, ratio: opts.passing / 11 },
      watchdog: { stale: false, evidenceAgeSec: 2 },
      checks: [],
    },
  };
}

async function run(browser, mode) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.setRequestInterception(true);
  let build = '';
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/stream')) return req.respond({ status: 503, body: '' });
    if (u.includes('/api/applet/status')) {
      const body = JSON.stringify(mode === 'pass'
        ? snapFor(build, { state: 'STABLE', passing: 11 })
        : snapFor(build, { state: 'VERIFYING', passing: 9 }));
      return req.respond({ status: 200, contentType: 'application/json', body });
    }
    req.continue();
  });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  build = await page.evaluate(() => document.documentElement.dataset.haksterBuild || '');
  await page.evaluate((b) => sessionStorage.setItem('phantom-applet-applied', JSON.stringify({ build: b, at: Date.now() })), build);
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });

  const samples = [];
  let firstVerified = null;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const detail = document.getElementById('psa-detail');
      const chipRing = document.getElementById('psa-chip-ring');
      const tabRing = document.getElementById('psa-tab-ring');
      const after = (el) => el ? getComputedStyle(el, '::after').content : null;
      return {
        verified: root && root.dataset.verified,
        state: root && root.dataset.state,
        detail: detail ? detail.textContent.trim() : null,
        chipAfter: after(chipRing),
        tabAfter: after(tabRing),
      };
    });
    const sec = Math.round((Date.now() - t0) / 1000);
    samples.push({ sec, ...s });
    if (s.verified === '1' && firstVerified == null) firstVerified = sec;
    if (sec > 46) break;
    if (firstVerified != null && sec > firstVerified + 2) break;
  }
  const pick = (n) => samples.reduce((a, b) => (Math.abs(b.sec - n) < Math.abs(a.sec - n) ? b : a), samples[0]);
  await page.screenshot({ path: '/home/ghost/tmp-verify/applet-4point-' + mode + '.png' });
  const out = {
    mode,
    pageBuild: build,
    firstVerifiedSec: firstVerified,
    at5: pick(5),
    at13: pick(13),
    at25: pick(25),
    final: samples[samples.length - 1],
    errors: errs,
  };
  await page.close();
  return out;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-4point-' + Date.now(),
  });
  const pass = await run(browser, 'pass');
  const fail = await run(browser, 'verifying');
  console.log(JSON.stringify({ pass, fail }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
