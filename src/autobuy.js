// Auto-buy: spends scrap on run upgrades following a priority list the player can reorder.
// Each tick it walks the enabled items in order and buys the first one it can afford.
// "Weapon levels" upgrades the cheapest mounted weapon so all guns grow together.

export const AUTO_ITEMS = {
  weapons:     { name: 'Weapon levels',  desc: 'Upgrade the cheapest mounted weapon' },
  shieldRegen: { name: 'Shield regen',   desc: 'Tower upgrade' },
  shieldMax:   { name: 'Shield capacity', desc: 'Tower upgrade' },
  hull:        { name: 'Hull plating',   desc: 'Tower upgrade' },
  slot:        { name: 'Hardpoints',     desc: 'Unlock the next slot (you still choose the weapon)' },
  abilities:   { name: 'Abilities',      desc: 'Buy locked abilities, cheapest first' },
};
const DEFAULT_ORDER = ['weapons', 'shieldRegen', 'shieldMax', 'hull', 'slot', 'abilities'];

export class AutoBuy {
  constructor(scene) {
    this.scene = scene;
    this.on = false;
    this.order = [...DEFAULT_ORDER];
    this.enabled = Object.fromEntries(DEFAULT_ORDER.map(k => [k, true]));
    this.reserve = 0;      // scrap to keep untouched
    this.timer = 0;
    this.lastBuy = null;
  }

  // cost and action for one priority item, or null when nothing to buy
  option(key) {
    const s = this.scene, t = s.tower;
    switch (key) {
      case 'weapons': {
        let best = null;
        t.slots.forEach((w, i) => { if (w && (!best || w.upgradeCost() < best.cost)) best = { cost: w.upgradeCost(), id: 'weapon:' + i, label: w.def.name + ' Lv ' + (w.level + 1) }; });
        return best;
      }
      case 'shieldRegen': case 'shieldMax': case 'hull':
        return { cost: t.upgradeCost(key), id: 'tower:' + key, label: AUTO_ITEMS[key].name };
      case 'slot': {
        const c = t.nextSlotCost();
        return c === null ? null : { cost: c, id: 'slot', label: 'Hardpoint ' + (t.slots.length + 1) };
      }
      case 'abilities': {
        const a = s.abilities;
        let best = null;
        for (const k in a.state) if (!a.state[k].unlocked) {
          const cost = s.abilityCost(k);
          if (!best || cost < best.cost) best = { cost, id: 'ability:' + k, label: k };
        }
        return best;
      }
    }
    return null;
  }

  update(dt) {
    if (!this.on || this.scene.gameOver || this.scene.paused) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    const s = this.scene, budget = s.state.scrap - this.reserve;
    for (const key of this.order) {
      if (!this.enabled[key]) continue;
      const o = this.option(key);
      if (!o || o.cost > budget) continue;
      s.ui.buy(o.id, true);
      this.lastBuy = { label: o.label, at: s.state.time };
      s.fx.floater(s.tower.x, s.tower.y + 70, 'auto: ' + o.label, '#7d8bb0', 12);
      return;
    }
  }

  // Predict the next purchases: scrap keeps rising, so the next buy is always the
  // highest-priority item that becomes affordable first, i.e. the cheapest enabled one
  // once nothing is affordable right now. Costs are simulated forward.
  queue(n = 8) {
    const s = this.scene, t = s.tower, out = [];
    const sim = {
      scrap: s.state.scrap - this.reserve,
      weapons: t.slots.map(w => w ? { name: w.def.name, level: w.level, def: w.def, type: w.type } : null),
      up: { ...t.upgrades }, slots: t.slots.length,
      abilities: Object.keys(s.abilities.state).filter(k => !s.abilities.state[k].unlocked),
    };
    const costOf = (key) => {
      switch (key) {
        case 'weapons': {
          let best = null;
          sim.weapons.forEach((w, i) => { if (!w) return; const c = Math.floor(w.def.cost * Math.pow(w.def.costGrowth, w.level - 1)); if (!best || c < best.cost) best = { cost: c, label: w.name, from: w.level, to: w.level + 1, icon: w.type, color: w.def.color, apply: () => w.level++ }; });
          return best;
        }
        case 'shieldRegen': case 'shieldMax': case 'hull': {
          const c = t.upgradeCostAt(key, sim.up[key]);
          return { cost: c, label: AUTO_ITEMS[key].name, from: sim.up[key], to: sim.up[key] + 1, icon: key, color: 0x4ff2ff, apply: () => sim.up[key]++ };
        }
        case 'slot': {
          const c = t.slotCostAt(sim.slots);
          return c === null ? null : { cost: c, label: 'Hardpoint', from: sim.slots, to: sim.slots + 1, icon: 'slot', color: 0x4ff2ff, apply: () => sim.slots++ };
        }
        case 'abilities': {
          if (!sim.abilities.length) return null;
          const k = sim.abilities.slice().sort((a, b) => s.abilityCost(a) - s.abilityCost(b))[0];
          return { cost: s.abilityCost(k), label: k, from: null, to: null, icon: 'ab_' + k, color: 0x9be7ff, apply: () => sim.abilities.splice(sim.abilities.indexOf(k), 1) };
        }
      }
      return null;
    };
    for (let i = 0; i < n; i++) {
      let pick = null;
      for (const key of this.order) {
        if (!this.enabled[key]) continue;
        const o = costOf(key); if (!o) continue;
        if (o.cost <= sim.scrap) { pick = { ...o, key, now: true }; break; }
      }
      if (!pick) {
        for (const key of this.order) {
          if (!this.enabled[key]) continue;
          const o = costOf(key); if (!o) continue;
          if (!pick || o.cost < pick.cost) pick = { ...o, key, now: false };
        }
        if (pick) sim.scrap = pick.cost;
      }
      if (!pick) break;
      sim.scrap -= pick.cost;
      pick.apply();
      out.push({ key: pick.key, label: pick.label, from: pick.from, to: pick.to, cost: pick.cost, now: pick.now, icon: pick.icon, color: pick.color });
    }
    return out;
  }

  move(key, dir) {
    const i = this.order.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= this.order.length) return;
    [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
  }

  serialize() { return { on: this.on, order: this.order, enabled: this.enabled, reserve: this.reserve }; }
  restore(o) {
    if (!o) return;
    this.on = !!o.on;
    if (Array.isArray(o.order)) this.order = [...o.order.filter(k => AUTO_ITEMS[k]), ...DEFAULT_ORDER.filter(k => !o.order.includes(k))];
    if (o.enabled) Object.assign(this.enabled, o.enabled);
    this.reserve = o.reserve || 0;
  }
}
