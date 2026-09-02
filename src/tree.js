// Permanent skill tree, bought with core fragments. Survives prestige.
// Each node: branch, name, desc, max level, cost(level), and how it changes `mods`.
// `unlock`/`weapon` name the weapon type a node is for; the skills tab shows that weapon's icon and colour.

export const BRANCHES = {
  offense: { name: 'Offense', color: 0xff4d6d },
  defense: { name: 'Defense', color: 0x4ff2ff },
  economy: { name: 'Economy', color: 0xffd166 },
  weapons: { name: 'Weapon mods', color: 0xc084fc },
};

const lin = (base, step) => (lvl) => base + step * lvl;      // cost grows per level
const pct = (v) => Math.round(v * 100) + '%';

export const TREE = {
  // ---- offense ----
  dmg:      { branch: 'offense', name: 'Targeting AI',    max: 10, cost: lin(1, 1), effect: (m, l) => { m.dmg *= 1 + 0.08 * l; }, text: (l) => `+${pct(0.08 * l)} weapon damage` },
  rate:     { branch: 'offense', name: 'Overclocked servos', max: 8, cost: lin(1, 1), effect: (m, l) => { m.rate *= 1 + 0.05 * l; }, text: (l) => `+${pct(0.05 * l)} fire rate` },
  crit:     { branch: 'offense', name: 'Weak-point scanner', max: 8, cost: lin(2, 1), effect: (m, l) => { m.crit += 0.02 * l; }, text: (l) => `+${pct(0.02 * l)} crit chance` },
  critMul:  { branch: 'offense', name: 'Overpenetration', max: 5, cost: lin(3, 2), effect: (m, l) => { m.critMul += 0.3 * l; }, text: (l) => `+${(0.3 * l).toFixed(1)}× crit damage` },
  abilityCd:{ branch: 'offense', name: 'Capacitor banks', max: 5, cost: lin(2, 2), effect: (m, l) => { m.abilityCd *= 1 - 0.08 * l; }, text: (l) => `-${pct(0.08 * l)} ability cooldowns` },

  // ---- defense ----
  shieldMax:{ branch: 'defense', name: 'Shield lattice',  max: 10, cost: lin(1, 1), effect: (m, l) => { m.shieldMax *= 1 + 0.15 * l; }, text: (l) => `+${pct(0.15 * l)} shield capacity` },
  regen:    { branch: 'defense', name: 'Flux capacitors', max: 10, cost: lin(1, 1), effect: (m, l) => { m.shieldRegen *= 1 + 0.15 * l; }, text: (l) => `+${pct(0.15 * l)} shield regen` },
  hull:     { branch: 'defense', name: 'Composite armour', max: 10, cost: lin(1, 1), effect: (m, l) => { m.hull *= 1 + 0.15 * l; }, text: (l) => `+${pct(0.15 * l)} hull` },
  hullRegen:{ branch: 'defense', name: 'Nanite repair',   max: 5, cost: lin(3, 2), effect: (m, l) => { m.hullRegen += 1 * l; }, text: (l) => `+${l} hull per second` },
  calm:     { branch: 'defense', name: 'Deep recharge',   max: 3, cost: lin(4, 3), effect: (m, l) => { m.calmMul += 1 * l; }, text: (l) => `+${l}× calm regen multiplier` },

  // ---- economy ----
  scrap:    { branch: 'economy', name: 'Salvage drones',  max: 10, cost: lin(1, 1), effect: (m, l) => { m.scrap *= 1 + 0.10 * l; }, text: (l) => `+${pct(0.10 * l)} scrap from kills` },
  start:    { branch: 'economy', name: 'Emergency reserve', max: 10, cost: lin(1, 1), effect: (m, l) => { m.startScrap += 250 * l; }, text: (l) => `start each run with ${250 * l} scrap` },
  offRate:  { branch: 'economy', name: 'Autonomous salvage', max: 5, cost: lin(2, 2), effect: (m, l) => { m.offlineRate += 0.10 * l; }, text: (l) => `offline scrap rate ${pct(0.5 + 0.10 * l)}` },
  offCap:   { branch: 'economy', name: 'Long-haul storage', max: 4, cost: lin(3, 3), effect: (m, l) => { m.offlineCap += 2 * l; }, text: (l) => `offline cap ${8 + 2 * l} h` },
  bossFrag: { branch: 'economy', name: 'Core harvester',  max: 3, cost: lin(5, 5), effect: (m, l) => { m.bossFrag += l; }, text: (l) => `+${l} fragment per Overseer` },

  // ---- weapon unlocks and mods ----
  u_railgun:{ branch: 'weapons', name: 'Unlock Railgun',   max: 1, cost: () => 1, unlock: 'railgun', effect: () => {}, text: () => 'railgun can be mounted' },
  u_missile:{ branch: 'weapons', name: 'Unlock Missile pod', max: 1, cost: () => 1, unlock: 'missile', effect: () => {}, text: () => 'missile pod can be mounted' },
  u_tesla:  { branch: 'weapons', name: 'Unlock Tesla arc', max: 1, cost: () => 1, unlock: 'tesla', effect: () => {}, text: () => 'tesla arc can be mounted' },
  u_laser:  { branch: 'weapons', name: 'Unlock Laser beam', max: 1, cost: () => 2, unlock: 'laser', effect: () => {}, text: () => 'laser beam can be mounted' },
  u_gravity:{ branch: 'weapons', name: 'Unlock Gravity well', max: 1, cost: () => 2, unlock: 'gravity', effect: () => {}, text: () => 'gravity well can be mounted' },
  u_drones: { branch: 'weapons', name: 'Unlock Drone bay', max: 1, cost: () => 2, unlock: 'drones', effect: () => {}, text: () => 'drone bay can be mounted' },
  m_drones: { branch: 'weapons', weapon: 'drones', name: 'Extra hangar',     max: 2, cost: lin(3, 2), requires: 'u_drones', effect: (m, l) => { m.w.drones.extra = (m.w.drones.extra || 0) + l; }, text: (l) => `+${l} interceptor drone${l > 1 ? 's' : ''}` },
  u_shock:  { branch: 'weapons', name: 'Unlock Shock emitter', max: 1, cost: () => 2, unlock: 'shock', effect: () => {}, text: () => 'shock emitter can be mounted' },
  u_chrono: { branch: 'weapons', name: 'Unlock Chrono field', max: 1, cost: () => 3, unlock: 'chrono', effect: () => {}, text: () => 'chrono field can be mounted' },
  u_nanite: { branch: 'weapons', name: 'Unlock Replicator swarm', max: 1, cost: () => 3, unlock: 'nanite', effect: () => {}, text: () => 'replicator swarm can be mounted' },
  u_beamdrones: { branch: 'weapons', name: 'Unlock Beam drones', max: 1, cost: () => 3, unlock: 'beamdrones', effect: () => {}, text: () => 'beam drones can be mounted' },
  u_missiledrones: { branch: 'weapons', name: 'Unlock Missile drones', max: 1, cost: () => 3, unlock: 'missiledrones', effect: () => {}, text: () => 'missile drones can be mounted' },
  u_kamikaze: { branch: 'weapons', name: 'Unlock Kamikaze drones', max: 1, cost: () => 3, unlock: 'kamikaze', effect: () => {}, text: () => 'kamikaze drones can be mounted' },
  u_ionstorm: { branch: 'weapons', name: 'Unlock Ion storm', max: 1, cost: () => 3, unlock: 'ionstorm', effect: () => {}, text: () => 'ion storm can be mounted' },
  u_singularity: { branch: 'weapons', name: 'Unlock Singularity core', max: 1, cost: () => 4, unlock: 'singularity', effect: () => {}, text: () => 'singularity core can be mounted' },
  m_shock:  { branch: 'weapons', weapon: 'shock', name: 'Resonance coils', max: 4, cost: lin(2, 2), requires: 'u_shock', effect: (m, l) => { m.w.shock.rate *= 1 + 0.12 * l; }, text: (l) => `shock emitter cooldown -${Math.round(100 - 100 / (1 + 0.12 * l))}%` },
  m_pulse:  { branch: 'weapons', weapon: 'pulse', name: 'Twin pulse coils', max: 5, cost: lin(2, 1), effect: (m, l) => { m.w.pulse.rate *= 1 + 0.10 * l; }, text: (l) => `pulse cannon +${pct(0.10 * l)} fire rate` },
  m_rail:   { branch: 'weapons', weapon: 'railgun', name: 'Tungsten sabots', max: 5, cost: lin(2, 1), requires: 'u_railgun', effect: (m, l) => { m.w.railgun.dmg *= 1 + 0.20 * l; }, text: (l) => `railgun +${pct(0.20 * l)} damage` },
  m_missile:{ branch: 'weapons', weapon: 'missile', name: 'Cluster warheads', max: 5, cost: lin(2, 1), requires: 'u_missile', effect: (m, l) => { m.w.missile.splash *= 1 + 0.20 * l; }, text: (l) => `missile splash +${pct(0.20 * l)}` },
  m_tesla:  { branch: 'weapons', weapon: 'tesla', name: 'Arc relays',      max: 4, cost: lin(2, 2), requires: 'u_tesla', effect: (m, l) => { m.w.tesla.chains += l; }, text: (l) => `tesla +${l} chain jumps` },
  m_laser:  { branch: 'weapons', weapon: 'laser', name: 'Focusing crystal', max: 3, cost: lin(3, 2), requires: 'u_laser', effect: (m, l) => { m.w.laser.rampMax += l; }, text: (l) => `laser ramps to +${l}× more` },
  m_gravity:{ branch: 'weapons', weapon: 'gravity', name: 'Event horizon',   max: 3, cost: lin(3, 2), requires: 'u_gravity', effect: (m, l) => { m.w.gravity.radius *= 1 + 0.20 * l; m.w.gravity.life += 1 * l; }, text: (l) => `wells +${pct(0.20 * l)} radius, +${l} s` },
  swaps:    { branch: 'weapons', name: 'Refit bays',      max: 9, cost: lin(1, 1), effect: (m, l) => { m.swaps += l; }, text: (l) => `${1 + l} weapon swaps per run` },
  combo:    { branch: 'weapons', name: 'Synergy matrix',  max: 5, cost: lin(2, 2), effect: (m, l) => { m.comboChance *= 1 + 0.20 * l; }, text: (l) => `combo chance +${pct(0.20 * l)}` },
};

