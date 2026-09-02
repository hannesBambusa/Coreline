// All balance numbers live here. Tune, don't hunt through code.

export const COLORS = {
  cyan: 0x4ff2ff, blue: 0x3b82f6, white: 0xffffff,
  magenta: 0xff3df2, red: 0xff4d6d, orange: 0xff9f43,
  gold: 0xffd166, violet: 0xc084fc, green: 0x5eead4,
};

export const TOWER = {
  radius: 24,
  shieldRadius: 52,
  hullMax: 300,
  shieldMax: 120,
  shieldRegen: 10,        // per second
  regenDelay: 1.0,       // seconds after last hit before regen resumes
  calmAfter: 4,          // seconds without damage before out-of-combat regen
  calmRegenMul: 3,       // regen multiplier when out of combat
  underFireRegen: 0.4,   // regen multiplier during the delay right after a hit
};

// Scrap upgrades on the tower itself. cost = base * growth^level
export const TOWER_UPGRADES = {
  shieldMax:   { name: 'Shield capacity', base: 25, growth: 1.28, add: 40,  unit: 'shield' },
  shieldRegen: { name: 'Shield regen',    base: 40, growth: 1.32, add: 3,   unit: '/s' },
  hull:        { name: 'Hull plating',    base: 60, growth: 1.35, add: 100, unit: 'hull' },
};

export const SLOT_COSTS = [0, 150, 800, 3000];   // max 4 hardpoints: pick your loadout

// install = scrap to mount the weapon in an empty slot. cost/costGrowth = per-level upgrade.
export const WEAPONS = {
  pulse: {
    name: 'Pulse cannon', install: 0,
    desc: 'Fast single-target bolts. Nearest enemy.',
    dmg: 5, rate: 6, range: 380, speed: 820,
    dmgMul: 1.15, rateMul: 1.04,
    cost: 15, costGrowth: 1.3,
    prefer: ['drone', 'swarm'], bonus: 1.4,
    color: 0x4ff2ff,
  },
  railgun: {
    name: 'Railgun', install: 250,
    desc: 'Slow, huge hit. Pierces everything in a line. Targets toughest.',
    dmg: 70, rate: 0.6, range: 520,
    dmgMul: 1.18, rateMul: 1.03,
    cost: 60, costGrowth: 1.32,
    prefer: ['shielder', 'boss'], bonus: 1.6, crit: 0.12, critMul: 3,
    color: 0xffffff,
  },
  missile: {
    name: 'Missile pod', install: 400,
    desc: 'Homing missiles with splash. Targets the densest cluster.',
    dmg: 22, rate: 1.4, range: 460, speed: 330, turn: 5, splash: 80,
    dmgMul: 1.16, rateMul: 1.04,
    cost: 70, costGrowth: 1.32,
    prefer: ['raider', 'orbiter'], bonus: 1.5,
    color: 0xff9f43,
  },
  laser: {
    name: 'Laser beam', install: 700,
    desc: 'Continuous beam, damage ramps on the same target. Targets farthest.',
    dmg: 14, rate: 1, range: 560, rampTime: 3, rampMax: 3,
    dmgMul: 1.15, rateMul: 1.0,
    cost: 90, costGrowth: 1.32,
    prefer: ['orbiter', 'boss'], bonus: 1.5, crit: 0.08,
    color: 0xff3df2,
  },
  tesla: {
    name: 'Tesla arc', install: 500,
    desc: 'Chain lightning, short range. Jumps between nearby ships.',
    dmg: 14, rate: 1.6, range: 240, chains: 4, chainRange: 140,
    dmgMul: 1.15, rateMul: 1.04,
    cost: 70, costGrowth: 1.32,
    prefer: ['swarm', 'drone'], bonus: 1.6, crit: 0.09,
    color: 0x9be7ff,
  },
  gravity: {
    name: 'Gravity well', install: 900,
    desc: 'Launches a singularity that drags ships in and slows them.',
    dmg: 6, rate: 0.3, range: 420, speed: 260, wellRadius: 160, wellLife: 4, pull: 90, slow: 0.45,
    dmgMul: 1.15, rateMul: 1.05,
    cost: 110, costGrowth: 1.32,
    prefer: ['swarm', 'raider'], bonus: 1.4,
    color: 0xc084fc,
  },
};

