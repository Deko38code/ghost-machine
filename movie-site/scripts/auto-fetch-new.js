#!/usr/bin/env node
// Fetch recent movie metadata into CineVault's cover bank.

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const BANK_PATH = path.join(DATA_DIR, 'cover_bank.json');
const LOG_PATH = path.join(DATA_DIR, 'auto-fetch.log');
const PORT = process.env.PORT || 8080;
const MIN_YEAR = Number(process.env.CINEVAULT_MIN_NEW_YEAR || new Date().getFullYear() - 2);
const LOOKAHEAD_DAYS = Number(process.env.CINEVAULT_RELEASE_LOOKAHEAD_DAYS || 21);
const DROP_WINDOW_DAYS = Number(process.env.CINEVAULT_RELEASE_DROP_WINDOW_DAYS || 0);

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, line + '\n');
}

function getJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'CineVault/2.0' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).href;
        getJson(nextUrl, redirects + 1).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`JSON parse failed: ${body.slice(0, 80)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function getText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'CineVault/2.0' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).href;
        getText(nextUrl, redirects + 1).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(body);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function localDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : localDateKey(d);
}

function diffDays(aKey, bKey) {
  if (!aKey || !bKey) return null;
  const a = new Date(`${aKey}T00:00:00`);
  const b = new Date(`${bKey}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((a - b) / 86400000);
}

function cleanHtmlText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, ' ');
}

function titleFromScheduleLine(line) {
  const match = String(line || '').trim().match(/^(.+?)\s+\((Wide|Limited|Special Engagement|Expands Wide)\)\b/);
  if (!match) return null;
  const title = match[1].trim().replace(/\s+/g, ' ');
  return title ? title.replace(/\s+\d{4}$/, '').trim() : null;
}

async function fetchReleaseCandidatesFromNumbers() {
  const html = await getText('https://www.the-numbers.com/movies/release-schedule');
  const text = cleanHtmlText(html);
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const months = new Set(['January','February','March','April','May','June','July','August','September','October','November','December']);
  const currentYear = new Date().getFullYear();
  let currentMonth = '';
  let currentDay = '';
  const candidates = [];

  for (const line of lines) {
    const dateMatch = line.match(new RegExp(`^(${Array.from(months).join('|')})\\s+(\\d{1,2})$`));
    if (dateMatch) {
      currentMonth = dateMatch[1];
      currentDay = dateMatch[2];
      continue;
    }

    if (!currentMonth || !currentDay) continue;
    const title = titleFromScheduleLine(line);
    if (!title) continue;

    const releaseDate = parseDateKey(`${currentMonth} ${currentDay}, ${currentYear}`);
    if (!releaseDate) continue;

    candidates.push({
      title,
      releaseDate,
      source: 'the-numbers',
    });
  }

  return candidates;
}

