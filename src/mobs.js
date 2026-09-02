import { MOBS, SPAWN, COLORS, ELITES, SIEGE } from './config.js';

class Mob {
  constructor(scene, type, tier, x, y) {
    this.scene = scene; this.type = type; this.def = MOBS[type];
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = this.def.r;
    this.hpMax = this.def.hp * Math.pow(SPAWN.hpGrowth, tier - 1); this.hp = this.hpMax;
    this.dmg = this.def.dmg * Math.pow(SPAWN.dmgGrowth, tier - 1);
    this.scrap = Math.max(1, Math.round(this.def.scrap * Math.pow(SPAWN.scrapGrowth, tier - 1)));
    this.dead = false;
    this.hitFlash = 0;
    this.dodgeVx = 0; this.dodgeVy = 0;
    this.slow = 1;
    this.stun = 0;
    this.elite = null;
    this.sprite = scene.add.image(x, y, 'ship_' + type).setTint(this.def.color).setDepth(5);
    this.glow = scene.add.image(x, y, 'glow').setTint(this.def.color)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(this.r / 22).setAlpha(0.5).setDepth(2);
  }
  makeElite(mod) {
    const d = ELITES.mods[mod];
    this.elite = mod; this.eliteDef = d;
    if (d.hp) { this.hpMax *= d.hp; this.hp = this.hpMax; }
    if (d.speed) this.speedMul = d.speed;
    if (d.alpha) { this.sprite.setAlpha(d.alpha); this.glow.setAlpha(0.2); }
    this.scrap *= ELITES.scrapMul;
    this.glow.setScale(this.glow.scaleX * 1.8);
    this.scene.fx.floater(this.x, this.y - this.r - 14, d.name + ' ' + this.def.name, '#' + d.color.toString(16).padStart(6, '0'), 12);
  }
  get speedMul() { return this._speedMul || 1; }
  set speedMul(v) { this._speedMul = v; }
  get tower() { return this.scene.tower; }
  distToTower() { return Phaser.Math.Distance.Between(this.x, this.y, this.tower.x, this.tower.y); }
  angleToTower() { return Phaser.Math.Angle.Between(this.x, this.y, this.tower.x, this.tower.y); }

  takeDamage(amount, hx, hy, quiet = false) {
    if (this.dead) return false;
    this.hp -= amount;
    if (!quiet) { this.hitFlash = 0.08; this.scene.fx.spark(hx, hy, this.def.color, 3); }
    if (this.hp <= 0) { this.die(true); return true; }
    return false;
  }

  tryDodge() {
    const chance = (this.def.dodge || 0) + (this.eliteDef && this.eliteDef.dodge || 0);
    if (!chance || Math.random() > chance || this.stun > 0) return false;
    const a = this.angleToTower() + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    this.dodgeVx = Math.cos(a) * 320; this.dodgeVy = Math.sin(a) * 320;
    this.scene.fx.floater(this.x, this.y - 14, 'dodge', '#ff9f43', 11);
    return true;
  }

  die(killed) {
    this.dead = true;
    this.scene.fx.explode(this.x, this.y, this.def.color, killed ? 18 : 10);
    if (killed) this.scene.onKill(this);
    if (killed && this.elite === 'splitter') {
      for (let i = 0; i < this.eliteDef.spawn; i++) {
        const a = Math.random() * Math.PI * 2;
        const m = createMob(this.scene, 'swarm', this.scene.tier, this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10);
        m.dodgeVx = Math.cos(a) * 200; m.dodgeVy = Math.sin(a) * 200;
        this.scene.mobs.push(m);
      }
    }
    this.sprite.destroy(); this.glow.destroy();
  }

  eliteTick(dt) {
    if (this.elite === 'healer') {
      for (const o of this.scene.mobs) {
        if (o.dead || o.hp >= o.hpMax) continue;
        if (Phaser.Math.Distance.Between(this.x, this.y, o.x, o.y) <= this.eliteDef.radius) {
          o.hp = Math.min(o.hpMax, o.hp + o.hpMax * this.eliteDef.heal * dt);
        }
      }
      if (Math.random() < dt * 6) { const a = Math.random() * 6.28, rr = Math.random() * this.eliteDef.radius; this.scene.fx.trailAt(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr, this.eliteDef.color); }
    }
  }

  drawElite(g) {
    if (!this.elite) return;
    const p = 0.5 + 0.5 * Math.sin(this.scene.time.now / 150);
    g.lineStyle(2, this.eliteDef.color, 0.5 + p * 0.4);
    g.strokeCircle(this.x, this.y, this.r + 6);
    if (this.elite === 'healer') { g.lineStyle(1, this.eliteDef.color, 0.15); g.strokeCircle(this.x, this.y, this.eliteDef.radius); }
  }

  move(dt, ax, ay) {
    const k = this.slow * this.speedMul;
    this.vx = ax * k + this.dodgeVx; this.vy = ay * k + this.dodgeVy;
    this.slow = 1;
    this.dodgeVx *= Math.pow(0.02, dt); this.dodgeVy *= Math.pow(0.02, dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
  }

  update(dt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.sprite.setPosition(this.x, this.y).setTint(this.hitFlash > 0 ? 0xffffff : this.stun > 0 ? 0x9be7ff : this.def.color);
    this.glow.setPosition(this.x, this.y);
    if (this.elite) this.eliteTick(dt);
  }

  // called by the scene while stunned: drift only
  stunned(dt) {
    this.stun -= dt;
    this.dodgeVx *= Math.pow(0.02, dt); this.dodgeVy *= Math.pow(0.02, dt);
    this.x += this.dodgeVx * dt; this.y += this.dodgeVy * dt;
    this.vx = 0; this.vy = 0;
    if (Math.random() < dt * 10) this.scene.fx.spark(this.x + (Math.random() - 0.5) * this.r * 2, this.y + (Math.random() - 0.5) * this.r * 2, 0x9be7ff, 1);
    Mob.prototype.update.call(this, dt);
  }
}

export class Drone extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'drone', tier, x, y); this.wob = Math.random() * 10; }
  update(dt) {
    this.wob += dt * 6;
    const a = this.angleToTower();
    const s = this.def.speed;
    const side = Math.sin(this.wob) * 30;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(a);
    if (this.distToTower() < this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r) {
      this.tower.takeDamage(this.dmg, this.x, this.y);
      this.die(false);
    }
    super.update(dt);
  }
}

