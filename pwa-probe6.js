// Phone-width pass: is the install surface present, visible, unclipped, and tappable?
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const PAGES = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  for (const url of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const r = { url };
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
      await new Promise((res) => setTimeout(res, 2000));
      r.data = await page.evaluate(() => {
        const d = {};
        d.manifest = !!document.querySelector('link[rel=manifest]');
        d.swReg = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
        d.bipState = !!(window.__haksterInstall && window.__haksterInstall.evt);
        const pill = document.getElementById('hakster-install-pill');
        d.pillExists = !!pill;
        if (pill) {
          const s = getComputedStyle(pill);
          const b = pill.getBoundingClientRect();
          d.pill = { hidden: pill.hidden, display: s.display, z: s.zIndex,
            rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
            insideViewport: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight,
            gutterLeft: Math.round(b.left),
            hitTest: (function(){ const e = document.elementFromPoint(Math.round(b.left+b.width/2), Math.round(b.top+b.height/2)); return e ? (e.id || e.tagName) : null; })() };
        }
        d.docWidth = document.documentElement.scrollWidth;
        d.viewportWidth = innerWidth;
        d.horizOverflow = document.documentElement.scrollWidth > innerWidth + 1;
        return d;
      });
    } catch (e) { r.error = String(e).slice(0, 140); }
    out.push(r);
    await page.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e && e.message); process.exit(1); });
