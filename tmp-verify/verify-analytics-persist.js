const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], userDataDir: '/home/ghost/tmp-verify/chrome-an-' + Date.now() });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844 });
  const posts = [];
  p.on('response', (r) => { if (r.url().includes('/api/analytics/track')) posts.push(r.status()); });
  await p.goto('https://haksterai.com/', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500));
  await p.mouse.click(200, 400);
  await new Promise(r => setTimeout(r, 1500));
  console.log(JSON.stringify({ trackResponses: posts }));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
