// The game layer: connects the rules in ./core to the original Stillwander engine.
// The engine draws the world and moves the wanderer; this file turns the pointer
// and keys into bow actions, and draws what the World says is happening.
import { engine, hooks } from './engine.js';
import { World } from './core/world.js';
import { Target } from './core/target.js';
import { Wind, Hawk, LAND_BLESSINGS } from './core/blessing.js';
import { Burning, Chilled, Frozen, Stunned, Blinded, Lulled } from './core/effects.js';
import { Inventory } from './core/inventory.js';

const { T, scene, P, player, worldMat, Geo, TP, M, hex, colours } = engine;
const { VERM, cream, gold, dark, white, WOOD } = colours;
const PI = Math.PI, TAU = PI * 2;
const STRAW = 2;                 // the engine's material slot for straw
const SLOW = 0.55;               // the world's pace while a steered arrow flies
const RESPAWN = 10;              // seconds before a fallen target stands again
const SAVE_KEY = 'stillwander-bow2-kit';
const TINT = { wind: hex(0xbfefff), fire: hex(0xffa060), thunder: hex(0xfff08a), frost: hex(0xd8ecff),
  split: hex(0xa8e890), hawk: hex(0xff6a4a), bloom: hex(0xffb0c8) };
// What each shrine says as it blesses the bow.
const GIFT = {
  wind: 'The wind obeys the bow. Loose a Wind arrow, then lead it with the pointer.',
  fire: 'The Golden Wood sets the bow alight. Fire arrows burn, spread to those close by, and break a raised guard.',
  split: 'Bamboo grows in clusters. Split arrows leave the string as three.',
  frost: 'Snow Crest cools the string. Frost slows a foe, a second arrow freezes it, a full draw shatters it.',
  thunder: 'The marsh hums with storm. Thunder leaps to three more and stuns them, further in wet ground.',
  hawk: 'Crimson Vale gives the hawk\'s eye. Hawk arrows find their own prey.',
  bloom: 'Blossom Field opens. Where a Bloom arrow falls, flowers mend you and lull whatever stands among them.',
};

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
function placeTargets(cx = P.x, cz = P.z, radii = [7.5, 10, 12.5, 9, 14]) {
  const home = terrain.height(cx, cz);
  radii.forEach((r, i) => {
    let ang = -0.4 + i * 0.62, x = 0, z = 0, ok = false;
    for (let k = 0; k < 24 && !ok; k++) {   // walk round until the tile is open and near the centre's height
      x = Math.floor(cx + Math.cos(ang) * r) + 0.5; z = Math.floor(cz + Math.sin(ang) * r) + 0.5;
      const h = terrain.height(x, z);
      ok = Math.abs(h - home) <= 1 && h >= 0 && !terrain.blocked(x, z) && !world.hollows.some(t => Math.hypot(t.x - x, t.z - z) < 2);
      ang += 0.21;
    }
    if (ok) world.hollows.push(new Target(x, z));
  });
}

// ---- input --------------------------------------------------------------------
let pointer = null;            // where the mouse points on the ground
function aimAngle() {
  const p = pointer || { x: archer.x + Math.cos(archer.facing), z: archer.z + Math.sin(archer.facing) };
  return Math.atan2(p.z - archer.z, p.x - archer.x);
}
function steered() { return world.arrows.filter(a => a.steerable && !a.seeks && a.owner === archer && a.flying); }

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

