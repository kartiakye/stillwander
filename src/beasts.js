// The beasts on screen: their models, how they move, and what the player hears
// and reads as they grow wary, bolt, settle and carry the archer.
import { engine } from './engine.js';
import { MossbackOx, GinkgoStag, HollowBoar, FrostmaneBear, ReedToad, MapleCrane, ElderCarp, BEASTS, Mood } from './core/beast.js';

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
  { Kind: GinkgoStag, x: 268, z: -118, n: 3, tag: 'goldglade' },
  { Kind: GinkgoStag, x: 402, z: -58, n: 2, tag: 'highgold' },
  { Kind: HollowBoar, x: 302, z: 118, n: 2, tag: 'canebrake' },
  { Kind: HollowBoar, x: 412, z: 228, n: 2, tag: 'deepcane' },
  { Kind: FrostmaneBear, x: -368, z: -236, n: 1, tag: 'lowsnow' },
  { Kind: FrostmaneBear, x: -452, z: -186, n: 1, tag: 'westsnow' },
  { Kind: ReedToad, x: -398, z: 206, n: 1, tag: 'mere' },
  { Kind: ReedToad, x: -322, z: 118, n: 1, tag: 'lotus' },
  { Kind: MapleCrane, x: -122, z: -276, n: 5, tag: 'redbank' },
  { Kind: MapleCrane, x: 104, z: -262, n: 4, tag: 'mesa' },
  { Kind: ElderCarp, x: 60.5, z: 262.5, n: 1, tag: 'petalpond', exact: true },
];

// ---- models, all built facing +z ---------------------------------------------------
const HIDE = hex(0x8c7b6b), HIDE2 = hex(0xb3a18c), MOSS = hex(0x7fae5c), MOSS2 = hex(0xb4d886);
const STONE = hex(0xd9d0bf), ROPE = hex(0xe9d9b0), PAPER = hex(0xfffaf0), DARK = hex(0x4a3d38);
const WOODB = hex(0x6b4a38), GOLDL = hex(0xf2c14e), GOLDL2 = hex(0xffe08a), CANE = hex(0x9fbf62), CANE2 = hex(0xd3e29a);
const ICE = hex(0xa8d8ff), ICE2 = hex(0xffffff), RED = hex(0xd8452e), RED2 = hex(0xf58a5a);

function geo(build) { const g = new Geo(); build(g); return g.build(); }
const leg = (w, len, c1, c2) => geo(g => { g.add(TP.cyl6, M(0, -len, 0, w, len, w), c1, c2); g.add(TP.cyl6, M(0, -len - 0.02, 0, w * 1.2, 0.1, w * 1.2), c1); });
const iceMat = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.82 });

