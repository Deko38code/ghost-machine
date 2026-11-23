/* topreels-social-publish.js — server-side publishing to a connected Meta Page.
 *
 * What actually runs here:
 *  - Facebook: a real Page feed post through the Graph API using the Page token
 *    this server stored encrypted at OAuth connect time. The returned post id is
 *    persisted, so the customer and owner can see exactly what was published.
 *  - Instagram: a real single-image publish (media container + media_publish)
 *    against the Page's linked Instagram professional account.
 *
 * Rules:
 *  - The token never goes back to the browser. It is decrypted per request and
 *    used only in the outbound Graph call.
 *  - A Graph error is reported as an error with the provider message; the server
 *    never invents a post id or claims a post is live when it is not.
 *  - Every attempt is recorded with platform, page, external id (if any), status
 *    and error text. Success is only whatever the provider returned.
 *  - YouTube upload stays in the browser (the rendered video blob never leaves
 *    the device); its returned video id is already logged as a `reel_shared`
 *    event by the studio.
 */

export function ensureTopReelsSocialTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topreels_social_posts (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram')),
      page_id TEXT NOT NULL DEFAULT '',
      ig_user_id TEXT NOT NULL DEFAULT '',
      external_post_id TEXT NOT NULL DEFAULT '',
      container_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('confirmed','failed','pending')),
      message_preview TEXT NOT NULL DEFAULT '',
      permalink TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_on TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_topreels_social_posts_user ON topreels_social_posts(user_id, created_on DESC);
  `);
}

/* Same key derivation as topreels-tools.js metaEncrypt(). */
function metaKey(JWT_SECRET, crypto) {
  return crypto.createHmac("sha256", JWT_SECRET).update("topreels-meta-token-v1").digest();
}

export function decryptMetaToken(row, { crypto, JWT_SECRET }) {
  const iv = Buffer.from(String(row?.token_iv || ""), "base64");
  const tag = Buffer.from(String(row?.token_tag || ""), "base64");
  const ct = Buffer.from(String(row?.token_ct || ""), "base64");
  if (!iv.length || !tag.length || !ct.length) throw new Error("stored Meta token is incomplete");
  const decipher = crypto.createDecipheriv("aes-256-gcm", metaKey(JWT_SECRET, crypto), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

async function defaultGraphRequest(pathname, { method = "GET", params = {}, token } = {}) {
  const base = "https://graph.facebook.com/v21.0/" + String(pathname).replace(/^\/+/, "");
  let url = base;
  let body;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (method === "GET") {
    const q = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
    url += "?" + q.toString();
  } else {
    const form = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
    body = form;
  }
  const response = await fetch(url, {
    method,
    headers: token ? { Authorization: "Bearer " + token } : {},
    body,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(String(data?.error?.message || "Graph API request failed (" + response.status + ")"));
    error.graphCode = data?.error?.code ?? null;
    error.graphSubcode = data?.error?.error_subcode ?? null;
    error.httpStatus = response.status;
    throw error;
  }
  return data;
}

export function registerTopReelsSocialPublish(ctx) {
  const { app, db, crypto, JWT_SECRET, getTopReelsCustomer, topReelsCustomerCors, graphRequest = defaultGraphRequest } = ctx;
  const json = (res, status, body) => res.status(status).set("Cache-Control", "no-store, private").json(body);
  const limiter = new Map();
  const limited = (key, max, windowMs) => {
    const now = Date.now(), prior = limiter.get(key);
    if (prior && now - prior.at < windowMs && prior.count >= max) return true;
    const entry = prior && now - prior.at < windowMs ? prior : { at: now, count: 0 };
    entry.at = now; entry.count++; limiter.set(key, entry);
    return false;
  };
  const record = (fields) => {
    db.prepare(`INSERT INTO topreels_social_posts
        (id,user_id,platform,page_id,ig_user_id,external_post_id,container_id,status,message_preview,permalink,error)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(fields.id, fields.userId, fields.platform, fields.pageId || "", fields.igUserId || "",
        fields.externalPostId || "", fields.containerId || "", fields.status,
        String(fields.message || "").slice(0, 280), fields.permalink || "", String(fields.error || "").slice(0, 500));
  };
  const shape = (row) => ({
    id: row.id, platform: row.platform, pageId: row.page_id, igUserId: row.ig_user_id,
    externalPostId: row.external_post_id || null, status: row.status,
    messagePreview: row.message_preview, permalink: row.permalink || null,
    error: row.error || null, createdOn: row.created_on,
  });

  app.post("/api/topreels/customer/meta/publish", async (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const link = db.prepare("SELECT * FROM topreels_meta_links WHERE user_id=?").get(user.id);
    if (!link) return json(res, 409, { ok: false, error: "Connect a Facebook Page first — no post was attempted." });
    if (limited("meta-publish:" + user.id, 30, 3600000)) return json(res, 429, { ok: false, error: "Too many publish attempts this hour." });

    const target = String(req.body?.target || "facebook").toLowerCase() === "instagram" ? "instagram" : "facebook";
    const message = String(req.body?.message || "").trim();
    if (message.length < 1 || message.length > 2000) return json(res, 400, { ok: false, error: "Message must be 1–2000 characters." });
    const linkUrl = String(req.body?.link || "").trim();
    if (linkUrl && !/^https:\/\//i.test(linkUrl)) return json(res, 400, { ok: false, error: "The link must be an HTTPS URL." });
    const imageUrl = String(req.body?.imageUrl || "").trim();
    if (target === "instagram" && !/^https:\/\//i.test(imageUrl)) {
      return json(res, 400, { ok: false, error: "Instagram publishing needs a public HTTPS image URL for the creative." });
    }

    let token;
    try {
      token = decryptMetaToken(link, { crypto, JWT_SECRET });
    } catch {
      return json(res, 409, { ok: false, error: "The stored Page connection could not be read. Reconnect the Page — nothing was posted." });
    }

    const attemptId = crypto.randomUUID();
    try {
      if (target === "facebook") {
        const out = await graphRequest(link.page_id + "/feed", {
          method: "POST", token,
          params: { message, ...(linkUrl ? { link: linkUrl } : {}) },
        });
        const postId = String(out?.id || "");
        if (!/^\d+_\d+$/.test(postId)) throw new Error("Facebook did not return a Page post id; nothing is verified as published.");
        record({ id: attemptId, userId: user.id, platform: "facebook", pageId: link.page_id, externalPostId: postId, status: "confirmed", message, permalink: "https://www.facebook.com/" + postId });
        return json(res, 200, {
          ok: true, platform: "facebook", postId,
          permalink: "https://www.facebook.com/" + postId,
          page: { id: link.page_id, name: link.page_name },
          note: "Facebook accepted the Page post. This is the provider's own post id.",
        });
      }

      const account = await graphRequest(link.page_id, { token, params: { fields: "instagram_business_account" } });
      const igUserId = String(account?.instagram_business_account?.id || "");
      if (!igUserId) {
        record({ id: attemptId, userId: user.id, platform: "instagram", pageId: link.page_id, status: "failed", message, error: "No Instagram professional account is linked to this Page." });
        return json(res, 409, {
          ok: false, error: "No Instagram professional account is linked to this Page. Link one in Meta Business Suite, then reconnect.",
          page: { id: link.page_id, name: link.page_name },
        });
      }
      const container = await graphRequest(igUserId + "/media", {
        method: "POST", token, params: { image_url: imageUrl, caption: message },
      });
      const containerId = String(container?.id || "");
      if (!containerId) throw new Error("Instagram did not return a media container id.");
      try {
        const published = await graphRequest(igUserId + "/media_publish", { method: "POST", token, params: { creation_id: containerId } });
        const mediaId = String(published?.id || "");
        if (!mediaId) throw new Error("Instagram did not return a published media id.");
        record({ id: attemptId, userId: user.id, platform: "instagram", pageId: link.page_id, igUserId, externalPostId: mediaId, containerId, status: "confirmed", message });
        return json(res, 200, {
          ok: true, platform: "instagram", mediaId, containerId,
          note: "Instagram accepted the publish request and returned its own media id.",
        });
      } catch (publishError) {
        record({ id: attemptId, userId: user.id, platform: "instagram", pageId: link.page_id, igUserId, containerId, status: "pending", message, error: String(publishError?.message || publishError) });
        return json(res, 202, {
          ok: false, pending: true, containerId,
          error: "The Instagram media container was created but publishing did not confirm. Retry shortly — nothing is verified as live yet.",
        });
      }
    } catch (error) {
      record({ id: attemptId, userId: user.id, platform: target, pageId: link.page_id, status: "failed", message, error: String(error?.message || error) });
      console.warn("[topreels-social] publish failed:", String(error?.message || error).slice(0, 160));
      return json(res, 502, {
        ok: false,
        error: String(error?.message || "The provider rejected this post."),
        graphCode: error?.graphCode ?? null,
        note: "Nothing is published. Fix the provider error and try again.",
      });
    }
  });

  app.get("/api/topreels/customer/social/posts", (req, res) => {
    if (!topReelsCustomerCors(req, res)) return json(res, 403, { ok: false, error: "origin not allowed" });
    const user = getTopReelsCustomer(req);
    if (!user) return json(res, 401, { ok: false, error: "Sign in first." });
    const rows = db.prepare("SELECT * FROM topreels_social_posts WHERE user_id=? ORDER BY created_on DESC LIMIT 50").all(user.id);
    return json(res, 200, {
      ok: true, posts: rows.map(shape),
      note: "Only provider-returned post ids are shown. A pending row means the provider did not confirm the publish.",
    });
  });
}