export class Raider extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'raider', tier, x, y);
    this.cd = 0.5 + Math.random();
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.preferred = this.def.range * (0.8 + Math.random() * 0.2);
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 10) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else {
      const t = a + Math.PI / 2 * this.orbitDir;
      const radial = (d < this.preferred - 10) ? -s * 0.5 : 0;
      ax = Math.cos(t) * s * 0.45 + Math.cos(a) * radial;
      ay = Math.sin(t) * s * 0.45 + Math.sin(a) * radial;
    }
    this.move(dt, ax, ay);
    this.sprite.setRotation(a);
    if (d <= this.def.range) {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 1 / this.def.fireRate;
        const spread = (Math.random() - 0.5) * 0.12;
        this.scene.spawnEnemyBullet({
          x: this.x + Math.cos(a) * this.r, y: this.y + Math.sin(a) * this.r,
          vx: Math.cos(a + spread) * this.def.bulletSpeed, vy: Math.sin(a + spread) * this.def.bulletSpeed,
          dmg: this.dmg, color: this.def.color,
        });
      }
    }
    super.update(dt);
  }
}

export class Swarm extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'swarm', tier, x, y); this.wob = Math.random() * 10; this.freq = 7 + Math.random() * 4; }
  update(dt) {
    this.wob += dt * this.freq;
    const a = this.angleToTower(), s = this.def.speed, side = Math.sin(this.wob) * 90;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(Math.atan2(this.vy, this.vx));
    if (this.distToTower() < this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r) {
      this.tower.takeDamage(this.dmg, this.x, this.y);
      this.die(false);
    }
    super.update(dt);
  }
}

export class Orbiter extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'orbiter', tier, x, y);
    this.cd = 1; this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.preferred = this.def.range * (0.85 + Math.random() * 0.1);
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 15) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else {
      const t = a + Math.PI / 2 * this.orbitDir;
      const radial = d < this.preferred - 15 ? -s * 0.6 : 0;
      ax = Math.cos(t) * s * 0.7 + Math.cos(a) * radial; ay = Math.sin(t) * s * 0.7 + Math.sin(a) * radial;
    }
    this.move(dt, ax, ay);
    this.sprite.setRotation(this.sprite.rotation + dt * 3);
    if (d <= this.def.range + 20) {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 1 / this.def.fireRate;
        this.scene.spawnEnemyBullet({
          x: this.x, y: this.y, vx: Math.cos(a) * this.def.bulletSpeed, vy: Math.sin(a) * this.def.bulletSpeed,
          dmg: this.dmg, color: this.def.color,
        });
      }
    }
    super.update(dt);
  }
}

export class Shielder extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'shielder', tier, x, y);
    const scale = this.hpMax / this.def.hp;
    this.shieldMax = this.def.shield * scale; this.shield = this.shieldMax;
    this.cd = 1.5; this.shieldHit = 0;
    this.preferred = this.def.range * 0.9;
  }
  takeDamage(amount, hx, hy, quiet) {
    if (this.dead) return false;
    if (this.shield > 0) {
      this.shield -= amount;
      this.shieldHit = 0.12;
      if (!quiet) this.scene.fx.spark(hx, hy, this.def.color, 2);
      if (this.shield < 0) { const spill = -this.shield; this.shield = 0; this.scene.fx.ripple(this.x, this.y, this.def.color, this.r + 8, this.r + 30); return super.takeDamage(spill, hx, hy, quiet); }
      return false;
    }
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    this.shieldHit = Math.max(0, this.shieldHit - dt);
    if (this.shield < this.shieldMax) this.shield = Math.min(this.shieldMax, this.shield + this.def.shieldRegen * dt);
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    if (d > this.preferred) this.move(dt, Math.cos(a) * s, Math.sin(a) * s); else this.move(dt, 0, 0);
    this.sprite.setRotation(a);
    if (d <= this.def.range) {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 1 / this.def.fireRate;
        this.scene.spawnEnemyBullet({
          x: this.x, y: this.y, vx: Math.cos(a) * this.def.bulletSpeed, vy: Math.sin(a) * this.def.bulletSpeed,
          dmg: this.dmg, color: this.def.color,
        });
      }
    }
    super.update(dt);
  }
  drawExtra(g) {
    if (this.shield <= 0) return;
    const f = this.shield / this.shieldMax;
    g.lineStyle(1 + 3 * f, this.def.color, this.shieldHit > 0 ? 0.9 : 0.25 + f * 0.3);
    g.strokeCircle(this.x, this.y, this.r + 9);
  }
}