export function baseMods() {
  const w = {};
  for (const k of ['pulse', 'railgun', 'missile', 'laser', 'tesla', 'gravity', 'shock', 'drones', 'chrono', 'nanite', 'singularity', 'beamdrones', 'ionstorm', 'missiledrones', 'kamikaze']) w[k] = { dmg: 1, rate: 1, splash: 1, chains: 0, rampMax: 0, radius: 1, life: 0 };
  return {
    dmg: 1, rate: 1, crit: 0, critMul: 0, abilityCd: 1,
    shieldMax: 1, shieldRegen: 1, hull: 1, hullRegen: 0, calmMul: 0,
    scrap: 1, startScrap: 0, offlineRate: 0, offlineCap: 0, bossFrag: 0,
    comboChance: 1, swaps: 0, w,
  };
}

export class Tree {
  constructor(scene) {
    this.scene = scene;
    this.levels = {};
    this.recompute();
  }
  level(id) { return this.levels[id] || 0; }
  cost(id) { return TREE[id].cost(this.level(id)); }
  canBuy(id) {
    const n = TREE[id];
    if (this.level(id) >= n.max) return false;
    if (n.requires && !this.level(n.requires)) return false;
    return this.scene.state.fragments >= this.cost(id);
  }
  buy(id) {
    if (!this.canBuy(id)) return false;
    this.scene.state.fragments -= this.cost(id);
    this.levels[id] = this.level(id) + 1;
    this.recompute();
    return true;
  }
  unlocked(weaponType) {
    if (weaponType === 'pulse') return true;
    const node = Object.keys(TREE).find(k => TREE[k].unlock === weaponType);
    return !node || this.level(node) > 0;
  }
  recompute() {
    const m = baseMods();
    for (const id in this.levels) if (this.levels[id] > 0 && TREE[id]) TREE[id].effect(m, this.levels[id]);
    this.mods = m;
    if (this.scene.tower) this.scene.tower.recompute();
  }
  serialize() { return { ...this.levels }; }
  restore(o) { this.levels = { ...(o || {}) }; this.recompute(); }
}
