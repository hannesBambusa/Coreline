// Ion storm: one (two from `secondAt`) storm clouds that live out on the ring and drift after the densest pack.
// Ships inside take chain-lightning ticks (`arcs` ships per tick at `rate` ticks per second) and their shots are
// eaten. The cloud never comes closer than `minDist` to the core.
import { Weapon, formatStats } from './base.js';
import { COLORS } from '../config.js';
import { dist, angleTo, targetable, TAU } from '../utils.js';

const TUNING = {
  packRadius: 140,       // cluster measure when choosing where to drift
  steer: 1.5,            // velocity blend rate
  idleOrbit: 0.25,       // rad/s the cloud circles the ring when nothing is around
  separation: 2.4,       // clouds push apart below this many cloud radii between centres
  wisps: 5,              // drawn swirl arcs
  boltRate: 1,           // decorative bolts per second inside an idle cloud
  eatRadius: 1.0,        // fraction of cloud radius that eats enemy shots
  downburstMul: 4,       // Downburst combo damage multiplier
};

export class IonStorm extends Weapon {
  constructor(...a) {
    super(...a);
    this.clouds = [];
    this.tickT = 0;
    this.sync();
  }
  get cloudCount() { return this.level >= this.def.secondAt ? 2 : 1; }
  get cloudRadius() { return this.def.cloudRadius + this.def.radiusPerLevel * (this.level - 1); }
  cloudRadiusAt(level) { return this.def.cloudRadius + this.def.radiusPerLevel * (level - 1); }
  get dps() { return this.dmg * this.rate * this.def.arcs; }
  text(level, dmg, rate) {
    const parts = [`<b>${this.def.arcs}</b> arcs per tick`, `cloud <b>${this.cloudRadiusAt(level)}</b> px`];
    if (level >= this.def.secondAt) parts.push('2 clouds'); else if (level === this.level) parts.push(`Lv ${this.def.secondAt}: +cloud`);
    return formatStats({ dmg, rate, rateUnit: ' ticks/s', extra: parts });
  }
  statLine() { return this.text(this.level, this.dmg, this.rate); }
  nextLine() { const s = this.statsAt(this.level + 1); return this.text(this.level + 1, s.dmg, s.rate); }
  sync() {
    const t = this.tower;
    while (this.clouds.length < this.cloudCount) {
      // a new cloud starts on the far side of the ring from the existing one
      const a = this.clouds.length ? this.clouds[0].ang + Math.PI : Math.random() * TAU, r = this.range * 0.7;
      this.clouds.push({ x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, vx: 0, vy: 0, spin: Math.random() * TAU, flash: 0, ang: a });
    }
  }
  get r() { return this.cloudRadius; }
  inside(c, m) { return dist(c, m) <= this.cloudRadius + m.r; }
  update(dt, mobs) {
    this.sync();
    if (this.jammed > 0) { this.jammed -= dt; return; }
    const sc = this.scene, t = this.tower, R = this.cloudRadius;
    this.target = null;
    this.angle += dt * 0.4;
    for (const c of this.clouds) {
      c.spin += dt * 1.5; c.flash = Math.max(0, c.flash - dt);
      this.drift(c, dt, mobs);
    }
    // enemy shots inside a cloud are eaten
    sc.enemyBullets = sc.enemyBullets.filter(b => !this.clouds.some(c => dist(c, b) <= R * TUNING.eatRadius));
    // lightning ticks
    this.tickT -= dt * this.effectiveRateMul;
    if (this.tickT <= 0) {
      this.tickT = 1 / this.rate;
      for (const c of this.clouds) this.strike(c, mobs);
    }
    for (const c of this.clouds) if (Math.random() < dt * 8) { const a = Math.random() * TAU, rr = R * Math.random(); sc.fx.trailAt(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, this.color); }
  }
  /** drift toward the densest pack inside weapon range (keeping off the core), or circle the ring when idle */
  drift(c, dt, mobs) {
    const t = this.tower, def = this.def, R = this.cloudRadius;
    const pool = mobs.filter(m => !m.dead && dist(t, m) <= this.range);
    let best = null, bestN = 0;
    for (const m of pool) { let n = 0; for (const o of pool) if (dist(m, o) < TUNING.packRadius) n++; if (n > bestN && !this.clouds.some(o => o !== c && dist(o, m) <= R)) { bestN = n; best = m; } }
    let tx, ty;
    if (best) { tx = best.x; ty = best.y; }
    else { c.ang += dt * TUNING.idleOrbit; const rr = this.range * 0.75; tx = t.x + Math.cos(c.ang) * rr; ty = t.y + Math.sin(c.ang) * rr; }
    // second cloud: never the pack the first one already covers (falls back to the far side of the ring)
    if (best && this.clouds.indexOf(c) > 0 && this.clouds.some(o => o !== c && dist(o, best) <= R * 1.5)) { const oa = angleTo(t, this.clouds[0]) + Math.PI, rr = this.range * 0.75; tx = t.x + Math.cos(oa) * rr; ty = t.y + Math.sin(oa) * rr; }
    // never inside minDist of the core
    const dc = dist(t, { x: tx, y: ty });
    if (dc < def.minDist) { const a = angleTo(t, { x: tx, y: ty }); tx = t.x + Math.cos(a) * def.minDist; ty = t.y + Math.sin(a) * def.minDist; }
    const a = Math.atan2(ty - c.y, tx - c.x), k = Math.min(1, dt * TUNING.steer), sp = def.cloudSpeed;
    c.vx += (Math.cos(a) * sp - c.vx) * k; c.vy += (Math.sin(a) * sp - c.vy) * k;
    // clouds keep at least `separation` radii apart: the nearer they get, the harder they push off each other
    for (const o of this.clouds) {
      if (o === c) continue;
      const d = dist(c, o), minD = R * TUNING.separation;
      if (d < minD && d > 0) { const pa = angleTo(o, c), push = (1 - d / minD) * sp * 2; c.vx += Math.cos(pa) * push * dt * 4; c.vy += Math.sin(pa) * push * dt * 4; }
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
  }
  /** one tick: bolts from the cloud into up to `arcs` ships inside it */
  strike(c, mobs) {
    const sc = this.scene, R = this.cloudRadius;
    const inside = mobs.filter(m => targetable(m) && this.inside(c, m));
    if (!inside.length) { if (Math.random() < 0.3) { const a = Math.random() * TAU; sc.fx.bolt(c.x, c.y, c.x + Math.cos(a) * R * 0.6, c.y + Math.sin(a) * R * 0.6, this.color); } return; }
    inside.sort(() => Math.random() - 0.5);
    for (const m of inside.slice(0, this.def.arcs)) {
      const a = Math.random() * TAU, rr = R * (0.3 + Math.random() * 0.6);
      sc.fx.bolt(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, m.x, m.y, this.color);
      sc.hit(m, this, m.x, m.y, { color: '#9be7ff', size: 12 });
    }
    c.flash = 0.12;
    sc.sfx.shot('tesla', c.x);
  }
  /** every ship in the cloud that contains (x, y), for combos */
  shipsAround(x, y, mobs) {
    const c = this.clouds.find(o => dist(o, { x, y }) <= this.cloudRadius);
    return c ? mobs.filter(m => !m.dead && this.inside(c, m)) : [];
  }
  draw(g) {
    const R = this.cloudRadius;
    for (const c of this.clouds) {
      const f = 0.5 + 0.5 * Math.sin(c.spin * 2), fl = c.flash / 0.12;
      g.fillStyle(this.color, 0.04 + 0.05 * fl); g.fillCircle(c.x, c.y, R);
      g.lineStyle(1.5 + 3 * fl, this.color, 0.3 + 0.5 * fl); g.strokeCircle(c.x, c.y, R);
      for (let i = 0; i < TUNING.wisps; i++) {
        const a0 = c.spin * (i % 2 ? -1 : 1) + i * 1.3, rr = R * (0.45 + 0.1 * i);
        g.lineStyle(1.5, i % 2 ? COLORS.white : this.color, 0.25 + 0.2 * f);
        g.beginPath(); g.arc(c.x, c.y, rr, a0, a0 + 1.4, false); g.strokePath();
      }
      g.fillStyle(COLORS.white, 0.5 + 0.5 * fl); g.fillCircle(c.x, c.y, 3);
    }
  }
}
