// With a queued update the applet opens as the card: confirm it sits in the
// corner, the marketplace padding follows --phantom-applet-h, no overflow.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-cardlayout-' + Date.now(),
  });
  const out = {};
  for (const vp of [{ n: '360x640', w: 360, h: 640 }, { n: '390x844', w: 390, h: 844 }, { n: '414x896', w: 414, h: 896 }, { n: '1440x900', w: 1440, h: 900 }, { n: '1920x1080', w: 1920, h: 1080 }]) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h });
    let build = '';
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/applet/stream')) return req.respond({ status: 503, body: '' });
      if (u.includes('/api/version')) {
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: build + '-NEW', server: { build: build + '-NEW', pending: 0, stale: false } }) });
      }
      req.continue();
    });
    await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    build = await page.evaluate(() => document.documentElement.dataset.haksterBuild || '');
    await page.waitForFunction(() => ['card', 'chip'].includes(document.getElementById('phantom-server-applet')?.dataset.mode), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 500));
    out[vp.n] = await page.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const card = root.querySelector('.psa-card').getBoundingClientRect();
      const sec = getComputedStyle(document.getElementById('marketplace'));
      return {
        mode: root.dataset.mode,
        appletVar: getComputedStyle(document.documentElement).getPropertyValue('--phantom-applet-h').trim(),
        card: { left: Math.round(card.left), top: Math.round(card.top), right: Math.round(card.right), bottom: Math.round(card.bottom) },
        cardInViewport: card.left >= 0 && card.right <= innerWidth && card.bottom <= innerHeight,
        rightGap: Math.round(innerWidth - card.right),
        bottomGap: Math.round(innerHeight - card.bottom),
        padB: sec.paddingBottom,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      };
    });
    await page.screenshot({ path: '/home/ghost/tmp-verify/cardlayout-' + vp.n + '.png' });
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
