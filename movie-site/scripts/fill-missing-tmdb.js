// Fetch cover bank entries for TMDB IDs not yet in the bank
// Uses /api/auto-enrich which handles TMDB→IMDB lookup + Cinemeta fetch
// Usage: node scripts/fill-missing-tmdb.js

const fs = require('fs');
const path = require('path');

const COVER_BANK_FILE = path.join(__dirname, '../data/cover_bank.json');
const BASE_URL = 'http://localhost:8081';

// All TMDB IDs referenced in app.js / curated.js (extracted statically)
const GENRE_IDS = new Set([28,12,16,35,80,99,18,10751,14,36,27,10402,9648,10749,10769,10770,53,10752,37,878,10768,10759,10762,10763,10764,10765,10766,10767]);

function loadBank() {
  try { return JSON.parse(fs.readFileSync(COVER_BANK_FILE, 'utf8')); }
  catch { return {}; }
}

function saveBank(bank) {
  fs.writeFileSync(COVER_BANK_FILE, JSON.stringify(bank, null, 2), 'utf8');
}

function extractTmdbIds() {
  const ids = new Set();
  for (const fname of ['../js/app.js', '../js/curated.js']) {
    const src = fs.readFileSync(path.join(__dirname, fname), 'utf8');
    for (const [, id] of src.matchAll(/\b([1-9]\d{4,6})\b/g)) {
      const n = parseInt(id);
      if (!GENRE_IDS.has(n) && n > 1000) ids.add(String(n));
    }
  }
  return ids;
}

async function enrichTmdb(tmdbId, type = 'movie') {
  const url = `${BASE_URL}/api/auto-enrich?id=${tmdbId}&type=${type}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const bank = loadBank();
  const existing = new Set(Object.keys(bank).filter(k => k.startsWith('tmdb_')).map(k => k.replace('tmdb_', '')));
  const allIds = extractTmdbIds();
  const missing = [...allIds].filter(id => !existing.has(id));

  console.log(`Bank: ${Object.keys(bank).length} | Missing TMDB IDs: ${missing.length}`);

  let added = 0, failed = 0;

  for (const tmdbId of missing) {
    const key = `tmdb_${tmdbId}`;
    try {
      let result = await enrichTmdb(tmdbId, 'movie');
      if (!result?.poster && !result?.title) {
        result = await enrichTmdb(tmdbId, 'tv');
      }
      if (result?.title || result?.poster) {
        bank[key] = {
          poster: result.poster || `https://live.metahub.space/poster/medium/${result.imdb_id || ''}/img`,
          backdrop: result.backdrop || null,
          dvdCover: null,
          source: 'auto-enrich',
          tmdbId: parseInt(tmdbId),
          imdb_id: result.imdb_id || null,
          title: result.title || result.name || null,
          year: result.year ? String(result.year) : '',
          type: result.type || 'movie',
          updatedAt: new Date().toISOString(),
        };
        added++;
        process.stdout.write(`\r  Added ${added} | Failed ${failed} | ${result.title || result.name || tmdbId}`.padEnd(80));
        if (added % 20 === 0) saveBank(bank);
      } else {
        failed++;
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      failed++;
      process.stdout.write(`\r  Added ${added} | Failed ${failed} | ERR ${tmdbId}: ${e.message}`.padEnd(80));
    }
  }

  saveBank(bank);
  console.log(`\nDone. Added: ${added} | Failed: ${failed}`);
  console.log(`Bank now has ${Object.keys(bank).length} entries`);
}

main().catch(console.error);
