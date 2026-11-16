// Timed conditions that sit on a character: burning, chilled, frozen, stunned, blinded.

export class Effect {
  static label = 'effect';
  speedScale = 1;       // multiplies movement speed
  blocksAction = false; // true: cannot move or attack
  blocksAim = false;    // true: cannot loose arrows
  constructor(duration) { this.remaining = duration; }
  get expired() { return this.remaining <= 0; }
  update(owner, dt) { this.remaining -= dt; }
}

export class Burning extends Effect {
  static label = 'burning';
  static TICK = 1;
  constructor(duration = 3, damage = 1) { super(duration); this.damage = damage; this.untilTick = Burning.TICK; }
  update(owner, dt) {
    super.update(owner, dt);
    this.untilTick -= dt;
    while (this.untilTick <= 0 && owner.alive) { owner.takeDamage(this.damage); this.untilTick += Burning.TICK; }
  }
}

export class Chilled extends Effect {
  static label = 'chilled';
  speedScale = 0.5;
  constructor(duration = 4) { super(duration); }
}

export class Frozen extends Effect {
  static label = 'frozen';
  speedScale = 0;
  blocksAction = true;
  constructor(duration = 3) { super(duration); }
}

export class Stunned extends Effect {
  static label = 'stunned';
  speedScale = 0;
  blocksAction = true;
  constructor(duration = 1) { super(duration); }
}

export class Blinded extends Effect {
  static label = 'blinded';
  blocksAim = true;
  constructor(duration = 4) { super(duration); }
}

// A Hollow lulled by a bloom forgets to fight while it stands in the flowers.
export class Lulled extends Effect {
  static label = 'lulled';
  speedScale = 0;
  blocksAction = true;
  constructor(duration = 1) { super(duration); }
}
