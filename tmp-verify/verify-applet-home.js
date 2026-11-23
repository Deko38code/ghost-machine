const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const VIEWPORTS = [
  { w: 360, h: 640, label: 'phone-360' }, { w: 390, h: 844, label: 'phone-390' },
  { w: 414, h: 896, label: 'phone-414' }, { w: 1440, h: 900, label: 'desktop-1440' },
  { w: 1920, h: 1080, label: 'tv-1920' },
];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-ah-' + Date.now() });
  const out = {};
  for (const vp of VIEWPORTS) {
    const p = await b.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e.message || e)));
    await p.setViewport({ width: vp.w, height: vp.h });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate(() => new Promise(r => setTimeout(r, 1200)));
    // open the applet card and wait for a poll to paint it
    await p.evaluate(async () => {
      const root = document.getElementById('phantom-server-applet');
      const tab = document.getElementById('psa-tab');
      if (root && root.dataset.mode !== 'card' && tab) tab.click();
      if (window.__phantomApplet) await window.__phantomApplet.check().catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      // force the card visible long enough to measure
      document.getElementById('phantom-server-applet').dataset.mode = 'card';
    });
    const applet = await p.evaluate(() => {
      const root = document.getElementById('phantom-server-applet');
      const card = root.querySelector('.psa-card');
      const cr = card.getBoundingClientRect();
      const g = (id) => (document.getElementById(id) || {}).textContent;
      const grid = root.querySelector('.psa-grid');
      return {
        mode: root.dataset.mode,
        state: root.dataset.state,
        uptime: g('psa-uptime'), files: g('psa-files'), missing: g('psa-missing'),
        missingHidden: document.getElementById('psa-missing').hidden,
        card: { l: Math.round(cr.left), r: Math.round(cr.right), t: Math.round(cr.top), b: Math.round(cr.bottom) },
        cardInside: cr.left >= -0.5 && cr.right <= innerWidth + 0.5 && cr.top >= -0.5 && cr.bottom <= innerHeight + 0.5,
        gridOverflowX: grid.scrollWidth - grid.clientWidth,
        cardOverflowX: card.scrollWidth - card.clientWidth,
        docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      };
    });
    // chat: open a bot, find Home, click it, confirm Discover is back
    const chat = await p.evaluate(async () => {
      const list = await (await fetch('/api/apps?limit=1')).json();
      const apps = Array.isArray(list) ? list : (list.apps || list.data || []);
      if (!apps.length) return { error: 'no app' };
      await openApp(apps[0].slug);
      await new Promise(r => setTimeout(r, 900));
      const btn = document.querySelector('.chat-home-btn');
      if (!btn) return { error: 'no home button' };
      const br = btn.getBoundingClientRect();
      const acts = document.querySelector('.chat-header-actions').getBoundingClientRect();
      const visible = br.width > 0 && br.left >= -0.5 && br.right <= innerWidth + 0.5;
      const res = { slug: apps[0].slug, text: btn.textContent.trim(), rect: { l: Math.round(br.left), r: Math.round(br.right) },
        visible, actionsRight: Math.round(acts.right), vw: innerWidth,
        actionsOverflowX: document.querySelector('.chat-header-actions').scrollWidth - document.querySelector('.chat-header-actions').clientWidth };
      btn.click();
      await new Promise(r => setTimeout(r, 700));
      res.after = { hero: !!document.querySelector('.hero h1'), overlay: getComputedStyle(document.getElementById('chat-overlay')).display };
      return res;
    });
    out[vp.label] = { applet, chat, errors };
    await p.screenshot({ path: `/home/ghost/tmp-verify/applet-home-${vp.label}.png` });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