hooks.awaken = th => {          // a woken shrine blesses the bow, never the archer
  const Kind = LAND_BLESSINGS[th.st.b];
  if (archer.bow.bind(new Kind())) {
    archer.bow.select(Kind);
    setTimeout(() => engine.say(GIFT[Kind.label] + ' T changes arrow.', 10), 2600);
    placeTargets(th.x, th.z, [7, 9.5, 12, 8.5]);     // a practice ground round the shrine
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
  world.wet = engine.land === 4;           // the marsh carries thunder further
  world.update(dt);
  P.x = archer.x; P.z = archer.z;          // a sidestep moves the wanderer
  for (const [kind, data] of world.drainEvents()) onEvent(kind, data);
  drawBow(); drawAim(); drawArrows(); drawStuck(); drawFigures(dt); drawMarks(dt, time); drawFx(dt);
  saveT += dt; if (saveT > 6) { saveT = 0; save(); }
};

function onEvent(kind, data) {
  if (kind === 'loose') {
    const fromArcher = data[0].owner === archer;
    if (data[0].sibling) return;          // a split arrow's twins share its sound
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
    if (arrow.blessing && !res.blocked) blessedHit(arrow.blessing.label, who);
  } else if (kind === 'arrowStuck' || kind === 'arrowBroke') {
    engine.noise({ f0: 900, f1: 260, dur: 0.07, vol: 0.05, type: 'lowpass' });
  } else if (kind === 'pickup') {
    engine.pluck(72 + [0, 2, 4, 7, 9][archer.inventory.arrows % 5], { vol: 0.1, dur: 1.2 });
    hudKit(true);
  } else if (kind === 'death') {
    engine.bloomRing(data[0].x, data[0].z, 0.4, 1.6, 6, engine.land);
  } else if (kind === 'chain') {
    thunder(data[0], data[1]);
  } else if (kind === 'steam') {
    const [x, z] = data, y = terrain.height(x, z);
    engine.leafBurst(x, y + 1, z, 12, [1, 1, 1], 1.4);
    engine.pulse(x, y, z, 4, 1.2, 0xffffff);
    engine.noise({ f0: 3000, f1: 800, dur: 0.6, vol: 0.06, type: 'highpass' });
    engine.say('Fire on frost: the steam blinds them.', 2);
  } else if (kind === 'grace') {
    grace(data[0]);
  } else if (kind === 'mend') {
    engine.pluck(76, { vol: 0.08, dur: 1.4 });
    engine.burst(P.x, P.y + 0.8, P.z, 4, 0.8);
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
      blessings: archer.bow.blessings.map(b => b.label),
      selected: archer.bow.selected ? archer.bow.selected.label : null,
      charges: archer.bow.charges,
    }));
  } catch (_) { /* storage unavailable: play on without it */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!s) return;
    archer.inventory.arrows = s.arrows;
    for (const label of s.blessings || []) {
      const Kind = LAND_BLESSINGS.find(K => K.label === label);
      if (Kind) archer.bow.bind(new Kind());
    }
    archer.bow.charges = s.charges || 0;
    const sel = LAND_BLESSINGS.find(K => K.label === s.selected);
    archer.bow.select(sel || null);
  } catch (_) { /* a broken save is ignored */ }
}
addEventListener('pagehide', save);

export { world };

// ---- what each blessing looks like ------------------------------------------------
const fx = [];                 // short-lived effect meshes: { obj, life, age, tick }
function addFx(obj, life, tick) { scene.add(obj); fx.push({ obj, life, age: 0, tick }); }
function drawFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.age += dt;
    if (f.tick) f.tick(f, Math.min(1, f.age / f.life));
    if (f.age >= f.life) { scene.remove(f.obj); fx.splice(i, 1); }
  }
}

function blessedHit(label, who) {
  const y = terrain.height(who.x, who.z);
  if (label === 'fire') {
    engine.leafBurst(who.x, y + 1.2, who.z, 10, [1, 0.55, 0.2], 1.8);
    engine.noise({ f0: 900, f1: 200, dur: 0.5, vol: 0.08, type: 'lowpass' });
  } else if (label === 'frost') {
    engine.leafBurst(who.x, y + 1.2, who.z, 9, [0.82, 0.93, 1], 1.5);
    engine.tone({ f0: 2400, f1: 3100, dur: 0.25, vol: 0.05, rev: 1 });
    engine.tone({ f0: 1800, f1: 1700, dur: 0.4, vol: 0.03, delay: 0.06, rev: 1 });
  } else if (label === 'hawk') {
    engine.leafBurst(who.x, y + 1.2, who.z, 7, [1, 0.4, 0.3], 1.4);
    engine.tone({ f0: 1700, f1: 2600, dur: 0.18, vol: 0.05 });
  } else if (label === 'split') {
    engine.leafBurst(who.x, y + 1.0, who.z, 5, [0.6, 0.85, 0.45], 1.2);
  }
}

// Lightning: a jagged bolt from the sky to the first, then leaps to the rest.
const boltMat = new T.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, depthWrite: false });
function bolt(a, b, group) {
  const pts = [a];
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    pts.push(new T.Vector3(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 0.7, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 0.4,
      a.z + (b.z - a.z) * t + (Math.random() - 0.5) * 0.7));
  }
  pts.push(b);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], len = p.distanceTo(q);
    const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, len, 4), boltMat);
    m.position.copy(p).add(q).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().sub(p).normalize());
    group.add(m);
  }
}
function thunder(first, rest) {
  const top = c => new T.Vector3(c.x, terrain.height(c.x, c.z) + 1.3, c.z);
  const g = new T.Group(), f = top(first);
  bolt(new T.Vector3(f.x - 1.5, f.y + 9, f.z + 1), f, g);
  let prev = first;
  for (const c of rest) { bolt(top(prev), top(c), g); prev = c; }
  addFx(g, 0.4, (fxo, k) => { boltMat.opacity = 1 - k; g.visible = Math.random() > 0.15 || k > 0.5; });
  engine.pulse(first.x, f.y - 1.3, first.z, 3, 0.6, 0xfff3b0);
  engine.shake(0.12);
  engine.noise({ f0: 4000, f1: 300, dur: 0.35, vol: 0.12, type: 'highpass' });
  engine.tone({ f0: 70, f1: 40, dur: 1.2, vol: 0.18, type: 'triangle', delay: 0.05 });
}

