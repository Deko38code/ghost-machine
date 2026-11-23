/* topreels-migration-crawl.js — durable, resumable source-site crawl.
 *
 * What is real here:
 *  - Job state lives in SQLite, so a crawl survives restarts and page refreshes
 *    and resumes from the pages still marked `not_scanned`.
 *  - Each page gets its own truthful row: real HTTP status, title, description,
 *    extracted text size, headings, image/link counts, a content hash, and a
 *    stored snapshot of the extracted content.
 *  - Robots.txt is obeyed per origin, one page is fetched per tick, and a page
 *    that keeps failing is marked failed after maxAttempts instead of looping.
 *  - Progress is computed from rows on disk, never from a timer. Elapsed time is
 *    the job's real started/finished timestamps.
 *
 * What is NOT here: rebuilding the destination site. That stays an owner-reviewed
 * step; this module never claims a migration was completed, imported or cut over.
 */

export function ensureTopReelsCrawlTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topreels_migration_jobs (
      migration_id INTEGER PRIMARY KEY REFERENCES site_migrations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','paused','complete','failed')),
      total_pages INTEGER NOT NULL DEFAULT 0,
      scanned_pages INTEGER NOT NULL DEFAULT 0,
      failed_pages INTEGER NOT NULL DEFAULT 0,
      skipped_pages INTEGER NOT NULL DEFAULT 0,
      started_on TEXT,
      updated_on TEXT NOT NULL DEFAULT (datetime('now')),
      finished_on TEXT,
      last_error TEXT NOT NULL DEFAULT '',
      robots_origin TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_migration_jobs_status ON topreels_migration_jobs(status, updated_on);
  `);
  const existing = new Set(db.prepare("PRAGMA table_info(topreels_migration_pages)").all().map((c) => c.name));
  const columns = [
    ["snapshot_json", "TEXT NOT NULL DEFAULT ''"],
    ["content_hash", "TEXT NOT NULL DEFAULT ''"],
    ["attempts", "INTEGER NOT NULL DEFAULT 0"],
    ["scanned_on", "TEXT"],
    ["skip_reason", "TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [name, ddl] of columns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE topreels_migration_pages ADD COLUMN ${name} ${ddl}`);
  }
}

/* ─── robots.txt ─── */
export function robotsAllows(robotsTxt, target, agent = "TopReelsMigrator") {
  const text = String(robotsTxt || "");
  if (!text.trim()) return true;
  const path = (() => {
    try { const u = new URL(target); return u.pathname + (u.search || ""); } catch { return String(target || "/"); }
  })();
  let inAgentBlock = false;
  let applies = false;
  let rules = [];
  const groups = [];
  const flush = () => { if (rules.length) groups.push({ applies, rules }); rules = []; };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      if (!inAgentBlock) { flush(); applies = false; inAgentBlock = true; }
      const ua = value.toLowerCase();
      if (ua === "*" || ua.includes(agent.toLowerCase())) applies = true;
      continue;
    }
    if (field === "disallow" || field === "allow") {
      inAgentBlock = false;
      if (field === "disallow" && value === "") { rules.push({ allow: true, path: "" }); continue; }
      if (!value) continue;
      rules.push({ allow: field === "allow", path: value });
    }
  }
  flush();
  const matching = groups.filter((g) => g.applies).flatMap((g) => g.rules).filter((r) => r.path === "" || path.startsWith(r.path));
  if (!matching.length) return true;
  matching.sort((a, b) => b.path.length - a.path.length);
  const winner = matching[0];
  return winner.allow;
}

