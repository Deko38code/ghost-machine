// $999 lifetime copy: measure the marketplace panel on both live pages.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-lifetime-' + Date.now(),
  });
  const out = {};
  for (const path of ['/', '/marketplace/']) {
    for (const vp of [{ n: '360x640', w: 360, h: 640 }, { n: '390x844', w: 390, h: 844 }, { n: '414x896', w: 414, h: 896 }, { n: '1440x900', w: 1440, h: 900 }, { n: '1920x1080', w: 1920, h: 1080 }]) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto('https://haksterai.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 800));
      out[path + ' ' + vp.n] = await page.evaluate(() => {
        const pills = Array.from(document.querySelectorAll('span, .pill')).filter((s) => /lifetime subscription/i.test(s.textContent || ''));
        const pill = pills[0] || null;
        const box = pill ? pill.getBoundingClientRect() : null;
        const h2 = Array.from(document.querySelectorAll('h2')).find((el) => /Fully built sites/i.test(el.textContent || ''));
        return {
          found: pills.length,
          text: pill ? pill.textContent.trim().slice(0, 60) : null,
          h2: h2 ? h2.textContent.trim() : null,
          pillLeft: box ? Math.round(box.left) : null,
          pillRight: box ? Math.round(box.right) : null,
          inViewport: box ? box.left >= 0 && box.right <= innerWidth : false,
          gutter: box ? Math.round(box.left) : null,
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      await page.screenshot({ path: '/home/ghost/tmp-verify/lifetime-' + path.replace(/\W+/g, '_') + vp.n + '.png', fullPage: false });
      await page.close();
    }
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
