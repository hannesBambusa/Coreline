import { Weapon, formatStats, isEscort } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo, maxBy, nearest, targetable, TAU } from '../utils.js';

const TUNING = {
  size: 7,                          // drone collision radius
  spawnRing: 80,                    // fresh drones appear this far from the core
  orbit: 70, orbitSpin: 2.5,        // hold this far off the target and circle it, rad/s
  idleOffset: 40, idleSpin: 1.2,    // no target: circle this far outside the shield ring, rad/s
  mirrorClearance: 34,              // idle orbit sits this far outside the mirror plates when mirrors are mounted
  steer: 4,                         // velocity blend rate towards the wanted heading
  boostMul: 2,                      // speed and fire-rate multiplier while Scramble boost is active
  ramTypes: ['swarm', 'shoal', 'drone', 'bomber'],   // ships that die on contact with a drone
  ramFraction: 0.6,                 // ramming ships deal this fraction of their dmg to the drone; bombers deal it all
  bomberBlast: 24,
  trailRate: 20,                    // trail particles per second
  boltLife: 0.4,                    // seconds a drone bolt lives
  hitPad: 4,                        // enemy bullet counts as a hit within drone radius + this
  respawnFlash: 0.8,
};

/** true for any weapon that fields drones (drone bay, beam drones) */
export const isBay = (w) => !!(w && Array.isArray(w.drones));

