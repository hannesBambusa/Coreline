// Beam drones: the drone bay with short lasers. Each drone holds a continuous beam on its target while in fireRange;
// from `splitAt` levels the beam forks to the nearest other ships within splitRange (up to five targets).
import { DroneBay } from './drones.js';
import { formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, targetable } from '../utils.js';
import { onBeamTick } from '../combos/procs.js';

const TUNING = {
  sparkRate: 6,          // sparks per second on a beamed ship
  prismSplit: 1, prismMul: 1.5,   // Prism combo: extra fork and damage while active
};

export class BeamDrones extends DroneBay {
  constructor(...a) {
    super(...a);
    this.prismT = 0;      // seconds left of the Prism combo
  }
  splitsAt(level) { return this.def.splitAt.filter(l => level >= l).length; }
  get splits() { return this.splitsAt(this.level) + (this.prismT > 0 ? TUNING.prismSplit : 0); }
  get beamMul() { return this.prismT > 0 ? TUNING.prismMul : 1; }
  statLine() {
    const n = 1 + this.splitsAt(this.level);
    return formatStats({ prefix: `<b>${this.droneCount}</b> drones`, dmg: this.dmg, dmgUnit: 'dps each', extra: [`<b>${n}</b> target${n > 1 ? 's' : ''} per beam`, `<b>${Math.round(this.droneHp)}</b> hp`] });
  }
  nextLine() {
    const s = this.statsAt(this.level + 1), n = 1 + this.splitsAt(this.level + 1);
    const cnt = Math.min(this.def.maxDrones, this.def.drones + Math.floor(this.level / this.def.dronePerLevels) + (this.wm.extra || 0));
    return formatStats({ prefix: `<b>${cnt}</b> drones`, dmg: s.dmg, dmgUnit: 'dps each', extra: [`<b>${n}</b> target${n > 1 ? 's' : ''} per beam`, `<b>${Math.round(this.droneHp * this.def.droneHpMul)}</b> hp`] });
  }
  update(dt, mobs) {
    this.prismT = Math.max(0, this.prismT - dt);
    super.update(dt, mobs);
  }
  /** continuous beam on the target plus forks to nearby ships; `d.beams` holds this frame's targets for drawing */
  fireFrom(d, dt, rm, mobs) {
    d.beams = [];
    const t = d.target;
    if (!t || t.dead || dist(d, t) > this.def.fireRange) return;
    const sc = this.scene, mul = this.beamMul * rm;
    this.beam(t, this.dmgVs(t) * mul * dt);
    d.beams.push(t);
    const n = this.splits;
    if (n > 0) {
      const extra = mobs.filter(o => targetable(o) && o !== t && dist(o, t) <= this.def.splitRange).sort((p, q) => dist(t, p) - dist(t, q)).slice(0, n);
      for (const o of extra) { this.beam(o, this.dmgVs(o) * this.def.splitDmg * mul * dt); d.beams.push(o); }
    }
    if (Math.random() < dt * TUNING.sparkRate) sc.fx.spark(t.x, t.y, this.color, 1);
    if (Math.random() < dt) onBeamTick(this, d, t);
  }
  beam(m, amount) {
    m.lastHit = this.type;
    m.takeDamage(amount, m.x, m.y, true);
    this.scene.addDmg(this.type, m.lastDealt ?? 0);
  }
  draw(g) {
    super.draw(g);
    const k = 0.7 + 0.3 * Math.sin(this.scene.time.now / 40);
    for (const d of this.drones) {
      if (!d.alive || !d.beams) continue;
      d.beams.forEach((m, i) => {
        if (m.dead) return;
        const from = i === 0 ? d : d.beams[0];
        g.lineStyle(i === 0 ? 3 : 2, this.color, (i === 0 ? 0.25 : 0.15) * k); g.lineBetween(from.x, from.y, m.x, m.y);
        g.lineStyle(i === 0 ? 1.2 : 0.8, COLORS.white, i === 0 ? 0.9 : 0.6); g.lineBetween(from.x, from.y, m.x, m.y);
      });
    }
  }
}
