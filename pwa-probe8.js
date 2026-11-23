// Full chain with touch: tap pill, then tap the card's Install, and watch 4s for the outcome.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const URL = process.argv[2] || 'https://haksterai.com/';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args:['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.evaluateOnNewDocument(() => {
    window.__p = { promptCalls: 0, promptErr: null, choice: null, bip: 0 };
    window.addEventListener('beforeinstallprompt', (e) => {
      window.__p.bip++;
      const real = e.prompt ? e.prompt.bind(e) : null;
      if (real) e.prompt = function () { window.__p.promptCalls++; try { return real(); } catch(err){ window.__p.promptErr = String(err).slice(0,160); throw err; } };
      else window.__p.promptErr = 'no prompt() on event';
      try { if (e.userChoice && e.userChoice.then) e.userChoice.then(c => { window.__p.choice = c && c.outcome; }); } catch(_){}
    });
  });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 }).catch(()=>{});
  await new Promise(r=>setTimeout(r,2500));

  const tapId = async (id) => {
    const b = await page.evaluate((i) => { const el = document.getElementById(i); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }; }, id);
    if (!b) return null;
    await page.touchscreen.tap(b.x, b.y);
    return b;
  };
  const pillTap = await tapId('hakster-install-pill');
  await new Promise(r=>setTimeout(r,700));
  const cardState = await page.evaluate(() => { const c = document.getElementById('hakster-install'); return c ? { hidden: c.hidden, text: c.innerText.replace(/\s+/g,' ').slice(0,140), goHidden: (document.getElementById('hakster-install-go')||{}).hidden } : null; });
  const goTap = await tapId('hakster-install-go');
  await new Promise(r=>setTimeout(r,4000));
  const final = await page.evaluate(() => {
    const c = document.getElementById('hakster-install'); const p = document.getElementById('hakster-install-pill');
    return { cardHidden: c && c.hidden, cardText: c ? c.innerText.replace(/\s+/g,' ').slice(0,180) : null,
             pillHidden: p && p.hidden, state: window.__p };
  });
  console.log(JSON.stringify({ url: URL, pillTap, cardState, goTap, final }, null, 2));
  await browser.close();
})().catch(e => { console.error('FAILED:', e && e.message); process.exit(1); });
