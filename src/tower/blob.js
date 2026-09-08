// Drift-mode rendering: the core as a swimming blob. Same readouts as the tower (shield ring, hardpoints,
// nucleus) wrapped in a wobbling membrane that stretches in the direction of travel.
import { COLORS, DRIFT } from '../config.js';
import { drawRangeAura, drawShield, drawHardpoints, drawCore } from './draw.js';
import { blinkCharge } from '../drift/blink.js';

const TAU = Math.PI * 2;
const MEMBRANE = 0x0b1030;      // same dark fill the tower body uses, so the two modes match
const CILIA = 14;               // little hairs around the rim

/** Membrane radius at angle `a`: two sine waves for the wobble, more of it as the hull drops. */
function radiusAt(tower, a, t, amp) {
  const w = 1 + amp * Math.sin(a * 3 + t * 2) + amp * 0.6 * Math.sin(a * 5 - t * 3.1);
  return tower.r * w;
}

/** Closed membrane path, squashed along the direction of travel. */
function membrane(g, tower, t, amp, scale, sx, sy, ca, sa) {
  const n = DRIFT.blobPoints;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i * TAU / n, r = radiusAt(tower, a, t, amp) * scale;
    // rotate into the travel frame, stretch, rotate back
    const lx = Math.cos(a) * r, ly = Math.sin(a) * r;
    const fx = (lx * ca + ly * sa) * sx, fy = (-lx * sa + ly * ca) * sy;
    const px = tower.x + fx * ca - fy * sa, py = tower.y + fx * sa + fy * ca;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}

export function drawBlob(tower, g, dt) {
  const scene = tower.scene;
  g.clear();
  const { x, y } = tower;
  const t = tower.spin;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  const oc = scene.abilities.state.overcharge.active > 0;
  tower.glow.setTint(oc ? COLORS.orange : tower.coreColor).setScale((oc ? 2.4 : 1.7) + pulse * 0.2).setAlpha(0.4 + pulse * 0.15);

  const hf = Math.max(0, Math.min(1, tower.hull / tower.hullMax));
  const skin = hf > 0.5 ? tower.coreColor : hf > 0.25 ? COLORS.orange : COLORS.red;
  const amp = DRIFT.blobWobble * (1 + (1 - hf) * 1.4);          // a hurt blob wobbles harder
  const speed = Math.hypot(tower.vx || 0, tower.vy || 0);
  const k = Math.min(1, speed / DRIFT.speed) * DRIFT.blobStretch;
  const dir = speed > 1 ? Math.atan2(tower.vy, tower.vx) : 0;
  const ca = Math.cos(dir), sa = Math.sin(dir);
  const pop = 1 + (tower.absorbT > 0 ? tower.absorbT * 0.9 : 0);  // little bulge when a wreck is swallowed
  const sx = 1 + k, sy = 1 / (1 + k);

  drawRangeAura(tower, g, pulse);
  drawMagnetAura(tower, g, t);
  drawShield(tower, g, dt, pulse);
  drawBlinkRing(tower, g, pulse);

  // outer halo, body, and a lighter inner blob offset backwards like a nucleus sac
  g.fillStyle(skin, 0.10 + pulse * 0.04);
  membrane(g, tower, t, amp, 1.35 * pop, sx, sy, ca, sa); g.fillPath();
  g.fillStyle(MEMBRANE, 0.92); g.lineStyle(2, skin, 0.9);
  membrane(g, tower, t, amp, 1 * pop, sx, sy, ca, sa); g.fillPath(); g.strokePath();
  g.lineStyle(1, skin, 0.30);
  membrane(g, tower, t * 1.3 + 1.7, amp * 0.8, 0.72 * pop, sx, sy, ca, sa); g.strokePath();

  // cilia: short hairs that trail backwards while moving
  g.lineStyle(1.5, skin, 0.45);
  for (let i = 0; i < CILIA; i++) {
    const a = i * TAU / CILIA + t * 0.2;
    const r = radiusAt(tower, a, t, amp) * pop;
    const lean = a - dir, back = -Math.cos(lean) * k * 6;
    const x0 = x + Math.cos(a) * r, y0 = y + Math.sin(a) * r;
    const len = 4 + Math.sin(t * 4 + i) * 1.5 + Math.abs(back);
    g.lineBetween(x0, y0, x0 + Math.cos(a) * len - ca * back, y0 + Math.sin(a) * len - sa * back);
  }

  // vacuoles drifting inside
  for (let i = 0; i < 4; i++) {
    const a = t * (0.4 + i * 0.17) + i * 1.9, rr = tower.r * (0.25 + i * 0.12);
    g.fillStyle(skin, 0.25);
    g.fillCircle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2.5 + (i % 2));
  }

  drawHardpoints(tower, g);
  for (const w of tower.weapons) w.draw(g);
  if (scene.quads) scene.quads.draw(g);
  drawCore(tower, g, pulse);
}

/**
 * Blink cooldown as a ring outside the shield: an arc that fills up as it recharges, then a bright
 * ring with four ticks once the jump is ready again.
 */
function drawBlinkRing(tower, g, pulse) {
  const { x, y } = tower, R = tower.shieldR + DRIFT.blinkRingR;
  const charge = blinkCharge(tower), ready = charge >= 1;
  g.lineStyle(3.5, 0x0b1030, 0.55);                  // dark backing, so the arc reads over anything
  g.strokeCircle(x, y, R);
  g.lineStyle(1.5, COLORS.ice, 0.16);                // the empty track
  g.strokeCircle(x, y, R);
  if (!ready) {
    g.lineStyle(3.5, COLORS.ice, 0.85);
    g.beginPath(); g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * charge, false); g.strokePath();
    const a = -Math.PI / 2 + TAU * charge;
    g.fillStyle(COLORS.white, 0.95);                 // the head of the arc
    g.fillCircle(x + Math.cos(a) * R, y + Math.sin(a) * R, 2.5);
    return;
  }
  g.lineStyle(3, COLORS.ice, 0.6 + pulse * 0.35);
  g.strokeCircle(x, y, R);
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * TAU / 4 + tower.spin * 0.5;
    g.lineStyle(2, COLORS.white, 0.5 + pulse * 0.4);
    g.lineBetween(x + Math.cos(a) * (R - 4), y + Math.sin(a) * (R - 4), x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4));
  }
}

/**
 * The pickup ring: everything lime is salvage, so the aura that swallows wrecks is lime too and
 * dashed, which keeps it apart from the solid cyan weapon-range circle it sits inside.
 */
function drawMagnetAura(tower, g, t) {
  const { x, y } = tower, R = tower.magnetR;
  const n = DRIFT.magnetTicks, span = TAU / n * 0.55, spin = t * 0.12;
  g.fillStyle(COLORS.lime, 0.018);
  g.fillCircle(x, y, R);
  g.lineStyle(1.5, COLORS.lime, 0.28);
  for (let i = 0; i < n; i++) {
    const a0 = spin + i * TAU / n;
    g.beginPath(); g.arc(x, y, R, a0, a0 + span, false); g.strokePath();
  }
}