/* ─── crawler ─── */
export function createMigrationCrawler({
  db,
  fetchPage,
  capturePage = null,
  fetchRobots,
  now = () => new Date(),
  maxAttempts = 3,
  maxPagesPerJob = 200,
} = {}) {
  if (!db) throw new Error("createMigrationCrawler needs a db");
  if (typeof fetchPage !== "function" || typeof fetchRobots !== "function") throw new Error("createMigrationCrawler needs fetchPage and fetchRobots");
  const robotsCache = new Map();
  let tickInProgress = false;
  const stamp = () => now().toISOString().replace("T", " ").slice(0, 19);

  const counters = (migrationId) => {
    const row = db.prepare(`SELECT
        COUNT(*) AS total,
        COALESCE(SUM(status='ok'),0) AS ok,
        COALESCE(SUM(status='failed'),0) AS failed,
        COALESCE(SUM(status='not_scanned'),0) AS pending
      FROM topreels_migration_pages WHERE migration_id=?`).get(migrationId);
    return { total: Number(row.total), ok: Number(row.ok), failed: Number(row.failed), pending: Number(row.pending) };
  };

  function saveJob(migrationId, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    db.prepare(`UPDATE topreels_migration_jobs SET ${keys.map((k) => `${k}=?`).join(", ")} WHERE migration_id=?`)
      .run(...keys.map((k) => fields[k]), migrationId);
  }

  function start({ migrationId, userId = null } = {}) {
    const job = db.prepare("SELECT m.id,m.user_id,m.source_url,m.status FROM site_migrations m WHERE m.id=? " + (userId ? "AND m.user_id=?" : ""))
      .get(...(userId ? [Number(migrationId), Number(userId)] : [Number(migrationId)]));
    if (!job) return { started: false, reason: "not_found" };
    if (job.status === "ownership_required") return { started: false, reason: "ownership_required" };

    // The intake scan may already have marked pages ok before the visual OMP
    // capture feature was enabled. Requeue only those without a real capture.
    if (typeof capturePage === "function") {
      const previouslyScanned = db.prepare("SELECT id,snapshot_json FROM topreels_migration_pages WHERE migration_id=? AND status='ok'").all(job.id);
      const requeue = db.prepare("UPDATE topreels_migration_pages SET status='not_scanned' WHERE id=?");
      for (const page of previouslyScanned) {
        let captured = false;
        try { captured = JSON.parse(page.snapshot_json || "{}").ompCaptureStatus === "captured"; } catch {}
        if (!captured) requeue.run(page.id);
      }
    }

    const existing = db.prepare("SELECT * FROM topreels_migration_jobs WHERE migration_id=?").get(job.id);
    const counts = counters(job.id);
    if (existing?.status === "complete") return { started: true, status: "complete", migrationId: job.id, ...counts, resumed: false };
    if (!counts.total) {
      // Nothing discovered to crawl: record that honestly instead of "running" forever.
      if (existing) saveJob(job.id, { status: "complete", finished_on: stamp(), updated_on: stamp(), total_pages: 0, scanned_pages: 0, failed_pages: 0, skipped_pages: 0 });
      else db.prepare(`INSERT INTO topreels_migration_jobs (migration_id,status,total_pages,scanned_pages,failed_pages,skipped_pages,started_on,finished_on)
        VALUES (?,'complete',0,0,0,0,?,?)`).run(job.id, stamp(), stamp());
      return { started: true, status: "complete", migrationId: job.id, ...counts, resumed: false };
    }
    if (!existing) {
      db.prepare(`INSERT INTO topreels_migration_jobs (migration_id,status,total_pages,started_on,updated_on)
        VALUES (?,'running',?,?,?)`).run(job.id, counts.total, stamp(), stamp());
    } else {
      saveJob(job.id, { status: "running", total_pages: counts.total, finished_on: null, last_error: "", updated_on: stamp() });
    }
    return { started: true, status: "running", migrationId: job.id, ...counts, resumed: Boolean(existing) };
  }

  async function robotsFor(origin) {
    if (robotsCache.has(origin)) return robotsCache.get(origin);
    let text = "";
    try { text = await fetchRobots(origin); } catch { text = ""; }
    robotsCache.set(origin, text || "");
    return text || "";
  }

  function addDiscoveredPages(migrationId, sourceUrl, links) {
    const origin = new URL(sourceUrl).origin;
    let added = 0;
    for (const link of links || []) {
      let href;
      try { const u = new URL(link, sourceUrl); if (u.origin !== origin) continue; u.hash = ""; href = u.href; } catch { continue; }
      if (/\.(pdf|zip|jpg|jpeg|png|webp|gif|svg|mp4|mp3|css|js|ico|woff2?)$/i.test(new URL(href).pathname)) continue;
      const total = counters(migrationId).total;
      if (total >= maxPagesPerJob) break;
      const seq = Number(db.prepare("SELECT COALESCE(MAX(seq),0) AS n FROM topreels_migration_pages WHERE migration_id=?").get(migrationId).n) + 1;
      const result = db.prepare("INSERT OR IGNORE INTO topreels_migration_pages (migration_id,seq,source_url,status) VALUES (?,?,?,'not_scanned')").run(migrationId, seq, href);
      added += result.changes;
    }
    return added;
  }

  async function tick() {
    if (tickInProgress) return { idle: true, busy: true };
    tickInProgress = true;
    try { return await tickOnce(); }
    finally { tickInProgress = false; }
  }

  async function tickOnce() {
    const job = db.prepare("SELECT j.*,m.source_url FROM topreels_migration_jobs j JOIN site_migrations m ON m.id=j.migration_id WHERE j.status='running' ORDER BY j.updated_on ASC LIMIT 1").get();
    if (!job) return { idle: true };
    const migrationId = job.migration_id;
    const page = db.prepare("SELECT * FROM topreels_migration_pages WHERE migration_id=? AND status='not_scanned' ORDER BY seq LIMIT 1").get(migrationId);
    if (!page) {
      const counts = counters(migrationId);
      saveJob(migrationId, { status: "complete", finished_on: stamp(), updated_on: stamp(), total_pages: counts.total, scanned_pages: counts.ok, failed_pages: counts.failed, skipped_pages: 0 });
      return { migrationId, done: true, ...counts };
    }

    const origin = new URL(page.source_url).origin;
    let robots = "";
    try { robots = await robotsFor(origin); } catch { robots = ""; }
    if (!robotsAllows(robots, page.source_url)) {
      db.prepare(`UPDATE topreels_migration_pages
        SET status='failed', attempts=attempts+1, error=?, skip_reason='robots_disallowed', scanned_on=?, title=COALESCE(NULLIF(title,''),?) WHERE id=?`)
        .run("Disallowed by robots.txt — not fetched.", stamp(), new URL(page.source_url).pathname, page.id);
      const counts = counters(migrationId);
      saveJob(migrationId, { total_pages: counts.total, scanned_pages: counts.ok, failed_pages: counts.failed, skipped_pages: counts.failed, updated_on: stamp() });
      return { migrationId, skipped: true, reason: "robots_disallowed", url: page.source_url, ...counts };
    }

    try {
      const snapshot = await fetchPage(page.source_url);
      if (!snapshot || typeof snapshot !== "object" || !snapshot.url) throw new Error("No page snapshot returned.");
      if (new URL(snapshot.url).origin !== origin) throw new Error("Page redirected to a different origin.");
      let ompCapture = null;
      let ompCaptureError = "";
      if (typeof capturePage === "function") {
        try { ompCapture = await capturePage(snapshot.url); }
        catch (captureError) { ompCaptureError = String(captureError?.message || captureError).slice(0, 240); }
      }
      const stored = {
        title: String(snapshot.title || "").slice(0, 300),
        description: String(snapshot.description || "").slice(0, 400),
        headings: (snapshot.headings || []).slice(0, 30),
        text: String(snapshot.text || "").slice(0, 4000),
        images: (snapshot.images || []).slice(0, 40),
        links: (snapshot.links || []).slice(0, 60),
        htmlBytes: Number(snapshot.htmlBytes) || null,
        capturedOn: stamp(),
        ompCaptureStatus: ompCapture ? "captured" : typeof capturePage === "function" ? "unavailable" : "not_configured",
        ompCaptureError,
        ompCapture,
      };
      db.prepare(`UPDATE topreels_migration_pages SET status='ok', http_status=?, title=?, description=?, text_chars=?,
          image_count=?, link_count=?, error='', skip_reason='', attempts=attempts+1, scanned_on=?,
          snapshot_json=?, content_hash=? WHERE id=?`)
        .run(Number(snapshot.httpStatus) || 200, stored.title, stored.description, String(snapshot.text || "").length,
          (snapshot.images || []).length, (snapshot.links || []).length, stamp(), JSON.stringify(stored), String(snapshot.contentHash || ""), page.id);
      const added = addDiscoveredPages(migrationId, page.source_url, snapshot.links);
      const counts = counters(migrationId);
      saveJob(migrationId, { total_pages: counts.total, scanned_pages: counts.ok, failed_pages: counts.failed, updated_on: stamp() });
      return { migrationId, url: page.source_url, scanned: true, discovered: added, ...counts };
    } catch (error) {
      const attempts = Number(page.attempts || 0) + 1;
      const finalFailure = attempts >= maxAttempts;
      db.prepare(`UPDATE topreels_migration_pages SET status=?, attempts=?, error=?, scanned_on=? WHERE id=?`)
        .run(finalFailure ? "failed" : "not_scanned", attempts, String(error?.message || error).slice(0, 300), finalFailure ? stamp() : null, page.id);
      const counts = counters(migrationId);
      saveJob(migrationId, {
        total_pages: counts.total, scanned_pages: counts.ok, failed_pages: counts.failed, updated_on: stamp(),
        last_error: String(error?.message || error).slice(0, 300),
        ...(finalFailure && !counts.pending ? { status: "complete", finished_on: stamp() } : {}),
      });
      return { migrationId, url: page.source_url, fetchFailed: true, error: String(error?.message || error).slice(0, 200), finalFailure, ...counts };
    }
  }

  async function runToIdle({ maxTicks = 400 } = {}) {
    const results = [];
    for (let i = 0; i < maxTicks; i++) {
      const out = await tick();
      results.push(out);
      if (out.idle) break;
    }
    return results;
  }

  function progress(migrationId) {
    const job = db.prepare(`SELECT j.*,m.source_url AS sourceUrl,m.project_name AS projectName,m.status AS migrationStatus
      FROM topreels_migration_jobs j JOIN site_migrations m ON m.id=j.migration_id WHERE j.migration_id=?`).get(Number(migrationId));
    const counts = counters(Number(migrationId));
    if (!job) return { ok: true, migrationId: Number(migrationId), status: "not_started", ...counts, pages: [], elapsedSeconds: 0 };
    const started = job.started_on ? Date.parse(job.started_on.replace(" ", "T") + "Z") : null;
    const ended = job.finished_on ? Date.parse(job.finished_on.replace(" ", "T") + "Z") : Date.now();
    const pages = db.prepare(`SELECT seq,source_url AS sourceUrl,status,http_status AS httpStatus,title,text_chars AS textChars,
        image_count AS imageCount,link_count AS linkCount,error,skip_reason AS skipReason,attempts,scanned_on AS scannedOn,content_hash AS contentHash,snapshot_json AS snapshotJson
      FROM topreels_migration_pages WHERE migration_id=? ORDER BY seq LIMIT 300`).all(Number(migrationId));
    return {
      ok: true,
      migrationId: Number(migrationId),
      status: job.status,
      sourceUrl: job.sourceUrl,
      projectName: job.projectName,
      ...counts,
      skipped: Number(job.skipped_pages || 0),
      startedOn: job.started_on,
      finishedOn: job.finished_on,
      elapsedSeconds: started ? Math.max(0, Math.round((ended - started) / 1000)) : 0,
      lastError: job.last_error || "",
      pages: pages.map(({ snapshotJson, ...page }) => {
        let stored = {};
        try { stored = JSON.parse(snapshotJson || "{}"); } catch {}
        return { ...page, ompCaptureStatus: stored.ompCaptureStatus || "not_captured", ompCaptureError: stored.ompCaptureError || "", ompCapturedAt: stored.ompCapture?.capturedAt || null };
      }),
      note: "Counts come from stored page rows. 'ok' means content was read and a snapshot stored; the destination rebuild is a separate owner-reviewed step.",
    };
  }

  return { start, tick, runToIdle, progress };
}

