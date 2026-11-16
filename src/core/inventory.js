// Inventory: what the archer carries, and the one recipe that matters.

export class Inventory {
  static STRAW_PER_ARROW = 4;
  constructor(arrows = 6, straw = 0, wood = 0) { this.arrows = arrows; this.straw = straw; this.wood = wood; }
  add(item, amount = 1) {
    if (!['arrows', 'straw', 'wood'].includes(item)) throw new Error(`unknown item: ${item}`);
    this[item] += amount;
  }
  craftArrows(count = 1) {     // four straws each; returns how many were made
    const made = Math.min(count, Math.floor(this.straw / Inventory.STRAW_PER_ARROW));
    this.straw -= made * Inventory.STRAW_PER_ARROW;
    this.arrows += made;
    return made;
  }
  takeArrow() {
    if (this.arrows <= 0) return false;
    this.arrows -= 1;
    return true;
  }
}
