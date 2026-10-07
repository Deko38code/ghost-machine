#!/usr/bin/env node
/* Mirror scraped neighborstrailer images to local /uploads + rewrite db.
 * v2: low concurrency, retries + backoff, no page fetch (direct blob translation). Resumable. */
const { DatabaseSync } = require("node:sqlite");
const https = require("https");
const fs = require("fs");
const path = require("path");

const DB = "/home/ghost/rent-my-trailer/server/rentmytrailer.db";
const UP = "/home/ghost/rent-my-trailer/server/uploads";
const CDN = (blob) => `https://neighborstrailercdn.com/cdn-cgi/image/format=webp,width=800,quality=60,fit=scale-down/${blob}`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36";
const CONC = Number(process.env.CONC || 4);

function get(url, { asBuf = false, timeout = 30000 } = {}, tries = 4) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = https.get(url, { headers: { "User-Agent": UA, Accept: "*/*" }, timeout }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          if (n < tries && (res.statusCode >= 500 || res.statusCode === 429 || res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 404)) {
            return setTimeout(() => attempt(n + 1), 1500 * n);
          }
          return reject(new Error("HTTP " + res.statusCode));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(asBuf ? Buffer.concat(chunks) : Buffer.concat(chunks).toString("utf8")));
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", (e) => (n < tries ? setTimeout(() => attempt(n + 1), 1500 * n) : reject(e)));
    };
    attempt(1);
  });
}

const toOriginal = (u) => {
  let m = u.match(/ntmedia3761\.blob\.core\.windows\.net\/(public\/[^\s"')]*)/);
  if (m) return `https://ntmedia3761.blob.core.windows.net/${m[1]}`;
  m = u.match(/neighborstrailer\.com(\/Upload\/trailerImage\/[^\s"')]*)/);
  if (m) return `https://ntmedia3761.blob.core.windows.net/public${m[1].replace("/Upload/trailerImage", "/trailerImage")}`;
  m = u.match(/\/(trailerImage\/[^\s"')]*)/);
  if (m) return `https://ntmedia3761.blob.core.windows.net/public/${m[1]}`;
  return null;
};
const safeParse = (s) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

(async () => {
  fs.mkdirSync(UP, { recursive: true });
  const db = new DatabaseSync(DB, { enableForeignKeyConstraints: false });
  let done = 0, fail = 0, imgFail = 0;
  const list = db.prepare("SELECT id, img, pics_json FROM trailers WHERE img LIKE 'https://neighborstrailer.com%'").all();
  console.log("to mirror:", list.length);
  fs.writeFileSync("/home/ghost/rent-my-trailer/data/mirror-fail.txt", "");

  const queue = [...list];
  async function worker() {
    while (queue.length) {
      const t = queue.shift();
      if (!t) return;
      try {
        const urls = [...new Set([t.img, ...safeParse(t.pics_json)])].filter(Boolean);
        const blobs = [];
        for (const u of urls) { const o = toOriginal(u); if (o && !blobs.includes(o)) blobs.push(o); }
        if (!blobs.length) { imgFail++; fs.appendFileSync("/home/ghost/rent-my-trailer/data/mirror-fail.txt", `${t.id}\tno-blob\n`); continue; }
        const pics = [];
        for (let i = 0; i < blobs.length && i < 12; i++) {
          const fn = `${t.id}_${i + 1}.webp`;
          const dest = path.join(UP, fn);
          if (!fs.existsSync(dest) || fs.statSync(dest).size < 1024) {
            const buf = await get(CDN(blobs[i]), { asBuf: true });
            if (!buf || buf.length < 1024) throw new Error("tiny " + fn);
            fs.writeFileSync(dest, buf);
          }
          pics.push(`/uploads/${fn}`);
        }
        db.prepare("UPDATE trailers SET img=?, pics_json=? WHERE id=?").run(pics[0], JSON.stringify(pics), t.id);
        done++;
        if (done % 200 === 0) {
          console.log(`done ${done}/${list.length}`);
          fs.writeFileSync("/home/ghost/rent-my-trailer/data/mirror-done.txt", String(done));
        }
      } catch (e) {
        fail++;
        fs.appendFileSync("/home/ghost/rent-my-trailer/data/mirror-fail.txt", `${t.id}\t${e.message}\t${e.stack.split("\n")[0]}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  console.log(`FINISHED done=${done} fail=${fail} noBlob=${imgFail}`);
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });