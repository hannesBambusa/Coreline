# Coreline – design record

Space-themed idle tower defence. One tower in the centre, rogue-AI ships attack from all sides. Tower auto-fires, player spends currency on weapons, upgrades and a permanent skill tree.

Decisions below were settled in a grilling session on 2026-09-01. Change here first, then in code.

## Stack

- Phaser 3 via CDN `<script>`, vanilla JS, ES modules, no build step.
- Needs a local server for modules (`npx serve .` or `python3 -m http.server`).
- UI is an HTML overlay, not canvas.
- All art procedural (Phaser Graphics + built-in FX). Sprites and sound may come later.

## Domain model

### Entities

| Entity | Fields | Lifetime |
|---|---|---|
| **Tower** | hull, hullMax, shield, shieldMax, shieldRegen, slots[], tier | Run |
| **Slot** | index, weapon or null | Run |
| **Weapon** | type, level, cooldown, target rule | Run |
| **Mob** | type, hp, shield (Shielder only), speed, behaviour state, dodgeChance | Wave |
| **Projectile** | owner (tower or mob), damage, kind (bullet, missile, beam, arc) | Seconds |
| **Run** | scrap, time, tier, kills | Until prestige |
| **Profile** | fragments, tree nodes bought, prestigeCount, bestTime, stats | Permanent |
| **Save** | v, run, profile, lastTick | localStorage |

### Currencies

| Currency | Earned | Spent on | Reset on prestige |
|---|---|---|---|
| **Scrap** | Per kill, scaled by wave | Weapon levels, slot unlocks, tower upgrades | Yes |
| **Core fragments** | Prestige (by best wave) + small trickle from bosses | Skill tree | No |

### Invariants

- Scrap and weapon levels never survive prestige. Tree and fragments always do.
- A slot can only hold a weapon type whose tree unlock node is bought (pulse cannon always unlocked).
- Shield absorbs damage before hull. Shield regens, hull does not (except tree nodes).
- Hull 0 forces prestige. Manual prestige allowed from threat level 10.
- Survival time never advances while offline.

## Failure state

Hybrid: shield ring regens, hull damage persists. Hull 0 ends the run and triggers prestige. Shield regen is the key defensive stat because mobs shoot from range.

## Mobs

All ships piloted by a rogue AI.

| Type | Behaviour | From wave | Role |
|---|---|---|---|
| Drone | Rushes tower, rams, dies on contact | 1 | Fodder |
| Raider | Approaches to mid range, fires blasters, ~10 % dodge chance per incoming shot | 3 | Basic shooter |
| Swarm | Groups of 8–12, tiny HP, zig-zag path | 6 | AoE check |
| Orbiter | Stops at long range, circles tower, sustained fire, never approaches | 10 | Range check |
| Shielder | Slow, own shield must break first, escorts others | 15 | Burst check |
| Boss | Big, orbits, spawns drones, phases | Every 10 | Milestone, drops fragments |

Mob AI is not "walk straight and hit". Mobs shoot at the tower, some dodge, some keep distance.

## Weapons

Tower has hardpoint slots. Start with 1, unlock up to 4 with scrap. A 5th hardpoint (12 000 scrap) opens at threat 30 (`SLOT_GATES`). With eight weapon types every loadout still leaves some out. Each slot holds one weapon with its own level. Weapons pick targets automatically by their own rule.

| Weapon | Behaviour | Target rule | Counters |
|---|---|---|---|
| Pulse cannon | Single target, fast. Starter, always unlocked | Nearest | Drones |
| Railgun | Slow, huge dmg, pierces in a line | Highest HP | Shielder, boss |
| Missile pod | Homing, splash | Densest cluster | Raider, swarm |
| Laser beam | Continuous, dmg ramps on same target | Farthest | Orbiter |
| Tesla arc | Chain lightning, short range | Nearest, chains | Swarm |
| Gravity well | Pulls mobs in, slows | Cluster | Utility |

Global tower upgrades bought with scrap: shield cap, shield regen, hull, targeting speed.

## Skill tree

Permanent, bought with core fragments.

| Branch | Examples |
|---|---|
| Offense | +% dmg, crit chance, unlock weapon types |
| Defense | shield cap, regen, hull, shield reflect |
| Economy | +% scrap, offline cap, starting scrap |
| Weapon mods | missiles split, laser bounces, tesla longer chain |

