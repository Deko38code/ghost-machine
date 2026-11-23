const fs=require('fs');
const raw=fs.readFileSync('/home/ghost/haksterAi/.env','utf8');
const KEY=(raw.split('\n').find(l=>l.startsWith('STRIPE_SECRET_KEY='))||'').slice('STRIPE_SECRET_KEY='.length).trim().replace(/^["']|["']$/g,'');
const H={Authorization:'Bearer '+KEY};
const api=async(p,q)=>{const u=new URL('https://api.stripe.com'+p);if(q)for(const[k,v]of Object.entries(q))u.searchParams.set(k,v);const r=await fetch(u,{headers:H});const j=await r.json();if(!r.ok)throw new Error(p+' HTTP '+r.status+' '+(j.error&&j.error.message));return j;};
const val=n=>{const l=raw.split('\n').find(x=>x.startsWith(n+'='));return l?l.slice(n.length+1).trim().replace(/^["']|["']$/g,''):''};
(async()=>{
  const ids=[
    ['env STRIPE_PRICE_STARTER_MONTHLY',val('STRIPE_PRICE_STARTER_MONTHLY')],
    ['env STRIPE_PRICE_PRO_MONTHLY',val('STRIPE_PRICE_PRO_MONTHLY')],
    ['env STRIPE_PRICE_PRO_YEARLY',val('STRIPE_PRICE_PRO_YEARLY')],
    ['env STRIPE_PRICE_ENTERPRISE_MONTHLY',val('STRIPE_PRICE_ENTERPRISE_MONTHLY')],
    ['env STRIPE_PRICE_ENTERPRISE_YEARLY',val('STRIPE_PRICE_ENTERPRISE_YEARLY')],
    ['code lite',"price_1UdxxOA0UrVsJMzeKh22sWDy"],
    ['code starter_plus monthly',"price_1UdxxPA0UrVsJMze3cRPHBpN"],
    ['code starter_plus yearly',"price_1UdxxPA0UrVsJMzeygh4cJcZ"],
  ];
  for(const [label,id] of ids){
    if(!id){console.log(label.padEnd(36)+' -> (empty)');continue;}
    try{
      const p=await api('/v1/prices/'+id);
      console.log(label.padEnd(36)+' -> '+id+' | active='+p.active+' | '+(p.currency||'').toUpperCase()+' '+((p.unit_amount||0)/100).toFixed(2)+'/'+((p.recurring&&p.recurring.interval)||'once'));
    }catch(e){console.log(label.padEnd(36)+' -> ERROR '+e.message);}
  }
})().catch(e=>{console.log('FAILED: '+e.message);process.exit(1);});
