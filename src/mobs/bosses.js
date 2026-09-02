// The tier boss (Overseer), the Warlord (every 10th level) with its relay pylons, and the Dreadnought's escort
// (Warden). The Dreadnought itself lives in titan.js. `armour*` helpers are shared by the Warlord and the Dreadnought.
import { WEAPONS } from '../config.js';
import { Mob, orbitOpts } from './base.js';
import { TAU, pick, maxBy } from '../utils.js';

/** how much of a second's damage budget the armour can bank */
const ARMOUR_BANK = 0.5;
/** floater rate for blocked / absorbed hits */
const BLOCK_TEXT_RATE = 0.25;
const IMMUNE_COLOR = '#ffd166', SHIELD_COLOR = 0x9be7ff, SHIELD_TEXT = '#9be7ff';

// ---- adaptive armour: damage cap per second, hp scaled to the player's dps, immunity to the top weapon ----

/** Call from the constructor after hp is final. Raises hp to recent dps × dpsSeconds and starts the armour. */
export function armourInit(m) {
  const d = m.def, floor = m.scene.recentDps() * d.dpsSeconds;
  if (floor > m.hpMax) { m.hpMax = floor; m.hp = floor; }
  m.budget = m.hpMax / d.minKillSec * ARMOUR_BANK;
  m.adapt = null; m.adaptT = 0; m.adaptCd = d.adaptEvery * 0.7; m.dmgBy = {};
  m.blockText = 0;
}

/** Per frame: refill the damage budget and run the adapt timer. `who` is used for the banner. */
export function armourTick(m, dt, who) {
  const perSec = m.hpMax / m.def.minKillSec;
  m.budget = Math.min(m.budget + perSec * dt, perSec * ARMOUR_BANK);
  m.blockText = Math.max(0, m.blockText - dt);
  if (m.adapt) {
    m.adaptT -= dt;
    if (m.adaptT <= 0) { m.adapt = null; m.adaptCd = m.def.adaptEvery; }
    return;
  }
  m.adaptCd -= dt;
  if (m.adaptCd > 0) return;
  const types = Object.keys(m.dmgBy);
  if (!types.length) { m.adaptCd = 2; return; }
  const top = maxBy(types, t => m.dmgBy[t]);
  m.dmgBy = {};
  if (!WEAPONS[top]) { m.adaptCd = 2; return; }
  m.adapt = top; m.adaptT = m.def.adaptDur;
  m.scene.ui.banner(`${who} adapts · immune to ${WEAPONS[top].name}`, true);
  m.scene.fx.ripple(m.x, m.y, WEAPONS[top].color, m.r, m.r + 50);
  m.scene.sfx.play('ability', 'emp');
}

/**
 * Filter incoming damage through the armour. Returns the amount that gets through, or -1 when the hit is
 * fully blocked (immune weapon). Records who is hurting the boss for the next adapt.
 */
export function armourFilter(m, amount, hx, hy, quiet) {
  const src = m.lastHit;
  if (m.adapt && src === m.adapt) {
    m.lastDealt = 0;
    if (!quiet && m.blockText <= 0) { m.blockText = BLOCK_TEXT_RATE; m.scene.fx.floater(hx, hy - 10, 'immune', IMMUNE_COLOR, 11); }
    return -1;
  }
  if (src) m.dmgBy[src] = (m.dmgBy[src] || 0) + amount;
  const a = Math.min(amount, m.budget);
  m.budget -= a;
  if (a < amount && !quiet && m.blockText <= 0) { m.blockText = BLOCK_TEXT_RATE; m.scene.fx.floater(hx, hy - 10, 'absorbed', '#9ca3af', 10); }
  return a;
}

/** Ring in the immune weapon's colour, plus a faint armour ring. */
export function armourDraw(m, g, radius) {
  if (!m.adapt) return;
  const c = WEAPONS[m.adapt].color, k = 0.5 + 0.5 * Math.sin(m.scene.time.now / 80);
  g.lineStyle(4, c, 0.5 + 0.4 * k); g.strokeCircle(m.x, m.y, radius);
  g.lineStyle(1, c, 0.3); g.strokeCircle(m.x, m.y, radius + 6);
}

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
      if (frag > 0) this.scene.fx.floater(this.x, this.y - 40, `+${frag} fragment${frag > 1 ? 's' : ''}`, '#c084fc', 18);
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

