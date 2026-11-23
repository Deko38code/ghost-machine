const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const VIEWPORTS = [
  { w: 360, h: 640, label: 'phone-360' }, { w: 390, h: 844, label: 'phone-390' },
  { w: 414, h: 896, label: 'phone-414' }, { w: 1440, h: 900, label: 'desktop-1440' },
  { w: 1920, h: 1080, label: 'tv-1920' },
];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-home-' + Date.now() });
  const out = {};
  for (const vp of VIEWPORTS) {
    const p = await b.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e.message || e)));
    await p.setViewport({ width: vp.w, height: vp.h });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate(() => new Promise(r => setTimeout(r, 900)));
    const nav = await p.evaluate(() => {
      const links = document.querySelector('.nav-links');
      const r = links.getBoundingClientRect();
      return {
        linksLeft: Math.round(r.left), linksRight: Math.round(r.right), vw: innerWidth,
        clippedItems: [...links.children].filter(c => c.offsetParent !== null && c.getBoundingClientRect().right > innerWidth + 0.5).map(c => c.textContent.trim().slice(0, 12)),
        docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      };
    });
    // open a real bot chat
    const chat = await p.evaluate(async () => {
      const list = await (await fetch('/api/apps?limit=1')).json();
      const apps = list.apps || list.data || [];
      if (!apps.length) return { error: 'no app in /api/apps' };
      await openApp(apps[0].slug);
      await new Promise(r => setTimeout(r, 900));
      const btn = document.querySelector('.chat-home-btn');
      const acts = document.querySelector('.chat-header-actions');
      const br = btn ? btn.getBoundingClientRect() : null;
      const ar = acts.getBoundingClientRect();
      const visible = btn && br.width > 0 && br.left >= 0 && br.right <= innerWidth + 0.5 && br.top >= 0 && br.bottom <= innerHeight + 0.5;
      const res = { slug: apps[0].slug, btnText: btn ? btn.textContent.trim() : null,
        btnRect: br ? { l: Math.round(br.left), r: Math.round(br.right), t: Math.round(br.top), b: Math.round(br.bottom), w: Math.round(br.width) } : null,
        actionsRect: { l: Math.round(ar.left), r: Math.round(ar.right) },
        actionsOverflow: ar.right - innerWidth, visible,
        overlayDisplay: getComputedStyle(document.getElementById('chat-overlay')).display,
        headerOverflowX: (() => { const h = document.querySelector('.chat-header'); return h.scrollWidth - h.clientWidth; })() };
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 700));
      res.afterClick = { hero: !!document.querySelector('.hero h1'), heroText: (document.querySelector('.hero h1') || {}).textContent || null,
        overlayDisplay: getComputedStyle(document.getElementById('chat-overlay')).display };
      return res;
    });
    out[vp.label] = { nav, chat, errors };
    await p.screenshot({ path: `/home/ghost/tmp-verify/home-${vp.label}.png` });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
