import { ICONS } from './icons.js';
import { WEAPONS } from './config.js';
const WEAPON_COLORS = Object.fromEntries(Object.entries(WEAPONS).map(([k, v]) => [k, v.color]));

// Weapon combos: when two specific weapons are mounted, a shot from one has a small
// chance to trigger a joint attack. Each combo has its own cooldown so it stays rare.
export const COMBOS = {
  ionlance:    { name: 'Ion lance',        pair: ['railgun', 'tesla'],   chance: 0.15, cd: 8,  color: 0x9be7ff,
                 desc: 'Railgun shot arcs lightning into every ship near its path.' },
  singularity: { name: 'Singularity strike', pair: ['missile', 'gravity'], chance: 0.25, cd: 10, color: 0xc084fc,
                 desc: 'A missile detonating inside a gravity well collapses it: huge blast.' },
  focus:       { name: 'Focus fire',       pair: ['pulse', 'laser'],     chance: 0.10, cd: 6,  color: 0xff3df2,
                 desc: 'Pulse bolts hitting the laser target crit for triple damage.' },
  storm:       { name: 'Storm well',       pair: ['tesla', 'gravity'],   chance: 0.20, cd: 9,  color: 0x9be7ff,
                 desc: 'Tesla arcs to every ship trapped in a gravity well.' },
  barrage:     { name: 'Barrage',          pair: ['pulse', 'missile'],   chance: 0.06, cd: 7,  color: 0xff9f43,
                 desc: 'Pulse cannon launches a volley of micro-missiles.' },
  escort:      { name: 'Escort strike',    pair: ['missile', 'drones'],  chance: 0.18, cd: 9,  color: 0x60a5fa,
                 desc: 'A missile launch makes every live drone fire a mini-missile at its own target.' },
  collapse:    { name: 'Collapse',         pair: ['shock', 'gravity'],   chance: 0.30, cd: 10, color: 0xc084fc,
                 desc: 'A shockwave through an active gravity well collapses it: everything inside is yanked to the centre and blasted.' },
  scramble:    { name: 'Scramble',         pair: ['shock', 'drones'],    chance: 0.25, cd: 9,  color: 0x60a5fa, effectDur: 3,
                 desc: 'The shockwave launches your drones: double speed and fire rate for 3 s.' },
  paint:       { name: 'Target paint',     pair: ['laser', 'drones'],    chance: 0.12, cd: 8,  color: 0xff3df2, effectDur: 3,
                 desc: 'Drones swarm the laser target. It takes +50% damage from everything for 3 s.' },
  buster:      { name: 'Bunker buster',    pair: ['railgun', 'missile'], chance: 0.18, cd: 8,  color: 0xff9f43,
                 desc: 'A railgun hit calls three missiles down on the same target.' },
  lance:       { name: 'Kinetic lance',    pair: ['railgun', 'shock'],   chance: 0.20, cd: 8,  color: 0x5eead4,
                 desc: 'The railgun shot hits 50% harder and hurls every ship on its line backwards.' },
  charged:     { name: 'Charged rounds',   pair: ['pulse', 'tesla'],     chance: 0.08, cd: 7,  color: 0x9be7ff, effectDur: 3,
                 desc: 'For 3 s every pulse bolt arcs lightning to the nearest other ship.' },
  overload:    { name: 'Overload beam',    pair: ['railgun', 'laser'],   chance: 0.20, cd: 12, color: 0xffffff, effectDur: 3,
                 desc: 'Railgun hit on the laser target supercharges the beam for 3 s.' },
  stasis:      { name: 'Stasis lock',      pair: ['chrono', 'shock'],    chance: 0.25, cd: 10, color: 0x9be7ff,
                 desc: 'Shock pulse freezes every ship inside the chrono field for 2 s.' },
  bloom:       { name: 'Temporal bloom',   pair: ['chrono', 'laser'],    chance: 0.15, cd: 9,  color: 0xff3df2,
                 desc: 'A laser crit tick on a ship inside the field echoes three times.' },
  plague:      { name: 'Plague wind',      pair: ['nanite', 'shock'],    chance: 0.25, cd: 10, color: 0x5eead4,
                 desc: 'Shock pulse spreads every infection to all ships within 140 px of a host.' },
  culture:     { name: 'Culture well',     pair: ['nanite', 'gravity'],  chance: 0.25, cd: 10, color: 0xc084fc,
                 desc: 'A nanite shot seeds every ship held in a gravity well.' },
  horizon:     { name: 'Event horizon',    pair: ['singularity', 'gravity'], chance: 0.30, cd: 12, color: 0xc084fc,
                 desc: 'The singularity blast collapses into a tower-sized gravity well for 4 s.' },
  supernova:   { name: 'Supernova',        pair: ['singularity', 'tesla'], chance: 0.25, cd: 12, color: 0x9be7ff,
                 desc: 'The blast arcs to every ship in range for 3× tesla damage.' },
  // ---- second wave (src/combos/procs.js) ----
  sabot:       { name: 'Sabot volley',     pair: ['pulse', 'railgun'],   chance: 0.15, cd: 8,  color: 0xffffff,
                 desc: 'A railgun shot carries six fast pulse rounds along the beam at 1.5× damage.' },
  orbital:     { name: 'Orbital rounds',   pair: ['pulse', 'gravity'],   chance: 0.20, cd: 8,  color: 0xc084fc,
                 desc: 'A pulse shot bursts a ring of eight double-damage rounds out of the active well.' },
  flak:        { name: 'Flak burst',       pair: ['pulse', 'shock'],     chance: 0.12, cd: 7,  color: 0x5eead4,
                 desc: 'The shock pulse throws sixteen pulse rounds in every direction.' },
  gunrun:      { name: 'Gun run',          pair: ['pulse', 'drones'],    chance: 0.15, cd: 8,  color: 0x60a5fa,
                 desc: 'Every drone fires a three-round burst at its target.' },
  slingshot:   { name: 'Slingshot',        pair: ['railgun', 'gravity'], chance: 0.25, cd: 9,  color: 0xc084fc,
                 desc: 'The railgun drags the nearest well onto its target and doubles the well\'s damage.' },
  spotter:     { name: 'Spotter',          pair: ['railgun', 'drones'],  chance: 0.20, cd: 8,  color: 0x60a5fa,
                 desc: 'The railgun target is marked (+50 % damage taken) for 4 s and every drone goes for it.' },
  ionwarhead:  { name: 'Ion warheads',     pair: ['missile', 'tesla'],   chance: 0.18, cd: 8,  color: 0x9be7ff,
                 desc: 'A missile impact arcs into the four nearest ships for 0.8× tesla damage.' },
  guided:      { name: 'Guided burn',      pair: ['missile', 'laser'],   chance: 0.15, cd: 8,  color: 0xff3df2,
                 desc: 'A missile locks onto the laser target with double damage and tighter turns.' },
  concussion:  { name: 'Concussion',       pair: ['missile', 'shock'],   chance: 0.20, cd: 9,  color: 0xff9f43,
                 desc: 'The shock pulse detonates every missile in flight with double splash.' },
  conductor:   { name: 'Conductor',        pair: ['laser', 'tesla'],     chance: 0.20, cd: 8,  color: 0x9be7ff,
                 desc: 'The tesla arc leaps onto the laser target and runs three extra hops from it at 2× damage.' },
  lensing:     { name: 'Lensing',          pair: ['laser', 'gravity'],   chance: 0.20, cd: 9,  color: 0xff3df2,
                 desc: 'A beam through a well refracts onto every ship the well holds for 3 s at half damage.' },
  flashpoint:  { name: 'Flashpoint',       pair: ['laser', 'shock'],     chance: 0.20, cd: 9,  color: 0xff3df2,
                 desc: 'The shock pulse triggers an immediate ring sweep from a fully ramped laser.' },
  relay:       { name: 'Relay net',        pair: ['tesla', 'drones'],    chance: 0.20, cd: 8,  color: 0x9be7ff,
                 desc: 'The arc jumps through every drone and from each into a fresh ship at 0.7× damage.' },
  orbitstrike: { name: 'Orbit strike',     pair: ['gravity', 'drones'],  chance: 0.25, cd: 9,  color: 0x60a5fa,
                 desc: 'When a well lands, the ships in it are marked and the drones dive on them, boosted 3 s.' },
  dilation:    { name: 'Time dilation',    pair: ['chrono', 'drones'],   chance: 0.20, cd: 10, color: 0x9be7ff,
                 desc: 'Drones run on tower time: double speed and fire rate for 4 s.' },
  staticfield: { name: 'Static field',     pair: ['chrono', 'tesla'],    chance: 0.20, cd: 9,  color: 0x9be7ff,
                 desc: 'Ships arced inside the chrono field lock up for 1 s.' },
  carrierstrain: { name: 'Carrier strain', pair: ['nanite', 'drones'],   chance: 0.20, cd: 9,  color: 0x5eead4,
                 desc: 'A nanite shot infects every drone\'s target.' },
  spore:       { name: 'Spore warheads',   pair: ['nanite', 'missile'],  chance: 0.20, cd: 8,  color: 0x5eead4,
                 desc: 'A missile impact infects every ship in its splash.' },
  accretion:   { name: 'Accretion',        pair: ['singularity', 'drones'], chance: 0.30, cd: 12, color: 0x60a5fa,
                 desc: 'The blast rebuilds every lost drone at once and boosts them 4 s.' },
  prism:       { name: 'Prism',            pair: ['beamdrones', 'laser'], chance: 0.20, cd: 9,  color: 0xff3df2, effectDur: 4,
                 desc: 'While the laser is at full ramp, drone beams run at +50 % damage and split to one more ship for 4 s.' },
  lattice:     { name: 'Arc lattice',      pair: ['beamdrones', 'tesla'], chance: 0.20, cd: 8,  color: 0x9be7ff,
                 desc: 'A tesla arc that hits a drone\'s target jumps to every ship the drones are beaming.' },
  thunderhead: { name: 'Thunderhead',      pair: ['ionstorm', 'tesla'],   chance: 0.20, cd: 8,  color: 0x9be7ff,
                 desc: 'A tesla arc that reaches a ship inside the storm jumps to every ship in the cloud.' },
  downburst:   { name: 'Downburst',        pair: ['ionstorm', 'gravity'], chance: 0.25, cd: 10, color: 0xc084fc,
                 desc: 'A well landing inside the storm collapses it into one 4× bolt on every ship in the cloud.' },
  cluster:     { name: 'Cluster drop',     pair: ['missiledrones', 'shock'], chance: 0.20, cd: 9, color: 0xff9f43,
                 desc: 'The shock pulse makes every missile drone dump a full salvo at once.' },
  seekers:     { name: 'Well seekers',     pair: ['missiledrones', 'gravity'], chance: 0.25, cd: 9, color: 0xc084fc,
                 desc: 'A drone missile fired at a ship in a well hits for double.' },
  painted:     { name: 'Painted targets',  pair: ['drones', 'beamdrones'],   chance: 0.20, cd: 8, color: 0x60a5fa, effectDur: 3,
                 desc: 'Ships held in a drone beam are marked (+50 % damage taken) for 3 s, and the interceptors dive on them.' },
  escortvolley:{ name: 'Escort volley',    pair: ['drones', 'missiledrones'], chance: 0.20, cd: 8, color: 0x60a5fa,
                 desc: 'When a missile drone fires, every interceptor drone puts a burst into the same ship.' },
  laserguided: { name: 'Laser guided',     pair: ['beamdrones', 'missiledrones'], chance: 0.25, cd: 8, color: 0xff3df2,
                 desc: 'A drone missile fired at a ship under a drone beam hits for double and cannot miss.' },
  wingmen:     { name: 'Wingmen',          pair: ['kamikaze', 'drones'],     chance: 0.25, cd: 8, color: 0x60a5fa,
                 desc: 'A kamikaze blast sends every interceptor into a 3 s boost with a burst at the nearest survivor.' },
  targetlock:  { name: 'Target lock',      pair: ['kamikaze', 'beamdrones'], chance: 0.25, cd: 8, color: 0xff3df2,
                 desc: 'A kamikaze that dives into a beamed ship blasts for double.' },
  chainblast:  { name: 'Chain detonation', pair: ['kamikaze', 'missiledrones'], chance: 0.25, cd: 9, color: 0xff9f43,
                 desc: 'A kamikaze blast makes every missile drone salvo the ships caught in it.' },
  sporebomb:   { name: 'Spore bomb',       pair: ['kamikaze', 'nanite'],     chance: 0.25, cd: 9, color: 0x5eead4,
                 desc: 'Every ship caught in a kamikaze blast is infected.' },
  prismcannon: { name: 'Prism cannon',     pair: ['mirrors', 'laser'],      chance: 0.20, cd: 8, color: 0xff3df2,
                 desc: 'A reflect also fires the laser from the plate at the farthest ship for 3× beam damage.' },
  ricochetfield: { name: 'Ricochet field', pair: ['mirrors', 'pulse'],      chance: 0.25, cd: 8, color: 0xc084fc,
                 desc: 'Reflected shots pierce through two ships.' },
  focalpoint:  { name: 'Focal point',      pair: ['mirrors', 'chrono'],     chance: 0.25, cd: 8, color: 0x9be7ff,
                 desc: 'A shot crawling through the chrono field is reflected for double damage.' },
  collapsar:   { name: 'Collapsar rounds', pair: ['singularity', 'railgun'], chance: 0.25, cd: 12, color: 0xffffff,
                 desc: 'The blast lands a triple railgun hit on the three biggest ships in range.' },
};

