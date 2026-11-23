import dns from "node:dns/promises";
import net from "node:net";
import crypto from "node:crypto";

const MAX_HTML = 600_000;
const PRIVATE_V4 = /^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|192\.0\.0|192\.0\.2|198\.18|198\.19|198\.51\.100|203\.0\.113|22[4-9]|23\d|24\d|25[0-5])\./;
function publicIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return !PRIVATE_V4.test(ip) && !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);
  if (version !== 6) return false;
  const value = ip.toLowerCase();
  if (value.startsWith("::ffff:")) return publicIp(value.slice(7));
  if (value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("2001:db8:")) return false;
  return value.startsWith("2") || value.startsWith("3");
}
export async function checkedUrl(raw) {
  let url;
  try { url = new URL(String(raw || "")); } catch { throw new Error("Enter a valid website URL, including https://"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") throw new Error("Use a public HTTPS website on the standard port.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) throw new Error("That host cannot be scanned.");
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => !publicIp(address))) throw new Error("The website must resolve only to public internet addresses.");
  url.hash = "";
  return url;
}
async function readLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0, chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML) { await reader.cancel(); throw new Error("A page was too large to scan safely."); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function fetchHtml(raw) {
  let url = await checkedUrl(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(9000), headers: { Accept: "text/html,application/xhtml+xml" } });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("The source site redirected too many times.");
      url = await checkedUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`The source website returned HTTP ${response.status}.`);
    if (!/^text\/(html|xhtml\+xml)/i.test(response.headers.get("content-type") || "")) throw new Error("That URL did not return an HTML page.");
    return { url, html: await readLimited(response) };
  }
  throw new Error("Could not open the source website.");
}
const decode = (s) => String(s || "").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
function extract(html, pageUrl) {
  const title = decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || new URL(pageUrl).hostname;
  const description = decode(html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] || html.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description/i)?.[1]);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
    try { const u = new URL(decode(m[1]), pageUrl); return u.origin === new URL(pageUrl).origin ? { url: u.href, label: decode(m[2]).slice(0,100) } : null; } catch { return null; }
  }).filter(Boolean);
  const images = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(decode(m[1]), pageUrl).href; } catch { return null; } }).filter(Boolean).slice(0,80);
  const text = decode(html.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ")).slice(0,1800);
  return { url: pageUrl, title, description, text, links, images, hasCheckout: /checkout|cart|add.to.cart|buy.now|subscribe/i.test(html), hasContactForm: /<form\b/i.test(html), hasStructuredProducts: /"@type"\s*:\s*"(?:Product|Offer)"/i.test(html) };
}
export async function scanWebsite(raw) {
  const initial = await fetchHtml(raw);
  const first = extract(initial.html, initial.url.href);
  const origin = initial.url.origin;
  const candidates = [...new Set(first.links.map((l) => l.url).filter((u) => new URL(u).origin === origin && !/\.(?:pdf|zip|jpg|jpeg|png|webp|gif|svg|mp4|mp3|css|js)(?:$|\?)/i.test(u)))].slice(0, 6);
  const pages = [first];
  for (let start = 0; start < candidates.length; start += 3) {
    const batch = await Promise.allSettled(candidates.slice(start, start + 3).map(async (url) => {
      const result = await fetchHtml(url);
      return extract(result.html, result.url.href);
    }));
    for (const result of batch) if (result.status === "fulfilled") pages.push(result.value);
  }
  const pageLinks = [...new Set(pages.flatMap((p) => p.links.map((l) => l.url)))].slice(0,120);
  const imageUrls = [...new Set(pages.flatMap((p) => p.images))].slice(0,120);
  const signals = { pages: pages.length, internalLinks: pageLinks.length, images: imageUrls.length, checkout: pages.some((p)=>p.hasCheckout), contactForms: pages.filter((p)=>p.hasContactForm).length, structuredProducts: pages.some((p)=>p.hasStructuredProducts) };
  return { sourceUrl: initial.url.href, domain: initial.url.hostname, scannedAt: new Date().toISOString(), pages, pageLinks, imageUrls, signals };
}
/* Read one already-known page and return a snapshot safe to store on the server.
   Same SSRF + size + redirect rules as the initial scan. */
