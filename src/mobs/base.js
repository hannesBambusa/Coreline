import { MOBS, SPAWN } from '../config.js';
import { TAU, distXY, angleTo, randomSign } from '../utils.js';
import { createMob } from './index.js';
import { makeElite, eliteTick, drawElite, spawnSplit } from './elite.js';

/** sideways kick applied when a mob dodges a shot (px/s) */
export const DODGE_IMPULSE = 320;
/** per-second decay factor for dodge / launch impulses: v *= DRIFT_DECAY^dt */
const DRIFT_DECAY = 0.02;
/** tint while stunned */
const STUN_TINT = 0x9be7ff;

/**
 * Orbit options for a shooter: keep `base + rnd*span` of the mob's range and pick a random orbit direction.
 * Use as the 6th constructor argument: super(scene, type, tier, x, y, orbitOpts(type, 0.9)).
 */
export function orbitOpts(type, base, span = 0) {
  const frac = span ? base + Math.random() * span : base;
  return { preferred: MOBS[type].range * frac, orbitDir: randomSign() };
}

export class Mob {
  /**
   * opts (optional): { preferred, orbitDir } - the standoff distance and orbit direction used by
   * approachAndOrbit(). Mobs that do not orbit simply leave these undefined.
   */
  constructor(scene, type, tier, x, y, opts = {}) {
    this.scene = scene; this.type = type; this.def = MOBS[type];
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = this.def.r;
    const diff = scene.diff;
    this.hpMax = this.def.hp * Math.pow(SPAWN.hpGrowth, tier - 1) * diff.hp; this.hp = this.hpMax;
    this.dmg = this.def.dmg * Math.pow(SPAWN.dmgGrowth, tier - 1) * diff.dmg;
    this.scrap = Math.max(1, Math.round(this.def.scrap * Math.pow(SPAWN.scrapGrowth, tier - 1)));
    this.dead = false;
    this.hitFlash = 0;
    this.dodgeVx = 0; this.dodgeVy = 0;
    this.slow = 1;
    this.stun = 0;
    this.elite = null;
    this.baseAlpha = 1;
    if (opts.preferred !== undefined) this.preferred = opts.preferred;
    if (opts.orbitDir !== undefined) this.orbitDir = opts.orbitDir;
    this.sprite = scene.add.image(x, y, 'ship_' + type).setTint(this.def.color).setDepth(5);
    this.glow = scene.add.image(x, y, 'glow').setTint(this.def.color)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(this.r / 22).setAlpha(0.5).setDepth(2);
  }

  // ---- elite affixes (see elite.js) ----
  makeElite(mod) { makeElite(this, mod); }
  eliteTick(dt) { eliteTick(this, dt); }
  drawElite(g) { drawElite(this, g); }

  get speedMul() { return this._speedMul || 1; }
  set speedMul(v) { this._speedMul = v; }
  get tower() { return this.scene.tower; }
  distToTower() { return distXY(this.x, this.y, this.tower.x, this.tower.y); }
  angleToTower() { return angleTo(this, this.tower); }

  // ---- shared helpers ----

  /** distance from the core centre at which this mob touches the shield (when up) or the hull */
  coreReach() {
    return this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r;
  }

  /** crash into the core: deal contact damage, run any impact fx, then remove self (not a kill) */
  ramCore(onImpact) {
    this.tower.takeDamage(this.dmg, this.x, this.y);
    if (onImpact) onImpact();
    this.die(false);
  }

  /** count `cd` down; when it expires reset it to 1/rate and return true */
  tickCooldown(dt, rate) {
    this.cd -= dt;
    if (this.cd > 0) return false;
    this.cd = 1 / rate;
    return true;
  }

  /** same as tickCooldown for an arbitrary timer field, reset to a fixed period */
  tickTimer(key, dt, period) {
    this[key] -= dt;
    if (this[key] > 0) return false;
    this[key] = period;
    return true;
  }

  /** per-tier drain amount for this frame: base * dmgGrowth^(tier-1) * dt */
  tierDrain(base, dt) {
    return base * Math.pow(SPAWN.dmgGrowth, this.scene.tier - 1) * this.scene.diff.dmg * dt;
  }

