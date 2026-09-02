import { PulseCannon } from './pulse.js';
import { Railgun } from './railgun.js';
import { MissilePod } from './missile.js';
import { LaserBeam } from './laser.js';
import { TeslaArc } from './tesla.js';
import { GravityWell } from './gravity.js';
import { ShockEmitter } from './shock.js';
import { DroneBay } from './drones.js';

export { Weapon, formatStats } from './base.js';
export { PulseCannon, Railgun, MissilePod, LaserBeam, TeslaArc, GravityWell, ShockEmitter, DroneBay };

export const CLASSES = {
  pulse: PulseCannon, shock: ShockEmitter, drones: DroneBay, railgun: Railgun,
  missile: MissilePod, laser: LaserBeam, tesla: TeslaArc, gravity: GravityWell,
};

export function createWeapon(scene, tower, type, slotIndex) {
  const C = CLASSES[type];
  if (!C) throw new Error('unknown weapon ' + type);
  return new C(scene, tower, type, slotIndex);
}
