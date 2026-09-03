import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo } from '../utils.js';
import { onShockPulse } from '../combos/procs.js';

const TUNING = {
  spin: 1.5,                    // idle turret rotation, rad/s (the emitter has no target)
  edgeFalloff: 0.5,             // push at the wave's edge is this fraction of the push at the centre
  // knockback velocity decays as 0.02^t, so displacement = v / ln(50). Scale so `push` is real pixels.
  decay: Math.log(50),
  knockResist: { titan: 0.15, boss: 0.4, warden: 0.4, behemoth: 0.4 },   // push multiplier by ship type (others 1)
  // Collapse combo: a gravity well caught in the wave implodes
  collapse: { reach: 0.5, pull: 0.85, radius: 0.6, dmgMul: 6, shake: 0.01, shakeMs: 300 },
  // Scramble combo (with a drone bay): drones get a speed boost and a kick outward
  scramble: { boost: 10, kick: 400, flash: 0.8 },
  ring: { ease: 0.25, fade: 0.06 },   // expanding ring animation: approach rate and alpha loss per frame
  flash: 2.5, shake: { amount: 0.0025, ms: 100 },
};

export class ShockEmitter extends Weapon {
  constructor(...a) {
    super(...a);
    this.ring = null;   // expanding ring animation state after a pulse
    this.flakT = 0;     // seconds left of the Flak burst combo window
  }
  get push() { return this.def.push + this.def.pushPerLevel * (this.level - 1); }
  get cooldown() { return 1 / this.rate; }
  pushText(push, cooldown) { return [`push <b>${Math.round(push)}</b> px`, `every <b>${cooldown.toFixed(1)}</b> s`]; }
  statLine() { return formatStats({ dmg: this.dmg, extra: this.pushText(this.push, this.cooldown) }); }
  nextLine() {
    const n = this.statsAt(this.level + 1), push = this.def.push + this.def.pushPerLevel * this.level;
    return formatStats({ dmg: n.dmg, extra: this.pushText(push, 1 / n.rate) });
  }
  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; return; }
    this.cd -= dt * this.effectiveRateMul;
    this.flakT = Math.max(0, this.flakT - dt);
    this.angle += dt * TUNING.spin;
    this.target = null;
    if (this.cd <= 0 && this.inRange(mobs).length) {
      this.fire(null, mobs);
      this.scene.sfx.play('shock', null, this.tower.x);
      this.cd = this.cooldown;
    }
  }
  fire(_, mobs) {
    const t = this.tower, R = this.range, push = this.push, sc = this.scene;
    for (const m of mobs) {
      if (m.dead) continue;
      const d = dist(t, m);
      if (d > R + m.r) continue;
      const a = angleTo(t, m);
      const k = TUNING.knockResist[m.type] ?? 1;
      const f = push * (1 - TUNING.edgeFalloff * d / R) * k * TUNING.decay;
      m.dodgeVx += Math.cos(a) * f; m.dodgeVy += Math.sin(a) * f;
      if (m.attached) { m.attached = false; }     // knocks leeches off
      sc.hit(m, this, m.x, m.y, { color: '#5eead4' });
    }
    // clears enemy shots caught in the wave
    sc.enemyBullets = sc.enemyBullets.filter(b => dist(t, b) > R);
    this.collapse(mobs);
    this.scramble();
    this.stasis(mobs);
    this.plague(mobs);
    onShockPulse(this, mobs);
    this.ring = { r: t.shieldR, r1: R, a: 1 };
    sc.fx.ripple(t.x, t.y, this.color, t.shieldR, R);
    sc.fx.ripple(t.x, t.y, COLORS.white, t.shieldR, R * 0.8);
    sc.fx.flash(t.x, t.y, this.color, TUNING.flash);
    sc.fx.shake(TUNING.shake.amount, TUNING.shake.ms);
  }
  // Collapse: a well inside the wave implodes, dragging ships to its centre and bursting
  collapse(mobs) {
    const t = this.tower, R = this.range, sc = this.scene, C = TUNING.collapse;
    const well = sc.wells.find(w => dist(t, w) <= R + w.r * C.reach);
    if (!well || !sc.combos.roll('collapse')) return;
    for (const m of mobs) {
      if (m.dead) continue;
      const d = dist(well, m);
      if (d <= well.r) {
        const a = angleTo(m, well);
        m.x += Math.cos(a) * d * C.pull; m.y += Math.sin(a) * d * C.pull;
        m.dodgeVx = 0; m.dodgeVy = 0;
      }
    }
    sc.damageRadius(well.x, well.y, well.r * C.radius, this.dmg * C.dmgMul, COLORS.violet, this);
    sc.fx.ripple(well.x, well.y, COLORS.violet, well.r, 10);
    sc.fx.explode(well.x, well.y, COLORS.white, 40);
    sc.fx.shake(C.shake, C.shakeMs);
    well.age = well.life;
  }
  // Stasis lock: everything inside the chrono field freezes
  stasis(mobs) {
    const sc = this.scene, cf = this.tower.weapons.find(w => w.type === 'chrono');
    if (!cf || !sc.combos.roll('stasis')) return;
    for (const m of mobs) if (!m.dead && dist(this.tower, m) <= cf.range + m.r) { m.stun = Math.max(m.stun, 2); m.dodgeVx = 0; m.dodgeVy = 0; }
    sc.fx.ripple(this.tower.x, this.tower.y, COLORS.ice, cf.range, this.tower.shieldR);
  }
  // Plague wind: every infection spreads to its neighbours
  plague(mobs) {
    const sc = this.scene, ns = this.tower.weapons.find(w => w.type === 'nanite');
    if (!ns || !ns.hosts.size || !sc.combos.roll('plague')) return;
    const hosts = [...ns.hosts].filter(h => !h.dead && h.infect);
    for (const h of hosts) for (const m of mobs) {
      if (m.dead || m.infect || dist(h, m) > 140) continue;
      sc.fx.bolt(h.x, h.y, m.x, m.y, ns.color); ns.infect(m, h.infect.gen + 1);
    }
  }
  // Scramble: drones get a burst
  scramble() {
    const t = this.tower, sc = this.scene, S = TUNING.scramble;
    const bay = t.weapons.find(w => w.type === 'drones');
    if (!bay || !sc.combos.roll('scramble')) return;
    bay.boost = sc.combos.dur(S.boost);
    for (const d of bay.drones) {
      if (!d.alive) continue;
      const a = angleTo(t, d);
      d.vx += Math.cos(a) * S.kick; d.vy += Math.sin(a) * S.kick;
      sc.fx.flash(d.x, d.y, COLORS.sky, S.flash);
    }
  }
  draw(g) {
    if (!this.ring) return;
    const r = this.ring;
    r.r += (r.r1 - r.r) * TUNING.ring.ease; r.a -= TUNING.ring.fade;
    if (r.a <= 0) { this.ring = null; return; }
    g.lineStyle(14 * r.a, this.color, 0.25 * r.a); g.strokeCircle(this.tower.x, this.tower.y, r.r);
    g.lineStyle(3, COLORS.white, 0.6 * r.a); g.strokeCircle(this.tower.x, this.tower.y, r.r);
  }
}
