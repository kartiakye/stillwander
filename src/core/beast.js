// Beasts of the old age: great animals that are part flesh and part land.
// Moss, bark, stone and ice have grown over them for centuries. Arrows break
// those parts away; a beast is never killed, only calmed, and a calmed beast
// gives the archer its gift.
import { Character, HitResult } from './character.js';
import { Frozen } from './effects.js';

export const Mood = Object.freeze({ CALM: 'calm', WARY: 'wary', ALERT: 'alert', CALMED: 'calmed' });

// How hard each blessing bites each material. A missing entry counts as 1.
export const MATERIAL = {
  moss:  { fire: 2.5, frost: 0.5 },
  bark:  { fire: 2.5, thunder: 0.5 },
  stone: { thunder: 2, fire: 0.3 },
  ice:   { fire: 3, frost: 0.2 },
  hide:  { thunder: 1.5 },
};
export const bite = (material, label) => (label && MATERIAL[material] && MATERIAL[material][label]) || 1;

// One breakable piece of a beast, placed relative to its body:
// `at` is [forward, left] in tiles, `y` its height above the ground.
export class Part {
  constructor(def) {
    Object.assign(this, { name: 'part', material: 'hide', hp: 2, at: [0, 0], y: 1, radius: 0.4, key: false }, def);
    this.maxHp = this.hp;
    this.broken = false;
  }
  position(beast) {
    const c = Math.cos(beast.facing), s = Math.sin(beast.facing), [f, l] = this.at;
    return [beast.x + c * f - s * l, beast.z + s * f + c * l];
  }
  wear(amount) {               // returns true if this broke it
    if (this.broken || amount <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) { this.broken = true; return true; }
    return false;
  }
  regrow() { this.hp = this.maxHp; this.broken = false; }
}

export class Beast extends Character {
  static label = 'beast';
  static gift = null;          // what the archer receives when it is calmed
  static parts = [];           // Part definitions
  static radius = 1.2;
  static maxHp = 99;
  static maxPosture = 999;
  static gentle = true;        // the body takes no harm; only its parts wear
  // senses
  static sight = 16;           // how far it sees the archer in the open
  static sightHidden = 5;      // ... and when the archer hides in tall grass
  static cone = 1.2;           // radians either side of its facing
  static hearing = 6;          // how far it hears footsteps
  static notice = 0.45;        // alarm per second while it senses the archer
  static settle = 0.12;        // alarm shed per second when it does not
  static partAlarm = 0.45;     // alarm from an arrow on a part
  static bodyAlarm = 0.7;      // ... and on the body
  static sootheTime = 14;      // seconds a hum keeps it settled
  // movement
  static speed = 0.8;          // grazing pace
  static fleeSpeed = 6.5;
  static fleeTime = 6;
  static herdCall = 22;        // an alerted beast spooks its herd within this
  static rideSpeed = 2.2;      // multiplies the archer's pace when ridden
  static range = 10;           // how far it grazes from home
  // fierce beasts do not run: they charge, strike, and must be calmed mid-fight
  static fierce = false;
  static chargeSpeed = 4.2;
  static reach = 2.2;          // distance at which it starts a blow
  static strikeReach = 2.9;    // distance at which the blow still lands
  static windup = 0.8;
  static recover = 1.4;
  static strikeDamage = 1;
  static turn = 5;             // radians per second it turns to face its foe
  static leash = 34;           // how far from home it will give chase
  static dormant = false;      // true: it sleeps until the game wakes it

  constructor(x = 0, z = 0, herd = null) {
    super(x, z);
    const C = this.constructor;
    this.parts = C.parts.map(d => new Part(d));
    this.mood = Mood.CALM;
    this.alarm = 0;
    this.soothed = 0;          // > 0 while a hum keeps it settled
    this.home = [x, z];
    this.herd = herd;          // beasts that spook together share a herd tag
    this.goal = null;          // where it is grazing towards
    this.rest = 0;             // seconds it stands still before moving on
    this.fleeing = 0;
    this.following = false;    // a calmed beast walking to the archer
    this.rider = null;
    this.pending = [];         // events gathered between updates
    this.act = 'chase';        // a fierce beast's step in the fight: chase, windup, recover
    this.timer = 0;
    this.dormant = C.dormant;
  }

