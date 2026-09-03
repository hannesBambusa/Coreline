// The Dreadnought: siege boss with a rotating shield sector, spread bursts, drone bays, a siege beam,
// a blink teleport, mine drops and (level 2+) hardpoint jamming. Each system has its own update method.
import { SIEGE } from '../config.js';
import { TAU, randomSign, pick } from '../utils.js';
import { Mob } from './base.js';
import { armourInit, armourTick, armourFilter, armourDraw } from './bosses.js';

/** shield sector / blink colour */
const ARC_COLOR = 0x9be7ff;
/** beam colour */
const BEAM_COLOR = 0xff4d6d;
/** enrage below this hp fraction; speed / rate multiplier while enraged */
const ENRAGE_HP = 0.3, ENRAGE_MUL = 1.3;
/** angular spread between burst bullets */
const BURST_SPREAD = 0.16;
/** launch speed of bay drones / dropped mines, mine spawn offset beyond the hull, mine fan spacing */
const BAY_IMPULSE = 150, MINE_IMPULSE = 220, MINE_OFFSET = 10, MINE_SPREAD = 0.5;
/** blink ring: bullets fan over this arc, at this speed / damage fraction */
const BLINK_RING_ARC = Math.PI * 1.2, BLINK_RING_SPEED = 1.2, BLINK_RING_DMG = 0.5;
/** time spent in the 'arrive' state after a blink */
const BLINK_ARRIVE_T = 0.35;
/** beam damage bonus per titan level */
const BEAM_DMG_PER_LEVEL = 0.3;

export class Titan extends Mob {
  constructor(scene, tier, x, y, level = 1) {
    super(scene, 'titan', tier, x, y);
    this.level = level;
    const mul = SIEGE.hpMul + SIEGE.hpMulPerLevel * (level - 1);
    this.hpMax *= mul; this.hp = this.hpMax;
    armourInit(this);
    this.scrap = Math.round(this.scrap * (1 + 0.5 * (level - 1)));
    this.arc = this.def.shieldArc + SIEGE.arcPerLevel * (level - 1);
    this.arcAngle = 0; this.spin = 0;
    this.beamCd = this.def.beamEvery * 0.6; this.beamState = 'idle'; this.beamT = 0;
    this.bayCd = this.def.bayEvery; this.cd = 2;
    this.jamCd = this.def.jamEvery;
    this.blinkCd = this.def.blinkEvery * 0.8; this.blinkState = 'idle'; this.blinkT = 0;
    this.mineCd = this.def.mineEvery * 0.5;
    this.phase = 1; this.orbitDir = randomSign();
    this.preferred = this.def.keepDistance;
    this.sprite.setScale(1.6); this.glow.setScale(this.r / 10).setAlpha(0.7);
    this.scene.fx.shake(0.015, 800);
  }

  // the rotating sector blocks hits arriving from the direction of `from` (default: the core)
  takeDamage(amount, hx, hy, quiet, crit, from) {
    if (this.dead) return false;
    const src = from || this.tower;
    const a = Phaser.Math.Angle.Between(this.x, this.y, src.x, src.y);
    const d = Math.abs(Phaser.Math.Angle.Wrap(a - this.arcAngle));
    if (d < this.arc / 2) {
      this.lastDealt = 0;
      this.arcHit = 0.15;
      if (!quiet) { this.scene.fx.spark(hx, hy, ARC_COLOR, 4); this.scene.fx.floater(hx, hy - 10, 'blocked', '#9be7ff', 11); }
      return false;
    }
    const got = armourFilter(this, amount, hx, hy, quiet);
    if (got < 0) return false;
    return super.takeDamage(got, hx, hy, quiet);
  }

  /** enrage multiplier for the current phase */
  get mul() { return this.phase === 2 ? ENRAGE_MUL : 1; }