export class Boss extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'boss', tier, x, y);
    this.cd = 2; this.spawnCd = this.def.spawnEvery; this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.preferred = this.def.range * 0.9; this.phase = 1; this.spin = 0;
    this.glow.setScale(this.r / 14).setAlpha(0.6);
    this.scene.fx.shake(0.01, 400);
  }
  update(dt) {
    this.spin += dt * (this.phase === 2 ? 2.5 : 1);
    if (this.phase === 1 && this.hp < this.hpMax * 0.5) {
      this.phase = 2;
      this.scene.ui.banner('Overseer enraged', true);
      this.scene.fx.explode(this.x, this.y, this.def.color, 40);
      this.scene.fx.shake(0.012, 400);
    }
    const mul = this.phase === 2 ? 1.6 : 1;
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed * mul;
    let ax = 0, ay = 0;
    if (d > this.preferred + 20) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else {
      const t = a + Math.PI / 2 * this.orbitDir;
      const radial = d < this.preferred - 20 ? -s * 0.5 : 0;
      ax = Math.cos(t) * s * 0.6 + Math.cos(a) * radial; ay = Math.sin(t) * s * 0.6 + Math.sin(a) * radial;
    }
    this.move(dt, ax, ay);
    this.sprite.setRotation(this.spin * 0.5);
    if (d <= this.def.range + 30) {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 1 / (this.def.fireRate * mul);
        for (let i = 0; i < this.def.burst; i++) {
          const sp = (i - (this.def.burst - 1) / 2) * 0.18;
          this.scene.spawnEnemyBullet({
            x: this.x, y: this.y, vx: Math.cos(a + sp) * this.def.bulletSpeed, vy: Math.sin(a + sp) * this.def.bulletSpeed,
            dmg: this.dmg, color: this.def.color,
          });
        }
      }
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = this.def.spawnEvery / mul;
      for (let i = 0; i < this.def.spawnCount; i++) {
        const aa = Math.random() * Math.PI * 2;
        const m = createMob(this.scene, 'drone', this.scene.tier, this.x + Math.cos(aa) * this.r, this.y + Math.sin(aa) * this.r);
        this.scene.mobs.push(m);
      }
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 40);
    }
    super.update(dt);
  }
  die(killed) {
    if (killed) {
      this.scene.fx.shake(0.02, 700);
      this.scene.fx.explode(this.x, this.y, 0xffffff, 40);
      const frag = this.def.fragments + this.scene.tree.mods.bossFrag;
      this.scene.state.fragments += frag;
      this.scene.fx.floater(this.x, this.y - 40, `+${frag} fragment${frag > 1 ? 's' : ''}`, '#c084fc', 18);
      this.scene.ui.banner('Overseer destroyed', true);
    }
    super.die(killed);
  }
  drawExtra(g) {
    for (let i = 0; i < 3; i++) {
      g.lineStyle(2, this.def.color, 0.6);
      g.beginPath(); g.arc(this.x, this.y, this.r + 6 + i * 5, this.spin * (i % 2 ? -1 : 1) + i, this.spin * (i % 2 ? -1 : 1) + i + 1.6, false); g.strokePath();
    }
  }
}

export class Mine extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'mine', tier, x, y);
    this.fuse = this.def.fuse; this.blink = 0;
    this.sprite.setScale(0.9);
  }
  update(dt) {
    this.fuse -= dt; this.blink += dt * (this.fuse < 3 ? 12 : 4);
    const a = this.angleToTower(), s = this.def.speed;
    this.move(dt, Math.cos(a) * s, Math.sin(a) * s);
    this.sprite.setRotation(this.blink * 0.3).setAlpha(0.6 + 0.4 * Math.abs(Math.sin(this.blink)));
    const reach = this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r;
    if (this.distToTower() < reach || this.fuse <= 0) this.detonate();
    super.update(dt);
  }
  detonate() {
    if (this.dead) return;
    if (this.distToTower() < this.tower.shieldR + 60) this.tower.takeDamage(this.dmg, this.x, this.y);
    this.scene.damageDrones(this.x, this.y, 70, this.dmg);
    this.scene.fx.explode(this.x, this.y, this.def.color, 30);
    this.scene.fx.ripple(this.x, this.y, this.def.color, 8, 70);
    this.scene.fx.shake(0.004, 120);
    this.scene.sfx.play('explode', 16, this.x);
    this.die(false);
  }
  drawExtra(g) {
    const f = this.fuse < 3 ? 0.9 : 0.4;
    g.lineStyle(1.5, this.def.color, f); g.strokeCircle(this.x, this.y, this.r + 4);
  }
}

// ---------- roster additions ----------
export class Bomber extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'bomber', tier, x, y); this.fuse = 0; }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    const sprint = d < 260 ? this.def.sprint : 1;
    this.move(dt, Math.cos(a) * this.def.speed * sprint, Math.sin(a) * this.def.speed * sprint);
    this.sprite.setRotation(a);
    if (sprint > 1) { this.fuse += dt; this.sprite.setTint(Math.sin(this.fuse * 25) > 0 ? 0xffffff : this.def.color); if (Math.random() < dt * 20) this.scene.fx.trailAt(this.x - Math.cos(a) * this.r, this.y - Math.sin(a) * this.r, this.def.color); }
    if (d < this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r) {
      this.tower.takeDamage(this.dmg, this.x, this.y);
      this.scene.damageDrones(this.x, this.y, this.def.blast, this.dmg);
      this.scene.fx.explode(this.x, this.y, this.def.color, 40);
      this.scene.fx.ripple(this.x, this.y, this.def.color, 10, this.def.blast);
      this.scene.fx.shake(0.006, 200);
      this.scene.sfx.play('explode', 20, this.x);
      this.die(false);
    }
    Mob.prototype.update.call(this, dt);
    if (sprint > 1 && !this.dead) this.sprite.setTint(Math.sin(this.fuse * 25) > 0 ? 0xffffff : this.def.color);
  }
}

