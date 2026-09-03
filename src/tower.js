import { TOWER, TOWER_UPGRADES, COLORS, SLOT_COSTS, SLOT_GATES, CORE_TIERS, LEVELS } from './config.js';
import { createWeapon } from './weapons.js';
import { drawTower } from './tower/draw.js';

export class Tower {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.r = TOWER.radius;
    this.shieldR = TOWER.shieldRadius;
    this.upgrades = { shieldMax: 0, shieldRegen: 0, hull: 0 };
    this.slots = [createWeapon(scene, this, 'pulse', 0)];
    this.hitTimer = 0;
    this.regenDelay = 0;
    this.sinceHit = 99;
    this.spin = 0;
    this.calm = false;
    this.regenPhase = 0;
    this.recompute();
    this.hull = this.hullMax;
    this.shield = this.shieldMax;

    this.glow = scene.add.image(x, y, 'glow').setTint(COLORS.cyan)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.55).setDepth(1);
    this.gfx = scene.add.graphics().setDepth(4);
  }

  /** threat-level choice modifiers; null before the scene has set them */
  get lm() { return this.scene.levelMods || null; }

  /** total bonus from `level` upgrade steps: full `add` up to the soft cap, a fraction of it after */
  static upgradeBonus(key, level) {
    const add = TOWER_UPGRADES[key].add, full = Math.min(level, LEVELS.towerSoftCap), soft = Math.max(0, level - LEVELS.towerSoftCap);
    return add * full + add * LEVELS.towerSoftFrac * soft;
  }
  upgradeBonus(key, level = this.upgrades[key]) { return Tower.upgradeBonus(key, level); }
  get maxUpgrade() { return LEVELS.capBase + LEVELS.capPerPrestige * (this.scene.profile ? this.scene.profile.prestige : 0); }
  atCap(key) { return this.upgrades[key] >= this.maxUpgrade; }

  /** shield regen per second right now: base × under-fire / calm multiplier × this level's modifier */
  regenNow() {
    const tm = this.scene.tree.mods, lm = this.lm;
    const mul = this.regenDelay > 0 ? TOWER.underFireRegen : this.calm ? TOWER.calmRegenMul + tm.calmMul : 1;
    return this.shieldRegen * mul * (lm ? lm.shieldRegen : 1);
  }

  recompute() {
    const m = this.scene.tree ? this.scene.tree.mods : { hull: 1, shieldMax: 1, shieldRegen: 1 };
    const lm = this.lm;
    this.hullMax = Math.round((TOWER.hullMax + this.upgradeBonus('hull')) * m.hull);
    const shieldBase = TOWER.shieldMax + this.upgradeBonus('shieldMax');
    this.shieldMax = Math.round(shieldBase * m.shieldMax * (lm ? lm.shieldMax : 1));
    this.shieldRegen = (TOWER.shieldRegen + this.upgradeBonus('shieldRegen')) * m.shieldRegen;
    if (this.hull > this.hullMax) this.hull = this.hullMax;
    if (this.shield > this.shieldMax) this.shield = this.shieldMax;
  }
  get coreColor() { const p = this.scene.profile ? this.scene.profile.prestige : 0; return CORE_TIERS[Math.min(p, CORE_TIERS.length - 1)]; }

  upgradeCost(key) { return this.upgradeCostAt(key, this.upgrades[key]); }
  upgradeCostAt(key, level) {
    const u = TOWER_UPGRADES[key];
    return Math.floor(u.base * Math.pow(u.growth, level));
  }
  slotGate(count) { return SLOT_GATES[count] || 0; }
  slotCostAt(count) {
    if (SLOT_COSTS[count] === undefined) return null;
    return this.scene.tier >= this.slotGate(count) ? SLOT_COSTS[count] : null;
  }

  buyUpgrade(key) {
    this.upgrades[key]++;
    const before = { hull: this.hullMax, shield: this.shieldMax };
    this.recompute();
    if (key === 'hull') this.hull += this.hullMax - before.hull;
    if (key === 'shieldMax') this.shield += this.shieldMax - before.shield;
  }

  nextSlotCost() { return this.slotCostAt(this.slots.length); }
  nextSlotGate() { return SLOT_COSTS[this.slots.length] === undefined ? null : this.slotGate(this.slots.length); }
  unlockSlot() { this.slots.push(null); }
  installWeapon(i, type) { this.slots[i] = createWeapon(this.scene, this, type, i); }
  // Swap keeps the slot but the new weapon starts at level 1.
  swapWeapon(i, type) {
    const old = this.slots[i], w = createWeapon(this.scene, this, type, i);
    if (old) w.angle = old.angle;
    this.slots[i] = w;
  }
  get weapons() { return this.slots.filter(Boolean); }
  slotAngle(i) { const n = Math.max(4, this.slots.length); return -Math.PI / 2 + i * (Math.PI * 2 / n) - this.spin * 0.3; }
  maxRange() { let r = 0; for (const w of this.weapons) r = Math.max(r, w.range); return r; }

  setPosition(x, y) { this.x = x; this.y = y; this.glow.setPosition(x, y); }

  /** `source` is the ship type that dealt it, for the damage-taken stats */
  takeDamage(amount, hx, hy, quiet = false, source = 'other') {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.scene.quads) this.scene.quads.onTaken(amount);
    if (this.scene.quads && this.scene.quads.ult) { this.hitTimer = 0.25; this.hitAngle = Phaser.Math.Angle.Between(this.x, this.y, hx, hy); return; }   // invulnerable while an ultimate runs
    const st = this.scene.stats;
    if (st) { st.taken += amount; if (!st.takenBy) st.takenBy = {}; st.takenBy[source] = (st.takenBy[source] || 0) + amount; }
    if (this.scene.takenLog) this.scene.logTaken(amount);
    const fx = this.scene.fx;
    if (this.shield > 0) {
      this.shield -= amount;
      const a = Phaser.Math.Angle.Between(this.x, this.y, hx, hy);
      fx.ripple(this.x + Math.cos(a) * this.shieldR, this.y + Math.sin(a) * this.shieldR, COLORS.cyan, 6, 30);
      fx.spark(hx, hy, COLORS.cyan, 4);
      if (this.shield < 0) {
        this.hull += this.shield; this.shield = 0;
        fx.shake(0.006, 200);
        this.scene.sfx.play('shieldBreak');
        this.scene.tx.say('shieldDown', 45);
      } else this.scene.sfx.play('shieldHit', null, hx);
    } else {
      this.hull -= amount;
      fx.spark(hx, hy, COLORS.orange, 8);
      fx.shake(0.004, 120);
      this.scene.sfx.play('hullHit', null, hx);
    }
    this.hitTimer = 0.25; this.hitAngle = Phaser.Math.Angle.Between(this.x, this.y, hx, hy);
    this.regenDelay = TOWER.regenDelay;
    this.sinceHit = 0;
    if (this.hull <= 0) { this.hull = 0; this.scene.onTowerDestroyed(); }
  }

  update(dt, mobs) {
    this.spin += dt;
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.regenDelay = Math.max(0, this.regenDelay - dt);
    this.sinceHit += dt;
    this.calm = this.sinceHit > TOWER.calmAfter;
    const tm = this.scene.tree.mods, lm = this.lm;
    if (tm.hullRegen > 0 && this.hull < this.hullMax) this.hull = Math.min(this.hullMax, this.hull + tm.hullRegen * dt);
    if (this.shield < this.shieldMax) {
      const mul = this.regenDelay > 0 ? TOWER.underFireRegen : this.calm ? TOWER.calmRegenMul + tm.calmMul : 1;
      this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * mul * (lm ? lm.shieldRegen : 1) * dt);
    }
    for (const w of this.weapons) w.update(dt, mobs);
    this.draw(dt);
  }

  draw(dt = 0) { drawTower(this, this.gfx, dt); }
}
