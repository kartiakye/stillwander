// The people and the Hollows on screen. Villagers live in the hamlets and towns
// and talk when you press F. Hollows, the empty soldiers, hold the ruins, the
// pass and stretches of road. This file also draws the archer's petals and
// wakes the archer at a shrine after a fall.
import { engine } from './engine.js';
import * as MAP from './map.js';
import { Villager } from './core/villager.js';
import { Footman, Sentry, HollowArcher, State } from './core/hollow.js';
import { Drillmaster, CertainArcher } from './core/guardian.js';

const { T, P, worldMat, Geo, TP, M, hex } = engine;
const PI = Math.PI;
const height = (x, z) => engine.effH(Math.floor(x), Math.floor(z));
let world = null;

// ---- who lives where ---------------------------------------------------------------
// Lines are told in order; the last one repeats.
const PEOPLE = {
  'The Waystation': [
    { name: 'Old Hana', role: 'Keeper of the Waystation', look: 0, gift: { arrows: 4 }, lines: [
      'You are awake. Good. The shrines have slept so long that the roads forgot where they lead.',
      'Carry light to a shrine and it will wake. Each land keeps its own blessing for your bow.',
      'The oxen in the west grass are older than this house. Hum to them. They like to be asked.',
      'Take these. I tied them myself, so do not laugh at the fletching.' ] },
    { name: 'Taro', role: 'Stable boy', look: 3, child: true, lines: [
      'Have you seen the Hollows? Armour walking about with nobody inside! I looked. Nobody!',
      'They stand at the broken dojo and at the pass up north. Granny says do not go. So I have not. Much.' ] },
  ],
  'North Farm': [
    { name: 'Genji', role: 'Farmer', look: 1, lines: [
      'The plain feeds everyone and thanks no one. Mind the furrows.',
      'A Hollow came down the north road last moon. It stood at my fence all night, then walked back. Guarding something that is not there any more.' ] },
    { name: 'Sada', role: 'Farmer', look: 2, lines: [
      'When the shrine east of here was awake, the rice came up gold. My mother told me. I have never seen it.',
      'If you wake it, come back. I will not believe it otherwise.' ] },
  ],
  'Mill Hamlet': [
    { name: 'Miller Jun', role: 'Miller', look: 1, lines: [
      'The wheel turns when the Stillwater is kind. Lately it is kind.',
      'Follow the river south and you reach the marsh. Follow it north and you reach trouble.' ] },
    { name: 'Aiko', role: 'Weaver', look: 2, lines: [
      'Four straw to an arrow. Forty to a hat. I know which I would rather make.',
      'The oxen shed moss in spring. We stuff pillows with it. Do not tell the oxen.' ] },
    { name: 'Little Miki', role: '', look: 3, child: true, lines: [
      'I hummed at an ox and it looked at me! Well. It looked near me.' ] },
  ],
  "Woodcutters' Town": [
    { name: 'Foreman Daigo', role: 'Woodcutter', look: 1, lines: [
      'We cut one tree in ten and plant two. That was the bargain with the wood, and we keep it.',
      'There is a stag in the deep gold. Antlers like branches. We leave the trees it sleeps under.',
      'The Thousand Steps are east of here. Count them if you like. Everyone gets a different number.' ] },
    { name: 'Rin', role: 'Charcoal burner', look: 0, lines: [
      'Fire is a guest. Feed it, watch it, see it out the door.',
      'The Golden Wood blesses arrows with flame, they say. Then it trusts you more than I would.' ] },
    { name: 'Kenta', role: 'Apprentice', look: 3, lines: [
      'I am to sweep the yard until I can tell oak from ash by the sound of the broom. It has been two years.' ] },
  ],
  "Craftsmen's Village": [
    { name: 'Master Ume', role: 'Bowyer', look: 0, lines: [
      'Let me see that bow. Hm. Older than me, and better kept.',
      'Bamboo splits three ways if you ask it properly. So will an arrow, once the Hollow shrine wakes.',
      'A bow is a promise to something far away. Keep it.' ] },
    { name: 'Sora', role: 'Flute maker', look: 2, lines: [
      'The Green Cathedral is west of here. The wind plays the bamboo there and I write down what I can.',
      'A boar lives in the thick of it. Armoured in cane. It dislikes music, which I take personally.' ] },
  ],
  'Stilt Village': [
    { name: 'Ferryman Bo', role: 'Ferryman', look: 1, lines: [
      'Marsh water remembers. Step where the stones are and it will forget you kindly.',
      'The torii in the lagoon went under in my grandfather\'s time. The Hollows there still bow to it.',
      'When the storm shrine wakes, arrows carry thunder. Stand somewhere dry.' ] },
    { name: 'Nami', role: 'Reed cutter', look: 2, lines: [
      'There is a toad out past the mere as big as a boat. It sings before rain. It is never wrong.' ] },
  ],
  'Pilgrim Shelter': [
    { name: 'Brother Eiji', role: 'Pilgrim', look: 4, lines: [
      'The monastery is higher still. I am resting. I have been resting since the first snow.',
      'A bear walks the crest in a coat of ice. It is not unkind. It is only very large and very cold.' ] },
  ],
  'The Mountain Monastery': [
    { name: 'Abbot Seiren', role: 'Abbot', look: 4, lines: [
      'You climbed. Most things worth hearing are said at the top of a climb, so I will be brief.',
      'The Hollows were soldiers once. They were ordered to hold, and no one ever told them to stop.',
      'An arrow ends them gently. Think of it as the order they have waited for.',
      'The island is waking because you are walking it. Do not hurry. It has waited long enough to be patient.' ] },
    { name: 'Novice Tomo', role: 'Novice', look: 4, lines: [
      'I ring the bell at dawn. And at noon. And when I forget whether I have rung it.' ] },
  ],
  'The Last Village': [
    { name: 'Elder Chiyo', role: 'Village elder', look: 0, lines: [
      'So the wanderer comes south at last. Sit. No? Then stand and listen.',
      'Under Petal Pond sleeps the Elder Carp. When every shrine is awake, it will rise to look at who woke them.',
      'Be someone worth looking at.' ] },
    { name: 'Hoshi', role: 'Fisher', look: 1, lines: [
      'I have fished Petal Pond forty years and caught nothing. I think that is the arrangement.' ] },
    { name: 'Yui', role: 'Flower seller', look: 2, lines: [
      'Blossoms for the road? They are free. They were going to fall anyway.',
      'A Bloom arrow leaves a ring of these. Stand in it when you are hurt.' ] },
    { name: 'Kazu', role: 'Lantern maker', look: 1, lines: [
      'Every lantern on the island came from this bench or my father\'s. The cranes in the vale steal the red paper.' ] },
    { name: 'Mei', role: '', look: 3, child: true, lines: [
      'Are you the one with the ox? Can I ride the ox? Please can I ride the ox.' ] },
  ],
};