  get hostile() { return this.alive && this.mood !== Mood.CALMED && !this.dormant; }
  get calmed() { return this.mood === Mood.CALMED; }
  get keyParts() { return this.parts.filter(p => p.key); }

  // ---- being struck
  partAt(x, z, pad) {
    let best = null, bd = Infinity;
    for (const p of this.parts) {
      if (p.broken) continue;
      const [px, pz] = p.position(this), d = Math.hypot(px - x, pz - z);
      if (d <= p.radius + pad && d < bd) { bd = d; best = p; }
    }
    return best;
  }
  receiveArrow(arrow) {
    const res = new HitResult();
    if (!this.hostile) { res.blocked = true; return res; }
    const label = arrow.blessing ? arrow.blessing.label : null;
    const part = this.partAt(arrow.x, arrow.z, arrow.constructor.HIT_RADIUS);
    res.part = part;
    if (part) {
      res.damage = arrow.damage * bite(part.material, label);
      if (this.has(Frozen) && arrow.shatters) res.damage = part.hp;   // a full draw shatters what frost has seized
      if (part.wear(res.damage)) { res.partBroken = true; this.pending.push(['partBroken', part]); }
      this.startle(this.constructor.partAlarm);
    } else {
      if (!this.constructor.gentle) { res.damage = arrow.damage * 0.5; super.takeDamage(res.damage); }
      this.startle(this.constructor.bodyAlarm);
    }
    this.checkCalmed();
    return res;
  }
  // Burning, thunder and the like wear away the softest part that is left.
  takeDamage(amount) {
    if (!this.constructor.gentle) return super.takeDamage(amount);
    const left = this.parts.filter(p => !p.broken).sort((a, b) => a.hp - b.hp);
    if (left.length && left[0].wear(amount)) { this.pending.push(['partBroken', left[0]]); this.checkCalmed(); }
    return false;
  }
  checkCalmed() {
    if (this.calmed) return;
    if (!this.constructor.fierce && (this.mood === Mood.ALERT || this.alarm >= 1)) return;   // too frightened to settle
    if (this.keyParts.length && this.keyParts.every(p => p.broken)) this.becomeCalmed();
  }
  becomeCalmed() {
    this.mood = Mood.CALMED;
    this.alarm = 0;
    this.fleeing = 0;
    this.pending.push(['calmed']);
  }

  // ---- alarm and soothing
  startle(amount) {
    if (this.calmed) return;
    this.alarm = Math.min(1, this.alarm + amount * (this.soothed > 0 ? 0.35 : 1));
  }
  soothe() {
    if (this.calmed) return;
    this.soothed = this.constructor.sootheTime;
    this.alarm *= 0.3;
    if (this.mood === Mood.ALERT) this.fleeing = Math.min(this.fleeing, 1);
    this.pending.push(['soothed']);
  }
  senses(world) {               // can it tell the archer is there?
    const a = world.archer, C = this.constructor, d = this.distanceTo(a);
    if (!a.alive) return false;
    if (world.archerMoving && !world.archerHidden && d <= C.hearing) return true;
    const off = Math.abs(Math.atan2(Math.sin(this.angleTo(a.x, a.z) - this.facing), Math.cos(this.angleTo(a.x, a.z) - this.facing)));
    return off <= C.cone && d <= (world.archerHidden ? C.sightHidden : C.sight);
  }
  setMood(mood, world) {
    if (this.mood === mood) return;
    this.mood = mood;
    world.emit('mood', this, mood);
  }
  spook(world) {
    const C = this.constructor;
    this.alarm = 1;
    this.fleeing = C.fleeTime;
    this.setMood(Mood.ALERT, world);
    for (const b of world.beasts) {
      if (b === this || b.herd !== this.herd || !b.hostile || b.mood === Mood.ALERT) continue;
      if (this.distanceTo(b) <= C.herdCall) { b.alarm = 1; b.fleeing = C.fleeTime; b.setMood(Mood.ALERT, world); }
    }
  }

