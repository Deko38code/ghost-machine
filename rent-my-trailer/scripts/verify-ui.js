/* Visual + DOM verification of the live site in real headless Chrome.
   Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/verify-ui.js
   Asserts the actual rendered UI (not just the build) and writes screenshots. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

const B = "https://localhost:8111";
const OUT = path.join(process.cwd(), "verify-shots");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, body, token) {
  const r = await fetch(B + p, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p}: ${j.error || r.status}`);
  return j;
}

/* ─── CDP client over the project's own `ws` dependency ─── */
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
  async goto(url) {
    this.events.length = 0;
    const loaded = new Promise((res) => {
      const t = setInterval(() => {
        if (this.events.some((e) => e.method === "Page.loadEventFired")) { clearInterval(t); res(); }
      }, 100);
      setTimeout(() => { clearInterval(t); res(); }, 15000);
    });
    await this.send("Page.navigate", { url });
    await loaded;
    await sleep(1200);
  }
  /* hard reload: hash-only navigation does NOT re-mount the SPA, so assertions
     about what a fresh session renders need a real document load */
  async hardReload(url) {
    await this.send("Page.reload", { ignoreCache: true });
    await sleep(300);
    if (url) { this.events.length = 0; await this.send("Page.navigate", { url }); }
    await sleep(2000);
  }
  async shot(name) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, "base64"));
    return path.join(OUT, name);
  }
}

const results = [];
const check = (label, ok, detail = "") => { results.push({ label, ok, detail }); console.log(`${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`); };

const chrome = spawn("chromium", [
  "--headless=new", "--remote-debugging-port=9222", "--no-sandbox", "--disable-gpu",
  "--ignore-certificate-errors", "--hide-scrollbars", "--window-size=1440,2400", "about:blank",
], { stdio: "ignore" });

