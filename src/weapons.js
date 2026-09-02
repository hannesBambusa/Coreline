import { WEAPONS } from './config.js';

const dist = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

export class Weapon {
  constructor(scene, tower, type, slotIndex) {
    this.scene = scene;
    this.tower = tower;
    this.type = type;
    this.def = WEAPONS[type];
    this.slot = slotIndex;
    this.level = 1;
    this.cd = 0;
    this.angle = 0;
    this.target = null;
  }
  get mods() { return this.scene.tree.mods; }
  get wm() { return this.mods.w[this.type]; }
  get dmg() { return this.def.dmg * Math.pow(this.def.dmgMul, this.level - 1) * this.mods.dmg * this.wm.dmg; }
  get rate() { return this.def.rate * Math.pow(this.def.rateMul, this.level - 1) * this.mods.rate * this.wm.rate; }
  get range() { return this.def.range; }
  get dps() { return this.dmg * this.rate; }
  get color() { return this.def.color; }
  upgradeCost() { return Math.floor(this.def.cost * Math.pow(this.def.costGrowth, this.level - 1)); }
  statsAt(level) {
    const dmg = this.def.dmg * Math.pow(this.def.dmgMul, level - 1) * this.mods.dmg * this.wm.dmg;
    const rate = this.def.rate * Math.pow(this.def.rateMul, level - 1) * this.mods.rate * this.wm.rate;
    return { dmg, rate, dps: dmg * rate };
  }
  statLine() { return `<b>${this.dmg.toFixed(1)}</b> dmg · <b>${this.rate.toFixed(2)}</b>/s · <b>${this.dps.toFixed(1)}</b> dps`; }
  nextLine() {
    const n = this.statsAt(this.level + 1);
    return `<b>${n.dmg.toFixed(1)}</b> dmg · <b>${n.rate.toFixed(2)}</b>/s · <b>${n.dps.toFixed(1)}</b> dps`;
  }

  inRange(mobs) { return mobs.filter(m => !m.dead && dist(this.tower, m) <= this.range); }
  prefers(mob) { return this.def.prefer.includes(mob.type); }
  dmgVs(mob) { return this.dmg * (this.prefers(mob) ? this.def.bonus : 1); }

  // preferred mob types first, then the weapon's own rule within that pool
  pickTarget(mobs) {
    const list = this.inRange(mobs);
    if (!list.length) return null;
    const pref = list.filter(m => this.prefers(m));
    return this.selectFrom(pref.length ? pref : list);
  }
  // default: nearest
  selectFrom(list) {
    let best = null, bestD = Infinity;
    for (const m of list) { const d = dist(this.tower, m); if (d < bestD) { bestD = d; best = m; } }
    return best;
  }

  // mount point on tower rim
  mount() {
    const a = this.tower.slotAngle(this.slot);
    return { x: this.tower.x + Math.cos(a) * this.tower.r, y: this.tower.y + Math.sin(a) * this.tower.r };
  }
  muzzle(len = 16) {
    const m = this.mount();
    return { x: m.x + Math.cos(this.angle) * len, y: m.y + Math.sin(this.angle) * len };
  }

  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; this.target = null; if (Math.random() < dt * 10) { const m = this.mount(); this.scene.fx.spark(m.x, m.y, 0xff4d6d, 2); } return; }
    this.cd -= dt * this.scene.abilities.rateMul * (this.jamSlow ? this.jamSlow : 1);
    if (!this.target || this.target.dead || dist(this.tower, this.target) > this.range) {
      this.target = this.pickTarget(mobs);
    }
    if (this.target) {
      const m = this.mount();
      const want = Phaser.Math.Angle.Between(m.x, m.y, this.target.x, this.target.y);
      this.angle = Phaser.Math.Angle.RotateTo(this.angle, want, dt * 12);
      if (this.cd <= 0) { this.fire(this.target, mobs); this.scene.sfx.shot(this.type, this.target.x); this.cd = 1 / this.rate; }
    }
  }

  fire(target, mobs) {}
  draw(g) {}
}

export class PulseCannon extends Weapon {
  fire(target) {
    const m = this.muzzle();
    const t = dist(m, target) / this.def.speed;
    const a = Phaser.Math.Angle.Between(m.x, m.y, target.x + target.vx * t, target.y + target.vy * t);
    this.scene.spawnBullet({
      x: m.x, y: m.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed,
      dmg: this.dmg, weapon: this, color: this.color, life: this.range / this.def.speed + 0.2, target,
    });
    this.scene.fx.flash(m.x, m.y, this.color, 0.5);
    if (this.scene.combos.roll('barrage')) {
      const pod = this.tower.weapons.find(w => w.type === 'missile');
      for (let i = 0; i < 5; i++) {
        const b = a + (i - 2) * 0.35;
        this.scene.spawnMissile({
          x: m.x, y: m.y, vx: Math.cos(b) * 200, vy: Math.sin(b) * 200,
          speed: pod.def.speed * 1.2, turn: pod.def.turn * 1.5, dmg: pod.dmg * 0.5, weapon: pod, splash: pod.def.splash * 0.7,
          color: 0xff9f43, life: 3, target,
        });
      }
    }
  }
}

