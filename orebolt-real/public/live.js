(function(){
  function fmtTime(iso){ try{ return new Date(iso).toLocaleTimeString(); }catch(_){ return 'unknown'; } }
  function esc(v){ return String(v ?? '').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c)); }
  window.Orebolt={
    fmtTime, esc,
    renderCard(el,label,value,cls){ if(!el)return; el.innerHTML=`<div class="kx">${esc(label)}</div><div class="v ${cls||''}">${esc(value)}</div>`; },
    renderLogs(el,rows){ if(!el)return; el.innerHTML=`<table><thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>IP</th><th>UA</th><th>ms</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtTime(r.time)}</td><td>${esc(r.method)}</td><td>${esc(r.path)}</td><td class="${r.status>=400?'bad':'ok'}">${r.status}</td><td>${esc(r.ip)}</td><td>${esc(r.ua)}</td><td class="num">${r.ms}</td></tr>`).join('')}</tbody></table>`; },
    renderAnomalies(el,items){ if(!el)return; el.innerHTML = (!items||!items.length)?`<div class="badge green">No anomalies</div>`:items.map(a=>`<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)"><span class="badge ${a.level||'medium'}">${a.type}</span><span>${esc(a.detail||a.path||a.ip||a.method||'')}</span></div>`).join(''); },
    renderStats(el,data){ if(!el)return; el.innerHTML=Object.entries(data).map(([k,v])=>`<div class="card"><div class="kx">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join(''); },
    renderMachines(el,items){ if(!el)return; el.innerHTML=items.map(m=>`<div class="card machine-poster"><div class="machine-poster"><img src="${m.image}" alt="${esc(m.name)}"/></div><div><div class="badge green">${esc(m.availability)}</div><h3>${esc(m.name)}</h3><p class="p">${esc(m.specs)}</p><div class="meta"><div><div class="kx">Hashrate</div><div class="val">${m.hash} ${esc(m.hashUnit)}</div></div><div><div class="kx">Power</div><div class="val">${m.power}W</div></div><div><div class="kx">J/TH</div><div class="val">${m.efficiency}</div></div></div></div></div>`).join(''); },
  };
})();
