// ── CineVault Store ──
// Persistent localStorage: watchlist + watch progress + resume state

const STORE_KEY = 'cinevault_watchlist';
const THEME_KEY = 'cinevault_theme';
const PROGRESS_KEY = 'cinevault_progress';
const RESUME_KEY = 'cinevault_resume';

class Store {
  constructor() {
    this._watchlist = this._load(STORE_KEY, []);
    this._progress = this._load(PROGRESS_KEY, {});
    this._listeners = [];
  }

  _load(key, fallback) {
    try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
    catch { return fallback; }
  }

  _save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }

  _notify() { this._listeners.forEach(fn => fn(this._watchlist)); }

  onChange(fn) { this._listeners.push(fn); fn(this._watchlist); }

  // ── Watchlist ──
  getAll() { return [...this._watchlist]; }
  has(id) { return this._watchlist.some(m => m.id === id); }

  add(movie) {
    if (this.has(movie.id)) return false;
    this._watchlist.unshift({
      id: movie.id,
      title: movie.title || movie.name,
      poster: movie.poster_path,
      rating: movie.vote_average,
      year: (movie.release_date || movie.first_air_date || '').slice(0, 4),
      type: movie.media_type || (movie.first_air_date ? 'tv' : 'movie'),
      addedAt: Date.now()
    });
    this._save(STORE_KEY, this._watchlist);
    this._notify();
    return true;
  }

  remove(id) {
    const before = this._watchlist.length;
    this._watchlist = this._watchlist.filter(m => m.id !== id);
    if (this._watchlist.length < before) { this._save(STORE_KEY, this._watchlist); this._notify(); return true; }
    return false;
  }

  toggle(movie) {
    if (this.has(movie.id)) { this.remove(movie.id); return false; }
    this.add(movie); return true;
  }

  count() { return this._watchlist.length; }

  // ── Watch Progress (auto-save & resume) ──
  saveProgress(id, season, episode, source, percent) {
    const key = `${id}_${season}_${episode}`;
    this._progress[key] = {
      id, season: parseInt(season), episode: parseInt(episode),
      source, percent: Math.min(percent, 100),
      timestamp: Date.now()
    };
    this._save(PROGRESS_KEY, this._progress);
  }

  getProgress(id, season, episode) {
    const key = `${id}_${season}_${episode}`;
    return this._progress[key] || null;
  }

  // Get last watched item overall
  getLastWatched() {
    const all = Object.values(this._progress);
    if (!all.length) return null;
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all[0];
  }

  // Get all progress for a show/movie
  getProgressFor(id) {
    return Object.values(this._progress).filter(p => p.id === id);
  }

  // ── Resume state (what was playing when user left) ──
  saveResume(id, season, episode, source, title, type) {
    this._save(RESUME_KEY, { id, season, episode, source, title, type, timestamp: Date.now() });
  }

  getResume() {
    try { return JSON.parse(localStorage.getItem(RESUME_KEY)); } catch { return null; }
  }

  clearResume() {
    try { localStorage.removeItem(RESUME_KEY); } catch {}
  }

  // ── Theme ──
  getTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }
  setTheme(t) { localStorage.setItem(THEME_KEY, t); }
}

const store = new Store();