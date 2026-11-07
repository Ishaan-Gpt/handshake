// The diorama: an architect's lit model of the three rooms (your room, the table, their room), in real 3D.
// Section-cut walls, one lamp per room casting soft shadows, model figures at the desks, sealed playbooks,
// and paper slips that arc through the hatch. The camera is driven by the page (shots) and the pointer (parallax).
import * as THREE from "./vendor/three.module.min.js";

const C = { ink: 0x0b1210, wall: 0x223631, part: 0x2a403a, floor: 0x15231f, line: 0x8fb8a3, paper: 0xeef3ec, figure: 0xdfe8e1,
  lamp: 0xdcefe2, wax: 0xa8343c, cel: 0x9dc1ae };
const ROOMS = { you: -4, table: 0, them: 4 };
export const SHOTS = {
  wide:  { pos: [-1.6, 4.8, 18.5], look: [-2.9, 1.0, 0] },
  you:   { pos: [-5.6, 3.1, 8.6], look: [-5.4, 1.0, 0] },
  table: { pos: [-1.4, 3.2, 9.4], look: [-1.9, 1.05, 0] },
  them:  { pos: [3.2, 3.1, 8.6], look: [2.6, 1.0, 0] },
  out:   { pos: [-1.2, 8.0, 22], look: [-2.6, 0.6, 0] },
};
// On portrait screens the copy sits below, so every shot centres on its subject instead.
export const SHOTS_TALL = {
  wide:  { pos: [0, 7.5, 25], look: [0, -2.6, 0] },
  you:   { pos: [-4, 3.9, 10.5], look: [-4, -0.9, 0] },
  table: { pos: [0, 4.2, 11.5], look: [0, -0.9, 0] },
  them:  { pos: [4, 3.9, 10.5], look: [4, -0.9, 0] },
  out:   { pos: [0, 9.5, 29], look: [0, -3.0, 0] },
};

