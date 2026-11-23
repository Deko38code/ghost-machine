// Checks the Stripe billing-portal links render on /plans, / and /marketplace/
// and that the new panel fits at the §18 viewports.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const URL_ = 'https://billing.stripe.com/p/login/fZu3cv4lqaqncMIauIbMQ00';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-billing-' + Date.now(),
  });
  const out = {};

  // /plans at each §18 viewport
  for (const vp of [{ n: '360x640', w: 360, h: 640 }, { n: '390x844', w: 390, h: 844 }, { n: '414x896', w: 414, h: 896 }, { n: '1440x900', w: 1440, h: 900 }, { n: '1920x1080', w: 1920, h: 1080 }]) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    await page.goto('https://haksterai.com/plans', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1200));
    const m = await page.evaluate((u) => {
      const links = [...document.querySelectorAll('a')].filter((a) => a.href === u);
      const panelLink = links.find((a) => a.textContent.includes('Open the billing portal'));
      const r = panelLink ? panelLink.getBoundingClientRect() : null;
      const panel = panelLink ? panelLink.closest('div.rounded-2xl') : null;
      const pr = panel ? panel.getBoundingClientRect() : null;
      return {
        linkCount: links.length,
        label: panelLink ? panelLink.textContent.trim() : null,
        target: panelLink ? panelLink.target : null,
        rel: panelLink ? panelLink.rel : null,
        linkInViewport: r ? r.left >= 0 && r.right <= innerWidth : null,
        linkBox: r ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null,
        panelText: panel ? panel.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
        panelInViewport: pr ? pr.left >= 0 && pr.right <= innerWidth : null,
        gutterLeft: pr ? Math.round(pr.left) : null,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      };
    }, URL_);
    out['plans-' + vp.n] = { ...m, errs };
    await page.screenshot({ path: '/home/ghost/tmp-verify/billing-plans-' + vp.n + '.png', fullPage: false });
    await page.close();
  }

  // landing + marketplace mini app
  for (const path of ['/', '/marketplace/']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('https://haksterai.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1500));
    out[path] = await page.evaluate((u) => {
      const a = [...document.querySelectorAll('a')].find((x) => x.href === u);
      if (!a) return { found: false };
      a.scrollIntoView({ block: 'center' });
      const r = a.getBoundingClientRect();
      return {
        found: true,
        text: a.textContent.trim(),
        target: a.target,
        rel: a.rel,
        color: getComputedStyle(a).color,
        visible: r.width > 0 && r.height > 0,
        box: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      };
    }, URL_);
    await page.screenshot({ path: '/home/ghost/tmp-verify/billing-' + (path === '/' ? 'landing' : 'marketplace') + '.png' });
    await page.close();
  }

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
