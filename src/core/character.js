// Character: the base class for everything that walks, is hit, and can fall.
import { Frozen } from './effects.js';

export class HitResult {
  blocked = false;
  damage = 0;
  postureBroken = false;
  finished = false;   // a finishing blow on an open or frozen target
  killed = false;
}

export class Character {
  static maxHp = 4;
  static maxPosture = 6;
  static speed = 3;
  static radius = 0.45;
  static openTime = 2.5;          // how long a broken guard stays open
  static postureRecovery = 0.6;   // posture shed per second when not hit recently
  static finishDamage = null;     // null: a finishing blow kills outright

  constructor(x = 0, z = 0, name = '') {
    const C = this.constructor;
    this.name = name || C.name;
    this.x = x; this.z = z;
    this.facing = 0;              // radians, 0 = +x
    this.maxHp = C.maxHp; this.maxPosture = C.maxPosture;
    this.speed = C.speed; this.radius = C.radius;
    this.hp = this.maxHp;
    this.posture = 0;
    this.openFor = 0;             // > 0 while the guard is broken
    this.effects = [];
    this.alive = true;
    this.sinceHit = 99;
  }

  // ---- geometry
  distanceTo(o) { return Math.hypot(o.x - this.x, o.z - this.z); }
  angleTo(x, z) { return Math.atan2(z - this.z, x - this.x); }
  face(x, z) { this.facing = this.angleTo(x, z); }

  // ---- conditions
  effect(Kind) { return this.effects.find(e => e instanceof Kind) || null; }
  has(Kind) { return this.effect(Kind) !== null; }
  addEffect(effect) {            // the same kind refreshes rather than stacks
    const old = this.effect(effect.constructor);
    if (old) old.remaining = Math.max(old.remaining, effect.remaining);
    else this.effects.push(effect);
  }
  removeEffect(Kind) { this.effects = this.effects.filter(e => !(e instanceof Kind)); }
  get canAct() { return this.alive && !this.effects.some(e => e.blocksAction); }
  get canAim() { return this.canAct && !this.effects.some(e => e.blocksAim); }
  get moveSpeed() { return this.effects.reduce((s, e) => s * e.speedScale, this.speed); }
  get isOpen() { return this.openFor > 0; }   // the next good arrow finishes it

  // ---- harm
  takeDamage(amount) {
    if (!this.alive || amount <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) { this.alive = false; this.onDeath(); }
    return !this.alive;
  }
  addPosture(amount) {           // returns true if this broke the guard
    if (!this.alive || this.isOpen || amount <= 0) return false;
    this.sinceHit = 0;
    this.posture = Math.min(this.maxPosture, this.posture + amount);
    if (this.posture >= this.maxPosture) {
      this.posture = 0;
      this.openFor = this.constructor.openTime;
      this.onGuardBroken();
      return true;
    }
    return false;
  }
  finish() {                     // a finishing blow; returns the damage dealt
    const fd = this.constructor.finishDamage;
    const dmg = fd === null ? this.hp : fd;
    this.openFor = 0;
    this.removeEffect(Frozen);
    this.takeDamage(dmg);
    return dmg;
  }
  blocks(arrow) { return false; }  // does this character turn the arrow aside?
  receiveArrow(arrow) {
    const res = new HitResult();
    if (!this.alive) return res;
    if (this.blocks(arrow)) { res.blocked = true; return res; }
    if (this.isOpen || (this.has(Frozen) && arrow.shatters)) {
      res.finished = true;
      res.damage = this.finish();
    } else {
      res.damage = arrow.damage;
      this.takeDamage(arrow.damage);
      if (this.alive) res.postureBroken = this.addPosture(arrow.postureDamage);
    }
    res.killed = !this.alive;
    return res;
  }

  // ---- hooks
  onDeath() {}
  onGuardBroken() {}

  // ---- time
  update(dt, world) {
    if (!this.alive) return;
    for (const e of [...this.effects]) e.update(this, dt);
    this.effects = this.effects.filter(e => !e.expired);
    if (!this.alive) return;
    if (this.openFor > 0) this.openFor = Math.max(0, this.openFor - dt);
    this.sinceHit += dt;
    if (this.sinceHit > 2 && this.posture > 0) {
      this.posture = Math.max(0, this.posture - this.constructor.postureRecovery * dt);
    }
  }
}
