/* End-to-end check of the listing-photo routes:
   upload → pick cover → remove → ownership guard + on-disk file cleanup.
   Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/verify-photos.js
   Creates fixtures matching the cleanup patterns, then removes them (and their files). */
import fs from "node:fs";
import path from "node:path";
import { cleanupTestData } from "./cleanup-test-data.js";

const B = process.env.RMT_BASE || "https://localhost:8111";
const UPLOADS = path.join(process.cwd(), "server", "uploads");
const tag = Date.now().toString(36).slice(-6);
const EMAILS = [`verifyp-o${tag}@example.com`, `verifyp-x${tag}@example.com`];

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
};

async function json(method, p, body, token) {
  const r = await fetch(B + p, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
}

/* a tiny but real PNG so multer sees image bytes and the file lands on disk */
function pngBytes() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64"
  );
}
/* filenames in UPLOADS — snapshot before a request and diff after, so "wrote nothing"
   is proven by the actual file set rather than a timing window */
function snapshotUploads() {
  try { return new Set(fs.readdirSync(UPLOADS)); } catch { return new Set(); }
}
function newFilesSince(before) {
  return [...snapshotUploads()].filter((f) => !before.has(f));
}
async function upload(id, n, token) {
  const fd = new FormData();
  for (let i = 0; i < n; i++) fd.append("photos", new Blob([pngBytes()], { type: "image/png" }), `p${i}.png`);
  const r = await fetch(`${B}/api/trailers/${id}/photos`, { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
}

const created = [];
try {
  const owner = await json("POST", "/api/auth/signup", { email: EMAILS[0], password: "password123", display_name: "Photo Owner" });
  const other = await json("POST", "/api/auth/signup", { email: EMAILS[1], password: "password123", display_name: "Other User" });
  ok("signup returns a token", !!owner.json?.token && !!other.json?.token);
  const ownerT = owner.json.token, otherT = other.json.token;

  const t = await json("POST", "/api/trailers", { title: "verify photos listing", cat: "Dump Trailer", daily: 111, city: "Kerrville", state: "TX" }, ownerT);
  ok("listing created", t.status === 200 && !!t.json?.id);
  const id = t.json.id;
  created.push(id);

  /* ── upload ── */
  const up = await upload(id, 2, ownerT);
  ok("POST photos accepts 2 files", up.status === 200 && up.json?.added === 2, `status ${up.status} ${JSON.stringify(up.json)}`);
  const pics = up.json?.pics || [];
  ok("both photos returned", pics.length === 2);
  ok("first upload becomes the cover", up.json?.img === pics[0], `img=${up.json?.img}`);
  const onDisk = pics.filter((p) => String(p).startsWith("/uploads/"));
  ok("files written under /uploads/", onDisk.length === 2, JSON.stringify(pics));
  ok("files exist on disk", onDisk.every((p) => fs.existsSync(path.join(UPLOADS, path.basename(p)))));
  const fetchOne = await fetch(B + pics[0]);
  ok("uploaded photo is served over HTTP", fetchOne.status === 200, `status ${fetchOne.status}`);

  /* ── ownership guard ── */
  // multer writes as it parses, so the ownership check must run BEFORE it —
  // otherwise a stranger's upload lands on disk and is then thrown away, leaving
  // orphaned files anyone logged-in could use to fill the disk.
  const beforeStolen = snapshotUploads();
  const stolen = await upload(id, 1, otherT);
  ok("non-owner cannot add photos (403)", stolen.status === 403, `status ${stolen.status}`);
  ok("a rejected upload writes no file to disk", newFilesSince(beforeStolen).length === 0, JSON.stringify(newFilesSince(beforeStolen)));
  const stealCover = await json("POST", `/api/trailers/${id}/cover`, { url: pics[1] }, otherT);
  ok("non-owner cannot set cover (403)", stealCover.status === 403, `status ${stealCover.status}`);
  const stealRemove = await json("POST", `/api/trailers/${id}/photos/remove`, { url: pics[0] }, otherT);
  ok("non-owner cannot remove photos (403)", stealRemove.status === 403, `status ${stealRemove.status}`);

  /* ── cover pick ── */
  const cover = await json("POST", `/api/trailers/${id}/cover`, { url: pics[1] }, ownerT);
  ok("owner can pick a cover", cover.status === 200 && cover.json?.img === pics[1]);
  const bogus = await json("POST", `/api/trailers/${id}/cover`, { url: "/not-on-this-listing.jpg" }, ownerT);
  ok("cover rejects a photo not on the listing (400)", bogus.status === 400, `status ${bogus.status}`);

  /* ── remove ── */
  const rm = await json("POST", `/api/trailers/${id}/photos/remove`, { url: pics[0] }, ownerT);
  ok("owner can remove a photo", rm.status === 200 && (rm.json?.pics || []).length === 1);
  ok("removed upload is deleted from disk", !fs.existsSync(path.join(UPLOADS, path.basename(pics[0]))));
  ok("cover falls back when the cover photo is removed", rm.json?.img === pics[1], `img=${rm.json?.img}`);
  const rmAgain = await json("POST", `/api/trailers/${id}/photos/remove`, { url: pics[0] }, ownerT);
  ok("removing a photo twice 404s", rmAgain.status === 404, `status ${rmAgain.status}`);

  /* ── the manage panel reads this list from /api/mytrailers ── */
  const mine = await json("GET", "/api/mytrailers", null, ownerT);
  const row = (mine.json?.rows || []).find((r) => r.id === id);
  const parsed = (() => { try { return JSON.parse(row?.pics_json || "[]"); } catch { return null; } })();
  ok("/api/mytrailers exposes pics_json (drives the manage panel)", Array.isArray(parsed) && parsed.length === 1, JSON.stringify(row?.pics_json));
  ok("/api/mytrailers exposes the cover", row?.img === pics[1]);

  /* ── the detail endpoint renders the gallery ── */
  const detail = await json("GET", `/api/trailers/${id}`);
  ok("detail endpoint returns pics", (detail.json?.pics || []).length === 1, JSON.stringify(detail.json?.pics));
  ok("detail endpoint carves pics_json out of the payload", detail.json?.pics_json === undefined);

  /* ── validation ── */
  const empty = await upload(id, 0, ownerT);
  ok("upload with no files 400s", empty.status === 400, `status ${empty.status}`);
  const noAuth = await json("POST", `/api/trailers/${id}/photos/remove`, { url: pics[1] });
  ok("remove without a token 401s", noAuth.status === 401, `status ${noAuth.status}`);
  const missing = await json("POST", "/api/trailers/999999999/photos/remove", { url: "x" }, ownerT);
  ok("removing from a missing listing 404s", missing.status === 404, `status ${missing.status}`);
} catch (ex) {
  fail++; console.log("  ✗ threw — " + (ex?.stack || ex));
} finally {
  /* delete any uploaded files this run left behind, then the fixtures */
  try {
    for (const id of created) {
      const db = (await import("node:sqlite")).DatabaseSync;
      const d = new db(path.join(process.cwd(), "server", "rentmytrailer.db"));
      const row = d.prepare("SELECT pics_json, img FROM trailers WHERE id=?").get(id);
      d.close();
      const urls = [...new Set([...(row?.pics_json ? JSON.parse(row.pics_json) : []), row?.img].filter((u) => String(u || "").startsWith("/uploads/")))];
      for (const u of urls) { try { fs.unlinkSync(path.join(UPLOADS, path.basename(u))); } catch {} }
    }
  } catch {}
  const res = cleanupTestData();
  console.log(`\n  cleaned up ${res.trailers} test listing(s), ${res.users} test user(s)`);
  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
}
