// World: everything alive in the scene, and the rules for how they meet.
// The renderer reads this object and drains `events`; it never changes the rules.
import { Archer } from './archer.js';
import { Lulled } from './effects.js';

// A tree trunk or rock placed by hand: stops arrows and feet.
export class Obstacle {
  constructor(x, z, radius = 0.4) { this.x = x; this.z = z; this.radius = radius; }
}

// Grace: a ring of flowers left by a Bloom arrow.
export class Grace {
  static RADIUS = 3;
  static LIFE = 7;
  static MEND = 1.6;         // seconds per petal mended
  constructor(x, z) { this.x = x; this.z = z; this.radius = Grace.RADIUS; this.left = Grace.LIFE; this.mend = Grace.MEND; }
  contains(c) { return Math.hypot(c.x - this.x, c.z - this.z) <= this.radius; }
}

export class StuckArrow {
  constructor(x, z) { this.x = x; this.z = z; }
}

// A small seeded random source, so a world plays the same way twice.
export function seededRandom(seed) {
  let a = seed | 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class World {
  static BREAK_CHANCE = 1 / 3;   // a spent arrow snaps this often
  static PICKUP_RADIUS = 1.0;
  static STEP_UP = 1.0;          // the tallest ledge a Hollow can climb
  static STEP_DOWN = 2.0;

  // `terrain` is optional: { height(x, z), blocked(x, z) }.
  constructor(seed = 0, terrain = null) {
    this.random = seededRandom(seed);
    this.terrain = terrain;
    this.time = 0;
    this.archer = new Archer();
    this.hollows = [];
    this.arrows = [];
    this.stuck = [];
    this.obstacles = [];
    this.wind = [0, 0];          // sideways push on unblessed arrows, tiles/second
    this.wet = false;            // rain or marsh: thunder reaches further
    this.graces = [];
    this.beasts = [];            // the old-age beasts; see beast.js
    this.folk = [];              // villagers; see villager.js
    this.archerMoving = false;   // set by the game each frame: footsteps can be heard
    this.archerHidden = false;   // ... and hidden in tall grass
    this.events = [];
  }

  // ---- events for the renderer
  emit(kind, ...data) { this.events.push([kind, data]); }
  drainEvents() { const out = this.events; this.events = []; return out; }

  // ---- queries
  hostilesNear(x, z, radius, owner) {    // living enemies of `owner`, nearest first
    const pool = owner === this.archer ? [...this.hollows, ...this.beasts.filter(b => b.hostile)] : [this.archer];
    return pool.filter(c => c.alive)
      .map(c => [Math.hypot(c.x - x, c.z - z), c])
      .filter(p => p[0] <= radius)
      .sort((p, q) => p[0] - q[0])
      .map(p => p[1]);
  }
  blockedAt(x, z, radius = 0) {
    if (this.terrain && this.terrain.blocked(x, z)) return true;
    return this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.radius + radius);
  }
  heightAt(x, z) { return this.terrain ? this.terrain.height(x, z) : 0; }
  walkable(x0, z0, x1, z1) {
    if (!this.terrain) return true;
    if (this.terrain.blocked(x1, z1)) return false;
    const d = this.terrain.height(x1, z1) - this.terrain.height(x0, z0);
    return d <= World.STEP_UP && d >= -World.STEP_DOWN;
  }

  // ---- movement: slide round trunks, rocks and cliffs
  move(c, dx, dz) {
    const ox = c.x, oz = c.z;
    c.x += dx; c.z += dz;
    if (!this.walkable(ox, oz, c.x, c.z)) {
      if (this.walkable(ox, oz, c.x, oz)) c.z = oz;
      else if (this.walkable(ox, oz, ox, c.z)) c.x = ox;
      else { c.x = ox; c.z = oz; return; }
    }
    for (const o of this.obstacles) {
      const d = Math.hypot(c.x - o.x, c.z - o.z), gap = o.radius + c.radius;
      if (d < gap) {
        if (d === 0) c.x += gap;
        else { c.x = o.x + (c.x - o.x) / d * gap; c.z = o.z + (c.z - o.z) / d * gap; }
      }
    }
  }

  // ---- arrows
  resolveArrow(arrow) {          // called every flight step
    if (this.blockedAt(arrow.x, arrow.z) || (this.terrain && this.heightAt(arrow.x, arrow.z) > arrow.height)) {
      this.landArrow(arrow);     // a trunk, a rock or a cliff face
      return;
    }
    for (const c of this.hostilesNear(arrow.x, arrow.z, 3, arrow.owner)) {
      if (arrow.struck.includes(c)) continue;
      if (Math.hypot(c.x - arrow.x, c.z - arrow.z) > c.radius + arrow.constructor.HIT_RADIUS) continue;
      if (c.parts) {             // inside a great beast, fly on until a part is met or the middle is reached
        const [dx, dz] = arrow.direction, inward = (c.x - arrow.x) * dx + (c.z - arrow.z) * dz > 0;
        const deep = Math.hypot(c.x - arrow.x, c.z - arrow.z) <= c.radius * 0.35;
        if (!c.partAt(arrow.x, arrow.z, arrow.constructor.HIT_RADIUS) && inward && !deep) continue;
      }
      arrow.struck.push(c);
      const res = c.receiveArrow(arrow);
      if (arrow.blessing) arrow.blessing.onHit(arrow, c, res, this);
      this.emit('hit', arrow, c, res);
      if (arrow.owner === this.archer && res.finished) this.archer.gainResolve();
      if (res.blocked) { arrow.flying = false; this.emit('arrowBroke', arrow); return; }
      if (arrow.pierce > 0) { arrow.pierce -= 1; continue; }
      this.landArrow(arrow);
      return;
    }
  }
  landArrow(arrow) {             // it stops, and may be left standing to pick up
    arrow.flying = false;
    if (arrow.blessing) arrow.blessing.onLand(arrow, this);
    if (arrow.owner === this.archer && arrow.recoverable && this.random() >= World.BREAK_CHANCE) {
      const s = new StuckArrow(arrow.x, arrow.z);
      this.stuck.push(s);
      this.emit('arrowStuck', arrow, s);
      return;
    }
    this.emit('arrowBroke', arrow);
  }
  pickUpArrows() {
    const a = this.archer, keep = [];
    for (const s of this.stuck) {
      if (Math.hypot(s.x - a.x, s.z - a.z) <= World.PICKUP_RADIUS) { a.inventory.add('arrows'); this.emit('pickup', s); }
      else keep.push(s);
    }
    this.stuck = keep;
  }

  // ---- graces
  addGrace(x, z) {
    const g = new Grace(x, z);
    this.graces.push(g);
    this.emit('grace', g);
    return g;
  }
  updateGraces(dt) {
    const a = this.archer;
    for (const g of this.graces) {
      g.left -= dt;
      if (a.alive && g.contains(a) && a.hp < a.maxHp) {
        g.mend -= dt;
        if (g.mend <= 0) { g.mend = Grace.MEND; a.hp = Math.min(a.maxHp, a.hp + 1); this.emit('mend', a); }
      }
      for (const h of this.hollows) if (h.alive && g.contains(h)) h.addEffect(new Lulled(0.4));
      for (const b of this.beasts) if (b.hostile && g.contains(b) && b.soothed <= 0) b.soothe();
    }
    for (const g of this.graces) if (g.left <= 0) this.emit('graceEnd', g);
    this.graces = this.graces.filter(g => g.left > 0);
  }

  // ---- beasts
  hum(x, z, radius = 9) {        // a hum settles the beasts nearby and calls a calmed one
    let called = null;
    for (const b of this.beasts) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (b.hostile && d <= radius) b.soothe();
      if (b.calmed && !b.rider && (!called || d < Math.hypot(called.x - x, called.z - z))) called = b;
    }
    if (called && Math.hypot(called.x - x, called.z - z) > 3) { called.following = true; this.emit('called', called); }
    return called;
  }
  mount() {                      // climb onto the nearest calmed beast that carries riders
    const a = this.archer;
    if (a.mount) return null;
    const b = this.beasts.find(b => b.calmed && b.constructor.gift === 'ride' && b.distanceTo(a) <= b.radius + 1.8);
    if (!b) return null;
    a.mount = b; b.rider = a; b.following = false;
    a.x = b.x; a.z = b.z;
    this.emit('mount', b);
    return b;
  }
  dismount() {
    const a = this.archer, b = a.mount;
    if (!b) return null;
    a.mount = null; b.rider = null;
    const side = a.facing + Math.PI / 2;
    this.move(a, Math.cos(side) * (b.radius + 0.6), Math.sin(side) * (b.radius + 0.6));
    this.emit('dismount', b);
    return b;
  }

  // ---- villagers
  talk(reach = 2.6) {            // speak with the nearest villager in reach
    const a = this.archer;
    let best = null, bd = reach;
    for (const v of this.folk) { const d = v.distanceTo(a); if (d <= bd) { bd = d; best = v; } }
    if (!best) return null;
    const said = best.talk();
    best.face(a.x, a.z);
    if (said.gift && said.gift.arrows) a.inventory.arrows += said.gift.arrows;
    this.emit('talk', best, said.line, said.gift);
    return best;
  }

  separateBeasts() {             // great bodies do not walk through one another
    const bs = this.beasts;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), gap = (p.radius + q.radius) * 0.85;
      if (d >= gap || d === 0) continue;
      const push = (gap - d) / 2 / d;
      if (!p.rider) this.move(p, -dx * push, -dz * push);
      if (!q.rider) this.move(q, dx * push, dz * push);
    }
  }

  // ---- time
  update(dt) {
    this.time += dt;
    this.archer.update(dt, this);
    for (const h of this.hollows) {
      const was = h.alive;
      h.update(dt, this);
      if (was && !h.alive) this.emit('death', h);
    }
    for (const b of this.beasts) {
      if (b.rider) { b.x = b.rider.x; b.z = b.rider.z; b.facing = b.rider.facing; }
      b.update(dt, this);
    }
    this.separateBeasts();
    for (const v of this.folk) v.update(dt, this);
    for (const arrow of this.arrows) arrow.update(dt, this);
    this.arrows = this.arrows.filter(a => a.flying);
    this.updateGraces(dt);
    if (this.archer.alive) this.pickUpArrows();
  }
}
