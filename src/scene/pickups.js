// Drift mode wrecks. A killed ship leaves its scrap on the field as a wreck; the blob has to swim
// over it. Anything inside the magnet radius is pulled in and absorbed on contact.
import { COLORS, DRIFT } from '../config.js';
import { TAU, rnd } from '../utils.js';

const SPIN_MIN = 0.6, SPIN_MAX = 2.4;

/** How big a wreck draws, from the base scrap of the ship that left it: 1 for a drone, up to the cap. */
export function wreckSize(weight) {
  const k = Math.pow(Math.max(1, weight) / DRIFT.wreckRef, DRIFT.wreckSizeExp);
  return Math.max(1, Math.min(DRIFT.wreckSizeMax, k));
}

/**
 * Drop `amount` scrap at (x, y) as a wreck. `weight` is the base scrap of the ship it came from and
 * only decides how big the wreck draws; pass nothing for a plain one.
 */
export function spawnWreck(scene, x, y, amount, weight = DRIFT.wreckRef) {
  if (amount <= 0) return;
  const a = Math.random() * TAU, s = rnd(0.3, 1) * DRIFT.wreckDrift;
  scene.wrecks.push({
    x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
    amount, size: wreckSize(weight), t: 0,
    spin: rnd(SPIN_MIN, SPIN_MAX) * (Math.random() < 0.5 ? -1 : 1), phase: Math.random() * TAU,
  });
  if (scene.wrecks.length > DRIFT.wreckCap) mergeOldest(scene);
}

/** Cap only: the oldest wreck folds its scrap into the nearest one and disappears. */
function mergeOldest(scene) {
  let oldest = 0;
  for (let i = 1; i < scene.wrecks.length; i++) if (scene.wrecks[i].t > scene.wrecks[oldest].t) oldest = i;
  const w = scene.wrecks[oldest];
  let best = -1, bestD = Infinity;
  for (let i = 0; i < scene.wrecks.length; i++) {
    if (i === oldest) continue;
    const d = Math.hypot(scene.wrecks[i].x - w.x, scene.wrecks[i].y - w.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best >= 0) {
    const into = scene.wrecks[best];
    into.amount += w.amount;
    into.size = Math.min(DRIFT.wreckSizeMax, Math.max(into.size, w.size) * 1.05);   // a merged wreck looks the part
  }
  scene.wrecks.splice(oldest, 1);
}

/** Yank every wreck inside `radius` toward the blob, ignoring the magnet range (shield burst). */
export function magnetAll(scene, radius) {
  const t = scene.tower;
  for (const w of scene.wrecks) if (Math.hypot(w.x - t.x, w.y - t.y) <= radius) w.forced = true;
}

export function updateWrecks(scene, dt) {
  const t = scene.tower, magnet = t.magnetR, pickup = DRIFT.pickup + t.r;
  const decay = Math.pow(DRIFT.wreckDrag, dt);
  let picked = 0, gained = 0, lastX = 0, lastY = 0;
  for (let i = scene.wrecks.length - 1; i >= 0; i--) {
    const w = scene.wrecks[i];
    w.t += dt;
    const dx = t.x - w.x, dy = t.y - w.y, d = Math.hypot(dx, dy) || 1;
    w.pulled = d < magnet || !!w.forced;
    if (w.pulled) {
      // speed ramps the longer it has been travelling, so it out-runs the blob however it moves
      w.pullT = (w.pullT || 0) + dt;
      const speed = Math.min(DRIFT.magnetMax, DRIFT.magnetStart + DRIFT.magnetRamp * w.pullT);
      const f = 1 - Math.exp(-DRIFT.magnetSteer * dt);
      w.vx += (dx / d * speed - w.vx) * f;
      w.vy += (dy / d * speed - w.vy) * f;
    } else { w.pullT = 0; w.vx *= decay; w.vy *= decay; }
    w.x += w.vx * dt; w.y += w.vy * dt;
    if (d <= pickup) {
      scene.wrecks.splice(i, 1);
      picked++; gained += w.amount; lastX = w.x; lastY = w.y;
    }
  }
  if (!picked) return;
  scene.creditScrap(gained, lastX, lastY, scene.wreckPicks % DRIFT.floaterEvery === 0);
  scene.wreckPicks = (scene.wreckPicks || 0) + picked;
  scene.sfx.play('pickup', null, t.x);
  t.absorbT = 0.18;
}

/**
 * Wrecks read as salvage, never as a threat: they are the only lime thing in the game. Kept small and
 * thin on purpose, so a field of them never hides the ships behind it.
 */
export function drawWrecks(scene, g) {
  g.clear();
  if (!scene.wrecks.length) return;
  const t = scene.tower;
  for (const w of scene.wrecks) {
    const big = w.size >= DRIFT.wreckRingAt;
    const r = DRIFT.wreckR * w.size;
    const beat = 0.5 + 0.5 * Math.sin(w.t * 3.4 + w.phase);
    const rot = w.phase + w.t * w.spin * 0.6;

    // flying in: a tail behind it, so the trip to the blob is something you can watch
    if (w.pulled) {
      const sp = Math.hypot(w.vx, w.vy);
      if (sp > 30) {
        const tail = Math.min(48, sp * 0.085), ux = -w.vx / sp, uy = -w.vy / sp;
        g.lineStyle(1.5, COLORS.lime, 0.4);
        g.lineBetween(w.x, w.y, w.x + ux * tail, w.y + uy * tail);
        for (let i = 1; i <= 4; i++) {
          const f = i / 4;
          g.fillStyle(COLORS.lime, 0.42 * (1 - f) + 0.06);
          g.fillCircle(w.x + ux * tail * f, w.y + uy * tail * f, r * (1 - f * 0.6));
        }
      }
    }

    // a tight halo, just enough to catch the eye
    g.fillStyle(COLORS.lime, 0.07 + beat * 0.05);
    g.fillCircle(w.x, w.y, r * (2.2 + beat * 0.3));

    // four short spikes that turn: movement is what makes them findable, not size
    g.lineStyle(1, COLORS.lime, 0.5 + beat * 0.3);
    for (let i = 0; i < 4; i++) {
      const a = rot + i * TAU / 4, len = r * (2 + beat * 0.5);
      g.lineBetween(w.x + Math.cos(a) * r * 0.8, w.y + Math.sin(a) * r * 0.8, w.x + Math.cos(a) * len, w.y + Math.sin(a) * len);
    }

    // body: a small crystal with a pale centre
    g.lineStyle(1, COLORS.lime, 0.9); g.fillStyle(COLORS.lime, 0.85);
    g.beginPath();
    const pts = big ? 8 : 6;                       // bigger wrecks get more facets, so they do not read as a plain triangle
    for (let i = 0; i < pts; i++) {
      const a = rot * 1.6 + i * TAU / pts, rr = r * (i % 2 ? 0.6 : 1.1);
      const px = w.x + Math.cos(a) * rr, py = w.y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0xeaffc4, 0.9);
    g.fillCircle(w.x, w.y, r * 0.35);
    if (big) { g.lineStyle(1, COLORS.lime, 0.3 + beat * 0.25); g.strokeCircle(w.x, w.y, r * 1.9); }
  }
}

export function clearWrecks(scene) {
  scene.wrecks = [];
  scene.wreckPicks = 0;
  if (scene.wreckGfx) scene.wreckGfx.clear();
}

/** total scrap lying on the field, for the HUD */
export function wreckValue(scene) {
  let n = 0; for (const w of scene.wrecks) n += w.amount; return n;
}
