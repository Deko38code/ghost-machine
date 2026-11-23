// Focused check: is the admin pin gate (z 1000) or any admin overlay covering the page / pill?
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['https://haksterai.com/'];

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  for (const url of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const r = { url };
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
      await new Promise((res) => setTimeout(res, 1500));
      r.data = await page.evaluate(() => {
        const d = {};
        const gate = document.getElementById('admin-pin-gate');
        if (gate) {
          const s = getComputedStyle(gate);
          const b = gate.getBoundingClientRect();
          d.pinGate = {
            display: s.display, visibility: s.visibility, z: s.zIndex,
            hiddenAttr: gate.hasAttribute('hidden'),
            coversViewport: s.display !== 'none' && s.visibility !== 'hidden' && b.width >= innerWidth * 0.9,
          };
        } else d.pinGate = 'not present in DOM';

        // Anything fixed with a z-index of 900 or more that is actually painted
        d.highZOverlays = Array.from(document.querySelectorAll('body *')).filter((el) => {
          const s = getComputedStyle(el);
          if (s.position !== 'fixed' && s.position !== 'sticky') return false;
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
          const z = parseInt(s.zIndex, 10);
          if (!(z >= 900)) return false;
          const b = el.getBoundingClientRect();
          return b.width > 40 && b.height > 20;
        }).map((el) => {
          const b = el.getBoundingClientRect();
          return { id: el.id || null, cls: String(el.className).slice(0, 40), z: getComputedStyle(el).zIndex, at: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] };
        });

        d.manifestLink = !!document.querySelector('link[rel=manifest]');
        d.hasPill = !!document.getElementById('hakster-install-pill');
        d.bodyScrollLocked = getComputedStyle(document.body).overflow;
        return d;
      });
    } catch (e) { r.error = String(e).slice(0, 120); }
    out.push(r);
    await page.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e && e.message); process.exit(1); });
