// Arrow: one shaft in flight. It carries at most one blessing.

export class Arrow {
  static BASE_SPEED = 14;   // tiles per second at an empty draw
  static DRAW_SPEED = 14;   // extra speed at a full draw
  static HIT_RADIUS = 0.25;
  static FULL_DRAW = 0.95;  // power at or above this counts as a full draw

  constructor(owner, x, z, angle, power = 1, blessing = null) {
    this.owner = owner;
    this.x = x; this.z = z;
    this.angle = angle;                 // direction of travel, radians
    this.power = Math.max(0, Math.min(1, power));
    this.speed = Arrow.BASE_SPEED + Arrow.DRAW_SPEED * this.power;
    this.damage = 1 + 2 * this.power;
    this.postureDamage = 1 + 3 * this.power;
    this.blessing = blessing;
    this.lifetime = 1.6;                // seconds of flight before it drops
    this.age = 0;
    this.drifts = true;                 // pushed sideways by the world's wind
    this.steerable = false;             // bends towards steerTarget in flight
    this.turnRate = 2.6;                // radians per second when steered
    this.steerTarget = null;
    this.turned = 0;                    // total radians it has bent in flight
    this.pierce = 0;                    // extra targets it may pass through
    this.guardBreak = false;            // goes through a raised guard
    this.shatters = this.power >= Arrow.FULL_DRAW;   // breaks a frozen target
    this.recoverable = true;
    this.height = 0;                    // how high it flies; set when it is loosed
    this.struck = [];
    this.flying = true;
    if (blessing) blessing.onLoose(this);
  }

  get direction() { return [Math.cos(this.angle), Math.sin(this.angle)]; }
  steerTowards(x, z) { this.steerTarget = [x, z]; }

  steer(dt) {
    const [tx, tz] = this.steerTarget;
    const want = Math.atan2(tz - this.z, tx - this.x);
    const TAU = Math.PI * 2;
    const diff = ((((want - this.angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    const step = this.turnRate * dt;
    const turn = Math.max(-step, Math.min(step, diff));
    this.angle += turn;
    this.turned += Math.abs(turn);
  }

  // Advance in small steps so a fast arrow cannot skip a target.
  update(dt, world) {
    if (!this.flying) return;
    const steps = Math.max(1, Math.ceil(this.speed * dt / 0.2));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (this.steerable && this.steerTarget) this.steer(h);
      const [dx, dz] = this.direction;
      this.x += dx * this.speed * h;
      this.z += dz * this.speed * h;
      if (this.drifts) { this.x += world.wind[0] * h; this.z += world.wind[1] * h; }
      if (this.blessing) this.blessing.onFlight(this, h, world);
      this.age += h;
      world.resolveArrow(this);
      if (!this.flying) return;
      if (this.age >= this.lifetime) { world.landArrow(this); return; }
    }
  }
}
