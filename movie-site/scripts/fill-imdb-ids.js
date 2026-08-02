#!/usr/bin/env node
// Backfill missing imdbId in cover_bank.json using server TMDB map + Cinemeta
const fs = require('fs');
const https = require('https');
const path = require('path');

const BANK = path.join(__dirname, '../data/cover_bank.json');
const SERVER_JS = path.join(__dirname, '../server.js');

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CineVault/2.0' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('parse fail')); }
      });
    }).on('error', reject).setTimeout(10000, function() { this.destroy(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Extract TMDB→IMDB map from server.js
function loadServerMap() {
  const src = fs.readFileSync(SERVER_JS, 'utf8');
  const match = src.match(/TMDB_TO_IMDB_MAP\s*=\s*\{([^}]+)\}/s);
  if (!match) return {};
  const map = {};
  for (const [, k, v] of match[1].matchAll(/'(\d+)'\s*:\s*'(tt\d+)'/g)) map[k] = v;
  return map;
}

async function cinemetaImdb(tmdbId, type = 'movie') {
  // Cinemeta catalog lookup by TMDB ID
  try {
    const d = await getJson(`https://v3-cinemeta.strem.io/meta/${type}/tmdb${tmdbId}.json`);
    return d?.meta?.imdb_id || d?.meta?.id || null;
  } catch { return null; }
}

async function main() {
  const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  const serverMap = loadServerMap();
  console.log(`Server TMDB map: ${Object.keys(serverMap).length} entries`);

  const entries = Object.entries(bank).filter(([, v]) => !v.imdbId && v.tmdbId);
  console.log(`Entries needing imdbId: ${entries.length}`);

  let fixed = 0, failed = 0;

  for (const [key, entry] of entries) {
    const tmdbId = String(entry.tmdbId);

    // 1. Try server TMDB map first (instant)
    let imdbId = serverMap[tmdbId] || null;

    // 2. Try Cinemeta lookup
    if (!imdbId) {
      imdbId = await cinemetaImdb(tmdbId, 'movie') || await cinemetaImdb(tmdbId, 'series');
      if (imdbId) await sleep(150);
    }

    if (imdbId && /^tt\d+$/.test(imdbId)) {
      entry.imdbId = imdbId;
      entry.poster = `https://live.metahub.space/poster/medium/${imdbId}/img`;
      fixed++;
      console.log(`+ ${entry.title} → ${imdbId}`);
    } else {
      failed++;
    }
  }

  fs.writeFileSync(BANK, JSON.stringify(bank, null, 2));
  console.log(`\nFixed: ${fixed} | Failed: ${failed} | Total: ${Object.keys(bank).length}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
