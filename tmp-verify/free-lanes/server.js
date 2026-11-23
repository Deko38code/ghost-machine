#!/usr/bin/env node
'use strict';
/**
 * PhantomIDE Free Lanes — our own endpoint, on our own model, speaking the same
 * protocol our CLI speaks.
 *
 * Model: deepseek-v4.1-flash:cloud — the same lane Claude Code, HakTerm and the
 * bots run on. Nothing here resells or proxies anyone else's service.
 *
 * Ingress (both, same keys, same caps, same ledger):
 *   POST /v1/messages           Anthropic Messages format — point ANTHROPIC_BASE_URL at us
 *   POST /v1/chat/completions   OpenAI format (alias /chat) — point OPENAI_BASE_URL at us
 *   GET  /usage                 this key's quota for today
 *   GET  /health
 *
 *   node server.js --issue "<label>"        mint a key (printed once, stored hashed)
 *   node server.js --revoke "<prefix|id>"   revoke a key
 *   node server.js --list                   labels + today's usage
 *   node server.js                          serve
 *
 * Env: PORT(4199) HOST(127.0.0.1) UPSTREAM(http://127.0.0.1:11434) DATA_DIR(./data)
 *      DAILY_REQ_CAP(200) DAILY_TOKEN_CAP(400000) RATE_PER_MIN(30)
 *      ADMIN_TOKEN(<file data/admin.token>)  — enables POST /admin/keys
 *      (no MODEL env — the model is pinned in code: OUR_MODEL over LANE_MODEL)
 *
 * §19: every call is written to an append-only ledger. Recording is accounting,
 * never billing — no charge, seat, plan or provider cost is created here.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4199);
const HOST = process.env.HOST || '127.0.0.1';
const UPSTREAM = process.env.UPSTREAM || 'http://127.0.0.1:11434';

/**
 * PINNED. Owner's rule, 2026-11-21: this lane must never be altered — for any
 * caller, any operator, any agent, and not by the owner either. Both values are
 * literals, not environment variables, so no env change and no restart can move
 * them, and they are copied exactly from the CLI config this session runs on.
 *
 *   public name  OUR_MODEL   what every API response shows
 *   wire config  LANE_MODEL  the exact model string the CLI sends to the relay
 *   relay        UPSTREAM    the exact base URL the CLI uses
 *
 * Same config, no difference — our name is a label on top of it, never a switch.
 * Changing a line here is a code change that has to be asked for explicitly and
 * recorded as its own decision.
 */
const OUR_MODEL = 'phantom-flash';
const LANE_MODEL = 'deepseek-v4.1-flash:cloud';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DAILY_REQ_CAP = Number(process.env.DAILY_REQ_CAP || 200);
const DAILY_TOKEN_CAP = Number(process.env.DAILY_TOKEN_CAP || 400000);
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 30);
const LEDGER_MAX_BYTES = Number(process.env.LEDGER_MAX_BYTES || 32 * 1024 * 1024);

const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const LEDGER = path.join(DATA_DIR, 'usage.jsonl');
const SPONSORS = path.join(DATA_DIR, 'sponsors.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.token');

fs.mkdirSync(DATA_DIR, { recursive: true });

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

/**
 * The lane is pinned — for everyone, permanently.
 * Our own name, the DeepSeek lane id, a missing name, "auto", or a Claude-style
 * name (what a stock CLI sends) all resolve to the one wire config. Anything else
 * is REFUSED rather than served: no caller may re-point this endpoint at a
 * different or pricier lane, and no agent may alter it. Nothing here changes what
 * the model does — the config is identical, only the published name is ours.
 */
const ACCEPTED = (m) =>
  !m || m === 'auto' || m === 'default' || m === OUR_MODEL || m === 'phantom' ||
  m === LANE_MODEL || /^claude/i.test(m);

function resolveModel(requested) {
  const m = String(requested || '').trim();
  if (ACCEPTED(m)) return LANE_MODEL;
  const err = new Error(`model "${m}" is not available — this lane is pinned to ${OUR_MODEL} and is never altered`);
  err.code = 'MODEL_PINNED';
  throw err;
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(p, v) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2));
  fs.renameSync(tmp, p); // never leaves a half-written key file
}