// intrinsic procs that show up in stats alongside combos
COMBOS.rewind = { name: 'Rewind', pair: ['chrono', 'chrono'], chance: 0, cd: 0, color: 0x9be7ff, intrinsic: true, desc: 'Chrono field Lv 10+: every ship inside jumps back 3 s every 20 s.' };
COMBOS.replicate = { name: 'Replicate', pair: ['nanite', 'nanite'], chance: 0, cd: 0, color: 0x5eead4, intrinsic: true, desc: 'Nanites jump to nearby ships when a host dies.' };
COMBOS.kamikaze = { name: 'Kamikaze', pair: ['kamikaze', 'kamikaze'], chance: 0, cd: 0, color: 0xff4d6d, intrinsic: true, desc: 'A kamikaze drone detonated on its target.' };
COMBOS.sweep = { name: 'Ring sweep', pair: ['laser', 'laser'], chance: 0, cd: 0, color: 0xff3df2, intrinsic: true, desc: 'Laser at full ramp sweeps the whole ring every 6 s. From half ramp it forks to nearby ships.' };

export class Combos {
  constructor(scene) {
    this.scene = scene;
    this.cd = {};
    this.count = 0;
  }

  mounted(type) { return this.scene.tower.weapons.some(w => w.type === type); }
  available(id) { const c = COMBOS[id]; return this.mounted(c.pair[0]) && this.mounted(c.pair[1]); }

