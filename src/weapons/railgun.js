import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo, maxBy } from '../utils.js';
import { onRailShot } from '../combos/procs.js';

const TUNING = {
  hitPad: 6,                              // px beyond a mob's radius the beam still counts as a hit
  lance: { mul: 1.5, kick: 520 },         // Lance combo (with a shock emitter): damage mul, knockback velocity along the beam
  ionlance: { reach: 140, dmgMul: 0.6 },  // Ion lance combo: arcs into ships within reach of the beam line
  // Buster combo (with a missile pod): a fan of heavy missiles after a hit
  buster: { count: 3, spread: 0.5, launch: 220, speedMul: 1.4, turnMul: 2, dmgMul: 1.2, life: 3 },
  overloadDur: 10,                        // Overload combo: seconds the laser stays supercharged
  beam: { width: 4, alpha: 0.25 }, glow: { width: 10, alpha: 0.12 }, lanceLine: { width: 18, alpha: 0.3 },
  flash: 1.2, shake: { amount: 0.0008, ms: 60 },
};

export class Railgun extends Weapon {
  constructor(...a) { super(...a); this.shots = 0; }
  get splash() { return this.def.splash + this.def.splashPerLevel * (this.level - 1); }
  /** the next shot is the heavy slug */
  get heavyNext() { return (this.shots + 1) % this.def.heavyEvery === 0; }
  statLine() { return formatStats({ dmg: this.dmg, rate: this.rate, extra: [`crater <b>${this.splash}</b> px`, `heavy slug every <b>${this.def.heavyEvery}th</b> (×${this.def.heavyMul})`], dps: this.dps }); }
  nextLine() { const s = this.statsAt(this.level + 1); return formatStats({ dmg: s.dmg, rate: s.rate, extra: `crater <b>${this.splash + this.def.splashPerLevel}</b> px`, dps: s.dps }); }
  // toughest: most hp plus shield
  selectFrom(list) { return maxBy(list, m => m.hp + (m.shield || 0)); }
  fire(target, mobs) {
    const m = this.muzzle(), sc = this.scene;
    const a = angleTo(m, target);
    const ex = m.x + Math.cos(a) * this.range, ey = m.y + Math.sin(a) * this.range;
    const line = new Phaser.Geom.Line(m.x, m.y, ex, ey);
    const nearestOnLine = (mob) => Phaser.Geom.Line.GetNearestPoint(line, mob, new Phaser.Geom.Point());
    let hits = 0;
    const heavy = this.heavyNext; this.shots++;
    const lance = this.tower.weapons.some(w => w.type === 'shock') && sc.combos.roll('lance');
    const lanceMul = (lance ? TUNING.lance.mul : 1) * (heavy ? this.def.heavyMul : 1);
    let first = null, firstP = null, firstD = Infinity;
    for (const mob of mobs) {
      if (mob.dead) continue;
      const p = nearestOnLine(mob);
      if (dist(p, mob) <= mob.r + TUNING.hitPad && dist(m, mob) <= this.range) {
        sc.hit(mob, this, p.x, p.y, { color: heavy ? '#ffd166' : this.prefers(mob) ? '#ffe66d' : '#ffffff', size: heavy ? 18 : 14, mul: lanceMul });
        if (lance) { mob.dodgeVx += Math.cos(a) * TUNING.lance.kick; mob.dodgeVy += Math.sin(a) * TUNING.lance.kick; }
        hits++;
        const dd = dist(m, mob); if (dd < firstD) { firstD = dd; first = mob; firstP = p; }
      }
    }
    // crater where the slug first lands: splash around the nearest ship on the line (the ship itself already took the hit)
    if (first) {
      const r = this.splash * (heavy ? this.def.heavySplashMul : 1);
      const crater = this.dmg * this.def.splashFrac * (heavy ? this.def.heavyMul : 1);
      for (const o of mobs) {
        if (o.dead || o === first || dist(o, firstP) > r + o.r) continue;
        sc.hit(o, this, o.x, o.y, { dmg: crater * (this.prefers(o) ? this.def.bonus : 1), color: '#ffb86b', size: 12 });
      }
      sc.fx.ripple(firstP.x, firstP.y, heavy ? 0xffd166 : this.color, 8, r);
      sc.fx.explode(firstP.x, firstP.y, heavy ? 0xffd166 : this.color, heavy ? 26 : 12);
      if (heavy) { sc.fx.shake(0.004, 140); sc.sfx.play('explode', 12, firstP.x); }
    }
    if (hits && sc.combos.roll('ionlance')) {
      for (const mob of mobs) {
        if (mob.dead) continue;
        const p = nearestOnLine(mob);
        const dd = dist(p, mob);
        if (dd > mob.r + TUNING.hitPad && dd <= TUNING.ionlance.reach && dist(m, mob) <= this.range) {
          sc.fx.bolt(p.x, p.y, mob.x, mob.y, COLORS.ice);
          sc.hit(mob, this, mob.x, mob.y, { dmg: this.dmg * TUNING.ionlance.dmgMul, color: '#9be7ff', size: 13 });
        }
      }
    }
    if (lance) sc.fx.line(m.x, m.y, ex, ey, COLORS.green, TUNING.lanceLine.width, TUNING.lanceLine.alpha);
    const pod = this.tower.weapons.find(w => w.type === 'missile');
    if (pod && hits && sc.combos.roll('buster')) {
      const B = TUNING.buster;
      for (let i = 0; i < B.count; i++) {
        const b = a + (i - (B.count - 1) / 2) * B.spread;
        sc.spawnMissile({
          x: m.x, y: m.y, vx: Math.cos(b) * B.launch, vy: Math.sin(b) * B.launch,
          speed: pod.def.speed * B.speedMul, turn: pod.def.turn * B.turnMul, dmg: pod.dmg * B.dmgMul, weapon: pod,
          splash: pod.def.splash, color: COLORS.orange, life: B.life, target,
        });
      }
    }
    const laser = this.tower.weapons.find(w => w.type === 'laser');
    if (laser && laser.target === target && sc.combos.roll('overload')) {
      laser.overload = sc.combos.dur(TUNING.overloadDur);
      laser.held = laser.def.rampTime;
    }
    onRailShot(this, target, mobs, a, m);
    sc.fx.line(m.x, m.y, ex, ey, heavy ? 0xffd166 : this.color, TUNING.beam.width * (heavy ? 2 : 1), TUNING.beam.alpha);
    sc.fx.line(m.x, m.y, ex, ey, heavy ? 0xffd166 : COLORS.cyan, TUNING.glow.width * (heavy ? 1.6 : 1), TUNING.glow.alpha);
    sc.fx.flash(m.x, m.y, this.color, TUNING.flash);
    sc.fx.shake(TUNING.shake.amount, TUNING.shake.ms);
  }
}
