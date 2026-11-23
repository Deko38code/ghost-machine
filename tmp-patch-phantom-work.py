#!/usr/bin/env python3
import io, sys

BASE = "/home/ghost694/phantomide/"
SRV = BASE + "phantom-server.js"
HTML = BASE + "phantom-ide.html"

# ---------- 1. owner-only read-only API ------------------------------------
with io.open(SRV, "r", encoding="utf-8") as f:
    srv = f.read()

anchor = "app.get('/api/admin/pending-payments', async (req, res) => {"
if anchor not in srv:
    sys.exit("FAIL: server anchor not found")

route = r"""// Owner (2026-11-20): the owner's PhantomIDE dashboard shows how much work has
// been done on Junkalot — a live 24-hour counter, the 80 h / 2-week goal and a
// pace verdict. This READS Junkalot's append-only invoice worklog and its
// verified build notes, read-only. It never writes into the Junkalot project
// (CLAUDE.md §16, §19.6). Every number comes from a recorded line; nothing is
// estimated and no rate or price is invented.
app.get('/api/admin/junkalot-work', async (req, res) => {
  if(!canAccessAdminPanel(req)) return res.status(403).json({ error:'Forbidden' });
  const JL = '/home/ghost694/junkalot/data';
  const now = Date.now();
  const DAY = 24*60*60*1000;
  const utcDay = ts => new Date(ts).toISOString().slice(0,10);
  let entries = [];
  try {
    const text = fs.readFileSync(path.join(JL,'invoice-worklog.jsonl'),'utf8');
    for(const line of text.split('\n')){
      const t = line.trim(); if(!t) continue;
      try{
        const v = JSON.parse(t);
        const day = String(v?.date||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const ts = Date.parse(day+'T'+String(v?.time_utc||'00:00:00')+'Z');
        if(!Number.isFinite(ts)) continue;
        entries.push({ ts, day, kind:String(v?.kind||'other'), title:String(v?.title||''), verified:String(v?.verified||'') });
      }catch(e){}
    }
  }catch(e){}
  let builds = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(JL,'build-notes.json'),'utf8'))||{};
    for(const [id,v] of Object.entries(raw)){
      const ts = Date.parse(String(v?.at||''));
      if(Number.isFinite(ts)) builds.push({ id, ts });
    }
  }catch(e){}
  const items24 = entries.filter(e=>now-e.ts<=DAY).sort((a,b)=>a.ts-b.ts);
  const builds24 = builds.filter(b=>now-b.ts<=DAY);
  const byKind = {}; for(const e of items24) byKind[e.kind]=(byKind[e.kind]||0)+1;
  const spanMinutes = items24.length>1 ? Math.round((items24[items24.length-1].ts-items24[0].ts)/60000) : 0;
  const byDay = [];
  for(let i=13;i>=0;i-=1){
    const day = utcDay(now-i*DAY);
    const items = entries.filter(e=>e.day===day).sort((a,b)=>a.ts-b.ts);
    const buildCount = builds.filter(b=>utcDay(b.ts)===day).length;
    const span = items.length>1 ? Math.round((items[items.length-1].ts-items[0].ts)/60000) : 0;
    byDay.push({ day, items:items.length, builds:buildCount, spanMinutes:span });
  }
  const last7 = byDay.slice(-7);
  const activeDays = last7.filter(d=>d.items>0||d.builds>0).length;
  const items7 = last7.reduce((s,d)=>s+d.items,0);
  const builds7 = last7.reduce((s,d)=>s+d.builds,0);
  const lastItem = entries.length ? entries.reduce((a,b)=>a.ts>b.ts?a:b) : null;
  res.json({
    generatedAt:new Date(now).toISOString(),
    last24h:{ items:items24.length, builds:builds24.length, byKind, firstAt:items24.length?new Date(items24[0].ts).toISOString():null, lastAt:items24.length?new Date(items24[items24.length-1].ts).toISOString():null, spanMinutes },
    rate:{ activeDays7:activeDays, items7, builds7, itemsPerActiveDay:activeDays?Math.round(items7/activeDays*10)/10:null, buildsPerActiveDay:activeDays?Math.round(builds7/activeDays*10)/10:null },
    byDay,
    lastItem: lastItem ? { title:lastItem.title, at:new Date(lastItem.ts).toISOString(), kind:lastItem.kind } : null,
  });
});

"""
srv = srv.replace(anchor, route + anchor, 1)
with io.open(SRV, "w", encoding="utf-8") as f:
    f.write(srv)
print("PATCHED server")

# ---------- 2. the dashboard section + loader ------------------------------
with io.open(HTML, "r", encoding="utf-8") as f:
    html = f.read()

sec_anchor = """        <section style="margin:14px 0;padding:13px;background:linear-gradient(135deg,#071510,#0b0d14);border:1px solid #174b32;border-radius:9px;">
          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:8px;">
            <strong style="color:#54f29b;font-size:.76rem;">🛡 LIVE SECURITY AGENT</strong>"""
if sec_anchor not in html:
    sys.exit("FAIL: html section anchor not found")

section = """        <section style="margin:12px 0;padding:12px;background:#0a0d14;border:1px solid #2a3f55;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:9px;">
            <strong style="color:#8dc4ff;font-size:.74rem;">🛠 JUNKALOT WORK · past 24 h</strong>
            <span id="jl-work-verdict" style="font-size:.6rem;padding:2px 8px;border-radius:99px;border:1px solid #3a4840;color:#9ca6a0;">loading…</span>
            <span style="margin-left:auto;font-size:.58rem;color:#6f8577;">reads Junkalot's invoice worklog read-only — never writes it</span>
          </div>
          <div id="jl-work-body" style="font-size:.62rem;color:#cdd4cf;">Loading work log…</div>
        </section>
"""
html = html.replace(sec_anchor, section + sec_anchor, 1)