  // ---- time
  update(dt, world) {
    for (const [kind, ...data] of this.pending) world.emit(kind, this, ...data);
    this.pending = [];
    super.update(dt, world);
    if (!this.alive || this.rider || this.dormant) return;
    if (this.calmed) { this.idle(dt, world); return; }
    if (!this.canAct) return;
    const C = this.constructor;
    this.soothed = Math.max(0, this.soothed - dt);
    const sensed = this.senses(world);
    if (this.mood !== Mood.ALERT) {
      if (sensed) this.alarm = Math.min(1, this.alarm + C.notice * (this.soothed > 0 ? 0.25 : 1) * dt);
      else this.alarm = Math.max(0, this.alarm - C.settle * dt);
      if (this.alarm >= 1) this.spook(world);
      else this.setMood(this.alarm >= 0.4 ? Mood.WARY : Mood.CALM, world);
    }
    if (this.mood === Mood.ALERT) { if (C.fierce) this.fight(dt, world); else this.flee(dt, world); }
    else if (this.mood === Mood.WARY) this.face(world.archer.x, world.archer.z);
    else this.graze(dt, world);
  }

  flee(dt, world) {
    const a = world.archer, C = this.constructor;
    this.fleeing -= dt;
    const ang = this.angleTo(a.x, a.z) + Math.PI;
    this.turnTowards(ang, dt * 6);
    this.walk(C.fleeSpeed * dt, world);
    if (this.fleeing <= 0) {
      this.alarm = 0.5;
      for (const p of this.keyParts) if (p.broken) { p.regrow(); world.emit('regrow', this, p); }
      this.home = [this.x, this.z];
      this.setMood(Mood.WARY, world);
    }
  }

  fight(dt, world) {
    const a = world.archer, C = this.constructor, d = this.distanceTo(a);
    const fromHome = Math.hypot(this.x - this.home[0], this.z - this.home[1]);
    if (!a.alive || fromHome > C.leash) {          // it loses interest and walks home
      this.alarm = 0; this.act = 'chase'; this.goal = [this.home[0], this.home[1]]; this.rest = 0;
      this.setMood(Mood.CALM, world);
      return;
    }
    if (this.act === 'chase') {
      this.turnTowards(this.angleTo(a.x, a.z), dt * C.turn);
      if (d <= C.reach) { this.act = 'windup'; this.timer = C.windup; world.emit('windup', this); }
      else if (C.chargeSpeed > 0) this.walk(C.chargeSpeed * this.effects.reduce((s, e) => s * e.speedScale, 1) * dt, world);
    } else if (this.act === 'windup') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const landed = d <= C.strikeReach && a.takeStrike(C.strikeDamage);
        world.emit('strike', this, landed);
        this.act = 'recover'; this.timer = C.recover;
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.act = 'chase';
    }
  }

  graze(dt, world) {
    const C = this.constructor;
    if (this.rest > 0) { this.rest -= dt; return; }
    if (!this.goal) {
      const r = world.random() * C.range, t = world.random() * Math.PI * 2;
      this.goal = [this.home[0] + Math.cos(t) * r, this.home[1] + Math.sin(t) * r];
    }
    const [gx, gz] = this.goal;
    if (Math.hypot(gx - this.x, gz - this.z) < 0.6) { this.goal = null; this.rest = 3 + world.random() * 6; return; }
    this.turnTowards(this.angleTo(gx, gz), dt * 1.5);
    if (!this.walk(this.moveSpeed * dt, world)) { this.goal = null; this.rest = 1; }
  }

  idle(dt, world) {             // a calmed beast grazes where it was left, or comes when called
    const a = world.archer;
    if (this.following) {
      const d = this.distanceTo(a);
      if (d < 2.6) { this.following = false; world.emit('arrived', this); return; }
      this.turnTowards(this.angleTo(a.x, a.z), dt * 4);
      this.walk(Math.min(this.constructor.fleeSpeed * 0.7, d) * dt, world);
      return;
    }
    this.home = [this.x, this.z];
    if (this.constructor.speed > 0) this.graze(dt, world);
  }

  turnTowards(ang, step) {
    const diff = Math.atan2(Math.sin(ang - this.facing), Math.cos(ang - this.facing));
    this.facing += Math.max(-step, Math.min(step, diff));
  }
  walk(d, world) {              // returns false when it could not move
    const ox = this.x, oz = this.z;
    world.move(this, Math.cos(this.facing) * d, Math.sin(this.facing) * d);
    return Math.hypot(this.x - ox, this.z - oz) > d * 0.3;
  }
}

