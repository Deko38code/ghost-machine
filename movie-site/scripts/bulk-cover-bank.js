// Bulk-populate cover_bank.json from Cinemeta for all TMDB IDs in TMDB_TO_IMDB_MAP
// Usage: node scripts/bulk-cover-bank.js

const fs = require('fs');
const path = require('path');

const SERVER_JS = path.join(__dirname, '../server.js');
const COVER_BANK_FILE = path.join(__dirname, '../data/cover_bank.json');

// Parse TMDB_TO_IMDB_MAP from server.js
function loadMap() {
  const src = fs.readFileSync(SERVER_JS, 'utf8');
  const m = src.match(/const TMDB_TO_IMDB_MAP\s*=\s*\{([\s\S]*?)\};/);
  if (!m) throw new Error('TMDB_TO_IMDB_MAP not found');
  const map = {};
  for (const [, tmdb, imdb] of m[1].matchAll(/['"]?(\d+)['"]?\s*:\s*['"]?(tt\d+)['"]?/g)) {
    map[tmdb] = imdb;
  }
  return map;
}

function loadBank() {
  try { return JSON.parse(fs.readFileSync(COVER_BANK_FILE, 'utf8')); }
  catch { return {}; }
}

function saveBank(bank) {
  fs.writeFileSync(COVER_BANK_FILE, JSON.stringify(bank, null, 2), 'utf8');
}

async function fetchCinemeta(imdbId, type = 'movie') {
  const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json();
  return data.meta || null;
}

async function main() {
  const map = loadMap();
  const bank = loadBank();
  const entries = Object.entries(map);
  console.log(`Map: ${entries.length} entries | Bank: ${Object.keys(bank).length} entries`);

  let added = 0, skipped = 0, failed = 0;

  for (const [tmdbId, imdbId] of entries) {
    const key = `tmdb_${tmdbId}`;
    if (bank[key]?.title && bank[key]?.poster) { skipped++; continue; }

    try {
      let meta = await fetchCinemeta(imdbId, 'movie');
      let type = 'movie';
      if (!meta) { meta = await fetchCinemeta(imdbId, 'series'); type = 'tv'; }
      if (!meta) { failed++; console.log(`  FAIL ${imdbId}`); continue; }

      bank[key] = {
        poster: meta.poster || `https://live.metahub.space/poster/medium/${imdbId}/img`,
        backdrop: meta.background || null,
        dvdCover: null,
        source: 'cinemeta',
        tmdbId: parseInt(tmdbId),
        imdb_id: imdbId,
        title: meta.name,
        year: meta.year ? String(meta.year) : '',
        type,
        updatedAt: new Date().toISOString(),
      };
      added++;
      process.stdout.write(`\r  Added ${added} | Skipped ${skipped} | Failed ${failed} | ${meta.name}`.padEnd(80));

      // Save every 20 entries
      if (added % 20 === 0) saveBank(bank);

      // Rate limit
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      failed++;
      console.log(`\n  ERROR ${imdbId}: ${e.message}`);
    }
  }

  saveBank(bank);
  console.log(`\nDone. Added: ${added} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`Bank now has ${Object.keys(bank).length} entries`);
}

main().catch(console.error);