function paperTexture(lines, { order = false, stamp = "" } = {}) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = order ? "#e08a86" : "#eef3ec"; g.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(30,50,40,${Math.random() * 0.035})`; g.fillRect(Math.random() * 512, Math.random() * 320, 2, 2); }
  g.fillStyle = "#1f2e29"; g.font = "600 92px Newsreader, Georgia, serif"; g.fillText(lines[0], 34, 128);
  g.font = "400 30px 'Martian Mono', monospace"; g.globalAlpha = 0.72; g.fillText(lines[1] || "", 36, 196); g.fillText(lines[2] || "", 36, 240); g.globalAlpha = 1;
  if (stamp) {
    g.save(); g.translate(380, 70); g.rotate(0.14); g.strokeStyle = order ? "#6b2028" : "#456f5c"; g.lineWidth = 5;
    g.strokeRect(-78, -30, 156, 58); g.fillStyle = g.strokeStyle; g.font = "600 30px 'Martian Mono', monospace"; g.textAlign = "center"; g.fillText(stamp, 0, 10); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function hatchTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"); g.fillStyle = "#13201c"; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(143,184,163,.28)"; g.lineWidth = 2;
  for (let i = -128; i < 256; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - 128, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createDiorama(container, { onReady } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.ink);
  scene.fog = new THREE.Fog(C.ink, 14, 30);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  scene.add(new THREE.HemisphereLight(0xb7d3c4, 0x14211d, 0.95));
  const fill = new THREE.DirectionalLight(0xcfe3d8, 0.35); fill.position.set(-3, 6, 9); scene.add(fill);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...o });
  const lineMat = new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: 0.38 });
  const add = (geo, m, pos, { cast = true, receive = true, edges = true, parent = scene } = {}) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(...pos); mesh.castShadow = cast; mesh.receiveShadow = receive; parent.add(mesh);
    if (edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lineMat); mesh.add(e); }
    return mesh;
  };

  // The slab, cut in section: its front face carries the architect's hatching.
  const hatch = hatchTexture(); hatch.repeat.set(24, 1.5);
  const slabFront = mat(C.floor, { map: hatch });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 4.6), [mat(C.floor), mat(C.floor), mat(0x182724, { roughness: 0.55 }), mat(C.floor), slabFront, mat(C.floor)]);
  slab.position.set(0, -0.25, 0); slab.receiveShadow = true; scene.add(slab);
  slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), lineMat));
  add(new THREE.BoxGeometry(13, 0.18, 4.6), mat(C.part), [0, 3.3, 0], { cast: false });              // the roof, cut
  add(new THREE.BoxGeometry(13, 3.3, 0.2), mat(C.wall), [0, 1.65, -2.2], { cast: false });            // back wall
  for (const x of [-6.4, 6.4]) add(new THREE.BoxGeometry(0.2, 3.3, 4.6), mat(C.part), [x, 1.65, 0]);   // end walls

  // The two walls that keep the sides apart, each with one hatch for slips. Their edge lines flash oxblood on a refusal.
  const wallLines = [];
  for (const x of [-2, 2]) {
    const lm = new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: 0.55 });
    for (const [h, y] of [[1.0, 0.5], [1.75, 2.425]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, h, 4.4), mat(C.part)); m.position.set(x, y, 0); m.castShadow = m.receiveShadow = true; scene.add(m);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lm));
    }
    for (const z of [-1.6, 1.6]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 1.2), mat(C.part)); m.position.set(x, 1.275, z); m.castShadow = true; scene.add(m);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lm)); }
    wallLines.push(lm);
  }

  // Furniture: a desk in each private room, the long table, chairs, model figures, sealed playbooks.
  const wood = mat(0x1e302a, { roughness: 0.6 });
  const desk = (x, w, d = 1.1) => {
    add(new THREE.BoxGeometry(w, 0.08, d), wood, [x, 0.82, 0.2]);
    for (const dx of [-w / 2 + 0.08, w / 2 - 0.08]) for (const dz of [-d / 2 + 0.08, d / 2 - 0.08]) add(new THREE.BoxGeometry(0.06, 0.78, 0.06), wood, [x + dx, 0.39, 0.2 + dz], { edges: false });
  };
  desk(-4.1, 1.9); desk(4.1, 1.9); desk(0, 2.6, 1.3);
  const chair = (x, z, rot) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    add(new THREE.BoxGeometry(0.5, 0.06, 0.5), wood, [0, 0.48, 0], { parent: g }); add(new THREE.BoxGeometry(0.5, 0.6, 0.06), wood, [0, 0.8, -0.22], { parent: g });
    for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) add(new THREE.BoxGeometry(0.04, 0.46, 0.04), wood, [dx, 0.23, dz], { parent: g, edges: false }); };
  const figure = (x, z, rot) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const m = mat(C.figure, { roughness: 0.92 });
    add(new THREE.CapsuleGeometry(0.17, 0.42, 6, 14), m, [0, 0.95, 0], { parent: g, edges: false });
    add(new THREE.SphereGeometry(0.13, 24, 16), m, [0, 1.45, 0.02], { parent: g, edges: false });
    const arm = add(new THREE.CapsuleGeometry(0.05, 0.36, 4, 8), m, [0.16, 1.02, 0.22], { parent: g, edges: false }); arm.rotation.x = -1.1;
    return g; };
  chair(-4.9, 0.25, Math.PI / 2); figure(-4.85, 0.25, Math.PI / 2);
  chair(4.9, 0.25, -Math.PI / 2); figure(4.85, 0.25, -Math.PI / 2);
  chair(-0.9, 1.15, Math.PI); chair(0.9, 1.15, Math.PI);
  const seal = (x) => { const e = add(new THREE.BoxGeometry(0.46, 0.012, 0.32), mat(C.paper, { roughness: 0.95 }), [x, 0.866, 0.15]); e.rotation.y = x < 0 ? 0.15 : -0.12;
    const w = add(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 24), mat(C.wax, { roughness: 0.4, emissive: 0x3a0d12, emissiveIntensity: 0.6 }), [x, 0.88, 0.15], { edges: false }); return w; };
  const seals = [seal(-3.75), seal(3.75)];

  // One lamp per room: a shade, a glowing bulb, and a spotlight with soft shadows.
  const lamps = {};
  for (const [k, x] of Object.entries(ROOMS)) {
    const shade = add(new THREE.ConeGeometry(0.32, 0.28, 32, 1, true), mat(C.part, { side: THREE.DoubleSide }), [x, 2.9, 0.1], { cast: false, edges: false });
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), mat(C.part), [x, 3.12, 0.1], { cast: false, edges: false });
    const bulbMat = new THREE.MeshStandardMaterial({ color: C.lamp, emissive: C.lamp, emissiveIntensity: 2.2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), bulbMat); bulb.position.set(x, 2.8, 0.1); scene.add(bulb);
    const spot = new THREE.SpotLight(C.lamp, 38, 7.5, 0.78, 0.55, 1.6);
    spot.position.set(x, 2.78, 0.1); spot.target.position.set(x, 0, 0.3); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0008; spot.shadow.radius = 4;
    scene.add(spot, spot.target);
    lamps[k] = { spot, bulbMat, level: 1, target: 1 };
  }

  // Slips of paper, carried through the hatch.
  const slips = new Set();
  function slip(side, lines, { order = false, stamp = "APPROVED", duration = 2.2, stay = true } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshStandardMaterial({ map: paperTexture(lines, { order, stamp }), roughness: 0.9, side: THREE.DoubleSide }));
    m.castShadow = true; scene.add(m);
    const dir = side === "you" ? 1 : -1, fromX = side === "you" ? -3.9 : 3.9, hatchX = side === "you" ? -2 : 2;
    const tableX = side === "you" ? -0.5 : 0.5;
    const s = { mesh: m, t: 0, dur: duration, order, done: false, path: new THREE.CatmullRomCurve3(
      [new THREE.Vector3(fromX, 0.95, 0.35), new THREE.Vector3((fromX + hatchX) / 2, 1.55, 0.3), new THREE.Vector3(hatchX, 1.3, 0.1), new THREE.Vector3(tableX, 0.9, 0.35 + Math.random() * 0.2)]),
      spin: (Math.random() - 0.5) * 0.4, stay };
    if (order) { // an order thrown at your agent: it hits your wall and drops back on their side
      s.path = new THREE.CatmullRomCurve3([new THREE.Vector3(3.9, 0.95, 0.4), new THREE.Vector3(2.6, 1.6, 0.3), new THREE.Vector3(-1.75, 1.3, 0.1), new THREE.Vector3(-1.95, 1.25, 0.1)]);
    }
    slips.add(s);
    return s;
  }
  function clearSlips() { for (const s of slips) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.map.dispose(); s.mesh.material.dispose(); } slips.clear(); }

  // Camera: shots blend by a 0..1 mix the page drives; the pointer adds a little parallax.
  const cam = { from: SHOTS.wide, to: SHOTS.wide, mix: 1, px: 0, py: 0, tpx: 0, tpy: 0 };
  const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  let flash = 0;
  let tall = false;
  function setShot(from, to, mix) { const S = tall ? SHOTS_TALL : SHOTS; cam.from = S[from] || from; cam.to = S[to] || to; cam.mix = mix; }
  function setLight(room, v) { lamps[room].target = v; }
  function refuse() { flash = 1; }
  addEventListener("pointermove", (e) => { cam.tpx = (e.clientX / innerWidth - 0.5); cam.tpy = (e.clientY / innerHeight - 0.5); }, { passive: true });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    tall = w / h < 0.9; camera.fov = tall ? 44 : 30; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();

  let running = true, visible = true, last = performance.now(), first = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(container);
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });
  const tmpLook = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !visible) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    cam.px += (cam.tpx - cam.px) * 0.05; cam.py += (cam.tpy - cam.py) * 0.05;
    const e = cam.mix < 0.5 ? 2 * cam.mix * cam.mix : 1 - Math.pow(-2 * cam.mix + 2, 2) / 2;
    const p = lerp3(cam.from.pos, cam.to.pos, e), l = lerp3(cam.from.look, cam.to.look, e);
    camera.position.set(p[0] + cam.px * 0.9, p[1] - cam.py * 0.5, p[2]);
    camera.lookAt(tmpLook.set(l[0] + cam.px * 0.2, l[1], l[2]));
    for (const L of Object.values(lamps)) {
      L.level += (L.target - L.level) * (reduce ? 1 : 0.08);
      const flicker = L.level > 0.5 ? 1 + Math.sin(now * 0.004 + L.spot.position.x) * 0.012 : 1;
      L.spot.intensity = 38 * L.level * flicker; L.bulbMat.emissiveIntensity = 2.2 * L.level + 0.05;
    }
    flash = Math.max(0, flash - dt * 1.4);
    wallLines[0].color.setHex(C.line).lerp(new THREE.Color(0xd0505a), flash); wallLines[0].opacity = 0.55 + flash * 0.45;
    for (const w of seals) w.material.emissiveIntensity = 0.6 + Math.sin(now * 0.002) * 0.25;
    for (const s of slips) {
      if (s.done) continue;
      s.t = Math.min(1, s.t + dt / s.dur * (reduce ? 20 : 1));
      const k = s.t < 0.5 ? 2 * s.t * s.t : 1 - Math.pow(-2 * s.t + 2, 2) / 2;
      s.mesh.position.copy(s.path.getPoint(k));
      s.mesh.rotation.set(-Math.PI / 2 * Math.min(1, k * 1.15) * (s.order ? 0.2 : 1) + (1 - k) * 0.6, s.spin * (1 - k), s.spin * 0.5);
      if (s.t >= 1) { s.done = true; if (s.order) { const m = s.mesh; setTimeout(() => { scene.remove(m); slips.delete(s); }, 900); } }
    }
    renderer.render(scene, camera);
    if (first) { first = false; onReady?.(); }
  }
  requestAnimationFrame(frame);
  return { setShot, setLight, refuse, slip, clearSlips, SHOTS };
}
