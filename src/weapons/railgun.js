import { Weapon } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo, maxBy } from '../utils.js';

const TUNING = {
  hitPad: 6,                              // px beyond a mob's radius the beam still counts as a hit
  lance: { mul: 1.5, kick: 520 },         // Lance combo (with a shock emitter): damage mul, knockback velocity along the beam
  ionlance: { reach: 140, dmgMul: 0.6 },  // Ion lance combo: arcs into ships within reach of the beam line
  // Buster combo (with a missile pod): a fan of heavy missiles after a hit
  buster: { count: 3, spread: 0.5, launch: 220, speedMul: 1.4, turnMul: 2, dmgMul: 1.2, life: 3 },
  overloadDur: 3,                         // Overload combo: seconds the laser stays supercharged
  beam: { width: 4, alpha: 0.25 }, glow: { width: 10, alpha: 0.12 }, lanceLine: { width: 18, alpha: 0.3 },
  flash: 1.2, shake: { amount: 0.0008, ms: 60 },
};

export class Railgun extends Weapon {
  // toughest: most hp plus shield
  selectFrom(list) { return maxBy(list, m => m.hp + (m.shield || 0)); }
  fire(target, mobs) {
    const m = this.muzzle(), sc = this.scene;
    const a = angleTo(m, target);
    const ex = m.x + Math.cos(a) * this.range, ey = m.y + Math.sin(a) * this.range;
    const line = new Phaser.Geom.Line(m.x, m.y, ex, ey);
    const nearestOnLine = (mob) => Phaser.Geom.Line.GetNearestPoint(line, mob, new Phaser.Geom.Point());
    let hits = 0;
    const lance = this.tower.weapons.some(w => w.type === 'shock') && sc.combos.roll('lance');
    const lanceMul = lance ? TUNING.lance.mul : 1;
    for (const mob of mobs) {
      if (mob.dead) continue;
      const p = nearestOnLine(mob);
      if (dist(p, mob) <= mob.r + TUNING.hitPad && dist(m, mob) <= this.range) {
        sc.hit(mob, this, p.x, p.y, { color: this.prefers(mob) ? '#ffe66d' : '#ffffff', size: 14, mul: lanceMul });
        if (lance) { mob.dodgeVx += Math.cos(a) * TUNING.lance.kick; mob.dodgeVy += Math.sin(a) * TUNING.lance.kick; }
        hits++;
      }
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
      laser.overload = TUNING.overloadDur;
      laser.held = laser.def.rampTime;
    }
    sc.fx.line(m.x, m.y, ex, ey, this.color, TUNING.beam.width, TUNING.beam.alpha);
    sc.fx.line(m.x, m.y, ex, ey, COLORS.cyan, TUNING.glow.width, TUNING.glow.alpha);
    sc.fx.flash(m.x, m.y, this.color, TUNING.flash);
    sc.fx.shake(TUNING.shake.amount, TUNING.shake.ms);
  }
}
