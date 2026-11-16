// Archer: the player. Perfect at the start, more human with every chapter.
import { Character, HitResult } from './character.js';
import { Inventory } from './inventory.js';
import { Bow } from './bow.js';

export class Archer extends Character {
  static maxHp = 5;
  static maxPosture = 999;        // the archer has no posture bar
  static speed = 4.3;
  static MAX_STAMINA = 100;
  static STAMINA_REGEN = 20;
  static SIDESTEP_COST = 25;
  static SIDESTEP_TIME = 0.25;    // seconds, untouchable throughout
  static SIDESTEP_DISTANCE = 2.2;
  static MAX_RESOLVE = 3;
  static HEAL = 2;
  static DRAW_MOVE_SCALE = 0.45;  // walking speed while the bow is drawn

  constructor(x = 0, z = 0) {
    super(x, z, 'Archer');
    this.bow = new Bow();
    this.inventory = new Inventory();
    this.flaws = [];
    this.stamina = Archer.MAX_STAMINA;
    this.resolve = 0;
    this.stepLeft = 0;
    this.stepDir = [0, 0];
  }

  // ---- becoming human
  get perfect() { return this.flaws.length === 0; }   // true in the prologue
  addFlaw(flaw) {
    if (this.hasFlaw(flaw.constructor)) return false;
    this.flaws.push(flaw);
    return true;
  }
  hasFlaw(Kind) { return this.flaws.some(f => f instanceof Kind); }
  aimAngle(wanted, t) {           // where the arrow will really go
    return this.flaws.reduce((a, f) => a + f.aimOffset(this.bow.held, t), wanted);
  }
  get aimLineScale() { return this.flaws.reduce((s, f) => s * f.aimLineScale, 1); }

  // ---- the bow
  draw() {
    if (!this.canAim || this.inventory.arrows <= 0 || this.sidestepping) return false;
    this.bow.beginDraw();
    return true;
  }
  loose(wantedAngle, world) {     // returns the arrow, now flying in the world, or null
    if (!this.bow.drawing) return null;
    if (!this.inventory.takeArrow()) { this.bow.cancel(); return null; }
    const angle = this.aimAngle(wantedAngle, world.time);
    this.facing = angle;
    const arrow = this.bow.loose(this, angle);
    if (this.perfect) arrow.drifts = false;
    arrow.height = world.heightAt(this.x, this.z) + 1;
    world.arrows.push(arrow);
    world.emit('loose', arrow);
    return arrow;
  }

  // ---- moving
  get sidestepping() { return this.stepLeft > 0; }
  get moveSpeed() {
    const s = super.moveSpeed;
    return this.bow.drawing ? s * Archer.DRAW_MOVE_SCALE : s;
  }
  sidestep(dx, dz) {              // a quick step out of reach; cancels a draw
    const n = Math.hypot(dx, dz);
    if (n === 0 || !this.canAct || this.sidestepping) return false;
    if (this.stamina < Archer.SIDESTEP_COST) return false;
    this.stamina -= Archer.SIDESTEP_COST;
    this.bow.cancel();
    this.stepLeft = Archer.SIDESTEP_TIME;
    this.stepDir = [dx / n, dz / n];
    return true;
  }

  // ---- harm and healing
  takeStrike(damage) {            // a blow at arm's length; true if it landed
    if (this.sidestepping || !this.alive) return false;
    this.takeDamage(damage);
    this.bow.cancel();
    return true;
  }
  receiveArrow(arrow) {
    const res = new HitResult();
    if (this.sidestepping || !this.alive) { res.blocked = true; return res; }
    res.damage = 1;
    this.takeDamage(1);
    res.killed = !this.alive;
    return res;
  }
  gainResolve(amount = 1) { this.resolve = Math.min(Archer.MAX_RESOLVE, this.resolve + amount); }
  heal() {                        // spend one Resolve to mend two petals
    if (this.resolve <= 0 || this.hp >= this.maxHp || !this.alive) return false;
    this.resolve -= 1;
    this.hp = Math.min(this.maxHp, this.hp + Archer.HEAL);
    return true;
  }

  // ---- time
  update(dt, world) {
    super.update(dt, world);
    if (!this.alive) return;
    this.bow.update(dt);
    if (this.sidestepping) {
      const step = Math.min(dt, this.stepLeft);
      const v = Archer.SIDESTEP_DISTANCE / Archer.SIDESTEP_TIME;
      world.move(this, this.stepDir[0] * v * step, this.stepDir[1] * v * step);
      this.stepLeft -= step;
    } else {
      this.stamina = Math.min(Archer.MAX_STAMINA, this.stamina + Archer.STAMINA_REGEN * dt);
    }
  }
}
