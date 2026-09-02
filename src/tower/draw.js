// Tower rendering. Pure draw code: reads tower state, writes to its graphics object.
import { COLORS } from '../config.js';

const BODY = 0x0b1030;          // dark hull fill shared by body, hardpoints and hull-arc backing
const TURRET_LEN = 16;          // barrel length from mount point
const HULL_ARC_R = 22;          // hull arc sits this far outside the body radius
const HULL_ARC_FROM = Math.PI * 0.12, HULL_ARC_SPAN = Math.PI * 0.76;

/** Draw the whole tower: aura, shield ring, body, hardpoints, weapons, core, hull arc. */
export function drawTower(tower, g, dt) {
  const scene = tower.scene;
  g.clear();
  const { x, y, r } = tower;
  const pulse = 0.5 + 0.5 * Math.sin(tower.spin * 3);
  const oc = scene.abilities.state.overcharge.active > 0;
  tower.glow.setTint(oc ? COLORS.orange : tower.coreColor).setScale((oc ? 2.2 : 1.5) + pulse * 0.15).setAlpha(0.45 + pulse * 0.15);

  drawRangeAura(tower, g, pulse);
  drawShield(tower, g, dt, pulse);

  // outer rotating ring with ticks
  g.lineStyle(1.5, COLORS.cyan, 0.5);
  g.strokeCircle(x, y, r + 10);
  for (let i = 0; i < 6; i++) {
    const a = tower.spin * 0.6 + i * Math.PI / 3;
    g.lineBetween(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), x + Math.cos(a) * (r + 13), y + Math.sin(a) * (r + 13));
  }

  // hexagon body
  g.lineStyle(2, COLORS.white, 0.9);
  g.fillStyle(BODY, 0.9);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -tower.spin * 0.3 + i * Math.PI / 3;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fillPath(); g.strokePath();

  drawHardpoints(tower, g);
  for (const w of tower.weapons) w.draw(g);
  drawCore(tower, g, pulse);
  drawHullArc(tower, g);
}

function drawRangeAura(tower, g, pulse) {
  const { x, y } = tower;
  const maxRange = tower.maxRange();
  if (maxRange <= 0) return;
  g.fillStyle(COLORS.cyan, 0.025 + pulse * 0.01);
  g.fillCircle(x, y, maxRange);
  g.lineStyle(1, COLORS.cyan, 0.10 + pulse * 0.05);
  g.strokeCircle(x, y, maxRange);
  for (const w of tower.weapons) {
    if (w.range === maxRange) continue;
    g.lineStyle(1, w.def.color, 0.08); g.strokeCircle(x, y, w.range);
  }
}

// shield ring: thickness = shield percentage
function drawShield(tower, g, dt, pulse) {
  const { x, y, shieldR } = tower;
  const sf = tower.shield / tower.shieldMax;
  const regenerating = tower.regenDelay <= 0 && tower.shield < tower.shieldMax;
  tower.regenPhase += dt * (tower.calm ? 2.2 : 1);
  if (sf > 0) {
    const width = 1.5 + 14 * sf;
    const alpha = tower.hitTimer > 0 ? 1 : 0.3 + 0.5 * sf;
    g.fillStyle(COLORS.cyan, 0.02 + sf * 0.05);
    g.fillCircle(x, y, shieldR);
    g.lineStyle(width, tower.hitTimer > 0 ? COLORS.white : COLORS.cyan, alpha);
    g.strokeCircle(x, y, shieldR);
    g.lineStyle(1, COLORS.white, 0.25 + sf * 0.4);
    g.strokeCircle(x, y, shieldR + width / 2);
  } else {
    g.lineStyle(1, COLORS.red, 0.35 + pulse * 0.3);
    g.strokeCircle(x, y, shieldR);
  }
  // regen animation: bright segments sweep the ring, energy pulses collapse inward
  if (regenerating) {
    const n = tower.calm ? 6 : 3, sweep = tower.regenPhase * 2.5;
    for (let i = 0; i < n; i++) {
      const a0 = sweep + i * (Math.PI * 2 / n);
      g.lineStyle(3 + 10 * sf, COLORS.white, tower.calm ? 0.55 : 0.3);
      g.beginPath(); g.arc(x, y, shieldR, a0, a0 + 0.35, false); g.strokePath();
    }
    const period = tower.calm ? 0.5 : 1.0;
    const k = (tower.regenPhase % period) / period;
    const pr = shieldR + 34 * (1 - k);
    g.lineStyle(2, COLORS.cyan, 0.5 * k);
    g.strokeCircle(x, y, pr);
  }
}

// hardpoints + turrets
function drawHardpoints(tower, g) {
  const { x, y, r } = tower;
  tower.slots.forEach((w, i) => {
    const sa = tower.slotAngle(i);
    const mx = x + Math.cos(sa) * r, my = y + Math.sin(sa) * r;
    if (!w) {
      g.lineStyle(1.5, COLORS.cyan, 0.5); g.strokeCircle(mx, my, 4);
      return;
    }
    const a = w.angle, jam = w.jammed > 0 || w.jamSlow > 0;
    g.fillStyle(BODY, 1); g.fillCircle(mx, my, 6);
    g.lineStyle(1.5, jam ? COLORS.red : w.color, 0.9); g.strokeCircle(mx, my, 6);
    if (jam) {
      g.lineStyle(2, COLORS.red, 0.8);
      g.lineBetween(mx - 5, my - 5, mx + 5, my + 5);
      g.lineBetween(mx - 5, my + 5, mx + 5, my - 5);
    }
    const bx = mx + Math.cos(a) * TURRET_LEN, by = my + Math.sin(a) * TURRET_LEN;
    g.lineStyle(6, BODY, 1);
    g.lineBetween(mx, my, bx, by);
    g.lineStyle(3, w.color, 1);
    g.lineBetween(mx, my, bx, by);
  });
}

// core (colour = prestige tier), with one orbiting mote per prestige level (max 6)
function drawCore(tower, g, pulse) {
  const { x, y } = tower;
  const pc = tower.coreColor, pl = tower.scene.profile ? tower.scene.profile.prestige : 0;
  g.fillStyle(COLORS.white, 0.9);
  g.fillCircle(x, y, 6 + pulse * 1.5);
  g.fillStyle(pc, 0.6);
  g.fillCircle(x, y, 9 + pulse * 2);
  for (let i = 0; i < Math.min(pl, 6); i++) {
    const a = tower.spin * (1 + i * 0.3) + i * 1.1;
    g.fillStyle(pc, 0.9); g.fillCircle(x + Math.cos(a) * (14 + i * 1.5), y + Math.sin(a) * (14 + i * 1.5), 1.6);
  }
}

// hull arc under tower
function drawHullArc(tower, g) {
  const { x, y, r } = tower;
  const hf = tower.hull / tower.hullMax;
  const hullColor = hf > 0.5 ? COLORS.green : hf > 0.25 ? COLORS.orange : COLORS.red;
  g.lineStyle(4, BODY, 0.8);
  g.beginPath(); g.arc(x, y, r + HULL_ARC_R, HULL_ARC_FROM, HULL_ARC_FROM + HULL_ARC_SPAN, false); g.strokePath();
  if (hf > 0) {
    g.lineStyle(4, hullColor, 0.95);
    g.beginPath(); g.arc(x, y, r + HULL_ARC_R, HULL_ARC_FROM, HULL_ARC_FROM + HULL_ARC_SPAN * hf, false); g.strokePath();
  }
}
