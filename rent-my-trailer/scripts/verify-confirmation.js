/* Verifies the route-level behaviour a user actually hits in the browser:
   the Stripe return (#/confirmation/<code>?paid=1) must land on a real page and
   say what happened, ?canceled=1 must say nothing was charged, and a shared
   browse link (#/browse?q=…) must still apply its filter.
   Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/verify-confirmation.js */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";
import { cleanupTestData } from "./cleanup-test-data.js";

const B = "https://localhost:8111";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString(36).slice(-6);
const OWNER = `verifyp-o${tag}@example.com`;
const RENTER = `verifyp-r${tag}@example.com`;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
};
async function api(method, p, body, token) {
  const r = await fetch(B + p, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p}: ${j.error || r.status}`);
  return j;
}

/* ─── CDP client (same shape as verify-ui.js, over the project's ws dep) ─── */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  static async attach(port) {
    for (let i = 0; i < 60; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) {
          const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
          await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
          return new CDP(ws);
        }
      } catch {}
      await sleep(300);
    }
    throw new Error("could not attach to chrome");
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  wire() {
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) this.events.push(m);
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async goto(url, settle = 1500) {
    this.events.length = 0;
    await this.send("Page.navigate", { url });
    await sleep(settle);
  }
}

const chrome = spawn("chromium", [
  "--headless=new", "--remote-debugging-port=9223", "--no-sandbox", "--disable-gpu",
  "--ignore-certificate-errors", "--hide-scrollbars", "--window-size=1440,1600", "about:blank",
], { stdio: "ignore" });

let activeBooking = null;
try {
  /* ─── fixtures: a renter, and a booking on a catalog listing ─── */
  const owner = await api("POST", "/api/auth/signup", { email: OWNER, password: "password123", display_name: "Owner O" });
  const renter = await api("POST", "/api/auth/signup", { email: RENTER, password: "password123", display_name: "Renter R" });

  const catalog = await api("GET", "/api/trailers?limit=1");
  const row = (catalog.rows || []).find((r) => r.src !== "user" || !r.owner_id);
  if (!row) throw new Error("no bookable catalog listing found");
  const b = await api("POST", "/api/bookings", { trailer_id: row.id, start_date: "2026-11-02", days: 2 }, renter.token);
  activeBooking = b.booking.code;
  if (!activeBooking) throw new Error("booking was not created");
  ok("booking created on a catalog listing", !!activeBooking, activeBooking);

  const cdp = await CDP.attach(9223);
  cdp.wire();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.goto(`${B}/`);
  await cdp.eval(`localStorage.setItem('rmt-token', ${JSON.stringify(renter.token)});
    localStorage.setItem('rmt-user', ${JSON.stringify(JSON.stringify(renter.user))}); true`);

  const text = () => cdp.eval("document.body.innerText");
  /* the SPA is hash-routed and a bare hash change does NOT remount it, so each
     visit goes through about:blank to force a real document load (localStorage
     is per-origin, so the injected session survives) */
  const visit = async (hash) => {
    await cdp.goto("about:blank", 200);
    await cdp.goto(`${B}/#${hash}`, 2400);
  };

  /* ─── 1. the plain confirmation route renders (it used to be a dead end) ─── */
  await visit(`/confirmation/${activeBooking}`);
  let t = await text();
  ok("confirmation route renders the booking page", /Booking confirmed/i.test(t), t.slice(0, 90).replace(/\n/g, " | "));
  ok("confirmation page shows the reservation code", t.includes(activeBooking));
  ok("no payment banner without a paid flag", !/Payment received/i.test(t));

  /* ─── 2. ?canceled=1 says nothing was charged ─── */
  await visit(`/confirmation/${activeBooking}?canceled=1`);
  t = await text();
  ok("?canceled=1 shows the canceled notice", /Checkout canceled/i.test(t), t.slice(0, 120).replace(/\n/g, " | "));
  ok("?canceled=1 still renders the booking itself", /Booking confirmed/i.test(t));

  /* ─── 3. ?paid=1: the webhook lands late, the page must catch up ─── */
  await visit(`/confirmation/${activeBooking}?paid=1`);
  t = await text();
  ok("?paid=1 while still pending shows the confirming state", /Confirming your payment/i.test(t), t.slice(0, 120).replace(/\n/g, " | "));

  // now let the gateway "confirm" — the page should notice without a manual reload
  const { DatabaseSync } = await import("node:sqlite");
  const d = new DatabaseSync(path.join(process.cwd(), "server", "rentmytrailer.db"));
  d.prepare("UPDATE bookings SET payment_state='paid' WHERE code=?").run(activeBooking);
  d.close();
  let sawPaid = false;
  for (let i = 0; i < 8; i++) { await sleep(1200); if (/Payment received/i.test(await text())) { sawPaid = true; break; } }
  ok("page reaches 'Payment received' once the gateway confirms", sawPaid, sawPaid ? "" : (await text()).slice(0, 140).replace(/\n/g, " | "));

  /* ─── 4. the query string no longer leaks into the route param ─── */
  /* the referral gate upper-cases its param — a query string used to ride along */
  await cdp.eval("localStorage.removeItem('rmt-ref'); true");
  await visit("/r/deke2025?utm_source=email");
  await sleep(800);
  const ref = await cdp.eval("localStorage.getItem('rmt-ref')");
  ok("referral code is clean of the query string", ref === "DEKE2025", `stored ${JSON.stringify(ref)}`);

  /* ─── 5. a shared browse link still applies its filters ───
     Browse has no text input — it shows the active query in the subtitle and
     mirrors ?cat= into the Type select, so assert those. */
  // use a category that actually exists, so a zero-result filter cannot be mistaken for a bug
  const meta = await api("GET", "/api/trailers/meta");
  const realCat = (meta.cats || []).map((c) => c.cat).find((c) => c && !c.includes(","));
  if (!realCat) throw new Error("no single-value category in meta");
  await visit(`/browse?q=dump&cat=${encodeURIComponent(realCat)}`);
  await sleep(2000);
  t = await text();
  ok("browse keeps ?q= from a shared link", /for\s*[“"]dump[”"]/i.test(t), t.split("\n").slice(0, 3).join(" | "));
  const catSel = await cdp.eval(`(document.querySelector('select[aria-label="Type"]')||{}).value || ''`);
  ok(`browse keeps ?cat= in the Type select (${realCat})`, catSel === realCat, `select="${catSel}"`);
  const shown = await cdp.eval(`document.querySelectorAll('.grid .card').length`);
  ok("browse renders filtered results", Number(shown) > 0, `${shown} card(s)`);
} catch (ex) {
  fail++; console.log("  ✗ threw — " + (ex?.stack || ex));
} finally {
  try { chrome.kill(); } catch {}
  /* clean the booking, then the fixtures */
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const d = new DatabaseSync(path.join(process.cwd(), "server", "rentmytrailer.db"));
    if (activeBooking) {
      const b = d.prepare("SELECT id FROM bookings WHERE code=?").get(activeBooking);
      if (b) { d.prepare("DELETE FROM booking_logs WHERE booking_id=?").run(b.id); d.prepare("DELETE FROM bookings WHERE id=?").run(b.id); }
    }
    d.close();
  } catch {}
  const res = cleanupTestData();
  console.log(`\n  cleaned up ${res.users} fixture user(s), ${res.trailers} trailer(s)`);
  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail ? 1 : 0);
}
