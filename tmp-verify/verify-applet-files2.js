const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
const VPS = [{w:360,h:640,l:'360'},{w:390,h:844,l:'390'},{w:414,h:896,l:'414'},{w:1440,h:900,l:'1440'},{w:1920,h:1080,l:'1920'}];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-f2-' + Date.now() });
  const out = {};
  for (const vp of VPS) {
    const p = await b.newPage();
    const errors = []; p.on('pageerror', e => errors.push(String(e.message || e)));
    await p.setViewport({ width: vp.w, height: vp.h });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate(() => new Promise(r => setTimeout(r, 1100)));
    const res = await p.evaluate(async () => {
      const root = document.getElementById('phantom-server-applet');
      if (root.dataset.mode !== 'card') document.getElementById('psa-tab')?.click();
      if (window.__phantomApplet) await window.__phantomApplet.check().catch(() => {});
      await new Promise(r => setTimeout(r, 600));
      root.dataset.mode = 'card';
      const card = root.querySelector('.psa-card'), cr = card.getBoundingClientRect();
      const t = (id) => (document.getElementById(id) || {}).textContent;
      return { uptime: t('psa-uptime'), files: t('psa-files'),
        missing: t('psa-missing'), missingHidden: document.getElementById('psa-missing').hidden,
        mirror: t('psa-mirror'), mirrorHidden: document.getElementById('psa-mirror').hidden,
        cardInside: cr.left >= -0.5 && cr.right <= innerWidth + 0.5 && cr.top >= -0.5 && cr.bottom <= innerHeight + 0.5,
        cardOverflowX: card.scrollWidth - card.clientWidth,
        docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth };
    });
    out[vp.l] = { ...res, errors };
    await p.screenshot({ path: `/home/ghost/tmp-verify/files2-${vp.l}.png` });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