  update(dt) {
    const mul = this.mul;
    this.spin += dt * 0.4 * mul;
    this.arcAngle += dt * this.def.arcSpeed * mul * this.orbitDir;
    this.arcHit = Math.max(0, (this.arcHit || 0) - dt);
    armourTick(this, dt, 'Dreadnought');
    if (this.phase === 1 && this.hp < this.hpMax * ENRAGE_HP) {
      this.phase = 2;
      this.scene.ui.banner('Dreadnought enraged', true);
      this.scene.tx.say('siegeEnrage', 0);
      this.scene.fx.explode(this.x, this.y, this.def.color, 60);
      this.scene.fx.shake(0.015, 500);
    }
    // distance / angle sampled once before moving; the systems below all use the same reading
    const d = this.distToTower(), a = this.angleToTower();
    this.updateMovement(dt, d, a);
    this.updateBlink(dt, d);
    this.updateMines(dt);
    this.sprite.setRotation(this.spin);
    this.updateBursts(dt, d, a);
    this.updateBays(dt);
    this.updateBeam(dt, d, a);
    this.updateJam(dt);
    super.update(dt);
  }

  /** hold keepDistance: approach, back off hard when too close, otherwise orbit. Frozen while firing the beam or blinking. */
  updateMovement(dt, d, a) {
    const s = this.def.speed * this.mul;
    let ax = 0, ay = 0;
    if (d > this.preferred + 20) { ax = Math.cos(a) * s; ay = Math.sin(a) * s; }
    else if (d < this.preferred - 30) { ax = -Math.cos(a) * s * 1.5; ay = -Math.sin(a) * s * 1.5; }   // never closer than keepDistance
    else {
      const t = a + Math.PI / 2 * this.orbitDir;
      ax = Math.cos(t) * s * 0.5; ay = Math.sin(t) * s * 0.5;
    }
    if (this.beamState === 'fire' || this.blinkState !== 'idle') { ax = 0; ay = 0; }
    this.move(dt, ax, ay);
  }

