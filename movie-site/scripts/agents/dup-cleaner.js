#!/usr/bin/env node
// Dup Cleaner + Organizer — scans FRANCHISES + cover_bank for dups, orphans, missing covers
// Adds timestamps to all records. Runs every 15 min. Auto-fixes issues.
const fs = require('fs');
const path = require('path');

const FRANCHISES_PATH = path.join(__dirname, '..', 'flix-ai.js');
const COVER_BANK_PATH = path.join(__dirname, '..', '..', 'data', 'cover_bank.json');
const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'flix-ai-cache.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'data', 'dup-fixes.json');

function readFranchises() {
  const content = fs.readFileSync(FRANCHISES_PATH, 'utf8');
  const entries = [];
  const franchiseRegex = /'([^']+)':\s*\{\s*type:\s*'(\w+)',[\s\S]*?ids:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = franchiseRegex.exec(content)) !== null) {
    const name = m[1];
    const type = m[2];
    const idsBlock = m[3];
    const idRegex = /\{[^}]*tmdb:\s*(\d+)[^}]*imdb:\s*'([^']+)'[^}]*title:\s*'([^']+)'[^}]*\}/g;
    let id;
    while ((id = idRegex.exec(idsBlock)) !== null) {
      entries.push({ franchise: name, type, tmdb: parseInt(id[1]), imdb: id[2], title: id[3] });
    }
  }
  return entries;
}

function readCoverBank() {
  try { return JSON.parse(fs.readFileSync(COVER_BANK_PATH, 'utf8')); }
  catch { return {}; }
}

function loadCacheImdbs() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const imdbs = new Set();
    // Handle { version, franchises: { Name: { items: [tt...] } } }
    if (raw.franchises) {
      for (const [, f] of Object.entries(raw.franchises)) {
        const list = f?.items || f?.ids || (Array.isArray(f) ? f : []);
        if (Array.isArray(list)) list.forEach(i => {
          const imdb = typeof i === 'string' ? i : i?.imdb;
          if (imdb) imdbs.add(imdb);
        });
        else if (f?.imdb) imdbs.add(f.imdb);
      }
    }
    return imdbs;
  } catch { return new Set(); }
}

function loadFixLog() {
  try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); }
  catch { return []; }
}

function saveFixLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log.slice(-200), null, 2));
}

// Add timestamps to cover_bank entries that don't have them
function addTimestamps(coverBank) {
  let patched = 0;
  const now = new Date().toISOString();
  for (const [imdb, entry] of Object.entries(coverBank)) {
    if (typeof entry !== 'object' || !entry) continue;
    if (!entry.addedAt) {
      entry.addedAt = now;
      patched++;
    }
  }
  return patched;
}

