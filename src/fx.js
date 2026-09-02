import { COLORS } from './config.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.burst = scene.add.particles(0, 0, 'dot', {
      speed: { min: 40, max: 240 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 }, lifespan: { min: 300, max: 750 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(6);
    this.sparks = scene.add.particles(0, 0, 'dot', {
      speed: { min: 20, max: 120 }, scale: { start: 0.35, end: 0 },
      alpha: { start: 1, end: 0 }, lifespan: { min: 150, max: 350 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(6);
    this.trail = scene.add.particles(0, 0, 'dot', {
      speed: 0, scale: { start: 0.32, end: 0 }, alpha: { start: 0.6, end: 0 },
      lifespan: 220, blendMode: 'ADD', emitting: false,
    }).setDepth(3);
    this.gfx = scene.add.graphics().setDepth(7);
    this.ripples = [];
    this.lines = [];
  }

  line(x1, y1, x2, y2, color, width = 2, life = 0.2) {
    this.lines.push({ pts: [[x1, y1], [x2, y2]], color, width, life, max: life });
  }

  bolt(x1, y1, x2, y2, color) {
    const pts = [[x1, y1]], n = 6;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < n; i++) {
      const t = i / n, off = (Math.random() - 0.5) * Math.min(40, len * 0.3);
      pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
    }
    pts.push([x2, y2]);
    this.lines.push({ pts, color, width: 2.5, life: 0.15, max: 0.15 });
    this.lines.push({ pts, color: 0xffffff, width: 1, life: 0.1, max: 0.1 });
  }

  explode(x, y, color, n = 16) {
    this.burst.setParticleTint(color);
    this.burst.explode(n, x, y);
    this.flash(x, y, color, 1.2);
  }

  spark(x, y, color, n = 5) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(n, x, y);
  }

  trailAt(x, y, color) {
    this.trail.setParticleTint(color);
    this.trail.emitParticleAt(x, y);
  }

  flash(x, y, color, scale = 1) {
    const img = this.scene.add.image(x, y, 'glow').setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(scale * 0.4).setDepth(6);
    this.scene.tweens.add({
      targets: img, scale: scale, alpha: 0, duration: 260, ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  floater(x, y, text, color = '#dbe7ff', size = 14) {
    this.floaters = (this.floaters || 0);
    if (this.floaters > 80) return;
    this.floaters++;
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Rajdhani, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#05060d', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    this.scene.tweens.add({
      targets: t, y: y - 34, alpha: 0, duration: 800, ease: 'Quad.easeOut',
      onComplete: () => { t.destroy(); this.floaters--; },
    });
  }

  // big punchy number: scales in fast, hangs, then drifts up and fades
  critFloater(x, y, text, color = '#ffb703', size = 30) {
    this.floaters = (this.floaters || 0);
    if (this.floaters > 80) return;
    this.floaters++;
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Orbitron, Rajdhani, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#05060d', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(11).setScale(0.3).setAlpha(1);
    t.postFX && t.postFX.addGlow(0xffb703, 4, 0, false, 0.1, 12);
    this.scene.tweens.chain({
      targets: t,
      tweens: [
        { scale: 1.35, duration: 120, ease: 'Back.easeOut' },
        { scale: 1, duration: 140, ease: 'Quad.easeOut' },
        { y: y - 46, alpha: 0, duration: 700, delay: 250, ease: 'Quad.easeIn' },
      ],
      onComplete: () => { t.destroy(); this.floaters--; },
    });
  }

  ripple(x, y, color, r0 = 8, r1 = 40) {
    this.ripples.push({ x, y, color, r: r0, r1, a: 1 });
  }

  shake(intensity = 0.004, duration = 150) {
    if (this.scene.settings.shake) this.scene.cameras.main.shake(duration, intensity);
  }

  update(dt) {
    this.gfx.clear();
    for (const rp of this.ripples) {
      rp.r += (rp.r1 - rp.r) * dt * 8;
      rp.a -= dt * 3;
      this.gfx.lineStyle(2, rp.color, Math.max(rp.a, 0));
      this.gfx.strokeCircle(rp.x, rp.y, rp.r);
    }
    this.ripples = this.ripples.filter(r => r.a > 0);
    for (const l of this.lines) {
      l.life -= dt;
      const a = Math.max(0, l.life / l.max);
      this.gfx.lineStyle(l.width * a, l.color, a);
      this.gfx.beginPath();
      l.pts.forEach(([px, py], i) => i ? this.gfx.lineTo(px, py) : this.gfx.moveTo(px, py));
      this.gfx.strokePath();
    }
    this.lines = this.lines.filter(l => l.life > 0);
  }
}
