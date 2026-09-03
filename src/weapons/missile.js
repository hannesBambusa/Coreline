import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, maxBy } from '../utils.js';
import { onMissileLaunch } from '../combos/procs.js';

const TUNING = {
  launchSpeedMul: 0.5,   // missiles leave the tube at half speed and accelerate to def.speed
  scatter: 1.2,          // launch angle jitter, radians (centred)
  life: 4,
  flash: 0.5,
  // Escort combo (with a drone bay): every live drone fires a mini-missile at its own target
  escort: { launch: 180, scatter: 0.8, speedMul: 1.3, turnMul: 1.6, dmgMul: 0.6, splashMul: 0.6, life: 3, flash: 0.6 },
};

/** member of list with the most list members (itself included) within radius */
export function densest(list, radius) {
  return maxBy(list, m => list.filter(o => dist(m, o) < radius).length);
}

export class MissilePod extends Weapon {
  selectFrom(list) { return densest(list, this.def.splash); }
  /** missiles per shot: 1, then one more at each salvoAt level */
  salvoAt(level) { return 1 + this.def.salvoAt.filter(l => level >= l).length; }
  get salvo() { return this.salvoAt(this.level); }
  statLine() { const n = this.salvo; return formatStats({ prefix: n > 1 ? `<b>${n}</b> missiles` : undefined, dmg: this.dmg, dmgUnit: 'each', rate: this.rate, dps: this.dps * n, extra: `splash <b>${Math.round(this.def.splash * this.wm.splash)}</b>` }); }
  nextLine() { const s = this.statsAt(this.level + 1), n = this.salvoAt(this.level + 1); return formatStats({ prefix: n > 1 ? `<b>${n}</b> missiles` : undefined, dmg: s.dmg, dmgUnit: 'each', rate: s.rate, dps: s.dps * n }); }
  fire(target) {
    const m = this.muzzle(), sc = this.scene, n = this.salvo;
    // a salvo spreads over the nearest other ships in range so the pod does not dump everything on one cluster
    const others = n > 1 ? sc.mobs.filter(o => !o.dead && o !== target && dist(this.tower, o) <= this.range + o.r).sort((p, q) => dist(target, p) - dist(target, q)) : [];
    for (let i = 0; i < n; i++) {
      const tg = i === 0 ? target : (others[(i - 1) % Math.max(1, others.length)] || target);
      const a = this.angle + (Math.random() - 0.5) * TUNING.scatter + (i - (n - 1) / 2) * 0.35;
      const v0 = this.def.speed * TUNING.launchSpeedMul;
      const missile = {
        x: m.x, y: m.y, vx: Math.cos(a) * v0, vy: Math.sin(a) * v0,
        speed: this.def.speed, turn: this.def.turn, dmg: this.dmg, weapon: this, splash: this.def.splash * this.wm.splash * (this.lm.missileSplash || 1),
        color: this.color, life: TUNING.life, target: tg,
      };
      onMissileLaunch(this, missile);
      sc.spawnMissile(missile);
    }
    sc.fx.flash(m.x, m.y, this.color, TUNING.flash);
    const bay = this.tower.weapons.find(w => w.type === 'drones');
    if (bay && bay.drones.some(d => d.alive && d.target && !d.target.dead) && sc.combos.roll('escort')) {
      const E = TUNING.escort;
      for (const d of bay.drones) {
        if (!d.alive) continue;
        const tg = d.target && !d.target.dead ? d.target : target;
        const ba = Math.atan2(d.vy, d.vx) + (Math.random() - 0.5) * E.scatter;
        sc.spawnMissile({
          x: d.x, y: d.y, vx: Math.cos(ba) * E.launch, vy: Math.sin(ba) * E.launch,
          speed: this.def.speed * E.speedMul, turn: this.def.turn * E.turnMul, dmg: this.dmg * E.dmgMul, weapon: this,
          splash: this.def.splash * E.splashMul, color: COLORS.sky, life: E.life, target: tg,
        });
        sc.fx.flash(d.x, d.y, COLORS.sky, E.flash);
      }
      sc.sfx.shot('missile', this.tower.x);
    }
  }
}
