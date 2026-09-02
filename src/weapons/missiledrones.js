// Missile drones: the drone bay with small missile pods. Each drone lobs a homing mini-missile at its target when
// its cooldown is up; from `salvoAt` levels a shot is a salvo of several missiles.
import { DroneBay } from './drones.js';
import { formatStats } from './base.js';
import { dist } from '../utils.js';
import { onDroneMissile } from '../combos/procs.js';

const TUNING = {
  launch: 160,           // px/s the missile leaves the drone with
  scatter: 0.9,          // launch angle jitter, radians
  life: 3,
  flash: 0.5,
};

export class MissileDrones extends DroneBay {
  salvoAt(level) { return 1 + this.def.salvoAt.filter(l => level >= l).length; }
  get salvo() { return this.salvoAt(this.level); }
  statLine() {
    const n = this.salvo;
    return formatStats({ prefix: `<b>${this.droneCount}</b> drones`, dmg: this.dmg, rate: this.rate, rateUnit: '/s each', extra: [`<b>${n}</b> missile${n > 1 ? 's' : ''} per shot`, `splash <b>${this.def.splash}</b>`, `<b>${Math.round(this.droneHp)}</b> hp`] });
  }
  nextLine() {
    const s = this.statsAt(this.level + 1), n = this.salvoAt(this.level + 1);
    const cnt = Math.min(this.def.maxDrones, this.def.drones + Math.floor(this.level / this.def.dronePerLevels) + (this.wm.extra || 0));
    return formatStats({ prefix: `<b>${cnt}</b> drones`, dmg: s.dmg, rate: s.rate, rateUnit: '/s each', extra: [`<b>${n}</b> missile${n > 1 ? 's' : ''} per shot`, `<b>${Math.round(this.droneHp * this.def.droneHpMul)}</b> hp`] });
  }
  fireFrom(d, dt, rm) {
    d.cd -= dt * rm;
    if (!d.target || d.cd > 0 || dist(d, d.target) > this.def.fireRange) return;
    d.cd = 1 / this.rate;
    this.launch(d, d.target, this.salvo);
    onDroneMissile(this, d, d.target);
  }
  /** `n` mini-missiles from drone `d` at `target`; `mul` scales damage (combos) */
  launch(d, target, n, mul = 1) {
    const sc = this.scene, def = this.def;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(d.vy, d.vx) + (Math.random() - 0.5) * TUNING.scatter + (i - (n - 1) / 2) * 0.3;
      sc.spawnMissile({
        x: d.x, y: d.y, vx: Math.cos(a) * TUNING.launch, vy: Math.sin(a) * TUNING.launch,
        speed: def.speed, turn: def.turn, dmg: this.dmg * mul, weapon: this, splash: def.splash * (this.lm.missileSplash || 1),
        color: this.color, life: TUNING.life, target,
      });
    }
    sc.fx.flash(d.x, d.y, this.color, TUNING.flash);
    sc.sfx.shot('missile', d.x);
  }
}
