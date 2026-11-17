// Villagers: the people who still live on the island. They do not fight.
// Each keeps to a home, turns to the archer when spoken to, and has a few
// things to say, told in order; the last line repeats.
import { Character } from './character.js';

export class Villager extends Character {
  static speed = 1.0;
  static radius = 0.4;
  static range = 4;            // how far they stroll from home
  static notice = 3.2;         // they stop and turn when the archer is this close

  constructor(x, z, { name = 'Villager', role = '', lines = [], look = 0, gift = null, child = false } = {}) {
    super(x, z, name);
    this.role = role;
    this.lines = lines;
    this.look = look;          // which clothes the renderer gives them
    this.gift = gift;          // { arrows: n } given once, with the line at giftAt
    this.child = child;
    this.said = 0;
    this.given = false;
    this.home = [x, z];
    this.goal = null;
    this.rest = 1 + (x * 7 + z * 3) % 5;
  }

  talk() {                     // returns { line, gift } and moves on to the next line
    const line = this.lines[Math.min(this.said, this.lines.length - 1)] || '...';
    const last = this.said >= this.lines.length - 1;
    this.said = Math.min(this.said + 1, this.lines.length);
    let gift = null;
    if (this.gift && !this.given && last) { this.given = true; gift = this.gift; }
    return { line, gift };
  }

  update(dt, world) {
    super.update(dt, world);
    const a = world.archer, C = this.constructor;
    if (this.distanceTo(a) <= C.notice) { this.face(a.x, a.z); this.goal = null; this.rest = 1.5; return; }
    if (this.rest > 0) { this.rest -= dt; return; }
    if (!this.goal) {
      const r = world.random() * C.range, t = world.random() * Math.PI * 2;
      this.goal = [this.home[0] + Math.cos(t) * r, this.home[1] + Math.sin(t) * r];
    }
    const [gx, gz] = this.goal;
    if (Math.hypot(gx - this.x, gz - this.z) < 0.4) { this.goal = null; this.rest = 2 + world.random() * 7; return; }
    this.face(gx, gz);
    const ox = this.x, oz = this.z, d = this.moveSpeed * dt;
    world.move(this, Math.cos(this.facing) * d, Math.sin(this.facing) * d);
    if (Math.hypot(this.x - ox, this.z - oz) < d * 0.3) { this.goal = null; this.rest = 1; }
  }
}
