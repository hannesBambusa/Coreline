// Threat-level choices: every SPAWN.choiceEvery levels the player picks one of two modifiers that last until the
// next offer. Each card is a trade or a gamble. Cards can require a mounted weapon type (`needs`) or an unlocked
// ability (`needsAbility`) so the offer always fits the current loadout.
import { MOBS, WEAPONS } from './config.js';

const LIGHT_HP = 35;              // hunts of ships at or under this HP also multiply spawn numbers
const HUNT = { scrap: 4, hp: 1.8, lightSpawn: 2.5 };
const NO_HUNT = new Set(['boss', 'titan', 'mine', 'warden', 'warlord', 'pylon']);

export const CHOICES = {
  // ---- economy ----
  scrapFast:   { name: 'Salvage rush',     good: '+80% scrap',                    bad: 'ships 35% faster',                 fromTier: 1 },
  scrapCalm:   { name: 'Quiet sector',     good: '-40% spawn rate',               bad: '-50% scrap',                       fromTier: 1 },
  bloodMoney:  { name: 'Blood money',      good: '+150% scrap',                   bad: 'ships 60% tougher, +40% spawns',   fromTier: 4 },
  fragRun:     { name: 'Fragment lure',    good: '+50% fragments',                bad: 'ships 50% tougher',                fromTier: 4 },
  fragFever:   { name: 'Fragment fever',   good: 'double fragments',              bad: 'spawn rate ×2, ships 30% faster',  fromTier: 10 },
  bounty:      { name: 'Bounty board',     good: 'elites drop 6× scrap',          bad: 'elite chance ×4',                  fromTier: 5 },
  swarmStorm:  { name: 'Swarm storm',      good: 'swarm drops ×5 scrap',          bad: '200+ swarm arrive now, then swarm only, ×5 spawn rate', fromTier: 4 },
  parade:      { name: 'Elite parade',     good: 'elites drop 3× scrap',          bad: 'every ship is an elite',           fromTier: 8 },
  // ---- offense and defense ----
  critHigh:    { name: 'Overtuned optics', good: '+25% crit chance',              bad: 'no shield regen',                  fromTier: 2 },
  glass:       { name: 'Glass cannon',     good: '+60% weapon damage',            bad: 'shield capacity -60%',             fromTier: 2 },
  allIn:       { name: 'All in',           good: '+100% damage, +50% scrap',      bad: 'shield 25%, no regen',             fromTier: 6 },
  fortress:    { name: 'Bunker mode',      good: 'shield regen ×3',               bad: '-30% weapon damage',               fromTier: 2 },
  overclock:   { name: 'Overclock',        good: '+50% fire rate',                bad: 'abilities on 2× cooldown',         fromTier: 3, needsAbility: true },
  reactor:     { name: 'Reactor surge',    good: 'ability cooldowns halved, +30% fire rate', bad: 'shield capacity -40%', fromTier: 5, needsAbility: true },
  eclipse:     { name: 'Eclipse',          good: 'phantoms never phase',          bad: 'snipers fire twice as often',      fromTier: 11 },
  // ---- per weapon (only offered while that weapon is mounted) ----
  hive:        { name: 'Hive protocol',    good: 'drones +80% damage',            bad: 'other weapons -25%',               fromTier: 3, needs: 'drones' },
  rapid:       { name: 'Rapid cycling',    good: 'pulse cannon +80% fire rate',   bad: 'ships 30% faster',                 fromTier: 1, needs: 'pulse' },
  sabots:      { name: 'Sabot surplus',    good: 'railgun +100% damage',          bad: 'elite chance ×3',                  fromTier: 2, needs: 'railgun' },
  warheads:    { name: 'Warhead surplus',  good: 'missiles +40% damage, +50% splash', bad: 'ships 40% tougher',            fromTier: 2, needs: 'missile' },
  lens:        { name: 'Focus lens',       good: 'laser +50% damage, ramps 2× faster', bad: 'shield capacity halved',      fromTier: 2, needs: 'laser' },
  storm:       { name: 'Storm front',      good: 'tesla +3 chains, +30% damage',  bad: 'no shield regen',                  fromTier: 2, needs: 'tesla' },
  wells:       { name: 'Deep wells',       good: 'wells pull 2×, gravity +60% damage', bad: '+50% spawns',                 fromTier: 3, needs: 'gravity' },
  coils:       { name: 'Overcharged coils', good: 'shock emitter +120% damage',   bad: 'ships 25% faster',                 fromTier: 3, needs: 'shock' },
  nothing:     { name: 'Hold steady',      good: 'no change',                     bad: '',                                 fromTier: 1 },
};

// ---- hunts: one ship type only, big scrap, tougher (and more of them when they are light) ----
for (const [type, d] of Object.entries(MOBS)) {
  if (NO_HUNT.has(type) || d.noSolo || !d.fromWave || d.fromWave >= 999) continue;
  const light = d.hp <= LIGHT_HP;
  CHOICES['hunt_' + type] = {
    name: `${d.name} hunt`, hunt: type, fromTier: Math.max(1, d.fromWave + 1),
    good: `only ${d.name.toLowerCase()}s, ×${HUNT.scrap} scrap`,
    bad: `×${HUNT.hp} HP${light ? `, ×${HUNT.lightSpawn} numbers` : ''}`,
  };
}

