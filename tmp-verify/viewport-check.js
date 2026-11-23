const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const URL = process.argv[2] || 'https://haksterai.com/admin/live-stats/';
const viewports = [
  { w: 360, h: 640, name: '360x640 phone' },
  { w: 390, h: 844, name: '390x844 phone' },
  { w: 414, h: 896, name: '414x896 phone' },
  { w: 1440, h: 900, name: '1440x900 desktop' },
  { w: 1920, h: 1080, name: '1920x1080 TV' },
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let bad = 0;
  for (const v of viewports) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    await page.setJavaScriptEnabled(false); // the owner gate redirects otherwise; CSS layout still measures
    await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const r = await page.evaluate(() => {
      const doc = document.documentElement;
      const wrap = document.querySelector('.ls-wrap');
      const pill = document.querySelector('a[href*="phantomide.com"]');
      const box = wrap ? wrap.getBoundingClientRect() : null;
      const pb = pill ? pill.getBoundingClientRect() : null;
      return {
        scrollW: doc.scrollWidth, innerW: window.innerWidth,
        wrapLeft: box ? Math.round(box.left + parseFloat(getComputedStyle(wrap).paddingLeft)) : null,
        wrapRight: box ? Math.round(window.innerWidth - box.right + parseFloat(getComputedStyle(wrap).paddingRight)) : null,
        title: (document.querySelector('.ls-title') || {}).textContent || '',
        pillText: pill ? pill.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : 'MISSING',
        pillInside: pb ? (pb.left >= 0 && pb.right <= window.innerWidth + 0.5) : false,
      };
    });
    const ok = r.scrollW <= r.innerW && r.pillInside && !errs.length && (r.wrapLeft === null || r.wrapLeft >= 16);
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${v.name}: scrollW ${r.scrollW}/${r.innerW} · gutter L ${r.wrapLeft} R ${r.wrapRight} · title "${r.title}" · pill "${r.pillText}" ${r.pillInside ? 'inside' : 'OVERFLOW'}${errs.length ? ' · JS errors: ' + errs.join('; ') : ''}`);
    await page.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(2); });
