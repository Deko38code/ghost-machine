const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3997/dashboard/verify-copy.html', { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(e=>console.log('goto',e.message));
  await new Promise(r => setTimeout(r, 2000));
  const shape = await page.evaluate(() => ({
    url: location.href,
    dashNodes: document.querySelectorAll('#dash-root *').length,
    bodyText: (document.body.innerText || '').slice(0, 80),
  }));
  console.log('PAGE', JSON.stringify(shape));
  // drag across the content with the button held — the exact gesture that selected everything
  await page.mouse.move(200, 200);
  await page.mouse.down();
  for (let x = 200; x <= 1200; x += 50) { await page.mouse.move(x, 260); }
  for (let y = 260; y <= 700; y += 40) { await page.mouse.move(1200, y); }
  await page.mouse.up();
  const sel = await page.evaluate(() => String(window.getSelection().toString()).trim().slice(0, 120));
  console.log('SELECTED AFTER A FULL DRAG:', JSON.stringify(sel));
  const cs = await page.evaluate(() => {
    const n = document.querySelector('#dash-root');
    if (!n) return 'no dash-root';
    const c = getComputedStyle(n);
    return { userSelect: c.userSelect, webkitUserSelect: c.webkitUserSelect, userDrag: c.getPropertyValue('-webkit-user-drag') };
  });
  console.log('COMPUTED', JSON.stringify(cs));
  await browser.close();
})();
