import { Weapon } from './base.js';
import { dist, angleTo } from '../utils.js';

const TUNING = {
  wellOverlap: 0.9,   // a ship inside this fraction of an active well's radius counts as already caught
  flash: 0.7,
};

export class GravityWell extends Weapon {
  // prefer clusters that are not already sitting inside an active well, then the densest
  // cluster measured by the well's own radius
  selectFrom(list) {
    const wells = this.scene.wells;
    const free = list.filter(m => !wells.some(w => dist(w, m) <= w.r * TUNING.wellOverlap));
    const pool = free.length ? free : list, R = this.def.wellRadius * this.wm.radius;
    let best = null, bestN = -1;
    for (const m of pool) {
      let n = 0;
      for (const o of pool) if (dist(m, o) < R) n++;
      if (n > bestN) { bestN = n; best = m; }
    }
    return best;
  }
  fire(target) {
    const m = this.muzzle();
    const a = angleTo(m, target);
    this.scene.spawnWellShot({
      x: m.x, y: m.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed,
      tx: target.x, ty: target.y, color: this.color,
      well: {
        r: this.def.wellRadius * this.wm.radius, life: this.def.wellLife + this.wm.life,
        pull: this.def.pull * (this.lm.gravityPull || 1), slow: this.def.slow, dps: this.dmg, weapon: this, color: this.color,
      },
    });
    this.scene.fx.flash(m.x, m.y, this.color, TUNING.flash);
  }
}