// Where the Hollows stand. Guardians hold the two ruins.
const CAMPS = [
  { at: 'The Broken Dojo', who: [Drillmaster, Footman, Footman, Sentry, Footman] },
  { at: 'The Fortified Pass', who: [CertainArcher, Sentry, Sentry, HollowArcher, HollowArcher] },
  { at: 'The Drowned Torii', who: [Footman, Footman, Sentry], spread: 16 },
  { x: -62, z: -172, who: [Footman, Footman] },                 // the north road
  { x: 228, z: -40, who: [Footman, HollowArcher] },             // the east road
  { x: 242, z: 128, who: [Sentry, HollowArcher] },              // the bamboo road
  { x: -256, z: 108, who: [Footman, Footman, HollowArcher] },   // the marsh road
  { x: 44, z: 226, who: [Sentry, Footman] },                    // the south road
];

function openTile(cx, cz, home, taken, minGap, start = 2, grow = 0.8) {
  for (let k = 0; k < 40; k++) {
    const a = k * 2.39 + cx, r = start + k * grow, x = Math.floor(cx + Math.cos(a) * r) + 0.5, z = Math.floor(cz + Math.sin(a) * r) + 0.5;
    const h = height(x, z);
    if (h >= 0.4 && Math.abs(h - home) <= 1.2 && !engine.blockedAt(x, z) && !taken.some(t => Math.hypot(t.x - x, t.z - z) < minGap)) return [x, z];
  }
  return null;
}

