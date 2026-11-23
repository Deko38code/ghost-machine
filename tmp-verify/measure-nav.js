const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox','--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-nav-' + Date.now() });
  for (const w of [360, 390, 414, 1440, 1920]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: w >= 1000 ? 1080 : 844 });
    await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 800));
    const m = await p.evaluate(() => {
      const nav = document.querySelector('.nav');
      const links = document.querySelector('.nav-links');
      const r = nav.getBoundingClientRect(), l = links.getBoundingClientRect();
      return { navW: Math.round(r.width), linksLeft: Math.round(l.left), linksRight: Math.round(l.right),
        docOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        items: [...links.children].filter(c => c.offsetParent !== null).map(c => ({ t: c.textContent.trim().slice(0,14), l: Math.round(c.getBoundingClientRect().left), r: Math.round(c.getBoundingClientRect().right) })) };
    });
    console.log(w, JSON.stringify(m));
    await p.close();
  }
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
