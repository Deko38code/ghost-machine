const puppeteer = require('/home/ghost694/haksterAi/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    userDataDir: '/home/ghost694/tmp-verify/chrome-counter',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let first = true;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (first && req.url().includes('/api/version')) {
      first = false;
      // Pretend the server is serving a build this page is not on.
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify({
          build: 'FAKE-NEWER-BUILD-20261121', builtAt: new Date().toISOString(),
          portfolio: null, pending: null, maintenance: null, lastApply: null, update: null,
        }),
      });
      return;
    }
    req.continue();
  });

  const t0 = Date.now();
  let navigations = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations.push(Date.now() - t0); });

  await page.goto('https://junkalot.co/', { waitUntil: 'domcontentloaded', timeout: 45000 });

  const samples = [];
  const deadline = Date.now() + 11000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const ring = document.querySelector('#junkalot-update-toast .jl-ring span');
      const root = document.getElementById('junkalot-update-toast');
      return ring ? { n: ring.textContent, mode: root && root.dataset.docked } : null;
    }).catch(() => null);
    samples.push({ t: Date.now() - t0, ...(s || { n: null }) });
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(JSON.stringify({
    samples: samples.filter((s, i, a) => i === 0 || s.n !== a[i - 1].n),
    navigations,
  }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
