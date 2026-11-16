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
    this.events = [];
  }

  // ---- events for the renderer
  emit(kind, ...data) { this.events.push([kind, data]); }
  drainEvents() { const out = this.events; this.events = []; return out; }

  // ---- queries
  hostilesNear(x, z, radius, owner) {    // living enemies of `owner`, nearest first
    const pool = owner === this.archer ? this.hollows : [this.archer];
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
    }
    for (const g of this.graces) if (g.left <= 0) this.emit('graceEnd', g);
    this.graces = this.graces.filter(g => g.left > 0);
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
    for (const arrow of this.arrows) arrow.update(dt, this);
    this.arrows = this.arrows.filter(a => a.flying);
    this.updateGraces(dt);
    if (this.archer.alive) this.pickUpArrows();
  }
}
