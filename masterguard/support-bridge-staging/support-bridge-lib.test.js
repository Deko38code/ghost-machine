'use strict';
// Focused tests for the support bridge helpers. Run: node --test support-bridge-lib.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const lib = require('./support-bridge-lib.js');

const KEY = 'k'.repeat(64);
const b64 = (v) => Buffer.from(v).toString('base64url');
const signRaw = (payload, key = KEY) => {
  const body = b64(JSON.stringify(payload));
  return body + '.' + crypto.createHmac('sha256', key).update(body).digest('base64url');
};
const basePayload = (over = {}) => ({
  aud: lib.AUDIENCE, act: lib.ACTIONS.create, agt: 'owner@example.com', jcl: 'client@example.com',
  sid: null, jti: crypto.randomUUID(), iat: 1000, exp: 1000 + 60_000, ...over,
});

test('token: a valid token verifies and carries its claims', () => {
  const token = lib.signToken(KEY, { act: lib.ACTIONS.create, agt: 'Owner@Example.com', jcl: 'Client@Example.com', jti: 'jti-12345678' }, 1000);
  const r = lib.verifyToken(KEY, token, { now: 2000 });
  assert.equal(r.ok, true);
  assert.equal(r.payload.agt, 'owner@example.com');
  assert.equal(r.payload.jcl, 'client@example.com');
  assert.equal(r.payload.aud, lib.AUDIENCE);
});

test('token: rejects a wrong key, a tampered body and a foreign audience', () => {
  const token = lib.signToken(KEY, { act: lib.ACTIONS.create, agt: 'a@b.co', jcl: 'c@d.co', jti: 'jti-12345678' }, 1000);
  assert.equal(lib.verifyToken('x'.repeat(64), token, { now: 2000 }).reason, 'bad-signature');
  const [body, sig] = token.split('.');
  const tampered = b64(JSON.stringify({ ...basePayload(), jcl: 'other@example.com' })) + '.' + sig;
  assert.equal(lib.verifyToken(KEY, tampered, { now: 2000 }).reason, 'bad-signature');
  assert.equal(lib.verifyToken(KEY, body + '.' + sig + '.extra', { now: 2000 }).reason, 'bad-format');
  const foreign = signRaw(basePayload({ aud: 'someone-else' }));
  assert.equal(lib.verifyToken(KEY, foreign, { now: 2000 }).reason, 'bad-audience');
});

test('token: rejects expiry, a future iat, an over-long ttl and the wrong action', () => {
  const now = 10_000;
  const expired = signRaw(basePayload({ iat: now - 61_000, exp: now - 1 }));
  assert.equal(lib.verifyToken(KEY, expired, { now }).reason, 'expired');
  const future = signRaw(basePayload({ iat: now + 60_000, exp: now + 120_000 }));
  assert.equal(lib.verifyToken(KEY, future, { now }).reason, 'not-yet-valid');
  const longTtl = signRaw(basePayload({ iat: now, exp: now + 120_000 }));
  assert.equal(lib.verifyToken(KEY, longTtl, { now }).reason, 'ttl-too-long');
  const wrongAction = signRaw(basePayload({ act: lib.ACTIONS.status, iat: now, exp: now + 30_000 }));
  assert.equal(lib.verifyToken(KEY, wrongAction, { now, action: lib.ACTIONS.create }).reason, 'wrong-action');
  const missing = signRaw(basePayload({ jti: '', iat: now, exp: now + 30_000 }));
  assert.equal(lib.verifyToken(KEY, missing, { now }).reason, 'missing-jti');
});

