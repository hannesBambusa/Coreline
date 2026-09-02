// Continuous spawning: threat tier, surge levels, mob type rolls, and the level-start events.
import { SPAWN, MOBS, ELITES, SLOT_GATES, SIEGE } from '../config.js';
import { createMob } from '../mobs.js';
import { baseLevelMods } from '../choices.js';
import { TAU, pick, rnd } from '../utils.js';
import { ICONS_SURGE } from './icons.js';

const SPAWN_RADIUS_JITTER = 80;        // mobs spawn up to this far beyond the spawn ring
const BURST_SPREAD = 0.6;              // radians of angular scatter within a spawn burst
const SWARM_SPREAD = 0.4;              // tighter scatter for swarm groups
const NEVER_SURGE = ['boss', 'titan', 'warden', 'mine', 'warlord', 'pylon'];
const LEVEL_SCRAP_BASE = 20;           // scrap bonus at level start = base * scrapGrowth^tier

/** Fractional threat tier: 1 + minutes-ish of run time. */
export function tierOf(scene) { return 1 + scene.state.time / SPAWN.tierSeconds; }

/** Surge levels spawn more of a single type; how many more depends on how tough that type is. */
export function surgeMultiplier(scene) {
  if (!scene.surgeType) return 1;
  const hp = MOBS[scene.surgeType].hp;
  return hp <= SPAWN.surgeLightHp ? SPAWN.surgeMul.light : hp <= SPAWN.surgeMediumHp ? SPAWN.surgeMul.medium : SPAWN.surgeMul.heavy;
}

export function spawnRate(scene) {
  const base = SPAWN.baseRate + SPAWN.ratePerSecond * scene.state.time;
  // difficulty multiplies after the cap so it still bites late in a run
  return Math.min(SPAWN.maxRate * 2, base * surgeMultiplier(scene) * scene.levelMods.spawn) * scene.diff.spawn;
}

/** Pick a surge type among everything unlocked by this tier, excluding bosses and static hazards. */
export function pickSurge(scene, tierInt) {
  const pool = Object.keys(MOBS).filter(t => MOBS[t].fromWave <= tierInt && !NEVER_SURGE.includes(t));
  return pick(pool) || 'drone';
}

/** Roll the type of the next spawn: forced by a choice card, forced by a surge, else weighted by MOBS chances. */
export function pickType(scene) {
  if (scene.levelMods.force) return scene.levelMods.force;
  if (scene.surgeType) return scene.surgeType;
  const tier = scene.tier, roll = Math.random();
  let acc = 0;
  for (const t in MOBS) {
    const d = MOBS[t];
    if (!d.chance || d.fromWave > tier) continue;
    acc += d.chance;
    if (roll < acc) return t;
  }
  // whatever chance is left goes to raiders (growing with tier) and then drones
  const raiderFrac = Math.min(SPAWN.raiderMax, Math.max(0, (tier - 1.5) * SPAWN.raiderPerTier));
  return MOBS.raider.fromWave <= tier && roll < acc + raiderFrac ? 'raider' : 'drone';
}

/** Elite roll for a natural spawn. Bosses and swarm never go elite. */
function maybeMakeElite(scene, m, type) {
  if (type === 'boss' || type === 'swarm' || type === 'warlord' || type === 'pylon') return;
  const chance = scene.levelMods.allElite ? 1 : Math.min(ELITES.chanceMax * 3, (ELITES.chanceBase + ELITES.chancePerTier * scene.tier) * scene.levelMods.elite * scene.diff.elite);
  if (Math.random() < chance) {
    m.makeElite(pick(Object.keys(ELITES.mods)));
    scene.tx.say('elite', 90);
  }
}

/** First time a type shows up in this session: banner plus a floating description over the ship. */
function announceNewThreat(scene, m, type) {
  if (scene.seen[type] || !MOBS[type].desc) return;
  scene.seen[type] = true;
  scene.ui.banner('New threat: ' + MOBS[type].name, true);
  scene.fx.floater(m.x, m.y - m.r - 20, MOBS[type].desc, '#ff9f43', 12);
}

/**
 * Spawn one mob on the ring around the tower.
 * tierOverride is set when restoring from a save: those spawns skip level mods, elite rolls, sounds and banners.
 */
export function spawnMob(scene, type, angle, tierOverride, gen) {
  const a = angle ?? Math.random() * TAU, R = scene.spawnRadius() + Math.random() * SPAWN_RADIUS_JITTER;
  const tier = tierOverride ?? scene.tier;
  const m = createMob(scene, type, tier, scene.tower.x + Math.cos(a) * R, scene.tower.y + Math.sin(a) * R, gen);
  m.tierAtSpawn = tier;
  const natural = tierOverride === undefined;
  if (natural && scene.levelMods.mobHp !== 1) { m.hpMax *= scene.levelMods.mobHp; m.hp = m.hpMax; }
  if (natural) maybeMakeElite(scene, m, type);
  if ((type === 'boss' || type === 'warlord') && natural) scene.sfx.play('boss');
  if (natural) announceNewThreat(scene, m, type);
  scene.mobs.push(m);
  return m;
}

