const fs=require('fs');
const raw=fs.readFileSync('/home/ghost/haksterAi/.env','utf8');
const KEY=(raw.split('\n').find(l=>l.startsWith('STRIPE_SECRET_KEY='))||'').slice('STRIPE_SECRET_KEY='.length).trim().replace(/^["']|["']$/g,'');
const H={Authorization:'Bearer '+KEY};
const call=async(m,p)=>{const r=await fetch('https://api.stripe.com'+p,{method:m,headers:H});const j=await r.json();if(!r.ok)throw new Error(p+' HTTP '+r.status+' '+(j.error&&j.error.message));return j;};
(async()=>{
  // every open session on this account that our site created
  let after=null, open=[];
  do{
    const page=await call('GET','/v1/checkout/sessions?limit=100&status=open'+(after?'&starting_after='+after:''));
    open.push(...page.data);
    after=page.has_more?page.data[page.data.length-1].id:null;
  }while(after);
  const ours=open.filter(s=>String(s.integration_identifier||'').startsWith('haksterai_web_'));
  console.log('open sessions on account: '+open.length+' | created by haksterai.com: '+ours.length);
  for(const s of ours){
    const e=await call('POST','/v1/checkout/sessions/'+s.id+'/expire');
    console.log('  expired '+s.id.slice(0,20)+'… | status='+e.status+' | total=$'+((e.amount_total||0)/100).toFixed(2));
  }
  const left=(await call('GET','/v1/checkout/sessions?limit=100&status=open'));
  const still=(left.data||[]).filter(s=>String(s.integration_identifier||'').startsWith('haksterai_web_'));
  console.log('\nremaining open haksterai sessions: '+still.length);
})().catch(e=>{console.log('FAILED: '+e.message);process.exit(1);});
