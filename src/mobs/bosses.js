// The tier boss (Overseer) and the Dreadnought's escort (Warden). The Dreadnought itself lives in titan.js.
import { Mob, orbitOpts } from './base.js';

/** overseer enrages below this hp fraction */
const BOSS_ENRAGE_HP = 0.5;
/** overseer speed / fire rate / spawn rate multiplier while enraged */
const BOSS_ENRAGE_MUL = 1.6;
/** angular spread between overseer burst bullets */
const BOSS_BURST_SPREAD = 0.18;
/** angular spread between warden burst bullets */
const WARDEN_BURST_SPREAD = 0.14;

export class Boss extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'boss', tier, x, y, orbitOpts('boss', 0.9));
    this.cd = 2; this.spawnCd = this.def.spawnEvery;
    this.phase = 1; this.spin = 0;
    this.glow.setScale(this.r / 14).setAlpha(0.6);
    this.scene.fx.shake(0.01, 400);
  }
  update(dt) {
    this.spin += dt * (this.phase === 2 ? 2.5 : 1);
    if (this.phase === 1 && this.hp < this.hpMax * BOSS_ENRAGE_HP) {
      this.phase = 2;
      this.scene.ui.banner('Overseer enraged', true);
      this.scene.fx.explode(this.x, this.y, this.def.color, 40);
      this.scene.fx.shake(0.012, 400);
    }
    const mul = this.phase === 2 ? BOSS_ENRAGE_MUL : 1;
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 20, tangent: 0.6, backoff: 0.5, speed: this.def.speed * mul });
    this.sprite.setRotation(this.spin * 0.5);
    if (d <= this.def.range + 30 && this.tickCooldown(dt, this.def.fireRate * mul)) {
      this.fireBurst(a, this.def.burst, BOSS_BURST_SPREAD);
    }
    if (this.tickTimer('spawnCd', dt, this.def.spawnEvery / mul)) {
      for (let i = 0; i < this.def.spawnCount; i++) this.spawnChild('drone');
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 40);
    }
    super.update(dt);
  }
  die(killed) {
    if (killed) {
      this.scene.fx.shake(0.02, 700);
      this.scene.fx.explode(this.x, this.y, 0xffffff, 40);
      const frag = Math.round((this.def.fragments + this.scene.tree.mods.bossFrag) * this.scene.levelMods.fragments);
      this.scene.state.fragments += frag;
      this.scene.fx.floater(this.x, this.y - 40, `+${frag} fragment${frag > 1 ? 's' : ''}`, '#c084fc', 18);
      this.scene.ui.banner('Overseer destroyed', true);
      this.scene.tx.say('bossDead');
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

export class Warden extends Mob {
  constructor(scene, tier, x, y, titan) {
    super(scene, 'warden', tier, x, y, orbitOpts('warden', 0.85, 0.15));
    this.titan = titan;
    this.cd = 1 + Math.random();
    this.sprite.setScale(1.3); this.glow.setScale(this.r / 12).setAlpha(0.6);
  }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 15, tangent: 0.7, backoff: 0.5 });
    this.sprite.setRotation(a);
    if (d <= this.def.range + 20 && this.tickCooldown(dt, this.def.fireRate)) {
      // burst is centred on the middle bullet of three
      for (let i = 0; i < this.def.burst; i++) this.fireAt(a + (i - 1) * WARDEN_BURST_SPREAD);
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
