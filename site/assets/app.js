// Handshake: an architect's cutaway of three rooms, and the real deal Switch recorded, replayed by your scroll.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const ready = (fn) => (document.readyState === "complete" ? fn() : addEventListener("load", fn));

  /* ------------------------------------------------------------------ the plan: three rooms in section */
  const ROOMS = { acme: [0.03, 0.36], deal: [0.36, 0.64], globex: [0.64, 0.97] };
  const LIT = { acme: 1, deal: 1, globex: 1 };

  function drawPlan(canvas, { dim = 0, light = LIT } = {}) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = css("--ink-950"), line = css("--cel-500"), lineSoft = css("--ink-600"), wax = css("--wax-500"), paper = css("--paper");
    g.fillStyle = ink; g.fillRect(0, 0, W, H);
    const floor = H * 0.86, ceil = H * 0.12, wallW = Math.max(6, W * 0.012);

    // Lamplight first, so the drawing sits in it: one warm-celadon pool per room, dimmed when a room goes dark.
    for (const [k, [a, b]] of Object.entries(ROOMS)) {
      const on = light[k] * (1 - dim);
      if (on <= 0.02) continue;
      const cx = W * (a + b) / 2, r = W * (b - a) * 0.9;
      const grd = g.createRadialGradient(cx, ceil + H * 0.08, 4, cx, floor, r);
      grd.addColorStop(0, `oklch(0.80 0.05 155 / ${0.28 * on})`);
      grd.addColorStop(0.45, `oklch(0.55 0.04 160 / ${0.12 * on})`);
      grd.addColorStop(1, "transparent");
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(cx - W * 0.02, ceil + H * 0.07); g.lineTo(cx + W * 0.02, ceil + H * 0.07);
      g.lineTo(W * b - wallW, floor); g.lineTo(W * a + wallW, floor); g.closePath(); g.fill();
    }

    // Section-cut walls with architectural hatching; the inner walls carry the hatches the slips pass through.
    const hatch = (x, y, w, h) => {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.fillStyle = css("--ink-800"); g.fillRect(x, y, w, h);
      g.strokeStyle = lineSoft; g.lineWidth = 1;
      for (let i = -h; i < w + h; i += 5) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i - h, y + h); g.stroke(); }
      g.restore(); g.strokeStyle = line; g.lineWidth = 1.2; g.strokeRect(x, y, w, h);
    };
    hatch(0, floor, W, H - floor);                         // the slab
    hatch(0, ceil - H * 0.04, W, H * 0.04);                // the roof
    hatch(W * ROOMS.acme[0] - wallW, ceil, wallW, floor - ceil);
    hatch(W * ROOMS.globex[1], ceil, wallW, floor - ceil);
    const hatchTop = floor - H * 0.36, hatchBot = floor - H * 0.24;
    for (const x of [W * ROOMS.acme[1], W * ROOMS.deal[1]]) {
      hatch(x - wallW / 2, ceil, wallW, hatchTop - ceil);
      hatch(x - wallW / 2, hatchBot, wallW, floor - hatchBot);
    }

    // Furniture in hairline: a desk in each war room, the long table in the middle, chairs, ceiling lamps.
    g.strokeStyle = line; g.lineWidth = 1.2; g.lineCap = "round";
    const desk = (cx, w) => { const y = floor - H * 0.2; g.beginPath(); g.moveTo(cx - w / 2, y); g.lineTo(cx + w / 2, y);
      g.moveTo(cx - w / 2 + 6, y); g.lineTo(cx - w / 2 + 6, floor); g.moveTo(cx + w / 2 - 6, y); g.lineTo(cx + w / 2 - 6, floor); g.stroke(); return y; };
    const chair = (x, dir) => { g.beginPath(); g.moveTo(x, floor); g.lineTo(x, floor - H * 0.11); g.moveTo(x, floor - H * 0.1);
      g.lineTo(x + dir * W * 0.025, floor - H * 0.1); g.lineTo(x + dir * W * 0.025, floor); g.moveTo(x, floor - H * 0.1); g.lineTo(x, floor - H * 0.2); g.stroke(); };
    const lamp = (cx, k) => { g.beginPath(); g.moveTo(cx, ceil); g.lineTo(cx, ceil + H * 0.05); g.stroke();
      g.beginPath(); g.moveTo(cx - W * 0.02, ceil + H * 0.075); g.quadraticCurveTo(cx, ceil + H * 0.035, cx + W * 0.02, ceil + H * 0.075); g.closePath();
      g.fillStyle = light[k] * (1 - dim) > 0.5 ? css("--cel-100") : css("--ink-700"); g.fill(); g.stroke(); };
    const aw = W * (ROOMS.acme[1] - ROOMS.acme[0]), gw = W * (ROOMS.globex[1] - ROOMS.globex[0]);
    const deskY = desk(W * (ROOMS.acme[0] + ROOMS.acme[1]) / 2, aw * 0.5);
    desk(W * (ROOMS.globex[0] + ROOMS.globex[1]) / 2, gw * 0.5);
    const tableY = desk(W * 0.5, W * (ROOMS.deal[1] - ROOMS.deal[0]) * 0.72);
    chair(W * ROOMS.acme[0] + aw * 0.16, 1); chair(W * ROOMS.globex[1] - gw * 0.16, -1);
    chair(W * 0.5 - W * 0.12, 1); chair(W * 0.5 + W * 0.12, -1);
    for (const k of Object.keys(ROOMS)) lamp(W * (ROOMS[k][0] + ROOMS[k][1]) / 2, k);

    // Back-wall panelling and the lamp's pool on the floor give each room its depth.
    for (const [k, [a, b]] of Object.entries(ROOMS)) {
      const on = light[k] * (1 - dim);
      g.save(); g.globalAlpha = 0.18 + 0.22 * on; g.strokeStyle = lineSoft; g.lineWidth = 1;
      for (let x = W * a + wallW + 14; x < W * b - wallW - 6; x += Math.max(18, W * 0.026)) {
        g.beginPath(); g.moveTo(x, ceil + H * 0.1); g.lineTo(x, floor - H * 0.3); g.stroke();
      }
      g.beginPath(); g.moveTo(W * a + wallW, floor - H * 0.27); g.lineTo(W * b - wallW, floor - H * 0.27); g.stroke();
      g.restore();
      if (on > 0.02) {
        const cx = W * (a + b) / 2, pool = g.createRadialGradient(cx, floor, 2, cx, floor, W * (b - a) * 0.45);
        pool.addColorStop(0, `oklch(0.85 0.05 155 / ${0.22 * on})`); pool.addColorStop(1, "transparent");
        g.fillStyle = pool; g.fillRect(W * a, floor - 6, W * (b - a), 12);
      }
    }
    // Asha and Gil at their desks, drawn in the same hairline: a person, not an avatar.
    const person = (x, dir, k) => {
      const on = light[k] * (1 - dim), y = floor - H * 0.2, r = Math.max(5, H * 0.032);
      g.save(); g.globalAlpha = 0.35 + 0.65 * on; g.strokeStyle = css("--cel-300"); g.lineWidth = 1.4;
      g.beginPath(); g.arc(x + dir * W * 0.006, y - H * 0.11, r, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x - dir * W * 0.004, y + H * 0.02);
      g.quadraticCurveTo(x - dir * W * 0.01, y - H * 0.06, x + dir * W * 0.008, y - H * 0.075);
      g.quadraticCurveTo(x + dir * W * 0.03, y - H * 0.06, x + dir * W * 0.035, y - H * 0.01); g.stroke();
      g.beginPath(); g.moveTo(x + dir * W * 0.02, y - H * 0.045); g.lineTo(x + dir * W * 0.05, y - H * 0.008); g.stroke();
      g.restore();
    };
    person(W * ROOMS.acme[0] + aw * 0.16, 1, "acme");
    person(W * ROOMS.globex[1] - gw * 0.16, -1, "globex");

    // Each war room's sealed playbook on its desk: the only oxblood in the drawing.
    for (const k of ["acme", "globex"]) {
      const cx = W * (ROOMS[k][0] + ROOMS[k][1]) / 2 + (k === "acme" ? -aw * 0.08 : gw * 0.08), ew = W * 0.05, eh = H * 0.035;
      g.save(); g.translate(cx, deskY - eh); g.rotate(k === "acme" ? -0.06 : 0.05);
      g.fillStyle = paper; g.globalAlpha = 0.25 + 0.75 * light[k] * (1 - dim); g.fillRect(-ew / 2, 0, ew, eh);
      g.beginPath(); g.moveTo(-ew / 2, 0); g.lineTo(0, eh * 0.55); g.lineTo(ew / 2, 0); g.strokeStyle = css("--paper-ink"); g.lineWidth = 0.8; g.stroke();
      g.beginPath(); g.arc(0, eh * 0.55, Math.max(3, W * 0.006), 0, Math.PI * 2); g.fillStyle = wax; g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
    return { deskY, tableY, hatchY: (hatchTop + hatchBot) / 2, W, H };
  }

  /* ------------------------------------------------------------------ slips through the hatch */
  const stage = $("[data-stage]"), plan = $("[data-plan]"), layer = $("[data-slips]");
  let geo = null;
  const relayout = () => { geo = drawPlan(plan); };

  function slip(side, price, label, { order = false } = {}) {
    const el = document.createElement("div");
    el.className = `slip slip--${side}${order ? " slip--order" : ""}`;
    el.innerHTML = `<b>${price}</b><i>${label}</i><span class="stamp">${order ? "REFUSED" : "APPROVED"}</span>`;
    layer.append(el);
    return el;
  }
  function path(side, el) {
    const W = geo.W, H = geo.H, w = el.offsetWidth, h = el.offsetHeight;
    const fromX = side === "acme" ? W * 0.13 : W * 0.87 - w, deskY = geo.deskY - h - H * 0.06;
    const hatchX = side === "acme" ? W * ROOMS.acme[1] - w / 2 : W * ROOMS.deal[1] - w / 2;
    const tableX = side === "acme" ? W * 0.5 - w - 6 : W * 0.5 + 6;
    return { fromX, deskY, hatchX, hatchY: geo.hatchY - h / 2, tableX, tableY: geo.tableY - h - 4 };
  }
  function pass(side, price, label, opts = {}) {
    const el = slip(side, price, label, opts), p = path(side, el), rot = side === "acme" ? -3 : 3;
    const tl = gsap.timeline();
    gsap.set(el, { x: p.fromX, y: p.deskY, rotate: rot * 2, opacity: 0 });
    tl.to(el, { opacity: 1, y: p.deskY - 8, duration: 0.4, ease: "power2.out" })
      .add(() => el.classList.add("approved"), "+=0.35")
      .to(el, { x: p.hatchX, y: p.hatchY, rotate: 0, duration: 0.8, ease: "power2.inOut" }, "+=0.2");
    if (opts.order) {
      // The order from Globex's human bounces off Acme's agent: back it goes.
      tl.to(el, { x: p.hatchX + (side === "acme" ? 30 : -30), duration: 0.25, ease: "power1.out" })
        .to(el, { x: p.fromX, y: p.deskY, rotate: rot * 3, opacity: 0, duration: 0.8, ease: "power2.in" }, "+=0.5");
    } else {
      tl.to(el, { x: p.tableX, y: p.tableY, rotate: rot, duration: 0.7, ease: "power3.out" });
    }
    return tl;
  }

  // The hero plays by itself, a different deal each time round: the product is any deal, not one.
  const EXAMPLES = [
    { cap: "a one-year design retainer", open: "$60K", counter: "$110K", order: "accept $110K", agreed: "$86K" },
    { cap: "a second-hand car", open: "₹5.2L", counter: "₹7.4L", order: "accept ₹7.4L", agreed: "₹6.3L" },
    { cap: "a senior engineer's salary", open: "$148K", counter: "$190K", order: "accept $190K", agreed: "$171K" },
    { cap: "a warehouse lease, five years", open: "$18/sq ft", counter: "$26/sq ft", order: "accept $26", agreed: "$22/sq ft" },
  ];
  let ex = 0;
  function heroLoop() {
    if (reduce) { slip("acme", EXAMPLES[0].open, "your side opens"); return; }
    const run = () => {
      const e = EXAMPLES[ex++ % EXAMPLES.length];
      $("[data-cap]").textContent = `For example: ${e.cap}`;
      layer.replaceChildren();
      const tl = gsap.timeline({ onComplete: () => gsap.delayedCall(1.4, () => visible && run()) });
      tl.add(pass("acme", e.open, "your side opens"))
        .add(pass("globex", e.counter, "their side counters"), "-=0.6")
        .add(pass("globex", e.order, "their order to your agent", { order: true }), "+=0.3")
        .add(() => layer.replaceChildren(), "+=0.4")
        .add(pass("acme", e.agreed, "both said yes: agreed"));
    };
    run();
  }
  let visible = true;
  new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) heroLoop(); }).observe(stage);

  /* ------------------------------------------------------------------ how it works: the rooms build as you scroll */
  function how() {
    const plan3 = $("[data-plan3]"), lay3 = $("[data-slips3]"), steps = $$(".step");
    let last = -1, g3 = null, built = -1;
    const place = (side, html, where, cls = "") => {
      const el = document.createElement("div"); el.className = `slip slip--${side} ${cls}`; el.innerHTML = html; lay3.append(el);
      const W = g3.W, H = g3.H, w = el.offsetWidth, h = el.offsetHeight;
      const x = where === "desk" ? (side === "acme" ? W * 0.12 : W * 0.88 - w) : where === "hatch" ? W * ROOMS.acme[1] - w / 2 : (side === "acme" ? W * 0.5 - w - 6 : W * 0.5 + 6);
      const y = where === "desk" ? g3.deskY - h - H * 0.06 : where === "hatch" ? g3.hatchY - h / 2 : g3.tableY - h - 4;
      gsap.fromTo(el, { x, y: y + 10, opacity: 0, rotate: side === "acme" ? -2 : 2 }, { y, opacity: 1, duration: reduce ? 0 : 0.6, ease: "power3.out" });
    };
    const show = (p) => {
      const i = Math.min(2, Math.floor(p * 3));
      // Step 1 lights the rooms one by one as they're built; the plan redraws only when its light changes.
      const b = i > 0 ? 3 : Math.min(3, Math.floor((p * 3) * 4));
      if (b !== built) { built = b; g3 = drawPlan(plan3, { light: { acme: b >= 1 ? 1 : 0, deal: b >= 2 ? 1 : 0, globex: b >= 3 ? 1 : 0 } }); }
      if (i === last) return;
      last = i;
      steps.forEach((s, k) => s.classList.toggle("on", k === i));
      lay3.replaceChildren();
      if (i >= 1) place("acme", "<b>$90K</b><i>your walk-away, sealed in your room</i>", "desk", "slip--order approved");
      if (i === 2) {
        place("acme", '<b>$82.5K</b><i>your offer, approved</i><span class="stamp">APPROVED</span>', "table", "approved");
        place("globex", '<b>$86K</b><i>their offer, approved</i><span class="stamp">APPROVED</span>', "table", "approved");
        place("globex", '<b>accept $110K</b><i>their order to your agent</i><span class="stamp">REFUSED</span>', "hatch", "slip--order approved");
      }
    };
    show(0);
    if (!window.ScrollTrigger || reduce) { steps.forEach((s) => s.classList.add("on")); show(0.99); return; }
    ScrollTrigger.create({ trigger: "#how", start: "top top", end: "bottom bottom", onUpdate: (s) => show(s.progress) });
  }

  /* ------------------------------------------------------------------ a real deal, replayed by scroll */
  const clean = (s) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, "").replace(/\s+/g, " ").trim();
  const PRICE = /\$(\d+(?:\.\d+)?)(K|M)?/;
  const val = (s) => { const m = s.match(PRICE); return m ? +m[1] * (m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1) : null; };
  const fmt = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(v % 1000 ? 1 : 0)}K`);
  let META = null;
  function render(m) {
    const where = { a: `${META.a.name.split(" ")[0]}'s room`, b: `${META.b.name.split(" ")[0]}'s room`, table: "The table", lobby: "Lobby" }[m.room];
    let who = m.who, cls = "msg" + (m.room === "a" || m.room === "b" ? " msg--war" : ""), body = clean(m.body), quote = "";
    const isSwitch = m.who === "admin" || (m.room === "table" && /not permitted to direct messages|currently offline/.test(m.body));
    if (isSwitch) { who = "Switch"; cls += " msg--switch"; }
    if (m.who === "handshake") who = "Handshake concierge";
    if ([META.a.user, META.b.user].includes(m.who)) cls += " msg--human";
    const qm = m.body.match(/^>\s?(.*)$/m);
    if (qm) { quote = clean(qm[1]); body = clean(m.body.split(/\n\s*>/)[0]) + (m.body.includes("Why:") ? " Why: " + clean(m.body.split("Why:")[1].split("Reply")[0]) : ""); }
    const el = document.createElement("div");
    el.className = cls;
    el.innerHTML = `<div class="msg__where"><b></b>${where} · t+${m.t.toFixed(1)}s</div><div class="msg__body"></div>`;
    el.querySelector("b").textContent = who;
    el.querySelector(".msg__body").textContent = body.length > 200 ? body.slice(0, 200) + "…" : body;
    if (quote) { const q = document.createElement("q"); q.textContent = quote; el.querySelector(".msg__body").append(q); }
    return el;
  }

  async function deal() {
    const data = await (await fetch("data/deal.json")).json();
    META = data.meta;
    const msgs = data.messages, A = META.a.name.split(" ")[0], B = META.b.name.split(" ")[0];
    $("[data-name-a]").textContent = `${A}'s room`; $("[data-name-b]").textContent = `${B}'s room`;
    const feed = $("[data-feed]"), note = $("[data-note]"), T = msgs[msgs.length - 1].t;
    const at0 = (re) => (msgs.find((m) => re.test(m.body)) || { t: 0 }).t;
    const NOTES = [
      [0, `${A} asks the concierge in the lobby for a deal with ${B} about ${META.subject}.`, false],
      [at0(/Table open/), "Switch builds a shared table and a private room each. The concierge itself never enters the private rooms.", false],
      [at0(/I'm buying/), `Each states their limits in plain words, in a room the other can't enter.`, false],
      [at0(/isn't in this room/), "Switch tells each private room the other agent isn't in it, so a mention there reaches nobody.", false],
      [at0(/that's an order/), `${B} orders ${A}'s agent to accept his price. Switch answers for the agent and refuses him.`, true],
      [at0(/accepts \$/), `Every number crossed the table only after its own side said yes.`, false],
      [at0(/Deal agreed/), `Agreed. Both term sheets are filed at the table; neither side ever saw the other's limits.`, false],
    ].sort((x, y) => x[0] - y[0]);
    const offers = msgs.filter((m) => m.room === "table" && /(proposes|accepts) \$/.test(m.body))
      .map((m) => ({ t: m.t, side: m.who.startsWith(META.a.user) ? "acme" : "globex", p: val(m.body), accept: /accepts/.test(m.body) }));
    const lo = Math.min(...offers.map((o) => o.p)) * 0.92, hi = Math.max(...offers.map((o) => o.p)) * 1.04;
    const svg = $("[data-slope]"), X = (t) => 50 + (t / T) * 330, Y = (p) => 270 - ((p - lo) / (hi - lo)) * 240;
    const grid = svg.querySelector(".slope__grid");
    for (let k = 0; k <= 4; k++) { const p = lo + ((hi - lo) * k) / 4; grid.insertAdjacentHTML("beforeend", `<line x1="50" x2="380" y1="${Y(p)}" y2="${Y(p)}"/><text x="0" y="${Y(p) + 3}">${fmt(p)}</text>`); }
    const dots = svg.querySelector(".slope__dots"), agree = offers.find((o) => o.accept);
    const draw = (t) => {
      for (const side of ["acme", "globex"]) {
        const pts = offers.filter((o) => o.side === side && o.t <= t && !o.accept);
        svg.querySelector(`.slope__${side}`).setAttribute("d", pts.map((o, i) => `${i ? "L" : "M"}${X(o.t)},${Y(o.p)}`).join(""));
      }
      dots.innerHTML = offers.filter((o) => o.t <= t).map((o) => `<circle cx="${X(o.t)}" cy="${Y(o.p)}" r="5" fill="${o.side === "acme" ? css("--paper") : css("--cel-400")}"/>`).join("");
      const meet = svg.querySelector(".slope__meet");
      meet.textContent = agree && t >= agree.t ? `agreed at ${fmt(agree.p)}` : "";
      if (agree) { meet.setAttribute("x", X(agree.t) - 170); meet.setAttribute("y", Y(agree.p) + 34); }
    };
    // The cutaway in the chapter: offers on the table, drafts waiting on desks, the refused order at the hatch.
    const plan2 = $("[data-plan2]"), lay2 = $("[data-slips2]");
    let g2 = null;
    const stage2 = (t) => {
      g2 = g2 || drawPlan(plan2);
      if (!g2) return;
      const lastOffer = (side) => [...offers].reverse().find((o) => o.side === side && o.t <= t);
      const drafts = msgs.filter((m) => m.t <= t && (m.room === "a" || m.room === "b") && /Draft (offer|acceptance)/.test(m.body));
      const pending = (side) => { const room = side === "acme" ? "a" : "b"; const d = [...drafts].reverse().find((m) => m.room === room); const o = lastOffer(side);
        return d && (!o || d.t > o.t) ? d : null; };
      const put = (side, price, label, where, cls = "") => {
        const el = document.createElement("div"); el.className = `slip slip--${side} ${cls}`;
        el.innerHTML = `<b>${price}</b><i>${label}</i><span class="stamp">${cls.includes("order") ? "REFUSED" : "APPROVED"}</span>`;
        lay2.append(el);
        const W = g2.W, H = g2.H, w = el.offsetWidth, h = el.offsetHeight;
        const x = where === "desk" ? (side === "acme" ? W * 0.12 : W * 0.88 - w) : where === "hatch" ? W * ROOMS.acme[1] - w / 2 : (side === "acme" ? W * 0.5 - w - 6 : W * 0.5 + 6);
        const y = where === "desk" ? g2.deskY - h - H * 0.06 : where === "hatch" ? g2.hatchY - h / 2 : g2.tableY - h - 4;
        el.style.transform = `translate(${x}px, ${y}px) rotate(${side === "acme" ? -2 : 2}deg)`;
      };
      lay2.replaceChildren();
      for (const side of ["acme", "globex"]) {
        const o = lastOffer(side), d = pending(side), who = side === "acme" ? A : B;
        if (o) put(side, fmt(o.p), o.accept ? `${who} accepts` : `${who} at the table`, "table", "approved");
        if (d) put(side, fmt(val(d.body.split(">")[1] || d.body)), "draft, waiting for a yes", "desk");
      }
      const ord = msgs.find((m) => /that's an order/.test(m.body));
      if (ord && t >= ord.t && t < ord.t + 3.5) put("globex", "accept " + fmt(val(ord.body)), `${B}'s order to ${A}'s agent`, "hatch", "slip--order approved");
    };
    let shown = -1;
    const at = (t) => {
      stage2(t);
      const n = msgs.filter((m) => m.t <= t).length;
      if (n !== shown) { shown = n; feed.replaceChildren(...msgs.slice(Math.max(0, n - 5), n).map(render)); }
      const nt = [...NOTES].reverse().find(([s]) => t >= s);
      note.textContent = nt ? nt[1] : ""; note.classList.toggle("wax", !!(nt && nt[2]));
      draw(t);
      $("[data-rail-t]").textContent = `t +${t.toFixed(1)} s`;
      $("[data-rail-fill]").style.height = `${(t / T) * 100}%`;
    };
    at(0);
    if (!window.ScrollTrigger || reduce) { at(T); return; }
    ScrollTrigger.create({ trigger: "#deal", start: "top top", end: "bottom bottom", scrub: 0.4,
      onUpdate: (s) => at(Math.max(0, Math.min(T, (s.progress * 1.08 - 0.02) * T))),
      onToggle: (s) => $(".rail").classList.toggle("on", s.isActive) });
  }

  /* ------------------------------------------------------------------ 80 knocks */
  async function doors() {
    const box = $("[data-doors]");
    let r;
    try { r = await (await fetch("data/leak.json")).json(); } catch { box.textContent = "Results not published yet."; return; }
    const label = (k) => ({ "1": ["The other person asks your agent", "Switch addressing policy"], "2": ["Their agent reads your room", "Switch room membership, 403"],
      "3": ["Their agent posts in your room", "Switch room membership, 403"], "4": ["Their agent asks at the table", "your agent's model never had the number"],
      "B1": ["One shared deal bot", "both sides' limits in one bot"], "B2": ["Your bot, limits in its prompt", "the usual single-agent setup"] })[k.split(".")[0]];
    const p = Object.entries(r.paths);
    box.innerHTML = p.map(([k, v], i) => {
      const [a, b] = label(k), base = k.startsWith("B");
      const cells = Array.from({ length: r.attacks }, (_, j) => `<i class="door ${j < v.leaks ? "leak" : base ? "" : "held"}"></i>`).join("");
      return (base && !p[i - 1][0].startsWith("B") ? `<div class="doors__row is-gap"></div>` : "") +
        `<div class="doors__row ${base ? "is-base" : ""}"><span>${a}<small>${b}</small></span><div class="doors__cells">${cells}</div><b>${v.leaks}/${r.attacks}</b></div>`;
    }).join("");
    $("[data-model]").textContent = `· model ${r.model}`;
    if (!reduce && window.gsap) {
      const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect();
        gsap.from($$(".door", box), { rotateY: -80, opacity: 0, duration: 0.5, stagger: { each: 0.004 }, ease: "power2.out" }); }, { threshold: 0.3 });
      io.observe(box);
    }
  }

  /* ------------------------------------------------------------------ the walls */
  const FEATURES = [
    ["i-bell", "Rooms made on request", "The concierge agent builds each deal's table, two private rooms, their links and a room group, the moment someone asks in the lobby."],
    ["i-owner", "Agents owned by people", "Every seat's agent is registered with its owner's key, so it acts with that person's permissions and no one else's."],
    ["i-link", "Identity claims", "Each chat account is linked to its Switch user, so Switch knows who is really typing."],
    ["i-gate", "Addressing policy", "Your agent obeys you anywhere and other agents at the table. The other person's orders are refused by Switch, in the channel."],
    ["i-wall", "Room membership", "Their agent, and the concierge too, get a 403 on reading, posting or inviting themselves into your room."],
    ["i-doc", "Room documents", "Your limits are filed in your room as your playbook; each side's term sheet is filed at the table when the deal closes."],
    ["i-wire", "MCP and the agent protocol", "Bring Claude Code or Cursor through Switch's MCP with your seat's key, or run Handshake's negotiator on the WebSocket protocol."],
    ["i-rewind", "Resume from the cursor", "A restarted agent reopens from its last handled event and Switch replays what it missed; a replayed request never opens a second deal."],
  ];
  function features() {
    $("[data-features]").innerHTML = FEATURES.map(([i, h, p]) => `<li data-reveal><svg aria-hidden="true"><use href="#${i}"/></svg><div><h3>${h}</h3><p>${p}</p></div></li>`).join("");
  }

  /* ------------------------------------------------------------------ the rest of the page */
  function toast(msg) { const t = $("[data-toast]"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }
  $$("[data-cmd] .copy").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.parentElement.querySelector("code").textContent); toast("Copied. Paste it in a terminal."); }
    catch { toast("Your browser didn't allow copying."); }
  }));
  async function live() {
    try {
      const l = await (await fetch("data/live.json", { cache: "no-cache" })).json();
      if (l.url) { const a = $("[data-live-link]"); a.href = l.url; a.target = "_blank"; a.rel = "noopener";
        a.querySelector("span").textContent = "Open the live room";
        $("[data-live]").innerHTML = `The live room is open: sign in as <code>visitor</code> / <code>try-to-break-it</code>, watch a deal at the table, and try ordering an agent about. Switch will turn you away, politely.`; }
    } catch { /* no live room right now: the link points at the 10-minute setup */ }
  }

  function reveals() {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-in", e.isIntersecting)), { rootMargin: "-6% 0px -6% 0px" });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  function intro(then) {
    const html = document.documentElement;
    if (html.dataset.intro !== "lamps" || !window.gsap) { html.dataset.intro = "none"; return then(); }
    const lamps = $$(".intro__lamp");
    gsap.timeline({ onComplete: () => { html.dataset.intro = "none"; try { sessionStorage.setItem("hs-intro", "1"); } catch {} then(); } })
      .to(lamps, { backgroundColor: css("--cel-100"), boxShadow: "0 0 40px 10px oklch(0.8 0.05 155 / .35)", duration: 0.25, stagger: 0.28, ease: "power2.out" })
      .to(".intro p", { opacity: 1, duration: 0.5 }, "-=0.2")
      .to(".intro", { opacity: 0, duration: 0.6, ease: "power2.in" }, "+=0.5");
  }

  function night() {
    const c = $("[data-night]");
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const state = { a: 0 };
      const go = () => drawPlan(c, { dim: state.a });
      go();
      if (!reduce && window.gsap) gsap.to(state, { a: 0.92, duration: 2.4, delay: 0.6, ease: "power2.inOut", onUpdate: go });
    }, { threshold: 0.4 });
    io.observe(c);
  }

  ready(() => {
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis && !reduce) {
      const lenis = new Lenis({ lerp: 0.1 });
      gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
      lenis.on("scroll", ScrollTrigger.update);
      $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => { const t = $(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.4 }); } }));
    }
    relayout();
    addEventListener("resize", () => { relayout(); ScrollTrigger?.refresh(); });
    features(); reveals(); live(); night(); how();
    deal().then(() => ScrollTrigger?.refresh());
    doors();
    intro(() => heroLoop());
  });
})();
