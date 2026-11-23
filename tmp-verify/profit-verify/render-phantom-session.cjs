(async () => {
const fs = require('fs');
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const payload = JSON.parse(fs.readFileSync('profit-bridge.json', 'utf8'));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://10.0.0.251:4000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));

const served = await page.evaluate(() => ({
  fns: typeof createAdminProfitPane === 'function' && typeof renderAdminProfit === 'function',
  patched: document.documentElement.innerHTML.includes('data-profit-session'),
}));
console.log('served page:', JSON.stringify(served));

async function render(data, w, h, label, waitMs) {
  await page.setViewport({ width: w, height: h });
  const out = await page.evaluate((d, width) => {
    document.querySelectorAll('#pane-test-host').forEach(n => n.remove());
    const host = document.createElement('div');
    host.id = 'pane-test-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#05070a;overflow:auto;padding:8px;width:' + width + 'px;max-width:100vw;';
    document.body.appendChild(host);
    const pane = createAdminProfitPane();
    host.appendChild(pane);
    renderAdminProfit(pane, d);
    const slot = pane.querySelector('[data-profit-session]');
    const overflow = [...host.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > host.clientWidth + 1 || r.left < -1); }).slice(0,4).map(el => { const r = el.getBoundingClientRect(); return el.tagName + ' w=' + r.width.toFixed(1) + ' right=' + r.right.toFixed(1); });
    return {
      sessionText: slot ? slot.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null,
      clock: (document.getElementById('phantom-profit-session-clock') || {}).textContent || null,
      overflow,
    };
  }, data, w);
  await new Promise(r => setTimeout(r, waitMs || 100));
  const clock2 = await page.evaluate(() => (document.getElementById('phantom-profit-session-clock') || {}).textContent || null);
  console.log('\n### ' + label + ' ' + w + 'x' + h + '\n' + JSON.stringify(out, null, 1) + '\nclock after wait: ' + JSON.stringify(clock2));
  await page.screenshot({ path: 'phantom-session-' + label + '-' + w + '.png' });
}

// 1. live server today: no session facts reported yet
await render(Object.assign({}, payload), 390, 844, 'nosession', 200);
// 2. with real-shaped session facts: counter must tick
const withSession = Object.assign({}, payload, { session: { email: 'owner@example.invalid', issuedAt: new Date(Date.now() - 4 * 3600 * 1000 - 125000).toISOString() } });
await render(withSession, 360, 640, 'live360', 2200);
await render(withSession, 1920, 1080, 'live1920', 200);

console.log('\nERRORS:', errs.length ? errs.slice(0, 4) : 'none');
await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
