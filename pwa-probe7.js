// Reproduce "pill shows but does nothing" with a real touch tap at phone size.
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const URL = process.argv[2] || 'https://haksterai.com/';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0,200)));
  await page.evaluateOnNewDocument(() => {
    window.__t = { ready: 0, done: 0, click: 0, bip: 0, errors: [] };
    window.addEventListener('error', e => window.__t.errors.push(String(e.message).slice(0,150)));
    window.addEventListener('hakster-install-ready', () => window.__t.ready++);
    window.addEventListener('hakster-install-done', () => window.__t.done++);
    window.addEventListener('beforeinstallprompt', () => window.__t.bip++);
  });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 }).catch(()=>{});
  await new Promise(r => setTimeout(r, 2500));

  const before = await page.evaluate(() => {
    const pill = document.getElementById('hakster-install-pill');
    const box = document.getElementById('hakster-install');
    return {
      pillPresent: !!pill, pillHidden: pill && pill.hidden,
      boxPresent: !!box, boxHidden: box && box.hidden,
      evt: !!(window.__haksterInstall && window.__haksterInstall.evt),
      traces: window.__t,
    };
  });

  const box = await page.evaluate(() => {
    const p = document.getElementById('hakster-install-pill');
    if (!p) return null;
    const b = p.getBoundingClientRect();
    return { x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2) };
  });
  if (!box) { console.log(JSON.stringify({ error: 'no pill', before }, null, 2)); await browser.close(); return; }

  // real touch tap
  await page.touchscreen.tap(box.x, box.y);
  await new Promise(r => setTimeout(r, 900));

  const after = await page.evaluate(() => {
    const pill = document.getElementById('hakster-install-pill');
    const b = document.getElementById('hakster-install');
    let disp = null, rect = null, topEl = null;
    if (b) {
      disp = getComputedStyle(b).display;
      const r = b.getBoundingClientRect();
      rect = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
      const e = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + r.height/2));
      topEl = e ? (e.id || e.tagName) : null;
    }
    return {
      pillHidden: pill && pill.hidden,
      cardHidden: b && b.hidden, cardDisplay: disp, cardRect: rect, cardTopAtCentre: topEl,
      cardText: b ? (b.innerText || '').replace(/\s+/g,' ').slice(0,140) : null,
      goHidden: (function(){const g=document.getElementById('hakster-install-go');return g&&g.hidden;})(),
      evt: !!(window.__haksterInstall && window.__haksterInstall.evt),
      traces: window.__t,
    };
  });
  console.log(JSON.stringify({ url: URL, before, tapAt: box, after, consoleErrors: errs.slice(0,6) }, null, 2));
  await browser.close();
})().catch(e => { console.error('FAILED:', e && e.message); process.exit(1); });
