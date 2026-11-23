const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const VIEWPORTS = [
  { w: 360, h: 640, label: 'phone-360' }, { w: 390, h: 844, label: 'phone-390' },
  { w: 414, h: 896, label: 'phone-414' }, { w: 1440, h: 900, label: 'desktop-1440' },
  { w: 1920, h: 1080, label: 'tv-1920' },
];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-lb-' + Date.now() });
  const out = {};
  for (const vp of VIEWPORTS) {
    const p = await b.newPage();
    await p.setViewport({ width: vp.w, height: vp.h });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    out[vp.label] = await p.evaluate(async () => {
      currentUser = { email: 'preview@example.com' };
      await showPricing();
      await new Promise(r => setTimeout(r, 1200));
      const grid = document.querySelector('#pricing-modal .modal div[style*="grid-template-columns"]');
      const cards = grid ? [...grid.children] : [];
      const rows = cards.map(c => {
        const title = (c.querySelector('div') || {}).textContent || '';
        const priceEl = c.querySelectorAll('div')[1];
        const price = priceEl ? priceEl.textContent.trim() : '';
        const btn = c.querySelector('button');
        return { title, price, button: btn ? btn.textContent.trim() : '(no button)', disabled: btn ? btn.disabled : null };
      });
      return { cards: rows.filter(r => /pack|free|try me|low budget|team/i.test(r.title)),
        docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth };
    });
    await p.screenshot({ path: `/home/ghost/tmp-verify/lowbudget-${vp.label}.png` });
    await p.close();
  }
  const p2 = await b.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await p2.goto('https://haksterai.com/plans', { waitUntil: 'networkidle2', timeout: 60000 });
  await p2.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  out['plans-1440'] = await p2.evaluate(() => {
    const cards = [...document.querySelectorAll('div')].filter(d => d.querySelector('h2') && d.querySelector('button'));
    const rows = cards.slice(0, 30).map(d => ({ title: (d.querySelector('h2').textContent || '').trim(), buttons: [...d.querySelectorAll('button')].map(x => x.textContent.trim()) }));
    return { rows: rows.filter(r => /pack|free|try me|low budget|team/i.test(r.title)), docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth };
  });
  await p2.close();
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
