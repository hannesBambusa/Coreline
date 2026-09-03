// Tower rendering. Pure draw code: reads tower state, writes to its graphics object.
//
// Layout, inside out: core -> hex body with armour plates (hull) -> hardpoints with per-weapon turrets ->
// segmented shield ring (capacity = lit segments, regen = charging segment + chasing motes) -> range aura.
import { COLORS } from '../config.js';

const BODY = 0x0b1030;          // dark hull fill shared by body, hardpoints and plates
const PLATE = 0x141b3d;         // armour plate fill
const TAU = Math.PI * 2;

// shield ring
const SEGMENTS = 24;            // shield capacity is shown as lit segments
const SEG_GAP = 0.05;           // radians between segments
const SEG_WIDTH = 6;
const REGEN_MOTES = 8;          // motes chasing around the inner regen track while charging
const REGEN_TRACK = 9;          // px inside the shield ring
const CRACK_LEN = 10;

// hull plates
const PLATES = 6;
const PLATE_IN = 4, PLATE_OUT = 14;   // px outside the body radius

// hardpoints
const MOUNT_R = 8;
const RECOIL_T = 0.12;          // seconds of recoil after a shot
const RECOIL_PX = 3;

/** Draw the whole tower. */
export function drawTower(tower, g, dt) {
  const scene = tower.scene;
  g.clear();
  const { x, y, r } = tower;
  const pulse = 0.5 + 0.5 * Math.sin(tower.spin * 3);
  const oc = scene.abilities.state.overcharge.active > 0;
  tower.glow.setTint(oc ? COLORS.orange : tower.coreColor).setScale((oc ? 2.2 : 1.5) + pulse * 0.15).setAlpha(0.45 + pulse * 0.15);

  drawRangeAura(tower, g, pulse);
  drawShield(tower, g, dt, pulse);
  drawBody(tower, g);
  drawHullPlates(tower, g);
  drawHardpoints(tower, g);
  for (const w of tower.weapons) w.draw(g);
  drawCore(tower, g, pulse);
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

/** one arc segment of the shield ring */
function seg(g, x, y, R, i, from = 0, to = 1) {
  const span = TAU / SEGMENTS - SEG_GAP, a0 = -Math.PI / 2 + i * TAU / SEGMENTS + SEG_GAP / 2;
  g.beginPath(); g.arc(x, y, R, a0 + span * from, a0 + span * to, false); g.strokePath();
}

// Shield: SEGMENTS arc segments around shieldR. Lit segments = capacity. While charging, the next segment fills up
// like a progress bar and motes race around an inner track (faster = more regen, doubled when calm).
function drawShield(tower, g, dt, pulse) {
  const { x, y, shieldR: R } = tower;
  const sf = Math.max(0, Math.min(1, tower.shield / tower.shieldMax));
  const lit = sf * SEGMENTS, full = Math.floor(lit), partial = lit - full;
  const regenerating = tower.regenDelay <= 0 && tower.shield < tower.shieldMax;
  const hit = tower.hitTimer > 0;
  const regenSpeed = tower.calm ? 2.2 : 1;
  tower.regenPhase += dt * regenSpeed;

  // faint disc + dim rail for every segment
  g.fillStyle(COLORS.cyan, 0.015 + sf * 0.04);
  g.fillCircle(x, y, R);
  g.lineStyle(SEG_WIDTH, sf > 0 ? COLORS.cyan : COLORS.red, 0.10);
  for (let i = 0; i < SEGMENTS; i++) seg(g, x, y, R, i);

  // lit segments
  if (full > 0) {
    g.lineStyle(SEG_WIDTH, hit ? COLORS.white : COLORS.cyan, hit ? 1 : 0.75 + 0.15 * pulse);
    for (let i = 0; i < full; i++) seg(g, x, y, R, i);
    g.lineStyle(1, COLORS.white, 0.35);
    for (let i = 0; i < full; i++) seg(g, x, y, R + SEG_WIDTH / 2 + 1, i);
  }
  // the segment being charged
  if (partial > 0 && full < SEGMENTS) {
    const charging = regenerating ? 0.5 + 0.5 * Math.sin(tower.regenPhase * 6) : 1;
    g.lineStyle(SEG_WIDTH, COLORS.cyan, 0.35 + 0.5 * charging);
    seg(g, x, y, R, full, 0, partial);
    if (regenerating) { g.lineStyle(2, COLORS.white, 0.8 * charging); seg(g, x, y, R, full, Math.max(0, partial - 0.08), partial); }
  }
  // regen track: motes chase around just inside the ring, spaced by regen rate
  if (regenerating) {
    const track = R - REGEN_TRACK, n = tower.calm ? REGEN_MOTES : REGEN_MOTES / 2;
    g.lineStyle(1, COLORS.cyan, 0.25); g.strokeCircle(x, y, track);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + tower.regenPhase * 1.6 + i * TAU / n;
      g.fillStyle(COLORS.white, 0.9); g.fillCircle(x + Math.cos(a) * track, y + Math.sin(a) * track, 1.8);
      g.fillStyle(COLORS.cyan, 0.5); g.fillCircle(x + Math.cos(a - 0.08) * track, y + Math.sin(a - 0.08) * track, 1.4);
    }
    if (tower.calm) { g.lineStyle(1, COLORS.cyan, 0.15 + 0.15 * pulse); g.strokeCircle(x, y, track - 4); }
  }
  // broken: red dashed warning ring and cracks
  if (sf <= 0) {
    g.lineStyle(2, COLORS.red, 0.4 + pulse * 0.4);
    for (let i = 0; i < SEGMENTS; i += 2) seg(g, x, y, R, i);
  }
  // hit: white flare on the impact side
  if (hit && tower.hitAngle !== undefined) {
    const a = tower.hitAngle, k = tower.hitTimer;
    g.lineStyle(3, COLORS.white, k * 2);
    for (let i = -2; i <= 2; i++) {
      const aa = a + i * 0.25, r0 = R + SEG_WIDTH / 2, r1 = r0 + CRACK_LEN * (1 - Math.abs(i) * 0.3);
      g.lineBetween(x + Math.cos(aa) * r0, y + Math.sin(aa) * r0, x + Math.cos(aa) * r1, y + Math.sin(aa) * r1);
    }
  }
}

