const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setJavaScriptEnabled(false);
  await p.setViewport({ width: 390, height: 844 });
  await p.goto('https://haksterai.com/admin/live-stats/', { waitUntil: 'domcontentloaded' });
  console.log(await p.evaluate(() => {
    const w = document.querySelector('.ls-wrap');
    const cs = w && getComputedStyle(w);
    const chain = [];
    let n = w;
    while (n && n !== document.documentElement) { const c = getComputedStyle(n); chain.push(n.tagName + '.' + (n.className || '').toString().slice(0, 24) + ' pl=' + c.paddingLeft + ' pr=' + c.paddingRight + ' ml=' + c.marginLeft + ' w=' + Math.round(n.getBoundingClientRect().width)); n = n.parentElement; }
    return { wrapPadding: cs && (cs.paddingLeft + '/' + cs.paddingRight), wrapRect: w && Math.round(w.getBoundingClientRect().left), chain };
  }));
  await b.close();
})();