// Each beast: its body, its head (pivot at the neck), where its legs stand, and
// what each breakable part looks like.
const SPEC = {
  MossbackOx: {
    headAt: [1.62, 1.2], legs: [[-0.48, 0.78], [0.48, 0.78], [-0.48, -0.75], [0.48, -0.75]], hip: 0.82, leg: leg(0.3, 0.78, DARK, HIDE), mark: 2.55, graze: 0.55,
    body: g => {
      g.add(TP.ico1, M(0, 1.15, 0, 1.3, 1.05, 2.45), HIDE, HIDE2);
      g.add(TP.dome, M(0, 1.5, -0.05, 1.22, 0.5, 2.15), MOSS, MOSS2);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = 0.18 + (i % 3) * 0.17, x = Math.cos(a) * r, z = Math.sin(a) * r * 2.1;
        g.add(TP.cone4, M(x, 1.68, z, 0.16, 0.34, 0.16, a), MOSS, MOSS2);
        if (i % 3 === 0) g.add(TP.octa, M(x + 0.1, 1.86, z, 0.12), i % 2 ? hex(0xffd2e0) : PAPER);
      }
      g.add(TP.ico, M(0.18, 1.86, -0.35, 0.42, 0.34, 0.5, 0.6), STONE);
      g.add(TP.box, M(0, 1.0, -1.18, 0.07, 0.55, 0.07, 0, 0.5), DARK);
      g.add(TP.ico, M(0, 0.72, -1.38, 0.16), MOSS);
    },
    head: g => {
      g.add(TP.box, M(0, -0.32, 0.05, 0.72, 0.66, 0.72), HIDE, HIDE2);
      g.add(TP.box, M(0, -0.48, 0.46, 0.52, 0.42, 0.36), HIDE2);
      for (const s of [-1, 1]) {
        g.add(TP.cone8, M(s * 0.36, 0.16, 0.02, 0.16, 0.62, 0.16, 0, 0.25, -s * 1.15), STONE, PAPER);
        g.add(TP.ico, M(s * 0.3, -0.12, 0.42, 0.09), DARK);
      }
      g.add(TP.cyl12, M(0.5, 0.08, 0.02, 0.2, 0.08, 0.2, 0, 0, -1.15), ROPE);
      for (let i = 0; i < 3; i++) g.add(TP.box, M(0.6 + i * 0.05, -0.12 - i * 0.07, 0.02, 0.1, 0.16, 0.02, 0, 0, 0.3), PAPER);
    },
    part: () => geo(g => { g.add(TP.ico1, M(0, 0, 0, 0.36, 0.3, 0.32), MOSS, MOSS2); g.add(TP.cone4, M(0.06, 0.08, 0, 0.1, 0.2, 0.1), MOSS2); }),
    onHead: true, partOffset: [0, 0.05, 0.34],
  },
  GinkgoStag: {
    headAt: [2.0, 0.85], legs: [[-0.26, 0.55], [0.26, 0.55], [-0.26, -0.6], [0.26, -0.6]], hip: 1.05, leg: leg(0.14, 1.0, hex(0x8a6a48), hex(0xc9a678)), mark: 3.5, graze: 0.9,
    body: g => {
      g.add(TP.ico1, M(0, 1.35, 0, 0.72, 0.8, 1.75), hex(0xc9a678), hex(0xe8d2a8));
      g.add(TP.cyl6, M(0, 1.45, 0.6, 0.3, 0.75, 0.3, 0, 0.75), hex(0xc9a678), hex(0xe8d2a8));   // the neck
      g.add(TP.ico, M(0, 1.5, -0.9, 0.22), PAPER);                                              // a white scut
      for (let i = 0; i < 4; i++) g.add(TP.octa, M((i % 2 ? 0.25 : -0.25), 1.72, -0.5 + i * 0.3, 0.1, 0.04, 0.1), GOLDL2);
    },
    head: g => {
      g.add(TP.box, M(0, -0.2, 0.05, 0.36, 0.36, 0.5), hex(0xc9a678), hex(0xe8d2a8));
      g.add(TP.box, M(0, -0.22, 0.4, 0.22, 0.2, 0.26), hex(0xe8d2a8));
      g.add(TP.ico, M(0, -0.14, 0.54, 0.08), DARK);
      for (const s of [-1, 1]) {
        g.add(TP.box, M(s * 0.14, 0.12, -0.02, 0.06, 0.62, 0.06, 0, 0, -s * 0.5), WOODB);       // antlers like branches
        g.add(TP.box, M(s * 0.44, 0.52, -0.02, 0.05, 0.44, 0.05, 0, 0, s * 0.35), WOODB);
        g.add(TP.box, M(s * 0.3, 0.4, 0.02, 0.05, 0.36, 0.05, 0, 0.5, -s * 0.9), WOODB);
        g.add(TP.ico, M(s * 0.1, 0.0, 0.3, 0.07), DARK);
      }
    },
    part: () => geo(g => { for (let i = 0; i < 6; i++) { const a = i * 1.05; g.add(TP.octa, M(Math.cos(a) * 0.2, (i % 3) * 0.14 - 0.1, Math.sin(a) * 0.2, 0.3, 0.1, 0.22, a, 0.4), GOLDL, GOLDL2); } }),
    onHead: true,
  },
  HollowBoar: {
    headAt: [0.95, 1.0], legs: [[-0.42, 0.6], [0.42, 0.6], [-0.42, -0.6], [0.42, -0.6]], hip: 0.55, leg: leg(0.26, 0.5, DARK, hex(0x6b4d3f)), mark: 2.2, graze: 0.35,
    body: g => {
      g.add(TP.ico1, M(0, 0.95, 0, 1.25, 1.1, 2.1), hex(0x5e4438), hex(0x8a6a58));
      for (let i = 0; i < 5; i++) g.add(TP.cone4, M(0, 1.42, 0.6 - i * 0.32, 0.14, 0.3, 0.14), DARK);   // a bristle ridge
    },
    head: g => {
      g.add(TP.box, M(0, -0.4, 0.05, 0.7, 0.62, 0.6), hex(0x5e4438), hex(0x8a6a58));
      g.add(TP.box, M(0, -0.44, 0.5, 0.42, 0.34, 0.4), hex(0x8a6a58));
      for (const s of [-1, 1]) {
        g.add(TP.cone6, M(s * 0.24, -0.4, 0.6, 0.1, 0.4, 0.1, 0, 0, -s * 0.5), PAPER);          // tusks
        g.add(TP.ico, M(s * 0.26, -0.08, 0.34, 0.07), hex(0xffe27a));
      }
    },
    part: (d, i) => geo(g => {                                                                // cane lashed to it
      const side = i > 0;
      for (let k = -2; k <= 2; k++) g.add(TP.cyl6, side ? M(0, -0.45, k * 0.2, 0.15, 0.9, 0.15) : M(k * 0.14, -0.1, 0, 0.12, 0.5, 0.12, 0, 0.5), CANE, CANE2);
    }),
  },
  FrostmaneBear: {
    headAt: [1.95, 1.45], legs: [[-0.62, 0.8], [0.62, 0.8], [-0.62, -0.8], [0.62, -0.8]], hip: 0.8, leg: leg(0.46, 0.75, hex(0xbfcfe0), hex(0xe8eef5)), mark: 3.5, graze: 0.3,
    body: g => {
      g.add(TP.ico1, M(0, 1.5, 0, 1.8, 1.7, 2.8), hex(0xcfdbea), hex(0xf4f8fc));
      g.add(TP.ico1, M(0, 2.0, 0.7, 1.4, 1.2, 1.3), hex(0xe8eef5), hex(0xffffff));                // the mane
    },
    head: g => {
      g.add(TP.ico1, M(0, -0.3, 0.1, 0.95, 0.85, 0.95), hex(0xe8eef5), hex(0xffffff));
      g.add(TP.box, M(0, -0.55, 0.55, 0.46, 0.36, 0.4), hex(0xcfdbea));
      g.add(TP.ico, M(0, -0.44, 0.78, 0.12), DARK);
      for (const s of [-1, 1]) { g.add(TP.ico, M(s * 0.36, 0.14, -0.05, 0.24), hex(0xcfdbea)); g.add(TP.ico, M(s * 0.26, -0.22, 0.52, 0.07), DARK); }
    },
    part: (d, i) => geo(g => { const n = i === 0 ? 6 : 4; for (let k = 0; k < n; k++) { const a = k / n * 6.283; g.add(TP.octa, M(Math.cos(a) * d.radius * 0.5, 0.1, Math.sin(a) * d.radius * 0.5, 0.36, 0.9 + (k % 2) * 0.4, 0.36, a, 0.25), ICE, ICE2); } }),
    partMat: iceMat,
  },
  ReedToad: {
    headAt: [0.9, 1.0], legs: [[-1.05, 0.7], [1.05, 0.7], [-1.1, -0.7], [1.1, -0.7]], hip: 0.34, leg: leg(0.5, 0.3, hex(0x5f7a48), hex(0x7d9a5a)), mark: 2.9, graze: 0,
    body: g => {
      g.add(TP.ico1, M(0, 0.85, -0.1, 2.5, 1.5, 2.6), hex(0x6f8c52), hex(0xa9bf7a));
      for (let i = 0; i < 7; i++) { const a = i * 2.3; g.add(TP.ico, M(Math.cos(a) * 0.8, 1.45 + (i % 2) * 0.08, Math.sin(a) * 0.8 - 0.2, 0.24), hex(0x5f7a48)); }   // warts
    },
    head: g => {
      g.add(TP.ico1, M(0, -0.25, 0.35, 1.7, 0.9, 1.1), hex(0x7d9a5a), hex(0xb9cc8c));
      for (const s of [-1, 1]) { g.add(TP.ico1, M(s * 0.55, 0.28, 0.3, 0.44), hex(0x7d9a5a)); g.add(TP.ico, M(s * 0.6, 0.34, 0.5, 0.2), hex(0xffe27a)); g.add(TP.ico, M(s * 0.62, 0.36, 0.6, 0.09), DARK); }
    },
    part: (d, i) => geo(g => {
      if (d.material === 'hide') { g.add(TP.ico1, M(0, 0, 0, 0.95, 0.75, 0.7), hex(0xe9e3b4), hex(0xfff8d8)); return; }   // the pale throat
      for (let k = 0; k < 7; k++) { const a = k * 0.9, r = (k % 3) * 0.16; g.add(TP.box, M(Math.cos(a) * r, -0.3, Math.sin(a) * r, 0.05, 0.9 + (k % 3) * 0.25, 0.05, 0, (k % 2 ? 0.12 : -0.1)), MOSS, MOSS2); g.add(TP.cyl6, M(Math.cos(a) * r, 0.55 + (k % 3) * 0.2, Math.sin(a) * r, 0.1, 0.28, 0.1), WOODB); }
    }),
  },
  MapleCrane: {
    headAt: [1.95, 0.42], legs: [[-0.1, 0], [0.1, 0]], hip: 1.02, leg: leg(0.05, 1.0, DARK, hex(0x8a6a58)), mark: 2.7, graze: 1.1, flies: true,
    body: g => {
      g.add(TP.ico1, M(0, 1.25, 0, 0.5, 0.5, 0.95), PAPER, hex(0xffffff));
      g.add(TP.cyl6, M(0, 1.35, 0.3, 0.1, 0.7, 0.1, 0, 0.35), PAPER);                              // the neck
      g.add(TP.box, M(0, 1.3, -0.55, 0.3, 0.05, 0.4, 0, -0.3), DARK);                              // tail feathers
    },
    head: g => {
      g.add(TP.ico, M(0, 0, 0.02, 0.2), PAPER);
      g.add(TP.octa, M(0, 0.1, 0, 0.12, 0.06, 0.14), RED);
      g.add(TP.cone4, M(0, -0.03, 0.12, 0.06, 0.3, 0.06, 0, 1.57), hex(0xe9b44c));
    },
    part: () => geo(g => { for (const s of [-1, 1]) for (let k = 0; k < 4; k++) g.add(TP.octa, M(s * (0.3 + k * 0.17), -0.08 - k * 0.03, -0.1 + k * 0.05, 0.36, 0.05, 0.5 - k * 0.06, s * 0.2), RED, RED2); }),
  },
  ElderCarp: {
    headAt: [1.3, 3.1], legs: [], hip: 0, leg: null, mark: 4.2, graze: 0, swims: true,
    body: g => {
      g.add(TP.ico1, M(0, 0.7, 0, 2.5, 2.2, 6.4), hex(0xf7efe6), hex(0xffffff));
      for (const [x, z, s] of [[0.5, 1.2, 1.3], [-0.6, -0.4, 1.6], [0.3, -1.9, 1.1], [-0.3, 2.2, 0.9]]) g.add(TP.ico1, M(x, 1.35, z, s, 0.7, s * 1.3), hex(0xf08a4b), hex(0xf6b27a));   // koi patches
      g.add(TP.box, M(0, 1.5, -0.3, 0.1, 0.9, 2.6), hex(0xf08a4b), hex(0xf6b27a));                 // back fin
      g.add(TP.box, M(0, 0.2, -3.7, 0.12, 2.0, 1.5, 0, 0.5), hex(0xf08a4b), hex(0xffe0c0));        // tail
      for (const s of [-1, 1]) g.add(TP.box, M(s * 1.4, 0.4, 0.8, 1.1, 0.08, 0.8, 0, 0, s * 0.4), hex(0xf6b27a));
    },
    head: g => {
      g.add(TP.ico1, M(0, -0.6, 0.2, 2.0, 1.7, 1.8), hex(0xf7efe6), hex(0xffffff));
      for (const s of [-1, 1]) {
        g.add(TP.ico, M(s * 0.82, -0.3, 0.5, 0.3), hex(0xffe27a)); g.add(TP.ico, M(s * 0.9, -0.28, 0.6, 0.14), DARK);
        g.add(TP.box, M(s * 0.6, -1.0, 1.0, 0.05, 0.05, 1.3, s * 0.5, 0.3), hex(0xf08a4b));         // whiskers
      }
    },
    part: () => geo(g => { g.add(TP.cyl6, M(0, -0.1, 0, 1.1, 0.24, 1.1, 0.5), hex(0xcfc3a8), hex(0xf2ead6)); g.add(TP.cyl6, M(0, 0.12, 0, 0.6, 0.1, 0.6, 0.5), GOLDL); }),
  },
};
const BUILT = {};
function built(name) {
  if (!BUILT[name]) { const s = SPEC[name]; BUILT[name] = { body: geo(s.body), head: geo(s.head) }; }
  return BUILT[name];
}
const glowMat = new T.MeshBasicMaterial({ vertexColors: true });
const eyeGlow = geo(g => g.add(TP.octa, M(0, 0, 0, 0.13), hex(0xffe27a)));
const moodMark = geo(g => g.add(TP.octa, M(0, 0, 0, 0.2, 0.32, 0.2), hex(0xffffff)));

