#!/usr/bin/env node
// Star Wars Sniffer — detects new Star Wars content (movies/TV) via OMDB
// Runs every 20 min. Reports new finds. Adds timestamps to all records.
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const FRANCHISES_PATH = path.join(__dirname, '..', 'flix-ai.js');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SEEN_PATH = path.join(DATA_DIR, 'sw-seen.json');
const COVER_BANK_PATH = path.join(DATA_DIR, 'cover_bank.json');
const CACHE_PATH = path.join(DATA_DIR, 'flix-ai-cache.json');
const OMDB_KEY = 'trilogy';

// Only search for terms that are distinctly Star Wars
// Generic words like "Rebels", "Lando", "Acolyte" pull in tons of false positives
const SEARCH_TERMS = [
  'Star Wars', 'Mandalorian', 'Ahsoka', 'Andor Star',
  'Obi-Wan Kenobi', 'Boba Fett', 'Skeleton Crew Star',
  'Bad Batch Star', 'Clone Wars', 'Star Wars Rebels',
  'Tales of the Jedi', 'Rogue Squadron Star',
  'Dawn of the Jedi', 'The Acolyte Star', 'Lando Star Wars',
];

// Title MUST contain "star wars" OR one of these specific SW compound phrases
// This filters out fan films, talk-shows, LEGO parodies, and unrelated movies
const REQUIRED_PHRASES = [
  'star wars', 'the mandalorian', 'ahsoka', 'obi-wan',
  'boba fett', 'clone wars', 'bad batch', 'rogue one',
  'skeleton crew', 'tales of the jedi', 'acolyte',
];

// Genres to EXCLUDE — fan films, reactions, talk-shows, LEGO parodies
const EXCLUDE_GENRES = ['talk-show', 'short', 'documentary'];
const EXCLUDE_TITLE_WORDS = ['fan film', 'fan-made', 'fan animation', 'reaction', 'lego', 'lego the',
  'behind the scene', 'making of', 'disney gallery', 'blind wave', 'recon', 'deleted scene',
  'declassified', 'patterson cut', 'unleashed', 'daddy strikes', 'trouble wif',
  'idiotic', 'cheap', 'angry birds', 'spelling bee', 'celebrity bowling',
  'zero hour', 'mandalorian legacy', 'canopy', 'bighead',
  'wrath of the mandalorian', 'shadow of the mandalorian', 'forsaken'];

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

async function searchOMDB(term, type) {
  // OMDB type param only accepts single type: movie, series, episode
  try {
    const url = `http://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(term)}&type=${type}`;
    const r = await fetchUrl(url);
    if (r.status !== 200) return [];
    const json = JSON.parse(r.body);
    if (!json.Search) return [];
    return json.Search.filter(item => {
      const t = (item.Title || '').toLowerCase();
      // Must match a required SW phrase
      const matchesRequired = REQUIRED_PHRASES.some(kw => t.includes(kw));
      if (!matchesRequired) return false;
      // Exclude junk titles
      if (EXCLUDE_TITLE_WORDS.some(ex => t.includes(ex))) return false;
      return true;
    }).map(item => ({
      imdbId: item.imdbID,
      title: item.Title,
      year: item.Year,
      type: item.Type, // "movie" or "series"
    }));
  } catch { return []; }
}

async function getOMDBDetail(imdbId) {
  try {
    const r = await fetchUrl(`http://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`);
    if (r.status !== 200) return null;
    return JSON.parse(r.body);
  } catch { return null; }
}

function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')); }
  catch { return { imdbIds: [], addedAt: {} }; }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2));
}

function loadFranchiseImdbs() {
  const content = fs.readFileSync(FRANCHISES_PATH, 'utf8');
  const known = new Set();
  for (const m of content.matchAll(/imdb:\s*'([^']+)'/g)) known.add(m[1]);
  return known;
}

// Add timestamp to records that don't have one
function addTimestampsToCache() {
  let cache;
  try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return; }

  let modified = false;
  const now = new Date().toISOString();

  // Add lastRun timestamp if missing
  if (!cache.lastRun) { cache.lastRun = now; modified = true; }

  // Add timestamps to franchises
  if (cache.franchises) {
    for (const [name, f] of Object.entries(cache.franchises)) {
      if (!f.addedAt) { f.addedAt = now; modified = true; }
      if (!f.lastChecked) { f.lastChecked = now; modified = true; }
    }
  }

  // Add timestamps + IDs to items
  if (cache.items) {
    for (const [imdb, item] of Object.entries(cache.items)) {
      if (!item.addedAt) { item.addedAt = now; modified = true; }
      if (!item.imdbId && imdb.startsWith('tt')) { item.imdbId = imdb; modified = true; }
      if (!item.franchise) { item.franchise = 'Unknown'; modified = true; }
    }
  }

  if (modified) {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`[SW-SNIFFER] Added timestamps to cache records.`);
  }
}

