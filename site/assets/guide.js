// The Switch layer: the toggle that loads the page, the switches you flip, and Bulb, the stickman whose head is a light,
// who walks the page and tells the story one line per stop. Motion follows the film laws: one speed curve per move,
// separate timings, long soft settles, the walk driven by distance so the feet never slide.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const vw = () => document.documentElement.clientWidth || innerWidth;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

/* ---------- Sound: synthesised, off until you flip it on ---------- */
const sound = (() => {
  let ctx = null, on = store.get("hs-sound") === "1";
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ctx.state === "suspended") ctx.resume(); return ctx; };
  const tone = (f, dur, gain, type = "sine", glide = 0) => {
    const c = ensure(); if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, gain, freq) => {
    const c = ensure(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = gain;
    s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start();
  };
  return {
    get on() { return on; },
    set(v) { on = v; store.set("hs-sound", v ? "1" : "0"); if (v) ensure(); },
    click() { if (!on) return; noise(0.03, 0.5, 3200); tone(1900, 0.035, 0.05, "square", 0.6); },   // a switch: a hard tick and a tiny spring
    clunk() { if (!on) return; noise(0.05, 0.6, 1400); tone(140, 0.09, 0.12, "sine", 0.7); },       // the big switch
    pop() { if (!on) return; tone(880, 0.07, 0.035, "sine", 1.25); },                               // a line appears
    step(k) { if (!on) return; noise(0.018, 0.06 + k * 0.03, 900 + k * 300); },                     // a footstep
    buzz() { if (!on) return; tone(118, 0.16, 0.03, "sawtooth", 1.02); },                            // a filament catching
  };
})();

/* ---------- Little switches everywhere ---------- */
function flipper(el, onChange) {
  el.addEventListener("click", () => {
    const v = el.getAttribute("aria-checked") !== "true";
    el.setAttribute("aria-checked", String(v));
    sound.click();
    onChange?.(v);
  });
}
function soundSwitch() {
  const el = $("[data-sound]");
  if (!el) return;
  el.setAttribute("aria-checked", String(sound.on));
  flipper(el, (v) => { sound.set(v); sound.click(); });
}

/* ---------- The loader: a toggle whose track fills with real progress, then flips and lights the page ---------- */
function loader(done) {
  const box = $(".intro");
  if (html.dataset.intro !== "switch" || !window.gsap) { html.dataset.intro = "none"; return done(); }
  const fill = $("[data-intro-fill]"), knob = $("[data-intro-knob]"), pc = $("[data-intro-pc]"), sw = $("[data-intro-sw]");
  const parts = { fonts: 0, page: 0, gl: 0 };
  document.fonts?.ready.then(() => (parts.fonts = 1));
  if (document.readyState === "complete") parts.page = 1; else addEventListener("load", () => (parts.page = 1), { once: true });
  const glDone = () => (parts.gl = 1);
  if (html.classList.contains("gl-ready") || html.classList.contains("no-gl")) glDone();
  new MutationObserver(() => { if (html.classList.contains("gl-ready") || html.classList.contains("no-gl")) glDone(); }).observe(html, { attributes: true, attributeFilter: ["class"] });
  setTimeout(glDone, 5000); // a slow GPU never holds the page hostage
  const t0 = performance.now();
  let shown = 0;
  const tick = () => {
    const target = parts.fonts * 0.2 + parts.page * 0.4 + parts.gl * 0.4;
    // A floor of 1.1 s so the switch reads, and an eased chase so the fill never jumps.
    const cap = clamp((performance.now() - t0) / 1100, 0, 1);
    shown += (Math.min(target, cap) - shown) * 0.09;
    if (Math.min(target, cap) >= 1 && shown > 0.985) shown = 1;
    fill.style.transform = `scaleX(${0.12 + shown * 0.88})`;
    pc.textContent = Math.round(shown * 100);
    if (shown < 1) return requestAnimationFrame(tick);
    flip();
  };
  const flip = () => {
    const r = sw.getBoundingClientRect(), x = r.left + r.width * 0.72, y = r.top + r.height / 2;
    box.style.setProperty("--x", x + "px"); box.style.setProperty("--y", y + "px");
    const hole = { r: 0 };
    gsap.timeline({ onComplete: () => { html.dataset.intro = "none"; try { sessionStorage.setItem("hs-intro", "1"); } catch {} } })
      .add(() => { sw.classList.add("on"); sound.clunk(); })
      .to(knob, { x: () => r.width - r.height, duration: 0.42, ease: "expo.out" }, 0)
      .to(knob, { scaleX: 1.18, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1, transformOrigin: "100% 50%" }, 0.02)
      .to(".intro__t", { opacity: 0, y: -6, filter: "blur(4px)", duration: 0.35, ease: "power2.in" }, 0.1)
      .add(done, 0.55)
      // The light comes on from the switch outward: a hole grows in the dark, fast at first, with a long soft tail.
      .to(hole, { r: Math.hypot(innerWidth, innerHeight) * 1.05, duration: 1.25, ease: "expo.inOut", onUpdate: () => box.style.setProperty("--r", hole.r + "px") }, 0.5);
  };
  requestAnimationFrame(tick);
}

