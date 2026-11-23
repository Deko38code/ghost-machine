import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ARCHIVE_ROOT = "/home/ghost/backups/network-ads";
const ASSET_ROOT = path.join(ARCHIVE_ROOT, "assets");
const CAMPAIGN_ROOT = path.join(ARCHIVE_ROOT, "campaigns");
const IMAGE_HOSTS = new Set(["phantomide.com", "haksterai.com", "rmt.haksterai.com"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const checkedAt = new Map();

fs.mkdirSync(ASSET_ROOT, { recursive: true });
fs.mkdirSync(CAMPAIGN_ROOT, { recursive: true });

function safeId(value) {
  return String(value || "unknown").replace(/[^a-z0-9._-]/gi, "-").slice(0, 100) || "unknown";
}

function imageSource(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.hostname === "rmt.haksterai.com" && url.pathname === "/api/network-ads/image") {
      const source = url.searchParams.get("src");
      if (source) return new URL(source);
    }
    return url;
  } catch {
    return null;
  }
}

function loadLocalImage(url, uploadsDirectory) {
  if (!uploadsDirectory || url.hostname !== "rmt.haksterai.com" || !url.pathname.startsWith("/uploads/")) return null;
  const root = path.resolve(uploadsDirectory);
  const candidate = path.resolve(root, decodeURIComponent(url.pathname.slice("/uploads/".length)));
  if (!candidate.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  const data = fs.readFileSync(candidate);
  if (data.length > MAX_IMAGE_BYTES) throw new Error("creative exceeds archive size limit");
  const ext = path.extname(candidate).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".img";
  return { data, contentType: ext === ".svg" ? "image/svg+xml" : "image/*", ext };
}

async function loadRemoteImage(url, uploadsDirectory) {
  const local = loadLocalImage(url, uploadsDirectory);
  if (local) return local;
  const isLanAdsImage = url.protocol === "http:" && url.hostname === "10.0.0.251" && String(url.port) === "4000";
  if (!url || (!isLanAdsImage && (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname) || url.port || url.username || url.password))) {
    throw new Error("creative image host is not in the archive allowlist");
  }
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml" },
  });
  if (!response.ok) throw new Error(`creative image returned HTTP ${response.status}`);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const extensions = {
    "image/avif": ".avif", "image/webp": ".webp", "image/png": ".png",
    "image/jpeg": ".jpg", "image/gif": ".gif", "image/svg+xml": ".svg",
  };
  const ext = extensions[contentType];
  if (!ext) throw new Error(`creative returned unsupported type ${contentType || "unknown"}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > MAX_IMAGE_BYTES) throw new Error("creative image is empty or exceeds archive size limit");
  return { data, contentType, ext };
}

function saveImmutable(file, data) {
  if (fs.existsSync(file)) return;
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, data, { flag: "wx", mode: 0o600 });
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

/**
 * Keep an append-only, Dell-local copy of each distinct campaign revision and its creative.
 * Duplicate feed polls are throttled in memory; the archive itself is never pruned.
 */
export async function archiveNetworkAdCampaigns(campaigns, { uploadsDirectory } = {}) {
  const failures = [];
  for (const campaign of campaigns || []) {
    const id = safeId(campaign.id ?? campaign.event_key ?? campaign.title);
    const identity = JSON.stringify([
      campaign.id ?? campaign.event_key ?? "", campaign.title || "", campaign.headline || "",
      campaign.support || "", campaign.image || "", campaign.href || "", campaign.cta || "",
      campaign.status || "active", campaign.updated_on || campaign.updated || "",
    ]);
    const lastCheck = checkedAt.get(id);
    if (lastCheck && lastCheck.identity === identity && Date.now() - lastCheck.at < 5 * 60 * 1000) continue;

    let asset = null;
    let imageError = "";
    try {
      const source = imageSource(campaign.image);
      asset = await loadRemoteImage(source, uploadsDirectory);
      const assetHash = crypto.createHash("sha256").update(asset.data).digest("hex");
      const assetPath = path.join(ASSET_ROOT, `${assetHash}${asset.ext}`);
      saveImmutable(assetPath, asset.data);
      asset = { sha256: assetHash, path: path.relative(ARCHIVE_ROOT, assetPath), content_type: asset.contentType, bytes: asset.data.length };
    } catch (error) {
      imageError = String(error?.message || error).slice(0, 300);
    }

    const record = {
      snapshot_schema_version: 1,
      saved_at: new Date().toISOString(),
      campaign: {
        id: campaign.id ?? null,
        event_key: campaign.event_key ?? null,
        source: campaign.source ?? campaign.kind ?? null,
        title: campaign.title || "",
        headline: campaign.headline || "",
        support: campaign.support || "",
        image: campaign.image || "",
        href: campaign.href || "",
        cta: campaign.cta || "",
        status: campaign.status || "active",
        created_on: campaign.created_on || null,
        updated_on: campaign.updated_on || campaign.updated || null,
      },
      archived_creative: asset,
      creative_error: imageError || null,
    };
    const version = crypto.createHash("sha256").update(JSON.stringify({ campaign: record.campaign, creative: asset?.sha256 || null })).digest("hex");
    const folder = path.join(CAMPAIGN_ROOT, id);
    fs.mkdirSync(folder, { recursive: true });
    saveImmutable(path.join(folder, `${version}.json`), `${JSON.stringify(record, null, 2)}\n`);
    checkedAt.set(id, { identity, at: Date.now() });
    if (imageError) failures.push({ id, error: imageError });
  }
  return failures;
}

export function networkAdsArchiveRoot() {
  return ARCHIVE_ROOT;
}

export function archivedCreativeUrl(campaignId, currentImage) {
  const folder = path.join(CAMPAIGN_ROOT, safeId(campaignId));
  if (!fs.existsSync(folder)) return "";
  let records = [];
  try {
    records = fs.readdirSync(folder).filter((name) => name.endsWith(".json"))
      .map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), "utf8")))
      .sort((a, b) => String(b.saved_at || "").localeCompare(String(a.saved_at || "")));
  } catch { return ""; }
  const currentSource = imageSource(currentImage)?.href || "";
  for (const record of records) {
    const creative = record.archived_creative;
    const savedSource = imageSource(record.campaign?.image)?.href || "";
    if (!creative?.path || !savedSource || savedSource !== currentSource) continue;
    const filename = path.basename(creative.path);
    if (!/^[a-f0-9]{64}\.(avif|webp|png|jpg|gif|svg)$/.test(filename)) continue;
    if (!fs.existsSync(path.join(ASSET_ROOT, filename))) continue;
    return `https://rmt.haksterai.com/api/public/file/${filename}`;
  }
  return "";
}
