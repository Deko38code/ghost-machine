#!/usr/bin/env node
// Season Watchdog — refreshes new movies, poster art, and TV season counts.
// Designed for PM2 cron: short run, update JSON, exit.
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const COVER_BANK_PATH = path.join(DATA_DIR, 'cover_bank.json');
const STATUS_PATH = path.join(DATA_DIR, 'season-watchdog-status.json');
const LOG_PATH = path.join(DATA_DIR, 'season-watchdog.log');

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';
const WATCH_INTERVAL_HINT = 'PM2 cron controls schedule';
const CATALOG_PAGE_SIZE = 100;
const CATALOG_PAGES = 3;
const CURRENT_YEAR = new Date().getFullYear();
const DISCOVERY_CATALOGS = [
  { type: 'movie', id: 'year', extra: `genre=${CURRENT_YEAR}` },
  { type: 'movie', id: 'year', extra: `genre=${CURRENT_YEAR - 1}` },
  { type: 'movie', id: 'top', extra: '' },
  { type: 'series', id: 'year', extra: `genre=${CURRENT_YEAR}` },
  { type: 'series', id: 'top', extra: '' },
];

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, `${line}\n`);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function episodeCountValue(value) {
  if (value && typeof value === 'object') return numberValue(value.episode_count || value.count || value.episodes);
  return numberValue(value);
}

function normalizeImdb(entry, key) {
  if (entry.imdbId) return entry.imdbId;
  if (entry.imdb) return entry.imdb;
  if (entry.imdb_id) return entry.imdb_id;
  if (/^tt\d+$/i.test(key)) return key;
  return null;
}

function isTvEntry(entry) {
  return entry && !entry.redirect && (
    entry.type === 'tv' ||
    entry.type === 'series' ||
    entry.franchise === 'The Boys' ||
    entry.seasons
  );
}

function getSeasonCounts(videos) {
  const counts = {};
  for (const video of videos || []) {
    const season = Number(video.season);
    const episode = Number(video.episode || video.number);
    if (!isPositiveInt(season) || !isPositiveInt(episode)) continue;
    counts[season] = Math.max(counts[season] || 0, episode);
  }
  return counts;
}

function setSeasonCount(merged, season, incomingCount) {
  const existing = merged[season];
  const existingCount = episodeCountValue(existing);
  const count = Math.max(existingCount, incomingCount);
  if (!isPositiveInt(count)) return;

  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    merged[season] = { ...existing, episode_count: count };
  } else {
    merged[season] = count;
  }
}

function mergeSeasonCounts(existing, incoming) {
  const merged = { ...(existing || {}) };
  for (const [season, count] of Object.entries(incoming || {})) {
    const seasonNum = Number(season);
    const countNum = numberValue(count);
    if (!isPositiveInt(seasonNum) || !isPositiveInt(countNum)) continue;
    setSeasonCount(merged, String(seasonNum), countNum);
  }
  return merged;
}

function totalEpisodes(seasons) {
  return Object.values(seasons || {}).reduce((sum, count) => {
    const n = episodeCountValue(count);
    return sum + (isPositiveInt(n) ? n : 0);
  }, 0);
}

function displaySeasonCounts(seasons) {
  const out = {};
  for (const [season, count] of Object.entries(seasons || {})) {
    const seasonNum = Number(season);
    const countNum = episodeCountValue(count);
    if (isPositiveInt(seasonNum) && isPositiveInt(countNum)) out[String(seasonNum)] = countNum;
  }
  return out;
}

function posterLargeFromSmall(url) {
  return typeof url === 'string' ? url.replace('/poster/small/', '/poster/large/') : '';
}

function keyForMeta(meta) {
  const imdbId = meta.imdb_id || meta.imdbId || meta.id;
  if (/^tt\d+$/i.test(imdbId || '')) return imdbId;
  if (meta.moviedb_id) return `tmdb_${meta.moviedb_id}`;
  return null;
}

function findExistingKey(bank, meta) {
  const imdbId = meta.imdb_id || meta.imdbId || (/^tt\d+$/i.test(meta.id || '') ? meta.id : null);
  const tmdbId = meta.moviedb_id || meta.tmdbId || null;
  const directKey = keyForMeta(meta);
  if (directKey && bank[directKey]) return directKey;
  for (const [key, entry] of Object.entries(bank)) {
    if (!entry) continue;
    if (imdbId && normalizeImdb(entry, key) === imdbId) return key;
    if (tmdbId && String(entry.tmdbId || '').replace(/^tmdb_/, '') === String(tmdbId)) return key;
  }
  return directKey;
}

function normalizeMetaEntry(meta, fallbackType) {
  const imdbId = meta.imdb_id || meta.imdbId || (/^tt\d+$/i.test(meta.id || '') ? meta.id : null);
  const tmdbId = meta.moviedb_id || meta.tmdbId || null;
  return {
    poster: meta.poster || (imdbId ? `${CINEMETA_BASE.replace('v3-cinemeta.strem.io', 'images.metahub.space')}/poster/small/${imdbId}/img` : null),
    backdrop: meta.background || (imdbId ? `https://images.metahub.space/background/medium/${imdbId}/img` : null),
    dvdCover: posterLargeFromSmall(meta.poster) || null,
    source: 'cinemeta-auto',
    tmdbId: tmdbId || imdbId,
    title: meta.name || meta.title || imdbId || String(tmdbId || ''),
    year: String(meta.year || meta.releaseInfo || '').slice(0, 4),
    type: meta.type === 'series' || fallbackType === 'series' ? 'tv' : 'movie',
    imdbId,
    imdb: imdbId,
    genre: Array.isArray(meta.genre || meta.genres) ? (meta.genre || meta.genres).join(', ') : (meta.genre || ''),
    description: meta.description || '',
    rating: meta.imdbRating || meta.rating || '',
    updatedAt: new Date().toISOString(),
  };
}

