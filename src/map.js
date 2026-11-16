// The island of Stillwander, drawn by hand.
//
// Units are tiles. x runs west to east, z runs north (negative) to south (positive).
// The start, a waystation on the Pampas Plain, is at 0, 0.
// Land numbers follow the engine: 0 Pampas Plain, 1 Golden Wood, 2 Bamboo Hollow,
// 3 Snow Crest, 4 Heron Marsh, 5 Crimson Vale, 6 Blossom Field.

export const LAND = { PAMPAS: 0, GOLDEN: 1, BAMBOO: 2, SNOW: 3, MARSH: 4, CRIMSON: 5, BLOSSOM: 6 };

export const BOUNDS = { x0: -540, x1: 540, z0: -440, z1: 440 };

// The shore, clockwise from the north-west. Inside is land, outside is open sea.
export const COAST = [
  [-470, -385], [-300, -408], [-100, -414], [100, -398], [260, -372], [400, -332], [482, -242],
  [502, -120], [492, 20], [508, 150], [472, 272], [382, 352], [262, 392], [196, 404], [150, 418],
  [104, 404], [-20, 396], [-120, 382], [-200, 352], [-282, 372], [-362, 392], [-452, 334],
  [-502, 222], [-497, 80], [-512, -60], [-502, -200], [-492, -322],
];

// Where each land lies. A land may have several centres; borders fall halfway
// between neighbouring centres and blend over a belt about 45 tiles wide.
export const REGIONS = [
  { land: LAND.PAMPAS, at: [[0, 20], [-80, 90], [90, -40], [60, 120]] },
  { land: LAND.GOLDEN, at: [[300, -140], [410, -40], [230, -250]] },
  { land: LAND.BAMBOO, at: [[300, 140], [420, 220], [210, 250]] },
  { land: LAND.SNOW, at: [[-400, -300], [-300, -360], [-450, -180]], label: [-430, -215] },
  { land: LAND.MARSH, at: [[-330, 120], [-400, 280], [-230, 260], [-430, 30]] },
  { land: LAND.CRIMSON, at: [[-150, -260], [0, -335], [110, -270], [-250, -150]] },
  { land: LAND.BLOSSOM, at: [[40, 330], [-80, 330], [170, 360]] },
];

// How high each land sits and how much its terraces climb. The route rises from
// the marsh at sea level, through the plain and woods, up the canyons, to the mountain.
export const ELEVATION = [
  { base: 1.6, rise: 1.6 },   // Pampas Plain
  { base: 2.6, rise: 2.6 },   // Golden Wood
  { base: 2.2, rise: 3.0 },   // Bamboo Hollow
  { base: 6.0, rise: 4.5 },   // Snow Crest
  { base: 0.3, rise: 1.3 },   // Heron Marsh
  { base: 4.0, rise: 3.6 },   // Crimson Vale
  { base: 1.5, rise: 1.8 },   // Blossom Field
];

// Rivers: points with a half-width. The Stillwater is the spine of the island:
// it rises in a glacier lake on Snow Crest, cuts the Crimson canyons, edges the
// plain and spreads into the marsh delta.
export const RIVERS = [
  { name: 'Stillwater', path: [
    [-380, -290, 2], [-330, -250, 2.5], [-260, -226, 3], [-170, -200, 3], [-112, -150, 3.5],
    [-150, -80, 3.5], [-190, -10, 4], [-210, 70, 4.5], [-262, 150, 5], [-322, 222, 6],
    [-370, 300, 7], [-392, 400, 9]] },
  { name: 'Stillwater delta', path: [[-322, 222, 4], [-262, 300, 4.5], [-236, 390, 6]] },
  { name: 'Bamboo Run', path: [[430, -40, 2], [384, 100, 2.5], [332, 200, 3], [300, 300, 3.5], [292, 400, 5]] },
];

export const LAKES = [
  { name: 'Glacier Tarn', x: -385, z: -298, r: 17 },
  { name: 'Lotus Lake', x: -300, z: 60, r: 22 },
  { name: 'Heron Mere', x: -425, z: 195, r: 19 },
  { name: 'Mirror Pond', x: 92, z: 62, r: 13 },
  { name: 'Petal Pond', x: 60, z: 262, r: 10 },
  { name: 'Torii Lagoon', x: -382, z: 262, r: 16 },
];