/* ---------- Bulb: the rig ---------- */
const SVGNS = "http://www.w3.org/2000/svg";
const BODY = `
<svg class="bulb" viewBox="0 -24 120 234" aria-hidden="true">
  <defs>
    <radialGradient id="g-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".55"/><stop offset=".45" stop-color="var(--lamp)" stop-opacity=".14"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></radialGradient>
    <radialGradient id="g-glass-off" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="var(--glass-hi)"/><stop offset=".55" stop-color="var(--glass)"/><stop offset="1" stop-color="var(--glass-lo)"/></radialGradient>
    <radialGradient id="g-glass-on" cx="50%" cy="58%" r="62%"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--lamp)"/><stop offset="1" stop-color="var(--lamp-edge)"/></radialGradient>
    <linearGradient id="g-metal" x1="0" x2="1"><stop offset="0" stop-color="var(--metal-lo)"/><stop offset=".35" stop-color="var(--metal-hi)"/><stop offset="1" stop-color="var(--metal-lo)"/></linearGradient>
    <linearGradient id="g-limb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--limb-hi)"/><stop offset="1" stop-color="var(--limb)"/></linearGradient>
  </defs>
  <ellipse class="bulb__pool" cx="60" cy="204" rx="40" ry="5"/>
  <ellipse class="bulb__shadow" cx="60" cy="204" rx="22" ry="3.4"/>
  <g class="bulb__fig">
    <circle class="bulb__halo" cx="60" cy="34" r="64" fill="url(#g-halo)"/>
    <path class="limb limb--back" data-leg="1"/><path class="limb limb--back" data-arm="1"/>
    <path class="limb" data-torso/>
    <path class="limb" data-leg="0"/>
    <g data-head>
      <path class="bulb__neck" d="M49 58h22v14a4 4 0 0 1-4 4H53a4 4 0 0 1-4-4z" fill="url(#g-metal)"/>
      <path class="bulb__thread" d="M49 62.5l22-1.6M49 67l22-1.6M50 71.4l20-1.4"/>
      <path class="bulb__glass" d="M48.5 58c-1-5-4.5-8.2-8.4-12.4A24 24 0 1 1 79.9 45.6c-3.9 4.2-7.4 7.4-8.4 12.4z" fill="url(#g-glass-off)"/>
      <path class="bulb__glow" d="M48.5 58c-1-5-4.5-8.2-8.4-12.4A24 24 0 1 1 79.9 45.6c-3.9 4.2-7.4 7.4-8.4 12.4z" fill="url(#g-glass-on)"/>
      <path class="bulb__wire" d="M55 57V44M65 57V44"/>
      <path class="bulb__fil" d="M55 44l2.5-5 2.5 5 2.5-5 2.5 5"/>
      <g class="bulb__eyes" data-eyes><ellipse cx="52.5" cy="28" rx="2.6" ry="3.4"/><ellipse cx="67.5" cy="28" rx="2.6" ry="3.4"/></g>
      <path class="bulb__shine" d="M44 22a18 18 0 0 1 9-10"/>
    </g>
    <path class="limb" data-arm="0"/>
  </g>
</svg>`;

