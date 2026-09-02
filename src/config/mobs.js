import { COLORS } from './colors.js';

const GREY = 0x9ca3af;

// Overseer baseline. Siege bosses (titan, warden) scale from these so the three can't drift apart.
const BOSS_HP = 900;
const BOSS_SCRAP = 250;
const TITAN_HP_MUL = 50, TITAN_SCRAP_MUL = 25;
const WARDEN_HP_MUL = 6, WARDEN_SCRAP_MUL = 2;

export const MOBS = {
  drone: {
    name: 'Drone', hp: 9, speed: 95, dmg: 6, scrap: 3, r: 9,
    color: COLORS.magenta, fromWave: 1,
  },
  raider: {
    name: 'Raider', hp: 30, speed: 75, dmg: 3, scrap: 9, r: 12,
    fireRate: 1.1, range: 220, bulletSpeed: 300, dodge: 0.1,
    color: COLORS.red, fromWave: 2,
  },
  swarm: {
    name: 'Swarm', hp: 4, speed: 140, dmg: 3, scrap: 1, r: 6,
    group: [8, 12], color: COLORS.gold, fromWave: 3, chance: 0.10,
  },
  orbiter: {
    name: 'Orbiter', hp: 55, speed: 90, dmg: 2, scrap: 14, r: 13,
    fireRate: 2.2, range: 340, bulletSpeed: 340, dodge: 0.15,
    color: COLORS.violet, fromWave: 5, chance: 0.08,
  },
  shielder: {
    name: 'Shielder', hp: 80, speed: 40, dmg: 6, scrap: 24, r: 16,
    shield: 120, shieldRegen: 6, fireRate: 0.5, range: 170, bulletSpeed: 220,
    color: COLORS.green, fromWave: 8, chance: 0.05,
  },
  // ---- roster additions, gated by threat level (fromWave) ----
  bomber: {
    name: 'Bomber', hp: 22, speed: 120, dmg: 30, scrap: 8, r: 11,
    blast: 90, sprint: 1.8, color: COLORS.orange, fromWave: 4, chance: 0.06,
    desc: 'Sprints at the shield and detonates. Kill it early for a harmless pop.',
  },
  leech: {
    name: 'Leech', hp: 40, speed: 85, dmg: 6, scrap: 10, r: 10,
    drain: 9, color: COLORS.green, fromWave: 6, chance: 0.05,
    desc: 'Latches onto the shield ring and drains it until shot off.',
  },
  phantom: {
    name: 'Phantom', hp: 45, speed: 70, dmg: 4, scrap: 12, r: 12,
    fireRate: 1.0, range: 210, bulletSpeed: 300, phaseOn: 1.6, phaseOff: 1.4,
    color: COLORS.violet, fromWave: 7, chance: 0.05,
    desc: 'Phases out of reality every few seconds. Only solid ships can be hit.',
  },
  hydra: {
    name: 'Hydra', hp: 70, speed: 60, dmg: 8, scrap: 14, r: 14,
    splits: 2, gens: 2, color: COLORS.magenta, fromWave: 9, chance: 0.05,
    desc: 'Splits into two smaller hydras on death, twice.',
  },
  sniper: {
    name: 'Sniper', hp: 55, speed: 80, dmg: 28, scrap: 16, r: 12,
    range: 480, aim: 1.2, cooldown: 3.2, bulletSpeed: 900, color: COLORS.white, fromWave: 11, chance: 0.04,
    desc: 'Sits at extreme range and fires heavy shots after a visible aim line.',
  },
  carrier: {
    name: 'Carrier', hp: 160, speed: 35, dmg: 3, scrap: 30, r: 20,
    range: 380, hangarEvery: 6, hangarCount: 2, color: COLORS.red, fromWave: 13, chance: 0.025,
    desc: 'Holds position and launches drones from its hangar.',
  },
  jammer: {
    name: 'Jammer', hp: 90, speed: 75, dmg: 3, scrap: 22, r: 13,
    range: 300, fireRate: 1.2, bulletSpeed: 280, slow: 0.5, color: COLORS.ice, fromWave: 15, chance: 0.035,
    desc: 'Locks onto one hardpoint and halves its fire rate while alive.',
  },
  siphon: {
    name: 'Siphon', hp: 120, speed: 65, dmg: 0, scrap: 26, r: 14,
    range: 330, drain: 14, color: COLORS.gold, fromWave: 19, chance: 0.035,
    desc: 'Tethers to the core, drains shield and heals itself with it.',
  },
  beacon: {
    name: 'Warp beacon', hp: 140, speed: 90, dmg: 0, scrap: 35, r: 15,
    range: 430, warpEvery: 6, warpCount: 2, color: COLORS.white, fromWave: 21, chance: 0.02,
    desc: 'Parks at range and warps in reinforcements next to it. Kill the beacon first.',
  },
  behemoth: {
    name: 'Behemoth', hp: 420, speed: 28, dmg: 90, scrap: 60, r: 26,
    armour: 0.6, color: GREY, fromWave: 24, chance: 0.03,
    desc: 'Armoured hulk. Takes half damage from non-critical hits. Rams for massive damage.',
  },
  boss: {
    name: 'Overseer', hp: BOSS_HP, speed: 55, dmg: 7, scrap: BOSS_SCRAP, r: 34,
    fireRate: 1.0, burst: 3, range: 300, bulletSpeed: 260, spawnEvery: 4, spawnCount: 3,
    fragments: 0, color: COLORS.magenta, every: 5,      // fragments only via Core harvester
  },
  // Warlord: every 10th threat level (sieges take the 30s and 60s). Built to test the loadout: adapts to the weapon
  // hurting it most, hides behind relay pylons twice, flaks player drones, and its armour caps how fast it can die.
  warlord: {
    name: 'Warlord', hp: BOSS_HP * 4, speed: 85, dmg: 9, scrap: BOSS_SCRAP * 4, r: 44,
    fireRate: 0.9, burst: 5, range: 380, bulletSpeed: 280, keepDistance: 330,
    adaptEvery: 10, adaptDur: 4,                   // immune to the weapon type that dealt the most damage since the last adapt
    pylonPhases: [0.66, 0.33], pylons: 3, pylonRadius: 130,   // at these hp fractions: invulnerable until the pylons die
    flakEvery: 7, flakRadius: 220, flakMul: 4,     // burst that hurts player drones in range (dmg * flakMul)
    escortEvery: 8, escortCount: 3,
    minKillSec: 12, dpsSeconds: 12,                // armour: at most hpMax/minKillSec per second; hp at least recent dps * dpsSeconds
    fragments: 2, color: COLORS.gold, every: 10,
  },
  pylon: {
    name: 'Relay pylon', hp: 150, speed: 0, dmg: 0, scrap: 25, r: 12,
    color: COLORS.ice, fromWave: 999, chance: 0,
  },
  // Siege bosses. hp/scrap are multiples of the Overseer at the same threat.
  titan: {
    name: 'Dreadnought', hp: BOSS_HP * TITAN_HP_MUL, speed: 32, dmg: 10, scrap: BOSS_SCRAP * TITAN_SCRAP_MUL, r: 64,
    range: 520, fireRate: 0.7, burst: 4, bulletSpeed: 260, keepDistance: 470,
    shieldArc: Math.PI * 2 / 3, arcSpeed: 0.5,          // rotating shield sector, radians and rad/s
    beamEvery: 14, beamCharge: 2.2, beamDur: 2.5, beamDps: 60,
    bayEvery: 6, bayCount: 5,
    jamEvery: 15, jamDur: 5,                             // from siege level 2: disables a hardpoint
    blinkEvery: 11, blinkCharge: 0.7, blinkRing: 12,     // teleport: charge, vanish, reappear elsewhere, bullet ring
    mineEvery: 9, mineCount: 4,                          // drops drifting mines
    adaptEvery: 12, adaptDur: 5,                         // immune to the weapon hurting it most
    minKillSec: 30, dpsSeconds: 40,                      // armour cap and dps-scaled hp: a siege lasts at least 30 s
    color: COLORS.red,
  },
  mine: {
    name: 'Mine', hp: 90, speed: 40, dmg: 45, scrap: 30, r: 9,
    fuse: 14, color: COLORS.orange, fromWave: 999, chance: 0,
  },
  warden: {
    name: 'Warden', hp: BOSS_HP * WARDEN_HP_MUL, speed: 70, dmg: 6, scrap: BOSS_SCRAP * WARDEN_SCRAP_MUL, r: 24,
    range: 260, fireRate: 1.4, burst: 3, bulletSpeed: 280, dodge: 0.12,
    heal: 0.006,                                          // fraction of titan max hp per second, each
    color: COLORS.orange,
  },
};