// how each choice changes the level. m = mods object for the level.
export function applyChoice(id, m) {
  const c = CHOICES[id];
  if (c && c.hunt) {
    m.force = c.hunt; m.typeScrap[c.hunt] = HUNT.scrap; m.mobHp *= HUNT.hp;
    if (MOBS[c.hunt].hp <= LIGHT_HP) m.spawn *= HUNT.lightSpawn;
    return m;
  }
  switch (id) {
    case 'scrapFast':  m.scrap *= 1.8; m.mobSpeed *= 1.35; break;
    case 'scrapCalm':  m.spawn *= 0.6; m.scrap *= 0.5; break;
    case 'bloodMoney': m.scrap *= 2.5; m.mobHp *= 1.6; m.spawn *= 1.4; break;
    case 'fragRun':    m.fragments *= 1.5; m.mobHp *= 1.5; break;
    case 'fragFever':  m.fragments *= 2; m.spawn *= 2; m.mobSpeed *= 1.3; break;
    case 'bounty':     m.eliteScrap *= 6; m.elite *= 4; break;
    case 'parade':     m.eliteScrap *= 3; m.allElite = true; break;
    case 'swarmStorm': m.swarmScrap *= 5; m.force = 'swarm'; m.spawn *= 5; m.cap *= 2.5; break;
    case 'critHigh':   m.crit += 0.25; m.shieldRegen = 0; break;
    case 'glass':      m.dmg *= 1.6; m.shieldMax *= 0.4; break;
    case 'allIn':      m.dmg *= 2; m.scrap *= 1.5; m.shieldMax *= 0.25; m.shieldRegen = 0; break;
    case 'fortress':   m.shieldRegen *= 3; m.dmg *= 0.7; break;
    case 'overclock':  m.rate *= 1.5; m.abilityCd *= 2; break;
    case 'reactor':    m.abilityCd *= 0.5; m.rate *= 1.3; m.shieldMax *= 0.6; break;
    case 'eclipse':    m.noPhase = true; m.sniperRate *= 2; break;
    case 'hive':       m.droneDmg *= 1.8; m.otherDmg *= 0.75; break;
    case 'rapid':      m.w.pulse.rate *= 1.8; m.mobSpeed *= 1.3; break;
    case 'sabots':     m.w.railgun.dmg *= 2; m.elite *= 3; break;
    case 'warheads':   m.w.missile.dmg *= 1.4; m.missileSplash *= 1.5; m.mobHp *= 1.4; break;
    case 'lens':       m.w.laser.dmg *= 1.5; m.laserRamp *= 0.5; m.shieldMax *= 0.5; break;
    case 'storm':      m.teslaChains += 3; m.w.tesla.dmg *= 1.3; m.shieldRegen = 0; break;
    case 'wells':      m.gravityPull *= 2; m.w.gravity.dmg *= 1.6; m.spawn *= 1.5; break;
    case 'coils':      m.w.shock.dmg *= 2.2; m.mobSpeed *= 1.25; break;
  }
  return m;
}

export function baseLevelMods() {
  const w = {};
  for (const k of Object.keys(WEAPONS)) w[k] = { dmg: 1, rate: 1 };
  return { scrap: 1, swarmScrap: 1, eliteScrap: 1, typeScrap: {}, spawn: 1, mobSpeed: 1, mobHp: 1, crit: 0, shieldRegen: 1, shieldMax: 1,
    fragments: 1, dmg: 1, droneDmg: 1, otherDmg: 1, rate: 1, abilityCd: 1, elite: 1, allElite: false, force: null, noPhase: false, sniperRate: 1,
    w, teslaChains: 0, laserRamp: 1, missileSplash: 1, gravityPull: 1, cap: 1 };
}

/** Cards that fit the tier and the current loadout. */
export function choicePool(scene, tier) {
  const mounted = new Set(scene.tower.weapons.map(w => w.type));
  const hasAbility = Object.values(scene.abilities.state).some(a => a.unlocked);
  return Object.keys(CHOICES).filter(k => {
    const c = CHOICES[k];
    if (k === 'nothing' || c.fromTier > tier) return false;
    if (c.needs && !mounted.has(c.needs)) return false;
    if (c.needsAbility && !hasAbility) return false;
    return true;
  });
}

// two options that fit, always different, never two hunts at once
export function rollChoices(scene, tier) {
  const pool = choicePool(scene, tier);
  const rnd = (list) => list[Math.floor(Math.random() * list.length)];
  const a = rnd(pool);
  const rest = pool.filter(k => k !== a && !(CHOICES[a].hunt && CHOICES[k].hunt));
  return [a, rest.length ? rnd(rest) : 'nothing'];
}