function rig(svg) {
  const P = (sel) => $(sel, svg);
  const legs = [P('[data-leg="0"]'), P('[data-leg="1"]')], arms = [P('[data-arm="0"]'), P('[data-arm="1"]')];
  const torso = P("[data-torso]"), head = P("[data-head]"), fig = P(".bulb__fig"), shadow = P(".bulb__shadow"), eyes = P("[data-eyes]");
  const glow = P(".bulb__glow"), halo = P(".bulb__halo"), fil = P(".bulb__fil"), pool = P(".bulb__pool");
  const seg = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l]; // angle 0 = straight down
  const limb = (el, pts) => el.setAttribute("d", "M" + pts.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L"));
  return {
    // s: { phase, walk (0..1), bob, point (0..1), wave (0..1), lean, t, light (0..1), blink }
    pose(s) {
      const w = s.walk, ph = s.phase, t = s.t;
      const breathe = Math.sin(t * 1.7) * 0.9 * (1 - w);
      const bob = (1 - Math.cos(ph * 2)) * 1.8 * w;
      const hip = [60, 146 - bob];
      const neck = [60 + s.lean * 6, 108 - bob - breathe * 0.4];
      limb(torso, [hip, [60 + s.lean * 3, 127 - bob], neck]);
      head.setAttribute("transform", `translate(${(neck[0] - 60).toFixed(2)} ${(neck[1] - 76).toFixed(2)}) translate(60 76) scale(1.38) translate(-60 -76) rotate(${(Math.sin(t * 0.9) * 2.4 * (1 - w) + s.lean * 8 + s.tilt * 10).toFixed(2)} 60 72)`);
      // Legs: thighs swing with the gait, knees bend on the forward swing; at rest a little contrapposto.
      for (let k = 0; k < 2; k++) {
        const p = ph + k * Math.PI;
        const thigh = lerp(k ? 0.06 : -0.05, Math.sin(p) * 0.5, w);
        const knee = lerp(0.04, Math.max(0, Math.sin(p - 1.1)) * 0.95 + 0.08, w);
        const kn = seg(hip[0], hip[1], thigh, 28), ft = seg(kn[0], kn[1], thigh - knee, 29);
        const toe = [ft[0] + 6, ft[1] + 0.5];
        limb(legs[k], [hip, kn, ft, toe]);
      }
      // Arms: swing against the legs when walking; the front arm can point up toward the line, or wave.
      const sh = [neck[0], neck[1] + 6];
      for (let k = 0; k < 2; k++) {
        const swing = Math.sin(ph + (k ? 0 : Math.PI)) * 0.42 * w;
        let up = lerp(k ? -0.16 : 0.14, swing, w), fore = lerp(k ? -0.22 : 0.3, -0.35 + swing * 0.5, w);
        if (k === 0) {
          up = lerp(up, 2.25 + Math.sin(t * 2.2) * 0.04, s.point); fore = lerp(fore, 0.25, s.point);
          up = lerp(up, 2.75, s.wave); fore = lerp(fore, 0.55 + Math.sin(t * 11) * 0.5, s.wave);
        } else {
          up = lerp(up, -0.35, s.point * 0.6);
        }
        const el = seg(sh[0], sh[1], up, 22), hd = seg(el[0], el[1], up + fore, 21);
        limb(arms[k], [sh, el, hd]);
      }
      const lift = bob / 4;
      shadow.setAttribute("rx", (22 - lift * 2).toFixed(2));
      shadow.style.opacity = (0.42 - lift * 0.05).toFixed(3);
      eyes.setAttribute("transform", `translate(${(s.look * 2.2).toFixed(2)} 0) translate(0 28) scale(1 ${(1 - s.blink).toFixed(3)}) translate(0 -28)`);
      const L = s.light;
      glow.style.opacity = L.toFixed(3);
      halo.style.opacity = (L * 0.95).toFixed(3);
      pool.style.opacity = (L * 0.5).toFixed(3);
      fil.style.opacity = (0.35 + L * 0.65).toFixed(3);
      fig.style.setProperty("--L", L.toFixed(3));
    },
  };
}

/* ---------- Bulb: the stops, in the story's order ---------- */
const STOPS = {
  hero: { light: "nervous", side: "right", line: "Your agent knows the most you'd ever pay, and the moment it starts chatting with theirs, one sly message could pull that number out." },
  ask: { light: "on", side: "right", gesture: "point", line: "So ask for the deal right in your chat, and Switch builds three rooms on the spot: yours, theirs, and the table in between." },
  limits: { light: "on", side: "right", gesture: "point", line: "Your limits go in your room, behind a wall their agent can't walk through, because Switch holds the door, not a polite prompt." },
  bargain: { light: "on", side: "right", line: "Every offer waits in your room for your yes, and when their side tries bossing your agent about, Switch sends them away." },
  end: { light: "on", side: "right", gesture: "wave", line: "Salary, car, lease, retainer: any deal, any agent, and your number stays yours." },
  try: { light: "on", side: "right", gesture: "point", line: "Have a go: tell your agent your limits, say open, and flip yes on each offer. Their floor stays hidden till the end." },
  agents: { light: "on", side: "right", gesture: "point", line: "Already use Claude Code or Cursor? Plug it into Switch's MCP with your seat key and it bargains for you." },
  deal: { light: "on", side: "left", line: "This one really happened on our Switch server, and your scroll plays it back message by message." },
  knocks: { light: "nervous", side: "right", line: "We knocked eighty times trying to get Priya's limit out, and the room never once opened." },
  walls: { light: "on", side: "left", gesture: "point", line: "Owners, rooms, invites and refusals all belong to Switch, so there's nothing in the prompt to talk your way past." },
  start: { light: "on", side: "right", gesture: "wave", line: "Three commands and ten minutes, and your team has its own table." },
  night: { light: "off", side: "right", line: "Deal done. I'll get the lights." },
};
const POKES = ["Click. Still nobody has seen your number.", "Off, on, off again, and your limits stayed put the whole time.", "I'm a switch, not a leak."];

