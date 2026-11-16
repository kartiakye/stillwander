// Flaws: what the archer loses, one per chapter, on the way to being human.
// A flaw never touches the arrow. It only changes how well the archer can hold
// and aim the bow, which is why the blessings on the arrow come to matter.

export class Flaw {
  static label = 'flaw';
  static chapter = 0;
  aimLineScale = 1;                 // how much of the aim guide the archer still sees
  aimOffset(held, t) { return 0; }  // radians added to the aim
}

// Chapter One. The arms tire: a draw held too long begins to shake.
export class Fatigue extends Flaw {
  static label = 'fatigue';
  static chapter = 1;
  static STEADY = 1.2;      // seconds a draw can be held before it shakes
  static MAX_SHAKE = 0.12;  // radians
  aimOffset(held, t) {
    const over = Math.max(0, held - Fatigue.STEADY);
    return Math.min(Fatigue.MAX_SHAKE, over * 0.08) * Math.sin(t * 23);
  }
}

// Chapter Two. Certainty goes: the aim sways and the guide grows short.
export class Doubt extends Flaw {
  static label = 'doubt';
  static chapter = 2;
  static SWAY = 0.05;
  aimLineScale = 0.6;
  aimOffset(held, t) { return Doubt.SWAY * Math.sin(t * 1.7); }
}