Tree unlocks what slots are allowed to hold.

## Prestige

- Trigger: hull 0 (forced) or manual button from wave 10.
- Fragments: `floor((bestWaveThisRun / 10) ^ 1.5)`, plus boss trickle mid-run.
- Keeps: tree, fragments, profile stats. Resets: scrap, slots, weapon levels, wave.
- Tower core colour/tier changes with prestige count.

## Pressure (replaces waves, decided 2026-09-01)

No discrete waves. Ships arrive continuously and pressure rises with time survived. Survival time is the score.

- Threat level = 1 + seconds / 40. Mob HP ×1.12 and scrap ×1.08 per level. Banner + scrap bonus on each new level.
- Spawn rate = 1.2/s + 0.012 per second survived, capped at 12/s. Spawns in bursts of 2–4 from one direction.
- Raider share grows 6 % per threat level, max 50 %. Later roster types gate on threat level the same way.
- Bosses: appear at fixed threat levels (every 5) instead of every 10 waves.
- Prestige fragments are based on best survival time instead of best wave.

Sim reference: a greedy buyer with three weapons is alive at 9:30, threat 15.

## Player control

Fully auto in v1. Player only buys. Active abilities (EMP, overcharge, shield burst) are a later tree-unlocked addition.

## Offline

"Offline" = any gap between ticks over 30 s. Covers hidden tab, sleep, closed browser, all treated the same.

- Scrap only, at 50 % of the average scrap/sec from the last 5 min of play.
- Cap 8 h, tree can extend.
- No wave progress.
- Popup on return shows earnings.

## Save

- localStorage, JSON, schema versioned (`v: 1`) for migrations.
- Autosave every 10 s and on tab hide.
- Export/import as base64 string.
- Hard reset with confirm.

## Look and feel

- Neon vector, dark parallax starfield, geometric ships with additive glow.
- Palette: tower cyan/white, player shots cyan/blue, enemies magenta/red, scrap gold, fragments violet.
- Juice: bloom (WebGL postFX), screen shake on boss hit/death, kill particles, shield ripple at impact point, floating damage numbers, wave banner.
- Camera fixed, tower centred, arena scales to window.
- No sound in v1.

## UI

- Canvas full window.
- Right panel, collapsible, tabs: Tower (slots, weapons) / Upgrades (shield, hull, regen) / Skills (appears after first fragment) / Settings (export, import, reset).
- Top bar: scrap, fragments, wave, kills.
- Shield ring and hull bar drawn on canvas around tower.

## Files

```
index.html        Phaser CDN, panel markup
style.css
src/main.js       Phaser config, boot
src/config.js     all balance numbers
src/scene.js      GameScene: loop, spawning, waves
src/tower.js      tower, shields, slots
src/weapons.js    weapon classes
src/mobs.js       mob classes and AI
src/ui.js         HTML panel binding
src/save.js       localStorage, offline calc, prestige
src/fx.js         particles, shake, floaters
docs/DESIGN.md    this file
```

## Build order

1. **Core.** Arena, tower, pulse cannon, drones + raiders, scrap, weapon levels, shield/hull, discrete waves, HUD. Playable.
2. **Roster and weapons.** All 6 mobs, all 6 weapons, slots, bosses, dodge/orbit AI, juice pass.
3. **Persistence.** Save, offline scrap, export/import.
4. **Prestige and tree.** Fragments, tree UI, unlock gating, tower tiers.
5. **Later.** Active abilities, sprites, sound.

Each phase is played before the next starts.

## Additions (2026-09-01, after first play)

- **Abilities** (`src/abilities.js`, config `ABILITIES`): EMP, Overcharge, Shield burst, Nova. Bought with scrap per run, hotkeys 1–4, cooldown bar at the bottom. Reset on prestige.
- **Elites** (config `ELITES`): 4–15 % of non-boss, non-swarm spawns get a modifier: Fast, Armoured, Splitter, Healer, Cloaked. Coloured ring, 3× scrap.
- **Sound** (`src/sfx.js`): procedural WebAudio, no assets. Toggle in Settings. Boss hum while an Overseer lives.
- **Save** (`src/save.js`): localStorage `core-defence-v1`, autosave 10 s + tab hide + unload. Offline scrap = 50 % of the 5 min scrap rate × gap, 8 h cap, popup on return. Export/import base64 in Settings. Hard reset wipes storage.
- **Weapon combos** (`src/combos.js`): six pairs, each a per-shot chance plus its own cooldown. Listed in the Tower tab with chance and readiness.
- **Targeting priorities**: each weapon has `prefer` types with a damage `bonus`; falls back to anything in range.
- **Swap**: a mounted weapon can be swapped for another type, keeping its level, paying the new mount cost.