export function placeFolk(w, saved) {
  world = w;
  const said = (saved && saved.said) || {};
  for (const [place, people] of Object.entries(PEOPLE)) {
    const l = MAP.LANDMARKS.find(m => m.name === place);
    if (!l) continue;
    const home = height(l.x, l.z);
    for (const p of people) {
      const at = openTile(l.x, l.z, home, w.folk, 2.5, 2.5, 0.5);
      if (!at) continue;
      const v = new Villager(at[0], at[1], p);
      v.facing = w.random() * PI * 2;
      if (said[p.name]) { v.said = said[p.name][0]; v.given = !!said[p.name][1]; }
      w.folk.push(v);
    }
  }
  for (const c of CAMPS) {
    const l = c.at ? MAP.LANDMARKS.find(m => m.name === c.at) : c;
    const home = Math.max(0.5, height(l.x, l.z));
    c.who.forEach((Kind, i) => {
      const at = i === 0 && c.at && height(l.x, l.z) >= 0.4 && !engine.blockedAt(l.x + 0.5, l.z + 0.5) ? [l.x + 0.5, l.z + 0.5]
        : openTile(l.x, l.z, home, w.hollows, 2.6, c.spread ? 6 : 2.5, c.spread ? 1.2 : 0.7);
      if (!at) return;
      const h = new Kind(at[0], at[1]);
      h.home = [at[0], at[1]];
      h.facing = w.random() * PI * 2;
      w.hollows.push(h);
    });
  }
}
export const folkSave = () => world ? { said: Object.fromEntries(world.folk.filter(v => v.said || v.given).map(v => [v.name, [v.said, v.given ? 1 : 0]])) } : null;

// ---- models ------------------------------------------------------------------------
function geo(build) { const g = new Geo(); build(g); return g.build(); }
const SKIN = hex(0xf2d3b5), HAIR = hex(0x3a2f3a), STRAW = hex(0xe9cf86), WOODC = hex(0x8b6448);
const ROBES = [
  [hex(0x6f7fb5), hex(0xa9b6dd)],   // indigo: elders and keepers
  [hex(0x8a6b4f), hex(0xc4a37e)],   // earth: farmers and workers
  [hex(0xc9728a), hex(0xf0b6c4)],   // rose
  [hex(0x79a86a), hex(0xbcd9a4)],   // green: children and apprentices
  [hex(0xd98a3d), hex(0xf3c27e)],   // saffron: monks
];
const villagerGeo = ROBES.map((c, look) => geo(g => {
  g.add(TP.robe, M(0, 0, 0, 1.25, 1.35, 1.25), c[0], c[1]);
  g.add(TP.box, M(0, 0.52, 0, 0.46, 0.07, 0.36), look === 4 ? hex(0x7a4a2a) : hex(0xfff4e0));   // sash
  g.add(TP.ico1, M(0, 1.16, 0, 0.42), SKIN);
  if (look === 1) g.add(TP.cone8, M(0, 1.28, 0, 0.95, 0.3, 0.95), STRAW, hex(0xf6e2a8));         // a field hat
  else if (look === 4) g.add(TP.dome, M(0, 1.2, 0, 0.44, 0.2, 0.44), SKIN);                        // shaven
  else { g.add(TP.dome, M(0, 1.2, -0.02, 0.46, 0.26, 0.46), HAIR); g.add(TP.ico, M(0, 1.5, -0.08, 0.18), HAIR); }
  for (const s of [-1, 1]) g.add(TP.box, M(s * 0.26, 0.42, 0.04, 0.12, 0.36, 0.14, 0, 0, s * 0.2), c[0], c[1]);
  if (look === 0) g.add(TP.box, M(0.34, 0, 0.16, 0.05, 1.05, 0.05), WOODC);                        // a walking staff
}));