test('jti: the store consumes a value exactly once, even when two callers race', async () => {
  const seen = new Set();
  let releases = 0;
  const queryFn = async (sql, params) => {
    if (/CREATE TABLE/i.test(sql)) return { rowCount: 0 };
    if (/DELETE/i.test(sql)) { releases += 1; return { rowCount: 0 }; }
    const jti = params[0];
    if (seen.has(jti)) return { rowCount: 0 }; // ON CONFLICT DO NOTHING
    seen.add(jti);
    return { rowCount: 1 };
  };
  const store = lib.createJtiStore(queryFn);
  const results = await Promise.all([store.consume('jti-aaaaaaaa'), store.consume('jti-aaaaaaaa')]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(await store.consume('jti-bbbbbbbb'), true);
  assert.ok(releases >= 1, 'pruning runs after a successful consume');
});

test('mapping: resolves only an explicit, well-formed server-side mapping', () => {
  const mapping = { 'client@example.com': 'Paid@PhantomIDE.com', 'bad@example.com': 'no-at-sign' };
  assert.equal(lib.resolveMappedCustomer(mapping, 'CLIENT@Example.com '), 'paid@phantomide.com');
  assert.equal(lib.resolveMappedCustomer(mapping, 'stranger@example.com'), null);
  assert.equal(lib.resolveMappedCustomer(mapping, 'bad@example.com'), null);
  assert.equal(lib.resolveMappedCustomer(null, 'client@example.com'), null);
});

test('entitlement: missing row and free plan are refused; a paid row passes', () => {
  const isPaid = (u) => String(u.plan) === 'monthly';
  assert.deepEqual(lib.entitlementResult(null, isPaid), { paid: false, reason: 'no-account' });
  assert.deepEqual(lib.entitlementResult({ plan: 'free' }, isPaid), { paid: false, reason: 'plan-not-paid' });
  assert.deepEqual(lib.entitlementResult({ plan: 'monthly' }, isPaid), { paid: true, reason: 'paid', basis: 'users' });
  assert.equal(lib.entitlementResult({ plan: 'monthly' }, null).paid, false);
});

test('entitlement: the owner-recorded metered plan entitles, an unmarked entry does not', () => {
  const isPaid = () => false;
  const record = { phantom_email: 'client@phantomide.example', support: true, planUsdMonth: 249, billingStartsISO: '2027-01-01T00:00:00.000Z', meterSinceISO: '2026-11-20T00:00:00.000Z' };
  const verdict = lib.entitlementResult(null, isPaid, record);
  assert.equal(verdict.paid, true);
  assert.equal(verdict.reason, 'plan-agreed');
  assert.equal(verdict.basis, 'mapping');
  assert.equal(verdict.planUsdMonth, 249);
  // A paid users row outranks the record.
  assert.equal(lib.entitlementResult({ plan: 'monthly' }, (u) => u.plan === 'monthly', record).basis, 'users');
  // No support flag, no positive plan, or no record at all is never entitled.
  assert.equal(lib.entitlementResult(null, isPaid, { ...record, support: false }).paid, false);
  assert.equal(lib.entitlementResult(null, isPaid, { ...record, planUsdMonth: 0 }).paid, false);
  assert.equal(lib.entitlementResult(null, isPaid).paid, false);
});

test('mapping: object entries resolve and carry the recorded plan', () => {
  const mapping = { 'CLIENT@Example.com': { phantom_email: 'Client@PhantomIDE.example', support: true, planUsdMonth: 249 } };
  assert.equal(lib.resolveMappedCustomer(mapping, 'client@example.com'), 'client@phantomide.example');
  const record = lib.mappingRecord(mapping, 'client@example.com');
  assert.equal(record.planUsdMonth, 249);
  assert.equal(lib.mappingRecord(mapping, 'nobody@example.com'), null);
  assert.equal(lib.resolveMappedCustomer({ 'x@example.com': { phantom_email: 'no-at-sign' } }, 'x@example.com'), null);
});

test('status: server states map to the five displayable states, never "reconnecting"', () => {
  const now = 1_000_000;
  const open = { inviteExpiresAt: now + 600_000, peers: {} };
  assert.deepEqual(lib.mapSessionState(open, now), { state: 'requested', reason: 'invite-open' });
  assert.deepEqual(lib.mapSessionState({ ...open, peers: { owner: {} } }, now), { state: 'waiting', reason: 'agent-ready' });
  assert.deepEqual(lib.mapSessionState({ ...open, peers: { owner: {}, client: {} } }, now), { state: 'waiting', reason: 'customer-joined' });
  assert.deepEqual(lib.mapSessionState({ ...open, connectedAt: now - 1000, connectedExpiresAt: now + 60_000 }, now), { state: 'connected', reason: 'connected' });
  assert.deepEqual(lib.mapSessionState({ ...open, connectedAt: now - 1000, connectedExpiresAt: now - 1 }, now), { state: 'ended', reason: 'time-expired' });
  assert.deepEqual(lib.mapSessionState({ ...open, inviteExpiresAt: now - 1 }, now), { state: 'ended', reason: 'invite-expired' });
  assert.deepEqual(lib.mapSessionState({ endedReason: 'connection-lost' }, now), { state: 'ended', reason: 'connection-lost' });
  assert.deepEqual(lib.mapSessionState({ endedReason: 'code-attempt-limit' }, now), { state: 'failed', reason: 'code-attempt-limit' });
  assert.deepEqual(lib.mapSessionState(null, now), { state: 'ended', reason: 'not-found' });
  assert.notEqual(lib.mapSessionState(open, now).state, 'reconnecting');
});

test('access: a session is bound to the mapped customer and refuses a cross-customer read', () => {
  const mapping = { 'client@example.com': 'paid@phantomide.com', 'other@example.com': 'paid@phantomide.com' };
  const session = { customer: 'paid@phantomide.com' };
  assert.equal(lib.authorizeSessionForCustomer(session, 'client@example.com', mapping).ok, true);
  assert.equal(lib.authorizeSessionForCustomer(session, 'nobody@example.com', mapping).reason, 'no-mapping');
  const foreign = { customer: 'another-paid@phantomide.com' };
  assert.equal(lib.authorizeSessionForCustomer(foreign, 'client@example.com', mapping).reason, 'cross-customer');
  assert.equal(lib.authorizeSessionForCustomer({ customer: null }, 'client@example.com', mapping).reason, 'unbound-session');
  assert.equal(lib.authorizeSessionForCustomer(null, 'client@example.com', mapping).reason, 'not-found');
});

test('rate limiter: caps per key inside the window and reopens after it', () => {  let now = 0;
  const hit = lib.createRateLimiter(() => now);
  assert.equal(hit('agent', 2), true);
  assert.equal(hit('agent', 2), true);
  assert.equal(hit('agent', 2), false);
  assert.equal(hit('other-agent', 2), true);
  now += 61_000;
  assert.equal(hit('agent', 2), true);
});

test('presence: the bridge is active only while she is signed in, and never invents presence', () => {
  const now = 2_000_000;
  const win = 15 * 60 * 1000;
  const line = (o) => JSON.stringify(o);
  const admin = [
    line({ type: 'start', account: 'client@example.com', at: new Date(now - 20 * 60 * 1000).toISOString() }),
    line({ type: 'heartbeat', account: 'client@example.com', lastSeenAt: new Date(now - 60_000).toISOString() }),
  ];
  assert.equal(lib.clientPresence({ adminSessionLines: admin, email: 'Client@Example.com', nowMs: now, windowMs: win }).present, true);
  const ended = admin.concat([line({ type: 'end', account: 'client@example.com', at: new Date(now - 30_000).toISOString() })]);
  assert.equal(lib.clientPresence({ adminSessionLines: ended, email: 'client@example.com', nowMs: now, windowMs: win }).present, false);
  const stale = [line({ type: 'heartbeat', account: 'client@example.com', lastSeenAt: new Date(now - 16 * 60 * 1000).toISOString() })];
  assert.equal(lib.clientPresence({ adminSessionLines: stale, email: 'client@example.com', nowMs: now, windowMs: win }).present, false);
  const ips = { clients: { 'client@example.com': { lastSeen: new Date(now - 5 * 60 * 1000).toISOString() } } };
  assert.equal(lib.clientPresence({ adminSessionLines: [], clientIps: ips, email: 'client@example.com', nowMs: now, windowMs: win }).present, true);
  assert.equal(lib.clientPresence({ adminSessionLines: [], clientIps: ips, email: 'someone@example.com', nowMs: now, windowMs: win }).present, false);
  assert.equal(lib.clientPresence({ adminSessionLines: [], email: 'client@example.com', nowMs: now, windowMs: 0 }).present, true, 'window 0 disables the gate explicitly');
});
