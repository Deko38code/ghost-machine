const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const VPS = [[360, 640], [390, 844], [414, 896], [1440, 900], [1920, 1080]];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-hak-applet',
  });
  const results = [];
  for (const [w, h] of VPS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    let mode = 'idle';
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('/api/version')) {
        if (mode === 'queued') {
          return req.respond({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' },
            body: JSON.stringify({ build: '2026-11-20T15:42:07.957Z', server: { build: 'srv-test', stale: true, pending: 2, idle: true, applying: false }, checkedAt: new Date().toISOString() }) });
        }
        if (mode === 'applying') {
          return req.respond({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' },
            body: JSON.stringify({ build: '2026-11-20T15:42:07.957Z', server: { build: 'srv-test', stale: false, pending: 0, idle: false, applying: true }, checkedAt: new Date().toISOString() }) });
        }
      }
      req.continue();
    });
    await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));

    const read = () => page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const card = root && root.querySelector('.psa-card');
      const r = card ? card.getBoundingClientRect() : null;
      return {
        mode: root && root.dataset.mode,
        state: root && root.dataset.state,
        cardVisible: r ? (r.width > 0 && r.height > 0) : false,
        cardRight: r ? Math.round(r.right) : null,
        vw: window.innerWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        text: root ? root.innerText.replace(/\s+/g, ' ').slice(0, 220) : null,
        hasJunkalot: root ? /junkalot/i.test(root.innerText + ' ' + root.innerHTML) : null,
        appletVar: getComputedStyle(document.documentElement).getPropertyValue('--phantom-applet-h'),
      };
    });

    const idle = await read();
    mode = 'queued';
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2500));
    const queued = await read();
    mode = 'applying';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2500));
    const applying = await read();

    results.push({ vp: w + 'x' + h, idle, queued, applying });
    await page.screenshot({ path: '/home/ghost/tmp-verify/hak-applet-' + w + 'x' + h + '.png' });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
