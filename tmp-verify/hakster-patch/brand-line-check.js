// §18 check for the "a part of PhantomIDE" logo line + footer credit.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const VIEWPORTS = [
  [360, 640], [390, 844], [414, 896], [1440, 900], [1920, 1080],
];
const PAGES = ['/', '/plans', '/hack/', '/terminal/'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const out = [];
  for (const path of PAGES) {
    for (const [w, h] of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await page.goto('http://127.0.0.1:3579' + path, { waitUntil: 'networkidle2', timeout: 30000 });
      const m = await page.evaluate(() => {
        const txt = document.body.innerText;
        const brandLine = Array.from(document.querySelectorAll('header a span, #term-nav .brand span'))
          .find(el => /a part of\s*PhantomIDE/i.test(el.textContent || ''));
        const logo = document.querySelector('header a[href="/"] span, #term-nav .brand span');
        const r = el => el ? el.getBoundingClientRect().toJSON() : null;
        return {
          brandLine: brandLine ? brandLine.textContent.trim() : null,
          brandLineRect: r(brandLine),
          logoRect: r(logo),
          brandLineVisible: !!brandLine && !!brandLine.offsetParent && r(brandLine).height > 0,
          footerCredit: /Powered by\s*PhantomIDE\.com/i.test(txt),
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          headerRect: r(document.querySelector('header')),
          termNavRect: r(document.querySelector('#term-nav')),
          applet: (() => {
            const el = document.querySelector('[data-phantom-applet], #phantom-applet, .phantom-applet');
            return el ? r(el) : null;
          })(),
        };
      });
      m.page = path; m.viewport = w + 'x' + h;
      m.overflow = m.scrollW > m.innerW + 1;
      out.push(m);
      await page.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
