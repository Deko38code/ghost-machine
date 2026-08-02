#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CineVault Stream Scraper v1.0
//  Headless browser that loops ALL movie sites daily
//  Resolves video streams → pairs with correct IMDB/TMDB IDs
//  Organizes by franchise, keeps movies together
//  Writes results to data/stream-cache.json
// ═══════════════════════════════════════════════════════════════

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'stream-cache.json');
const STATUS_FILE = path.join(DATA_DIR, 'scrape-status.json');
const LOG_FILE = path.join(DATA_DIR, 'scrape.log');

// ── FRANCHISE MAP ──
// Movies organized in pairs/groups — always kept together
const FRANCHISES = {
  'Marvel Cinematic Universe': {
    type: 'movie',
    ids: { tmdb: [299524,299519,299522,497698,557,558,559,102611,324549,495764,616037,447365,41447,608,609,610,43964,457232,284053,271110,315635,429203,545611,531219,476329,524434,361743,505742] },
  },
  'Spider-Man': {
    type: 'movie',
    ids: { tmdb: [557,558,559,102611,324549,616037,572802,41447] },
  },
  'The Boys': {
    type: 'tv',
    ids: { tmdb: [76479], imdb: ['tt1190634'] },
  },
  'Star Wars': {
    type: 'movie',
    ids: { tmdb: [11,1891,1892,1893,1894,1895,181808,330459,348350,181812,674324] },
  },
  'James Bond': {
    type: 'movie',
    ids: { tmdb: [649,650,651,652,653,654,655,656,657,658,659,660,661,662,663,664,665,666,667,668,669] },
  },
  'The Matrix': {
    type: 'movie',
    ids: { tmdb: [603,604,605,624860] },
  },
  'Jurassic Park': {
    type: 'movie',
    ids: { tmdb: [329,330,331,135397,351286,438631,508439] },
  },
  'Fast & Furious': {
    type: 'movie',
    ids: { tmdb: [9614,9615,9616,9617,514847,168259,384018,497698,383472] },
  },
  'Mission Impossible': {
    type: 'movie',
    ids: { tmdb: [956,957,958,959,960,503535,577922] },
  },
  'Rocky / Creed': {
    type: 'movie',
    ids: { tmdb: [2396,1370,1371,1372,1373,361743,405084,545611] },
  },
  'John Wick': {
    type: 'movie',
    ids: { tmdb: [245891,330459,545611,748781] },
  },
  'Die Hard': {
    type: 'movie',
    ids: { tmdb: [1462,1463,1464,1465] },
  },
  'Lord of the Rings': {
    type: 'movie',
    ids: { tmdb: [120,121,122,49051,49052,49053,49046] },
  },
  'Stranger Things': {
    type: 'tv',
    ids: { tmdb: [66203], imdb: ['tt4574334'] },
  },
  'Breaking Bad': {
    type: 'tv',
    ids: { tmdb: [1396], imdb: ['tt0903747'] },
  },
  'Game of Thrones': {
    type: 'tv',
    ids: { tmdb: [1399], imdb: ['tt0944947'] },
  },
  'Peaky Blinders': {
    type: 'tv',
    ids: { tmdb: [60574], imdb: ['tt2442560'] },
  },
  'Ozark': {
    type: 'tv',
    ids: { tmdb: [68426], imdb: ['tt5071412'] },
  },
  'Daredevil': {
    type: 'tv',
    ids: { tmdb: [61889], imdb: ['tt3322314'] },
  },
  'National Lampoon': {
    type: 'movie',
    ids: { tmdb: [545,11104,10729,43964,551,43967,43965], imdb: ['tt0085995','tt0089670','tt0097958','tt0118995','tt0077975','tt0283111','tt0107659'] },
  },
};

