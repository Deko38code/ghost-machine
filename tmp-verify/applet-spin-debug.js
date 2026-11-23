// Why does the startup ring report animation:none?
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-spindbg-' + Date.now(),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    if (req.url().includes('/api/version')) {
      await new Promise((r) => setTimeout(r, 3000));
      const b = '2026-11-20T17:46:05.730Z';
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: b, server: { build: b, pending: 0, stale: false } }) });
    }
    req.continue();
  });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 800));
  const d = await page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    const start = document.getElementById('psa-start');
    const ring = document.getElementById('psa-start-ring');
    const b = getComputedStyle(ring, '::before');
    return {
      mode: root.dataset.mode,
      rootPaused: root.dataset.paused,
      startAttrs: { active: start.dataset.active, failed: start.dataset.failed },
      ringAttrs: { progress: ring.dataset.progress, failed: ring.dataset.failed },
      beforeDisplay: b.display,
      beforeAnim: b.animationName,
      beforeDur: b.animationDuration,
      startAnim: getComputedStyle(start).animationName,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
