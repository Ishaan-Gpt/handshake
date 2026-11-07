// The hero scene is the product itself: your agent and theirs, each in a private room with its owner and a sealed limit,
// a Switch table between them, and the offers of a real recorded deal crossing it. Drawn as SVG for wide and tall screens.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const money = (v) => (v >= 1e4 ? `$${(v / 1e3).toFixed(1).replace(".0", "")}K` : `$${v}`);

// Two layouts of the same drawing. Rooms, people, agent tiles, sealed chips, doors and the hub.
const LAYOUT = {
  wide: { vb: [1200, 540], hub: [600, 262], r: 64,
    L: { room: [40, 50, 340, 430], label: [68, 88], person: [112, 236], tile: [196, 176, 120], chip: [68, 384, 230], door: [380, 262] },
    R: { room: [820, 50, 340, 430], label: [848, 88], person: [1088, 236], tile: [884, 176, 120], chip: [902, 384, 230], door: [820, 262] } },
  tall: { vb: [400, 860], hub: [200, 430], r: 52,
    L: { room: [16, 16, 368, 290], label: [40, 50], person: [74, 150], tile: [200, 88, 110], chip: [40, 236, 220], door: [200, 306] },
    R: { room: [16, 554, 368, 290], label: [40, 588], person: [326, 688], tile: [90, 626, 110], chip: [140, 774, 220], door: [200, 554] } },
};
const SIDES = {
  L: { label: "YOUR ROOM", who: "You", agent: "Claude Code", icon: "#i-claude", limit: 90000, note: "SEALED · ONLY YOU" },
  R: { label: "THEIR ROOM", who: "Them", agent: "Cursor", icon: "#i-cube", limit: 78000, note: "SEALED · ONLY THEM" },
};
// The real deal on Switch (priya and tomas, the design retainer), in order.
const DEAL = [["L", 60000], ["R", 110000], ["X"], ["L", 67500], ["R", 102000], ["L", 75000], ["R", 94000], ["L", 82500], ["R", 86000], ["A", 86000]];

function node(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.append(el);
  return el;
}
function text(parent, x, y, cls, str, anchor = "start") {
  const t = node("text", { x, y, class: cls, "text-anchor": anchor }, parent); t.textContent = str; return t;
}

