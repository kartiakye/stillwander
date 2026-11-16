// Bow: draws, looses, and holds the blessings that shrines have bound to it.
import { Arrow } from './arrow.js';
import { Wind } from './blessing.js';

export class Bow {
  static FULL_DRAW_TIME = 0.9;   // seconds to reach full power
  static MAX_CHARGES = 3;        // shared by every blessing

  constructor() {
    this.blessings = [];
    this.selected = null;
    this.charges = 0;
    this.drawing = false;
    this.held = 0;               // seconds the string has been held
  }

  // ---- blessings
  bind(blessing) {               // returns false if the bow already holds this one
    if (this.has(blessing.constructor)) return false;
    this.blessings.push(blessing);
    this.charges = Bow.MAX_CHARGES;
    return true;
  }
  has(Kind) { return this.blessings.some(b => b instanceof Kind); }
  select(Kind) {                 // null for a plain arrow
    if (Kind === null) { this.selected = null; return true; }
    const b = this.blessings.find(x => x instanceof Kind);
    if (b) this.selected = b;
    return !!b;
  }
  cycle() {                      // plain arrow, then each bound blessing in turn
    const order = [null, ...this.blessings];
    this.selected = order[(order.indexOf(this.selected) + 1) % order.length];
    return this.selected;
  }
  recharge(amount = 1) {
    if (this.blessings.length) this.charges = Math.min(Bow.MAX_CHARGES, this.charges + amount);
  }

  // ---- drawing
  get power() { return Math.min(1, this.held / Bow.FULL_DRAW_TIME); }
  beginDraw() { this.drawing = true; this.held = 0; }
  cancel() { this.drawing = false; this.held = 0; }
  update(dt) { if (this.drawing) this.held += dt; }
  loose(owner, angle) {          // the caller has already taken an arrow from the quiver
    const blessing = this.selected && this.charges > 0 ? this.selected : null;
    if (blessing) this.charges -= 1;
    const arrow = new Arrow(owner, owner.x, owner.z, angle, this.power, blessing);
    // Once the wind is bound, every blessed arrow can be steered (a hawk arrow steers itself).
    if (blessing && this.has(Wind) && !arrow.seeks) Wind.makeSteerable(arrow);
    this.cancel();
    return arrow;
  }
}