function guide() {
  const root = document.createElement("div");
  root.className = "guide"; root.setAttribute("aria-hidden", "true");
  root.innerHTML = `<p class="guide__say" data-say></p><button class="guide__body" type="button" tabindex="-1">${BODY}</button>`;
  document.body.append(root);
  const say = $("[data-say]", root), body = $(".guide__body", root), R = rig($("svg", root));
  const s = { x: 0, y: 0, phase: 0, walk: 0, point: 0, wave: 0, lean: 0, tilt: 0, look: 0, blink: 0, light: 0, t: 0, face: -1 };
  let lightMode = "off", lightTarget = 0, flick = 0, lastStep = 0, current = null, hideT = 0, speaking = 0;

  const geo = () => {
    const w = root.offsetWidth, m = vw() < 760 ? 10 : clamp(vw() * 0.025, 16, 40);
    return { right: vw() - w - m, left: m };
  };
  s.x = geo().right; root.style.transform = `translate3d(${s.x}px,0,0)`;

  const setLight = (mode) => {
    if (mode === lightMode) return;
    const was = lightMode; lightMode = mode;
    if (mode === "off") { lightTarget = 0; sound.click(); return; }
    if (was === "off") { flick = 0.6; sound.click(); setTimeout(() => sound.buzz(), 90); }
    lightTarget = 1;
  };

  const speak = (line) => {
    clearTimeout(hideT);
    say.replaceChildren();
    const words = line.split(" ");
    words.forEach((w, i) => {
      const sp = document.createElement("span"); sp.textContent = w + (i < words.length - 1 ? " " : "");
      sp.style.transitionDelay = reduce ? "0s" : (i * 0.045 + Math.random() * 0.02).toFixed(3) + "s";
      say.append(sp);
    });
    say.classList.remove("on"); void say.offsetWidth; say.classList.add("on");
    sound.pop();
    speaking = 1;
    // Reading time: about 3.3 words a second plus a breath, then the bubble folds so it never sits on the page.
    hideT = setTimeout(() => { say.classList.remove("on"); speaking = 0; }, 1600 + words.length * 300);
  };

  const gesture = { point: 0, wave: 0 };
  const panelIds = ["hero", "ask", "limits", "bargain", "end"];
  const go = (id) => {
    const stop = STOPS[id];
    if (!stop || id === current) return;
    current = id;
    setLight(stop.light === "nervous" ? "nervous" : stop.light);
    const g = geo(), target = vw() < 760 ? g.right : g[stop.side];
    const dist = Math.abs(target - s.x);
    root.classList.toggle("is-left", target < vw() / 2);
    gsap.killTweensOf(gesture); gsap.killTweensOf(s, "x");
    gesture.point = 0; gesture.wave = 0;
    const arrive = () => {
      speak(stop.line);
      if (stop.gesture) gsap.fromTo(gesture, { [stop.gesture]: 0 }, { [stop.gesture]: 1, duration: 0.7, ease: "expo.out", onComplete: () => gsap.to(gesture, { [stop.gesture]: 0, duration: 1.1, delay: 1.6, ease: "sine.inOut" }) });
    };
    const y = vw() < 760 && panelIds.includes(id) ? -innerHeight * 0.44 : 0;
    gsap.to(s, { y, duration: reduce ? 0 : 0.9, ease: "expo.inOut" });
    if (dist < 4 || reduce) { s.x = target; arrive(); return; }
    s.face = target > s.x ? 1 : -1;
    gsap.to(s, { x: target, duration: clamp(dist / 300, 0.9, 3.2), ease: "sine.inOut", onComplete: arrive });
  };

  // One frame loop: velocity drives the gait, the gait drives the phase, so the feet plant where they land.
  let last = performance.now(), px = s.x, blinkAt = 2;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; s.t += dt;
    const v = (s.x - px) / Math.max(dt, 1e-3); px = s.x;
    s.walk += (clamp(Math.abs(v) / 140, 0, 1) - s.walk) * Math.min(1, dt * 7);
    s.phase += (Math.abs(v) * dt) / 19;
    if (s.walk > 0.4 && Math.floor(s.phase / Math.PI) !== lastStep) { lastStep = Math.floor(s.phase / Math.PI); sound.step(s.walk); }
    s.lean += (clamp(v / 900, -0.35, 0.35) * (s.face) - s.lean) * Math.min(1, dt * 5);
    s.point = gesture.point; s.wave = gesture.wave;
    // Face the bubble when still, the road when walking.
    const facing = Math.abs(v) > 20 ? Math.sign(v) : (root.classList.contains("is-left") ? 1 : -1);
    s.face += (facing - s.face) * Math.min(1, dt * 9);
    s.look = speaking ? 1 : Math.sin(s.t * 0.6) * 0.4;
    s.tilt = speaking ? Math.sin(s.t * 2.1) * 0.25 : 0;
    // Blinks: quick and irregular.
    blinkAt -= dt; if (blinkAt < 0) { s.blink = 1; blinkAt = 2.2 + Math.random() * 3.4; }
    s.blink = Math.max(0, s.blink - dt * 9);
    // Light: a filament warms up with two short catches, and a nervous bulb wavers.
    let L = s.light + (lightTarget - s.light) * Math.min(1, dt * (lightTarget > s.light ? 5 : 3));
    if (flick > 0) { flick -= dt; L = lightTarget * (flick > 0.48 ? 0.85 : flick > 0.4 ? 0.1 : flick > 0.3 ? 0.7 : flick > 0.22 ? 0.2 : L); }
    s.light = L;
    const shown = lightMode === "nervous" ? L * (0.78 + 0.22 * (Math.sin(s.t * 23) * Math.sin(s.t * 7.3) > 0.55 ? 0.15 : 1) * (0.92 + Math.sin(s.t * 3) * 0.08)) : L;
    R.pose({ ...s, light: shown });
    root.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0)`;
    body.style.transform = `scaleX(${(s.face).toFixed(3)})`;
    html.style.setProperty("--room-light", shown.toFixed(3));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  body.addEventListener("click", () => {
    setLight(lightMode === "off" ? "on" : "off");
    if (lightMode === "on") speak(POKES[Math.floor(Math.random() * POKES.length)]);
  });

  // Stops: the film's panels, then each chapter as it crosses the middle of the screen.
  const watchPanels = () => {
    const sync = () => { const on = $("[data-panel].on"); const film = $("[data-film]"); if (!on || !film) return;
      const r = film.getBoundingClientRect(); if (r.bottom > innerHeight * 0.5 && r.top < innerHeight * 0.5) go(panelIds[+on.dataset.panel]); };
    new MutationObserver(sync).observe($("[data-film]") || document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    sync();
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const id = e.target.dataset.stop;
    if (id === "film") { const on = $("[data-panel].on"); go(panelIds[on ? +on.dataset.panel : 0]); } else go(id);
  }), { rootMargin: "-48% 0px -48% 0px" });
  $$("[data-stop]").forEach((el) => io.observe(el));
  watchPanels();

  // Reactions from the playable deal.
  addEventListener("hs:react", (e) => {
    const { line, light } = e.detail || {};
    if (light) setLight(light);
    if (line) speak(line);
  });
  // Typing on a phone: step aside for the keyboard.
  addEventListener("focusin", (e) => { if (e.target.matches("input,textarea") && vw() < 760) root.classList.add("away"); });
  addEventListener("focusout", () => root.classList.remove("away"));
  let lastW = vw();
  addEventListener("resize", () => { if (vw() === lastW || !current) return; lastW = vw(); const g = geo(); gsap.killTweensOf(s, "x"); s.x = px = vw() < 760 ? g.right : g[STOPS[current].side]; });
  return { go, setLight, speak };
}

function start() {
  soundSwitch();
  $$("[data-flip]").forEach((el) => el.addEventListener("click", () => {
    el.setAttribute("aria-checked", "true"); sound.click();
    setTimeout(() => el.setAttribute("aria-checked", "false"), 750);
  }));
  const run = () => { if (window.gsap) guide(); };
  loader(() => { window.dispatchEvent(new Event("hs:intro-done")); run(); });
}
window.hsSound = sound;
if (document.readyState === "loading") addEventListener("DOMContentLoaded", start); else start();