// Pampas Plain. A grass meadow grows on its back; moss has crept over its eyes.
// Hum to settle it, then free its eyes, and it will carry you.
export class MossbackOx extends Beast {
  static label = 'Mossback Ox';
  static gift = 'ride';
  static radius = 1.25;
  static parts = [
    { name: 'left eye moss', material: 'moss', hp: 1, at: [1.32, 0.3], y: 1.45, radius: 0.34, key: true },
    { name: 'right eye moss', material: 'moss', hp: 1, at: [1.32, -0.3], y: 1.45, radius: 0.34, key: true },
  ];
}

// Golden Wood. Dead gold leaves weigh down its antlers. It is the shyest beast
// on the island: it sees far and runs fast. Shake the leaves loose.
export class GinkgoStag extends Beast {
  static label = 'Ginkgo Stag';
  static gift = 'leaf';
  static radius = 0.95;
  static sight = 21;
  static hearing = 9;
  static fleeSpeed = 8.5;
  static speed = 1.0;
  static parts = [
    { name: 'left antler leaves', material: 'bark', hp: 2.5, at: [0.95, 0.42], y: 2.6, radius: 0.4, key: true, onHead: true },
    { name: 'right antler leaves', material: 'bark', hp: 2.5, at: [0.95, -0.42], y: 2.6, radius: 0.4, key: true, onHead: true },
  ];
}

// Bamboo Hollow. Cane has grown round it like armour. It charges whoever it hears.
export class HollowBoar extends Beast {
  static label = 'Hollow Boar';
  static gift = 'tusk';
  static fierce = true;
  static radius = 1.15;
  static sight = 13;
  static hearing = 8;
  static chargeSpeed = 5.4;
  static windup = 0.55;
  static recover = 1.7;
  static range = 7;
  static parts = [
    { name: 'brow cane', material: 'bark', hp: 3, at: [1.05, 0], y: 1.25, radius: 0.42, key: true },
    { name: 'left flank cane', material: 'bark', hp: 3, at: [0, 0.72], y: 1.1, radius: 0.5, key: true },
    { name: 'right flank cane', material: 'bark', hp: 3, at: [0, -0.72], y: 1.1, radius: 0.5, key: true },
  ];
}

// Snow Crest. It wears a shell of ice. Frost seizes the shell; a full draw shatters it.
export class FrostmaneBear extends Beast {
  static label = 'Frostmane Bear';
  static gift = 'fur';
  static fierce = true;
  static radius = 1.6;
  static sight = 12;
  static hearing = 6;
  static chargeSpeed = 3.0;
  static reach = 2.7;
  static strikeReach = 3.4;
  static windup = 1.0;
  static recover = 1.8;
  static strikeDamage = 2;
  static range = 6;
  static parts = [
    { name: 'ice on its back', material: 'ice', hp: 5, at: [-0.3, 0], y: 2.5, radius: 0.7, key: true },
    { name: 'ice on its left shoulder', material: 'ice', hp: 4, at: [0.85, 0.85], y: 1.9, radius: 0.55, key: true },
    { name: 'ice on its right shoulder', material: 'ice', hp: 4, at: [0.85, -0.85], y: 1.9, radius: 0.55, key: true },
  ];
}

