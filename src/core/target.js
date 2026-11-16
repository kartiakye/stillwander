// Target: a straw figure on a post. It never moves and never fights back.
import { Character } from './character.js';

export class Target extends Character {
  static maxHp = 3;
  static maxPosture = 4;
  static speed = 0;
  static radius = 0.5;
}