function mergeArt(target, meta) {
  let changed = false;
  const poster = meta.poster || '';
  const backdrop = meta.background || '';
  const dvdCover = posterLargeFromSmall(poster);
  if (poster && target.poster !== poster) { target.poster = poster; changed = true; }
  if (backdrop && target.backdrop !== backdrop) { target.backdrop = backdrop; changed = true; }
  if (dvdCover && target.dvdCover !== dvdCover) { target.dvdCover = dvdCover; changed = true; }
  if (meta.moviedb_id && !target.tmdbId) { target.tmdbId = meta.moviedb_id; changed = true; }
  if ((meta.imdb_id || meta.id) && !target.imdbId) { target.imdbId = meta.imdb_id || meta.id; changed = true; }
  if (meta.name && !target.title) { target.title = meta.name; changed = true; }
  return changed;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CineVaultSeasonWatchdog/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchCinemeta(type, imdbId) {
  const url = `${CINEMETA_BASE}/meta/${type}/${encodeURIComponent(imdbId)}.json`;
  const data = await fetchJson(url);
  return data.meta || data;
}

async function discoverFreshCatalogs(bank, status) {
  let changed = false;
  for (const catalog of DISCOVERY_CATALOGS) {
    for (let page = 0; page < CATALOG_PAGES; page++) {
      const skip = page * CATALOG_PAGE_SIZE;
      const extras = [catalog.extra, skip ? `skip=${skip}` : ''].filter(Boolean).join('&');
      const extraPath = extras ? `/${extras}` : '';
      const url = `${CINEMETA_BASE}/catalog/${catalog.type}/${catalog.id}${extraPath}.json`;
      try {
        const data = await fetchJson(url);
        const metas = data.metas || [];
        status.catalogs.push({ type: catalog.type, id: catalog.id, extra: extras || null, count: metas.length });
        if (!metas.length) break;

        for (const meta of metas) {
          const key = findExistingKey(bank, meta);
          if (!key) continue;
          const existing = bank[key];
          if (!existing) {
            bank[key] = normalizeMetaEntry(meta, catalog.type);
            status.added++;
            changed = true;
            continue;
          }
          if (mergeArt(existing, meta)) {
            existing.updatedAt = new Date().toISOString();
            status.artUpdated++;
            changed = true;
          }
        }
      } catch (error) {
        status.errors.push(`catalog ${catalog.type}/${catalog.id}: ${error.message}`);
      }
    }
  }
  return changed;
}

async function run() {
  const bank = readJson(COVER_BANK_PATH, {});
  const status = {
    lastRun: new Date().toISOString(),
    schedule: WATCH_INTERVAL_HINT,
    checked: 0,
    updated: 0,
    added: 0,
    artUpdated: 0,
    errors: [],
    shows: [],
    catalogs: [],
  };

  let dirty = await discoverFreshCatalogs(bank, status);
  const seen = new Set();

  for (const [key, entry] of Object.entries(bank)) {
    if (!isTvEntry(entry)) continue;
    const imdbId = normalizeImdb(entry, key);
    if (!imdbId || seen.has(imdbId)) continue;
    seen.add(imdbId);
    status.checked++;

    try {
      const meta = await fetchCinemeta('series', imdbId);
      const incoming = getSeasonCounts(meta.videos || []);
      const before = entry.seasons || {};
      const merged = mergeSeasonCounts(before, incoming);
      const beforeTotal = totalEpisodes(before);
      const afterTotal = totalEpisodes(merged);

      for (const [candidateKey, candidate] of Object.entries(bank)) {
        const candidateImdb = normalizeImdb(candidate, candidateKey);
        if (candidateImdb !== imdbId) continue;
        candidate.type = 'tv';
        candidate.imdbId = imdbId;
        candidate.imdb = imdbId;
        candidate.seasons = merged;
        candidate.lastSeasonCheck = status.lastRun;
        mergeArt(candidate, meta);
      }

      if (afterTotal > beforeTotal || JSON.stringify(before) !== JSON.stringify(merged)) {
        dirty = true;
        status.updated++;
        log(`${entry.title || imdbId}: ${beforeTotal} -> ${afterTotal} episodes`);
      }

      status.shows.push({
        title: entry.title || meta.name || imdbId,
        imdbId,
        seasons: displaySeasonCounts(merged),
        totalEpisodes: afterTotal,
      });
    } catch (error) {
      const detail = `${entry.title || imdbId}: ${error.message}`;
      status.errors.push(detail);
      log(`ERROR ${detail}`);
    }
  }

  if (dirty) writeJson(COVER_BANK_PATH, bank);
  writeJson(STATUS_PATH, status);
  log(`checked=${status.checked} updated=${status.updated} errors=${status.errors.length}`);
}

run().catch(error => {
  log(`FATAL ${error.stack || error.message}`);
  process.exitCode = 1;
});
