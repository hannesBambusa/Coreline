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

Tower has hardpoint slots. Start with 1, unlock up to 4 with scrap. Four of six weapons means every loadout leaves something out. Each slot holds one weapon with its own level. Weapons pick targets automatically by their own rule.

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
