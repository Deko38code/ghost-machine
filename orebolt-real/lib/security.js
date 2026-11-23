const fs = require('fs');
const path = require('path');
const ACCESS_FILE = path.join(__dirname, '..', 'logs', 'orebolt.log');
const ANOMALY_FILE = path.join(__dirname, '..', 'logs', 'anomalies.jsonl');

function readAccessLog() {
  try {
    return fs.readFileSync(ACCESS_FILE, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  } catch { return []; }
}

function computeRisk(score) {
  if (score >= 70) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function analyzeLogs() {
  const logs = readAccessLog();
  const now = Date.now();
  const last1m = logs.filter(l => now - new Date(l.time).getTime() < 60_000);
  const last5m = logs.filter(l => now - new Date(l.time).getTime() < 5 * 60_000);
  const last24h = logs.filter(l => now - new Date(l.time).getTime() < 24 * 60 * 60_000);
  const errors = last24h.filter(l => l.status >= 400);

  const ipCounts = new Map();
  const pathCounts = new Map();
  const methodCounts = new Map();
  for (const l of last24h) {
    ipCounts.set(l.ip, (ipCounts.get(l.ip) || 0) + 1);
    pathCounts.set(l.path, (pathCounts.get(l.path) || 0) + 1);
    methodCounts.set(l.method, (methodCounts.get(l.method) || 0) + 1);
  }

  let score = 0;
  const anomalies = [];

  for (const [ip, count] of ipCounts) {
    if (count > 80) { score += 30; anomalies.push({ type: 'rate_burst', level: 'high', ip, count }); }
    else if (count > 25) { score += 10; anomalies.push({ type: 'rate_spike', level: 'medium', ip, count }); }
  }

  if (errors.length >= 8) { score += Math.min(25, errors.length * 2); anomalies.push({ type: 'errors', level: errors.length >= 30 ? 'high' : 'medium', count: errors.length }); }

  for (const l of last24h) {
    const p = (l.path || '').toLowerCase();
    if (p.includes('..') || p.includes('%2e') || p.includes('/admin') || p.includes('//') || p.includes('/api/admin')) { score += 7; anomalies.push({ type: 'suspicious_path', level: 'high', path: l.path, ip: l.ip }); }
    if (!['GET','POST','HEAD','OPTIONS','PUT','DELETE'].includes(l.method)) { score += 12; anomalies.push({ type: 'suspicious_method', level: 'high', method: l.method, ip: l.ip }); }
    if (p.includes('sqlmap') || p.includes('.env') || p.includes('wp-')) { score += 15; anomalies.push({ type: 'scanner', level: 'high', path: l.path, ip: l.ip }); }
  }

  if (last1m.length > 80) { score += 20; anomalies.push({ type: 'recent_burst', level: 'high', count: last1m.length }); }

  const risk = computeRisk(score);
  return {
    time: new Date().toISOString(),
    totalRequests: logs.length,
    last24h: last24h.length,
    last5m: last5m.length,
    last1m: last1m.length,
    errors: errors.length,
    score,
    risk,
    topIps: [...ipCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ip,count])=>({ip,count})),
    topPaths: [...pathCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([path,count])=>({path,count})),
    methods: [...methodCounts.entries()].map(([method,count])=>({method,count})),
    anomalies,
  };
}

module.exports = { analyzeLogs, readAccessLog };
