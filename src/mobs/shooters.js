// Mobs that keep their distance and shoot at the core.
import { MOBS } from '../config.js';
import { pick } from '../utils.js';
import { Mob, orbitOpts } from './base.js';

/** raider bullets leave with up to this much angular spread */
const RAIDER_SPREAD = 0.12;
/** alpha of a phased phantom's sprite and glow */
const PHASED_ALPHA = 0.25, PHASED_GLOW_ALPHA = 0.1;

export class Raider extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'raider', tier, x, y, orbitOpts('raider', 0.8, 0.2));
    this.cd = 0.5 + Math.random();
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 10, tangent: 0.45, backoff: 0.5 });
    this.sprite.setRotation(a);
    if (d <= this.def.range && this.tickCooldown(dt, this.def.fireRate)) {
      const spread = (Math.random() - 0.5) * RAIDER_SPREAD;
      // shots leave from the nose
      this.fireAt(a + spread, { x: this.x + Math.cos(a) * this.r, y: this.y + Math.sin(a) * this.r });
    }
    super.update(dt);
  }
}

export class Orbiter extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'orbiter', tier, x, y, orbitOpts('orbiter', 0.85, 0.1));
    this.cd = 1;
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 15, tangent: 0.7, backoff: 0.6 });
    this.sprite.setRotation(this.sprite.rotation + dt * 3);
    if (d <= this.def.range + 20 && this.tickCooldown(dt, this.def.fireRate)) this.fireAt(a);
    super.update(dt);
  }
}

export class Shielder extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'shielder', tier, x, y, { preferred: MOBS.shielder.range * 0.9 });
    // shield scales with the same tier growth as hp
    const scale = this.hpMax / this.def.hp;
    this.shieldMax = this.def.shield * scale; this.shield = this.shieldMax;
    this.cd = 1.5; this.shieldHit = 0;
  }
  takeDamage(amount, hx, hy, quiet) {
    if (this.dead) return false;
    if (this.shield > 0) {
      this.lastDealt = Math.min(amount, this.shield);
      this.shield -= amount;
      this.shieldHit = 0.12;
      if (!quiet) this.scene.fx.spark(hx, hy, this.def.color, 2);
      // shield broke: the remainder spills onto the hull
      if (this.shield < 0) {
        const spill = -this.shield; this.shield = 0;
        this.scene.fx.ripple(this.x, this.y, this.def.color, this.r + 8, this.r + 30);
        return super.takeDamage(spill, hx, hy, quiet);
      }
      return false;
    }
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    this.shieldHit = Math.max(0, this.shieldHit - dt);
    if (this.shield < this.shieldMax) this.shield = Math.min(this.shieldMax, this.shield + this.def.shieldRegen * dt);
    const d = this.distToTower(), a = this.angleToTower(), s = this.def.speed;
    // approach, then hold position (no orbit)
    if (d > this.preferred) this.move(dt, Math.cos(a) * s, Math.sin(a) * s); else this.move(dt, 0, 0);
    this.sprite.setRotation(a);
    if (d <= this.def.range && this.tickCooldown(dt, this.def.fireRate)) this.fireAt(a);
    super.update(dt);
  }
  drawExtra(g) {
    if (this.shield <= 0) return;
    const f = this.shield / this.shieldMax;
    g.lineStyle(1 + 3 * f, this.def.color, this.shieldHit > 0 ? 0.9 : 0.25 + f * 0.3);
    g.strokeCircle(this.x, this.y, this.r + 9);
  }
}

export class Phantom extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'phantom', tier, x, y);
    this.phased = false; this.pt = Math.random() * this.def.phaseOff; this.cd = 1;
    Object.assign(this, orbitOpts('phantom', 0.85));
  }
  takeDamage(amount, hx, hy, quiet) {
    if (this.phased) {
      this.lastDealt = 0;
      if (!quiet && Math.random() < 0.3) this.scene.fx.floater(hx, hy - 8, 'phased', '#c084fc', 10);
      return false;
    }
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    this.pt -= dt;
    if (this.scene.levelMods.noPhase) { this.phased = false; this.pt = 1; }
    else if (this.pt <= 0) {
      // toggle phase and start the next timer
      this.phased = !this.phased; this.pt = this.phased ? this.def.phaseOn : this.def.phaseOff;
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 16);
    }
    this.sprite.setAlpha(this.phased ? PHASED_ALPHA : this.baseAlpha); this.glow.setAlpha(this.phased ? PHASED_GLOW_ALPHA : 0.5);
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 10, tangent: 0.6, backoff: 0 });
    this.sprite.setRotation(a);
    if (!this.phased && d <= this.def.range && this.tickCooldown(dt, this.def.fireRate)) this.fireAt(a);
    super.update(dt);
  }
}

export class Sniper extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'sniper', tier, x, y);
    this.cd = this.def.cooldown * 0.6; this.aim = 0;
    Object.assign(this, orbitOpts('sniper', 0.95));
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    // holds still while aiming
    this.approachAndOrbit(dt, { gap: 10, tangent: this.aim <= 0 ? 0.3 : 0, backoff: 0 });
    this.sprite.setRotation(a);
    if (d <= this.def.range + 20) {
      if (this.aim > 0) {
        this.aim -= dt;
        if (this.aim <= 0) {
          this.fireAt(a);
          this.scene.fx.line(this.x, this.y, this.tower.x, this.tower.y, 0xffffff, 3, 0.15);
          this.scene.sfx.shot('railgun', this.x);
          this.cd = this.def.cooldown / this.scene.levelMods.sniperRate;
        }
      } else { this.cd -= dt; if (this.cd <= 0) this.aim = this.def.aim; }
    }
    super.update(dt);
  }
  drawExtra(g) {
    // aim line brightens as the shot charges
    if (this.aim > 0) {
      const k = 1 - this.aim / this.def.aim;
      g.lineStyle(1 + k * 2, 0xffffff, 0.15 + 0.5 * k); g.lineBetween(this.x, this.y, this.tower.x, this.tower.y);
    }
  }
}

export class Jammer extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'jammer', tier, x, y);
    this.cd = 1;
    Object.assign(this, orbitOpts('jammer', 0.9));
    this.slot = null; this.spin = 0;
  }
  update(dt) {
    this.spin += dt * 4;
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 10, tangent: 0.6, backoff: 0 });
    this.sprite.setRotation(this.spin);
    const inRange = d <= this.def.range + 30;
    // the lock only holds while in range and while the weapon is still mounted
    if (this.slot && (!inRange || !this.tower.weapons.includes(this.slot))) { this.slot.jamSlow = 0; this.slot = null; }
    if (inRange) {
      if (!this.slot) this.lockOn();
      if (this.slot) this.slot.jamSlow = this.def.slow;
      if (this.tickCooldown(dt, this.def.fireRate)) this.fireAt(a);
    }
    super.update(dt);
  }
  /** pick a random un-jammed weapon and lock onto it */
  lockOn() {
    const ws = this.tower.weapons.filter(w => !w.jamSlow);
    if (!ws.length) return;
    this.slot = pick(ws);
    this.scene.fx.bolt(this.x, this.y, this.slot.mount().x, this.slot.mount().y, this.def.color);
    this.scene.ui.banner(this.slot.def.name + ' being jammed', true);
  }
  die(killed) { if (this.slot) this.slot.jamSlow = 0; super.die(killed); }
  drawExtra(g) {
    if (!this.slot) return;
    const m = this.slot.mount();
    g.lineStyle(1, this.def.color, 0.25 + 0.2 * Math.sin(this.spin * 3)); g.lineBetween(this.x, this.y, m.x, m.y);
  }
}
