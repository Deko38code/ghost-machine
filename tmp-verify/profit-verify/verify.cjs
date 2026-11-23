(async()=>{
const { DatabaseSync } = require('node:sqlite');
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const db = new DatabaseSync('/home/ghost/haksterAi/data/hakster.db', { readOnly: true });
const owner = db.prepare("select api_key from users where email like 'dek%' and api_key is not null limit 1").get();
if (!owner) { console.log('no owner key'); process.exit(1); }
const URL_BASE = 'http://127.0.0.1:3579';
const VIEWPORTS = [
  { w: 360, h: 640, name: 'phone-360' },
  { w: 390, h: 844, name: 'phone-390' },
  { w: 414, h: 896, name: 'phone-414' },
  { w: 1440, h: 900, name: 'desktop-1440' },
  { w: 1920, h: 1080, name: 'tv-1920' },
];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL_BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate((k) => { localStorage.setItem('hakster_api_key', k); localStorage.setItem('hakster_google_token', k); }, owner.api_key);
for (const v of VIEWPORTS) {
  await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });
  await page.goto(URL_BASE + '/admin/profit', { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('pl-status');
    return s && (/LIVE/.test(s.textContent) || /Unavailable/.test(s.textContent) || /required/.test(s.textContent));
  }, { timeout: 25000 }).catch(() => {});
  const out = await page.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    const q = (s) => [...document.querySelectorAll(s)];
    const wheels = q('.pl-wheel');
    const tiles = q('.pl-tile');
    const overflowEls = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
    }).slice(0, 6).map((el) => el.tagName + '.' + (el.className || '').toString().slice(0, 40) + ' ' + JSON.stringify(box(el)));
    return {
      status: (document.getElementById('pl-status') || {}).textContent,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      docHeight: document.documentElement.scrollHeight,
      wheels: wheels.length,
      wheelDash: wheels.map((w) => (w.querySelector('circle:nth-child(2)') || {}).getAttribute && w.querySelector('circle:nth-child(2)').getAttribute('stroke-dasharray')),
      wheelText: wheels.map((w) => (w.querySelector('text') || {}).textContent),
      wheelLabels: wheels.map((w) => (w.querySelector('.lbl') || {}).textContent),
      tiles: tiles.map((t) => ((t.querySelector('.k') || {}).textContent) + ' = ' + ((t.querySelector('.v') || {}).textContent)),
      tileBoxes: tiles.slice(0, 2).map(box),
      firstWheelBox: box(wheels[0]),
      chartBars: q('.pl-bar').length,
      chartBox: box(document.getElementById('pl-chart')),
      phantomBadge: (document.querySelector('#pl-phantom .pl-badge') || {}).textContent,
      junkBadge: (document.querySelector('#pl-junkalot .pl-badge') || {}).textContent,
      foot: (document.getElementById('pl-foot') || {}).textContent.slice(0, 120),
      overflowEls,
    };
  });
  console.log('\n### ' + v.name + ' ' + v.w + 'x' + v.h);
  console.log(JSON.stringify(out, null, 1));
  await page.screenshot({ path: 'shot-' + v.name + '.png', fullPage: false });
}
console.log('\nPAGE ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

})().catch(e=>{console.error('FAIL',e);process.exit(1);});
