# Combo Procs Logic Breakdown

All combos roll (probabilistic trigger) when their conditions are met. They pair mounted weapons and apply effects when both are present.

## Pulse Cannon (onPulseShot)

### orbital
- **Condition:** Gravity well exists + railgun is mounted
- **Effect:** 8 bullets burst from the well in a ring formation
- **Damage:** 2x weapon damage
- **Visual:** Ripple effect at well center

### gunrun
- **Condition:** Active drones with targets exist + drone bay is mounted
- **Effect:** Every active drone fires a 3-bullet burst at its target
- **Damage:** Normal drone damage, normal drone speed
- **Visual:** Flash at each drone location

## Railgun Shot (onRailShot)

### sabot
- **Condition:** Pulse cannon mounted
- **Effect:** 6 pulse bullets fan out along the railgun beam angle
- **Damage:** 1.5x pulse damage
- **Speed:** 1.3x pulse speed
- **Pattern:** Bullets spread across ±6° arc from beam center

### slingshot
- **Condition:** Gravity well exists + gravity weapon mounted
- **Effect:** Nearest gravity well teleports to target location and DPS doubles
- **Duration:** Permanent (affects well for rest of life)
- **Visual:** Ripple effects before and after teleport

### spotter
- **Condition:** Drone bay exists + target alive
- **Effect:** Target marked for 10 frames; all active drones re-target to marked enemy
- **Visual:** Sky blue ripple expanding from target

## Missile Launch (onMissileLaunch)

### guided
- **Condition:** Laser mounted + laser has active target + target alive
- **Effect:** Missile homes on laser's target instead
- **Damage:** 2x missile damage
- **Turn:** 2x turn rate (more responsive homing)
- **Color:** Magenta
- **Note:** Overrides original target if there was one

## Missile Impact (onMissileImpact)

### ionwarhead
- **Condition:** Tesla weapon mounted
- **Effect:** Arcs from impact to up to 4 nearby mobs within 200 range
- **Damage:** 0.8x weapon damage per arc
- **Targets:** Sorted by distance, hits nearest first
- **Visual:** Lightning bolts to each target

### spore
- **Condition:** Nanite weapon mounted
- **Effect:** Every mob in missile splash radius gets infected
- **Infection:** Base amount (1 gen)
- **Visual:** Ripple at impact center

## Tesla Chain (onTeslaChain)

### relay
- **Condition:** Drone bay exists + active drones exist
- **Effect:** Arc jumps from last hit to each drone, then each drone arcs to nearest unhit ship (160 range)
- **Damage:** 0.7x weapon damage to new targets
- **Pattern:** All drones get a chance to extend the chain
- **Visual:** Blue bolts from last target → drone → new target

### conductor
- **Condition:** Laser mounted + laser has active target in range + target alive
- **Effect:** Arc jumps to laser target, then chains 3 times to nearest unhit ships
- **Damage:** 2x initially, drops 20% per hop
- **Chain Range:** Uses weapon's chainRange stat
- **Visual:** Magenta bolts for conductor-specific hops
- **Note:** Laser target can be already-hit or outside main chain

### lattice
- **Condition:** Beam drones mounted + at least one arc hit a beamed ship
- **Effect:** Arc jumps from that ship to all ships currently held by beam drones
- **Damage:** 0.8x weapon damage
- **Visual:** Magenta bolts to each beamed target
- **Note:** Only triggers if tesla arc already touched a beamed ship

### thunderhead
- **Condition:** Ion storm mounted + at least one arc hit a ship inside the storm cloud
- **Effect:** Arc jumps to all ships inside that cloud
- **Damage:** 0.9x weapon damage
- **Visual:** Storm-colored bolts within cloud
- **Note:** "seed" is the first hit ship; all others in cloud get hit from there

### staticfield
- **Condition:** Chrono field mounted + at least one arc hit inside tower's chrono range
- **Effect:** All hit ships inside chrono range get stunned
- **Stun:** 1 frame of stun, sets dodgeVx/Vy to 0 (no evasion)
- **Note:** Ships outside chrono range not affected

## Shock Pulse (onShockPulse)

### flak
- **Condition:** Pulse cannon mounted
- **Effect:** Opens a "flak window" (10 frame duration). While active, every pulse fires 16 rounds in all directions
- **Damage:** Normal pulse damage
- **Pattern:** One bullet per compass direction (full circle)
- **Spawn:** Bullets spawn from tower perimeter in all directions
- **Note:** Roll only starts the window; duration ticks down independently

### concussion
- **Condition:** Missile pod mounted
- **Effect:** Every in-flight missile detonates at current position with bigger splash (2x radius). Shock pod fires a 12-missile volley
- **Damage:** Original missile damage via damageRadius
- **Splash:** 2x missile splash
- **Volley:** 12 missiles fired in ring formation, each targeting nearest ship in order
- **Volley Damage:** 1.5x pod damage
- **Volley Speed:** 1.3x pod speed
- **Volley Turn:** 1.5x pod turn
- **Timing:** Explosions ripple outward as wave travels (closer = earlier detonation)
- **Visual:** Explosions, white flashes, ripple effects, missile audio

