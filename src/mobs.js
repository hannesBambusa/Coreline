// Compatibility shim: the mob roster now lives in src/mobs/. Import from here or from './mobs/index.js'.
export * from './mobs/index.js';
export {
  Mob, createMob, MOB_CLASSES,
  Drone, Swarm, Hydra, Bomber, Behemoth, Mine,
  Raider, Orbiter, Shielder, Phantom, Sniper, Jammer,
  Leech, Siphon, Carrier, Beacon,
  Boss, Warden, Titan,
} from './mobs/index.js';
