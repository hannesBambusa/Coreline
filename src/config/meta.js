// Run-level tuning: abilities, crits, offline earnings, prestige.

export const ABILITIES = {
  emp:        { name: 'EMP',          key: '1', cost: 300,  cd: 40,  dur: 3,  desc: 'Stuns every ship for 3 s.' },
  overcharge: { name: 'Overcharge',   key: '2', cost: 500,  cd: 60,  dur: 8,  mul: 2, desc: 'All weapons fire 2× faster for 8 s.' },
  burst:      { name: 'Shield burst', key: '3', cost: 400,  cd: 50,  dur: 0,  knock: 260, radius: 320, desc: 'Refills shield, clears shots, throws ships back.' },
  nuke:       { name: 'Nova',         key: '4', cost: 1500, cd: 120, dur: 0,  dmg: 400, desc: 'Massive blast across your whole weapon range.' },
};

// Critical strikes. Per-weapon overrides via WEAPONS[x].crit / critMul.
// Level scaling. Soft cap: growth per level shrinks past softCap. Hard cap: capBase + capPerPrestige * prestige.
export const LEVELS = {
  softCap: 25, softDmgMul: 1.06, softRateMul: 1.01,      // weapons
  towerSoftCap: 20, towerSoftFrac: 0.5,                   // tower upgrades add half as much per level past this
  capBase: 20, capPerPrestige: 5,                          // hard cap for weapon levels and tower upgrade levels
};

// Run difficulty, picked on the start screen. Scales every ship's HP and damage and the spawn rate;
// harder runs pay more scrap and fragments. `color` is the label colour.
export const DIFFICULTY = {
// cap = alive-ship cap multiplier, speed = ship speed, elite = elite chance multiplier.
  // unlock: reach `tier` on difficulty `on` (any run) before this level shows on the start screen
  easy:    { name: 'Easy',        hp: 0.7, dmg: 0.7, spawn: 0.8, cap: 0.8, speed: 0.9, elite: 0.7, scrap: 0.9,  frag: 0.5,  color: '#7ee787' },
  normal:  { name: 'Normal',      hp: 1,   dmg: 1,   spawn: 1,   cap: 1,   speed: 1,   elite: 1,   scrap: 1,    frag: 1,    color: '#4ff2ff' },
  hard:    { name: 'Hard',        hp: 1.5, dmg: 1.4, spawn: 1.3, cap: 1.1, speed: 1.05, elite: 1.3, scrap: 1.15, frag: 1.2,  color: '#ffd166', unlock: { on: 'normal', tier: 15 } },
  brutal:  { name: 'Really hard', hp: 2.2, dmg: 1.9, spawn: 1.6, cap: 1.3, speed: 1.1, elite: 1.7, scrap: 1.3,  frag: 1.4,  color: '#ff8c42', unlock: { on: 'hard', tier: 20 } },
  insane:  { name: 'Insane',      hp: 5,   dmg: 4,   spawn: 4,   cap: 2,   speed: 1.25, elite: 3, scrap: 0.6,  frag: 1.75, color: '#ff4d6d', unlock: { on: 'brutal', tier: 25 } },
};

export const CRIT = { chance: 0.06, mul: 2.2, superChance: 0.04, superMul: 3 };   // a crit can crit again: super crit, ×3 on top

export const OFFLINE = { threshold: 30, rate: 0.5, capHours: 8 };

// Prestige: fragments earned from a run = floor((tier / divisor) ^ power). Manual prestige from minTier.
export const FRESH_START_FRAGMENTS = 4;   // a brand-new profile (no save at all) starts with these to unlock a first weapon

export const PRESTIGE = { divisor: 8, power: 1.4, minTier: 10 };   // threat 20 → 3, 40 → 9, 60 → 16
