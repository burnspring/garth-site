// Capture the tour's frames from a running Garth, scene by scene, timed to the
// narration (audio/<id>.pcm). See README.md for the demo install it expects.
import { connect, sleep } from "./cdp.mjs";
import fs from "fs";
const G = (process.env.GARTH_URL ?? "http://127.0.0.1:8094").replace(/\/$/, "");
const WHO = process.env.GARTH_USER ?? "maya.chen";       // an administrator in the demo data
const PROJECT = process.env.GARTH_PROJECT;                 // the project the session is filmed on
const PROMPT = process.env.GARTH_PROMPT ?? "Add a GET /orders route that returns three sample orders as JSON, and list it in the README. Don't commit; I'll review the diff. Reply in two short sentences, no emoji.";
const CARD = "http://localhost:8765/card.html";
const dur = (id) => fs.statSync(`audio/${id}.pcm`).size / 32000;
const LEAD = 0.5, TAIL = 0.8;
const only = process.argv[2]; // capture one scene for a look
if (!PROJECT) { console.error("set GARTH_PROJECT to the demo project's id"); process.exit(2); }

const c = await connect();
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
const go = async (u, w = 4000) => { await c.send("Page.navigate", { url: u }); await sleep(w); };
await go(G + "/login", 2500);
// The demo install runs development sign-in on loopback, so any demo person signs in by name.
console.log("sign-in", await c.evalJS(`fetch('/api/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(WHO)}})}).then(r=>r.status)`));

// On-screen label and a visible cursor, injected into whatever page is showing.
const overlay = (label) => c.evalJS(`(() => {
  let s = document.getElementById("__tour"); if (s) s.remove();
  s = document.createElement("div"); s.id = "__tour";
  s.innerHTML = ${JSON.stringify(label)} ? '<div class="chip">' + ${JSON.stringify(label || "")} + '</div>' : '';
  s.innerHTML += '<div class="cur"></div>';
  const st = document.createElement("style"); st.textContent = \`
   #__tour .chip{position:fixed;left:28px;bottom:26px;z-index:2147483647;background:#1e3a8a;color:#fff;font:600 19px/1 Geist,Inter,system-ui,sans-serif;padding:13px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.28);letter-spacing:-.01em;animation:__in .5s ease-out}
   #__tour .cur{position:fixed;left:-40px;top:-40px;width:22px;height:22px;z-index:2147483647;border-radius:50%;background:rgba(40,85,196,.35);border:2px solid #2855c4;transition:left .7s cubic-bezier(.4,0,.2,1),top .7s cubic-bezier(.4,0,.2,1),transform .15s;pointer-events:none;transform:translate(-50%,-50%)}
   #__tour .cur.down{transform:translate(-50%,-50%) scale(.7)}
   @keyframes __in{from{opacity:0;transform:translateY(10px)}to{opacity:1}}\`;
  s.appendChild(st); document.body.appendChild(s); return true; })()`);
