// Blessings live on the arrow, never on the archer. Each overrides three hooks:
//   onLoose  - the arrow leaves the string
//   onFlight - every step in the air
//   onHit    - it has struck a character (after damage is resolved)
import { Blinded, Burning, Chilled, Frozen, Stunned } from './effects.js';

export class Blessing {
  static label = 'blessing';
  static land = '';
  get label() { return this.constructor.label; }
  onLoose(arrow) {}
  onFlight(arrow, dt, world) {}
  onHit(arrow, target, result, world) {}
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