export class Railgun extends Weapon {
  selectFrom(list) {
    let best = null, bestHp = -1;
    for (const m of list) { const hp = m.hp + (m.shield || 0); if (hp > bestHp) { bestHp = hp; best = m; } }
    return best;
  }
  fire(target, mobs) {
    const m = this.muzzle();
    const a = Phaser.Math.Angle.Between(m.x, m.y, target.x, target.y);
    const ex = m.x + Math.cos(a) * this.range, ey = m.y + Math.sin(a) * this.range;
    const line = new Phaser.Geom.Line(m.x, m.y, ex, ey);
    let hits = 0;
    for (const mob of mobs) {
      if (mob.dead) continue;
      const p = Phaser.Geom.Line.GetNearestPoint(line, mob, new Phaser.Geom.Point());
      if (dist(p, mob) <= mob.r + 6 && dist(m, mob) <= this.range) {
        this.scene.hit(mob, this, p.x, p.y, { color: this.prefers(mob) ? '#ffe66d' : '#ffffff', size: 14 });
        hits++;
      }
    }
    if (hits && this.scene.combos.roll('ionlance')) {
      for (const mob of mobs) {
        if (mob.dead) continue;
        const p = Phaser.Geom.Line.GetNearestPoint(line, mob, new Phaser.Geom.Point());
        const dd = dist(p, mob);
        if (dd > mob.r + 6 && dd <= 140 && dist(m, mob) <= this.range) {
          this.scene.fx.bolt(p.x, p.y, mob.x, mob.y, 0x9be7ff);
          this.scene.hit(mob, this, mob.x, mob.y, { dmg: this.dmg * 0.6, color: '#9be7ff', size: 13 });
        }
      }
    }
    const laser = this.tower.weapons.find(w => w.type === 'laser');
    if (laser && laser.target === target && this.scene.combos.roll('overload')) {
      laser.overload = 3;
      laser.held = laser.def.rampTime;
    }
    this.scene.fx.line(m.x, m.y, ex, ey, this.color, 4, 0.25);
    this.scene.fx.line(m.x, m.y, ex, ey, 0x4ff2ff, 10, 0.12);
    this.scene.fx.flash(m.x, m.y, this.color, 1.2);
    this.scene.fx.shake(0.0008, 60);
  }
}

export class MissilePod extends Weapon {
  selectFrom(list) {
    let best = null, bestN = -1;
    for (const m of list) {
      let n = 0;
      for (const o of list) if (dist(m, o) < this.def.splash) n++;
      if (n > bestN) { bestN = n; best = m; }
    }
    return best;
  }
  fire(target) {
    const m = this.muzzle();
    const a = this.angle + (Math.random() - 0.5) * 1.2;
    this.scene.spawnMissile({
      x: m.x, y: m.y, vx: Math.cos(a) * this.def.speed * 0.5, vy: Math.sin(a) * this.def.speed * 0.5,
      speed: this.def.speed, turn: this.def.turn, dmg: this.dmg, weapon: this, splash: this.def.splash * this.wm.splash,
      color: this.color, life: 4, target,
    });
    this.scene.fx.flash(m.x, m.y, this.color, 0.5);
  }
}

