#!/usr/bin/env node
// CineVault Performance Maintenance — warms hot endpoints and records timings.
// Designed for PM2 cron: run briefly, write status JSON, exit.
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATUS_PATH = path.join(DATA_DIR, 'performance-maintenance-status.json');
const LOG_PATH = path.join(DATA_DIR, 'performance-maintenance.log');
const PORT = process.env.CINEVAULT_PORT || process.env.PORT || '8081';
const BASE_URL = process.env.CINEVAULT_BASE_URL || `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = Number(process.env.CINEVAULT_MAINT_TIMEOUT_MS || 12000);

const HOT_PATHS = [
  '/',
  '/css/style.css?v=354',
  '/css/components.css?v=354',
  '/js/config.js?v=353',
  '/js/curated.js?v=356',
  '/js/api.js?v=353',
  '/js/app.js?v=410',
  '/api/cover-bank?search=swordfish',
  '/api/cover-art?title=Swordfish&type=movie',
  '/api/cover-bank?search=matrix',
  '/api/cover-bank?search=batman',
];

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function log(message) {
  ensureDataDir();
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, `${line}\n`);
}

async function timeFetch(pathname) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${pathname}`, {
      headers: { 'User-Agent': 'CineVault-Performance-Maintenance/1.0' },
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      path: pathname,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      bytes: Buffer.byteLength(text),
    };
  } catch (error) {
    return {
      path: pathname,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      bytes: 0,
      error: error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  ensureDataDir();
  log(`performance maintenance start base=${BASE_URL}`);
  const results = [];
  for (const pathname of HOT_PATHS) {
    const result = await timeFetch(pathname);
    results.push(result);
    log(`${result.ok ? 'OK' : 'FAIL'} ${result.status} ${result.ms}ms ${result.bytes}b ${pathname}${result.error ? ` error=${result.error}` : ''}`);
  }

  const failed = results.filter(r => !r.ok);
  const slow = results.filter(r => r.ok && r.ms > 2500);
  const status = {
    updatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ok: failed.length === 0,
    failedCount: failed.length,
    slowCount: slow.length,
    results,
  };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  log(`performance maintenance done ok=${status.ok} failed=${failed.length} slow=${slow.length}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(error => {
  log(`fatal ${error.stack || error.message}`);
  process.exit(1);
});