try {
  const cdp = await CDP.attach(9222);
  cdp.wire();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  /* ── test fixtures: owner lists a trailer, renter opens a thread ── */
  const tag = Date.now().toString().slice(-6);
  const fixtures = [`uiverify-o${tag}@example.com`, `uiverify-r${tag}@example.com`];
  const owner = await api("POST", "/api/auth/signup", { email: fixtures[0], password: "password123", display_name: "Owner O" });
  const renter = await api("POST", "/api/auth/signup", { email: fixtures[1], password: "password123", display_name: "Renter R" });
  const trailer = await api("POST", "/api/trailers", { title: "UI verify trailer 7x14 dump", cat: "Dump Trailer", daily: 130, weekly: 700, deposit: 150, city: "Kerrville", state: "TX" }, owner.token);
  const thread = await api("POST", `/api/messages/start/${trailer.id}`, null, renter.token);
  await api("POST", `/api/messages/${thread.threadId}`, { text: "Hi! Is this dump trailer free next weekend?" }, owner.token);
  await api("POST", `/api/messages/${thread.threadId}`, { text: "Yes — Saturday works. Ramps and straps included." }, renter.token);

  /* ── 1. logged-out home: colors ── */
  await cdp.goto(B + "/#/home");
  await cdp.goto(B + "/#/home");
  const colors = await cdp.eval(`(() => {
    const cs = getComputedStyle(document.body);
    const top = cs.backgroundImage;
    const nav = getComputedStyle(document.querySelector('.navlink')).color;
    const stat = document.querySelector('.stat b') ? getComputedStyle(document.querySelector('.stat b')).color : null;
    const card = document.querySelector('.card');
    return { bgImage: top.slice(0, 120), bgColor: cs.backgroundColor, navColor: nav, statColor: stat, cards: !!card, amberVar: getComputedStyle(document.documentElement).getPropertyValue('--amber').trim(), asphaltVar: getComputedStyle(document.documentElement).getPropertyValue('--asphalt').trim() };
  })()`);
  check("body paints the new radial gradient (not flat asphalt)", /radial-gradient/.test(colors.bgImage), colors.bgImage.slice(0, 60));
  check("--asphalt lifted off the old #16181b", colors.asphaltVar.toLowerCase() !== "#16181b", colors.asphaltVar);
  check("--amber brightened", colors.amberVar.toLowerCase() === "#ffbe33", colors.amberVar);
  check("listing cards render on home", colors.cards);
  const homeShot = await cdp.shot("1-home-logged-out.png");

  /* ── 2. logged-out messages gate ── */
  await cdp.goto(B + "/#/messages");
  const gate = await cdp.eval(`(() => { const b = document.querySelector('.sec-sub button'); return { text: b ? b.textContent : null, href: null }; })()`);
  check("Messages gate offers Google login", gate.text === "log in with Google", JSON.stringify(gate.text));
  const gateShot = await cdp.shot("2-messages-gate.png");

  /* ── 3. sign in (inject token like the OAuth callback does) ── */
  await cdp.eval(`localStorage.setItem('rmt-token', ${JSON.stringify(renter.token)});
    localStorage.setItem('rmt-user', ${JSON.stringify(JSON.stringify({ ...renter.user, bio: "ui verify", tier: "free" }))});
    localStorage.setItem('rmt-onboarded','1'); localStorage.setItem('rmt-intro-seen','1'); true;`);
  // the real Google callback lands on a fresh document load with the token stored
  await cdp.goto(B + "/?v=" + Date.now() + "#/home");
  await cdp.hardReload();
  await cdp.goto(B + "/?v=" + Date.now() + "#/home");

  /* ── 4. account chip shows the RMT logo as the default avatar ── */
  const chip = await cdp.eval(`(() => {
    const img = document.querySelector('.acct .acct-ava');
    if (!img) return { tag: null };
    const cs = getComputedStyle(img);
    return { tag: img.tagName, src: img.getAttribute('src') || '', w: img.getBoundingClientRect().width, radius: cs.borderRadius };
  })()`);
  check("account chip renders an <img> avatar (logo, not a letter)", chip.tag === "IMG", JSON.stringify({ tag: chip.tag, src: (chip.src || "").slice(0, 40) }));
  check("chip avatar points at the rmt-badge asset", /rmt-badge/i.test(chip.src || ""), (chip.src || "").split("/").pop());
  check("chip avatar is circular and sized", Math.round(chip.w) === 26 && chip.radius.startsWith("50%"), `w=${chip.w} r=${chip.radius}`);
  const chipShot = await cdp.shot("3-home-logged-in.png");

  /* ── 5. DM panel: threads, bubbles, emoji picker, smart text ── */
  await cdp.goto(B + "/#/messages/" + thread.threadId);
  const panel = await cdp.eval(`(() => {
    const bubbles = [...document.querySelectorAll('.bubble')];
    const mine = bubbles.filter(b => b.classList.contains('mine'));
    const theirs = bubbles.filter(b => b.classList.contains('theirs'));
    const mineP = mine[0] && getComputedStyle(mine[0].querySelector('p'));
    const emojiBtn = [...document.querySelectorAll('.composer button')].find(b => b.textContent.trim() === '😀');
    return {
      threadCount: document.querySelectorAll('.thread').length,
      total: bubbles.length, mine: mine.length, theirs: theirs.length,
      mineBg: mineP ? mineP.backgroundImage.slice(0, 70) : null,
      mineColor: mineP ? mineP.color : null,
      mineWeight: mineP ? mineP.fontWeight : null,
      emojiBtn: !!emojiBtn,
      composerInput: !!document.querySelector('.composer input'),
      headHint: document.querySelector('.threadhead-meta + .threadhead-meta') ? document.querySelector('.threadhead-meta + .threadhead-meta').textContent.slice(0, 40) : null,
      avatars: document.querySelectorAll('.bubble .bav').length,
    };
  })()`);
  check("DM thread list renders the conversation", panel.threadCount >= 1, `threads=${panel.threadCount}`);
  check("both sides' bubbles render", panel.mine >= 1 && panel.theirs >= 1, `mine=${panel.mine} theirs=${panel.theirs}`);
  check("'mine' bubbles use the amber→orange gradient", /gradient/.test(panel.mineBg || ""), panel.mineBg);
  check("per-message avatar widgets render", panel.avatars === panel.total, `${panel.avatars}/${panel.total}`);
  check("emoji picker button present in composer", panel.emojiBtn);
  check("thread header shows the founding phone-exchange note", /founding 1,000/.test(panel.headHint || ""), panel.headHint);

  /* emoji picker opens + inserts (React re-renders async — wait a tick) */
  const emoji = await cdp.eval(`(async () => {
    const tick = () => new Promise(r => setTimeout(r, 250));
    const btn = [...document.querySelectorAll('.composer button')].find(b => b.textContent.trim() === '😀');
    btn.click();
    await tick();
    const grid = btn.parentElement.querySelector('div[style*="display: grid"]');
    const opts = grid ? [...grid.querySelectorAll('button')] : [];
    const n = opts.length;
    if (opts[5]) opts[5].click();
    await tick();
    const input = document.querySelector('.composer input');
    return { n, value: input.value, gridCols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0 };
  })()`);
  check("emoji picker opens with a 24-emoji grid", emoji.n === 24 && emoji.gridCols === 8, `opts=${emoji.n} cols=${emoji.gridCols}`);
  check("clicking an emoji appends it to the draft", emoji.value.length > 0, JSON.stringify(emoji.value));

  /* smart text: type through the real React input path */
  const smart = await cdp.eval(`(() => {
    const input = document.querySelector('.composer input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const type = (v) => { setter.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); return input.value; };
    const a = type('teh trailor is okk ,plz call');
    const b = type('i recieve it tomorow ,thx');
    const c = type('the trailer is fine');
    return { a, b, c };
  })()`);
  check("smart text fixes typos (teh→the, trailor→trailer, okk→OK)", /the trailer/.test(smart.a) && /plz/.test(smart.a) === false, smart.a);
  check("smart text fixes punctuation spacing", / ,/.test(smart.a) === false && /, /.test(smart.a), smart.a);
  check("smart text expands shorthand (recieve→receive, thx→thanks)", /receive/.test(smart.b) && /thanks/.test(smart.b), smart.b);
  check("smart text leaves clean sentences untouched", smart.c === "the trailer is fine", smart.c);
  const dmShot = await cdp.shot("4-messages-dm.png");

  /* ── 6. phone gate in the real UI — both sides of the 1,000-seat deadline ── */
  const sendFromUi = async (txt) => cdp.eval(`(async () => {
    const input = document.querySelector('.composer input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(txt)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.composer button')].find(b => b.textContent.trim() === 'Send').click();
    await new Promise(r => setTimeout(r, 1600));
    const err = document.querySelector('.coupon-no');
    return { err: err ? err.textContent.slice(0, 500) : null };
  })()`);
  const setRank = async (email, rank) => { const { DatabaseSync } = await import("node:sqlite"); const d = new DatabaseSync(path.join(process.cwd(), "server", "rentmytrailer.db")); d.prepare("UPDATE users SET signup_rank=? WHERE email=?").run(rank, email); d.close(); };

  await cdp.goto(B + "/#/messages/" + thread.threadId);
  // founder (inside the first 1,000) exchanges numbers free
  await setRank(fixtures[1], 42);
  const founderPhone = await sendFromUi("call me 555-321-9876");
  check("founding member exchanges a phone number free", !founderPhone.err, founderPhone.err || "sent, no error");

  // past the deadline: 10% fee tier, number-sharing gated
  await setRank(fixtures[1], 5000);
  await cdp.goto(B + "/#/messages/" + thread.threadId);
  const phoneGate = await sendFromUi("text me 555-321-9876");
  check("user past the 1,000 seats is blocked from sharing a number", /founding-member perk/.test(phoneGate.err || ""), phoneGate.err);
  check(
    "the block message explains the post-deadline terms",
    /premium/.test(phoneGate.err || "") && /keep chatting on-platform/.test(phoneGate.err || "") && /10% plus 10\.25% CA sales tax/.test(phoneGate.err || ""),
    phoneGate.err
  );
  const phoneShot = await cdp.shot("5-phone-gate.png");

  /* ── 7. browse page: cards render; remote images depend on outbound network ── */
  await cdp.goto(B + "/#/browse");
  const browse = await cdp.eval(`(() => {
    const imgs = [...document.querySelectorAll('.card img')];
    const first = imgs[0] || null;
    return {
      cards: document.querySelectorAll('.card').length,
      withImg: imgs.length,
      // newest rows can be imageless user listings — assert on any card that has one
      imgSrc: first ? (first.getAttribute('src') || '').slice(0, 46) : null,
      imgDecoded: first ? first.naturalWidth > 0 : false,
      prices: document.querySelectorAll('.price-day').length,
      filters: document.querySelectorAll('.filters select').length,
    };
  })()`);
  const net = await cdp.eval(`fetch('https://neighborstrailer.com/', {method:'HEAD'}).then(()=>'ok').catch(e=>'offline')`);
  check("browse grid renders cards from live API", browse.cards > 0 && browse.prices > 0, `cards=${browse.cards} prices=${browse.prices}`);
  check("cards carry listing image URLs", browse.withImg > 0 && /^https?:\/\//.test(browse.imgSrc || ""), `${browse.withImg}/${browse.cards} cards with img · ${browse.imgSrc}`);
  if (net === "ok") check("remote listing images decode", browse.imgDecoded, `decoded=${browse.imgDecoded}`);
  else console.log(`… skipped remote-image decode check — no outbound network (fetch said: ${net})`);
  check("browse filter widgets present", browse.filters === 4, `filters=${browse.filters}`);
  const browseShot = await cdp.shot("6-browse.png");

  console.log("\nshots:", [homeShot, gateShot, chipShot, dmShot, phoneShot, browseShot].map((p) => path.basename(p)).join(", "));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log("FAILED:", failed.map((f) => f.label).join(" | ")); process.exitCode = 1; }
} finally {
  chrome.kill("SIGKILL");
  /* leave the live DB exactly as we found it */
  try {
    const { cleanupTestData } = await import("./cleanup-test-data.js");
    const r = cleanupTestData();
    console.log(`cleanup: ${r.users} fixture user(s), ${r.trailers} trailer(s) removed`);
  } catch (e) { console.log("cleanup skipped:", String(e).slice(0, 120)); }
}