const IRON = hex(0x3d3a52), IRON2 = hex(0x6a6788), LACQ = hex(0x8c2f39), VOID = hex(0x15121f), GOLD = hex(0xf6c453);
function hollowGeo(kind) {
  return geo(g => {
    g.add(TP.robe, M(0, 0, 0, 1.45, 1.4, 1.45), IRON, IRON2);                       // an empty coat of plates
    for (let i = 0; i < 3; i++) g.add(TP.cyl8, M(0, 0.18 + i * 0.2, 0, 0.92 - i * 0.16, 0.07, 0.92 - i * 0.16), LACQ);
    for (const s of [-1, 1]) g.add(TP.box, M(s * 0.36, 0.74, 0, 0.3, 0.1, 0.42, 0, 0, s * -0.3), LACQ);   // shoulder guards
    g.add(TP.ico1, M(0, 1.18, 0, 0.4), VOID);                                       // nothing where a face should be
    g.add(TP.dome, M(0, 1.2, 0, 0.56, 0.34, 0.56), IRON, IRON2);                    // helmet
    g.add(TP.cyl8, M(0, 1.2, 0, 0.74, 0.04, 0.74), IRON);
    g.add(TP.arch, M(0, 1.42, 0.2, 0.5, 0.5, 0.5), kind === 'guardian' ? GOLD : LACQ);   // crest
    if (kind === 'footman' || kind === 'guardian') {                                // a spear
      g.add(TP.box, M(0.42, 0.1, 0.2, 0.05, 1.9, 0.05, 0, 0.25), WOODC);
      g.add(TP.octa, M(0.42, 1.95, 0.7, 0.1, 0.34, 0.1, 0, 0.25), IRON2);
    }
    if (kind === 'sentry' || kind === 'guardian') {                                 // a tall wooden shield
      g.add(TP.box, M(0, 0.1, 0.5, 0.95, 1.15, 0.09), WOODC, hex(0xb08a66));
      g.add(TP.box, M(0, 0.55, 0.56, 0.5, 0.08, 0.02), LACQ);
    }
    if (kind === 'archer') {                                                        // a bow at the hip
      g.add(TP.arch, M(0.44, 0.75, 0.1, 1.0, 1.0, 1.0, PI / 2, 0, PI / 2), WOODC);
      g.add(TP.box, M(-0.2, 0.5, -0.3, 0.14, 0.5, 0.14, 0, -0.4), WOODC);            // quiver
    }
  });
}
const HOLLOW_GEO = { footman: hollowGeo('footman'), sentry: hollowGeo('sentry'), archer: hollowGeo('archer'), guardian: hollowGeo('guardian') };
const kindOf = c => c.constructor.isGuardian ? 'guardian' : c instanceof HollowArcher ? 'archer' : c instanceof Sentry ? 'sentry' : 'footman';

// The game layer asks for a Hollow's mesh; straw targets keep their own.
export function hollowMesh(c) {
  if (!('state' in c)) return null;
  const m = new T.Mesh(HOLLOW_GEO[kindOf(c)], worldMat);
  m.castShadow = true;
  if (c.constructor.isGuardian) m.userData.scale = 1.5;
  return m;
}
export function poseHollow(c, f, dt, time) {       // called every frame for each living Hollow
  const m = f.mesh, s = m.userData.scale || 1;
  m.position.set(c.x, height(c.x, c.z), c.z);
  m.rotation.y = PI / 2 - c.facing;
  const wind = c.state === State.WINDUP || c.state === State.DRAW;
  f.lean = (f.lean || 0) + ((wind ? -0.32 : c.state === State.RECOVER && !c.isOpen ? 0.3 : 0) - (f.lean || 0)) * Math.min(1, dt * 12);
  m.rotation.x = f.lean - 0.18 * f.punch + (c.isOpen ? 0.5 : 0);
  const k = 1 + 0.2 * Math.sin(f.punch * PI);
  m.scale.set(s * k, s / k, s * k);
  m.position.y += c.state === State.APPROACH || c.returning ? Math.abs(Math.sin(time * 9 + c.x)) * 0.07 : 0;
}

