// The beasts on screen: their models, how they move, and what the player hears
// and reads as they grow wary, bolt, settle and carry the archer.
import { engine } from './engine.js';
import { MossbackOx, Mood } from './core/beast.js';

const { T, scene, P, player, worldMat, Geo, TP, M, hex } = engine;
const PI = Math.PI;
const toEngine = a => PI / 2 - a;
const height = (x, z) => engine.effH(Math.floor(x), Math.floor(z));
const RIDE_LIFT = 1.15;          // how high the archer sits on the ox's back

// Where the herds graze when the island first wakes.
const HERDS = [
  { Kind: MossbackOx, x: -30, z: 46, n: 4, tag: 'reedfield' },
  { Kind: MossbackOx, x: 96, z: -56, n: 3, tag: 'eastgrass' },
  { Kind: MossbackOx, x: -96, z: 112, n: 3, tag: 'westgrass' },
];

// ---- the Mossback Ox, built facing +z -----------------------------------------
const HIDE = hex(0x8c7b6b), HIDE2 = hex(0xb3a18c), MOSS = hex(0x7fae5c), MOSS2 = hex(0xb4d886);
const STONE = hex(0xd9d0bf), ROPE = hex(0xe9d9b0), PAPER = hex(0xfffaf0), DARK = hex(0x4a3d38);

function geo(build) { const g = new Geo(); build(g); return g.build(); }
const oxBody = geo(g => {
  g.add(TP.ico1, M(0, 1.15, 0, 1.3, 1.05, 2.45), HIDE, HIDE2);                  // the great body
  g.add(TP.dome, M(0, 1.5, -0.05, 1.22, 0.5, 2.15), MOSS, MOSS2);              // a meadow on its back
  for (let i = 0; i < 9; i++) {                                                // grass tufts and a few flowers
    const a = i * 2.4, r = 0.18 + (i % 3) * 0.17, x = Math.cos(a) * r, z = Math.sin(a) * r * 2.1;
    g.add(TP.cone4, M(x, 1.68, z, 0.16, 0.34, 0.16, a), MOSS, MOSS2);
    if (i % 3 === 0) g.add(TP.octa, M(x + 0.1, 1.86, z, 0.12), i % 2 ? hex(0xffd2e0) : PAPER);
  }
  g.add(TP.ico, M(0.18, 1.86, -0.35, 0.42, 0.34, 0.5, 0.6), STONE);            // a stone grown into the hump
  g.add(TP.box, M(0, 1.0, -1.18, 0.07, 0.55, 0.07, 0, 0.5), DARK);             // the tail
  g.add(TP.ico, M(0, 0.72, -1.38, 0.16), MOSS);
});
const oxHead = geo(g => {                                                     // pivot at the neck
  g.add(TP.box, M(0, -0.32, 0.05, 0.72, 0.66, 0.72), HIDE, HIDE2);
  g.add(TP.box, M(0, -0.48, 0.46, 0.52, 0.42, 0.36), HIDE2);                  // the muzzle
  for (const s of [-1, 1]) {
    g.add(TP.cone8, M(s * 0.36, 0.16, 0.02, 0.16, 0.62, 0.16, 0, 0.25, -s * 1.15), STONE, PAPER);  // horns
    g.add(TP.ico, M(s * 0.3, -0.12, 0.42, 0.09), DARK);                        // the eyes under the moss
  }
  g.add(TP.cyl12, M(0.5, 0.08, 0.02, 0.2, 0.08, 0.2, 0, 0, -1.15), ROPE);     // an old offering rope on a horn
  for (let i = 0; i < 3; i++) g.add(TP.box, M(0.6 + i * 0.05, -0.12 - i * 0.07, 0.02, 0.1, 0.16, 0.02, 0, 0, 0.3), PAPER);
});
const oxLeg = geo(g => {                                                      // pivot at the hip
  g.add(TP.cyl6, M(0, -0.78, 0, 0.3, 0.78, 0.3), DARK, HIDE);
  g.add(TP.cyl6, M(0, -0.8, 0, 0.36, 0.1, 0.36), DARK);
});
const mossClump = geo(g => {
  g.add(TP.ico1, M(0, 0, 0, 0.36, 0.3, 0.32), MOSS, MOSS2);
  g.add(TP.cone4, M(0.06, 0.08, 0, 0.1, 0.2, 0.1), MOSS2);
});
const glowMat = new T.MeshBasicMaterial({ vertexColors: true });
const eyeGlow = geo(g => g.add(TP.octa, M(0, 0, 0, 0.13), hex(0xffe27a)));
const moodMark = geo(g => g.add(TP.octa, M(0, 0, 0, 0.2, 0.32, 0.2), hex(0xffffff)));

