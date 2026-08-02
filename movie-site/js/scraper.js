// ── CineVault Auto-Scraper ──
// Fetches newest seasons, episodes, trending daily
// Caches in localStorage, refreshes every 6 hours
// Adds Live PD, TruTV, reality, crime, action franchises

const SCRAPER_CACHE_KEY = 'cinevault_scrape_cache';
const SCRAPER_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

const SCRAPER = {
  cache: {},
  lastFetch: 0,

  init() {
    try {
      this.cache = JSON.parse(localStorage.getItem(SCRAPER_CACHE_KEY)) || {};
      this.lastFetch = parseInt(localStorage.getItem(SCRAPER_CACHE_KEY + '_ts')) || 0;
    } catch { this.cache = {}; this.lastFetch = 0; }
  },

  save() {
    try {
      localStorage.setItem(SCRAPER_CACHE_KEY, JSON.stringify(this.cache));
      localStorage.setItem(SCRAPER_CACHE_KEY + '_ts', String(this.lastFetch));
    } catch {}
  },

  isStale() {
    return Date.now() - this.lastFetch > SCRAPER_INTERVAL;
  },

  // ── TMDB fetch with cache ──
  async fetch(endpoint, params = {}) {
    if (!CONFIG.tmdb.apiKey) return null;
    const url = new URL(`${CONFIG.tmdb.baseUrl}${endpoint}`);
    url.searchParams.set('api_key', CONFIG.tmdb.apiKey);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const key = url.toString();
    if (this.cache[key] && !this.isStale()) return this.cache[key];
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      this.cache[key] = data;
      this.save();
      return data;
    } catch { return null; }
  },

  // ── Scrape newest episodes for a TV show ──
  async getLatestEpisodes(tvId, seasons = 1) {
    if (!CONFIG.tmdb.apiKey) return [];
    try {
      const showData = await this.fetch(`/tv/${tvId}`, { append_to_response: 'credits' });
      if (!showData) return [];
      const totalSeasons = showData.number_of_seasons || 1;
      const episodes = [];
      // Fetch last N seasons
      const startSeason = Math.max(1, totalSeasons - seasons + 1);
      for (let s = startSeason; s <= totalSeasons; s++) {
        const seasonData = await this.fetch(`/tv/${tvId}/season/${s}`);
        if (seasonData?.episodes) {
          seasonData.episodes.forEach(ep => {
            episodes.push({
              id: tvId,
              season: s,
              episode: ep.episode_number,
              title: ep.name || `S${s}E${ep.episode_number}`,
              overview: ep.overview || '',
              still: ep.still_path,
              airDate: ep.air_date || '',
              rating: ep.vote_average,
              runtime: ep.runtime || showData.episode_run_time?.[0] || 42,
              showName: showData.name || showData.title,
              type: 'tv',
              media_type: 'tv',
              poster_path: showData.poster_path,
              backdrop_path: showData.backdrop_path,
            });
          });
        }
      }
      return episodes;
    } catch { return []; }
  },

  // ── Get all shows in a collection with latest season ──
  async getShowWithSeasons(tvId) {
    const show = await this.fetch(`/tv/${tvId}`);
    if (!show) return null;
    // Get the latest season episodes
    const latestSeason = show.number_of_seasons || 1;
    const seasonData = await this.fetch(`/tv/${tvId}/season/${latestSeason}`);
    return {
      ...show,
      latestSeason,
      episodes: seasonData?.episodes || [],
      media_type: 'tv'
    };
  }
};

// ── SHOW DATABASE ──
// TV Shows organized by category — always fresh, episodes auto-scraped
const SCRAPER_SHOW_DATABASE = {
  // ── Live PD / TruTV / Reality ──
  livepd: {
    title: '🚔 Live PD & Reality Crime',
    shows: [
      { id: 67158, name: 'Cops' },
      { id: 71663, name: 'Live PD' },
      { id: 85968, name: 'Panic' },
      { id: 89826, name: '61st Street' },
      { id: 94555, name: 'Accused' },
    ]
  },
  trutv: {
    title: '📺 TruTV & True Crime',
    shows: [
      { id: 4087, name: 'Forensic Files' },
      { id: 2615, name: 'Law & Order: SVU' },
      { id: 2734, name: 'Law & Order' },
      { id: 1100, name: 'NCIS' },
      { id: 4614, name: 'Criminal Minds' },
      { id: 2287, name: 'CSI: Crime Scene Investigation' },
    ]
  },
  crime: {
    title: '🔫 Crime & Investigation',
    shows: [
      { id: 4626, name: 'CSI: NY' },
      { id: 55316, name: 'CSI: Cyber' },
      { id: 102022, name: 'CSI: Vegas' },
      { id: 4614, name: 'Criminal Minds' },
      { id: 202250, name: 'Criminal Minds: Evolution' },
      { id: 1622, name: 'Sherlock' },
      { id: 2478, name: 'Dexter' },
      { id: 1396, name: 'Breaking Bad' },
      { id: 71912, name: 'Ozark' },
      { id: 82856, name: 'Peaky Blinders' },
    ]
  },
  action: {
    title: '💥 Action & Thriller TV',
    shows: [
      { id: 76479, name: 'The Boys' },
      { id: 1399, name: 'Game of Thrones' },
      { id: 82856, name: 'Peaky Blinders' },
      { id: 66732, name: 'Stranger Things' },
      { id: 70536, name: 'Dark' },
      { id: 57243, name: 'House of Cards' },
      { id: 60573, name: 'Black Mirror' },
      { id: 67915, name: 'The Witcher' },
      { id: 88396, name: 'The Falcon and the Winter Soldier' },
      { id: 93484, name: 'Loki' },
    ]
  },
  comedy: {
    title: '😂 Comedy TV',
    shows: [
      { id: 2190, name: 'South Park' },
      { id: 1434, name: 'Family Guy' },
      { id: 60625, name: 'Rick and Morty' },
      { id: 2316, name: 'The Office' },
      { id: 2190, name: 'South Park' },
      { id: 45793, name: 'Brooklyn Nine-Nine' },
      { id: 48891, name: 'The Good Place' },
      { id: 1668, name: 'Friends' },
    ]
  },
  kids: {
    title: '🧒 Kids & Family TV',
    shows: [
      { id: 34307, name: 'Avatar: The Last Airbender' },
      { id: 246, name: 'Avatar: The Last Airbender' },
      { id: 103516, name: 'Star Wars: The Bad Batch' },
      { id: 71446, name: 'Gravity Falls' },
      { id: 62104, name: 'Teen Titans Go!' },
    ]
  },
  anime: {
    title: '🎌 Anime',
    shows: [
      { id: 37854, name: 'One Piece' },
      { id: 12971, name: 'Dragon Ball Z' },
      { id: 8592, name: 'Naruto' },
      { id: 1429, name: 'Attack on Titan' },
      { id: 62104, name: 'My Hero Academia' },
      { id: 100283, name: 'Jujutsu Kaisen' },
      { id: 125141, name: 'Spy x Family' },
      { id: 104281, name: 'Demon Slayer' },
    ]
  }
};

window.SCRAPER = SCRAPER;
window.SCRAPER_SHOW_DATABASE = SCRAPER_SHOW_DATABASE;