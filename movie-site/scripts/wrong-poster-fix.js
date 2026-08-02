#!/usr/bin/env node
// wrong-poster-fix.js — Fixes entries where poster IMDB ID doesn't match TMDB_TO_IMDB_MAP
// Also resolves numeric-only titles (#XXXX) to real titles via OMDb
// Cron: */5 * * * * node /home/ghost/cine-vault-movie-site/scripts/wrong-poster-fix.js >> /home/ghost/cine-vault-movie-site/data/wrong-poster-fix.log 2>&1

const https = require('https');
const fs = require('fs');

const BANKS = [
  '/home/ghost/cine-vault-movie-site/data/cover_bank.json',
  '/home/ghost/cine-vault-live/data/cover_bank.json',
];

// Extracted from server.js TMDB_TO_IMDB_MAP
const TMDB_TO_IMDB = (() => {
  const src = fs.readFileSync('/home/ghost/cine-vault-movie-site/server.js', 'utf8');
  const m = src.match(/const TMDB_TO_IMDB_MAP = \{([\s\S]*?)\n      \};/);
  if (!m) return {};
  const map = {};
  for (const [, k, v] of m[1].matchAll(/'(\d+)':\s*'(tt\d+)'/g)) map[k] = v;
  return map;
})();

function get(url) {
  return new Promise((res, rej) => {
    const req = https.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { rej(e); } });
    });
    req.on('error', rej);
    req.setTimeout(8000, () => { req.destroy(); rej(new Error('timeout')); });
  });
}

async function omdbLookup(imdbId) {
  try {
    const d = await get(`https://www.omdbapi.com/?apikey=trilogy&i=${imdbId}`);
    if (d.Response === 'True') return d;
  } catch(e) {}
  return null;
}

async function fixBank(bankPath) {
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  let fixed = 0;

  // Normalize all poster URLs: images.metahub.space -> live.metahub.space, small -> medium
  for (const [key, entry] of Object.entries(bank)) {
    if (!entry.poster) continue;
    let p = entry.poster;
    if (p.includes('images.metahub.space')) p = p.replace('images.metahub.space', 'live.metahub.space');
    if (p.includes('/poster/small/')) p = p.replace('/poster/small/', '/poster/medium/');
    if (p !== entry.poster) { entry.poster = p; entry.updatedAt = new Date().toISOString(); fixed++; }
  }

  for (const [key, entry] of Object.entries(bank)) {
    if (entry.redirect) continue;
    const tmdbId = String(entry.tmdbId || key.replace('tmdb_', ''));
    const correctImdb = TMDB_TO_IMDB[tmdbId];
    if (!correctImdb) continue;

    // Extract current IMDB ID from poster URL
    const currentImdb = entry.poster && entry.poster.match(/tt\d+/)?.[0];
    const isNumericTitle = /^#\d+$/.test(entry.title || '');
    const posterWrong = currentImdb && currentImdb !== correctImdb;

    if (!posterWrong && !isNumericTitle) continue;

    // Fetch correct info from OMDb
    const info = await omdbLookup(correctImdb);
    await new Promise(r => setTimeout(r, 300));

    if (!info) continue;

    const newPoster = `https://live.metahub.space/poster/medium/${correctImdb}/img`;

    if (posterWrong) {
      console.log(`[wrong-poster-fix] ${bankPath.includes('live') ? 'LIVE' : 'SITE'} Fixed poster: ${entry.title || key} | ${currentImdb} → ${correctImdb}`);
      entry.poster = newPoster;
      fixed++;
    }

    if (isNumericTitle && info.Title) {
      console.log(`[wrong-poster-fix] ${bankPath.includes('live') ? 'LIVE' : 'SITE'} Fixed title: ${entry.title} → ${info.Title}`);
      entry.title = info.Title;
      entry.year = entry.year || info.Year || '';
      if (!entry.poster) entry.poster = newPoster;
      fixed++;
    }

    entry.updatedAt = new Date().toISOString();
  }

  if (fixed) {
    fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2));
    console.log(`[wrong-poster-fix] ${bankPath.includes('live') ? 'LIVE' : 'SITE'} Fixed ${fixed} entries`);
  }
}

async function main() {
  for (const bank of BANKS) {
    await fixBank(bank);
  }
}

main().catch(e => console.error('[wrong-poster-fix] ERROR:', e.message));