  /** blink: charge (flicker) -> vanish -> reappear at a new angle, same distance, with a bullet ring */
  updateBlink(dt, d) {
    if (this.blinkState === 'idle') {
      if (this.beamState === 'idle') this.blinkCd -= dt * this.mul;
      if (this.blinkCd <= 0 && d < this.def.range + 100) { this.blinkState = 'charge'; this.blinkT = this.def.blinkCharge; this.scene.sfx.play('ability', 'emp'); }
    } else if (this.blinkState === 'charge') {
      this.blinkT -= dt;
      this.sprite.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.blinkT * 40)));
      if (Math.random() < dt * 40) { const aa = Math.random() * TAU, rr = this.r + Math.random() * 30; this.scene.fx.trailAt(this.x + Math.cos(aa) * rr, this.y + Math.sin(aa) * rr, ARC_COLOR); }
      if (this.blinkT <= 0) this.blinkJump(d);
    } else if (this.blinkState === 'arrive') {
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkState = 'idle'; this.blinkCd = this.def.blinkEvery; }
    }
  }

  /** the teleport itself: vanish fx, move to the far side of the core, arrival fx and bullet ring */
  blinkJump(d) {
    this.scene.fx.ripple(this.x, this.y, ARC_COLOR, this.r + 20, 10);
    this.scene.fx.explode(this.x, this.y, ARC_COLOR, 30);
    // new bearing: roughly the opposite side of the core, 90-180 degrees away
    const na = this.angleToTower() + Math.PI + randomSign() * (Math.PI / 2 + Math.random() * Math.PI / 2);
    const nd = Math.max(this.preferred, Math.min(d, this.preferred + 80));
    this.x = this.tower.x + Math.cos(na) * nd; this.y = this.tower.y + Math.sin(na) * nd;
    this.blinkState = 'arrive'; this.blinkT = BLINK_ARRIVE_T;
    this.sprite.setAlpha(1);
    this.scene.fx.ripple(this.x, this.y, ARC_COLOR, 10, this.r + 60);
    this.scene.fx.flash(this.x, this.y, ARC_COLOR, 4);
    this.scene.fx.shake(0.008, 250);
    this.scene.sfx.play('ability', 'burst');
    const ta = this.angleToTower();
    for (let i = 0; i < this.def.blinkRing; i++) {
      const ba = ta + (i - this.def.blinkRing / 2) * (BLINK_RING_ARC / this.def.blinkRing);
      this.fireAt(ba, { speed: this.def.bulletSpeed * BLINK_RING_SPEED, dmg: this.dmg * BLINK_RING_DMG, color: ARC_COLOR });
    }
    // weapons lose their lock on the vanished ship
    for (const w of this.tower.weapons) if (w.target === this) w.target = null;
  }

  /** drop a fan of mines toward the core (not while blinking) */
  updateMines(dt) {
    this.mineCd -= dt * this.mul;
    if (this.mineCd > 0 || this.blinkState !== 'idle') return;
    this.mineCd = this.def.mineEvery;
    for (let i = 0; i < this.def.mineCount; i++) {
      const aa = this.angleToTower() + (i - (this.def.mineCount - 1) / 2) * MINE_SPREAD;
      this.spawnChild('mine', MINE_IMPULSE, { angle: aa, offset: this.r + MINE_OFFSET });
    }
    this.scene.ui.banner('Mines deployed', true);
  }

  /** spread bursts at the core (paused while the beam is charging or firing) */
  updateBursts(dt, d, a) {
    if (d > this.def.range + 40 || this.beamState !== 'idle') return;
    if (this.tickCooldown(dt, this.def.fireRate * this.mul)) this.fireBurst(a, this.def.burst, BURST_SPREAD);
  }

  /** drone bays: every third launch is a swarm */
  updateBays(dt) {
    this.bayCd -= dt * this.mul;
    if (this.bayCd > 0) return;
    this.bayCd = this.def.bayEvery;
    for (let i = 0; i < this.def.bayCount; i++) this.spawnChild(i % 3 === 2 ? 'swarm' : 'drone', BAY_IMPULSE);
    this.scene.fx.ripple(this.x, this.y, this.def.color, this.r, this.r + 60);
  }

  /** siege beam: charge (telegraph) -> fire -> idle */
  updateBeam(dt, d, a) {
    if (this.beamState === 'idle') {
      this.beamCd -= dt * this.mul;
      if (this.beamCd <= 0 && d <= this.def.range + 80) { this.beamState = 'charge'; this.beamT = this.def.beamCharge; this.scene.ui.banner('Dreadnought charging', true); this.scene.sfx.play('boss'); }
    } else if (this.beamState === 'charge') {
      this.beamT -= dt;
      if (Math.random() < dt * 20) this.scene.fx.trailAt(this.x + (Math.random() - 0.5) * this.r, this.y + (Math.random() - 0.5) * this.r, 0xffffff);
      if (this.beamT <= 0) { this.beamState = 'fire'; this.beamT = this.def.beamDur; this.scene.fx.shake(0.01, 300); }
    } else if (this.beamState === 'fire') {
      this.beamT -= dt;
      const beamDmg = this.tierDrain(this.def.beamDps, dt) * (1 + BEAM_DMG_PER_LEVEL * (this.level - 1));
      // the beam lands on the near side of the shield
      const hx = this.tower.x + Math.cos(a + Math.PI) * this.tower.shieldR, hy = this.tower.y + Math.sin(a + Math.PI) * this.tower.shieldR;
      this.tower.takeDamage(beamDmg, hx, hy, true, 'titan');
      this.scene.damageDrones(0, 0, 22, beamDmg * 2, new Phaser.Geom.Line(this.x, this.y, this.tower.x, this.tower.y));
      if (Math.random() < dt * 30) this.scene.fx.spark(hx, hy, BEAM_COLOR, 2);
      if (this.beamT <= 0) { this.beamState = 'idle'; this.beamCd = this.def.beamEvery; }
    }
  }

  /** level 2+: jam a random un-jammed hardpoint */
  updateJam(dt) {
    if (this.level < 2) return;
    if (!this.tickTimer('jamCd', dt, this.def.jamEvery)) return;
    const ws = this.tower.weapons.filter(w => !w.jammed && !w.def.noJam);
    if (!ws.length) return;
    const w = pick(ws);
    w.jammed = this.def.jamDur;
    this.scene.ui.banner(w.def.name + ' jammed', true);
    this.scene.fx.bolt(this.x, this.y, w.mount().x, w.mount().y, BEAM_COLOR);
  }

  die(killed) {
    if (killed) {
      this.scene.fx.shake(0.03, 1200);
      this.scene.fx.explode(this.x, this.y, 0xffffff, 80);
      this.scene.fx.explode(this.x, this.y, this.def.color, 80);
      for (let i = 0; i < 8; i++) this.scene.time.delayedCall(i * 120, () => this.scene.fx.explode(this.x + (Math.random() - 0.5) * this.r * 2, this.y + (Math.random() - 0.5) * this.r * 2, i % 2 ? 0xffffff : this.def.color, 25));
      this.scene.flashScreen(0.6, BEAM_COLOR);
      this.scene.sfx.play('bigExplode', null, this.x);
    }
    super.die(killed);
  }

  drawExtra(g) {
    // rotating shield sector
    const f = this.arcHit > 0 ? 0.9 : 0.45;
    g.lineStyle(this.arcHit > 0 ? 8 : 5, ARC_COLOR, f);
    g.beginPath(); g.arc(this.x, this.y, this.r + 14, this.arcAngle - this.arc / 2, this.arcAngle + this.arc / 2, false); g.strokePath();
    g.lineStyle(1, ARC_COLOR, 0.2); g.strokeCircle(this.x, this.y, this.r + 14);
    armourDraw(this, g, this.r + 26);
    // hull rings
    for (let i = 0; i < 3; i++) { g.lineStyle(2, this.def.color, 0.5); g.beginPath(); g.arc(this.x, this.y, this.r + 4 + i * 4, this.spin * (i % 2 ? -1.5 : 1.5) + i, this.spin * (i % 2 ? -1.5 : 1.5) + i + 2, false); g.strokePath(); }
    // blink telegraph
    if (this.blinkState === 'charge') {
      const k = 1 - this.blinkT / this.def.blinkCharge;
      g.lineStyle(3, ARC_COLOR, 0.5 + 0.5 * k); g.strokeCircle(this.x, this.y, this.r + 22 - k * 20);
      g.lineStyle(1, ARC_COLOR, 0.4); g.strokeCircle(this.x, this.y, this.r + 40 - k * 30);
    }
    // beam telegraph / beam
    const t = this.tower;
    if (this.beamState === 'charge') {
      const k = 1 - this.beamT / this.def.beamCharge;
      g.lineStyle(1 + 3 * k, BEAM_COLOR, 0.3 + 0.5 * k); g.lineBetween(this.x, this.y, t.x, t.y);
      g.lineStyle(2, 0xffffff, 0.6 * k); g.strokeCircle(this.x, this.y, this.r * (1 - k * 0.5));
    } else if (this.beamState === 'fire') {
      const p = 0.7 + 0.3 * Math.sin(this.scene.time.now / 30);
      g.lineStyle(26 * p, BEAM_COLOR, 0.25); g.lineBetween(this.x, this.y, t.x, t.y);
      g.lineStyle(10, BEAM_COLOR, 0.9); g.lineBetween(this.x, this.y, t.x, t.y);
      g.lineStyle(4, 0xffffff, 1); g.lineBetween(this.x, this.y, t.x, t.y);
    }
  }
}
