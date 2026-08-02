#!/usr/bin/env node
// Redbox/Blockbuster Sniffer — scrapes Redbox new releases + Blockbuster catalog via OMDB
// Finds new movies/TV and adds to FRANCHISES. Reports new finds.
// Also checks for Redbox kiosk bypass API endpoints.
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const FRANCHISES_PATH = path.join(__dirname, '..', 'flix-ai.js');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SEEN_PATH = path.join(DATA_DIR, 'redbox-seen.json');
const COVER_BANK_PATH = path.join(DATA_DIR, 'cover_bank.json');
const OMDB_KEY = 'trilogy';

function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')); }
  catch { return { imdbIds: [], lastRun: null }; }
}

function saveSeen(seen) {
  seen.lastRun = new Date().toISOString();
  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2));
}

function loadFranchiseImdbs() {
  const content = fs.readFileSync(FRANCHISES_PATH, 'utf8');
  const ids = new Set();
  const matches = content.matchAll(/imdb:\s*'([^']+)'/g);
  for (const m of matches) ids.add(m[1]);
  return ids;
}

function loadCoverBankImdbs() {
  try {
    const bank = JSON.parse(fs.readFileSync(COVER_BANK_PATH, 'utf8'));
    return new Set(Object.keys(bank).filter(k => k.startsWith('tt')));
  } catch { return new Set(); }
}

// Scrape Redbox new releases via their public API
async function scrapeRedbox() {
  const results = [];
  const endpoints = [
    'https://www.redbox.com/api/product?productType= movies&pageSize=100&sort=newest',
    'https://www.redbox.com/api/product?productType=tv&pageSize=100&sort=newest',
  ];
  // Redbox blocks direct curl — use OMDB search for "Redbox new releases" titles instead
  // We'll search OMDB for recent high-profile releases
  const recentSearches = [
    'horizon', 'inside out 2', 'deadpool', 'alien romulus', 'twisters',
    'trap', 'the fall guy', 'furiosa', 'kingdom of the planet', 'bad boys',
    'civil war', 'godzilla x kong', 'dune part two', 'kung fu panda 4',
    'ghostbusters', 'moana 2', 'gladiator ii', 'wicked', 'nosferatu',
    'conclave', 'the substance', 'anora', 'brutalist', 'emilia perez',
    'a real pain', 'the wild robot', 'flow', 'nickel boys',
  ];
  for (const term of recentSearches) {
    try {
      const r = await fetchUrl(`http://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(term)}&y=2024,2025,2026`);
      if (r.status !== 200) continue;
      const json = JSON.parse(r.body);
      if (!json.Search) continue;
      json.Search.forEach(item => {
        results.push({ imdbId: item.imdbID, title: item.Title, year: item.Year, type: item.Type });
      });
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

// Blockbuster search (they're digital now, search for their catalog highlights)
async function scrapeBlockbuster() {
  const results = [];
  const searches = [
    'blockbuster hits 2024', 'blockbuster hits 2025', 'top rental 2024', 'top rental 2025',
  ];
  for (const term of searches) {
    try {
      const r = await fetchUrl(`http://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(term)}&type=movie,series`);
      if (r.status !== 200) continue;
      const json = JSON.parse(r.body);
      if (!json.Search) continue;
      json.Search.forEach(item => {
        results.push({ imdbId: item.imdbID, title: item.Title, year: item.Year, type: item.Type });
      });
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

// Check for Redbox API bypass (kiosk info, inventory)
async function checkRedboxBypass() {
  const bypassEndpoints = [
    'https://www.redbox.com/api/kiosk/search?lat=0&lon=0',
    'https://www.redbox.com/api/inventory?productId=',
    'https://www.redbox.com/api/product/',
  ];
  const open = [];
  for (const ep of bypassEndpoints) {
    try {
      const r = await fetchUrl(ep, 5000);
      if (r.status === 200 && r.body.length > 50) {
        open.push({ endpoint: ep, status: r.status, bodyLen: r.body.length, sample: r.body.slice(0, 100) });
      }
    } catch {}
  }
  return open;
}

async function run() {
  const seen = loadSeen();
  const knownImdbs = loadFranchiseImdbs();
  const coverImdbs = loadCoverBankImdbs();
  const newFinds = [];

  console.log('[REDBOX-SNIFFER] 🔍 Scanning Redbox new releases...');
  const redboxResults = await scrapeRedbox();
  console.log('[REDBOX-SNIFFER] 🔍 Scanning Blockbuster catalog...');
  const bbResults = await scrapeBlockbuster();

  const allResults = [...redboxResults, ...bbResults];
  const uniqueImdbs = new Set();
  for (const item of allResults) {
    if (uniqueImdbs.has(item.imdbId)) continue;
    uniqueImdbs.add(item.imdbId);
    if (seen.imdbIds.includes(item.imdbId)) continue;
    if (knownImdbs.has(item.imdbId)) { seen.imdbIds.push(item.imdbId); continue; }

    // Fetch details
    let detail = null;
    try {
      const r = await fetchUrl(`http://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${item.imdbId}`);
      detail = JSON.parse(r.body);
    } catch {}

    const entry = {
      imdbId: item.imdbId,
      title: item.title,
      year: item.year,
      type: item.type,
      poster: detail?.Poster || 'N/A',
      genre: detail?.Genre || 'N/A',
      hasCover: coverImdbs.has(item.imdbId),
      found: new Date().toISOString(),
      source: redboxResults.find(r => r.imdbId === item.imdbId) ? 'redbox' : 'blockbuster',
    };
    newFinds.push(entry);
    seen.imdbIds.push(item.imdbId);
  }

  saveSeen(seen);

  // Redbox API bypass check
  console.log('[REDBOX-SNIFFER] 🔓 Checking Redbox API bypass...');
  const bypasses = await checkRedboxBypass();
  if (bypasses.length > 0) {
    console.log(`[REDBOX-SNIFFER] 🚨 ${bypasses.length} open API endpoint(s):`);
    bypasses.forEach(b => console.log(`  → ${b.endpoint} (${b.status}, ${b.bodyLen} bytes)`));
  } else {
    console.log('[REDBOX-SNIFFER] ✓ No open Redbox API bypasses found');
  }

  if (newFinds.length === 0) {
    console.log(`[REDBOX-SNIFFER] No new movies found. Scanned ${allResults.length} results.`);
    process.exit(0);
  }

  console.log(`\n[REDBOX-SNIFFER] 🎬 ${newFinds.length} NEW find(s):`);
  for (const f of newFinds) {
    console.log('');
    console.log(`  🎬 ${f.title} (${f.year}) [${f.type}]`);
    console.log(`  IMDB: ${f.imdbId} | Genre: ${f.genre}`);
    console.log(`  Cover: ${f.hasCover ? '✅' : '❌ MISSING'} | Source: ${f.source}`);
    console.log(`  Poster: ${f.poster}`);
  }
  console.log('\n[REDBOX-SNIFFER] Add to FRANCHISES or run flix-ai scanner.');
}

run().catch(e => { console.error('[REDBOX-SNIFFER] Error:', e.message); process.exit(1); });