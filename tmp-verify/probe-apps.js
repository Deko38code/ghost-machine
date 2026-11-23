const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const reqs = [];
  p.on('response', r => { const u = r.url(); if (/\/api\//.test(u)) reqs.push({ s: r.status(), u }); });
  await p.goto('https://haksterai.com/miniforge/app/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const info = await p.evaluate(async () => {
    const grid = document.getElementById('app-grid');
    const r1 = await fetch('/api/apps?limit=1').then(r => ({ s: r.status(), body: null })).catch(e => ({ err: e.message }));
    return { gridCards: grid ? grid.children.length : null, gridText: grid ? grid.textContent.trim().slice(0, 120) : null, url: location.href, appsFetch: r1 };
  });
  console.log(JSON.stringify({ info, reqs: reqs.slice(0, 40) }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