export class Leech extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'leech', tier, x, y); this.attached = false; this.ang = 0; this.pulse = 0; }
  update(dt) {
    const t = this.tower;
    if (!this.attached) {
      const d = this.distToTower(), a = this.angleToTower();
      this.move(dt, Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
      this.sprite.setRotation(a);
      if (d <= t.shieldR + this.r + 2) { this.attached = true; this.ang = Phaser.Math.Angle.Between(t.x, t.y, this.x, this.y); this.scene.fx.ripple(this.x, this.y, this.def.color, 4, 30); }
    } else {
      this.ang += dt * 0.15;
      const rr = (t.shield > 0 ? t.shieldR : t.r) + this.r;
      this.x = t.x + Math.cos(this.ang) * rr; this.y = t.y + Math.sin(this.ang) * rr; this.vx = 0; this.vy = 0;
      this.sprite.setRotation(this.ang + Math.PI);
      this.pulse += dt;
      const drain = this.def.drain * Math.pow(SPAWN.dmgGrowth, this.scene.tier - 1) * dt;
      if (t.shield > 0) t.shield = Math.max(0, t.shield - drain); else t.takeDamage(drain, this.x, this.y);
      if (Math.random() < dt * 8) this.scene.fx.trailAt(this.x, this.y, this.def.color);
    }
    super.update(dt);
  }
  drawExtra(g) { if (this.attached) { g.lineStyle(2, this.def.color, 0.5 + 0.3 * Math.sin(this.pulse * 8)); g.strokeCircle(this.x, this.y, this.r + 4); } }
}

export class Phantom extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'phantom', tier, x, y); this.phased = false; this.pt = Math.random() * this.def.phaseOff; this.cd = 1; this.orbitDir = Math.random() < 0.5 ? 1 : -1; this.preferred = this.def.range * 0.85; }
  takeDamage(amount, hx, hy, quiet) {
    if (this.phased) { if (!quiet && Math.random() < 0.3) this.scene.fx.floater(hx, hy - 8, 'phased', '#c084fc', 10); return false; }
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    this.pt -= dt;
    if (this.pt <= 0) { this.phased = !this.phased; this.pt = this.phased ? this.def.phaseOn : this.def.phaseOff; this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 16); }
    this.sprite.setAlpha(this.phased ? 0.25 : 1); this.glow.setAlpha(this.phased ? 0.1 : 0.5);
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 10) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else { const t = a + Math.PI / 2 * this.orbitDir; ax = Math.cos(t) * s * 0.6; ay = Math.sin(t) * s * 0.6; }
    this.move(dt, ax, ay); this.sprite.setRotation(a);
    if (!this.phased && d <= this.def.range) { this.cd -= dt; if (this.cd <= 0) { this.cd = 1 / this.def.fireRate; this.scene.spawnEnemyBullet({ x: this.x, y: this.y, vx: Math.cos(a) * this.def.bulletSpeed, vy: Math.sin(a) * this.def.bulletSpeed, dmg: this.dmg, color: this.def.color }); } }
    super.update(dt);
  }
}

export class Hydra extends Mob {
  constructor(scene, tier, x, y, gen = 0) {
    super(scene, 'hydra', tier, x, y);
    this.gen = gen;
    const k = Math.pow(0.55, gen);
    this.hpMax *= k; this.hp = this.hpMax; this.r = Math.max(7, this.def.r * Math.pow(0.75, gen)); this.scrap = Math.max(1, Math.round(this.scrap * k));
    this.sprite.setScale(Math.pow(0.75, gen)); this.glow.setScale(this.r / 22);
    this.wob = Math.random() * 10;
  }
  update(dt) {
    this.wob += dt * 4;
    const a = this.angleToTower(), s = this.def.speed * (1 + this.gen * 0.3), side = Math.sin(this.wob) * 40;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(a);
    if (this.distToTower() < this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r) { this.tower.takeDamage(this.dmg, this.x, this.y); this.die(false); }
    super.update(dt);
  }
  die(killed) {
    if (killed && this.gen < this.def.gens) {
      for (let i = 0; i < this.def.splits; i++) {
        const a = Math.random() * Math.PI * 2;
        const h = new Hydra(this.scene, this.scene.tier, this.x + Math.cos(a) * 8, this.y + Math.sin(a) * 8, this.gen + 1);
        h.dodgeVx = Math.cos(a) * 180; h.dodgeVy = Math.sin(a) * 180;
        this.scene.mobs.push(h);
      }
    }
    super.die(killed);
  }
}

export class Sniper extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'sniper', tier, x, y); this.cd = this.def.cooldown * 0.6; this.aim = 0; this.preferred = this.def.range * 0.95; this.orbitDir = Math.random() < 0.5 ? 1 : -1; }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 10) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else if (this.aim <= 0) { const t = a + Math.PI / 2 * this.orbitDir; ax = Math.cos(t) * s * 0.3; ay = Math.sin(t) * s * 0.3; }
    this.move(dt, ax, ay); this.sprite.setRotation(a);
    if (d <= this.def.range + 20) {
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) {
          this.scene.spawnEnemyBullet({ x: this.x, y: this.y, vx: Math.cos(a) * this.def.bulletSpeed, vy: Math.sin(a) * this.def.bulletSpeed, dmg: this.dmg, color: this.def.color });
          this.scene.fx.line(this.x, this.y, this.tower.x, this.tower.y, 0xffffff, 3, 0.15);
          this.scene.sfx.shot('railgun', this.x);
          this.cd = this.def.cooldown;
        }
      } else { this.cd -= dt; if (this.cd <= 0) this.aim = this.def.aim; }
    }
    super.update(dt);
  }
  drawExtra(g) {
    if (this.aim > 0) { const k = 1 - this.aim / this.def.aim; g.lineStyle(1 + k * 2, 0xffffff, 0.15 + 0.5 * k); g.lineBetween(this.x, this.y, this.tower.x, this.tower.y); }
  }
}

