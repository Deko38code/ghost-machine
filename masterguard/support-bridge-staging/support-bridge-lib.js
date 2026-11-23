'use strict';
// Junkalot OMP Snapshot <-> PhantomIDE support bridge — pure helpers.
// Kept separate from phantom-server.js so the token, mapping, entitlement and
// status rules can be tested without booting production. No secret is ever
// printed, logged or returned to a browser by anything in this file.

const crypto = require('crypto');

const AUDIENCE = 'phantomide-support';
const MAX_TTL_MS = 60 * 1000;        // a token lives at most 60 s
const CLOCK_SKEW_MS = 5 * 1000;      // tolerated future iat
const JTI_RETENTION_MS = 10 * 60 * 1000;

const ACTIONS = Object.freeze({
  create: 'support.session.create',
  status: 'support.session.status',
  end: 'support.session.end',
});

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function hmac(key, body) {
  return crypto.createHmac('sha256', key).update(body).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// payload: { jcl, agt, sid, act, jti, iat, exp } — jcl is the *Junkalot* client
// email; PhantomIDE resolves the mapped PhantomIDE account itself, so the
// browser and Junkalot never handle a PhantomIDE identity.
function signToken(key, payload, nowMs = Date.now()) {
  if (typeof key !== 'string' || key.length < 48) throw new Error('bridge key must be at least 48 characters');
  const body = b64url(JSON.stringify({
    aud: AUDIENCE,
    act: payload.act,
    agt: String(payload.agt || '').toLowerCase(),
    jcl: String(payload.jcl || '').toLowerCase(),
    sid: payload.sid || null,
    jti: payload.jti,
    iat: payload.iat === undefined ? nowMs : payload.iat,
    exp: payload.exp === undefined ? nowMs + MAX_TTL_MS : payload.exp,
  }));
  return body + '.' + hmac(key, body);
}

function verifyToken(key, token, opts = {}) {
  const now = opts.now === undefined ? Date.now() : opts.now;
  if (typeof key !== 'string' || key.length < 48) return { ok: false, reason: 'server-key-missing' };
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'bad-format' };
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return { ok: false, reason: 'bad-format' };
  if (!safeEqual(signature, hmac(key, body))) return { ok: false, reason: 'bad-signature' };
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return { ok: false, reason: 'bad-format' }; }
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'bad-format' };
  if (payload.aud !== AUDIENCE) return { ok: false, reason: 'bad-audience' };
  if (!ACTIONS_VALUES.has(payload.act)) return { ok: false, reason: 'bad-action' };
  if (opts.action && payload.act !== opts.action) return { ok: false, reason: 'wrong-action' };
  if (!payload.jti || typeof payload.jti !== 'string' || payload.jti.length < 8) return { ok: false, reason: 'missing-jti' };
  const iat = Number(payload.iat);
  const exp = Number(payload.exp);
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return { ok: false, reason: 'bad-times' };
  if (iat > now + CLOCK_SKEW_MS) return { ok: false, reason: 'not-yet-valid' };
  if (exp <= now) return { ok: false, reason: 'expired' };
  if (exp - iat > MAX_TTL_MS) return { ok: false, reason: 'ttl-too-long' };
  if (!payload.agt || !payload.jcl) return { ok: false, reason: 'missing-claims' };
  return { ok: true, payload };
}

const ACTIONS_VALUES = new Set(Object.values(ACTIONS));

// Mapping file, read server-side only and never sent to a browser or written
// into a log. Two shapes are accepted per entry:
//   "<phantomide account email>"                      — mapping only
//   { "phantom_email": "...", "support": true,        — mapping plus the owner's
//     "planUsdMonth": 249, "billingStartsISO": "..." }  recorded entitlement
// The recorded form exists because her plan is agreed and metered on the books
// (Mr Ed usage meter, running since 2026-11-20, billing from 2027-01-01) while
// PhantomIDE has no users row to read a plan from. `support` is the owner's
// decision, stored here once — never inferred by this code.
function mappingRecord(mapping, junkalotEmail) {
  const key = String(junkalotEmail || '').trim().toLowerCase();
  if (!key || !mapping || typeof mapping !== 'object') return null;
  let mapped = mapping[key];
  if (mapped === undefined) {
    const hit = Object.keys(mapping).find((k) => String(k).trim().toLowerCase() === key);
    if (hit === undefined) return null;
    mapped = mapping[hit];
  }
  if (typeof mapped === 'string') {
    const value = mapped.trim().toLowerCase();
    return value.includes('@') ? { phantom_email: value, support: false } : null;
  }
  if (!mapped || typeof mapped !== 'object') return null;
  const phantom = String(mapped.phantom_email || mapped.email || '').trim().toLowerCase();
  if (!phantom.includes('@')) return null;
  return { ...mapped, phantom_email: phantom };
}

