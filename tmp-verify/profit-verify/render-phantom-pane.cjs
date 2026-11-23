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
const has = await page.evaluate(() => typeof createAdminProfitPane === 'function' && typeof renderAdminProfit === 'function' && typeof loadAdminProfit === 'function');
console.log('functions present in live page:', has);
for (const [w, h, name] of [[360,640,'360'],[390,844,'390'],[414,896,'414'],[1440,900,'1440'],[1920,1080,'1920']]) {
  await page.setViewport({ width: w, height: h });
  const out = await page.evaluate((data, width) => {
    document.querySelectorAll('#pane-test-host').forEach(n => n.remove());
    const host = document.createElement('div');
    host.id = 'pane-test-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#05070a;overflow:auto;padding:8px;width:' + width + 'px;max-width:100vw;';
    document.body.appendChild(host);
    const pane = createAdminProfitPane();
    host.appendChild(pane);
    renderAdminProfit(pane, data);
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x:+r.x.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1) }; };
    const q = s => [...pane.querySelectorAll(s)];
    const overflow = [...host.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > host.clientWidth + 1 || r.left < -1); }).slice(0,5).map(el => el.tagName + ' ' + JSON.stringify(box(el)));
    return {
      pane: box(pane), hostScroll: host.scrollWidth, hostClient: host.clientWidth,
      wheels: q('[data-profit-wheels] > div').length,
      wheelLabels: q('[data-profit-wheels] .x, [data-profit-wheels] div[style*="uppercase"]').map(n=>n.textContent).slice(0,6),
      tiles: q('[data-profit-tiles] > div').length,
      tileValues: q('[data-profit-tiles] > div').map(t => (t.querySelector('div:nth-child(2)')||{}).textContent),
      bars: q('[data-profit-chart] > div').length,
      barHeights: q('[data-profit-chart] > div').map(b => b.getBoundingClientRect().height.toFixed(1)),
      status: (pane.querySelector('[data-profit-status]')||{}).textContent,
      clients: (pane.querySelector('[data-profit-clients]')||{}).textContent.slice(0,120),
      extra: (pane.querySelector('[data-profit-extra]')||{}).textContent.slice(0,160),
      overflow,
    };
  }, payload, w);
  console.log('\n### ' + name + 'x' + h + '\n' + JSON.stringify(out, null, 1));
  await page.screenshot({ path: 'phantom-pane-' + name + '.png' });
}
console.log('\nERRORS:', errs.length ? errs.slice(0,4) : 'none');
await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
