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

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

function ensureFile(path) {
  if (!fs.existsSync(path)) fs.writeFileSync(path, '');
}
ensureFile(ACCESS_LOG);
ensureFile(SECURITY_LOG);

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}
function writeJSON(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function appendLog(file, value) {
  fs.appendFileSync(file, JSON.stringify(value) + '\n');
}
function safeSend(res, code, body, type = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}
function logRequest(req, res, start = Date.now()) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const entry = {
    id: crypto.randomUUID(),
    time: new Date(start).toISOString(),
    method: req.method,
    path: req.url?.split('?')[0] || '/',
    status: res.statusCode ?? 0,
    ip,
    ua: (req.headers['user-agent'] || 'unknown').slice(0, 220),
    ms: Date.now() - start,
  };
  appendLog(ACCESS_LOG, entry);
  return entry;
}
function appendSecurityEvent(event) {
  appendLog(SECURITY_LOG, { ...event, time: new Date().toISOString() });
}

async function poolStatus() {
  const cfg = readJSON(path.join(DATA, 'pool.json'));
  if (!cfg?.provider || !cfg?.apiUrl) return { ok: false, reason: 'not-configured' };
  try {
    const headers = {};
    if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
    const r = await fetch(cfg.apiUrl, { headers });
    const data = await r.json();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, reason: 'pool_request_failed', error: String(error) };
  }
}

function getRecentLogs(limit = 200) {
  try {
    const lines = fs.readFileSync(ACCESS_LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).reverse();
    return lines.map(l => JSON.parse(l));
  } catch (error) {
    return [];
  }
}

function getSecuritySummary() {
  const logs = getRecentLogs(5000).reverse();
  const now = Date.now();
  const last1m = logs.filter(l => now - Date.parse(l.time) < 60_000);
  const last5m = logs.filter(l => now - Date.parse(l.time) < 300_000);
  const last24h = logs.filter(l => now - Date.parse(l.time) < 86_400_000);
  const ipCounts = new Map();
  const pathCounts = new Map();
  const methodCounts = new Map();
  const anomalies = [];
  let score = 0;
  for (const l of last24h) {
    ipCounts.set(l.ip, (ipCounts.get(l.ip) || 0) + 1);
    pathCounts.set(l.path, (pathCounts.get(l.path) || 0) + 1);
    methodCounts.set(l.method, (methodCounts.get(l.method) || 0) + 1);
  }
  for (const [ip, count] of ipCounts) {
    if (count > 40) { score += Math.min(30, (count - 40) / 2); anomalies.push({ type: 'ip_burst', level: 'high', ip, count }); }
    else if (count > 15) { score += 10; anomalies.push({ type: 'ip_spike', level: 'medium', ip, count }); }
  }
  const paths = [...pathCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 15);
  const methods = [...methodCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 10);
  return {
    generatedAt: new Date().toISOString(),
    totalRequests: logs.length,
    last24h: last24h.length,
    last5m: last5m.length,
    last1m: last1m.length,
    errors: logs.filter(l => l.status >= 400).length,
    topIps: [...ipCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ip,count])=>({ip,count})),
    topPaths: paths.map(([path,count])=>({path,count})),
    methods: methods.map(([method,count])=>({method,count})),
    risk: score > 70 ? 'high' : score > 35 ? 'medium' : 'low',
    score: Math.round(score),
    anomalies,
  };
}

const machineSpecs = [
  { name: 'NMAxe', hash: 0, hashUnit: 'GH/s', hashRaw: 500, power: 80, efficiency: 160, availability: 'available' },
  { name: 'NMAxe Gamma', hash: 0, hashUnit: 'GH/s', hashRaw: 800, power: 110, efficiency: 137, availability: 'available' },
  { name: 'NMQAxe++', hash: 0, hashUnit: 'GH/s', hashRaw: 700, power: 75, efficiency: 107, availability: 'limited' }
];

server = http.createServer(async (req, res) => {
  const start = Date.now();
  const url = req.url.split('?')[0];
  let status = 200;
  try {
    if (url === '/api/machines') {
      return safeSend(res, 200, machines);
    }
    if (url === '/api/health') {
      const body = { ok: true, time: new Date().toISOString(), uptime: process.uptime() };
      return safeSend(res, 200, body);
    }
    if (url === '/api/site') return safeSend(res, 200, readJSON(path.join(DATA, 'site.json')) || {});
    if (url === '/api/pool/stats') {
      const data = await poolStatus();
      status = data.ok ? 200 : 503;
      return safeSend(res, status, data);
    }
    if (url === '/api/security') return safeSend(res, 200, getSecuritySummary());
    if (url === '/api/logs') return safeSend(res, 200, getRecentLogs());

    const filePath = path.join(ROOT, decodeURIComponent(url).replace(/^\/(api|logs|security)/, ''));
    if (!filePath.startsWith(ROOT)) {
      status = 403;
      return safeSend(res, 403, { ok: false, error: 'forbidden' });
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        status = 404;
        return safeSend(res, 404, { ok: false, error: 'not_found' });
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }[ext] || 'text/plain';
      return safeSend(res, 200, data, mime);
    });
  } catch (error) {
    status = 500;
    return safeSend(res, 500, { ok: false, error: 'server_error' });
  } finally {
    res.on('finish', () => logRequest(req, res, start));
  }
});

server.listen(PORT, () => console.log(`Orebolt real server http://localhost:${PORT}`));