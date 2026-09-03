// Mobs that fly straight at the core and ram it (plus the mine, which is launched the same way).
import { dist, distXY } from '../utils.js';
import { Mob } from './base.js';

/** launch speed of hydra fragments */
const HYDRA_SPLIT_IMPULSE = 180;
/** spawn offset of hydra fragments from the parent */
const HYDRA_SPLIT_OFFSET = 8;
/** hp / size / speed scaling per hydra generation */
const HYDRA_HP_PER_GEN = 0.55, HYDRA_SIZE_PER_GEN = 0.75, HYDRA_SPEED_PER_GEN = 0.3, HYDRA_MIN_R = 7;
/** bomber starts its sprint inside this distance */
const BOMBER_SPRINT_DIST = 260;
/** mine blast radius and detonation reach outside the shield */
const MINE_BLAST_R = 70, MINE_TRIGGER_MARGIN = 60;

export class Drone extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'drone', tier, x, y); this.wob = Math.random() * 10; }
  update(dt) {
    this.wob += dt * 6;
    const a = this.angleToTower();
    const s = this.def.speed;
    // weave sideways while closing in
    const side = Math.sin(this.wob) * 30;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(a);
    if (this.distToTower() < this.coreReach()) this.ramCore();
    super.update(dt);
  }
}

/** Shoal: fast rammers in big packs. A shoal ship with a shoal-mate closer to the core within linkRange is covered and takes no damage. */
export class Shoal extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'shoal', tier, x, y);
    this.wob = Math.random() * 10; this.cover = null; this.coverText = 0;
    this.sprite.setScale(0.8);
  }
  /** the closest shoal-mate that is nearer the core than this one, within linkRange */
  findCover() {
    const t = this.tower, my = this.distToTower(), L = this.def.linkRange;
    let best = null, bd = L;
    for (const o of this.scene.mobs) {
      if (o === this || o.dead || o.type !== 'shoal') continue;
      const d = dist(this, o);
      if (d < bd && distXY(o.x, o.y, t.x, t.y) < my - 2) { bd = d; best = o; }
    }
    return best;
  }
  takeDamage(amount, hx, hy, quiet) {
    if (this.cover && !this.cover.dead) {
      this.lastDealt = 0;
      this.coverText = Math.max(0, this.coverText - 0.0001);
      if (!quiet && Math.random() < 0.15) this.scene.fx.floater(hx, hy - 6, 'covered', '#60a5fa', 9);
      return false;
    }
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    this.wob += dt * 9;
    const a = this.angleToTower(), s = this.def.speed, side = Math.sin(this.wob) * 25;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(Math.atan2(this.vy, this.vx));
    this.cover = this.findCover();
    this.sprite.setAlpha(this.cover ? 0.55 : 1);
    if (this.distToTower() < this.coreReach()) this.ramCore();
    super.update(dt);
  }
  drawExtra(g) {
    if (this.cover && !this.cover.dead) { g.lineStyle(1, this.def.color, 0.25); g.lineBetween(this.x, this.y, this.cover.x, this.cover.y); }
    else { g.lineStyle(1.5, this.def.color, 0.6); g.strokeCircle(this.x, this.y, this.r + 2); }
  }
}

export class Swarm extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'swarm', tier, x, y);
    this.wob = Math.random() * 10; this.freq = 7 + Math.random() * 4;
  }
  update(dt) {
    this.wob += dt * this.freq;
    const a = this.angleToTower(), s = this.def.speed, side = Math.sin(this.wob) * 90;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(Math.atan2(this.vy, this.vx));
    if (this.distToTower() < this.coreReach()) this.ramCore();
    super.update(dt);
  }
}

export class Hydra extends Mob {
  constructor(scene, tier, x, y, gen = 0) {
    super(scene, 'hydra', tier, x, y);
    this.gen = gen;
    // each generation is smaller, weaker and worth less
    const k = Math.pow(HYDRA_HP_PER_GEN, gen);
    this.hpMax *= k; this.hp = this.hpMax;
    this.r = Math.max(HYDRA_MIN_R, this.def.r * Math.pow(HYDRA_SIZE_PER_GEN, gen));
    this.scrap = Math.max(1, Math.round(this.scrap * k));
    this.sprite.setScale(Math.pow(HYDRA_SIZE_PER_GEN, gen)); this.glow.setScale(this.r / 22);
    this.wob = Math.random() * 10;
  }
  update(dt) {
    this.wob += dt * 4;
    const a = this.angleToTower(), s = this.def.speed * (1 + this.gen * HYDRA_SPEED_PER_GEN), side = Math.sin(this.wob) * 40;
    this.move(dt, Math.cos(a) * s + Math.cos(a + Math.PI / 2) * side, Math.sin(a) * s + Math.sin(a + Math.PI / 2) * side);
    this.sprite.setRotation(a);
    if (this.distToTower() < this.coreReach()) this.ramCore();
    super.update(dt);
  }
  die(killed) {
    // a killed hydra splits into the next generation until def.gens is reached
    if (killed && this.gen < this.def.gens) {
      for (let i = 0; i < this.def.splits; i++) {
        this.spawnChild('hydra', HYDRA_SPLIT_IMPULSE, { offset: HYDRA_SPLIT_OFFSET, gen: this.gen + 1 });
      }
    }
    super.die(killed);
  }
}