function beastModel(b) {
  const name = b.constructor.name, s = SPEC[name], B = built(name);
  const root = new T.Group();
  const body = new T.Mesh(B.body, worldMat); body.castShadow = true; root.add(body);
  const head = new T.Group(); head.position.set(0, s.headAt[0], s.headAt[1]); root.add(head);
  const hm = new T.Mesh(B.head, worldMat); hm.castShadow = true; head.add(hm);
  const legs = s.legs.map(([x, z]) => { const l = new T.Mesh(s.leg, worldMat); l.castShadow = true; l.position.set(x, s.hip, z); root.add(l); return l; });
  // each breakable part, and the gold light it leaves when it is gone
  const parts = b.parts.map((p, i) => {
    const m = new T.Mesh(s.part(p, i), s.partMat || worldMat); m.castShadow = true;
    const onHead = s.onHead || p.onHead, parent = onHead ? head : root;
    const pos = onHead ? [-p.at[1], p.y - s.headAt[0], p.at[0] - s.headAt[1]] : [-p.at[1], p.y, p.at[0]];
    if (s.partOffset) s.partOffset.forEach((o, k) => { pos[k] += o; });
    m.position.set(...pos); parent.add(m);
    const e = new T.Mesh(eyeGlow, glowMat); e.position.set(...pos); e.visible = false; parent.add(e);
    return [m, e];
  });
  const mark = new T.Mesh(moodMark, new T.MeshBasicMaterial({ color: 0xf6c453, transparent: true, opacity: 0.9 }));
  mark.position.set(0, s.mark, s.headAt[1] * 0.7); mark.visible = false; root.add(mark);
  return { root, body, head, legs, parts, mark, s };
}

