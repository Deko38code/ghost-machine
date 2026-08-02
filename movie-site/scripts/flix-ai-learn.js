#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Pronto Learning Engine v1.0
//  Analyzes scrape results + watch logs + TMDB data
//  Learns genre patterns, franchise correlations, source reliability
//  Writes predictions to data/pronto-brain.json
//  Runs after each Pronto scrape cycle
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BRAIN_FILE = path.join(DATA_DIR, 'pronto-brain.json');
const CACHE_FILE = path.join(DATA_DIR, 'pronto-cache.json');
const LOGS_FILE = path.join(DATA_DIR, 'movie_logs.json');
const CURATED_FILE = path.join(__dirname, '..', 'js', 'curated.js');

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Pronto-learn] ${msg}`);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── BRAIN STRUCTURE ──
// The brain accumulates knowledge over time
function initBrain() {
  return {
    version: 1,
    lastLearned: null,
    learnCount: 0,
    // Source reliability scores (0-100)
    sourceReliability: {},
    // Genre → franchise correlations
    genreFranchiseMap: {},
    // Franchise → genre tags
    franchiseGenreTags: {},
    // Director/actor → genre patterns
    peoplePatterns: {},
    // Year → trending genres
    yearTrends: {},
    // Franchise pairings (movies that go together)
    franchisePairs: {},
    // IMDB ID → learned metadata
    movieKnowledge: {},
    // Genre popularity rankings
    genreRankings: {},
    // Source → genre reliability (some sources better for action, etc.)
    sourceGenreAffinity: {},
    // Decade → popular genres
    decadeGenres: {},
    // Watch patterns (from movie_logs)
    watchPatterns: {
      topGenres: [],
      topFranchises: [],
      peakWatchHours: {},
      genreTransitions: {},
    },
    // Predictions (what to scrape next)
    predictions: {
      trendingGenres: [],
      hotFranchises: [],
      sourceShifts: {},
    },
  };
}

function learn() {
  log('═══ Pronto Learning START ═══');

  const brain = readJson(BRAIN_FILE) || initBrain();
  const cache = readJson(CACHE_FILE);
  const logs = readJson(LOGS_FILE) || [];

  brain.learnCount++;
  brain.lastLearned = new Date().toISOString();

  // ── 1. LEARN SOURCE RELIABILITY ──
  // From scrape cache: count working vs dead per source
  if (cache && cache.items) {
    const sourceStats = {};
    for (const [idKey, item] of Object.entries(cache.items)) {
      for (const [srcKey, result] of Object.entries(item.embeds || {})) {
        if (!sourceStats[srcKey]) sourceStats[srcKey] = { working: 0, total: 0, genres: {} };
        sourceStats[srcKey].total++;
        if (result.working) sourceStats[srcKey].working++;
        // Track genre affinity
        const genres = item.genres || item.franchise ? [item.franchise] : [];
        genres.forEach(g => {
          if (!sourceStats[srcKey].genres[g]) sourceStats[srcKey].genres[g] = { working: 0, total: 0 };
          sourceStats[srcKey].genres[g].total++;
          if (result.working) sourceStats[srcKey].genres[g].working++;
        });
      }
      // Goojara reliability
      const gj = item.goojara || [];
      if (gj.length > 0) {
        if (!sourceStats.goojara) sourceStats.goojara = { working: 0, total: 0, genres: {} };
        sourceStats.goojara.total += gj.length;
        sourceStats.goojara.working += gj.filter(g => g.working).length;
      }
    }

    // Calculate reliability scores (0-100)
    for (const [src, stats] of Object.entries(sourceStats)) {
      const score = stats.total > 0 ? Math.round((stats.working / stats.total) * 100) : 0;
      brain.sourceReliability[src] = score;
      log(`  Source ${src}: ${score}% reliable (${stats.working}/${stats.total})`);

      // Source-genre affinity
      for (const [genre, gStats] of Object.entries(stats.genres || {})) {
        if (!brain.sourceGenreAffinity[src]) brain.sourceGenreAffinity[src] = {};
        brain.sourceGenreAffinity[src][genre] = gStats.total > 0 
          ? Math.round((gStats.working / gStats.total) * 100) : 0;
      }
    }
  }

  // ── 2. LEARN FRANCHISE-GENRE CORRELATIONS ──
  if (cache && cache.franchises) {
    for (const [fName, fr] of Object.entries(cache.franchises)) {
      brain.franchiseGenreTags[fName] = brain.franchiseGenreTags[fName] || [];
      const type = fr.type;
      
      // Auto-tag genres based on franchise name patterns
      const tags = [];
      const lower = fName.toLowerCase();
      if (lower.includes('marvel') || lower.includes('spider') || lower.includes('avenger') || lower.includes('iron man') || lower.includes('ant-man')) tags.push('superhero', 'action', 'sci-fi');
      if (lower.includes('star wars') || lower.includes('star trek')) tags.push('sci-fi', 'space', 'adventure');
      if (lower.includes('lampoon') || lower.includes('van wilder') || lower.includes('animal house')) tags.push('comedy', 'slapstick', 'family');
      if (lower.includes('boys')) tags.push('superhero', 'dark comedy', 'action');
      if (lower.includes('stranger')) tags.push('sci-fi', 'horror', '80s nostalgia');
      if (lower.includes('breaking') || lower.includes('meth') || lower.includes('peaky')) tags.push('crime', 'drama', 'thriller');
      if (lower.includes('game of throne') || lower.includes('got')) tags.push('fantasy', 'drama', 'political');
      if (lower.includes('bond') || lower.includes('mission impossible') || lower.includes('bourne')) tags.push('spy', 'action', 'thriller');
      if (lower.includes('matrix')) tags.push('sci-fi', 'cyberpunk', 'philosophy');
      if (lower.includes('jurassic') || lower.includes('dinosaur')) tags.push('adventure', 'sci-fi', 'creature');
      if (lower.includes('fast') || lower.includes('furious')) tags.push('action', 'cars', 'heist');
      if (lower.includes('rocky') || lower.includes('creed')) tags.push('sports', 'drama', 'underdog');
      if (lower.includes('john wick')) tags.push('action', 'revenge', 'stylized violence');
      if (lower.includes('die hard')) tags.push('action', 'holiday', 'one-man army');
      if (lower.includes('lord') || lower.includes('hobbit')) tags.push('fantasy', 'epic', 'adventure');
      if (lower.includes('horror') || lower.includes('saw') || lower.includes('conjuring')) tags.push('horror', 'supernatural');
      
      if (tags.length > 0) {
        brain.franchiseGenreTags[fName] = [...new Set([...(brain.franchiseGenreTags[fName] || []), ...tags])];
        // Reverse map: genre → franchises
        tags.forEach(g => {
          if (!brain.genreFranchiseMap[g]) brain.genreFranchiseMap[g] = [];
          if (!brain.genreFranchiseMap[g].includes(fName)) brain.genreFranchiseMap[g].push(fName);
        });
      }
    }
  }

  // ── 3. LEARN FRANCHISE PAIRINGS ──
  // Movies that belong together (same universe, same vibe)
  brain.franchisePairs = {
    'superhero': ['Marvel Cinematic Universe', 'Spider-Man', 'The Boys', 'DC Universe'],
    'galactic': ['Star Wars', 'Star Trek'],
    'crime_drama': ['Breaking Bad', 'Peaky Blinders', 'Ozark', 'Game of Thrones'],
    'comedy_classic': ['National Lampoon'],
    'action_franchise': ['Fast & Furious', 'Mission Impossible', 'John Wick', 'Die Hard', 'James Bond'],
    'fantasy_epic': ['Lord of the Rings', 'Game of Thrones', 'Harry Potter'],
    'retro_nostalgia': ['Stranger Things', 'The Goonies', 'Back to the Future'],
    'dark_subversive': ['The Boys', 'Breaking Bad', 'Peaky Blinders'],
  };

  // ── 4. LEARN FROM WATCH LOGS ──
  if (logs && logs.length > 0) {
    const genreCount = {};
    const franchiseCount = {};
    const hourCount = {};
    const genreTransitions = {};

    let prevGenre = null;
    logs.forEach((entry, i) => {
      // Count genre watches
      const genre = entry.details?.genre || entry.details?.source || 'unknown';
      genreCount[genre] = (genreCount[genre] || 0) + 1;

      // Count franchise watches
      const franchise = entry.details?.franchise || 'other';
      franchiseCount[franchise] = (franchiseCount[franchise] || 0) + 1;

      // Watch time patterns
      const hour = entry.timestamp ? new Date(entry.timestamp).getHours() : null;
      if (hour !== null) {
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }

      // Genre transitions (watching A then B = A→B pattern)
      if (prevGenre && prevGenre !== genre) {
        const key = `${prevGenre}→${genre}`;
        genreTransitions[key] = (genreTransitions[key] || 0) + 1;
      }
      prevGenre = genre;
    });

    // Top genres
    brain.watchPatterns.topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([g, c]) => ({ genre: g, watches: c }));

    // Top franchises
    brain.watchPatterns.topFranchises = Object.entries(franchiseCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([f, c]) => ({ franchise: f, watches: c }));

    // Peak hours
    brain.watchPatterns.peakWatchHours = Object.entries(hourCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h, c]) => ({ hour: +h, watches: c }));

    // Genre transitions
    brain.watchPatterns.genreTransitions = Object.entries(genreTransitions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});

    log(`  Watch patterns: ${brain.watchPatterns.topGenres.length} top genres, ${brain.watchPatterns.topFranchises.length} top franchises`);
  }

  // ── 5. LEARN YEAR/DECADE TRENDS ──
  brain.decadeGenres = {
    '1970s': ['disaster', 'grindhouse', 'new hollywood', 'kung fu'],
    '1980s': ['slasher', 'action', 'sci-fi', 'teen comedy', 'fantasy'],
    '1990s': ['indie', 'tarantino', 'cgi', 'disney renaissance', 'thriller'],
    '2000s': ['superhero', 'franchise', 'reality', 'found footage', 'pixar'],
    '2010s': ['mcu', 'streaming', 'dark superhero', 'nostalgia', 'true crime'],
    '2020s': ['ai', 'multiverse', 'reboot', 'limited series', 'retro horror'],
  };

  // ── 6. GENERATE PREDICTIONS ──
  // Based on what's working + what's trending
  const trendingGenres = [];
  const hotFranchises = [];
  const sourceShifts = {};

  // Genres with most live sources = trending
  for (const [genre, franchises] of Object.entries(brain.genreFranchiseMap)) {
    const liveCount = Object.values(brain.sourceReliability).filter(s => s > 50).length;
    trendingGenres.push({ genre, franchiseCount: franchises.length, reliability: liveCount });
  }
  trendingGenres.sort((a, b) => b.franchiseCount - a.franchiseCount);
  brain.predictions.trendingGenres = trendingGenres.slice(0, 5);

  // Franchises with highest live count = hot
  if (cache && cache.items) {
    const franchiseLive = {};
    for (const [idKey, item] of Object.entries(cache.items)) {
      const fr = item.franchise || 'other';
      const live = Object.values(item.embeds || {}).filter(e => e.working).length + 
                   (item.goojara || []).filter(g => g.working).length;
      franchiseLive[fr] = (franchiseLive[fr] || 0) + live;
    }
    Object.entries(franchiseLive)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([f, l]) => hotFranchises.push({ franchise: f, liveStreams: l }));
    brain.predictions.hotFranchises = hotFranchises;
  }

  // Source shifts (which sources gaining/losing reliability)
  for (const [src, score] of Object.entries(brain.sourceReliability)) {
    const prev = brain.sourceReliability[src] || 50;
    sourceShifts[src] = { current: score, trend: score >= prev ? 'up' : 'down' };
  }
  brain.predictions.sourceShifts = sourceShifts;

  // ── 7. GENRE RANKINGS ──
  // Combine watch data + franchise count
  const genreScores = {};
  for (const [genre, franchises] of Object.entries(brain.genreFranchiseMap)) {
    genreScores[genre] = (genreScores[genre] || 0) + franchises.length * 10;
  }
  brain.watchPatterns.topGenres.forEach(g => {
    genreScores[g.genre] = (genreScores[g.genre] || 0) + g.watches * 5;
  });
  brain.genreRankings = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([g, s], i) => ({ rank: i + 1, genre: g, score: s }));

  // ── SAVE BRAIN ──
  writeJson(BRAIN_FILE, brain);
  log(`═══ Pronto Learning COMPLETE ═══`);
  log(`  Sources analyzed: ${Object.keys(brain.sourceReliability).length}`);
  log(`  Genre-franchise links: ${Object.keys(brain.genreFranchiseMap).length}`);
  log(`  Franchise tags: ${Object.keys(brain.franchiseGenreTags).length}`);
  log(`  Genre rankings: ${brain.genreRankings.length}`);
  log(`  Learn cycle: #${brain.learnCount}`);
}

learn();