function addTimestampsToCoverBank() {
  let bank;
  try { bank = JSON.parse(fs.readFileSync(COVER_BANK_PATH, 'utf8')); }
  catch { return; }

  let modified = false;
  const now = new Date().toISOString();

  for (const [key, entry] of Object.entries(bank)) {
    if (typeof entry !== 'object' || !entry.title) continue;
    if (!entry.addedAt) { entry.addedAt = now; modified = true; }
    if (!entry.imdbId && key.startsWith('tt')) { entry.imdbId = key; modified = true; }
    if (!entry.imdb && key.startsWith('tt')) { entry.imdb = key; modified = true; }
  }

  if (modified) {
    fs.writeFileSync(COVER_BANK_PATH, JSON.stringify(bank, null, 2));
    console.log(`[SW-SNIFFER] Added timestamps/IDs to cover bank records.`);
  }
}

async function run() {
  // Step 1: Add timestamps to existing data
  addTimestampsToCache();
  addTimestampsToCoverBank();

  // Step 2: Sniff for new Star Wars content
  const seen = loadSeen();
  if (!seen.addedAt) seen.addedAt = {};
  const knownImdbs = loadFranchiseImdbs();
  const newFinds = [];

  for (const term of SEARCH_TERMS) {
    // Search movies AND series separately (OMDB requirement)
    for (const type of ['movie', 'series']) {
      const results = await searchOMDB(term, type);
      for (const item of results) {
        if (seen.imdbIds.includes(item.imdbId)) continue;
        if (knownImdbs.has(item.imdbId)) {
          seen.imdbIds.push(item.imdbId);
          seen.addedAt[item.imdbId] = new Date().toISOString();
          continue;
        }

        const detail = await getOMDBDetail(item.imdbId);
        if (detail?.Response === 'False') continue;

        // Filter by genre — skip documentaries, talk-shows, shorts
        const genre = (detail?.Genre || '').toLowerCase();
        if (EXCLUDE_GENRES.some(g => genre.includes(g))) {
          seen.imdbIds.push(item.imdbId);
          seen.addedAt[item.imdbId] = new Date().toISOString();
          continue;
        }

        // Filter by type — skip "episode" type
        if (item.type === 'episode') continue;

        const entry = {
          imdbId: item.imdbId,
          title: item.title,
          year: item.year,
          type: item.type,
          poster: detail?.Poster || 'N/A',
          plot: detail?.Plot?.slice(0, 150) || 'N/A',
          genre: detail?.Genre || 'N/A',
          foundAt: new Date().toISOString(),
        };
        newFinds.push(entry);
        seen.imdbIds.push(item.imdbId);
        seen.addedAt[item.imdbId] = new Date().toISOString();
      }
      await new Promise(r => setTimeout(r, 350)); // Rate limit
    }
  }

  saveSeen(seen);

  if (newFinds.length === 0) {
    console.log(`[SW-SNIFFER] No new Star Wars content found. Watching ${SEARCH_TERMS.length} search terms.`);
    process.exit(0);
  }

  console.log(`[SW-SNIFFER] 🌟 ${newFinds.length} NEW Star Wars find(s)!`);
  for (const f of newFinds) {
    console.log('');
    console.log(`  🎬 ${f.title} (${f.year})`);
    console.log(`  IMDB: ${f.imdbId} | Type: ${f.type} | Genre: ${f.genre}`);
    console.log(`  Poster: ${f.poster}`);
    if (f.plot !== 'N/A') console.log(`  Plot: ${f.plot}...`);
    const franchiseKey = f.type === 'series' ? 'Star Wars TV' : 'Star Wars';
    console.log(`  → Add to FRANCHISES under '${franchiseKey}': { tmdb: 0, imdb: '${f.imdbId}', title: '${f.title.replace(/'/g, "\\'")}' }`);
    console.log(`  Found at: ${f.foundAt}`);
  }
}

run().catch(e => { console.error('[SW-SNIFFER] Error:', e.message); process.exit(1); });