// Drift mode: the core leaves its foundation and swims. Movement, wreck pickups and blob looks.

/** The two ways to play. 'tower' holds one spot; 'drift' swims around picking the wrecks up. */
export const MODES = {
  tower: { name: 'Coreline', sub: 'The classic. The core is bolted down: mount weapons and hold the line.' },
  drift: { name: 'Drift', sub: 'The core tears loose and swims. Dodge the fleet, swallow the wrecks it leaves behind.' },
};
export const DRIFT = {
  speed: 205,             // blob top speed, px/s
  accel: 14,              // how fast the blob reaches the target velocity (exponential, per second)
  drag: 9,                // slowdown rate when nothing is held
  pointerDead: 26,        // pointer closer than this to the blob: stand still
  hullMul: 1,             // hull multiplier in this mode (dodging is the defence, so no free tanking)
  shieldRegenMul: 0.8,    // shields come back slower: you are meant to move, not to soak

  // blink: double-tap a movement key to jump that way
  blinkMinDist: 150,      // floor for the jump; normally it is the range of the longest weapon mounted
  blinkWindow: 0.3,       // seconds between the two taps
  blinkCooldown: 10,      // seconds before it can be used again
  blinkGhosts: 6,         // afterimages drawn along the jump
  blinkFxDur: 0.5,        // seconds the departure and arrival animation runs
  blinkRingR: 18,         // cooldown ring, px outside the shield ring

  // wrecks
  magnetMin: 160,         // floor for the magnet; normally it is the weapon range circle around the blob
  // A pulled wreck steers its whole velocity at the blob rather than just accelerating toward it:
  // plain acceleration builds up sideways speed and makes the wreck orbit instead of arriving.
  magnetStart: 230,       // px/s the moment the pull takes hold
  magnetRamp: 900,        // px/s gained per second under pull, so it always closes on a moving blob
  magnetMax: 900,         // pull speed cap
  magnetSteer: 14,        // how fast the velocity turns onto the blob (exponential, per second)
  pickup: 22,             // absorbed once this close to the blob centre
  wreckDrift: 70,         // scatter speed a wreck is thrown out with
  wreckDrag: 0.05,        // per-second decay factor of the scatter
  wreckCap: 260,          // over this the oldest wreck folds into its nearest neighbour
  wreckR: 3.5,            // drawn radius of the weakest ship's wreck
  // Wreck size follows how tough the ship was, through its base scrap (MOBS[type].scrap), not the
  // scrap actually paid out: that one inflates with the threat level and would grow every wreck.
  wreckRef: 3,            // base scrap of the weakest ship (drone); this is a 1x wreck
  wreckSizeExp: 0.3,      // how fast the size grows with base scrap
  wreckSizeMax: 4.6,      // cap, so a Dreadnought's wreck stays a pickup and not a wall
  wreckEliteMul: 1.4,     // elites count as tougher ships
  wreckRingAt: 2.2,       // size from which the wreck gets its extra ring
  floaterEvery: 3,        // only every Nth pickup shows a floating number, so the screen stays readable

  // looks
  blobPoints: 26,         // vertices of the membrane
  blobWobble: 0.09,       // wobble as a fraction of the radius
  blobStretch: 0.3,       // squash and stretch at top speed
  trailEvery: 0.05,       // seconds between trail motes while moving
};
