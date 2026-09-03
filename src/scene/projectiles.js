// Projectiles: tower bullets, enemy bullets, homing missiles, gravity-well shots and the wells they leave behind.
// Everything is plain data on scene.bullets / enemyBullets / missiles / wellShots / wells; this file moves, collides and draws it.
import { onMissileImpact, onWellLand } from '../combos/procs.js';
import { SPAWN } from '../config.js';
import { distXY, nearest } from '../utils.js';

const DEAD_AGE = 99;                   // age set on anything that should be filtered out at the end of the tick
const DRONE_AGGRO_RANGE = 420;         // enemy shots retarget a friendly drone within this range
const MISSILE_RETARGET_RANGE = 400;    // missiles that lost their target pick a new one within this range
const CHARGED_ARC_RANGE = 140;         // charged pulse rounds arc to another ship within this range
const CHARGED_ARC_MUL = 0.6;
const DODGE_WARN_DIST = 70;            // targets get their dodge roll once a bullet is this close
const RICOCHET_LIFE = 0.5;
const WELL_LAND_DIST = 12;
const WELL_SHOT_MAX_AGE = 3;
const WELL_REFRESH_FRAC = 0.9;         // a shot landing within this fraction of a well's radius refreshes it
const WELL_MIN_PULL = 20;
const FOCUS_TINT = 0xff3df2, FOCUS_COLOR = '#ff3df2';
const ARC_TINT = 0x9be7ff, ARC_COLOR = '#9be7ff';
const RICOCHET_TINT = 0x4ff2ff, RICOCHET_COLOR = '#4ff2ff';

// ---------- spawning ----------
export function spawnBullet(scene, b) { b.age = 0; scene.bullets.push(b); }

/** Enemy shot. Some shooters go for your drones instead of the core: the shot is redirected at the nearest drone's predicted position. */
export function spawnEnemyBullet(scene, b) {
  b.age = 0; b.life = 3;
  if (Math.random() < SPAWN.droneAggro) {
    let best = null, bd = DRONE_AGGRO_RANGE;
    for (const bay of scene.tower.weapons) {
      if (!Array.isArray(bay.drones)) continue;
      for (const d of bay.drones) {
        if (!d.alive) continue;
        const dd = distXY(b.x, b.y, d.x, d.y);
        if (dd < bd) { bd = dd; best = d; }
      }
    }
    if (best) {
      const sp = Math.hypot(b.vx, b.vy), t = bd / sp;
      const a = Phaser.Math.Angle.Between(b.x, b.y, best.x + best.vx * t, best.y + best.vy * t);
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.atDrone = true;
    }
  }
  scene.enemyBullets.push(b);
}

export function spawnMissile(scene, m) { m.age = 0; scene.missiles.push(m); }
export function spawnWellShot(scene, w) { w.age = 0; scene.wellShots.push(w); }

// ---------- bullets ----------
/** Pulse + laser focus combo: a pulse bolt hitting the laser's current target can land a triple-damage crit. Mutates opts. */
function focusCombo(scene, b, m, opts) {
  if (!b.weapon || b.weapon.type !== 'pulse') return;
  const laser = scene.tower.weapons.find(w => w.type === 'laser');
  if (!laser || laser.target !== m || !scene.combos.roll('focus')) return;
  opts.mul = 3; opts.color = FOCUS_COLOR; opts.size = 18;
  scene.fx.explode(m.x, m.y, FOCUS_TINT, 28);
  scene.fx.explode(m.x, m.y, 0xffffff, 12);
  scene.fx.ripple(m.x, m.y, FOCUS_TINT, m.r, m.r + 90);
  scene.fx.ripple(m.x, m.y, 0xffffff, m.r, m.r + 50);
  scene.fx.flash(m.x, m.y, FOCUS_TINT, 2.5);
  scene.fx.floater(m.x, m.y - m.r - 26, 'CRIT', FOCUS_COLOR, 16);
  laser.flare = 0.6;
  const mz = laser.muzzle(10);
  scene.fx.line(mz.x, mz.y, m.x, m.y, 0xffffff, 10, 0.5);
  scene.fx.line(mz.x, mz.y, m.x, m.y, FOCUS_TINT, 26, 0.4);
  scene.fx.shake(0.003, 120);
}

/** Charged pulse rounds arc to the nearest other ship for reduced damage. */
function chargedArc(scene, b, m) {
  if (!b.weapon || b.weapon.type !== 'pulse' || !(b.weapon.charged > 0)) return;
  const near = nearest(scene.mobs, m.x, m.y, CHARGED_ARC_RANGE, o => o !== m);
  if (!near) return;
  scene.fx.bolt(m.x, m.y, near.x, near.y, ARC_TINT);
  scene.hit(near, b.weapon, near.x, near.y, { mul: CHARGED_ARC_MUL, color: ARC_COLOR });
}