const people = new Map();      // Villager -> mesh
export function drawFolk(dt, time) {
  const a = world.archer;
  let near = null, nd = 2.6;
  for (const v of world.folk) {
    let m = people.get(v);
    const d = Math.hypot(v.x - P.x, v.z - P.z);
    if (!m) {
      if (d > 80) continue;
      m = new T.Mesh(villagerGeo[v.look % villagerGeo.length], worldMat); m.castShadow = true;
      if (v.child) m.scale.setScalar(0.68);
      engine.scene.add(m); people.set(v, m);
    }
    m.visible = d <= 80;
    if (!m.visible) continue;
    const walking = v.goal && v.rest <= 0;
    m.position.set(v.x, height(v.x, v.z) + (walking ? Math.abs(Math.sin(time * 7 + v.x)) * 0.05 : 0), v.z);
    let da = PI / 2 - v.facing - m.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    m.rotation.y += da * Math.min(1, dt * 8);
    if (d < nd && !a.mount) { nd = d; near = v; }
  }
  if (near !== hinted) { hinted = near; if (near) engine.say(`F to speak with ${near.name}.`, 2.2); }
  if (talking && (time > talking.until || Math.hypot(talking.who.x - P.x, talking.who.z - P.z) > 5)) closeTalk();
  drawPetals(dt);
}
let hinted = null;

// ---- the talk panel ----------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `#talk{position:fixed;left:50%;bottom:calc(64px + env(safe-area-inset-bottom,0px));transform:translate(-50%,12px);width:min(560px,calc(100vw - 32px));
padding:16px 22px 14px;border-radius:18px;background:rgba(251,243,228,.94);color:#2b2550;box-shadow:0 14px 40px rgba(43,37,80,.28);opacity:0;pointer-events:none;
transition:opacity .25s,transform .25s;z-index:12;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#talk.on{opacity:1;transform:translate(-50%,0)}
#talk b{font:500 1.25rem var(--display);letter-spacing:.02em}
#talk small{font:400 .6rem var(--ui);letter-spacing:.22em;text-transform:uppercase;opacity:.6;margin-left:.9em}
#talk p{margin:.45em 0 .5em;font:400 1.02rem/1.5 var(--display);text-wrap:pretty}
#talk i{display:block;font:400 .58rem var(--ui);letter-spacing:.22em;text-transform:uppercase;opacity:.5;font-style:normal}
#petals{font-size:1rem;letter-spacing:.18em;line-height:1;margin-bottom:6px;transition:transform .15s}
#petals span{opacity:.28}
#hurt{position:fixed;inset:0;pointer-events:none;z-index:9;opacity:0;background:radial-gradient(ellipse at center,rgba(224,72,58,0) 45%,rgba(224,72,58,.55) 100%)}
#fall{position:fixed;inset:0;pointer-events:none;z-index:15;opacity:0;background:#fbf3e4;transition:opacity .9s}`;
document.head.appendChild(style);
const panel = document.createElement('div');
panel.id = 'talk'; panel.setAttribute('role', 'status');
panel.innerHTML = '<b></b><small></small><p></p><i></i>';
document.body.appendChild(panel);
let talking = null;
function closeTalk() { talking = null; panel.classList.remove('on'); }
function showTalk(v, line, gift, time) {
  panel.children[0].textContent = v.name;
  panel.children[1].textContent = v.role;
  panel.children[2].textContent = line;
  const more = v.said < v.lines.length;
  panel.children[3].textContent = gift ? `You received ${gift.arrows} arrows` : more ? 'F to hear more' : '';
  panel.classList.add('on');
  talking = { who: v, until: time + 5 + line.length * 0.06 };
}