  /**
   * Fly toward `this.preferred`, then circle at that distance (direction `this.orbitDir`).
   *   gap      dead band around preferred before approaching / backing off
   *   tangent  orbit speed as a fraction of speed
   *   backoff  radial retreat speed fraction when closer than preferred - gap (0 = never back off)
   *   speed    overrides def.speed (e.g. enraged multiplier)
   */
  approachAndOrbit(dt, { gap = 20, tangent = 0.5, backoff = 0.5, speed = this.def.speed } = {}) {
    const d = this.distToTower(), a = this.angleToTower(), s = speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + gap) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else {
      const t = a + Math.PI / 2 * this.orbitDir;
      const radial = (d < this.preferred - gap) ? -s * backoff : 0;
      ax = Math.cos(t) * s * tangent + Math.cos(a) * radial;
      ay = Math.sin(t) * s * tangent + Math.sin(a) * radial;
    }
    this.move(dt, ax, ay);
  }

  /**
   * Spawn an enemy bullet along `angle`.
   * opts: { x, y (origin, default own centre), speed (default def.bulletSpeed), dmg (default this.dmg), color (default def.color) }
   */
  fireAt(angle, { x = this.x, y = this.y, speed = this.def.bulletSpeed, dmg = this.dmg, color = this.def.color } = {}) {
    this.scene.spawnEnemyBullet({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      dmg, color,
    });
  }

  /** fan of `count` bullets centred on `angle`, `spread` radians apart */
  fireBurst(angle, count, spread) {
    for (let i = 0; i < count; i++) {
      const sp = (i - (count - 1) / 2) * spread;
      this.fireAt(angle + sp);
    }
  }

  /**
   * Spawn a mob of `type` next to this one and push it into the scene.
   *   impulse       launch speed (px/s) applied as a dodge impulse, 0 for none
   *   angle         direction of the offset from this mob (default random)
   *   offset        distance of the spawn point from this mob's centre (default own radius)
   *   impulseAngle  direction of the launch impulse (default: same as angle)
   *   gen           generation passed through to createMob (hydra)
   * Returns the new mob.
   */
  spawnChild(type, impulse = 0, { angle = Math.random() * TAU, offset = this.r, impulseAngle = angle, gen } = {}) {
    const m = createMob(this.scene, type, this.scene.tier, this.x + Math.cos(angle) * offset, this.y + Math.sin(angle) * offset, gen);
    if (impulse) { m.dodgeVx = Math.cos(impulseAngle) * impulse; m.dodgeVy = Math.sin(impulseAngle) * impulse; }
    this.scene.mobs.push(m);
    return m;
  }

  // ---- damage / death ----

  takeDamage(amount, hx, hy, quiet = false) {
    if (this.dead) { this.lastDealt = 0; return false; }
    this.lastDealt = Math.min(amount, Math.max(0, this.hp));   // what actually came off the hp bar
    this.hp -= amount;
    if (!quiet) { this.hitFlash = 0.08; this.scene.fx.spark(hx, hy, this.def.color, 3); }
    if (this.hp <= 0) { this.die(true); return true; }
    return false;
  }

  tryDodge() {
    const chance = (this.def.dodge || 0) + (this.eliteDef && this.eliteDef.dodge || 0);
    if (!chance || Math.random() > chance || this.stun > 0) return false;
    // sidestep perpendicular to the core, random side
    const a = this.angleToTower() + randomSign() * Math.PI / 2;
    this.dodgeVx = Math.cos(a) * DODGE_IMPULSE; this.dodgeVy = Math.sin(a) * DODGE_IMPULSE;
    this.scene.fx.floater(this.x, this.y - 14, 'dodge', '#ff9f43', 11);
    return true;
  }

  die(killed) {
    this.dead = true;
    this.scene.fx.explode(this.x, this.y, this.def.color, killed ? 18 : 10);
    if (killed) this.scene.onKill(this);
    if (killed && this.elite === 'splitter') spawnSplit(this);
    this.sprite.destroy(); this.glow.destroy();
  }

  // ---- movement / per-frame ----

  move(dt, ax, ay) {
    const k = this.slow * this.speedMul * (this.scene.levelMods ? this.scene.levelMods.mobSpeed : 1) * this.scene.diff.speed;
    this.vx = ax * k + this.dodgeVx; this.vy = ay * k + this.dodgeVy;
    this.slow = 1;
    this.dodgeVx *= Math.pow(DRIFT_DECAY, dt); this.dodgeVy *= Math.pow(DRIFT_DECAY, dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
  }

  update(dt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    const tint = this.hitFlash > 0 ? 0xffffff : this.stun > 0 ? STUN_TINT : this.def.color;
    this.sprite.setPosition(this.x, this.y).setTint(tint);
    this.glow.setPosition(this.x, this.y);
    if (this.elite) this.eliteTick(dt);
  }

  // called by the scene while stunned: drift only
  stunned(dt) {
    this.stun -= dt;
    this.dodgeVx *= Math.pow(DRIFT_DECAY, dt); this.dodgeVy *= Math.pow(DRIFT_DECAY, dt);
    this.x += this.dodgeVx * dt; this.y += this.dodgeVy * dt;
    this.vx = 0; this.vy = 0;
    // ~10 sparks per second somewhere on the hull
    if (Math.random() < dt * 10) {
      const sx = this.x + (Math.random() - 0.5) * this.r * 2, sy = this.y + (Math.random() - 0.5) * this.r * 2;
      this.scene.fx.spark(sx, sy, STUN_TINT, 1);
    }
    Mob.prototype.update.call(this, dt);
  }
}