/** Pulse ricochet: a killing bolt bounces once to the nearest other ship it has not already hit. */
function ricochet(scene, b, m, hpBefore) {
  if (!b.weapon || b.weapon.type !== 'pulse' || !m.dead || hpBefore <= 0 || b.bounced) return;
  const near = nearest(scene.mobs, m.x, m.y, b.weapon.def.ricochetRange, o => o !== m && !(b.hitSet && b.hitSet.has(o)));
  if (!near) return;
  const ra = Phaser.Math.Angle.Between(m.x, m.y, near.x, near.y), sp = Math.hypot(b.vx, b.vy);
  scene.spawnBullet({ x: m.x, y: m.y, vx: Math.cos(ra) * sp, vy: Math.sin(ra) * sp, dmg: b.dmg * b.weapon.def.ricochetDmg, weapon: b.weapon, color: b.color, life: RICOCHET_LIFE, target: near, bounced: true, ricochet: true });
  scene.fx.spark(m.x, m.y, RICOCHET_TINT, 4);
}

/** Pierce: keep flying through up to N ships. Returns true when the bullet should carry on after this hit. */
function pierceThrough(b, m) {
  if (b.pierce && b.hitSet) { b.hitSet.add(m); if (b.hitSet.size < b.pierce + 1) return true; }   // pierce N = passes through N ships, hits N+1
  return false;
}

/** One bullet touching one ship: combo, damage, arcs, ricochet, pierce. Returns true when the bullet survives the hit. */
function bulletHit(scene, b, m) {
  const opts = {};
  focusCombo(scene, b, m, opts);
  if (b.ricochet || b.reflected) opts.dmg = b.dmg;   // these carry their own damage instead of the weapon's
  if (b.chronoT) { const cf = scene.tower.weapons.find(w => w.type === 'chrono'); if (cf) { opts.mul = (opts.mul || 1) * cf.bulletMul(b.chronoT); opts.color = opts.color || '#e0f2fe'; } }
  const hpBefore = m.hp;
  if (b.weapon) scene.hit(m, b.weapon, b.x, b.y, opts);
  if (b.onHit) b.onHit(m);
  else { m.takeDamage(b.dmg, b.x, b.y); scene.fx.floater(m.x, m.y - m.r - 6, Math.round(b.dmg), '#dbe7ff', 12); }
  if (b.ricochet) scene.fx.floater(m.x, m.y - m.r - 18, 'ricochet', RICOCHET_COLOR, 10);
  chargedArc(scene, b, m);
  ricochet(scene, b, m, hpBefore);
  return pierceThrough(b, m);
}

function updateTowerBullets(scene, dt) {
  for (const b of scene.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
    scene.fx.trailAt(b.x, b.y, b.color);
    if (b.target && !b.target.dead && !b.dodgeChecked && distXY(b.x, b.y, b.target.x, b.target.y) < DODGE_WARN_DIST) {
      b.dodgeChecked = true; b.target.tryDodge();
    }
    for (const m of scene.mobs) {
      if (m.dead) continue;
      if (b.hitSet && b.hitSet.has(m)) continue;
      if (distXY(b.x, b.y, m.x, m.y) >= m.r + 4) continue;
      if (bulletHit(scene, b, m)) continue;
      b.age = DEAD_AGE; break;
    }
  }
  scene.bullets = scene.bullets.filter(b => b.age < b.life);
}

function updateEnemyBullets(scene, dt) {
  const t = scene.tower;
  const bays = t.weapons.filter(w => Array.isArray(w.drones)), mirror = t.weapons.find(w => w.type === 'mirrors');
  for (const b of scene.enemyBullets) {
    const k = b.chrono || 1;   // chrono field slows shots inside it
    const prevD = mirror ? distXY(b.x, b.y, t.x, t.y) : 0;
    b.x += b.vx * dt * k; b.y += b.vy * dt * k; b.age += dt;
    if (bays.length && bays.some(w => w.absorb(b))) { b.age = DEAD_AGE; continue; }
    if (mirror && mirror.reflect(b, prevD)) { b.age = DEAD_AGE; continue; }
    const d = distXY(b.x, b.y, t.x, t.y);
    const hitR = t.shield > 0 ? t.shieldR : t.r + 4;
    if (d < hitR) { t.takeDamage(b.dmg, b.x, b.y, false, b.from); b.age = DEAD_AGE; }
  }
  scene.enemyBullets = scene.enemyBullets.filter(b => b.age < b.life);
}

