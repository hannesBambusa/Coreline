// Mob roster: one class per enemy type, plus the factory the scene and the mobs themselves spawn through.
import { Drone, Swarm, Hydra, Bomber, Behemoth, Mine, Shoal } from './rushers.js';
import { Raider, Orbiter, Shielder, Phantom, Sniper, Jammer, Blinker, Bulwark } from './shooters.js';
import { Leech, Siphon, Carrier, Beacon } from './support.js';
import { Boss, Warden, Warlord, Pylon } from './bosses.js';
import { Titan } from './titan.js';

export { Mob, orbitOpts, DODGE_IMPULSE } from './base.js';
export { Drone, Swarm, Hydra, Bomber, Behemoth, Mine, Raider, Orbiter, Shielder, Phantom, Sniper, Jammer, Leech, Siphon, Carrier, Beacon, Boss, Warden, Titan };

/** type key -> class */
export const MOB_CLASSES = {
  drone: Drone, raider: Raider, swarm: Swarm, orbiter: Orbiter, shielder: Shielder, boss: Boss,
  bomber: Bomber, leech: Leech, phantom: Phantom, blinker: Blinker, bulwark: Bulwark, shoal: Shoal, hydra: Hydra, sniper: Sniper, carrier: Carrier,
  jammer: Jammer, siphon: Siphon, beacon: Beacon, behemoth: Behemoth, titan: Titan, mine: Mine, warden: Warden, warlord: Warlord, pylon: Pylon,
};

/** `gen` is only used by the hydra (split generation); titan level / warden titan are set by the caller */
export function createMob(scene, type, tier, x, y, gen) {
  const Cls = MOB_CLASSES[type];
  if (!Cls) throw new Error('unknown mob ' + type);
  if (type === 'hydra') return new Hydra(scene, tier, x, y, gen || 0);
  return new Cls(scene, tier, x, y);
}