const findJS = (sel, text) => `[...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.offsetParent !== null && ${text ? `e.textContent.trim().match(${text})` : "true"})`;
const point = async (sel, text) => {
  const ok = await c.evalJS(`(() => { const e = ${findJS(sel, text)}; if (!e) return false; e.scrollIntoView({block:"nearest"}); const r = e.getBoundingClientRect(); const k = document.querySelector("#__tour .cur"); if (k) { k.style.left = (r.left + Math.min(r.width/2, 60)) + "px"; k.style.top = (r.top + r.height/2) + "px"; } return true; })()`);
  if (!ok) console.error("not found", sel, text); await sleep(850); return ok;
};
const click = async (sel, text) => {
  if (!(await point(sel, text))) return;
  await c.evalJS(`(() => { const k = document.querySelector("#__tour .cur"); k && k.classList.add("down"); setTimeout(() => k && k.classList.remove("down"), 180); ${findJS(sel, text)}.click(); })()`);
};
// Types into an input or a textarea the way React hears it.
const type = async (sel, str, ms = 45) => {
  await point(sel);
  await c.evalJS(`${findJS(sel)}.focus()`);
  for (let i = 1; i <= str.length; i++) {
    await c.evalJS(`(() => { const e = ${findJS(sel)}; const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), "value").set; set.call(e, ${JSON.stringify(str)}.slice(0, ${i})); e.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await sleep(ms);
  }
};
const scroll = async (px, ms, within) => {   // smooth scroll by px over ms, on the window or the biggest scroller (or one inside `within`)
  const steps = Math.round(ms / 33);
  for (let i = 0; i < steps; i++) {
    await c.evalJS(`(() => { const d = ${px / steps}; const root = ${within ? `document.querySelector(${JSON.stringify(within)})` : "document"} || document; const cands = [document.scrollingElement, ...root.querySelectorAll("*")].filter(e => e && e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY) || e === document.scrollingElement); const el = cands.sort((a,b) => b.clientHeight - a.clientHeight).find(e => e.scrollHeight > e.clientHeight + 5) || document.scrollingElement; el.scrollBy(0, d); })()`);
    await sleep(33);
  }
};
const card = (h, p) => `${CARD}?h=${encodeURIComponent(h)}&p=${encodeURIComponent(p)}`;
const busy = () => c.evalJS(`!!document.querySelector('button[aria-label="Steer"]')`);
// Off the clock: let the agent finish its turn, then have the Changes panel read git again.
const untilAgentDone = async () => {
  for (let i = 0; i < 300 && (await busy()); i++) await sleep(1000);
  await sleep(1500);
  await c.evalJS(`[...document.querySelectorAll("button")].find(b => /^Refresh$/.test(b.textContent.trim()))?.click()`);
  await sleep(2500);
};

// Each scene: audio id, label, prepare (before the clock), then segments run on the clock.
const scenes = [
  { id: "01", segs: [{ prep: () => go("about:blank", 300), url: card("A coding agent for your team. <em>On your own cluster.</em>", "A two-minute tour"), act: async () => {} }] },
  { id: "02", label: "Projects are git repositories", segs: [{ prep: () => go(G + "/", 4000), act: async () => { await sleep(1500); await click("button", /^All projects/); await sleep(1500); await point("a,span,div", /^orders-service$/); } }] },
  { id: "03", label: "What the agent reads", segs: [{ prep: () => go(G + `/projects/${PROJECT}`, 4500), act: async () => { await sleep(1200); await point("div,span,h2,h3", /^Recent commits on main$/); await sleep(1500); await point("div,span,h2,h3", /^What the agent reads$/); await sleep(800); await point("code,span,a", /^AGENTS\.md$/); await sleep(900); await point("code,span,a", /^memory\/$/); await sleep(900); await point("code,span,a", /^\.pi\/skills\/$/); } }] },
  { id: "04", label: "Its own sandbox, its own branch", extra: 1.5, segs: [{ prep: async () => {}, act: async () => { await sleep(900); await click("button", /Start a session/); } }] },
  { id: "05", label: "Ask in plain words", extra: 3, segs: [{ prep: async () => { for (let i = 0; i < 120 && !(await c.evalJS(`(() => { const t = document.querySelector('textarea[aria-label="Message the agent"]'); return !!t && !t.disabled; })()`)); i++) await sleep(1000); }, act: async () => { await sleep(400); await type('textarea[aria-label="Message the agent"]', PROMPT, 22); await sleep(300); await click('button[aria-label="Send"]'); } }] },
  { id: "06", label: "Review the diff", extra: 2, segs: [{ prep: untilAgentDone, act: async () => { await sleep(800); await point("button", /^Changes/); await sleep(900); await click("button", /^View diff$/); await sleep(2500); await scroll(260, 2500, "[role=dialog]"); } }] },
  { id: "07", label: "Merge for the team", extra: 1.5, segs: [{ prep: async () => { await c.evalJS(`[...document.querySelectorAll("[role=dialog] button")].find(b => /^Close$/.test(b.textContent.trim()))?.click()`); await sleep(800); }, act: async () => { await sleep(500); await type('input[aria-label="Commit message"]', "Add GET /orders with sample orders", 35); await sleep(300); await click("button", /^Commit and push$/); await sleep(3000); await click("button", /^Merge into main/); } }] },
  { id: "08", label: "Work together", segs: [{ prep: async () => { await sleep(1500); }, act: async () => { await sleep(500); await click('button[aria-label="Session actions"]'); await sleep(900); await click("[role=menuitem]", /^Share session/); await sleep(1500); await point("[role=dialog] button,[role=dialog] [role=combobox]", null); } }] },
  { id: "09", label: "People and budgets", segs: [{ prep: () => go(G + "/admin/people", 4500), act: async () => { await sleep(1200); await point("th,button,span", /^Budget$/); await sleep(1500); await point("td,span,div", /^\$50\.00\/mo$/); } }] },
  { id: "10", label: "Costs, as they happen", segs: [{ prep: () => go(G + "/admin/costs", 5000), act: async () => { await sleep(1000); await click("button", /^7 days$/); await sleep(1500); await scroll(1000, 4000); } }] },
  { id: "11", label: "Fenced by network policy", segs: [{ prep: () => go(G + "/admin/sandbox", 4500), act: async () => { await sleep(1200); await point("*", /^Can reach$/); await sleep(1500); await point("*", /^The control plane/); await sleep(1500); await point("*", /^\d+ listed destinations/); await sleep(1800); await point("*", /^Can.t reach$/); await sleep(1300); await point("*", /^Instance metadata/); await sleep(1300); await point("*", /^The Kubernetes API$/); await sleep(1200); await point("*", /^Other sandboxes$/); } }] },
  { id: "12", label: "Your identity provider", segs: [{ prep: () => go(G + "/admin/sign-in", 4500), act: async () => { await sleep(1200); await point("button", /^Approval$/); await sleep(1300); await point("button", /^Invite only$/); } }] },
  { id: "13", segs: [{ prep: () => go("about:blank", 300), url: card("Garth is <em>free.</em>", "getgarth.com · Made and owned by Burnspring"), act: async () => {} }] },
];

fs.rmSync("web/frames", { recursive: true, force: true }); fs.mkdirSync("web/frames", { recursive: true });
const frames = []; let n = 0; let clock = null, segStart = 0;
c.on("Page.screencastFrame", (p) => {
  c.send("Page.screencastFrameAck", { sessionId: p.sessionId });
  if (clock === null) return;
  const f = String(n++).padStart(5, "0") + ".jpg";
  fs.writeFileSync("web/frames/" + f, Buffer.from(p.data, "base64"));
  frames.push({ f, t: segStart + Math.max(0, p.metadata.timestamp - clock) });
});
const manifest = { scenes: [], frames };
let t = 0;
for (const s of scenes) {
  if (only && s.id !== only) continue;
  const total = LEAD + dur(s.id) + TAIL + (s.extra || 0);
  manifest.scenes.push({ id: s.id, start: t, lead: LEAD });
  let used = 0;
  for (const [i, g] of s.segs.entries()) {
    const d = i === s.segs.length - 1 ? total - used : total * g.frac;
    await g.prep();
    if (g.url) await go(g.url, 200);
    if (s.label) await overlay(s.label);
    await sleep(300);
    // An exact first frame, then the screencast for motion.
    const shot = await c.send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
    const f = String(n++).padStart(5, "0") + ".jpg"; fs.writeFileSync("web/frames/" + f, Buffer.from(shot.data, "base64"));
    frames.push({ f, t: t + used });
    segStart = t + used;
    await c.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    clock = Date.now() / 1000;
    const end = Date.now() + d * 1000;
    await Promise.race([g.act().catch((e) => console.error(s.id, e.message)), sleep(d * 1000)]);
    const left = end - Date.now(); if (left > 0) await sleep(left);
    await c.send("Page.stopScreencast"); clock = null; await sleep(150);
    // Drop anything that arrived past this segment's end.
    while (frames.length && frames[frames.length - 1].t > segStart + d) frames.pop();
    used += d;
  }
  t += total;
  console.log(s.id, total.toFixed(1), "s, frames so far", frames.length);
}
frames.sort((a, b) => a.t - b.t);
manifest.total = t;
fs.writeFileSync("web/manifest.json", JSON.stringify(manifest));
console.log("total", t.toFixed(1), "frames", frames.length);
process.exit(0);