function draw(svg, lay) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${lay.vb[0]} ${lay.vb[1]}`);
  const tall = lay === LAYOUT.tall, parts = { svg };
  const [hx, hy] = lay.hub;
  // The bridge: a soft rail and an ink line from door to door through the hub.
  const d = `M${lay.L.door[0]} ${lay.L.door[1]} L${lay.R.door[0]} ${lay.R.door[1]}`;
  node("path", { d, class: "sc-rail" }, svg);
  node("path", { d, class: "sc-bridge", "stroke-dasharray": "2 8" }, svg);
  for (const k of ["L", "R"]) {
    const s = lay[k], meta = SIDES[k], g = node("g", { class: "sc-side" }, svg);
    const [x, y, w, h] = s.room;
    parts[k] = { g };
    parts[k].glow = node("rect", { x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: 34, class: "sc-glow" }, g);
    node("rect", { x, y, width: w, height: h, rx: 28, class: "sc-room" }, g);
    // The wall facing the bridge, with the one door Switch controls.
    const [dx, dy] = s.door;
    if (!tall) { node("path", { d: `M${dx} ${y + 18} V${dy - 34} M${dx} ${dy + 34} V${y + h - 18}`, class: "sc-wall" }, g); }
    else { node("path", { d: `M${x + 18} ${dy} H${dx - 34} M${dx + 34} ${dy} H${x + w - 18}`, class: "sc-wall" }, g); }
    text(g, s.label[0], s.label[1], "sc-label", meta.label);
    // Owner: a person, tied to their agent by a short line.
    const [px, py] = s.person;
    const person = node("g", { class: "sc-person" }, g);
    node("circle", { cx: px, cy: py - 22, r: 15 }, person);
    node("path", { d: `M${px - 26} ${py + 30} C${px - 24} ${py + 2} ${px - 12} ${py - 2} ${px} ${py - 2} C${px + 12} ${py - 2} ${px + 24} ${py + 2} ${px + 26} ${py + 30}` }, person);
    text(g, px, py + 56, "sc-label", meta.who.toUpperCase(), "middle");
    const [tx, ty, ts] = s.tile, tcx = tx + ts / 2, tcy = ty + ts / 2;
    const link = tall ? `M${px + (k === "L" ? 30 : -30)} ${py} L${k === "L" ? tx - 6 : tx + ts + 6} ${py}` : `M${px + 30} ${py} L${tx - 6} ${py}`;
    node("path", { d: k === "R" && !tall ? `M${px - 30} ${py} L${tx + ts + 6} ${py}` : link, class: "sc-bridge", "stroke-dasharray": "3 5" }, g);
    node("rect", { x: tx, y: ty, width: ts, height: ts, rx: 26, class: "sc-tile" }, g);
    const ic = ts * 0.5;
    node("use", { href: meta.icon, x: tcx - ic / 2, y: tcy - ic / 2, width: ic, height: ic, color: "currentColor", style: "color:var(--ink)" }, g);
    text(g, tcx, ty + ts + 30, "sc-name", meta.agent, "middle");
    // The sealed limit.
    const [cx, cy, cw] = s.chip;
    const chip = node("g", {}, g);
    node("rect", { x: cx, y: cy, width: cw, height: 62, rx: 14, class: "sc-chip" }, chip);
    node("use", { href: "#i-lock", x: cx + 12, y: cy + 15, width: 30, height: 30, style: "color:var(--ink)" }, chip);
    text(chip, cx + 50, cy + 32, "sc-chip-t", money(meta.limit));
    text(chip, cx + 50, cy + 50, "sc-chip-s", meta.note);
    parts[k].yes = node("g", { opacity: 0 }, g);
    node("rect", { x: px - 30, y: py - 84, width: 60, height: 28, rx: 14, class: "sc-yes" }, parts[k].yes);
    text(parts[k].yes, px, py - 64, "sc-chip-s", "YES ✓", "middle");
    parts[k].tile = [tcx, tcy];
    parts[k].door = s.door;
  }
  // The hub: Switch, holding the table.
  parts.ring = node("circle", { cx: hx, cy: hy, r: lay.r + 10, fill: "none", stroke: "var(--ink)", "stroke-width": 1.5, opacity: .25 }, svg);
  node("circle", { cx: hx, cy: hy, r: lay.r, class: "sc-hub" }, svg);
  parts.hubT = text(svg, hx, hy + 2, "sc-hub-t", "Switch", "middle");
  parts.hubS = text(svg, hx, hy + 22, "sc-hub-s", "THE TABLE", "middle");
  parts.no = text(svg, hx, hy - lay.r - 18, "sc-403", "", "middle");
  parts.sigLayer = node("g", {}, svg);
  return parts;
}

// A point at distance t (0..1) along a polyline.
function along(pts, t) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = t * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const u = seg[i] ? Math.min(1, d / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
    d -= seg[i];
  }
  return pts.at(-1);
}

function signal(parts, label, bad) {
  const g = node("g", { class: "sc-sig" + (bad ? " sc-sig--bad" : ""), opacity: 0 }, parts.sigLayer);
  const w = bad ? 210 : 96;
  node("rect", { x: -w / 2, y: -19, width: w, height: 38, rx: 19 }, g);
  text(g, 0, 6, "", label, "middle");
  return g;
}

function play(parts, lay) {
  const cap = $("[data-scene-cap]");
  const say = (s) => { if (cap.textContent !== s) { gsap.to(cap, { opacity: 0, duration: .2, onComplete: () => { cap.textContent = s; gsap.to(cap, { opacity: 1, duration: .35 }); } }); } };
  const route = (from) => { const a = parts[from], b = parts[from === "L" ? "R" : "L"]; return [a.tile, a.door, lay.hub, b.door, b.tile]; };
  const tl = gsap.timeline({ repeat: -1, repeatDelay: .4, defaults: { ease: "power2.inOut" } });
  tl.add(() => { say("Replaying a real deal on Switch"); parts.hubT.textContent = "Switch"; parts.hubS.textContent = "THE TABLE"; }, 0);
  tl.to({}, { duration: .9 });
  for (const step of DEAL) {
    const [who, price] = step;
    if (who === "X") { // their side tries to order your agent about
      const g = signal(parts, "@claude-code accept $110K", true), pts = route("R").slice(0, 3), o = { t: 0 };
      tl.add(() => say("Their side orders your agent to accept. Switch refuses it at the table."));
      tl.set(g, { opacity: 1 });
      tl.to(o, { t: 1, duration: 1.4, onUpdate: () => { const [x, y] = along(pts, o.t * .86); g.setAttribute("transform", `translate(${x} ${y})`); } });
      tl.add(() => { parts.no.textContent = "403 · REFUSED BY SWITCH"; });
      const k = { s: 0 }; // a refused knock: a short damped shake where it was stopped
      tl.to(k, { s: 1, duration: .55, ease: "none", onUpdate: () => { const [x, y] = along(pts, .86); g.setAttribute("transform", `translate(${x + Math.sin(k.s * 34) * 7 * (1 - k.s)} ${y})`); } });
      tl.to(g, { opacity: 0, duration: .5, ease: "power2.in" }, "+=.5");
      tl.add(() => { parts.no.textContent = ""; });
      continue;
    }
    const from = who === "A" ? "L" : who, side = parts[from];
    const g = signal(parts, who === "A" ? `accept ${money(price)}` : money(price)), o = { t: 0 };
    const pts = who === "A" ? route("L").slice(0, 3) : route(from);
    tl.add(() => say(who === "A" ? `You said yes. Your agent accepts ${money(price)}.` : `${from === "L" ? "You" : "They"} said yes, so ${from === "L" ? "your" : "their"} agent offers ${money(price)}.`));
    tl.fromTo(side.yes, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .35, ease: "back.out(2)" });
    tl.set(g, { opacity: 1 }, "+=.15");
    tl.to(o, { t: 1, duration: who === "A" ? 1.1 : 1.6, onUpdate: () => { const [x, y] = along(pts, o.t); g.setAttribute("transform", `translate(${x} ${y})`); } });
    tl.to(side.yes, { opacity: 0, duration: .3 }, "<.2");
    tl.to(g, { opacity: 0, duration: .3 }, who === "A" ? ">" : ">-.15");
  }
  // The handshake: the hub shows the price, both rooms light up, and neither limit ever moved.
  tl.add(() => { parts.hubT.textContent = "$86K"; parts.hubS.textContent = "AGREED"; say("Deal at $86K. Neither agent ever saw the other side's limit."); });
  tl.to([parts.L.glow, parts.R.glow], { opacity: 1, duration: .5, stagger: .08, ease: "power2.out" });
  tl.to(parts.ring, { attr: { r: lay.r + 34 }, opacity: 0, duration: 1.2, ease: "expo.out" }, "<");
  tl.to([parts.L.glow, parts.R.glow], { opacity: 0, duration: .8 }, "+=2.6");
  tl.set(parts.ring, { attr: { r: lay.r + 10 }, opacity: .25 });
  return tl;
}

function scene() {
  const svg = $("[data-scene-svg]");
  if (!svg || !window.gsap) return;
  let mode = null, tl = null, visible = true;
  const build = () => {
    const m = innerWidth < 760 ? "tall" : "wide";
    if (m === mode) return;
    mode = m; tl?.kill();
    const parts = draw(svg, LAYOUT[m]);
    if (reduce) { parts.hubT.textContent = "$86K"; parts.hubS.textContent = "AGREED"; $("[data-scene-cap]").textContent = "A real deal on Switch closed at $86K"; return; }
    tl = play(parts, LAYOUT[m]);
    if (!visible) tl.pause();
  };
  build();
  addEventListener("resize", build);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; tl && (visible ? tl.resume() : tl.pause()); }).observe(svg);
}

function page() {
  // Smooth scroll, anchored links.
  if (window.Lenis && !reduce) {
    const lenis = new Lenis({ lerp: .1 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => { const t = $(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -70, duration: 1.3 }); } }));
  }
  // The headline arrives word by word, each on its own clock.
  const h = $(".hero .h-xl");
  const walk = (el) => [...el.childNodes].forEach((n) => {
    if (n.nodeType === 3) { const f = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach((w) => { if (!w.trim()) return f.append(w); const s = document.createElement("span"); s.className = "w"; s.textContent = w; f.append(s); }); n.replaceWith(f); }
    else walk(n);
  });
  walk(h);
  $$(".w", h).forEach((w, i) => (w.style.transitionDelay = (i * 0.055 + Math.random() * 0.03).toFixed(3) + "s"));
  (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(() => h.classList.add("in")));
  // Reveals, staggered with a little jitter inside each section; counters count up once.
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); io.unobserve(e.target);
    $$("[data-count]", e.target).forEach((c) => {
      const to = +c.dataset.count; if (!to || reduce || !window.gsap) return;
      const o = { v: 0 }; gsap.to(o, { v: to, duration: 1.4, ease: "expo.out", onUpdate: () => (c.textContent = Math.round(o.v)) });
    });
  }), { rootMargin: "0px 0px -12% 0px" });
  $$("section").forEach((sec) => $$("[data-rise]", sec).forEach((el, i) => { el.style.setProperty("--d", (i * 0.07 + Math.random() * 0.03).toFixed(3) + "s"); io.observe(el); }));
  // Tabs and copy buttons.
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
  }));
  $$(".copy").forEach((b) => b.addEventListener("click", async () => {
    const code = b.parentElement.querySelector("code").innerText;
    try { await navigator.clipboard.writeText(code); b.textContent = "Copied"; } catch { b.textContent = "Select and copy"; }
    setTimeout(() => (b.textContent = "Copy"), 1600);
  }));
}

const go = () => { page(); scene(); };
if (document.readyState === "loading") addEventListener("DOMContentLoaded", go); else go();
