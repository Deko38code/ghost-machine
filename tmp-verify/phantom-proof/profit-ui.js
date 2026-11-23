function createAdminProfitPane(){
  const pane=document.createElement('section');pane.id='admin-profit-pane';pane.setAttribute('aria-label','Live profit, tokens and margin');
  pane.style.cssText='padding:14px;background:linear-gradient(135deg,#071510,#0b0d14);border:1px solid #2d6443;border-radius:10px;';
  pane.innerHTML=[
    '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">',
      '<strong style="color:#9af0b4;font-size:.8rem;letter-spacing:.06em;">LIVE PROFIT · WHEELS · GRIDS</strong>',
      '<button type="button" data-profit-refresh style="padding:6px 11px;border:1px solid #39d778;border-radius:7px;background:#0d2a1a;color:#9af0b4;font:700 11px system-ui;cursor:pointer;">&#8635; Refresh</button>',
    '</div>',
    '<p style="margin:0 0 10px;color:#9ba99f;font-size:.62rem;line-height:1.55;">Read-only accounting: tokens served, what was booked and collected, modelled token cost and margin. It records what happened; it never charges, never changes a plan and never edits a provider.</p>',
    '<div data-profit-status role="status" aria-live="polite" style="margin-bottom:10px;color:#9ba99f;font-size:.62rem;">Loading live profit&#8230;</div>',
    '<div data-profit-wheels style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:10px;margin-bottom:12px;"></div>',
    '<div data-profit-tiles style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr));gap:8px;margin-bottom:12px;"></div>',
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;align-items:start;">',
      '<div style="min-width:0;"><div style="color:#84958a;font-size:.58rem;letter-spacing:.08em;margin-bottom:6px;">SNAPSHOT HISTORY</div><div data-profit-chart style="display:flex;align-items:flex-end;gap:4px;height:96px;padding:8px;border:1px solid #20382a;border-radius:8px;background:#080d0a;"></div></div>',
      '<div style="min-width:0;"><div style="color:#84958a;font-size:.58rem;letter-spacing:.08em;margin-bottom:6px;">CLIENTS BY MARGIN</div><div data-profit-clients style="border:1px solid #20382a;border-radius:8px;background:#080d0a;padding:6px;font-size:.62rem;color:#b8c8bd;overflow:auto;max-height:126px;"></div></div>',
    '</div>',
    '<div data-profit-extra style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;"></div>'
  ].join('');
  const refresh=pane.querySelector('[data-profit-refresh]');
  if(refresh)refresh.addEventListener('click',()=>loadAdminProfit());
  return pane;
}
let _adminProfitTimer=null;
async function loadAdminProfit(){
  const pane=document.getElementById('admin-profit-pane');if(!pane)return;
  const status=pane.querySelector('[data-profit-status]'),button=pane.querySelector('[data-profit-refresh]');
  if(button)button.disabled=true;
  if(status){status.textContent='Loading live profit...';status.style.color='#9ba99f';}
  try{
    const token=phantomOwnerSessionToken();
    if(!token)throw new Error('Owner sign-in required');
    const response=await fetch('/api/admin/profit-watch',{headers:{'x-phantom-session':token},cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(9000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data||!data.totals)throw new Error(data&&data.error?data.error:('HTTP '+response.status));
    renderAdminProfit(pane,data);
    if(status){status.textContent='LIVE · checked '+(data.checkedAt?new Date(data.checkedAt).toLocaleString():'just now')+' · '+(data.windowDays||30)+'-day window';status.style.color='#8ddd9a';}
    clearTimeout(_adminProfitTimer);
    _adminProfitTimer=setTimeout(()=>{const p=document.getElementById('admin-profit-pane');if(p&&!p.hidden)loadAdminProfit();},30000);
  }catch(error){
    if(status){status.textContent='Profit unavailable: '+((error&&error.message)||'unknown');status.style.color='#ff9a9a';}
  }finally{if(button)button.disabled=false;}
}
function renderAdminProfit(pane,data){
  const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(value)||0)/100);
  const pct=value=>(Number(value)||0).toFixed(1)+'%';
  const compact=value=>{const n=Number(value)||0;if(n>=1e9)return(n/1e9).toFixed(2)+'B';if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(Math.round(n));};
  const totals=data.totals||{},coach=data.coach||null,worklog=data.worklog||null;
  const wheel=(value,label,caption,color)=>{
    const p=Math.max(0,Math.min(100,Number(value)||0)),circ=2*Math.PI*34,dash=(p/100)*circ;
    return '<div style="padding:10px;border:1px solid #20382a;border-radius:9px;background:#080d0a;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;">'
      +'<svg viewBox="0 0 84 84" style="width:84px;height:84px;" role="img" aria-label="'+label+' '+p.toFixed(1)+' percent">'
      +'<circle cx="42" cy="42" r="34" fill="none" stroke="#1c3326" stroke-width="8"></circle>'
      +'<circle cx="42" cy="42" r="34" fill="none" stroke="'+color+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" transform="rotate(-90 42 42)"></circle>'
      +'<text x="42" y="47" text-anchor="middle" font-family="ui-monospace,monospace" font-size="16" font-weight="700" fill="#eafff0">'+pct(p)+'</text>'
      +'</svg><div style="font:700 9.5px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#84958a;">'+label+'</div>'
      +'<div style="font-size:.58rem;color:#9ba99f;text-align:center;line-height:1.45;">'+caption+'</div></div>';
  };
  const tile=(label,value,sub,good)=>'<div style="min-width:0;padding:10px;border:1px solid #20382a;border-radius:9px;background:#080d0a;">'
    +'<div style="font:700 9.5px/1 ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase;color:#84958a;margin-bottom:6px;">'+label+'</div>'
    +'<div style="font:800 18px/1.1 ui-monospace,monospace;color:'+(good?'#8ddd9a':'#eafff0')+';font-variant-numeric:tabular-nums;overflow-wrap:anywhere;">'+value+'</div>'
    +(sub?'<div style="font-size:.57rem;color:#84958a;margin-top:4px;line-height:1.4;">'+sub+'</div>':'')+'</div>';
  const costShare=Number(totals.bookedCents)>0?(Number(totals.estCostCents)||0)/Number(totals.bookedCents)*100:0;
  const collectShare=Number(totals.bookedCents)>0?(Number(totals.collectedCents)||0)/Number(totals.bookedCents)*100:0;
  const coachShare=Number(totals.tokensServed)>0&&coach&&Number(coach.tokens)>0?(Number(coach.tokens)/Number(totals.tokensServed))*100:0;
  const wheels=pane.querySelector('[data-profit-wheels]');
  if(wheels)wheels.innerHTML=wheel(totals.marginPct||0,'Margin',money(totals.marginCents)+' on '+money(totals.bookedCents),'#39d778')
    +wheel(collectShare,'Collected',money(totals.collectedCents)+' of booked','#3fb6ff')
    +wheel(coachShare,'Coach share',(coach?compact(coach.tokens):'0')+' of '+compact(totals.tokensServed)+' tokens','#f0b46a');
  const tiles=pane.querySelector('[data-profit-tiles]');
  if(tiles)tiles.innerHTML=tile('Tokens served',compact(totals.tokensServed),data.windowDays+' days')
    +tile('Calls',compact(totals.calls),'logged usage rows')
    +tile('Booked',money(totals.bookedCents),'invoiced + purchases')
    +tile('Collected',money(totals.collectedCents),'paid',true)
    +tile('Token cost',money(totals.estCostCents),'modelled at plan rates')
    +tile('Margin',money(totals.marginCents),pct(totals.marginPct),true)
    +tile('Verdict',String(data.verdict||'—'),'advice only, never automatic')
    +tile('Worklog 7d',String(worklog&&worklog.last7!=null?worklog.last7:'—'),'Junkalot items');
  const history=Array.isArray(data.history)?data.history.slice(-14):[];
  const chart=pane.querySelector('[data-profit-chart]');
  if(chart){
    if(!history.length)chart.innerHTML='<div style="color:#64748b;font-size:.6rem;">No daily snapshots yet</div>';
    else{
      const max=Math.max.apply(null,history.map(h=>Number(h.tokens)||0).concat([1]));
      chart.innerHTML=history.map(h=>{const v=Number(h.tokens)||0;const height=v?Math.max(6,(v/max)*100):3;return'<div title="'+(h.day||'')+' · '+compact(v)+' tokens" style="flex:1 1 0;min-width:3px;height:'+height.toFixed(1)+'%;border-radius:3px 3px 0 0;background:'+(v?'linear-gradient(180deg,#4ade80,#166534)':'#1c3326')+';"></div>';}).join('');
    }
  }
  const clients=pane.querySelector('[data-profit-clients]');
  if(clients){
    const list=Array.isArray(data.clients)?data.clients.slice().sort((a,b)=>(Number(b.marginPct)||0)-(Number(a.marginPct)||0)).slice(0,8):[];
    clients.innerHTML=list.length?list.map(c=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 2px;border-bottom:1px solid #14251b;"><span style="min-width:0;overflow-wrap:anywhere;">'+(c.label||c.key||'client')+'</span><span style="font-family:ui-monospace,monospace;white-space:nowrap;color:#8ddd9a;">'+compact(c.tokens)+' · '+pct(c.marginPct)+'</span></div>').join(''):'<div style="color:#64748b;font-size:.6rem;">No client rows in this window</div>';
  }
  const extra=pane.querySelector('[data-profit-extra]');
  if(extra){
    const coachCard='<div style="min-width:0;padding:10px;border:1px solid #20382a;border-radius:9px;background:#080d0a;">'
      +'<div style="color:#9af0b4;font-size:.66rem;font-weight:700;letter-spacing:.07em;margin-bottom:6px;">JUNKALOT COACH</div>'
      +(coach?'<div style="font-size:.62rem;color:#b8c8bd;line-height:1.7;">Turns '+compact(coach.turns)+' · tokens '+compact(coach.tokens)+'<br>Metered cost '+(coach.metered?money(Number(coach.estMarginalCostUsd||0)*100):'$0 marginal (plan included)')+'<br>Newest '+(coach.newestAt?new Date(coach.newestAt).toLocaleString():'—')+'</div>':'<div style="font-size:.6rem;color:#64748b;">Coach usage file not readable</div>')
      +'</div>';
    const workCard='<div style="min-width:0;padding:10px;border:1px solid #20382a;border-radius:9px;background:#080d0a;">'
      +'<div style="color:#9af0b4;font-size:.66rem;font-weight:700;letter-spacing:.07em;margin-bottom:6px;">JUNKALOT WORKLOG</div>'
      +(worklog?'<div style="font-size:.62rem;color:#b8c8bd;line-height:1.7;">Today '+String(worklog.today!=null?worklog.today:'—')+' · 7 days '+String(worklog.last7!=null?worklog.last7:'—')+' · 30 days '+String(worklog.last30!=null?worklog.last30:'—')+'<br>Total '+String(worklog.total!=null?worklog.total:'—')+' items'+(worklog.newestAt?'<br>Newest '+new Date(worklog.newestAt).toLocaleString():'')+'</div>':'<div style="font-size:.6rem;color:#64748b;">Worklog not readable</div>')
      +'</div>';
    extra.innerHTML=coachCard+workCard;
  }
}
