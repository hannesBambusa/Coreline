// Threat-level choices: at each new threat level the player picks one of two modifiers
// for that level. Modifiers apply until the next level starts. Some are trades, some are gambles.
export const CHOICES = {
  scrapFast:   { name: 'Salvage rush',     good: '+50% scrap',            bad: 'ships 25% faster',       fromTier: 1 },
  scrapCalm:   { name: 'Quiet sector',     good: '-30% spawn rate',       bad: '-40% scrap',             fromTier: 1 },
  critHigh:    { name: 'Overtuned optics', good: '+15% crit chance',      bad: 'no shield regen',        fromTier: 2 },
  fragRun:     { name: 'Fragment lure',    good: 'double fragments',      bad: 'ships 30% tougher',      fromTier: 4 },
  swarmDay:    { name: 'Swarm storm',      good: '+80% scrap from swarm', bad: 'swarm only, ×3 numbers', fromTier: 3 },
  glass:       { name: 'Glass cannon',     good: '+40% weapon damage',    bad: 'shield capacity halved', fromTier: 2 },
  fortress:    { name: 'Bunker mode',      good: 'shield regen ×2',       bad: '-30% weapon damage',     fromTier: 2 },
  bounty:      { name: 'Bounty board',     good: 'elites drop 5× scrap',  bad: 'elite chance ×3',        fromTier: 5 },
  hive:        { name: 'Hive protocol',    good: 'drones +50% damage',    bad: 'other weapons -20%',     fromTier: 3 },
  overclock:   { name: 'Overclock',        good: '+35% fire rate',        bad: 'abilities on 2× cooldown', fromTier: 3 },
  eclipse:     { name: 'Eclipse',          good: 'phantoms never phase',  bad: 'snipers fire twice as often', fromTier: 11 },
  nothing:     { name: 'Hold steady',      good: 'no change',             bad: '',                       fromTier: 1 },
};

// how each choice changes the level. m = mods object for the level.
export function applyChoice(id, m) {
  switch (id) {
    case 'scrapFast': m.scrap *= 1.5; m.mobSpeed *= 1.25; break;
    case 'scrapCalm': m.spawn *= 0.7; m.scrap *= 0.6; break;
    case 'critHigh':  m.crit += 0.15; m.shieldRegen = 0; break;
    case 'fragRun':   m.fragments *= 2; m.mobHp *= 1.3; break;
    case 'swarmDay':  m.swarmScrap *= 1.8; m.force = 'swarm'; m.spawn *= 3; break;
    case 'glass':     m.dmg *= 1.4; m.shieldMax *= 0.5; break;
    case 'fortress':  m.shieldRegen *= 2; m.dmg *= 0.7; break;
    case 'bounty':    m.eliteScrap *= 5; m.elite *= 3; break;
    case 'hive':      m.droneDmg *= 1.5; m.otherDmg *= 0.8; break;
    case 'overclock': m.rate *= 1.35; m.abilityCd *= 2; break;
    case 'eclipse':   m.noPhase = true; m.sniperRate *= 2; break;
  }
  return m;
}

export function baseLevelMods() {
  return { scrap: 1, swarmScrap: 1, eliteScrap: 1, spawn: 1, mobSpeed: 1, mobHp: 1, crit: 0, shieldRegen: 1, shieldMax: 1,
    fragments: 1, dmg: 1, droneDmg: 1, otherDmg: 1, rate: 1, abilityCd: 1, elite: 1, force: null, noPhase: false, sniperRate: 1 };
}

// two random options that fit the tier, always different
export function rollChoices(tier) {
  const pool = Object.keys(CHOICES).filter(k => CHOICES[k].fromTier <= tier && k !== 'nothing');
  const a = pool[Math.floor(Math.random() * pool.length)];
  let b = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0; while (b === a && guard++ < 20) b = pool[Math.floor(Math.random() * pool.length)];
  return [a, b === a ? 'nothing' : b];
}