/** Start-of-level surge handling: pick (or clear) the surge type and show or remove its effect chip. */
function startSurge(scene, tierInt) {
  scene.surgeType = tierInt % SPAWN.surgeEvery === 0 ? pickSurge(scene, tierInt) : null;
  if (scene.surgeType) scene.tx.say('surge');
  if (!scene.surgeType) { scene.ui.removeEffect('surge'); return; }
  const d = MOBS[scene.surgeType];
  scene.time.delayedCall(1200, () => {
    if (scene.gameOver) return;
    scene.ui.banner(`${d.name} surge`, true);
    scene.fx.floater(scene.tower.x, scene.tower.y - 120, `Only ${d.name.toLowerCase()}s this level`, '#ff9f43', 14);
  });
  const mul = surgeMultiplier(scene);
  const sub = 'only ' + d.name.toLowerCase() + 's' + (mul > 1 ? ' · ×' + mul.toFixed(1) + ' numbers' : '');
  scene.ui.addEffect('surge', { name: d.name + ' surge', color: d.color, dur: SPAWN.tierSeconds, sub, icon: ICONS_SURGE });
}

/** Everything that happens the moment the integer threat level ticks over. Order matters for banners. */
function onNewTier(scene, tierInt) {
  scene.state.tier = tierInt;
  scene.sfx.play('tier');
  if (SLOT_GATES[scene.tower.slots.length] === tierInt) {
    scene.ui.banner('Hardpoint ' + (scene.tower.slots.length + 1) + ' unsealed', false);
    scene.fx.floater(scene.tower.x, scene.tower.y - 120, 'A fifth hardpoint can be unlocked', '#4ff2ff', 14);
  }
  if (tierInt % SPAWN.choiceEvery === 0) {
    scene.levelMods = baseLevelMods(); scene.levelChoice = null; scene.ui.removeEffect('choice');
    scene.offerChoice(tierInt);
  }
  if (tierInt === 5) scene.tx.say('tier5'); else if (tierInt === 10) scene.tx.say('tier10'); else if (tierInt === 20) scene.tx.say('tier20');
  startSurge(scene, tierInt);
  const siegeTier = tierInt % SIEGE.every === 0;
  if (!siegeTier && tierInt % MOBS.warlord.every === 0) {
    scene.ui.banner('Warlord approaching', true);
    scene.tx.say('warlord');
    scene.time.delayedCall(1500, () => { if (!scene.gameOver) scene.spawnMob('warlord'); });
  } else if (!siegeTier && tierInt % MOBS.boss.every === 0) {
    scene.ui.banner('Overseer approaching', true);
    scene.tx.say('boss');
    scene.time.delayedCall(1500, () => { if (!scene.gameOver) scene.spawnMob('boss'); });
  } else scene.ui.banner(`Threat level ${tierInt}`);
  const bonus = Math.round(LEVEL_SCRAP_BASE * Math.pow(SPAWN.scrapGrowth, tierInt));
  scene.state.scrap += bonus;
  scene.fx.floater(scene.tower.x, scene.tower.y - 70, `+${bonus}`, '#ffd166', 16);
}

/** One spawn burst: n ships scattered around a shared angle; swarm types come as a group each. */
function spawnBurst(scene) {
  const n = Phaser.Math.Between(SPAWN.burst[0], SPAWN.burst[1]);
  const a = Math.random() * TAU;
  for (let i = 0; i < n; i++) {
    const type = pickType(scene);
    if (type === 'swarm') {
      const k = Phaser.Math.Between(MOBS.swarm.group[0], MOBS.swarm.group[1]);
      for (let j = 0; j < k; j++) scene.spawnMob('swarm', a + rnd(-0.5, 0.5) * SWARM_SPREAD);
    } else scene.spawnMob(type, a + rnd(-0.5, 0.5) * BURST_SPREAD);
  }
  scene.spawnTimer = n / spawnRate(scene);
}

export function updateSpawning(scene, dt) {
  if (scene.siege) { scene.updateSiege(dt); return; }
  // reaching a siege threat: freeze time and start it
  const nextT = scene.nextSiegeTier() - 1;   // tier = 1 + time/tierSeconds, so tier 30 is time >= 29*tierSeconds
  if (scene.state.time + dt >= nextT * SPAWN.tierSeconds) {
    scene.state.time = nextT * SPAWN.tierSeconds;
    scene.state.tier = Math.floor(scene.tier);
    scene.startSiege(scene.siegesCleared + 1);
    return;
  }
  scene.state.time += dt;
  scene.state.bestTime = Math.max(scene.state.bestTime, scene.state.time);
  const tierInt = Math.floor(scene.tier);
  if (tierInt !== scene.state.tier) onNewTier(scene, tierInt);
  scene.spawnTimer -= dt;
  if (scene.spawnTimer <= 0 && scene.mobs.length < SPAWN.softCap * scene.diff.cap * (scene.levelMods.cap || 1)) spawnBurst(scene);
}
