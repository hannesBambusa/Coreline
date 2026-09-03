// Mirrors: reflector plates orbiting just outside the shield ring. An enemy shot that crosses a plate becomes one of
// your bullets, flying back at the ship that fired it (or straight back along its path) for the shot's own damage
// times a multiplier. Plates drift to face where the most fire is coming from. More plates at `platesAt` levels.
import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo, TAU } from '../utils.js';

import { onReflect } from '../combos/procs.js';

const NO_CRASH = ['boss', 'warlord', 'titan', 'warden', 'pylon'];   // bosses do not die on a plate
const REFLECT_COLOR = 0xffd166;   // every reflected shot turns gold, whatever colour it arrived in

const TUNING = {
  ringOffset: 40,        // px outside the shield ring: past the point where rammers touch the core (shieldR + tower.r + ship radius)
  spin: 0.15,            // rad/s idle rotation
  faceRate: 1.2,         // rad/s the plates turn toward incoming fire
  sampleRange: 420,      // enemy shots inside this range steer the facing
  shipRange: 300, shipWeight: 0.6,   // ships inside this range steer it too, weaker and by closeness
  flashT: 0.15,
  speedMul: 1.2,         // reflected shot leaves faster than it arrived
  minSpeed: 320,
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Mirrors extends Weapon {
  constructor(...a) {
    super(...a);
    this.ang = Math.random() * TAU;   // angle of plate 0's centre
    this.flash = [];                  // per plate: seconds of glow left after a reflect
    this.reflected = 0;
    this.plateState = [];             // per plate: { hp, alive, respawnT }
    this.syncPlates();
  }
  platesAt(level) { return 1 + this.def.platesAt.filter(l => level >= l).length; }
  get plates() { return this.platesAt(this.level); }
  arcAt(level) { return Math.min(this.def.arcMax, this.def.arc + this.def.arcPerLevel * (level - 1)); }
  get arc() { return this.arcAt(this.level); }
  mulAt(level) { return this.def.mul + this.def.mulPerLevel * (level - 1); }
  get mul() { return this.mulAt(this.level) * this.mods.dmg * this.wm.dmg * this.lm.dmg * this.lw.dmg; }
  get ringR() { return this.tower.shieldR + TUNING.ringOffset; }
  get dps() { return 0; }
  text(level) {
    const n = this.platesAt(level), cover = Math.round(n * this.arcAt(level) / TAU * 100);
    const parts = [`<b>${n}</b> plate${n > 1 ? 's' : ''}`, `<b>${cover}%</b> of the ring`, `reflect <b>×${this.mulAt(level).toFixed(2)}</b>`, `<b>${Math.round(this.def.plateHp * Math.pow(this.def.plateHpMul, level - 1))}</b> hp each`];
    const next = this.def.platesAt.find(l => l > level);
    if (level === this.level && next) parts.push(`Lv ${next}: +plate`);
    return formatStats({ extra: parts });
  }
  statLine() { return this.text(this.level); }
  nextLine() { return this.text(this.level + 1); }
  get plateHp() { return this.def.plateHp * Math.pow(this.def.plateHpMul, this.level - 1); }
  syncPlates() { while (this.plateState.length < this.plates) this.plateState.push({ hp: this.plateHp, alive: true, respawnT: 0 }); }
  plateAngle(i) { return this.ang + i * TAU / this.plates; }
  /** damage a plate; a broken plate rebuilds after def.rebuild seconds */
  wear(i, amount) {
    const p = this.plateState[i]; if (!p || !p.alive) return;
    p.hp -= amount;
    if (p.hp <= 0) {
      p.alive = false; p.respawnT = this.def.rebuild; p.hp = 0;
      const t = this.tower, a = this.plateAngle(i), R = this.ringR;
      this.scene.fx.explode(t.x + Math.cos(a) * R, t.y + Math.sin(a) * R, this.color, 18);
      this.scene.fx.floater(t.x + Math.cos(a) * R, t.y + Math.sin(a) * R - 12, 'plate lost', '#9be7ff', 11);
      this.scene.sfx.play('explode', 8, t.x);
    }
  }
  /** is world angle `a` (from the core) inside plate `i`? */
  onPlate(a, i) { return Math.abs(wrap(a - this.plateAngle(i))) <= this.arc / 2; }
  /** index of the live plate at world angle `a`, or -1 */
  plateAt(a) { for (let i = 0; i < this.plates; i++) if (this.plateState[i] && this.plateState[i].alive && this.onPlate(a, i)) return i; return -1; }

  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; return; }
    const sc = this.scene, t = this.tower;
    this.target = null;
    this.syncPlates();
    this.flash = this.flash.map(f => Math.max(0, f - dt));
    // rebuild timers
    for (const p of this.plateState) if (!p.alive) { p.respawnT -= dt; if (p.respawnT <= 0) { p.alive = true; p.hp = this.plateHp; sc.fx.flash(t.x, t.y, this.color, 1); } }
    // rams: a ship reaching the ring on a live plate dies there and hits the plate for its damage
    const R = this.ringR;
    for (const m of mobs) {
      if (m.dead || NO_CRASH.includes(m.type)) continue;
      const d = dist(t, m);
      if (d > R + m.r || d < R - m.r - 6) continue;
      const i = this.plateAt(angleTo(t, m));
      if (i === -1) continue;
      this.wear(i, m.dmg);
      sc.fx.explode(m.x, m.y, m.def.color, 10);
      this.flash[i] = TUNING.flashT;
      m.die(false);
    }
    // face the threat: mean direction of enemy shots near the core, plus ships closing in (nearer = heavier), else idle spin
    let sx = 0, sy = 0, n = 0;
    for (const b of sc.enemyBullets) { const d = dist(t, b); if (d <= TUNING.sampleRange) { const a = angleTo(t, b); sx += Math.cos(a); sy += Math.sin(a); n++; } }
    for (const m of mobs) { if (m.dead) continue; const d = dist(t, m); if (d <= TUNING.shipRange) { const a = angleTo(t, m), wgt = TUNING.shipWeight * (1 - d / TUNING.shipRange); sx += Math.cos(a) * wgt; sy += Math.sin(a) * wgt; n++; } }
    if (n) {
      const want = Math.atan2(sy, sx);
      // the plate nearest to `want` turns onto it (so extra plates keep their spacing)
      let best = 0, bd = Infinity;
      for (let i = 0; i < this.plates; i++) { const d = Math.abs(wrap(want - this.plateAngle(i))); if (d < bd) { bd = d; best = i; } }
      const delta = wrap(want - this.plateAngle(best));
      this.ang += Math.sign(delta) * Math.min(Math.abs(delta), TUNING.faceRate * dt);
    } else this.ang += dt * TUNING.spin;
    this.angle = this.ang;
  }

  /** called by projectiles for every enemy shot after it moved; true when the shot was reflected */
  reflect(b, prevD) {
    const t = this.tower, R = this.ringR, d = dist(t, b);
    if (!(prevD > R && d <= R)) return false;              // crossing the ring inward this frame
    const a = angleTo(t, b);
    const i = this.plateAt(a);
    if (i === -1) return false;
    const sc = this.scene, sp = Math.max(TUNING.minSpeed, Math.hypot(b.vx, b.vy) * TUNING.speedMul);
    const owner = b.owner && !b.owner.dead ? b.owner : null;
    const back = owner ? angleTo(b, owner) : Math.atan2(-b.vy, -b.vx);
    const shot = {
      x: t.x + Math.cos(a) * (R + 4), y: t.y + Math.sin(a) * (R + 4), vx: Math.cos(back) * sp, vy: Math.sin(back) * sp,
      dmg: b.dmg * this.mul, weapon: this, color: REFLECT_COLOR, life: 1.6, target: owner, reflected: true,
    };
    onReflect(this, b, shot);
    sc.spawnBullet(shot);
    this.flash[i] = TUNING.flashT;
    this.reflected++;
    this.wear(i, b.dmg * this.def.reflectWear);
    // make the bounce readable: a bright line back along the return path, a flash on the plate and a callout
    const ex = owner ? owner.x : shot.x + Math.cos(back) * 700, ey = owner ? owner.y : shot.y + Math.sin(back) * 700;
    sc.fx.line(shot.x, shot.y, ex, ey, COLORS.white, 3, 0.22);
    sc.fx.line(shot.x, shot.y, ex, ey, REFLECT_COLOR, 8, 0.18);
    sc.fx.flash(shot.x, shot.y, COLORS.white, 1.6);
    sc.fx.spark(shot.x, shot.y, this.color, 8);
    sc.fx.floater(shot.x, shot.y - 16, 'REFLECTED', '#ffd166', 12);
    sc.sfx.play('shieldHit', null, shot.x);
    return true;
  }

  draw(g) {
    const t = this.tower, R = this.ringR, half = this.arc / 2;
    for (let i = 0; i < this.plates; i++) {
      const a = this.plateAngle(i), f = (this.flash[i] || 0) / TUNING.flashT, p = this.plateState[i];
      if (p && !p.alive) {   // rebuilding: faint dashed outline that fills as the timer runs
        const k = 1 - p.respawnT / this.def.rebuild;
        g.lineStyle(2, this.color, 0.2); g.beginPath(); g.arc(t.x, t.y, R, a - half, a + half, false); g.strokePath();
        g.lineStyle(3, this.color, 0.5); g.beginPath(); g.arc(t.x, t.y, R, a - half, a - half + this.arc * k, false); g.strokePath();
        continue;
      }
      const hpF = p ? p.hp / this.plateHp : 1;
      g.lineStyle(7, this.color, (0.18 + 0.5 * f) * (0.4 + 0.6 * hpF)); g.beginPath(); g.arc(t.x, t.y, R, a - half, a + half, false); g.strokePath();
      if (hpF < 1) { g.lineStyle(2, hpF > 0.4 ? COLORS.white : COLORS.red, 0.8); g.beginPath(); g.arc(t.x, t.y, R - 6, a - half, a - half + this.arc * hpF, false); g.strokePath(); }
      g.lineStyle(2, COLORS.white, 0.7 + 0.3 * f); g.beginPath(); g.arc(t.x, t.y, R + 3, a - half, a + half, false); g.strokePath();
      g.lineStyle(1, this.color, 0.5); g.beginPath(); g.arc(t.x, t.y, R - 3, a - half, a + half, false); g.strokePath();
      // end caps
      for (const e of [a - half, a + half]) g.lineBetween(t.x + Math.cos(e) * (R - 4), t.y + Math.sin(e) * (R - 4), t.x + Math.cos(e) * (R + 4), t.y + Math.sin(e) * (R + 4));
    }
  }
}