export class Carrier extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'carrier', tier, x, y); this.hangar = this.def.hangarEvery * 0.5; this.preferred = this.def.range * 0.9; this.orbitDir = Math.random() < 0.5 ? 1 : -1; this.sprite.setScale(1.2); }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 10) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else { const t = a + Math.PI / 2 * this.orbitDir; ax = Math.cos(t) * s * 0.5; ay = Math.sin(t) * s * 0.5; }
    this.move(dt, ax, ay); this.sprite.setRotation(a);
    this.hangar -= dt;
    if (this.hangar <= 0 && d <= this.def.range + 40) {
      this.hangar = this.def.hangarEvery;
      for (let i = 0; i < this.def.hangarCount; i++) { const m = createMob(this.scene, 'drone', this.scene.tier, this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r); m.dodgeVx = Math.cos(a + (i - 0.5) * 0.6) * 160; m.dodgeVy = Math.sin(a + (i - 0.5) * 0.6) * 160; this.scene.mobs.push(m); }
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 24);
    }
    super.update(dt);
  }
  drawExtra(g) { g.lineStyle(1, this.def.color, 0.4); g.strokeRect(this.x - 10, this.y - 4, 20, 8); }
}

export class Jammer extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'jammer', tier, x, y); this.cd = 1; this.preferred = this.def.range * 0.9; this.orbitDir = Math.random() < 0.5 ? 1 : -1; this.slot = null; this.spin = 0; }
  update(dt) {
    this.spin += dt * 4;
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 10) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else { const t = a + Math.PI / 2 * this.orbitDir; ax = Math.cos(t) * s * 0.6; ay = Math.sin(t) * s * 0.6; }
    this.move(dt, ax, ay); this.sprite.setRotation(this.spin);
    if (d <= this.def.range + 30) {
      if (!this.slot) { const ws = this.tower.weapons.filter(w => !w.jamSlow); if (ws.length) { this.slot = ws[Math.floor(Math.random() * ws.length)]; this.scene.fx.bolt(this.x, this.y, this.slot.mount().x, this.slot.mount().y, this.def.color); this.scene.ui.banner(this.slot.def.name + ' being jammed', true); } }
      if (this.slot) this.slot.jamSlow = this.def.slow;
      this.cd -= dt; if (this.cd <= 0) { this.cd = 1 / this.def.fireRate; this.scene.spawnEnemyBullet({ x: this.x, y: this.y, vx: Math.cos(a) * this.def.bulletSpeed, vy: Math.sin(a) * this.def.bulletSpeed, dmg: this.dmg, color: this.def.color }); }
    }
    super.update(dt);
  }
  die(killed) { if (this.slot) this.slot.jamSlow = 0; super.die(killed); }
  drawExtra(g) { if (this.slot) { const m = this.slot.mount(); g.lineStyle(1, this.def.color, 0.25 + 0.2 * Math.sin(this.spin * 3)); g.lineBetween(this.x, this.y, m.x, m.y); } }
}

export class Siphon extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'siphon', tier, x, y); this.preferred = this.def.range * 0.9; this.orbitDir = Math.random() < 0.5 ? 1 : -1; this.tethered = false; this.pulse = 0; }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 10) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else { const t = a + Math.PI / 2 * this.orbitDir; ax = Math.cos(t) * s * 0.35; ay = Math.sin(t) * s * 0.35; }
    this.move(dt, ax, ay); this.sprite.setRotation(a);
    this.tethered = d <= this.def.range + 20;
    if (this.tethered) {
      this.pulse += dt;
      const t = this.tower, drain = this.def.drain * Math.pow(SPAWN.dmgGrowth, this.scene.tier - 1) * dt;
      if (t.shield > 0) { const took = Math.min(t.shield, drain); t.shield -= took; this.hp = Math.min(this.hpMax, this.hp + took * 2); t.regenDelay = Math.max(t.regenDelay, 0.5); t.sinceHit = 0; }
      if (Math.random() < dt * 14) { const k = Math.random(); this.scene.fx.trailAt(t.x + (this.x - t.x) * k, t.y + (this.y - t.y) * k, this.def.color); }
    }
    super.update(dt);
  }
  drawExtra(g) {
    if (!this.tethered) return;
    const t = this.tower, w = 1.5 + Math.sin(this.pulse * 10);
    g.lineStyle(w * 3, this.def.color, 0.12); g.lineBetween(this.x, this.y, t.x, t.y);
    g.lineStyle(w, this.def.color, 0.7); g.lineBetween(this.x, this.y, t.x, t.y);
  }
}

export class Beacon extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'beacon', tier, x, y); this.parked = false; this.warp = this.def.warpEvery * 0.4; this.spin = 0; }
  update(dt) {
    this.spin += dt * 2;
    if (!this.parked) {
      const d = this.distToTower(), a = this.angleToTower();
      this.move(dt, Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
      if (d <= this.def.range) { this.parked = true; this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 50); }
    } else {
      this.move(dt, 0, 0);
      this.warp -= dt;
      if (this.warp <= 0) {
        this.warp = this.def.warpEvery;
        const pool = ['drone', 'raider', 'swarm', 'drone'];
        for (let i = 0; i < this.def.warpCount; i++) {
          const a = Math.random() * Math.PI * 2, m = createMob(this.scene, pool[Math.floor(Math.random() * pool.length)], this.scene.tier, this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 30);
          this.scene.fx.flash(m.x, m.y, this.def.color, 0.8);
          this.scene.mobs.push(m);
        }
        this.scene.fx.ripple(this.x, this.y, this.def.color, 10, 60);
        this.scene.sfx.play('ability', 'burst');
      }
    }
    this.sprite.setRotation(this.spin);
    super.update(dt);
  }
  drawExtra(g) {
    if (!this.parked) return;
    for (let i = 0; i < 2; i++) { g.lineStyle(1.5, this.def.color, 0.5); g.beginPath(); g.arc(this.x, this.y, this.r + 8 + i * 6, this.spin * (i ? -1 : 1), this.spin * (i ? -1 : 1) + 2.4, false); g.strokePath(); }
    const k = 1 - this.warp / this.def.warpEvery; g.lineStyle(2, 0xffffff, 0.2 + 0.6 * k); g.strokeCircle(this.x, this.y, 4 + k * 10);
  }
}

