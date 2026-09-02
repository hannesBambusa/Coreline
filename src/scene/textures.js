// Procedural textures: the particle dot, the soft glow sprite, every ship silhouette, and the starfield.
// All ships are drawn in white so tint can colour them later.
import { COLORS } from '../config.js';
import { TAU, rnd } from '../utils.js';

const WHITE = 0xffffff;
const GLOW_SIZE = 64;
const DOT_SIZE = 16;

// Starfield layout
const NEBULA_STEPS = 24;               // concentric discs per nebula blob
const NEBULA_RADIUS_MIN = 260;
const NEBULA_RADIUS_MAX = 520;
const STAR_LAYERS = 3;
const STARS_PER_LAYER = 90;
const STAR_SPREAD = 1.4;               // stars spawn over 1.4x the viewport so parallax drift can wrap

/** Stroke a closed regular polygon / star: n points, alternating radii when rInner differs from rOuter. */
function starPath(g, cx, cy, n, rOuter, rInner = rOuter) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n, rr = i % 2 ? rInner : rOuter;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}

/** Draw n radial spokes from radius r0 to r1 around (cx, cy), starting at angle offset. */
function spokes(g, cx, cy, n, r0, r1, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + offset;
    g.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
  }
}

/** Stroke and fill a closed polygon from a list of [x, y] points. */
function poly(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath(); g.fillPath(); g.strokePath();
}

export function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(WHITE, 1); g.fillCircle(8, 8, 8); g.generateTexture('dot', DOT_SIZE, DOT_SIZE); g.clear();

  // glow: radial gradient on a canvas texture
  const cv = scene.textures.createCanvas('glow', GLOW_SIZE, GLOW_SIZE);
  const half = GLOW_SIZE / 2;
  const ctx = cv.context, grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE); cv.refresh();

  // drone: small dart
  g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.25);
  poly(g, [[22, 12], [4, 3], [9, 12], [4, 21]]);
  g.generateTexture('ship_drone', 24, 24); g.clear();

  // raider: wider wing shape
  g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.2);
  poly(g, [[30, 16], [10, 4], [2, 10], [12, 16], [2, 22], [10, 28]]);
  g.fillStyle(WHITE, 1); g.fillCircle(16, 16, 3);
  g.generateTexture('ship_raider', 32, 32); g.clear();

  // swarm: tiny dart
  g.lineStyle(1.5, WHITE, 1); g.fillStyle(WHITE, 0.5);
  poly(g, [[14, 8], [2, 3], [5, 8], [2, 13]]);
  g.generateTexture('ship_swarm', 16, 16); g.clear();

  // orbiter: ring with three fins
  g.lineStyle(2, WHITE, 1); g.strokeCircle(16, 16, 8); g.fillStyle(WHITE, 1); g.fillCircle(16, 16, 3);
  spokes(g, 16, 16, 3, 8, 15);
  g.generateTexture('ship_orbiter', 32, 32); g.clear();

  // shielder: bulky hexagon
  g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.2);
  starPath(g, 20, 20, 6, 15); g.fillPath(); g.strokePath();
  g.fillStyle(WHITE, 0.9); g.fillRect(24, 17, 12, 6);
  g.generateTexture('ship_shielder', 40, 40); g.clear();

  // boss: layered star
  g.lineStyle(3, WHITE, 1); g.fillStyle(WHITE, 0.15);
  starPath(g, 40, 40, 16, 36, 22); g.fillPath(); g.strokePath();
  g.lineStyle(2, WHITE, 0.8); g.strokeCircle(40, 40, 14); g.fillStyle(WHITE, 1); g.fillCircle(40, 40, 6);
  g.generateTexture('ship_boss', 80, 80); g.clear();

  // titan: heavy gear hull
  g.lineStyle(3, WHITE, 1); g.fillStyle(WHITE, 0.12);
  starPath(g, 44, 44, 24, 40, 30); g.fillPath(); g.strokePath();
  g.lineStyle(2, WHITE, 0.8); g.strokeCircle(44, 44, 20); g.strokeCircle(44, 44, 10);
  spokes(g, 44, 44, 4, 10, 20);
  g.fillStyle(WHITE, 1); g.fillCircle(44, 44, 5);
  g.generateTexture('ship_titan', 88, 88); g.clear();

  // warden: armoured arrowhead
  g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.2);
  poly(g, [[36, 20], [14, 6], [4, 12], [12, 20], [4, 28], [14, 34]]);
  g.lineStyle(2, WHITE, 0.8); g.strokeCircle(18, 20, 5);
  g.generateTexture('ship_warden', 40, 40); g.clear();

  // mine: spiked ball
  g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.3);
  g.fillCircle(12, 12, 6); g.strokeCircle(12, 12, 6);
  spokes(g, 12, 12, 8, 6, 11);
  g.generateTexture('ship_mine', 24, 24); g.clear();

  // warlord: broad eight-point star with a core ring
  g.lineStyle(3, WHITE, 1); g.fillStyle(WHITE, 0.14);
  starPath(g, 48, 48, 8, 46, 30); g.fillPath(); g.strokePath();
  g.lineStyle(2, WHITE, 0.8); g.strokeCircle(48, 48, 18); spokes(g, 48, 48, 8, 8, 18);
  g.fillStyle(WHITE, 1); g.fillCircle(48, 48, 6);
  g.generateTexture('ship_warlord', 96, 96); g.clear();

  // pylon: tall diamond with a core
  g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.25);
  poly(g, [[12, 1], [22, 12], [12, 23], [2, 12]]);
  g.fillStyle(WHITE, 1); g.fillCircle(12, 12, 3);
  g.generateTexture('ship_pylon', 24, 24); g.clear();

  // the rest are drawn around their centre c = size / 2
  const shape = (key, size, fn) => { fn(size / 2); g.generateTexture(key, size, size); g.clear(); };

  // bomber: fat dart with a bulb
  shape('ship_bomber', 28, (c) => {
    g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.3);
    poly(g, [[c + 12, c], [c - 8, c - 8], [c - 4, c], [c - 8, c + 8]]);
    g.fillStyle(WHITE, 1); g.fillCircle(c - 2, c, 3);
  });
  // leech: crescent
  shape('ship_leech', 24, (c) => {
    g.lineStyle(2, WHITE, 1); g.beginPath(); g.arc(c, c, 9, 0.6, 5.7, false); g.strokePath();
    g.fillStyle(WHITE, 0.8); g.fillCircle(c + 6, c - 6, 2); g.fillCircle(c + 6, c + 6, 2);
  });
  // phantom: thin diamond
  shape('ship_phantom', 30, (c) => {
    g.lineStyle(1.5, WHITE, 1); g.fillStyle(WHITE, 0.15);
    poly(g, [[c + 14, c], [c, c - 6], [c - 14, c], [c, c + 6]]);
  });
  // hydra: three-lobed
  shape('ship_hydra', 32, (c) => {
    g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.25);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3, lx = c + Math.cos(a) * 6, ly = c + Math.sin(a) * 6;
      g.fillCircle(lx, ly, 6); g.strokeCircle(lx, ly, 6);
    }
    g.fillStyle(WHITE, 1); g.fillCircle(c, c, 3);
  });
  // sniper: long needle
  shape('ship_sniper', 34, (c) => {
    g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.3);
    poly(g, [[c + 16, c], [c - 6, c - 4], [c - 14, c], [c - 6, c + 4]]);
    g.lineBetween(c - 2, c - 8, c - 2, c + 8);
  });
  // carrier: wide slab with bays
  shape('ship_carrier', 44, (c) => {
    g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.2);
    poly(g, [[c + 18, c - 6], [c + 18, c + 6], [c - 16, c + 12], [c - 20, c], [c - 16, c - 12]]);
    g.fillStyle(WHITE, 0.9); g.fillRect(c - 8, c - 3, 12, 6);
  });
  // jammer: ring with antennae
  shape('ship_jammer', 30, (c) => {
    g.lineStyle(2, WHITE, 1); g.strokeCircle(c, c, 7);
    spokes(g, c, c, 4, 7, 14, Math.PI / 4);
    g.fillStyle(WHITE, 1); g.fillCircle(c, c, 2.5);
  });
  // siphon: droplet
  shape('ship_siphon', 30, (c) => {
    g.lineStyle(2, WHITE, 1); g.fillStyle(WHITE, 0.25);
    poly(g, [[c + 14, c], [c - 4, c - 9], [c - 10, c], [c - 4, c + 9]]);
    g.strokeCircle(c - 2, c, 3);
  });
  // beacon: hexagonal frame (stroke only)
  shape('ship_beacon', 34, (c) => {
    g.lineStyle(2, WHITE, 1);
    starPath(g, c, c, 6, 13); g.strokePath();
    g.strokeCircle(c, c, 5);
  });
  // behemoth: blocky hull
  shape('ship_behemoth', 56, (c) => {
    g.lineStyle(3, WHITE, 1); g.fillStyle(WHITE, 0.25);
    poly(g, [[c + 22, c - 10], [c + 26, c], [c + 22, c + 10], [c - 18, c + 16], [c - 24, c], [c - 18, c - 16]]);
    g.lineStyle(2, WHITE, 0.7);
    g.lineBetween(c - 10, c - 10, c - 10, c + 10); g.lineBetween(c, c - 12, c, c + 12); g.lineBetween(c + 10, c - 8, c + 10, c + 8);
  });
  g.destroy();
}

