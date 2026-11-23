// Verifies the landing-page marketplace cards: live plans from /api/stripe/plans,
// catalog chips, site-market card, and §18 layout at five viewports.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

(async () => {
  const api = await (await fetch('http://localhost:3579/api/stripe/plans')).json();
  const liveNames = api.plans.map((p) => p.name);
  const liveAmounts = new Set();
  for (const p of api.plans) for (const pr of (p.prices || [])) if (pr.amount > 0) liveAmounts.add('$' + (pr.amount / 100).toFixed(2).replace(/\.00$/, ''));

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost/tmp-verify/chrome-market-' + Date.now(),
  });
  const out = { livePlansFromApi: liveNames, viewports: {} };

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('https://haksterai.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.querySelectorAll('#mk-plans > div').length >= 2, { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));

    const data = await page.evaluate(() => {
      const section = document.getElementById('marketplace');
      const applet = document.getElementById('phantom-server-applet');
      const names = [...document.querySelectorAll('#mk-plans h3')].map((h) => h.textContent.trim());
      const prices = [...document.querySelectorAll('#mk-plans .text-xl')].map((h) => h.textContent.trim());
      const buttons = [...document.querySelectorAll('#mk-plans button')].map((b) => b.textContent.trim());
      const chips = [...document.querySelectorAll('#mk-catalog li')].map((li) => li.textContent.trim());
      const market = (document.getElementById('mk-listings') || {}).textContent.trim().slice(0, 120);
      const msg = document.getElementById('mk-msg');
      const rect = section.getBoundingClientRect();
      const cs = getComputedStyle(section);
      let widest = null;
      if (section) {
        for (const el of section.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 1 || r.left < -1)) {
            if (!widest || r.width > widest.width) widest = { tag: el.tagName, cls: String(el.className).slice(0, 60), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
          }
        }
      }
      const ar = applet ? applet.getBoundingClientRect() : null;
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        sectionLeft: Math.round(rect.left),
        sectionRightGap: Math.round(innerWidth - rect.right),
        sectionPadLeft: cs.paddingLeft,
        sectionPadRight: cs.paddingRight,
        sectionPadBottom: cs.paddingBottom,
        widest,
        planCount: names.length,
        names,
        prices,
        buttons,
        chips,
        market,
        msgShown: msg ? msg.className : null,
        applet: ar ? { left: Math.round(ar.left), right: Math.round(ar.right), top: Math.round(ar.top), bottom: Math.round(ar.bottom), w: Math.round(ar.width), h: Math.round(ar.height) } : null,
      };
    });

    // scroll the section into view to confirm the applet never sits over it
    await page.evaluate(() => document.getElementById('marketplace').scrollIntoView({ block: 'end' }));
    await new Promise((r) => setTimeout(r, 400));
    const atBottom = await page.evaluate(() => {
      const section = document.getElementById('marketplace').getBoundingClientRect();
      const applet = document.getElementById('phantom-server-applet');
      const ar = applet ? applet.getBoundingClientRect() : null;
      const lastCard = [...document.querySelectorAll('#mk-plans > div')].pop();
      const lr = lastCard ? lastCard.getBoundingClientRect() : null;
      const inner = document.querySelector('#mk-listings')?.getBoundingClientRect();
      return {
        appletBottomGap: ar ? Math.round(innerHeight - ar.bottom) : null,
        appletRightGap: ar ? Math.round(innerWidth - ar.right) : null,
        sectionBottomVisible: Math.round(innerHeight - section.bottom),
        lastPlanBottom: lr ? Math.round(lr.bottom) : null,
        listingsBottom: inner ? Math.round(inner.bottom) : null,
        viewportH: innerHeight,
      };
    });

    out.viewports[vp.name] = { ...data, atBottom, consoleErrors };
    await page.screenshot({ path: '/home/ghost/tmp-verify/market-' + vp.name + '.png', fullPage: false });
    await page.close();
  }

  // price honesty: every rendered paid amount must exist live in the API
  const rendered = new Set();
  for (const v of Object.values(out.viewports)) for (const p of v.prices) if (p.startsWith('$')) rendered.add(p);
  out.renderedPaidAmounts = [...rendered];
  out.livePaidAmounts = [...liveAmounts];
  out.pricesAllFromLiveApi = [...rendered].every((p) => liveAmounts.has(p));
  out.namesAllFromLiveApi = Object.values(out.viewports)[0].names.every((n) => liveNames.includes(n));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