// hexagon body with inner rotating ring and vents
function drawBody(tower, g) {
  const { x, y, r } = tower;
  const spin = -tower.spin * 0.3;
  g.lineStyle(2, COLORS.white, 0.9); g.fillStyle(BODY, 0.95);
  hex(g, x, y, r, spin); g.fillPath(); g.strokePath();
  g.lineStyle(1, COLORS.cyan, 0.35);
  hex(g, x, y, r * 0.72, spin); g.strokePath();
  // vents between hex corners
  g.lineStyle(1.5, COLORS.cyan, 0.5);
  for (let i = 0; i < 6; i++) {
    const a = spin + i * Math.PI / 3 + Math.PI / 6;
    g.lineBetween(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66);
  }
  // inner ring with ticks
  g.lineStyle(1.5, COLORS.cyan, 0.5); g.strokeCircle(x, y, r * 0.42);
  for (let i = 0; i < 8; i++) {
    const a = tower.spin * 0.6 + i * Math.PI / 4;
    g.lineBetween(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36, x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42);
  }
}

function hex(g, x, y, r, rot) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}

// Hull: six armour plates around the body. Plates fill in order with hull fraction; colour follows hull health.
function drawHullPlates(tower, g) {
  const { x, y, r } = tower;
  const hf = Math.max(0, Math.min(1, tower.hull / tower.hullMax));
  const color = hf > 0.5 ? COLORS.green : hf > 0.25 ? COLORS.orange : COLORS.red;
  const filled = hf * PLATES, rot = -tower.spin * 0.3;
  for (let i = 0; i < PLATES; i++) {
    const a0 = rot + i * TAU / PLATES + 0.06, a1 = rot + (i + 1) * TAU / PLATES - 0.06;
    const f = Math.max(0, Math.min(1, filled - i));
    g.lineStyle(1, COLORS.white, 0.25); g.fillStyle(PLATE, 0.9);
    plate(g, x, y, r + PLATE_IN, r + PLATE_OUT, a0, a1); g.fillPath(); g.strokePath();
    if (f > 0) {
      g.fillStyle(color, 0.55 + 0.3 * f);
      plate(g, x, y, r + PLATE_IN + 1, r + PLATE_OUT - 1, a0 + 0.02, a0 + 0.02 + (a1 - a0 - 0.04) * f); g.fillPath();
    }
  }
  if (hf <= 0.25) { g.lineStyle(1, COLORS.red, 0.5 + 0.4 * Math.sin(tower.spin * 6)); g.strokeCircle(x, y, r + PLATE_OUT + 2); }
}

