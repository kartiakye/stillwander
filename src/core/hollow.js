// Hollows: the empty soldiers. Footman, Sentry and HollowArcher.
import { Character } from './character.js';
import { Arrow } from './arrow.js';

export const State = Object.freeze({ IDLE: 'idle', APPROACH: 'approach', WINDUP: 'windup', RECOVER: 'recover', DRAW: 'draw' });

// A melee Hollow: notices the archer, closes in, winds up, strikes, recovers.
export class Hollow extends Character {
  static sight = 14;
  static reach = 1.3;         // distance at which it starts a strike
  static strikeReach = 1.7;   // distance at which the strike still lands
  static windup = 0.6;
  static recover = 1.0;
  static strikeDamage = 1;
  static leash = 26;          // how far from its post it will chase

  constructor(x = 0, z = 0, name = '') {
    super(x, z, name);
    this.sight = this.constructor.sight;
    this.state = State.IDLE;
    this.timer = 0;
    this.home = null;          // [x, z] of the post it guards; null: it roams free
    this.returning = false;
  }
  setState(state, timer = 0) { this.state = state; this.timer = timer; }
  onGuardBroken() { this.setState(State.RECOVER, this.constructor.openTime); }

  update(dt, world) {
    super.update(dt, world);
    if (!this.canAct || this.isOpen) return;
    const target = world.archer;
    if (!target.alive) { this.setState(State.IDLE); return; }
    if (this.home) {           // a posted Hollow gives up the chase and walks back
      const fromHome = Math.hypot(this.x - this.home[0], this.z - this.home[1]);
      if (fromHome > this.constructor.leash && !this.returning) { this.returning = true; world.emit('giveUp', this); }
      if (this.returning) {
        if (fromHome < 1.5) { this.returning = false; this.hp = this.maxHp; this.posture = 0; this.setState(State.IDLE); }
        else { this.face(this.home[0], this.home[1]); this.stepTowards(this.home[0], this.home[1], dt, world); }
        return;
      }
    }
    this.think(dt, world, this.distanceTo(target));
  }

  think(dt, world, dist) {
    const C = this.constructor, target = world.archer;
    if (this.state === State.IDLE) {
      if (dist <= this.sight) this.setState(State.APPROACH);
    } else if (this.state === State.APPROACH) {
      this.face(target.x, target.z);
      if (dist <= C.reach) { this.setState(State.WINDUP, C.windup); world.emit('windup', this); }
      else this.stepTowards(target.x, target.z, dt, world);
    } else if (this.state === State.WINDUP) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const landed = dist <= C.strikeReach && target.takeStrike(C.strikeDamage);
        world.emit('strike', this, landed);
        this.setState(State.RECOVER, C.recover);
      }
    } else if (this.state === State.RECOVER) {
      this.timer -= dt;
      if (this.timer <= 0) this.setState(State.APPROACH);
    }
  }

  stepTowards(x, z, dt, world, away = false) {
    const a = this.angleTo(x, z) + (away ? Math.PI : 0), d = this.moveSpeed * dt;
    world.move(this, Math.cos(a) * d, Math.sin(a) * d);
  }
}

export class Footman extends Hollow {
  static maxHp = 4;
  static maxPosture = 6;
  static speed = 2.6;
}

// Holds a guard to its front. Hit it from behind, or burn through.
export class Sentry extends Hollow {
  static maxHp = 6;
  static maxPosture = 8;
  static speed = 2.0;
  static guardArc = 70 * Math.PI / 180;   // half-angle of the guarded front

  frontal(arrow) {    // > 0 when the arrow flies against the way this one faces
    const [dx, dz] = arrow.direction;
    return -(dx * Math.cos(this.facing) + dz * Math.sin(this.facing));
  }
  blocks(arrow) {
    if (arrow.guardBreak || this.isOpen || !this.canAct) return false;
    return this.frontal(arrow) > Math.cos(this.constructor.guardArc);
  }
}

// Keeps its distance and looses volleys.
export class HollowArcher extends Hollow {
  static maxHp = 3;
  static maxPosture = 4;
  static speed = 2.4;
  static sight = 18;
  static near = 8;          // backs away inside this
  static far = 13;          // closes in beyond this
  static drawTime = 1.0;
  static volley = 3;
  static volleyGap = 0.35;
  static rest = 2.2;
  static arrowPower = 0.3;

  constructor(x = 0, z = 0, name = '') { super(x, z, name); this.shotsLeft = 0; }

  think(dt, world, dist) {
    const C = this.constructor, target = world.archer;
    if (this.state === State.IDLE) { if (dist <= this.sight) this.setState(State.APPROACH); return; }
    this.face(target.x, target.z);
    if (this.state === State.APPROACH) {
      if (dist < C.near) this.stepTowards(target.x, target.z, dt, world, true);
      else if (dist > C.far) this.stepTowards(target.x, target.z, dt, world);
      else if (this.canAim) { this.shotsLeft = C.volley; this.setState(State.DRAW, C.drawTime); world.emit('windup', this); }
    } else if (this.state === State.DRAW) {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.canAim) this.fire(world);
        this.shotsLeft -= 1;
        if (this.shotsLeft > 0) this.timer = C.volleyGap;
        else this.setState(State.RECOVER, C.rest);
      }
    } else if (this.state === State.RECOVER) {
      this.timer -= dt;
      if (this.timer <= 0) this.setState(State.APPROACH);
    }
  }

  fire(world) {
    const arrow = new Arrow(this, this.x, this.z, this.facing, this.constructor.arrowPower);
    arrow.drifts = false;
    arrow.recoverable = false;
    arrow.lifetime = 2;
    arrow.height = world.heightAt(this.x, this.z) + 1;
    world.arrows.push(arrow);
    world.emit('loose', arrow);
    return arrow;
  }
}
