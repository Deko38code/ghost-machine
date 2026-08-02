// flix-ai-preview.js
// Stalker portal preview — authenticates, loads channel list
// Used by flix-ai to pull live TV channel data from stalker portals
// CJS module — uses node-fetch (already installed)

const fetch = require('node-fetch');
const crypto = require('crypto');
const EventEmitter = require('events');

const flixBus = new EventEmitter();

class FlixAIPortal {
  constructor({ mac, portalUrl }) {
    this.mac = mac;
    this.portalUrl = portalUrl;
    this.token = null;
    this.channels = [];
  }

  // Authenticate with stalker portal — get auth token
  async login() {
    // Normalize URL for /stalker_portal format
    let base = this.portalUrl.replace(/\/+$/, '');
    if (!base.includes('/stalker_portal') && !base.includes('/portal.php')) {
      base = base + '/stalker_portal/server/load.php';
    }
    this.base = base;

    const serialNum = crypto.createHash('md5').update(this.mac).digest('hex').substring(0, 13).toUpperCase();
    const deviceId = crypto.createHash('sha256').update(serialNum).digest('hex').toUpperCase();
    const deviceId2 = crypto.createHash('sha256').update(this.mac).digest('hex').toUpperCase();

    const handshakeUrl = `${base}?action=handshake&type=stb&token=&JsHttpRequest=1-xml`;

    const res = await fetch(handshakeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'Cookie': `mac=${this.mac}; sn=${serialNum}; device_id=${deviceId}; device_id2=${deviceId2}`,
        'Accept': '*/*',
      },
      timeout: 15000,
    });

    const data = await res.json();
    this.token = data?.js?.token || '';
    flixBus.emit('auth', { ok: !!this.token, token: this.token, mac: this.mac, portal: this.portalUrl });
    return this.token;
  }

  // Load all channels from portal
  async loadChannels() {
    if (!this.token) throw new Error('Not authenticated — call login() first');

    const serialNum = crypto.createHash('md5').update(this.mac).digest('hex').substring(0, 13).toUpperCase();
    const deviceId = crypto.createHash('sha256').update(serialNum).digest('hex').toUpperCase();
    const deviceId2 = crypto.createHash('sha256').update(this.mac).digest('hex').toUpperCase();

    const headers = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Cookie': `mac=${this.mac}; sn=${serialNum}; device_id=${deviceId}; device_id2=${deviceId2}; token=${this.token}`,
      'Authorization': `Bearer ${this.token}`,
      'Accept': '*/*',
    };

    // Get genres first for group names
    let genreMap = {};
    try {
      const genresUrl = `${this.base}?type=itv&action=get_genres&JsHttpRequest=1-xml`;
      const genresRes = await fetch(genresUrl, { headers, timeout: 10000 });
      const genresData = await genresRes.json();
      const rawGenres = genresData?.js?.data || genresData?.js || [];
      for (const g of (Array.isArray(rawGenres) ? rawGenres : [])) {
        genreMap[String(g.id || g.number)] = g.title || g.name || 'Other';
      }
    } catch (e) { /* genres optional */ }

    // Get all channels
    const allChUrl = `${this.base}?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
    const chRes = await fetch(allChUrl, { headers, timeout: 20000 });
    const chData = await chRes.json();
    const rawChannels = chData?.js?.data || [];

    this.channels = rawChannels.map(ch => {
      const genreId = ch.tv_genre_id || ch.genre || '';
      return {
        id: ch.id,
        name: ch.name || '',
        number: ch.number || 0,
        logo: ch.logo || '',
        group: genreId,
        genreName: genreMap[String(genreId)] || 'Uncategorized',
        cmd: ch.cmd || '',
        url: ch.cmd || ch.url || '',
        type: ch.video_codec || 'live',
        open: ch.open || 0,
      };
    }).filter(ch => ch.id && ch.name);

    flixBus.emit('channels', { portal: this.portalUrl, mac: this.mac, channels: this.channels });
    return this.channels;
  }
}

module.exports = { FlixAIPortal, flixBus };