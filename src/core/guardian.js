// Guardians: the one great Hollow that ends each chapter.
// For a guardian, a finishing blow wounds instead of killing.
import { HollowArcher, Sentry } from './hollow.js';

// Chapter One. Nothing gets through its front, not even fire. The only way in
// is an arrow bent around to its back, which is what the Wind blessing is for.
export class Drillmaster extends Sentry {
  static isGuardian = true;
  static chapter = 1;
  static maxHp = 20;
  static maxPosture = 12;
  static speed = 2.2;
  static radius = 0.7;
  static reach = 1.8;
  static strikeReach = 2.3;
  static windup = 0.75;
  static recover = 1.5;
  static strikeDamage = 2;
  static finishDamage = 8;
  static guardArc = 100 * Math.PI / 180;
  blocks(arrow) {
    if (this.isOpen || !this.canAct) return false;
    return this.frontal(arrow) > Math.cos(Drillmaster.guardArc);
  }
}

// Chapter Two. It never misses in a straight line, and no straight arrow
// reaches it: it shoots them out of the air. Only a curved arrow lands.
export class CertainArcher extends HollowArcher {
  static isGuardian = true;
  static chapter = 2;
  static maxHp = 16;
  static maxPosture = 10;
  static speed = 2.8;
  static sight = 24;
  static near = 9;
  static far = 15;
  static drawTime = 0.9;
  static rest = 1.8;
  static arrowPower = 0.45;
  static finishDamage = 6;
  static CURVE = 0.35;   // radians an arrow must have turned to count as curved
  blocks(arrow) {
    if (this.isOpen || !this.canAim) return false;
    return arrow.turned < CertainArcher.CURVE;
  }
}
