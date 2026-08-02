// ── CineVault API Layer ──
// TMDB + OMDb + TV + free streaming sources + goojara scraper + cover art search + auto-resume
// ALL external API calls go through /api/proxy for CORS bypass

// Base URL for our Node.js server proxy
const API_PROXY = '/api/proxy';
const EMBED_PROXY = '/api/embed-proxy';
const STALKER_PROXY = '/api/stalker-proxy';

// Helper: proxy a URL through our server
function proxyUrl(url) {
  return `${API_PROXY}?url=${encodeURIComponent(url)}`;
}

// ══════════════════════════════════════════════════════════════════════
// ══ TMDB API ══
// ══════════════════════════════════════════════════════════════════════

class TMDBApi {
  constructor() {
    this.key = CONFIG.tmdb.apiKey;
    this.base = CONFIG.tmdb.baseUrl;
    this.imgBase = CONFIG.tmdb.imgBase;
    this.cache = new Map();
  }
  async _get(endpoint, params = {}) {
    const url = new URL(`${this.base}${endpoint}`);
    url.searchParams.set('api_key', this.key);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const key = url.toString();
    if (this.cache.has(key)) return this.cache.get(key);
    // Route TMDB through our server proxy for CORS bypass
    const proxyedUrl = proxyUrl(url.toString());
    const res = await fetch(proxyedUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`);
    const data = await res.json();
    this.cache.set(key, data);
    return data;
  }
  posterUrl(path, size = CONFIG.tmdb.posterSize) { return path ? `${this.imgBase}/${size}${path}` : 'assets/no-poster.svg'; }
  backdropUrl(path) { return path ? `${this.imgBase}/${CONFIG.tmdb.backdropSize}${path}` : ''; }
  // Movies
  async trending(page = 1) { return this._get('/trending/movie/week', { page }); }
  async topRated(page = 1) { return this._get('/movie/top_rated', { page }); }
  async popular(page = 1) { return this._get('/movie/popular', { page }); }
  async nowPlaying(page = 1) { return this._get('/movie/now_playing', { page }); }
  async upcoming(page = 1) { return this._get('/movie/upcoming', { page }); }
  async search(query, page = 1) { return this._get('/search/multi', { query, page }); }
  async movieDetails(id) { return this._get(`/movie/${id}`, { append_to_response: 'credits,videos' }); }
  async byGenre(genreId, page = 1) { return this._get('/discover/movie', { with_genres: genreId, sort_by: 'popularity.desc', page }); }
  async genres() { return this._get('/genre/movie/list'); }
  // TV
  async tvTrending(page = 1) { return this._get('/trending/tv/week', { page }); }
  async tvPopular(page = 1) { return this._get('/tv/popular', { page }); }
  async tvTopRated(page = 1) { return this._get('/tv/top_rated', { page }); }
  async tvDetails(id) { return this._get(`/tv/${id}`, { append_to_response: 'credits,videos' }); }
  async tvSeason(tvId, season) { return this._get(`/tv/${tvId}/season/${season}`); }
  async tvGenres() { return this._get('/genre/tv/list'); }
  async tvByGenre(genreId, page = 1) { return this._get('/discover/tv', { with_genres: genreId, sort_by: 'popularity.desc', page }); }
  // Cast & crew
  async personDetails(personId) { return this._get(`/person/${personId}`); }
  async personCredits(personId) { return this._get(`/person/${personId}/combined_credits`); }
}

// ══════════════════════════════════════════════════════════════════════
// ══ OMDB API ══
// ══════════════════════════════════════════════════════════════════════

class OMDbApi {
  constructor() {
    this.key = CONFIG.omdb.apiKey;
    this.base = CONFIG.omdb.baseUrl;
    this.cache = new Map();
  }
  async _get(params = {}) {
    params.apikey = this.key;
    const url = new URL(this.base);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const key = url.toString();
    if (this.cache.has(key)) return this.cache.get(key);
    // Route OMDb through server proxy
    const proxyedUrl = proxyUrl(url.toString());
    const res = await fetch(proxyedUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`OMDb ${res.status}`);
    const data = await res.json();
    if (data.Response === 'False') throw new Error(data.Error || 'OMDb: not found');
    this.cache.set(key, data);
    return data;
  }
  async search(query, page = 1) { return this._get({ s: query, page }); }
  async byImdbId(imdbId) { return this._get({ i: imdbId, plot: 'full' }); }
}

// ══════════════════════════════════════════════════════════════════════
// ══ STREAMING SOURCES ══
// ══════════════════════════════════════════════════════════════════════

// ── STREAMING SOURCES ──
// Only sources that are LIVE and working (tested May 2026)
// SOURCE CHAIN (cracked May 2026):
//   vidsrc.to  → vsembed.ru → cloudnestra.com/rcp/{hash} (3 servers: CloudStream Pro, 2Embed, Superembed)
//   vidsrc.pm  → brightpathsignals.com (own player)
//   2embed.skin → 2embed.cc → streamsrcs.2embed.cc/swish
//   vidsrcme.ru → DEAD embed domain, use vidsrc-embed.ru (June 2026). Episode format: s-e (dash).
//   vidsrc.dev → vidsrc.su (dev domain died, .su is the replacement)
//   cloudnestra uses rotating CDN: {sha256_token}.{cfd|rest|cyou} domains, rotated every 3h
//   Content DB: Cinemeta v3 (v3-cinemeta.strem.io) — master catalog all sites pull from
// Dead/removed: vidsrc.xyz(DNS), vidsrc.icu(DNS), vidsrc.cc(403), autoembed(H2 err),
//   blackvid(H2 err), moviesapi.club(DNS), vidsrc.pro(embed.su DNS fail), wootly(stub)
// ── PLAYMOGO SHORT CODES ──
// Playmogo uses random short codes (not IMDB IDs). Map IMDB IDs → short codes here.
// When a code exists, the Playmogo tab auto-loads the correct URL.
// Unknown IMDB IDs return null → Playmogo tab suggests using Direct URL instead.
const PLAYMOGO_SHORTS = {
  'tt1190634': 'bo9lrfqmfhmm',  // The Boys
};

// Each source function receives { tmdbId, imdbId } — prefer imdbId when available
const STREAM_SOURCES = {
  videasy:     { name: '⚡ Videasy',      movie: ids => `https://player.videasy.net/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://player.videasy.net/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidbinge:    { name: '🎬 VidBinge',     movie: ids => `https://vidbinge.dev/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidbinge.dev/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidsrc2:     { name: '⚡ VidSrc 2',     movie: ids => `https://vidsrc.to/embed/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidsrc.to/embed/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidsrcpm:    { name: '🎬 VidSrc PM',    movie: ids => `https://vidsrc.pm/embed/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidsrc.pm/embed/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidsrcme:    { name: '📡 VidSrc Me',    movie: ids => `https://vidsrc-embed.ru/embed/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidsrc-embed.ru/embed/tv/${ids.imdbId || ids.tmdbId}/${s}-${e}` },
  embedrev:    { name: '🔁 EmbedRev',     movie: ids => `https://www.embedrev.com/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://www.embedrev.com/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  flicky:      { name: '🎞 Flicky',       movie: ids => `https://flicky.host/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://flicky.host/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidlink:     { name: '🔗 VidLink',      movie: ids => `https://vidlink.pro/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidlink.pro/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  smashy:      { name: '💥 Smashy',       movie: ids => `https://embed.smashystream.com/playere.php?imdb=${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://embed.smashystream.com/playere.php?imdb=${ids.imdbId || ids.tmdbId}&season=${s}&episode=${e}` },
  multiembed:  { name: '🔗 MultiEmbed',   movie: ids => ids.imdbId ? `https://multiembed.mov/?video_id=${ids.imdbId}` : `https://multiembed.mov/?video_id=${ids.tmdbId}&tmdb=1`, tv: (ids,s,e) => ids.imdbId ? `https://multiembed.mov/?video_id=${ids.imdbId}&s=${s}&e=${e}` : `https://multiembed.mov/?video_id=${ids.tmdbId}&tmdb=1&s=${s}&e=${e}` },
  embed2:      { name: '2️⃣ 2Embed',      movie: ids => ids.imdbId ? `https://2embed.cc/embed/imdb/${ids.imdbId}` : `https://2embed.cc/embed/${ids.tmdbId}`, tv: (ids,s,e) => ids.imdbId ? `https://2embed.cc/embed/tv/imdb/${ids.imdbId}/${s}/${e}` : `https://2embed.cc/embed/tv/${ids.tmdbId}/${s}/${e}` },
  embed2skin:  { name: '🎭 2Embed Skin',  movie: ids => `https://2embed.skin/embed/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://2embed.skin/embed/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidsrcpro:   { name: '🚀 VidSrc Pro',   movie: ids => `https://vidsrc.pro/embed/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidsrc.pro/embed/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  vidsrcsu:    { name: '🔥 VidSrc Dev',    movie: ids => `https://vidsrc.su/embed/movie/${ids.imdbId || ids.tmdbId}`, tv: (ids,s,e) => `https://vidsrc.su/embed/tv/${ids.imdbId || ids.tmdbId}/${s}/${e}` },
  goojara:     { name: '🟢 Goojara',      movie: ids => null, tv: (ids,s,e) => null, goojara: true },
  playmogo:    { name: '🎬 Playmogo',     movie: ids => PLAYMOGO_SHORTS[ids.imdbId] ? `https://playmogo.com/d/${PLAYMOGO_SHORTS[ids.imdbId]}` : null, tv: (ids,s,e) => PLAYMOGO_SHORTS[ids.imdbId] ? `https://playmogo.com/d/${PLAYMOGO_SHORTS[ids.imdbId]}` : null, playmogo: true },
  lookmovie:   { name: '👁️ LookMovie',    movie: ids => `https://www.lookmovie2.to/movies/view/${(ids.imdbId || '').replace('tt','') || ids.tmdbId}`, tv: (ids,s,e) => `https://www.lookmovie2.to/shows/view/${(ids.imdbId || '').replace('tt','') || ids.tmdbId}` },
  portal:      { name: '💀 Portal',       movie: null, tv: null, portal: true },
};

// Source priority order — tested June 2026
const SOURCE_ORDER = ['vidsrcme','videasy','vidbinge','vidsrcpm','vidsrc2','vidsrcsu','embedrev','flicky','vidlink','smashy','multiembed','embed2','embed2skin','playmogo','portal'];

// ══════════════════════════════════════════════════════════════════════
// ══ GOOJARA SCRAPER ══
// ══════════════════════════════════════════════════════════════════════

// ── GOOJARA SCRAPER ──
// Uses /api/proxy for CORS bypass
const GoojaraScraper = {
  BASE: 'https://ww1.goojara.to',
  IMG_CDN: 'https://md.goojara.to',
  cache: new Map(),
  cacheExpiry: 6 * 60 * 60 * 1000,

  _cacheKey(type, query) { return `gj_${type}_${query.toLowerCase().replace(/\s+/g, '_')}`; },

  async _fetch(url) {
    try {
      // Route through our server proxy
      const proxyedUrl = proxyUrl(url);
      const res = await fetch(proxyedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; }
  },

  async search(title, type = 'movie') {
    const key = this._cacheKey('search', title);
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.ts < this.cacheExpiry) return cached.data;
    }
    const path = type === 'tv' ? 'watch-series' : 'watch-movies';
    const html = await this._fetch(`${this.BASE}/${path}`);
    if (!html) return null;
    const titleLower = title.toLowerCase();
    const regex = /<a\s+href="([^"]+)"\s+title="([^"]+)"/g;
    let match, bestMatch = null;
    while ((match = regex.exec(html)) !== null) {
      const [, href, t] = match;
      if (t.toLowerCase().includes(titleLower.split(' ').slice(0, 2).join(' '))) {
        const slug = href.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
        const imgMatch = html.substring(match.index - 500, match.index).match(/src="([^"]*md\.goojara\.to[^"]*)"/);
        bestMatch = { slug, title: t, coverUrl: imgMatch ? imgMatch[1] : null };
        break;
      }
    }
    this.cache.set(key, { data: bestMatch, ts: Date.now() });
    return bestMatch;
  },

  async getCoverArt(title) {
    const result = await this.search(title);
    return result?.coverUrl || null;
  },

  async getSeriesInfo(slug) {
    const html = await this._fetch(`${this.BASE}/${slug}`);
    if (!html) return null;
    const result = { slug, seasons: [], cast: [], coverUrl: null };
    const imgMatch = html.match(/src="(https?:\/\/md\.goojara\.to\/[^"]+\.jpg)"/);
    if (imgMatch) result.coverUrl = imgMatch[1];
    const castMatch = html.match(/<strong>Cast:<\/strong>\s*(.+?)<\/p>/i);
    if (castMatch) {
      result.cast = castMatch[1].split(',').map(n => n.trim()).filter(Boolean).slice(0, 10).map(name => ({ name, profile_path: null }));
    }
    const seasonRegex = /href="([^"]*\?s=(\d+))"[^>]*>\s*Season\s*(\d+)/gi;
    let sm;
    while ((sm = seasonRegex.exec(html)) !== null) {
      result.seasons.push({ url: sm[1], num: parseInt(sm[2] || sm[3]) });
    }
    if (result.seasons.length === 0) {
      const seasonBlock = html.match(/Season\s+(\d+)/gi);
      if (seasonBlock) {
        result.seasons = [...new Set(seasonBlock.map(s => parseInt(s.match(/\d+/)[0])))].sort().map(n => ({ num: n }));
      }
    }
    return result;
  },

