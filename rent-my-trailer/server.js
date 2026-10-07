// ── Rent My Trailer — listings, booking, coupons, deposits, handoff photos, paid messaging ──
// Patterns: cine-vault-live/server.js:11016 (Stripe checkout); catalog scraped from neighborstrailer.com.
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '8090', 10);
const ADMIN_KEY = process.env.RMT_ADMIN_KEY || 'rmt-admin';
const DATA_DIR = path.join(__dirname, 'data');
const HANDOFF_DIR = path.join(DATA_DIR, 'handoffs');
fs.mkdirSync(HANDOFF_DIR, { recursive: true });

// ── Catalog ──
const trailers = [];
for (const line of fs.readFileSync(path.join(DATA_DIR, 'trailers.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try { trailers.push(JSON.parse(line)); } catch {}
}
const byId = new Map(trailers.map(t => [String(t.id), t]));
const categories = Array.from(new Set(trailers.map(t => t.categoryTitle).filter(Boolean))).sort();
console.log(`[rmt] loaded ${trailers.length} trailers, ${categories.length} categories`);

// ── Persistence ──
function loadJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function saveJson(file, obj) { try { fs.writeFileSync(file, JSON.stringify(obj)); } catch (e) { console.warn('[rmt] save skipped:', file, e.message); } }
const bookingsPath = path.join(DATA_DIR, 'bookings.json');
const bookings = loadJson(bookingsPath, []);
const coupons = loadJson(path.join(DATA_DIR, 'coupons.json'), {});
let saveTimer;
function persist(file, obj) { // coalesced write: one save per 1.5s burst window
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveJson(file, obj), 1500).unref();
}
function persistNow(file, obj) { saveJson(file, obj); }
function persistBookings() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveJson(bookingsPath, bookings), 1200).unref(); }

// ── Pricing / booking math ──
function priceQuote(t, days) {
  const daily = Math.round(Number(t.dailyPrice) || 0);
  const weekly = Math.round(Number(t.weeklyPrice) || 0) || 0;
  const monthly = Math.round(Number(t.monthlyPrice) || 0) || 0;
  let base = 0, mode = 'daily';
  const wElig = t.isEligbleForWeekly === 'True' || t.isEligbleForWeekly === true || t.isEligbleForWeekly === '1';
  const mElig = t.isEligbleForMonthly === 'True' || t.isEligbleForMonthly === true || t.isEligbleForMonthly === '1';
  if (days >= 28 && mElig && monthly > 0) { base = Math.ceil(days / 28) * monthly; mode = 'monthly-x' + Math.ceil(days / 28); }
  else if (days >= 7 && wElig && weekly > 0) { const wk = Math.floor(days / 7); base = wk * weekly + (days % 7) * daily; mode = 'weekly-x' + wk; }
  else base = days * daily;
  let discount = 0;
  const d3 = Number(t.discountPercent3Day);
  if (days >= 3 && d3 > 0 && d3 <= 100) discount = Math.round(base * (d3 / 100) * 100) / 100;
  const deliveryFee = t.isDeliveryAvailable === 'True' ? 0 : 0; // site data has no fee field — delivery shown as option
  const cashDeposit = Math.round(Number(t.refundableCashDeposit) || 0);
  return { daily, weekly, monthly, days, base, mode, discount, deliveryFee, subtotal: base - discount, refundableCashDeposit: cashDeposit };
}

