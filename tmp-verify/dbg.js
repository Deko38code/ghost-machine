const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844 });
  const resp = await p.goto(process.argv[2], { waitUntil: 'networkidle2', timeout: 45000 });
  console.log('status', resp && resp.status(), 'url', p.url());
  console.log('title:', await p.title());
  console.log('body:', (await p.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, ' | '));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
