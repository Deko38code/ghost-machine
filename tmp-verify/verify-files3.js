const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-f3-' + Date.now() });
  const out = {};
  for (const vp of [{w:390,h:844,l:'390'},{w:1440,h:900,l:'1440'}]) {
    const p = await b.newPage();
    await p.setViewport({ width: vp.w, height: vp.h });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    out[vp.l] = await p.evaluate(async () => {
      const root = document.getElementById('phantom-server-applet');
      if (root.dataset.mode !== 'card') document.getElementById('psa-tab')?.click();
      if (window.__phantomApplet) await window.__phantomApplet.check().catch(() => {});
      await new Promise(r => setTimeout(r, 600));
      root.dataset.mode = 'card';
      const t = (id) => (document.getElementById(id) || {}).textContent;
      const cr = root.querySelector('.psa-card').getBoundingClientRect();
      return { uptime: t('psa-uptime'), files: t('psa-files'),
        missingHidden: document.getElementById('psa-missing').hidden,
        mirrorHidden: document.getElementById('psa-mirror').hidden,
        cardInside: cr.left >= -0.5 && cr.right <= innerWidth + 0.5 };
    });
    await p.screenshot({ path: `/home/ghost/tmp-verify/files3-${vp.l}.png` });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
