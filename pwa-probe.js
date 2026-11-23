// Read-only PWA probe for haksterai.com. Launches headless Chromium, loads the live site,
// and reports what the browser actually sees: service worker state, manifest, installability
// errors, whether the install pill renders and is hit-testable, and what a click does.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');

const URL = process.argv[2] || 'https://haksterai.com/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 160)));

  const bip = [];
  await page.evaluateOnNewDocument(() => {
    window.__bipFired = 0;
    window.addEventListener('beforeinstallprompt', () => { window.__bipFired += 1; });
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const cdp = await page.createCDPSession();
  await cdp.send('Page.enable');

  const out = { url: URL };

  // Manifest as the browser parsed it
  try {
    const m = await cdp.send('Page.getAppManifest');
    out.manifest = { url: m.url, errors: (m.errors || []).map((e) => e.message || e), parsed: !!m.parsed };
  } catch (e) { out.manifest = { error: String(e).slice(0, 120) }; }

  // Installability verdict
  try {
    const r = await cdp.send('Page.getInstallabilityErrors');
    out.installabilityErrors = (r.installabilityErrors || []).map((e) => e.errorId || e);
  } catch (e) { out.installabilityErrors = ['could not query: ' + String(e).slice(0, 100)]; }

  out.sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const reg = await navigator.serviceWorker.getRegistration('/');
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      supported: true,
      scope: reg && reg.scope,
      activeScript: reg && reg.active && reg.active.scriptURL,
      state: reg && reg.active && reg.active.state,
      controller: !!navigator.serviceWorker.controller,
      registrationCount: regs.length,
      registrations: regs.map((r) => r.scope),
    };
  });

  out.beforeinstallpromptFired = await page.evaluate(() => window.__bipFired);
  out.standalone = await page.evaluate(() =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

  // The install pill
  out.pill = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const t = (el.textContent || '').trim().toLowerCase();
      if (!t || t.length > 60) return false;
      if (!/install/.test(t)) return false;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 10;
    });
    const pill = candidates.sort((a, b) => (a.textContent.length - b.textContent.length))[0];
    if (!pill) return { found: false };
    const r = pill.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return {
      found: true,
      text: (pill.textContent || '').trim().slice(0, 60),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      zIndex: getComputedStyle(pill).zIndex,
      pointerEvents: getComputedStyle(pill).pointerEvents,
      hitTestReachesPill: !!(hit && (hit === pill || pill.contains(hit))),
      hitTag: hit ? hit.tagName + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : null,
      inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
    };
  });

  // What a click actually does
  if (out.pill.found) {
    const box = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('body *')).filter((e) => {
        const t = (e.textContent || '').trim().toLowerCase();
        const s = getComputedStyle(e);
        if (!/install/.test(t) || t.length > 60) return false;
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        return r.width > 20 && r.height > 10;
      }).sort((a, b) => a.textContent.length - b.textContent.length)[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (box) {
      await page.mouse.click(box.x, box.y);
      await new Promise((r) => setTimeout(r, 1200));
      out.afterClick = await page.evaluate(() => {
        const vis = Array.from(document.querySelectorAll('body *')).filter((el) => {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 120 || r.height < 60) return false;
          const t = (el.textContent || '').trim();
          return /install|add to home|menu|share/i.test(t) && t.length < 600;
        });
        const seen = new Set();
        return vis.map((el) => {
          const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200);
          return t;
        }).filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; }).slice(0, 4);
      });
    }
  }

  out.consoleErrors = consoleErrors.slice(0, 8);
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED:', e && e.message); process.exit(1); });