export async function fetchPageSnapshot(raw) {
  const result = await fetchHtml(raw);
  const page = extract(result.html, result.url.href);
  const headings = [...result.html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => decode(m[2])).filter(Boolean).slice(0, 30).map((h) => h.slice(0, 200));
  return {
    url: result.url.href,
    httpStatus: 200,
    title: page.title,
    description: page.description,
    text: page.text,
    headings,
    images: page.images.slice(0, 40),
    links: page.links.slice(0, 60),
    htmlBytes: result.html.length,
    contentHash: crypto.createHash("sha256").update(page.text || "").digest("hex"),
  };
}

/* Ask the local HakTerm browser to make the real visual OMP capture. The
   endpoint stays loopback-only; the source URL is separately checked here. */
export async function captureOmpPage(raw, { endpoint = process.env.TOPREELS_OMP_CAPTURE_URL || "http://127.0.0.1:8100/api/site-snapshot", waitMs = 250 } = {}) {
  const target = await checkedUrl(raw);
  let captureUrl;
  try { captureUrl = new URL(endpoint); } catch { throw new Error("OMP capture endpoint is invalid."); }
  if (captureUrl.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(captureUrl.hostname)) {
    throw new Error("OMP capture endpoint must use HTTP on loopback.");
  }
  const response = await fetch(captureUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ url: target.href, wait_ms: Math.max(0, Math.min(1000, Number(waitMs) || 0)), compact: true }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`OMP capture returned HTTP ${response.status}.`);
  if (body.length > 12_000_000) throw new Error("OMP capture response exceeded the size limit.");
  let result;
  try { result = JSON.parse(body); } catch { throw new Error("OMP capture returned invalid JSON."); }
  if (result.url !== target.href || result.mimeType !== "image/jpeg" || typeof result.data !== "string" || !result.data.startsWith("/9j/")) {
    throw new Error("OMP capture did not return a matching JPEG screenshot.");
  }
  return { url: result.url, title: String(result.title || "").slice(0, 240), capturedAt: result.capturedAt || new Date().toISOString(), mimeType: result.mimeType, data: result.data };
}

/* robots.txt for an origin. Absent/unreadable robots means "allowed", which is
   what the standard says; the crawler still rate-limits itself. */
export async function fetchRobotsTxt(origin) {
  try {
    const url = new URL("/robots.txt", origin);
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { Accept: "text/plain" } });
    if (!response.ok) return "";
    return (await readLimited(response)).slice(0, 120_000);
  } catch { return ""; }
}

export function verifyFileUrl(raw) {
  const base = new URL(raw);
  base.pathname = "/.well-known/hakster-migration.txt";
  base.search = ""; base.hash = "";
  return base.href;
}
export async function verifyOwnership(raw, token) {
  const result = await fetchHtmlForText(verifyFileUrl(raw));
  return result.trim() === String(token).trim();
}
async function fetchHtmlForText(raw) {
  let url = await checkedUrl(raw);
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { Accept: "text/plain" } });
  if (!response.ok || response.status >= 300) return "";
  const text = await readLimited(response);
  return text.slice(0,1000);
}

/* Discover candidate pages from the source site's sitemap.xml (up to 25 URLs, same origin only). */
export async function discoverSitemap(raw) {
  let base;
  try { base = new URL(raw); } catch { return []; }
  base.pathname = "/sitemap.xml"; base.search = ""; base.hash = "";
  try {
    const response = await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(7000) });
    if (!response.ok) return [];
    const body = (await readLimited(response)).slice(0, 400_000);
    const origins = new Set([base.origin]);
    const urls = [];
    for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      try {
        const u = new URL(m[1], base);
        if (origins.has(u.origin) && /(^|\/)([^/]+\.html?)?$/.test(u.pathname) && !/\.(png|jpe?g|webp|gif|svg|pdf|zip|mp4|css|js)$/i.test(u.pathname)) {
          u.hash = ""; u.search = "";
          const href = u.href;
          if (!urls.includes(href)) urls.push(href);
        }
      } catch { /* skip malformed loc */ }
      if (urls.length >= 25) break;
    }
    return urls;
  } catch { return []; }
}
