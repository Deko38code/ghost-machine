// Orebolt — fleet dashboard server (static + API + logging + anomaly detection)
// Orebolt — fleet dashboard server (static + API + logging + anomaly detection) (pm2, Dell)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8214', 10);
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const LOGS = path.join(ROOT, 'logs');
const ACCESS_LOG = path.join(LOGS, 'orebolt-access.jsonl');
const SECURITY_LOG = path.join(LOGS, 'orebolt-security.jsonl');
const REQUEST_LOG = path.join(LOGS, 'requests.jsonl');

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });
[ACCESS_LOG, SECURITY_LOG, REQUEST_LOG].forEach(p => { if (!fs.existsSync(p)) fs.writeFileSync(p, ''); });

// ---------- helpers ----------
function appendLog(f, v) { try { fs.appendFileSync(f, JSON.stringify(v) + '\n'); } catch {} }
function safeSend(res, code, body, type = 'application/json') {
  const payload = Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(payload);
}
function logRequest(req, res, start = Date.now()) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const entry = {
    id: crypto.randomUUID(), time: new Date().toISOString(), method: req.method,
    path: req.url?.split('?')[0] || '/', status: res.statusCode ?? 0, ip,
    ua: (req.headers['user-agent'] || 'unknown').slice(0, 200), ms: Date.now() - start
  };
  appendLog(REQUEST_LOG, entry);
  return entry;
}
function getRecentLogs(limit = 200) {
  try { return fs.readFileSync(REQUEST_LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse().map(JSON.parse); }
  catch { return []; }
}

// ---------- machine catalog (real spec-sheet numbers) ----------
const KWH = 0.06;           // demo energy price $/kWh
const RENT_MARKUP = 1.35;   // demo hosting margin factor
const MACHINES = [
  { id:'s19-pro',       name:'Antminer S19 Pro',       brand:'Bitmain',  model:'S19 Pro',       th:110, w:3250, jth:29.5, qty:3, avail:'stock'  },
  { id:'s19j-pro',      name:'Antminer S19j Pro',      brand:'Bitmain',  model:'S19j Pro',      th:104, w:3068, jth:29.5, qty:4, avail:'stock'  },
  { id:'s19-xp',        name:'Antminer S19 XP',        brand:'Bitmain',  model:'S19 XP',        th:141, w:3010, jth:21.5, qty:2, avail:'rental' },
  { id:'s19-xp-hydro',  name:'Antminer S19 XP Hydro',  brand:'Bitmain',  model:'S19 XP Hydro',  th:198, w:5445, jth:27.5, qty:1, avail:'rental' },
  { id:'s21',           name:'Antminer S21',           brand:'Bitmain',  model:'S21',           th:200, w:3500, jth:17.5, qty:2, avail:'stock'  },
  { id:'s21-pro',       name:'Antminer S21 Pro',       brand:'Bitmain',  model:'S21 Pro',       th:234, w:3510, jth:15.0, qty:2, avail:'rental' },
  { id:'s21-xp',        name:'Antminer S21 XP',        brand:'Bitmain',  model:'S21 XP',        th:270, w:3645, jth:13.5, qty:1, avail:'rental' },
  { id:'s21-hydro',     name:'Antminer S21 Hydro',     brand:'Bitmain',  model:'S21 Hydro',     th:335, w:5360, jth:16.0, qty:0, avail:'planned'},
  { id:'t19',           name:'Antminer T19',           brand:'Bitmain',  model:'T19',           th:84,  w:3150, jth:37.5, qty:2, avail:'stock'  },
  { id:'m30s-pp',       name:'Whatsminer M30S++',      brand:'MicroBT',  model:'M30S++',        th:112, w:3472, jth:31.0, qty:3, avail:'stock'  },
  { id:'m50',           name:'Whatsminer M50',         brand:'MicroBT',  model:'M50',           th:118, w:3268, jth:27.7, qty:2, avail:'rental' },
  { id:'a1466',         name:'AvalonMiner A1466',      brand:'Canaan',   model:'A1466',         th:150, w:3250, jth:21.7, qty:2, avail:'rental' },
  { id:'nmaxe',         name:'NMAxe (BM1366)',         brand:'Orebolt',  model:'NMAxe',         th:0.5, w:20,   jth:40,   qty:3, avail:'owned'  },
  { id:'nmaxe-gamma',   name:'NMAxe Gamma (BM1370)',   brand:'Orebolt',  model:'NMAxe Gamma',   th:0.8, w:22,   jth:27.5, qty:2, avail:'owned'  },
  { id:'nmqaxe',        name:'NMQAxe++ (ESP32-S3)',    brand:'Orebolt',  model:'NMQAxe++',      th:0.7, w:18,   jth:25.7, qty:1, avail:'planned'}
].map(m => ({
  ...m,
  specs: m.th >= 1 ? `${m.th} TH/s · ${m.w} W · ${m.jth} J/TH` : `${m.th * 1000} GH/s · ${m.w} W · ${m.jth} J/TH`,
  rentEstPerThDay: +(m.jth * 24 / 1000 * KWH * RENT_MARKUP).toFixed(3),
  rentEstPerUnitDay: +(m.th * m.jth * 24 / 1000 * KWH * RENT_MARKUP).toFixed(2),
  dayKwhPerTh: +(m.jth * 24 / 1000).toFixed(2)
}));

// ---------- server-side live telemetry (SIMULATED, pool-ready) ----------
const units = [];
for (const m of MACHINES) {
  for (let i = 0; i < m.qty; i++) {
    units.push({
      mid: m.id, idx: i + 1, spec: m.th,
      drift: (Math.random() * 0.04 - 0.02),
      temp: 52 + Math.random() * 8, fan: 60 + Math.random() * 25
    });
  }
}
function tickTelemetry() {
  for (const u of units) {
    u.drift = Math.max(-0.035, Math.min(0.035, u.drift + (Math.random() * 0.008 - 0.004)));
    u.hash = u.spec * (1 + u.drift);
    u.temp = Math.max(45, Math.min(78, u.temp + (Math.random() * 1.6 - 0.8)));
    u.fan = Math.max(45, Math.min(100, u.fan + (Math.random() * 3 - 1.5) + (u.temp > 65 ? 0.6 : u.temp < 55 ? -0.6 : 0)));
    u.status = u.spec > 0 ? 'online' : 'offline';
  }
}
tickTelemetry();
setInterval(tickTelemetry, 1000);

function liveUnitTempAvg(mid) {
  const us = units.filter(u => u.mid === mid);
  return us.length ? us.reduce((s, u) => s + u.temp, 0) / us.length : 0;
}
function telemetrySnapshot() {
  const models = MACHINES.map(m => {
    const us = units.filter(u => u.mid === m.id);
    const online = us.length;
    const liveTH = us.reduce((s, u) => s + (u.hash ?? 0), 0);
    return {
      id: m.id, name: m.name, brand: m.brand, model: m.model,
      specTH: m.th, qty: us.length, online, liveTH: +liveTH.toFixed(1),
      liveUnitTH: online ? +(liveTH / online).toFixed(2) : 0,
      specW: m.w, jth: m.jth, avail: m.avail,
      temp: online ? +liveUnitTempAvg(m.id).toFixed(1) : 0,
      fan: online ? +((us.reduce((s, u) => s + u.fan, 0)) / online).toFixed(1) : 0,
      specs: m.specs
    };
  });
  const fleetTH = units.reduce((s, u) => s + (u.hash ?? 0), 0);
  const powerW = MACHINES.reduce((s, m) => s + (units.some(u => u.mid === m.id) ? m.w * m.qty : 0), 0);
  return {
    time: new Date().toISOString(), mode: 'sim',
    fleetTH: +fleetTH.toFixed(1), powerW,
    effJth: fleetTH > 0 ? +(powerW / fleetTH).toFixed(1) : 0,
    unitsOnline: units.length, unitsTotal: units.length,
    unitsOnlineNow: units.filter(u => (u.hash ?? 0) > 0).length,
    avgTemp: +(units.reduce((s, u) => s + u.temp, 0) / units.length).toFixed(1),
    avgFan: +(units.reduce((s, u) => s + u.fan, 0) / units.length).toFixed(0),
    models
  };
}

// ---------- pool hook (flips to real data when data/pool.json is configured) ----------
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
async function poolStatus() {
  const cfg = readJSON(path.join(DATA, 'pool.json'));
  if (!cfg?.provider || !cfg?.apiUrl) return { ok: false, reason: 'not-configured' };
  try {
    const headers = {}; if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
    const r = await fetch(cfg.apiUrl, { headers });
    const data = await r.json();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { ok: true, data };
  } catch (e) { return { ok: false, reason: 'pool_request_failed', error: String(e) }; }
}

// ---------- anomaly detection ----------
function getSecuritySummary() {
  const logs = getRecentLogs(5000).reverse();
  const now = Date.now();
  const last1m = logs.filter(l => now - Date.parse(l.time) < 60_000);
  const last5m = logs.filter(l => now - Date.parse(l.time) < 300_000);
  const last24h = logs.filter(l => now - Date.parse(l.time) < 86_400_000);
  const ipCounts = new Map(), pathCounts = new Map(), ip404 = new Map(), anomalies = [];
  let score = 0;
  const suspiciousPaths = ['/admin', '.php', '.env', 'wp-', '/cgi-bin', '%2e', '..', '/actuator', '/.git'];
  for (const l of last24h) {
    ipCounts.set(l.ip, (ipCounts.get(l.ip) || 0) + 1);
    pathCounts.set(l.path, (pathCounts.get(l.path) || 0) + 1);
    const p = l.path.toLowerCase();
    if (suspiciousPaths.some(s => p.includes(s))) {
      score += 7; anomalies.push({ type: 'suspicious_path', level: 'high', ip: l.ip, path: l.path });
    }
    if (l.status === 404) ip404.set(l.ip, (ip404.get(l.ip) || 0) + 1);
    const quietStub = (l.path === '/api/pool/stats' || l.path === '/auth/google');
    if (!quietStub && l.status >= 500) { score += 4; anomalies.push({ type: 'server_error', level: 'medium', ip: l.ip, path: l.path, status: l.status }); }
    else if (!quietStub && l.status >= 400) { score += 2; anomalies.push({ type: 'client_error', level: 'low', ip: l.ip, path: l.path, status: l.status }); }
    if (l.ms > 1500) { score += 3; anomalies.push({ type: 'slow_request', level: 'low', ip: l.ip, path: l.path, ms: l.ms }); }
    if (['TRACE', 'CONNECT', 'OPTIONS'].includes(l.method) && l.path !== '*') {
      score += 5; anomalies.push({ type: 'method_anomaly', level: 'medium', ip: l.ip, method: l.method });
    }
  }
  for (const [ip, c] of ip404) if (c > 25) { score += 20; anomalies.push({ type: 'scan_storm', level: 'high', ip, count404: c }); }
  for (const [ip, count] of ipCounts) {
    if (count > 250) { score += Math.min(30, (count - 250) / 5); anomalies.push({ type: 'ip_burst', level: 'high', ip, count }); }
    else if (count > 100) { score += 10; anomalies.push({ type: 'ip_spike', level: 'medium', ip, count }); }
  }
  if (last1m.length > 120) { score += 12; anomalies.push({ type: 'rate_anomaly', level: 'medium', req1m: last1m.length }); }
  const syb = sybilReport();
  score += Math.min(30, syb.findings.length * 4);
  // persist high-level events with cooldown
  try {
    const recent = fs.readFileSync(SECURITY_LOG, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).slice(-80);
    const seen = new Set();
    for (const a of anomalies.filter(a => a.level === 'high')) {
      const key = `${a.type}|${a.ip || ''}`;
      if (seen.has(key)) continue;
      const dup = recent.find(r => `${r.type}|${r.ip || ''}` === key && now - Date.parse(r.time) < 300_000);
      if (!dup) appendLog(SECURITY_LOG, { ...a, time: new Date().toISOString() });
      seen.add(key);
    }
  } catch {}
  const events = (() => { try { return fs.readFileSync(SECURITY_LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-40).reverse().map(JSON.parse); } catch { return []; } })();
  return {
    sybil: syb,
    generatedAt: new Date().toISOString(),
    totalRequests: logs.length, last24h: last24h.length, last5m: last5m.length, last1m: last1m.length,
    errors: logs.filter(l => l.status >= 400).length,
    topIps: [...ipCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, count]) => ({ ip, count })),
    topPaths: [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([p, count]) => ({ path: p, count })),
    risk: score > 70 ? 'high' : score > 35 ? 'medium' : 'low',
    score: Math.round(score), anomalies: anomalies.slice(0, 50), events
  };
}


