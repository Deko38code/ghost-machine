const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium', headless:'new', args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  for (const [w,h,tag] of [[360,640,'360'],[390,844,'390'],[768,900,'768'],[1440,900,'1440'],[1920,1080,'1920']]) {
    await page.setViewport({width:w,height:h,deviceScaleFactor:1});
    await page.goto('file:///home/ghost/tmp-verify/.preview.html',{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,300));
    const m = await page.evaluate(()=>({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      sh: document.documentElement.scrollHeight,
      bars: document.querySelectorAll('#callsChart .bar').length,
      lanes: document.querySelectorAll('#laneChart .hrow').length,
      rows: document.querySelectorAll('#tableView tr').length,
      wide: [...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>window.innerWidth+1 && getComputedStyle(e).overflowX==='visible' && e.tagName!=='HTML'}).slice(0,4).map(e=>e.tagName+'.'+e.className+':'+Math.round(e.getBoundingClientRect().width))
    }));
    console.log(tag, JSON.stringify(m));
    await page.screenshot({path:'/home/ghost/tmp-verify/stats-'+tag+'.png', fullPage: tag==='390'||tag==='1440'});
  }
  // dark check
  await page.emulateMediaFeatures([{name:'prefers-color-scheme', value:'dark'}]);
  await page.setViewport({width:1440,height:900});
  await page.goto('file:///home/ghost/tmp-verify/.preview.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,300));
  const bg = await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  console.log('dark body bg', bg, 'errors', JSON.stringify(errs));
  await page.screenshot({path:'/home/ghost/tmp-verify/stats-dark.png', fullPage:true});
  await browser.close();
})();