function resolveMappedCustomer(mapping, junkalotEmail) {
  const record = mappingRecord(mapping, junkalotEmail);
  return record ? record.phantom_email : null;
}

// Entitlement is a PhantomIDE decision, in this order:
//   1. a real users row whose plan passes isPaidUser — paid;
//   2. else the owner's recorded plan in the server-side mapping, marked
//      support:true with a positive monthly plan — plan-agreed (metered client
//      whose billing date has not arrived yet);
//   3. else not entitled. A missing row with no record is never paid, and this
//      function never invents a plan.
function entitlementResult(userRow, isPaidUser, record) {
  if (userRow && typeof isPaidUser === 'function' && isPaidUser(userRow)) {
    return { paid: true, reason: 'paid', basis: 'users' };
  }
  const planUsdMonth = Number(record && record.planUsdMonth);
  if (record && record.support === true && Number.isFinite(planUsdMonth) && planUsdMonth > 0) {
    return {
      paid: true,
      reason: 'plan-agreed',
      basis: 'mapping',
      planUsdMonth,
      billingStartsISO: typeof record.billingStartsISO === 'string' ? record.billingStartsISO : null,
      meterSinceISO: typeof record.meterSinceISO === 'string' ? record.meterSinceISO : null,
      evidence: typeof record.evidence === 'string' ? record.evidence : null,
    };
  }
  if (!userRow) return { paid: false, reason: 'no-account' };
  if (typeof isPaidUser !== 'function') return { paid: false, reason: 'check-unavailable' };
  return { paid: false, reason: 'plan-not-paid' };
}

// Server states (phantom-server.js remoteAssist lifecycle) -> the five states
// the OMP Snapshot may display. "reconnecting" does not exist here: a closed
// socket ends the session, so it is reported as ended/connection-lost.
function mapSessionState(session, nowMs = Date.now()) {
  if (!session) return { state: 'ended', reason: 'not-found' };
  if (session.endedReason) return terminal(session.endedReason);
  if (session.connectedAt) {
    if (session.connectedExpiresAt && nowMs >= session.connectedExpiresAt) return { state: 'ended', reason: 'time-expired' };
    return { state: 'connected', reason: 'connected' };
  }
  if (session.inviteExpiresAt && nowMs >= session.inviteExpiresAt) return { state: 'ended', reason: 'invite-expired' };
  if (session.peers && session.peers.client) return { state: 'waiting', reason: 'customer-joined' };
  if (session.peers && session.peers.owner) return { state: 'waiting', reason: 'agent-ready' };
  return { state: 'requested', reason: 'invite-open' };
}

function terminal(reason) {
  const failed = ['code-attempt-limit', 'invite-expired'];
  const ended = ['20-minute-session-limit', 'participant-ended', 'connection-lost', 'owner-ended', 'time-expired'];
  if (failed.includes(reason)) return { state: 'failed', reason };
  if (ended.includes(reason)) return { state: 'ended', reason };
  return { state: 'ended', reason: reason || 'ended' };
}

// A session may only be read or ended by the customer it was opened for.
function authorizeSessionForCustomer(session, junkalotEmail, mapping) {
  if (!session) return { ok: false, reason: 'not-found' };
  const expected = resolveMappedCustomer(mapping, junkalotEmail);
  if (!expected) return { ok: false, reason: 'no-mapping' };
  if (!session.customer) return { ok: false, reason: 'unbound-session' };
  return expected === String(session.customer).toLowerCase()
    ? { ok: true, customer: expected }
    : { ok: false, reason: 'cross-customer' };
}

