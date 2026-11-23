const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-live-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 6000));
  const out = await page.evaluate(() => {
    const root = document.getElementById('phantom-server-applet');
    if (root.dataset.mode === 'tab') document.getElementById('psa-tab').click();
    const stab = document.getElementById('psa-stab');
    return { mode: root.dataset.mode, stabHidden: stab.hidden, stabState: (document.getElementById('psa-stab-state') || {}).textContent, stabDetail: (document.getElementById('psa-stab-detail') || {}).textContent };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
