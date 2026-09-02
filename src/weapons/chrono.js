// Chrono field: a bubble around the tower where time runs slow. Ships and their shots inside crawl, your bullets
// speed up and hit harder the longer they spent inside, and (from `rewindAt`) every ship inside is dragged back to
// where it was `rewindBack` seconds earlier. Damage is a small time-shear dps on everything inside.
import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist } from '../utils.js';
import { onChronoTick } from '../combos/procs.js';

const TUNING = {
  ticks: 12,            // clock ticks drawn on the field rim
  hands: 2,             // slow-turning hands inside the field
  historyMax: 4,        // seconds of position history kept per ship
  rewindTrail: 6,       // trail dots per ship on rewind
};

export class ChronoField extends Weapon {
  constructor(...a) {
    super(...a);
    this.rewindCd = this.def.rewindEvery;
    this.phase = 0;
    this.pulseT = 0;
  }
  get range() { return this.def.range + this.def.rangePerLevel * (this.level - 1); }
  rangeAt(level) { return this.def.range + this.def.rangePerLevel * (level - 1); }
  /** time ratio inside the field at a level (lower = slower) */
  ratioAt(level) { return Math.max(this.def.ratioMin, this.def.ratio - this.def.ratioPerLevel * (level - 1)); }
  get ratio() { return this.ratioAt(this.level); }
  get canRewind() { return this.level >= this.def.rewindAt; }
  get dps() { return this.dmg; }
  text(level, dmg) {
    const parts = [`time <b>×${this.ratioAt(level).toFixed(2)}</b>`, `radius <b>${this.rangeAt(level)}</b>`];
    if (level >= this.def.rewindAt) parts.push('rewind'); else if (level === this.level) parts.push(`Lv ${this.def.rewindAt}: +rewind`);
    return formatStats({ dmg, dmgUnit: 'dps', extra: parts });
  }
  statLine() { return this.text(this.level, this.dmg); }
  nextLine() { return this.text(this.level + 1, this.statsAt(this.level + 1).dmg); }

  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; return; }
    const sc = this.scene, t = this.tower, R = this.range, ratio = this.ratio;
    this.angle += dt * 0.3;
    this.phase += dt;
    this.pulseT = Math.max(0, this.pulseT - dt);
    this.target = null;
    let inside = 0;
    for (const m of mobs) {
      if (m.dead) continue;
      const d = dist(t, m);
      if (d > R + m.r) { m.history = null; continue; }
      inside++;
      m.slow = Math.min(m.slow, ratio);
      // time-shear damage
      m.lastHit = this.type;
      m.takeDamage(this.dmgVs(m) * dt, m.x, m.y, true);
      sc.addDmg(this.type, m.lastDealt ?? 0);
      if (this.canRewind) {
        if (!m.history) m.history = [];
        m.history.push([sc.state.time, m.x, m.y]);
        while (m.history.length && m.history[0][0] < sc.state.time - TUNING.historyMax) m.history.shift();
      }
    }
    // enemy shots crawl inside the field
    for (const b of sc.enemyBullets) b.chrono = dist(t, b) <= R ? ratio : 1;
    // your bullets bank time inside the field; the hit multiplier is applied in projectiles.js
    for (const b of sc.bullets) if (dist(t, b) <= R) b.chronoT = (b.chronoT || 0) + dt;
    if (inside) onChronoTick(this, dt);
    if (this.canRewind && inside) {
      this.rewindCd -= dt * this.effectiveRateMul;
      if (this.rewindCd <= 0) { this.rewind(mobs); this.rewindCd = this.def.rewindEvery; }
    }
  }

  /** every ship inside jumps back to where it was rewindBack seconds ago */
  rewind(mobs) {
    const sc = this.scene, t = this.tower, R = this.range, back = sc.state.time - this.def.rewindBack;
    let n = 0;
    for (const m of mobs) {
      if (m.dead || !m.history || dist(t, m) > R + m.r) continue;
      const h = m.history.find(e => e[0] >= back) || m.history[0];
      if (!h) continue;
      for (let i = 0; i < TUNING.rewindTrail; i++) { const k = i / TUNING.rewindTrail; sc.fx.trailAt(m.x + (h[1] - m.x) * k, m.y + (h[2] - m.y) * k, this.color); }
      m.x = h[1]; m.y = h[2]; m.dodgeVx = 0; m.dodgeVy = 0; m.history = null;
      n++;
    }
    if (!n) return;
    this.pulseT = 0.5;
    sc.fx.ripple(t.x, t.y, this.color, R, t.shieldR);
    sc.fx.flash(t.x, t.y, this.color, 2);
    sc.fx.floater(t.x, t.y - R - 12, 'REWIND', '#e0f2fe', 16);
    sc.sfx.play('rewind', null, t.x);
    sc.stats.procs.rewind = (sc.stats.procs.rewind || 0) + 1;
  }

  /** chrono damage bonus for a bullet that spent `t` seconds inside */
  bulletMul(t) { return 1 + this.def.boostPerSec * Math.min(t, this.def.boostMax); }

  draw(g) {
    const t = this.tower, R = this.range, p = this.phase;
    const k = 0.6 + 0.4 * Math.sin(p * 2);
    g.fillStyle(this.color, 0.03 + 0.02 * k); g.fillCircle(t.x, t.y, R);
    g.lineStyle(1.5 + 3 * this.pulseT, this.color, 0.35 + 0.5 * this.pulseT); g.strokeCircle(t.x, t.y, R);
    for (let i = 0; i < TUNING.ticks; i++) {
      const a = i * Math.PI * 2 / TUNING.ticks - p * 0.15;
      g.lineStyle(1, COLORS.white, 0.35);
      g.lineBetween(t.x + Math.cos(a) * (R - 6), t.y + Math.sin(a) * (R - 6), t.x + Math.cos(a) * R, t.y + Math.sin(a) * R);
    }
    for (let i = 0; i < TUNING.hands; i++) {
      const a = -p * (0.4 + i * 0.9), len = R * (0.55 - i * 0.2);
      g.lineStyle(1, this.color, 0.25); g.lineBetween(t.x, t.y, t.x + Math.cos(a) * len, t.y + Math.sin(a) * len);
    }
    if (this.canRewind) {
      const f = 1 - this.rewindCd / this.def.rewindEvery;
      g.lineStyle(3, COLORS.white, 0.4); g.beginPath(); g.arc(t.x, t.y, R + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false); g.strokePath();
    }
  }
}
