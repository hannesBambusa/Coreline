// Drift mode blink: double-tap a movement key and the blob folds space in that direction.
// Costs nothing but time - one shared cooldown, shown on a ring around the blob and in the proc list.
import { COLORS, DRIFT } from '../config.js';
import { ICONS_BLINK } from '../scene/icons.js';

const TAU = Math.PI * 2;
const DEPART = 0.3;        // seconds the collapse at the old position runs
const GHOSTS = 0.28;       // seconds the afterimages along the path last
const ARRIVE = 0.45;       // seconds the bloom at the new position runs
const STREAKS = 10;        // lines pulled inward at the departure point
const SHARDS = 8;          // lines thrown outward at the arrival point

const easeOut = (p) => 1 - Math.pow(1 - p, 3);

/** false when the blob cannot blink right now (wrong mode, run not live, still cooling) */
export function canBlink(scene) {
  return scene.mode === 'drift' && !scene.paused && !scene.starting && !scene.gameOver && !scene.choosing
    && (scene.tower.blinkCd || 0) <= 0;
}

/** how full the blink is, 0 right after a jump to 1 when it is ready again */
export function blinkCharge(tower) {
  const cd = tower.blinkCd || 0;
  return cd <= 0 ? 1 : Math.max(0, 1 - cd / DRIFT.blinkCooldown);
}

/** How far a jump goes: the reach of the longest-ranged weapon mounted, so it lands on the range aura. */
export function blinkDist(tower) {
  return Math.max(DRIFT.blinkMinDist, tower.maxRange());
}

/**
 * Jump `blinkDist` along `dir` (a unit vector). Returns false when it was on cooldown, so the
 * caller can play the deny sound.
 */
export function blink(scene, dir) {
  if (!canBlink(scene)) return false;
  const t = scene.tower;
  const x0 = t.x, y0 = t.y, d = blinkDist(t);
  t.setPosition(x0 + dir.x * d, y0 + dir.y * d);
  t.blinkCd = DRIFT.blinkCooldown;
  t.absorbT = 0.2;                     // the membrane snaps back into shape on arrival
  // carry a little speed out of the jump so it flows into the swim
  t.vx = dir.x * DRIFT.speed; t.vy = dir.y * DRIFT.speed;
  scene.followBlob();

  scene.blinkFx = { x0, y0, x1: t.x, y1: t.y, r: t.r, t: 0 };
  scene.fx.spark(x0, y0, COLORS.ice, 12);
  scene.fx.spark(t.x, t.y, COLORS.ice, 12);
  scene.sfx.play('blink', null, t.x);
  scene.ui.addEffect('blink', {
    name: 'Blink', icon: ICONS_BLINK, color: COLORS.ice, dur: DRIFT.blinkCooldown,
    sub: 'recharging', tip: 'Blink\nDouble-tap a movement key to jump.\nReady again when this runs out.',
  });
  return true;
}

/** count the cooldown down; called from the tower's own update while in drift mode */
export function tickBlink(tower, dt) {
  if (!tower.blinkCd) return;
  tower.blinkCd = Math.max(0, tower.blinkCd - dt);
}

/**
 * The jump animation, drawn into its own graphics object: space collapsing where the blob left,
 * a row of afterimages along the path, and a bloom where it lands.
 */
export function drawBlinkFx(scene, g, dt) {
  const f = scene.blinkFx;
  g.clear();
  if (!f) return;
  f.t += dt;
  if (f.t >= DRIFT.blinkFxDur) { scene.blinkFx = null; return; }
  const { x0, y0, x1, y1, r } = f;

  // ---- departure: a ring implodes and streaks are sucked into the hole it leaves
  if (f.t < DEPART) {
    const p = f.t / DEPART, k = 1 - easeOut(p);
    g.lineStyle(2.5, COLORS.ice, 0.9 * k);
    g.strokeCircle(x0, y0, r * 0.4 + r * 3.4 * k);
    g.lineStyle(1, COLORS.white, 0.5 * k);
    g.strokeCircle(x0, y0, r * 0.3 + r * 2.6 * k);
    for (let i = 0; i < STREAKS; i++) {
      const a = i * TAU / STREAKS + p * 1.2, from = r * (0.6 + 3.6 * k), to = from - r * (0.5 + 1.4 * k);
      g.lineStyle(1.5, COLORS.ice, 0.7 * k);
      g.lineBetween(x0 + Math.cos(a) * from, y0 + Math.sin(a) * from, x0 + Math.cos(a) * to, y0 + Math.sin(a) * to);
    }
    g.fillStyle(COLORS.white, 0.35 * k * k);
    g.fillCircle(x0, y0, r * 0.8 * k);
  }

  // ---- the path: afterimages thinning out from where it left to where it lands
  if (f.t < GHOSTS) {
    const k = 1 - f.t / GHOSTS;
    for (let i = 1; i < DRIFT.blinkGhosts; i++) {
      const s = i / DRIFT.blinkGhosts;
      const gx = x0 + (x1 - x0) * s, gy = y0 + (y1 - y0) * s;
      g.lineStyle(1.5, COLORS.ice, 0.5 * k * (1 - s * 0.5));
      g.strokeCircle(gx, gy, r * (0.9 - s * 0.25));
      g.fillStyle(COLORS.ice, 0.10 * k);
      g.fillCircle(gx, gy, r * (0.9 - s * 0.25));
    }
  }

  // ---- arrival: a ring blooms outward with shards, over a flash that fades
  if (f.t < ARRIVE) {
    const p = f.t / ARRIVE, e = easeOut(p), k = 1 - p;
    g.fillStyle(COLORS.ice, 0.22 * k * k);
    g.fillCircle(x1, y1, r * (1 + 2 * e));
    g.lineStyle(3 * k + 0.5, COLORS.ice, 0.9 * k);
    g.strokeCircle(x1, y1, r * (0.5 + 3.6 * e));
    g.lineStyle(1, COLORS.white, 0.6 * k);
    g.strokeCircle(x1, y1, r * (0.3 + 2.4 * e));
    for (let i = 0; i < SHARDS; i++) {
      const a = i * TAU / SHARDS - p * 0.8, from = r * (0.8 + 3.4 * e), to = from + r * (0.6 + 1.2 * k);
      g.lineStyle(2, COLORS.white, 0.7 * k);
      g.lineBetween(x1 + Math.cos(a) * from, y1 + Math.sin(a) * from, x1 + Math.cos(a) * to, y1 + Math.sin(a) * to);
    }
  }
}
