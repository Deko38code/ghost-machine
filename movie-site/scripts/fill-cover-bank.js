// Bulk-add missing TMDB IDs to cover_bank.json via Cinemeta title search
// Usage: node scripts/fill-cover-bank.js

const fs = require('fs');
const path = require('path');
const { https } = require('follow-redirects');

const COVER_BANK_FILE = path.join(__dirname, '../data/cover_bank.json');
const TMDB_EXPORT = '/tmp/tmdb_export_matches.json';

function loadBank() {
  try { return JSON.parse(fs.readFileSync(COVER_BANK_FILE, 'utf8')); }
  catch { return {}; }
}
function saveBank(bank) {
  fs.writeFileSync(COVER_BANK_FILE, JSON.stringify(bank, null, 2), 'utf8');
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CineVault/2.0' }, maxRedirects: 5, timeout: 10000 }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function cinemetaSearch(title, type = 'movie') {
  const q = encodeURIComponent(title);
  const url = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${q}.json`;
  const data = await httpsGet(url);
  return data?.metas || [];
}

async function cinemetaMeta(imdbId, type = 'movie') {
  const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
  const data = await httpsGet(url);
  return data?.meta || null;
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const bank = loadBank();
  const existing = new Set(Object.keys(bank).filter(k => k.startsWith('tmdb_')).map(k => k.replace('tmdb_', '')));

  // Load TMDB export matches (title + id)
  const tmdbMatches = JSON.parse(fs.readFileSync(TMDB_EXPORT, 'utf8'));
  const toProcess = Object.entries(tmdbMatches).filter(([id]) => !existing.has(id));

  console.log(`To process: ${toProcess.length}`);
  let added = 0, failed = 0;

  for (const [tmdbId, tmdbObj] of toProcess) {
    const title = tmdbObj.original_title || tmdbObj.title;
    const key = `tmdb_${tmdbId}`;
    try {
      // Search Cinemeta by title
      let metas = await cinemetaSearch(title, 'movie');
      if (!metas.length) metas = await cinemetaSearch(title, 'series');

      // Find best match by title similarity
      const match = metas.find(m => normalize(m.name) === normalize(title)) || metas[0];

      if (match?.imdb_id) {
        // Get full meta for poster
        const meta = await cinemetaMeta(match.imdb_id, metas[0] === match && metas[0]?.type === 'series' ? 'series' : 'movie');
        bank[key] = {
          poster: meta?.poster || match.poster || `https://live.metahub.space/poster/medium/${match.imdb_id}/img`,
          backdrop: meta?.background || null,
          dvdCover: null,
          source: 'cinemeta',
          tmdbId: parseInt(tmdbId),
          imdb_id: match.imdb_id,
          title: meta?.name || match.name || title,
          year: meta?.year ? String(meta.year) : '',
          type: meta?.type || 'movie',
          updatedAt: new Date().toISOString(),
        };
        added++;
        process.stdout.write(`\r  ${added} added | ${failed} failed | ${title}`.padEnd(80));
        if (added % 20 === 0) saveBank(bank);
      } else {
        // No Cinemeta match — store with metahub poster using title-based key
        failed++;
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      failed++;
      process.stdout.write(`\r  ${added} added | ${failed} failed | ERR: ${e.message}`.padEnd(80));
      await new Promise(r => setTimeout(r, 500));
    }
  }

  saveBank(bank);
  console.log(`\nDone. Added: ${added} | Failed: ${failed}`);
  console.log(`Bank now has ${Object.keys(bank).length} entries`);
}

main().catch(console.error);