function couponCheck(code, subtotal) {
  const c = coupons[String(code || '').trim().toUpperCase()];
  if (!c || c.active === false) return null;
  let off = 0;
  if (c.percentOff) off = Math.round(subtotal * (c.percentOff / 100) * 100) / 100;
  if (c.amountOff) off += c.amountOff;
  if (off > subtotal) off = subtotal;
  return { code: String(code).toUpperCase(), percentOff: c.percentOff || 0, amountOff: c.amountOff || 0, off, description: c.description || '' };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30mb' })); // handoff photo uploads are base64 batches

// ── Listings ──
app.get('/api/trailers', (req, res) => {
  const q = String(req.query.search || '').toLowerCase().trim();
  const cat = String(req.query.category || '');
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const per = Math.min(100, Math.max(1, parseInt(req.query.per || '24', 10)));
  let list = trailers;
  if (cat) list = list.filter(t => t.categoryTitle === cat);
  if (q) list = list.filter(t =>
    (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    || (t.city || '').toLowerCase().includes(q) || (t.location || '').toLowerCase().includes(q));
  const items = list.slice((page - 1) * per, page * per).map(t => ({
    id: t.id, title: t.title, categoryTitle: t.categoryTitle,
    dailyPrice: t.dailyPrice, weeklyPrice: t.weeklyPrice, monthlyPrice: t.monthlyPrice,
    city: t.city, location: t.location, description: (t.description || '').slice(0, 200),
    community: !!t.community,
    imageUrl: (t.attachments && t.attachments[0] && (t.attachments[0].url || t.attachments[0].imageUrl)) || null,
  }));
  res.json({ total: list.length, page, per, categories, items });
});
app.get('/api/categories', (_q, res) => res.json(categories));
app.get('/api/trailers/:id', (req, res) => {
  const t = byId.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
});
app.get('/api/trailers/:id/quote', (req, res) => {
  const t = byId.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(priceQuote(t, Math.max(1, parseInt(req.query.days || '1', 10))));
});

// ── Community listings (people post personal trailers) ──
const listingsSubmitted = loadJson(path.join(DATA_DIR, 'listings-submitted.json'), {});
let communitySeq = 900000;
app.post('/api/listings', (req, res) => {
  const { title, categoryTitle, dailyPrice, weeklyPrice, monthlyPrice, refundableCashDeposit,
    discountPercent3Day, city, description, imageUrl, isDeliveryAvailable, name, email,
    hitchTitle, ballSizeTitle, minimumRentalPeriod, maximumRentalPeriod } = req.body || {};
  if (!title || !dailyPrice || !email) return res.status(400).json({ error: 'title, dailyPrice and email required' });
  const id = String(++communitySeq);
  const t = {
    id, identifier: 'community-' + id, title: String(title).slice(0, 140),
    categoryTitle: String(categoryTitle || 'Personal Trailer Rentals'),
    dailyPrice: Number(dailyPrice) || 0, weeklyPrice: Number(weeklyPrice) || 0, monthlyPrice: Number(monthlyPrice) || 0,
    refundableCashDeposit: Number(refundableCashDeposit) || 0, discountPercent3Day: Number(discountPercent3Day) || 0,
    city: String(city || '').slice(0, 80), location: '', description: String(description || '').slice(0, 1000),
    attachments: imageUrl ? [{ url: String(imageUrl).slice(0, 400) }, { url: String(imageUrl).slice(0, 400) }] : [],
    hitchTitle: hitchTitle || 'Bumper Pull', ballSizeTitle: ballSizeTitle || '',
    minimumRentalPeriod: minimumRentalPeriod || 1, maximumRentalPeriod: maximumRentalPeriod || 30,
    isDeliveryAvailable: String(isDeliveryAvailable || 'False'),
    isEligbleForWeekly: Number(weeklyPrice) > 0 ? 'True' : 'False',
    isEligbleForMonthly: Number(monthlyPrice) > 0 ? 'True' : 'False',
    postedBy: String(email).slice(0, 120), postedByName: String(name || '').slice(0, 80),
    community: true, createdOn: new Date().toISOString(),
  };
  listingsSubmitted[id] = { submittedBy: t.postedBy, submittedAt: t.createdOn };
  trailers.push(t);
  byId.set(id, t);
  persist(path.join(DATA_DIR, 'listings-submitted.json'), listingsSubmitted);
  res.json({ ok: true, id: t.id });
});

// ── Coupons ──
app.post('/api/coupons/validate', (req, res) => {
  const r = couponCheck(req.body && req.body.code, Number(req.body && req.body.subtotal) || 0);
  if (!r) return res.status(404).json({ error: 'coupon not valid' });
  res.json(r);
});
app.post('/api/coupons', (req, res) => { // admin: x-admin-key header
  if (req.header('x-admin-key') !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const { code, percentOff, amountOff, description } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code required' });
  coupons[String(code).toUpperCase()] = { percentOff: Number(percentOff) || 0, amountOff: Number(amountOff) || 0, description: description || '', active: true, createdOn: new Date().toISOString() };
  persistNow(path.join(DATA_DIR, 'coupons.json'), coupons);
  res.json({ ok: true, coupons: Object.keys(coupons) });
});

// ── Bookings ──
app.post('/api/bookings', (req, res) => {
  const { trailerId, days, email, name, phone, coupon, pickup, dropoff, delivery } = req.body || {};
  const t = byId.get(String(trailerId || ''));
  if (!t) return res.status(404).json({ error: 'trailer not found' });
  if (!email || !name) return res.status(400).json({ error: 'name and email required' });
  const q = priceQuote(t, Math.max(1, parseInt(days || '1', 10)));
  const cp = couponCheck(coupon, q.subtotal);
  q.coupon = cp;
  q.total = Math.max(0, Math.round((q.subtotal - (cp ? cp.off : 0)) * 100) / 100);
  const b = {
    id: 'BK' + Date.now(), trailerId: t.id, trailerTitle: t.title,
    email: String(email).slice(0, 120), name: String(name).slice(0, 80), phone: String(phone || '').slice(0, 40),
    quote: q, status: 'pending-payment', at: new Date().toISOString(),
    pickup: pickup ? { date: pickup.date, note: String(pickup.note || '').slice(0, 300) } : null,
    dropoff: dropoff ? { date: dropoff.date, note: String(dropoff.note || '').slice(0, 300) } : null,
    delivery: !!delivery && t.isDeliveryAvailable === 'True',
    handoffs: [],
  };
  bookings.push(b);
  persistBookings();
  res.json(b);
});
app.get('/api/bookings/:id', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  res.json(b);
});
app.get('/api/bookings', (req, res) => {
  const e = String(req.query.email || '').toLowerCase().trim();
  if (!e) return res.json(bookings.slice(-20));
  res.json(bookings.filter(b => b.email.toLowerCase() === e));
});

// ── Deposit payment (Stripe) ──
app.post('/api/bookings/:id/deposit-checkout', async (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'Payments not configured — deposit payable in cash at pickup', bookingId: b.id });
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(key);
    const amount = Math.round((b.quote.refundableCashDeposit || b.quote.total) * 100);
    if (amount <= 0) return res.status(400).json({ error: 'nothing to charge' });
    const origin = req.headers.origin || `http://localhost:${PORT}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: b.email || undefined,
      line_items: [{ price_data: { currency: 'usd', product_data: { name: `Refundable deposit — ${b.trailerTitle}` }, unit_amount: amount }, quantity: 1 }],
      success_url: `${origin}/#/booking/${b.id}?paid=1`,
      cancel_url: `${origin}/#/booking/${b.id}?paid=0`,
      metadata: { bookingId: b.id, trailerId: b.trailerId },
    });
    b.stripeSessionId = session.id;
    persistBookings();
    res.json({ url: session.url });
  } catch (e) {
    console.error('[rmt] stripe error:', e.message);
    res.status(500).json({ error: 'Could not start deposit payment. Try again.' });
  }
});
app.post('/api/bookings/:id/confirm', async (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && b.stripeSessionId) {
    try {
      const Stripe = (await import('stripe')).default;
      const s = await new Stripe(key).checkout.sessions.retrieve(b.stripeSessionId);
      b.status = s.payment_status === 'paid' ? 'paid' : 'pending-payment';
    } catch (e) {
      console.error('[rmt] stripe confirm error:', e.message);
      return res.status(500).json({ error: 'could not verify payment' });
    }
  } else {
    b.status = 'paid-deposit-cash';
  }
  persistNow(bookingsPath, bookings);
  res.json(b);
});
app.post('/api/bookings/:id/status', (req, res) => { // admin manual mark
  if (req.header('x-admin-key') !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const b = bookings.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  b.status = String(req.body.status || 'pending-payment');
  persistNow(bookingsPath, bookings);
  res.json(b);
});

// ── Handoff photo verification (pickup / dropoff — deposit hold proof) ──
// POST photos: [{ data: "data:image/jpeg;base64,…" }] + stage + notes
app.post('/api/bookings/:id/handoff', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  const { stage, photos, notes, by } = req.body || {};
  if (!['pickup', 'dropoff'].includes(stage)) return res.status(400).json({ error: "stage must be 'pickup' or 'dropoff'" });
  if (!Array.isArray(photos) || !photos.length) return res.status(400).json({ error: 'at least one photo required' });
  const saved = [];
  photos.slice(0, 12).forEach((p, i) => {
    const m = String(p.data || p || '').match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return;
    const ext = m[1] === 'image/png' ? 'png' : 'jpg';
    const file = `${b.id}-${stage}-${Date.now()}-${i}.${ext}`;
    fs.writeFileSync(path.join(HANDOFF_DIR, file), Buffer.from(m[2], 'base64'));
    saved.push(file);
  });
  const entry = { stage, photos: saved, notes: String(notes || '').slice(0, 500), by: String(by || '').slice(0, 40), at: new Date().toISOString() };
  b.handoffs.push(entry);
  persistBookings();
  res.json({ ok: true, entry });
});
app.get('/api/bookings/:id/handoffs', (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  res.json(b.handoffs || []);
});
app.get('/handoffs/:file', (req, res) => { // serve handoff proof photos to booking participants/admin
  const f = path.basename(String(req.params.file || ''));
  const p = path.join(HANDOFF_DIR, f);
  if (!f.endsWith('.jpg') && !f.endsWith('.png') || !fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

// ── Messaging: community + per-trailer rooms, gated to paid users ──
const messages = loadJson(path.join(DATA_DIR, 'messages.json'), {});
function paidFor(email) {
  const e = String(email || '').toLowerCase().trim();
  return bookings.some(b => b.email.toLowerCase() === e && String(b.status).startsWith('paid'));
}
app.get('/api/messages', (req, res) => {
  const email = String(req.query.email || '');
  res.json({ paid: paidFor(email), rooms: Object.entries(messages).map(([chatId, msgs]) => ({ chatId, count: msgs.length, last: msgs[msgs.length - 1] })) });
});
app.get('/api/messages/:chatId', (req, res) => res.json(messages[req.params.chatId] || []));
app.post('/api/messages/:chatId', (req, res) => {
  const { from, text, email } = req.body || {};
  if (!paidFor(email)) return res.status(402).json({ error: 'Community messaging is for paid members. Complete a booking deposit to unlock.' });
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
  const chatId = String(req.params.chatId);
  const msg = { id: Date.now() + '' + Math.floor(Math.random() * 1e6), chatId, from: String(from || 'guest').slice(0, 40), text: String(text).slice(0, 2000), at: new Date().toISOString() };
  (messages[chatId] = messages[chatId] || []).push(msg);
  persistNow(path.join(DATA_DIR, 'messages.json'), messages);
  for (const ws of wss.clients) {
    try { if (ws.readyState === 1 && ws._chatId === chatId) ws.send(JSON.stringify({ type: 'message', message: msg })); } catch {}
  }
  res.json(msg);
});

// live push
const wss = new WebSocketServer({ noServer: true });
const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  const m = String(req.url || '').match(/^\/ws\/([^\s/?#]+)$/);
  if (!m) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => { ws._chatId = m[1]; wss.emit('connection', ws, req); });
});

// UI — built React app first (intro w/ yellow logo), static fallback legacy page
const RMT_DIST = path.join(__dirname, 'app', 'dist');
app.use(express.static(RMT_DIST));
app.get(/^\/(?!api\/|handoffs\/).*/, (_req, res) => {
  res.sendFile(path.join(RMT_DIST, 'index.html'));
});

server.listen(PORT, () => console.log(`[rmt] rent-my-trailer on :${PORT} — ${trailers.length} listings, ${bookings.length} bookings`));