// Heron Marsh. A toad the size of a boat, crowned with reeds. Its hide is always wet.
export class ReedToad extends Beast {
  static label = 'Reed Toad';
  static gift = 'sinew';
  static fierce = true;
  static radius = 1.7;
  static sight = 11;
  static cone = 1.6;
  static hearing = 7;
  static chargeSpeed = 2.4;
  static reach = 4.2;            // its tongue
  static strikeReach = 5;
  static windup = 0.9;
  static recover = 2.2;
  static speed = 0.4;
  static range = 4;
  static parts = [
    { name: 'left reed crown', material: 'moss', hp: 3.5, at: [-0.2, 0.9], y: 1.9, radius: 0.55, key: true },
    { name: 'right reed crown', material: 'moss', hp: 3.5, at: [-0.2, -0.9], y: 1.9, radius: 0.55, key: true },
    { name: 'throat', material: 'hide', hp: 5, at: [1.25, 0], y: 0.8, radius: 0.55, key: true },
  ];
}

// Crimson Vale. Cranes whose wings are red maple leaves. They scatter at a breath.
export class MapleCrane extends Beast {
  static label = 'Maple Crane';
  static gift = 'feather';
  static radius = 0.55;
  static sight = 18;
  static hearing = 8;
  static fleeSpeed = 10;
  static fleeTime = 4;
  static speed = 0.9;
  static range = 7;
  static parts = [
    { name: 'leaf wings', material: 'bark', hp: 2, at: [0, 0], y: 1.4, radius: 0.5, key: true },
  ];
}

// Blossom Field. It sleeps under Petal Pond until every shrine is awake.
// It does not leave the water; it sends waves at whoever stands on the shore.
export class ElderCarp extends Beast {
  static label = 'Elder Carp';
  static gift = 'scale';
  static fierce = true;
  static dormant = true;
  static radius = 3.2;
  static sight = 16;
  static cone = 4;               // it sees all round
  static hearing = 16;
  static speed = 0;
  static chargeSpeed = 0;
  static reach = 13;             // its waves cross the pond
  static strikeReach = 13;
  static windup = 1.5;
  static recover = 2.6;
  static leash = 999;
  static turn = 0.3;             // it turns slowly: circle the pond, or curve an arrow, to reach its far side
  static parts = [
    { name: 'scale', material: 'stone', hp: 4, at: [1.9, 1.05], y: 1.2, radius: 0.6, key: true },
    { name: 'scale', material: 'stone', hp: 4, at: [1.9, -1.05], y: 1.2, radius: 0.6, key: true },
    { name: 'scale', material: 'stone', hp: 4, at: [0, 1.4], y: 1.4, radius: 0.6, key: true },
    { name: 'scale', material: 'stone', hp: 4, at: [0, -1.4], y: 1.4, radius: 0.6, key: true },
    { name: 'scale', material: 'stone', hp: 4, at: [-1.9, 1.0], y: 1.2, radius: 0.6, key: true },
    { name: 'scale', material: 'stone', hp: 4, at: [-1.9, -1.0], y: 1.2, radius: 0.6, key: true },
  ];
  // Its wave can be stepped through (Shift), and it quickens as its scales fall.
  fight(dt, world) {
    const broken = this.parts.filter(p => p.broken).length;
    if (this.act === 'recover') this.timer -= dt * (broken >= 4 ? 0.8 : broken >= 2 ? 0.35 : 0);
    super.fight(dt, world);
  }
}

export const BEASTS = { MossbackOx, GinkgoStag, HollowBoar, FrostmaneBear, ReedToad, MapleCrane, ElderCarp };
