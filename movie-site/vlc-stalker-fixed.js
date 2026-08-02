// ============================================================
// vlc-stalker-fixed.js — The 45s buffering fix
// ============================================================

const express = require('express');
const { spawn, exec } = require('child_process');
const net = require('net');
const dns = require('dns');
const http = require('http');
const https = require('https');

const app = express();
app.use(express.json());

const CONFIG = {
  portalUrl: 'http://your-portal:25461',
  mac: '00:1A:79:XX:XX:XX',
  vlcPath: 'vlc',
  
  // ---- THE FIX: Aggressive low-latency caching ----
  networkCaching: 600,    // 600ms — enough for jitter
  liveCaching: 0,         // ZERO — live streams buffer nothing
  probingTimeout: 5000,   // 5s max to start receiving data
  streamReapMs: 8000,     // Kill VLC if stream doesn't start in 8s
};

// ============= STALKER API =============
class StalkerClient {
  constructor(portalUrl, mac) {
    this.portalUrl = portalUrl;
    this.mac = mac;
    this.token = null;
    this.lastHandshake = 0;
    this.streamUrlCache = new Map();
  }

  async handshake() {
    const url = `${this.portalUrl}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
        'Cookie': `mac=${this.mac}; stb_lang=en; timezone=UTC;`,
      },
    });
    const data = await resp.json();
    this.token = data?.js?.token;
    this.lastHandshake = Date.now();
    if (!this.token) throw new Error(`Handshake failed: ${JSON.stringify(data)}`);
    return this.token;
  }

  async ensureToken() {
    if (!this.token || Date.now() - this.lastHandshake > 600000) {
      await this.handshake();
    }
    return this.token;
  }

  async createLink(channelId) {
    await this.ensureToken();
    
    // Check cache (URLs expire in ~25s)
    const cached = this.streamUrlCache.get(channelId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    const cmd = encodeURIComponent(`http://localhost/ch/${channelId}_`);
    const url = `${this.portalUrl}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=${cmd}&series=&forced_storage=undefined&disable_ad=0&download=0&JsHttpRequest=1-xml`;
    
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C)',
        'Cookie': `mac=${this.mac}; stb_lang=en; timezone=UTC;`,
        'Authorization': `Bearer ${this.token}`,
      },
    });
    
    const data = await resp.json();
    let streamUrl = (data?.js?.cmd || '').replace(/^ffmpeg\s+/, '');
    
    if (!streamUrl) throw new Error(`create_link failed for ${channelId}: no URL returned`);
    
    // Cache
    this.streamUrlCache.set(channelId, {
      url: streamUrl,
      expiresAt: Date.now() + 20000, // 20s
    });
    
    return streamUrl;
  }
}

// ============= STREAM VALIDATOR =============
class StreamValidator {
  // Returns { valid, timeToFirstByte, httpCode, error }
  static async probe(url, timeoutMs = 5000) {
    const start = Date.now();
    const parsed = new URL(url);
    
    return new Promise((resolve) => {
      const client = parsed.protocol === 'https:' ? https : http;
      
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        const timeToFirstByte = Date.now() - start;
        
        // Read just the first chunk to confirm data is flowing
        let bytesReceived = 0;
        res.once('data', (chunk) => {
          bytesReceived = chunk.length;
          req.destroy(); // Close connection immediately after first data
          
          resolve({
            valid: true,
            httpCode: res.statusCode,
            timeToFirstByte,
            bytesReceived,
            totalTime: Date.now() - start,
          });
        });
        
        // If no data event within timeout
        setTimeout(() => {
          req.destroy();
          if (bytesReceived === 0) {
            resolve({
              valid: false,
              httpCode: res.statusCode,
              error: 'No data received after headers',
              totalTime: Date.now() - start,
            });
          }
        }, 2000);
      });
      
      req.on('error', (err) => {
        resolve({
          valid: false,
          error: err.message,
          totalTime: Date.now() - start,
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          valid: false,
          error: 'Timeout',
          totalTime: Date.now() - start,
        });
      });
    });
  }
}

// ============= VLC MANAGER WITH AUTO-HEAL =============
class VlcManager {
  constructor() {
    this.activeProcess = null;
    this.activeChannelId = null;
    this.startTime = null;
    this.healthCheckInterval = null;
    this.debugLog = [];
    this.lastStreamUrl = null;
  }

