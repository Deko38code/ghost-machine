// ── CineVault API Configuration ──
// TMDB API key (v3 auth) — free at https://www.themoviedb.org/settings/api
// OMDb API key — now fetched securely from /api/config (server-side)
// Stalker portal MAC/URL — now fetched securely from /api/config (server-side)

const CONFIG = {
  tmdb: {
    apiKey: '',           // ← TMDB API key (optional — Cinemeta+OMDb work without it)
    baseUrl: 'https://api.themoviedb.org/3',
    imgBase: 'https://image.tmdb.org/t/p',
    posterSize: 'w500',
    backdropSize: 'original',
  },
  omdb: {
    apiKey: '',           // ← populated from /api/config on load
    baseUrl: 'https://www.omdbapi.com',
  },
  macattack: {
    portals: [],
    autoLoad: true,
    preloaded: true,
  },
  stalkerPortals: []      // ← populated from /api/config on load
};

// ── Fetch secure config from server (secrets stay server-side) ──
(async () => {
  try {
    const r = await fetch('/api/config');
    if (r.ok) {
      const data = await r.json();
      if (data.stalkerPortals) CONFIG.stalkerPortals = data.stalkerPortals;
      if (data.omdbApiKey) CONFIG.omdb.apiKey = data.omdbApiKey;
    }
  } catch (e) {
    console.warn('Config fetch failed, using defaults:', e);
  }
})();