function oxModel() {
  const root = new T.Group();
  const body = new T.Mesh(oxBody, worldMat); body.castShadow = true; root.add(body);
  const head = new T.Group(); head.position.set(0, 1.62, 1.2); root.add(head);
  const hm = new T.Mesh(oxHead, worldMat); hm.castShadow = true; head.add(hm);
  const legs = [];
  for (const [x, z] of [[-0.48, 0.78], [0.48, 0.78], [-0.48, -0.75], [0.48, -0.75]]) {
    const l = new T.Mesh(oxLeg, worldMat); l.castShadow = true; l.position.set(x, 0.82, z); root.add(l); legs.push(l);
  }
  // the moss over each eye: rule part 0 is the left eye (local -x), part 1 the right
  const moss = [-1, 1].map(s => { const m = new T.Mesh(mossClump, worldMat); m.position.set(s * 0.3, -0.12, 0.46); head.add(m); return m; });
  const eyes = [-1, 1].map(s => { const m = new T.Mesh(eyeGlow, glowMat); m.position.set(s * 0.3, -0.12, 0.47); m.visible = false; head.add(m); return m; });
  const mark = new T.Mesh(moodMark, new T.MeshBasicMaterial({ color: 0xf6c453, transparent: true, opacity: 0.9 }));
  mark.position.set(0, 2.55, 1.0); mark.visible = false; root.add(mark);
  return { root, head, legs, moss, eyes, mark };
}

// ---- the herds -------------------------------------------------------------------
const views = new Map();         // Beast -> { model, walk, last }
let world = null;

function openGround(cx, cz, home) {
  for (let k = 0; k < 30; k++) {
    const a = k * 2.39, r = 1.5 + k * 0.9, x = Math.floor(cx + Math.cos(a) * r) + 0.5, z = Math.floor(cz + Math.sin(a) * r) + 0.5;
    const h = height(x, z);
    if (h >= 0.5 && Math.abs(h - home) <= 1.2 && !engine.blockedAt(x, z) && !world.beasts.some(b => Math.hypot(b.x - x, b.z - z) < 5)) return [x, z];
  }
  return null;
}
export function placeHerds(w, saved) {
  world = w;
  if (saved && saved.length) {
    for (const s of saved) {
      const Kind = s.kind === 'MossbackOx' ? MossbackOx : null;
      if (!Kind) continue;
      const b = new Kind(s.x, s.z, s.herd); b.facing = s.f || 0;
      if (s.calmed) { b.mood = Mood.CALMED; for (const p of b.keyParts) p.broken = true; }
      w.beasts.push(b);
    }
    return;
  }
  for (const h of HERDS) {
    const home = height(h.x, h.z);
    for (let i = 0; i < h.n; i++) {
      const at = openGround(h.x + (i % 2) * 7 - 3.5, h.z + Math.floor(i / 2) * 7 - 3.5, home);
      if (!at) continue;
      const b = new h.Kind(at[0], at[1], h.tag);
      b.facing = world.random() * PI * 2;
      b.home = [h.x, h.z];
      w.beasts.push(b);
    }
  }
}
export const beastSave = () => world ? world.beasts.map(b => ({ kind: b.constructor.name, x: +b.x.toFixed(1), z: +b.z.toFixed(1), f: +b.facing.toFixed(2), herd: b.herd, calmed: b.calmed })) : [];