// ---- the herds -------------------------------------------------------------------
const views = new Map();         // Beast -> { m, walk, last, speed }
let world = null;

function openGround(cx, cz, home, gap) {
  for (let k = 0; k < 40; k++) {
    const a = k * 2.39, r = 1.5 + k * 0.9, x = Math.floor(cx + Math.cos(a) * r) + 0.5, z = Math.floor(cz + Math.sin(a) * r) + 0.5;
    const h = height(x, z);
    if (h >= 0.2 && Math.abs(h - home) <= 1.6 && !engine.blockedAt(x, z) && !world.beasts.some(b => Math.hypot(b.x - x, b.z - z) < gap)) return [x, z];
  }
  return null;
}
export function placeHerds(w, saved) {
  world = w;
  const seen = new Set();
  for (const s of saved || []) {
    const Kind = BEASTS[s.kind];
    if (!Kind) continue;
    const b = new Kind(s.x, s.z, s.herd); b.facing = s.f || 0;
    if (s.calmed) { b.mood = Mood.CALMED; b.dormant = false; for (const p of b.keyParts) p.broken = true; }
    if (s.awake) b.dormant = false;
    w.beasts.push(b); seen.add(s.herd);
  }
  for (const h of HERDS) {
    if (seen.has(h.tag)) continue;
    const home = Math.max(0.2, height(h.x, h.z));
    for (let i = 0; i < h.n; i++) {
      const at = h.exact ? [h.x, h.z] : openGround(h.x + (i % 2) * 7 - 3.5, h.z + Math.floor(i / 2) * 7 - 3.5, home, h.Kind.radius * 2 + 2.5);
      if (!at) continue;
      const b = new h.Kind(at[0], at[1], h.tag);
      b.facing = h.exact ? PI / 2 : world.random() * PI * 2;
      b.home = h.exact ? [at[0], at[1]] : [h.x, h.z];
      w.beasts.push(b);
    }
  }
}
export const beastSave = () => world ? world.beasts.map(b => ({ kind: b.constructor.name, x: +b.x.toFixed(1), z: +b.z.toFixed(1), f: +b.facing.toFixed(2), herd: b.herd, calmed: b.calmed, awake: b.constructor.dormant && !b.dormant })) : [];

