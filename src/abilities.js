import { ABILITIES, COLORS } from './config.js';
import { ICONS } from './icons.js';

export class Abilities {
  constructor(scene) {
    this.scene = scene;
    this.state = {};
    for (const k of Object.keys(ABILITIES)) this.state[k] = { unlocked: false, cd: 0, active: 0 };
    window.addEventListener('keydown', (e) => {
      const k = Object.keys(ABILITIES).find(a => ABILITIES[a].key === e.key);
      if (k) this.use(k);
    });
  }

  unlock(k) { this.state[k].unlocked = true; }
  ready(k) { const s = this.state[k]; return s.unlocked && s.cd <= 0; }

  use(k) {
    if (!this.ready(k) || this.scene.gameOver || this.scene.paused) return false;
    const def = ABILITIES[k], st = this.state[k], sc = this.scene, t = sc.tower;
    st.cd = def.cd * sc.tree.mods.abilityCd; st.active = def.dur;
    if (sc.stats) sc.stats.abilities[k] = (sc.stats.abilities[k] || 0) + 1;
    sc.sfx.play('ability', k);
    if (def.dur > 0) sc.ui.addEffect('ability:' + k, { name: def.name, color: k === 'overcharge' ? 0xff9f43 : 0x9be7ff, dur: def.dur, sub: 'ability', icon: ICONS['ab_' + k] });
    if (k === 'emp') {
      for (const m of sc.mobs) { m.stun = def.dur; sc.fx.spark(m.x, m.y, 0x9be7ff, 4); }
      sc.enemyBullets = [];
      sc.fx.ripple(t.x, t.y, 0x9be7ff, t.shieldR, t.maxRange() + 100);
      sc.fx.flash(t.x, t.y, 0x9be7ff, 3);
    } else if (k === 'overcharge') {
      sc.fx.flash(t.x, t.y, COLORS.orange, 2);
    } else if (k === 'burst') {
      t.shield = t.shieldMax; t.regenDelay = 0;
      sc.enemyBullets = [];
      for (const m of sc.mobs) {
        const d = Phaser.Math.Distance.Between(t.x, t.y, m.x, m.y);
        if (d < def.radius) {
          const a = Phaser.Math.Angle.Between(t.x, t.y, m.x, m.y), f = def.knock * (1.4 - d / def.radius);
          m.dodgeVx += Math.cos(a) * f * 2.2; m.dodgeVy += Math.sin(a) * f * 2.2;
        }
      }
      sc.fx.ripple(t.x, t.y, COLORS.cyan, t.shieldR, def.radius);
      sc.fx.flash(t.x, t.y, COLORS.cyan, 3);
      sc.fx.shake(0.006, 200);
    } else if (k === 'nuke') {
      const R = t.maxRange();
      const dmg = def.dmg * Math.pow(1.12, sc.tier - 1);
      for (const m of sc.mobs) {
        if (Phaser.Math.Distance.Between(t.x, t.y, m.x, m.y) <= R + m.r) {
          sc.hit(m, null, m.x, m.y, { dmg, color: '#ffffff', size: 14, source: 'nova' });
        }
      }
      sc.enemyBullets = [];
      sc.fx.ripple(t.x, t.y, COLORS.white, t.shieldR, R);
      sc.fx.ripple(t.x, t.y, COLORS.orange, t.shieldR, R * 0.7);
      sc.fx.flash(t.x, t.y, COLORS.white, 8);
      sc.fx.shake(0.02, 500);
      sc.flashScreen(0.8);
    }
    return true;
  }

  get rateMul() { return this.state.overcharge.active > 0 ? ABILITIES.overcharge.mul : 1; }

  update(dt) {
    for (const k of Object.keys(this.state)) {
      const s = this.state[k];
      s.cd = Math.max(0, s.cd - dt);
      s.active = Math.max(0, s.active - dt);
    }
    if (this.state.overcharge.active > 0 && Math.random() < dt * 30) {
      const t = this.scene.tower, a = Math.random() * Math.PI * 2;
      this.scene.fx.trailAt(t.x + Math.cos(a) * (t.r + 8), t.y + Math.sin(a) * (t.r + 8), COLORS.orange);
    }
  }

  serialize() { const o = {}; for (const k in this.state) o[k] = { unlocked: this.state[k].unlocked, cd: this.state[k].cd }; return o; }
  restore(o) { if (!o) return; for (const k in o) if (this.state[k]) { this.state[k].unlocked = !!o[k].unlocked; this.state[k].cd = o[k].cd || 0; } }
}
