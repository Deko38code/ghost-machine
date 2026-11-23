// 2026-11-17 (owner): standalone Junkalot toast + progress service.
//
// Owner-supplied express + ws server, extended only to carry the progress event
// the owner also supplied ({ type: "progress", percent, message }). A browser
// opens ws://…/ws/status and receives events; an authorised server call posts to
// /api/toast to broadcast one. Publishing is fail-closed — with no TOAST_API_KEY
// configured every publish is refused with 401.
//
// Separate process from the Junkalot web app (`next start` on :5006); nothing
// here touches, restarts or proxies the app. It binds loopback only
// (127.0.0.1:3001), so it is reachable from this box and via a tunnel route —
// not directly from the internet.

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws/status',
});

app.use(express.json({ limit: '16kb' }));

const TOAST_TYPES = ['info', 'success', 'warning', 'error'];

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'success',
      title: 'Server Online',
      message: 'Connected to Junkalot live updates.',
    })
  );
});

function broadcast(event) {
  const payload = JSON.stringify(event);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function isProgress(body) {
  const n = Number(body.percent);
  return (
    body.type === 'progress' &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= 100 &&
    typeof body.message === 'string' &&
    body.message.length <= 500
  );
}

function isToast(body) {
  return (
    TOAST_TYPES.includes(body.type) &&
    typeof body.title === 'string' &&
    typeof body.message === 'string' &&
    body.title.length > 0 &&
    body.title.length <= 100 &&
    body.message.length <= 500
  );
}

// Protect event publishing with a server-side secret.
// Set TOAST_API_KEY in the environment that starts this service.
app.post('/api/toast', (req, res) => {
  const key = req.get('x-toast-api-key');

  if (!process.env.TOAST_API_KEY || key !== process.env.TOAST_API_KEY) {
    return res.sendStatus(401);
  }

  const body = req.body || {};

  if (isProgress(body)) {
    broadcast({
      type: 'progress',
      percent: Math.round(Number(body.percent)),
      message: body.message,
    });
    return res.json({ ok: true, broadcast: 'progress' });
  }

  if (!isToast(body)) {
    return res.status(400).json({
      error: 'Invalid toast event',
    });
  }

  const { type, title, message } = body;
  broadcast({ type, title, message });

  res.json({ ok: true });
});

// Read-only readiness probe: proves the service is up and says whether
// publishing is armed, without ever echoing the key.
app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    clients: wss.clients.size,
    publishArmed: Boolean(process.env.TOAST_API_KEY),
  });
});

const PORT = Number(process.env.TOAST_PORT || 3001);

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `Junkalot toast service on port ${PORT} ` +
      `(publish ${process.env.TOAST_API_KEY ? 'armed' : 'locked: no TOAST_API_KEY'})`
  );
});