// Raised ground: the mountain, the temple hill, mesas, a sea-cliff headland.
export const HILLS = [
  { x: -410, z: -320, r: 150, h: 8 },     // Snow Crest's peak
  { x: 392, z: -152, r: 36, h: 5 },       // the Thousand Steps hill
  { x: 0, z: -305, r: 45, h: 2.5 },       // Crimson mesa under the Broken Dojo
  { x: 240, z: 360, r: 55, h: 2 },        // Blossom headland
];

// Roads from the waystation to every main shrine. Where a road meets water it
// becomes a bridge.
export const ROADS = [
  [[0, 0], [-40, -100], [-90, -238], [-200, -222], [-350, -258]],      // north, to Crimson and the mountain
  [[0, 0], [150, -20], [300, -58], [392, -150]],                       // east, to Golden Wood and the Thousand Steps
  [[0, 0], [150, 90], [330, 168], [440, 122]],                         // south-east, to Bamboo Hollow
  [[0, 0], [30, 150], [60, 298], [150, 358]],                          // south, to Blossom Field and the Last Village
  [[0, 0], [-120, 40], [-210, 72], [-300, 148], [-372, 252]],          // west, to the marsh
  [[-70, -60], [-40, -100]],                                           // spur to the Drill Yard
];

// Shrines. Main shrines (one a land) are where a land's blessing is first bound;
// wayside shrines recharge the bow. At most one shrine to each 110-tile square.
export const SHRINES = [
  { name: 'Waystation Shrine', x: 45, z: 35, main: true },
  { name: 'Shrine of the Golden Wood', x: 300, z: -62, main: true },
  { name: 'Shrine of the Bamboo Hollow', x: 330, z: 172, main: true },
  { name: 'Shrine of Snow Crest', x: -350, z: -262, main: true },
  { name: 'Shrine of the Heron Marsh', x: -300, z: 152, main: true },
  { name: 'Shrine of Crimson Vale', x: -90, z: -242, main: true },
  { name: 'Shrine of the Blossom Field', x: 60, z: 302, main: true },
  { name: 'Wayside, west meadow', x: -120, z: 64 },
  { name: 'Wayside, east meadow', x: 92, z: -92 },
  { name: 'Wayside, south meadow', x: -60, z: 182 },
  { name: 'Wayside, high wood', x: 452, z: -262 },
  { name: 'Wayside, river wood', x: 200, z: 28 },
  { name: 'Wayside, hot springs', x: 452, z: 282 },
  { name: 'Wayside, bamboo ravine', x: 222, z: 252 },
  { name: 'Wayside, pilgrim road', x: -462, z: -142 },
  { name: 'Wayside, north ridge', x: -252, z: -372 },
  { name: 'Wayside, reed beds', x: -432, z: 322 },
  { name: 'Wayside, west shore', x: -432, z: 30 },
  { name: 'Wayside, canyon rim', x: 90, z: -302 },
  { name: 'Wayside, river gate', x: -232, z: -142 },
  { name: 'Wayside, orchard', x: -100, z: 342 },
  { name: 'Wayside, cliff walk', x: 200, z: 332 },
];

// Dense forest. Between these stands the ground is open, with only small copses.
export const FORESTS = [
  { x: -150, z: 120, r: 30 }, { x: 120, z: -150, r: 28 }, { x: -60, z: 230, r: 22 }, { x: 140, z: 40, r: 18 },
  { x: 300, z: -200, r: 60 }, { x: 440, z: -100, r: 45 }, { x: 250, z: -60, r: 30 }, { x: 350, z: 10, r: 40 },
  { x: 360, z: 150, r: 45 }, { x: 260, z: 230, r: 40 }, { x: 440, z: 210, r: 35 }, { x: 220, z: 120, r: 25 },
  { x: -330, z: -320, r: 40 }, { x: -460, z: -230, r: 35 }, { x: -270, z: -300, r: 30 },
  { x: -380, z: 90, r: 30 }, { x: -260, z: 320, r: 25 },
  { x: -180, z: -300, r: 35 }, { x: 60, z: -250, r: 30 },
  { x: -20, z: 330, r: 30 }, { x: 110, z: 300, r: 25 }, { x: -140, z: 310, r: 22 },
];

