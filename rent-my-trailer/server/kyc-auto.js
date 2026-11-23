/**
 * kyc-auto.js — free, self-hosted ID verification for Rent My Trailer.
 * Pipeline: system Tesseract OCR → regex/MRZ parse → expiry & name checks → fuzzy match.
 * No third-party vendor sees the ID. Everything runs on this Dell box.
 *
 * Public API:
 *   autoVerifyId(filePath, { full_name, dob } ) -> { verified, score, fields, checks, mrz }
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { parse as mrzParse } from "mrz";

const TESS = "tesseract";
const TMP = "/tmp/kyc-autouploads";
fs.mkdirSync(TMP, { recursive: true });

/* Convert webp/jpg to png — tesseract reads PNG/JPEG/WEBP directly but WEBP sometimes fails; force convert */
function normalizeImage(src) {
  const ext = path.extname(src).toLowerCase();
  // tesseract 5 handles jpg/png/webp natively, so usually no convert needed
  if ([".png", ".jpg", ".jpeg", ".png", ".pnm", ".tiff", ".bmp"].includes(ext)) return src;
  const dst = path.join(TMP, path.basename(src).replace(/\.[^.]+$/, "") + ".png");
  try {
    const out = spawnSync("convert", [src, "-auto-orient", "-colorspace", "Gray", "-resize", "1400x", dst], { encoding: "utf8", timeout: 15000 });
    if (fs.existsSync(dst)) return dst;
  } catch {}
  // Fallback: copy (tesseract webp support varies)
  return src;
}

/* Run tesseract and get raw text */
export function ocr(filePath) {
  if (!fs.existsSync(filePath)) return "";
  const img = normalizeImage(filePath);
  try {
    const out = execSync(`${TESS} ${JSON.stringify(img)} stdout --psm 6 2>/dev/null`, { encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
    return out.trim();
  } catch { return ""; }
}

/* Extract dates like 12/31/2028, 31/12/2028, 2028-12-31, 31·12·2028 */
function extractDates(text) {
  const out = [];
  const re = /(?:\d{1,4})[\/\-·.\s]\d{1,2}[\/\-·.\s]\d{1,4}/g;
  const found = text.match(re) || [];
  for (const d of found) {
    // Try common US / intl patterns and normalize to YYYY-MM-DD
    let y = null, m = null, dd = null;
    let parts = d.split(/[\/\-·.\s]+/).filter(Boolean);
    if (parts.length !== 3) continue;
    for (let i = 0; i < 3; i++) parts[i] = String(parseInt(parts[i].replace(/[^0-9]/g, ""), 10));
    // If first is 4 digits → YYYY-MM-DD
    if (parts[0].length === 4) { y = parts[0]; m = parts[1]; dd = parts[2]; }
    else {
      // US style MM/DD/YYYY
      let a = parseInt(parts[0]), b = parseInt(parts[1]), c = parseInt(parts[2]);
      if (a > 12 && b <= 12) { dd = parts[0]; m = parts[1]; y = parts[2]; } // DD/MM/YYYY
      else if (a > 0 && a <= 31 && b > 0 && b <= 12) { m = parts[0]; dd = parts[1]; y = parts[2]; } // MM/DD/YYYY
      else { m = parts[0]; dd = parts[1]; y = parts[2]; }
    }
    if (y && m && dd) {
      if (y.length === 2) y = (y >= 30 ? "19" + y : "20" + y);
      if (y.length === 3) y = "2" + y;
      // Normalize
      const mm = String(m).padStart(2, "0");
      const ddd = String(dd).padStart(2, "0");
      const norm = `${y}-${mm}-${ddd}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) out.push(norm);
    }
  }
  return out;
}

/* Look for "XXXX-XX" style MRZ (2-line 44-char) inside text */
function tryMrz(text) {
  try {
    const lines = text.split(/\n/).map((l) => l.replace(/\s/g, "").toUpperCase());
    // find a candidate 44-char-ish line with lots of < characters
    const cand = lines.filter((l) => l.length >= 30 && l.includes("<<"));
    if (cand.length >= 2) {
      // mrz parser needs exactly 2 or 3 lines - take last 2
      const mrz = mrzParse(cand.slice(-2).join("\n"));
      return mrz;
    }
  } catch {}
  return null;
}

/* Fuzzy match — jaro / levenshtein-lite */
function fuzzyEq(a, b) {
  if (!a || !b) return false;
  const A = String(a).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const B = String(b).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (A === B) return true;
  if (A.length < 3 || B.length < 3) return false;
  // Simple edit distance
  const dp = new Array(B.length + 1).fill(0);
  for (let i = 0; i <= A.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= B.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (A[i - 1] === B[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  const dist = dp[B.length];
  return dist <= Math.max(2, Math.floor(A.length * 0.18));
}

/* main:autoVerifyId */
export function autoVerifyId(file, ctx = {}) {
  const text = ocr(file);
  const dates = extractDates(text);
  const mrz = tryMrz(text);
  const checks = [];
  let score = 0;

  // 1. Expiry check
  const validDate = dates.filter((d) => d >= new Date().toISOString().slice(0, 10))[0];
  if (validDate) { checks.push({ name: "id_not_expired", ok: true, date: validDate }); score += 20; }
  else checks.push({ name: "id_not_expired", ok: false, note: dates.length ? "no future date found" : "no dates found in OCR" });

  // 2. Name match (if user gave a name)
  if (ctx.full_name) {
    const nWords = String(ctx.full_name).toUpperCase().split(/\s+/).filter(Boolean);
    let hit = 0;
    for (const w of nWords) if (w.length >= 3 && text.toUpperCase().includes(w)) hit++;
    const nameOk = hit >= Math.min(2, nWords.length);
    checks.push({ name: "name_match", ok: nameOk, hits: hit, of: nWords.length });
    if (nameOk) score += 30;
  } else {
    checks.push({ name: "name_match", ok: null, note: "no name to compare" });
  }

  // 3. MRZ found → strong signal
  if (mrz && mrz.fields?.firstName !== undefined) {
    checks.push({ name: "mrz_parsed", ok: true, last: mrz.fields?.lastName, first: mrz.fields?.firstName });
    score += 30;
  } else checks.push({ name: "mrz_parsed", ok: false, note: "no MRZ strip found" });

  // 4. OCR got enough text (>= some min chars)
  if (text.length >= 80) { checks.push({ name: "ocr_readable", ok: true, chars: text.length }); score += 10; }
  else checks.push({ name: "ocr_readable", ok: false, chars: text.length });

  // 5. Looks like an ID (has DOB / EXPIRY / ID NUMBER / DL prefix)
  const hasIdKeyword = /(?:license|identification|identification|driver|passport|id\s*number|expir)/i.test(text);
  if (hasIdKeyword) { checks.push({ name: "looks_like_id", ok: true }); score += 10; }
  else checks.push({ name: "looks_like_id", ok: false });

  const verified = score >= 75;
  return { verified, score, checks, fields: { dob: validDate || null }, ocr_chars: text.length, mrz_fields: mrz?.fields || null };
}
