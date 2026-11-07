// The film: the hero and "How it works" are one pinned sequence over the 3D diorama, directed by your scroll.
// 0 hero (wide, slips crossing on their own) · 1 ask for a deal (the rooms are built, lamp by lamp)
// 2 your limits (into your room, the sealed playbook) · 3 the bargain (across the table; their order hits your wall)
// 4 pull back (any deal, any agent).
import { createDiorama } from "./diorama.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SEGMENTS = [["wide", "wide"], ["wide", "table"], ["table", "you"], ["you", "table"], ["table", "out"]];
const EXAMPLES = [["$60K", "$110K", "$86K", "a design retainer"], ["₹5.2L", "₹7.4L", "₹6.3L", "a second-hand car"],
  ["$148K", "$190K", "$171K", "a senior salary"], ["$18/ft", "$26/ft", "$22/ft", "a warehouse lease"]];

function start() {
  const host = $("[data-gl]");
  if (!host) return;
  let d;
  try {
    d = createDiorama(host, { onReady: () => document.documentElement.classList.add("gl-ready") });
  } catch (e) {
    document.documentElement.classList.add("no-gl");
    return;
  }
  const panels = $$("[data-panel]"), ticks = $$("[data-tick]");
  let seg = -1, loop = null, ex = 0;

  const heroLoop = () => {
    clearInterval(loop);
    const play = () => {
      const [a, b, c, what] = EXAMPLES[ex++ % EXAMPLES.length];
      d.clearSlips();
      $("[data-film-ex]").textContent = what;
      d.slip("you", [a, "your side opens", what]);
      setTimeout(() => seg === 0 && d.slip("them", [b, "their side counters", what]), 1500);
      setTimeout(() => { if (seg === 0) { d.slip("them", ["order", "accept " + b + " now", "from their person"], { order: true, stamp: "REFUSED" }); setTimeout(() => d.refuse(), 1700); } }, 3200);
      setTimeout(() => seg === 0 && d.slip("you", [c, "both said yes", "agreed"], { stamp: "AGREED" }), 5600);
    };
    play();
    loop = setInterval(play, 8200);
  };

  const enter = (i) => {
    panels.forEach((p) => p.classList.toggle("on", +p.dataset.panel === i));
    ticks.forEach((t) => t.classList.toggle("on", +t.dataset.tick <= i));
    clearInterval(loop);
    if (i === 0) return heroLoop();
    d.clearSlips();
    if (i === 1) { // the rooms are built: the lamps go dark, then come on one by one
      for (const r of ["you", "table", "them"]) d.setLight(r, 0.05);
      ["you", "table", "them"].forEach((r, k) => setTimeout(() => seg === 1 && d.setLight(r, 1), 500 + k * 450));
    } else {
      for (const r of ["you", "table", "them"]) d.setLight(r, 1);
    }
    if (i === 2) {
      d.setLight("them", 0.18); d.setLight("table", 0.45);
      setTimeout(() => seg === 2 && d.slip("you", ["$90K", "your walk-away", "only you see this"], { stamp: "SEALED", duration: 1.4 }), 300);
    }
    if (i === 3) {
      d.slip("you", ["$82.5K", "your offer", "you said yes"]);
      setTimeout(() => seg === 3 && d.slip("them", ["$86K", "their offer", "they said yes"]), 1300);
      setTimeout(() => { if (seg === 3) { d.slip("them", ["order", "accept $110K now", "from their person"], { order: true, stamp: "REFUSED" }); setTimeout(() => d.refuse(), 1700); } }, 2800);
    }
  };

  const update = (p) => {
    const f = Math.min(SEGMENTS.length - 0.001, p * SEGMENTS.length), i = Math.floor(f), local = f - i;
    // Hold each shot a little at both ends, so a scroll stops on a composed frame.
    const mix = Math.max(0, Math.min(1, (local - 0.12) / 0.6));
    d.setShot(...SEGMENTS[i], i === 0 ? 0 : mix);
    if (i !== seg) { seg = i; enter(i); }
  };

  const go = () => {
    if (!window.ScrollTrigger || reduce) { update(0); return; }
    ScrollTrigger.create({ trigger: "[data-film]", start: "top top", end: "bottom bottom", onUpdate: (s) => update(s.progress) });
    update(0);
    ScrollTrigger.refresh();
  };
  if (document.documentElement.dataset.intro === "none") go();
  else addEventListener("hs:intro-done", go, { once: true });
}

if (document.readyState === "complete") start(); else addEventListener("load", start);