/** Every 10th threat level. Orbits at mid range, bursts, adapts, hides behind pylons at 66 % and 33 %, flaks drones. */
export class Warlord extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'warlord', tier, x, y);
    this.preferred = this.def.keepDistance; this.orbitDir = Math.random() < 0.5 ? -1 : 1;
    armourInit(this);
    this.cd = 2; this.flakCd = this.def.flakEvery; this.escortCd = this.def.escortEvery * 0.5;
    this.pylons = []; this.phaseIdx = 0; this.spin = 0;
    this.sprite.setScale(1.2); this.glow.setScale(this.r / 12).setAlpha(0.65);
    scene.warlord = this;
    scene.fx.shake(0.012, 600);
  }
  get shielded() { return this.pylons.some(p => !p.dead); }
  status() {
    if (this.shielded) return `shielded · ${this.pylons.filter(p => !p.dead).length} pylons left`;
    if (this.adapt) return `immune to ${WEAPONS[this.adapt].name} · ${Math.ceil(this.adaptT)} s`;
    return 'adapts to your best weapon · flaks drones';
  }
  takeDamage(amount, hx, hy, quiet, crit, from) {
    if (this.dead) return false;
    if (this.shielded) {
      this.lastDealt = 0;
      if (!quiet && this.blockText <= 0) { this.blockText = BLOCK_TEXT_RATE; this.scene.fx.floater(hx, hy - 10, 'shielded', SHIELD_TEXT, 11); this.scene.fx.spark(hx, hy, SHIELD_COLOR, 3); }
      return false;
    }
    const a = armourFilter(this, amount, hx, hy, quiet);
    if (a < 0) return false;
    return super.takeDamage(a, hx, hy, quiet);
  }
  update(dt) {
    this.spin += dt * (this.shielded ? 2 : 0.8);
    armourTick(this, dt, 'Warlord');
    const d = this.distToTower(), a = this.angleToTower();
    this.approachAndOrbit(dt, { gap: 20, tangent: 0.6, backoff: 0.6 });
    this.sprite.setRotation(this.spin * 0.5);
    // pylon phases
    const ph = this.def.pylonPhases;
    if (this.phaseIdx < ph.length && this.hp < this.hpMax * ph[this.phaseIdx]) { this.phaseIdx++; this.raisePylons(); }
    if (d <= this.def.range + 30 && this.tickCooldown(dt, this.def.fireRate)) this.fireBurst(a, this.def.burst, 0.14);
    // flak against player drones
    if (this.tickTimer('flakCd', dt, this.def.flakEvery) && this.tower.weapons.some(w => Array.isArray(w.drones))) {
      this.scene.damageDrones(this.x, this.y, this.def.flakRadius, this.dmg * this.def.flakMul);
      this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.def.flakRadius);
      this.scene.fx.shake(0.005, 150);
    }
    if (this.tickTimer('escortCd', dt, this.def.escortEvery)) {
      for (let i = 0; i < this.def.escortCount; i++) this.spawnChild(i % 2 ? 'drone' : 'raider', 120);
    }
    super.update(dt);
  }
  raisePylons() {
    this.pylons = [];
    for (let i = 0; i < this.def.pylons; i++) {
      const p = this.spawnChild('pylon', 0, { angle: i * TAU / this.def.pylons, offset: this.def.pylonRadius });
      p.owner = this; p.orbitA = i * TAU / this.def.pylons;
      this.pylons.push(p);
    }
    this.scene.ui.banner('Warlord shielded · destroy the relay pylons', true);
    this.scene.fx.ripple(this.x, this.y, SHIELD_COLOR, this.r, this.def.pylonRadius + 20);
    this.scene.sfx.play('shieldBreak');
  }
  die(killed) {
    for (const p of this.pylons) if (!p.dead) p.die(false);
    if (killed) {
      this.scene.fx.shake(0.025, 900);
      this.scene.fx.explode(this.x, this.y, 0xffffff, 60);
      this.scene.fx.explode(this.x, this.y, this.def.color, 60);
      const frag = Math.round((this.def.fragments + this.scene.tree.mods.bossFrag) * this.scene.levelMods.fragments);
      this.scene.state.fragments += frag;
      if (frag > 0) this.scene.fx.floater(this.x, this.y - 50, `+${frag} fragment${frag > 1 ? 's' : ''}`, '#c084fc', 20);
      this.scene.ui.banner('Warlord destroyed', true);
      this.scene.tx.say('bossDead');
      this.scene.sfx.play('bigExplode', null, this.x);
    }
    if (this.scene.warlord === this) this.scene.warlord = null;
    super.die(killed);
  }
  drawExtra(g) {
    for (let i = 0; i < 3; i++) {
      g.lineStyle(2, this.def.color, 0.55);
      g.beginPath(); g.arc(this.x, this.y, this.r + 6 + i * 6, this.spin * (i % 2 ? -1 : 1) + i, this.spin * (i % 2 ? -1 : 1) + i + 1.4, false); g.strokePath();
    }
    if (this.shielded) {
      const k = 0.6 + 0.4 * Math.sin(this.scene.time.now / 90);
      g.lineStyle(3, SHIELD_COLOR, 0.5 * k); g.strokeCircle(this.x, this.y, this.r + 24);
      g.lineStyle(1, SHIELD_COLOR, 0.25); g.strokeCircle(this.x, this.y, this.def.pylonRadius);
    }
    armourDraw(this, g, this.r + 30);
  }
}

/** Relay pylon: orbits its Warlord and keeps it invulnerable while alive. Dies with its owner. */
export class Pylon extends Mob {
  constructor(scene, tier, x, y) {
    super(scene, 'pylon', tier, x, y);
    this.owner = null; this.orbitA = 0; this.spin = 0;
    this.glow.setScale(this.r / 10).setAlpha(0.7);
  }
  update(dt) {
    this.spin += dt * 3;
    if (this.owner && !this.owner.dead) {
      this.orbitA += dt * 0.5;
      const R = this.owner.def.pylonRadius;
      this.x = this.owner.x + Math.cos(this.orbitA) * R; this.y = this.owner.y + Math.sin(this.orbitA) * R;
    } else if (!this.dead) { this.die(false); return; }
    this.sprite.setRotation(this.spin);
    super.update(dt);
  }
  drawExtra(g) {
    if (this.owner && !this.owner.dead) { g.lineStyle(1.5, this.def.color, 0.35); g.lineBetween(this.x, this.y, this.owner.x, this.owner.y); }
    g.lineStyle(2, this.def.color, 0.7); g.strokeCircle(this.x, this.y, this.r + 4);
  }
}
