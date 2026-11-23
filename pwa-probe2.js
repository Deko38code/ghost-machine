// Second probe: exactly what the Install pill does when clicked.
// Hooks the deferred beforeinstallprompt event and records whether prompt() is called,
// and diffs the visible fixed overlays before and after the click.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const URL = process.argv[2] || 'https://haksterai.com/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument(() => {
    window.__pwa = { bip: 0, promptCalls: 0, userChoice: null };
    const origAdd = window.addEventListener;
    window.addEventListener('beforeinstallprompt', (e) => {
      window.__pwa.bip += 1;
      // Wrap prompt() on the actual event object Chrome handed us
      try {
        const realPrompt = e.prompt.bind(e);
        e.prompt = function () {
          window.__pwa.promptCalls += 1;
          return realPrompt();
        };
      } catch (err) { window.__pwa.wrapError = String(err).slice(0, 100); }
    });
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const snap = () => page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' && s.position !== 'absolute' && s.position !== 'sticky') return false;
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      if (s.pointerEvents === 'none') return false;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 30) return false;
      return r.top < innerHeight && r.bottom > 0;
    });
    const seen = new Set();
    const list = [];
    for (const el of els) {
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      if (!t) continue;
      const key = el.className + '|' + t;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = el.getBoundingClientRect();
      list.push({ id: el.id || null, cls: String(el.className).slice(0, 60), text: t, z: getComputedStyle(el).zIndex, x: Math.round(r.x), y: Math.round(r.y) });
    }
    return list;
  });

  const before = await snap();
  const box = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button, a, [role=button]')).filter((e) => {
      const t = (e.textContent || '').trim().toLowerCase();
      if (!/install/.test(t) || t.length > 60) return false;
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const r = e.getBoundingClientRect();
      return r.width > 20 && r.height > 10;
    }).sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim(), tag: el.tagName, cls: String(el.className).slice(0, 60) };
  });

  if (!box) { console.log(JSON.stringify({ error: 'no install control found' }, null, 2)); await browser.close(); return; }

  await page.mouse.click(box.x, box.y);
  await new Promise((r) => setTimeout(r, 1800));

  const after = await snap();
  const seen = new Set(before.map((e) => e.cls + '|' + e.text));
  const appeared = after.filter((e) => !seen.has(e.cls + '|' + e.text));

  const pwa = await page.evaluate(() => window.__pwa);
  const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400));

  console.log(JSON.stringify({
    clicked: box,
    pwaEventState: pwa,
    overlaysBefore: before.length,
    newOverlaysAfter: appeared,
    bodyTextStart: bodyText,
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED:', e && e.message); process.exit(1); });