  async getEpisodes(slug, season) {
    const html = await this._fetch(`${this.BASE}/${slug}?s=${season}`);
    if (!html) return [];
    const episodes = [];
    const epRegex = /href="(https?:\/\/[^"]+\/[a-zA-Z0-9]{6})[^"]*"[^>]*title="([^"]*\(S?\d+\.?\s*E?\d+[^)]*\))"/gi;
    let m;
    while ((m = epRegex.exec(html)) !== null) {
      episodes.push({ url: m[1], title: m[2] });
    }
    return episodes;
  }
};

// ══════════════════════════════════════════════════════════════════════
// ══ COVER ART SEARCH ══
// ══════════════════════════════════════════════════════════════════════

// ── COVER ART SEARCH ──
// Multi-source poster/cover art fetcher — Server proxy + TMDB + Goojara + Cinemeta
const CoverArtSearch = {
  IMG_BASE: 'https://image.tmdb.org/t/p',

  async search(title, year = '', type = 'movie') {
    // 1. Try server-side cover art API (TMDB + OMDb + Goojara + Cinemeta)
    try {
      const res = await fetch(`/api/cover-art?title=${encodeURIComponent(title)}&year=${year}&type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (data.poster) {
          return {
            poster: data.poster,
            backdrop: data.backdrop,
            dvdCover: data.dvdCover,
            source: 'server-api',
            id: data.tmdbData?.id,
            cast: data.tmdbData?.credits?.cast?.slice(0, 10) || [],
            omdb: data.omdbData || null,
          };
        }
      }
    } catch {}

    // 2. Try TMDB API directly via proxy
    if (CONFIG.tmdb.apiKey) {
      try {
        const data = await tmdbApi.search(title);
        const match = data.results?.find(m => {
          const t = (m.title || m.name || '').toLowerCase();
          const q = title.toLowerCase();
          const y = (m.release_date || m.first_air_date || '').slice(0, 4);
          return t.includes(q) || q.includes(t) || (year && y === year);
        });
        if (match?.poster_path) {
          return {
            poster: `${this.IMG_BASE}/w500${match.poster_path}`,
            backdrop: match.backdrop_path ? `${this.IMG_BASE}/original${match.backdrop_path}` : null,
            source: 'tmdb',
            id: match.id
          };
        }
      } catch {}
    }

    // 3. Try Goojara CDN via proxy
    try {
      const coverUrl = await GoojaraScraper.getCoverArt(title);
      if (coverUrl) {
        return { poster: coverUrl, backdrop: null, source: 'goojara', id: null };
      }
    } catch {}

    // 4. Placeholder
    const encoded = encodeURIComponent(title || '?');
    return {
      poster: `https://placehold.co/500x750/1a1a2e/e50914?text=${encoded}&font=inter`,
      backdrop: null,
      source: 'placeholder',
      id: null
    };
  },

  async webSearch(title) {
    try {
      const res = await fetch(`/api/image-search?q=${encodeURIComponent(title + ' movie poster')}`);
      if (res.ok) {
        const data = await res.json();
        return data.images || [];
      }
    } catch {}
    return [];
  },

  quickPoster(posterPath, title = '?') {
    if (!posterPath) {
      const encoded = encodeURIComponent(title);
      return `https://placehold.co/500x750/1a1a2e/e50914?text=${encoded}&font=inter`;
    }
    if (posterPath.startsWith('http')) return posterPath;
    const cleanPath = posterPath.startsWith('/') ? posterPath : '/' + posterPath;
    return `${this.IMG_BASE}/w500${cleanPath}`;
  }
};

// ══════════════════════════════════════════════════════════════════════
// ══ COVER ART CACHE ══
// ══════════════════════════════════════════════════════════════════════

// ── COVER ART CACHE (localStorage memory bank) ──
// Persists poster/backdrop URLs so they survive page refresh
const CoverArtCache = {
  STORAGE_KEY: 'cinevault_cover_bank',
  MAX_ENTRIES: 2000,
  PREWARM_LIMIT: 2000,
  _memoryBank: null,

  _load() {
    if (this._memoryBank) return this._memoryBank;
    try {
      this._memoryBank = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      const keys = Object.keys(this._memoryBank);
      if (keys.length > this.MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => (this._memoryBank[b].savedAt || '').localeCompare(this._memoryBank[a].savedAt || ''));
        this._memoryBank = Object.fromEntries(sorted.slice(0, this.MAX_ENTRIES).map(key => [key, this._memoryBank[key]]));
        this._save(this._memoryBank);
      }
    }
    catch { this._memoryBank = {}; }
    return this._memoryBank;
  },
  _save(bank) {
    this._memoryBank = bank || {};
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bank)); } catch {}
  },

  // Get a cached poster by TMDB ID or title
  get(id, title = '') {
    const bank = this._load();
    // Try by ID first
    if (id && bank[`tmdb_${id}`]) return bank[`tmdb_${id}`];
    // Try by title key
    if (title) {
      const key = `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      for (const [k, v] of Object.entries(bank)) {
        if (k.startsWith('ttl_') && k.includes(key)) return v;
      }
    }
    return null;
  },

  // Save a poster to the bank
  save(id, title, data) {
    const bank = this._load();
    const entry = {
      poster: data.poster || null,
      backdrop: data.backdrop || null,
      dvdCover: data.dvdCover || null,
      source: data.source || 'unknown',
      title: title || '',
      savedAt: new Date().toISOString(),
      ...(id ? { tmdbId: id } : {}),
    };
    if (id) bank[`tmdb_${id}`] = entry;
    if (title) {
      const titleKey = `ttl_${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      bank[titleKey] = entry;
    }
    // Evict oldest entries if over max
    const keys = Object.keys(bank);
    if (keys.length > this.MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => (bank[a].savedAt || '').localeCompare(bank[b].savedAt || ''));
      for (let i = 0; i < keys.length - this.MAX_ENTRIES; i++) delete bank[sorted[i]];
    }
    this._save(bank);
    // Also persist to server cover bank (fire and forget)
    if (id || title) {
      const key = id ? `tmdb_${id}` : `ttl_${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      fetch('/api/cover-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...entry }),
      }).catch(() => {});
    }
    return entry;
  },

  // Check if we have a cached poster for a movie
  has(id, title = '') {
    return this.get(id, title) !== null;
  },

  // Pre-warm cache from server on startup
  async prewarm() {
    try {
      const res = await fetch('/api/cover-bank?all=1&limit=2000');
      if (res.ok) {
        const data = await res.json();
        if (data.entries) {
          const bank = this._load();
          let added = 0;
          for (const [key, entry] of Object.entries(data.entries)) {
            if (added >= this.PREWARM_LIMIT) break;
            if (!bank[key]) { bank[key] = entry; added++; }
          }
          if (added > 0) this._save(bank);
          console.log(`[CoverArtCache] Pre-warmed ${added} entries from server`);
        }
      }
    } catch {}
  }
};

// ══════════════════════════════════════════════════════════════════════
// ══ MOVIE LOGS ══
// ══════════════════════════════════════════════════════════════════════

// ── MOVIE LOGS ──
// Tracks movie additions, updates, and watches via server API
const MovieLogs = {
  async add(type, title, id = null, details = {}) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          id,
          season: details.season || null,
          episode: details.episode || null,
          source: details.source || '',
          details: details.details || '',
        }),
      });
    } catch {}
    // Also save to localStorage for offline viewing
    try {
      const logs = JSON.parse(localStorage.getItem('cinevault_logs') || '[]');
      logs.unshift({
        type, title, id, ...details,
        timestamp: new Date().toISOString(),
      });
      if (logs.length > 200) logs.length = 200;
      localStorage.setItem('cinevault_logs', JSON.stringify(logs));
    } catch {}
  },

  async get(limit = 50, type = '') {
    try {
      const res = await fetch(`/api/logs?limit=${limit}${type ? '&type=' + type : ''}`);
      if (res.ok) return await res.json();
    } catch {}
    // Fallback to localStorage
    try {
      const logs = JSON.parse(localStorage.getItem('cinevault_logs') || '[]');
      return type ? logs.filter(l => l.type === type) : logs;
    } catch { return []; }
  },

  // Get logs from localStorage only (fast, no network)
  getLocal(limit = 50) {
    try {
      const logs = JSON.parse(localStorage.getItem('cinevault_logs') || '[]');
      return logs.slice(0, limit);
    } catch { return []; }
  }
};

// ══════════════════════════════════════════════════════════════════════
// ══ AUTO-ENRICH ══
// ══════════════════════════════════════════════════════════════════════

// ── AUTO-ENRICH ──
// When a new movie/show appears, auto-fetch cover art + cast bio
const AutoEnrich = {
  _enriched: new Set(),

  async enrich(tmdbId, type = 'movie') {
    if (!tmdbId) return null;
    const key = `${type}_${tmdbId}`;
    if (this._enriched.has(key)) return null; // already enriched
    this._enriched.add(key);

    try {
      const res = await fetch(`/api/auto-enrich?id=${tmdbId}&type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (data.poster || data.cast?.length) {
          // Log the enrichment
          MovieLogs.add('update', data.title || 'Unknown', tmdbId, {
            source: 'auto-enrich',
            details: `Auto-fetched cover art + ${data.cast?.length || 0} cast members`
          });
          return data;
        }
      }
    } catch {}
    return null;
  },

  // Enrich all movies in a list (batch)
  async enrichBatch(movies, type = 'movie') {
    for (const movie of movies) {
      if (movie.id && !this._enriched.has(`${type}_${movie.id}`)) {
        await this.enrich(movie.id, type);
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }
};

// ══════════════════════════════════════════════════════════════════════
// ══ FRANCHISES & SHOW DATABASE ══
// ══════════════════════════════════════════════════════════════════════

// ── FRANCHISES & SHOW DATABASE ──
if (typeof FRANCHISES === 'undefined') {
  const FRANCHISES = {
    marvel:       { title: '🦸 Marvel Universe',    type: 'movie', ids: [76338,1771,10023,4951,68721,299534,299536,299537,429617,508943,566525,361743,420818,634649,580489,603692,705861,616037,102611,495764,24428,284052,497698,471574,527771,41421,91314] },
    spiderman:    { title: '🕷️ Spider-Man',          type: 'movie', ids: [557,558,559,102611,324549,324552,616037,634649,76338,102610] },
    mib:          { title: '🕶️ Men in Black',          type: 'movie', ids: [608,609,610,43964,457232] },
    theboys:      { title: '💥 The Boys',              type: 'tv',    ids: [76479], seasons: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 } },
  };
}

