import { COLORS } from './colors.js';

// install = scrap to mount the weapon in an empty slot. cost/costGrowth = per-level upgrade.
export const WEAPONS = {
  pulse: {
    name: 'Pulse cannon', install: 0,
    desc: 'Fast bolts at the nearest ship. Gets more barrels as it levels, and later its bolts punch through ships and bounce to the next one.',
    dmg: 5, rate: 6, range: 380, speed: 820,
    barrelsAt: [10, 20, 30], pierceAt: [15, 30], ricochetRange: 220, ricochetDmg: 0.7,
    dmgMul: 1.15, rateMul: 1.04,
    cost: 22, costGrowth: 1.4,
    prefer: ['drone', 'swarm'], bonus: 1.4,
    color: COLORS.cyan,
  },
  railgun: {
    name: 'Railgun', install: 250,
    desc: 'One slow, huge shot that goes straight through everything in its path and blasts a crater where it first lands. Every fourth shot is a heavy slug that hits twice as hard with a bigger crater. Picks the toughest ship.',
    dmg: 150, rate: 0.4, range: 520,
    splash: 80, splashFrac: 0.75, splashPerLevel: 2,  // crater at the first ship the beam meets: radius (+per level), fraction of the shot's damage
    heavyEvery: 4, heavyMul: 2.5, heavySplashMul: 1.8, // every Nth shot is a heavy slug
    dmgMul: 1.19, rateMul: 1.03,
    cost: 90, costGrowth: 1.42,
    prefer: ['shielder', 'boss'], bonus: 1.6, crit: 0.15, critMul: 3.5,
    color: COLORS.white,
  },
  missile: {
    name: 'Missile pod', install: 400,
    desc: 'Homing missiles that explode on impact and hurt everything nearby. Aims at the biggest cluster.',
    dmg: 22, rate: 1.4, range: 460, speed: 330, turn: 5, splash: 80,
    dmgMul: 1.16, rateMul: 1.04,
    cost: 105, costGrowth: 1.42,
    prefer: ['raider', 'orbiter'], bonus: 1.5,
    color: COLORS.orange,
  },
  laser: {
    name: 'Laser beam', install: 700,
    desc: 'A steady beam that gets stronger the longer it stays on one ship. Once warmed up it splits onto nearby ships and, at full power, sweeps the whole ring. Higher levels add more splits and explosive crits.',
    dmg: 20, rate: 1, range: 560, rampTime: 3, rampMax: 3, keepRamp: 0.6,
    forksAt: [1, 8, 16, 24], forkDmg: 0.5, forkRamp: 0.5, forkRange: 170, burstAt: 5, burstRadius: 80,
    sweepEvery: 6, sweepDur: 0.6, sweepMul: 2.5,
    dmgMul: 1.16, rateMul: 1.0,
    cost: 135, costGrowth: 1.42,
    prefer: ['orbiter', 'boss'], bonus: 1.5, crit: 0.08,
    color: COLORS.magenta,
  },
  tesla: {
    name: 'Tesla arc', install: 500,
    desc: 'Chain lightning that jumps from ship to ship, a little weaker with each jump.',
    dmg: 14, rate: 1.6, range: 520, chains: 4, chainRange: 220,
    dmgMul: 1.15, rateMul: 1.04,
    cost: 105, costGrowth: 1.42,
    prefer: ['swarm', 'drone'], bonus: 1.6, crit: 0.09,
    color: COLORS.ice,
  },
  gravity: {
    name: 'Gravity well', install: 900,
    support: true,   // not offered as a starting weapon: it does not shoot on its own
    desc: 'Throws a gravity well that drags ships together and slows them, so your other weapons hit more at once.',
    dmg: 6, rate: 0.3, range: 420, speed: 260, wellRadius: 160, wellLife: 4, pull: 90, slow: 0.45,
    dmgMul: 1.15, rateMul: 1.05,
    cost: 165, costGrowth: 1.42,
    prefer: ['swarm', 'raider'], bonus: 1.4,
    color: COLORS.violet,
  },
  shock: {
    name: 'Shock emitter', install: 600,
    support: true,   // not offered as a starting weapon: it does not shoot on its own
    desc: 'A shockwave that throws every nearby ship back and wipes their shots. Pushes harder and recharges faster as it levels.',
    dmg: 14, rate: 0.25, range: 320, push: 130, pushPerLevel: 12,
    dmgMul: 1.15, rateMul: 1.05,
    cost: 120, costGrowth: 1.42,
    prefer: ['swarm', 'drone', 'bomber'], bonus: 1.4,
    color: COLORS.green,
  },
  chrono: {
    name: 'Chrono field', install: 900,
    support: true,   // not offered as a starting weapon: it does not shoot on its own
    desc: 'Support field. Time runs slow in a bubble around the core: ships and their shots crawl, and your bullets hit harder for every moment they spend inside. Barely any damage of its own. At high level it rewinds every ship inside to where it was a few seconds ago.',
    dmg: 2, rate: 1, range: 260, rangePerLevel: 5, ratio: 0.65, ratioPerLevel: 0.01, ratioMin: 0.35,
    boostPerSec: 0.5, boostMax: 2, rewindAt: 10, rewindEvery: 20, rewindBack: 3,
    dmgMul: 1.10, rateMul: 1.0,
    cost: 150, costGrowth: 1.42,
    prefer: ['raider', 'sniper', 'bomber'], bonus: 1.3,
    color: COLORS.ice,
  },
  nanite: {
    name: 'Replicator swarm', install: 750,
    support: true,   // not offered as a starting weapon: infection needs packs to matter
    desc: 'Infects a ship with nanites. The host takes damage over time and, when it dies, the nanites jump to its neighbours, growing stronger with each hop. Weak against a lone boss, deadly against a pack.',
    dmg: 12, rate: 0.8, range: 480, speed: 380, turn: 7, dur: 8, genMul: 1.35, jumpRange: 240, packRadius: 120,   // the bolt is a homing missile now
    jumpsAt: [8, 16], outbreakAt: 12,
    dmgMul: 1.15, rateMul: 1.03,
    cost: 135, costGrowth: 1.42,
    prefer: ['swarm', 'hydra', 'carrier', 'drone'], bonus: 1.4,
    color: COLORS.green,
  },
  singularity: {
    name: 'Singularity core', install: 1200,
    desc: 'Charges up from the scrap your kills bring in, then detonates: every ship in range loses a chunk of its max health (bosses less) and every enemy shot is wiped. Higher levels take a bigger chunk and leave a glow where all your hits crit. Needs killing weapons around it.',
    dmg: 0.18, pctMax: 0.55, bossPct: 0.06, rate: 1, range: 400, need: 900, trickle: 10, afterglowAt: 8, afterglowDur: 4,
    // `need` is in threat-1 scrap: it grows with SPAWN.scrapGrowth per threat level, and with the flat scrap multipliers, so a charge stays a fixed number of kills
    support: true,   // not offered as a starting weapon: it only charges from kills made by other slots
    dmgMul: 1.05, rateMul: 1.06,
    cost: 180, costGrowth: 1.44,
    prefer: ['behemoth', 'carrier', 'shielder'], bonus: 1,
    color: COLORS.magenta,
  },
  beamdrones: {
    name: 'Beam drones', install: 800,
    support: true,   // not offered as a starting weapon: runs start with a turret
    desc: 'Interceptor drones with short lasers instead of guns. Each beam holds on one ship and, as the bay levels, splits onto more ships around it.',
    dmg: 22, rate: 1, range: 640, speed: 0, fireRange: 150, splitRange: 120, splitAt: [6, 10, 14, 18], splitDmg: 0.6,
    drones: 3, dronePerLevels: 4, maxDrones: 6, droneHp: 110, droneHpMul: 1.15, droneSpeed: 240, respawn: 6,
    dmgMul: 1.13, rateMul: 1.0,
    cost: 130, costGrowth: 1.42,
    prefer: ['orbiter', 'raider', 'shielder', 'carrier'], bonus: 1.4,
    color: COLORS.magenta,
  },
  ionstorm: {
    name: 'Ion storm', install: 1000,
    support: true,   // not offered as a starting weapon: it does not shoot on its own
    desc: 'A storm cloud that lives out on the ring and drifts after the biggest pack. Ships inside get hit by lightning and their shots are eaten. High level adds a second cloud. It never comes near the core.',
    dmg: 16, rate: 2.5, range: 560, cloudRadius: 110, radiusPerLevel: 3, cloudSpeed: 60, arcs: 4, secondAt: 12, minDist: 180,
    dmgMul: 1.14, rateMul: 1.02,
    cost: 120, costGrowth: 1.42,
    prefer: ['swarm', 'drone', 'hydra', 'blinker'], bonus: 1.4,
    color: COLORS.ice,
  },
  missiledrones: {
    name: 'Missile drones', install: 850,
    support: true,   // not offered as a starting weapon: runs start with a turret
    desc: 'Interceptor drones with mini missile pods: homing missiles that explode on impact. Higher levels fire salvos.',
    dmg: 18, rate: 0.7, range: 640, speed: 380, turn: 9, splash: 55, fireRange: 230, salvoAt: [8, 16],
    drones: 3, dronePerLevels: 4, maxDrones: 6, droneHp: 120, droneHpMul: 1.15, droneSpeed: 230, respawn: 6,
    dmgMul: 1.14, rateMul: 1.02,
    cost: 130, costGrowth: 1.42,
    prefer: ['shielder', 'carrier', 'behemoth', 'hydra'], bonus: 1.4,
    color: COLORS.orange,
  },
  kamikaze: {
    name: 'Kamikaze drones', install: 700,
    support: true,   // not offered as a starting weapon: runs start with a turret
    desc: 'Big, slow drones that fly straight into a ship and explode. Lost drones are rebuilt in a few seconds. Every blast counts as a proc.',
    dmg: 60, rate: 1, range: 640, speed: 0, fireRange: 0, blast: 90, blastPerLevel: 3,
    drones: 2, dronePerLevels: 5, maxDrones: 5, droneHp: 160, droneHpMul: 1.15, droneSpeed: 170, respawn: 5,
    dmgMul: 1.15, rateMul: 1.0,
    cost: 110, costGrowth: 1.42,
    prefer: ['shielder', 'behemoth', 'carrier', 'hydra'], bonus: 1.4,
    color: COLORS.red,
  },
  mirrors: {
    name: 'Mirrors', install: 800,
    support: true,   // not offered as a starting weapon: it does not shoot on its own
    desc: 'Reflector plates orbiting just outside the shield. Enemy shots that hit a plate fly back at whoever fired them, harder than they came, and take a share of the shooter’s own hull with them. Ships that crash into a plate die but damage it, and shots wear it down a little; a broken plate rebuilds in a few seconds. Plates turn to face incoming fire, and more plates come with levels.',
    dmg: 1, rate: 1, range: 0, arc: 1.0, arcPerLevel: 0.03, arcMax: 1.7, mul: 1.5, mulPerLevel: 0.12, platesAt: [8, 16],
    hpFrac: 0.08, hpFracPerLevel: 0.005, bossFrac: 0.2,   // a reflected shot also takes this share of the shooter's max hp (bosses a fifth of it), so mirrors keep up with ship hp
    plateHp: 220, plateHpMul: 1.14, reflectWear: 0.08, rebuild: 10, noJam: true,   // plates have no electronics to jam   // a plate has hp: rams hit it for their damage, each reflect costs wear × the shot's damage; dead plates rebuild
    dmgMul: 1.0, rateMul: 1.0,
    cost: 100, costGrowth: 1.4,
    prefer: ['sniper', 'raider', 'orbiter', 'warden'], bonus: 1,
    color: COLORS.ice,
  },
  drones: {
    name: 'Drone bay', install: 600,
    support: true,   // not offered as a starting weapon: runs start with a turret
    desc: 'Interceptor drones that go after the ships your guns cannot reach first, then work inward. They draw enemy fire and rebuild when lost.',
    dmg: 8, rate: 3.2, range: 640, speed: 850, fireRange: 190,
    drones: 3, dronePerLevels: 3, maxDrones: 8, droneHp: 100, droneHpMul: 1.15, droneSpeed: 260, respawn: 5,
    dmgMul: 1.12, rateMul: 1.03,
    cost: 120, costGrowth: 1.4,
    prefer: ['raider', 'phantom', 'orbiter', 'sniper', 'beacon'], bonus: 1.5,
    color: COLORS.sky,
  },
};