function plate(g, x, y, r0, r1, a0, a1) {
  g.beginPath();
  g.moveTo(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0);
  g.lineTo(x + Math.cos(a0) * r1, y + Math.sin(a0) * r1);
  g.arc(x, y, r1, a0, a1, false);
  g.lineTo(x + Math.cos(a1) * r0, y + Math.sin(a1) * r0);
  g.arc(x, y, r0, a1, a0, true);
  g.closePath();
}

// ---- hardpoints and turrets ---------------------------------------------------------------------------

/** local-frame helper: points are [forward, side] in px, rotated by `a` around (mx, my) */
const P = (mx, my, a, f, s) => [mx + Math.cos(a) * f - Math.sin(a) * s, my + Math.sin(a) * f + Math.cos(a) * s];
function poly(g, pts) { g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); }
function line(g, mx, my, a, f0, s0, f1, s1) { const [ax, ay] = P(mx, my, a, f0, s0), [bx, by] = P(mx, my, a, f1, s1); g.lineBetween(ax, ay, bx, by); }

function drawHardpoints(tower, g) {
  const { x, y, r } = tower;
  tower.slots.forEach((w, i) => {
    const sa = tower.slotAngle(i);
    const mx = x + Math.cos(sa) * (r + PLATE_OUT - 2), my = y + Math.sin(sa) * (r + PLATE_OUT - 2);
    // mount: rounded pad facing outward
    if (!w) {
      g.lineStyle(1.5, COLORS.cyan, 0.45); g.fillStyle(BODY, 0.8);
      poly(g, [P(mx, my, sa, -5, -6), P(mx, my, sa, 3, -6), P(mx, my, sa, 3, 6), P(mx, my, sa, -5, 6)]); g.fillPath(); g.strokePath();
      g.lineStyle(1, COLORS.cyan, 0.5); g.strokeCircle(mx, my, 3);
      return;
    }
    const jam = w.jammed > 0 || w.jamSlow > 0, c = jam ? COLORS.red : w.color;
    const period = 1 / Math.max(0.01, w.rate), sinceShot = period - w.cd;
    const recoil = w.cd > 0 && sinceShot >= 0 && sinceShot < RECOIL_T ? (1 - sinceShot / RECOIL_T) * RECOIL_PX : 0;
    g.lineStyle(1.5, c, 0.9); g.fillStyle(BODY, 1);
    poly(g, [P(mx, my, sa, -6, -8), P(mx, my, sa, 4, -8), P(mx, my, sa, 4, 8), P(mx, my, sa, -6, 8)]); g.fillPath(); g.strokePath();
    // turret ring
    g.fillStyle(PLATE, 1); g.fillCircle(mx, my, MOUNT_R);
    g.lineStyle(1.5, c, 0.9); g.strokeCircle(mx, my, MOUNT_R);
    drawTurret(g, w, mx, my, w.angle, c, recoil);
    if (jam) {
      g.lineStyle(2, COLORS.red, 0.9);
      g.lineBetween(mx - 6, my - 6, mx + 6, my + 6); g.lineBetween(mx - 6, my + 6, mx + 6, my - 6);
    }
  });
}

