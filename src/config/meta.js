// Run-level tuning: abilities, crits, offline earnings, prestige.

export const ABILITIES = {
  emp:        { name: 'EMP',          key: '1', cost: 300,  cd: 40,  dur: 3,  desc: 'Stuns every ship for 3 s.' },
  overcharge: { name: 'Overcharge',   key: '2', cost: 500,  cd: 60,  dur: 8,  mul: 2, desc: 'All weapons fire 2× faster for 8 s.' },
  burst:      { name: 'Shield burst', key: '3', cost: 400,  cd: 50,  dur: 0,  knock: 260, radius: 320, desc: 'Refills shield, clears shots, throws ships back.' },
  nuke:       { name: 'Nova',         key: '4', cost: 1500, cd: 120, dur: 0,  dmg: 400, desc: 'Massive blast across your whole weapon range.' },
};

// Critical strikes. Per-weapon overrides via WEAPONS[x].crit / critMul.
export const CRIT = { chance: 0.06, mul: 2.2, superChance: 0.04, superMul: 3 };   // a crit can crit again: super crit, ×3 on top

export const OFFLINE = { threshold: 30, rate: 0.5, capHours: 8 };

// Prestige: fragments earned from a run = floor((tier / divisor) ^ power). Manual prestige from minTier.
export const PRESTIGE = { divisor: 4, power: 1.5, minTier: 10 };
