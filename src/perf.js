// Effects quality. Three levels plus 'auto', which starts at full and steps down when the frame rate sags.
// What each level changes is in LEVELS; the rest of the code asks `scene.perf` before spending draw time.
const LEVELS = {
  full:    { bloom: 2, numbers: true,  trails: 1, sparks: 1,   glows: 'all',   flashes: true,  label: 'Full' },
  reduced: { bloom: 0, numbers: false, trails: 2, sparks: 0.5, glows: 'large', flashes: true,  label: 'Reduced' },
  minimal: { bloom: 0, numbers: false, trails: 0, sparks: 0,   glows: 'none',  flashes: false, label: 'Minimal' },
};
const ORDER = ['full', 'reduced', 'minimal'];
// fps thresholds, the seconds they must hold, and how many times a level may be dropped before auto stops climbing back
const AUTO = { down: 45, floor: 30, up: 58, downAfter: 3, upAfter: 15, maxDrops: 2 };
const SMALL_GLOW_R = 12;      // 'large' glows: only ships with a radius above this keep their glow

export class Perf {
  constructor(scene) {
    this.scene = scene;
    this.setting = 'auto';
    this.level = 'full';
    this.lowT = 0; this.highT = 0; this.tick = 0;
    this.frame = 0;
    this.drops = {};      // level -> times auto stepped down out of it, so a level that keeps sagging is not retried forever
    this.applied = false; // set() is a no-op for an unchanged setting, but the first call must still apply
  }
  get cfg() { return LEVELS[this.level]; }
  get label() { return this.setting === 'auto' ? `Auto (${this.cfg.label.toLowerCase()})` : this.cfg.label; }

  /** from the settings tab or the save: 'auto' | 'full' | 'reduced' | 'minimal' */
  set(setting) {
    const valid = LEVELS[setting] || setting === 'auto';
    const next = valid ? setting : 'auto';
    if (this.applied && next === this.setting) return;   // a settings resync must not throw away the auto-tuned level
    this.applied = true;
    this.setting = next;
    this.lowT = 0; this.highT = 0; this.drops = {};
    this.apply(next === 'auto' ? 'full' : next);
  }

  apply(level) {
    if (!LEVELS[level]) return;
    const changed = level !== this.level;
    this.level = level;
    const sc = this.scene, cfg = this.cfg, cam = sc.cameras.main;
    if (sc.renderer.type === Phaser.WEBGL) {
      cam.postFX.clear();
      if (cfg.bloom) cam.postFX.addBloom(0xffffff, 1, 1, 1, 1.15, cfg.bloom);
    }
    for (const m of sc.mobs) if (!m.dead && m.glow) m.glow.setVisible(this.glowFor(m.r));
    if (changed && sc.ui) sc.ui.render();
  }

  glowFor(r) { const g = this.cfg.glows; return g === 'all' || (g === 'large' && r > SMALL_GLOW_R); }
  /** trail particles: every frame at full, every other frame reduced, none at minimal */
  trailOk() { const t = this.cfg.trails; return t === 1 || (t === 2 && this.frame % 2 === 0); }
  sparkCount(n) { return Math.round(n * this.cfg.sparks); }
  get numbers() { return this.cfg.numbers; }
  get flashes() { return this.cfg.flashes; }

  /** auto mode: watch the real frame rate once a second */
  update(dt) {
    this.frame++;
    if (this.setting !== 'auto') return;
    this.tick += dt;
    if (this.tick < 1) return;
    this.tick = 0;
    const fps = this.scene.game.loop.actualFps, i = ORDER.indexOf(this.level);
    if (fps < AUTO.down) {
      this.lowT++; this.highT = 0;
    } else if (fps > AUTO.up) {
      this.highT++; this.lowT = 0;
    } else {
      this.lowT = 0; this.highT = 0;
    }
    if (this.lowT >= AUTO.downAfter && i < ORDER.length - 1) {
      const next = fps < AUTO.floor ? 'minimal' : ORDER[i + 1];
      this.lowT = 0;
      this.drops[this.level] = (this.drops[this.level] || 0) + 1;
      this.apply(next);
      if (this.scene.ui) this.scene.ui.banner(`Effects ${this.cfg.label.toLowerCase()} · low frame rate`, false);
    } else if (this.highT >= AUTO.upAfter && i > 0) {
      this.highT = 0;
      // a level dropped out of maxDrops times stays dropped: otherwise a machine sitting near the thresholds oscillates
      if ((this.drops[ORDER[i - 1]] || 0) < AUTO.maxDrops) this.apply(ORDER[i - 1]);
    }
  }
}

export const PERF_LEVELS = ['auto', ...ORDER];
