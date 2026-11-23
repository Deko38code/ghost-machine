const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath:'/usr/bin/chromium', headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage'], userDataDir:'/home/ghost/tmp-verify/chrome-bs-' + Date.now() });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('https://haksterai.com/', { waitUntil:'domcontentloaded', timeout:45000 });
  await new Promise(r => setTimeout(r, 800));
  const m = await page.evaluate(() => {
    const c = document.getElementById('phantom-server-applet').querySelector('.psa-card');
    const cs = getComputedStyle(c);
    return { boxSizing: cs.boxSizing, width: cs.width, padding: cs.padding, border: cs.borderWidth, rect: Math.round(c.getBoundingClientRect().width) };
  });
  console.log(JSON.stringify(m));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
