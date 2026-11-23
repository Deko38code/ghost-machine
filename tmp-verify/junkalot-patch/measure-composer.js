const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const out = [];
  for (const [w,h] of [[360,640],[390,844],[414,896],[1440,900],[1920,1080]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h });
    await p.goto('file:///home/ghost/tmp-verify/junkalot-patch/composer-harness.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    out.push(await p.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height) }; };
      return { vp: innerWidth + 'x' + innerHeight, mic: r('#mic'), send: r('#send'), ta: r('textarea'), overflow: document.documentElement.scrollWidth > innerWidth + 1, label: document.querySelector('#send').textContent.trim() };
    }));
    await p.close();
  }
  await b.close(); console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
