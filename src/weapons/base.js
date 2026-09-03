import { WEAPONS, COLORS, LEVELS } from '../config.js';
import { dist, angleTo, minBy, targetable } from '../utils.js';

const NO_LW = { dmg: 1, rate: 1 };
/** boss escorts every weapon goes for first: wardens heal the Dreadnought, pylons shield the Warlord */
export const ESCORTS = ['warden', 'pylon'];
export const isEscort = (m) => ESCORTS.includes(m.type);

const TUNING = {
  turnSpeed: 12,        // turret tracking, rad/s
  jamSparkRate: 10,     // sparks per second while a Dreadnought jam holds the hardpoint
  jamSparkCount: 2,
  muzzleLen: 16,        // default barrel length from the mount point
};

/**
 * One stat line for the upgrade panel. Parts are joined with ' · ' in this order:
 * prefix, dmg, rate, extra..., dps, then suffix appended verbatim.
 * Every field is optional so each weapon can pick the columns it has.
 */
export function formatStats({ prefix, dmg, dmgUnit = 'dmg', rate, rateUnit = '/s', extra, dps, suffix }) {
  const parts = [];
  if (prefix) parts.push(prefix);
  if (dmg !== undefined) parts.push(`<b>${dmg.toFixed(1)}</b> ${dmgUnit}`);
  if (rate !== undefined) parts.push(`<b>${rate.toFixed(2)}</b>${rateUnit}`);
  if (extra) parts.push(...(Array.isArray(extra) ? extra : [extra]).filter(Boolean));
  if (dps !== undefined) parts.push(`<b>${dps.toFixed(1)}</b> dps`);
  const line = parts.join(' · ');
  return suffix ? line + suffix : line;
}

export class Weapon {
  constructor(scene, tower, type, slotIndex) {
    this.scene = scene;
    this.tower = tower;
    this.type = type;
    this.def = WEAPONS[type];
    this.slot = slotIndex;
    this.level = 1;
    this.cd = 0;
    this.angle = 0;
    this.target = null;
    this.jammed = 0;      // seconds left of a Dreadnought jam (weapon fully disabled)
    this.jamSlow = 0;     // fire-rate multiplier while a Jammer holds a lock (0 = none)
  }
  /** overcharge and jammer effects on fire rate */
  get effectiveRateMul() { return this.scene.abilities.rateMul * (this.scene.quads ? this.scene.quads.rateMul : 1) * (this.jamSlow ? this.jamSlow : 1); }
  get mods() { return this.scene.tree.mods; }
  get wm() { return this.mods.w[this.type]; }
  get lm() { return this.scene.levelMods; }
  /** per-level growth: full multiplier up to LEVELS.softCap, a smaller one after */
  static growth(level, mul, softMul) {
    const full = Math.min(level, LEVELS.softCap) - 1, soft = Math.max(0, level - LEVELS.softCap);
    return Math.pow(mul, full) * Math.pow(softMul, soft);
  }
  dmgGrowth(level) { return Weapon.growth(level, this.def.dmgMul, LEVELS.softDmgMul); }
  rateGrowth(level) { return Weapon.growth(level, this.def.rateMul, LEVELS.softRateMul); }
  /** hard level cap for this run, rising with prestige */
  get maxLevel() { return LEVELS.capBase + LEVELS.capPerPrestige * (this.scene.profile ? this.scene.profile.prestige : 0); }
  get atCap() { return this.level >= this.maxLevel; }
  get dmg() {
    const lm = this.lm;
    return this.def.dmg * this.dmgGrowth(this.level) * this.mods.dmg * this.wm.dmg * lm.dmg * this.lw.dmg
      * (Array.isArray(this.drones) ? lm.droneDmg : lm.otherDmg);
  }
  get rate() { return this.def.rate * this.rateGrowth(this.level) * this.mods.rate * this.wm.rate * this.lm.rate * this.lw.rate; }
  /** this level's choice-card mods for this weapon type (old saves may lack the map) */
  get lw() { return (this.lm.w && this.lm.w[this.type]) || NO_LW; }
  get range() { return this.def.range; }
  get dps() { return this.dmg * this.rate; }
  get color() { return this.def.color; }
  upgradeCost() { return Math.floor(this.def.cost * Math.pow(this.def.costGrowth, this.level - 1)); }
  /** dmg/rate/dps at a given level, without the threat-level modifiers */
  statsAt(level) {
    const dmg = this.def.dmg * this.dmgGrowth(level) * this.mods.dmg * this.wm.dmg;
    const rate = this.def.rate * this.rateGrowth(level) * this.mods.rate * this.wm.rate;
    return { dmg, rate, dps: dmg * rate };
  }
  statLine() { return formatStats({ dmg: this.dmg, rate: this.rate, dps: this.dps }); }
  nextLine() { return formatStats(this.statsAt(this.level + 1)); }

  inRange(mobs) { return mobs.filter(m => targetable(m) && dist(this.tower, m) <= this.range); }
  prefers(mob) { return this.def.prefer.includes(mob.type); }
  dmgVs(mob) { return this.dmg * (this.prefers(mob) ? this.def.bonus : 1); }

  // boss escorts first, then preferred mob types, then the weapon's own rule within that pool
  pickTarget(mobs) {
    const list = this.inRange(mobs);
    if (!list.length) return null;
    const esc = list.filter(isEscort);
    if (esc.length) return this.selectFrom(esc);   // escorts first, whatever the weapon's own rule
    const pref = list.filter(m => this.prefers(m));
    return this.selectFrom(pref.length ? pref : list);
  }
  /** an escort inside range that this weapon is not already shooting at */
  escortNear(mobs) { return mobs.some(m => isEscort(m) && targetable(m) && dist(this.tower, m) <= this.range); }
  // default: nearest to the tower
  selectFrom(list) { return minBy(list, m => dist(this.tower, m)); }

  // mount point on tower rim
  mount() {
    const a = this.tower.slotAngle(this.slot);
    return { x: this.tower.x + Math.cos(a) * this.tower.r, y: this.tower.y + Math.sin(a) * this.tower.r };
  }
  muzzle(len = TUNING.muzzleLen) {
    const m = this.mount();
    return { x: m.x + Math.cos(this.angle) * len, y: m.y + Math.sin(this.angle) * len };
  }

  update(dt, mobs) {
    if (this.jammed > 0) {
      this.jammed -= dt;
      this.target = null;
      if (Math.random() < dt * TUNING.jamSparkRate) {
        const m = this.mount();
        this.scene.fx.spark(m.x, m.y, COLORS.red, TUNING.jamSparkCount);
      }
      return;
    }
    this.cd -= dt * this.effectiveRateMul;
    if (!this.target || !targetable(this.target) || dist(this.tower, this.target) > this.range || (!isEscort(this.target) && this.escortNear(mobs))) {
      this.target = this.pickTarget(mobs);
    }
    if (this.target) {
      const want = angleTo(this.mount(), this.target);
      this.angle = Phaser.Math.Angle.RotateTo(this.angle, want, dt * TUNING.turnSpeed);
      if (this.cd <= 0) {
        this.fire(this.target, mobs);
        this.scene.sfx.shot(this.type, this.target.x);
        this.cd = 1 / this.rate;
      }
    }
  }

  fire(target, mobs) {}
  draw(g) {}
}