export const MOBS = {
  drone: {
    name: 'Drone', hp: 9, speed: 95, dmg: 6, scrap: 3, r: 9,
    color: 0xff3df2, fromWave: 1,
  },
  raider: {
    name: 'Raider', hp: 30, speed: 75, dmg: 3, scrap: 9, r: 12,
    fireRate: 1.1, range: 220, bulletSpeed: 300, dodge: 0.1,
    color: 0xff4d6d, fromWave: 2,
  },
  swarm: {
    name: 'Swarm', hp: 4, speed: 140, dmg: 3, scrap: 1, r: 6,
    group: [8, 12], color: 0xffd166, fromWave: 3, chance: 0.10,
  },
  orbiter: {
    name: 'Orbiter', hp: 55, speed: 90, dmg: 2, scrap: 14, r: 13,
    fireRate: 2.2, range: 340, bulletSpeed: 340, dodge: 0.15,
    color: 0xc084fc, fromWave: 5, chance: 0.08,
  },
  shielder: {
    name: 'Shielder', hp: 80, speed: 40, dmg: 6, scrap: 24, r: 16,
    shield: 120, shieldRegen: 6, fireRate: 0.5, range: 170, bulletSpeed: 220,
    color: 0x5eead4, fromWave: 8, chance: 0.05,
  },
  // ---- roster additions, gated by threat level (fromWave) ----
  bomber: {
    name: 'Bomber', hp: 22, speed: 120, dmg: 30, scrap: 8, r: 11,
    blast: 90, sprint: 1.8, color: 0xff9f43, fromWave: 4, chance: 0.06,
    desc: 'Sprints at the shield and detonates. Kill it early for a harmless pop.',
  },
  leech: {
    name: 'Leech', hp: 40, speed: 85, dmg: 6, scrap: 10, r: 10,
    drain: 9, color: 0x5eead4, fromWave: 6, chance: 0.05,
    desc: 'Latches onto the shield ring and drains it until shot off.',
  },
  phantom: {
    name: 'Phantom', hp: 45, speed: 70, dmg: 4, scrap: 12, r: 12,
    fireRate: 1.0, range: 210, bulletSpeed: 300, phaseOn: 1.6, phaseOff: 1.4,
    color: 0xc084fc, fromWave: 7, chance: 0.05,
    desc: 'Phases out of reality every few seconds. Only solid ships can be hit.',
  },
  hydra: {
    name: 'Hydra', hp: 70, speed: 60, dmg: 8, scrap: 14, r: 14,
    splits: 2, gens: 2, color: 0xff3df2, fromWave: 9, chance: 0.05,
    desc: 'Splits into two smaller hydras on death, twice.',
  },
  sniper: {
    name: 'Sniper', hp: 55, speed: 80, dmg: 28, scrap: 16, r: 12,
    range: 480, aim: 1.2, cooldown: 3.2, bulletSpeed: 900, color: 0xffffff, fromWave: 11, chance: 0.04,
    desc: 'Sits at extreme range and fires heavy shots after a visible aim line.',
  },
  carrier: {
    name: 'Carrier', hp: 160, speed: 35, dmg: 3, scrap: 30, r: 20,
    range: 380, hangarEvery: 6, hangarCount: 2, color: 0xff4d6d, fromWave: 13, chance: 0.025,
    desc: 'Holds position and launches drones from its hangar.',
  },
  jammer: {
    name: 'Jammer', hp: 90, speed: 75, dmg: 3, scrap: 22, r: 13,
    range: 300, fireRate: 1.2, bulletSpeed: 280, slow: 0.5, color: 0x9be7ff, fromWave: 15, chance: 0.035,
    desc: 'Locks onto one hardpoint and halves its fire rate while alive.',
  },
  siphon: {
    name: 'Siphon', hp: 120, speed: 65, dmg: 0, scrap: 26, r: 14,
    range: 330, drain: 14, color: 0xffd166, fromWave: 19, chance: 0.035,
    desc: 'Tethers to the core, drains shield and heals itself with it.',
  },
  beacon: {
    name: 'Warp beacon', hp: 140, speed: 90, dmg: 0, scrap: 35, r: 15,
    range: 430, warpEvery: 6, warpCount: 2, color: 0xffffff, fromWave: 21, chance: 0.02,
    desc: 'Parks at range and warps in reinforcements next to it. Kill the beacon first.',
  },
  behemoth: {
    name: 'Behemoth', hp: 520, speed: 28, dmg: 90, scrap: 60, r: 26,
    armour: 0.5, color: 0x9ca3af, fromWave: 24, chance: 0.03,
    desc: 'Armoured hulk. Takes half damage from non-critical hits. Rams for massive damage.',
  },
  boss: {
    name: 'Overseer', hp: 900, speed: 55, dmg: 7, scrap: 250, r: 34,
    fireRate: 1.0, burst: 3, range: 300, bulletSpeed: 260, spawnEvery: 4, spawnCount: 3,
    fragments: 1, color: 0xff3df2, every: 5,
  },
  // Siege bosses. hp/scrap are multiples of the Overseer at the same threat.
  titan: {
    name: 'Dreadnought', hp: 900 * 50, speed: 32, dmg: 10, scrap: 250 * 25, r: 64,
    range: 520, fireRate: 0.7, burst: 4, bulletSpeed: 260, keepDistance: 470,
    shieldArc: Math.PI * 2 / 3, arcSpeed: 0.5,          // rotating shield sector, radians and rad/s
    beamEvery: 14, beamCharge: 2.2, beamDur: 2.5, beamDps: 60,
    bayEvery: 6, bayCount: 5,
    jamEvery: 15, jamDur: 5,                             // from siege level 2: disables a hardpoint
    blinkEvery: 11, blinkCharge: 0.7, blinkRing: 12,     // teleport: charge, vanish, reappear elsewhere, bullet ring
    mineEvery: 9, mineCount: 4,                          // drops drifting mines
    color: 0xff4d6d,
  },
  mine: {
    name: 'Mine', hp: 90, speed: 40, dmg: 45, scrap: 30, r: 9,
    fuse: 14, color: 0xff9f43, fromWave: 999, chance: 0,
  },
  warden: {
    name: 'Warden', hp: 900 * 6, speed: 70, dmg: 6, scrap: 250 * 2, r: 24,
    range: 260, fireRate: 1.4, burst: 3, bulletSpeed: 280, dodge: 0.12,
    heal: 0.006,                                          // fraction of titan max hp per second, each
    color: 0xff9f43,
  },
};