// ── EMBED SOURCES TO CHECK ──
// Each source: how to build URL from IMDB ID
const EMBED_SOURCES = [
  { key: 'vidsrc2',   movie: id => `https://vidsrc.to/embed/movie/${id}`,   tv: (id,s,e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrcpm',  movie: id => `https://vidsrc.pm/embed/movie/${id}`,   tv: (id,s,e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrcme',  movie: id => `https://vidsrcme.ru/embed/movie/${id}`, tv: (id,s,e) => `https://vidsrcme.ru/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrcdev', movie: id => `https://vidsrc.dev/embed/movie/${id}`,  tv: (id,s,e) => `https://vidsrc.dev/embed/tv/${id}/${s}/${e}` },
  { key: 'embed2skin',movie: id => `https://2embed.skin/embed/movie/${id}`, tv: (id,s,e) => `https://2embed.skin/embed/tv/${id}/${s}/${e}` },
  { key: 'lookmovie', movie: id => `https://www.lookmovie2.to/movies/view/${id.replace('tt','')}`, tv: (id,s,e) => `https://www.lookmovie2.to/shows/view/${id.replace('tt','')}` },
];

// ── LOGGING ──
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function writeStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch { return { lastRun: null, franchises: {}, imdbMap: {}, checked: {} }; }
}

function writeCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// ── RESOLVE IMDB ID FROM TMDB ──
// Uses Cinemeta to get the correct IMDB ID — always verify IDs match
async function resolveImdbId(tmdbId, type) {
  try {
    const fetch = (await import('node-fetch')).default;
    const cinemetaType = type === 'tv' ? 'series' : 'movie';
    const url = `https://v3-cinemeta.strem.io/search/tmdb${tmdbId}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const match = data.results?.find(r => r.type === cinemetaType);
      if (match?.id?.startsWith('tt')) return match.id;
    }
  } catch {}
  return null;
}

// ── CHECK EMBED SOURCE ──
// Uses headless browser to verify a source actually plays video
async function checkEmbedSource(page, url, sourceKey) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Wait for video element or iframe to appear
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      const iframe = document.querySelector('iframe');
      return (video && video.src) || (iframe && iframe.src && iframe.src !== 'about:blank');
    }, { timeout: 12000 }).catch(() => {});

    const result = await page.evaluate(() => {
      const video = document.querySelector('video');
      const iframe = document.querySelector('iframe');
      return {
        hasVideo: !!video,
        videoSrc: video?.src || null,
        iframeSrc: iframe?.src || null,
        title: document.title,
      };
    });

    // Filter out ad redirects
    const src = result.videoSrc || result.iframeSrc || '';
    const isAd = src.includes('opera.com') || src.includes('survey') || src.includes('google.com');
    const hasContent = (result.hasVideo || (src && !isAd));

    return {
      working: hasContent,
      url,
      videoSrc: result.videoSrc,
      iframeSrc: isAd ? null : result.iframeSrc,
      title: result.title,
    };
  } catch (err) {
    return { working: false, url, error: err.message };
  }
}

// ── SCRAPE GOOJARA WITH HEADLESS BROWSER ──
// Navigate to episode page, extract go.php links, click through to get video URLs
async function scrapeGoojara(browser, title, type, season, episode) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

  const results = [];
  try {
    // Go to Goojara search page
    const searchPath = type === 'tv' ? 'watch-series' : 'watch-movies';
    await page.goto(`https://ww1.goojara.to/${searchPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Find the show link
    const showHref = await page.evaluate((searchTitle) => {
      const links = document.querySelectorAll('a');
      const titleWords = searchTitle.toLowerCase().split(' ').filter(w => w.length > 2);
      let bestMatch = null, bestScore = 0;
      links.forEach(a => {
        const text = (a.textContent + ' ' + a.title).toLowerCase();
        let score = 0;
        titleWords.forEach(w => { if (text.includes(w)) score++; });
        if (score > bestScore) { bestScore = score; bestMatch = a.href; }
      });
      return bestMatch;
    }, title);

    if (!showHref) {
      log(`  Goojara: "${title}" not found on search page`);
      await page.close();
      return results;
    }

    // Go to the show's episode page
    await page.goto(showHref, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // For TV, find the right episode link on this page or navigate
    if (type === 'tv') {
      // Look for episode links matching season.episode
      const epHref = await page.evaluate((s, e) => {
        const links = document.querySelectorAll('a');
        const target = `${s}.${e}`;
        for (const a of links) {
          const t = a.textContent.toLowerCase();
          if (t.includes(target) || t.includes(`s${s}, ep${e}`)) return a.href;
        }
        // Fall back: look at "Season N" section for episode links
        return null;
      }, season, episode);

      if (epHref) {
        await page.goto(epHref, { waitUntil: 'domcontentloaded', timeout: 15000 });
      }
    }

    // Now extract all direct link URLs from the episode page
    const directLinks = await page.evaluate(() => {
      const bcgLinks = document.querySelectorAll('a.bcg');
      return Array.from(bcgLinks).map(a => ({
        url: a.href,
        label: a.textContent.replace(/\s+/g, ' ').trim(),
      })).filter(l => l.url.includes('go.php'));
    });

    log(`  Goojara: Found ${directLinks.length} direct links for "${title}"`);

    // Try each direct link type — click it and see what iframe loads
    const seenTypes = new Set();
    for (const link of directLinks.slice(0, 8)) {
      const ltype = link.label.toLowerCase();
      if (ltype.includes('wootly') && seenTypes.has('wootly')) continue;
      if (ltype.includes('luluvdo') && seenTypes.has('luluvdo')) continue;
      if (ltype.includes('dood') && seenTypes.has('dood')) continue;
      if (ltype.includes('streamplay') && seenTypes.has('streamplay')) continue;
      if (ltype.includes('vidsrc') && seenTypes.has('vidsrc')) continue;
      if (ltype.includes('opus') && seenTypes.has('av1')) continue;

      seenTypes.add(ltype.split(' ')[0]);

      try {
        // Click the link and wait for the iframe to update
        await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(2000);

        // Check for video or iframe on the redirected page
        const videoInfo = await page.evaluate(() => {
          const video = document.querySelector('video');
          const iframe = document.querySelector('iframe');
          const source = document.querySelector('source');
          return {
            videoSrc: video?.src || source?.src || null,
            iframeSrc: iframe?.src || null,
            pageTitle: document.title,
            bodyText: document.body?.innerText?.substring(0, 200) || '',
          };
        });

        const src = videoInfo.videoSrc || videoInfo.iframeSrc || '';
        const isAd = src.includes('opera.com') || src.includes('survey-smiles');

        results.push({
          source: ltype.includes('vidsrc') ? 'vidsrc' :
                  ltype.includes('luluvdo') ? 'luluvdo' :
                  ltype.includes('dood') ? 'dood' :
                  ltype.includes('streamplay') ? 'streamplay' :
                  ltype.includes('wootly') ? 'wootly' :
                  ltype.includes('opus') || ltype.includes('av1') ? 'av1' : 'unknown',
          label: link.label,
          url: link.url,
          resolvedUrl: isAd ? null : src,
          working: !!src && !isAd,
          videoSrc: videoInfo.videoSrc,
        });
      } catch (err) {
        results.push({
          source: link.label.split(' ')[0].toLowerCase(),
          label: link.label,
          url: link.url,
          resolvedUrl: null,
          working: false,
          error: err.message,
        });
      }
    }
  } catch (err) {
    log(`  Goojara error for "${title}": ${err.message}`);
  }

  await page.close();
  return results;
}

// ── MAIN SCRAPE LOOP ──
async function main() {
  log('═══ CineVault Stream Scraper START ═══');
  const startTime = Date.now();

  const cache = readCache();
  cache.lastRun = new Date().toISOString();
  cache.franchises = cache.franchises || {};
  cache.imdbMap = cache.imdbMap || {};
  cache.checked = cache.checked || {};

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } catch (err) {
    log(`FATAL: Cannot launch browser: ${err.message}`);
    writeStatus({ status: 'error', error: err.message, lastRun: new Date().toISOString() });
    process.exit(1);
  }

  const status = {
    status: 'running',
    startedAt: new Date().toISOString(),
    franchises: Object.keys(FRANCHISES),
    totalItems: 0,
    checkedItems: 0,
    workingStreams: 0,
    deadStreams: 0,
    results: {},
  };

  // ── Loop through each franchise ──
  for (const [franchiseName, franchise] of Object.entries(FRANCHISES)) {
    log(`\n── ${franchiseName} (${franchise.type}) ──`);
    status.results[franchiseName] = { type: franchise.type, items: {} };

    const tmdbIds = franchise.ids.tmdb || [];
    const imdbIds = franchise.ids.imdb || [];
    const allItems = [];

    // Resolve TMDB → IMDB IDs (always verify IDs match)
    for (const tmdbId of tmdbIds) {
      // Check cache first
      const cacheKey = `tmdb_${tmdbId}`;
      let imdbId = cache.imdbMap[cacheKey];

      if (!imdbId) {
        // Try to resolve from Cinemeta
        imdbId = await resolveImdbId(tmdbId, franchise.type);
        if (imdbId) {
          cache.imdbMap[cacheKey] = imdbId;
          log(`  Resolved TMDB ${tmdbId} → ${imdbId}`);
        } else {
          log(`  WARN: Could not resolve TMDB ${tmdbId} → keeping as-is`);
        }
      }

      allItems.push({ tmdbId, imdbId, type: franchise.type });
    }

    // Add explicitly provided IMDB IDs
    for (const imdbId of imdbIds) {
      if (!allItems.find(i => i.imdbId === imdbId)) {
        allItems.push({ tmdbId: null, imdbId, type: franchise.type });
      }
    }

    status.totalItems += allItems.length;

    // ── Check each item in this franchise ──
    for (const item of allItems) {
      const idKey = item.imdbId || `tmdb_${item.tmdbId}`;
      const checkKey = `${idKey}_${franchise.type}`;
      status.checkedItems++;

      log(`  Checking ${idKey}...`);

      const itemResult = {
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        type: franchise.type,
        embedSources: {},
        goojara: [],
        lastChecked: new Date().toISOString(),
      };

      // ── 1. Check embed sources (movies) ──
      if (franchise.type === 'movie') {
        const id = item.imdbId || String(item.tmdbId);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

        for (const source of EMBED_SOURCES) {
          const url = source.movie(id);
          log(`    ${source.key}: ${url}`);
          const result = await checkEmbedSource(page, url, source.key);
          itemResult.embedSources[source.key] = result;

          if (result.working) status.workingStreams++;
          else status.deadStreams++;
        }
        await page.close();
      }

      // ── 2. Check embed sources (TV S1E1) ──
      if (franchise.type === 'tv') {
        const id = item.imdbId || String(item.tmdbId);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

        for (const source of EMBED_SOURCES) {
          if (!source.tv) continue;
          const url = source.tv(id, 1, 1);
          log(`    ${source.key}: ${url}`);
          const result = await checkEmbedSource(page, url, source.key);
          itemResult.embedSources[source.key] = result;

          if (result.working) status.workingStreams++;
          else status.deadStreams++;
        }
        await page.close();
      }

      // ── 3. Scrape Goojara (headless browser resolves go.php) ──
      // Get title from Cinemeta for Goojara search
      let title = '';
      try {
        const fetchMod = (await import('node-fetch')).default;
        const cinemetaType = franchise.type === 'tv' ? 'series' : 'movie';
        const metaId = item.imdbId || `tmdb${item.tmdbId}`;
        const metaUrl = item.imdbId
          ? `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${item.imdbId}.json`
          : `https://v3-cinemeta.strem.io/search/tmdb${item.tmdbId}.json`;
        const metaRes = await fetchMod(metaUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          title = meta.meta?.name || meta.results?.[0]?.name || '';
        }
      } catch {}

      if (title) {
        log(`    Goojara: searching "${title}"...`);
        const goojaraResults = await scrapeGoojara(browser, title, franchise.type, 1, 1);
        itemResult.goojara = goojaraResults;
        status.workingStreams += goojaraResults.filter(r => r.working).length;
        status.deadStreams += goojaraResults.filter(r => !r.working).length;
      }

      // ── 4. Check Playmogo (short code map) ──
      if (item.imdbId) {
        try {
          const fetchMod = (await import('node-fetch')).default;
          const pmRes = await fetchMod(`http://localhost:8080/api/stream?imdb=${item.imdbId}&type=${franchise.type}&s=1&e=1`, {
            signal: AbortSignal.timeout(5000),
          });
          if (pmRes.ok) {
            const pmData = await pmRes.json();
            itemResult.streamApi = pmData;
          }
        } catch {}
      }

      // ── Save to cache ──
      cache.checked[checkKey] = itemResult;
      status.results[franchiseName].items[idKey] = itemResult;

      writeStatus(status);
      writeCache(cache);

      log(`  ✓ ${idKey}: ${Object.values(itemResult.embedSources).filter(s => s.working).length} embeds working, ${itemResult.goojara.filter(g => g.working).length} goojara`);
    }

    // ── Keep franchise group together in cache ──
    cache.franchises[franchiseName] = {
      type: franchise.type,
      items: allItems.map(i => i.imdbId || `tmdb_${i.tmdbId}`),
      lastChecked: new Date().toISOString(),
    };
  }

  // ── Finalize ──
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  status.status = 'complete';
  status.completedAt = new Date().toISOString();
  status.elapsedSeconds = elapsed;
  writeStatus(status);
  writeCache(cache);

  log(`\n═══ CineVault Stream Scraper COMPLETE ═══`);
  log(`  Items checked: ${status.checkedItems}/${status.totalItems}`);
  log(`  Working: ${status.workingStreams} | Dead: ${status.deadStreams}`);
  log(`  Time: ${elapsed}s`);

  await browser.close();
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  writeStatus({ status: 'error', error: err.message, lastRun: new Date().toISOString() });
  process.exit(1);
});