export class Behemoth extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'behemoth', tier, x, y); this.sprite.setScale(1.3); this.glow.setScale(this.r / 12).setAlpha(0.4); }
  takeDamage(amount, hx, hy, quiet, crit) {
    if (!crit) amount *= this.def.armour;
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    const a = this.angleToTower();
    this.move(dt, Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
    this.sprite.setRotation(a);
    if (this.distToTower() < this.tower.shieldR * (this.tower.shield > 0 ? 1 : 0) + this.tower.r + this.r) {
      this.tower.takeDamage(this.dmg, this.x, this.y);
      this.scene.fx.explode(this.x, this.y, this.def.color, 40); this.scene.fx.shake(0.01, 300);
      this.die(false);
    }
    super.update(dt);
  }
  drawExtra(g) { g.lineStyle(3, this.def.color, 0.5); g.strokeCircle(this.x, this.y, this.r + 4); }
}

export class Titan extends Mob {
  constructor(scene, tier, x, y, level = 1) {
    super(scene, 'titan', tier, x, y);
    this.level = level;
    const mul = SIEGE.hpMul + SIEGE.hpMulPerLevel * (level - 1);
    this.hpMax *= mul; this.hp = this.hpMax;
    this.scrap = Math.round(this.scrap * (1 + 0.5 * (level - 1)));
    this.arc = this.def.shieldArc + SIEGE.arcPerLevel * (level - 1);
    this.arcAngle = 0; this.spin = 0;
    this.beamCd = this.def.beamEvery * 0.6; this.beamState = 'idle'; this.beamT = 0;
    this.bayCd = this.def.bayEvery; this.cd = 2;
    this.jamCd = this.def.jamEvery;
    this.blinkCd = this.def.blinkEvery * 0.8; this.blinkState = 'idle'; this.blinkT = 0;
    this.mineCd = this.def.mineEvery * 0.5;
    this.phase = 1; this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.preferred = this.def.keepDistance;
    this.sprite.setScale(1.6); this.glow.setScale(this.r / 10).setAlpha(0.7);
    this.scene.fx.shake(0.015, 800);
  }
  // hits that land on the shielded sector are absorbed
  takeDamage(amount, hx, hy, quiet) {
    if (this.dead) return false;
    const a = Phaser.Math.Angle.Between(this.x, this.y, hx, hy);
    const d = Math.abs(Phaser.Math.Angle.Wrap(a - this.arcAngle));
    if (d < this.arc / 2) {
      this.arcHit = 0.15;
      if (!quiet) { this.scene.fx.spark(hx, hy, 0x9be7ff, 4); this.scene.fx.floater(hx, hy - 10, 'blocked', '#9be7ff', 11); }
      return false;
    }
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    const mul = this.phase === 2 ? 1.3 : 1;
    this.spin += dt * 0.4 * mul;
    this.arcAngle += dt * this.def.arcSpeed * mul * this.orbitDir;
    this.arcHit = Math.max(0, (this.arcHit || 0) - dt);
    if (this.phase === 1 && this.hp < this.hpMax * 0.3) {
      this.phase = 2;
      this.scene.ui.banner('Dreadnought enraged', true);
      this.scene.fx.explode(this.x, this.y, this.def.color, 60);
      this.scene.fx.shake(0.015, 500);
    }
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed * mul;
    let ax = 0, ay = 0;
    if (d > this.preferred + 20) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else if (d < this.preferred - 30) { ax = -Math.cos(a) * s * 1.5; ay = -Math.sin(a) * s * 1.5; }   // never closer than keepDistance
    else {
      const t = a + Math.PI / 2 * this.orbitDir;
      ax = Math.cos(t) * s * 0.5; ay = Math.sin(t) * s * 0.5;
    }
    if (this.beamState === 'fire' || this.blinkState !== 'idle') { ax = 0; ay = 0; }
    this.move(dt, ax, ay);

    // blink: charge (flicker) -> vanish -> reappear at a new angle, same distance, with a bullet ring
    if (this.blinkState === 'idle') {
      if (this.beamState === 'idle') this.blinkCd -= dt * mul;
      if (this.blinkCd <= 0 && d < this.def.range + 100) { this.blinkState = 'charge'; this.blinkT = this.def.blinkCharge; this.scene.sfx.play('ability', 'emp'); }
    } else if (this.blinkState === 'charge') {
      this.blinkT -= dt;
      this.sprite.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.blinkT * 40)));
      if (Math.random() < dt * 40) { const aa = Math.random() * 6.28, rr = this.r + Math.random() * 30; this.scene.fx.trailAt(this.x + Math.cos(aa) * rr, this.y + Math.sin(aa) * rr, 0x9be7ff); }
      if (this.blinkT <= 0) {
        this.scene.fx.ripple(this.x, this.y, 0x9be7ff, this.r + 20, 10);
        this.scene.fx.explode(this.x, this.y, 0x9be7ff, 30);
        const na = this.angleToTower() + Math.PI + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + Math.random() * Math.PI / 2);
        const nd = Math.max(this.preferred, Math.min(d, this.preferred + 80));
        this.x = this.tower.x + Math.cos(na) * nd; this.y = this.tower.y + Math.sin(na) * nd;
        this.blinkState = 'arrive'; this.blinkT = 0.35;
        this.sprite.setAlpha(1);
        this.scene.fx.ripple(this.x, this.y, 0x9be7ff, 10, this.r + 60);
        this.scene.fx.flash(this.x, this.y, 0x9be7ff, 4);
        this.scene.fx.shake(0.008, 250);
        this.scene.sfx.play('ability', 'burst');
        const ta = this.angleToTower();
        for (let i = 0; i < this.def.blinkRing; i++) {
          const ba = ta + (i - this.def.blinkRing / 2) * (Math.PI * 1.2 / this.def.blinkRing);
          this.scene.spawnEnemyBullet({ x: this.x, y: this.y, vx: Math.cos(ba) * this.def.bulletSpeed * 1.2, vy: Math.sin(ba) * this.def.bulletSpeed * 1.2, dmg: this.dmg * 0.5, color: 0x9be7ff });
        }
        for (const w of this.tower.weapons) if (w.target === this) w.target = null;
      }
    } else if (this.blinkState === 'arrive') {
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkState = 'idle'; this.blinkCd = this.def.blinkEvery; }
    }

    // mines
    this.mineCd -= dt * mul;
    if (this.mineCd <= 0 && this.blinkState === 'idle') {
      this.mineCd = this.def.mineEvery;
      for (let i = 0; i < this.def.mineCount; i++) {
        const aa = this.angleToTower() + (i - (this.def.mineCount - 1) / 2) * 0.5;
        const m = new Mine(this.scene, this.scene.tier, this.x + Math.cos(aa) * (this.r + 10), this.y + Math.sin(aa) * (this.r + 10));
        m.dodgeVx = Math.cos(aa) * 220; m.dodgeVy = Math.sin(aa) * 220;
        this.scene.mobs.push(m);
      }
      this.scene.ui.banner('Mines deployed', true);
    }
    this.sprite.setRotation(this.spin);

    // spread bursts
    if (d <= this.def.range + 40 && this.beamState === 'idle') {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 1 / (this.def.fireRate * mul);
        for (let i = 0; i < this.def.burst; i++) {
          const sp = (i - (this.def.burst - 1) / 2) * 0.16;
          this.scene.spawnEnemyBullet({ x: this.x, y: this.y, vx: Math.cos(a + sp) * this.def.bulletSpeed, vy: Math.sin(a + sp) * this.def.bulletSpeed, dmg: this.dmg, color: this.def.color });
        }
      }
    }
    // drone bays
    this.bayCd -= dt * mul;
    if (this.bayCd <= 0) {
      this.bayCd = this.def.bayEvery;
      for (let i = 0; i < this.def.bayCount; i++) {
        const aa = Math.random() * Math.PI * 2;
        const m = createMob(this.scene, i % 3 === 2 ? 'swarm' : 'drone', this.scene.tier, this.x + Math.cos(aa) * this.r, this.y + Math.sin(aa) * this.r);
        m.dodgeVx = Math.cos(aa) * 150; m.dodgeVy = Math.sin(aa) * 150;
        this.scene.mobs.push(m);
      }
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 60);
    }
    // siege beam: charge (telegraph) -> fire -> idle
    if (this.beamState === 'idle') {
      this.beamCd -= dt * mul;
      if (this.beamCd <= 0 && d <= this.def.range + 80) { this.beamState = 'charge'; this.beamT = this.def.beamCharge; this.scene.ui.banner('Dreadnought charging', true); this.scene.sfx.play('boss'); }
    } else if (this.beamState === 'charge') {
      this.beamT -= dt;
      if (Math.random() < dt * 20) this.scene.fx.trailAt(this.x + (Math.random() - 0.5) * this.r, this.y + (Math.random() - 0.5) * this.r, 0xffffff);
      if (this.beamT <= 0) { this.beamState = 'fire'; this.beamT = this.def.beamDur; this.scene.fx.shake(0.01, 300); }
    } else if (this.beamState === 'fire') {
      this.beamT -= dt;
      const beamDmg = this.def.beamDps * Math.pow(SPAWN.dmgGrowth, this.scene.tier - 1) * dt * (1 + 0.3 * (this.level - 1));
      this.tower.takeDamage(beamDmg, this.tower.x + Math.cos(a + Math.PI) * this.tower.shieldR, this.tower.y + Math.sin(a + Math.PI) * this.tower.shieldR, true);
      this.scene.damageDrones(0, 0, 22, beamDmg * 2, new Phaser.Geom.Line(this.x, this.y, this.tower.x, this.tower.y));
      if (Math.random() < dt * 30) this.scene.fx.spark(this.tower.x + Math.cos(a + Math.PI) * this.tower.shieldR, this.tower.y + Math.sin(a + Math.PI) * this.tower.shieldR, 0xff4d6d, 2);
      if (this.beamT <= 0) { this.beamState = 'idle'; this.beamCd = this.def.beamEvery; }
    }
    // level 2+: jam a hardpoint
    if (this.level >= 2) {
      this.jamCd -= dt;
      if (this.jamCd <= 0) {
        this.jamCd = this.def.jamEvery;
        const ws = this.tower.weapons.filter(w => !w.jammed);
        if (ws.length) { const w = ws[Math.floor(Math.random() * ws.length)]; w.jammed = this.def.jamDur; this.scene.ui.banner(w.def.name + ' jammed', true); this.scene.fx.bolt(this.x, this.y, w.mount().x, w.mount().y, 0xff4d6d); }
      }
    }
    super.update(dt);
  }
  die(killed) {
    if (killed) {
      this.scene.fx.shake(0.03, 1200);
      this.scene.fx.explode(this.x, this.y, 0xffffff, 80);
      this.scene.fx.explode(this.x, this.y, this.def.color, 80);
      for (let i = 0; i < 8; i++) this.scene.time.delayedCall(i * 120, () => this.scene.fx.explode(this.x + (Math.random() - 0.5) * this.r * 2, this.y + (Math.random() - 0.5) * this.r * 2, i % 2 ? 0xffffff : this.def.color, 25));
      this.scene.flashScreen(0.6, 0xff4d6d);
      this.scene.sfx.play('bigExplode', null, this.x);
    }
    super.die(killed);
  }
  drawExtra(g) {
    // rotating shield sector
    const f = this.arcHit > 0 ? 0.9 : 0.45;
    g.lineStyle(this.arcHit > 0 ? 8 : 5, 0x9be7ff, f);
    g.beginPath(); g.arc(this.x, this.y, this.r + 14, this.arcAngle - this.arc / 2, this.arcAngle + this.arc / 2, false); g.strokePath();
    g.lineStyle(1, 0x9be7ff, 0.2); g.strokeCircle(this.x, this.y, this.r + 14);
    // hull rings
    for (let i = 0; i < 3; i++) { g.lineStyle(2, this.def.color, 0.5); g.beginPath(); g.arc(this.x, this.y, this.r + 4 + i * 4, this.spin * (i % 2 ? -1.5 : 1.5) + i, this.spin * (i % 2 ? -1.5 : 1.5) + i + 2, false); g.strokePath(); }
    // blink telegraph
    if (this.blinkState === 'charge') {
      const k = 1 - this.blinkT / this.def.blinkCharge;
      g.lineStyle(3, 0x9be7ff, 0.5 + 0.5 * k); g.strokeCircle(this.x, this.y, this.r + 22 - k * 20);
      g.lineStyle(1, 0x9be7ff, 0.4); g.strokeCircle(this.x, this.y, this.r + 40 - k * 30);
    }
    // beam telegraph / beam
    const t = this.tower;
    if (this.beamState === 'charge') {
      const k = 1 - this.beamT / this.def.beamCharge;
      g.lineStyle(1 + 3 * k, 0xff4d6d, 0.3 + 0.5 * k); g.lineBetween(this.x, this.y, t.x, t.y);
      g.lineStyle(2, 0xffffff, 0.6 * k); g.strokeCircle(this.x, this.y, this.r * (1 - k * 0.5));
    } else if (this.beamState === 'fire') {
      const p = 0.7 + 0.3 * Math.sin(this.scene.time.now / 30);
      g.lineStyle(26 * p, 0xff4d6d, 0.25); g.lineBetween(this.x, this.y, t.x, t.y);
      g.lineStyle(10, 0xff4d6d, 0.9); g.lineBetween(this.x, this.y, t.x, t.y);
      g.lineStyle(4, 0xffffff, 1); g.lineBetween(this.x, this.y, t.x, t.y);
    }
  }
}

