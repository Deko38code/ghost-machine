#!/usr/bin/env node
/**
 * stalker-to-m3u — Stalker portal to M3U extractor
 *
 * Usage:
 *   stalker-to-m3u generate m3u iptv --portal-url http://portal --mac 00:1A:78:XX:XX:XX
 *   stalker-to-m3u generate m3u iptv --portal-url http://portal --mac 00:1A:78:XX:XX:XX --output channels.m3u
 *   stalker-to-m3u generate m3u iptv --portal-url http://portal --mac 00:1A:78:XX:XX:XX --play
 *   stalker-to-m3u generate m3u iptv --portal-url http://portal --mac 00:1A:78:XX:XX:XX --cache 5000
 */

const axios = require('axios');
const { program } = require('commander');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class StalkerClient {
  constructor(portalUrl, mac) {
    this.portalUrl = portalUrl.replace(/\/+$/, '');
    this.mac = mac.toUpperCase();
    this.baseUrl = `${this.portalUrl}/stalker_portal/server/load.php`;

    const raw = this.mac.replace(/:/g, '');
    this.deviceId = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();
    this.serial = Array.from({ length: 13 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
    this.token = null;
  }

  get cookies() {
    return {
      mac: this.mac,
      serial: this.serial,
      device_id: this.deviceId,
      device_id2: this.deviceId,
    };
  }

  async handshake() {
    const params = {
      type: 'account_info',
      action: 'get_main_info',
      JsHttpRequest: '1-xml',
    };

    const res = await axios.get(this.baseUrl, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        Referer: `${this.portalUrl}/c/`,
      },
      cookies: this.cookies,
      timeout: 15000,
    });

    const js = res.data?.js;
    if (!js?.token) {
      throw new Error(`Handshake failed — no token in response: ${JSON.stringify(res.data).slice(0, 200)}`);
    }

    this.token = js.token;
    return this.token;
  }

  async getChannels() {
    const params = {
      type: 'itv',
      action: 'get_all_channels',
      JsHttpRequest: '1-xml',
    };

    const res = await axios.get(this.baseUrl, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        Referer: `${this.portalUrl}/c/`,
        Cookie: Object.entries({ ...this.cookies, token: this.token })
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
      timeout: 30000,
    });

    const channels = res.data?.js?.data || res.data?.js?.channels || [];
    return channels;
  }

  async createLink(channel) {
    const chCmd = channel.cmd || '';
    const chId = channel.id || channel.channel_id || channel.number;

    const params = {
      type: 'itv',
      action: 'create_link',
      JsHttpRequest: '1-xml',
    };

    const formData = new URLSearchParams();
    formData.append('cmd', chCmd);
    formData.append('type', 'itv');
    formData.append('uid', String(chId));

    const res = await axios.post(this.baseUrl, formData.toString(), {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        Referer: `${this.portalUrl}/c/`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: Object.entries({ ...this.cookies, token: this.token })
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
      timeout: 15000,
    });

    const js = res.data?.js || {};
    const cmd = js.cmd || '';

    // Extract URL from the cmd string
    const urlMatch = cmd.match(/https?:\/\/[^\s"'<>]+/);
    return urlMatch ? urlMatch[0] : (cmd.startsWith('http') ? cmd : null);
  }
}

async function generateM3U(portalUrl, mac, options = {}) {
  const { output: outputFile, cache = 5000, play = false } = options;

  console.log(`[*] Connecting to portal: ${portalUrl}`);
  console.log(`[*] Using MAC: ${mac}`);

  const client = new StalkerClient(portalUrl, mac);

  // Handshake
  try {
    await client.handshake();
    console.log('[+] Handshake OK — token acquired');
  } catch (err) {
    console.error(`[-] Handshake failed: ${err.message}`);
    process.exit(1);
  }

  // Get channels
  let channels;
  try {
    channels = await client.getChannels();
    console.log(`[+] Found ${channels.length} channels`);
  } catch (err) {
    console.error(`[-] Failed to fetch channels: ${err.message}`);
    process.exit(1);
  }

  if (channels.length === 0) {
    console.error('[-] No channels found');
    process.exit(1);
  }

  // Resolve stream URLs
  const lines = ['#EXTM3U'];
  let resolved = 0;
  let failed = 0;

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const name = ch.name || `Channel ${i + 1}`;
    process.stdout.write(`  [${i + 1}/${channels.length}] ${name}... `);

    try {
      const url = await client.createLink(ch);
      if (url) {
        lines.push(`#EXTINF:-1,${name}`);
        lines.push(url);
        resolved++;
        console.log('OK');
      } else {
        failed++;
        console.log('NO URL');
      }
    } catch (err) {
      failed++;
      console.log(`FAILED (${err.message.slice(0, 40)})`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n[*] Resolved: ${resolved} / ${channels.length} (${failed} failed)`);

  // Write M3U
  const m3uContent = lines.join('\n');
  const m3uFile = outputFile || `stalker_${mac.replace(/:/g, '')}.m3u`;
  const outPath = path.resolve(m3uFile);
  fs.writeFileSync(outPath, m3uContent);
  console.log(`[+] M3U saved: ${outPath}`);

  // Optionally launch VLC
  if (play) {
    const vlcScript = path.resolve(__dirname, 'vlc-stalker.sh');
    const vlcArgs = [String(cache), outPath];

    console.log(`[+] Launching VLC via vlc-stalker.sh (cache=${cache}ms)...`);

    const useScript = fs.existsSync(vlcScript);
    const cmd = useScript ? vlcScript : 'vlc';
    const args = useScript
      ? vlcArgs
      : [`--network-caching=${cache}`, `--live-caching=${cache}`, `--file-caching=${cache}`, '--no-video-title-show', outPath];

    const vlc = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    vlc.unref();
    console.log(`[+] VLC launched (PID ${vlc.pid})`);
  }

  return outPath;
}

async function quickFetch(portalUrl, mac, options = {}) {
  /** Hit the portal's built-in M3U endpoint — no handshake needed. */
  const { output: outputFile, cache = 5000, play = false } = options;
  const url = `${portalUrl.replace(/\/+$/, '')}/stalker_portal/server/tools/m3u.php?mac=${encodeURIComponent(mac)}`;

  console.log(`[*] Fetching M3U: ${url}`);

  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000,
    responseType: 'text',
  });

  if (!res.data || !res.data.includes('#EXTM3U')) {
    console.error('[-] Response is not a valid M3U playlist');
    process.exit(1);
  }

  const lines = res.data.trim().split('\n');
  const channels = lines.filter(l => l.startsWith('#EXTINF')).length;
  console.log(`[+] Got M3U with ${channels} channels`);

  const m3uFile = outputFile || `stalker_${mac.replace(/:/g, '')}.m3u`;
  const outPath = path.resolve(m3uFile);
  fs.writeFileSync(outPath, res.data);
  console.log(`[+] M3U saved: ${outPath}`);

  if (play) {
    const vlcScript = path.resolve(__dirname, '..', 'vlc-stalker.sh');
    const useScript = fs.existsSync(vlcScript);
    const cmd = useScript ? vlcScript : 'vlc';
    const args = useScript
      ? [String(cache), outPath]
      : [`--network-caching=${cache}`, `--live-caching=${cache}`, `--file-caching=${cache}`, '--no-video-title-show', outPath];

    console.log(`[+] Launching VLC ${useScript ? 'via vlc-stalker.sh' : ''} (cache=${cache}ms)...`);
    const vlc = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    vlc.unref();
    console.log(`[+] VLC launched (PID ${vlc.pid})`);
  }

  return outPath;
}

// CLI
program
  .name('stalker-to-m3u')
  .description('Stalker portal to M3U extractor — MacAttack companion');

program
  .command('generate')
  .description('Generate M3U playlist from Stalker portal (full handshake)')
  .argument('format', 'Output format (m3u)')
  .argument('type', 'Content type (iptv)')
  .requiredOption('--portal-url <url>', 'Stalker portal URL')
  .requiredOption('--mac <mac>', 'MAC address')
  .option('--output <file>', 'Output M3U file path')
  .option('--cache <ms>', 'VLC cache in milliseconds', '5000')
  .option('--play', 'Auto-play in VLC after generation')
  .action(async (format, type, opts) => {
    if (format !== 'm3u') {
      console.error(`[-] Unsupported format: ${format}. Use 'm3u'.`);
      process.exit(1);
    }
    await generateM3U(opts.portalUrl, opts.mac, {
      output: opts.output,
      cache: parseInt(opts.cache, 10),
      play: opts.play,
    });
  });

program
  .command('fetch')
  .description('Quick-fetch M3U from portal endpoint (no handshake)')
  .requiredOption('--portal-url <url>', 'Stalker portal URL')
  .requiredOption('--mac <mac>', 'MAC address')
  .option('--output <file>', 'Output M3U file path')
  .option('--cache <ms>', 'VLC cache in milliseconds', '5000')
  .option('--play', 'Auto-play in VLC after fetch')
  .action(async (opts) => {
    await quickFetch(opts.portalUrl, opts.mac, {
      output: opts.output,
      cache: parseInt(opts.cache, 10),
      play: opts.play,
    });
  });

program.parse();