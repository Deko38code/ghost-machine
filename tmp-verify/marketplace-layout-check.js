// §18 layout check for the landing-page marketplace cards.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-mklayout-' + Date.now(),
  });
  const out = {};
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/CORS|ERR_FAILED/.test(m.text())) errs.push(m.text().slice(0, 120)); });
    page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 120)));
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll('#mk-plans > div').length >= 2, { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    const top = await page.evaluate(() => {
      const grid = document.getElementById('mk-plans');
      const g = grid.getBoundingClientRect();
      const section = document.getElementById('marketplace');
      const cs = getComputedStyle(section);
      let widest = null;
      for (const el of section.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > document.documentElement.clientWidth + 1 || r.left < -1)) {
          if (!widest || r.width > widest.width) widest = { tag: el.tagName, cls: String(el.className).slice(0, 50), left: Math.round(r.left), right: Math.round(r.right) };
        }
      }
      return {
        gutterLeft: Math.round(g.left),
        gutterRight: Math.round(document.documentElement.clientWidth - g.right),
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        padB: cs.paddingBottom,
        appletVar: getComputedStyle(document.documentElement).getPropertyValue('--phantom-applet-h').trim(),
        widest,
      };
    });

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await new Promise((r) => setTimeout(r, 800));
    const bottom = await page.evaluate(() => {
      const applet = document.getElementById('phantom-server-applet');
      const mode = applet.dataset.mode;
      const sel = mode === 'chip' ? '.psa-chip' : mode === 'tab' ? '.psa-tab' : mode === 'ring' ? '.psa-start' : mode === 'hidden' ? null : '.psa-card';
      const visible = sel ? applet.querySelector(sel) : null;
      const vr = visible && getComputedStyle(applet).display !== 'none' ? visible.getBoundingClientRect() : null;
      const listings = document.getElementById('mk-listings').getBoundingClientRect();
      const section = document.getElementById('marketplace').getBoundingClientRect();
      return {
        mode,
        appletVisibleTop: vr ? Math.round(vr.top) : null,
        appletVisibleLeft: vr ? Math.round(vr.left) : null,
        appletVisibleRight: vr ? Math.round(vr.right) : null,
        appletBottomGap: vr ? Math.round(innerHeight - vr.bottom) : null,
        sectionBottomInView: Math.round(innerHeight - section.bottom),
        listingsBottom: Math.round(listings.bottom),
        contentClearOfApplet: vr ? listings.bottom <= vr.top || listings.right <= vr.left : null,
        scrolledToEnd: Math.round(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 2,
      };
    });
    await page.screenshot({ path: '/home/ghost/tmp-verify/mklayout-' + vp.name + '.png' });
    out[vp.name] = { top, bottom, errs };
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