// Landmarks: the places the island is remembered by. `pave` lays a cream court
// and clears the ground; `flat` levels it.
export const LANDMARKS = [
  { name: 'The Waystation', kind: 'waystation', x: 0, z: 0, r: 8, land: LAND.PAMPAS },
  { name: 'The Drill Yard', kind: 'yard', x: -70, z: -60, r: 11, flat: true, pave: true, land: LAND.PAMPAS },
  { name: 'North Farm', kind: 'hamlet', x: 112, z: -122, r: 12, flat: true, houses: 3, land: LAND.PAMPAS },
  { name: 'Mill Hamlet', kind: 'hamlet', x: -122, z: 142, r: 12, flat: true, houses: 4, land: LAND.PAMPAS },
  { name: 'The Thousand Steps', kind: 'steps', x: 392, z: -152, r: 9, flat: true, pave: true, land: LAND.GOLDEN },
  { name: "Woodcutters' Town", kind: 'town', x: 248, z: -198, r: 16, flat: true, houses: 6, land: LAND.GOLDEN },
  { name: 'The Green Cathedral', kind: 'cathedral', x: 368, z: 92, r: 14, flat: true, land: LAND.BAMBOO },
  { name: "Craftsmen's Village", kind: 'hamlet', x: 444, z: 132, r: 13, flat: true, houses: 4, land: LAND.BAMBOO },
  { name: 'The Drowned Torii', kind: 'drowned', x: -380, z: 262, r: 12, land: LAND.MARSH },
  { name: 'Stilt Village', kind: 'hamlet', x: -342, z: 338, r: 12, flat: true, houses: 4, land: LAND.MARSH },
  { name: 'The Broken Dojo', kind: 'dojo', x: -2, z: -308, r: 12, flat: true, pave: true, land: LAND.CRIMSON },
  { name: 'The Fortified Pass', kind: 'pass', x: -160, z: -228, r: 10, flat: true, land: LAND.CRIMSON },
  { name: 'The Mountain Monastery', kind: 'monastery', x: -412, z: -324, r: 11, flat: true, pave: true, land: LAND.SNOW },
  { name: 'Pilgrim Shelter', kind: 'hamlet', x: -298, z: -312, r: 9, flat: true, houses: 2, land: LAND.SNOW },
  { name: 'The Last Village', kind: 'town', x: 152, z: 360, r: 18, flat: true, houses: 9, land: LAND.BLOSSOM },
];

// ---- geometry helpers -----------------------------------------------------------

// Distance from a point to a segment, and how far along it the nearest point is.
function seg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t];
}

// Signed distance to the coast: positive inland, negative out at sea.
export function coastDistance(x, z) {
  let d = Infinity, inside = false;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i++) {
    const [ax, az] = COAST[j], [bx, bz] = COAST[i];
    d = Math.min(d, seg(x, z, ax, az, bx, bz)[0]);
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside ? d : -d;
}

// How far a point lies outside the nearest river's banks (negative = in the water).
export function riverDistance(x, z) {
  let best = Infinity;
  for (const r of RIVERS) {
    const p = r.path;
    for (let i = 0; i < p.length - 1; i++) {
      const [d, t] = seg(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
      const half = p[i][2] + (p[i + 1][2] - p[i][2]) * t;
      best = Math.min(best, d - half);
    }
  }
  for (const l of LAKES) best = Math.min(best, Math.hypot(x - l.x, z - l.z) - l.r);
  return best;
}

export function roadDistance(x, z) {
  let best = Infinity;
  for (const p of ROADS) for (let i = 0; i < p.length - 1; i++) {
    best = Math.min(best, seg(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1])[0]);
  }
  return best;
}

// 0 in open country, 1 deep in an authored forest.
export function forestAt(x, z) {
  let f = 0;
  for (const s of FORESTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) f = Math.max(f, 1 - Math.pow(d / s.r, 2));
  }
  return f;
}

export function landmarkAt(x, z) {
  for (const l of LANDMARKS) if (Math.hypot(x - l.x, z - l.z) < l.r) return l;
  return null;
}
