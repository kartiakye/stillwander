// The game layer: connects the rules in ./core to the original Stillwander engine.
// The engine draws the world and moves the wanderer; this file turns the pointer
// and keys into bow actions, and draws what the World says is happening.
import { engine, hooks } from './engine.js';
import { World } from './core/world.js';
import { Target } from './core/target.js';
import { Wind } from './core/blessing.js';
import { Inventory } from './core/inventory.js';

const { T, scene, P, player, worldMat, Geo, TP, M, hex, colours } = engine;
const { VERM, cream, gold, dark, white, WOOD } = colours;
const PI = Math.PI, TAU = PI * 2;
const STRAW = 2;                 // the engine's material slot for straw
const SLOW = 0.55;               // the world's pace while a steered arrow flies
const RESPAWN = 10;              // seconds before a fallen target stands again
const SAVE_KEY = 'stillwander-bow2-kit';
const TINT = { wind: hex(0xbfefff), fire: hex(0xffa060), thunder: hex(0xfff08a), frost: hex(0xd8ecff) };

// Engine angles are measured from +z (three.js facing); the rules measure from +x.
const toEngine = a => PI / 2 - a;
const fromEngine = f => PI / 2 - f;

// ---- the world, standing on the engine's terrain ------------------------------
const terrain = {
  height: (x, z) => engine.effH(Math.floor(x), Math.floor(z)),
  blocked: (x, z) => engine.blockedAt(x, z),
};
const world = new World(7, terrain);
const archer = world.archer;

// ---- models, built with the engine's own mesh kit -----------------------------
function mesh(build) { const g = new Geo(); build(g); const m = new T.Mesh(g.build(), worldMat); m.castShadow = true; return m; }

function arrowModel(tint) {
  return mesh(g => {
    g.add(TP.box, M(0, -0.022, 0, 0.044, 0.044, 1.05), hex(0x8b6448));
    g.add(TP.octa, M(0, 0, 0.56, 0.07, 0.07, 0.15), dark);
    for (const r of [0, PI / 2]) g.add(TP.box, M(0, -0.07, -0.42, 0.012, 0.14, 0.2, 0, 0, r), tint || white);
  });
}

const bowMesh = mesh(g => {             // a bow drawn as a shallow curve of short staves
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n - 0.5) * 2.3, t1 = ((i + 1) / n - 0.5) * 2.3, tm = (t0 + t1) / 2;
    const y = Math.sin(tm) * 0.62, z = 0.2 - 0.2 * Math.cos(tm) * 1.1;
    const len = Math.hypot(Math.sin(t1) - Math.sin(t0), Math.cos(t1) - Math.cos(t0)) * 0.66;
    g.add(TP.box, M(0, y - len / 2, z, 0.05, len + 0.02, 0.05, 0, Math.atan2(-Math.sin(tm) * 0.22, Math.cos(tm))), hex(0x6b4430), hex(0x9a6a48));
  }
  g.add(TP.box, M(0, -0.6, 0.02, 0.012, 1.2, 0.012), cream);   // the string
});
bowMesh.position.set(0.34, 0.62, 0.08);
player.add(bowMesh);
const nocked = arrowModel();
nocked.visible = false;
bowMesh.add(nocked);

const targetGeo = (() => {
  const g = new Geo(), straw = hex(0xe9cf86), straw2 = hex(0xf6e2a8);
  g.add(TP.box, M(0, 0, 0, 0.5, 0.12, 0.5), WOOD);
  g.add(TP.cyl6, M(0, 0, 0, 0.13, 1.0, 0.13), WOOD);
  g.add(TP.robe, M(0, 0.45, 0, 0.8, 0.95, 0.8), straw, straw2);
  g.add(TP.cyl12, M(0, 1.0, 0, 0.62, 0.08, 0.62), VERM);
  g.add(TP.box, M(0, 1.2, 0, 1.25, 0.09, 0.09), WOOD);
  g.add(TP.ico1, M(0, 1.6, 0, 0.27), straw2);
  return g.build();
})();

// The aim line: small diamonds on the ground.
const dotMat = new T.MeshBasicMaterial({ color: 0x2b2550, transparent: true, opacity: 0.5, depthWrite: false });
const dotGeo = new T.PlaneGeometry(0.2, 0.2).rotateX(-PI / 2).rotateY(PI / 4);
const dots = Array.from({ length: 18 }, () => { const d = new T.Mesh(dotGeo, dotMat); d.visible = false; d.renderOrder = 2; scene.add(d); return d; });