  // returns true when the combo fires this time
  roll(id) {
    const c = COMBOS[id];
    if (!this.available(id)) return false;
    if ((this.cd[id] || 0) > 0) return false;
    if (Math.random() > c.chance * this.scene.tree.mods.comboChance) return false;
    this.cd[id] = c.cd;
    this.count++;
    const st = this.scene.stats; if (st) st.procs[id] = (st.procs[id] || 0) + 1;
    this.announce({ id, ...c });
    return true;
  }

  /** A proc shows only in the effect tray on the left (plus a small flash on the two hardpoints): no ring, tint or slow-mo. */
  announce(c) {
    const s = this.scene, t = s.tower;
    for (const type of c.pair) { const w = t.weapons.find(x => x.type === type); if (w) { const m = w.mount(); s.fx.flash(m.x, m.y, w.color, 1.2); } }
    s.ui.addEffect('combo:' + (c.id || c.name), {
      name: c.name, color: c.color, dur: c.effectDur || 2.5,
      sub: c.effectDur ? 'active' : 'combo proc',
      icon: c.pair.map(p => `<span style="color:#${WEAPON_COLORS[p].toString(16).padStart(6, '0')}">${ICONS[p]}</span>`).join(''),
    });
    s.sfx.play('combo');
  }

  update(dt) { for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt); }

  // list for the UI: [{id, name, desc, ready, available}]
  list() {
    return Object.entries(COMBOS).filter(([, c]) => !c.intrinsic).map(([id, c]) => ({ id, ...c, available: this.available(id), cd: this.cd[id] || 0 }));
  }
}
