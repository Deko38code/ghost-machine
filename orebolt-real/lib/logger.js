const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const ACCESS_FILE = path.join(LOG_DIR, 'orebolt.log');
const SECURITY_FILE = path.join(LOG_DIR, 'security.jsonl');
const ANOMALY_FILE = path.join(LOG_DIR, 'anomalies.jsonl');

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.writeFileSync(ACCESS_FILE, '');
fs.writeFileSync(SECURITY_FILE, '');
fs.writeFileSync(ANOMALY_FILE, '');

function safeString(value, maxLength = 220) {
  try { return String(value || '').slice(0, maxLength); } catch { return 'unknown'; }
}

function logRequest(req, res, start = Date.now()) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const entry = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    method: req.method,
    path: safeString(req.url, 320),
    status: res.statusCode ?? 0,
    ip: safeString(ip),
    ua: safeString(req.headers['user-agent'], 260),
    referrer: safeString(req.headers.referer || req.headers.referrer, 260),
    ms: Date.now() - start,
  };
  fs.appendFileSync(ACCESS_FILE, JSON.stringify(entry) + '\n');
  return entry;
}

module.exports = { logRequest, ACCESS_FILE, SECURITY_FILE, ANOMALY_FILE };