export class Bomber extends Mob {
  constructor(scene, tier, x, y) { super(scene, 'bomber', tier, x, y); this.fuse = 0; }
  flicker() { this.sprite.setTint(Math.sin(this.fuse * 25) > 0 ? 0xffffff : this.def.color); }
  update(dt) {
    const d = this.distToTower(), a = this.angleToTower();
    const sprint = d < BOMBER_SPRINT_DIST ? this.def.sprint : 1;
    this.move(dt, Math.cos(a) * this.def.speed * sprint, Math.sin(a) * this.def.speed * sprint);
    this.sprite.setRotation(a);
    if (sprint > 1) {
      this.fuse += dt;
      this.flicker();
      // ~20 exhaust motes per second behind the ship while sprinting
      if (Math.random() < dt * 20) this.scene.fx.trailAt(this.x - Math.cos(a) * this.r, this.y - Math.sin(a) * this.r, this.def.color);
    }
    if (d < this.coreReach()) {
      this.ramCore(() => {
        this.scene.damageDrones(this.x, this.y, this.def.blast, this.dmg);
        this.scene.fx.explode(this.x, this.y, this.def.color, 40);
        this.scene.fx.ripple(this.x, this.y, this.def.color, 10, this.def.blast);
        this.scene.fx.shake(0.006, 200);
        this.scene.sfx.play('explode', 20, this.x);
      });
    }
    Mob.prototype.update.call(this, dt);
    // base update resets the tint, so re-apply the sprint flicker after it
    if (sprint > 1 && !this.dead) this.flicker();
  }
}

export class Behemoth extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'behemoth', tier, x, y);
    this.sprite.setScale(1.3); this.glow.setScale(this.r / 12).setAlpha(0.4);
  }
  takeDamage(amount, hx, hy, quiet, crit) {
    // armour reduces everything except crits
    if (!crit) amount *= this.def.armour;
    return super.takeDamage(amount, hx, hy, quiet);
  }
  update(dt) {
    const a = this.angleToTower();
    this.move(dt, Math.cos(a) * this.def.speed, Math.sin(a) * this.def.speed);
    this.sprite.setRotation(a);
    if (this.distToTower() < this.coreReach()) {
      this.ramCore(() => {
        this.scene.fx.explode(this.x, this.y, this.def.color, 40); this.scene.fx.shake(0.01, 300);
      });
    }
    super.update(dt);
  }
  drawExtra(g) { g.lineStyle(3, this.def.color, 0.5); g.strokeCircle(this.x, this.y, this.r + 4); }
}

export class Mine extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'mine', tier, x, y);
    this.fuse = this.def.fuse; this.blink = 0;
    this.sprite.setScale(0.9);
  }
  update(dt) {
    // blink faster during the last 3 seconds of the fuse
    this.fuse -= dt; this.blink += dt * (this.fuse < 3 ? 12 : 4);
    const a = this.angleToTower(), s = this.def.speed;
    this.move(dt, Math.cos(a) * s, Math.sin(a) * s);
    this.sprite.setRotation(this.blink * 0.3).setAlpha(this.baseAlpha * (0.6 + 0.4 * Math.abs(Math.sin(this.blink))));
    if (this.distToTower() < this.coreReach() || this.fuse <= 0) this.detonate();
    super.update(dt);
  }
  detonate() {
    if (this.dead) return;
    if (this.distToTower() < this.tower.shieldR + MINE_TRIGGER_MARGIN) this.tower.takeDamage(this.dmg, this.x, this.y, false, 'mine');
    this.scene.damageDrones(this.x, this.y, MINE_BLAST_R, this.dmg);
    this.scene.fx.explode(this.x, this.y, this.def.color, 30);
    this.scene.fx.ripple(this.x, this.y, this.def.color, 8, MINE_BLAST_R);
    this.scene.fx.shake(0.004, 120);
    this.scene.sfx.play('explode', 16, this.x);
    this.die(false);
  }
  drawExtra(g) {
    const f = this.fuse < 3 ? 0.9 : 0.4;
    g.lineStyle(1.5, this.def.color, f); g.strokeCircle(this.x, this.y, this.r + 4);
  }
}
