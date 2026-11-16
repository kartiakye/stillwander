// Blessings live on the arrow, never on the archer. Each land's shrine grants one.
// A blessing overrides any of these hooks:
//   onLoose   - the arrow is made, before it leaves the string
//   onRelease - it has left the string and is in the world
//   onFlight  - every step in the air
//   onHit     - it has struck a character (after damage is resolved)
//   onLand    - it has stopped in the ground, a trunk or a cliff
import { Blinded, Burning, Chilled, Frozen, Stunned } from './effects.js';
import { Arrow } from './arrow.js';

export class Blessing {
  static label = 'blessing';
  static land = '';
  get label() { return this.constructor.label; }
  onLoose(arrow) {}
  onRelease(arrow, world) {}
  onFlight(arrow, dt, world) {}
  onHit(arrow, target, result, world) {}
  onLand(arrow, world) {}
}

// The wind obeys the bow: the arrow follows where the archer points.
export class Wind extends Blessing {
  static label = 'wind';
  static land = 'Pampas Plain';
  static FLIGHT = 3;       // seconds a steered arrow stays in the air
  static SPEED = 12;       // steered arrows fly slower, so they can turn tightly
  static TURN_RATE = 3.2;  // radians per second
  static PIERCE = 2;
  static makeSteerable(arrow) {   // used by every blessing once Wind is bound
    arrow.steerable = true;
    arrow.drifts = false;
    arrow.lifetime = Wind.FLIGHT;
    arrow.speed = Wind.SPEED;
    arrow.turnRate = Wind.TURN_RATE;
  }
  onLoose(arrow) { Wind.makeSteerable(arrow); arrow.pierce = Wind.PIERCE; }
}

// Ignites the target, spreads to those beside it, and breaks a guard.
export class Fire extends Blessing {
  static label = 'fire';
  static land = 'Golden Wood';
  static SPREAD = 2.5;
  static STEAM = 4;
  onLoose(arrow) { arrow.guardBreak = true; }
  onHit(arrow, target, result, world) {
    if (result.blocked) return;
    if (target.has(Chilled) || target.has(Frozen)) {   // fire on frost makes blinding steam
      target.removeEffect(Chilled);
      target.removeEffect(Frozen);
      for (const c of world.hostilesNear(target.x, target.z, Fire.STEAM, arrow.owner)) c.addEffect(new Blinded());
      world.emit('steam', target.x, target.z);
      return;
    }
    for (const c of world.hostilesNear(target.x, target.z, Fire.SPREAD, arrow.owner)) c.addEffect(new Burning());
  }
}

// Strikes, then leaps to up to three more. Shatters anything frozen.
export class Thunder extends Blessing {
  static label = 'thunder';
  static land = 'Heron Marsh';
  static CHAIN = 3;
  static REACH = 5;
  static CHAIN_DAMAGE = 1;
  static CHAIN_POSTURE = 3;
  onLoose(arrow) { arrow.shatters = true; }
  onHit(arrow, target, result, world) {
    if (result.blocked) return;
    if (target.alive) target.addEffect(new Stunned());
    const reach = Thunder.REACH * (world.wet ? 2 : 1);
    const near = world.hostilesNear(target.x, target.z, reach, arrow.owner).filter(c => c !== target);
    world.emit('chain', target, near.slice(0, Thunder.CHAIN));
    for (const c of near.slice(0, Thunder.CHAIN)) {
      if (c.has(Frozen)) { c.finish(); continue; }
      c.takeDamage(Thunder.CHAIN_DAMAGE);
      if (c.alive) { c.addPosture(Thunder.CHAIN_POSTURE); c.addEffect(new Stunned()); }
    }
  }
}

// First hit slows. A second hit on a chilled target freezes it solid.
export class Frost extends Blessing {
  static label = 'frost';
  static land = 'Snow Crest';
  onHit(arrow, target, result, world) {
    if (result.blocked || !target.alive || result.finished) return;
    if (target.has(Chilled)) { target.removeEffect(Chilled); target.addEffect(new Frozen()); }
    else if (!target.has(Frozen)) target.addEffect(new Chilled());
  }
}

// Bamboo Hollow. Bamboo grows in clusters: the arrow leaves the string as three.
export class Split extends Blessing {
  static label = 'split';
  static land = 'Bamboo Hollow';
  static SPREAD = 0.2;     // radians between the arrows of the fan
  onRelease(arrow, world) {
    for (const d of [-Split.SPREAD, Split.SPREAD]) {
      const c = new Arrow(arrow.owner, arrow.x, arrow.z, arrow.angle + d, arrow.power);
      c.height = arrow.height;
      c.drifts = arrow.drifts;
      c.sibling = true;
      world.arrows.push(c);
      world.emit('loose', c);
    }
  }
}

// Crimson Vale. Like a hawk off the wrist, the arrow finds its own prey.
export class Hawk extends Blessing {
  static label = 'hawk';
  static land = 'Crimson Vale';
  static SIGHT = 11;       // how far ahead it looks for prey
  static CONE = 1.3;       // radians either side of its heading
  static TURN_RATE = 6.5;
  static SPEED = 15;       // slow enough to bank tightly onto its prey
  onLoose(arrow) {
    arrow.seeks = true;    // the pointer does not steer it
    arrow.steerable = true;
    arrow.drifts = false;
    arrow.turnRate = Hawk.TURN_RATE;
    arrow.speed = Math.min(arrow.speed, Hawk.SPEED);
    arrow.lifetime = 2.4;
  }
  onFlight(arrow, dt, world) {
    if (arrow.age < 0.08) return;
    let best = null, bd = Infinity;
    for (const c of world.hostilesNear(arrow.x, arrow.z, Hawk.SIGHT, arrow.owner)) {
      if (arrow.struck.includes(c)) continue;
      const a = Math.atan2(c.z - arrow.z, c.x - arrow.x);
      const off = Math.abs(Math.atan2(Math.sin(a - arrow.angle), Math.cos(a - arrow.angle)));
      if (off > Hawk.CONE) continue;
      const d = Math.hypot(c.x - arrow.x, c.z - arrow.z) * (1 + off);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) arrow.steerTowards(best.x, best.z);
  }
}

// Blossom Field. Where the arrow falls, flowers open: they mend the archer
// standing among them and lull any Hollow into forgetting the fight.
export class Bloom extends Blessing {
  static label = 'bloom';
  static land = 'Blossom Field';
  onHit(arrow, target, result, world) {
    if (!arrow.bloomed) { arrow.bloomed = true; world.addGrace(target.x, target.z); }
  }
  onLand(arrow, world) {
    if (!arrow.bloomed) { arrow.bloomed = true; world.addGrace(arrow.x, arrow.z); }
  }
}

// Which land's shrine grants which blessing, in the engine's land order.
export const LAND_BLESSINGS = [Wind, Fire, Split, Frost, Thunder, Hawk, Bloom];
