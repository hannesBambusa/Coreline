// Replicator swarm: nanite bolts infect a ship. Infected ships take damage over time and, when they die, the
// nanites jump to the nearest ships (more jumps at `jumpsAt` levels), stronger each generation. From `outbreakAt`
// a dying host also bursts for area damage. Weak against a lone boss, brutal against packs.
import { Weapon, formatStats } from './base.js';
import { dist, minBy } from '../utils.js';
import { onNaniteShot } from '../combos/procs.js';

const TUNING = {
  sparkRate: 3,          // sparks per second on an infected ship
  bulletLife: 0.2,       // extra seconds of flight beyond range / speed
  maxGen: 8,             // generation multiplier stops growing here
  outbreakMul: 4,        // burst on death = infection dps × this
  outbreakRadius: 90,
};

export class ReplicatorSwarm extends Weapon {
  constructor(...a) {
    super(...a);
    this.hosts = new Set();     // infected ships, alive or just died
  }
  get jumps() { return 1 + this.def.jumpsAt.filter(l => this.level >= l).length; }
  jumpsAt(level) { return 1 + this.def.jumpsAt.filter(l => level >= l).length; }
  get outbreak() { return this.level >= this.def.outbreakAt; }
  text(level, dmg) {
    const j = this.jumpsAt(level), parts = [`<b>${j}</b> jump${j === 1 ? '' : 's'} per death`, `+${Math.round((this.def.genMul - 1) * 100)}% per generation`];
    if (level >= this.def.outbreakAt) parts.push('outbreak'); else if (level === this.level) parts.push(`Lv ${this.def.outbreakAt}: +outbreak`);
    return formatStats({ dmg, dmgUnit: 'dps infection', extra: parts });
  }
  statLine() { return this.text(this.level, this.dmg); }
  nextLine() { return this.text(this.level + 1, this.statsAt(this.level + 1).dmg); }
  // healthy ships in the densest pack first
  selectFrom(list) {
    const healthy = list.filter(m => !m.infect), pool = healthy.length ? healthy : list, R = this.def.packRadius;
    let best = null, bestN = -1;
    for (const m of pool) { let n = 0; for (const o of pool) if (dist(m, o) < R) n++; if (n > bestN) { bestN = n; best = m; } }
    return best;
  }
  fire(target) {
    const m = this.muzzle(), a = Math.atan2(target.y - m.y, target.x - m.x), sc = this.scene;
    sc.spawnBullet({
      x: m.x, y: m.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed,
      dmg: this.dmg, weapon: this, color: this.color, life: this.range / this.def.speed + TUNING.bulletLife, target,
      onHit: (mob) => this.infect(mob, 0),
    });
    sc.fx.flash(m.x, m.y, this.color, 0.6);
    onNaniteShot(this);
    // Culture well: a gravity well seeds every ship it holds
    const well = sc.wells[0];
    if (well && sc.combos.roll('culture')) {
      for (const o of sc.mobs) if (!o.dead && dist(well, o) <= well.r) this.infect(o, 1);
      sc.fx.ripple(well.x, well.y, this.color, 10, well.r);
    }
  }
  infect(m, gen) {
    if (m.dead) return;
    const dps = this.dmg * Math.pow(this.def.genMul, Math.min(gen, TUNING.maxGen)) * (this.prefers(m) ? this.def.bonus : 1);
    if (m.infect && m.infect.dps >= dps) { m.infect.left = this.def.dur; return; }
    m.infect = { dps, gen, left: this.def.dur };
    this.hosts.add(m);
    this.scene.fx.ripple(m.x, m.y, this.color, m.r, m.r + 14);
  }
  /** nanites leave a dying host for the nearest healthy ships */
  spread(m) {
    const sc = this.scene, gen = m.infect.gen + 1;
    if (this.outbreak) sc.damageRadius(m.x, m.y, TUNING.outbreakRadius, m.infect.dps * TUNING.outbreakMul, this.color, this);
    const pool = sc.mobs.filter(o => !o.dead && o !== m && !o.infect && dist(m, o) <= this.def.jumpRange);
    for (let i = 0; i < this.jumps && pool.length; i++) {
      const o = minBy(pool, x => dist(m, x));
      pool.splice(pool.indexOf(o), 1);
      sc.fx.bolt(m.x, m.y, o.x, o.y, this.color);
      this.infect(o, gen);
    }
    sc.fx.explode(m.x, m.y, this.color, 10);
    sc.stats.procs.replicate = (sc.stats.procs.replicate || 0) + 1;
  }
  update(dt, mobs) {
    super.update(dt, mobs);
    const sc = this.scene;
    for (const m of this.hosts) {
      const inf = m.infect;
      if (!inf) { this.hosts.delete(m); continue; }
      if (m.dead) { this.spread(m); m.infect = null; this.hosts.delete(m); continue; }
      inf.left -= dt;
      if (inf.left <= 0) { m.infect = null; this.hosts.delete(m); continue; }
      m.lastHit = this.type;
      m.takeDamage(inf.dps * dt, m.x, m.y, true);
      sc.addDmg(this.type, m.lastDealt ?? 0);
      if (Math.random() < dt * TUNING.sparkRate) sc.fx.spark(m.x + (Math.random() - 0.5) * m.r, m.y + (Math.random() - 0.5) * m.r, this.color, 1);
    }
  }
  draw(g) {
    for (const m of this.hosts) {
      if (m.dead || !m.infect) continue;
      const k = 0.5 + 0.5 * Math.sin(this.scene.time.now / 120 + m.x);
      g.lineStyle(1.5, this.color, 0.35 + 0.4 * k); g.strokeCircle(m.x, m.y, m.r + 3);
    }
  }
}
