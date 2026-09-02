import { ICONS } from './icons.js';
import { WEAPONS } from './config.js';
const WEAPON_COLORS = Object.fromEntries(Object.entries(WEAPONS).map(([k, v]) => [k, v.color]));

// Weapon combos: when two specific weapons are mounted, a shot from one has a small
// chance to trigger a joint attack. Each combo has its own cooldown so it stays rare.
export const COMBOS = {
  ionlance:    { name: 'Ion lance',        pair: ['railgun', 'tesla'],   chance: 0.15, cd: 8,  color: 0x9be7ff,
                 desc: 'Railgun shot arcs lightning into every ship near its path.' },
  singularity: { name: 'Singularity strike', pair: ['missile', 'gravity'], chance: 0.25, cd: 10, color: 0xc084fc,
                 desc: 'A missile detonating inside a gravity well collapses it: huge blast.' },
  focus:       { name: 'Focus fire',       pair: ['pulse', 'laser'],     chance: 0.10, cd: 6,  color: 0xff3df2,
                 desc: 'Pulse bolts hitting the laser target crit for triple damage.' },
  storm:       { name: 'Storm well',       pair: ['tesla', 'gravity'],   chance: 0.20, cd: 9,  color: 0x9be7ff,
                 desc: 'Tesla arcs to every ship trapped in a gravity well.' },
  barrage:     { name: 'Barrage',          pair: ['pulse', 'missile'],   chance: 0.06, cd: 7,  color: 0xff9f43,
                 desc: 'Pulse cannon launches a volley of micro-missiles.' },
  overload:    { name: 'Overload beam',    pair: ['railgun', 'laser'],   chance: 0.20, cd: 12, color: 0xffffff, effectDur: 3,
                 desc: 'Railgun hit on the laser target supercharges the beam for 3 s.' },
};

export class Combos {
  constructor(scene) {
    this.scene = scene;
    this.cd = {};
    this.count = 0;
  }

  mounted(type) { return this.scene.tower.weapons.some(w => w.type === type); }
  available(id) { const c = COMBOS[id]; return this.mounted(c.pair[0]) && this.mounted(c.pair[1]); }

  // returns true when the combo fires this time
  roll(id) {
    const c = COMBOS[id];
    if (!this.available(id)) return false;
    if ((this.cd[id] || 0) > 0) return false;
    if (Math.random() > c.chance * this.scene.tree.mods.comboChance) return false;
    this.cd[id] = c.cd;
    this.count++;
    this.announce({ id, ...c });
    return true;
  }

  announce(c) {
    const s = this.scene, t = s.tower;
    const hex = '#' + c.color.toString(16).padStart(6, '0');
    s.fx.flash(t.x, t.y, c.color, 3);
    s.fx.ripple(t.x, t.y, c.color, t.shieldR, t.maxRange());
    s.fx.ripple(t.x, t.y, 0xffffff, t.shieldR, t.maxRange() * 0.6);
    s.flashScreen(0.22, c.color);
    s.slowMo(0.35, 0.45);
    s.fx.shake(0.004, 160);
    s.ui.addEffect('combo:' + (c.id || c.name), {
      name: c.name, color: c.color, dur: c.effectDur || 2.5,
      sub: c.effectDur ? 'active' : 'combo proc',
      icon: c.pair.map(p => `<span style="color:#${WEAPON_COLORS[p].toString(16).padStart(6, '0')}">${ICONS[p]}</span>`).join(''),
    });
    s.sfx.play('combo');
  }

  update(dt) { for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt); }

  // list for the UI: [{id, name, desc, ready, available}]
  list() {
    return Object.entries(COMBOS).map(([id, c]) => ({ id, ...c, available: this.available(id), cd: this.cd[id] || 0 }));
  }
}