// Presence: the owner's rule is that the bridge only goes active while she is
// signed in on the Parrot box. Two read-only signals are accepted — the Junkalot
// admin-session log (her sign-in heartbeat) and PhantomIDE's own client access
// registry. Neither is written, and no IP is returned or logged.
function presenceFromAdminSessions(lines, email, nowMs, windowMs) {
  const account = String(email || '').trim().toLowerCase();
  let best = 0;
  let lastType = '';
  for (const line of Array.isArray(lines) ? lines : []) {
    let event;
    try { event = typeof line === 'string' ? JSON.parse(line) : line; } catch { continue; }
    if (!event || String(event.account || '').toLowerCase() !== account) continue;
    const at = Date.parse(event.lastSeenAt || event.at || '');
    if (!Number.isFinite(at)) continue;
    if (at >= best) { best = at; lastType = String(event.type || '').toLowerCase(); }
  }
  const closed = ['end', 'ended', 'logout', 'signout', 'stop', 'expired'].includes(lastType);
  return { present: best > 0 && !closed && nowMs - best <= windowMs, lastSeenAt: best || null, lastType };
}

function presenceFromClientIps(registry, email, nowMs, windowMs) {
  const account = String(email || '').trim().toLowerCase();
  const clients = registry && typeof registry === 'object' ? registry.clients : null;
  const record = clients && clients[account];
  const at = record ? Date.parse(record.lastSeen || '') : NaN;
  return { present: Number.isFinite(at) && nowMs - at <= windowMs, lastSeenAt: Number.isFinite(at) ? at : null };
}

function clientPresence({ adminSessionLines = [], clientIps = null, email, nowMs = Date.now(), windowMs = 15 * 60 * 1000 } = {}) {
  if (!(windowMs > 0)) return { present: true, windowMs: 0, sources: [] };
  const sources = [];
  const admin = presenceFromAdminSessions(adminSessionLines, email, nowMs, windowMs);
  if (admin.present) sources.push({ source: 'junkalot-admin-session', lastSeenAt: admin.lastSeenAt });
  const ips = presenceFromClientIps(clientIps, email, nowMs, windowMs);
  if (ips.present) sources.push({ source: 'phantomide-client-access', lastSeenAt: ips.lastSeenAt });
  return { present: sources.length > 0, windowMs, sources };
}

// Bounded, rate-limit helper for the bridge routes (single Node process).
function createRateLimiter(nowFn = Date.now) {
  const buckets = new Map();
  return function hit(key, cap, windowMs = 60 * 1000) {
    const now = nowFn();
    const entry = buckets.get(key);
    if (!entry || now >= entry.reset) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      if (buckets.size > 5000) { const first = buckets.keys().next().value; buckets.delete(first); }
      return true;
    }
    entry.count += 1;
    return entry.count <= cap;
  };
}

// Atomic single-use jti store. consume() is one INSERT ... ON CONFLICT DO
// NOTHING RETURNING: two processes racing on the same jti can only insert
// once, so the second caller is refused. queryFn must be pg-compatible.
function createJtiStore(queryFn, nowFn = Date.now) {
  let schemaReady = false;
  async function ensureSchema() {
    if (schemaReady) return;
    await queryFn(`CREATE TABLE IF NOT EXISTS support_bridge_jti (
      jti TEXT PRIMARY KEY,
      seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    schemaReady = true;
  }
  return {
    async consume(jti, nowMs = nowFn()) {
      await ensureSchema();
      const inserted = await queryFn(
        'INSERT INTO support_bridge_jti(jti) VALUES($1) ON CONFLICT (jti) DO NOTHING RETURNING jti',
        [String(jti)]
      );
      const took = Boolean(inserted && inserted.rowCount === 1);
      if (took) {
        const cutoff = new Date(nowMs - JTI_RETENTION_MS).toISOString();
        queryFn('DELETE FROM support_bridge_jti WHERE seen_at < $1', [cutoff]).catch(() => {});
      }
      return took;
    },
  };
}

module.exports = {
  AUDIENCE, MAX_TTL_MS, ACTIONS, JTI_RETENTION_MS,
  signToken, verifyToken,
  resolveMappedCustomer, mappingRecord, entitlementResult,
  mapSessionState, terminal, authorizeSessionForCustomer,
  presenceFromAdminSessions, presenceFromClientIps, clientPresence,
  createRateLimiter, createJtiStore,
};
