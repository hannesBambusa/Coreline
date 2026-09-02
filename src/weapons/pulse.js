import { Weapon, formatStats } from './base.js';
import { onPulseShot } from '../combos/procs.js';
import { COLORS } from '../config.js';
import { dist, angleTo } from '../utils.js';

const TUNING = {
  barrelSpread: 0.09,                 // radians between barrels in a multi-barrel volley
  flashBase: 0.5, flashPerBarrel: 0.15,
  chargedDur: 3,                      // seconds the Charged combo (with a tesla mounted) electrifies bolts
  // Barrage combo (with a missile pod mounted): a fan of mini-missiles alongside the volley
  barrage: { count: 5, spread: 0.35, launch: 200, speedMul: 1.2, turnMul: 1.5, dmgMul: 0.5, splashMul: 0.7, life: 3 },
};

export class PulseCannon extends Weapon {
  constructor(...a) {
    super(...a);
    this.charged = 0;   // seconds left of electrified bolts (Charged combo)
  }
  get barrels() { return 1 + this.def.barrelsAt.filter(l => this.level >= l).length; }
  get pierce() { return this.def.pierceAt.filter(l => this.level >= l).length; }
  barrelText(b, p) { return [`<b>${b}</b> barrel${b > 1 ? 's' : ''}`, p ? 'pierce ' + p : '']; }
  statLine() {
    return formatStats({ dmg: this.dmg, rate: this.rate, extra: this.barrelText(this.barrels, this.pierce), dps: this.dps * this.barrels });
  }
  nextLine() {
    const n = this.statsAt(this.level + 1), L = this.level + 1;
    const b = 1 + this.def.barrelsAt.filter(l => L >= l).length, p = this.def.pierceAt.filter(l => L >= l).length;
    const nextMile = [...this.def.barrelsAt.map(l => [l, 'barrel']), ...this.def.pierceAt.map(l => [l, 'pierce'])]
      .filter(([l]) => l > this.level).sort((x, y) => x[0] - y[0])[0];
    return formatStats({
      dmg: n.dmg, rate: n.rate, extra: this.barrelText(b, p), dps: n.dps * b,
      suffix: nextMile ? ` · next ${nextMile[1]} at Lv ${nextMile[0]}` : '',
    });
  }
  fire(target) {
    const m = this.muzzle();
    // lead the target by its flight time
    const t = dist(m, target) / this.def.speed;
    const a = angleTo(m, { x: target.x + target.vx * t, y: target.y + target.vy * t });
    const n = this.barrels;
    for (let i = 0; i < n; i++) {
      const sp = n > 1 ? (i - (n - 1) / 2) * TUNING.barrelSpread : 0;
      this.scene.spawnBullet({
        x: m.x, y: m.y, vx: Math.cos(a + sp) * this.def.speed, vy: Math.sin(a + sp) * this.def.speed,
        dmg: this.dmg, weapon: this, color: this.color, life: this.range / this.def.speed + 0.2, target,
        pierce: this.pierce, hitSet: this.pierce ? new Set() : null,
      });
    }
    this.scene.fx.flash(m.x, m.y, this.color, TUNING.flashBase + TUNING.flashPerBarrel * n);
    this.charged = Math.max(0, this.charged - (1 / this.rate));
    onPulseShot(this, target, this.scene.mobs);
    const hasTesla = this.tower.weapons.some(w => w.type === 'tesla');
    if (hasTesla && !this.charged && this.scene.combos.roll('charged')) this.charged = TUNING.chargedDur;
    if (this.scene.combos.roll('barrage')) {
      const pod = this.tower.weapons.find(w => w.type === 'missile'), B = TUNING.barrage;
      for (let i = 0; i < B.count; i++) {
        const b = a + (i - (B.count - 1) / 2) * B.spread;
        this.scene.spawnMissile({
          x: m.x, y: m.y, vx: Math.cos(b) * B.launch, vy: Math.sin(b) * B.launch,
          speed: pod.def.speed * B.speedMul, turn: pod.def.turn * B.turnMul, dmg: pod.dmg * B.dmgMul, weapon: pod,
          splash: pod.def.splash * B.splashMul, color: COLORS.orange, life: B.life, target,
        });
      }
    }
  }
}
