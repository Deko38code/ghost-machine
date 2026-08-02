// ── CineVault App ──
// Main logic: init, render, events, player, franchises, stalker

(function() {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  // ── DOM refs ──
  const searchInput  = $('#search-input');
  const searchBtn    = $('#search-btn');
  const themeToggle  = $('#theme-toggle');
  const navLinks     = $$('.nav-link');
  const hero         = $('#hero');
  const heroTitle    = $('#hero-title');
  const heroOverview = $('#hero-overview');
  const heroMeta     = $('#hero-meta');
  const heroPlay     = $('#hero-play');
  const heroInfo     = $('#hero-info');
  const heroList     = $('#hero-list');
  const mainContent  = $('#main-content');

  // Sections
  const trendingSection = $('#trending-section');
  const topRatedSection = $('#top-rated-section');
  const curatedSection  = $('#curated-section');
  const watchlistSection = $('#watchlist-section');
  const searchSection   = $('#search-section');
  const logsSection     = $('#logs-section');
  const genresSection   = $('#genres-section');
  const stalkerSection  = $('#stalker-section');
  const livetvSection   = $('#livetv-section');
  const aiSection       = $('#ai-section');

  // Grids / rows
  const trendingRow  = $('#trending-row');
  const topRatedRow  = $('#top-rated-row');
  const curatedRow   = $('#curated-row');
  const watchlistGrid = $('#watchlist-grid');
  const searchGrid   = $('#search-grid');
  const genreRow     = $('#genre-row');
  const watchlistEmpty = $('#watchlist-empty');
  const searchEmpty  = $('#search-empty');
  const searchTitle  = $('#search-title');

  // Modal
  const modalOverlay = $('#modal-overlay');
  const modalClose   = $('#modal-close');
  const modalBackdrop = $('#modal-backdrop');
  const modalPosterImg = $('#modal-poster-img');
  const modalTitle   = $('#modal-title');
  const modalMeta    = $('#modal-meta');
  const modalOverview = $('#modal-overview');
  const modalTrailer = $('#modal-trailer');
  const modalWatchlist = $('#modal-watchlist');
  const modalCast    = $('#modal-cast');
  const modalSources = $('#modal-sources');

  // Player
  const playerOverlay = $('#player-overlay');
  const playerClose   = $('#player-close');
  const playerTitle    = $('#player-title-text');
  const playerVideoWrap = $('#player-video-wrap');
  const playerSpinner = $('#player-spinner');
  const playerProgress = $('#player-progress');
  const playerTime    = $('#player-time');
  const playerPlayBtn = $('#player-play-btn');
  const playerVolSlider = $('#player-vol-slider');
  const playerControls = $('#player-controls');

  // State
  let currentPage = 'home';
  let currentMovieData = null;
  let heroMovie = null;
  let isPlaying = false;
  let isPaused = false;
  let hideControlsTimer = null;
  let playerElement = null;

  // ── POSTER HELPER ──
  // TMDB image base + Cinemeta metahub CDN + Goojara CDN fallbacks
  const IMG_BASE = 'https://image.tmdb.org/t/p';
  const GOOJARA_IMG = 'https://md.goojara.to';
  const METAHUB_IMG = 'https://images.metahub.space';

  function posterUrl(path, size = 'w500') {
    if (!path) return 'assets/no-poster.svg';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${IMG_BASE}/${size}${cleanPath}`;
  }
  function backdropUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${IMG_BASE}/original${cleanPath}`;
  }
  // Cinemeta poster by IMDB ID (best quality, always works)
  function cinemetaPoster(imdbId, size = 'medium') {
    if (!imdbId) return '';
    return `${METAHUB_IMG}/poster/${size}/${imdbId}/img`;
  }
  function cinemetaBg(imdbId, size = 'medium') {
    if (!imdbId) return '';
    return `${METAHUB_IMG}/background/${size}/${imdbId}/img`;
  }
  function cinemetaLogo(imdbId, size = 'medium') {
    if (!imdbId) return '';
    return `${METAHUB_IMG}/logo/${size}/${imdbId}/img`;
  }
  // TMDB ID → IMDB ID mapping (for Cinemeta fallback without TMDB API key)
  const TMDB_TO_IMDB = {
    8:'tt0088763', 9:'tt0096874', 10:'tt0099088', 11:'tt0076759', 12:'tt0266543',
    13:'tt0109830', 21:'tt0060371', 22:'tt0325980', 24:'tt0266697', 26:'tt0352994',
    58:'tt0383574', 62:'tt0062622', 85:'tt0082971', 86:'tt0084467', 87:'tt0097576',
    89:'tt0097576', 93:'tt0120382', 98:'tt0172495', 120:'tt0167261', 121:'tt0120737',
    122:'tt0167260', 155:'tt0468569', 165:'tt0119698', 194:'tt0118799', 218:'tt0088247',
    238:'tt0068646', 254:'tt0360717', 266:'tt0057345', 268:'tt0372784', 272:'tt0112461',
    274:'tt0102926', 278:'tt0111161', 287:'tt0325980', 303:'tt0325980', 329:'tt0107290',
    330:'tt0119567', 331:'tt0119568', 335:'tt0367882', 346:'tt0114369', 348:'tt0113481',
    366:'tt0095016', 367:'tt0095016', 368:'tt0095016', 369:'tt0095016', 399:'tt0086879',
    411:'tt0078748', 414:'tt0112462', 419:'tt0081505', 424:'tt0108052', 500:'tt0105236',
    532:'tt0090605', 539:'tt0093057', 550:'tt0137523', 557:'tt0145487', 558:'tt0316654',
    559:'tt0413300', 572:'tt0062622', 590:'tt0098408', 603:'tt0133093', 604:'tt0234215',
    605:'tt0242653', 608:'tt0119654', 609:'tt0120912', 610:'tt0349494', 631:'tt0078748',
    637:'tt0118799', 650:'tt0101507', 656:'tt0091258', 659:'tt0082971', 670:'tt0075688',
    671:'tt0082971', 672:'tt0091258', 679:'tt0090605', 680:'tt0078748', 681:'tt0066995',
    686:'tt0091258', 687:'tt0086879', 693:'tt0081505', 707:'tt0086879', 710:'tt0075688',
    722:'tt0082971', 76338:'tt1211837', 769:'tt0078748', 809:'tt0298148', 810:'tt0093057',
    812:'tt0185795', 824:'tt0203009', 8592:'tt0988824', 8587:'tt0268380', 8588:'tt0093057',
    8589:'tt0408472', 862:'tt0114709', 863:'tt0211915', 887:'tt0036868', 920:'tt0119698',
    921:'tt0352248', 946:'tt0040536', 947:'tt0232500', 954:'tt0117060', 956:'tt0120755',
    957:'tt0120755', 958:'tt0120755', 94605:'tt0119698', 95396:'tt0078748', 10023:'tt0162220',
    100283:'tt12844910', 10088:'tt0078748', 10138:'tt1228705', 10193:'tt0078748',
    10273:'tt6304046', 10340:'tt0325980', 104281:'tt9335498', 10702:'tt3696720',
    10721:'tt0088247', 10764:'tt0075688', 10766:'tt0082971', 10778:'tt0091258',
    1100:'tt0364845', 11216:'tt0095765', 11574:'tt0065051', 11594:'tt0116583',
    12291:'tt0120737', 125141:'tt14528586', 12971:'tt0122281', 135397:'tt0369610',
    1396:'tt0903747', 1399:'tt0944947', 1429:'tt2560140', 1434:'tt0182576', 1492:'tt0103594',
    157336:'tt0816692', 1585:'tt0038650', 1622:'tt1475582', 1668:'tt0108778', 168259:'tt1905041',
    181808:'tt0458369', 1891:'tt0086190', 1892:'tt0082971', 1893:'tt0075688',
    1894:'tt0086879', 1895:'tt0091258', 194:'tt0118799', 2001:'tt0416449',
    2002:'tt0416449', 2003:'tt0416449', 2004:'tt0177882', 2105:'tt0102926',
    2190:'tt0121955', 2287:'tt0275140', 2316:'tt0386676', 2396:'tt0075148',
    2397:'tt0076171', 2398:'tt0077066', 2399:'tt0081680', 2402:'tt0086178',
    24428:'tt0848228', 245891:'tt2911666', 24637:'tt0458369', 2478:'tt0773262',
    2615:'tt0629480', 263115:'tt3315342', 268:'tt0372784', 27205:'tt0095016',
    2734:'tt0094760', 278154:'tt3416828', 281338:'tt2872718', 284052:'tt4154758',
    2899:'tt0253124', 290859:'tt6450804', 293660:'tt1431045', 299534:'tt4154756',
    299536:'tt4154758', 299537:'tt4154664', 302694:'tt2802144', 31911:'tt1795061',
    324549:'tt6791350', 324552:'tt10872600', 326291:'tt3253734', 326473:'tt0325980',
    329869:'tt0107290', 330459:'tt2527336', 335784:'tt1464335', 337339:'tt4630562',
    338761:'tt0325980', 348350:'tt2527336', 351286:'tt0119567', 354912:'tt0119568',
    359516:'tt0119654', 361197:'tt0120912', 361743:'tt9032400', 370913:'tt0086879',
    372658:'tt2527336', 383498:'tt5463162', 385687:'tt5433138', 40011:'tt0276651',
    407201:'tt4467194', 408529:'tt3648024', 4087:'tt0247364', 408826:'tt0091007',
    41421:'tt0372784', 420818:'tt4154758', 429617:'tt1825683', 438799:'tt4530422',
    43964:'tt0120912', 440922:'tt0112462', 444489:'tt0165374', 4470:'tt0136461',
    447365:'tt6791350', 457232:'tt0120912', 458156:'tt6146586', 4614:'tt0452046',
    46260:'tt0102926', 46610:'tt2117962', 471574:'tt6228896', 48883:'tt0043824',
    48891:'tt0498441', 49026:'tt0167261', 49051:'tt0120737', 4951:'tt0113481',
    495764:'tt6791350', 496243:'tt6751668', 4971:'tt2872732', 497698:'tt4154736',
    500:'tt0105236', 50619:'tt1324999', 508439:'tt0119568', 508943:'tt4154664',
    51439:'tt1596343', 527771:'tt1877830', 533535:'tt6263850', 53423:'tt0186810',
    53647:'tt0167260', 55316:'tt4292586', 566525:'tt6320628', 568124:'tt2953050',
    577922:'tt12849262', 580489:'tt12844910', 60059:'tt0078748', 603692:'tt15398776',
    60573:'tt2085059', 60574:'tt2803304', 60625:'tt2861424', 608:'tt0119654',
    609:'tt0120912', 610:'tt0349494', 618344:'tt6320628', 62104:'tt0118799',
    624860:'tt10872600', 62710:'tt0102926', 634649:'tt9362722', 637:'tt0118799',
    64688:'tt0075688', 650:'tt0101507', 653346:'tt11389872', 656:'tt0091258',
    659:'tt0082971', 66732:'tt4574334', 67158:'tt0102926', 67195:'tt0325980',
    67915:'tt5180504', 680:'tt0110912', 681:'tt0066995', 686:'tt0091258',
    687:'tt0086879', 693:'tt0081505', 70059:'tt0102926', 70160:'tt0118799',
    70161:'tt0118799', 70162:'tt0118799', 70163:'tt0118799', 70524:'tt0102926',
    70536:'tt0185806', 70548:'tt3533430', 705861:'tt9213124', 707:'tt0086879',
    710:'tt0075688', 714166:'tt0433043', 71446:'tt0102926', 71663:'tt0325980',
    71912:'tt5071412', 722:'tt0082971', 76338:'tt1211837', 76479:'tt1190634',
    769:'tt0078748', 77169:'tt0102926', 809:'tt0298148', 810:'tt0093057',
    812:'tt0185795', 824:'tt0203009', 82674:'tt1291671', 82819:'tt7366338',
    82856:'tt2803304', 84958:'tt0120755', 85271:'tt0117060', 8592:'tt0988824',
    85968:'tt0119698', 8587:'tt0268380', 87101:'tt0186810', 88396:'tt0078748',
    89826:'tt0102926', 91314:'tt2109248', 920:'tt0119698', 921:'tt0352248',
    93405:'tt0325980', 93484:'tt0095016', 94555:'tt0102926', 946:'tt0040536',
    947:'tt0232500', 9476:'tt0183790', 9480:'tt3322312', 9483:'tt0388395',
    958:'tt0120755', 4626:'tt0393727', 48883:'tt0043824', 48891:'tt0498441',
    4951:'tt0113481', 508943:'tt4154664', 51439:'tt1596343', 168259:'tt1905041',
    181812:'tt2527336', 263115:'tt3315342', 278154:'tt3416828', 102022:'tt14643072',
    102611:'tt2250912', 102610:'tt1464335', 103516:'tt0416449', 202250:'tt15475142',
    37854:'tt0388629', 57243:'tt1856010', 616037:'tt10872600', 31911:'tt1795061',
    705861:'tt9213124', 748822:'tt10366206',
    // National Lampoon franchise
    545:'tt0085995', 11104:'tt0089670', 10729:'tt0097958', 43964:'tt0118995',
    551:'tt0077975', 43967:'tt0283111', 43965:'tt0107659',
  };

  function getImdbId(tmdbId) {
    return TMDB_TO_IMDB[tmdbId] || null;
  }

  // ── UNIFIED DATA FETCHER ──
  // Try TMDB first (if key exists), then Cinemeta via IMDB ID, then fallback cached data
  async function fetchMovieData(tmdbId, isTV = false) {
    const fallback = CURATED_FALLBACK.find(m => m.id === tmdbId);
    const isTVShow = isTV || (fallback && !!fallback.first_air_date);

    // 1. Try TMDB if key exists
    if (CONFIG.tmdb.apiKey) {
      try {
        const fetcher = isTVShow ? (id => tmdbApi.tvDetails(id)) : (id => tmdbApi.movieDetails(id));
        const movie = await fetcher(tmdbId);
        if (movie) {
          currentMovieData = movie;
          return { source: 'tmdb', data: movie };
        }
      } catch {}
    }

    // 2. Try Cinemeta via IMDB ID lookup
    const imdbId = getImdbId(tmdbId);
    if (imdbId) {
      try {
        const cm = await cinemetaApi.tvDetails(imdbId) || await cinemetaApi.movieDetails(imdbId);
        if (cm) {
          // ALWAYS prefer fallback title when available — Cinemeta search returns wrong titles for some TMDB IDs
          const fallbackTitle = fallback ? fallback.title : null;
          const resolvedTitle = fallbackTitle || cm.name || `#${tmdbId}`;
          // Normalize Cinemeta data to look like TMDB data
          const normalized = {
            id: tmdbId,
            imdb_id: imdbId,
            title: resolvedTitle,
            name: resolvedTitle,
            overview: cm.description || fallback?.overview || '',
            poster_path: null, // Use Cinemeta poster directly
            backdrop_path: null,
            vote_average: parseFloat(cm.imdbRating) || (fallback ? fallback.rating : null),
            release_date: cm.year ? String(cm.year) : (fallback ? String(fallback.year) : ''),
            first_air_date: cm.type === 'series' ? (cm.year ? String(cm.year) : '') : '',
            genre: cm.genre || [],
            genres: (cm.genre || []).map(g => ({ id: 0, name: g })),
            runtime: cm.runtime ? parseInt(cm.runtime) : null,
            media_type: cm.type === 'series' ? 'tv' : 'movie',
            _cinemeta: cm,
            _source: 'cinemeta',
          };
          currentMovieData = normalized;
          return { source: 'cinemeta', data: normalized };
        }
      } catch {}
    }

    // 3. Fallback to cached/curated data
    if (fallback) {
      const normalized = {
        id: fallback.id,
        title: fallback.title,
        name: fallback.title,
        overview: '',
        poster_path: fallback.poster,
        backdrop_path: null,
        vote_average: fallback.rating,
        release_date: String(fallback.year),
        media_type: 'movie',
        _source: 'fallback',
      };
      currentMovieData = normalized;
      return { source: 'fallback', data: normalized };
    }

    // 4. Last resort — minimal data with TMDB ID only
    const minimal = {
      id: tmdbId,
      title: `#${tmdbId}`,
      name: `#${tmdbId}`,
      overview: '',
      media_type: isTVShow ? 'tv' : 'movie',
      _source: 'none',
    };
    currentMovieData = minimal;
    return { source: 'none', data: minimal };
  }

  // Generate a gradient poster placeholder with the title
  function placeholderPoster(title) {
    const encoded = encodeURIComponent(title || '?');
    return `https://placehold.co/500x750/1a1a2e/e50914?text=${encoded}&font=inter`;
  }

  // ══════════════════════════════
  //  TOAST
  // ══════════════════════════════
  function toast(msg, type = '') {
    const container = $('.toast-container') || (() => {
      const c = document.createElement('div');
      c.className = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 400); }, 3000);
  }

  // ══════════════════════════════
  //  CARD RENDERING
  // ══════════════════════════════
  function movieCard(movie, isGrid = false) {
    const title = movie.title || movie.name || 'Unknown';
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4) || '';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '—';
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');

    // ── VOTE BANK — persist likes/dislikes across refresh ──
    const VOTE_KEY = 'cinevault_votes';
    const movieKey = `${movie.id}_${mediaType}`;
    let votes = {};
    try { votes = JSON.parse(localStorage.getItem(VOTE_KEY) || '{}'); } catch {}
    const myVote = votes[movieKey] || null; // 'like' | 'dislike' | null

    // ── COVER ART CACHE — instant poster from memory bank ──
    let poster = '';
    // 1. Try CoverArtCache first (survives refresh!)
    const cached = typeof CoverArtCache !== 'undefined' ? CoverArtCache.get(movie.id, title) : null;
    if (cached && cached.poster) {
      poster = cached.poster;
    }
    // 2. Cinemeta poster from data
    if (!poster && movie._cinemetaPoster) {
      poster = movie._cinemetaPoster;
    }
    // 3. TMDB poster path
    if (!poster && movie.poster_path) {
      poster = posterUrl(movie.poster_path, isGrid ? 'w342' : 'w500');
    }
    // 4. Cinemeta metahub poster by IMDB ID
    if (!poster) {
      const imdbId = movie.imdb_id || getImdbId(movie.id);
      if (imdbId) {
        const metaPoster = cinemetaPoster(imdbId, isGrid ? 'small' : 'medium');
        if (metaPoster) poster = metaPoster;
      }
    }
    // 5. Placeholder
    if (!poster) poster = placeholderPoster(title);

    // Save to cover bank if we got a real poster
    if (poster && !poster.includes('placehold.co') && !poster.includes('no-poster') && movie.id) {
      if (typeof CoverArtCache !== 'undefined') {
        CoverArtCache.save(movie.id, title, { poster, source: movie._cinemetaPoster ? 'cinemeta' : (movie.poster_path ? 'tmdb' : 'unknown') });
      }
    }

    // Async: try CoverArtSearch for better poster if still placeholder
    if (poster.includes('placehold.co') || poster.includes('no-poster')) {
      const imdbId = movie.imdb_id || getImdbId(movie.id);
      if (imdbId) {
        const bigPoster = cinemetaPoster(imdbId, 'large');
        if (bigPoster) poster = bigPoster;
      }
      CoverArtSearch.search(title, (movie.release_date || '').slice(0, 4), mediaType).then(result => {
        if (result?.poster && card.querySelector('.movie-card-poster')) {
          const img = card.querySelector('.movie-card-poster');
          if (img.src.includes('placehold.co') || img.src.includes('no-poster')) {
            img.src = result.poster;
            // Save found poster to cover bank
            if (typeof CoverArtCache !== 'undefined' && movie.id) {
              CoverArtCache.save(movie.id, title, { poster: result.poster, source: result.source || 'search' });
            }
          }
        }
      }).catch(() => {});
    }
    const fallback = placeholderPoster(title);

    // Vote counts (visual only — we show user's own vote)
    const likeClass = myVote === 'like' ? 'vote-btn liked' : 'vote-btn';
    const dislikeClass = myVote === 'dislike' ? 'vote-btn disliked' : 'vote-btn';

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.mediaType = mediaType;
    card.dataset.id = movie.id;
    card.innerHTML = `
      <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy"
           onerror="this.onerror=null;this.src='${fallback}';">
      <div class="movie-card-overlay">
        <button class="card-overlay-btn btn-play" data-id="${movie.id}">▶ Play</button>
        <button class="card-overlay-btn btn-info" data-id="${movie.id}">ℹ️ Info</button>
      </div>
      <div class="movie-card-votes">
        <button class="${likeClass}" data-action="like" data-key="${movieKey}" title="Like">👍</button>
        <button class="${dislikeClass}" data-action="dislike" data-key="${movieKey}" title="Dislike">👎</button>
      </div>
      <div class="movie-card-info">
        <div class="movie-card-title">${title}</div>
        <div class="movie-card-meta">
          <span>${year}</span>
          <span class="movie-card-rating">⭐ ${rating}</span>
        </div>
      </div>
    `;

    // ── Vote button handlers ──
    card.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const key = btn.dataset.key;
        const current = votes[key] || null;
        // Toggle: clicking same vote removes it
        const newVote = current === action ? null : action;
        if (newVote) votes[key] = newVote;
        else delete votes[key];
        try { localStorage.setItem(VOTE_KEY, JSON.stringify(votes)); } catch {}
        // Update button classes
        const likeBtn = card.querySelector('[data-action="like"]');
        const dislikeBtn = card.querySelector('[data-action="dislike"]');
        likeBtn.className = newVote === 'like' ? 'vote-btn liked' : 'vote-btn';
        dislikeBtn.className = newVote === 'dislike' ? 'vote-btn disliked' : 'vote-btn';
      });
    });

    card.addEventListener('click', (e) => {
      if (e.target.closest('.vote-btn')) return; // already handled above
      if (e.target.closest('.btn-info')) {
        e.stopPropagation();
        openModal(movie.id, mediaType === 'tv');
      } else {
        // Auto-play on ANY card click (Play button, poster click, etc.)
        e.stopPropagation();
        openPlayer(movie.id, mediaType === 'tv');
      }
    });

    return card;
  }

  function skeletonCard() {
    const s = document.createElement('div');
    s.className = 'movie-card skeleton';
    s.innerHTML = `<div class="skeleton-poster"></div><div class="skeleton-text short"></div><div class="skeleton-text"></div>`;
    return s;
  }

  function showSkeletons(container, count = 8) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) container.appendChild(skeletonCard());
  }

  // ══════════════════════════════
  //  CINEMETA BATCH LOADER (works without TMDB key!)
  // ══════════════════════════════
  const cinemetaCache = new Map();

  async function loadCinemetaMovie(tmdbId) {
    if (cinemetaCache.has(tmdbId)) return cinemetaCache.get(tmdbId);
    const imdbId = getImdbId(tmdbId);
    if (!imdbId) return null;
    try {
      const res = await fetch(`/api/cinemeta?type=movie&id=${imdbId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data?.meta;
      if (!meta) return null;
      const movie = {
        id: tmdbId, imdb_id: imdbId,
        title: meta.name || 'Unknown', name: meta.name || 'Unknown',
        overview: meta.description || '', poster_path: null,
        _cinemetaPoster: meta.poster || '', _cinemetaBackdrop: meta.background || '',
        vote_average: parseFloat(meta.imdbRating) || null,
        release_date: meta.year ? String(meta.year) : '',
        genre: meta.genre || [], genres: (meta.genre || []).map(g => ({ id: 0, name: g })),
        media_type: 'movie', _source: 'cinemeta',
        _cast: (meta.cast || []).slice(0, 10).map(c => typeof c === 'string' ? { name: c } : c),
      };
      cinemetaCache.set(tmdbId, movie);
      return movie;
    } catch { return null; }
  }

  async function loadCinemetaTV(tmdbId) {
    if (cinemetaCache.has('tv_' + tmdbId)) return cinemetaCache.get('tv_' + tmdbId);
    const imdbId = getImdbId(tmdbId);
    if (!imdbId) return null;
    try {
      const res = await fetch(`/api/cinemeta?type=series&id=${imdbId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data?.meta;
      if (!meta) return null;
      const show = {
        id: tmdbId, imdb_id: imdbId,
        title: meta.name || 'Unknown', name: meta.name || 'Unknown',
        overview: meta.description || '', poster_path: null,
        _cinemetaPoster: meta.poster || '', _cinemetaBackdrop: meta.background || '',
        vote_average: parseFloat(meta.imdbRating) || null,
        release_date: meta.year ? String(meta.year) : '',
        first_air_date: meta.year ? String(meta.year) + '-01-01' : '',
        genre: meta.genre || [], genres: (meta.genre || []).map(g => ({ id: 0, name: g })),
        media_type: 'tv', _source: 'cinemeta',
        _cast: (meta.cast || []).slice(0, 10).map(c => typeof c === 'string' ? { name: c } : c),
      };
      cinemetaCache.set('tv_' + tmdbId, show);
      return show;
    } catch { return null; }
  }

  async function loadCinemetaBatch(ids, isTV = false) {
    const results = [];
    const concurrency = 5;
    for (let i = 0; i < ids.length; i += concurrency) {
      const chunk = ids.slice(i, i + concurrency);
      const promises = chunk.map(id => isTV ? loadCinemetaTV(id) : loadCinemetaMovie(id));
      const chunkResults = await Promise.all(promises);
      chunkResults.filter(Boolean).forEach(m => results.push(m));
    }
    return results;
  }

  // ══════════════════════════════
  //  LOAD SECTIONS
  // ══════════════════════════════
  async function loadTrending() {
    showSkeletons(trendingRow, 10);
    // 1. Try TMDB if key exists
    if (CONFIG.tmdb.apiKey) {
      try {
        const data = await tmdbApi.trending();
        trendingRow.innerHTML = '';
        (data.results || []).forEach(m => trendingRow.appendChild(movieCard(m)));
        return;
      } catch {}
    }
    // 2. Render fallback immediately, enrich with Cinemeta in background
    trendingRow.innerHTML = '';
    CURATED_FALLBACK.forEach(m => trendingRow.appendChild(movieCard({
      ...m, poster_path: m.poster, vote_average: m.rating, release_date: String(m.year)
    })));
    const trendingIds = [550, 278, 155, 603, 496243, 157336, 680, 13, 424, 346, 293660, 533535, 245891, 76338, 299534, 122, 11, 947, 508943, 429617];
    loadCinemetaBatch(trendingIds).then(movies => {
      if (movies.length) { trendingRow.innerHTML = ''; movies.forEach(m => trendingRow.appendChild(movieCard(m))); }
    }).catch(() => {});
  }

  async function loadTopRated() {
    showSkeletons(topRatedRow, 10);
    if (CONFIG.tmdb.apiKey) {
      try {
        const data = await tmdbApi.topRated();
        topRatedRow.innerHTML = '';
        (data.results || []).forEach(m => topRatedRow.appendChild(movieCard(m)));
        return;
      } catch {}
    }
    // Render fallback immediately, enrich with Cinemeta in background
    topRatedRow.innerHTML = '';
    CURATED_FALLBACK.slice().reverse().forEach(m => topRatedRow.appendChild(movieCard({
      ...m, poster_path: m.poster, vote_average: m.rating, release_date: String(m.year)
    })));
    const topIds = [278, 155, 13, 680, 603, 496243, 157336, 497, 424, 238, 346, 550, 76338, 122, 11, 550, 8, 862, 812, 218];
    loadCinemetaBatch(topIds).then(movies => {
      if (movies.length) { topRatedRow.innerHTML = ''; movies.forEach(m => topRatedRow.appendChild(movieCard(m))); }
    }).catch(() => {});
  }

  async function loadCurated() {
    showSkeletons(curatedRow, 10);
    const list = CURATED_LISTS.classics || CURATED_LISTS.action;
    if (CONFIG.tmdb.apiKey && list) {
      try {
        const movies = await Promise.all(list.ids.slice(0, 10).map(id => tmdbApi.movieDetails(id).catch(() => null)));
        curatedRow.innerHTML = '';
        movies.filter(Boolean).forEach(m => curatedRow.appendChild(movieCard(m)));
        return;
      } catch {}
    }
    // Render fallback immediately, enrich with Cinemeta in background
    curatedRow.innerHTML = '';
    CURATED_FALLBACK.forEach(m => curatedRow.appendChild(movieCard({
      ...m, poster_path: m.poster, vote_average: m.rating, release_date: String(m.year)
    })));
    const curatedIds = list ? list.ids.slice(0, 12) : [155, 603, 278, 550, 680, 496243, 157336, 245891, 11, 122, 947, 293660];
    loadCinemetaBatch(curatedIds).then(movies => {
      if (movies.length) { curatedRow.innerHTML = ''; movies.forEach(m => curatedRow.appendChild(movieCard(m))); }
    }).catch(() => {});
  }

  async function loadGenres() {
    if (!CONFIG.tmdb.apiKey) return;
    try {
      const data = await tmdbApi.genres();
      genreRow.innerHTML = '';
      (data.genres || []).forEach(g => {
        const pill = document.createElement('button');
        pill.className = 'genre-pill';
        pill.textContent = g.name;
        pill.dataset.id = g.id;
        pill.addEventListener('click', () => loadGenre(g.id, g.name));
        genreRow.appendChild(pill);
      });
    } catch {}
  }

  async function loadGenre(genreId, genreName) {
    $$('.genre-pill').forEach(p => p.classList.toggle('active', +p.dataset.id === genreId));
    searchSection.style.display = '';
    searchTitle.textContent = `🎭 ${genreName}`;
    showSkeletons(searchGrid, 12);
    try {
      const data = await tmdbApi.byGenre(genreId);
      searchGrid.innerHTML = '';
      (data.results || []).forEach(m => searchGrid.appendChild(movieCard(m, true)));
      searchEmpty.style.display = data.results?.length ? 'none' : '';
    } catch {
      searchGrid.innerHTML = '';
      searchEmpty.style.display = '';
    }
  }

  async function loadHero() {
    if (CONFIG.tmdb.apiKey) {
      try {
        const data = await tmdbApi.trending();
        const movie = data.results[Math.floor(Math.random() * Math.min(5, data.results.length))];
        if (!movie) return;
        heroMovie = movie;
        heroTitle.textContent = movie.title || movie.name;
        heroOverview.textContent = movie.overview || '';
        const bd = backdropUrl(movie.backdrop_path);
        if (bd) hero.querySelector('.hero-backdrop').style.backgroundImage = `url(${bd})`;
        heroMeta.innerHTML = '';
        const year = (movie.release_date || '').slice(0, 4);
        const rating = movie.vote_average?.toFixed(1) || '—';
        if (year) heroMeta.innerHTML += `<span>📅 ${year}</span>`;
        if (rating) heroMeta.innerHTML += `<span>⭐ ${rating}</span>`;
        return;
      } catch {}
    }
    // Cinemeta fallback — pick a random movie from curated list and fetch real data
    const heroIds = [550, 155, 603, 278, 496243, 680, 157336, 13, 218, 245891];
    const randomId = heroIds[Math.floor(Math.random() * heroIds.length)];
    try {
      const movie = await loadCinemetaMovie(randomId);
      if (movie) {
        heroMovie = movie;
        heroTitle.textContent = movie.title || movie.name || 'CineVault';
        heroOverview.textContent = movie.overview || 'AI-powered movie & TV search. Streaming links auto-found. Watch anything.';
        if (movie._cinemetaBackdrop) {
          hero.querySelector('.hero-backdrop').style.backgroundImage = `url(${movie._cinemetaBackdrop})`;
        } else if (movie._cinemetaPoster) {
          hero.querySelector('.hero-backdrop').style.backgroundImage = `url(${movie._cinemetaPoster})`;
        }
        heroMeta.innerHTML = '';
        const year = (movie.release_date || '').slice(0, 4);
        const rating = movie.vote_average?.toFixed(1) || '—';
        if (year) heroMeta.innerHTML += `<span>📅 ${year}</span>`;
        if (rating) heroMeta.innerHTML += `<span>⭐ ${rating}</span>`;
        return;
      }
    } catch {}
    // Last resort
    const fb = CURATED_FALLBACK[Math.floor(Math.random() * CURATED_FALLBACK.length)];
    heroMovie = { ...fb, id: fb.id, title: fb.title };
    heroTitle.textContent = fb.title;
    heroOverview.textContent = 'AI-powered movie & TV search. Streaming links auto-found. Watch anything.';
    heroMeta.innerHTML = `<span>📅 ${fb.year}</span><span>⭐ ${fb.rating}</span>`;
  }

  // ══════════════════════════════
  //  FRANCHISE & TV ROWS
  // ══════════════════════════════
  // TMDB poster paths for popular IDs — public CDN, works without key
  const POSTER_DB = {
    947:'/r8N2ogP7EOaFQEfVyQHsV4A33KA.jpg',584:'/2x1nbLESskkdgRdlZ1G8IQ6n3wV.jpg',585:'/9diS2MI8vKQ0M0M6c1jEBv1i3iA.jpg',13811:'/4FHVYENgGSHsN0isqQ0ibqEm0d.jpg',51439:'/d2YF6RPlm7B4dYn082rV3v5Ih0v.jpg',168259:'/n9a9K0iSAKqxIpO00j2RtjAB0x9.jpg',281338:'/ysOGyy0IS7v6UHaMRK8x2Ps0Ls6.jpg',337339:'/d5jAy6q0J1p7m0NWCd1W8RqvvYf.jpg',385687:'/pkdR8MWCzWYQ9FpPi3F8F2kIP0V.jpg',714166:'/1E5baAa4Se3FSe0M2R1h0DQ0R8E.jpg',
    293660:'/inVq3FRqcYIRl2dl8YBR6UuKiVO.jpg',383498:'/to0sp8lN6ou0UY1lxLor6020O2R.jpg',533535:'/8cdWv0e6jJNxP2GqO0U3Q2V6CSB.jpg',181808:'/2xmBW1fo9Ss0VaG6mM9ycDBWZDr.jpg',263115:'/rGB3TW0KiZQ2PlB6Z9j4DiwCb3u.jpg',24637:'/wbE0s1l9bKl6g4T6RZ1g2bG5o3f.jpg',
    550:'/pzVrdfChS3rE8hWylxBHHO0X3qL.jpg',278:'/q6y0GoHJ1qXXaQ3Y0vp3L1tdO6q.jpg',155:'/qJ2tW6WMUDux911BTUgMJolZGYh.jpg',603:'/f89U0ADeTa5cI9F5y0r3W0WlGGIf.jpg',238:'/3bhkrj58Vtu7nYhNZ1XT7G2so7K.jpg',496243:'/7IiTTgloJzZPJ4Z7Pm8Vzl7FFZM.jpg',157336:'/gEU2QniE6E77NI6ot8h3FEoAqk6.jpg',497:'/velWPhDMr7JK7D5dh3jQ9R6dF0C.jpg',680:'/d5iIlFn5s0ImszYzBPb8JPIh6Mh.jpg',13:'/arw2vcBveWOVZr6xsR8MtVT7Y3Z.jpg',
    76338:'/tFMFqO8JOZvPuk7MjHHG8nL25K4.jpg',1771:'/6UbRQRJH2u9RfF3XR6l9OZ6G5vV.jpg',299534:'/7WsyG1g0d2hRFn0SvPdA5nL1NfZ.jpg',299536:'/or06FN3y0xbCMmQ7R3K1F1Gd0f7.jpg',429617:'/uxzzxpd3o1K5E2RZMsIvbHkY5Nq.jpg',508943:'/Atsg8xD2U1l5vu8RDXz7VmKfK9l.jpg',
    557:'/rF6JWfsTjJJtoGZLID9xJ0aUymV.jpg',558:'/2JCRPwC7O4LorQjZqj5g8R6kY5W.jpg',559:'/2TeImek9QH2W6U9aDfKk0rJ6nYQ.jpg',
    608:'/uM4E1nVf5KQIK1jMqVHR3sH4D3k.jpg',609:'/u2wp3p7X3E7JZjS7f5mJKdM3gXr.jpg',
    11:'/6FfR4GDGcUQSt8N5ElaOQm1y7R9.jpg',1891:'/6FfR4GDGcUQSt8N5ElaOQm1y7R9.jpg',
    122:'/rCzpDGLbOoP3S6gGBkFcl2sMMl.jpg',120:'/5unx2M8NphG8k2kES9I5K8G5f0c.jpg',
    218:'/7D430eqZj8y3oVkLFsf8QP0Q4IH.jpg',245891:'/fZPSd91yGE9D6E7WZxVPYdPvGfu.jpg',302694:'/hXHBWB8N7m8Q0PgRf0V5O6k7I2q.jpg',
    329:'/1ZFrv9JJP9tl8pNcX0J8G5mG2f3.jpg',330:'/eO3L3AqL5kZ5D0k0u8g2N4pR7vA.jpg',
    954:'/8u3W8Q0N5rL7v1Q0X6Z3K4oP8jI.jpg',
    8:'/7a0Z4V8H5oQ3x8G9i0Z7nL2kP4s.jpg',9:'/5K8Q0Z3r7vN1g6J2l9mF4pR8dW.jpg',
    862:'/uM4E1nVf5KQIK1jMqVHR3sH4D3k.jpg',863:'/uM4E1nVf5KQIK1jMqVHR3sH4D3k.jpg',
    812:'/o2Wy4GqDZ6F5f3k8P1eY5vL2hK.jpg',
    366:'/1u4z3F8lQ7WZ2hGJ5mKX9pN3oV.jpg',
    1399:'/u3bZ9GQ3F6eD3JqK5eQ5Z7Z6fA8.jpg',1396:'/1u4z3F8lQ7WZ2hGJ5mKX9pN3oV.jpg',
    76479:'/mY7q2G8FSZ7QsKedg3Q8u2JQ8Jf.jpg',66732:'/49WJ3N1mr4Q4QeK7QpJ3bQ3jL2Z.jpg',
    71912:'/2DvFXm1Qj3U8u3qVLrBF6eD3e7A.jpg',
  };

  function makeFallbackCard(id, title, year, rating) {
    const p = POSTER_DB[id];
    return movieCard({
      id,
      title,
      poster_path: p || null,
      vote_average: rating || 7.5,
      release_date: String(year || 2020),
    });
  }

  // Franchise section → row ID map
  const FRANCHISE_ROWS = {
    'franchise-marvel-section': { data: FRANCHISES.marvel, list: CURATED_LISTS.marvel },
    'franchise-spiderman-section': { data: FRANCHISES.spiderman, list: CURATED_LISTS.spiderman },
    'franchise-mib-section': { data: FRANCHISES.mib, list: CURATED_LISTS.mib },
    'franchise-theboys-section': { data: FRANCHISES.theboys, list: CURATED_LISTS.deadpool },
    'franchise-antman-section': { data: FRANCHISES.fastFurious, list: CURATED_LISTS.fastFurious },
    'franchise-csiny-section': { data: FRANCHISES.csiny, list: CURATED_LISTS.crime },
    'franchise-csicyber-section': { data: FRANCHISES.csicyber, list: CURATED_LISTS.crime },
    'franchise-csi-section': { data: FRANCHISES.csi, list: CURATED_LISTS.mystery },
    'franchise-livepd-section': { data: FRANCHISES.livepd, list: CURATED_LISTS.action },
    'franchise-trutv-section': { data: FRANCHISES.trutv, list: CURATED_LISTS.drama },
  };

  async function loadFranchiseSection(sectionId, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    showSkeletons(row, 8);

    const config = FRANCHISE_ROWS[sectionId];
    const ids = config?.data?.ids || config?.list?.ids || [];
    const isTV = config?.data?.type === 'tv';

    if (CONFIG.tmdb.apiKey && ids.length) {
      try {
        const fetcher = isTV ? (id => tmdbApi.tvDetails(id)) : (id => tmdbApi.movieDetails(id));
        const movies = await Promise.all(ids.slice(0, 12).map(id => fetcher(id).catch(() => null)));
        row.innerHTML = '';
        movies.filter(Boolean).forEach(m => row.appendChild(movieCard(m)));
        return;
      } catch {}
    }

    // Cinemeta fallback — fetch real data with real posters
    if (ids.length) {
      row.innerHTML = '';
      try {
        const movies = await loadCinemetaBatch(ids.slice(0, 12), isTV);
        if (movies.length) {
          movies.forEach(m => row.appendChild(movieCard(m)));
          return;
        }
      } catch {}
    }

    // Last resort — use curated list titles with TMDB poster paths
    row.innerHTML = '';
    const titles = {
      947:'The Fast and the Furious',584:'2 Fast 2 Furious',585:'Tokyo Drift',13811:'Fast & Furious',51439:'Fast Five',168259:'Furious 6',281338:'Furious 7',337339:'Fate of the Furious',385687:'F9',714166:'Fast X',
      293660:'Deadpool',383498:'Deadpool 2',533535:'Deadpool & Wolverine',181808:'X-Men Origins: Wolverine',263115:'Logan',24637:'The Wolverine',
      550:'Fight Club',278:'The Shawshank Redemption',155:'The Dark Knight',603:'The Matrix',238:'The Godfather',496243:'Parasite',157336:'Interstellar',497:'The Green Mile',680:'Pulp Fiction',13:'Forrest Gump',424:'Schindler\'s List',346:'Se7en',
      76338:'Doctor Strange',1771:'Iron Man',299534:'Infinity War',299536:'Endgame',429617:'Black Panther',508943:'Captain Marvel',566525:'Shang-Chi',361743:'Eternals',634649:'Far From Home',580489:'Eternals',603692:'Brave New World',705861:'Loki',
      557:'Spider-Man',558:'Spider-Man 2',559:'Spider-Man 3',102611:'Homecoming',324549:'Far From Home',324552:'No Way Home',616037:'Across the Spider-Verse',
      608:'Men in Black',609:'Men in Black II',610:'Men in Black 3',43964:'MIB: International',457232:'MIB: International',
      218:'The Terminator',245891:'John Wick',302694:'John Wick: Chapter 2',458156:'John Wick: Chapter 3',748822:'John Wick: Chapter 4',
      11:'Star Wars',122:'Return of the King',8:'Back to the Future',862:'Toy Story',812:'Shrek',8587:'Ice Age',366:'Die Hard',
      76479:'The Boys',4626:'CSI: NY',55316:'CSI: Cyber',67158:'Live PD',71663:'Live Rescue',85968:'Cops',89826:'Fear Factor',
    };
    ids.slice(0, 12).forEach((id) => {
      row.appendChild(makeFallbackCard(id, titles[id] || `#${id}`, 2020, +(7 + Math.random() * 1.5).toFixed(1)));
    });
  }

  async function loadFranchises() {
    const map = {
      'franchise-marvel-section': 'franchise-marvel-row',
      'franchise-spiderman-section': 'franchise-spiderman-row',
      'franchise-mib-section': 'franchise-mib-row',
      'franchise-theboys-section': 'franchise-theboys-row',
      'franchise-antman-section': 'franchise-antman-row',
      'franchise-csiny-section': 'franchise-csiny-row',
      'franchise-csicyber-section': 'franchise-csicyber-row',
      'franchise-csi-section': 'franchise-csi-row',
      'franchise-livepd-section': 'franchise-livepd-row',
      'franchise-trutv-section': 'franchise-trutv-row',
    };
    for (const [sectionId, rowId] of Object.entries(map)) {
      loadFranchiseSection(sectionId, rowId);
    }
  }

  async function loadTVRows() {
    const tvTrendingRow = $('#tv-trending-row');
    const tvPopularRow  = $('#tv-popular-row');

    if (CONFIG.tmdb.apiKey) {
      if (tvTrendingRow) {
        showSkeletons(tvTrendingRow, 10);
        try {
          const data = await tmdbApi.tvTrending();
          tvTrendingRow.innerHTML = '';
          (data.results || []).forEach(m => tvTrendingRow.appendChild(movieCard(m)));
        } catch { tvTrendingRow.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Could not load.</p>'; }
      }
      if (tvPopularRow) {
        showSkeletons(tvPopularRow, 10);
        try {
          const data = await tmdbApi.tvPopular();
          tvPopularRow.innerHTML = '';
          (data.results || []).forEach(m => tvPopularRow.appendChild(movieCard(m)));
        } catch { tvPopularRow.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Could not load.</p>'; }
      }
    } else {
      // Cinemeta fallback — fetch real TV data with posters
      const tvIds = [1399, 1396, 76479, 66732, 71912, 4614, 1622, 2478, 60625, 45793, 67915, 82856, 2190, 2316, 70536, 57243, 60573, 82819, 1434, 1100];
      if (tvTrendingRow) {
        showSkeletons(tvTrendingRow, 10);
        loadCinemetaBatch(tvIds.slice(0, 10), true).then(movies => {
          tvTrendingRow.innerHTML = '';
          if (movies.length) {
            movies.forEach(m => tvTrendingRow.appendChild(movieCard(m)));
          } else {
            // Hardcoded fallback
            const fallbackTV = [
              {id:1399,title:'Game of Thrones',poster_path:'/u3bZ9GQ3F6eD3JqK5eQ5Z7Z6fA8',vote_average:8.4,release_date:'2011',name:'Game of Thrones',first_air_date:'2011-04-17'},
              {id:1396,title:'Breaking Bad',poster_path:'/ztkUQFLlC19CCMYHW4sFRaY9e3Z',vote_average:8.9,release_date:'2008',name:'Breaking Bad',first_air_date:'2008-01-20'},
              {id:76479,title:'The Boys',poster_path:'/mY7q2G8FSZ7QsKedg3Q8u2JQ8Jf',vote_average:8.5,release_date:'2019',name:'The Boys',first_air_date:'2019-07-25'},
              {id:66732,title:'Stranger Things',poster_path:'/49WJ3N1mr4Q4QeK7QpJ3bQ3jL2Z',vote_average:8.3,release_date:'2016',name:'Stranger Things',first_air_date:'2016-07-15'},
            ];
            fallbackTV.forEach(m => tvTrendingRow.appendChild(movieCard(m)));
          }
        }).catch(() => {
          tvTrendingRow.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Could not load.</p>';
        });
      }
      if (tvPopularRow) {
        showSkeletons(tvPopularRow, 10);
        loadCinemetaBatch(tvIds.slice(10, 20), true).then(movies => {
          tvPopularRow.innerHTML = '';
          if (movies.length) {
            movies.forEach(m => tvPopularRow.appendChild(movieCard(m)));
          } else {
            const fallbackTV2 = [
              {id:60625,title:'Rick and Morty',poster_path:null,vote_average:8.6,release_date:'2013',name:'Rick and Morty',first_air_date:'2013-12-02'},
              {id:45793,title:'Brooklyn Nine-Nine',poster_path:null,vote_average:7.9,release_date:'2013',name:'Brooklyn Nine-Nine',first_air_date:'2013-09-17'},
            ];
            fallbackTV2.forEach(m => tvPopularRow.appendChild(movieCard(m)));
          }
        }).catch(() => {
          tvPopularRow.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Could not load.</p>';
        });
      }
    }
  }

  // ══════════════════════════════
  //  SEARCH
  // ══════════════════════════════
  async function doSearch(query) {
    if (!query.trim()) return;
    searchSection.style.display = '';
    searchTitle.textContent = `🔍 Results for "${query}"`;
    showSkeletons(searchGrid, 12);

    // Try AI search first
    if (typeof AISearch !== 'undefined') {
      try {
        const results = AISearch.search(query);
        if (results && results.length) {
          searchGrid.innerHTML = '';
          results.forEach(m => searchGrid.appendChild(movieCard(m, true)));
          searchEmpty.style.display = 'none';
          return;
        }
      } catch {}
    }

    if (CONFIG.tmdb.apiKey) {
      try {
        const data = await tmdbApi.search(query);
        searchGrid.innerHTML = '';
        (data.results || []).forEach(m => searchGrid.appendChild(movieCard(m, true)));
        searchEmpty.style.display = data.results?.length ? 'none' : '';
      } catch {
        searchGrid.innerHTML = '';
        searchEmpty.style.display = '';
      }
    } else {
      // Fallback: search curated lists
      const allMovies = CURATED_FALLBACK.filter(m =>
        m.title.toLowerCase().includes(query.toLowerCase())
      );
      searchGrid.innerHTML = '';
      if (allMovies.length) {
        allMovies.forEach(m => searchGrid.appendChild(movieCard({
          ...m, poster_path: m.poster, vote_average: m.rating, release_date: String(m.year)
        }, true)));
        searchEmpty.style.display = 'none';
      } else {
        searchEmpty.style.display = '';
      }
    }
  }

  // ══════════════════════════════
  //  MODAL
  // ══════════════════════════════
  let currentMovieId = null;
  let currentIsTV = false;
  let currentSeason = null;
  let currentEpisode = null;
  let currentImdbId = null;

  async function openModal(movieId, isTV = false) {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    currentMovieId = movieId;
    currentIsTV = isTV;

    modalTitle.textContent = 'Loading...';
    modalOverview.textContent = '';
    modalMeta.innerHTML = '';
    modalCast.innerHTML = '';
    modalSources.innerHTML = '';
    modalPosterImg.src = 'assets/no-poster.svg';

    let movieData = null;
    let imdbId = null;

    if (CONFIG.tmdb.apiKey) {
      try {
        const fetcher = isTV ? (id => tmdbApi.tvDetails(id)) : (id => tmdbApi.movieDetails(id));
        const movie = await fetcher(movieId);
        movieData = movie;
        currentMovieData = movie;

        modalTitle.textContent = movie.title || movie.name || 'Unknown';
        modalOverview.textContent = movie.overview || 'No description available.';

        // Poster: try TMDB, then enrich with Cinemeta
        imdbId = movie.imdb_id || getImdbId(movieId);
        currentImdbId = imdbId;

        if (movie.poster_path) {
          modalPosterImg.src = posterUrl(movie.poster_path);
          modalPosterImg.onerror = function() {
            // TMDB failed — try Cinemeta
            if (imdbId) { this.src = cinemetaPoster(imdbId, 'medium'); this.onerror = function() { this.src = 'assets/no-poster.svg'; }; }
            else { this.src = 'assets/no-poster.svg'; }
          };
        } else if (imdbId) {
          modalPosterImg.src = cinemetaPoster(imdbId, 'medium');
          modalPosterImg.onerror = function() { this.src = 'assets/no-poster.svg'; };
        } else {
          modalPosterImg.src = placeholderPoster(movie.title || movie.name);
        }

        const bd = movie.backdrop_path ? backdropUrl(movie.backdrop_path) : (imdbId ? cinemetaBg(imdbId) : '');
        if (bd) modalBackdrop.style.backgroundImage = `url(${bd})`;

        const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
        const rating = movie.vote_average?.toFixed(1) || '—';
        const runtime = movie.runtime ? `${Math.floor(movie.runtime/60)}h ${movie.runtime%60}m` : (movie.episode_run_time?.length ? `${movie.episode_run_time[0]}m` : '');
        modalMeta.innerHTML = '';
        if (year) modalMeta.innerHTML += `<span>📅 ${year}</span>`;
        if (rating) modalMeta.innerHTML += `<span>⭐ ${rating}</span>`;
        if (runtime) modalMeta.innerHTML += `<span>⏱ ${runtime}</span>`;
        if (movie.genres?.length) modalMeta.innerHTML += `<span>${movie.genres.map(g=>g.name).join(', ')}</span>`;
        if (movie.number_of_seasons && isTV) modalMeta.innerHTML += `<span>📺 ${movie.number_of_seasons} Season${movie.number_of_seasons>1?'s':''}</span>`;

        // Cast — TMDB credits + Cinemeta enrichment for bios
        if (movie.credits?.cast?.length) {
          modalCast.style.display = '';
          let castHtml = '<h3>Cast</h3><div class="cast-row">';
          movie.credits.cast.slice(0, 10).forEach(c => {
            const p = posterUrl(c.profile_path, 'w185');
            castHtml += `<div class="cast-item"><img src="${p}" alt="${c.name}" onerror="this.style.display='none'"><span>${c.name}</span>${c.character ? `<small>${c.character}</small>` : ''}</div>`;
          });
          castHtml += '</div>';
          modalCast.innerHTML = castHtml;
        }

        // Enrich with Cinemeta for awards, better cast, etc.
        if (imdbId) {
          cinemetaApi.tvDetails(imdbId).then(cm => {
            if (!cm) {
              // Try movie endpoint for TV also (some are mislabeled)
              cinemetaApi.movieDetails(imdbId).then(cm2 => enrichModalWithCinemeta(cm2));
            } else {
              enrichModalWithCinemeta(cm);
            }
          }).catch(() => {});
        }

        // TV episode grid
        if (isTV && imdbId) {
          loadEpisodeGrid(movieId, movie, imdbId);
        } else if (isTV) {
          // No imdb ID but have TMDB — use season data
          loadEpisodeGridFromTMDB(movieId, movie);
        }

        const inList = store.has(movieId);
        modalWatchlist.textContent = inList ? '✓ In Watchlist' : '＋ Watchlist';
        modalWatchlist.classList.toggle('added', inList);
      } catch {
        modalTitle.textContent = isTV ? 'Show #' + movieId : 'Movie #' + movieId;
        modalOverview.textContent = 'Add your TMDB API key for movie details.';
      }
    } else {
      // No API — try Cinemeta by IMDB ID
      imdbId = getImdbId(movieId);
      currentImdbId = imdbId;

      if (imdbId) {
        try {
          const cm = await cinemetaApi.tvDetails(imdbId) || await cinemetaApi.movieDetails(imdbId);
          if (cm) {
            modalTitle.textContent = cm.name || 'Unknown';
            modalOverview.textContent = cm.description || '';
            modalPosterImg.src = cinemetaPoster(imdbId, 'medium');
            modalPosterImg.onerror = function() { this.src = 'assets/no-poster.svg'; };
            const bgUrl = cinemetaBg(imdbId);
            if (bgUrl) modalBackdrop.style.backgroundImage = `url(${bgUrl})`;
            modalMeta.innerHTML = '';
            if (cm.year) modalMeta.innerHTML += `<span>📅 ${cm.year}</span>`;
            if (cm.imdbRating) modalMeta.innerHTML += `<span>⭐ ${cm.imdbRating}</span>`;
            if (cm.runtime) modalMeta.innerHTML += `<span>⏱ ${cm.runtime}</span>`;
            if (cm.genre?.length) modalMeta.innerHTML += `<span>${cm.genre.join(', ')}</span>`;
            if (cm.awards) modalMeta.innerHTML += `<span>🏆 ${cm.awards}</span>`;

            // Cast from Cinemeta
            if (cm.cast?.length) {
              modalCast.style.display = '';
              let castHtml = '<h3>Cast</h3><div class="cast-row">';
              cm.cast.slice(0, 10).forEach(name => {
                castHtml += `<div class="cast-item"><div class="cast-avatar">🎭</div><span>${name}</span></div>`;
              });
              castHtml += '</div>';
              modalCast.innerHTML = castHtml;
            }

            // Episode grid for TV
            if (cm.type === 'series' && cm.videos?.length) {
              currentIsTV = true;
              loadEpisodeGridFromCinemeta(cm);
            }
          }
        } catch {
          const fb = CURATED_FALLBACK.find(m => m.id === movieId);
          modalTitle.textContent = fb?.title || `#${movieId}`;
          modalOverview.textContent = fb ? `${fb.title} (${fb.year}) ⭐ ${fb.rating}` : 'Add your TMDB API key in js/config.js for full details.';
          if (fb?.poster) modalPosterImg.src = posterUrl(fb.poster);
          modalMeta.innerHTML = fb ? `<span>📅 ${fb.year}</span><span>⭐ ${fb.rating}</span>` : '';
          modalCast.style.display = 'none';
        }
      } else {
        const fb = CURATED_FALLBACK.find(m => m.id === movieId);
        modalTitle.textContent = fb?.title || `#${movieId}`;
        modalOverview.textContent = fb ? `${fb.title} (${fb.year}) ⭐ ${fb.rating}` : 'Add your TMDB API key in js/config.js for full details.';
        if (fb?.poster) modalPosterImg.src = posterUrl(fb.poster);
        modalMeta.innerHTML = fb ? `<span>📅 ${fb.year}</span><span>⭐ ${fb.rating}</span>` : '';
        modalCast.style.display = 'none';
      }
    }
  }

  // Cinemeta enrichment — fill in awards, better cast bios, logos
  function enrichModalWithCinemeta(cm) {
    if (!cm) return;
    // Add awards if TMDB didn't have them
    if (cm.awards && !modalMeta.innerHTML.includes('🏆')) {
      modalMeta.innerHTML += `<span>🏆 ${cm.awards}</span>`;
    }
    // Add Cinemeta cast if TMDB cast was missing or sparse
    if (cm.cast?.length && modalCast.innerHTML === '') {
      modalCast.style.display = '';
      let castHtml = '<h3>Cast</h3><div class="cast-row">';
      cm.cast.slice(0, 10).forEach(name => {
        castHtml += `<div class="cast-item"><div class="cast-avatar">🎭</div><span>${name}</span></div>`;
      });
      castHtml += '</div>';
      modalCast.innerHTML = castHtml;
    }
    // Enrich poster with Cinemeta if TMDB poster failed
    if (currentImdbId && (!modalPosterImg.src || modalPosterImg.src.includes('no-poster') || modalPosterImg.src.includes('placehold'))) {
      modalPosterImg.src = cinemetaPoster(currentImdbId, 'medium');
      modalPosterImg.onerror = function() { 
        // Try Goojara CDN as last resort
        const title = currentMovieData?.title || currentMovieData?.name || '';
        if (title) {
          GoojaraScraper.getCoverArt(title).then(url => {
            if (url) modalPosterImg.src = url;
          }).catch(() => { this.src = 'assets/no-poster.svg'; });
        } else {
          this.src = 'assets/no-poster.svg';
        }
      };
    }
  }

  // Load episode grid from Cinemeta data
  function loadEpisodeGridFromCinemeta(cm) {
    if (!cm?.videos?.length) return;
    const seasons = {};
    cm.videos.forEach(v => {
      const s = v.season || 0;
      if (!seasons[s]) seasons[s] = [];
      seasons[s].push(v);
    });
    // Remove specials (season 0)
    delete seasons[0];
    const seasonNums = Object.keys(seasons).map(Number).sort((a,b) => a - b);
    if (!seasonNums.length) return;

    let html = `<div class="episode-section">
      <h3>📺 Episodes</h3>
      <div class="season-tabs">`;
    seasonNums.forEach((s, i) => {
      html += `<button class="season-tab ${i === 0 ? 'active' : ''}" data-season="${s}">S${s}</button>`;
    });
    html += `</div><div class="episode-grid" id="episodes-grid">`;
    // Show first season episodes
    const firstSeason = seasons[seasonNums[0]] || [];
    firstSeason.sort((a,b) => (a.episode||0) - (b.episode||0)).forEach(ep => {
      const epTitle = ep.title || ep.name || `Episode ${ep.episode || '?'}`;
      html += `<div class="episode-card" data-tmdb="${cm.moviedb_id || currentMovieId}" data-season="${ep.season}" data-episode="${ep.episode}" data-imdb="${ep.id || ''}">
        <div class="ep-num">${ep.episode || '?'}</div>
        <div class="ep-info"><div class="ep-title">${epTitle}</div>${ep.released ? `<div class="ep-meta">${new Date(ep.released).toLocaleDateString()}</div>` : ''}</div>
      </div>`;
    });
    html += `</div></div>`;
    modalSources.innerHTML = html;

    // Season tab switching
    modalSources.querySelectorAll('.season-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modalSources.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const s = parseInt(tab.dataset.season);
        const eps = seasons[s] || [];
        eps.sort((a,b) => (a.episode||0) - (b.episode||0));
        const grid = document.getElementById('episodes-grid');
        if (grid) {
          grid.innerHTML = eps.map(ep => {
            const epTitle = ep.title || ep.name || `Episode ${ep.episode || '?'}`;
            return `<div class="episode-card" data-tmdb="${cm.moviedb_id || currentMovieId}" data-season="${ep.season}" data-episode="${ep.episode}" data-imdb="${ep.id || ''}">
              <div class="ep-num">${ep.episode || '?'}</div>
              <div class="ep-info"><div class="ep-title">${epTitle}</div>${ep.released ? `<div class="ep-meta">${new Date(ep.released).toLocaleDateString()}</div>` : ''}</div>
            </div>`;
          }).join('');
          // Bind episode click → play
          grid.querySelectorAll('.episode-card').forEach(card => {
            card.addEventListener('click', () => {
              const tmdbId = parseInt(card.dataset.tmdb);
              const season = parseInt(card.dataset.season);
              const episode = parseInt(card.dataset.episode);
              openPlayer(tmdbId || currentMovieId, true, season, episode);
            });
          });
        }
      });
    });

    // Bind episode clicks
    modalSources.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', () => {
        const tmdbId = parseInt(card.dataset.tmdb);
        const season = parseInt(card.dataset.season);
        const episode = parseInt(card.dataset.episode);
        openPlayer(tmdbId || currentMovieId, true, season, episode);
      });
    });
  }

  // Load episode grid from TMDB data
  function loadEpisodeGridFromTMDB(tmdbId, movie) {
    const numSeasons = movie.number_of_seasons || 1;
    const franchiseKey = Object.entries(FRANCHISES || {}).find(([k,v]) => v.ids?.includes(tmdbId));
    const seasonCount = franchiseKey ? (FRANCHISES[franchiseKey[0]].seasons) : null;

    let html = `<div class="episode-section"><h3>📺 Episodes</h3><div class="season-tabs">`;
    for (let s = 1; s <= numSeasons; s++) {
      html += `<button class="season-tab ${s === 1 ? 'active' : ''}" data-season="${s}">S${s}</button>`;
    }
    html += `</div><div class="episode-grid" id="episodes-grid">`;

    // Show first season
    const epCount = seasonCount ? (seasonCount[1] || 8) : (movie.seasons?.find(s => s.season_number === 1)?.episode_count || 8);
    for (let e = 1; e <= epCount; e++) {
      html += `<div class="episode-card" data-season="1" data-episode="${e}">
        <div class="ep-num">${e}</div>
        <div class="ep-info"><div class="ep-title">Episode ${e}</div></div>
      </div>`;
    }
    html += `</div></div>`;
    modalSources.innerHTML = html;

    // Bind season tabs — try to fetch real episode data from TMDB
    modalSources.querySelectorAll('.season-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        modalSources.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const s = parseInt(tab.dataset.season);
        const grid = document.getElementById('episodes-grid');
        if (!grid) return;

        // Show skeleton while loading
        const episodeCount = seasonCount ? (seasonCount[s] || 8) : (movie.seasons?.find(se => se.season_number === s)?.episode_count || 8);
        grid.innerHTML = Array.from({length: episodeCount}, (_, i) =>
          `<div class="episode-card" data-season="${s}" data-episode="${i+1}">
            <div class="ep-num">${i+1}</div>
            <div class="ep-info"><div class="ep-title">Episode ${i+1}</div></div>
          </div>`
        ).join('');

        // Try loading real episode titles from TMDB
        if (CONFIG.tmdb.apiKey) {
          try {
            const seasonData = await tmdbApi.tvSeason(tmdbId, s);
            if (seasonData?.episodes?.length) {
              grid.innerHTML = seasonData.episodes.map(ep =>
                `<div class="episode-card" data-season="${ep.season_number}" data-episode="${ep.episode_number}">
                  <div class="ep-num">${ep.episode_number}</div>
                  <div class="ep-info"><div class="ep-title">${ep.name || 'Episode ' + ep.episode_number}</div>${ep.overview ? `<div class="ep-meta">${ep.overview.slice(0, 60)}...</div>` : ''}</div>
                </div>`
              ).join('');
            }
          } catch (e) { /* fallback to numbered episodes */ }
        }

        // Bind episode clicks
        grid.querySelectorAll('.episode-card').forEach(card => {
          card.addEventListener('click', () => {
            openPlayer(tmdbId, true, parseInt(card.dataset.season), parseInt(card.dataset.episode));
          });
        });
      });
    });

    // Try to fetch S1 episode titles from TMDB
    if (CONFIG.tmdb.apiKey) {
      tmdbApi.tvSeason(tmdbId, 1).then(seasonData => {
        if (seasonData?.episodes?.length) {
          const grid = document.getElementById('episodes-grid');
          if (grid) {
            grid.innerHTML = seasonData.episodes.map(ep =>
              `<div class="episode-card" data-season="${ep.season_number}" data-episode="${ep.episode_number}">
                <div class="ep-num">${ep.episode_number}</div>
                <div class="ep-info"><div class="ep-title">${ep.name || 'Episode ' + ep.episode_number}</div>${ep.overview ? `<div class="ep-meta">${ep.overview.slice(0, 60)}...</div>` : ''}</div>
              </div>`
            ).join('');
            grid.querySelectorAll('.episode-card').forEach(card => {
              card.addEventListener('click', () => {
                openPlayer(tmdbId, true, parseInt(card.dataset.season), parseInt(card.dataset.episode));
              });
            });
          }
        }
      }).catch(() => {});
    }

    // Bind episode clicks (S1 default)
    modalSources.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', () => {
        openPlayer(tmdbId, true, parseInt(card.dataset.season), parseInt(card.dataset.episode));
      });
    });
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    currentMovieData = null;
  }

  // ══════════════════════════════
  //  MOVIE PLAYER
  // ══════════════════════════════
  let currentSource = 'vidsrc2';
  let sourceTimeout = null;
  const SOURCE_ORDER = ['vidsrc2','vidsrcpm','vidsrcdev','vidsrcme','multiembed','embed2','embed2skin','vidsrcpro','goojara','playmogo','lookmovie'];

  function getSourceUrl(sourceKey, movieId, season, episode) {
    const src = typeof STREAM_SOURCES !== 'undefined' ? STREAM_SOURCES[sourceKey] : null;
    if (!src) return null;
    // Build ids object: prefer imdbId from currentMovieData or currentImdbId for reliable source resolution
    const imdbId = currentMovieData?.imdb_id || currentImdbId || getImdbId(movieId) || null;
    const ids = { tmdbId: movieId, imdbId };
    // TV shows: always use TV URL, defaulting to S1E1 if no season/episode specified
    if (currentIsTV) {
      const s = season || 1;
      const e = episode || 1;
      return src.tv ? src.tv(ids, s, e) : src.movie(ids);
    }
    if (season && episode) return src.tv(ids, season, episode);
    return src.movie(ids);
  }

  async function openPlayer(movieId, isTV = false, season = null, episode = null) {
    closeModal();
    currentMovieId = movieId;
    currentIsTV = isTV;
    currentSeason = season;
    currentEpisode = episode;

    // Fetch movie data for this specific movie to ensure correct title
    // (currentMovieData might be stale from a previously viewed movie)
    if (!currentMovieData || currentMovieData.id !== movieId) {
      const result = await fetchMovieData(movieId, isTV);
      if (result && result.data) {
        currentMovieData = result.data;
        const newImdbId = result.data.imdb_id || getImdbId(movieId);
        if (newImdbId) currentImdbId = newImdbId;
      }
    }

    playerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    isPlaying = true;
    if (playerPlayBtn) { playerPlayBtn.textContent = '⏸'; playerPlayBtn.title = 'Pause'; }
    isPaused = false;

    // Show source tabs
    const tabs = document.getElementById('player-source-tabs');
    if (tabs) tabs.style.display = '';

    // Build title
    let titleText = 'Loading...';
    if (currentMovieData) {
      titleText = currentMovieData.title || currentMovieData.name || 'Now Playing';
    } else {
      // Fallback: try TMDB_TO_IMDB map for imdb ID, or a readable title
      const fallbackTitles = {76479:'The Boys',4656:'The Boys Presents: Diabolical'};
      titleText = fallbackTitles[movieId] || `#${movieId}`;
    }
    if (isTV) {
      const s = season || 1;
      const e = episode || 1;
      titleText += ` S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;
    }
    if (playerTitle) playerTitle.textContent = titleText;
    showPlayerSpinner('💀 Connecting to source...');
    loadPlayerSource(movieId, currentSource);
  }

  function loadPlayerSource(movieId, sourceKey) {
    playerVideoWrap.innerHTML = '';
    playerProgress.style.width = '0%';
    if (playerTime) playerTime.textContent = '0:00 / 0:00';
    if (sourceTimeout) clearTimeout(sourceTimeout);

    // ── Goojara requires async search → episode lookup ──
    const src = typeof STREAM_SOURCES !== 'undefined' ? STREAM_SOURCES[sourceKey] : null;
    if (src && src.goojara) {
      loadGoojaraSource(movieId);
      return;
    }

    // ── Playmogo uses Direct URL path (CF-protected, short codes) ──
    if (src && src.playmogo) {
      const pmUrl = getSourceUrl('playmogo', movieId, currentSeason, currentEpisode);
      if (pmUrl) {
        loadDirectUrl(pmUrl);
        $$('.source-tab').forEach(t => t.classList.toggle('active', t.dataset.source === 'playmogo'));
        showToast('🎬 Loading Playmogo...');
      } else {
        // No short code mapped → suggest Direct URL tab
        showToast('🎬 No Playmogo code for this title — use 🔗 Direct URL tab');
        tryNextSource(movieId);
      }
      return;
    }

    // ── Direct URL mode ──
    if (sourceKey === 'direct') {
      const urlBar = document.getElementById('direct-url-bar');
      if (urlBar) urlBar.style.display = 'flex';
      return;
    }

    // ── Portal fallback waterfall ──
    if (sourceKey === 'portal') {
      loadPortalFallback(movieId);
      return;
    }

    // ── PORTAL FALLBACK WATERFALL ──
    // When all embed sources fail, try portal hits to load a live TV stream
    async function loadPortalFallback(movieId) {
      showPlayerSpinner('💀 Loading portal hits...');
      setSkullEyes('scan');
      $$('.source-tab').forEach(t => t.classList.toggle('active', t.dataset.source === 'portal'));
      
      try {
        const res = await fetch('/api/portal-hits?status=live');
        const data = await res.json();
        const hits = Array.isArray(data) ? data : (data.hits || []);
        
        if (hits.length === 0) {
          showPlayerSpinner('💀 No portal hits found — run portal-scan first');
          setSkullEyes('error');
          showToast('💀 No working portals — try scanning first', 'error');
          return;
        }

        // Try each hit as waterfall
        for (let i = 0; i < Math.min(hits.length, 5); i++) {
          const hit = hits[i];
          showPlayerSpinner(`💀 Trying portal ${i+1}/${Math.min(hits.length,5)}: ${hit.channels}ch...`);
          setSkullEyes('yellow');
          
          try {
            const chRes = await fetch(`/api/stalker-channels?url=${encodeURIComponent(hit.portal)}&mac=${encodeURIComponent(hit.mac)}&proxy=server`, {
              signal: AbortSignal.timeout(15000),
            });
            const chData = await chRes.json();
            
            if (chData.channels && chData.channels.length > 0) {
              // Found live channels! Load the first playable one
              const playable = chData.channels.find(c => c.url);
              if (playable && playable.url) {
                playerVideoWrap.innerHTML = '';
                const video = document.createElement('video');
                video.src = playable.url;
                video.controls = true;
                video.autoplay = true;
                video.style.cssText = 'width:100%;height:100%;background:#000';
                playerVideoWrap.appendChild(video);
                hidePlayerSpinner();
                setSkullEyes('green');
                playHitSound();
                const titleEl = document.getElementById('player-title-text');
                if (titleEl) titleEl.textContent = playable.name || 'Portal Stream';
                showToast(`💀 Portal LIVE: ${hit.channels}ch from ${playable.name}`, 'success');
                return;
              }
            }
          } catch { /* try next */ }
        }
        
        // All portal hits failed
        showPlayerSpinner('💀 All portal hits failed');
        setSkullEyes('error');
        showToast('💀 Portal waterfall exhausted — no playable streams', 'error');
      } catch {
        showPlayerSpinner('💀 Portal fetch error');
        setSkullEyes('error');
      }
    }

    // ── LookMovie opens in new tab (not an embed site) ──
    if (sourceKey === 'lookmovie') {
      const lmUrl = getSourceUrl('lookmovie', movieId, currentSeason, currentEpisode);
      if (lmUrl) {
        window.open(lmUrl, '_blank');
        showToast('👁️ Opened LookMovie in new tab');
      }
      return;
    }

    let url = getSourceUrl(sourceKey, movieId, currentSeason, currentEpisode);
    if (!url) {
      tryNextSource(movieId);
      return;
    }

    // 2026-05: Load embed URLs directly in iframe (no proxy).
    // The embed proxy was breaking video players by rewriting URLs inside
    // Cloudflare-protected pages. Iframes load cross-origin fine without CORS.
    // The proxy is still available at /api/embed-proxy for other uses.

    $$('.source-tab').forEach(t => t.classList.toggle('active', t.dataset.source === sourceKey));

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; popups; forms; same-origin';
    iframe.allowFullscreen = true;
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    // Sandbox with all redirect-friendly permissions — allows cross-origin
    // redirects (vidsrc→vsembed→cloudnestra), popups, forms, and scripts
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-presentation');
    iframe.style.cssText = 'width:100%;height:100%;border:none;outline:none;background:#000;';

    let loaded = false;
    iframe.onload = () => {
      loaded = true;
      if (sourceTimeout) clearTimeout(sourceTimeout);
      const title = currentMovieData?.title || currentMovieData?.name || heroMovie?.title || 'Now Playing';
      setSkullConnected(title);
      if (playerTitle) playerTitle.textContent = title;
      // Log the watch
      if (typeof MovieLogs !== 'undefined') {
        MovieLogs.add('watch', title, movieId, {
          season: currentSeason,
          episode: currentEpisode,
          source: sourceKey,
        });
      }
    };
    iframe.onerror = () => {
      if (!loaded) {
        setSkullEyes('red');
        tryNextSource(movieId);
      }
    };

    sourceTimeout = setTimeout(() => {
      if (!loaded) {
        console.warn(`[CineVault] Source ${sourceKey} timed out, trying next...`);
        setSkullEyes('red');
        tryNextSource(movieId);
      }
    }, 15000);

    playerVideoWrap.appendChild(iframe);
    playerElement = iframe;
    startControlsAutoHide();
  }

  // ── GOOJARA SOURCE LOADER ──
  // Goojara uses short codes (eLRN11), not IMDB IDs. Must search → find show → get episode page.
  async function loadGoojaraSource(movieId) {
    const title = currentMovieData?.title || currentMovieData?.name || '';
    const isTV = currentIsTV;
    showPlayerSpinner('🟢 Searching Goojara...');
    setSkullEyes('red');

    $$('.source-tab').forEach(t => t.classList.toggle('active', t.dataset.source === 'goojara'));

    try {
      if (typeof GoojaraScraper === 'undefined') {
        toast('🟢 Goojara scraper not loaded', 'error');
        tryNextSource(movieId);
        return;
      }

      // Search for the show on Goojara
      const searchType = isTV ? 'tv' : 'movie';
      const result = await GoojaraScraper.search(title, searchType);
      if (!result || !result.slug) {
        toast('🟢 Not found on Goojara', 'warning');
        tryNextSource(movieId);
        return;
      }

      // For TV shows, fetch episode page
      let embedUrl;
      if (isTV && currentSeason && currentEpisode) {
        const seriesInfo = await GoojaraScraper.getSeriesInfo(result.slug);
        if (!seriesInfo) {
          toast('🟢 Could not load series info', 'warning');
          tryNextSource(movieId);
          return;
        }
        // Use season query param directly on the slug
        const seasonUrl = `${GoojaraScraper.BASE}/${result.slug}?s=${currentSeason}`;
        const episodeHtml = await GoojaraScraper._fetch(seasonUrl);
        if (!episodeHtml) {
          toast('🟢 Could not load season page', 'warning');
          tryNextSource(movieId);
          return;
        }
        // Extract episode links — each has a short code like /eLRN11
        const epRegex = new RegExp(`href="(https?://[^"]+/[a-zA-Z0-9]{5,8})"[^>]*title="[^"]*[Ss]0?${currentSeason}[Ee]0?${currentEpisode}[^"]*"`, 'i');
        const epMatch = episodeHtml.match(epRegex);
        if (epMatch) {
          embedUrl = epMatch[1];
        } else {
          // Fallback: grab all episode links and pick by index
          const allEps = [];
          const epRx = /href="(https?:\/\/[^"]+\/[a-zA-Z0-9]{5,8})"[^>]*title="([^"]*\(S?\d+\.?\s*E?\d+[^)]*\))"/gi;
          let m;
          while ((m = epRx.exec(episodeHtml)) !== null) {
            allEps.push({ url: m[1], title: m[2] });
          }
          // Try to match by episode number
          const epNum = parseInt(currentEpisode);
          if (allEps.length >= epNum) {
            embedUrl = allEps[epNum - 1].url;
          } else if (allEps.length > 0) {
            embedUrl = allEps[0].url;
          }
        }
      } else {
        // For movies, the slug IS the page
        embedUrl = `${GoojaraScraper.BASE}/${result.slug}`;
      }

      if (!embedUrl) {
        toast('🟢 Episode not found on Goojara', 'warning');
        tryNextSource(movieId);
        return;
      }

      // Route through our proxy for CORS
      const finalUrl = proxyUrl(embedUrl);
      showPlayerSpinner('🟢 Loading Goojara...');

      const iframe = document.createElement('iframe');
      iframe.src = finalUrl;
      iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; popups; forms; same-origin';
      iframe.allowFullscreen = true;
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-presentation');
      iframe.style.cssText = 'width:100%;height:100%;border:none;outline:none;background:#000;';

      let loaded = false;
      iframe.onload = () => {
        loaded = true;
        if (sourceTimeout) clearTimeout(sourceTimeout);
        const displayName = currentMovieData?.title || currentMovieData?.name || 'Now Playing';
        setSkullConnected(displayName);
        if (playerTitle) playerTitle.textContent = displayName + ' 🟢 Goojara';
        if (typeof MovieLogs !== 'undefined') {
          MovieLogs.add('watch', displayName, movieId, {
            season: currentSeason,
            episode: currentEpisode,
            source: 'goojara',
          });
        }
      };
      iframe.onerror = () => {
        if (!loaded) { setSkullEyes('red'); tryNextSource(movieId); }
      };

      sourceTimeout = setTimeout(() => {
        if (!loaded) {
          console.warn('[CineVault] Goojara source timed out, trying next...');
          setSkullEyes('red');
          tryNextSource(movieId);
        }
      }, 20000);

      playerVideoWrap.appendChild(iframe);
      playerElement = iframe;
      startControlsAutoHide();
    } catch (err) {
      console.error('[CineVault] Goojara error:', err);
      toast('🟢 Goojara error: ' + err.message, 'error');
      setSkullEyes('red');
      tryNextSource(movieId);
    }
  }

  function tryNextSource(movieId) {
    const currentIdx = SOURCE_ORDER.indexOf(currentSource);
    if (currentIdx + 1 < SOURCE_ORDER.length) {
      currentSource = SOURCE_ORDER[currentIdx + 1];
      const name = typeof STREAM_SOURCES !== 'undefined' && STREAM_SOURCES[currentSource] ? STREAM_SOURCES[currentSource].name : currentSource;
      showPlayerSpinner(`💀 Trying ${name}...`);
      loadPlayerSource(movieId, currentSource);
    } else {
      showPlayerError();
    }
  }

  function switchSource(sourceKey) {
    currentSource = sourceKey;
    if (currentMovieId) {
      const name = typeof STREAM_SOURCES !== 'undefined' && STREAM_SOURCES[sourceKey] ? STREAM_SOURCES[sourceKey].name : sourceKey;
      showPlayerSpinner(`💀 Switching to ${name}...`);
      loadPlayerSource(currentMovieId, sourceKey);
    }
  }

  function showPlayerSpinner(text) {
    if (!playerSpinner) return;
    playerSpinner.classList.remove('hidden', 'connected', 'error');
    // Force display:flex in case CSS override hides it
    playerSpinner.style.display = 'flex';
    const spinText = playerSpinner.querySelector('.spinner-text');
    if (spinText) spinText.textContent = text || 'Loading...';
    setSkullEyes('red');
  }
  window.showPlayerSpinner = showPlayerSpinner;

  function hidePlayerSpinner() {
    if (!playerSpinner) return;
    playerSpinner.classList.add('hidden');
    // Don't force display — let CSS class handle it
  }
  window.hidePlayerSpinner = hidePlayerSpinner;

  // ── SKULL EYE COLOR CONTROL ──
  // 'red' = loading/trying sources, 'green' = connected/streaming, 'error' = all failed
  // Also controls the MacAttack scanner section skull (macattack-eye-*)
  function setSkullEyes(state) {
    const colors = {
      red:    { eye: '#e50914', inner: '#ff4444', socket: '#e50914', glow: '#e50914' },
      green:  { eye: '#00ff64', inner: '#80ffb0', socket: '#00ff64', glow: '#00ff64' },
      yellow: { eye: '#ffc800', inner: '#ffe066', socket: '#ffc800', glow: '#ffc800' },
      scan:   { eye: '#00ccff', inner: '#66ddff', socket: '#00ccff', glow: '#00ccff' },
      idle:   { eye: '#888888', inner: '#aaaaaa', socket: '#555555', glow: '#555555' },
      error:  { eye: '#ff2222', inner: '#ff6666', socket: '#ff2222', glow: '#ff2222' },
    };
    const c = colors[state] || colors.red;

    // --- Player spinner skull (skull-eye-*) ---
    const leftEye = document.getElementById('skull-eye-left');
    const rightEye = document.getElementById('skull-eye-right');
    const leftInner = document.getElementById('skull-eye-inner-left');
    const rightInner = document.getElementById('skull-eye-inner-right');
    const leftSocket = document.getElementById('skull-eye-socket-left');
    const rightSocket = document.getElementById('skull-eye-socket-right');
    const glowRing = document.getElementById('skull-glow-ring');

    if (leftEye) leftEye.setAttribute('fill', c.eye);
    if (rightEye) rightEye.setAttribute('fill', c.eye);
    if (leftInner) leftInner.setAttribute('fill', c.inner);
    if (rightInner) rightInner.setAttribute('fill', c.inner);
    if (leftSocket) leftSocket.setAttribute('stroke', c.socket);
    if (rightSocket) rightSocket.setAttribute('stroke', c.socket);
    if (glowRing) glowRing.setAttribute('stroke', c.glow);

    // Switch flare gradients on player skull
    document.querySelectorAll('#skull-eye-group-left ellipse[fill^="url(#eyeGlow"]').forEach(el => {
      el.setAttribute('fill', state === 'green' ? 'url(#eyeGlowLeftGreen)' : 'url(#eyeGlowLeft)');
    });
    document.querySelectorAll('#skull-eye-group-right ellipse[fill^="url(#eyeGlow"]').forEach(el => {
      el.setAttribute('fill', state === 'green' ? 'url(#eyeGlowRightGreen)' : 'url(#eyeGlowRight)');
    });

    // Player spinner CSS state
    if (playerSpinner) {
      playerSpinner.classList.remove('connected', 'error');
      if (state === 'green') playerSpinner.classList.add('connected');
      if (state === 'error') playerSpinner.classList.add('error');
    }

    // --- MacAttack scanner section skull (macattack-eye-*) ---
    const maLeftEye = document.getElementById('macattack-eye-left');
    const maRightEye = document.getElementById('macattack-eye-right');
    const maLeftInner = document.getElementById('macattack-eye-inner-left');
    const maRightInner = document.getElementById('macattack-eye-inner-right');
    const maLeftSocket = document.getElementById('macattack-eye-socket-left');
    const maRightSocket = document.getElementById('macattack-eye-socket-right');
    const maGlowRing = document.getElementById('macattack-glow-ring');

    if (maLeftEye) maLeftEye.setAttribute('fill', c.eye);
    if (maRightEye) maRightEye.setAttribute('fill', c.eye);
    if (maLeftInner) maLeftInner.setAttribute('fill', c.inner);
    if (maRightInner) maRightInner.setAttribute('fill', c.inner);
    if (maLeftSocket) maLeftSocket.setAttribute('stroke', c.socket);
    if (maRightSocket) maRightSocket.setAttribute('stroke', c.socket);
    if (maGlowRing) {
      maGlowRing.setAttribute('stroke', c.glow);
      // Also update the fill opacity based on state
      if (state === 'green') {
        maGlowRing.setAttribute('opacity', '1');
      } else if (state === 'scan') {
        maGlowRing.setAttribute('opacity', '0.9');
      } else {
        maGlowRing.setAttribute('opacity', '0.7');
      }
    }

    // Switch flare gradients on MacAttack skull
    document.querySelectorAll('#macattack-eye-group-left ellipse[fill^="url(#eyeGlow"]').forEach(el => {
      el.setAttribute('fill', state === 'green' ? 'url(#eyeGlowLeftGreen)' : 'url(#eyeGlowLeft)');
    });
    document.querySelectorAll('#macattack-eye-group-right ellipse[fill^="url(#eyeGlow"]').forEach(el => {
      el.setAttribute('fill', state === 'green' ? 'url(#eyeGlowRightGreen)' : 'url(#eyeGlowRight)');
    });

    // MacAttack skull container scan/hit animation classes
    const maSkull = document.getElementById('macattack-skull');
    if (maSkull) {
      maSkull.classList.remove('scanning', 'hit');
      if (state === 'scan') maSkull.classList.add('scanning');
      else if (state === 'green') {
        maSkull.classList.add('hit');
        setTimeout(() => {
          maSkull.classList.remove('hit');
          if (!StalkerScanner.isRunning()) maSkull.classList.remove('scanning');
        }, 800);
      }
    }
  }

  function setSkullConnected(titleText) {
    setSkullEyes('green');
    let displayText = titleText || 'CONNECTED — STREAMING';
    if (currentIsTV && currentSeason && currentEpisode) {
      displayText += ` S${String(currentSeason).padStart(2, '0')}E${String(currentEpisode).padStart(2, '0')}`;
    }
    const spinText = playerSpinner?.querySelector('.spinner-text');
    if (spinText) spinText.textContent = displayText;
    // Flash green for 2s then hide spinner
    setTimeout(() => { hidePlayerSpinner(); }, 2000);
  }

  function setSkullError() {
    setSkullEyes('error');
    const spinText = playerSpinner?.querySelector('.spinner-text');
    if (spinText) spinText.textContent = '💀 ALL SOURCES FAILED';
    if (playerSpinner) {
      playerSpinner.classList.remove('hidden');
      playerSpinner.style.display = 'flex';
    }
  }

  function showPlayerError() {
    hidePlayerSpinner();
    playerVideoWrap.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#fff;gap:16px;">
        <span style="font-size:4rem;">💀</span>
        <p style="font-size:1.1rem;color:var(--text-secondary);">All sources unavailable. Try again or use a different stream.</p>
        <button onclick="closePlayer()" style="background:var(--accent);color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:1rem;">Close</button>
      </div>
    `;
  }

  function closePlayer() {
    playerOverlay.classList.remove('open');
    document.body.style.overflow = '';
    isPlaying = false;
    isPaused = false;
    if (playerPlayBtn) { playerPlayBtn.textContent = '▶'; playerPlayBtn.title = 'Play'; }
    if (playerOverlay) playerOverlay.style.cursor = 'default';
    // Cleanup HLS instance if present
    const video = playerVideoWrap?.querySelector('video');
    if (video && video._hls) {
      video._hls.destroy();
      video._hls = null;
    }
    playerVideoWrap.innerHTML = '';
    playerElement = null;
    // Remove stalker URL+MAC bar if present
    const stalkerBar = document.getElementById('stalker-player-info');
    if (stalkerBar) stalkerBar.remove();
    clearControlsAutoHide();
    if (playerTitle) playerTitle.textContent = '';
    if (sourceTimeout) clearTimeout(sourceTimeout);
  }

  function startControlsAutoHide() {
    clearControlsAutoHide();
    hideControlsTimer = setTimeout(() => {
      if (!isPlaying) return;
      const header = playerOverlay?.querySelector('.player-header');
      if (header) header.style.opacity = '0';
      if (playerControls) playerControls.style.opacity = '0';
      if (playerOverlay) playerOverlay.style.cursor = 'none';
    }, 3000);
  }

  function clearControlsAutoHide() {
    if (hideControlsTimer) clearTimeout(hideControlsTimer);
  }

  // ══════════════════════════════
  //  NAVIGATION
  // ══════════════════════════════
  function switchPage(page) {
    currentPage = page;
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.page === page));

    // Hide all content sections first
    $$('.content-section').forEach(s => s.style.display = 'none');
    hero.style.display = (page === 'home') ? '' : 'none';

    if (page === 'home') {
      trendingSection.style.display = '';
      topRatedSection.style.display = '';
      curatedSection.style.display = '';
      genresSection.style.display = '';
      searchSection.style.display = searchGrid.children.length ? '' : 'none';
      $$('#tv-trending-section, #tv-popular-section, [id^="franchise-"]').forEach(s => s.style.display = '');
    } else if (page === 'trending') {
      trendingSection.style.display = '';
      topRatedSection.style.display = '';
      $$('#tv-trending-section, #tv-popular-section').forEach(s => s.style.display = '');
    } else if (page === 'discover') {
      genresSection.style.display = '';
    } else if (page === 'watchlist') {
      watchlistSection.style.display = '';
      renderWatchlist();
    } else if (page === 'stalker') {
      stalkerSection.style.display = '';
    } else if (page === 'livetv') {
      livetvSection.style.display = '';
      renderLiveTV();
    } else if (page === 'ai') {
      aiSection.style.display = '';
    } else if (page === 'logs') {
      logsSection.style.display = '';
      renderLogs();
    } else if (page === 'watchdog') {
      const wdSection = document.getElementById('watchdog-section');
      if (wdSection) { wdSection.style.display = ''; renderWatchdog(); }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderWatchlist() {
    const list = store.getAll();
    watchlistGrid.innerHTML = '';
    watchlistEmpty.style.display = list.length ? 'none' : '';
    list.forEach(m => {
      watchlistGrid.appendChild(movieCard({
        id: m.id,
        title: m.title,
        poster_path: m.poster,
        vote_average: m.rating ? parseFloat(m.rating) : null,
        release_date: m.year
      }, true));
    });
  }

  // ══════════════════════════════
  //  THEME
  // ══════════════════════════════
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    if (themeToggle) themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
  }

  // ══════════════════════════════
  //  SCROLL BUTTONS
  // ══════════════════════════════
  function setupScrollButtons() {
    $$('.scroll-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.dataset.row;
        const row = document.getElementById(rowId);
        if (row) {
          const direction = btn.classList.contains('scroll-left') ? -1 : 1;
          row.scrollBy({ left: direction * 600, behavior: 'smooth' });
        }
      });
    });
  }

  // ══════════════════════════════
  //  LIVE TV — Cable Channels + MacAttack Portal Scanner + Channel Guide
  // ══════════════════════════════

  // Active category filter for channel grid
  let liveTVCategory = 'live';

  // Sound effect for MacAttack hits — dramatic skull hit with descending tone
  function playHitSound() {
    // Check if sound is enabled
    const soundToggle = document.getElementById('macattack-sound');
    if (soundToggle && !soundToggle.checked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // --- Skull hit: short descending sweep + percussive crack ---
      // Layer 1: Descending sweep (skull crack)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1200, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      // Layer 2: Sharp crack (square wave)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.03);
      osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.08);
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc2.start(ctx.currentTime + 0.03);
      osc2.stop(ctx.currentTime + 0.25);

      // Layer 3: Deep thud for body
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(80, ctx.currentTime);
      osc3.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
      gain3.gain.setValueAtTime(0.4, ctx.currentTime);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc3.start(ctx.currentTime);
      osc3.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  async function renderLiveTV(category) {
    if (category) liveTVCategory = category;

    // ── Render category filter tabs ──
    const tabsContainer = document.getElementById('livetv-category-tabs');
    if (tabsContainer && typeof CHANNEL_CATEGORIES !== 'undefined') {
      tabsContainer.innerHTML = CHANNEL_CATEGORIES.map(cat =>
        `<button class="livetv-cat-tab${cat.id === liveTVCategory ? ' active' : ''}" data-cat="${cat.id}">${cat.label}</button>`
      ).join('');
      tabsContainer.querySelectorAll('.livetv-cat-tab').forEach(btn => {
        btn.addEventListener('click', () => renderLiveTV(btn.dataset.cat));
      });
    }

    // ── Render MacAttack portal cards (scanner results) ──
    const portalsRow = document.getElementById('livetv-portals-row');
    const portalsGrid = document.getElementById('livetv-portals-grid');
    const empty = document.getElementById('livetv-empty');

    const savedHits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
    const allPortals = [...(CONFIG.macattack?.portals || []), ...savedHits];
    
    // Also load portal hits from server (found by portal-scan cron)
    try {
      const phRes = await fetch('/api/portal-hits?status=live');
      const phData = await phRes.json();
      const serverHits = Array.isArray(phData) ? phData : (phData.hits || []);
      serverHits.forEach(h => {
        if (h.status === 'hit') allPortals.push({ url: h.portal, mac: h.mac, channels: h.channels, portalType: 'Portal Scan', expiry: 'Auto' });
      });
    } catch {}
    const seenMacs = new Set();
    const uniquePortals = allPortals.filter(p => {
      const key = p.mac || p.url || JSON.stringify(p);
      if (seenMacs.has(key)) return false;
      seenMacs.add(key);
      return true;
    });

    if (portalsRow && portalsGrid) {
      if (uniquePortals.length) {
        portalsRow.style.display = '';
        portalsGrid.innerHTML = uniquePortals.map((p, i) => {
          const url = p.url || document.getElementById('stalker-url')?.value || '';
          const mac = p.mac || 'Unknown';
          const channels = p.channels || '?';
          const expiry = p.expiry || 'Unknown';
          const type = p.portalType || 'Portal';
          const version = p.version || '';
          return `<div class="livetv-card livetv-portal-card">
            <div class="livetv-card-header">
              <span class="live-badge">● LIVE</span>
              <span class="portal-name">${type} ${version ? 'v' + version : ''}</span>
            </div>
            <div class="livetv-card-body">
              <div><span class="channel-count">${channels}</span> <span class="channel-label">Channels</span></div>
              <div class="portal-info">
                <span>MAC: <code>${mac}</code></span>
                <span>Expiry: ${expiry}</span>
              </div>
            </div>
            <div class="livetv-card-footer">
              <button class="livetv-watch-btn" data-index="${i}">▶ Watch Live</button>
              <button class="livetv-config-btn" data-mac="${mac}" data-url="${url}" title="Auto-configure scanner">⚙ Config</button>
            </div>
          </div>`;
        }).join('');
        portalsGrid.querySelectorAll('.livetv-watch-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            const portal = uniquePortals[idx];
            if (portal) {
              playHitSound();
              const url = portal.url || document.getElementById('stalker-url')?.value || '';
              playStalkerChannel(url, portal.mac);
            }
          });
        });
        portalsGrid.querySelectorAll('.livetv-config-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const mac = btn.dataset.mac;
            const url = btn.dataset.url;
            const urlInput = document.getElementById('stalker-url');
            const prefixSelect = document.getElementById('stalker-prefix');
            if (urlInput && url) urlInput.value = url;
            if (prefixSelect && mac) {
              const prefix = mac.split(':').slice(0, 3).join(':').toUpperCase() + ':';
              const opts = [...prefixSelect.options];
              const match = opts.find(o => o.value.toUpperCase() === prefix);
              if (match) prefixSelect.value = match.value;
              else prefixSelect.value = '00:1A:79:';
            }
            CONFIG.macattack = CONFIG.macattack || {};
            CONFIG.macattack.portals = CONFIG.macattack.portals || [];
            if (!CONFIG.macattack.portals.find(p => p.mac === mac)) {
              CONFIG.macattack.portals.push({ url, mac, channels: uniquePortals[0]?.channels, portalType: uniquePortals[0]?.portalType });
            }
            toast('⚙ Scanner configured — switch to Scanner tab to start', 'success');
          });
        });
      } else {
        portalsRow.style.display = 'none';
      }
    }

    if (empty) {
      empty.style.display = (uniquePortals.length || typeof CHANNEL_DATABASE !== 'undefined') ? 'none' : '';
    }

    // ── Render Cable Channel Grid with Logos ──
    const channelsGrid = document.getElementById('livetv-channels-grid');
    const channelsTitle = document.getElementById('livetv-channels-title');
    if (!channelsGrid) return;
    if (typeof CHANNEL_DATABASE === 'undefined') {
      channelsGrid.innerHTML = '<p style="color:var(--text-secondary)">Channel data not loaded.</p>';
      return;
    }

    const channels = getChannelsByCategory(liveTVCategory);
    const categoryLabel = CHANNEL_CATEGORIES.find(c => c.id === liveTVCategory)?.label || 'Channels';
    if (channelsTitle) channelsTitle.textContent = categoryLabel;

    const hasPortal = uniquePortals.length > 0;
    const activePortal = hasPortal ? uniquePortals[0] : null;
    const portalUrl = activePortal?.url || '';
    const portalMac = activePortal?.mac || '';

    channelsGrid.innerHTML = channels.map(ch => {
      const logoUrl = ch.logo || '';
      const fallbackLogo = channelLogoSVG(ch.name, ch.color || '#e50914');
      const chNumber = ch.number ? `Ch. ${ch.number}` : '';
      const group = ch.group || '';
      const hasStream = !!(LIVE_STREAM_URLS[ch.id] || ch.url || ch.stream);
      const isLive = ch.categories ? ch.categories.includes('live') : hasStream;
      const canWatch = hasPortal && isLive;
      const dotClass = hasStream ? 'channel-live-dot live' : 'channel-live-dot offline';
      return `<div class="channel-card${hasStream ? ' has-stream' : ' no-stream'}" data-ch="${ch.id}" style="--brand-color:${ch.color || '#e50914'}">
        <div class="channel-card-logo-wrap">
          <img class="channel-logo" src="${logoUrl}" alt="${ch.name}" onerror="this.src='${fallbackLogo}'">
          ${isLive || hasStream ? `<span class="${dotClass}"></span>` : ''}
        </div>
        <div class="channel-card-info">
          <div class="channel-card-name">${ch.name}</div>
          <div class="channel-card-meta">${chNumber}${chNumber && group ? ' · ' : ''}${group}</div>
        </div>
        ${canWatch || hasStream ? `<button class="channel-watch-btn" data-ch="${ch.id}" title="Watch ${ch.name}">▶</button>` : ''}
      </div>`;
    }).join('');

    channelsGrid.querySelectorAll('.channel-watch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chId = btn.dataset.ch;
        const ch = CHANNEL_DATABASE[chId];
        if (ch && portalUrl) {
          playHitSound();
          playStalkerChannel(portalUrl, portalMac);
          toast(`📺 Tuning to ${ch.name}...`, 'success');
        } else {
          toast('💀 No portal connected — run MacAttack Scanner first', 'warning');
        }
      });
    });
  }

  // ── CHANNEL GUIDE (modal overlay with schedule-style view) ──
  function showChannelGuide() {
    if (typeof CHANNEL_DATABASE === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.className = 'channel-guide-overlay';
    overlay.innerHTML = `
      <div class="channel-guide">
        <div class="channel-guide-header">
          <h2>📺 Channel Guide</h2>
          <button class="channel-guide-close" title="Close">✕</button>
        </div>
        <div class="channel-guide-tabs">
          ${CHANNEL_CATEGORIES.map(cat =>
            `<button class="guide-tab${cat.id === 'all' ? ' active' : ''}" data-cat="${cat.id}">${cat.label}</button>`
          ).join('')}
        </div>
        <div class="channel-guide-grid">
          ${Object.values(CHANNEL_DATABASE).map(ch => {
            const logoUrl = ch.logo || '';
            const fallbackLogo = channelLogoSVG(ch.name, ch.color || '#e50914');
            const chNumber = ch.number ? `Ch. ${ch.number}` : 'Streaming';
            return `<div class="guide-channel" data-categories="${ch.categories.join(',')}" style="--brand-color:${ch.color || '#e50914'}">
              <div class="guide-channel-logo">
                <img src="${logoUrl}" alt="${ch.name}" onerror="this.src='${fallbackLogo}'">
              </div>
              <div class="guide-channel-info">
                <div class="guide-channel-name">${ch.name}</div>
                <div class="guide-channel-number">${chNumber} · ${ch.group}</div>
              </div>
              <div class="guide-channel-badges">
                ${ch.categories.includes('live') ? '<span class="badge-live">LIVE</span>' : ''}
                ${ch.categories.includes('premium') ? '<span class="badge-premium">★</span>' : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.channel-guide-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('.guide-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.guide-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        overlay.querySelectorAll('.guide-channel').forEach(el => {
          el.style.display = (cat === 'all' || el.dataset.categories.split(',').includes(cat)) ? '' : 'none';
        });
      });
    });
  }
  // ══════════════════════════════
  //  AI ASSISTANT — Context-aware recommendations + search
  // ══════════════════════════════
  const AI_KNOWLEDGE = {
    genres: {
      action: { label: '💥 Action', ids: [28], tmdb: 'with_genres=28' },
      comedy: { label: '😂 Comedy', ids: [35], tmdb: 'with_genres=35' },
      horror: { label: '👹 Horror', ids: [27], tmdb: 'with_genres=27' },
      scifi: { label: '🚀 Sci-Fi', ids: [878], tmdb: 'with_genres=878' },
      thriller: { label: '🔫 Thriller', ids: [53], tmdb: 'with_genres=53' },
      drama: { label: '🎭 Drama', ids: [18], tmdb: 'with_genres=18' },
      crime: { label: '🕵️ Crime', ids: [80], tmdb: 'with_genres=80' },
      romance: { label: '💕 Romance', ids: [10749], tmdb: 'with_genres=10749' },
      animation: { label: '🎨 Animation', ids: [16], tmdb: 'with_genres=16' },
      documentary: { label: '📚 Documentary', ids: [99], tmdb: 'with_genres=99' },
      fantasy: { label: '🧙 Fantasy', ids: [14], tmdb: 'with_genres=14' },
      mystery: { label: '🔮 Mystery', ids: [9648], tmdb: 'with_genres=9648' },
    },
    moods: {
      'feel good': ['comedy', 'romance', 'animation'],
      'sad': ['drama', 'romance'],
      'scared': ['horror', 'thriller', 'mystery'],
      'excited': ['action', 'thriller', 'scifi'],
      'think': ['mystery', 'crime', 'documentary', 'thriller'],
      'laugh': ['comedy', 'animation'],
      'adventure': ['action', 'fantasy', 'scifi'],
      'dark': ['horror', 'crime', 'thriller'],
    },
    shows: {
      'the boys': { id: 76479, type: 'tv', name: 'The Boys', seasons: 5, notes: 'S5 currently airing. 8 eps/season.' },
      'stranger things': { id: 66732, type: 'tv', name: 'Stranger Things' },
      'breaking bad': { id: 1396, type: 'tv', name: 'Breaking Bad' },
      'game of thrones': { id: 1399, type: 'tv', name: 'Game of Thrones' },
      'peaky blinders': { id: 60574, type: 'tv', name: 'Peaky Blinders' },
      'ozark': { id: 69240, type: 'tv', name: 'Ozark' },
    },
    quickAnswers: {
      'what should i watch': 'Try these genres based on your watchlist, or ask me for a specific mood like "feel good" or "excited":',
      'what\'s new': 'Check the 🔥 Trending section on the home page — updated weekly from TMDB!',
      'the boys': '💥 The Boys is a dark superhero satire on Amazon Prime. All 5 seasons available! S5 is currently airing. Click to watch:',
      'help': 'I can help with:\n• Genre recommendations (action, horror, comedy...)\n• Mood-based picks (feel good, scared, excited...)\n• TV show info (The Boys, Stranger Things...)\n• Search by keyword (try "marvel" or "2024")\n• Live TV setup (MacAttack scanner)',
    }
  };

  function aiRespond(query) {
    const q = query.toLowerCase().trim();
    const chat = document.getElementById('ai-chat');

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg ai-user';
    userMsg.textContent = query;
    chat.appendChild(userMsg);

    // Build response
    let response = '';
    let movieLinks = [];

    // Check quick answers first
    for (const [key, answer] of Object.entries(AI_KNOWLEDGE.quickAnswers)) {
      if (q.includes(key)) {
        response = answer;
        break;
      }
    }

    // Check mood-based recommendations
    if (!response) {
      for (const [mood, genres] of Object.entries(AI_KNOWLEDGE.moods)) {
        if (q.includes(mood)) {
          response = `Based on your "${mood}" mood, I recommend:\n\n`;
          genres.forEach(g => {
            response += `${AI_KNOWLEDGE.genres[g]?.label || g}\n`;
          });
          response += `\nClick the genre tags in Discover to browse!`;
          break;
        }
      }
    }

    // Check genre requests
    if (!response) {
      for (const [key, genre] of Object.entries(AI_KNOWLEDGE.genres)) {
        if (q.includes(key)) {
          response = `${genre.label} movies — loading top picks for you!`;
          // Trigger genre search
          if (CONFIG.tmdb.apiKey) {
            tmdbApi.byGenre(genre.ids[0]).then(data => {
              if (data.results?.length) {
                const resp = document.createElement('div');
                resp.className = 'ai-msg ai-response';
                resp.innerHTML = `<strong>${genre.label} Top Picks:</strong><br><br>` +
                  data.results.slice(0, 8).map(m =>
                    `<span class="ai-movie-link" data-id="${m.id}" data-type="${m.media_type || 'movie'}">🎬 ${m.title || m.name} (${(m.release_date || m.first_air_date || '').slice(0, 4) || '?'}) ⭐${m.vote_average?.toFixed(1) || '?'}</span>`
                  ).join('<br>');
                chat.appendChild(resp);
                // Bind click links
                resp.querySelectorAll('.ai-movie-link').forEach(el => {
                  el.addEventListener('click', () => {
                    const id = parseInt(el.dataset.id);
                    const isTV = el.dataset.type === 'tv';
                    openModal(id, isTV);
                  });
                });
                chat.scrollTop = chat.scrollHeight;
              }
            }).catch(() => {});
          }
          break;
        }
      }
    }

    // Check show-specific requests
    if (!response) {
      for (const [key, show] of Object.entries(AI_KNOWLEDGE.shows)) {
        if (q.includes(key)) {
          const s = show;
          response = `💀 <strong>${s.name}</strong>\n`;
          response += `Type: ${s.type === 'tv' ? 'TV Series' : 'Movie'}\n`;
          if (s.seasons) response += `Seasons: ${s.seasons}\n`;
          if (s.notes) response += `${s.notes}\n`;
          response += `\nTMDB ID: ${s.id}\n\nClick to open:`;
          movieLinks.push({ id: s.id, name: s.name, type: s.type });
          break;
        }
      }
    }

    // Check if it's a search request
    if (!response && (q.includes('find') || q.includes('search') || q.includes('look for') || q.length > 3)) {
      // AI-powered search
      if (CONFIG.tmdb.apiKey) {
        response = `Searching for "${query}"...`;
        tmdbApi.search(query).then(data => {
          if (data.results?.length) {
            const resp = document.createElement('div');
            resp.className = 'ai-msg ai-response';
            resp.innerHTML = `<strong>Found ${data.results.length} results for "${query}":</strong><br><br>` +
              data.results.slice(0, 10).map(m =>
                `<span class="ai-movie-link" data-id="${m.id}" data-type="${m.media_type || (m.first_air_date ? 'tv' : 'movie')}">🎬 ${m.title || m.name} (${(m.release_date || m.first_air_date || '').slice(0, 4) || '?'}) ⭐${m.vote_average?.toFixed(1) || '?'}</span>`
              ).join('<br>');
            chat.appendChild(resp);
            resp.querySelectorAll('.ai-movie-link').forEach(el => {
              el.addEventListener('click', () => {
                openModal(parseInt(el.dataset.id), el.dataset.type === 'tv');
              });
            });
            chat.scrollTop = chat.scrollHeight;
          } else {
            const resp = document.createElement('div');
            resp.className = 'ai-msg ai-response';
            resp.textContent = `No results found for "${query}". Try a different search term.`;
            chat.appendChild(resp);
            chat.scrollTop = chat.scrollHeight;
          }
        }).catch(() => {
          const resp = document.createElement('div');
          resp.className = 'ai-msg ai-response';
          resp.textContent = `Search failed. Check your TMDB API key in config.js.`;
          chat.appendChild(resp);
          chat.scrollTop = chat.scrollHeight;
        });
      } else {
        response = `Add your TMDB API key in js/config.js to enable search. Without it, I can still recommend by genre and mood!`;
      }
    }

    // Default fallback
    if (!response) {
      response = `I didn't understand that. Try asking:\n• A genre (action, horror, comedy...)\n• A mood (feel good, scared, excited...)\n• A show name (The Boys, Breaking Bad...)\n• A search term (any movie/actor name)`;
    }

    // Add response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'ai-msg ai-response';
    aiMsg.innerHTML = response.replace(/\n/g, '<br>');

    // Add movie links
    if (movieLinks.length) {
      movieLinks.forEach(m => {
        aiMsg.innerHTML += `<br><span class="ai-movie-link" data-id="${m.id}" data-type="${m.type}">🎬 ${m.name}</span>`;
      });
    }

    chat.appendChild(aiMsg);

    // Bind movie links in response
    aiMsg.querySelectorAll('.ai-movie-link').forEach(el => {
      el.addEventListener('click', () => {
        openModal(parseInt(el.dataset.id), el.dataset.type === 'tv');
      });
    });

    chat.scrollTop = chat.scrollHeight;
  }

  // ══════════════════════════════
  //  MACATTACK AUTO-CONFIG — Load scanner hits into config + Live TV
  // ══════════════════════════════
  function macAttackAutoConfig() {
    // ── 1. Load pre-configured stalker portals from CONFIG ──
    if (CONFIG.stalkerPortals && CONFIG.stalkerPortals.length) {
      CONFIG.macattack = CONFIG.macattack || {};
      CONFIG.macattack.portals = [...(CONFIG.macattack.portals || [])];

      CONFIG.stalkerPortals.forEach(portal => {
        const exists = CONFIG.macattack.portals.find(p => p.mac === portal.mac);
        if (!exists) {
          CONFIG.macattack.portals.push({
            url: portal.url,
            mac: portal.mac,
            channels: '?',
            expiry: 'Pre-loaded',
            type: portal.type || 'Stalker Portal',
            version: '',
            name: portal.name || ''
          });
          // Also save to localStorage so it persists
          const hits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
          if (!hits.find(h => h.mac === portal.mac)) {
            hits.push({
              mac: portal.mac,
              channels: '?',
              expiry: 'Pre-loaded',
              portalType: portal.type || 'Stalker Portal',
              portalUrl: portal.url,
              name: portal.name || ''
            });
            localStorage.setItem('cinevault_stalker_hits', JSON.stringify(hits));
          }
        }
      });
      console.log(`💀 MacAttack: Pre-loaded ${CONFIG.stalkerPortals.length} portal(s) into config`);
    }

    // ── 2. Merge scanner hits from localStorage ──
    const savedHits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
    if (savedHits.length) {
      CONFIG.macattack = CONFIG.macattack || {};
      CONFIG.macattack.portals = [...(CONFIG.macattack.portals || [])];

      savedHits.forEach(hit => {
        const exists = CONFIG.macattack.portals.find(p => p.mac === hit.mac);
        if (!exists) {
          CONFIG.macattack.portals.push({
            url: hit.portalUrl || document.getElementById('stalker-url')?.value || '',
            mac: hit.mac,
            channels: hit.channels,
            expiry: hit.expiry,
            type: hit.portalType,
            version: hit.version
          });
        }
      });
    }

    console.log(`💀 MacAttack: ${CONFIG.macattack?.portals?.length || 0} portal(s) loaded total`);
  }

  // ══════════════════════════════
  //  COVER ART SEARCH — Multi-source poster fetching
  // ══════════════════════════════
  async function searchCoverArt(title) {
    // 1. Try TMDB API
    if (CONFIG.tmdb.apiKey) {
      try {
        const data = await tmdbApi.search(title);
        const match = data.results?.find(m => {
          const t = (m.title || m.name || '').toLowerCase();
          return t.includes(title.toLowerCase().split(' ').slice(0, 2).join(' '));
        });
        if (match?.poster_path) {
          return { poster: `${IMG_BASE}/w500${match.poster_path}`, backdrop: match.backdrop_path ? `${IMG_BASE}/original${match.backdrop_path}` : null, source: 'tmdb' };
        }
      } catch {}
    }
    // 2. Try Goojara CDN
    if (typeof GoojaraScraper !== 'undefined') {
      try {
        const coverUrl = await GoojaraScraper.getCoverArt(title);
        if (coverUrl) return { poster: coverUrl, backdrop: null, source: 'goojara' };
      } catch {}
    }
    // 3. Placeholder
    return { poster: placeholderPoster(title), backdrop: null, source: 'placeholder' };
  }

  // ══════════════════════════════
  //  STALKER SCANNER INIT
  // ── STALKER SCANNER INIT ──
  function initStalkerScanner() {
    const startBtn = document.getElementById('stalker-start');
    const stopBtn = document.getElementById('stalker-stop');
    const speedSlider = document.getElementById('stalker-speed');
    const speedVal = document.getElementById('stalker-speed-val');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (typeof StalkerScanner === 'undefined') {
          toast('💀 Stalker Scanner not loaded', 'error');
          return;
        }
        const url = document.getElementById('stalker-url')?.value || '';
        const prefix = document.getElementById('stalker-prefix')?.value || '00:1A:79:';
        const type = document.getElementById('stalker-type')?.value || 'auto';
        const speed = parseInt(speedSlider?.value || '10');

        if (!url) { toast('Enter an IPTV portal URL', 'error'); return; }
        startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        setSkullEyes('scan'); // Cyan eyes = scanning
        playHitSound(); // Start sound
        StalkerScanner.startScan({ url, prefix, speed, portalType: type });
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (typeof StalkerScanner !== 'undefined') StalkerScanner.stopScan();
        if (startBtn) startBtn.disabled = false;
        stopBtn.disabled = true;
        setSkullEyes('idle'); // Grey eyes = stopped
        toast('🛑 Scanner stopped', 'info');
      });
    }

    if (speedSlider && speedVal) {
      speedSlider.addEventListener('input', () => { speedVal.textContent = speedSlider.value; });
    }

    // 🎯 Scan This MAC — test a single MAC against the portal
    const scanMacBtn = document.getElementById('stalker-scan-mac');
    if (scanMacBtn) {
      scanMacBtn.addEventListener('click', async () => {
        const url = document.getElementById('stalker-url')?.value?.trim();
        const mac = document.getElementById('stalker-mac')?.value?.trim() || '00:1A:79:A3:96:BF';
        const type = document.getElementById('stalker-type')?.value || 'auto';

        if (!url) { toast('❌ Enter a portal URL first', 'error'); return; }
        if (!mac || mac.split(':').length !== 6) { toast('❌ Enter a valid MAC address (XX:XX:XX:XX:XX:XX)', 'error'); return; }

        scanMacBtn.disabled = true;
        scanMacBtn.textContent = '⏳ Scanning...';
        setSkullEyes('yellow');

        if (typeof StalkerScanner !== 'undefined' && StalkerScanner.connectToPortal) {
          try {
            const result = await StalkerScanner.connectToPortal(url, mac);
            if (result) {
              setSkullEyes('green');
              playHitSound();
              toast(`💀 HIT! ${result.channelCount} channels found for ${mac}`, 'success');

              // Save the hit
              StalkerScanner.saveHit({
                mac: mac,
                url: url,
                channels: result.channelCount,
                portalType: result.portalType || 'Stalker Portal',
                version: result.portalVersion || '',
                expiry: 'Active',
              });

              // Also update Settings for easy connect
              const settingsUrl = document.getElementById('livetv-portal-url');
              const settingsMac = document.getElementById('livetv-mac');
              if (settingsUrl) settingsUrl.value = url;
              if (settingsMac) settingsMac.value = mac;

              // Populate playlist
              const portalData = {
                url: url,
                mac: mac,
                channels: result.channels || [],
                genres: result.genres || [],
                portalType: result.portalType || 'Stalker Portal',
                channelCount: result.channelCount || 0
              };
              if (typeof showPlaylistChannels === 'function') showPlaylistChannels(portalData);
              if (typeof renderLiveTV === 'function') renderLiveTV();

              // Add hit to results
              if (typeof renderStalkerResults === 'function') renderStalkerResults();
            } else {
              setSkullEyes('red');
              toast(`❌ No response for MAC ${mac}`, 'error');
            }
          } catch (err) {
            setSkullEyes('red');
            toast(`❌ Scan failed: ${err.message}`, 'error');
          }
        } else {
          // Fallback: use /api/stalker-channels
          try {
            const resp = await fetch(`/api/stalker-channels?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, {
              signal: AbortSignal.timeout(15000)
            });
            const data = await resp.json();
            if (data.channels && data.channels.length > 0) {
              setSkullEyes('green');
              playHitSound();
              toast(`💀 HIT! ${data.channels.length} channels for ${mac}`, 'success');

              const portalData = {
                url: url,
                mac: mac,
                channels: data.channels,
                genres: data.genres || [],
                portalType: 'Stalker Portal',
                channelCount: data.channelCount || data.channels.length
              };
              if (typeof showPlaylistChannels === 'function') showPlaylistChannels(portalData);
            } else {
              setSkullEyes('red');
              toast(`❌ No channels for MAC ${mac}`, 'error');
            }
          } catch (err) {
            setSkullEyes('red');
            toast(`❌ Scan error: ${err.message}`, 'error');
          }
        }

        scanMacBtn.disabled = false;
        scanMacBtn.textContent = '🎯 Scan This MAC';
      });
    }

    // ── NOTEBOOK: Save All ──
    const saveBtn = document.getElementById('macattack-save-notebook');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const hits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
        if (!hits.length) { toast('No hits to save', ''); return; }
        // Also persist the notebook timestamp
        const notebook = { savedAt: new Date().toISOString(), hits };
        localStorage.setItem('cinevault_stalker_notebook', JSON.stringify(notebook));
        toast(`📓 Notebook saved! ${hits.length} hit(s) stored.`, 'success');
      });
    }

    // ── NOTEBOOK: Export ──
    const exportBtn = document.getElementById('macattack-export-notebook');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const hits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
        if (!hits.length) { toast('No hits to export', ''); return; }
        const lines = hits.map((h, i) =>
          `[${i+1}] MAC: ${h.mac || 'N/A'} | URL: ${h.url || h.portalUrl || 'N/A'} | Channels: ${h.channels || '?'} | Expiry: ${h.expiry || 'Unknown'} | Type: ${h.portalType || 'Portal'}`
        );
        const text = `MacAttack Hit Export — ${new Date().toLocaleString()}\n${'═'.repeat(60)}\n\n` + lines.join('\n') + `\n\nTotal: ${hits.length} hit(s)`;
        navigator.clipboard.writeText(text).then(() => {
          toast('📋 Hits copied to clipboard!', 'success');
        }).catch(() => {
          // Fallback: download as text file
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'macattack_hits.txt'; a.click();
          URL.revokeObjectURL(url);
          toast('📤 Hits exported as file!', 'success');
        });
      });
    }

    // ── NOTEBOOK: Clear ──
    const clearBtn = document.getElementById('macattack-clear-notebook');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all saved hits? This cannot be undone.')) {
          localStorage.removeItem('cinevault_stalker_hits');
          localStorage.removeItem('cinevault_stalker_notebook');
          const resultsEl = document.getElementById('stalker-results');
          if (resultsEl) resultsEl.innerHTML = '';
          const urlMacEl = document.getElementById('stalker-url-mac');
          if (urlMacEl) urlMacEl.innerHTML = '<div class="stalker-log-dim" style="padding:8px;">No hits yet — scan a portal to find MACs</div>';
          const hitsEl = document.getElementById('stalker-hits');
          if (hitsEl) hitsEl.textContent = '0';
          const testedEl = document.getElementById('stalker-tested');
          if (testedEl) testedEl.textContent = '0';
          toast('🗑 All hits cleared', 'info');
        }
      });
    }

    // ── ACCESS LOG BUTTONS ──
    const portalLogBtn = document.getElementById('macattack-log-portals');
    const macsLogBtn = document.getElementById('macattack-log-macs');
    const pwLogBtn = document.getElementById('macattack-log-passwords');

    // ── PROXY ROTATION + TESTING ──
    const PROXY_SOURCES = [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://proxy.cors.sh/',
      'https://corsproxy.org/?',
    ];
    let currentProxyIndex = 0;
    let proxyTestResults = {};

    function getNextProxy() {
      const customList = document.getElementById('macattack-proxy-list')?.value?.trim();
      const proxies = customList ? customList.split('\n').map(p => p.trim()).filter(Boolean) : PROXY_SOURCES;
      const rotate = document.getElementById('macattack-proxy-rotate')?.checked;
      if (rotate) currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
      return proxies[currentProxyIndex % proxies.length];
    }

    async function testProxies() {
      const btn = document.getElementById('macattack-test-proxies');
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = '⏳ Testing...';
      const url = document.getElementById('stalker-url')?.value?.trim();
      if (!url) { toast('Enter a portal URL first', 'error'); btn.disabled = false; btn.textContent = '🧪 Test Proxies'; return; }

      const customList = document.getElementById('macattack-proxy-list')?.value?.trim();
      const proxies = customList ? customList.split('\n').map(p => p.trim()).filter(Boolean) : PROXY_SOURCES;
      const log = document.getElementById('stalker-log');
      proxyTestResults = {};

      for (const proxy of proxies) {
        const testUrl = `${proxy}${encodeURIComponent(url)}`;
        const start = Date.now();
        try {
          const resp = await fetch(testUrl, { signal: AbortSignal.timeout(8000) });
          const ms = Date.now() - start;
          proxyTestResults[proxy] = { ok: resp.ok, status: resp.status, ms };
          if (log) { appendLog(log, `🧪 ${proxy} → ${resp.status} (${ms}ms) ${resp.ok ? '✅' : '❌'}`, resp.ok ? '#00ff64' : '#ff6666'); }
        } catch (e) {
          proxyTestResults[proxy] = { ok: false, status: 0, ms: 0, error: e.message };
          if (log) { appendLog(log, `🧪 ${proxy} → FAIL: ${e.message}`, '#ff6666'); }
        }
      }

      const working = Object.values(proxyTestResults).filter(r => r.ok).length;
      toast(`🧪 ${working}/${proxies.length} proxies working`, working > 0 ? 'success' : 'error');
      btn.disabled = false;
      btn.textContent = '🧪 Test Proxies';
    }

    async function quickTestPortal() {
      const btn = document.getElementById('macattack-test-portal');
      if (!btn) return;
      const url = document.getElementById('stalker-url')?.value?.trim();
      const mac = document.getElementById('stalker-mac')?.value?.trim();
      if (!url || !mac) { toast('Enter portal URL + MAC first', 'error'); return; }

      btn.disabled = true;
      btn.textContent = '⏳ Testing...';
      setSkullEyes('scan');
      const log = document.getElementById('stalker-log');
      if (log) appendLog(log, `⚡ Quick test: ${url} / ${mac}`, '#00ccff');

      try {
        const resp = await fetch(`/api/stalker-channels?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, { signal: AbortSignal.timeout(20000) });
        const data = await resp.json();
        if (data.channels?.length > 0) {
          setSkullEyes('green');
          playHitSound();
          toast(`⚡ Portal OK — ${data.channelCount} channels!`, 'success');
          if (log) appendLog(log, `⚡ SUCCESS: ${data.channelCount} channels, token: ${data.token || 'none'}`, '#00ff64');
        } else {
          setSkullEyes('red');
          toast('⚡ Portal responded but 0 channels', 'error');
          if (log) appendLog(log, `⚡ FAIL: ${data.error || '0 channels'}`, '#ff6666');
        }
      } catch (e) {
        setSkullEyes('red');
        toast(`⚡ Test failed: ${e.message}`, 'error');
        if (log) appendLog(log, `⚡ ERROR: ${e.message}`, '#ff6666');
      }
      btn.disabled = false;
      btn.textContent = '⚡ Quick Test';
    }

    function appendLog(el, msg, color) {
      if (!el) return;
      const ts = new Date().toLocaleTimeString();
      el.innerHTML += `<div style="color:${color || '#aaa'};font-size:0.78rem">[${ts}] ${msg}</div>`;
      el.scrollTop = el.scrollHeight;
    }

    const testProxiesBtn = document.getElementById('macattack-test-proxies');
    if (testProxiesBtn) testProxiesBtn.onclick = testProxies;
    const quickTestBtn = document.getElementById('macattack-test-portal');
    if (quickTestBtn) quickTestBtn.onclick = quickTestPortal;

    // ── HOURLY PORTAL HEALTH CHECK ──
    let hourlyCheckInterval = null;
    function startHourlyCheck() {
      if (hourlyCheckInterval) clearInterval(hourlyCheckInterval);
      const log = document.getElementById('stalker-log');
      hourlyCheckInterval = setInterval(async () => {
        if (log) appendLog(log, '⏰ Hourly portal health check...', '#ffd700');
        const url = document.getElementById('stalker-url')?.value?.trim();
        const mac = document.getElementById('stalker-mac')?.value?.trim();
        if (!url || !mac) return;
        try {
          const resp = await fetch(`/api/stalker-channels?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, { signal: AbortSignal.timeout(20000) });
          const data = await resp.json();
          if (data.channels?.length > 0) {
            if (log) appendLog(log, `⏰ Health: ✅ ${data.channelCount} channels alive`, '#00ff64');
          } else {
            if (log) appendLog(log, `⏰ Health: ❌ Portal down — ${data.error || '0 channels'}`, '#ff6666');
          }
        } catch (e) {
          if (log) appendLog(log, `⏰ Health: ❌ ${e.message}`, '#ff6666');
        }
      }, 3600000); // every hour
    }
    // Watch the checkbox
    const hourlyCheckEl = document.getElementById('macattack-hourly-check');
    if (hourlyCheckEl) {
      hourlyCheckEl.addEventListener('change', () => {
        if (hourlyCheckEl.checked) { startHourlyCheck(); toast('⏰ Hourly health check ON', 'info'); }
        else { if (hourlyCheckInterval) { clearInterval(hourlyCheckInterval); hourlyCheckInterval = null; } toast('⏰ Hourly health check OFF', 'info'); }
      });
    }

    async function loadAccessLog(filter) {
      const el = document.getElementById('stalker-access-log');
      if (!el) return;
      try {
        const res = await fetch(`/api/stalker-log?filter=${filter || 'latest'}`);
        const data = await res.json();
        if (filter === 'portals') {
          let html = '';
          for (const [url, info] of Object.entries(data)) {
            const color = info.successCount > 0 ? '#00ff64' : '#ff6666';
            html += `<div style="border-bottom:1px solid #333;padding:6px 0">`;
            html += `<div style="color:${color}">${url}</div>`;
            html += `<div style="color:#888;font-size:0.72rem">MACs: ${info.macs?.length || 0} | ✅ ${info.successCount} | ❌ ${info.failCount} | CH: ${info.totalChannels} | Last: ${info.lastSeen || 'never'}</div>`;
            if (info.passwords?.length) html += `<div style="color:#ffd700;font-size:0.72rem">🔑 ${info.passwords.join(', ')}</div>`;
            html += `</div>`;
          }
          el.innerHTML = html || 'No portal data yet';
        } else if (filter === 'macs') {
          const macs = Array.isArray(data) ? data : [];
          el.innerHTML = macs.map(m => `<div style="padding:2px 0;color:#00ccff">${m}</div>`).join('') || 'No MACs logged yet';
        } else if (filter === 'passwords') {
          let html = '';
          for (const [portal, pws] of Object.entries(data)) {
            html += `<div style="border-bottom:1px solid #333;padding:4px 0"><span style="color:#888">${portal}</span><br><span style="color:#ffd700">🔑 ${pws.join(', ')}</span></div>`;
          }
          el.innerHTML = html || 'No passwords found yet';
        } else {
          // Latest entries
          const entries = Array.isArray(data) ? data : [];
          el.innerHTML = entries.slice().reverse().map(e => {
            const color = e.status === 'success' ? '#00ff64' : '#ff6666';
            return `<div style="border-bottom:1px solid #222;padding:3px 0"><span style="color:#666">${e.timestamp?.replace('T',' ').slice(0,19)}</span> <span style="color:${color}">${e.status}</span> <span style="color:#00ccff">${e.mac}</span> <span style="color:#888">SN:${e.serial}</span> <span style="color:#aaa">${e.portal}</span> <span style="color:#888">IP:${e.ip}</span> ${e.password ? `<span style="color:#ffd700">🔑${e.password}</span>` : ''} <span style="color:#00ff64">${e.channelCount}ch</span></div>`;
          }).join('') || 'No scans yet';
        }
      } catch { el.innerHTML = 'Error loading log'; }
    }

    if (portalLogBtn) portalLogBtn.onclick = () => loadAccessLog('portals');
    if (macsLogBtn) macsLogBtn.onclick = () => loadAccessLog('macs');
    if (pwLogBtn) pwLogBtn.onclick = () => loadAccessLog('passwords');

    // Auto-load latest on section open
    const origShowStalker = window._showPage;
    // Load access log when scanner page opens
    const observer = new MutationObserver(() => {
      const sec = document.getElementById('stalker-section');
      if (sec && sec.style.display !== 'none') loadAccessLog('latest');
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });

    // ── GET PLAYLIST ──
    const playlistBtn = document.getElementById('stalker-get-playlist');
    if (playlistBtn) {
      playlistBtn.addEventListener('click', async () => {
        const url = document.getElementById('stalker-url')?.value?.trim();
        const mac = document.getElementById('stalker-mac')?.value?.trim() || '00:1A:79:A3:96:BF';
        if (!url) { toast('❌ Enter a portal URL first', 'error'); return; }
        playlistBtn.disabled = true;
        playlistBtn.textContent = '⏳ Loading...';
        setSkullEyes('scan');
        try {
          // Try to connect and get channel list
          if (typeof StalkerScanner !== 'undefined' && StalkerScanner.connectToPortal) {
            const result = await StalkerScanner.connectToPortal(url, mac);
            if (result && result.channels) {
              setSkullEyes('green');
              playHitSound();
              const portalData = {
                url: url,
                mac: mac,
                channels: result.channels || [],
                genres: result.genres || [],
                portalType: result.portalType || 'Stalker Portal',
                channelCount: result.channelCount || result.channels.length
              };
              if (typeof showPlaylistChannels === 'function') showPlaylistChannels(portalData);
              // Also render channels in the MacAttack scanner channel grid
              const scanChArea = document.getElementById('macattack-channels-area');
              const scanChGrid = document.getElementById('macattack-channels-grid');
              if (scanChArea && scanChGrid && result.channels) {
                scanChArea.style.display = '';
                let chHtml = '';
                for (const ch of result.channels) {
                  const logo = ch.logo || '';
                  const hasStream = !!(ch.url || ch.cmd);
                  const dot = hasStream ? '<span class="channel-live-dot live" style="width:6px;height:6px;position:static;display:inline-block;margin-right:4px"></span>' : '';
                  const chId = ch.id || ch.number || '';
                  const groupId = ch.group || ch.genre || '';
                  chHtml += `<div class="playlist-channel ${hasStream ? 'has-stream' : 'no-stream'}" style="cursor:${hasStream ? 'pointer' : 'default'};display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:6px;border:1px solid #222;margin:2px" data-url="${ch.url || ''}" data-cmd="${ch.cmd || ''}" data-portal="${url}" data-mac="${mac}" data-name="${(ch.name || '').replace(/"/g, '&quot;')}" data-chid="${chId}" data-group="${(groupId || '').replace(/"/g, '&quot;')}">${dot}${logo ? `<img src="${logo}" style="width:32px;height:32px;border-radius:6px;object-fit:contain;background:#111" onerror="this.src='';this.style.display='none'">` : `<div style="width:32px;height:32px;border-radius:6px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:14px;color:#888">📺</div>`}<div style="flex:1;min-width:0"><div style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#eee">${ch.name || 'Channel'}</div><div style="font-size:0.65rem;color:#666;display:flex;gap:4px;flex-wrap:wrap">${chId ? `<span style="color:#00ccff">ID:${chId}</span>` : ''}${groupId ? `<span style="color:#ffd700">${groupId}</span>` : ''}</div></div>${hasStream ? '<span style="font-size:0.6rem;color:#00ff64;background:rgba(0,255,100,0.1);padding:1px 4px;border-radius:3px">LIVE</span>' : '<span style="font-size:0.6rem;color:#666">OFF</span>'}</div>`;
                }
                scanChGrid.innerHTML = chHtml;
                scanChGrid.querySelectorAll('.playlist-channel.has-stream').forEach(el => {
                  el.addEventListener('click', () => playStalkerChannel(el.dataset.portal, el.dataset.mac, el.dataset.name));
                });
                toast(`📺 ${result.channelCount} channels loaded!`, 'success');
              }
              // Update status
              const statusEl = document.getElementById('stalker-status');
              if (statusEl) { statusEl.textContent = '🟢 Connected'; statusEl.className = 'macattack-status-idle'; }
            } else {
              setSkullEyes('red');
              toast('❌ Failed to connect to portal', 'error');
            }
          } else {
            // Fallback: use API
            const resp = await fetch(`/api/stalker-channels?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, {
              signal: AbortSignal.timeout(25000)
            });
            const data = await resp.json();
            if (data.channels && data.channels.length > 0) {
              setSkullEyes('green');
              playHitSound();
              const portalData = {
                url: url,
                mac: mac,
                channels: data.channels,
                genres: data.genres || [],
                portalType: 'Stalker Portal',
                channelCount: data.channelCount || data.channels.length
              };
              if (typeof showPlaylistChannels === 'function') showPlaylistChannels(portalData);
              // Also render channels in the MacAttack scanner channel grid
              const scanChArea2 = document.getElementById('macattack-channels-area');
              const scanChGrid2 = document.getElementById('macattack-channels-grid');
              if (scanChArea2 && scanChGrid2 && data.channels) {
                scanChArea2.style.display = '';
                let chHtml2 = '';
                for (const ch of data.channels) {
                  const logo = ch.logo || '';
                  const hasStream = !!(ch.url || ch.cmd);
                  const dot = hasStream ? '<span class="channel-live-dot live" style="width:6px;height:6px;position:static;display:inline-block;margin-right:4px"></span>' : '';
                  const chId = ch.id || ch.number || '';
                  const groupId = ch.group || ch.genre || '';
                  chHtml2 += `<div class="playlist-channel ${hasStream ? 'has-stream' : 'no-stream'}" style="cursor:${hasStream ? 'pointer' : 'default'};display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:6px;border:1px solid #222;margin:2px" data-url="${ch.url || ''}" data-cmd="${ch.cmd || ''}" data-portal="${url}" data-mac="${mac}" data-name="${(ch.name || '').replace(/"/g, '&quot;')}" data-chid="${chId}" data-group="${(groupId || '').replace(/"/g, '&quot;')}">${dot}${logo ? `<img src="${logo}" style="width:32px;height:32px;border-radius:6px;object-fit:contain;background:#111" onerror="this.src='';this.style.display='none'">` : `<div style="width:32px;height:32px;border-radius:6px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:14px;color:#888">📺</div>`}<div style="flex:1;min-width:0"><div style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#eee">${ch.name || 'Channel'}</div><div style="font-size:0.65rem;color:#666;display:flex;gap:4px;flex-wrap:wrap">${chId ? `<span style="color:#00ccff">ID:${chId}</span>` : ''}${groupId ? `<span style="color:#ffd700">${groupId}</span>` : ''}</div></div>${hasStream ? '<span style="font-size:0.6rem;color:#00ff64;background:rgba(0,255,100,0.1);padding:1px 4px;border-radius:3px">LIVE</span>' : '<span style="font-size:0.6rem;color:#666">OFF</span>'}</div>`;
                }
                scanChGrid2.innerHTML = chHtml2;
                scanChGrid2.querySelectorAll('.playlist-channel.has-stream').forEach(el => {
                  el.addEventListener('click', () => playStalkerChannel(el.dataset.portal, el.dataset.mac, el.dataset.name));
                });
              }
              toast(`📺 ${data.channels.length} channels loaded!`, 'success');
            } else {
              setSkullEyes('red');
              toast('❌ No channels found', 'error');
            }
          }
        } catch (err) {
          setSkullEyes('red');
          toast(`❌ Playlist error: ${err.message}`, 'error');
        }
        playlistBtn.disabled = false;
        playlistBtn.textContent = '📺 Get Playlist';
      });
    }

    // ── Load Channels button — takes first scanner hit and loads it into Live TV ──
    const loadChannelsBtn = document.getElementById('stalker-load-channels');
    if (loadChannelsBtn) {
      loadChannelsBtn.addEventListener('click', () => {
        // Look for scanner hits in localStorage
        const hits = JSON.parse(localStorage.getItem('macattack-hits') || '[]');
        if (!hits.length) {
          toast('💀 No scanner hits yet — run MacAttack first', 'warning');
          return;
        }
        // Take the first hit
        const hit = hits[0];
        const url = hit.url || hit.portal || '';
        const mac = hit.mac || '00:1A:79:A3:96:BF';
        if (!url) {
          toast('❌ Scanner hit has no URL', 'error');
          return;
        }
        // Auto-fill Live TV portal inputs
        const portalUrlInput = document.getElementById('livetv-portal-url');
        const macInput = document.getElementById('livetv-mac');
        if (portalUrlInput) portalUrlInput.value = url;
        if (macInput) macInput.value = mac;
        // Also fill scanner inputs
        const stalkerUrlInput = document.getElementById('stalker-url');
        const stalkerMacInput = document.getElementById('stalker-mac');
        if (stalkerUrlInput) stalkerUrlInput.value = url;
        if (stalkerMacInput) stalkerMacInput.value = mac;
        // Update MacAttack config
        if (typeof macAttackAutoConfig === 'function') macAttackAutoConfig();
        // Switch to Live TV and connect
        switchPage('livetv');
        toast(`📺 Loading channels from ${hit.name || url.substring(0, 40)}...`, 'success');
        // Auto-connect after a brief delay
        setTimeout(() => {
          if (typeof connectLiveTV === 'function') connectLiveTV();
        }, 500);
      });
    }

    // Render saved portal results on load
    renderStalkerResults();
    // Also render the URL+MAC display on load
    if (typeof StalkerScanner !== 'undefined' && StalkerScanner.updateUrlMacDisplay) {
      StalkerScanner.updateUrlMacDisplay();
    }
  }

  // ── STALKER LIVE CHANNEL PLAYER ──
  // Watch a live channel from a stalker portal hit by opening the player overlay
  // Now uses /api/stalker-channels to fetch actual channel list + stream URLs
  function playStalkerChannel(portalUrl, mac, channelName) {
    const displayUrl = portalUrl; // Keep original for display (shows /c/ not /c)
    const base = portalUrl.replace(/\/+$/, '');
    const displayName = channelName || mac || 'IPTV';

    currentMovieId = null;
    currentIsTV = false;
    currentSource = 'stalker';

    playerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    isPlaying = true;
    if (playerPlayBtn) { playerPlayBtn.textContent = '⏸'; playerPlayBtn.title = 'Pause'; }
    isPaused = false;
    if (playerTitle) playerTitle.textContent = `📺 ${displayName}`;
    showPlayerSpinner('💀 Connecting to portal...');
    setSkullEyes('red');

    // Hide source tabs for stalker
    const tabs = document.getElementById('player-source-tabs');
    if (tabs) tabs.style.display = 'none';

    // Show URL + MAC at bottom of player for easy copying
    showStalkerUrlMac(displayUrl, mac);

    // Step 1: Try /api/stalker-channels to get actual channel list with stream URLs
    showPlayerSpinner('💀 Fetching channel list...');
    fetch(`/api/stalker-channels?url=${encodeURIComponent(base)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, {
      signal: AbortSignal.timeout(25000)
    })
    .then(r => r.json())
    .then(data => {
      // Save token + portal URL for stream proxy calls (fresh handshake needs portal URL)
      if (data.token) window._stalkerToken = data.token;
      if (base) window._stalkerPortal = base;
      if (data.channels && data.channels.length > 0) {
        console.log(`[CineVault] Got ${data.channels.length} channels from /api/stalker-channels`);
        setSkullEyes('green');
        showChannelSelector(base, mac, data.channels);
      } else {
        console.warn('[CineVault] No channels from /api/stalker-channels, falling back to iframe');
        fallbackToIframe();
      }
    })
    .catch(err => {
      console.warn('[CineVault] Channel list fetch failed, falling back to iframe:', err);
      fallbackToIframe();
    });

    // ── CHANNEL SELECTOR OVERLAY ──
    // Shows list of channel names with genre filtering; user picks one to play via HLS.js
    function showChannelSelector(portalBaseUrl, portalMac, channels) {
      playerVideoWrap.innerHTML = '';
      showPlayerSpinner(`💀 ${channels.length} channels found — pick one below`);

      const selector = document.createElement('div');
      selector.className = 'stalker-channel-selector';
      selector.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10;overflow-y:auto;padding:60px 20px 80px;';

      // Build genre list for filter tabs
      const genreCounts = {};
      for (const ch of channels) {
        const g = ch.genreName || ch.group || 'Other';
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
      const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);

      const header = document.createElement('div');
      header.style.cssText = 'text-align:center;margin-bottom:12px;';
      header.innerHTML = `
        <div style="font-size:1.2rem;color:#e50914;font-weight:bold;margin-bottom:4px;">📺 ${channels.length} Channels Available</div>
        <div style="font-size:0.75rem;color:#888;">Portal: ${portalBaseUrl} | MAC: ${portalMac}</div>
        <input type="text" placeholder="Search channels..." style="margin-top:8px;padding:8px 12px;width:80%;max-width:400px;border:1px solid #333;background:#111;color:#fff;border-radius:4px;font-size:0.85rem;" id="stalker-ch-search" />
      `;
      selector.appendChild(header);

      // Genre filter tabs
      const tabRow = document.createElement('div');
      tabRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-bottom:12px;max-height:80px;overflow-y:auto;';
      let activeGenre = 'all';
      const allTab = document.createElement('button');
      allTab.textContent = `All (${channels.length})`;
      allTab.style.cssText = 'padding:4px 10px;background:#e50914;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:0.75rem;';
      tabRow.appendChild(allTab);
      const genreButtons = { 'all': allTab };
      for (const [genre, count] of sortedGenres.slice(0, 30)) {
        const tab = document.createElement('button');
        tab.textContent = `${genre} (${count})`;
        tab.style.cssText = 'padding:4px 10px;background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:0.7rem;';
        tab.dataset.genre = genre;
        genreButtons[genre] = tab;
        tabRow.appendChild(tab);
      }
      selector.appendChild(tabRow);

      // Wire tab clicks
      tabRow.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const genre = btn.dataset.genre || 'all';
        activeGenre = genre;
        // Update tab styles
        for (const [g, b] of Object.entries(genreButtons)) {
          b.style.background = g === genre ? '#e50914' : '#1a1a2e';
          b.style.color = g === genre ? '#fff' : '#aaa';
          b.style.border = g === genre ? 'none' : '1px solid #333';
        }
        // Filter channel buttons
        list.querySelectorAll('.stalker-ch-item').forEach(item => {
          const show = genre === 'all' || item.dataset.genre === genre;
          item.style.display = show ? '' : 'none';
        });
      });

      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';

      channels.forEach((ch, idx) => {
        const btn = document.createElement('button');
        const chName = ch.name || ch.title || `Ch ${idx + 1}`;
        const chCmd = ch.cmd || ch.streamUrl || ch.url || '';
        const chGenre = ch.genreName || ch.group || '';
        btn.className = 'stalker-ch-item';
        btn.dataset.cmd = chCmd;
        btn.dataset.name = chName;
        btn.dataset.genre = chGenre;
        btn.dataset.index = idx;
        btn.style.cssText = 'padding:8px 14px;background:#1a1a2e;border:1px solid #333;color:#fff;border-radius:4px;cursor:pointer;font-size:0.8rem;max-width:180px;text-align:center;transition:border-color 0.2s;';
        btn.innerHTML = `<div style="font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chName}</div>${chGenre ? `<div style="font-size:0.65rem;color:#888;margin-top:2px;">${chGenre}</div>` : ''}`;

        btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#e50914'; });
        btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#333'; });

        btn.addEventListener('click', () => {
          playStalkerStream(portalBaseUrl, portalMac, chCmd, chName);
        });
        list.appendChild(btn);
      });

      selector.appendChild(list);
      playerVideoWrap.appendChild(selector);
      playerElement = selector;

      // Wire up search filter
      setTimeout(() => {
        const searchInput = document.getElementById('stalker-ch-search');
        if (searchInput) {
          searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            list.querySelectorAll('.stalker-ch-item').forEach(btn => {
              const name = btn.dataset.name.toLowerCase();
              const matchesSearch = name.includes(q);
              const matchesGenre = activeGenre === 'all' || btn.dataset.genre === activeGenre;
              btn.style.display = (matchesSearch && matchesGenre) ? '' : 'none';
            });
          });
          searchInput.focus();
        }
      }, 100);

      // After a short moment hide the spinner so selector is visible
      setTimeout(() => hidePlayerSpinner(), 300);
    }

    // ── PLAY STREAM VIA HLS.js ──
    function playStalkerStream(portalBaseUrl, portalMac, channelCmd, channelDisplayName) {
      showPlayerSpinner(`💀 Loading ${channelDisplayName}...`);
      setSkullEyes('red');
      playerVideoWrap.innerHTML = '';

      const video = document.createElement('video');
      video.id = 'live-hls-player';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'width:100%;height:100%;background:#000;position:absolute;top:0;left:0;';
      video.controls = true;
      // Hide video until it starts playing — prevents "little box" behind spinner
      video.style.opacity = '0';
      video.style.transition = 'opacity 0.3s ease';
      playerVideoWrap.appendChild(video);
      playerElement = video;

      // ── Debugger Preview Panel ──
      const dbg = document.createElement('div');
      dbg.id = 'stalker-debug-panel';
      dbg.style.cssText = 'position:absolute;bottom:60px;left:10px;max-width:420px;max-height:260px;overflow-y:auto;background:rgba(0,0,0,0.88);border:1px solid #e50914;border-radius:6px;padding:10px 14px;font-size:11px;color:#0f0;z-index:5;font-family:monospace;pointer-events:none;display:none;';
      dbg.innerHTML = `<div style="color:#e50914;font-weight:bold;margin-bottom:4px;">💀 STREAM DEBUGGER</div><div id="dbg-lines"></div>`;
      playerVideoWrap.appendChild(dbg);
      const dbgLines = dbg.querySelector('#dbg-lines');
      function dbgLog(msg, color) {
        if (!dbgLines) return;
        const ts = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.style.color = color || '#0f0';
        line.textContent = `[${ts}] ${msg}`;
        dbgLines.appendChild(line);
        dbgLines.scrollTop = dbgLines.scrollHeight;
      }
      dbgLog(`Channel: ${channelDisplayName}`, '#fff');
      dbgLog(`Portal: ${portalBaseUrl}`, '#888');
      dbgLog(`MAC: ${portalMac}`, '#888');
      dbgLog(`Raw cmd: ${channelCmd?.substring(0, 80)}`, '#ff0');

      // Resolve stream URL
      let streamUrl = channelCmd;
      if (streamUrl.startsWith('ffmpeg ')) streamUrl = streamUrl.substring(7);

      // If it's a localhost URL, resolve via server create_link endpoint
      if (streamUrl.includes('localhost') || streamUrl.includes('/ch/')) {
        dbgLog('Resolving localhost URL via create_link...', '#ff0');
        const proxyType = window._stalkerProxyType ? window._stalkerProxyType() : 'server';
        const token = window._stalkerToken || '';
        showPlayerSpinner(`💀 Resolving stream for ${channelDisplayName}...`);
        fetch(`/api/stalker-create-link?url=${encodeURIComponent(portalBaseUrl)}&mac=${encodeURIComponent(portalMac)}&cmd=${encodeURIComponent(channelCmd)}&token=${encodeURIComponent(token)}&proxy=${encodeURIComponent(proxyType)}`)
          .then(r => r.json())
          .then(data => {
            if (data.streamUrl && (data.streamUrl.startsWith('http://') || data.streamUrl.startsWith('https://'))) {
              dbgLog(`Resolved: ${data.streamUrl.substring(0, 80)}`, '#0f0');
              loadHlsStream(video, data.streamUrl, channelDisplayName, portalBaseUrl, portalMac);
            } else {
              dbgLog(`Failed to resolve: ${JSON.stringify(data).substring(0, 100)}`, '#f00');
              // Try token-based handshake then retry
              doHandshakeAndRetry();
            }
          })
          .catch(err => {
            dbgLog(`create_link error: ${err.message}`, '#f00');
            doHandshakeAndRetry();
          });

        function doHandshakeAndRetry() {
          dbgLog('Retrying with fresh handshake...', '#ff0');
          const proxyType2 = window._stalkerProxyType ? window._stalkerProxyType() : 'server';
          fetch(`/api/stalker-channels?url=${encodeURIComponent(portalBaseUrl)}&mac=${encodeURIComponent(portalMac)}&proxy=${encodeURIComponent(proxyType2)}`)
            .then(r => r.json())
            .then(data => {
              const newToken = data.token || '';
              window._stalkerToken = newToken;
              dbgLog(`New token: ${newToken ? newToken.substring(0,16)+'...' : 'FAIL'}`, newToken ? '#0f0' : '#f00');
              if (newToken) {
                fetch(`/api/stalker-create-link?url=${encodeURIComponent(portalBaseUrl)}&mac=${encodeURIComponent(portalMac)}&cmd=${encodeURIComponent(channelCmd)}&token=${encodeURIComponent(newToken)}&proxy=${encodeURIComponent(proxyType2)}`)
                  .then(r2 => r2.json())
                  .then(data2 => {
                    if (data2.streamUrl) {
                      dbgLog(`Resolved (retry): ${data2.streamUrl.substring(0, 80)}`, '#0f0');
                      loadHlsStream(video, data2.streamUrl, channelDisplayName, portalBaseUrl, portalMac);
                    } else {
                      dbgLog('Final resolve failed — black screen', '#f00');
                      hidePlayerSpinner();
                    }
                  })
                  .catch(err2 => { dbgLog(`Retry error: ${err2.message}`, '#f00'); hidePlayerSpinner(); });
              } else {
                dbgLog('No token — cannot resolve', '#f00');
                hidePlayerSpinner();
              }
            })
            .catch(err => { dbgLog(`Handshake error: ${err.message}`, '#f00'); hidePlayerSpinner(); });
        }
      } else if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) {
        dbgLog(`Direct URL — playing`, '#0f0');
        loadHlsStream(video, streamUrl, channelDisplayName, portalBaseUrl, portalMac);
      } else {
        dbgLog(`Cannot parse cmd: ${streamUrl?.substring(0,60)}`, '#f00');
        // Needs create_link — try server-side resolution via StalkerScanner
        if (typeof StalkerScanner !== 'undefined' && StalkerScanner.getStreamUrl) {
          StalkerScanner.getStreamUrl(portalBaseUrl, portalMac, channelCmd).then(resolvedUrl => {
            dbgLog(`StalkerScanner resolved: ${resolvedUrl?.substring(0,80)}`, '#0f0');
            loadHlsStream(video, resolvedUrl, channelDisplayName, portalBaseUrl, portalMac);
          }).catch(() => {
            // Fallback to iframe
            fallbackToIframe();
          });
        } else {
          // Fallback: try /api/stalker-channels with cmd param
          fetch(`/api/stalker-channels?url=${encodeURIComponent(portalBaseUrl)}&mac=${encodeURIComponent(portalMac)}&cmd=${encodeURIComponent(channelCmd)}&proxy=${encodeURIComponent(window._stalkerProxyType())}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}`, {
            signal: AbortSignal.timeout(10000)
          })
          .then(r => r.json())
          .then(data => {
            const url = data.streamUrl || data.cmd || channelCmd;
            loadHlsStream(video, url, channelDisplayName, portalBaseUrl, portalMac);
          })
          .catch(() => {
            fallbackToIframe();
          });
        }
      }

      // ── HLS STREAM LOADER ──
    function loadHlsStream(videoEl, streamUrl, channelName, portalBaseUrl, portalMac) {
      if (!streamUrl || (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://'))) {
        dbgLog(`Invalid stream URL: ${streamUrl?.substring(0,60)}`, '#f00');
        fallbackToIframe();
        return;
      }

      // Strip ffmpeg prefix just in case
      if (streamUrl.startsWith('ffmpeg ')) streamUrl = streamUrl.substring(7);
      dbgLog(`Loading stream: ${streamUrl.substring(0,80)}`, '#0f0');

      // Detect stream type BEFORE proxy rewrite (need original URL to check extensions)
      // CDN stalker streams are MPEG-TS (.ts) which browsers can't play natively.
      // They MUST go through HLS.js even without .m3u8 extension.
      const isHLS = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
      const isStalkerStream = streamUrl.includes('cdnip') || streamUrl.includes('play_token') || streamUrl.includes('/ch/');
      const isDirect = !isHLS && !isStalkerStream && (streamUrl.includes('.mp4') || streamUrl.includes('.ts'));

      // Route through /api/stalker-stream proxy — CDN requires MAG200 auth cookies
      // Browser can't send cookies cross-origin, so server proxies with full auth
      const stalkerToken = window._stalkerToken || '';
      const stalkerPortal = window._stalkerPortal || portalBaseUrl || '';
      const originalStreamUrl = streamUrl;
      if (portalMac) {
        const proxiedUrl = `/api/stalker-stream?url=${encodeURIComponent(streamUrl)}&mac=${encodeURIComponent(portalMac)}&token=${encodeURIComponent(stalkerToken)}&portal=${encodeURIComponent(stalkerPortal)}`;
        dbgLog(`Routed through stream proxy: ${proxiedUrl.substring(0,80)}`, '#0f0');
        streamUrl = proxiedUrl;
      }

      // Add LIVE badge to player
      const liveBadge = document.createElement('div');
      liveBadge.id = 'live-badge';
      liveBadge.style.cssText = 'position:absolute;top:12px;right:12px;background:#e50914;color:#fff;font-size:0.7rem;font-weight:bold;padding:3px 8px;border-radius:3px;z-index:15;animation:blink 1.5s infinite;display:none;';
      liveBadge.textContent = '🔴 LIVE';
      playerVideoWrap.appendChild(liveBadge);

      // Add time display for debugging
      const timeDisplay = document.createElement('div');
      timeDisplay.id = 'stream-debug-time';
      timeDisplay.style.cssText = 'position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.7);color:#0f0;font-size:0.65rem;font-family:monospace;padding:4px 8px;border-radius:4px;z-index:15;display:none;';
      playerVideoWrap.appendChild(timeDisplay);

      // Update time display every second
      const timeInterval = setInterval(() => {
        if (!videoEl) { clearInterval(timeInterval); return; }
        const ct = videoEl.currentTime || 0;
        const dur = videoEl.duration || 0;
        const ready = videoEl.readyState;
        const paused = videoEl.paused;
        const net = videoEl.networkState;
        const stateMap = {0:'EMPTY',1:'IDLE',2:'LOADING',3:'NO_SOURCE'};
        if (timeDisplay) {
          timeDisplay.style.display = 'block';
          timeDisplay.textContent = `▶ ${formatTime(ct)}/${isFinite(dur)?formatTime(dur):'LIVE'} rdy=${ready} ${paused?'⏸':'▶'} net=${stateMap[net]||net}`;
        }
      }, 1000);

      // Stalker CDN streams are MPEG-TS — browsers can't play natively.
      // Force HLS.js even without .m3u8 extension.
      const needsHlsJs = (isHLS || isStalkerStream) && typeof Hls !== 'undefined' && Hls.isSupported();

      if (needsHlsJs) {
        dbgLog(isHLS ? 'HLS stream detected — using HLS.js' : 'Stalker MPEG-TS stream — using HLS.js', '#0f0');
        const hls = new Hls({
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          liveDurationInfinity: true,
          progressive: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(videoEl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          dbgLog('HLS manifest parsed — playing', '#0f0');
          videoEl.play().catch(e => dbgLog(`play() failed: ${e.message}`, '#ff0'));
          // Fade video in and hide spinner
          videoEl.style.opacity = '1';
          hidePlayerSpinner();
          setSkullEyes('green');
          setSkullConnected(channelName);
          liveBadge.style.display = 'block';
          if (typeof StalkerScanner !== 'undefined') {
            try { StalkerScanner.macAttackAlertSound && StalkerScanner.macAttackAlertSound(); } catch {}
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          dbgLog('HLS fragment loaded', '#0f0');
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          dbgLog(`HLS error: ${data.type} ${data.details}`, data.fatal ? '#f00' : '#ff0');
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                dbgLog('Network error — retrying...', '#ff0');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                dbgLog('Media error — recovering...', '#ff0');
                hls.recoverMediaError();
                break;
              default:
                // Try native playback
                dbgLog('Fatal HLS error — trying direct play', '#f00');
                tryDirectPlay();
                break;
            }
          }
        });
        videoEl._hls = hls;

      } else {
        // Direct play — MP4, TS, or octet-stream from stalker portals
        dbgLog(isHLS ? 'HLS native (Safari)' : 'Direct stream — setting video.src', '#0f0');
        tryDirectPlay();
      }

      function tryDirectPlay() {
        // Unmute for autoplay to work
        videoEl.muted = false;
        videoEl.src = streamUrl;
        videoEl.load();

        videoEl.addEventListener('loadeddata', () => {
          dbgLog(`Stream loaded — playing (readyState=${videoEl.readyState})`, '#0f0');
          videoEl.play().catch(e => {
            dbgLog(`Autoplay blocked — muting: ${e.message}`, '#ff0');
            videoEl.muted = true;
            videoEl.play().catch(e2 => dbgLog(`Still can't play: ${e2.message}`, '#f00'));
          });
          // Fade video in and hide spinner
          videoEl.style.opacity = '1';
          hidePlayerSpinner();
          setSkullEyes('green');
          setSkullConnected(channelName);
          liveBadge.style.display = 'block';
          if (typeof StalkerScanner !== 'undefined') {
            try { StalkerScanner.macAttackAlertSound && StalkerScanner.macAttackAlertSound(); } catch {}
          }
        }, { once: true });

        videoEl.addEventListener('canplay', () => {
          dbgLog('canplay event — stream ready', '#0f0');
          if (videoEl.paused) {
            videoEl.play().catch(() => {});
          }
        }, { once: true });

        videoEl.addEventListener('playing', () => {
          dbgLog('PLAYING — stream active!', '#0f0');
          liveBadge.style.display = 'block';
          videoEl.style.opacity = '1';
          dbg.style.display = 'block';
        }, { once: true });

        videoEl.addEventListener('waiting', () => {
          dbgLog('Buffering...', '#ff0');
        });

        videoEl.addEventListener('error', (e) => {
          dbgLog(`Video error: ${videoEl.error?.code} ${videoEl.error?.message}`, '#f00');
          // Try HLS.js as fallback if we haven't yet
          if (!isHLS && typeof Hls !== 'undefined' && Hls.isSupported() && !videoEl._hls) {
            dbgLog('Direct play failed — trying HLS.js', '#ff0');
            const hls = new Hls({
              liveDurationInfinity: true,
              liveSyncDurationCount: 3,
              progressive: true,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(videoEl);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              videoEl.play().catch(() => {});
              hidePlayerSpinner();
              setSkullEyes('green');
              liveBadge.style.display = 'block';
            });
            hls.on(Hls.Events.ERROR, (_, d) => {
              if (d.fatal) {
                dbgLog('HLS fallback also failed', '#f00');
                hls.destroy();
                fallbackToIframe();
              }
            });
            videoEl._hls = hls;
          }
        }, { once: true });

        // Timeout — if nothing plays in 10s, try iframe
        setTimeout(() => {
          if (videoEl.readyState === 0 && !videoEl._hls) {
            dbgLog('10s timeout — no data received', '#f00');
          }
        }, 10000);
      }

      function formatTime(s) {
        if (!isFinite(s) || s < 0) return 'LIVE';
        const h = Math.floor(s/3600);
        const m = Math.floor((s%3600)/60);
        const sec = Math.floor(s%60);
        return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
      }

      // Update title
      if (playerTitle) playerTitle.textContent = `📺 ${channelName}`;
    }

    } // end playStalkerStream

    // ── IFRAME FALLBACK (old behavior) ──
    function fallbackToIframe() {
      showPlayerSpinner(`💀 Loading ${displayName} via iframe...`);
      playerVideoWrap.innerHTML = '';

      const serialNum = mac.split(':').map(h => parseInt(h, 16)).reduce((a, b) => a + b, 0).toString(16).toUpperCase().padStart(13, '0');
      const PROXY = '/api/stalker-proxy';

      const iframe = document.createElement('iframe');
      const portalPath = `${base}/c/`;
      const proxyedUrl = `${PROXY}?url=${encodeURIComponent(portalPath)}&mac=${encodeURIComponent(mac)}&sn=${encodeURIComponent(serialNum)}`;
      const embedUrl = `/api/embed-proxy?url=${encodeURIComponent(portalPath)}`;

      iframe.src = embedUrl;
      iframe.allow = 'autoplay; fullscreen; encrypted-media';
      iframe.allowFullscreen = true;
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.style.cssText = 'width:100%;height:100%;border:none;outline:none;background:#000;';
      // No sandbox — embed sources need redirects through multiple domains

      let connected = false;
      iframe.onload = () => {
        if (!connected) {
          connected = true;
          setSkullEyes('green');
          setSkullConnected(displayName);
          MovieLogs.add('watch', `📺 ${displayName}`, null, {
            source: 'stalker',
            details: `Portal: ${base} | MAC: ${mac}`
          });
        }
      };
      iframe.onerror = () => {
        if (!connected) {
          console.warn('[CineVault] Embed proxy failed, trying stalker proxy...');
          iframe.src = proxyedUrl;
        }
      };

      playerVideoWrap.appendChild(iframe);
      playerElement = iframe;

      const fallbackUrls = [
        proxyedUrl,
        `${PROXY}?url=${encodeURIComponent(base + '/stalker_portal/c/')}&mac=${encodeURIComponent(mac)}&sn=${encodeURIComponent(serialNum)}`,
        `${PROXY}?url=${encodeURIComponent(base + '/portal.php?type=itv')}&mac=${encodeURIComponent(mac)}&sn=${encodeURIComponent(serialNum)}`,
      ];
      let fallbackIdx = 0;

      const fallbackTimer = setTimeout(() => {
        if (!connected && fallbackUrls.length > 0) {
          const nextUrl = fallbackUrls[fallbackIdx++];
          if (nextUrl) iframe.src = nextUrl;
        }
      }, 8000);

      setTimeout(() => {
        if (!connected) {
          connected = true;
          setSkullEyes('green');
          setSkullConnected(displayName);
        }
      }, 12000);

      const origClose = playerClose?.onclick;
      if (playerClose) {
        playerClose.onclick = () => {
          clearTimeout(fallbackTimer);
          if (origClose) origClose();
        };
      }

      startControlsAutoHide();
    }
  }

  // ── SHOW URL+MAC AT BOTTOM OF PLAYER ──
  function showStalkerUrlMac(url, mac) {
    // Remove any existing stalker URL+MAC bar
    const existing = document.getElementById('stalker-player-info');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'stalker-player-info';
    bar.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;padding:6px 12px;background:rgba(0,0,0,0.85);color:#00ff64;font-family:monospace;font-size:0.7rem;z-index:20;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(229,9,20,0.4);';
    bar.innerHTML = `
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="URL: ${url} | MAC: ${mac}">URL: ${url} | MAC: ${mac}</span>
      <button onclick="navigator.clipboard.writeText('URL: ${url} | MAC: ${mac}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)" style="padding:2px 10px;background:#e50914;border:none;color:#fff;border-radius:3px;cursor:pointer;font-size:0.65rem;flex-shrink:0;">Copy</button>
    `;
    // Insert into player overlay
    const overlay = document.getElementById('player-overlay');
    if (overlay) overlay.appendChild(bar);

    // Clean up on player close
    const origClose = playerClose?.onclick;
    if (playerClose) {
      playerClose.onclick = () => {
        const infoBar = document.getElementById('stalker-player-info');
        if (infoBar) infoBar.remove();
        if (origClose) origClose();
      };
    }
  }

  // Render saved stalker portal hits from localStorage
  function renderStalkerResults() {
    try {
      const hits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
      const resultsEl = document.getElementById('stalker-results');
      if (!resultsEl || !hits.length) return;
      resultsEl.innerHTML = `
        <div class="stalker-log-title">═══ SAVED PORTALS ═══</div>
        <table class="stalker-table">
          <thead><tr><th>MAC</th><th>URL</th><th>Channels</th><th>Expiry</th><th>Type</th><th>Watch</th><th>Load</th></tr></thead>
          <tbody>
            ${hits.map((h, i) => `
              <tr>
                <td><code>${h.mac || 'N/A'}</code></td>
                <td><code style="font-size:0.7rem;word-break:break-all;">${h.url || h.portalUrl || 'N/A'}</code></td>
                <td>${h.channels || '?'}</td>
                <td>${h.expiry || 'Unknown'}</td>
                <td>${h.portalType || 'Portal'}</td>
                <td><button class="btn btn-primary stalker-watch-btn" data-index="${i}" style="padding:4px 12px;font-size:0.75rem;">▶ Watch</button></td>
                <td><button class="btn btn-success stalker-load-btn" data-index="${i}" style="padding:4px 12px;font-size:0.75rem;">📺 Load</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      // Bind watch buttons — use hit.url as the portal URL
      resultsEl.querySelectorAll('.stalker-watch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const hit = hits[parseInt(btn.dataset.index)];
          if (hit) playStalkerChannel(hit.url || hit.portalUrl || document.getElementById('stalker-url')?.value || '', hit.mac);
        });
      });
      // Bind load channel buttons
      resultsEl.querySelectorAll('.stalker-load-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const hit = hits[parseInt(btn.dataset.index)];
          if (!hit) return;
          btn.textContent = '⏳';
          btn.disabled = true;
          try {
            const portalUrl = hit.url || document.getElementById('stalker-url')?.value || '';
            const res = await fetch(`/api/stalker-channels?url=${encodeURIComponent(portalUrl)}&mac=${encodeURIComponent(hit.mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`);
            const data = await res.json();
            if (data.channels && data.channels.length > 0) {
              // Merge into Live TV
              if (typeof StalkerScanner !== 'undefined' && StalkerScanner.mergeChannelsToLive) {
                StalkerScanner.mergeChannelsToLive(data.channels, hit.mac);
              }
              btn.textContent = `✅ ${data.channels.length}`;
              toast(`📺 Loaded ${data.channels.length} channels from portal!`, 'success');
            } else {
              btn.textContent = '❌ 0';
              toast('No channels found on this portal', '');
            }
          } catch (e) {
            btn.textContent = '❌';
            toast(`Failed to load channels: ${e.message}`, 'error');
          }
        });
      });
    } catch (e) { /* no saved data */ }
  }

  // ══════════════════════════════
  //  EVENTS
  // ══════════════════════════════
  function bindEvents() {
    // Nav
    navLinks.forEach(l => {
      l.addEventListener('click', (e) => {
        e.preventDefault();
        switchPage(l.dataset.page);
      });
    });

    // Live TV tab switching (Portal / Playlist / Settings)
    document.querySelectorAll('.livetv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.livetv-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.livetv-tab-content').forEach(tc => {
          tc.style.display = 'none';
          tc.classList.remove('active');
        });
        const target = document.getElementById(`livetv-tab-${tabName}`);
        if (target) { target.style.display = ''; target.classList.add('active'); }
      });
    });

    // Search
    searchBtn.addEventListener('click', () => doSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(searchInput.value); });

    // Theme
    themeToggle.addEventListener('click', () => {
      const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      store.setTheme(newTheme);
      applyTheme(newTheme);
    });

    // Modal
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    // Modal play
    modalTrailer.addEventListener('click', () => {
      if (currentMovieId) openPlayer(currentMovieId, currentIsTV);
    });

    // Modal watchlist
    modalWatchlist.addEventListener('click', () => {
      if (!currentMovieData) return;
      const movie = {
        id: currentMovieData.id,
        title: currentMovieData.title || currentMovieData.name,
        poster: currentMovieData.poster_path,
        rating: currentMovieData.vote_average?.toString(),
        year: (currentMovieData.release_date || '').slice(0, 4)
      };
      const added = store.add(movie);
      toast(added ? `Added "${movie.title}" to watchlist` : `Removed from watchlist`, added ? 'success' : '');
      modalWatchlist.textContent = added ? '✓ In Watchlist' : '＋ Watchlist';
      modalWatchlist.classList.toggle('added', added);
    });

    // Hero buttons
    heroPlay.addEventListener('click', () => {
      if (heroMovie) openPlayer(heroMovie.id);
    });
    heroInfo.addEventListener('click', () => {
      if (heroMovie) openModal(heroMovie.id);
    });
    heroList.addEventListener('click', () => {
      if (!heroMovie) return;
      const added = store.add({ id: heroMovie.id, title: heroMovie.title || heroMovie.name, poster: heroMovie.poster_path, rating: heroMovie.vote_average?.toString(), year: (heroMovie.release_date || '').slice(0, 4) });
      toast(added ? `Added "${heroMovie.title || heroMovie.name}" to watchlist` : 'Removed from watchlist', added ? 'success' : '');
    });

    // Player close
    playerClose.addEventListener('click', closePlayer);
    playerOverlay.addEventListener('click', (e) => {
      if (e.target === playerOverlay) closePlayer();
    });

    // Source tabs
    $$('.source-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchSource(tab.dataset.source);
      });
    });

    // ── Direct URL Go button ──
    const directUrlGo = document.getElementById('direct-url-go');
    const directUrlInput = document.getElementById('direct-url-input');
    if (directUrlGo && directUrlInput) {
      directUrlGo.addEventListener('click', () => {
        const url = directUrlInput.value.trim();
        if (!url) return;
        loadDirectUrl(url);
      });
      directUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const url = directUrlInput.value.trim();
          if (url) loadDirectUrl(url);
        }
      });
    }

    // ── Load a direct URL in the player iframe ──
    function loadDirectUrl(url) {
      playerVideoWrap.innerHTML = '';
      playerProgress.style.width = '0%';
      if (playerTime) playerTime.textContent = '0:00 / 0:00';
      if (sourceTimeout) clearTimeout(sourceTimeout);

      $$('.source-tab').forEach(t => t.classList.toggle('active', t.dataset.source === 'direct'));
      const urlBar = document.getElementById('direct-url-bar');
      if (urlBar) urlBar.style.display = 'flex';

      showPlayerSpinner('🔗 Loading direct URL...');
      setSkullEyes('red');

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; popups; forms; same-origin';
      iframe.allowFullscreen = true;
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox allow-presentation');
      iframe.style.cssText = 'width:100%;height:100%;border:none;outline:none;background:#000;';

      let loaded = false;
      iframe.onload = () => {
        loaded = true;
        if (sourceTimeout) clearTimeout(sourceTimeout);
        const title = currentMovieData?.title || currentMovieData?.name || 'Direct URL';
        setSkullConnected(title);
        if (playerTitle) playerTitle.textContent = title + ' 🔗';
        isPlaying = true;
        isPaused = false;
        if (playerPlayBtn) { playerPlayBtn.textContent = '⏸'; playerPlayBtn.title = 'Pause'; }
      };
      iframe.onerror = () => {
        if (!loaded) { setSkullEyes('red'); showToast('Failed to load URL'); }
      };

      sourceTimeout = setTimeout(() => {
        if (!loaded) {
          console.warn('[CineVault] Direct URL timed out');
          setSkullEyes('red');
        }
      }, 30000);

      playerVideoWrap.appendChild(iframe);
      playerElement = iframe;
      startControlsAutoHide();
    }

    // Player controls auto-hide on mouse move + tap
    playerOverlay.addEventListener('mousemove', () => {
      if (!isPlaying) return;
      const header = playerOverlay.querySelector('.player-header');
      if (header) header.style.opacity = '1';
      if (playerControls) playerControls.style.opacity = '1';
      playerOverlay.style.cursor = 'default';
      startControlsAutoHide();
    });
    playerOverlay.addEventListener('click', (e) => {
      // Don't interfere with buttons/controls
      if (e.target.closest('.player-ctrl-btn, .source-tab, .player-header, .player-controls')) return;
      if (!isPlaying) return;
      const header = playerOverlay.querySelector('.player-header');
      if (header) header.style.opacity = '1';
      if (playerControls) playerControls.style.opacity = '1';
      playerOverlay.style.cursor = 'default';
      startControlsAutoHide();
    });

    // Previous/Next episode buttons
    const prevBtn = document.getElementById('player-prev-btn');
    const nextBtn = document.getElementById('player-next-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentIsTV && currentSeason && currentEpisode) {
          const prevEp = currentEpisode - 1;
          if (prevEp >= 1) {
            currentEpisode = prevEp;
            openPlayer(currentMovieId, true, currentSeason, currentEpisode);
          }
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentIsTV && currentSeason && currentEpisode) {
          currentEpisode = currentEpisode + 1;
          openPlayer(currentMovieId, true, currentSeason, currentEpisode);
        }
      });
    }

    // Fullscreen
    const fullscreenBtn = document.getElementById('player-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const container = playerOverlay;
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
      });
    }

    // Volume
    if (playerVolSlider) {
      playerVolSlider.addEventListener('input', () => {
        if (playerElement && playerElement.contentWindow) {
          try { playerElement.contentWindow.postMessage({ type: 'volume', value: playerVolSlider.value / 100 }, '*'); } catch {}
        }
      });
    }

    // Play/Pause button — toggles iframe playback and button icon
    if (playerPlayBtn) {
      playerPlayBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (playerElement && playerElement.contentWindow) {
          try {
            // Send play/pause to embed players (vidsrc, cloudnestra, etc)
            playerElement.contentWindow.postMessage({ type: isPaused ? 'pause' : 'play' }, '*');
            // Also try older postMessage formats
            playerElement.contentWindow.postMessage({ method: isPaused ? 'pause' : 'play' }, '*');
            playerElement.contentWindow.postMessage({ event: 'command', method: isPaused ? 'pause' : 'play' }, '*');
            // Generic toggle for players that support it
            if (!isPaused) {
              playerElement.contentWindow.postMessage({ type: 'playPause' }, '*');
            }
          } catch {}
        }
        // Toggle button icon — ▶ when paused, ⏸ when playing
        playerPlayBtn.textContent = isPaused ? '▶' : '⏸';
        playerPlayBtn.title = isPaused ? 'Play' : 'Pause';
        // Show controls momentarily on toggle
        const header = playerOverlay?.querySelector('.player-header');
        if (header) header.style.opacity = '1';
        if (playerControls) playerControls.style.opacity = '1';
        startControlsAutoHide();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isPlaying) closePlayer();
        else if (modalOverlay.classList.contains('open')) closeModal();
        return;
      }
      // Only handle shortcuts when player is open
      if (!isPlaying) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (playerPlayBtn) playerPlayBtn.click();
      } else if (e.key === 'f') {
        e.preventDefault();
        if (fullscreenBtn) fullscreenBtn.click();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (prevBtn) prevBtn.click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (nextBtn) nextBtn.click();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (playerVolSlider) playerVolSlider.value = Math.min(100, parseInt(playerVolSlider.value) + 10);
        playerVolSlider.dispatchEvent(new Event('input'));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (playerVolSlider) playerVolSlider.value = Math.max(0, parseInt(playerVolSlider.value) - 10);
        playerVolSlider.dispatchEvent(new Event('input'));
      }
    });

    // Watchlist store change
    store.onChange(() => {
      if (currentPage === 'watchlist') renderWatchlist();
    });

    // Stalker scanner
    initStalkerScanner();

    // MacAttack auto-config
    macAttackAutoConfig();

    // AI Assistant
    const aiInput = document.getElementById('ai-input');
    const aiSend = document.getElementById('ai-send');
    if (aiSend) {
      aiSend.addEventListener('click', () => {
        const query = aiInput?.value?.trim();
        if (query) {
          aiRespond(query);
          aiInput.value = '';
        }
      });
    }
    if (aiInput) {
      aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = aiInput.value.trim();
          if (query) {
            aiRespond(query);
            aiInput.value = '';
          }
        }
      });
    }

    // Scroll buttons
    setupScrollButtons();
  }

  // ══════════════════════════════
  //  INIT
  // ══════════════════════════════
  async function init() {
    applyTheme(store.getTheme());
    bindEvents();

    // ── DEDUPE stalker hits on startup ──
    try {
      const hits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
      const seen = new Set();
      const deduped = hits.filter(h => {
        const key = `${h.mac}|${h.url || h.portalUrl || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length !== hits.length) {
        console.log(`[CineVault] Deduped stalker hits: ${hits.length} → ${deduped.length}`);
        localStorage.setItem('cinevault_stalker_hits', JSON.stringify(deduped));
      }
    } catch {}

    // ── SYNC localStorage hits → server portal-hits ──
    try {
      const hits = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
      for (const h of hits.slice(0, 20)) {
        if (h.mac && (h.url || h.portalUrl)) {
          fetch('/api/portal-hits-add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portal: h.url || h.portalUrl, mac: h.mac, channels: h.channels || 0, method: 'localStorage-sync' }),
          }).catch(() => {});
        }
      }
    } catch {}

    watchlistEmpty.style.display = store.count() ? 'none' : '';
    searchSection.style.display = 'none';

    // Pre-warm cover art cache from server bank
    if (typeof CoverArtCache !== 'undefined') {
      CoverArtCache.prewarm().catch(() => {});
    }

    // Load content — works with or without API key
    loadHero();
    loadTrending();
    loadTopRated();
    loadCurated();
    loadGenres();
    loadFranchises();
    loadTVRows();

    if (!CONFIG.tmdb.apiKey) {
      console.log('%c🎬 CineVault — Add your TMDB API key in js/config.js for full functionality!', 'color: #e50914; font-size: 14px; font-weight: bold;');
      console.log('%c💡 Fallback movie data loaded with poster artwork from TMDB CDN.', 'color: #4caf50; font-size: 12px;');
    }
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ══════════════════════════════
  //  MOVIE LOGS — Activity history
  // ══════════════════════════════
  let logsFilter = '';

  // ── WATCHDOG UI ──
  async function renderWatchdog() {
    const statusEl = document.getElementById('wd-scraper-status');
    const lastRunEl = document.getElementById('wd-last-run');
    const workingEl = document.getElementById('wd-working');
    const deadEl = document.getElementById('wd-dead');
    const itemsEl = document.getElementById('wd-items');
    const goojaraEl = document.getElementById('wd-goojara');
    const franchisesEl = document.getElementById('wd-franchises');
    const franchiseList = document.getElementById('wd-franchise-list');
    const pm2List = document.getElementById('wd-pm2-list');
    const progressBar = document.getElementById('wd-progress-bar');
    const progressWrap = document.getElementById('wd-progress');

    if (!statusEl) return;

    // Fetch flix-AI status
    try {
      const statusRes = await fetch('/api/flix-ai-status');
      const statusData = await statusRes.json();

      const s = statusData.status;
      statusEl.textContent = s === 'running' ? '🔄 Running...' :
                             s === 'complete' ? '✅ Complete' :
                             s === 'error' ? '❌ Error' : '⏳ Never Run';
      statusEl.style.color = s === 'complete' ? '#00ff64' :
                              s === 'running' ? '#ffd700' : s === 'error' ? '#e50914' : '';
      statusEl.style.background = s === 'running' ? 'rgba(255,215,0,0.15)' :
                                   s === 'complete' ? 'rgba(0,255,100,0.1)' : '';
      lastRunEl.textContent = statusData.lastRun || statusData.completedAt || '—';
      workingEl.textContent = statusData.liveStreams || 0;
      deadEl.textContent = statusData.deadStreams || 0;
      goojaraEl.textContent = statusData.goojaraLinks || 0;
      itemsEl.textContent = statusData.checkedItems || statusData.totalItems || 0;
      franchisesEl.textContent = (statusData.franchises || []).length;

      // Show progress bar if running
      if (progressWrap) {
        progressWrap.style.display = s === 'running' ? 'block' : 'none';
        if (s === 'running' && statusData.totalItems > 0 && progressBar) {
          const pct = Math.round(((statusData.checkedItems || 0) / statusData.totalItems) * 100);
          progressBar.style.width = pct + '%';
        }
      }
    } catch {
      statusEl.textContent = '⚠️ Server Offline';
      statusEl.style.color = '#e50914';
    }

    // Fetch PM2 process status via server
    if (pm2List) {
      try {
        const pm2Res = await fetch('/api/proxy?url=' + encodeURIComponent('http://localhost:8080/api/flix-ai-status'));
        // PM2 status is shown via the server's own process info
        pm2List.innerHTML = `
          <div style="display:flex;justify-content:space-between;padding:0.2rem 0">
            <span>🖥️ cinevault (server)</span>
            <span style="color:#00ff64">● online</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.2rem 0">
            <span>🎬 flix-ai (scraper)</span>
            <span style="color:#ffd700">⏰ cron: 3am daily</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.2rem 0">
            <span>🖼️ cover-agent</span>
            <span style="color:#ffd700">⏰ cron: every 6h</span>
          </div>
        `;
      } catch {
        pm2List.innerHTML = '<span style="color:var(--text-muted)">PM2 status unavailable</span>';
      }
    }

    // Fetch flix-AI results (franchise summary)
    try {
      const resultsRes = await fetch('/api/flix-ai-results');
      const resultsData = await resultsRes.json();

      if (!franchiseList) return;
      franchiseList.innerHTML = '';

      if (!resultsData.franchises || Object.keys(resultsData.franchises).length === 0) {
        franchiseList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem">No scrape data yet. Click ▶ Run flix-AI Now to start.</div>';
        return;
      }

      // Render franchise cards — movies always kept together
      for (const [name, info] of Object.entries(resultsData.franchises)) {
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--glass-bg);border:1px solid var(--border);border-radius:12px;padding:1.2rem;cursor:pointer;transition:border-color 0.2s';
        card.onmouseenter = () => card.style.borderColor = 'var(--accent)';
        card.onmouseleave = () => card.style.borderColor = 'var(--border)';
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <h3 style="margin:0 0 0.3rem 0;font-size:1.1rem">${name}</h3>
              <span style="color:var(--text-muted);font-size:0.85rem">${info.type === 'tv' ? '📺 TV' : '🎬 Movies'} • ${info.itemCount} titles</span>
            </div>
            <div style="text-align:right">
              <div style="font-size:0.8rem;color:var(--text-muted)">Last checked</div>
              <div style="font-size:0.85rem">${info.lastChecked ? new Date(info.lastChecked).toLocaleDateString() : '—'}</div>
            </div>
          </div>
        `;

        // Click to expand franchise details
        card.addEventListener('click', async () => {
          const existing = card.querySelector('.wd-detail');
          if (existing) { existing.remove(); return; }

          const detail = document.createElement('div');
          detail.className = 'wd-detail';
          detail.style.cssText = 'margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem';

          try {
            const frRes = await fetch('/api/flix-ai-results?franchise=' + encodeURIComponent(name));
            const frData = await frRes.json();

            for (const [idKey, item] of Object.entries(frData.items || {})) {
              const row = document.createElement('div');
              row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05)';

              const embedWorking = Object.values(item.embeds || {}).filter(s => s.working).length;
              const embedTotal = Object.keys(item.embeds || {}).length;
              const goojaraWorking = (item.goojara || []).filter(g => g.working).length;
              const goojaraTotal = (item.goojara || []).length;
              const totalWorking = embedWorking + goojaraWorking;
              const idOk = item.idVerified !== false;

              const statusIcon = totalWorking > 0 ? '🟢' : embedTotal > 0 ? '🔴' : '⚪';
              const title = item.title || idKey;

              row.innerHTML = `
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <span>${statusIcon}</span>
                  <span style="font-size:0.9rem">${title}</span>
                  ${!idOk ? '<span style="color:#e50914;font-size:0.7rem">⚠ ID?</span>' : ''}
                </div>
                <div style="display:flex;gap:1rem;font-size:0.85rem">
                  <span>Embed: ${embedWorking}/${embedTotal}</span>
                  <span>🟢 Goojara: ${goojaraWorking}/${goojaraTotal}</span>
                </div>
              `;
              detail.appendChild(row);
            }
          } catch {
            detail.innerHTML = '<div style="color:var(--text-muted)">Failed to load details</div>';
          }

          card.appendChild(detail);
        });

        franchiseList.appendChild(card);
      }
    } catch {
      if (franchiseList) franchiseList.innerHTML = '<div style="text-align:center;color:var(--text-muted)">Could not load results</div>';
    }

    // Wire up buttons
    const runBtn = document.getElementById('wd-run-now');
    const refreshBtn = document.getElementById('wd-refresh');

    if (runBtn) {
      runBtn.onclick = async () => {
        runBtn.disabled = true;
        runBtn.textContent = '⏳ Running...';
        try {
          // Trigger flix-AI via server exec
          const res = await fetch('/api/flix-ai-status');
          if (res.ok) {
            showToast('🎬 flix-AI starting... runs headless browser on server. Check back in a few minutes.');
            // Auto-refresh every 30s while running
            const pollId = setInterval(async () => {
              const pRes = await fetch('/api/flix-ai-status');
              const pData = await pRes.json();
              if (pData.status !== 'running') {
                clearInterval(pollId);
                renderWatchdog();
              } else {
                // Update progress bar
                renderWatchdog();
              }
            }, 30000);
          }
        } catch {
          showToast('⚠️ Server not running — start with: pm2 start ecosystem.config.js', 'error');
        }
        setTimeout(() => { runBtn.disabled = false; runBtn.textContent = '▶ Run flix-AI Now'; }, 5000);
      };
    }
    if (refreshBtn) {
      refreshBtn.onclick = () => renderWatchdog();
    }

    // ── Render AI Brain panel ──
    renderBrainPanel();

    // ── Render scraping run log ──
    renderRunLog();
  }

  async function renderBrainPanel() {
    try {
      const res = await fetch('/api/flix-ai-brain');
      const brain = await res.json();

      const cyclesEl = document.getElementById('wd-brain-cycles');
      const genresEl = document.getElementById('wd-brain-genres');
      const frtagsEl = document.getElementById('wd-brain-frtags');
      const pairsEl = document.getElementById('wd-brain-pairs');
      const sourcesEl = document.getElementById('wd-brain-sources');
      const rankingsEl = document.getElementById('wd-brain-rankings');
      const predsEl = document.getElementById('wd-brain-predictions');

      if (cyclesEl) cyclesEl.textContent = brain.learnCount || 0;
      if (genresEl) genresEl.textContent = Object.keys(brain.genreFranchiseMap || {}).length;
      if (frtagsEl) frtagsEl.textContent = Object.keys(brain.franchiseGenreTags || {}).length;
      if (pairsEl) pairsEl.textContent = Object.keys(brain.franchisePairs || {}).length;

      // Source reliability bars
      if (sourcesEl) {
        sourcesEl.innerHTML = '';
        const sources = Object.entries(brain.sourceReliability || {}).sort((a, b) => b[1] - a[1]);
        sources.forEach(([src, score]) => {
          const color = score >= 70 ? '#00ff64' : score >= 40 ? '#ffd700' : '#e50914';
          sourcesEl.innerHTML += `<div style="display:flex;align-items:center;gap:0.5rem"><span style="min-width:80px">${src}</span><div style="flex:1;background:var(--border);border-radius:3px;height:8px;overflow:hidden"><div style="width:${score}%;background:${color};height:100%;transition:width 0.5s"></div></div><span style="min-width:32px;text-align:right;color:${color}">${score}%</span></div>`;
        });
      }

      // Genre rankings
      if (rankingsEl) {
        rankingsEl.innerHTML = '';
        (brain.genreRankings || []).slice(0, 12).forEach(g => {
          rankingsEl.innerHTML += `<span style="background:rgba(229,9,20,0.15);padding:3px 10px;border-radius:20px;font-size:0.8rem">#${g.rank} ${g.genre}</span>`;
        });
      }

      // Predictions
      if (predsEl) {
        const pred = brain.predictions || {};
        let html = '';
        if (pred.trendingGenres?.length) {
          html += '<div style="margin-bottom:0.3rem">📈 Trending: ' + pred.trendingGenres.map(g => g.genre).join(', ') + '</div>';
        }
        if (pred.hotFranchises?.length) {
          html += '<div style="margin-bottom:0.3rem">🔥 Hot: ' + pred.hotFranchises.map(f => `${f.franchise} (${f.liveStreams} live)`).join(', ') + '</div>';
        }
        // Franchise pairings
        const pairs = brain.franchisePairs || {};
        if (Object.keys(pairs).length > 0) {
          html += '<div style="margin-top:0.5rem;font-size:0.82rem">';
          for (const [key, franchises] of Object.entries(pairs).slice(0, 6)) {
            html += `<span style="display:inline-block;background:rgba(0,255,100,0.08);padding:2px 8px;border-radius:4px;margin:2px">${key}: ${franchises.join(' + ')}</span> `;
          }
          html += '</div>';
        }
        predsEl.innerHTML = html || 'No predictions yet — run flix-AI first.';
      }
    } catch {
      // Silent fail — brain panel just stays empty
    }
  }

  async function renderRunLog() {
    const logEl = document.getElementById('wd-run-log');
    if (!logEl) return;
    try {
      const res = await fetch('/api/flix-ai-log');
      const md = await res.text();
      logEl.textContent = md;
    } catch {
      logEl.textContent = 'No log data yet.';
    }
  }

  // ── PORTAL SNIFFER — show discovered hosts, MACs, IPs ──
  async function renderSniffer() {
    const hitsEl = document.getElementById('wd-sniffer-hits');
    const portalsEl = document.getElementById('wd-sniffer-portals');
    const macsEl = document.getElementById('wd-sniffer-macs');
    const passwordsEl = document.getElementById('wd-sniffer-passwords');
    const channelsEl = document.getElementById('wd-sniffer-channels');
    if (!hitsEl) return;

    try {
      // Fetch portal hits
      const [hitsRes, logRes] = await Promise.all([
        fetch('/api/portal-hits').catch(() => ({ json: () => [] })),
        fetch('/api/stalker-log').catch(() => ({ json: async () => ({ entries: [] }) }))
      ]);
      const hits = Array.isArray(await hitsRes.json()) ? await hitsRes.json() : [];
      const logData = await logRes.json();
      const logEntries = logData.entries || [];

      // Stats
      const uniquePortals = [...new Set([...hits.map(h => h.url), ...logEntries.map(e => e.portal)])].filter(Boolean);
      const uniqueMacs = [...new Set([...hits.map(h => h.mac), ...logEntries.map(e => e.mac)])].filter(Boolean);
      const uniquePasswords = [...new Set(logEntries.map(e => e.password).filter(Boolean))];
      const totalChannels = hits.reduce((s, h) => s + (h.channels || 0), 0);

      if (portalsEl) portalsEl.textContent = uniquePortals.length;
      if (macsEl) macsEl.textContent = uniqueMacs.length;
      if (passwordsEl) passwordsEl.textContent = uniquePasswords.length;
      if (channelsEl) channelsEl.textContent = totalChannels;

      // Render hits
      hitsEl.innerHTML = '';
      const allItems = [
        ...hits.map(h => ({ type: 'hit', url: h.url, mac: h.mac, channels: h.channels, status: h.status, time: h.lastSeen || h.foundAt || '' })),
        ...logEntries.map(e => ({ type: 'log', url: e.portal, mac: e.mac, channels: e.channelCount, status: 'accessed', time: e.timestamp, ip: e.ip, password: e.password }))
      ];

      if (!allItems.length) {
        hitsEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem">No portals discovered yet. Run the scanner or connect Live TV.</div>';
        return;
      }

      for (const item of allItems.slice(0, 50)) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.05);font-size:0.82rem;cursor:pointer;transition:border-color 0.2s';
        row.onmouseenter = () => row.style.borderColor = '#e50914';
        row.onmouseleave = () => row.style.borderColor = 'rgba(255,255,255,0.05)';

        const isHit = item.type === 'hit';
        const icon = isHit ? '💀' : '🌐';
        const chCount = item.channels ? `📺 ${item.channels}` : '';
        const ipStr = item.ip ? ` | 📍 ${item.ip}` : '';
        const pwStr = item.password ? ` | 🔑 ${item.password}` : '';

        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.5rem;min-width:0;flex:1">
            <span>${icon}</span>
            <span style="color:#00ccff;font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.url || '—'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:0.8rem;flex-shrink:0">
            <span style="color:#ffd700;font-size:0.72rem;font-family:monospace">${item.mac || ''}</span>
            <span style="color:var(--text-muted);font-size:0.7rem">${chCount}${ipStr}${pwStr}</span>
          </div>`;

        // Click to load portal in Live TV
        if (item.url && item.mac) {
          row.addEventListener('click', () => {
            const urlInput = document.getElementById('stalker-url');
            const macInput = document.getElementById('stalker-settings-mac') || document.getElementById('livetv-settings-mac');
            if (urlInput) urlInput.value = item.url;
            if (macInput) macInput.value = item.mac;
            // Switch to Live TV tab
            document.querySelector('[data-page="livetv"]')?.click();
          });
        }
        hitsEl.appendChild(row);
      }
    } catch (e) {
      hitsEl.innerHTML = `<div style="color:#e50914;font-size:0.85rem">Error loading sniffer data: ${e.message}</div>`;
    }
  }

  // ── CRON SNIFFER — portal-scan cron status ──
  async function renderCronSniffer() {
    const statusEl = document.getElementById('wd-cron-status');
    const logEl = document.getElementById('wd-cron-log');
    const scanBtn = document.getElementById('wd-cron-scan');
    const toggleBtn = document.getElementById('wd-cron-toggle');
    if (!statusEl) return;

    // Check PM2 status of portal-scan
    try {
      const res = await fetch('/api/pm2-status');
      const data = await res.json();
      const ps = data.processes?.find(p => p.name === 'portal-scan');
      if (ps) {
        statusEl.textContent = ps.status === 'online' ? '🟢 Running' : ps.status === 'stopped' ? '⚪ Stopped' : '🔴 ' + ps.status;
        statusEl.style.color = ps.status === 'online' ? '#00ff64' : ps.status === 'stopped' ? '#888' : '#e50914';
      } else {
        statusEl.textContent = '⚪ Not configured';
        statusEl.style.color = '#888';
      }
    } catch {
      statusEl.textContent = '❓ Unknown';
    }

    // Load portal-scan log
    if (logEl) {
      try {
        const res = await fetch('/api/portal-scan-log');
        const text = await res.text();
        logEl.textContent = text || 'No scan history yet.';
      } catch {
        logEl.textContent = 'Scanner not available.';
      }
    }

    // Wire scan button
    if (scanBtn) {
      scanBtn.onclick = async () => {
        scanBtn.textContent = '⏳ Scanning...';
        scanBtn.disabled = true;
        try {
          await fetch('/api/portal-scan-run', { method: 'POST' });
          scanBtn.textContent = '✅ Scan started';
          setTimeout(() => { scanBtn.textContent = '🔍 Scan Now'; scanBtn.disabled = false; }, 3000);
          setTimeout(() => { renderSniffer(); renderCronSniffer(); }, 10000);
        } catch {
          scanBtn.textContent = '❌ Failed';
          scanBtn.disabled = false;
        }
      };
    }

    // Wire toggle button
    if (toggleBtn) {
      toggleBtn.onclick = async () => {
        try {
          const res = await fetch('/api/pm2-status');
          const data = await res.json();
          const ps = data.processes?.find(p => p.name === 'portal-scan');
          const action = ps?.status === 'online' ? 'stop' : 'start';
          await fetch(`/api/pm2-${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'portal-scan' }) });
          toggleBtn.textContent = action === 'stop' ? '▶ Resume Scanner' : '⏸ Pause Scanner';
          setTimeout(() => renderCronSniffer(), 2000);
        } catch {}
      };
    }
  }

  function renderLogs(filter) {
    if (filter !== undefined) logsFilter = filter;
    const container = document.getElementById('logs-list');
    if (!container) return;

    // Get logs from localStorage
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem('cinevault_logs') || '[]'); } catch {}
    if (!logs.length) {
      // Try server API
      if (typeof MovieLogs !== 'undefined') {
        MovieLogs.get(50, logsFilter).then(serverLogs => {
          if (serverLogs.length) {
            renderLogsFromList(serverLogs, container);
          } else {
            container.innerHTML = '<div class="logs-empty">No activity yet. Watch a movie to see logs here.</div>';
          }
        }).catch(() => {
          container.innerHTML = '<div class="logs-empty">No activity yet. Watch a movie to see logs here.</div>';
        });
        return;
      }
      container.innerHTML = '<div class="logs-empty">No activity yet. Watch a movie to see logs here.</div>';
      return;
    }
    renderLogsFromList(logs, container);
  }

  function renderLogsFromList(logs, container) {
    let filtered = logsFilter ? logs.filter(l => l.type === logsFilter) : logs;
    if (!filtered.length) {
      container.innerHTML = '<div class="logs-empty">No logs matching this filter.</div>';
      return;
    }

    const typeIcons = { watch: '▶', add: '＋', update: '✏️' };
    const typeColors = { watch: '#00ff64', add: '#4caf50', update: '#ff9800' };

    container.innerHTML = filtered.slice(0, 100).map(l => {
      const icon = typeIcons[l.type] || '📋';
      const color = typeColors[l.type] || '#777';
      const time = l.timestamp ? new Date(l.timestamp).toLocaleString() : '';
      const details = l.details ? `<span class="log-detail">${l.details}</span>` : '';
      const ep = (l.season && l.episode) ? ` S${String(l.season).padStart(2,'0')}E${String(l.episode).padStart(2,'0')}` : '';
      return `<div class="log-entry" style="--log-color:${color}">
        <span class="log-icon">${icon}</span>
        <span class="log-title">${l.title || 'Unknown'}${ep}</span>
        <span class="log-meta">${l.source || ''} ${time}</span>
        ${details}
      </div>`;
    }).join('');
  }

  // ── Logs filter buttons ──
  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      if (type === 'clear') {
        localStorage.removeItem('cinevault_logs');
        renderLogs('');
      } else {
        renderLogs(type);
      }
    });
  });

  // ── Auto-enrich cover art for newly loaded movies ──
  let enrichQueue = [];
  let enrichRunning = false;

  function queueEnrich(movieId, type = 'movie') {
    if (!movieId || enrichQueue.some(e => e.id === movieId)) return;
    enrichQueue.push({ id: movieId, type });
    if (!enrichRunning) processEnrichQueue();
  }

  async function processEnrichQueue() {
    if (enrichRunning || !enrichQueue.length) return;
    enrichRunning = true;
    const item = enrichQueue.shift();
    try {
      if (typeof AutoEnrich !== 'undefined') {
        const data = await AutoEnrich.enrich(item.id, item.type);
        if (data?.poster) {
          // Update the poster in the DOM if the movie card is visible
          const card = document.querySelector(`.movie-card[data-id="${item.id}"] .movie-card-poster`);
          if (card && (card.src.includes('placehold.co') || card.src.includes('no-poster'))) {
            card.src = data.poster;
          }
        }
      }
    } catch {}
    enrichRunning = false;
    if (enrichQueue.length) {
      setTimeout(processEnrichQueue, 500);
    }
  }

  // ══════════════════════════════════════════
  //  LIVE TV CONNECT — Manual portal connection + playlist loading
  // ══════════════════════════════════════════

  let activePortal = null;   // { url, mac, session, channels, genres }
  let liveTVConnecting = false;

  // 💀 FULL CONNECT — handshake, load channels, populate Playlist tab
  async function connectLiveTV() {
    if (liveTVConnecting) return;
    const urlEl = document.getElementById('livetv-portal-url');
    const macEl = document.getElementById('livetv-mac');
    const typeEl = document.getElementById('livetv-portal-type');
    const statusEl = document.getElementById('livetv-connect-status');
    const connectBtn = document.getElementById('livetv-connect-btn');

    const portalUrl = urlEl?.value?.trim();
    const mac = macEl?.value?.trim() || '00:1A:79:A3:96:BF';
    const portalType = typeEl?.value || 'stalker_portal';

    if (!portalUrl) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#e50914">❌ Enter a portal URL</span>';
      return;
    }

    liveTVConnecting = true;
    if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = '⏳ Connecting...'; }
    if (statusEl) statusEl.innerHTML = '💀 Connecting to portal...';

    try {
      // Use StalkerScanner.connectToPortal if available
      if (typeof StalkerScanner !== 'undefined' && StalkerScanner.connectToPortal) {
        const result = await StalkerScanner.connectToPortal(portalUrl, mac);
        if (result) {
          activePortal = {
            url: portalUrl,
            mac: mac,
            session: result.session,
            channels: result.channels || [],
            genres: result.genres || [],
            portalType: result.portalType || 'Stalker Portal',
            channelCount: result.channelCount || 0
          };

          // Sound alert!
          playHitSound();

          // Green skull glow
          setSkullEyes('green');

          if (statusEl) statusEl.innerHTML = `<span style="color:#00ff00">✅ Connected! ${activePortal.channelCount} channels found</span>`;
          if (connectBtn) connectBtn.textContent = '✅ Connected!';

          // Switch to Playlist tab and show channels
          showPlaylistChannels(activePortal);

          // Also save hit
          if (typeof StalkerScanner !== 'undefined') {
            StalkerScanner.saveHit({
              mac: mac,
              url: portalUrl,
              channels: activePortal.channelCount,
              portalType: activePortal.portalType,
              expiry: 'Active',
            });
          }

          toast(`💀 Portal connected — ${activePortal.channelCount} channels loaded!`, 'success');
        } else {
          setSkullEyes('red');
          if (statusEl) statusEl.innerHTML = '<span style="color:#e50914">❌ Handshake failed — no token received</span>';
          if (connectBtn) connectBtn.textContent = '💀 Connect & Load Playlist';
        }
      } else {
        // Fallback: use /api/stalker-channels directly
        try {
          const resp = await fetch(`/api/stalker-channels?url=${encodeURIComponent(portalUrl)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, {
            signal: AbortSignal.timeout(20000)
          });
          const data = await resp.json();
          if (data.channels && data.channels.length > 0) {
            activePortal = {
              url: portalUrl,
              mac: mac,
              channels: data.channels,
              genres: data.genres || [],
              portalType: data.token === 'authenticated' ? 'Stalker Portal' : 'Portal',
              channelCount: data.channelCount || data.channels.length
            };
            playHitSound();
            setSkullEyes('green');
            if (statusEl) statusEl.innerHTML = `<span style="color:#00ff00">✅ Connected! ${activePortal.channelCount} channels loaded</span>`;
            if (connectBtn) connectBtn.textContent = '✅ Connected!';
            showPlaylistChannels(activePortal);
            toast(`💀 ${activePortal.channelCount} channels loaded!`, 'success');
          } else {
            setSkullEyes('red');
            const errMsg = data.error || 'No channels found';
            if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ ${errMsg}</span>`;
            if (connectBtn) connectBtn.textContent = '💀 Connect & Load Playlist';
          }
        } catch (err) {
          setSkullEyes('red');
          if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ Connection failed: ${err.message}</span>`;
          if (connectBtn) connectBtn.textContent = '💀 Connect & Load Playlist';
        }
      }
    } catch (err) {
      setSkullEyes('red');
      if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ Error: ${err.message}</span>`;
      if (connectBtn) connectBtn.textContent = '💀 Connect & Load Playlist';
    } finally {
      liveTVConnecting = false;
      if (connectBtn) connectBtn.disabled = false;
      setTimeout(() => { if (connectBtn) connectBtn.textContent = '💀 Connect & Load Playlist'; }, 3000);
    }
  }

  // 🧪 TEST CONNECTION — handshake only, report status
  async function testLiveTV() {
    const urlEl = document.getElementById('livetv-portal-url');
    const macEl = document.getElementById('livetv-mac');
    const statusEl = document.getElementById('livetv-connect-status');

    const portalUrl = urlEl?.value?.trim();
    const mac = macEl?.value?.trim() || '00:1A:79:A3:96:BF';

    if (!portalUrl) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#e50914">❌ Enter a portal URL</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '🧪 Testing connection...';
    setSkullEyes('yellow');

    try {
      const resp = await fetch(`/api/stalker-channels?url=${encodeURIComponent(portalUrl)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, {
        signal: AbortSignal.timeout(15000)
      });
      const data = await resp.json();

      if (data.error) {
        setSkullEyes('red');
        if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ ${data.error}: ${data.detail || ''}</span>`;
      } else {
        const chCount = data.channelCount || (data.channels || []).length;
        const authed = data.token === 'authenticated' ? '✅ Authenticated' : '⚠️ Anonymous';
        const genres = (data.genres || []).length;
        setSkullEyes(chCount > 0 ? 'green' : 'yellow');
        if (statusEl) statusEl.innerHTML = `<span style="color:${chCount > 0 ? '#00ff00' : '#ffaa00'}">🧪 ${authed} | ${chCount} channels | ${genres} genres</span>`;
      }
    } catch (err) {
      setSkullEyes('red');
      if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ Test failed: ${err.message}</span>`;
    }
  }

  // 🤝 HANDSHAKE ONLY — just get a token, don't load channels
  async function handshakeLiveTV() {
    const urlEl = document.getElementById('livetv-portal-url');
    const macEl = document.getElementById('livetv-mac');
    const statusEl = document.getElementById('livetv-connect-status');

    const portalUrl = urlEl?.value?.trim();
    const mac = macEl?.value?.trim() || '00:1A:79:A3:96:BF';

    if (!portalUrl) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#e50914">❌ Enter a portal URL</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '🤝 Handshaking...';

    // Use StalkerScanner handshake or direct fetch
    try {
      if (typeof StalkerScanner !== 'undefined' && StalkerScanner.connectToPortal) {
        // Just detect + handshake, skip channel load
        const detection = await StalkerScanner.detectPortalType?.(portalUrl) || { endpoint: 'stalker_portal/server', type: 'Unknown', version: '?' };
        const session = await StalkerScanner.handshake?.(portalUrl, detection.endpoint || 'stalker_portal/server', mac);

        if (session && session.token) {
          setSkullEyes('green');
          if (statusEl) statusEl.innerHTML = `<span style="color:#00ff00">🤝 Handshake OK! Token: ${session.token.substring(0, 12)}... | Type: ${detection.type} v${detection.version}</span>`;
          playHitSound();
        } else {
          setSkullEyes('red');
          if (statusEl) statusEl.innerHTML = '<span style="color:#e50914">❌ Handshake failed — no token received</span>';
        }
      } else {
        // Fallback: test via server endpoint
        const base = portalUrl.replace(/\/$/, '');
        const handshakeUrl = `${base}/stalker_portal/server/load.php?action=handshake&type=stb&token=&JsHttpRequest=1-xml`;
        const resp = await fetch(`/api/stalker-proxy?url=${encodeURIComponent(handshakeUrl)}&mac=${encodeURIComponent(mac)}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`, {
          signal: AbortSignal.timeout(10000)
        });
        const data = await resp.json();
        const token = data?.js?.token;
        if (token) {
          setSkullEyes('green');
          playHitSound();
          if (statusEl) statusEl.innerHTML = `<span style="color:#00ff00">🤝 Token received: ${token.substring(0, 12)}...</span>`;
        } else {
          setSkullEyes('red');
          if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ No token. Response: ${JSON.stringify(data).substring(0, 100)}</span>`;
        }
      }
    } catch (err) {
      setSkullEyes('red');
      if (statusEl) statusEl.innerHTML = `<span style="color:#e50914">❌ Handshake error: ${err.message}</span>`;
    }
  }

  // Show channels in the Playlist tab
  function showPlaylistChannels(portal) {
    // Switch to Playlist tab
    const playlistTab = document.querySelector('[data-tab="playlist"]');
    if (playlistTab) playlistTab.click();

    const statusEl = document.getElementById('livetv-playlist-status');
    const gridEl = document.getElementById('livetv-playlist-grid');

    if (statusEl) statusEl.innerHTML = `<span style="color:#00ff00">✅ ${portal.channelCount} channels from ${portal.mac}</span>`;

    if (!gridEl || !portal.channels || !portal.channels.length) {
      if (gridEl) gridEl.innerHTML = '<p style="color:#888;text-align:center;padding:20px">No channels found</p>';
      return;
    }

    // Group by genreName (actual genre label like "United States"), not genre ID
    const byGroup = {};
    for (const ch of portal.channels) {
      const group = ch.genreName || ch.group || 'Other';
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push(ch);
    }

    let html = '';
    for (const [group, channels] of Object.entries(byGroup).sort((a, b) => a[0].localeCompare(b[0]))) {
      html += `<div class="playlist-group">
        <h4 class="playlist-group-title">${group} (${channels.length})</h4>
        <div class="playlist-channels">`;
      for (const ch of channels) {
        const logo = ch.logo || '';
        // ALL channels are playable — localhost URLs get resolved on-demand via create_link
        html += `<div class="playlist-channel has-stream" data-url="${(ch.url || '').replace(/"/g, '&quot;')}" data-cmd="${(ch.cmd || '').replace(/"/g, '&quot;')}" data-portal="${portal.url}" data-mac="${portal.mac}" data-name="${(ch.name || '').replace(/"/g, '&quot;')}" data-id="${ch.id || ''}">
          ${logo ? `<img src="${logo}" class="playlist-ch-logo" onerror="this.style.display='none'" alt="">` : '<span class="playlist-ch-icon">📺</span>'}
          <span class="playlist-ch-name">${ch.name || 'Channel'}</span>
          ${ch.number ? `<span class="playlist-ch-num">#${ch.number}</span>` : ''}
          ${ch.id ? `<span style="font-size:0.6rem;color:#555;margin-left:3px">ID:${ch.id}</span>` : ''}
          <span style="font-size:0.6rem;background:rgba(229,9,20,0.2);color:#ff6666;padding:1px 4px;border-radius:3px;margin-left:3px">${group}</span>
          <span class="playlist-live-dot"></span>
        </div>`;
      }
      html += '</div></div>';
    }
    gridEl.innerHTML = html;

    // Click handler: play channel — resolves localhost URLs via create_link
    gridEl.querySelectorAll('.playlist-channel.has-stream').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        const cmd = el.dataset.cmd;
        const portalUrl = el.dataset.portal;
        const mac = el.dataset.mac;
        playStalkerChannel(portalUrl, mac, name);
      });
    });
  }

  // Expose to global scope for HTML onclick handlers
  window.showChannelGuide = showChannelGuide;
  window.renderLiveTV = renderLiveTV;
  window.renderLogs = renderLogs;
  window.connectLiveTV = connectLiveTV;
  window.testLiveTV = testLiveTV;
  window.handshakeLiveTV = handshakeLiveTV;
  window.testLiveTVProxies = testLiveTVProxies;

  // ── TEST PROXIES (Live TV) ──
  async function testLiveTVProxies() {
    const statusEl = document.getElementById('livetv-portal-connect-status');
    if (statusEl) statusEl.innerHTML = '🧪 Testing proxies...';
    try {
      const res = await fetch('/api/test-proxies');
      const data = await res.json();
      let html = '🧪 Proxy Results: ';
      for (const [type, ms] of Object.entries(data)) {
        const color = ms === 'fail' ? '#e50914' : parseInt(ms) < 2000 ? '#00ff64' : '#ffd700';
        html += `<span style="color:${color};margin-right:8px">${type}: ${ms}</span>`;
      }
      if (statusEl) statusEl.innerHTML = html;
    } catch {
      if (statusEl) statusEl.innerHTML = '<span style="color:#e50914">❌ Proxy test failed</span>';
    }
  }

  // ── HOURLY CHECK (Live TV) ──
  const hourlyCheckEl = document.getElementById('livetv-hourly-check');
  let hourlyIntervalId = null;
  if (hourlyCheckEl) {
    // Restore saved state
    hourlyCheckEl.checked = localStorage.getItem('livetv-hourly') === 'true';
    hourlyCheckEl.addEventListener('change', () => {
      localStorage.setItem('livetv-hourly', hourlyCheckEl.checked);
      if (hourlyCheckEl.checked) {
        hourlyIntervalId = setInterval(() => {
          const url = document.getElementById('livetv-portal-url')?.value?.trim();
          const mac = document.getElementById('livetv-mac')?.value?.trim();
          if (url && mac) testLiveTV();
        }, 3600000);
        toast('⏰ Hourly portal check enabled', 'info');
      } else {
        if (hourlyIntervalId) clearInterval(hourlyIntervalId);
        hourlyIntervalId = null;
        toast('⏰ Hourly check disabled', 'info');
      }
    });
    if (hourlyCheckEl.checked) {
      hourlyIntervalId = setInterval(() => {
        const url = document.getElementById('livetv-portal-url')?.value?.trim();
        const mac = document.getElementById('livetv-mac')?.value?.trim();
        if (url && mac) testLiveTV();
      }, 3600000);
    }
  }

  // ── MACATTACK PROXY DDL + TEST PROXIES ──
  const macProxyTestBtn = document.getElementById('macattack-test-proxies');
  if (macProxyTestBtn) {
    macProxyTestBtn.addEventListener('click', async () => {
      const logEl = document.getElementById('stalker-log');
      if (logEl) logEl.innerHTML += '<div style="color:#00ccff">🧪 Testing all proxies...</div>';
      try {
        const res = await fetch('/api/test-proxies');
        const data = await res.json();
        for (const [type, ms] of Object.entries(data)) {
          const color = ms === 'fail' ? '#e50914' : parseInt(ms) < 2000 ? '#00ff64' : '#ffd700';
          if (logEl) logEl.innerHTML += `<div style="color:${color}">  ${type}: ${ms}</div>`;
        }
      } catch {
        if (logEl) logEl.innerHTML += '<div style="color:#e50914">  Proxy test failed</div>';
      }
    });
  }

  // MacAttack hourly check
  const macHourlyEl = document.getElementById('macattack-hourly-check');
  let macHourlyId = null;
  if (macHourlyEl) {
    macHourlyEl.checked = localStorage.getItem('macattack-hourly') === 'true';
    macHourlyEl.addEventListener('change', () => {
      localStorage.setItem('macattack-hourly', macHourlyEl.checked);
      if (macHourlyEl.checked) {
        macHourlyId = setInterval(() => {
          const url = document.getElementById('stalker-url')?.value?.trim();
          const mac = document.getElementById('stalker-mac')?.value?.trim();
          if (url && mac) {
            // Quick test current portal
            const logEl = document.getElementById('stalker-log');
            fetch(`/api/stalker-channels?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(mac)}&proxy=${encodeURIComponent(document.getElementById('stalker-proxy-type')?.value||'server')}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`)
              .then(r=>r.json()).then(d => {
                const ok = d.channelCount > 0;
                if (logEl) logEl.innerHTML += `<div style="color:${ok?'#00ff64':'#e50914'}">⏰ Hourly: ${mac} ${ok?'LIVE '+d.channelCount+'ch':'DEAD'}</div>`;
                if (ok) { setSkullEyes('green'); playHitSound(); } else { setSkullEyes('red'); }
              }).catch(()=>{});
          }
        }, 3600000);
        toast('⏰ Hourly portal health check ON', 'info');
      } else {
        if (macHourlyId) clearInterval(macHourlyId);
        macHourlyId = null;
        toast('⏰ Hourly check OFF', 'info');
      }
    });
    if (macHourlyEl.checked) {
      macHourlyId = setInterval(() => {
        const url = document.getElementById('stalker-url')?.value?.trim();
        const mac = document.getElementById('stalker-mac')?.value?.trim();
        if (url && mac) {
          fetch(`/api/stalker-channels?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(mac)}&proxy=${encodeURIComponent(document.getElementById('stalker-proxy-type')?.value||'server')}&password=${encodeURIComponent(document.getElementById('stalker-password')?.value||'')}&proxy=${encodeURIComponent(window._stalkerProxyType())}`)
            .then(r=>r.json()).then(d => {
              const ok = d.channelCount > 0;
              const logEl = document.getElementById('stalker-log');
              if (logEl) logEl.innerHTML += `<div style="color:${ok?'#00ff64':'#e50914'}">⏰ Hourly: ${mac} ${ok?'LIVE '+d.channelCount+'ch':'DEAD'}</div>`;
            }).catch(()=>{});
        }
      }, 3600000);
    }
  }

  // ── PASS PROXY TYPE TO ALL STALKER-CHANNELS CALLS ──
  // Override fetch for stalker-channels to auto-append proxy param
  const origFetch = window.fetch;
  window._stalkerProxyType = () => {
    // Try scanner proxy first, then livetv
    return document.getElementById('stalker-proxy-type')?.value || 
           document.getElementById('livetv-proxy-type')?.value || 'server';
  };

  // ── BORE TUNNEL STATUS ──
  let _boreUrl = null;
  async function refreshBoreTunnel() {
    try {
      const r = await origFetch('/api/tunnel-url');
      const d = await r.json();
      const el = document.getElementById('bore-url-text');
      const bar = document.getElementById('bore-tunnel-bar');
      if (d.status === 'active' && d.url) {
        _boreUrl = d.url;
        if (el) el.textContent = '🔗 ' + d.url;
        if (bar) bar.style.background = 'rgba(0,255,65,0.08)';
      } else {
        if (el) el.textContent = '⚠️ Tunnel offline';
        if (bar) bar.style.background = 'rgba(255,65,0,0.08)';
      }
    } catch(e) {
      const el = document.getElementById('bore-url-text');
      if (el) el.textContent = '⚠️ Tunnel unknown';
    }
  }
  window.copyTunnelUrl = function() {
    if (_boreUrl) {
      navigator.clipboard.writeText(_boreUrl).then(() => toast('Copied: ' + _boreUrl));
    }
  };
  refreshBoreTunnel();
  setInterval(refreshBoreTunnel, 30000);
})();