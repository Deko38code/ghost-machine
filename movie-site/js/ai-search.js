// ── CineVault AI Search Engine ──
// Natural language movie lookup — understands vibes, genres, actors, years, franchises
// Works with or without TMDB API key (falls back to curated data)

const AI_SEARCH = {
  // Genre keyword map — natural language → TMDB genre IDs + search terms
  genreMap: {
    // Direct genres
    action: { id: 28, query: 'action' },
    adventure: { id: 12, query: 'adventure' },
    comedy: { id: 35, query: 'comedy' },
    drama: { id: 18, query: 'drama' },
    horror: { id: 27, query: 'horror' },
    thriller: { id: 53, query: 'thriller' },
    scifi: { id: 878, query: 'science fiction' },
    'sci-fi': { id: 878, query: 'science fiction' },
    romance: { id: 10749, query: 'romance' },
    romantic: { id: 10749, query: 'romance' },
    animation: { id: 16, query: 'animation' },
    animated: { id: 16, query: 'animation' },
    documentary: { id: 99, query: 'documentary' },
    mystery: { id: 9648, query: 'mystery' },
    fantasy: { id: 14, query: 'fantasy' },
    crime: { id: 80, query: 'crime' },
    war: { id: 10752, query: 'war' },
    western: { id: 37, query: 'western' },
    family: { id: 10751, query: 'family' },
    kids: { id: 10751, query: 'kids family' },
    musical: { id: 10402, query: 'musical' },
    history: { id: 36, query: 'history' },
    historical: { id: 36, query: 'history' },

    // Vibe/mood mappings
    scary: { id: 27, query: 'horror' },
    creepy: { id: 27, query: 'horror' },
    spooky: { id: 27, query: 'horror' },
    funny: { id: 35, query: 'comedy' },
    hilarious: { id: 35, query: 'comedy' },
    sad: { id: 18, query: 'drama emotional' },
    emotional: { id: 18, query: 'drama emotional' },
    dark: { id: 80, query: 'crime dark thriller' },
    gritty: { id: 80, query: 'crime thriller' },
    intense: { id: 53, query: 'thriller intense' },
    mindbending: { id: 878, query: 'science fiction mind bending' },
    'mind-bending': { id: 878, query: 'science fiction mind bending' },
    mindfuck: { id: 878, query: 'science fiction mind bending' },
    feelgood: { id: 35, query: 'feel good comedy' },
    'feel-good': { id: 35, query: 'feel good comedy romance' },
    chill: { id: 35, query: 'comedy chill' },
    chillin: { id: 35, query: 'comedy' },
    wholesome: { id: 10751, query: 'family wholesome' },
    cute: { id: 10749, query: 'romance cute' },
    brutal: { id: 28, query: 'action brutal' },
    violent: { id: 28, query: 'action violent' },
    epic: { id: 12, query: 'adventure epic' },

    // Franchise keywords
    marvel: { franchise: 'marvel' },
    mcu: { franchise: 'marvel' },
    superhero: { id: 28, query: 'superhero' },
    spiderman: { franchise: 'spiderman' },
    'spider-man': { franchise: 'spiderman' },
    'men in black': { franchise: 'mib' },
    mib: { franchise: 'mib' },
    antman: { franchise: 'antman' },
    'ant-man': { franchise: 'antman' },
    'the boys': { franchise: 'theboys' },
    boys: { franchise: 'theboys' },
    'csi ny': { franchise: 'csiny' },
    'csi: ny': { franchise: 'csiny' },
    'csi cyber': { franchise: 'csicyber' },
    'csi: cyber': { franchise: 'csicyber' },
    csi: { franchise: 'csi' },
    snowfall: { franchise: 'snowfall' },
    'the 100': { franchise: 'the100' },
    the100: { franchise: 'the100' },
    'the hundred': { franchise: 'the100' },
    password: { franchise: 'password' },
    'password game show': { franchise: 'password' },
    supergirl: { franchise: 'supergirl' },
    'super girl': { franchise: 'supergirl' },
    'kara zor-el': { franchise: 'supergirl' },

    // June 2025 drops
    severance: { franchise: 'severance2' },
    'severance season 2': { franchise: 'severance2' },
    'white lotus': { franchise: 'whiteLotus3' },
    whitelotus: { franchise: 'whiteLotus3' },
    'white lotus season 3': { franchise: 'whiteLotus3' },
    'last of us': { franchise: 'lastOfUs2' },
    'the last of us': { franchise: 'lastOfUs2' },
    'last of us season 2': { franchise: 'lastOfUs2' },
    tlou: { franchise: 'lastOfUs2' },
    andor: { franchise: 'andor2' },
    'star wars andor': { franchise: 'andor2' },
    'andor season 2': { franchise: 'andor2' },
    reacher: { franchise: 'Reacher3' },
    'reacher season 3': { franchise: 'Reacher3' },
    invincible: { franchise: 'invincible3' },
    'invincible season 3': { franchise: 'invincible3' },
    'slow horses': { franchise: 'slowHorses5' },
    'slow horses season 5': { franchise: 'slowHorses5' },
    fallout: { franchise: 'fallout2' },
    'fallout season 2': { franchise: 'fallout2' },
    'fallout tv': { franchise: 'fallout2' },
    'house of dragon': { franchise: 'hotd3' },
    'house of the dragon': { franchise: 'hotd3' },
    hotd: { franchise: 'hotd3' },
    'hotd season 3': { franchise: 'hotd3' },

    // 2025 movies
    superman: { movieId: 1061474 },
    thunderbolts: { movieId: 986056 },
    'thunderbolts*': { movieId: 986056 },
    'mission impossible 8': { movieId: 575265 },
    'mission impossible the final reckoning': { movieId: 575265 },
    'mi 8': { movieId: 575265 },
    'lilo and stitch': { movieId: 552524 },
    'lilo & stitch': { movieId: 552524 },
    ballerina: { movieId: 541671 },
    'john wick ballerina': { movieId: 541671 },
    'karate kid legends': { movieId: 1011477 },
    'final destination bloodlines': { movieId: 574475 },
    'fantastic four': { movieId: 617126 },
    'fantastic 4': { movieId: 617126 },
    'the amateur': { movieId: 1087891 },
    warfare: { movieId: 1241436 },
    eddington: { movieId: 648878 },
    'mortal kombat 2': { movieId: 931285 },
    'mortal kombat ii': { movieId: 931285 },
    'mandalorian and grogu': { movieId: 1228710 },
    'the mandalorian movie': { movieId: 1228710 },
    'devil wears prada 2': { movieId: 1314481 },
    backrooms: { movieId: 1083381 },
    'toy story 5': { movieId: 1084244 },
    sinners: { movieId: 1233413 },
    'accountant 2': { movieId: 870028 },
    'the accountant 2': { movieId: 870028 },
    '28 years later': { movieId: 1100988 },
    f1: { movieId: 911430 },
    'how to train your dragon 2025': { movieId: 1087192 },
    'avatar fire and ash': { movieId: 83533 },
    'avatar 3': { movieId: 83533 },
    superman2025: { movieId: 1061474 },
    'captain america brave new world': { movieId: 822119 },
    'mission impossible final reckoning': { movieId: 1307769 },
    'mission impossible the final reckoning': { movieId: 1307769 },
    'mi8': { movieId: 1307769 },
    'snow white 2025': { movieId: 967851 },
    'the electric state': { movieId: 1318222 },
    'clown in a cornfield': { movieId: 1195392 },
    'fear street prom queen': { movieId: 1320726 },
    'i know what you did last summer 2025': { movieId: 1315868 },
    'ikwdls': { movieId: 1315868 },
    'downton abbey the grand finale': { movieId: 1264177 },
    'downton abbey 3': { movieId: 1264177 },
    'companion 2025': { movieId: 1037682 },
    'den of thieves 2': { movieId: 1113356 },
    'den of thieves pantera': { movieId: 1113356 },
    'bridget jones mad about the boy': { movieId: 1075180 },
    'bridget jones 4': { movieId: 1075180 },
    'masters of the universe': { movieId: 454639 },
    'scary movie 6': { movieId: 1273221 },
    'scary movie': { movieId: 1273221 },
    'the furious': { movieId: 1280738 },
    'avatar fire and ash': { movieId: 83533 },
    'avatar 3': { movieId: 83533 },

    // TV-specific
    tv: { tv: true },
    show: { tv: true },
    series: { tv: true },
    episode: { tv: true },
    anime: { id: 16, query: 'anime animation', tv: true },
    kdrama: { id: 18, query: 'korean drama', tv: true },

    // Time periods
    classic: { year: '1970-1999' },
    old: { year: '1970-1999' },
    vintage: { year: '1970-1989' },
    new: { year: '2023-2026' },
    recent: { year: '2023-2026' },
    '90s': { year: '1990-1999' },
    '80s': { year: '1980-1989' },
    '2000s': { year: '2000-2009' },
    '2010s': { year: '2010-2019' },
    '2020s': { year: '2020-2029' },
  },

  // Franchise data for quick lookup
  franchiseMap: {
    marvel: ['avengers', 'iron man', 'captain america', 'thor', 'hulk', 'black panther', 'guardians', 'wanda', 'strange', 'marvel'],
    spiderman: ['spider-man', 'spiderman', 'spider'],
    mib: ['men in black', 'mib'],
    antman: ['ant-man', 'antman'],
    theboys: ['the boys', 'boys'],
    csiny: ['csi: ny', 'csi ny', 'csi new york'],
    csicyber: ['csi: cyber', 'csi cyber'],
    csi: ['csi', 'crime scene'],
    snowfall: ['snowfall', 'franklin saint', 'fx snowfall'],
    the100: ['the 100', 'the100', 'the hundred'],
    password: ['password', 'password game show', 'password tv'],
    supergirl: ['supergirl', 'kara zor-el', 'super girl'],
    severance: ['severance', 'severance season 2'],
    'white lotus': ['white lotus', 'whitelotus', 'white lotus season 3'],
    'last of us': ['last of us', 'the last of us', 'last of us season 2', 'tlou'],
    andor: ['andor', 'star wars andor', 'andor season 2'],
    reacher: ['reacher', 'reacher season 3'],
    invincible: ['invincible', 'invincible season 3'],
    'slow horses': ['slow horses', 'slow horses season 5'],
    fallout: ['fallout', 'fallout season 2', 'fallout tv'],
    'house of dragon': ['house of dragon', 'house of the dragon', 'hotd', 'hotd season 3'],
  },

  // Parse natural language query into search params
  parse(query) {
    const q = query.toLowerCase().trim();
    const result = {
      original: query,
      genres: [],
      franchise: null,
      searchQuery: '',
      year: null,
      tv: false,
      vibe: '',
      isFranchise: false,
      isAI: false,
    };

    let remaining = q;

    // Check for franchise keywords first
    for (const [key, config] of Object.entries(this.genreMap)) {
      if (config.franchise && remaining.includes(key)) {
        result.franchise = config.franchise;
        result.isFranchise = true;
        result.isAI = true;
        remaining = remaining.replace(new RegExp(key, 'gi'), '').trim();
        break;
      }
    }

    // Check for year patterns (2024, 1999, etc)
    const yearMatch = remaining.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      result.year = yearMatch[1];
      remaining = remaining.replace(yearMatch[1], '').trim();
      result.isAI = true;
    }

    // Check for genre/vibe keywords
    const sortedKeys = Object.entries(this.genreMap)
      .filter(([, v]) => !v.franchise)
      .sort((a, b) => b[0].length - a[0].length); // longest match first

    for (const [key, config] of sortedKeys) {
      if (remaining.includes(key)) {
        if (config.tv) result.tv = true;
        if (config.id && !result.genres.find(g => g.id === config.id)) {
          result.genres.push(config);
        }
        if (config.query && !result.vibe) result.vibe = config.query;
        remaining = remaining.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
        result.isAI = true;
      }
    }

    // Clean up remaining as direct search
    result.searchQuery = remaining.replace(/[^\w\s]/g, '').trim();

    return result;
  },

  // Build a human-readable interpretation
  interpret(parsed) {
    const parts = [];
    if (parsed.isFranchise && parsed.franchise) {
      const fName = FRANCHISES[parsed.franchise]?.title || parsed.franchise;
      parts.push(`📂 ${fName} franchise`);
    }
    if (parsed.genres.length) {
      parts.push(parsed.genres.map(g => g.query).join(' + '));
    }
    if (parsed.tv) parts.push('📺 TV shows');
    if (parsed.year) parts.push(`📅 ${parsed.year}`);
    if (parsed.searchQuery) parts.push(`🔍 "${parsed.searchQuery}"`);
    return parts.join(' → ') || '🔧 General search';
  },

  // Execute the parsed search against APIs
  async search(query) {
    const parsed = this.parse(query);
    const results = [];

    // 1. Franchise search
    if (parsed.isFranchise && FRANCHISES[parsed.franchise]) {
      const franchise = FRANCHISES[parsed.franchise];
      if (CONFIG.tmdb.apiKey) {
        const movies = await Promise.all(franchise.ids.map(id =>
          (franchise.type === 'tv' ? tmdbApi.tvDetails(id) : tmdbApi.movieDetails(id)).catch(() => null)
        ));
        return { items: movies.filter(Boolean).map(m => ({...m, media_type: franchise.type === 'tv' ? 'tv' : 'movie'})), parsed, franchise: true };
      }
      // Fallback: search by franchise name
      const searchResults = await this._tmdbSearch(FRANCHISES[parsed.franchise].title.replace(/^[^\s]+ /, ''));
      return { items: searchResults, parsed, franchise: true };
    }

    // 2. Genre + vibe search via TMDB discover
    if (parsed.genres.length && CONFIG.tmdb.apiKey) {
      const genreId = parsed.genres[0].id;
      try {
        const endpoint = parsed.tv ? '/discover/tv' : '/discover/movie';
        const params = { with_genres: genreId, sort_by: 'popularity.desc', page: 1 };
        if (parsed.year) {
          if (parsed.year.includes('-')) {
            const [from, to] = parsed.year.split('-');
            params[parsed.tv ? 'first_air_date.gte' : 'primary_release_date.gte'] = `${from}-01-01`;
            params[parsed.tv ? 'first_air_date.lte' : 'primary_release_date.lte'] = `${to}-12-31`;
          } else {
            if (parsed.tv) params['first_air_date.gte'] = `${parsed.year}-01-01`;
            else params['primary_release_year'] = parsed.year;
          }
        }
        const url = new URL(`${CONFIG.tmdb.baseUrl}${endpoint}?api_key=${CONFIG.tmdb.apiKey}&` + new URLSearchParams(params).toString());
        // Use a raw fetch since _get might not support discover
        const res = await fetch(url);
        const data = await res.json();
        const items = (data.results || []).map(m => ({...m, media_type: parsed.tv ? 'tv' : 'movie'}));
        // Also do a text search to blend results
        if (parsed.searchQuery) {
          const textResults = await this._tmdbSearch(parsed.searchQuery);
          // Deduplicate
          const ids = new Set(items.map(i => i.id));
          textResults.forEach(r => { if (!ids.has(r.id)) { items.push(r); ids.add(r.id); } });
        }
        return { items: items.slice(0, 40), parsed };
      } catch (e) { console.warn('Genre search failed:', e); }
    }

    // 3. Text search
    if (parsed.searchQuery) {
      const items = await this._tmdbSearch(parsed.searchQuery);
      // If genre filter detected, try to filter client-side
      if (parsed.genres.length) {
        const gid = parsed.genres[0].id;
        const filtered = items.filter(m => m.genre_ids?.includes(gid));
        if (filtered.length) return { items: filtered, parsed };
      }
      return { items, parsed };
    }

    // 4. Vibe-only (no text, just genre/vibe)
    if (parsed.genres.length && !CONFIG.tmdb.apiKey) {
      return { items: CURATED_FALLBACK, parsed };
    }

    return { items: [], parsed };
  },

  async _tmdbSearch(query) {
    if (!CONFIG.tmdb.apiKey) return [];
    try {
      // Use multi search for combined movie+tv results
      const url = `${CONFIG.tmdb.baseUrl}/search/multi?api_key=${CONFIG.tmdb.apiKey}&query=${encodeURIComponent(query)}&page=1`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.results || []).filter(m => m.media_type === 'movie' || m.media_type === 'tv');
    } catch { return []; }
  }
};

window.AI_SEARCH = AI_SEARCH;