// ---- drawing ---------------------------------------------------------------------
const MOOD_COL = { wary: 0xf6c453, alert: 0xe0483a };
export function drawBeasts(dt, time) {
  const a = world.archer;
  for (const b of world.beasts) {
    let v = views.get(b);
    const far = Math.hypot(b.x - P.x, b.z - P.z) > 90 || b.dormant;
    if (!v) {
      if (far) continue;
      v = { m: beastModel(b), walk: Math.random() * 6, last: [b.x, b.z], speed: 0, rise: 0, lift: 0 };
      scene.add(v.m.root); views.set(b, v);
    }
    v.m.root.visible = !far;
    if (far) continue;
    const moved = Math.hypot(b.x - v.last[0], b.z - v.last[1]);
    v.last = [b.x, b.z];
    v.speed += ((dt > 0 ? moved / dt : 0) - v.speed) * Math.min(1, dt * 8);
    v.walk += v.speed * dt * 2.2;
    const { root, body, head, legs, parts, mark, s } = v.m;
    const fleeing = b.mood === Mood.ALERT && !b.constructor.fierce;
    v.lift += ((s.flies && fleeing ? 2.6 : 0) - v.lift) * Math.min(1, dt * 3);          // cranes take to the air
    v.rise = Math.min(1, v.rise + dt * 0.5);                                           // the carp rises from the pond
    let y = height(b.x, b.z) + v.lift;
    if (s.swims) y = -1.5 - (1 - v.rise) * 2.5 + Math.sin(time * 0.9) * 0.12;
    root.position.set(b.x, y, b.z);
    root.rotation.y = toEngine(b.facing) + (s.swims ? Math.sin(time * 0.6) * 0.12 : 0);
    const stride = Math.min(0.55, v.speed * 0.16);
    legs.forEach((l, i) => { l.rotation.x = v.lift > 0.3 ? 0.9 : Math.sin(v.walk + (i === 0 || i === 3 ? 0 : PI)) * stride; });
    body.position.y = Math.abs(Math.sin(v.walk)) * stride * 0.12;
    const winding = b.act === 'windup' && b.mood === Mood.ALERT;
    root.rotation.x = winding ? -0.16 : b.act === 'recover' && b.mood === Mood.ALERT ? 0.1 : 0;
    const grazing = b.mood === Mood.CALM || (b.calmed && !b.rider && !b.following);
    const down = grazing && v.speed < 0.2 ? s.graze * (0.9 + Math.sin(time * 1.3 + b.x) * 0.12) : b.mood === Mood.WARY ? -0.25 : winding ? -0.4 : 0;
    head.rotation.x += (down - head.rotation.x) * Math.min(1, dt * 3);
    b.parts.forEach((p, i) => { parts[i][0].visible = !p.broken; parts[i][1].visible = p.broken; });
    if (s.flies && parts[0][0].visible) parts[0][0].rotation.z = v.lift > 0.3 ? Math.sin(time * 14) * 0.5 : 0;
    const col = MOOD_COL[b.mood];
    mark.visible = !!col;
    if (col) { mark.material.color.setHex(col); mark.position.y = s.mark + Math.sin(time * 4) * 0.06; mark.rotation.y = time * 2; }
    if (b.rider) player.position.y += RIDE_LIFT + body.position.y;
  }
  // a soft word when the archer stands beside a calmed ox
  const near = !a.mount && world.beasts.find(b => b.calmed && b.constructor.gift === 'ride' && b.distanceTo(a) <= b.radius + 1.8);
  if (near && !shownRide) { engine.say('R to climb on its back.', 2.4); shownRide = true; }
  if (!near) shownRide = false;
}
let shownRide = false;

