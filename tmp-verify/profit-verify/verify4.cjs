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
  const st = await page.evaluate(() => ({ hidden: document.getElementById('admin-pin-gate')?.getAttribute('aria-hidden') }));
  if (st.hidden === 'true') break;
  await pinRound();
}
await new Promise(r => setTimeout(r, 1500));

// Counter must actually tick forward off the real sign-in time.
const c1 = await page.evaluate(() => document.getElementById('pl-session-clock')?.textContent);
await new Promise(r => setTimeout(r, 2200));
const c2 = await page.evaluate(() => document.getElementById('pl-session-clock')?.textContent);
console.log('SESSION CLOCK:', JSON.stringify(c1), '->', JSON.stringify(c2), c1 && c2 && c1 !== c2 ? 'TICKING' : 'NOT TICKING');

for (const [w,h,name] of VPS) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 400));
  const out = await page.evaluate(() => {
    const q = s => [...document.querySelectorAll(s)];
    const path = el => { const bits = []; let n = el; for (let i = 0; i < 4 && n && n.tagName; i++) { bits.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0,3).join('.') : '')); n = n.parentElement; } return bits.join(' > '); };
    const overflow = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.right > window.innerWidth + 1 || r.left < -1); }).slice(0,6).map(el => { const r = el.getBoundingClientRect(); return { path: path(el), right: +r.right.toFixed(1), left: +r.left.toFixed(1), w: +r.width.toFixed(1), html: el.outerHTML.slice(0,140), text: String(el.textContent||"").trim().slice(0,40) }; });
    const sess = document.getElementById('pl-session');
    return {
      session: sess ? sess.textContent.replace(/\s+/g,' ').trim().slice(0, 220) : null,
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
      overflow,
    };
  });
  console.log('\n### ' + name + ' ' + w + 'x' + h + '\n' + JSON.stringify(out, null, 1));
  await page.screenshot({ path: 'v3-' + name + '.png' });
}
console.log('\nERRORS:', errs.length ? errs : 'none');
await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
