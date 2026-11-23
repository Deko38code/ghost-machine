import puppeteer from "/home/ghost694/haksterAi/node_modules/puppeteer/lib/puppeteer/puppeteer.js";
import fs from "node:fs";

const html = fs.readFileSync("/home/ghost694/phantom-ide.html", "utf8");
const start = html.indexOf('<section id="admin-panel-inbox"');
const end = html.indexOf("</section>", start) + "</section>".length;
if (start < 0 || end < 12) { console.log("SECTION NOT FOUND"); process.exit(1); }
const section = html.slice(start, end);
console.log("section bytes", section.length);

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
await page.goto("http://127.0.0.1:4000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const hasFns = await page.evaluate(() => ({
  render: typeof renderAdminInbox, start: typeof startAdminInbox, send: typeof sendAdminInbox, load: typeof loadAdminInbox,
}));
console.log("functions", JSON.stringify(hasFns));

for (const [w, h] of [[360, 640], [390, 844], [414, 896], [1440, 900], [1920, 1080]]) {
  await page.setViewport({ width: w, height: h });
  const result = await page.evaluate((markup) => {
    document.querySelectorAll("#inbox-test-wrap").forEach((n) => n.remove());
    const wrap = document.createElement("div");
    wrap.id = "inbox-test-wrap";
    wrap.style.cssText = "position:fixed;inset:0;z-index:9;overflow:auto;background:#050806;padding:8px;box-sizing:border-box;";
    const modal = document.createElement("div");
    modal.style.cssText = "width:min(1180px,96vw);margin:0 auto;";
    modal.innerHTML = markup;
    wrap.appendChild(modal);
    document.body.appendChild(wrap);

    renderAdminInbox({ source: "junkalot", messages: [
      { id: "a", at: "2026-11-23T10:38:40Z", dir: "to-client", title: "An apology, and a promise from Phantom IDE", body: "A long message body that keeps going so the row has to wrap across several lines at phone width without pushing the panel sideways." },
      { id: "b", at: "2026-11-23T11:02:00Z", dir: "to-phantom", title: "Re: online payments", body: "She replies from her panel; this is the inbound direction the bridge returns." },
    ]});
    const sectionEl = document.getElementById("admin-panel-inbox");
    const box = sectionEl.getBoundingClientRect();
    const overflow = [];
    const vw = document.documentElement.clientWidth;
    for (const el of sectionEl.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5)) overflow.push((el.id || el.tagName) + " " + Math.round(r.left) + ".." + Math.round(r.right) + " of " + vw);
    }
    const list = document.getElementById("admin-inbox-list");
    const rows = list ? list.children.length : -1;
    const listOverflow = list ? list.scrollWidth - list.clientWidth : -1;
    const controls = ["admin-inbox-view", "admin-inbox-send-via", "admin-inbox-to", "admin-inbox-subject", "admin-inbox-body", "admin-inbox-send"].map((id) => {
      const el = document.getElementById(id);
      if (!el) return id + ":missing";
      const r = el.getBoundingClientRect();
      return id + " h" + Math.round(r.height) + " r" + Math.round(r.right);
    });
    const gmail = (() => { renderAdminInbox({ source: "gmail", messages: [{ id: "g", from: "Susie <susanschlamp53@gmail.com>", subject: "Re: my account", date: "Sun, 23 Nov 2026 09:15:00 -0500", snippet: "Thank you — the payments page loaded fine on my Windows laptop." }] }); return document.getElementById("admin-inbox-list").children.length; })();
    return {
      viewport: vw, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sectionLeft: Math.round(box.left), sectionRight: Math.round(box.right), sectionW: Math.round(box.width),
      listRows: rows, listOverflow, gmailRows: gmail, controls, overflow: overflow.slice(0, 6), overflowCount: overflow.length,
    };
  }, section);
  console.log(w + "x" + h, JSON.stringify(result));
}

await page.evaluate(() => { document.querySelectorAll("#inbox-test-wrap").forEach((n) => n.remove()); });
console.log("pageerrors", JSON.stringify(errors));
await browser.close();