// ---- what is on screen, keyed by the rule objects ------------------------------
const flying = new Map();      // Arrow -> { mesh, ribbon }
const stuck = new Map();       // StuckArrow -> mesh
const figures = new Map();     // Target -> { mesh, punch, fallen }
const respawns = [];

function ribbon(colour) {      // the pale ribbon a blessed arrow leaves behind
  const N = 26, pos = new Float32Array(N * 2 * 3), alpha = new Float32Array(N * 2);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('a', new T.BufferAttribute(alpha, 1));
  const idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { c: { value: new T.Color(...colour) } },
    vertexShader: 'attribute float a;varying float v;void main(){v=a;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 c;varying float v;void main(){gl_FragColor=vec4(mix(c,vec3(1.0),0.3),v*0.8);}',
  });
  const m = new T.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 3; scene.add(m);
  return { m, pts: [], N };
}
function drawRibbon(r, y) {
  const { pts, N } = r, pos = r.m.geometry.attributes.position.array, al = r.m.geometry.attributes.a.array;
  for (let i = 0; i < N; i++) {
    const p = pts[Math.max(0, pts.length - N + i)] || pts[0], q = pts[Math.max(0, pts.length - N + i - 1)] || p;
    if (!p) continue;
    let dx = p[0] - q[0], dz = p[1] - q[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const k = Math.min(1, pts.length / N) * (i / (N - 1)), w = 0.17 * k;
    pos.set([p[0] - dz * w, y, p[1] + dx * w, p[0] + dz * w, y, p[1] - dx * w], i * 6);
    al[i * 2] = al[i * 2 + 1] = k * k;
  }
  r.m.geometry.attributes.position.needsUpdate = true;
  r.m.geometry.attributes.a.needsUpdate = true;
}

// ---- practice ground: straw figures near the start -----------------------------
function placeTargets() {
  const home = terrain.height(P.x, P.z);
  [7.5, 10, 12.5, 9, 14].forEach((r, i) => {
    let ang = -0.4 + i * 0.62, x = 0, z = 0;
    for (let k = 0; k < 14; k++) {      // walk round until the tile is open and level with the start
      x = Math.floor(P.x + Math.cos(ang) * r) + 0.5; z = Math.floor(P.z + Math.sin(ang) * r) + 0.5;
      if (terrain.height(x, z) === home && !terrain.blocked(x, z) && terrain.height(x, z) >= 0) break;
      ang += 0.21;
    }
    world.hollows.push(new Target(x, z));
  });
}

// ---- input --------------------------------------------------------------------
let pointer = null;            // where the mouse points on the ground
function aimAngle() {
  const p = pointer || { x: archer.x + Math.cos(archer.facing), z: archer.z + Math.sin(archer.facing) };
  return Math.atan2(p.z - archer.z, p.x - archer.x);
}
function steered() { return world.arrows.filter(a => a.steerable && a.owner === archer && a.flying); }

hooks.pointer = (kind, hit, button) => {
  if (hit) pointer = hit;
  if (kind === 'cancel') { archer.bow.cancel(); return; }
  if (kind === 'down') {
    if (archer.draw()) engine.noise({ f0: 700, f1: 2000, dur: 0.5, vol: 0.03, att: 0.4 });
    else if (archer.inventory.arrows <= 0) engine.say('No arrows. Four straw make one: press C.', 3);
  } else if (kind === 'up') {
    archer.loose(aimAngle(), world);
  }
};

hooks.key = k => {
  if (k === 'c') craft();
  else if (k === 'f') gather();
  else if (k === 't') cycle();
  else if (k === 'shift') sidestep();
};

function craft() {
  if (engine.inv[STRAW] < Inventory.STRAW_PER_ARROW) { engine.say('An arrow needs four straw. Gather from grass and shrubs with F.', 3); return; }
  engine.inv[STRAW] -= Inventory.STRAW_PER_ARROW;
  archer.inventory.arrows += 1;
  engine.hud();
  engine.pluck(67, { vol: 0.08, dur: 1.2 }); engine.pluck(74, { vol: 0.06, dur: 1.4, delay: 0.09 });
  engine.say('One arrow made.', 1.6);
  hudKit(true);
}

function gather() {             // cut the nearest grass, reed or shrub; its straw flies to you
  let best = null, bd = 1.9;
  engine.eachCut(c => {
    if (c.solid) return;
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    if (d < bd && Math.abs(c.h - P.y) < 1.2) { bd = d; best = c; }
  });
  if (!best) { engine.say('Nothing to gather here. Find grass, reeds or a shrub.', 2.2); return; }
  const d = Math.hypot(best.x - P.x, best.z - P.z) || 1;
  engine.strike(best, (best.x - P.x) / d, (best.z - P.z) / d);
}

function cycle() {
  if (!archer.bow.blessings.length) { engine.say('The bow carries no blessing yet. Wake a shrine.', 3); return; }
  const b = archer.bow.cycle();
  engine.say(b ? `${b.label} arrow` : 'Plain arrow', 1.4);
  hudKit();
}

function sidestep() {
  let dx = -Math.cos(archer.facing), dz = -Math.sin(archer.facing);   // default: step back from the aim
  if (engine.moveDir) [dx, dz] = engine.moveDir();
  if (archer.sidestep(dx, dz)) engine.noise({ f0: 900, f1: 300, dur: 0.18, vol: 0.05 });
  else if (archer.stamina < 25) engine.say('Out of breath.', 1.2);
}

// ---- the engine asks, the game answers ------------------------------------------
hooks.speed = () => archer.bow.drawing ? 0.45 : 1;
hooks.face = () => (archer.bow.drawing || steered().length) ? toEngine(aimAngle()) : null;
hooks.timeScale = () => steered().length ? SLOW : 1;

hooks.awaken = () => {          // a woken shrine blesses the bow, never the archer
  if (archer.bow.bind(new Wind())) {
    archer.bow.select(Wind);
    setTimeout(() => engine.say('The wind obeys the bow. Loose, then lead the arrow with the pointer. T changes arrow.', 9), 2600);
  } else archer.bow.recharge(3);
  hudKit(true);
};
hooks.chime = () => { if (archer.bow.blessings.length) { archer.bow.recharge(1); hudKit(); } };

hooks.begin = () => {
  load();
  placeTargets();
  hudKit();
};

hooks.update = (dt, time) => {
  pointer = engine.pointer() || pointer;
  archer.x = P.x; archer.z = P.z;
  if (hooks.face() === null && !archer.sidestepping) archer.facing = fromEngine(P.face);
  for (const a of steered()) if (pointer) a.steerTowards(pointer.x, pointer.z);
  world.update(dt);
  P.x = archer.x; P.z = archer.z;          // a sidestep moves the wanderer
  for (const [kind, data] of world.drainEvents()) onEvent(kind, data);
  drawBow(); drawAim(); drawArrows(); drawStuck(); drawFigures(dt);
  saveT += dt; if (saveT > 6) { saveT = 0; save(); }
};

function onEvent(kind, data) {
  if (kind === 'loose') {
    const fromArcher = data[0].owner === archer;
    engine.noise({ f0: 2600, f1: 900, dur: 0.16, vol: fromArcher ? 0.09 : 0.05, type: 'highpass' });
    engine.tone({ f0: 520, f1: 210, dur: 0.14, vol: 0.06, type: 'triangle' });
    hudKit();
  } else if (kind === 'hit') {
    const [arrow, who, res] = data, f = figures.get(who);
    if (f) f.punch = 1;
    engine.tone({ f0: 170, f1: 90, dur: 0.16, vol: 0.2, type: 'triangle' });
    engine.noise({ f0: 1500, f1: 400, dur: 0.08, vol: 0.08, type: 'lowpass' });
    engine.burst(who.x, terrain.height(who.x, who.z) + 1.1, who.z, 5, 1.6);
    if (res.blocked) engine.say('Turned aside.', 1);
  } else if (kind === 'arrowStuck' || kind === 'arrowBroke') {
    engine.noise({ f0: 900, f1: 260, dur: 0.07, vol: 0.05, type: 'lowpass' });
  } else if (kind === 'pickup') {
    engine.pluck(72 + [0, 2, 4, 7, 9][archer.inventory.arrows % 5], { vol: 0.1, dur: 1.2 });
    hudKit(true);
  } else if (kind === 'death') {
    engine.bloomRing(data[0].x, data[0].z, 0.4, 1.6, 6, engine.land);
  }
}

// ---- drawing what the rules say -------------------------------------------------
function drawBow() {
  const b = archer.bow;
  if (b.drawing) {
    bowMesh.position.set(0, 0.62, 0.42);
    nocked.visible = true;
    nocked.position.set(0, -0.02, 0.2 - b.power * 0.3);
  } else {
    bowMesh.position.set(0.34, 0.62, 0.08);
    nocked.visible = false;
  }
}

function drawAim() {
  const b = archer.bow;
  if (!b.drawing) { for (const d of dots) d.visible = false; return; }
  const ang = archer.aimAngle(aimAngle(), world.time);
  const blessed = b.selected && b.charges > 0;
  const reach = (blessed && b.has(Wind) ? 9 : 6 + 12 * b.power) * archer.aimLineScale;
  dots.forEach((d, i) => {
    const r = 1.2 + i * 0.95;
    if (r > reach) { d.visible = false; return; }
    const x = archer.x + Math.cos(ang) * r, z = archer.z + Math.sin(ang) * r;
    d.visible = true;
    d.position.set(x, terrain.height(x, z) + 0.06, z);
  });
}

function drawArrows() {
  for (const [a, v] of flying) {
    if (world.arrows.includes(a)) continue;
    scene.remove(v.mesh);
    if (v.ribbon) scene.remove(v.ribbon.m);
    flying.delete(a);
  }
  for (const a of world.arrows) {
    let v = flying.get(a);
    if (!v) {
      const tint = a.blessing ? TINT[a.blessing.label] : null;
      v = { mesh: arrowModel(tint), ribbon: tint ? ribbon(tint) : null };
      v.mesh.scale.setScalar(1.25);
      scene.add(v.mesh);
      flying.set(a, v);
    }
    v.mesh.position.set(a.x, a.height, a.z);
    v.mesh.rotation.set(0, toEngine(a.angle), 0);
    if (v.ribbon) { v.ribbon.pts.push([a.x, a.z]); drawRibbon(v.ribbon, a.height); }
  }
}

function drawStuck() {
  for (const [s, m] of stuck) if (!world.stuck.includes(s)) { scene.remove(m); stuck.delete(s); }
  for (const s of world.stuck) {
    if (stuck.has(s)) continue;
    const m = arrowModel();
    m.position.set(s.x, terrain.height(s.x, s.z) + 0.38, s.z);
    m.rotation.set(-1.0, (s.x * 97 + s.z * 31) % TAU, 0, 'YXZ');
    scene.add(m);
    stuck.set(s, m);
  }
}

function drawFigures(dt) {
  for (const c of world.hollows) {
    if (figures.has(c)) continue;
    const m = new T.Mesh(targetGeo, worldMat);
    m.castShadow = m.receiveShadow = true;
    m.position.set(c.x, terrain.height(c.x, c.z), c.z);
    m.rotation.y = Math.atan2(P.x - c.x, P.z - c.z);
    scene.add(m);
    figures.set(c, { mesh: m, punch: 0, fallen: 0 });
  }
  for (const [c, f] of figures) {
    f.punch = Math.max(0, f.punch - dt * 5);
    const s = 1 + 0.2 * Math.sin(f.punch * PI);
    f.mesh.scale.set(s, 1 / s, s);
    if (c.alive) { f.mesh.rotation.x = -0.18 * f.punch; continue; }
    f.fallen += dt;
    f.mesh.rotation.x = -Math.min(1.5, f.fallen * 4.5);          // it tips over backwards
    if (f.fallen > 1.6) {
      scene.remove(f.mesh);
      figures.delete(c);
      world.hollows.splice(world.hollows.indexOf(c), 1);
      respawns.push([world.time + RESPAWN, c.x, c.z]);
    }
  }
  for (let i = respawns.length - 1; i >= 0; i--) {
    if (respawns[i][0] > world.time) continue;
    world.hollows.push(new Target(respawns[i][1], respawns[i][2]));
    respawns.splice(i, 1);
  }
}

// ---- the quiver line under the materials ------------------------------------------
const $ = id => document.getElementById(id);
function hudKit(bump) {
  $('ac').textContent = archer.inventory.arrows;
  const b = archer.bow;
  $('bless').textContent = b.blessings.length
    ? `${b.selected ? b.selected.label : 'plain'} · ${'◆'.repeat(b.charges)}${'◇'.repeat(3 - b.charges)}`
    : '';
  if (bump) { const k = $('kit'); k.style.transform = 'scale(1.12)'; setTimeout(() => { k.style.transform = ''; }, 170); }
}

// ---- keeping the quiver between visits --------------------------------------------
let saveT = 0;
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      arrows: archer.inventory.arrows,
      wind: archer.bow.has(Wind),
      charges: archer.bow.charges,
    }));
  } catch (_) { /* storage unavailable: play on without it */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!s) return;
    archer.inventory.arrows = s.arrows;
    if (s.wind) { archer.bow.bind(new Wind()); archer.bow.charges = s.charges; archer.bow.select(Wind); }
  } catch (_) { /* a broken save is ignored */ }
}
addEventListener('pagehide', save);

export { world };
