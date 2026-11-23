/**
 * ad-agent.js — LLM-powered ad writer for Rent My Trailer.
 * Uses local Ollama (free, on this Dell box at :11434) to write unique captions per
 * trailer instead of recycled templates. Falls back to templates if Ollama is down.
 *
 * Public API:
 *   writeAd(trailer, { tone }) -> Promise<{ caption, model, tokens }> 
 *   writeAdBatch(trailers, opts) -> Promise<[caption, ...]>
 *   pickTone(trailer) -> "practical" | "hype" | "friendly" | "professional" (rotates)
 *   isOllamaUp() -> Promise<boolean>
 */

import http from "node:http";
import crypto from "node:crypto";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const MODELS = ["rmt-assistant:latest", "hp-1000:latest", "llama3.2:latest", "tinyllama:latest"];
const TONES = ["practical", "hype", "friendly", "professional", "urgent"];

const TONE_PROMPT = {
  practical: "Keep it direct, useful, matter-of-fact. Mention the practical use case (moving, hauling work gear, weekend jobs). Be specific.",
  hype: "Make it exciting, energetic. Use power words. Emphasize speed, availability, and that renters can get it TODAY.",
  friendly: "Talk like a neighbor. Warm, casual, helpful. Mention how easy the booking is.",
  professional: "Business-toned. Mention fleet, capacity, delivery options, and reliability. Clean language.",
  urgent: "Scarcity + weekend + act now vibe. Mention peak times, limited availability without being pushy.",
};

/* check Ollama is reachable */
export async function isOllamaUp() {
  return new Promise((resolve) => {
    const url = new URL("/api/tags", OLLAMA_HOST);
    const req = http.request(url, { method: "GET", timeout: 2600 }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve(res.statusCode === 200 && (d || "").includes('"models"')));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/* find a usable local model */
export async function pickModel() {
  const up = await isOllamaUp();
  if (!up) return null;
  return new Promise((resolve) => {
    const url = new URL("/api/tags", OLLAMA_HOST);
    const req = http.request(url, { method: "GET", timeout: 3000 }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(d || "{}");
          const names = (j.models || []).map(m => m.name);
          const found = MODELS.find(m => names.includes(m));
          resolve(found || names[0] || null);
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/* build a per-trailer prompt — each call gets a different tone so the feed feels varied */
export function pickTone(trailer) {
  const id = Number(trailer?.id || 0);
  return TONES[id % TONES.length];
}

function buildPrompt(trailer, tone) {
  const detail = [
    trailer.title && `Trailer: ${trailer.title}`,
    trailer.cat && `Category: ${trailer.cat}`,
    trailer.city && `City: ${trailer.city}${trailer.state ? ", " + trailer.state : ""}`,
    trailer.dims && `Size: ${trailer.dims}`,
    trailer.weight && `Capacity: ${trailer.weight} lbs`,
    trailer.daily && `Rate: $${Math.round(Number(trailer.daily))}/day${trailer.weekly ? ` / $${Math.round(Number(trailer.weekly))}/week` : ""}`,
    trailer.delivery ? "Delivery available" : "Pickup in city",
    trailer.make && trailer.model && `Make/model: ${trailer.make} ${trailer.model}`,
  ].filter(Boolean).join("\n");
  const hashtags = [
    "#rentmytrailer",
    trailer.cat && `${String(trailer.cat).toLowerCase().replace(/[^a-z]+/g, "")}`,
    trailer.state && `${String(trailer.state).toLowerCase().replace(/[^a-z]+/g, "")}`,
  ].filter(Boolean).slice(0, 4).join(" ");
  return `${TONES[tone] || TONES.practical}

Trailer details:
${detail}

Write ONE social media caption for Rent My Trailer (rmt.haksterai.com) to post today.
Requirements:
- 2-4 sentences, punchy first line
- End with the booking link: https://rmt.haksterai.com/#/detail/${trailer.id}
- Hashtag line: ${hashtags}
- No markdown, plain text only
- No emojis except 1 at the very start
- Do not invent prices, capacities, or specs that aren't above
- Do not say "Contact us" — direct renters to the booking link`;
}

/* POST to Ollama generate */
export async function writeAd(trailer, opts = {}) {
  const model = opts.model || await pickModel();
  const tone = opts.tone || pickTone(trailer);
  if (!model) return { caption: null, model: null, tone, err: "ollama-down" };
  const prompt = buildPrompt(trailer, tone);
  return new Promise((resolve) => {
    const url = new URL("/api/generate", OLLAMA_HOST);
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 85000 }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(d || "{}");
          const caption = (j.response || "").trim();
          resolve({ caption, model, tone, tokens: j.eval_count || null, done: !!j.done });
        } catch (e) { resolve({ caption: null, model, tone, err: "ollama-parse", raw: d.slice(0, 200) }); }
      });
    });
    req.on("error", e => resolve({ caption: null, model, tone, err: "ollama-connect", detail: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ caption: null, model, tone, err: "ollama-timeout" }); });
    req.end(JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.85, top_p: 0.92 } }));
  });
}

/* sequential batch — one Ollama call at a time to avoid thrashing the local host */
export async function writeAdBatch(trailers, opts = {}) {
  const out = [];
  for (const t of trailers) {
    const r = await writeAd(t, opts);
    out.push(r);
  }
  return out;
}
