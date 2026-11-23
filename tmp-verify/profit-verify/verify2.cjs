(async () => {
const { DatabaseSync } = require('node:sqlite');
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const db = new DatabaseSync('/home/ghost/haksterAi/data/hakster.db', { readOnly: true });
const owner = db.prepare("select api_key from users where email like 'dek%' and api_key is not null limit 1").get();
const BASE = 'http://127.0.0.1:3579';
const VPS = [[360,640,'phone-360'],[390,844,'phone-390'],[414,896,'phone-414'],[1440,900,'desktop-1440'],[1920,1080,'tv-1920']];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(k => { localStorage.setItem('hakster_api_key', k); localStorage.setItem('hakster_google_token', k); }, owner.api_key);
// first run: set a PIN in this throwaway profile only
async function pinRound() {
  const keys = await page.$$('[data-admin-pin-key]');
  const byKey = {};
  for (const el of keys) byKey[await el.evaluate(n => n.getAttribute('data-admin-pin-key'))] = el;
  for (const d of ['1','2','3','4','5','6']) { await byKey[d].click(); await new Promise(r => setTimeout(r, 60)); }
  await new Promise(r => setTimeout(r, 400));
}
await page.setViewport({ width: 390, height: 844 });
await page.goto(BASE + '/admin/profit', { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise(r => setTimeout(r, 700));
for (let i = 0; i < 3; i++) {
  const st = await page.evaluate(() => ({ hidden: document.getElementById('admin-pin-gate')?.getAttribute('aria-hidden'), sub: document.getElementById('admin-pin-subtitle')?.textContent, err: document.getElementById('admin-pin-error')?.textContent }));
  console.log('pin state', i, JSON.stringify(st));
  if (st.hidden === 'true') break;
  await pinRound();
}
await new Promise(r => setTimeout(r, 1200));
for (const [w,h,name] of VPS) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 400));
  const out = await page.evaluate(() => {
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x:+r.x.toFixed(1), y:+r.y.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1) }; };
    const q = s => [...document.querySelectorAll(s)];
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && cs.visibility !== 'hidden'; };
    const bars = q('.pl-bar').map(b => ({ h: b.getBoundingClientRect().height.toFixed(1), title: b.getAttribute('title') }));
    const overflow = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.right > window.innerWidth + 1 || r.left < -1); }).slice(0,5).map(el => el.tagName + '.' + String(el.className).slice(0,30));
    const gate = document.getElementById('admin-pin-gate');
    return {
      gateHidden: gate?.getAttribute('aria-hidden'),
      pageState: document.documentElement.getAttribute('data-admin-page'),
      status: document.getElementById('pl-status')?.textContent,
      contentVisible: vis(document.querySelector('.pl-wrap')),
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
      wrap: box(document.querySelector('.pl-wrap')),
      wheelBoxes: q('.pl-wheel').map(box), tileBoxes: q('.pl-tile').map(box).slice(0,3),
      chart: box(document.getElementById('pl-chart')), bars, overflow,
      tallestBar: bars.map(b => +b.h).sort((a,b)=>b-a)[0],
    };
  });
  console.log('\n### ' + name + ' ' + w + 'x' + h + '\n' + JSON.stringify(out));
  await page.screenshot({ path: 'v2-' + name + '.png', fullPage: name.startsWith('phone') ? false : false });
}
console.log('\nERRORS:', errs.length ? errs : 'none');
await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
