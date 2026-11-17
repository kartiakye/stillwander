// The story: what the island remembers, told a card at a time.
// A chapter opens when a land's shrine first wakes; a beast's card when it is
// calmed; the ending when the Elder Carp has looked at you. J opens the journal.
import { engine } from './engine.js';
import { LAND_BLESSINGS } from './core/blessing.js';
import { ElderCarp } from './core/beast.js';

let world = null, afterEnding = () => {};
const seen = new Set();          // ids of cards already shown
const queue = [];                // cards waiting to be read
let open = null;

const LANDS = ['Pampas Plain', 'Golden Wood', 'Bamboo Hollow', 'Snow Crest', 'Heron Marsh', 'Crimson Vale', 'Blossom Field'];

const PROLOGUE = [
  { id: 'p1', over: 'Prologue', title: 'The one who woke', text: [
    'You wake at a waystation on a plain of pale grass, with a bow across your knees and no memory of sitting down.',
    'The bow you know. Your hands know it better than you do. Everything else is quiet: seven lands, seven shrines, all asleep.' ] },
  { id: 'p2', over: 'Prologue', title: 'What the keeper says', text: [
    'The shrines sleep, the old woman says, and while they sleep the roads forget where they lead. Carry light to them. Each one will give your bow something back.',
    'She does not say back from where. Speak to her; then walk.' ] },
];

// One chapter for each land, shown when its shrine first wakes.
const CHAPTERS = [
  { title: 'The wind remembers', text: [
    'The Waystation shrine wakes, and with it a first memory, thin as a draught under a door: a hill, a line of soldiers, and your own arm raised.',
    'The wind obeys your bow now. It always did. You had only forgotten how to ask.' ] },
  { title: 'The gold that burned', text: [
    'In the Golden Wood you remember fire. Not a battle: beacons, lit one after another along the ridges, each one answering yours.',
    'You were not a wanderer then. People watched for your signal.' ] },
  { title: 'Three where there was one', text: [
    'The bamboo grows in clusters, and so did they: the companies you sent out in threes to every road on the island.',
    'You remember their faces better than their names. You remember that they trusted you.' ] },
  { title: 'The cold order', text: [
    'On Snow Crest the memory comes clear and whole. The Elder Carp had gone under. The shrines were failing. And you stood before every soldier on the island and gave one order.',
    'Hold. Hold until I return.' ] },
  { title: 'What the water kept', text: [
    'The marsh remembers what you would rather not. You did not return. You lay down by the waystation to rest an hour, and the island fell asleep around you.',
    'They held. Season after season, long after there was anyone inside the armour to be tired.' ] },
  { title: 'The empty soldiers', text: [
    'From the canyon rim you can see them at the pass and the broken dojo: the Hollows. Your soldiers. Still holding.',
    'An arrow lets one rest. But there are more Hollows than arrows, and only one voice on the island they would stand down for.' ] },
  { title: 'The last shrine', text: [
    'The Blossom shrine wakes, and the seventh memory is not a memory at all. It is a choice no one has made yet.',
    'Every shrine is awake. Under Petal Pond, something very old has opened one eye. Go and be looked at.' ] },
];

const BEAST_CARDS = {
  ride: { title: 'The ox lowers its head', gift: 'It will carry you', text: [
    'The moss falls from its eyes and it sees you: small, upright, carrying a bow. It decides you are not a threat. Then it decides you are a friend.',
    'Climb on with R. Hum, and it will come from anywhere on the island.' ] },
  leaf: { title: 'The stag stands still', gift: 'Gold leaf: arrows fly farther', text: [
    'With the dead leaves shaken loose, its antlers rise a hand higher. It does not run. It lets one gold leaf fall at your feet.',
    'Fletched with it, your arrows hold the air longer.' ] },
  tusk: { title: 'The boar lies down', gift: 'Tusk: arrows pass through one more', text: [
    'The cane cracks away and the boar stops mid-charge, as if it had forgotten what it was angry about.',
    'It leaves you a shed tusk. An arrowhead cut from it does not stop at the first thing it meets.' ] },
  fur: { title: 'The bear breathes out', gift: 'Fur: two more petals', text: [
    'The ice comes off in sheets and the bear shakes like a wet dog, vast and suddenly gentle.',
    'A tuft of its fur, tucked under your collar, keeps more of you warm. You can take more than you could.' ] },
  sinew: { title: 'The toad sings', gift: 'Reed sinew: the bow draws faster', text: [
    'Its crown of reeds falls and it sings, once, a note so low the mere shivers. It will rain tomorrow. It is never wrong.',
    'A reed from its crown, twisted into your bowstring, draws quicker than gut.' ] },
  feather: { title: 'The crane bows', gift: 'Red feather: the wind turns tighter', text: [
    'The dead leaves drop from its wings and there are feathers under them after all, red as the vale.',
    'It leaves you one. An arrow that carries it turns on the wind like a crane on a thermal.' ] },
};