export const SIEGE = {
  every: 30,                 // threat levels between sieges
  wardens: 3, wardensPerLevel: 2,
  hpMul: 1.0, hpMulPerLevel: 1.2,
  fragments: 5, fragmentsPerLevel: 5,
  arcPerLevel: Math.PI / 6,
};

export const SPAWN = {
  tierSeconds: 40,       // one threat level per this many seconds survived
  hpGrowth: 1.12,        // mob hp multiplier per threat level
  dmgGrowth: 1.045,      // mob damage multiplier per threat level
  scrapGrowth: 1.08,     // scrap multiplier per threat level
  baseRate: 1.2,         // mobs per second at t=0
  ratePerSecond: 0.012,  // extra mobs/sec per second survived
  maxRate: 12,
  softCap: 220,          // stop regular spawns while this many ships are alive
  surgeEvery: 5,         // every Nth threat level spawns a single random ship type
  burst: [2, 4],         // mobs per spawn tick, min/max
  raiderPerTier: 0.06, raiderMax: 0.45,
};

// Critical strikes. Per-weapon overrides via WEAPONS[x].crit / critMul.
export const CRIT = { chance: 0.06, mul: 2.2 };

export const ABILITIES = {
  emp:        { name: 'EMP',          key: '1', cost: 300,  cd: 40,  dur: 3,  desc: 'Stuns every ship for 3 s.' },
  overcharge: { name: 'Overcharge',   key: '2', cost: 500,  cd: 60,  dur: 8,  mul: 2, desc: 'All weapons fire 2× faster for 8 s.' },
  burst:      { name: 'Shield burst', key: '3', cost: 400,  cd: 50,  dur: 0,  knock: 260, radius: 320, desc: 'Refills shield, clears shots, throws ships back.' },
  nuke:       { name: 'Nova',         key: '4', cost: 1500, cd: 120, dur: 0,  dmg: 400, desc: 'Massive blast across your whole weapon range.' },
};

export const ELITES = {
  chanceBase: 0.04, chancePerTier: 0.004, chanceMax: 0.15, scrapMul: 3,
  mods: {
    fast:     { name: 'Fast',     color: 0xffd166, speed: 1.7 },
    armoured: { name: 'Armoured', color: 0x9ca3af, hp: 3 },
    splitter: { name: 'Splitter', color: 0xff9f43, spawn: 4 },
    healer:   { name: 'Healer',   color: 0x5eead4, heal: 0.06, radius: 140 },
    cloaked:  { name: 'Cloaked',  color: 0xc084fc, dodge: 0.35, alpha: 0.35 },
  },
};

export const OFFLINE = { threshold: 30, rate: 0.5, capHours: 8 };

// Prestige: fragments earned from a run = floor((tier / divisor) ^ power). Manual prestige from minTier.
export const PRESTIGE = { divisor: 4, power: 1.5, minTier: 10 };
export const CORE_TIERS = [0x4ff2ff, 0x5eead4, 0xffd166, 0xff9f43, 0xc084fc, 0xff3df2, 0xffffff];
