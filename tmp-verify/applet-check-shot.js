// Visual proof: the circle shows ✓ once the 4-point inspection passes.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-checkshot-' + Date.now(),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  let build = '';
  const now = new Date().toISOString();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/applet/stream')) return req.respond({ status: 503, body: '' });
    if (u.includes('/api/applet/status')) {
      const body = JSON.stringify({
        type: 'snapshot', scope: 'public', site: 'haksterai', box: 'dell', ts: now,
        server: { status: 'online', uptimeSec: 1234, node: 'v24' },
        build: { id: build, builtAt: build, ageSec: 60 },
        job: { state: 'IDLE', label: 'Idle · no build running', percent: null, indeterminate: false },
        stability: {
          state: 'STABLE', reason: 'no failing check for 95s',
          window: { configuredSec: 90, approved: true, remainingSec: 0 },
          timestamps: { lastCheckAt: now, deployedBuildId: build, buildFirstStableAt: now, stableForSec: 95 },
          evidence: { checks: 11, passing: 11, measured: 11, ratio: 1 },
          watchdog: { stale: false, evidenceAgeSec: 2 }, checks: [],
        },
      });
      return req.respond({ status: 200, contentType: 'application/json', body });
    }
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  build = await page.evaluate(() => document.documentElement.dataset.haksterBuild || '');
  await page.evaluate((b) => sessionStorage.setItem('phantom-applet-applied', JSON.stringify({ build: b, at: Date.now() })), build);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });

  // wait for the check, then let the card dock so the chip's circle is visible
  await page.waitForFunction(() => document.getElementById('phantom-server-applet')?.dataset.verified === '1', { timeout: 60000 });
  await page.waitForFunction(() => ['chip','tab'].includes(document.getElementById('phantom-server-applet')?.dataset.mode), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));
  const mode = await page.evaluate(() => document.getElementById('phantom-server-applet').dataset.mode);
  const chip = await page.$('#' + (mode === 'tab' ? 'psa-tab' : 'psa-chip'));
  await chip.screenshot({ path: '/home/ghost/tmp-verify/applet-verified-chip.png' });
  const st = await page.evaluate(() => {
    const c = document.getElementById('psa-chip-ring');
    const t = document.getElementById('psa-tab-ring');
    return {
      verified: document.getElementById('phantom-server-applet').dataset.verified,
      chipContent: getComputedStyle(c, '::after').content,
      chipColor: getComputedStyle(c, '::after').color,
      chipFont: getComputedStyle(c, '::after').font,
      tabContent: getComputedStyle(t, '::after').content,
      chipTitle: document.getElementById('psa-chip-title').textContent,
    };
  });
  console.log(JSON.stringify(st, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
