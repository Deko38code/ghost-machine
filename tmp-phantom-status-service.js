// Junkalot.co — live customer status service (owner-supplied, 2026-11-17).
//
// SSE feed of deployment status: GET /events streams the current state to every
// connected customer page; POST /update (token-gated) publishes a new state and
// persists it, so a restart resumes from the last known state instead of a blank bar.
//
// Two deliberate deviations, both so this can run without touching anything frozen:
//   • PHANTOM_STATUS_PORT  — port 3001 is already held by the earlier toast service, so
//     this one is started on 3002 unless the owner stops that service.
//   • PHANTOM_STATE_FILE   — /var/lib/phantom needs root; the state lives in the owner's
//     home until the owner creates that directory with sudo.
// Everything else is as supplied: token required (>=32 chars, constant-time compare),
// 4 KiB body cap, integer percent 0-100, phase <= 60 chars, message <= 200 chars,
// atomic write via temp + rename, 20 s heartbeat.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PHANTOM_STATUS_PORT || 3001);
const FILE = process.env.PHANTOM_STATE_FILE || "/var/lib/phantom/status.json";
const TOKEN = process.env.PHANTOM_TOKEN;

if (!TOKEN || TOKEN.length < 32) {
  throw new Error("Set a strong PHANTOM_TOKEN (32+ chars)");
}

let state = {
  percent: 0,
  phase: "idle",
  message: "No deployment running",
  updatedAt: new Date().toISOString(),
};

try {
  state = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

const clients = new Set();

function send(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function authorized(req) {
  const supplied = req.headers["x-phantom-token"];
  if (typeof supplied !== "string") return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer((req, res) => {
  if (req.url === "/events" && req.method === "GET") {
    // Only expose behind authenticated admin routing.
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    send(res, state);
    clients.add(res);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 20000);

    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (req.url === "/state" && req.method === "GET") {
    // Read-only snapshot for pages that cannot hold an SSE connection open.
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(state));
    return;
  }

  if (req.url === "/update" && req.method === "POST") {
    if (!authorized(req)) {
      res.writeHead(401).end("Unauthorized");
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 4096) req.destroy();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(raw);
        const { percent, phase, message } = data;

        if (
          !Number.isInteger(percent) ||
          percent < 0 ||
          percent > 100 ||
          typeof phase !== "string" ||
          typeof message !== "string" ||
          phase.length > 60 ||
          message.length > 200
        ) {
          throw Error("Invalid progress event");
        }

        state = {
          percent,
          phase,
          message,
          updatedAt: new Date().toISOString(),
        };

        fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 });
        const temp = FILE + ".tmp";
        fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
        fs.renameSync(temp, FILE);

        for (const client of clients) {
          send(client, state);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400).end("Invalid event");
      }
    });
    return;
  }

  res.writeHead(404).end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Phantom status service ready on ${PORT} (state ${FILE}, token ${TOKEN.length} chars)`
  );
});
