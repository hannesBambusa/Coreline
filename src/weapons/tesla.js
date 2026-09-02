import { Weapon } from './base.js';
import { COLORS } from '../config.js';
import { dist, nearest } from '../utils.js';
import { onTeslaShot, onTeslaChain } from '../combos/procs.js';

const TUNING = {
  falloff: 0.8,              // damage multiplier applied per chain hop
  storm: { dmgMul: 1.2 },    // Storm combo: arcs from an active gravity well into every ship inside it
  flash: 0.6,
};

export class TeslaArc extends Weapon {
  fire(target, mobs) {
    const m = this.muzzle(), sc = this.scene;
    const hit = new Set();
    const extra = onTeslaShot(this, target);
    let from = m, cur = target, falloff = extra.mul;
    for (let i = 0; i < this.def.chains + this.wm.chains + (this.lm.teslaChains || 0) + extra.chains && cur; i++) {
      hit.add(cur);
      sc.fx.bolt(from.x, from.y, cur.x, cur.y, this.color);
      sc.hit(cur, this, cur.x, cur.y, { mul: falloff, color: this.prefers(cur) ? '#ffe66d' : '#9be7ff' });
      from = cur; falloff *= TUNING.falloff;
      // next hop: nearest unhit ship within chainRange of the current one
      cur = nearest(mobs, cur.x, cur.y, this.def.chainRange, o => !hit.has(o));
    }
    onTeslaChain(this, hit, mobs);
    const well = sc.wells[0];
    if (well && sc.combos.roll('storm')) {
      for (const o of mobs) {
        if (o.dead || hit.has(o)) continue;
        if (dist(well, o) <= well.r) {
          sc.fx.bolt(well.x, well.y, o.x, o.y, COLORS.ice);
          sc.hit(o, this, o.x, o.y, { dmg: this.dmg * TUNING.storm.dmgMul, color: '#9be7ff', size: 13 });
        }
      }
      sc.fx.ripple(well.x, well.y, COLORS.ice, 10, well.r);
    }
    sc.fx.flash(m.x, m.y, this.color, TUNING.flash);
  }
}