/** per-type turret in the mount's local frame (forward = aim direction) */
function drawTurret(g, w, mx, my, a, c, recoil) {
  const k = -recoil;
  switch (w.type) {
    case 'pulse': {   // twin barrels, extra pairs with barrel count
      const n = Math.min(3, w.barrels || 1), sp = n > 1 ? 3 : 0;
      g.lineStyle(2.5, c, 1);
      for (let i = 0; i < n; i++) { const s = (i - (n - 1) / 2) * sp * 2; line(g, mx, my, a, 2 + k, s, 15 + k, s); }
      g.fillStyle(c, 1); g.fillCircle(mx, my, 3);
      break;
    }
    case 'railgun': {  // long barrel, two side rails, muzzle brake; the barrel glows gold while the heavy slug is loaded
      if (w.heavyNext) { g.lineStyle(9, 0xffd166, 0.35); line(g, mx, my, a, 0, 0, 22 + k, 0); }
      g.lineStyle(5, BODY, 1); line(g, mx, my, a, 0, 0, 22 + k, 0);
      g.lineStyle(2.5, c, 1); line(g, mx, my, a, 0, 0, 22 + k, 0);
      g.lineStyle(1, c, 0.8); line(g, mx, my, a, 4, -4, 14 + k, -4); line(g, mx, my, a, 4, 4, 14 + k, 4);
      line(g, mx, my, a, 19 + k, -4, 19 + k, 4);
      break;
    }
    case 'missile': {  // box launcher with four tubes
      g.lineStyle(1.5, c, 0.9); g.fillStyle(BODY, 1);
      poly(g, [P(mx, my, a, -2, -7), P(mx, my, a, 12 + k, -7), P(mx, my, a, 12 + k, 7), P(mx, my, a, -2, 7)]); g.fillPath(); g.strokePath();
      for (const s of [-4, 4]) for (const f of [3, 8]) { const [px, py] = P(mx, my, a, f + k, s); g.fillStyle(c, 0.9); g.fillCircle(px, py, 1.6); }
      break;
    }
    case 'laser': {    // emitter with a focusing ring at the front
      g.lineStyle(4, c, 0.9); line(g, mx, my, a, 0, 0, 9, 0);
      const [fx, fy] = P(mx, my, a, 13, 0);
      g.lineStyle(1.5, c, 1); g.strokeCircle(fx, fy, 4);
      g.fillStyle(COLORS.white, 0.9); g.fillCircle(fx, fy, 1.5);
      break;
    }
    case 'tesla': {    // coil with two prongs
      g.lineStyle(3, c, 0.9); line(g, mx, my, a, 0, 0, 8, 0);
      g.lineStyle(1.5, c, 1); line(g, mx, my, a, 8, 0, 15, -5); line(g, mx, my, a, 8, 0, 15, 5);
      const [px, py] = P(mx, my, a, 6, 0); g.lineStyle(1, COLORS.white, 0.6); g.strokeCircle(px, py, 3);
      break;
    }
    case 'gravity': {  // ring emitter
      const [px, py] = P(mx, my, a, 10, 0);
      g.lineStyle(2, c, 1); g.strokeCircle(px, py, 5);
      g.lineStyle(1, c, 0.6); g.strokeCircle(px, py, 2);
      g.lineStyle(2.5, c, 0.9); line(g, mx, my, a, 0, 0, 5, 0);
      break;
    }
    case 'shock': {    // dish
      g.lineStyle(2, c, 0.9); line(g, mx, my, a, 0, 0, 6, 0);
      const [px, py] = P(mx, my, a, 6, 0);
      g.lineStyle(2, c, 1); g.beginPath(); g.arc(px, py, 7, a - 1.1, a + 1.1, false); g.strokePath();
      g.lineStyle(1, c, 0.6); g.beginPath(); g.arc(px, py, 4, a - 1.2, a + 1.2, false); g.strokePath();
      break;
    }
    case 'drones': {   // hangar pad with a bay door line
      g.lineStyle(1.5, c, 0.9); g.fillStyle(BODY, 1);
      poly(g, [P(mx, my, a, -1, -7), P(mx, my, a, 10, -5), P(mx, my, a, 10, 5), P(mx, my, a, -1, 7)]); g.fillPath(); g.strokePath();
      g.lineStyle(1, c, 0.7); line(g, mx, my, a, 2, -4, 8, -4); line(g, mx, my, a, 2, 4, 8, 4);
      break;
    }
    case 'beamdrones': {   // hangar pad with a lens on the door
      g.lineStyle(1.5, c, 0.9); g.fillStyle(BODY, 1);
      poly(g, [P(mx, my, a, -1, -7), P(mx, my, a, 10, -5), P(mx, my, a, 10, 5), P(mx, my, a, -1, 7)]); g.fillPath(); g.strokePath();
      const [lx, ly] = P(mx, my, a, 6, 0); g.lineStyle(1.5, c, 1); g.strokeCircle(lx, ly, 3);
      break;
    }
    case 'missiledrones': {   // hangar pad with two tubes on the door
      g.lineStyle(1.5, c, 0.9); g.fillStyle(BODY, 1);
      poly(g, [P(mx, my, a, -1, -7), P(mx, my, a, 10, -5), P(mx, my, a, 10, 5), P(mx, my, a, -1, 7)]); g.fillPath(); g.strokePath();
      for (const s of [-3, 3]) { const [px, py] = P(mx, my, a, 7, s); g.fillStyle(c, 0.9); g.fillCircle(px, py, 1.6); }
      break;
    }
    case 'kamikaze': {     // hangar pad with a warning chevron
      g.lineStyle(1.5, c, 0.9); g.fillStyle(BODY, 1);
      poly(g, [P(mx, my, a, -1, -7), P(mx, my, a, 10, -5), P(mx, my, a, 10, 5), P(mx, my, a, -1, 7)]); g.fillPath(); g.strokePath();
      g.lineStyle(1.5, c, 1); line(g, mx, my, a, 3, -4, 8, 0); line(g, mx, my, a, 3, 4, 8, 0);
      break;
    }
    case 'mirrors': {      // small angled plate on a stalk
      g.lineStyle(2, c, 0.9); line(g, mx, my, a, 0, 0, 7, 0);
      g.lineStyle(2.5, COLORS.white, 0.9); line(g, mx, my, a, 8, -6, 8, 6);
      g.lineStyle(1.5, c, 0.7); line(g, mx, my, a, 10, -5, 10, 5);
      break;
    }
    case 'ionstorm': {     // antenna mast with a dish
      g.lineStyle(2, c, 0.9); line(g, mx, my, a, 0, 0, 12, 0);
      const [dx, dy] = P(mx, my, a, 12, 0); g.lineStyle(1.5, c, 1); g.beginPath(); g.arc(dx, dy, 5, a - 1.3, a + 1.3, false); g.strokePath();
      g.lineStyle(1, c, 0.6); line(g, mx, my, a, 6, -4, 6, 4);
      break;
    }
    case 'chrono': {   // clock disc with a hand
      const [px, py] = P(mx, my, a, 8, 0);
      g.lineStyle(2, c, 1); g.strokeCircle(px, py, 6);
      const ha = w.phase || 0; g.lineStyle(1.5, COLORS.white, 0.8); g.lineBetween(px, py, px + Math.cos(ha) * 4, py + Math.sin(ha) * 4);
      break;
    }
    case 'nanite': {   // nozzle with three spines
      g.lineStyle(2.5, c, 0.9); line(g, mx, my, a, 0, 0, 10, 0);
      g.lineStyle(1, c, 0.8); for (const s of [-5, 0, 5]) line(g, mx, my, a, 10, s * 0.4, 15, s);
      break;
    }
    case 'singularity': {   // cradle; the weapon draws its own orb on top
      g.lineStyle(1.5, c, 0.8); line(g, mx, my, a, 2, -6, 9, -3); line(g, mx, my, a, 2, 6, 9, 3);
      break;
    }
    default: {
      g.lineStyle(3, c, 1); line(g, mx, my, a, 0, 0, 14 + k, 0);
    }
  }
}

// core (colour = prestige tier) with one orbiting mote per prestige level (max 6) and a slow reticle
function drawCore(tower, g, pulse) {
  const { x, y } = tower;
  const pc = tower.coreColor, pl = tower.scene.profile ? tower.scene.profile.prestige : 0;
  g.lineStyle(1, pc, 0.5);
  for (let i = 0; i < 3; i++) { const a = -tower.spin * 0.8 + i * TAU / 3; g.beginPath(); g.arc(x, y, 12, a, a + 1.2, false); g.strokePath(); }
  g.fillStyle(pc, 0.55); g.fillCircle(x, y, 8 + pulse * 2);
  g.fillStyle(COLORS.white, 0.95); g.fillCircle(x, y, 4.5 + pulse * 1.2);
  for (let i = 0; i < Math.min(pl, 6); i++) {
    const a = tower.spin * (1 + i * 0.3) + i * 1.1, rr = 15 + i * 1.5;
    g.fillStyle(pc, 0.9); g.fillCircle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.6);
  }
}