// ---- drawing ---------------------------------------------------------------------
const MOOD_COL = { wary: 0xf6c453, alert: 0xe0483a };
export function drawBeasts(dt, time) {
  const a = world.archer;
  for (const b of world.beasts) {
    let v = views.get(b);
    const far = Math.hypot(b.x - P.x, b.z - P.z) > 90;
    if (!v) {
      if (far) continue;
      v = { m: oxModel(), walk: Math.random() * 6, last: [b.x, b.z], speed: 0 };
      scene.add(v.m.root); views.set(b, v);
    }
    v.m.root.visible = !far;
    if (far) continue;
    const moved = Math.hypot(b.x - v.last[0], b.z - v.last[1]);
    v.last = [b.x, b.z];
    v.speed += ((dt > 0 ? moved / dt : 0) - v.speed) * Math.min(1, dt * 8);
    v.walk += v.speed * dt * 2.2;
    const { root, head, legs, moss, eyes, mark } = v.m;
    root.position.set(b.x, height(b.x, b.z), b.z);
    root.rotation.y = toEngine(b.facing);
    const stride = Math.min(0.55, v.speed * 0.16);
    legs.forEach((l, i) => { l.rotation.x = Math.sin(v.walk + (i === 0 || i === 3 ? 0 : PI)) * stride; });
    root.children[0].position.y = Math.abs(Math.sin(v.walk)) * stride * 0.12;
    const grazing = b.mood === Mood.CALM || (b.calmed && !b.rider && !b.following);
    const down = grazing && v.speed < 0.2 ? 0.55 + Math.sin(time * 1.3 + b.x) * 0.08 : b.mood === Mood.WARY ? -0.25 : 0;
    head.rotation.x += (down - head.rotation.x) * Math.min(1, dt * 3);
    b.parts.forEach((p, i) => { moss[i].visible = !p.broken; eyes[i].visible = p.broken; });
    const col = MOOD_COL[b.mood];
    mark.visible = !!col;
    if (col) { mark.material.color.setHex(col); mark.position.y = 2.55 + Math.sin(time * 4) * 0.06; mark.rotation.y = time * 2; }
    if (b.rider) player.position.y += RIDE_LIFT + root.children[0].position.y;
  }
  // a soft word when the archer stands beside a calmed ox
  const near = !a.mount && world.beasts.find(b => b.calmed && b.distanceTo(a) <= b.radius + 1.8);
  if (near && !shownRide) { engine.say('R to climb on its back.', 2.4); shownRide = true; }
  if (!near) shownRide = false;
}
let shownRide = false;

// ---- what the player hears and reads ----------------------------------------------
export function beastEvent(kind, data) {
  const b = data[0];
  if (!(b && b.parts)) return false;
  const y = height(b.x, b.z), near = Math.hypot(b.x - P.x, b.z - P.z) < 40;
  if (kind === 'mood') {
    if (data[1] === Mood.ALERT && near) {
      engine.tone({ f0: 110, f1: 70, dur: 0.6, vol: 0.14, type: 'triangle' });        // a low snort
      engine.noise({ f0: 600, f1: 150, dur: 0.4, vol: 0.06, type: 'lowpass' });
      engine.shake(0.05);
    } else if (data[1] === Mood.WARY && near) engine.tone({ f0: 180, f1: 150, dur: 0.35, vol: 0.06, type: 'triangle' });
  } else if (kind === 'partBroken') {
    const [px, pz] = data[1].position(b);
    engine.leafBurst(px, y + data[1].y, pz, 9, [0.5, 0.72, 0.36], 1.4);
    engine.pluck(69, { vol: 0.07, dur: 1 });
  } else if (kind === 'calmed') {
    engine.bloomRing(b.x, b.z, 0.5, 3.2, 12, engine.land);
    engine.pulse(b.x, y, b.z, 4.2, 1.6, 0xfff3c4);
    [60, 64, 67, 72].forEach((n, i) => engine.pluck(n, { vol: 0.09, dur: 2.4, delay: i * 0.12 }));
    engine.say(`The ${b.constructor.label} sees you now, and lowers its head. Walk up and press R to ride. Hum (H) to call it later.`, 7);
  } else if (kind === 'regrow' && near) {
    engine.say('The moss crept back over its eyes while it ran.', 3);
  } else if (kind === 'soothed' && near) {
    engine.burst(b.x, y + 1.9, b.z, 3, 0.8);
  } else if (kind === 'called') {
    engine.say('Far off, the ox lifts its head and comes.', 2.5);
  } else if (kind === 'mount') {
    engine.tone({ f0: 140, f1: 120, dur: 0.5, vol: 0.08, type: 'triangle' });
    engine.burst(b.x, y + 1.6, b.z, 6, 1.2);
  } else if (kind === 'dismount') {
    engine.burst(P.x, P.y + 0.3, P.z, 4, 0.8);
  }
  return true;
}

export function beastKey(k) {
  if (k === 'r') {
    if (world.archer.mount) world.dismount();
    else if (!world.mount()) {
      if (world.beasts.some(b => b.hostile && b.distanceTo(world.archer) < 4)) engine.say('It will not carry you yet. Free its eyes of moss; hum first so it stays.', 3.5);
    }
    return true;
  }
  if (k === 'h') { world.hum(world.archer.x, world.archer.z); return false; }
  return false;
}

// Tall grass on the plain hides an archer who is still, or creeping with the bow drawn.
export function senseArcher() {
  const a = world.archer, k = engine.keys;
  const moving = !!(k.w || k.a || k.s || k.d || k.arrowup || k.arrowdown || k.arrowleft || k.arrowright) || a.sidestepping;
  const s = engine.survey(Math.floor(a.x), Math.floor(a.z));
  world.archerMoving = moving;
  world.archerHidden = !a.mount && s.b === 0 && !s.road && s.h > 0 && (!moving || a.bow.drawing);
}