export function updateBullets(scene, dt) {
  updateTowerBullets(scene, dt);
  updateEnemyBullets(scene, dt);
}

// ---------- missiles and wells ----------
/** A missile detonating inside a gravity well can collapse the well into a singularity (combo) instead of a plain splash. */
function detonateMissile(scene, m, hitShip = null) {
  if (m.onImpact && hitShip) m.onImpact(hitShip);
  if (!m.splash) { if (hitShip) scene.hit(hitShip, m.weapon, m.x, m.y, { dmg: m.dmg }); m.age = DEAD_AGE; onMissileImpact(scene, m); return; }   // no splash: a direct hit only
  const well = scene.wells.find(w => distXY(w.x, w.y, m.x, m.y) <= w.r);
  if (well && scene.combos.roll('singularity')) {
    scene.damageRadius(well.x, well.y, well.r * 1.3, m.dmg * 3, 0xc084fc, m.weapon);
    scene.fx.ripple(well.x, well.y, 0xffffff, 10, well.r * 1.3);
    scene.fx.explode(well.x, well.y, 0xffffff, 40);
    scene.fx.shake(0.008, 250);
    well.age = well.life; // collapse the well
  } else scene.damageRadius(m.x, m.y, m.splash, m.dmg, m.color, m.weapon);
  onMissileImpact(scene, m);
  m.age = DEAD_AGE;
}

function updateHomingMissiles(scene, dt) {
  for (const m of scene.missiles) {
    m.age += dt;
    if (!m.target || m.target.dead) m.target = nearest(scene.mobs, m.x, m.y, MISSILE_RETARGET_RANGE);
    const cur = Math.atan2(m.vy, m.vx);
    let a = cur;
    if (m.target) {
      const want = Phaser.Math.Angle.Between(m.x, m.y, m.target.x, m.target.y);
      a = Phaser.Math.Angle.RotateTo(cur, want, m.turn * dt);
    }
    const sp = Math.min(m.speed, Math.hypot(m.vx, m.vy) + m.speed * 2 * dt);
    m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp;
    m.x += m.vx * dt; m.y += m.vy * dt;
    scene.fx.trailAt(m.x, m.y, m.color);
    for (const o of scene.mobs) {
      if (o.dead) continue;
      if (distXY(m.x, m.y, o.x, o.y) < o.r + 5) { detonateMissile(scene, m, o); break; }
    }
    if (m.age >= m.life && m.age < DEAD_AGE) { scene.damageRadius(m.x, m.y, m.splash, m.dmg, m.color, m.weapon); onMissileImpact(scene, m); m.age = DEAD_AGE; }
  }
  scene.missiles = scene.missiles.filter(m => m.age < DEAD_AGE);
}

/** Well shots fly to their target point; landing on top of an existing well refreshes it instead of stacking a second one. */
function updateWellShots(scene, dt) {
  for (const w of scene.wellShots) {
    w.age += dt; w.x += w.vx * dt; w.y += w.vy * dt;
    scene.fx.trailAt(w.x, w.y, w.color);
    if (distXY(w.x, w.y, w.tx, w.ty) < WELL_LAND_DIST || w.age > WELL_SHOT_MAX_AGE) {
      const near = scene.wells.find(o => distXY(o.x, o.y, w.x, w.y) < o.r * WELL_REFRESH_FRAC);
      if (near) { near.age = 0; near.life = Math.max(near.life, w.well.life); scene.fx.ripple(near.x, near.y, w.color, near.r * 0.5, near.r); }
      else { const well = { x: w.x, y: w.y, age: 0, spin: 0, ...w.well }; scene.wells.push(well); scene.fx.ripple(w.x, w.y, w.color, 10, w.well.r); onWellLand(scene, well); }
      w.age = DEAD_AGE;
    }
  }
  scene.wellShots = scene.wellShots.filter(w => w.age < DEAD_AGE);
}

/** Wells pull, slow and tick damage on every ship inside them, and spit particles until they expire. */
function updateWells(scene, dt) {
  for (const w of scene.wells) {
    w.age += dt; w.spin += dt * 3;
    for (const m of scene.mobs) {
      if (m.dead) continue;
      const d = distXY(w.x, w.y, m.x, m.y);
      if (d > w.r) continue;
      m.slow = w.slow;
      const a = Phaser.Math.Angle.Between(m.x, m.y, w.x, w.y);
      const pull = w.pull * (1 - d / w.r) + WELL_MIN_PULL;
      m.x += Math.cos(a) * pull * dt; m.y += Math.sin(a) * pull * dt;
      const wd = (w.weapon ? w.weapon.dmgVs(m) : w.dps) * dt;
      m.lastHit = 'gravity';
      m.takeDamage(wd, m.x, m.y, true);
      scene.addDmg('gravity', m.lastDealt ?? 0);
    }
    if (Math.random() < dt * 20) {
      const a = Math.random() * Math.PI * 2, rr = w.r * (0.6 + Math.random() * 0.4);
      scene.fx.trailAt(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, w.color);
    }
  }
  scene.wells = scene.wells.filter(w => w.age < w.life);
}