/* Rotate by renaming — the old ledger is kept, never truncated or deleted. */
function rotateIfNeeded() {
  try {
    const st = fs.statSync(LEDGER);
    if (st.size < LEDGER_MAX_BYTES) return;
    fs.renameSync(LEDGER, LEDGER.replace(/\.jsonl$/, '.' + nowIso().replace(/[:.]/g, '-') + '.jsonl'));
  } catch { /* no ledger yet */ }
}
function appendLedger(row) {
  rotateIfNeeded();
  fs.appendFileSync(LEDGER, JSON.stringify(row) + '\n');
}

/* ---------- admin ---------- */
function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  try { return fs.readFileSync(ADMIN_FILE, 'utf8').trim() || null; } catch { return null; }
}
function isAdmin(req) {
  const want = adminToken();
  if (!want) return false; // no token configured = admin API disabled
  const got = String(req.headers['x-admin-token'] || '').trim();
  if (!got || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/* ---------- keys ---------- */
function loadKeys() { return readJson(KEYS_FILE, { keys: [] }); }
function issueKey(label) {
  const db = loadKeys();
  const raw = 'pi_' + crypto.randomBytes(24).toString('base64url');
  const rec = {
    id: crypto.randomBytes(6).toString('hex'),
    label: String(label || 'unnamed').slice(0, 60),
    hash: sha(raw),
    prefix: raw.slice(0, 11),
    created: nowIso(),
    revoked: false,
  };
  db.keys.push(rec);
  writeJson(KEYS_FILE, db);
  // Hashed backup beside the live file: losing keys.json would strand every issued key.
  writeJson(KEYS_FILE.replace(/\.json$/, '.backup.json'), db);
  return { raw, rec };
}
function findKey(raw) {
  if (!raw) return null;
  const h = sha(String(raw).trim());
  return loadKeys().keys.find((k) => k.hash === h && !k.revoked) || null;
}
function revokeKey(needle) {
  const db = loadKeys();
  const hit = db.keys.find((k) => !k.revoked && (k.id === needle || k.prefix === needle || k.prefix + '…' === needle));
  if (!hit) return null;
  hit.revoked = true;
  hit.revokedAt = nowIso();
  writeJson(KEYS_FILE, db);
  return hit;
}

/* ---------- usage ---------- */
function usageFor(keyId, day = today()) {
  let calls = 0, tokens = 0, failed = 0;
  try {
    for (const line of fs.readFileSync(LEDGER, 'utf8').split('\n')) {
      if (!line) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (r.keyId !== keyId || r.day !== day) continue;
      if (r.ok) { calls++; tokens += (r.in || 0) + (r.out || 0); } else failed++;
    }
  } catch { /* no ledger yet */ }
  return { calls, tokens, failed };
}

/* ---------- per-ip burst guard ---------- */
const ipHits = new Map();
function rateOk(ip) {
  const now = Date.now();
  const win = (ipHits.get(ip) || []).filter((t) => now - t < 60000);
  win.push(now);
  ipHits.set(ip, win);
  if (ipHits.size > 5000) for (const [k, v] of ipHits) if (!v.some((t) => now - t < 60000)) ipHits.delete(k);
  return win.length <= RATE_PER_MIN;
}

/* ---------- upstream: Anthropic Messages, same as the CLI ---------- */
function upstreamPost(payload) {
  const url = new URL('/v1/messages', UPSTREAM);
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const rq = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      timeout: 180000,
    }, (res) => {
      res.setEncoding('utf8');
      let s = '';
      res.on('data', (c) => (s += c));
      res.on('end', () => {
        try { resolve(JSON.parse(s)); } catch { reject(new Error('upstream returned non-JSON: ' + s.slice(0, 120))); }
      });
    });
    rq.on('timeout', () => rq.destroy(new Error('upstream timeout')));
    rq.on('error', reject);
    rq.end(body);
  });
}

/* Streams upstream SSE frames to onFrame(name, data). Resolves at end. */
function upstreamStream(payload, onFrame) {
  const url = new URL('/v1/messages', UPSTREAM);
  const body = JSON.stringify({ ...payload, stream: true });
  return new Promise((resolve, reject) => {
    const rq = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      timeout: 180000,
    }, (res) => {
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (c) => {
        buf += c;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let name = 'message';
          const datas = [];
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) name = line.slice(6).trim();
            else if (line.startsWith('data:')) datas.push(line.slice(5).trim());
          }
          if (!datas.length) continue;
          let data; try { data = JSON.parse(datas.join('\n')); } catch { continue; }
          try { onFrame(name, data); } catch { /* client gone; keep draining */ }
        }
      });
      res.on('end', () => resolve());
    });
    rq.on('timeout', () => rq.destroy(new Error('upstream timeout')));
    rq.on('error', reject);
    rq.end(body);
  });
}