## Phase 4 built (2026-09-01)

- **Prestige** (`PRESTIGE` in config): fragments = floor((threat / 4) ^ 1.5). Forced on hull 0 (the death overlay's Rebuild button is the prestige), manual from threat 10 via Settings or the Skills tab. Resets scrap, slots, weapon levels, tower upgrades, abilities. Keeps tree, fragments, prestige count.
- **Skill tree** (`src/tree.js`): 4 branches, 27 nodes, all bought with fragments. Offense (dmg, rate, crit, crit dmg, ability cooldowns), Defense (shield cap, regen, hull, hull regen, calm multiplier), Economy (scrap, starting scrap, offline rate and cap, boss fragments), Weapon mods (5 weapon unlocks, per-weapon perks, combo chance). Effects compile into `tree.mods`, read by weapons, tower, crit resolver, combos, abilities, save.
- **Weapon gating**: only pulse is free. Other weapons need their unlock node (1–2 fragments). First fragments come from the threat-5 Overseer or the first death.
- **Core tier visuals** (`CORE_TIERS`): core and glow colour step through cyan, teal, gold, orange, violet, magenta, white per prestige, plus orbiting motes.
- **Crits** (`CRIT`): 6 % ×2.2 base, per-weapon overrides, tree adds to both. Big gold "CRIT n!" callout.

- **Sample audio** (2026-09-02): Kenney Sci-fi Sounds (CC0) in `assets/sfx/kenney/`, loaded on first interaction. `sfx.js` plays samples with random variant, pitch and pan; synth fallback stays for anything not loaded plus laser hum, ambient, stings and abilities.

## Sieges (2026-09-02)

At threat 30, 60, 90… (`SIEGE.every`) regular spawning stops and threat freezes until the siege is cleared.

- **Dreadnought** (`MOBS.titan`): 50× Overseer HP, scaled by threat and +120 % per siege level. Rotating shield sector (120°, +30° per level) blocks hits from that side. Every 14 s charges 2.2 s (visible telegraph line), then fires a 2.5 s beam at the tower. Drone bays launch drones and swarm every 6 s. Enrages under 30 %. From level 2 it jams a random hardpoint for 5 s every 15 s.
- **Wardens** (`MOBS.warden`): 3, +2 per level. 6× Overseer HP, orbit and burst fire, each heals the Dreadnought 0.6 % per second while alive. Kill them first.
- Boss bar top centre with wardens count and beam state. Siege card in the effect tray.
- Clear: +5 fragments (+5 per level), threat jumps to the next level, normal spawning resumes.
- **Enemy damage scaling** added at the same time: `SPAWN.dmgGrowth` 1.06 per threat level (mob bullets, rams, siege beam). Before this the tower was unkillable past ~threat 25.
- **Shield regen under fire**: regen no longer pauses after a hit, it runs at 40 % (`TOWER.underFireRegen`) for the delay window, then full or calm rate.
- Dev server `serve.py` sends no-cache headers so module edits always reload.
- **Dreadnought extras**: Blink every 11 s (0.7 s flicker telegraph, implodes, reappears at a new angle, fires a 12-bullet fan, weapons must retarget). Mines every 9 s: 4 drifting spiked mines that detonate on the shield or after 14 s, can be shot. Damage growth softened to 1.045 per level, beam 60 dps base.

## Roster additions (2026-09-02)

Spawn table is generic: every `MOBS` entry with `chance` and `fromWave` joins the pool once threat reaches it. First sighting of a type shows a "New threat" banner and its description.

| Threat | Ship | Trick |
|---|---|---|
| 4 | Bomber | sprints inside 260 px, detonates on the shield for 30 base + blast ring |
| 6 | Leech | latches onto the shield ring, drains it (then hull) until shot |
| 7 | Phantom | phases out 1.6 s of every 3 s, immune while phased |
| 9 | Hydra | splits into 2 smaller hydras on death, two generations |
| 11 | Sniper | holds at 480 px, 1.2 s aim line, then a 28-damage 900 px/s shot |
| 13 | Carrier | holds at 380, launches 2 drones every 6 s |
| 15 | Jammer | locks a hardpoint, halves its fire rate while alive |
| 19 | Siphon | tethers to the core, drains shield and heals itself with it, blocks calm regen |
| 21 | Warp beacon | parks at 430, warps 2 basic ships in every 6 s |
| 24 | Behemoth | 520 HP hulk, half damage from non-crits, 90 ram damage |

`SPAWN.softCap` (220 live ships) pauses regular spawning so carriers and beacons cannot snowball.
- **Weapon swaps are rationed** (2026-09-02): 1 swap per run by default, "Refit bays" tree node adds up to 9 more (10 total). Swap resets the slot to level 1, costs the new weapon's mount price, and is done from an icon strip under each mounted weapon. Counter in the Hardpoints header.
- **Shock emitter** weapon: pulse knockback, push and cooldown scale with level.
- **Cooldown cards**: weapons with a cooldown of 1 s or more show a permanent proc-style card top left.

## Weapon backlog (ideas, not built)

- **Flak battery**: shells burst at a set distance into a shrapnel cone, strongest at the burst point. Anti mid-range. Level raises burst radius and shell count.
- **Cryo lance**: slow piercing beam, low damage, freezes 1.5 s. Frozen ships stop, take +50 % damage, shatter for bonus scrap. Level extends freeze and adds chain-freeze. Combo with Railgun: frozen targets shatter for area damage.
- **Mortar**: arcing shell to where a cluster will be, red landing marker, big crater, ignores the Dreadnought's shield sector. Level shortens flight and widens crater. Combo with Gravity well: double crater.
- **Salvage harpoon**: hooks one ship and reels it into the shield ring, damage per second, double scrap on death, no bosses. Level adds reel speed and a second and third hook. Combo with Shock emitter: hooked ships launched back out as projectiles.
- **Drone bay**: built 2026-09-02. Combo **Escort strike** (Missile pod + Drone bay, 18 %, 9 s cd): every live drone fires a mini-missile (60 % damage and splash) at its own target.

## Immersion pass (2026-09-02)

- **Threat-level choices** (`src/choices.js`): every third threat level (`SPAWN.choiceEvery`) two random modifier cards appear top centre and the game pauses until one is picked. The modifier lasts three levels and shows as a gold card in the effect tray. Examples: Salvage rush (+50 % scrap, ships 25 % faster), Glass cannon (+40 % damage, shield halved), Fragment lure (double fragments, ships 30 % tougher), Swarm storm, Bunker mode, Bounty board, Hive protocol, Overclock, Eclipse. Cards unlock by tier. Level mods are not saved; a reload starts the level clean.
- **Transmissions** (`src/transmissions.js`): typed-out Overseer lines at the top on run start, threat 5/10/20, boss arrival and death, siege start, enrage and end, shield break, low hull, drone loss, elite spawn, surge, choice, death, prestige. Rate-limited per event. Toggle in Settings.
- **Music** (`src/music.js`): procedural. Pad and bass pulse always, arpeggio from threat ~8, hats from ~14, chord stabs from ~19, brighter filter as threat rises, extra intensity in sieges. Under 30 % hull it drops to a heartbeat. Follows the volume slider. Toggle in Settings.

## More combos (2026-09-02)

| Combo | Pair | Chance | Effect |
|---|---|---|---|
| Collapse | Shock + Gravity | 30 % | shockwave through a well: everything inside is dragged to the centre and blasted for 6× shock damage, well ends |
| Scramble | Shock + Drones | 25 % | drones flung outward, double speed and fire rate for 3 s |
| Target paint | Laser + Drones | 12 % | drones all take the laser target, it takes +50 % damage from everything for 3 s (magenta bracket) |
| Bunker buster | Railgun + Missile | 18 % | a railgun hit launches three fast missiles at the same target |
| Kinetic lance | Railgun + Shock | 20 % | the railgun shot does +50 % and hurls every ship on its line backwards |
| Charged rounds | Pulse + Tesla | 8 % | for 3 s each pulse bolt arcs to the nearest other ship for 60 % |

Plus Escort strike (Missile + Drones) and the laser's intrinsic Ring sweep. Total: 13 pair combos.
- **Pulse cannon late-game** (2026-09-02): extra barrels at Lv 10/20/30 (2/3/4 bolts in a fan), bolts pierce one extra ship from Lv 15 and two from Lv 30, and a bolt that kills its target ricochets to the nearest ship within 220 px for 70 %. Panel shows barrels, pierce and the next milestone. Also fixed a bug where uncharged weapon bolts applied damage twice (introduced with Charged rounds).

## QA pass (2026-09-02)

Full review and refactor. Bugs fixed: Dreadnought shield sector now checks the attacker's direction (all damage sources), derived missiles (Barrage, Escort, Buster, Singularity) keep their intended multipliers on preferred targets, Jammer locks clear when out of range or the weapon is swapped and the laser honours the slow, level choices and modifiers are saved (an open choice reappears on reload), prestige from the death screen no longer saves `gameOver`, resetRun clears combo cooldowns / tray cards / slow-mo, restored hydras keep their generation, stats count only damage that landed (armour, phase and blocked hits excluded), leech eases instead of snapping when the shield breaks, overload survives a target change, tooltips hide when their element is replaced, pierce off-by-one, cloaked elites of alpha-animating ships, music pause state, background ticker double-step, duplicated HTML ids, missing `--green` CSS var, gravity well cluster targeting (was reading a missing field and always picking the first ship).

Structure: `src/utils.js` helpers; `scene.js` 772 → 309 lines with `src/scene/*`; `mobs.js` 850 → 9-line shim with `src/mobs/*` and shared `approachAndOrbit` / `fireAt` / `fireBurst` / `tickCooldown` / `spawnChild` / `tierDrain` helpers; `ui.js` 628 → 165 with `src/ui/*`, tab HTML built only for the active tab and skipped when the panel is hidden, per-frame DOM queries cached; `weapons.js` split per weapon with `TUNING` blocks; `config.js` split by domain; `sfx.js` split into engine and a recipe table; CSS sectioned with keyframes at the end.

Also: tesla range 240 → 420 and chain range 140 → 180; start screen lets the player pick the slot-1 weapon from unlocked types.

## Level caps

Two caps, both in `LEVELS` in `src/config/meta.js`.

- **Soft cap.** Weapons grow at their full `dmgMul`/`rateMul` per level up to Lv 25, then ×1.06 damage and ×1.01 rate per level after. Tower upgrades add their full `add` per level up to Lv 20, then half of it. Cost growth is unchanged, so late levels are deliberately poor value.
- **Hard cap.** Weapon levels and tower upgrade levels stop at 20 + 5 per prestige. Rows show "Max" and a "Level cap N · +5 per prestige" note; purchases, auto-buy and the quick-buy cards skip capped items. Levels already above the cap in an old save are kept, they just cannot be bought further.

Tesla range 420 → 520, chain range 180 → 220.

## Laser rework (forks by level)

Forks were gated on a full 3 s ramp on one target, which the farthest-first targeting rarely held, so they almost never showed. Now: the ramp carries 60 % over a target switch (`keepRamp`), forks start at half ramp, the fork count comes from level (`forksAt: [1, 8, 16, 24]`, fork damage 35 % → 50 %), and from Lv 5 the beam's crit ticks burst in an 80 px area (`burstAt`, `burstRadius`). Ring sweep is unchanged and still needs full ramp. The tower row lists forks and the next milestone.

## Threat-level choices, second pass

The pool now fits the loadout: weapon cards carry `needs` (offered only while that weapon is mounted), ability cards `needsAbility`. Numbers went up on both sides. New cards:

- **Hunts**, one per ship type (`hunt_<type>`, generated from `MOBS`): only that ship spawns, ×4 scrap, ×1.8 HP, and ×2.5 numbers for light ships (≤ 35 HP). Unlocks one level after the ship joins the roster. Never two hunts in one offer.
- **Per weapon**: Rapid cycling (pulse), Sabot surplus (railgun), Warhead surplus (missile), Focus lens (laser), Storm front (tesla), Deep wells (gravity), Overcharged coils (shock), Hive protocol (drones).
- **Global gambles**: Blood money, Fragment fever, Elite parade (every ship elite), All in, Reactor surge.

`levelMods` grew: `w[type].dmg/rate`, `typeScrap`, `teslaChains`, `laserRamp`, `missileSplash`, `gravityPull`, `allElite`. Old saves with a removed card id (Swarm storm) load with no modifier.

## Difficulty

Picked on the start screen (`DIFFICULTY` in `src/config/meta.js`), locked once the run starts, saved with the run and kept for the next run. Easy ×0.7 HP / ×0.7 damage / ×0.8 spawns; Normal ×1; Hard ×1.5 / ×1.4 / ×1.3; Really hard ×2.2 / ×1.9 / ×1.6; Insane ×3.5 / ×2.8 / ×4 (spawns doubled after play, scrap cut to ×0.7). Harder runs pay more fragments and, up to Really hard, more scrap: ×0.9 … ×1.3 and fragments ×0.75 … ×2. HP and damage scale every ship including bosses and drains; the spawn multiplier applies after the rate cap so it still matters late. Shown in the Stats tab and on the death card.

## Bosses, second pass

- **Overseer** still every 5th level. **Warlord** (`MOBS.warlord`) every 10th level, except 30 and 60 where the siege takes over. **Dreadnought sieges** at 30 and 60 unchanged in structure but harder.
- **Adaptive armour** (shared by Warlord and Dreadnought, `armour*` helpers in `src/mobs/bosses.js`):
  - HP is raised to the player's sustained DPS over the last 20 s (`scene.recentDps()`) × `dpsSeconds` (12 s Warlord, 40 s Dreadnought), so the boss scales with the loadout instead of only with threat.
  - Damage cap: at most `hpMax / minKillSec` per second (12 s Warlord, 30 s Dreadnought); surplus shows as "absorbed". A siege therefore lasts at least 30 s even for an overbuilt tower.
  - Adapt: every `adaptEvery` seconds the boss becomes immune for `adaptDur` seconds to the weapon type that has dealt it the most damage since the last adapt (ring in that weapon's colour, banner, "immune" floaters, boss bar shows the timer). Single-weapon builds stall; mixed builds keep going.
- **Warlord extras**: five-shot bursts at mid range, flak burst every 7 s that hurts player drones within 220 px, escort spawns, and relay pylons at 66 % and 33 % HP: three pylons orbit the boss and it is invulnerable until they are destroyed (tests reach and area damage). Pays 3 fragments (+Core harvester) and 4× Overseer scrap. Not saved: a reload mid-fight drops it.
- Boss bar now also shows the Warlord with its status line.

Warlord tuned down after play: base HP 6× → 4× Overseer, dps-scaled floor 22 s → 12 s, kill floor 18 s → 12 s, immunity 6 s → 4 s.

## Three new weapons

- **Chrono field** (`chrono`, unlock 3 frag, install 900): bubble around the tower. Ships inside move at ×0.6 (→ ×0.25 with levels), enemy shots inside crawl, your bullets gain +60 % damage per second spent inside (max 2 s). Small time-shear dps on everything inside. Lv 10: rewind, every 20 s ships inside jump back to where they were 3 s earlier. Combos: **Stasis lock** (+shock: freeze everything inside 2 s), **Temporal bloom** (+laser: crit tick echoes ×3 inside the field).
- **Replicator swarm** (`nanite`, unlock 3, install 750): bolts infect a ship (dps over 8 s). On death the nanites jump to the nearest 1 ship (2 at Lv 8, 3 at Lv 16), +35 % per generation. Lv 12 outbreak: dying hosts burst. Targets healthy ships in the densest pack. Combos: **Plague wind** (+shock: spread to every ship within 140 px of a host), **Culture well** (+gravity: a shot seeds every ship in a well).
- **Singularity core** (`singularity`, unlock 4, install 1200): charges from scrap earned (`scene.onKill` calls `onScrap`) plus a trickle; at full charge it removes 25 % (→ 80 %) of max HP from every ship in range (bosses capped at 8 %) and erases enemy shots. Lv 8 afterglow: 5 s where every hit crits (`scene.afterglow`). Combos: **Event horizon** (+gravity: tower-sized well for 4 s), **Supernova** (+tesla: arcs to every ship for 3× tesla damage).

Hooks added: `bullet.onHit`, `bullet.chronoT` (damage multiplier in `bulletHit`), `enemyBullet.chrono` (speed factor), `Weapon.onScrap`, `scene.afterglow`.

## Threat-level choices, auto mode

The two cards are still rolled but one is picked at random and applied immediately. The game no longer pauses; the picked card shows top centre for 4.5 s. The HUD top bar shows the run's difficulty ("Mode").

Insane rebalanced to be insane: HP ×5, damage ×4, spawns ×4, alive-ship cap ×2 (440), ship speed ×1.25, elite chance ×3, scrap ×0.6, fragments ×2.5. The other levels got small cap/speed/elite multipliers too (`DIFFICULTY.cap/speed/elite`).

Singularity blast no longer flashes the screen: a dark disc collapses inward, then a thin ring rolls out. Settings got a "Screen flashes" toggle (`settings.flash`) that disables every full-screen flash (combo procs, siege start, Dreadnought death) for photosensitive players.

Singularity nerfed after play: blast 25 % → 18 % (max 80 % → 55 %), bosses 8 % → 6 %, range 420 → 400, trickle halved, afterglow 5 s → 4 s, and the charge cost now scales with threat (`scrapGrowth^(tier-1)`) and with every flat scrap multiplier (difficulty, Salvage drones, the active level choice), so a blast always costs roughly the same number of kills instead of firing every few seconds late in a run. Per-type scrap bonuses (swarm, elite, hunted type) are deliberately left out, so those still charge it faster.

## Performance knobs (`src/perf.js`)

Profiling with 500 ships showed game logic at under 1 ms per frame; the load is rendering.

An earlier version also overrode `Graphics.strokeCircle` to cut its segment count. That was wrong: Phaser's 7th `arc` argument is `overshoot`, not a segment step, and its WebGL renderer uses a fixed 100 segments per circle whatever the radius. The override only added overdraw, and it is gone.

Changes:

- **Bloom** dropped from 4 to 2 blur steps at full quality, off at reduced and minimal.
- **Effects levels** (Settings → Effects): Full, Reduced (no bloom, no plain damage numbers, glows only on ships larger than r 12, trails every other frame, half the sparks), Minimal (no bloom, numbers, trails, sparks, flashes or ship glows). **Auto** (default) starts at Full, drops a level after 3 s under 45 fps (straight to Minimal under 30), climbs back after 15 s above 58, but never back into a level it has already dropped out of twice (so a machine sitting on the thresholds does not oscillate). Saved in `settings.perf`.
- Hooks: `scene.perf.numbers / flashes / trailOk() / sparkCount(n) / glowFor(r)`; `Mob` glows are created with the current visibility and `apply()` re-toggles existing ones.

Chrono field nerfed after play (it held threat 7 alone): shear dps 6 → 2, growth ×1.14 → ×1.10, slow ×0.6 → ×0.65 (floor ×0.25 → ×0.35), radius +6 → +5 per level, bullet boost +60 % → +50 % per second.

## Fragments made scarce

Prestige payout `floor((threat / 8) ^ 1.4)` (was `/ 4 ^ 1.5`): threat 20 → 3, 40 → 9, 60 → 16 (was 11 / 31 / 58). Overseer pays 0 base fragments (Core harvester still adds +1..3), Warlord 3 → 2, siege 5 + 5/level → 3 + 3/level. Difficulty fragment multipliers 0.5 / 1 / 1.2 / 1.4 / 1.75. Fragment lure ×2 → ×1.5, Fragment fever ×3 → ×2.

## Harder curve

Ship HP: flat ×1.3 (`SPAWN.hpBase`) and growth ×1.12 → ×1.15 per threat (threat 20 ≈ ×2.2 tougher, threat 40 ≈ ×3.7). Upgrade prices: every weapon's base cost ×1.5 and cost growth +0.10 per level (1.32 → 1.42); tower upgrades base 25/40/60 → 40/60/90 and growth 1.28/1.32/1.35 → 1.38/1.42/1.45.

The idle ambient drone (55 Hz sawtooth pad plus wind noise, started on first interaction) was removed; only the music, the laser hum and the boss hum remain as continuous sounds.

## Tower redesign (`src/tower/draw.js`)

- **Shield** is 24 arc segments on the shield radius. Lit segments = capacity; the next segment fills like a progress bar while regenerating and motes chase around an inner track (8 when calm, 4 under fire, speed follows regen). Broken shield = red dashed ring. A hit flares white on the impact side (`tower.hitAngle`).
- **Hull** is six armour plates between the body and the hardpoints, filling in order with hull fraction, green → orange → red, red pulse ring under 25 %.
- **Body**: hexagon with an inner hex, vents at the corners and a ticking inner ring.
- **Hardpoints** sit on the plate ring: a mount pad, a turret ring in the weapon colour, and a per-type turret drawn in the mount's local frame (twin barrels, rail with side rails and brake, four-tube launcher, laser lens, tesla prongs, gravity ring, shock dish, hangar pad, chrono disc, nanite spines, singularity cradle). Barrel recoil for 0.12 s after a shot. Jammed = red X.
- **Core**: prestige-coloured with a slow three-arc reticle and one orbiting mote per prestige.

## Combos, second wave (`src/combos/procs.js`)

Twenty more pair combos so every pair of the original eight weapons has one, plus six for the new three. Weapons call a hook on their event (`onPulseShot`, `onRailShot`, `onMissileLaunch`, `onMissileImpact`, `onTeslaShot`/`onTeslaChain`, `onShockPulse`, `onLaserTick`, `onWellLand`, `onChronoTick`, `onNaniteShot`, `onSingularityBlast`); the hook rolls the combos for whatever else is mounted. Sabot volley, Orbital rounds, Flak burst, Gun run, Slingshot, Spotter, Ion warheads, Guided burn, Concussion, Conductor, Lensing, Flashpoint, Relay net, Orbit strike, Time dilation, Static field, Carrier strain, Spore warheads, Accretion, Collapsar rounds. Total 39 pair combos. Descriptions in `COMBOS`.

Combo procs no longer draw the expanding ring, screen tint, shake or slow-mo (it read as a second shockwave next to the Shock emitter). A proc now shows as the tray card on the left plus a small flash on the two hardpoints involved.

**Blinker** (`MOBS.blinker`, threat 6+): 20 hp, drifts slowly, every 1 s it charges for 0.25 s (flicker, shrinking ring), teleports to a random point 200–320 px from the core, drops every weapon's lock on it and fires a two-shot burst at the core. Counters: area damage, drones, chrono (slows its drift but not the jump), anything that retargets fast.

Top bar: "DPS out" and "DPS in" next to the volume control, both 2 s rolling averages (the Stats tab and boss scaling use 20 s) (`scene.recentDps()`, `scene.recentTaken()`, per-second buckets). The Stats tab also lists damage to the core by ship type (`stats.takenBy`, every hit on the core carries its source ship type).

## Beam drones, Missile drones, Ion storm

- **Beam drones** (`beamdrones`): the drone bay with continuous short lasers (`fireFrom` override). The beam forks to nearby ships at Lv 6 / 10 / 14 / 18 (five targets), forks at 60 %. Combos: **Prism** (+laser), **Arc lattice** (+tesla), **Painted targets** (+drone bay), **Laser guided** (+missile drones).
- **Missile drones** (`missiledrones`): the drone bay with homing mini-missiles with splash; salvo of 2 at Lv 8, 3 at Lv 16. Combos: **Cluster drop** (+shock), **Well seekers** (+gravity), **Escort volley** (+drone bay), **Laser guided** (+beam drones).
- **Ion storm** (`ionstorm`): one cloud (two from Lv 12) drifting after the densest pack inside range, never closer than 180 px to the core. Each tick arcs into up to 4 ships inside; enemy shots inside are eaten. Combos: **Thunderhead** (+tesla), **Downburst** (+gravity).
- Any weapon with a `drones` array counts as a bay for saves, drone aggro, flak, absorb, the tray card and the focus toggle (`isBay`). `DroneBay.fireFrom(d, dt, rm, mobs)` is the per-drone weapon hook the two variants override.

**Kamikaze drones** (`kamikaze`, unlock 3, install 700): bigger (r 11), slower (170 px/s) drones with no gun. They fly straight into their target and detonate (90 px blast, +3 per level, 60 damage ×1.15 per level), then the bay rebuilds them in 5 s. Every blast counts as a proc (tray card + intrinsic combo entry). Combos: **Wingmen** (+drone bay), **Target lock** (+beam drones), **Chain detonation** (+missile drones), **Spore bomb** (+nanite).
