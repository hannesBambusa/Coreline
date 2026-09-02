// Singularity core: charges from the scrap your kills bring in (plus a trickle), then detonates once: every ship in
// range loses a share of its max HP (bosses capped), every enemy shot in range is erased. From `afterglowAt` the
// blast leaves a zone where all your hits crit. Build-around: the other slots feed it.
import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist } from '../utils.js';

const TUNING = {
  bossTypes: ['boss', 'warlord', 'titan', 'warden'],
  orbSpin: 3,
  ringEase: 0.2, ringFade: 0.05,
  eventHorizon: { life: 4, pull: 140, slow: 0.4 },   // Event horizon combo: a tower-sized well after the blast
  supernovaMul: 3,                                    // Supernova combo: tesla-coloured arcs to every ship for tesla dmg × this
};

export class SingularityCore extends Weapon {
  constructor(...a) {
    super(...a);
    this.charge = 0;      // 0..1
    this.orb = 0;
    this.ring = null;
    this.afterglowT = 0;
  }
  /** percent of max hp removed by a blast */
  get pct() { return Math.min(this.def.pctMax, this.def.dmg * this.dmgGrowth(this.level) * this.mods.dmg * this.wm.dmg * this.lm.dmg * this.lw.dmg); }
  pctAt(level) { return Math.min(this.def.pctMax, this.def.dmg * this.dmgGrowth(level) * this.mods.dmg * this.wm.dmg); }
  /** scrap needed for a full charge; falls with level via rate */
  get need() { return this.def.need / (this.rateGrowth(this.level) * this.mods.rate * this.wm.rate * this.lm.rate * this.lw.rate); }
  needAt(level) { return this.def.need / (this.rateGrowth(level) * this.mods.rate * this.wm.rate); }
  get hasAfterglow() { return this.level >= this.def.afterglowAt; }
  get dps() { return 0; }
  text(level, pct, need) {
    const parts = [`blast <b>${Math.round(pct * 100)}%</b> max HP`, `charge <b>${Math.round(need)}</b> scrap`];
    if (level >= this.def.afterglowAt) parts.push('afterglow'); else if (level === this.level) parts.push(`Lv ${this.def.afterglowAt}: +afterglow`);
    return formatStats({ extra: parts });
  }
  statLine() { return this.text(this.level, this.pct, this.need); }
  nextLine() { return this.text(this.level + 1, this.pctAt(this.level + 1), this.needAt(this.level + 1)); }

  /** called by the scene for every scrap payout */
  onScrap(amount) { this.charge = Math.min(1, this.charge + amount / this.need); }

  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; return; }
    this.orb += dt * TUNING.orbSpin * (0.5 + this.charge);
    this.angle += dt * 0.5;
    this.afterglowT = Math.max(0, this.afterglowT - dt);
    this.charge = Math.min(1, this.charge + dt * this.def.trickle / this.need * this.effectiveRateMul);
    this.target = null;
    if (this.charge >= 1 && this.inRange(mobs).length) this.fire(null, mobs);
  }
  fire(_, mobs) {
    const sc = this.scene, t = this.tower, R = this.range, pct = this.pct;
    this.charge = 0;
    for (const m of mobs) {
      if (m.dead || dist(t, m) > R + m.r) continue;
      const boss = TUNING.bossTypes.includes(m.type);
      const dmg = m.hpMax * (boss ? Math.min(pct, this.def.bossPct) : pct);
      sc.hit(m, this, m.x, m.y, { dmg, color: '#f5d0fe', size: 16 });
    }
    sc.enemyBullets = sc.enemyBullets.filter(b => dist(t, b) > R);
    if (this.hasAfterglow) { this.afterglowT = this.def.afterglowDur; sc.afterglow = this.def.afterglowDur; }
    this.ring = { r: t.shieldR, r1: R, a: 1 };
    sc.fx.ripple(t.x, t.y, this.color, t.shieldR, R);
    sc.fx.ripple(t.x, t.y, COLORS.white, t.shieldR, R * 0.7);
    sc.fx.explode(t.x, t.y, this.color, 50);
    sc.fx.flash(t.x, t.y, COLORS.white, 4);
    sc.flashScreen(0.3, this.color);
    sc.fx.shake(0.012, 400);
    sc.sfx.play('singularity', null, t.x);
    this.eventHorizon(); this.supernova(mobs);
  }
  // Event horizon: the blast collapses into a tower-sized well
  eventHorizon() {
    const sc = this.scene, t = this.tower, E = TUNING.eventHorizon;
    const gw = t.weapons.find(w => w.type === 'gravity');
    if (!gw || !sc.combos.roll('horizon')) return;
    sc.wells.push({ x: t.x, y: t.y, age: 0, spin: 0, r: this.range, life: E.life, pull: E.pull, slow: E.slow, dps: gw.dmg, weapon: gw, color: COLORS.violet });
  }
  // Supernova: tesla arcs to every ship in range
  supernova(mobs) {
    const sc = this.scene, t = this.tower, tesla = t.weapons.find(w => w.type === 'tesla');
    if (!tesla || !sc.combos.roll('supernova')) return;
    for (const m of mobs) {
      if (m.dead || dist(t, m) > this.range + m.r) continue;
      sc.fx.bolt(t.x, t.y, m.x, m.y, tesla.color);
      sc.hit(m, tesla, m.x, m.y, { mul: TUNING.supernovaMul, color: '#9be7ff' });
    }
  }
  draw(g) {
    const t = this.tower, m = this.mount(), c = this.charge;
    // charging orb at the mount
    const r = 4 + 10 * c, k = 0.6 + 0.4 * Math.sin(this.orb * 2);
    g.fillStyle(this.color, 0.25 + 0.4 * c); g.fillCircle(m.x, m.y, r);
    g.lineStyle(1.5, COLORS.white, 0.4 + 0.5 * c * k); g.strokeCircle(m.x, m.y, r + 2);
    for (let i = 0; i < 3; i++) {
      const a = this.orb + i * Math.PI * 2 / 3, rr = r + 6 + 4 * c;
      g.fillStyle(this.color, 0.7); g.fillCircle(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr, 1.5 + c);
    }
    // charge arc around the tower
    g.lineStyle(3, this.color, 0.5); g.beginPath(); g.arc(t.x, t.y, t.shieldR + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c, false); g.strokePath();
    if (c >= 1) { g.lineStyle(2, COLORS.white, 0.6 * k); g.strokeCircle(t.x, t.y, t.shieldR + 8); }
    if (this.afterglowT > 0) {
      const f = this.afterglowT / this.def.afterglowDur;
      g.fillStyle(this.color, 0.05 * f); g.fillCircle(t.x, t.y, this.range);
      g.lineStyle(2, COLORS.white, 0.3 * f); g.strokeCircle(t.x, t.y, this.range);
    }
    if (this.ring) {
      const rg = this.ring;
      rg.r += (rg.r1 - rg.r) * TUNING.ringEase; rg.a -= TUNING.ringFade;
      if (rg.a <= 0) this.ring = null;
      else { g.lineStyle(16 * rg.a, this.color, 0.3 * rg.a); g.strokeCircle(t.x, t.y, rg.r); g.lineStyle(3, COLORS.white, 0.7 * rg.a); g.strokeCircle(t.x, t.y, rg.r); }
    }
  }
}