const PART_TINT = { moss: [0.5, 0.72, 0.36], bark: [0.95, 0.72, 0.3], ice: [0.8, 0.92, 1], stone: [0.85, 0.8, 0.68], hide: [1, 0.96, 0.8] };
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
    const [px, pz] = data[1].position(b), tint = PART_TINT[data[1].material] || [1, 1, 1];
    engine.leafBurst(px, Math.max(y, -1) + data[1].y, pz, 11, tint, 1.6);
    engine.pluck(69, { vol: 0.07, dur: 1 });
  } else if (kind === 'calmed') {
    engine.bloomRing(b.x, b.z, 0.5, b.radius + 2, 12, engine.land);
    engine.pulse(b.x, y, b.z, b.radius + 3, 1.6, 0xfff3c4);
    [60, 64, 67, 72].forEach((n, i) => engine.pluck(n, { vol: 0.09, dur: 2.4, delay: i * 0.12 }));
    if (b.constructor.gift === 'ride') engine.say(`The ${b.constructor.label} sees you now, and lowers its head. Walk up and press R to ride. Hum (H) to call it later.`, 7);
  } else if (kind === 'regrow' && near) {
    engine.say('What you shook loose settled back while it ran.', 3);
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
      if (world.beasts.some(b => b.hostile && b.constructor.gift === 'ride' && b.distanceTo(world.archer) < 4)) engine.say('It will not carry you yet. Free its eyes of moss; hum first so it stays.', 3.5);
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
