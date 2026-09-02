import { TOWER, TOWER_UPGRADES, COLORS, SLOT_COSTS, CORE_TIERS } from './config.js';
import { createWeapon } from './weapons.js';

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
    this.recompute();
    this.hull = this.hullMax;
    this.shield = this.shieldMax;

    this.glow = scene.add.image(x, y, 'glow').setTint(COLORS.cyan)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.55).setDepth(1);
    this.gfx = scene.add.graphics().setDepth(4);
  }

  recompute() {
    const m = this.scene.tree ? this.scene.tree.mods : { hull: 1, shieldMax: 1, shieldRegen: 1 };
    this.hullMax = Math.round((TOWER.hullMax + this.upgrades.hull * TOWER_UPGRADES.hull.add) * m.hull);
    this.shieldMax = Math.round((TOWER.shieldMax + this.upgrades.shieldMax * TOWER_UPGRADES.shieldMax.add) * m.shieldMax);
    this.shieldRegen = (TOWER.shieldRegen + this.upgrades.shieldRegen * TOWER_UPGRADES.shieldRegen.add) * m.shieldRegen;
    if (this.hull > this.hullMax) this.hull = this.hullMax;
    if (this.shield > this.shieldMax) this.shield = this.shieldMax;
  }
  get coreColor() { const p = this.scene.profile ? this.scene.profile.prestige : 0; return CORE_TIERS[Math.min(p, CORE_TIERS.length - 1)]; }

  upgradeCost(key) { return this.upgradeCostAt(key, this.upgrades[key]); }
  upgradeCostAt(key, level) {
    const u = TOWER_UPGRADES[key];
    return Math.floor(u.base * Math.pow(u.growth, level));
  }
  slotCostAt(count) { return SLOT_COSTS[count] ?? null; }

  buyUpgrade(key) {
    this.upgrades[key]++;
    const before = { hull: this.hullMax, shield: this.shieldMax };
    this.recompute();
    if (key === 'hull') this.hull += this.hullMax - before.hull;
    if (key === 'shieldMax') this.shield += this.shieldMax - before.shield;
  }

  nextSlotCost() { return SLOT_COSTS[this.slots.length] ?? null; }
  unlockSlot() { this.slots.push(null); }
  installWeapon(i, type) { this.slots[i] = createWeapon(this.scene, this, type, i); }
  // Swap keeps the slot but the new weapon starts at level 1.
  swapWeapon(i, type) {
    const old = this.slots[i], w = createWeapon(this.scene, this, type, i);
    if (old) w.angle = old.angle;
    this.slots[i] = w;
  }
  get weapons() { return this.slots.filter(Boolean); }
  slotAngle(i) { return -Math.PI / 2 + i * (Math.PI * 2 / SLOT_COSTS.length) - this.spin * 0.3; }
  maxRange() { let r = 0; for (const w of this.weapons) r = Math.max(r, w.range); return r; }

  setPosition(x, y) { this.x = x; this.y = y; this.glow.setPosition(x, y); }

  takeDamage(amount, hx, hy) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.scene.stats) this.scene.stats.taken += amount;
    const fx = this.scene.fx;
    if (this.shield > 0) {
      this.shield -= amount;
      const a = Phaser.Math.Angle.Between(this.x, this.y, hx, hy);
      fx.ripple(this.x + Math.cos(a) * this.shieldR, this.y + Math.sin(a) * this.shieldR, COLORS.cyan, 6, 30);
      fx.spark(hx, hy, COLORS.cyan, 4);
      if (this.shield < 0) { this.hull += this.shield; this.shield = 0; fx.shake(0.006, 200); this.scene.sfx.play('shieldBreak'); }
      else this.scene.sfx.play('shieldHit', null, hx);
    } else {
      this.hull -= amount;
      fx.spark(hx, hy, COLORS.orange, 8);
      fx.shake(0.004, 120);
      this.scene.sfx.play('hullHit', null, hx);
    }
    this.hitTimer = 0.25;
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
    const tm = this.scene.tree.mods;
    if (tm.hullRegen > 0 && this.hull < this.hullMax) this.hull = Math.min(this.hullMax, this.hull + tm.hullRegen * dt);
    if (this.shield < this.shieldMax) {
      const mul = this.regenDelay > 0 ? TOWER.underFireRegen : this.calm ? TOWER.calmRegenMul + tm.calmMul : 1;
      this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * mul * dt);
    }
    for (const w of this.weapons) w.update(dt, mobs);
    this.draw(dt);
  }

  draw(dt = 0) {
    const g = this.gfx; g.clear();
    const { x, y, r } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.spin * 3);
    const oc = this.scene.abilities.state.overcharge.active > 0;
    this.glow.setTint(oc ? COLORS.orange : this.coreColor).setScale((oc ? 2.2 : 1.5) + pulse * 0.15).setAlpha(0.45 + pulse * 0.15);

    // weapon range aura
    const maxRange = this.maxRange();
    if (maxRange > 0) {
      g.fillStyle(COLORS.cyan, 0.025 + pulse * 0.01);
      g.fillCircle(x, y, maxRange);
      g.lineStyle(1, COLORS.cyan, 0.10 + pulse * 0.05);
      g.strokeCircle(x, y, maxRange);
      for (const w of this.weapons) {
        if (w.range === maxRange) continue;
        g.lineStyle(1, w.def.color, 0.08); g.strokeCircle(x, y, w.range);
      }
    }

    // shield ring: thickness = shield percentage
    const sf = this.shield / this.shieldMax;
    const regenerating = this.regenDelay <= 0 && this.shield < this.shieldMax;
    this.regenPhase = (this.regenPhase || 0) + dt * (this.calm ? 2.2 : 1);
    if (sf > 0) {
      const width = 1.5 + 14 * sf;
      const alpha = this.hitTimer > 0 ? 1 : 0.3 + 0.5 * sf;
      g.fillStyle(COLORS.cyan, 0.02 + sf * 0.05);
      g.fillCircle(x, y, this.shieldR);
      g.lineStyle(width, this.hitTimer > 0 ? COLORS.white : COLORS.cyan, alpha);
      g.strokeCircle(x, y, this.shieldR);
      g.lineStyle(1, COLORS.white, 0.25 + sf * 0.4);
      g.strokeCircle(x, y, this.shieldR + width / 2);
    } else {
      g.lineStyle(1, COLORS.red, 0.35 + pulse * 0.3);
      g.strokeCircle(x, y, this.shieldR);
    }
    // regen animation: bright segments sweep the ring, energy pulses collapse inward
    if (regenerating) {
      const n = this.calm ? 6 : 3, sweep = this.regenPhase * 2.5;
      for (let i = 0; i < n; i++) {
        const a0 = sweep + i * (Math.PI * 2 / n);
        g.lineStyle(3 + 10 * sf, COLORS.white, this.calm ? 0.55 : 0.3);
        g.beginPath(); g.arc(x, y, this.shieldR, a0, a0 + 0.35, false); g.strokePath();
      }
      const period = this.calm ? 0.5 : 1.0;
      const k = (this.regenPhase % period) / period;
      const pr = this.shieldR + 34 * (1 - k);
      g.lineStyle(2, COLORS.cyan, 0.5 * k);
      g.strokeCircle(x, y, pr);
    }

    // outer rotating ring with ticks
    g.lineStyle(1.5, COLORS.cyan, 0.5);
    g.strokeCircle(x, y, r + 10);
    for (let i = 0; i < 6; i++) {
      const a = this.spin * 0.6 + i * Math.PI / 3;
      g.lineBetween(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), x + Math.cos(a) * (r + 13), y + Math.sin(a) * (r + 13));
    }

    // hexagon body
    g.lineStyle(2, COLORS.white, 0.9);
    g.fillStyle(0x0b1030, 0.9);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -this.spin * 0.3 + i * Math.PI / 3;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fillPath(); g.strokePath();

    // hardpoints + turrets
    this.slots.forEach((w, i) => {
      const sa = this.slotAngle(i);
      const mx = x + Math.cos(sa) * r, my = y + Math.sin(sa) * r;
      if (!w) {
        g.lineStyle(1.5, COLORS.cyan, 0.5); g.strokeCircle(mx, my, 4);
        return;
      }
      const a = w.angle, jam = w.jammed > 0 || w.jamSlow > 0;
      g.fillStyle(0x0b1030, 1); g.fillCircle(mx, my, 6);
      g.lineStyle(1.5, jam ? COLORS.red : w.color, 0.9); g.strokeCircle(mx, my, 6);
      if (jam) { g.lineStyle(2, COLORS.red, 0.8); g.lineBetween(mx - 5, my - 5, mx + 5, my + 5); g.lineBetween(mx - 5, my + 5, mx + 5, my - 5); }
      g.lineStyle(6, 0x0b1030, 1);
      g.lineBetween(mx, my, mx + Math.cos(a) * 16, my + Math.sin(a) * 16);
      g.lineStyle(3, w.color, 1);
      g.lineBetween(mx, my, mx + Math.cos(a) * 16, my + Math.sin(a) * 16);
    });
    for (const w of this.weapons) w.draw(g);

    // core (colour = prestige tier)
    const pc = this.coreColor, pl = this.scene.profile ? this.scene.profile.prestige : 0;
    g.fillStyle(COLORS.white, 0.9);
    g.fillCircle(x, y, 6 + pulse * 1.5);
    g.fillStyle(pc, 0.6);
    g.fillCircle(x, y, 9 + pulse * 2);
    for (let i = 0; i < Math.min(pl, 6); i++) {
      const a = this.spin * (1 + i * 0.3) + i * 1.1;
      g.fillStyle(pc, 0.9); g.fillCircle(x + Math.cos(a) * (14 + i * 1.5), y + Math.sin(a) * (14 + i * 1.5), 1.6);
    }

    // hull arc under tower
    const hf = this.hull / this.hullMax;
    const hullColor = hf > 0.5 ? COLORS.green : hf > 0.25 ? COLORS.orange : COLORS.red;
    g.lineStyle(4, 0x0b1030, 0.8);
    g.beginPath(); g.arc(x, y, r + 22, Math.PI * 0.12, Math.PI * 0.88, false); g.strokePath();
    if (hf > 0) {
      g.lineStyle(4, hullColor, 0.95);
      g.beginPath(); g.arc(x, y, r + 22, Math.PI * 0.12, Math.PI * 0.12 + Math.PI * 0.76 * hf, false); g.strokePath();
    }
  }
}