// ---------- client IP / soft IP-auth gate ----------
function normIp(ip){ return (ip && typeof ip==='string' && ip.startsWith('::ffff:')) ? ip.slice(7) : ip; }
function clientIp(req){ return normIp(((req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown')); }
let AUTH={enabled:false,allowedIps:[]};
function readAuth(){ try{ const a=readJSON(path.join(DATA,'auth.json')); if(a&&typeof a==='object') AUTH=a; }catch{} return AUTH; }

// ---------- live BTC price (CoinGecko, cached 60s) ----------
let priceCache={t:0,data:null};
async function btcPrice(){
  const now=Date.now();
  if(priceCache.data&&now-priceCache.t<60000&&!priceCache.data.error) return priceCache.data;
  try{
    const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true');
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    const out={ok:true,usd:d.bitcoin.usd,change24h:d.bitcoin.usd_24h_change,updated:new Date().toISOString(),source:'coingecko'};
    priceCache={t:now,data:out}; return out;
  }catch(e){
    if(priceCache.data&&!priceCache.data.error) return {...priceCache.data,stale:true};
    return {ok:false,error:'coingecko_unreachable'};
  }
}

// ---------- bitcoin network stats (mempool.space, cached 5min) ----------
let netCache={t:0,data:null};
async function btcNet(){
  const now=Date.now();
  if(netCache.data&&now-netCache.t<300000&&!netCache.data.error) return netCache.data;
  try{
    const [tip,adj,fees]=await Promise.all([
      fetch('https://mempool.space/api/blocks/tip/height').then(r=>r.text()),
      fetch('https://mempool.space/api/v1/difficulty-adjustment').then(r=>r.json()),
      fetch('https://mempool.space/api/v1/fees/recommended').then(r=>r.json())
    ]);
    const out={ok:true,tipHeight:parseInt(tip,10)||null,retarget:adj,fees,updated:new Date().toISOString(),source:'mempool.space'};
    netCache={t:now,data:out}; return out;
  }catch(e){
    if(netCache.data&&!netCache.data.error) return netCache.data;
    return {ok:false,error:'mempool_unreachable'};
  }
}


// ---------- session / multi-account (sybil) tracking ----------
const SESSIONS_LOG = path.join(LOGS, 'sessions.jsonl');
if (!fs.existsSync(SESSIONS_LOG)) fs.writeFileSync(SESSIONS_LOG, '');
const SESS = new Map(); // clientId -> {ips:Set, uas:Set, first, last, reqs}
function hydrateSessions(){
  try {
    for (const e of fs.readFileSync(SESSIONS_LOG,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)) {
      let s = SESS.get(e.id);
      if (!s) { s = { ips:new Set(), uas:new Set(), first:e.t, last:e.t, reqs:0 }; SESS.set(e.id, s); }
      s.ips.add(e.ip); s.uas.add(String(e.ua||'').slice(0,60)); s.last = e.t; s.reqs++;
    }
  } catch {}
}
hydrateSessions();
function sessionTouch(cid, ip, ua){
  let s = SESS.get(cid);
  const first = !s;
  if (!s) { s = { ips:new Set(), uas:new Set(), first:new Date().toISOString(), last:'', reqs:0 }; SESS.set(cid, s); }
  const newIp = !s.ips.has(ip);
  s.ips.add(ip); s.uas.add(String(ua||'unknown').slice(0,60));
  s.reqs++; s.last = new Date().toISOString();
  if (first || (newIp && s.ips.size < 12)) {
    appendLog(SESSIONS_LOG, { id:cid, ip, ua:String(ua||'').slice(0,80), t:s.last, type:first?'new':'ip_change' });
  }
}
function sybilReport(){
  const findings = [];
  const byIp = new Map(); // ip -> Set(clientIds)
  for (const [cid, s] of SESS) {
    for (const ip of s.ips) {
      if (!byIp.has(ip)) byIp.set(ip, new Set());
      byIp.get(ip).add(cid);
    }
  }
  for (const [ip, cids] of byIp) {
    if (cids.size > 1) findings.push({ type:'multi_accounts_same_ip', level:cids.size>3?'high':'medium', ip, accounts:cids.size, sample:[...cids].slice(0,6).map(c=>c.slice(0,8)) });
  }
  for (const [cid, s] of SESS) {
    if (s.ips.size > 2) findings.push({ type:'account_multi_ip', level:s.ips.size>4?'high':'medium', clientId:cid.slice(0,8), ips:s.ips.size });
    if (s.uas.size > 1) findings.push({ type:'fingerprint_mismatch', level:'high', clientId:cid.slice(0,8), uas:[...s.uas].slice(0,3) });
  }
  try {
    const lines = fs.readFileSync(SESSIONS_LOG,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
      .filter(e => e.type==='new' && Date.now()-Date.parse(e.t) < 3600000);
    const perIp = new Map();
    for (const e of lines) perIp.set(e.ip, (perIp.get(e.ip)||0)+1);
    for (const [ip, n] of perIp) if (n > 5) findings.push({ type:'account_farm', level:'high', ip, newAccounts1h:n });
  } catch {}
  const sessions = [...SESS.entries()].slice(-50).reverse().map(([cid, s]) => ({
    clientId: cid.slice(0, 10), ips: [...s.ips], uas: [...s.uas].slice(0, 2).map(u => u.slice(0, 50)), first: s.first, last: s.last, reqs: s.reqs
  }));
  return {
    accounts: SESS.size,
    sameIpGroups: [...byIp.entries()].filter(([,s])=>s.size>1).map(([ip,s])=>({ip, accounts:s.size})),
    multiIp: [...SESS.entries()].filter(([,s])=>s.ips.size>1).map(([cid,s])=>({ clientId:cid.slice(0,8), ips:s.ips.size })).slice(0,10),
    findings: findings.slice(0, 40),
    sessions
  };
}
// ---------- favicon (kills 404 noise) ----------
const FAVICON = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#0b0f16"/><path d="M13 4 7 12h4l-1 8 7-10h-4.5L13 4Z" fill="#f5b400"/></svg>');

// ---------- static ----------
function serveStatic(req, res, url, start) {
  let p = decodeURIComponent(url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.resolve(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(ROOT)) return safeSend(res, 403, { ok: false, error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) {
      return safeSend(res, 404, { ok: false, error: 'not_found' });
    }
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' }[path.extname(file)] || 'application/octet-stream';
    safeSend(res, 200, data, mime);
  });
}

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const url = req.url.split('?')[0];
  let logged=false;
  const logOnce=()=>{ if(!logged){ logged=true; logRequest(req,res,start); } };
  res.on('finish', logOnce);
  try {
    const auth=readAuth();
    const gateIp=normIp(req.socket?.remoteAddress)||'unknown';
    if(auth.enabled && !(Array.isArray(auth.allowedIps)?auth.allowedIps:[]).includes(gateIp) && !url.startsWith('/auth/')){
      logOnce();
      return safeSend(res,403,{ok:false,error:'ip_not_allowed',ip:gateIp,hint:'your IP is shown in `ip` — the operator must add it to data/auth.json'});
    }
    const rawCid = String(req.headers['x-client-id'] || '');
    if (/^[A-Za-z0-9\-]{8,64}$/.test(rawCid)) sessionTouch(rawCid, gateIp, (req.headers['user-agent']||'unknown'));
    if (url === '/api/machines') return safeSend(res, 200, MACHINES);
    if (url === '/api/telemetry') return safeSend(res, 200, telemetrySnapshot());
    if (url === '/api/health') return safeSend(res, 200, { ok: true, time: new Date().toISOString(), uptime: Math.round(process.uptime()) });
    if (url === '/api/security') return safeSend(res, 200, getSecuritySummary());
    if (url === '/api/logs') {
      const lim = Math.min(300, parseInt(new URL(req.url, 'http://x').searchParams.get('limit') || '200', 10) || 200);
      return safeSend(res, 200, getRecentLogs(lim));
    }
    if (url === '/api/pool/stats') {
      const s = await poolStatus();
      return safeSend(res, s.ok ? 200 : 503, s);
    }
    if (url === '/api/btcprice') return safeSend(res, 200, await btcPrice());
    if (url === '/api/btcnet') return safeSend(res, 200, await btcNet());
    if (url === '/api/clientinfo') {
      const ip = normIp(req.socket?.remoteAddress)||'unknown';
      const a = readAuth();
      return safeSend(res, 200, {
        ip, allowed:( Array.isArray(a.allowedIps)?a.allowedIps:[] ).includes(ip),
        gate:!!a.enabled, forwardedFor:(req.headers['x-forwarded-for']||null),
        ua:(req.headers['user-agent']||'').slice(0,200), time:new Date().toISOString()
      });
    }
    if (url === '/auth/google') return safeSend(res, 501, { ok:false, error:'google_oauth_not_wired_yet', hint:'wire later' });
    if (url === '/api/sessions') return safeSend(res, 200, sybilReport());
    if (url === '/favicon.ico' || url === '/favicon.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }); return res.end(FAVICON); }
    return serveStatic(req, res, req.url, start);
  } catch (e) {
    logRequest(req, res, start);
    return safeSend(res, 500, { ok: false, error: 'server_error' });
  } finally {
    if (!res.writableEnded) res.on('finish', () => logRequest(req, res, start));
  }
});

server.listen(PORT, () => console.log(`Orebolt fleet dashboard http://localhost:${PORT}`));
