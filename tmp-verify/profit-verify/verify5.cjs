(async () => {
const { DatabaseSync } = require('node:sqlite');
const puppeteer = require('/home/ghost/haksterAi/node_modules/puppeteer');
const db = new DatabaseSync('/home/ghost/haksterAi/data/hakster.db', { readOnly: true });
const owner = db.prepare("select api_key from users where email like 'dek%' and api_key is not null limit 1").get();
const b = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
const p = await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.setViewport({width:390,height:844});
await p.goto('http://127.0.0.1:3579/',{waitUntil:'domcontentloaded'});
await p.evaluate(k=>{localStorage.setItem('hakster_api_key',k);localStorage.setItem('hakster_google_token',k);},owner.api_key);
await p.goto('http://127.0.0.1:3579/admin/profit',{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,700));
for(let i=0;i<3;i++){const h=await p.evaluate(()=>document.getElementById('admin-pin-gate')?.getAttribute('aria-hidden'));if(h==='true')break;const ks=await p.$$('[data-admin-pin-key]');const m={};for(const el of ks)m[await el.evaluate(n=>n.getAttribute('data-admin-pin-key'))]=el;for(const d of ['1','2','3','4','5','6']){await m[d].click();await new Promise(r=>setTimeout(r,60));}await new Promise(r=>setTimeout(r,400));}
await new Promise(r=>setTimeout(r,1500));
for (const [w,h,name] of [[360,640,'phone-360'],[390,844,'phone-390'],[414,896,'phone-414'],[1440,900,'desktop-1440'],[1920,1080,'tv-1920']]) {
  await p.setViewport({width:w,height:h});
  await new Promise(r=>setTimeout(r,400));
  const out = await p.evaluate(()=>({
    lane: (document.getElementById('pl-lane')||{}).textContent.replace(/\s+/g,' ').trim().slice(0,520),
    session: (document.getElementById('pl-session')||{}).textContent.replace(/\s+/g,' ').trim().slice(0,140),
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    overflow: [...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&getComputedStyle(el).visibility!=='hidden'&&(r.right>window.innerWidth+1||r.left<-1);}).slice(0,4).map(el=>el.tagName+'.'+String(el.className).slice(0,24)),
  }));
  console.log('\n### '+name+' '+w+'x'+h+'\n'+JSON.stringify(out,null,1));
  await p.screenshot({path:'v4-'+name+'.png'});
}
console.log('\nERRORS:', errs.length?errs:'none');
await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