const ENDING = [
  { id: 'e1', over: 'The ending', title: 'The Elder Carp looks at you', text: [
    'The last stone scale falls away and the carp is only a fish again: enormous, patient, older than the shrines. It turns one gold eye on you and holds you there.',
    'It sees the hill, and the raised arm, and the long sleep. It sees the oxen and the villagers and every shrine you walked to. It does not look away.' ] },
  { id: 'e2', over: 'The ending', title: 'The order', text: [
    'You know what it is waiting for. So does the island. You have known since the snow.',
    'You lower the bow. You have not spoken above a hum since you woke, and your voice is rough with it. "Stand down," you say. "You held. It is finished. Go home."' ] },
  { id: 'e3', over: 'The ending', title: 'Stillwander', text: [
    'At the pass, at the dojo, on every road, the Hollows set down their spears. The armour settles to the ground like a sigh, and the wind takes whatever was left inside it somewhere kinder.',
    'The carp sinks back under the petals. The island is awake, and you are only a person in it, with a bow, and an ox, and nowhere you have to be. Wander as long as you like.' ], end: true },
];

// ---- the card ------------------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `#story{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:30;background:rgba(43,37,80,.5);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);padding:16px}
#story.on{display:flex;animation:storyIn .5s ease}
@keyframes storyIn{from{opacity:0}to{opacity:1}}
#story article{width:min(600px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fbf3e4;color:#2b2550;border-radius:22px;padding:34px 38px 26px;box-shadow:0 24px 70px rgba(43,37,80,.45)}
#story .over{font:400 .62rem var(--ui);letter-spacing:.3em;text-transform:uppercase;opacity:.55}
#story h2{font:300 2.1rem/1.15 var(--display);margin:.25em 0 .5em;text-wrap:balance}
#story p{font:400 1.08rem/1.6 var(--display);margin:0 0 .9em;text-wrap:pretty}
#story .gift{display:inline-block;font:500 .64rem var(--ui);letter-spacing:.2em;text-transform:uppercase;padding:.55em 1em;border-radius:99px;background:#f6c453;margin:.1em 0 1em}
#story button{font:500 .66rem var(--ui);letter-spacing:.26em;text-transform:uppercase;color:#fbf3e4;background:#2b2550;border:0;border-radius:99px;padding:.9em 1.8em;cursor:pointer;margin-top:.3em}
#story button:focus-visible{outline:2px solid #e0483a;outline-offset:3px}
#story ul{list-style:none;padding:0;margin:.2em 0 1em;font:400 1rem/1.7 var(--display)}
#story li.no{opacity:.4}
#story h3{font:500 .62rem var(--ui);letter-spacing:.26em;text-transform:uppercase;opacity:.6;margin:1.2em 0 .3em}
@media (max-width:520px){#story article{padding:24px 22px 20px}#story h2{font-size:1.6rem}}`;
document.head.appendChild(style);
const wrap = document.createElement('div');
wrap.id = 'story'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
wrap.innerHTML = '<article></article>';
document.body.appendChild(wrap);
const art = wrap.firstChild;
for (const ev of ['pointerdown', 'pointerup', 'wheel']) wrap.addEventListener(ev, e => e.stopPropagation());

function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function show(card) {
  open = card;
  art.innerHTML = `<div class="over">${esc(card.over || '')}</div><h2>${esc(card.title)}</h2>${card.text.map(t => `<p>${esc(t)}</p>`).join('')}`
    + (card.gift ? `<div class="gift">${esc(card.gift)}</div><br>` : '')
    + `<button type="button">${card.end ? 'Keep wandering' : queue.length ? 'Go on' : 'Continue'}</button>`;
  wrap.classList.add('on');
  art.scrollTop = 0;
  const b = art.querySelector('button');
  b.onclick = next; b.focus();
  [57, 64, 69].forEach((n, i) => engine.pluck(n, { vol: 0.07, dur: 2.6, delay: i * 0.14 }));
}
function next() {
  const was = open;
  open = null;
  if (was && was.end) afterEnding();
  if (queue.length) show(queue.shift());
  else { wrap.classList.remove('on'); engine.canvas.focus && engine.canvas.focus(); }
}
function tell(cards) {           // queue cards not yet seen
  for (const c of cards) { if (seen.has(c.id)) continue; seen.add(c.id); queue.push(c); }
  if (!open && queue.length) show(queue.shift());
}
export const storyOpen = () => !!open;

// ---- the journal -----------------------------------------------------------------------
function journal() {
  const a = world.archer, lands = a.bow.blessings.map(b => b.constructor.land);
  const li = (ok, t) => `<li class="${ok ? '' : 'no'}">${ok ? '◆' : '◇'} ${esc(t)}</li>`;
  const calmed = Kind => world.beasts.some(b => b.calmed && b.constructor.label === Kind);
  const beasts = [['Mossback Ox', 'Pampas Plain'], ['Ginkgo Stag', 'Golden Wood'], ['Hollow Boar', 'Bamboo Hollow'], ['Frostmane Bear', 'Snow Crest'], ['Reed Toad', 'Heron Marsh'], ['Maple Crane', 'Crimson Vale'], ['Elder Carp', 'Blossom Field']];
  open = { journal: true };
  art.innerHTML = `<div class="over">Journal</div><h2>${seen.has('e3') ? 'The island is awake' : 'What you remember'}</h2>
    <h3>Shrines woken, ${lands.length} of 7</h3><ul>${LANDS.map((l, i) => li(lands.includes(l), `${l}: ${lands.includes(l) ? CHAPTERS[i].title : 'asleep'}`)).join('')}</ul>
    <h3>Beasts calmed</h3><ul>${beasts.map(([n, l]) => li(calmed(n), `${n}, ${l}`)).join('')}</ul>
    <h3>Next</h3><p>${esc(hint(lands))}</p><button type="button">Close</button>`;
  wrap.classList.add('on');
  const b = art.querySelector('button'); b.onclick = next; b.focus();
}
function hint(lands) {
  if (seen.has('e3')) return 'Nothing is asked of you. Wander.';
  if (lands.length === 7) return 'The Elder Carp has risen in Petal Pond, in the Blossom Field to the south. Break its six stone scales. It turns slowly, so circle the pond or curve a Wind arrow to reach its far side. Step through its waves with Shift.';
  if (!lands.length) return 'Gather three motes of light and carry them to the shrine east of the Waystation.';
  const left = LANDS.filter(l => !lands.includes(l));
  return `Follow the roads from the Waystation. Still asleep: ${left.join(', ')}. Press N for the map.`;
}

// ---- gifts from the beasts ---------------------------------------------------------------
function applyGift(gift, fresh) {
  const a = world.archer;
  a.gifts.add(gift);
  if (gift === 'fur') { a.maxHp = 7; if (fresh) a.hp = 7; }
  if (gift === 'sinew') a.bow.quick = 1.5;
}
export function giftArrow(arrow) {     // called as each of the archer's arrows leaves the string
  const g = world.archer.gifts;
  if (g.has('leaf')) arrow.lifetime *= 1.4;
  if (g.has('tusk')) arrow.pierce += 1;
  if (g.has('feather') && arrow.steerable && !arrow.seeks) arrow.turnRate *= 1.5;
}

// ---- hooks for the game layer ------------------------------------------------------------
export function beginStory(w, saved, onEnding) {
  world = w; afterEnding = onEnding;
  w.archer.gifts = new Set();
  if (saved) {
    for (const id of saved.seen || []) seen.add(id);
    for (const g of saved.gifts || []) applyGift(g, false);
    if (saved.hp) w.archer.hp = Math.min(w.archer.maxHp, saved.hp);
  }
  if (seen.has('e3')) onEnding(true);
  tell(PROLOGUE);
}
export const storySave = () => world ? { seen: [...seen], gifts: [...world.archer.gifts], hp: world.archer.hp } : null;

export function shrineWoke(Kind) {     // a land's blessing was bound for the first time
  const i = LAND_BLESSINGS.indexOf(Kind);
  if (i < 0) return;
  setTimeout(() => tell([{ id: 'c' + i, over: `Chapter ${i + 1} · ${LANDS[i]}`, ...CHAPTERS[i] }]), 3200);
}
export function storyEvent(kind, data) {
  if (kind !== 'calmed') return;
  const b = data[0], gift = b.constructor.gift;
  if (gift === 'scale') { setTimeout(() => tell(ENDING), 2200); return; }
  if (world.archer.gifts.has(gift)) return;
  applyGift(gift, true);
  const c = BEAST_CARDS[gift];
  setTimeout(() => tell([{ id: 'b-' + gift, over: b.constructor.label, ...c }]), 2200);
}
export function storyTick() {          // wake the carp once every shrine is awake
  if (world.archer.bow.blessings.length < 7) return;
  const carp = world.beasts.find(b => b instanceof ElderCarp);
  if (carp && carp.dormant && !carp.calmed) {
    carp.dormant = false;
    engine.shake(0.3);
    engine.tone({ f0: 60, f1: 45, dur: 3, vol: 0.2, type: 'triangle' });
    engine.say('The ground hums. In the south, Petal Pond is stirring.', 7);
  }
}
export function storyKey(k) {
  if (open) { if (k === ' ' || k === 'enter' || k === 'escape' || (open.journal && k === 'j')) next(); return true; }
  if (k === 'j') { journal(); return true; }
  return false;
}
