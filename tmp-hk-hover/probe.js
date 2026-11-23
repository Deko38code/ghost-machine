const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const url = process.argv[2] || 'https://haksterai.com/dashboard';
  let status = 'n/a';
  page.on('response', r => { if (r.url() === url) status = r.status(); });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto err', e.message));
  await new Promise(r => setTimeout(r, 1500));
  const out = await page.evaluate(() => {
    const res = { url: location.href, title: document.title, rules: [], dragEls: [], grabEls: [], userSelectNone: [] };
    // scan every stylesheet rule for drag/select/grab declarations
    for (const sheet of Array.from(document.styleSheets)) {
      let rules = [];
      try { rules = Array.from(sheet.cssRules || []); } catch (e) { continue; }
      for (const r of rules) {
        const t = r.cssText || '';
        if (/-webkit-user-drag|cursor:\s*(grab|move|grabbing)|user-select|touch-action|pointer-events:\s*none/.test(t)) {
          if (res.rules.length < 40) res.rules.push(t.slice(0, 180));
        }
      }
    }
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.draggable === true) res.dragEls.push(el.tagName + '.' + (el.className || '').toString().slice(0, 50));
      const cs = getComputedStyle(el);
      const ud = cs.getPropertyValue('-webkit-user-drag');
      if (ud && ud !== 'auto' && ud !== 'none') res.dragEls.push('USERDRAG ' + el.tagName + '.' + (el.className||'').toString().slice(0,40) + ' = ' + ud);
      if (cs.cursor === 'grab' || cs.cursor === 'move' || cs.cursor === 'grabbing') res.grabEls.push(el.tagName + '.' + (el.className||'').toString().slice(0,50) + ' {' + cs.cursor + '}');
      if (res.dragEls.length > 30 && res.grabEls.length > 30) break;
    }
    return res;
  });
  console.log(JSON.stringify({ httpStatus: status, ...out }, null, 1).slice(0, 6000));
  await browser.close();
})();
