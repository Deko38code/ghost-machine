const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');

const VIEWPORTS = [
  { w: 360, h: 640,  label: 'phone-360' },
  { w: 390, h: 844,  label: 'phone-390' },
  { w: 414, h: 896,  label: 'phone-414' },
  { w: 1440, h: 900, label: 'desktop-1440' },
  { w: 1920, h: 1080, label: 'tv-1920' },
];

(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-fc-' + Date.now() });
  const out = {};
  for (const vp of VIEWPORTS) {
    const p = await b.newPage();
    await p.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    // Simulate a signed-in free user so the billing modal opens.
    const result = await p.evaluate(async () => {
      currentUser = { email: 'preview@example.com', name: 'Preview' };
      await showPricing();
      await new Promise(r => setTimeout(r, 800));
      const grid = document.querySelector('#pricing-modal .modal div[style*="grid-template-columns"]');
      const cards = grid ? [...grid.children] : [];
      const free = cards.filter(c => c.textContent.includes('$0.00'));
      return {
        cardCount: cards.length,
        freeCount: free.length,
        freeTitles: free.map(c => (c.querySelector('div') || {}).textContent || ''),
        freeFeatures: free.map(c => [...c.querySelectorAll('li')].map(li => li.textContent.replace(/^✓\s*/, ''))),
        hasMiniforgeFree: document.querySelector('#pricing-modal').textContent.includes('Miniforge Free'),
        docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      };
    });
    out[vp.label] = result;
    await p.screenshot({ path: `/home/ghost/tmp-verify/free-cards-${vp.label}.png`, fullPage: false });
    await p.close();
  }
  // /plans page: one free card, Miniforge stated on it.
  const p2 = await b.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await p2.goto('https://haksterai.com/plans', { waitUntil: 'networkidle2', timeout: 60000 });
  await p2.evaluate(() => new Promise(r => setTimeout(r, 1500)));
  const plansPage = await p2.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasMiniforgeFree: text.includes('Miniforge Free'),
      haksterFreeCount: (text.match(/HaksterAI Free/g) || []).length,
      hasMiniforgeLine: text.includes('10 free Miniforge messages/day'),
      docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
    };
  });
  out['plans-1440'] = plansPage;
  await p2.screenshot({ path: '/home/ghost/tmp-verify/free-cards-plans-1440.png', fullPage: false });
  await p2.close();
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