/* ─── routes ─── */
export function registerTopReelsMigrationCrawl(ctx) {
  const { app, db, getTopReelsCustomer, topReelsCustomerCors, isTopReelsOwner, crawler } = ctx;
  const json = (res, status, body) => res.status(status).set("Cache-Control", "no-store, private").json(body);
  const owned = (req, res) => {
    if (!topReelsCustomerCors(req, res)) { json(res, 403, { ok: false, error: "origin not allowed" }); return null; }
    const u = getTopReelsCustomer(req);
    if (!u) { json(res, 401, { ok: false, error: "Sign in first." }); return null; }
    const job = db.prepare("SELECT id,user_id,status,source_url FROM site_migrations WHERE id=? AND user_id=?").get(Number(req.params.id), u.id);
    if (!job) { json(res, 404, { ok: false, error: "Migration job not found." }); return null; }
    return { user: u, job };
  };

  app.post("/api/topreels/customer/migrations/:id/crawl", (req, res) => {
    const ownedJob = owned(req, res);
    if (!ownedJob) return;
    if (ownedJob.job.status === "ownership_required") {
      return json(res, 409, { ok: false, error: "Verify control of the source domain before crawling it." });
    }
    const out = crawler.start({ migrationId: ownedJob.job.id, userId: ownedJob.user.id });
    if (!out.started) {
      return json(res, out.reason === "ownership_required" ? 409 : 404, {
        ok: false,
        error: out.reason === "ownership_required" ? "Verify control of the source domain before crawling it." : "Migration job not found.",
      });
    }
    db.prepare("UPDATE site_migrations SET status='crawling',updated_on=datetime('now') WHERE id=? AND status='verified'").run(ownedJob.job.id);
    return json(res, 200, {
      ok: true,
      ...out,
      note: "Crawl runs in the background and resumes after restarts. It reads public pages only, obeys robots.txt, and never claims the site was migrated.",
    });
  });

  app.get("/api/topreels/customer/migrations/:id/progress", (req, res) => {
    const ownedJob = owned(req, res);
    if (!ownedJob) return;
    return json(res, 200, crawler.progress(ownedJob.job.id));
  });

  app.get("/api/admin/topreels/migrations/:id/crawl", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    if (!isTopReelsOwner(req)) return json(res, 403, { ok: false, error: "TopReels owner sign-in required" });
    return json(res, 200, crawler.progress(Number(req.params.id)));
  });
}
