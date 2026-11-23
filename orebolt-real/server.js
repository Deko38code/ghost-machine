const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8215', 10);
const ROOT = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const LOGS = path.join(__dirname, 'logs');
const ACCESS_LOG = path.join(LOGS, 'orebolt-access.jsonl');
const SECURITY_LOG = path.join(LOGS, 'orebolt-security.jsonl');
const REQUEST_LOG = path.join(DATA, 'requests.jsonl');

fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

function ensureFile(p){ if(!fs.existsSync(p)) fs.writeFileSync(p,''); }
[ACCESS_LOG, SECURITY_LOG, REQUEST_LOG].forEach(ensureFile);

function readJSON(f){ try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch{ return null; } }
function writeJSON(f,v){ fs.writeFileSync(f, JSON.stringify(v,null,2)); }
function appendLog(f,v){ fs.appendFileSync(f, JSON.stringify(v)+'\n'); }
function safeSend(res,code,body,type='application/json'){
  const payload = typeof body==='string'?body:JSON.stringify(body);
  res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});
  res.end(payload);
}
function logRequest(req,res,start=Date.now()){
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const entry = {
    id: crypto.randomUUID(), time:new Date().toISOString(), method:req.method,
    path:req.url?.split('?')[0]||'/', status:res.statusCode ?? 0,
    ip, ua:(req.headers['user-agent']||'unknown').slice(0,220), ms:Date.now()-start
  };
  appendLog(REQUEST_LOG, entry);
  return entry;
}
function getRecentLogs(limit=200){
  try{ return fs.readFileSync(REQUEST_LOG,'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse().map(JSON.parse); }catch{ return []; }
}
function getSecuritySummary(){
  const logs=getRecentLogs(5000).reverse();
  const now=Date.now();
  const last1m=logs.filter(l=>now-Date.parse(l.time)<60_000);
  const last5m=logs.filter(l=>now-Date.parse(l.time)<300_000);
  const last24h=logs.filter(l=>now-Date.parse(l.time)<86_400_000);
  const ipCounts=new Map(), pathCounts=new Map(), methodCounts=new Map(), anomalies=[];
  let score=0;
  for(const l of last24h){
    ipCounts.set(l.ip,(ipCounts.get(l.ip)||0)+1);
    pathCounts.set(l.path,(pathCounts.get(l.path)||0)+1);
    methodCounts.set(l.method,(methodCounts.get(l.method)||0)+1);
    const p=l.path.toLowerCase();
    if(p.includes('..')||p.includes('%2e')||p.includes('/admin')||p.includes('//')){score+=7;anomalies.push({type:'suspicious_path',level:'high',ip:l.ip,path:l.path});}
    if(l.status>=500){score+=4;anomalies.push({type:'server_error',level:'medium',ip:l.ip,path:l.path,status:l.status});}
    if(l.status>=400&&l.status<500){score+=2;anomalies.push({type:'client_error',level:'low',ip:l.ip,path:l.path,status:l.status});}
  }
  for(const [ip,count] of ipCounts){
    if(count>40){score+=Math.min(30,(count-40)/2);anomalies.push({type:'ip_burst',level:'high',ip,count});}
    else if(count>15){score+=10;anomalies.push({type:'ip_spike',level:'medium',ip,count});}
  }
  const paths=[...pathCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15);
  const methods=[...methodCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  return {
    generatedAt:new Date().toISOString(),
    totalRequests:logs.length, last24h:last24h.length, last5m:last5m.length, last1m:last1m.length,
    errors:logs.filter(l=>l.status>=400).length,
    topIps:[...ipCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ip,count])=>({ip,count})),
    topPaths:paths.map(([path,count])=>({path,count})),
    methods:methods.map(([method,count])=>({method,count})),
    risk: score>70?'high':score>35?'medium':'low',
    score: Math.round(score), anomalies
  };
}
async function poolStatus(){
  const cfg=readJSON(path.join(DATA,'pool.json'));
  if(!cfg?.provider || !cfg?.apiUrl) return {ok:false, reason:'not-configured'};
  try{
    const headers={}; if(cfg.apiToken) headers.Authorization=`Bearer ${cfg.apiToken}`;
    const r=await fetch(cfg.apiUrl,{headers});
    const data=await r.json();
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return {ok:true,data};
  }catch(e){ return {ok:false, reason:'pool_request_failed', error:String(e)}; }
}

const machines=[
  { id:'antminer-s19-pro', name:'Antminer S19 Pro', model:'S19 Pro', brand:'Bitmain', hash:110, hashUnit:'TH/s', power:3250, efficiency:29.5, availability:'available', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'110TH/s · 3250W · SHA-256 ASIC' },
  { id:'antminer-s19j-pro', name:'Antminer S19j Pro', model:'S19j Pro', brand:'Bitmain', hash:104, hashUnit:'TH/s', power:3068, efficiency:29.5, availability:'available', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'104TH/s · 3068W · SHA-256 ASIC' },
  { id:'antminer-s19-xp', name:'Antminer S19 XP', model:'S19 XP', brand:'Bitmain', hash:141, hashUnit:'TH/s', power:3010, efficiency:21.3, availability:'rental', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'141TH/s · 3010W · SHA-256 ASIC' },
  { id:'antminer-s19-hydro', name:'Antminer S19 XP Hydro', model:'S19 XP Hydro', brand:'Bitmain', hash:198, hashUnit:'TH/s', power:4468, efficiency:22.6, availability:'rental', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'198TH/s · 4468W · SHA-256 ASIC' },
  { id:'antminer-t19', name:'Antminer T19', model:'T19', brand:'Bitmain', hash:84, hashUnit:'TH/s', power:3150, efficiency:37.5, availability:'available', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'84TH/s · 3150W · SHA-256 ASIC' },
  { id:'whatsminer-m30s-plus', name:'Whatsminer M30S+', model:'M30S+', brand:'MicroBT', hash:100, hashUnit:'TH/s', power:3400, efficiency:34.0, availability:'available', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'100TH/s · 3400W · SHA-256 ASIC' },
  { id:'whatsminer-m30s-plus-plus', name:'Whatsminer M30S++', model:'M30S++', brand:'MicroBT', hash:112, hashUnit:'TH/s', power:3472, efficiency:31.0, availability:'rental', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'112TH/s · 3472W · SHA-256 ASIC' },
  { id:'auruminer-1246', name:'AvalonMiner 1246', model:'1246', brand:'Canaan', hash:90, hashUnit:'TH/s', power:3420, efficiency:38.0, availability:'available', image:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Antminer_S9.jpg/1024px-Antminer_S9.jpg', specs:'90TH/s · 3420W · SHA-256 ASIC' },
  { id:'nmaxe', name:'NMAxe', model:'NMAxe', brand:'Bitmain', hash:500, hashUnit:'GH/s', power:20, efficiency:40, availability:'available', image:'', specs:'500GH/s · 20W · SHA-256 ASIC' },
  { id:'nmaxe-gamma', name:'NMAxe Gamma', model:'NMAxe Gamma', brand:'Bitmain', hash:800, hashUnit:'GH/s', power:22, efficiency:27.5, availability:'available', image:'', specs:'800GH/s · 22W · SHA-256 ASIC' },
  { id:'nmqaxe', name:'NMQAxe++', model:'NMQAxe++', brand:'Bitmain', hash:700, hashUnit:'GH/s', power:18, efficiency:25.7, availability:'limited', image:'', specs:'700GH/s · 18W · SHA-256 ASIC' }
];
const machineSpecs=machines;

const server=http.createServer(async(req,res)=>{
  const start=Date.now();
  const url=req.url.split('?')[0];
  let status=200;
  try{
    if(url==='/api/machines') return safeSend(res,200,machineSpecs);
    if(url==='/api/health') return safeSend(res,200,{ok:true,time:new Date().toISOString(),uptime:process.uptime()});
    if(url==='/api/site') return safeSend(res,200,readJSON(path.join(DATA,'site.json'))||{});
    if(url==='/api/stats') return safeSend(res,200,getSecuritySummary());
    if(url==='/api/security') return safeSend(res,200,getSecuritySummary());
    if(url==='/api/logs') return safeSend(res,200,getRecentLogs());
    if(url==='/api/pool/stats'){
      const s=await poolStatus(); status=s.ok?200:503;
      return safeSend(res,status,s);
    }
    const file= url==='/' ? 'index.html' : url.substring(1);
    const safeFile=file.replace(/[^a-zA-Z0-9_\/.\\-]/g,'');
    if(safeFile.includes('..')){ status=403; return safeSend(res,403,{ok:false,error:'forbidden'}); }
    const filePath=path.join(ROOT,safeFile);
    if(!filePath.startsWith(ROOT)){ status=403; return safeSend(res,403,{ok:false,error:'forbidden'}); }
    fs.readFile(filePath,(err,data)=>{
      if(err){ status=404; return safeSend(res,404,{ok:false,error:'not_found'}); }
      const ext=path.extname(filePath).toLowerCase();
      const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[ext]||'text/plain';
      return safeSend(res,200,data,mime);
    });
  }catch(e){
    status=500;
    return safeSend(res,500,{ok:false,error:'server_error'});
  }finally{
    res.on('finish',()=>logRequest(req,res,start));
  }
});

server.listen(PORT,()=>console.log(`Orebolt real server http://localhost:${PORT}`));
