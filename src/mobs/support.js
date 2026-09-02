// Support mobs: drain the core, ferry in reinforcements or warp them in on the spot.
import { TAU, pick } from '../utils.js';
import { Mob, orbitOpts } from './base.js';

/** launch speed of carrier drones and their fan spread (radians between the two) */
const CARRIER_LAUNCH_IMPULSE = 160, CARRIER_LAUNCH_SPREAD = 0.6;
/** warped-in mobs appear this far from the beacon */
const BEACON_WARP_OFFSET = 30;
/** what a beacon can warp in (drone twice: it is the common pick) */
const BEACON_POOL = ['drone', 'raider', 'swarm', 'drone'];

export class Leech extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'leech', tier, x, y);
    this.attached = false; this.ang = 0; this.pulse = 0;
  }
  update(dt) {
    const t = this.tower;
    if (!this.attached) {
      const d = this.distToTower(), a = this.angleToTower();
      this.move(dt, Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
      this.sprite.setRotation(a);
      if (d <= t.shieldR + this.r + 2) {
        this.attached = true; this.ang = Phaser.Math.Angle.Between(t.x, t.y, this.x, this.y);
        this.scene.fx.ripple(this.x, this.y, this.def.color, 4, 30);
      }
    } else {
      // crawl around the core, hugging the shield (or the hull once the shield is down)
      this.ang += dt * 0.15;
      const want = (t.shield > 0 ? t.shieldR : t.r) + this.r;
      this.orbitR = this.orbitR === undefined ? want : this.orbitR + (want - this.orbitR) * Math.min(1, dt * 3);   // ease instead of snapping
      this.x = t.x + Math.cos(this.ang) * this.orbitR; this.y = t.y + Math.sin(this.ang) * this.orbitR; this.vx = 0; this.vy = 0;
      this.sprite.setRotation(this.ang + Math.PI);
      this.pulse += dt;
      const drain = this.tierDrain(this.def.drain, dt);
      if (t.shield > 0) t.shield = Math.max(0, t.shield - drain); else t.takeDamage(drain, this.x, this.y);
      if (Math.random() < dt * 8) this.scene.fx.trailAt(this.x, this.y, this.def.color);
    }
    super.update(dt);
  }
  drawExtra(g) {
    if (!this.attached) return;
    g.lineStyle(2, this.def.color, 0.5 + 0.3 * Math.sin(this.pulse * 8)); g.strokeCircle(this.x, this.y, this.r + 4);
  }
}

export class Siphon extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'siphon', tier, x, y, orbitOpts('siphon', 0.9));
    this.tethered = false; this.pulse = 0;
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 10, tangent: 0.35, backoff: 0 });
    this.sprite.setRotation(a);
    this.tethered = d <= this.def.range + 20;
    if (this.tethered) {
      this.pulse += dt;
      // drains the shield and heals itself for double the amount; also holds the shield regen back
      const t = this.tower, drain = this.tierDrain(this.def.drain, dt);
      if (t.shield > 0) {
        const took = Math.min(t.shield, drain); t.shield -= took;
        this.hp = Math.min(this.hpMax, this.hp + took * 2);
        t.regenDelay = Math.max(t.regenDelay, 0.5); t.sinceHit = 0;
      }
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

export class Carrier extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'carrier', tier, x, y, orbitOpts('carrier', 0.9));
    this.hangar = this.def.hangarEvery * 0.5;
    this.sprite.setScale(1.2);
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 10, tangent: 0.5, backoff: 0 });
    this.sprite.setRotation(a);
    this.hangar -= dt;
    if (this.hangar <= 0 && d <= this.def.range + 40) {
      this.hangar = this.def.hangarEvery;
      // launch drones from the nose, fanned out
      for (let i = 0; i < this.def.hangarCount; i++) {
        this.spawnChild('drone', CARRIER_LAUNCH_IMPULSE, { angle: a, impulseAngle: a + (i - 0.5) * CARRIER_LAUNCH_SPREAD });
      }
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 24);
    }
    super.update(dt);
  }
  drawExtra(g) { g.lineStyle(1, this.def.color, 0.4); g.strokeRect(this.x - 10, this.y - 4, 20, 8); }
}

export class Beacon extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'beacon', tier, x, y);
    this.parked = false; this.warp = this.def.warpEvery * 0.4; this.spin = 0;
  }
  update(dt) {
    this.spin += dt * 2;
    if (!this.parked) {
      const d = this.distToTower(), a = this.angleToTower();
      this.move(dt, Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
      if (d <= this.def.range) { this.parked = true; this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 50); }
    } else {
      this.move(dt, 0, 0);
      if (this.tickTimer('warp', dt, this.def.warpEvery)) {
        for (let i = 0; i < this.def.warpCount; i++) {
          const m = this.spawnChild(pick(BEACON_POOL), 0, { offset: BEACON_WARP_OFFSET });
          this.scene.fx.flash(m.x, m.y, this.def.color, 0.8);
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
    for (let i = 0; i < 2; i++) {
      g.lineStyle(1.5, this.def.color, 0.5); g.beginPath();
      g.arc(this.x, this.y, this.r + 8 + i * 6, this.spin * (i ? -1 : 1), this.spin * (i ? -1 : 1) + 2.4, false); g.strokePath();
    }
    // warp charge indicator
    const k = 1 - this.warp / this.def.warpEvery;
    g.lineStyle(2, 0xffffff, 0.2 + 0.6 * k); g.strokeCircle(this.x, this.y, 4 + k * 10);
  }
}