/* ---------- helpers ---------- */
function send(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length, 'cache-control': 'no-store' });
  res.end(b);
}
function readBody(req, limit = 4 << 20) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const bearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.headers['x-api-key'] || '');

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const text = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('');
  if (text) return text;
  return content.filter((b) => b && b.type === 'thinking').map((b) => b.thinking).join('');
}

/* OpenAI chat request -> Anthropic Messages payload */
function toAnthropic(body) {
  const sys = [];
  const msgs = [];
  for (const m of body.messages || []) {
    const role = m && m.role;
    if (role === 'system' || role === 'developer') { sys.push(textOf(m.content)); continue; }
    if (role !== 'user' && role !== 'assistant') continue;
    msgs.push({ role, content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.filter((b) => b && b.type === 'text').map((b) => ({ type: 'text', text: b.text })) : '') });
  }
  const payload = {
    model: resolveModel(body.model),
    max_tokens: Number(body.max_tokens) || 1024,
    messages: msgs,
  };
  if (sys.length) payload.system = sys.join('\n\n');
  if (typeof body.temperature === 'number') payload.temperature = body.temperature;
  if (Array.isArray(body.stop)) payload.stop_sequences = body.stop;
  else if (typeof body.stop === 'string') payload.stop_sequences = [body.stop];
  if (Array.isArray(body.tools)) {
    payload.tools = body.tools.filter((t) => t && t.function).map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      input_schema: t.function.parameters || { type: 'object', properties: {} },
    }));
    if (payload.tools.length === 0) delete payload.tools;
  }
  return payload;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = String(req.socket.remoteAddress || 'unknown');

  if (req.method === 'GET' && p === '/health') {
    return send(res, 200, {
      ok: true, service: 'phantom-free-lanes', model: OUR_MODEL, lane: LANE_MODEL, upstream: UPSTREAM,
      protocols: ['anthropic /v1/messages', 'openai /v1/chat/completions'],
      dailyReqCap: DAILY_REQ_CAP, dailyTokenCap: DAILY_TOKEN_CAP, ratePerMin: RATE_PER_MIN,
      keys: loadKeys().keys.filter((k) => !k.revoked).length,
      adminEnabled: Boolean(adminToken()),
    });
  }

  if (req.method === 'GET' && p === '/ads/slot') {
    const s = readJson(SPONSORS, { slots: [] });
    const live = (s.slots || []).filter((x) => x && x.active);
    return send(res, 200, { slot: live[0] || null, count: live.length });
  }

  if (req.method === 'GET' && p === '/usage') {
    const key = findKey(bearer(req));
    if (!key) return send(res, 401, { error: 'missing or invalid API key' });
    const u = usageFor(key.id);
    return send(res, 200, {
      label: key.label, keyPrefix: key.prefix, day: today(),
      calls: u.calls, tokens: u.tokens, failed: u.failed,
      callCap: DAILY_REQ_CAP, tokenCap: DAILY_TOKEN_CAP,
      model: OUR_MODEL, lane: LANE_MODEL, resets: '00:00 UTC', billed: false,
    });
  }

  // Owner-only minting, so keys never require shell access.
  if (req.method === 'POST' && p === '/admin/keys') {
    if (!adminToken()) return send(res, 503, { error: 'admin API disabled (no ADMIN_TOKEN configured)' });
    if (!isAdmin(req)) return send(res, 401, { error: 'bad admin token' });
    let body = {};
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch {}
    const { raw, rec } = issueKey(body.label);
    return send(res, 200, { key: raw, id: rec.id, prefix: rec.prefix, label: rec.label, warning: 'shown once — store it now' });
  }

  if (req.method === 'POST' && p === '/admin/keys/revoke') {
    if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
    let body = {};
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch {}
    const hit = revokeKey(String(body.key || body.id || '').trim());
    return hit ? send(res, 200, { revoked: hit.prefix, label: hit.label }) : send(res, 404, { error: 'no such key' });
  }

  const isMsg = req.method === 'POST' && p === '/v1/messages';
  const isOAI = req.method === 'POST' && (p === '/v1/chat/completions' || p === '/chat');

  if (isMsg || isOAI) {
    const fmt = isMsg ? 'anthropic' : 'openai';
    if (!rateOk(ip)) {
      return fmt === 'anthropic'
        ? send(res, 429, { type: 'error', error: { type: 'rate_limit_error', message: 'too many requests from this address' } })
        : send(res, 429, { error: { message: 'too many requests from this address', type: 'rate_limit_error' } });
    }

    let rawBody;
    try { rawBody = await readBody(req); } catch (e) { return send(res, 413, { error: { message: e.message, type: 'invalid_request_error' } }); }

    const key = findKey(bearer(req));
    if (!key) {
      return fmt === 'anthropic'
        ? send(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'missing or invalid API key' } })
        : send(res, 401, { error: { message: 'missing or invalid API key', type: 'authentication_error' } });
    }

    const used = usageFor(key.id);
    const over = used.calls >= DAILY_REQ_CAP ? 'daily request cap reached' : (used.tokens >= DAILY_TOKEN_CAP ? 'daily token cap reached' : null);
    if (over) {
      return fmt === 'anthropic'
        ? send(res, 429, { type: 'error', error: { type: 'rate_limit_error', message: over }, quota: { calls: used.calls, tokens: used.tokens, resets: '00:00 UTC' } })
        : send(res, 429, { error: { message: over, type: 'rate_limit_error' }, quota: { calls: used.calls, tokens: used.tokens, resets: '00:00 UTC' } });
    }

    let body;
    try { body = JSON.parse(rawBody); } catch { return send(res, 400, { error: { message: 'body must be JSON', type: 'invalid_request_error' } }); }

    let payload;
    try {
      if (fmt === 'anthropic') {
        if (!Array.isArray(body.messages) || !body.messages.length) {
          return send(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'messages[] required' } });
        }
        payload = { ...body, model: resolveModel(body.model), max_tokens: Number(body.max_tokens) || 1024 };
        delete payload.stream;
      } else {
        if (!Array.isArray(body.messages) || !body.messages.length) {
          return send(res, 400, { error: { message: 'messages[] required', type: 'invalid_request_error' } });
        }
        payload = toAnthropic(body);
      }
    } catch (e) {
      return send(res, 400, {
        type: 'error',
        error: { type: 'invalid_request_error', message: e.message },
        model: OUR_MODEL,
      });
    }

    const wantStream = Boolean(body.stream);
    const started = Date.now();
    const model = OUR_MODEL;          // what the caller sees
    const lane = payload.model;       // what the relay is sent — identical config

    if (wantStream) {
      res.writeHead(200, {
        'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      let inTok = 0, outTok = 0, textOut = '', thinkingOut = '', finish = null;
      const oaiId = 'chatcmpl_' + crypto.randomBytes(8).toString('hex');
      const created = Math.floor(Date.now() / 1000);

      try {
        await upstreamStream(payload, (name, d) => {
          if (name === 'message_start') {
            inTok = Number(d && d.message && d.message.usage && d.message.usage.input_tokens) || inTok;
          } else if (name === 'content_block_delta') {
            const delta = (d && d.delta) || {};
            if (delta.type === 'text_delta') textOut += delta.text || '';
            else if (delta.type === 'thinking_delta') thinkingOut += delta.thinking || '';
          } else if (name === 'message_delta') {
            // The relay reports a placeholder input count at message_start and the
            // real one here, so the final frame's figures win.
            if (d && d.usage) {
              if (typeof d.usage.output_tokens === 'number') outTok = d.usage.output_tokens;
              if (typeof d.usage.input_tokens === 'number' && d.usage.input_tokens > 0) inTok = d.usage.input_tokens;
            }
            if (d && d.delta && d.delta.stop_reason) finish = d.delta.stop_reason;
          }

          if (fmt === 'anthropic') {
            res.write('event: ' + name + '\ndata: ' + JSON.stringify(d) + '\n\n');
          } else {
            if (name === 'content_block_delta' && d.delta && d.delta.type === 'text_delta') {
              res.write('data: ' + JSON.stringify({
                id: oaiId, object: 'chat.completion.chunk', created, model,
                choices: [{ index: 0, delta: { content: d.delta.text }, finish_reason: null }],
              }) + '\n\n');
            } else if (name === 'message_delta') {
              res.write('data: ' + JSON.stringify({
                id: oaiId, object: 'chat.completion.chunk', created, model,
                choices: [{ index: 0, delta: {}, finish_reason: finish || 'stop' }],
              }) + '\n\n');
            }
          }
        });

        if (fmt === 'openai') res.write('data: [DONE]\n\n');
        res.end();
        appendLedger({ at: nowIso(), day: today(), keyId: key.id, label: key.label, model, lane, fmt, stream: true, ok: true, in: inTok, out: outTok, ms: Date.now() - started });
      } catch (e) {
        appendLedger({ at: nowIso(), day: today(), keyId: key.id, label: key.label, model, lane, fmt, stream: true, ok: false, error: String(e.message).slice(0, 200) });
        if (!res.headersSent) return send(res, 502, { error: { message: 'upstream failed', type: 'api_error' } });
        res.end();
      }
      return;
    }

    /* ---- non-stream ---- */
    let out;
    try { out = await upstreamPost({ ...payload, stream: false }); }
    catch (e) {
      appendLedger({ at: nowIso(), day: today(), keyId: key.id, label: key.label, model, lane, fmt, ok: false, error: String(e.message).slice(0, 200) });
      return send(res, 502, { error: { message: 'upstream failed', type: 'api_error' } });
    }

    if (out && out.type === 'error') {
      appendLedger({ at: nowIso(), day: today(), keyId: key.id, label: key.label, model, lane, fmt, ok: false, error: String((out.error && out.error.message) || 'upstream error').slice(0, 200) });
      return send(res, 502, out);
    }

    const inTok = Number(out && out.usage && out.usage.input_tokens) || 0;
    const outTok = Number(out && out.usage && out.usage.output_tokens) || 0;
    appendLedger({ at: nowIso(), day: today(), keyId: key.id, label: key.label, model, lane, fmt, ok: true, in: inTok, out: outTok, ms: Date.now() - started });

    if (fmt === 'anthropic') {
      out.model = model;
      return send(res, 200, out);
    }

    const blocks = (out && Array.isArray(out.content)) ? out.content : [];
    const text = textOf(blocks);
    const toolCalls = blocks.filter((b) => b && b.type === 'tool_use').map((b) => ({
      id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
    }));
    const msg = { role: 'assistant', content: text };
    if (toolCalls.length) msg.tool_calls = toolCalls;
    return send(res, 200, {
      id: 'chatcmpl_' + crypto.randomBytes(8).toString('hex'),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: msg, finish_reason: toolCalls.length ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok },
      quota: { callsToday: used.calls + 1, callCap: DAILY_REQ_CAP, tokensToday: used.tokens + inTok + outTok, tokenCap: DAILY_TOKEN_CAP, billed: false },
    });
  }

  if (req.method === 'GET' && p === '/') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end([
      'PhantomIDE Free Lanes — model ' + OUR_MODEL,
      '',
      'Anthropic:  ANTHROPIC_BASE_URL=<this host>  ANTHROPIC_AUTH_TOKEN=<key>',
      '            POST /v1/messages',
      'OpenAI:     POST /v1/chat/completions   Authorization: Bearer <key>',
      'Quota:      GET /usage',
      '',
      'Own lanes only. Usage is recorded, never billed.',
    ].join('\n'));
  }

  return send(res, 404, { error: { message: 'not found', type: 'not_found_error' } });
});

/* ---------- cli ---------- */
const argi = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
if (process.argv.includes('--issue')) {
  const { raw } = issueKey(argi('--issue'));
  console.log('KEY (shown once, stored hashed):', raw);
  process.exit(0);
}
if (process.argv.includes('--revoke')) {
  const hit = revokeKey(String(argi('--revoke') || '').trim());
  console.log(hit ? `revoked ${hit.prefix}… (${hit.label})` : 'no such key');
  process.exit(hit ? 0 : 1);
}
if (process.argv.includes('--list')) {
  for (const k of loadKeys().keys) {
    const u = usageFor(k.id);
    console.log(`${k.prefix}…  ${String(k.label).padEnd(24)} ${k.revoked ? 'REVOKED' : 'active'}  today: ${u.calls} calls / ${u.tokens} tokens  (${k.created.slice(0, 10)})`);
  }
  process.exit(0);
}

server.listen(PORT, HOST, () => {
  console.log(`phantom-free-lanes on http://${HOST}:${PORT}  model=${OUR_MODEL} (lane ${LANE_MODEL})  upstream=${UPSTREAM}  admin=${adminToken() ? 'enabled' : 'disabled'}`);
});
module.exports = { issueKey, usageFor, revokeKey };