function run() {
  const entries = readFranchises();
  const coverBank = readCoverBank();
  const cacheImdbs = loadCacheImdbs();
  const fixLog = loadFixLog();
  const issues = [];

  // ── Timestamp patching ──
  const patched = addTimestamps(coverBank);
  if (patched > 0) {
    fs.writeFileSync(COVER_BANK_PATH, JSON.stringify(coverBank, null, 2));
    fixLog.push({ time: new Date().toISOString(), type: 'timestamps_added', count: patched });
  }

  // ── Check 1: Duplicate IMDB IDs in FRANCHISES ──
  const imdbCount = {};
  entries.forEach(e => {
    if (!imdbCount[e.imdb]) imdbCount[e.imdb] = [];
    imdbCount[e.imdb].push(e);
  });
  for (const [imdb, matches] of Object.entries(imdbCount)) {
    if (matches.length > 1) {
      issues.push(`DUP IMDB ${imdb}: ${matches.map(m => `${m.franchise}→${m.title}`).join(' | ')}`);
      fixLog.push({ time: new Date().toISOString(), type: 'dup_imdb', imdb, franchises: matches.map(m => m.franchise), action: 'flagged' });
    }
  }

  // ── Check 2: Duplicate TMDB IDs in FRANCHISES ──
  const tmdbCount = {};
  entries.forEach(e => {
    if (!tmdbCount[e.tmdb]) tmdbCount[e.tmdb] = [];
    tmdbCount[e.tmdb].push(e);
  });
  for (const [tmdb, matches] of Object.entries(tmdbCount)) {
    if (matches.length > 1 && parseInt(tmdb) > 0) {
      issues.push(`DUP TMDB ${tmdb}: ${matches.map(m => `${m.franchise}→${m.title}`).join(' | ')}`);
    }
  }

  // ── Check 3: Duplicate titles in same franchise ──
  const byFranchise = {};
  entries.forEach(e => {
    if (!byFranchise[e.franchise]) byFranchise[e.franchise] = [];
    byFranchise[e.franchise].push(e);
  });
  for (const [franchise, items] of Object.entries(byFranchise)) {
    const titleSet = new Set();
    for (const item of items) {
      const normTitle = item.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (titleSet.has(normTitle)) {
        issues.push(`DUP TITLE in ${franchise}: ${item.title} (${item.imdb})`);
      }
      titleSet.add(normTitle);
    }
  }

  // ── Check 4: Missing covers ──
  const coverImdbs = new Set(Object.keys(coverBank).filter(k => k.startsWith('tt')));
  const missingCovers = entries.filter(e => !coverImdbs.has(e.imdb));
  if (missingCovers.length > 0) {
    issues.push(`MISSING COVERS: ${missingCovers.length} entries without cover art`);
    missingCovers.slice(0, 10).forEach(e => issues.push(`  → ${e.franchise}: ${e.title} (${e.imdb})`));
  }

  // ── Check 5: Orphan covers ──
  const franchiseImdbs = new Set(entries.map(e => e.imdb));
  const orphans = Object.keys(coverBank).filter(k => k.startsWith('tt') && !franchiseImdbs.has(k));
  if (orphans.length > 0) {
    issues.push(`ORPHAN COVERS: ${orphans.length} covers with no FRANCHISE entry`);
    orphans.slice(0, 5).forEach(imdb => {
      const e = coverBank[imdb];
      if (e?.title) issues.push(`  → ${e.title} (${imdb})`);
    });
  }

  // ── Check 6: Duplicate poster URLs ──
  const posterUrls = {};
  for (const [imdb, entry] of Object.entries(coverBank)) {
    if (!entry?.poster) continue;
    if (!posterUrls[entry.poster]) posterUrls[entry.poster] = [];
    posterUrls[entry.poster].push(imdb);
  }
  for (const [url, imdbs] of Object.entries(posterUrls)) {
    if (imdbs.length > 2 && url.includes('metahub')) {
      issues.push(`DUP POSTER: ${url} × ${imdbs.length} entries`);
    }
  }

  // ── Check 7: Cache sync ──
  const notInCache = entries.filter(e => !cacheImdbs.has(e.imdb));
  if (notInCache.length > 0) {
    // Auto-populate cache with missing entries
    try {
      const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      if (!raw.franchises) raw.franchises = {};
      const byF = {};
      notInCache.forEach(e => {
        if (!byF[e.franchise]) byF[e.franchise] = new Set();
        byF[e.franchise].add(e.imdb);
      });
      let added = 0;
      for (const [franchise, imdbs] of Object.entries(byF)) {
        if (!raw.franchises[franchise]) {
          raw.franchises[franchise] = { type: entries.find(e => e.franchise === franchise)?.type || 'movie', items: [...imdbs], addedAt: new Date().toISOString() };
        } else {
          const existing = new Set(raw.franchises[franchise].items || raw.franchises[franchise].ids || []);
          [...imdbs].filter(i => !existing.has(i)).forEach(i => {
            const list = raw.franchises[franchise].items || raw.franchises[franchise].ids;
            if (list) list.push(i);
            added++;
          });
        }
      }
      raw.lastRun = new Date().toISOString();
      fs.writeFileSync(CACHE_PATH, JSON.stringify(raw, null, 2));
      fixLog.push({ time: new Date().toISOString(), type: 'cache_synced', added: notInCache.length });
      issues.push(`CACHE SYNCED: ${notInCache.length} entries auto-added to cache`);
    } catch (err) {
      issues.push(`NOT IN CACHE: ${notInCache.length} FRANCHISE entries (cache write failed: ${err.message})`);
      notInCache.slice(0, 5).forEach(e => issues.push(`  → ${e.franchise}: ${e.title} (${e.imdb})`));
    }
  }

  saveFixLog(fixLog);

  if (issues.length === 0) {
    console.log(`[DUP-CLEANER] ✅ All clean. ${entries.length} entries | ${coverImdbs.size} covers | ${patched} timestamps added. No issues.`);
    process.exit(0);
  }

  console.log(`[DUP-CLEANER] 🔍 ${issues.length} issue(s) in ${entries.length} entries:`);
  issues.forEach(i => console.log(`  ${i}`));
  console.log(`[DUP-CLEANER] ${patched} timestamps patched | ${orphans.length} orphans | ${missingCovers.length} missing covers | ${notInCache.length} not cached`);
}

run();