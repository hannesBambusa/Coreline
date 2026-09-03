// Kamikaze drones: bigger, slower drones that fly straight into their target and detonate for area damage.
// The bay rebuilds a lost drone in `respawn` seconds, so the weapon's rhythm is one blast per drone per ~5 s plus flight.
import { DroneBay } from './drones.js';
import { formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo } from '../utils.js';
import { onKamikazeBlast, kamikazeMul } from '../combos/procs.js';

const TUNING = {
  size: 11,              // collision radius (interceptors are 7)
  steer: 3,
  armT: 0.6,             // seconds after launch before it can detonate (so it does not pop on the shield ring)
  idleOffset: 50, idleSpin: 0.9,
  trailRate: 25,
  flash: 1.6, shake: 0.004,
};

export class KamikazeDrones extends DroneBay {
  get blastRadius() { return this.def.blast + this.def.blastPerLevel * (this.level - 1); }
  blastAt(level) { return this.def.blast + this.def.blastPerLevel * (level - 1); }
  statLine() {
    return formatStats({ prefix: `<b>${this.droneCount}</b> drones`, dmg: this.dmg, dmgUnit: 'blast', extra: [`radius <b>${this.blastRadius}</b>`, `rebuild <b>${this.respawn}</b> s`, `<b>${Math.round(this.droneHp)}</b> hp`] });
  }
  nextLine() {
    const s = this.statsAt(this.level + 1);
    const cnt = Math.min(this.def.maxDrones, this.def.drones + Math.floor(this.level / this.def.dronePerLevels) + (this.wm.extra || 0));
    return formatStats({ prefix: `<b>${cnt}</b> drones`, dmg: s.dmg, dmgUnit: 'blast', extra: [`radius <b>${this.blastAt(this.level + 1)}</b>`, `<b>${Math.round(this.droneHp * this.def.droneHpMul)}</b> hp`] });
  }
  sync() {
    super.sync();
    for (const d of this.drones) { d.r = TUNING.size; if (d.armT === undefined) d.armT = TUNING.armT; }
  }
  /** straight at the target; idle drones circle wide of the shield ring */
  steer(d, dt, bm) {
    const t = this.tower;
    let tx, ty;
    if (d.target) { tx = d.target.x; ty = d.target.y; }
    else { d.ang += dt * TUNING.idleSpin; const ir = this.idleRadius(TUNING.idleOffset - 40); tx = t.x + Math.cos(d.ang) * ir; ty = t.y + Math.sin(d.ang) * ir; }
    const a = Math.atan2(ty - d.y, tx - d.x), sp = this.def.droneSpeed * bm, k = Math.min(1, dt * TUNING.steer);
    d.vx += (Math.cos(a) * sp - d.vx) * k; d.vy += (Math.sin(a) * sp - d.vy) * k;
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.armT = Math.max(0, (d.armT ?? TUNING.armT) - dt);
  }
  /** no gun: the drone is the shot. Detonate on contact with the target. */
  fireFrom(d, dt, rm, mobs) {
    const t = d.target;
    if (!t || t.dead || d.armT > 0 || dist(d, t) > d.r + t.r + 2) return;
    this.detonate(d, mobs);
  }
  detonate(d, mobs) {
    const sc = this.scene, R = this.blastRadius;
    sc.damageRadius(d.x, d.y, R, this.dmg * kamikazeMul(this, d.target), this.color, this);
    sc.fx.explode(d.x, d.y, this.color, 30); sc.fx.explode(d.x, d.y, COLORS.white, 12);
    sc.fx.ripple(d.x, d.y, this.color, 8, R);
    sc.fx.flash(d.x, d.y, this.color, TUNING.flash);
    sc.fx.shake(TUNING.shake, 120);
    sc.sfx.play('explode', 14, d.x);
    sc.stats.procs.kamikaze = (sc.stats.procs.kamikaze || 0) + 1;
    d.alive = false; d.respawnT = this.respawn; d.armT = TUNING.armT;
    onKamikazeBlast(this, d, mobs);
  }
  /** a rebuilt drone leaves the core armed after armT */
  hurt(d, dmg) {
    super.hurt(d, dmg);
    if (!d.alive) d.armT = TUNING.armT;
  }
  draw(g) {
    const k = 0.6 + 0.4 * Math.sin(this.scene.time.now / 90);
    for (const d of this.drones) {
      if (!d.alive) continue;
      const a = Math.atan2(d.vy, d.vx);
      g.fillStyle(this.color, 1);
      g.fillTriangle(d.x + Math.cos(a) * 12, d.y + Math.sin(a) * 12, d.x + Math.cos(a + 2.5) * 9, d.y + Math.sin(a + 2.5) * 9, d.x + Math.cos(a - 2.5) * 9, d.y + Math.sin(a - 2.5) * 9);
      g.lineStyle(1.5, d.target ? COLORS.red : this.color, d.target ? 0.5 + 0.4 * k : 0.35); g.strokeCircle(d.x, d.y, d.r + 2);
      g.fillStyle(d.armT > 0 ? COLORS.white : COLORS.red, 0.9); g.fillCircle(d.x, d.y, 2.5);
      if (d.hp < this.droneHp) { g.fillStyle(0x000000, 0.5); g.fillRect(d.x - 10, d.y - 16, 20, 2); g.fillStyle(this.color, 1); g.fillRect(d.x - 10, d.y - 16, 20 * d.hp / this.droneHp, 2); }
    }
    const alive = this.drones.filter(d => d.alive).length;
    if (alive < this.drones.length) { const m = this.mount(); g.lineStyle(1.5, this.color, 0.5); g.strokeCircle(m.x, m.y, 9); }
  }
}