async function enrichWithOMDb(tmdbMovie) {
  if (!CONFIG.omdb.apiKey || !tmdbMovie.imdb_id) return tmdbMovie;
  try {
    const omdb = await omdbApi.byImdbId(tmdbMovie.imdb_id);
    return { ...tmdbMovie, omdb: { ratings: omdb.Ratings || [], rated: omdb.Rated, runtime: omdb.Runtime, boxOffice: omdb.BoxOffice, awards: omdb.Awards, fullPlot: omdb.Plot } };
  } catch { return tmdbMovie; }
}

const tmdbApi = new TMDBApi();
const omdbApi = new OMDbApi();

// ── CINEMETA API ──
// Fetches metadata from Cinemeta via server proxy
class CinemetaApi {
  constructor() {
    this.cache = new Map();
  }
  async _get(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    const res = await fetch(`/api/cinemeta${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Cinemeta ${res.status}`);
    const data = await res.json();
    this.cache.set(path, data);
    return data;
  }
  async movieDetails(imdbId) {
    const data = await this._get(`/meta/movie/${imdbId}.json`);
    return data?.meta || null;
  }
  async tvDetails(imdbId) {
    const data = await this._get(`/meta/series/${imdbId}.json`);
    return data?.meta || null;
  }
}
const cinemetaApi = new CinemetaApi();
