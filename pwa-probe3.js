// Third probe: click the pill, then the card's own Install button, and measure whether
// the deferred beforeinstallprompt event's prompt() is actually invoked and what userChoice says.
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
    window.__pwa = { bip: 0, promptCalls: 0, promptThrew: null, userChoice: null, eventType: null };
    window.addEventListener('beforeinstallprompt', (e) => {
      window.__pwa.bip += 1;
      window.__pwa.eventType = e.constructor && e.constructor.name;
      try {
        const realPrompt = e.prompt ? e.prompt.bind(e) : null;
        if (realPrompt) {
          e.prompt = function () {
            window.__pwa.promptCalls += 1;
            const p = realPrompt();
            Promise.resolve(p).then(
              () => { window.__pwa.promptResolved = true; },
              (err) => { window.__pwa.promptThrew = String(err).slice(0, 160); }
            );
            return p;
          };
        } else {
          window.__pwa.promptThrew = 'event has no prompt()';
        }
      } catch (err) { window.__pwa.promptThrew = 'wrap failed: ' + String(err).slice(0, 120); }
    });
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const clickByText = async (selector, wanted, exact) => {
    const box = await page.evaluate((sel, want, ex) => {
      const els = Array.from(document.querySelectorAll(sel)).filter((e) => {
        const t = (e.textContent || '').trim();
        const ok = ex ? t === want : t.toLowerCase().includes(String(want).toLowerCase());
        if (!ok) return false;
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        const r = e.getBoundingClientRect();
        return r.width > 10 && r.height > 10;
      });
      const el = els[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim().slice(0, 40), tag: el.tagName };
    }, selector, wanted, exact);
    if (!box) return null;
    await page.mouse.click(box.x, box.y);
    return box;
  };

  const pill = await clickByText('button', 'Install app', false);
  await new Promise((r) => setTimeout(r, 900));

  const cardVisible = await page.evaluate(() => {
    const c = document.getElementById('hakster-install');
    if (!c) return false;
    const s = getComputedStyle(c);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
  });

  let cardButton = null;
  if (cardVisible) {
    cardButton = await page.evaluate(() => {
      const card = document.getElementById('hakster-install');
      if (!card) return null;
      const btns = Array.from(card.querySelectorAll('button, a'));
      return btns.map((b) => ({ text: (b.textContent || '').trim().slice(0, 30), tag: b.tagName }));
    });
    await clickByText('#hakster-install button', 'Install', true);
  }
  await new Promise((r) => setTimeout(r, 2000));

  const state = await page.evaluate(() => window.__pwa);
  console.log(JSON.stringify({
    pillClicked: pill,
    cardVisible,
    cardButtons: cardButton,
    pwaEventState: state,
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error('PROBE FAILED:', e && e.message); process.exit(1); });