### cluster
- **Condition:** Missile drones mounted + active missile drones with targets exist
- **Effect:** Every active missile drone fires maximum salvo (at least 2, or configured salvo count)
- **Note:** onShockPulse just triggers the salvos; individual drones handle launch logic

### flashpoint
- **Condition:** Laser mounted + laser held for 80%+ of ramp time (nearly full charge)
- **Effect:** Laser sweeps entire ring at once instead of single target
- **Note:** sweep() function handles the sweep behavior

## Laser Tick (onLaserTick)

### prism
- **Condition:** Beam drones mounted + laser held for 80%+ of ramp time + random 2x per second
- **Effect:** Sharpens beam drone beams (sets prismT timer to 3 frames)
- **Duration:** 3 frames
- **Note:** Low roll chance per frame; builds up when laser is ramped

### lensing
- **Condition:** Gravity well under laser target + gravity weapon mounted + random 2x per second
- **Effect:** Laser beam refracts through well to all ships inside well radius (for 3 frames)
- **Damage:** 0.5x laser beam damage
- **Range:** Well radius
- **Visual:** Trail effects inside well
- **Note:** Maintains focus on well even if laser target moves; ends if well dies

## Gravity Well Land (onWellLand)

### downburst
- **Condition:** Ion storm mounted + ships in cloud at well location
- **Effect:** Cloud collapses at well, damaging all ships in cloud
- **Damage:** 4x storm damage
- **Target:** All ships storm.shipsAround() returns (cloud radius)
- **Visual:** Lightning bolts from well to each ship, ripple effect

### orbitstrike
- **Condition:** Drone bay exists + ships in well radius
- **Effect:** Ships marked for 10 frames; drones retarget to nearest marked ship; drone bay gets speed boost
- **Mark Duration:** 10 frames
- **Boost:** 10 frames of drone acceleration
- **Boost Mechanic:** Stacks with other boosts (uses Math.max)
- **Visual:** Sky blue ripple at well center

## Chrono Field Tick (onChronoTick)

### dilation
- **Condition:** Drone bay exists + active drones exist + random 0.5x per second
- **Effect:** Drones get speed boost
- **Boost Duration:** 10 frames
- **Note:** Low roll chance; drones run on tower time while everything else slows

## Nanite Shot (onNaniteShot)

### carrierstrain
- **Condition:** Drone bay exists + active drones with targets exist
- **Effect:** Every active drone's target gets infected
- **Infection:** 1 generation
- **Visual:** Bolt from drone to target
- **Note:** Does NOT spread infection; just infects the drone's specific target

## Singularity Blast (onSingularityBlast)

### accretion
- **Condition:** Drone bay exists + at least one drone dead
- **Effect:** All dead drones revive at tower center with full HP; drone bay gets speed boost
- **Revive HP:** Full drone health
- **Boost Duration:** 10 frames
- **Visual:** Flash at tower center for each revived drone
- **Note:** Can revive entire fleet at once

### collapsar
- **Condition:** Railgun mounted
- **Effect:** 3 biggest ships in range (by max HP) each take triple railgun hit
- **Damage:** 3x railgun damage per hit
- **Count:** Up to 3 ships (fewer if fewer ships available)
- **Range:** Weapon range + ship radius
- **Visual:** White lines from tower to each target

## Beam Drone Tick (onBeamTick)

### painted
- **Condition:** Regular drone bay (interceptors) exists
- **Effect:** Beamed target marked for 10 frames; all active interceptor drones retarget to marked ship
- **Mark Duration:** 10 frames
- **Visual:** Sky blue ripple around target
- **Frequency:** Once per second while beam is held on target

## Missile Drone Launch (onDroneMissile)

### escortvolley
- **Condition:** Drone bay (interceptors) mounted + active interceptor drones exist
- **Effect:** Every active interceptor fires a 3-bullet burst at the same target as the missile drone
- **Spread:** 0.15 radians between bullets
- **Retarget:** All interceptors also lock onto the missile target
- **Visual:** No explicit effect (handled by bullet spawning)

### laserguided
- **Condition:** Beam drones mounted + target currently beamed by any beam drone + missile recently launched (age < 0.05)
- **Effect:** Missile gets doubled damage and tripled turn rate; color changes to beam drone color
- **Damage Multiplier:** 2x
- **Turn Multiplier:** 3x
- **Visual:** Beam drone color inherited
- **Note:** Only affects missiles launched in this frame (age < 50ms)

### seekers
- **Condition:** Gravity weapon mounted + target inside any gravity well + missile recently launched (age < 0.05)
- **Effect:** Missile damage doubled; color changes to violet
- **Damage Multiplier:** 2x
- **Color:** Violet
- **Note:** Only affects missiles launched in this frame (age < 50ms)