export class LaserBeam extends Weapon {
  constructor(...a) { super(...a); this.held = 0; this.lastTarget = null; this.overload = 0; }
  get dps() { return this.dmg; }
  statLine() { return `<b>${this.dmg.toFixed(1)}</b> dps · ramps to <b>×${this.def.rampMax}</b>`; }
  nextLine() { const n = this.statsAt(this.level + 1); return `<b>${n.dmg.toFixed(1)}</b> dps · ramps to <b>×${this.def.rampMax}</b>`; }
  selectFrom(list) {
    let best = null, bestD = -1;
    for (const m of list) { const d = dist(this.tower, m); if (d > bestD) { bestD = d; best = m; } }
    return best;
  }
  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; this.target = null; return; }
    if (!this.target || this.target.dead || dist(this.tower, this.target) > this.range) {
      this.target = this.pickTarget(mobs);
    }
    if (this.target !== this.lastTarget) { this.held = 0; this.lastTarget = this.target; }
    if (!this.target) return;
    this.held += dt;
    this.overload = Math.max(0, this.overload - dt);
    this.flare = Math.max(0, (this.flare || 0) - dt);
    const m = this.mount();
    this.angle = Phaser.Math.Angle.Between(m.x, m.y, this.target.x, this.target.y);
    const ramp = (1 + (this.def.rampMax + this.wm.rampMax - 1) * Math.min(1, this.held / this.def.rampTime)) * (this.overload > 0 ? 2.5 : 1);
    this.ramp = ramp;
    this.target.takeDamage(this.dmgVs(this.target) * ramp * dt * this.scene.abilities.rateMul, this.target.x, this.target.y, true);
    if (Math.random() < dt * 8) this.scene.fx.spark(this.target.x, this.target.y, this.color, 2);
    // crit ticks: twice a second the beam can spike for an extra burst
    this.critTimer = (this.critTimer || 0) + dt;
    if (this.critTimer >= 0.5) {
      this.critTimer = 0;
      if (Math.random() < (this.def.crit ?? 0.06)) {
        const burst = this.dmgVs(this.target) * ramp * 0.5 * ((this.def.critMul ?? 2.2) - 1);
        this.scene.hit(this.target, this, this.target.x, this.target.y, { dmg: burst, noCrit: true, color: '#ffb703', size: 20, tag: '' });
        this.scene.fx.spark(this.target.x, this.target.y, 0xffb703, 8);
        this.scene.fx.ripple(this.target.x, this.target.y, 0xffb703, this.target.r, this.target.r + 22);
        this.flare = Math.max(this.flare || 0, 0.25);
      }
    }
  }
  draw(g) {
    if (!this.target || this.target.dead) return;
    const m = this.muzzle(10), t = this.target;
    const w = 1.5 + (this.ramp || 1) * 1.2, pulse = 0.7 + 0.3 * Math.sin(this.scene.time.now / 40);
    if (this.overload > 0) { g.lineStyle(w * 6, 0xffffff, 0.25 * pulse); g.lineBetween(m.x, m.y, t.x, t.y); }
    if (this.flare > 0) { g.lineStyle(w * 8 * this.flare, 0xffffff, 0.5 * this.flare); g.lineBetween(m.x, m.y, t.x, t.y); }
    g.lineStyle(w * 3, this.color, 0.18 * pulse); g.lineBetween(m.x, m.y, t.x, t.y);
    g.lineStyle(w, this.color, 0.9); g.lineBetween(m.x, m.y, t.x, t.y);
    g.lineStyle(w * 0.4, 0xffffff, 1); g.lineBetween(m.x, m.y, t.x, t.y);
  }
}

export class TeslaArc extends Weapon {
  fire(target, mobs) {
    const m = this.muzzle();
    const hit = new Set();
    let from = m, cur = target, falloff = 1;
    for (let i = 0; i < this.def.chains + this.wm.chains && cur; i++) {
      hit.add(cur);
      this.scene.fx.bolt(from.x, from.y, cur.x, cur.y, this.color);
      this.scene.hit(cur, this, cur.x, cur.y, { mul: falloff, color: this.prefers(cur) ? '#ffe66d' : '#9be7ff' });
      from = cur; falloff *= 0.8;
      let next = null, bestD = this.def.chainRange;
      for (const o of mobs) {
        if (o.dead || hit.has(o)) continue;
        const d = dist(cur, o); if (d < bestD) { bestD = d; next = o; }
      }
      cur = next;
    }
    const well = this.scene.wells[0];
    if (well && this.scene.combos.roll('storm')) {
      for (const o of mobs) {
        if (o.dead || hit.has(o)) continue;
        if (Phaser.Math.Distance.Between(well.x, well.y, o.x, o.y) <= well.r) {
          this.scene.fx.bolt(well.x, well.y, o.x, o.y, 0x9be7ff);
          this.scene.hit(o, this, o.x, o.y, { dmg: this.dmg * 1.2, color: '#9be7ff', size: 13 });
        }
      }
      this.scene.fx.ripple(well.x, well.y, 0x9be7ff, 10, well.r);
    }
    this.scene.fx.flash(m.x, m.y, this.color, 0.6);
  }
}

export class GravityWell extends Weapon {
  selectFrom(list) { return MissilePod.prototype.selectFrom.call(this, list); }
  fire(target) {
    const m = this.muzzle();
    const a = Phaser.Math.Angle.Between(m.x, m.y, target.x, target.y);
    this.scene.spawnWellShot({
      x: m.x, y: m.y, vx: Math.cos(a) * this.def.speed, vy: Math.sin(a) * this.def.speed,
      tx: target.x, ty: target.y, color: this.color,
      well: { r: this.def.wellRadius * this.wm.radius, life: this.def.wellLife + this.wm.life, pull: this.def.pull, slow: this.def.slow, dps: this.dmg, weapon: this, color: this.color },
    });
    this.scene.fx.flash(m.x, m.y, this.color, 0.7);
  }
}

const CLASSES = { pulse: PulseCannon, railgun: Railgun, missile: MissilePod, laser: LaserBeam, tesla: TeslaArc, gravity: GravityWell };

export function createWeapon(scene, tower, type, slotIndex) {
  const C = CLASSES[type];
  if (!C) throw new Error('unknown weapon ' + type);
  return new C(scene, tower, type, slotIndex);
}