export const SIEGE = {
  every: 30,                 // threat levels between sieges
  wardens: 3, wardensPerLevel: 2,
  hpMul: 1.0, hpMulPerLevel: 1.2,
  fragments: 3, fragmentsPerLevel: 3,
  arcPerLevel: Math.PI / 6,
};

export const SPAWN = {
  tierSeconds: 40,       // one threat level per this many seconds survived
  hpGrowth: 1.15,        // mob hp multiplier per threat level
  hpBase: 1.3,           // flat multiplier on every ship's hp
  dmgGrowth: 1.045,      // mob damage multiplier per threat level
  scrapGrowth: 1.08,     // scrap multiplier per threat level
  baseRate: 1.2,         // mobs per second at t=0
  ratePerSecond: 0.012,  // extra mobs/sec per second survived
  maxRate: 12,
  softCap: 220,          // stop regular spawns while this many ships are alive
  surgeEvery: 5,         // every Nth threat level spawns a single random ship type
  choiceEvery: 3,        // offer a threat-level choice every Nth level; the pick lasts until the next offer
  droneAggro: 0.10,      // chance an enemy shot is aimed at the nearest friendly drone instead of the core
  // surge spawn-rate multiplier by ship toughness: light ships come in far bigger numbers
  surgeMul: { light: 2.6, medium: 1.6, heavy: 1.0 }, surgeLightHp: 35, surgeMediumHp: 100,
  burst: [2, 4],         // mobs per spawn tick, min/max
  raiderPerTier: 0.06, raiderMax: 0.45,
};

export const ELITES = {
  chanceBase: 0.04, chancePerTier: 0.004, chanceMax: 0.15, scrapMul: 3,
  mods: {
    fast:     { name: 'Fast',     color: COLORS.gold,   speed: 1.7 },
    armoured: { name: 'Armoured', color: GREY,          hp: 3 },
    splitter: { name: 'Splitter', color: COLORS.orange, spawn: 4 },
    healer:   { name: 'Healer',   color: COLORS.green,  heal: 0.06, radius: 140 },
    cloaked:  { name: 'Cloaked',  color: COLORS.violet, dodge: 0.35, alpha: 0.35 },
  },
};