## Kamikaze Blast (onKamikazeBlast)

### wingmen
- **Condition:** Drone bay (interceptors) mounted + active interceptor drones exist
- **Effect:** Interceptors get speed boost; each interceptor fires 3-bullet burst at nearest ship (2x blast radius range)
- **Boost Duration:** 10 frames
- **Burst Spread:** 0.15 radians
- **Visual:** Drone movement + bullet effects
- **Note:** Triggers after kamikaze damage is applied

### chainblast
- **Condition:** Missile drones mounted + active missile drones exist + blast hit ships
- **Effect:** Each active missile drone fires a 2-missile salvo at one of the ships hit by blast (round-robin)
- **Salvo Count:** 2 missiles per drone
- **Target Assignment:** Caught ships distributed evenly across drones

### sporebomb
- **Condition:** Nanite weapon mounted + blast hit ships
- **Effect:** Every ship hit by blast radius gets infected
- **Infection:** 1 generation per ship
- **Note:** Infects even if they're also taking kinetic damage from blast

## Target Lock (kamikazeMul)

### targetlock
- **Condition:** Beam drones mounted + target currently beamed + roll succeeds
- **Effect:** Kamikaze blast damage doubled
- **Damage Multiplier:** 2x
- **Return Value:** Multiplier applied to kamikaze damage calculation
- **Note:** Called BEFORE blast damage; returns multiplier for main damage

## Mirror Reflect (onReflect)

### ricochetfield
- **Condition:** Pulse cannon mounted
- **Effect:** Reflected bullet gains pierce (pierces 2 targets)
- **Pierce Amount:** 2
- **Note:** hitSet prevents hitting same target twice

### focalpoint
- **Condition:** Chrono field mounted + enemy bullet was slowed (chrono < 1) + roll succeeds
- **Effect:** Reflected shot comes back with doubled damage
- **Damage Multiplier:** 2x
- **Note:** Only works if original shot was actually slowed by chrono

### prismcannon
- **Condition:** Laser mounted
- **Effect:** Laser fires from mirror plate to farthest ship in laser range
- **Damage:** 3x laser damage
- **Visual:** Line from mirror to target, laser effect visual
- **Range:** Laser's configured range
- **Note:** Finds farthest by sorting all mobs; happens every reflect

---

## Summary Table

| Combo | Trigger | Main Effect |
|-------|---------|------------|
| sabot | Railgun + Pulse | Bullets fan from beam |
| orbital | Pulse + Gravity | Ring burst from well |
| gunrun | Pulse + Drones | Drones burst targets |
| guided | Missile + Laser | Missile homes on laser target |
| ionwarhead | Missile + Tesla | Tesla arcs from impact |
| spore | Missile + Nanite | Infect splash area |
| flak | Shock + Pulse | Pulse fires all directions |
| concussion | Shock + Missile | Detonate in-flight missiles |
| relay | Tesla + Drones | Arc jumps through drones |
| conductor | Tesla + Laser | Arc chains off laser target |
| lattice | Tesla + Beam Drones | Arc to beamed ships |
| thunderhead | Tesla + Storm | Arc in storm cloud |
| staticfield | Tesla + Chrono | Stun arced ships in field |
| slingshot | Railgun + Gravity | Well teleports to target |
| spotter | Railgun + Drones | Mark target, drones focus |
| prism | Laser + Beam Drones | Sharpen beam drone beams |
| lensing | Laser + Gravity | Refract through well |
| downburst | Well + Storm | Cloud collapses at well |
| orbitstrike | Well + Drones | Mark ships, drones dive |
| dilation | Chrono + Drones | Speed boost drones |
| accretion | Singularity + Drones | Revive dead drones |
| collapsar | Singularity + Railgun | Hit 3 biggest ships |
| painted | Beam + Drones | Mark beamed target |
| escortvolley | Missile Drone + Drones | Interceptors burst target |
| laserguided | Missile Drone + Beam | Enhanced missile |
| seekers | Missile Drone + Gravity | Enhanced missile in well |
| wingmen | Kamikaze + Drones | Interceptor surge + burst |
| targetlock | Kamikaze + Beam | Doubled blast damage |
| chainblast | Kamikaze + Missile Drones | Drones salvo caught ships |
| sporebomb | Kamikaze + Nanite | Infect blast area |
| ricochetfield | Mirror + Pulse | Reflect pierces |
| focalpoint | Mirror + Chrono | Slowed reflect hits harder |
| prismcannon | Mirror + Laser | Laser to farthest ship |
| carrierstrain | Nanite + Drones | Drone targets infected |
| cluster | Shock + Missile Drones | Drones salvo (shock pulse) |
| flashpoint | Shock + Laser | Laser sweeps full ring |