async function postAddLog(movie) {
  try {
    await fetch(`http://127.0.0.1:${PORT}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'add',
        title: movie.title,
        id: movie.tmdbId || movie.imdbId || null,
        source: 'auto-fetch',
        details: `Auto-added from ${movie.source || 'release schedule'} on ${movie.releaseDate || 'unknown date'}`
      })
    });
  } catch (error) {
    log(`log post failed for ${movie.title}: ${error.message}`);
  }
}

async function fetchCinemetaCatalog(pathname) {
  const data = await getJson(`https://v3-cinemeta.strem.io/catalog/movie/${pathname}/imdb.json`);
  return (data.metas || [])
    .slice(0, 120)
    .map(meta => ({
      imdbId: meta.imdb_id || meta.id,
      title: meta.name,
      year: meta.year ? String(meta.year) : '',
      poster: meta.poster || null
    }))
    .filter(movie => movie.imdbId && /^tt\d+$/i.test(movie.imdbId) && movie.title);
}

async function enrichViaServer(movie) {
  const params = new URLSearchParams({
    title: movie.title,
    year: movie.year || '',
    type: 'movie'
  });
  return getJson(`http://127.0.0.1:${PORT}/api/cover-art?${params.toString()}`);
}

function loadBank() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { return JSON.parse(fs.readFileSync(BANK_PATH, 'utf8')); }
  catch { return {}; }
}

function bankKey(enriched, fallback) {
  const tmdbId = enriched?.tmdbData?.id || enriched?.tmdbId;
  if (tmdbId) return `tmdb_${tmdbId}`;
  return fallback.imdbId;
}

async function main() {
  log('=== auto-fetch-new starting ===');
  const bank = loadBank();
  const existingKeys = new Set(Object.keys(bank));
  const existingTitles = new Set(
    Object.values(bank)
      .map(entry => String(entry.title || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const existingTitleYears = new Set(
    Object.values(bank)
      .map(entry => `${normalizeTitle(entry.title)}|${String(entry.year || entry.releaseDate || '').slice(0, 4)}`)
      .filter(Boolean)
  );
  const existingImdbIds = new Set(
    Object.values(bank)
      .map(entry => String(entry.imdbId || entry.imdb || '').trim())
      .filter(Boolean)
  );

  const todayKey = localDateKey(new Date());

  let releaseCandidates = [];
  try {
    releaseCandidates = await fetchReleaseCandidatesFromNumbers();
    log(`The Numbers release calendar: ${releaseCandidates.length}`);
  } catch (error) {
    log(`The Numbers release calendar failed: ${error.message}`);
  }

  let candidates = [];
  candidates = candidates.concat(releaseCandidates);
  for (const catalog of ['new', 'top']) {
    try {
      const movies = await fetchCinemetaCatalog(catalog);
      candidates = candidates.concat(movies);
      log(`Cinemeta ${catalog}: ${movies.length}`);
    } catch (error) {
      log(`Cinemeta ${catalog} failed: ${error.message}`);
    }
  }

  const seen = new Set();
  candidates = candidates.filter(movie => {
    const key = movie.imdbId || `${normalizeTitle(movie.title)}|${movie.releaseDate || movie.year || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let added = 0;
  let skipped = 0;
  let upcoming = 0;
  for (const movie of candidates) {
    const year = Number((movie.year || movie.releaseDate || '').toString().slice(0, 4) || 0);
    const titleKey = normalizeTitle(movie.title);
    const titleYearKey = `${titleKey}|${year || ''}`;
    const releaseKey = parseDateKey(movie.releaseDate || '');
    const daysUntilRelease = releaseKey ? diffDays(releaseKey, todayKey) : null;

    if (daysUntilRelease !== null && daysUntilRelease > DROP_WINDOW_DAYS) {
      upcoming++;
      continue;
    }
    if (year && year < MIN_YEAR) { skipped++; continue; }
    if (existingImdbIds.has(movie.imdbId) || existingTitles.has(titleKey) || existingTitleYears.has(titleYearKey)) { skipped++; continue; }

    try {
      const enriched = await enrichViaServer(movie);
      const key = bankKey(enriched, movie);
      const enrichedImdbId = enriched?.omdbData?.imdbID || enriched?.imdbId || movie.imdbId || '';
      const enrichedTitleKey = normalizeTitle(enriched.title || movie.title);
      const enrichedYear = String(enriched.year || movie.year || movie.releaseDate || '').slice(0, 4);
      const enrichedTitleYearKey = `${enrichedTitleKey}|${enrichedYear || ''}`;
      if (existingKeys.has(key) || existingImdbIds.has(enrichedImdbId) || existingTitles.has(enrichedTitleKey) || existingTitleYears.has(enrichedTitleYearKey)) { skipped++; continue; }

      bank[key] = {
        id: enriched.tmdbData?.id || enrichedImdbId || movie.imdbId || null,
        poster: enriched.poster || movie.poster || null,
        backdrop: enriched.backdrop || null,
        dvdCover: enriched.dvdCover || null,
        source: enriched.poster ? 'auto-fetch' : 'cinemeta',
        tmdbId: enriched.tmdbData?.id || null,
        imdbId: enrichedImdbId || movie.imdbId || null,
        title: enriched.title || movie.title,
        year: enriched.year || movie.year || '',
        releaseDate: movie.releaseDate || enriched.releaseDate || movie.year || '',
        type: 'movie',
        updatedAt: new Date().toISOString()
      };
      existingKeys.add(key);
      existingTitles.add(normalizeTitle(bank[key].title || ''));
      existingTitleYears.add(`${normalizeTitle(bank[key].title || '')}|${String(bank[key].year || bank[key].releaseDate || '').slice(0, 4)}`);
      if (bank[key].imdbId) existingImdbIds.add(String(bank[key].imdbId));
      added++;
      log(`+ ${bank[key].title} [${bank[key].id || 'no-id'}] (${bank[key].year || bank[key].releaseDate || 'unknown'})`);
      await postAddLog(bank[key]);
    } catch (error) {
      log(`skip ${movie.title}: ${error.message}`);
      skipped++;
    }
    await sleep(350);
  }

  fs.writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2));
  log(`Done. Added: ${added} | Upcoming: ${upcoming} | Skipped: ${skipped} | Total: ${Object.keys(bank).length}`);
}

main().catch(error => {
  log(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