export class Warden extends Mob {
  constructor(scene, tier, x, y, titan) {
    super(scene, 'warden', tier, x, y);
    this.titan = titan;
    this.cd = 1 + Math.random(); this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.preferred = this.def.range * (0.85 + Math.random() * 0.15);
    this.sprite.setScale(1.3); this.glow.setScale(this.r / 12).setAlpha(0.6);
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    let ax = 0, ay = 0;
    if (d > this.preferred + 15) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else { const t = a + Math.PI / 2 * this.orbitDir; const radial = d < this.preferred - 15 ? -s * 0.5 : 0; ax = Math.cos(t) * s * 0.7 + Math.cos(a) * radial; ay = Math.sin(t) * s * 0.7 + Math.sin(a) * radial; }
    this.move(dt, ax, ay);
    this.sprite.setRotation(a);
    if (d <= this.def.range + 20) {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 1 / this.def.fireRate;
        for (let i = 0; i < this.def.burst; i++) { const sp = (i - 1) * 0.14; this.scene.spawnEnemyBullet({ x: this.x, y: this.y, vx: Math.cos(a + sp) * this.def.bulletSpeed, vy: Math.sin(a + sp) * this.def.bulletSpeed, dmg: this.dmg, color: this.def.color }); }
      }
    }
    // heal the titan while alive
    if (this.titan && !this.titan.dead && this.titan.hp < this.titan.hpMax) {
      this.titan.hp = Math.min(this.titan.hpMax, this.titan.hp + this.titan.hpMax * this.def.heal * dt);
      if (Math.random() < dt * 12) { const k = Math.random(); this.scene.fx.trailAt(this.x + (this.titan.x - this.x) * k, this.y + (this.titan.y - this.y) * k, this.def.color); }
    }
    super.update(dt);
  }
  drawExtra(g) {
    if (this.titan && !this.titan.dead) { g.lineStyle(1, this.def.color, 0.25); g.lineBetween(this.x, this.y, this.titan.x, this.titan.y); }
    g.lineStyle(2, this.def.color, 0.6); g.strokeCircle(this.x, this.y, this.r + 5);
  }
}

