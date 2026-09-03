import { COLORS } from './colors.js';

export const TOWER = {
  radius: 24,
  shieldRadius: 52,
  hullMax: 300,
  shieldMax: 120,
  shieldRegen: 10,        // per second
  regenDelay: 1.0,       // seconds after last hit before regen resumes
  calmAfter: 4,          // seconds without damage before out-of-combat regen
  calmRegenMul: 3,       // regen multiplier when out of combat
  underFireRegen: 0.65,  // regen multiplier during the delay right after a hit
};

// Scrap upgrades on the tower itself. cost = base * growth^level
export const TOWER_UPGRADES = {
  shieldMax:   { name: 'Shield capacity', base: 40, growth: 1.38, add: 40,  unit: 'shield' },
  shieldRegen: { name: 'Shield regen',    base: 60, growth: 1.42, add: 3,   unit: '/s' },
  hull:        { name: 'Hull plating',    base: 90, growth: 1.45, add: 100, unit: 'hull' },
};

export const SLOT_COSTS = [0, 150, 800, 3000, 12000];   // 4 hardpoints normally; the 5th opens at threat 30
export const SLOT_GATES = { 4: 30 };                    // slot index -> threat level required

// Core colour by prestige tier.
export const CORE_TIERS = [COLORS.cyan, COLORS.green, COLORS.gold, COLORS.orange, COLORS.violet, COLORS.magenta, COLORS.white];