// ---- petals: the archer's health ---------------------------------------------------
const petals = document.createElement('div');
petals.id = 'petals'; petals.setAttribute('aria-label', 'Petals');
const kit = document.getElementById('kit');
kit.parentNode.insertBefore(petals, kit);
const hurt = document.createElement('div'); hurt.id = 'hurt'; document.body.appendChild(hurt);
const fall = document.createElement('div'); fall.id = 'fall'; document.body.appendChild(fall);
let shownHp = -1, hurtGlow = 0, sinceHurt = 99, mendT = 0, falling = 0;
function drawPetals(dt) {
  const a = world.archer;
  if (a.hp !== shownHp) {
    shownHp = a.hp;
    const full = Math.max(0, Math.ceil(a.hp));
    petals.innerHTML = '✿'.repeat(full) + `<span>${'✿'.repeat(a.maxHp - full)}</span>`;
    petals.setAttribute('aria-label', `${full} of ${a.maxHp} petals`);
  }
  hurtGlow = Math.max(0, hurtGlow - dt * 1.6);
  hurt.style.opacity = hurtGlow;
  // out of danger, a petal grows back every few breaths
  sinceHurt += dt;
  const danger = world.hollows.some(h => h.alive && 'state' in h && h.state !== State.IDLE && !h.returning && h.distanceTo(a) < 24);
  const hunted = world.beasts.some(b => b.constructor.fierce && b.mood === 'alert' && b.distanceTo(a) < 24);
  if (a.alive && a.hp < a.maxHp && sinceHurt > 6 && !danger && !hunted) {
    mendT += dt;
    if (mendT > 4) { mendT = 0; a.hp = Math.min(a.maxHp, a.hp + 1); engine.pluck(76, { vol: 0.06, dur: 1.2 }); }
  } else mendT = 0;
  // fallen: fade to paper, wake at a shrine
  if (!a.alive) {
    falling += dt;
    fall.style.opacity = 1;
    if (falling > 1.4) wake();
  }
}
function wake() {
  const a = world.archer;
  let best = [0, 0], bd = Infinity;
  for (const s of MAP.SHRINES) {
    const key = Math.floor(s.x / engine.RS) + ',' + Math.floor(s.z / engine.RS);
    if (!engine.awake.has(key)) continue;
    const d = Math.hypot(s.x - a.x, s.z - a.z);
    if (d < bd) { bd = d; best = [s.x + 3.5, s.z + 3.5]; }
  }
  if (a.mount) world.dismount();
  a.alive = true; a.hp = a.maxHp; a.effects = []; a.stamina = 100;
  a.x = P.x = best[0]; a.z = P.z = best[1];
  P.y = height(P.x, P.z);
  for (const h of world.hollows) if ('state' in h && h.home) { h.returning = true; }
  for (const b of world.beasts) if (b.constructor.fierce && b.mood === 'alert') { b.mood = 'calm'; b.alarm = 0; b.act = 'chase'; }
  falling = 0; sinceHurt = 99;
  setTimeout(() => { fall.style.opacity = 0; }, 60);
  engine.say(bd < Infinity ? 'You wake beside the shrine. Nothing is lost.' : 'You wake at the Waystation. Nothing is lost.', 5);
  [60, 67, 72].forEach((n, i) => engine.pluck(n, { vol: 0.08, dur: 2.2, delay: i * 0.15 }));
}

// ---- events and keys ----------------------------------------------------------------
export function folkEvent(kind, data, time) {
  const a = world.archer;
  if (kind === 'talk') {
    const [v, line, gift] = data;
    showTalk(v, line, gift, time);
    engine.pluck(62 + (v.name.length % 5) * 2, { vol: 0.07, dur: 0.9 });
    if (gift) { engine.pluck(74, { vol: 0.08, dur: 1.4, delay: 0.1 }); engine.burst(P.x, P.y + 0.8, P.z, 5, 1); }
    return true;
  }
  if (kind === 'windup') {                    // a Hollow draws back: the moment to step aside
    const h = data[0];
    if (h.distanceTo(a) < 30) {
      engine.tone({ f0: 300, f1: 520, dur: 0.22, vol: 0.07, type: 'triangle' });
      const reach = h.constructor.strikeReach || 1.7;
      engine.pulse(h.x, Math.max(0, height(h.x, h.z)), h.z, reach, reach > 6 ? h.constructor.windup : 0.5, reach > 6 ? 0x9fd8e8 : 0xe0483a);
    }
    return true;
  }
  if (kind === 'strike') {
    const [h, landed] = data;
    engine.noise({ f0: 1200, f1: 300, dur: 0.14, vol: 0.09, type: 'lowpass' });
    if (landed) struck();
    return true;
  }
  if (kind === 'hit' && data[1] === a) { if (!data[2].blocked) struck(); return true; }
  if (kind === 'giveUp') return true;
  return false;
}
function struck() {
  hurtGlow = 1; sinceHurt = 0;
  engine.shake(0.22);
  engine.tone({ f0: 150, f1: 60, dur: 0.3, vol: 0.2, type: 'triangle' });
  petals.style.transform = 'scale(1.25)'; setTimeout(() => { petals.style.transform = ''; }, 160);
  if (world.archer.alive && world.archer.hp <= 2) engine.say('Hurt. Step away (Shift) and rest out of sight to mend.', 3);
}
export function folkKey(k) {
  if (k === 'f' && !world.archer.mount && world.talk()) return true;
  return false;
}