export function updateMissiles(scene, dt) {
  updateHomingMissiles(scene, dt);
  updateWellShots(scene, dt);
  updateWells(scene, dt);
}

// ---------- drawing ----------
function drawWell(g, w) {
  // aura strength = remaining life: strong at spawn, fading to nothing as the well collapses
  const left = Math.max(0, 1 - w.age / w.life), f = Math.min(1, w.age * 4) * left;
  g.fillStyle(w.color, 0.03 + 0.11 * f); g.fillCircle(w.x, w.y, w.r);
  g.lineStyle(1 + 2 * f, w.color, 0.15 + 0.5 * f); g.strokeCircle(w.x, w.y, w.r);
  for (let i = 0; i < 3; i++) {
    g.lineStyle(2, w.color, 0.7 * f);
    g.beginPath(); g.arc(w.x, w.y, 10 + i * 9, w.spin + i * 2.1, w.spin + i * 2.1 + 2.2, false); g.strokePath();
  }
  g.fillStyle(0xffffff, 0.9 * f); g.fillCircle(w.x, w.y, 4);
}

export function drawBullets(scene) {
  const g = scene.bulletGfx; g.clear();
  for (const b of scene.bullets) {
    const l = b.reflected ? 30 : 10, a = Math.atan2(b.vy, b.vx);
    if (b.reflected) { g.lineStyle(7, b.color, 0.35); g.lineBetween(b.x - Math.cos(a) * l, b.y - Math.sin(a) * l, b.x, b.y); }   // reflected shots read as a bright bolt
    g.lineStyle(3, b.color, 1);
    g.lineBetween(b.x - Math.cos(a) * l, b.y - Math.sin(a) * l, b.x, b.y);
    g.fillStyle(0xffffff, 1); g.fillCircle(b.x, b.y, b.reflected ? 3 : 2);
  }
  for (const b of scene.enemyBullets) {
    g.fillStyle(b.color, 0.9); g.fillCircle(b.x, b.y, 3.5);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(b.x, b.y, 1.5);
  }
  for (const m of scene.missiles) {
    const a = Math.atan2(m.vy, m.vx);
    g.fillStyle(m.color, 1);
    g.fillTriangle(m.x + Math.cos(a) * 7, m.y + Math.sin(a) * 7,
      m.x + Math.cos(a + 2.5) * 5, m.y + Math.sin(a + 2.5) * 5,
      m.x + Math.cos(a - 2.5) * 5, m.y + Math.sin(a - 2.5) * 5);
  }
  for (const w of scene.wellShots) { g.fillStyle(w.color, 1); g.fillCircle(w.x, w.y, 5); g.fillStyle(0xffffff, 1); g.fillCircle(w.x, w.y, 2); }
  for (const w of scene.wells) drawWell(g, w);
}

/** Per-mob overlays: custom extras, elite ring, mark brackets, and the hp bar for anything below full. */
export function drawMobBars(scene) {
  const g = scene.mobGfx; g.clear();
  for (const m of scene.mobs) {
    if (m.drawExtra) m.drawExtra(g);
    m.drawElite(g);
    if (m.marked > 0) {
      g.lineStyle(2, FOCUS_TINT, 0.6); g.strokeCircle(m.x, m.y, m.r + 8);
      g.lineStyle(1, FOCUS_TINT, 0.8);
      g.lineBetween(m.x - m.r - 14, m.y, m.x - m.r - 6, m.y); g.lineBetween(m.x + m.r + 6, m.y, m.x + m.r + 14, m.y);
      g.lineBetween(m.x, m.y - m.r - 14, m.x, m.y - m.r - 6); g.lineBetween(m.x, m.y + m.r + 6, m.x, m.y + m.r + 14);
    }
    if (m.hp >= m.hpMax) continue;
    const w = m.r * 2 + 6, f = m.hp / m.hpMax;
    g.fillStyle(0x000000, 0.6); g.fillRect(m.x - w / 2, m.y - m.r - 10, w, 3);
    g.fillStyle(m.def.color, 1); g.fillRect(m.x - w / 2, m.y - m.r - 10, w * f, 3);
  }
}