export class DroneBay extends Weapon {
  constructor(...a) {
    super(...a);
    this.drones = [];
    this.focus = false;    // all drones share one target
    this.boost = 0;        // seconds left of the Scramble boost
    this.shared = null;    // the shared target while focus is on
    this.sync();
  }
  get droneCount() {
    return Math.min(this.def.maxDrones, this.def.drones + Math.floor((this.level - 1) / this.def.dronePerLevels) + (this.wm.extra || 0));
  }
  get droneHp() { return this.def.droneHp * Math.pow(this.def.droneHpMul, this.level - 1); }
  get respawn() { return this.def.respawn; }
  statLine() {
    return formatStats({
      prefix: `<b>${this.droneCount}</b> drones`, dmg: this.dmg, rate: this.rate, rateUnit: '/s each',
      extra: `<b>${Math.round(this.droneHp)}</b> hp`,
    });
  }
  nextLine() {
    const n = this.statsAt(this.level + 1);
    const cnt = Math.min(this.def.maxDrones, this.def.drones + Math.floor(this.level / this.def.dronePerLevels) + (this.wm.extra || 0));
    return formatStats({
      prefix: `<b>${cnt}</b> drones`, dmg: n.dmg, rate: n.rate,
      extra: `<b>${Math.round(this.droneHp * this.def.droneHpMul)}</b> hp`,
    });
  }
  /** match the drone list to droneCount: spawn missing ones on a ring, drop extras */
  sync() {
    while (this.drones.length < this.droneCount) {
      const a = Math.random() * TAU;
      this.drones.push({
        x: this.tower.x + Math.cos(a) * TUNING.spawnRing, y: this.tower.y + Math.sin(a) * TUNING.spawnRing,
        vx: 0, vy: 0, hp: this.droneHp, alive: true, respawnT: 0, cd: Math.random(), ang: a, target: null, r: TUNING.size,
      });
    }
    if (this.drones.length > this.droneCount) this.drones.length = this.droneCount;
  }
  update(dt, mobs) {
    this.sync();
    if (this.jammed > 0) { this.jammed -= dt; return; }
    this.boost = Math.max(0, this.boost - dt);
    const bm = this.boost > 0 ? TUNING.boostMul : 1;
    const t = this.tower, sc = this.scene, rm = this.effectiveRateMul * bm;
    // longest reach of every other gun: ships beyond it are the drones' first priority
    const gunRange = Math.max(0, ...t.weapons.filter(w => w !== this).map(w => w.range));
    // how many live drones hold each live target. Updated as drones re-pick below, so later drones
    // in the loop see earlier picks (spread mode avoids targets another drone already has).
    const taken = new Map();
    const claim = (m, n) => { if (m && !m.dead) taken.set(m, (taken.get(m) || 0) + n); };
    for (const o of this.drones) if (o.alive) claim(o.target, 1);
    const isTaken = (m) => (taken.get(m) || 0) > 0;
    const inReach = (m) => dist(t, m) <= this.range;

    for (const d of this.drones) {
      if (!d.alive) {
        d.respawnT -= dt;
        if (d.respawnT <= 0) {
          d.alive = true; d.hp = this.droneHp; d.x = t.x; d.y = t.y;
          sc.fx.flash(t.x, t.y, this.color, TUNING.respawnFlash);
          claim(d.target, 1);   // back in the pool, its old target counts as held again
        }
        continue;
      }
      this.pickTarget_(d, mobs, gunRange, isTaken, inReach, claim);
      this.steer(d, dt, bm);
      // ramming: light ships die on contact and chip the drone
      for (const m of mobs) {
        if (m.dead || !TUNING.ramTypes.includes(m.type)) continue;
        if (dist(d, m) < d.r + m.r) {
          this.hurt(d, m.dmg * (m.type === 'bomber' ? 1 : TUNING.ramFraction));
          if (m.type === 'bomber') sc.fx.explode(m.x, m.y, m.def.color, TUNING.bomberBlast);
          m.die(false);
          break;
        }
      }
      if (!d.alive) claim(d.target, -1);   // lost to a ram: its target is free for the others
      if (Math.random() < dt * TUNING.trailRate) sc.fx.trailAt(d.x - d.vx * 0.03, d.y - d.vy * 0.03, this.color);
      this.fireFrom(d, dt, rm, mobs);
    }
  }
  /** one drone's weapon for this frame: a bolt when its cooldown is up and the target is close (beam drones override) */
  fireFrom(d, dt, rm) {
    const sc = this.scene;
    d.cd -= dt * rm;
    if (d.target && d.cd <= 0 && dist(d, d.target) < this.def.fireRange) {
      d.cd = 1 / this.rate;
      const fa = angleTo(d, d.target);
      sc.spawnBullet({
        x: d.x, y: d.y, vx: Math.cos(fa) * this.def.speed, vy: Math.sin(fa) * this.def.speed,
        dmg: this.dmg, weapon: this, color: this.color, life: TUNING.boltLife, target: d.target,
      });
      sc.sfx.shot('pulse', d.x);
    }
  }
  /**
   * Target selection for one drone. Fallback chain:
   *   1. idle drone (no target yet): the ship farthest out that no other gun can reach
   *   2. nearest ship to the drone that no other drone holds (spread mode only)
   *   3. nearest ship to the drone, taken or not
   * A drone whose target just died skips step 1 and keeps working the nearby ships.
   * focus mode: every drone shares one target picked with the same chain, ignoring `taken`.
   */
  pickTarget_(d, mobs, gunRange, isTaken, inReach, claim) {
    const t = this.tower;
    claim(d.target, -1);   // its own target never counts as taken for itself
    const nearestTo = (from, avoid) => nearest(mobs, from.x, from.y, Infinity, m => inReach(m) && !(avoid && isTaken(m)));
    const farOut = (avoid) => maxBy(
      mobs.filter(m => targetable(m) && dist(t, m) > gunRange && inReach(m) && !(avoid && isTaken(m))),
      m => dist(t, m),
    );
    const escort = () => nearest(mobs, d.x, d.y, Infinity, m => inReach(m) && isEscort(m));
    const pick = (avoid, wasEngaged) => escort() || (wasEngaged ? null : farOut(avoid)) || nearestTo(d, avoid) || (avoid ? nearestTo(d, false) : null);
    if (this.focus) {
      const engaged = !!this.shared;
      if (!this.shared || !targetable(this.shared) || !inReach(this.shared) || (!isEscort(this.shared) && escort())) this.shared = pick(false, engaged && this.shared && this.shared.dead);
      d.target = this.shared;
    } else {
      const engaged = !!d.target;
      if (!d.target || !targetable(d.target) || !inReach(d.target) || (!isEscort(d.target) && escort())) d.target = pick(true, engaged && d.target && d.target.dead);
    }
    claim(d.target, 1);
  }
  /** idle orbit radius: outside the shield ring, or outside the mirror plates when mirrors are mounted */
  idleRadius(extra = 0) {
    const t = this.tower, mr = t.weapons.find(w => w.type === 'mirrors');
    return Math.max(t.shieldR + TUNING.idleOffset + extra, mr ? mr.ringR + TUNING.mirrorClearance + extra : 0);
  }
  /** fly towards the orbit point around the target, or idle around the shield ring */
  steer(d, dt, bm) {
    const t = this.tower;
    let tx, ty;
    if (d.target) {
      d.ang += dt * TUNING.orbitSpin;
      tx = d.target.x + Math.cos(d.ang) * TUNING.orbit; ty = d.target.y + Math.sin(d.ang) * TUNING.orbit;
    } else {
      d.ang += dt * TUNING.idleSpin;
      const ir = this.idleRadius();
      tx = t.x + Math.cos(d.ang) * ir; ty = t.y + Math.sin(d.ang) * ir;
    }
    const a = Math.atan2(ty - d.y, tx - d.x), sp = this.def.droneSpeed * bm, k = Math.min(1, dt * TUNING.steer);
    d.vx += (Math.cos(a) * sp - d.vx) * k; d.vy += (Math.sin(a) * sp - d.vy) * k;
    d.x += d.vx * dt; d.y += d.vy * dt;
  }
  hurt(d, dmg) {
    if (!d.alive) return;
    d.hp -= dmg;
    const sc = this.scene;
    sc.fx.spark(d.x, d.y, this.color, 3);
    if (d.hp <= 0) {
      d.alive = false; d.respawnT = this.respawn;
      sc.fx.explode(d.x, d.y, this.color, 14);
      sc.fx.floater(d.x, d.y - 10, 'drone lost', '#60a5fa', 11);
      sc.sfx.play('explode', 6, d.x);
      sc.tx.say('droneLost', 90);
    }
  }
  // enemy bullets can hit drones; scene calls this
  absorb(b) {
    for (const d of this.drones) {
      if (!d.alive) continue;
      if (dist(b, d) < d.r + TUNING.hitPad) { this.hurt(d, b.dmg); return true; }
    }
    return false;
  }
  draw(g) {
    for (const d of this.drones) {
      if (!d.alive) continue;
      const a = Math.atan2(d.vy, d.vx);
      g.fillStyle(this.color, 1);
      g.fillTriangle(
        d.x + Math.cos(a) * 8, d.y + Math.sin(a) * 8,
        d.x + Math.cos(a + 2.4) * 6, d.y + Math.sin(a + 2.4) * 6,
        d.x + Math.cos(a - 2.4) * 6, d.y + Math.sin(a - 2.4) * 6,
      );
      g.fillStyle(COLORS.white, 0.9); g.fillCircle(d.x, d.y, 2);
      if (d.hp < this.droneHp) {
        g.fillStyle(0x000000, 0.5); g.fillRect(d.x - 8, d.y - 12, 16, 2);
        g.fillStyle(this.color, 1); g.fillRect(d.x - 8, d.y - 12, 16 * d.hp / this.droneHp, 2);
      }
    }
    const alive = this.drones.filter(d => d.alive).length;
    if (alive < this.drones.length) { const m = this.mount(); g.lineStyle(1.5, this.color, 0.5); g.strokeCircle(m.x, m.y, 9); }
  }
}
