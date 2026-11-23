// Fourth probe: is anything admin-related covering the install pill?
// For each page: pill presence + hit-test, admin pin gate state, every element painted over
// the pill's centre point, and installability errors.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');

const PAGES = process.argv.slice(2);
if (!PAGES.length) PAGES.push('https://haksterai.com/');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const results = [];

  for (const url of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const r = { url };
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
      await new Promise((res) => setTimeout(res, 1800));

      const cdp = await page.createCDPSession();
      await cdp.send('Page.enable');
      try {
        const ie = await cdp.send('Page.getInstallabilityErrors');
        r.installabilityErrors = (ie.installabilityErrors || []).map((e) => e.errorId || e);
      } catch (e) { r.installabilityErrors = ['query failed']; }

      r.info = await page.evaluate(() => {
        const out = { status: document.readyState };

        // admin pin gate
        const gate = document.getElementById('admin-pin-gate');
        if (gate) {
          const s = getComputedStyle(gate);
          out.pinGate = { display: s.display, visibility: s.visibility, z: s.zIndex, covers: s.display !== 'none' };
        } else out.pinGate = null;

        // the install control
        const pill = Array.from(document.querySelectorAll('button, a, [role=button]')).filter((e) => {
          const t = (e.textContent || '').trim().toLowerCase();
          if (!/install/.test(t) || t.length > 60) return false;
          const s = getComputedStyle(e);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
          const b = e.getBoundingClientRect();
          return b.width > 20 && b.height > 10;
        }).sort((a, b) => a.textContent.length - b.textContent.length)[0];

        if (!pill) { out.pill = { found: false }; return out; }

        const b = pill.getBoundingClientRect();
        const cx = Math.round(b.left + b.width / 2);
        const cy = Math.round(b.top + b.height / 2);
        const stack = document.elementsFromPoint(cx, cy).slice(0, 5).map((el) => ({
          tag: el.tagName,
          id: el.id || null,
          cls: String(el.className || '').split(' ').slice(0, 2).join(' '),
          z: getComputedStyle(el).zIndex,
        }));
        out.pill = {
          found: true,
          text: (pill.textContent || '').trim().slice(0, 40),
          z: getComputedStyle(pill).zIndex,
          rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
          topmostAtCentre: stack[0],
          stack,
          reachable: !!(stack[0] && (stack[0].tag === pill.tagName && (stack[0].id === (pill.id || null)))),
        };
        return out;
      });
    } catch (e) {
      r.error = String(e).slice(0, 160);
    }
    results.push(r);
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED:', e && e.message); process.exit(1); });