export function createMob(scene, type, tier, x, y) {
  switch (type) {
    case 'drone': return new Drone(scene, tier, x, y);
    case 'raider': return new Raider(scene, tier, x, y);
    case 'swarm': return new Swarm(scene, tier, x, y);
    case 'orbiter': return new Orbiter(scene, tier, x, y);
    case 'shielder': return new Shielder(scene, tier, x, y);
    case 'boss': return new Boss(scene, tier, x, y);
    case 'bomber': return new Bomber(scene, tier, x, y);
    case 'leech': return new Leech(scene, tier, x, y);
    case 'phantom': return new Phantom(scene, tier, x, y);
    case 'hydra': return new Hydra(scene, tier, x, y);
    case 'sniper': return new Sniper(scene, tier, x, y);
    case 'carrier': return new Carrier(scene, tier, x, y);
    case 'jammer': return new Jammer(scene, tier, x, y);
    case 'siphon': return new Siphon(scene, tier, x, y);
    case 'beacon': return new Beacon(scene, tier, x, y);
    case 'behemoth': return new Behemoth(scene, tier, x, y);
    case 'titan': return new Titan(scene, tier, x, y);
    case 'mine': return new Mine(scene, tier, x, y);
    case 'warden': return new Warden(scene, tier, x, y);
    default: throw new Error('unknown mob ' + type);
  }
}