/** Three nebula blobs plus three parallax layers of twinkling stars. Stars are kept on scene.starLayers for the drift in update(). */
export function makeStarfield(scene, w, h) {
  scene.starLayers = [];
  const nebulas = [[COLORS.violet, 0.10], [COLORS.blue, 0.08], [COLORS.magenta, 0.05]];
  const ng = scene.add.graphics().setDepth(0);
  for (const [c, a] of nebulas) {
    const nx = Math.random() * w, ny = Math.random() * h, R = rnd(NEBULA_RADIUS_MIN, NEBULA_RADIUS_MAX);
    // stack translucent discs from large to small so the centre ends up brightest
    for (let i = NEBULA_STEPS; i > 0; i--) { ng.fillStyle(c, a / 12); ng.fillCircle(nx, ny, R * i / NEBULA_STEPS); }
  }
  for (let layer = 0; layer < STAR_LAYERS; layer++) {
    for (let i = 0; i < STARS_PER_LAYER; i++) {
      const s = scene.add.image(Math.random() * w * STAR_SPREAD, Math.random() * h * STAR_SPREAD, 'dot')
        .setScale(0.08 + layer * 0.07 + Math.random() * 0.05)
        .setAlpha(0.25 + layer * 0.25 * Math.random()).setDepth(0);
      s.layer = layer;
      scene.tweens.add({ targets: s, alpha: 0.05 + Math.random() * 0.3, duration: 1500 + Math.random() * 3000, yoyo: true, repeat: -1 });
      scene.starLayers.push(s);
    }
  }
}