// Grace: a soft ring of flowers that mends and lulls, then fades.
const graceMat = new T.MeshBasicMaterial({ color: 0xffc4dc, transparent: true, opacity: 0.0, depthWrite: false });
function grace(g) {
  const y = terrain.height(g.x, g.z);
  const disc = new T.Mesh(new T.CircleGeometry(g.radius, 40).rotateX(-PI / 2), graceMat.clone());
  disc.position.set(g.x, y + 0.04, g.z);
  disc.renderOrder = 1;
  addFx(disc, 7, (f, k) => {
    disc.material.opacity = 0.32 * Math.min(1, f.age * 3) * (1 - Math.max(0, (k - 0.8) / 0.2));
    if (Math.random() < 0.08) engine.bloomRing(g.x, g.z, 0.3, g.radius, 1, 6);
  });
  engine.bloomRing(g.x, g.z, 0.3, g.radius, 16, 6);
  engine.pulse(g.x, y, g.z, g.radius + 0.5, 1.4, 0xffc4dc);
  [72, 76, 79, 84].forEach((n, i) => engine.pluck(n, { vol: 0.07, dur: 2, delay: i * 0.09 }));
}

// Marks on a struck figure: flames, frost, ice, stars, steam, petals.
const glow = new T.MeshBasicMaterial({ vertexColors: true });
const iceMat = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.78 });
const veil = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
function markSet() {
  const flame = new T.Mesh((() => { const g = new Geo();
    g.add(TP.cone8, M(0, 1.15, 0, 0.55, 0.9, 0.55), hex(0xff5a1f), hex(0xffe36a));
    g.add(TP.cone8, M(0.14, 1.2, 0.08, 0.3, 0.6, 0.3, 1), hex(0xff8a2a), hex(0xfff2a0)); return g.build(); })(), glow);
  const chill = new T.Mesh((() => { const g = new Geo(); g.add(TP.cyl12, M(0, 0.02, 0, 1.25, 0.06, 1.25), hex(0xcfe8ff)); return g.build(); })(), iceMat);
  const ice = new T.Mesh((() => { const g = new Geo();
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU;
      g.add(TP.octa, M(Math.cos(a) * 0.32, 0.9 + (i % 3) * 0.3, Math.sin(a) * 0.32, 0.45, 1.6 + (i % 2) * 0.5, 0.45, a, 0.15, (i % 2 ? 0.2 : -0.2)), hex(0xa8d8ff), hex(0xffffff)); }
    return g.build(); })(), iceMat);
  const stars = new T.Group();
  for (let i = 0; i < 3; i++) { const s = new T.Mesh((() => { const g = new Geo(); g.add(TP.octa, M(0, 0, 0, 0.16), hex(0xffe27a)); return g.build(); })(), glow); s.userData.a = i / 3 * TAU; stars.add(s); }
  stars.position.y = 2.05;
  const steam = new T.Mesh((() => { const g = new Geo();
    for (let i = 0; i < 4; i++) g.add(TP.ico1, M((i - 1.5) * 0.3, 1.5 + (i % 2) * 0.3, (i % 2 - 0.5) * 0.3, 0.6), hex(0xffffff)); return g.build(); })(), veil);
  const petals = new T.Group();
  for (let i = 0; i < 3; i++) { const s = new T.Mesh((() => { const g = new Geo(); g.add(TP.octa, M(0, 0, 0, 0.22, 0.05, 0.14), hex(0xffa8c8)); return g.build(); })(), glow); s.userData.a = i / 3 * TAU; petals.add(s); }
  petals.position.y = 2.0;
  return { flame, chill, ice, stars, steam, petals };
}
const marks = new Map();       // character -> its mark meshes
function drawMarks(dt, time) {
  for (const [c, f] of figures) {
    let m = marks.get(c);
    if (!m) { m = markSet(); for (const o of Object.values(m)) { o.visible = false; f.mesh.add(o); } marks.set(c, m); }
    const on = (o, yes) => { o.visible = yes && c.alive; };
    on(m.flame, c.has(Burning)); on(m.chill, c.has(Chilled)); on(m.ice, c.has(Frozen));
    on(m.stars, c.has(Stunned)); on(m.steam, c.has(Blinded)); on(m.petals, c.has(Lulled));
    if (m.flame.visible) { m.flame.scale.set(1, 0.8 + 0.3 * Math.sin(time * 19 + c.x), 1); if (Math.random() < dt * 6) engine.burst(c.x, terrain.height(c.x, c.z) + 1.9, c.z, 1, 0.6); }
    for (const g of [m.stars, m.petals]) if (g.visible) g.children.forEach(s => {
      const a = s.userData.a + time * (g === m.stars ? 5 : 1.4);
      s.position.set(Math.cos(a) * 0.45, Math.sin(time * 3 + s.userData.a) * 0.06, Math.sin(a) * 0.45);
      s.rotation.y = a;
    });
  }
  for (const c of [...marks.keys()]) if (!figures.has(c)) marks.delete(c);
}
