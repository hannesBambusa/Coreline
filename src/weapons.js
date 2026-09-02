import { WEAPONS, CRIT } from './config.js';

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
    this.jammed = 0;      // seconds left of a Dreadnought jam (weapon fully disabled)
    this.jamSlow = 0;     // fire-rate multiplier while a Jammer holds a lock (0 = none)
  }
  /** overcharge and jammer effects on fire rate */
  get effectiveRateMul() { return this.scene.abilities.rateMul * (this.jamSlow ? this.jamSlow : 1); }
  get mods() { return this.scene.tree.mods; }
  get wm() { return this.mods.w[this.type]; }
  get lm() { return this.scene.levelMods; }
  get dmg() { return this.def.dmg * Math.pow(this.def.dmgMul, this.level - 1) * this.mods.dmg * this.wm.dmg * this.lm.dmg * (this.type === 'drones' ? this.lm.droneDmg : this.lm.otherDmg); }
  get rate() { return this.def.rate * Math.pow(this.def.rateMul, this.level - 1) * this.mods.rate * this.wm.rate * this.lm.rate; }
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
    this.cd -= dt * this.effectiveRateMul;
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
  get barrels() { return 1 + this.def.barrelsAt.filter(l => this.level >= l).length; }
  get pierce() { return this.def.pierceAt.filter(l => this.level >= l).length; }
  statLine() { return `<b>${this.dmg.toFixed(1)}</b> dmg · <b>${this.rate.toFixed(2)}</b>/s · <b>${this.barrels}</b> barrel${this.barrels > 1 ? 's' : ''}${this.pierce ? ' · pierce ' + this.pierce : ''} · <b>${(this.dps * this.barrels).toFixed(1)}</b> dps`; }
  nextLine() {
    const n = this.statsAt(this.level + 1), L = this.level + 1;
    const b = 1 + this.def.barrelsAt.filter(l => L >= l).length, p = this.def.pierceAt.filter(l => L >= l).length;
    const nextMile = [...this.def.barrelsAt.map(l => [l, 'barrel']), ...this.def.pierceAt.map(l => [l, 'pierce'])].filter(([l]) => l > this.level).sort((x, y) => x[0] - y[0])[0];
    return `<b>${n.dmg.toFixed(1)}</b> dmg · <b>${n.rate.toFixed(2)}</b>/s · <b>${b}</b> barrel${b > 1 ? 's' : ''}${p ? ' · pierce ' + p : ''} · <b>${(n.dps * b).toFixed(1)}</b> dps${nextMile ? ` · next ${nextMile[1]} at Lv ${nextMile[0]}` : ''}`;
  }
  fire(target) {
    const m = this.muzzle();
    const t = dist(m, target) / this.def.speed;
    const a = Phaser.Math.Angle.Between(m.x, m.y, target.x + target.vx * t, target.y + target.vy * t);
    const n = this.barrels;
    for (let i = 0; i < n; i++) {
      const sp = n > 1 ? (i - (n - 1) / 2) * 0.09 : 0;
      this.scene.spawnBullet({
        x: m.x, y: m.y, vx: Math.cos(a + sp) * this.def.speed, vy: Math.sin(a + sp) * this.def.speed,
        dmg: this.dmg, weapon: this, color: this.color, life: this.range / this.def.speed + 0.2, target,
        pierce: this.pierce, hitSet: this.pierce ? new Set() : null,
      });
    }
    this.scene.fx.flash(m.x, m.y, this.color, 0.5 + 0.15 * n);
    this.charged = Math.max(0, (this.charged || 0) - (1 / this.rate));
    if (this.tower.weapons.some(w => w.type === 'tesla') && !this.charged && this.scene.combos.roll('charged')) this.charged = 3;
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
    const lance = this.tower.weapons.some(w => w.type === 'shock') && this.scene.combos.roll('lance');
    const lanceMul = lance ? 1.5 : 1;
    for (const mob of mobs) {
      if (mob.dead) continue;
      const p = Phaser.Geom.Line.GetNearestPoint(line, mob, new Phaser.Geom.Point());
      if (dist(p, mob) <= mob.r + 6 && dist(m, mob) <= this.range) {
        this.scene.hit(mob, this, p.x, p.y, { color: this.prefers(mob) ? '#ffe66d' : '#ffffff', size: 14, mul: lanceMul });
        if (lance) { mob.dodgeVx += Math.cos(a) * 520; mob.dodgeVy += Math.sin(a) * 520; }
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
    if (lance) { this.scene.fx.line(m.x, m.y, ex, ey, 0x5eead4, 18, 0.3); }
    const pod = this.tower.weapons.find(w => w.type === 'missile');
    if (pod && hits && this.scene.combos.roll('buster')) {
      for (let i = 0; i < 3; i++) {
        const b = a + (i - 1) * 0.5;
        this.scene.spawnMissile({ x: m.x, y: m.y, vx: Math.cos(b) * 220, vy: Math.sin(b) * 220, speed: pod.def.speed * 1.4, turn: pod.def.turn * 2, dmg: pod.dmg * 1.2, weapon: pod, splash: pod.def.splash, color: 0xff9f43, life: 3, target });
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
    // Escort strike: every live drone fires a mini-missile at its own target
    const bay = this.tower.weapons.find(w => w.type === 'drones');
    if (bay && bay.drones.some(d => d.alive && d.target && !d.target.dead) && this.scene.combos.roll('escort')) {
      for (const d of bay.drones) {
        if (!d.alive) continue;
        const tg = d.target && !d.target.dead ? d.target : target;
        const ba = Math.atan2(d.vy, d.vx) + (Math.random() - 0.5) * 0.8;
        this.scene.spawnMissile({
          x: d.x, y: d.y, vx: Math.cos(ba) * 180, vy: Math.sin(ba) * 180,
          speed: this.def.speed * 1.3, turn: this.def.turn * 1.6, dmg: this.dmg * 0.6, weapon: this, splash: this.def.splash * 0.6,
          color: 0x60a5fa, life: 3, target: tg,
        });
        this.scene.fx.flash(d.x, d.y, 0x60a5fa, 0.6);
      }
      this.scene.sfx.shot('missile', this.tower.x);
    }
  }
}

export class LaserBeam extends Weapon {
  constructor(...a) { super(...a); this.held = 0; this.lastTarget = null; this.overload = 0; this.sweepCd = this.def.sweepEvery; this.sweepT = 0; this.forkTargets = []; }
  get dps() { return this.dmg; }
  /** continuous damage tick, credited to the laser */
  beamDamage(m, amount) { m.lastHit = 'laser'; m.takeDamage(amount, m.x, m.y, true); this.scene.addDmg('laser', m.lastDealt ?? 0); }
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
    if (this.target !== this.lastTarget) { this.held = this.overload > 0 ? this.def.rampTime : 0; this.lastTarget = this.target; }
    if (!this.target) return;
    this.held += dt;
    this.overload = Math.max(0, this.overload - dt);
    this.flare = Math.max(0, (this.flare || 0) - dt);
    const m = this.mount();
    this.angle = Phaser.Math.Angle.Between(m.x, m.y, this.target.x, this.target.y);
    const ramp = (1 + (this.def.rampMax + this.wm.rampMax - 1) * Math.min(1, this.held / this.def.rampTime)) * (this.overload > 0 ? 2.5 : 1);
    this.ramp = ramp;
    const ld = this.dmgVs(this.target) * ramp * dt * this.effectiveRateMul;
    this.beamDamage(this.target, ld);
    // Target paint: drones pile on the laser target
    const bay = this.tower.weapons.find(w => w.type === 'drones');
    if (bay && !this.target.marked && this.scene.combos.roll('paint')) { this.target.marked = 3; for (const d of bay.drones) d.target = this.target; this.scene.fx.ripple(this.target.x, this.target.y, 0xff3df2, this.target.r, this.target.r + 40); }
    // at full ramp: fork to nearby ships and charge a ring sweep
    const full = this.held >= this.def.rampTime;
    this.forkTargets = [];
    if (full) {
      const others = mobs.filter(o => !o.dead && o !== this.target && dist(this.tower, o) <= this.range).sort((a, b) => dist(this.target, a) - dist(this.target, b)).slice(0, this.def.forks);
      for (const o of others) {
        const fd = this.dmgVs(o) * ramp * this.def.forkDmg * dt * this.effectiveRateMul;
        this.beamDamage(o, fd);
        this.forkTargets.push(o);
      }
      this.sweepCd -= dt;
      if (this.sweepCd <= 0) {
        this.sweepCd = this.def.sweepEvery; this.sweepT = this.def.sweepDur;
        const burst = this.dmg * this.def.rampMax * this.def.sweepMul;
        let n = 0;
        for (const o of mobs) { if (o.dead || dist(this.tower, o) > this.range) continue; this.scene.hit(o, this, o.x, o.y, { dmg: burst * (this.prefers(o) ? this.def.bonus : 1), color: '#ff3df2', size: 14 }); n++; }
        this.scene.fx.ripple(this.tower.x, this.tower.y, this.color, this.tower.shieldR, this.range);
        this.scene.fx.flash(this.tower.x, this.tower.y, this.color, 2);
        this.scene.sfx.play('sweep', null, this.tower.x);
        this.scene.stats.procs.sweep = (this.scene.stats.procs.sweep || 0) + 1;
      }
    } else this.sweepCd = Math.min(this.sweepCd + dt * 0.5, this.def.sweepEvery);
    if (this.sweepT > 0) this.sweepT -= dt;
    if (Math.random() < dt * 8) this.scene.fx.spark(this.target.x, this.target.y, this.color, 2);
    // crit ticks: twice a second the beam can spike for an extra burst
    this.critTimer = (this.critTimer || 0) + dt;
    if (this.critTimer >= 0.5) {
      this.critTimer = 0;
      if (Math.random() < (this.def.crit ?? CRIT.chance)) {
        const burst = this.dmgVs(this.target) * ramp * 0.5 * ((this.def.critMul ?? CRIT.mul) - 1);
        this.scene.hit(this.target, this, this.target.x, this.target.y, { dmg: burst, noCrit: true, color: '#ffb703', size: 20, tag: '' });
        this.scene.fx.spark(this.target.x, this.target.y, 0xffb703, 8);
        this.scene.fx.ripple(this.target.x, this.target.y, 0xffb703, this.target.r, this.target.r + 22);
        this.flare = Math.max(this.flare || 0, 0.25);
      }
    }
  }
  draw(g) {
    if (this.sweepT > 0) {
      const k = 1 - this.sweepT / this.def.sweepDur, a = k * Math.PI * 2, tw = this.tower;
      for (let i = 0; i < 6; i++) { const aa = a - i * 0.12; g.lineStyle(6 - i, this.color, 0.7 - i * 0.1); g.lineBetween(tw.x, tw.y, tw.x + Math.cos(aa) * this.range, tw.y + Math.sin(aa) * this.range); }
      g.lineStyle(2, 0xffffff, 0.8); g.lineBetween(tw.x, tw.y, tw.x + Math.cos(a) * this.range, tw.y + Math.sin(a) * this.range);
    }
    if (!this.target || this.target.dead) return;
    const m = this.muzzle(10), t = this.target;
    for (const o of this.forkTargets) { if (o.dead) continue; g.lineStyle(4, this.color, 0.15); g.lineBetween(t.x, t.y, o.x, o.y); g.lineStyle(1.5, this.color, 0.7); g.lineBetween(t.x, t.y, o.x, o.y); }
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
  // prefer clusters that are not already sitting inside an active well
  selectFrom(list) {
    const wells = this.scene.wells;
    const free = list.filter(m => !wells.some(w => Phaser.Math.Distance.Between(w.x, w.y, m.x, m.y) <= w.r * 0.9));
    return MissilePod.prototype.selectFrom.call(this, free.length ? free : list);
  }
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

export class ShockEmitter extends Weapon {
  get push() { return this.def.push + this.def.pushPerLevel * (this.level - 1); }
  get cooldown() { return 1 / this.rate; }
  statLine() { return `<b>${this.dmg.toFixed(1)}</b> dmg · push <b>${Math.round(this.push)}</b> px · every <b>${this.cooldown.toFixed(1)}</b> s`; }
  nextLine() {
    const n = this.statsAt(this.level + 1), push = this.def.push + this.def.pushPerLevel * this.level;
    return `<b>${n.dmg.toFixed(1)}</b> dmg · push <b>${Math.round(push)}</b> px · every <b>${(1 / n.rate).toFixed(1)}</b> s`;
  }
  update(dt, mobs) {
    if (this.jammed > 0) { this.jammed -= dt; return; }
    this.cd -= dt * this.effectiveRateMul;
    this.angle += dt * 1.5;
    this.target = null;
    if (this.cd <= 0 && this.inRange(mobs).length) { this.fire(null, mobs); this.scene.sfx.play('shock', null, this.tower.x); this.cd = this.cooldown; }
  }
  fire(_, mobs) {
    const t = this.tower, R = this.range, push = this.push, sc = this.scene;
    let hits = 0;
    for (const m of mobs) {
      if (m.dead) continue;
      const d = dist(t, m);
      if (d > R + m.r) continue;
      const a = Phaser.Math.Angle.Between(t.x, t.y, m.x, m.y);
      const k = m.type === 'titan' ? 0.15 : (m.type === 'boss' || m.type === 'warden' || m.type === 'behemoth') ? 0.4 : 1;
      // knockback velocity decays as 0.02^t, so displacement = v / ln(50). Scale so `push` is real pixels.
      const f = push * (1 - 0.5 * d / R) * k * Math.log(50);
      m.dodgeVx += Math.cos(a) * f; m.dodgeVy += Math.sin(a) * f;
      if (m.attached) { m.attached = false; }     // knocks leeches off
      sc.hit(m, this, m.x, m.y, { color: '#5eead4' });
      hits++;
    }
    // clears enemy shots caught in the wave
    sc.enemyBullets = sc.enemyBullets.filter(b => Phaser.Math.Distance.Between(t.x, t.y, b.x, b.y) > R);
    // Collapse: a well inside the wave implodes
    const well = sc.wells.find(w => Phaser.Math.Distance.Between(t.x, t.y, w.x, w.y) <= R + w.r * 0.5);
    if (well && sc.combos.roll('collapse')) {
      for (const m of mobs) {
        if (m.dead) continue;
        const d = Phaser.Math.Distance.Between(well.x, well.y, m.x, m.y);
        if (d <= well.r) { const a = Phaser.Math.Angle.Between(m.x, m.y, well.x, well.y); m.x += Math.cos(a) * d * 0.85; m.y += Math.sin(a) * d * 0.85; m.dodgeVx = 0; m.dodgeVy = 0; }
      }
      sc.damageRadius(well.x, well.y, well.r * 0.6, this.dmg * 6, 0xc084fc, this);
      sc.fx.ripple(well.x, well.y, 0xc084fc, well.r, 10);
      sc.fx.explode(well.x, well.y, 0xffffff, 40);
      sc.fx.shake(0.01, 300);
      well.age = well.life;
    }
    // Scramble: drones get a burst
    const bay = t.weapons.find(w => w.type === 'drones');
    if (bay && sc.combos.roll('scramble')) { bay.boost = 3; for (const d of bay.drones) if (d.alive) { const a = Phaser.Math.Angle.Between(t.x, t.y, d.x, d.y); d.vx += Math.cos(a) * 400; d.vy += Math.sin(a) * 400; sc.fx.flash(d.x, d.y, 0x60a5fa, 0.8); } }
    this.ring = { r: t.shieldR, r1: R, a: 1 };
    sc.fx.ripple(t.x, t.y, this.color, t.shieldR, R);
    sc.fx.ripple(t.x, t.y, 0xffffff, t.shieldR, R * 0.8);
    sc.fx.flash(t.x, t.y, this.color, 2.5);
    sc.fx.shake(0.0025, 100);
  }
  draw(g) {
    if (!this.ring) return;
    const r = this.ring;
    r.r += (r.r1 - r.r) * 0.25; r.a -= 0.06;
    if (r.a <= 0) { this.ring = null; return; }
    g.lineStyle(14 * r.a, this.color, 0.25 * r.a); g.strokeCircle(this.tower.x, this.tower.y, r.r);
    g.lineStyle(3, 0xffffff, 0.6 * r.a); g.strokeCircle(this.tower.x, this.tower.y, r.r);
  }
}

export class DroneBay extends Weapon {
  constructor(...a) { super(...a); this.drones = []; this.focus = false; this.sync(); }
  get droneCount() { return Math.min(this.def.maxDrones, this.def.drones + Math.floor((this.level - 1) / this.def.dronePerLevels) + (this.wm.extra || 0)); }
  get droneHp() { return this.def.droneHp * Math.pow(this.def.droneHpMul, this.level - 1); }
  get respawn() { return this.def.respawn; }
  statLine() { return `<b>${this.droneCount}</b> drones · <b>${this.dmg.toFixed(1)}</b> dmg · <b>${this.rate.toFixed(2)}</b>/s each · <b>${Math.round(this.droneHp)}</b> hp`; }
  nextLine() {
    const n = this.statsAt(this.level + 1), cnt = Math.min(this.def.maxDrones, this.def.drones + Math.floor(this.level / this.def.dronePerLevels) + (this.wm.extra || 0));
    return `<b>${cnt}</b> drones · <b>${n.dmg.toFixed(1)}</b> dmg · <b>${n.rate.toFixed(2)}</b>/s · <b>${Math.round(this.droneHp * this.def.droneHpMul)}</b> hp`;
  }
  sync() {
    while (this.drones.length < this.droneCount) {
      const a = Math.random() * Math.PI * 2;
      this.drones.push({ x: this.tower.x + Math.cos(a) * 80, y: this.tower.y + Math.sin(a) * 80, vx: 0, vy: 0, hp: this.droneHp, alive: true, respawnT: 0, cd: Math.random(), ang: a, target: null, r: 7 });
    }
    if (this.drones.length > this.droneCount) this.drones.length = this.droneCount;
  }
  update(dt, mobs) {
    this.sync();
    if (this.jammed > 0) { this.jammed -= dt; return; }
    this.boost = Math.max(0, (this.boost || 0) - dt);
    const bm = this.boost > 0 ? 2 : 1;
    const t = this.tower, rm = this.effectiveRateMul * bm;
    for (const d of this.drones) {
      if (!d.alive) {
        d.respawnT -= dt;
        if (d.respawnT <= 0) { d.alive = true; d.hp = this.droneHp; d.x = t.x; d.y = t.y; this.scene.fx.flash(t.x, t.y, this.color, 0.8); }
        continue;
      }
      // pick target: ships outside every other gun's reach come first (farthest out), then nearest to the drone.
      // focus: all drones share one target. spread: each drone avoids targets other drones already have.
      const gunRange = Math.max(0, ...t.weapons.filter(w => w !== this).map(w => w.range));
      const outOfReach = (m) => dist(t, m) > gunRange;
      const taken = new Set(this.drones.filter(o => o !== d && o.alive && o.target && !o.target.dead).map(o => o.target));
      const nearest = (from, avoid) => { let best = null, bd = Infinity; for (const m of mobs) { if (m.dead || dist(t, m) > this.range || (avoid && taken.has(m))) continue; const dd = dist(from, m); if (dd < bd) { bd = dd; best = m; } } return best; };
      const farOut = (avoid) => { let best = null, bd = -1; for (const m of mobs) { if (m.dead || !outOfReach(m) || dist(t, m) > this.range || (avoid && taken.has(m))) continue; const dd = dist(t, m); if (dd > bd) { bd = dd; best = m; } } return best; };
      // idle drone (no target yet): out-of-reach ships first. engaged drone whose target died: nearest ship to it.
      const pick = (avoid, wasEngaged) => (wasEngaged ? null : farOut(avoid)) || nearest(d, avoid) || (avoid ? nearest(d, false) : null);
      if (this.focus) {
        const engaged = !!this.shared;
        if (!this.shared || this.shared.dead || dist(t, this.shared) > this.range) this.shared = pick(false, engaged && this.shared && this.shared.dead);
        d.target = this.shared;
      } else {
        const engaged = !!d.target;
        if (!d.target || d.target.dead || dist(t, d.target) > this.range) d.target = pick(true, engaged && d.target && d.target.dead);
        else if (!engaged) d.target = pick(true, false);
      }
      let tx, ty;
      if (d.target) {
        // hold ~70px off the target and circle it
        d.ang += dt * 2.5;
        tx = d.target.x + Math.cos(d.ang) * 70; ty = d.target.y + Math.sin(d.ang) * 70;
      } else {
        d.ang += dt * 1.2;
        tx = t.x + Math.cos(d.ang) * (t.shieldR + 40); ty = t.y + Math.sin(d.ang) * (t.shieldR + 40);
      }
      const a = Math.atan2(ty - d.y, tx - d.x), sp = this.def.droneSpeed * bm;
      d.vx += (Math.cos(a) * sp - d.vx) * Math.min(1, dt * 4); d.vy += (Math.sin(a) * sp - d.vy) * Math.min(1, dt * 4);
      d.x += d.vx * dt; d.y += d.vy * dt;
      for (const m of mobs) {
        if (m.dead || (m.type !== 'swarm' && m.type !== 'drone' && m.type !== 'bomber')) continue;
        if (dist(d, m) < d.r + m.r) { this.hurt(d, m.dmg * (m.type === 'bomber' ? 1 : 0.6)); if (m.type === 'bomber') { this.scene.fx.explode(m.x, m.y, m.def.color, 24); } m.die(false); break; }
      }
      if (Math.random() < dt * 20) this.scene.fx.trailAt(d.x - d.vx * 0.03, d.y - d.vy * 0.03, this.color);
      d.cd -= dt * rm;
      if (d.target && d.cd <= 0 && dist(d, d.target) < this.def.fireRange) {
        d.cd = 1 / this.rate;
        const fa = Phaser.Math.Angle.Between(d.x, d.y, d.target.x, d.target.y);
        this.scene.spawnBullet({ x: d.x, y: d.y, vx: Math.cos(fa) * this.def.speed, vy: Math.sin(fa) * this.def.speed, dmg: this.dmg, weapon: this, color: this.color, life: 0.4, target: d.target });
        this.scene.sfx.shot('pulse', d.x);
      }
    }
  }
  hurt(d, dmg) {
    if (!d.alive) return;
    d.hp -= dmg;
    this.scene.fx.spark(d.x, d.y, this.color, 3);
    if (d.hp <= 0) { d.alive = false; d.respawnT = this.respawn; this.scene.fx.explode(d.x, d.y, this.color, 14); this.scene.fx.floater(d.x, d.y - 10, 'drone lost', '#60a5fa', 11); this.scene.sfx.play('explode', 6, d.x); this.scene.tx.say('droneLost', 90); }
  }
  // enemy bullets can hit drones; scene calls this
  absorb(b) {
    for (const d of this.drones) {
      if (!d.alive) continue;
      if (Phaser.Math.Distance.Between(b.x, b.y, d.x, d.y) < d.r + 4) { this.hurt(d, b.dmg); return true; }
    }
    return false;
  }
  draw(g) {
    for (const d of this.drones) {
      if (!d.alive) continue;
      const a = Math.atan2(d.vy, d.vx);
      g.fillStyle(this.color, 1);
      g.fillTriangle(d.x + Math.cos(a) * 8, d.y + Math.sin(a) * 8, d.x + Math.cos(a + 2.4) * 6, d.y + Math.sin(a + 2.4) * 6, d.x + Math.cos(a - 2.4) * 6, d.y + Math.sin(a - 2.4) * 6);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(d.x, d.y, 2);
      if (d.hp < this.droneHp) { g.fillStyle(0x000000, 0.5); g.fillRect(d.x - 8, d.y - 12, 16, 2); g.fillStyle(this.color, 1); g.fillRect(d.x - 8, d.y - 12, 16 * d.hp / this.droneHp, 2); }
    }
    const alive = this.drones.filter(d => d.alive).length;
    if (alive < this.drones.length) { const m = this.mount(); g.lineStyle(1.5, this.color, 0.5); g.strokeCircle(m.x, m.y, 9); }
  }
}

const CLASSES = { pulse: PulseCannon, shock: ShockEmitter, drones: DroneBay, railgun: Railgun, missile: MissilePod, laser: LaserBeam, tesla: TeslaArc, gravity: GravityWell };

export function createWeapon(scene, tower, type, slotIndex) {
  const C = CLASSES[type];
  if (!C) throw new Error('unknown weapon ' + type);
  return new C(scene, tower, type, slotIndex);
}
