import { PulseCannon } from './pulse.js';
import { Railgun } from './railgun.js';
import { MissilePod } from './missile.js';
import { LaserBeam } from './laser.js';
import { TeslaArc } from './tesla.js';
import { GravityWell } from './gravity.js';
import { ShockEmitter } from './shock.js';
import { DroneBay } from './drones.js';
import { ChronoField } from './chrono.js';
import { ReplicatorSwarm } from './nanite.js';
import { SingularityCore } from './singularity.js';
import { BeamDrones } from './beamdrones.js';
import { IonStorm } from './ionstorm.js';
import { MissileDrones } from './missiledrones.js';
import { KamikazeDrones } from './kamikaze.js';
import { Mirrors } from './mirrors.js';

export { Weapon, formatStats } from './base.js';
export { PulseCannon, Railgun, MissilePod, LaserBeam, TeslaArc, GravityWell, ShockEmitter, DroneBay, ChronoField, ReplicatorSwarm, SingularityCore, BeamDrones, IonStorm, MissileDrones, KamikazeDrones, Mirrors };

export const CLASSES = {
  pulse: PulseCannon, shock: ShockEmitter, drones: DroneBay, railgun: Railgun,
  missile: MissilePod, laser: LaserBeam, tesla: TeslaArc, gravity: GravityWell,
  chrono: ChronoField, nanite: ReplicatorSwarm, singularity: SingularityCore, beamdrones: BeamDrones, ionstorm: IonStorm, missiledrones: MissileDrones, kamikaze: KamikazeDrones, mirrors: Mirrors,
};

export function createWeapon(scene, tower, type, slotIndex) {
  const C = CLASSES[type];
  if (!C) throw new Error('unknown weapon ' + type);
  return new C(scene, tower, type, slotIndex);
}