call_anchor = """    adminVaultLoad();
    if(window._adminSecurityRefreshTimer) clearInterval(window._adminSecurityRefreshTimer);"""
if call_anchor not in html:
    sys.exit("FAIL: html call anchor not found")
html = html.replace(call_anchor, """    adminVaultLoad();
    loadJunkalotWork();
    if(window._adminSecurityRefreshTimer) clearInterval(window._adminSecurityRefreshTimer);""", 1)

fn_anchor = "async function adminVaultLoad(){"
if fn_anchor not in html:
    sys.exit("FAIL: html function anchor not found")

loader = r"""async function loadJunkalotWork(){
  const body=document.getElementById('jl-work-body'); if(!body) return;
  try{
    const r=await fetch('/api/admin/junkalot-work',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!r.ok){ body.textContent='Work stats unavailable ('+r.status+'). Nothing is guessed.'; return; }
    const d=await r.json();
    const hours14=Math.round((d.byDay.reduce((s,x)=>s+x.spanMinutes,0)/60)*10)/10;
    const pct=Math.min(100,Math.round((hours14/80)*100));
    const share=hours14/80;
    const verdict=share>=0.8?['Doing fantastic','#2fbf71']:share>=0.4?['Improving','#d9a521']:['Needs more work','#e05252'];
    const vEl=document.getElementById('jl-work-verdict');
    if(vEl){ vEl.textContent=verdict[0]; vEl.style.color=verdict[1]; vEl.style.borderColor=verdict[1]; }
    const since=d.lastItem?Date.parse(d.lastItem.at):NaN;
    const maxItems=Math.max(1,...d.byDay.map(y=>y.items));
    const bar=(w,c)=>'<span style="display:block;height:100%;width:'+w+'%;background:'+c+';"></span>';
    const cell=(val,label,color)=>'<div style="background:#0a0a1a;border:1px solid #222244;border-radius:6px;padding:8px;text-align:center;"><div style="font-size:1.25rem;color:'+color+';font-weight:700;">'+val+'</div><div style="font-size:.55rem;color:#667;letter-spacing:.06em;">'+label+'</div></div>';
    const rows=d.byDay.slice(-7).map(x=>'<div style="display:flex;gap:8px;align-items:center;"><span style="width:44px;color:#667;">'+x.day.slice(5)+'</span><span style="flex:1;height:6px;background:#141a28;border-radius:99px;overflow:hidden;">'+bar(Math.round(x.items/maxItems*100),'#3f7fd6')+'</span><span style="width:52px;text-align:right;">'+x.items+' item'+(x.items===1?'':'s')+'</span><span style="width:44px;text-align:right;color:#667;">'+x.builds+' b</span></div>').join('');
    body.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:9px;">'
      +cell(d.last24h.items,'ITEMS · 24H','#8dc4ff')
      +cell(d.last24h.builds,'BUILDS · 24H','#8dc4ff')
      +cell(hours14+' h','RECORDED · 14D','#8dc4ff')
      +cell(d.rate.activeDays7,'ACTIVE DAYS · 7','#8dc4ff')
      +cell(pct+'%','OF 80 H GOAL',pct>=80?'#2fbf71':pct>=40?'#d9a521':'#e05252')
      +'<div style="background:#0a0a1a;border:1px solid #222244;border-radius:6px;padding:8px;text-align:center;"><div id="jl-work-clock" style="font-size:1.05rem;color:#8dc4ff;font-weight:700;font-variant-numeric:tabular-nums;">—</div><div style="font-size:.55rem;color:#667;letter-spacing:.06em;">SINCE LAST ITEM</div></div>'
      +'</div>'
      +'<div style="height:10px;border-radius:99px;background:#141a28;overflow:hidden;margin-bottom:6px;">'+bar(pct,pct>=80?'#2fbf71':pct>=40?'#d9a521':'#e05252')+'</div>'
      +'<div style="font-size:.58rem;color:#7b8794;margin-bottom:6px;">'+(hours14>=80?('Goal reached — '+Math.round((hours14-80)*10)/10+' h over target.'):(Math.round((80-hours14)*10)/10+' h to go. Measured first→last recorded entry each day.'))+'</div>'
      +'<div style="font-size:.58rem;color:#9ca6a0;margin-bottom:6px;">'+(d.lastItem?('Last: '+String(d.lastItem.title||'').slice(0,110)):'Nothing logged yet.')+'</div>'
      +'<div style="display:grid;gap:2px;font-size:.56rem;color:#8b98a6;">'+rows+'</div>';
    if(Number.isFinite(since)){
      if(window._jlWorkClock) clearInterval(window._jlWorkClock);
      const tick=()=>{
        const el=document.getElementById('jl-work-clock');
        if(!el){ clearInterval(window._jlWorkClock); window._jlWorkClock=null; return; }
        const t=Math.max(0,Math.floor((Date.now()-since)/1000));
        const dd=Math.floor(t/86400),hh=Math.floor((t%86400)/3600),mm=Math.floor((t%3600)/60),ss=t%60;
        el.textContent=(dd>0?dd+'d ':'')+hh+'h '+String(mm).padStart(2,'0')+'m '+String(ss).padStart(2,'0')+'s';
      };
      tick(); window._jlWorkClock=setInterval(tick,1000);
    }
  }catch(e){ body.textContent='Could not read the work log — nothing is guessed.'; }
}

"""
html = html.replace(fn_anchor, loader + fn_anchor, 1)

with io.open(HTML, "w", encoding="utf-8") as f:
    f.write(html)
print("PATCHED html")
