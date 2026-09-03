import { Weapon, formatStats } from './base.js';
import { CRIT, COLORS } from '../config.js';
import { dist, angleTo, maxBy, TAU } from '../utils.js';
import { onLaserTick } from '../combos/procs.js';

const TUNING = {
  overloadMul: 2.5,        // ramp multiplier while the Overload combo (railgun hit on the laser target) is active
  sweepRecharge: 0.5,      // sweep cooldown refills at half speed while the beam is below full ramp
  paintDur: 3,             // Paint combo (with a drone bay): seconds drones stay pinned to the beam target
  critTick: 0.5,           // the beam rolls for a crit this often
  critBurst: 0.5,          // crit burst = this fraction of a second of beam damage, times (critMul - 1)
  sparkRate: 8,            // sparks per second on the target
  flareDur: 0.25,          // beam flare after a crit tick
  sweepRays: 6,            // trailing rays drawn behind the sweep head
  critColor: 0xffb703, critText: '#ffb703',
};

export class LaserBeam extends Weapon {
  constructor(...a) {
    super(...a);
    this.held = 0;              // seconds on the current target; drives the ramp
    this.lastTarget = null;
    this.overload = 0;          // seconds left of the Overload combo
    this.sweepCd = this.def.sweepEvery;
    this.sweepT = 0;            // seconds left of the sweep animation
    this.forkTargets = [];
    this.flare = 0;             // seconds left of the crit flare
    this.critTimer = 0;
    this.ramp = 1;              // current damage multiplier, read by the scene for the hum
    this.lensT = 0; this.lensWell = null;   // Lensing combo
  }
  get dps() { return this.dmg; }
  get rampTime() { return this.def.rampTime * (this.lm.laserRamp || 1); }
  forksAt(level) { return this.def.forksAt.filter(l => level >= l).length; }
  get forks() { return this.forksAt(this.level); }
  get areaBurst() { return this.level >= this.def.burstAt; }
  /** continuous damage tick, credited to the laser */
  beamDamage(m, amount) { m.lastHit = 'laser'; m.takeDamage(amount, m.x, m.y, true); this.scene.addDmg('laser', m.lastDealt ?? 0); }
  rampText(level = this.level) {
    const f = this.forksAt(level), parts = [`ramps to <b>×${this.def.rampMax}</b>`, `<b>${f}</b> fork${f === 1 ? '' : 's'}`];
    if (level >= this.def.burstAt) parts.push('area crits');
    return parts.join(' · ');
  }
  /** the next level that adds a fork or the area crit, if any */
  nextMilestone() {
    const L = this.level, ms = [...this.def.forksAt.map(l => [l, 'fork']), [this.def.burstAt, 'area crits']].filter(([l]) => l > L).sort((a, b) => a[0] - b[0]);
    return ms.length ? ` · Lv ${ms[0][0]}: +${ms[0][1]}` : '';
  }
  statLine() { return formatStats({ dmg: this.dmg, dmgUnit: 'dps', extra: this.rampText() }) + this.nextMilestone(); }
  nextLine() { return formatStats({ dmg: this.statsAt(this.level + 1).dmg, dmgUnit: 'dps', extra: this.rampText(this.level + 1) }); }
  // farthest from the tower
  selectFrom(list) { return maxBy(list, m => dist(this.tower, m)); }
  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; this.target = null; return; }
    if (!this.target || this.target.dead || dist(this.tower, this.target) > this.range) {
      this.target = this.pickTarget(mobs);
    }
    // new target keeps part of the ramp (all of it while overloaded)
    if (this.target !== this.lastTarget) { this.held = this.overload > 0 ? this.rampTime : this.held * this.def.keepRamp; this.lastTarget = this.target; }
    if (!this.target) return;
    const sc = this.scene, tw = this.tower;
    this.held = Math.min(this.held + dt, this.rampTime);   // capped so the carry-over on a target switch is a real 60 %
    this.overload = Math.max(0, this.overload - dt);
    this.flare = Math.max(0, this.flare - dt);
    this.angle = angleTo(this.mount(), this.target);
    const rampMax = this.def.rampMax + this.wm.rampMax;
    const ramp = (1 + (rampMax - 1) * Math.min(1, this.held / this.rampTime)) * (this.overload > 0 ? TUNING.overloadMul : 1);
    this.ramp = ramp;
    this.beamDamage(this.target, this.dmgVs(this.target) * ramp * dt * this.effectiveRateMul);
    onLaserTick(this, dt, mobs);
    // Target paint: drones pile on the laser target
    const bay = tw.weapons.find(w => w.type === 'drones');
    if (bay && !this.target.marked && sc.combos.roll('paint')) {
      this.target.marked = TUNING.paintDur;
      for (const d of bay.drones) d.target = this.target;
      sc.fx.ripple(this.target.x, this.target.y, COLORS.magenta, this.target.r, this.target.r + 40);
    }
    // from half ramp: fork to the ships nearest the target; at full ramp: charge a ring sweep
    const full = this.held >= this.rampTime;
    this.forkTargets = [];
    if (this.held >= this.rampTime * this.def.forkRamp) {
      // forks only reach ships within forkRange of the beam's target
      const others = mobs.filter(o => !o.dead && o !== this.target && dist(tw, o) <= this.range && dist(this.target, o) <= this.def.forkRange)
        .sort((a, b) => dist(this.target, a) - dist(this.target, b)).slice(0, this.forks);
      for (const o of others) {
        this.beamDamage(o, this.dmgVs(o) * ramp * this.def.forkDmg * dt * this.effectiveRateMul);
        this.forkTargets.push(o);
      }
    }
    if (full) {
      this.sweepCd -= dt;
      if (this.sweepCd <= 0) this.sweep(mobs);
    } else this.sweepCd = Math.min(this.sweepCd + dt * TUNING.sweepRecharge, this.def.sweepEvery);
    if (this.sweepT > 0) this.sweepT -= dt;
    if (Math.random() < dt * TUNING.sparkRate) sc.fx.spark(this.target.x, this.target.y, this.color, 2);
    // crit ticks: twice a second the beam can spike for an extra burst
    this.critTimer += dt;
    if (this.critTimer >= TUNING.critTick) {
      this.critTimer = 0;
      if (Math.random() < (this.def.crit ?? CRIT.chance)) {
        const t = this.target;
        const burst = this.dmg * ramp * TUNING.critBurst * ((this.def.critMul ?? CRIT.mul) - 1);
        // from burstAt the crit tick explodes around the target (damageRadius applies the type bonus per ship)
        // Temporal bloom: inside a chrono field the crit tick echoes three times
        const cf = tw.weapons.find(w => w.type === 'chrono');
        const echoes = cf && dist(tw, t) <= cf.range && sc.combos.roll('bloom') ? 3 : 1;
        for (let e = 0; e < echoes; e++) {
          if (this.areaBurst) sc.damageRadius(t.x, t.y, this.def.burstRadius, burst, TUNING.critColor, this);
          else sc.hit(t, this, t.x, t.y, { dmg: burst * (this.prefers(t) ? this.def.bonus : 1), noCrit: true, color: TUNING.critText, size: 20, tag: '' });
        }
        sc.fx.spark(t.x, t.y, TUNING.critColor, 8);
        sc.fx.ripple(t.x, t.y, TUNING.critColor, t.r, this.areaBurst ? this.def.burstRadius : t.r + 22);
        this.flare = Math.max(this.flare, TUNING.flareDur);
      }
    }
  }
  /** ring sweep: one burst on every ship in range */
  sweep(mobs) {
    const sc = this.scene, tw = this.tower;
    this.sweepCd = this.def.sweepEvery; this.sweepT = this.def.sweepDur;
    const burst = this.dmg * this.def.rampMax * this.def.sweepMul;
    for (const o of mobs) {
      if (o.dead || dist(tw, o) > this.range) continue;
      sc.hit(o, this, o.x, o.y, { dmg: burst * (this.prefers(o) ? this.def.bonus : 1), color: '#ff3df2', size: 14 });
    }
    sc.fx.ripple(tw.x, tw.y, this.color, tw.shieldR, this.range);
    sc.fx.flash(tw.x, tw.y, this.color, 2);
    sc.sfx.play('sweep', null, tw.x);
    sc.stats.procs.sweep = (sc.stats.procs.sweep || 0) + 1;
  }
  draw(g) {
    if (this.sweepT > 0) {
      const k = 1 - this.sweepT / this.def.sweepDur, a = k * TAU, tw = this.tower;
      for (let i = 0; i < TUNING.sweepRays; i++) {
        const aa = a - i * 0.12;
        g.lineStyle(6 - i, this.color, 0.7 - i * 0.1);
        g.lineBetween(tw.x, tw.y, tw.x + Math.cos(aa) * this.range, tw.y + Math.sin(aa) * this.range);
      }
      g.lineStyle(2, COLORS.white, 0.8); g.lineBetween(tw.x, tw.y, tw.x + Math.cos(a) * this.range, tw.y + Math.sin(a) * this.range);
    }
    if (!this.target || this.target.dead) return;
    const m = this.muzzle(10), t = this.target;
    if (this.lensT > 0 && this.lensWell) { g.lineStyle(2, this.color, 0.35); g.strokeCircle(this.lensWell.x, this.lensWell.y, this.lensWell.r); }
    for (const o of this.forkTargets) {
      if (o.dead) continue;
      g.lineStyle(4, this.color, 0.15); g.lineBetween(t.x, t.y, o.x, o.y);
      g.lineStyle(1.5, this.color, 0.7); g.lineBetween(t.x, t.y, o.x, o.y);
    }
    const w = 1.5 + this.ramp * 1.2, pulse = 0.7 + 0.3 * Math.sin(this.scene.time.now / 40);
    if (this.overload > 0) { g.lineStyle(w * 6, COLORS.white, 0.25 * pulse); g.lineBetween(m.x, m.y, t.x, t.y); }
    if (this.flare > 0) { g.lineStyle(w * 8 * this.flare, COLORS.white, 0.5 * this.flare); g.lineBetween(m.x, m.y, t.x, t.y); }
    g.lineStyle(w * 3, this.color, 0.18 * pulse); g.lineBetween(m.x, m.y, t.x, t.y);
    g.lineStyle(w, this.color, 0.9); g.lineBetween(m.x, m.y, t.x, t.y);
    g.lineStyle(w * 0.4, COLORS.white, 1); g.lineBetween(m.x, m.y, t.x, t.y);
  }
}