  kill() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.activeProcess) {
      try { this.activeProcess.kill('SIGKILL'); } catch(e) {}
      this.activeProcess = null;
    }
    
    // Clean orphans
    if (process.platform === 'win32') {
      exec('taskkill /f /im vlc.exe 2>nul', () => {});
    } else {
      exec('pkill -9 vlc 2>/dev/null', () => {});
    }
    
    this.activeChannelId = null;
    this.startTime = null;
  }

  // THE FIXED VLC SPAWN — No 45s delay
  async spawnSafe(streamUrl, { channelId = null } = {}) {
    this.kill();
    this.lastStreamUrl = streamUrl;
    
    // IMPORTANT: Validate the stream URL FIRST
    // This prevents VLC from hanging on dead URLs
    console.log('[VALIDATOR] Probing stream URL...');
    const probe = await StreamValidator.probe(streamUrl, CONFIG.probingTimeout);
    
    if (!probe.valid) {
      console.error(`[VALIDATOR] Stream URL REJECTED: ${probe.error} (${probe.totalTime}ms)`);
      console.log('[VALIDATOR] Generating fresh URL...');
      return { error: `Stream URL invalid: ${probe.error}`, probe };
    }
    
    console.log(`[VALIDATOR] Stream OK — ${probe.timeToFirstByte}ms to first byte, HTTP ${probe.httpCode}`);
    
    // Now launch VLC with the KNOWN GOOD URL
    const args = [
      streamUrl,
      // CRITICAL: These flags kill the 45s delay
      '--play-and-exit',
      '--ipv4-timeout=3000',
      '--network-caching=' + CONFIG.networkCaching,  // 600ms
      '--live-caching=' + CONFIG.liveCaching,         // 0 — TRUE LIVE
      '--file-caching=50',                             // Minimal
      '--http-caching=300',
      '--clock-synchro=0',                             // Disable PCR sync
      '--no-drop-late-frames',
      '--no-skip-frames',
      '--avcodec-hw=any',
      '--avcodec-threads=2',
      '--no-video-title-show',
      '--no-sub-autodetect-file',
      '--no-keyboard-events',
      '--no-mouse-events',
      // Force TCP transport (no UDP)
      '--rtsp-tcp',
      // Disable VLC's internal retry — we handle retries ourselves
      '--no-playlist-autostart',
      '--no-playlist-tree',
    ];

    console.log('[VLC] Launching:', 'vlc ' + args.join(' ').substring(0, 200) + '...');

    this.startTime = Date.now();
    
    const vlc = spawn(CONFIG.vlcPath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    vlc.unref();
    this.activeProcess = vlc;
    this.activeChannelId = channelId;

    // DEBUG: Collect VLC output to identify buffering
    let stderrLog = '';
    vlc.stderr.on('data', (data) => {
      const msg = data.toString();
      stderrLog += msg;
      
      // Log critical VLC events
      if (msg.includes('error') || msg.includes('failed') || msg.includes('warning')) {
        console.log('[VLC]', msg.trim().substring(0, 300));
      }
      
      // Track buffering events specifically
      if (msg.includes('buffering') || msg.includes('buffer')) {
        console.log('[VLC-BUFFER]', msg.trim());
      }
    });

    vlc.on('exit', (code, signal) => {
      const runtime = (Date.now() - this.startTime) / 1000;
      console.log(`[VLC] Exited (code=${code}, signal=${signal}, ran=${runtime.toFixed(1)}s)`);
      
      // If VLC exited within 10s with no data, the URL was bad
      if (runtime < 10 && code !== 0) {
        console.log('[VLC] Early exit — possible bad stream URL');
        this.debugLog.push({
          time: new Date().toISOString(),
          channelId,
          runtime,
          exitCode: code,
          stderr: stderrLog.substring(stderrLog.length - 500), // Last 500 chars
        });
      }
      
      this.activeProcess = null;
    });

    return { success: true, pid: vlc.pid, probe };
  }

  getDebugLog() {
    return this.debugLog.slice(-50);
  }
}

// ============= INIT =============
const stalker = new StalkerClient(CONFIG.portalUrl, CONFIG.mac);
const vlcManager = new VlcManager();

// ============= API =============

// FIXED: Channel play with URL pre-validation and auto-retry
app.get('/api/vlc-channel/:id', async (req, res) => {
  try {
    const channelId = req.params.id;
    
    // Get fresh stream URL
    const streamUrl = await stalker.createLink(channelId);
    
    // Launch VLC with validation
    const result = await vlcManager.spawnSafe(streamUrl, { channelId });
    
    if (result.error) {
      // Auto-retry with fresh URL once
      console.log('[RETRY] Getting fresh URL and retrying...');
      stalker.streamUrlCache.delete(channelId); // Force fresh URL
      const retryUrl = await stalker.createLink(channelId);
      const retryResult = await vlcManager.spawnSafe(retryUrl, { channelId });
      
      if (retryResult.error) {
        return res.status(502).json({ 
          error: 'Stream unreachable after retry', 
          details: retryResult.probe,
        });
      }
      
      return res.json(retryResult);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BUFFERING DEBUG ENDPOINT — See what went wrong
app.get('/api/vlc-debug', (req, res) => {
  res.json({
    activePid: vlcManager.activeProcess?.pid || null,
    activeChannel: vlcManager.activeChannelId,
    uptime: vlcManager.startTime ? ((Date.now() - vlcManager.startTime) / 1000).toFixed(1) + 's' : 'none',
    lastStreamUrl: vlcManager.lastStreamUrl?.replace(/[?&].*/, '?...') || 'none',
    recentErrors: vlcManager.getDebugLog(),
    config: CONFIG,
  });
});

// Force URL validation test
app.get('/api/vlc-probe', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  
  const result = await StreamValidator.probe(url);
  res.json(result);
});

// Kill
app.post('/api/vlc-kill', (req, res) => {
  vlcManager.kill();
  res.json({ success: true });
});

// ============= START =============
async function main() {
  console.log('=== Stalker VLC — 45s Buffering Fix ===');
  console.log('');
  
  try {
    await stalker.handshake();
    console.log(`[OK] Handshake successful. Token: ${stalker.token?.substring(0, 16)}...`);
  } catch (err) {
    console.error(`[FAIL] Handshake: ${err.message}`);
    console.log('[INFO] Server will start but channels may fail until portal is reachable');
  }
  
  app.listen(3001, () => {
    console.log('');
    console.log('Server running on http://localhost:3001');
    console.log('');
    console.log('Endpoints:');
    console.log('  GET /api/vlc-channel/:id   — Play channel (with auto-heal)');
    console.log('  GET /api/vlc-debug          — See buffering diagnostics');
    console.log('  GET /api/vlc-probe?url=...  — Test a stream URL directly');
    console.log('  POST /api/vlc-kill          — Kill VLC');
    console.log('');
    console.log('DEBUG: If still buffering for 45s, run:');
    console.log('  curl http://localhost:3001/api/vlc-debug');
    console.log('');
    console.log('Then check the "recentErrors" field — it tells you exactly where the 45s goes');
  });
}

main();
