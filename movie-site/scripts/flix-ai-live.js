// flix-ai-live.js
// Resolves a live stream URL from stalker portal for a given channel
// Called after portal auth to get the actual playable HLS link
// CJS module — uses node-fetch (already installed)

const fetch = require('node-fetch');

async function getLiveStream(mac, portalUrl, channelId, token) {
  // Normalize base URL
  let base = portalUrl.replace(/\/+$/, '');
  if (!base.includes('/stalker_portal') && !base.includes('/portal.php')) {
    base = base + '/stalker_portal/server/load.php';
  }

  const url = `${base}?type=itv&action=create_link&cmd=${encodeURIComponent(channelId)}&JsHttpRequest=1-xml`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Cookie': `mac=${mac}; token=${token}`,
      'Authorization': `Bearer ${token}`,
      'Accept': '*/*',
    },
    timeout: 15000,
  });

  const data = await res.json();
  return data?.js?.cmd || null; // actual HLS stream URL
}

module.exports = { getLiveStream };