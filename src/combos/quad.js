// Ultimates and quad combos.
//
// Ultimates are player-fired power moves, each charged by something the loadout does. Every ultimate lists the four
// weapons it belongs to; how many of those are mounted sets its power (2 of 4 = 60 %, 4 of 4 = 100 %). Two ultimates
// Overdrive belongs to no weapon and is always there, so the bar never has fewer than two.
// The bar shows the matched ultimates first (best match first), then universals, at most four: keys Q W E R.
//
// Quad combos (all four of a set mounted) are ordinary combos registered in COMBOS; the first is Swarm Protocol.
import { COLORS } from '../config.js';
import { ICONS } from '../icons.js';
import { dist, angleTo, TAU } from '../utils.js';

export const QUADS = {
  swarmprotocol: {
    name: 'Swarm Protocol', pair: ['drones', 'beamdrones', 'missiledrones'], chance: 0.08, cd: 30, color: 0x60a5fa, effectDur: 10,
    desc: 'Drone bay, beam drones and missile drones mounted: a drone kill can trigger Swarm Protocol. Every lost drone is rebuilt at once and all bays run at double speed for 10 s, hunting the ships the beam drones hold.',
  },
};

const BOSS = ['boss', 'warlord', 'titan', 'warden'];
export const MIN_MATCH = 3;   // three of an ultimate's four weapons mounted is enough to show it, at full power
const BAR_MAX = 4;
const KEYS = ['Q', 'W', 'E', 'R'];
export const power = n => n >= MIN_MATCH ? 1 : 0.2 + 0.2 * n;   // full power from MIN_MATCH weapons up

export const ULTS = {
  hivecollapse: {
    name: 'Hive Collapse', match: ['drones', 'beamdrones', 'missiledrones', 'kamikaze'], color: 0xffd166, cd: 20,
    charge: 'droneKills', need: 40, needPerTier: 5, dur: 2.3,
    desc: 'Every drone recalls to the core, the bays overbuild a double swarm, and the whole hive launches as kamikazes in a ring, one per ship, biggest first. Survivors are marked, every enemy shot is wiped. Charged by drone kills.',
  },
  coherence: {
    name: 'Coherence', match: ['pulse', 'railgun', 'laser', 'tesla'], color: 0xffffff, cd: 25,
    charge: 'crits', need: 30, needPerTier: 3, dur: 3,
    desc: 'The turrets fuse into one white beam that sweeps the whole ring twice in 3 s. Everything it passes takes a burst of your total DPS and every hit crits. Charged by crits.',
  },
  eventhorizon: {
    name: 'Event Horizon', match: ['gravity', 'shock', 'chrono', 'singularity'], color: 0xc084fc, cd: 30,
    charge: 'held', need: 120, needPerTier: 10, dur: 4,
    desc: 'A well the size of your range opens on the core for 4 s: every ship is dragged inward through slowed time and every shot is swallowed. On collapse, everything pulled inside the shield ring is crushed for a share of its max HP. Charged by ships held in wells and fields.',
  },
  pandemic: {
    name: 'Pandemic', match: ['nanite', 'missile', 'ionstorm', 'beamdrones'], color: 0x5eead4, cd: 30,
    charge: 'infections', need: 40, needPerTier: 4, dur: 6,
    desc: 'Every ship in range is infected at once and rots for half its max HP over 6 s; each death bursts on its neighbours. Charged by infections and splash hits.',
  },
  fortress: {
    name: 'Fortress', match: ['mirrors', 'chrono', 'shock', 'drones'], color: 0x9be7ff, cd: 35,
    charge: 'blocks', need: 40, needPerTier: 3, dur: 6,
    desc: 'For 6 s the core is a wall: every shot that reaches the shield ring flies back at its shooter, rams die on the ring and blast their neighbours, and a shockwave pulses every second. Charged by reflections, drone absorbs and plate rams.',
  },
  barrage: {
    name: 'Barrage', match: ['missile', 'missiledrones', 'railgun', 'pulse'], color: 0xff9f43, cd: 30,
    charge: 'hits', need: 300, needPerTier: 30, dur: 4,
    desc: 'Four seconds of saturation fire: heavy missiles and slugs pour out of the core at every ship in range, biggest first. Charged by hits from these weapons.',
  },
  tempest: {
    name: 'Tempest', match: ['ionstorm', 'tesla', 'shock', 'mirrors'], color: 0x4ff2ff, cd: 30,
    charge: 'arcs', need: 200, needPerTier: 20, dur: 5,
    desc: 'A storm covers your whole range for 5 s: lightning strikes eight ships every quarter second, hit ships lock up, and every enemy shot is eaten. Charged by arcs and reflections.',
  },
  overdrive: {
    name: 'Overdrive', match: [], color: 0xff9f43, cd: 35,
    charge: 'taken', need: 3, needPerTier: 0, dur: 8,
    desc: 'For 8 s every weapon fires three times as fast, drones rebuild instantly, and the core cannot be hurt. Charged by damage the shield takes (three shields\' worth fills it).',
  },
};

const T = {
  recallT: 1.4, buildT: 0.9, strikeMul: 3, strikeTurn: 14, strikeSpeed: 520, strikeLife: 3, markDur: 10, bossCap: 0.15, darken: 0.45, tempKzLife: 12,
  coherence: { sweeps: 2, window: 0.22, dpsMul: 2.5 },
  horizon: { pull: 420, slow: 0.2, crushFrac: 0.4, crushR: 60 },
  overdrive: { rate: 3 },
  pandemic: { frac: 0.5, burstR: 100, burstMul: 0.15 },
  fortress: { reflectMul: 4, ramR: 70, pulseEvery: 1, push: 700 },
  barrage: { every: 0.12, volley: 4, budget: 10, splash: 70 },    // budget = seconds of your DPS spread over the whole barrage
  tempest: { every: 0.25, bolts: 8, budget: 10, stun: 1 },
};

export class Quads {
  constructor(scene) {
    this.scene = scene;
    this.swarmT = 0;
    this.charge = {};      // ult id -> 0..1
    this.cd = {};          // ult id -> seconds left
    this.ult = null;       // running ultimate: { id, phase, t, power }
    this.overdriveT = 0;
    this.tempKz = null;    // kamikaze wing spawned by Hive Collapse when no kamikaze bay is mounted
    this.tempT = 0;
    import('../weapons/index.js').then(m => { this.createWeapon = m.createWeapon; });   // lazy: weapons import the combo modules
  }
  /** Hive Collapse without a kamikaze bay: a temporary wing at the level of the best mounted bay, gone once its drones are spent */
  spawnTempKamikaze() {
    const sc = this.scene, t = sc.tower, bays = this.bays();
    if (!this.createWeapon || this.tempKz) return;
    const kz = this.createWeapon(sc, t, 'kamikaze', t.slots.length);
    kz.level = Math.max(1, ...bays.map(b => b.level)); kz.temp = true;
    Object.defineProperty(kz, 'respawn', { value: 999 });   // one flight each, no rebuild
    kz.sync();
    this.tempKz = kz; this.tempT = 0;
    sc.fx.floater(t.x, t.y - t.shieldR - 24, 'kamikaze wing launched', '#ffd166', 12);
  }
  bays() { const b = this.scene.tower.weapons.filter(w => Array.isArray(w.drones)); return this.tempKz ? b.concat(this.tempKz) : b; }
  mounted(type) { return this.scene.tower.weapons.some(w => w.type === type); }
  available(id) { return QUADS[id].pair.every(t => this.mounted(t)); }
  matches(id) { return ULTS[id].match.filter(t => this.mounted(t)).length; }
  powerOf(id) { return ULTS[id].match.length ? power(this.matches(id)) : 1; }

  /** the ultimates on the bar: the loadout's matched ones, best match first, at most four; Overdrive fills in below two */
  bar() {
    const scored = Object.keys(ULTS).filter(id => ULTS[id].match.length && this.matches(id) > 0).sort((a, b) => this.matches(b) - this.matches(a));
    const full = scored.filter(id => this.matches(id) >= MIN_MATCH);
    // full-power ultimates first; a loadout with none gets its two best partial matches at reduced power, and Overdrive fills the bar to at least two
    const list = full.length ? full.slice(0, BAR_MAX) : scored.slice(0, 2);
    if (list.length < 2 || !full.length) list.push('overdrive');
    return list.map((id, i) => ({ id, key: KEYS[i], ...ULTS[id] }));
  }
  need(id) { const u = ULTS[id]; return u.need + u.needPerTier * Math.max(0, Math.floor(this.scene.tier) - 1); }
  add(id, amount) { if (!this.ult || this.ult.id !== id) this.charge[id] = Math.min(1, (this.charge[id] || 0) + amount / this.need(id)); }
  ready(id) { return (this.charge[id] || 0) >= 1 && !this.ult && !(this.cd[id] > 0) && !(this.scene.siege && this.scene.siege.t < 10); }
  get invulnerable() { return !!this.ult; }
  /** weapon fire-rate multiplier from Overdrive */
  get rateMul() { return this.overdriveT > 0 ? T.overdrive.rate : 1; }

  // ---- charge sources ----
  onKill(m, src) {
    const worth = BOSS.includes(m.type) ? 10 : m.elite ? 3 : 1;
    if (['drones', 'beamdrones', 'missiledrones', 'kamikaze'].includes(src)) { this.add('hivecollapse', worth); this.onDroneKill(m); }
  }
  onCrit(weapon) { if (weapon && ULTS.coherence.match.includes(weapon.type)) this.add('coherence', 1); }
  /** every landed hit: Barrage and Tempest charge from their groups' hits */
  onHit(weapon) {
    if (!weapon) return;
    if (ULTS.barrage.match.includes(weapon.type)) this.add('barrage', 1);
    if (ULTS.tempest.match.includes(weapon.type)) this.add('tempest', 1);
    if (weapon.type === 'missile' || weapon.type === 'ionstorm') this.add('pandemic', 0.2);
  }
  onInfect() { this.add('pandemic', 1); }
  onBlock() { this.add('fortress', 1); this.add('tempest', 1); }
  onTaken(amount) { const t = this.scene.tower; this.add('overdrive', amount / Math.max(1, t.shieldMax)); }

  /** Swarm Protocol combo (needs drone bay, beam drones and missile drones) */
  onDroneKill() {
    const sc = this.scene, q = QUADS.swarmprotocol;
    if (!this.available('swarmprotocol') || this.ult || this.swarmT > 0) return;
    if (!sc.combos.roll('swarmprotocol')) return;
    this.swarmT = sc.combos.dur(q.effectDur);
    for (const bay of this.bays()) {
      for (const d of bay.drones) if (!d.alive) { d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.x = sc.tower.x; d.y = sc.tower.y; }
      bay.boost = Math.max(bay.boost, this.swarmT);
    }
    sc.ui.banner('SWARM PROTOCOL', true);
  }

  /** the player fires it (button or key) once the charge is full */
  fireUltimate(id) {
    if (!ULTS[id] || !this.ready(id) || !this.bar().some(x => x.id === id)) return false;
    const sc = this.scene, u = ULTS[id];
    this.cd[id] = u.cd; this.charge[id] = 0;
    this.ult = { id, phase: 'start', t: 0, power: this.powerOf(id), dps: Math.max(sc.baseDps(), 50) };   // DPS snapshot: the ultimate's own damage must not feed its scaling
    sc.stats.procs[id] = (sc.stats.procs[id] || 0) + 1;
    sc.ui.addEffect('ult:' + id, { name: u.name, color: u.color, dur: u.dur, sub: 'ULTIMATE', crit: true, icon: (u.match.length ? u.match : ['level']).map(p => ICONS[p] || ICONS.level).join('') });
    sc.ui.banner(u.name.toUpperCase(), true);
    sc.sfx.play('boss');
    if (id === 'hivecollapse') { if (!this.bays().some(b => b.type === 'kamikaze')) this.spawnTempKamikaze(); this.ult.phase = 'recall'; sc.screenFlash.setFillStyle(0x000000); sc.screenFlash.setAlpha(T.darken); for (const bay of this.bays()) for (const d of bay.drones) d.target = null; }
    if (id === 'overdrive') { this.overdriveT = u.dur; for (const bay of this.bays()) for (const d of bay.drones) if (!d.alive) { d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; } }
    if (id === 'coherence') sc.afterglow = Math.max(sc.afterglow || 0, u.dur);
    if (id === 'pandemic') this.startPandemic(sc.mobs);
    if (id === 'fortress') { this.ult.pulseT = 0; const mr = sc.tower.weapons.find(w => w.type === 'mirrors'); if (mr) mr.fortress = true; }
    if (id === 'barrage') this.ult.fireT = 0;
    if (id === 'tempest') this.ult.boltT = 0;
    return true;
  }

  update(dt, mobs) {
    const sc = this.scene;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.overdriveT = Math.max(0, this.overdriveT - dt);
    if (this.tempKz) {
      this.tempKz.update(dt, mobs);
      if (!this.ult || this.ult.id !== 'hivecollapse') {
        this.tempT += dt;
        if (this.tempT > T.tempKzLife || this.tempKz.drones.every(d => !d.alive)) { for (const d of this.tempKz.drones) if (d.alive) sc.fx.explode(d.x, d.y, COLORS.gold, 8); this.tempKz = null; }
      }
    }
    if (this.swarmT > 0) { this.swarmT -= dt; this.shareTargets(mobs); }
    // held ships charge Event Horizon: one point per ship-second inside a well or the chrono field
    if (ULTS.eventhorizon.match.some(t => this.mounted(t))) {
      const cf = sc.tower.weapons.find(w => w.type === 'chrono');
      let held = 0;
      for (const m of mobs) if (!m.dead && (sc.wells.some(w => dist(w, m) <= w.r) || (cf && dist(sc.tower, m) <= cf.range))) held++;
      if (held) this.add('eventhorizon', held * dt);
    }
    if (!this.ult) return;
    const u = this.ult; u.t += dt;
    if (u.id === 'hivecollapse') this.updateHive(dt, mobs);
    else if (u.id === 'coherence') this.updateCoherence(dt, mobs);
    else if (u.id === 'eventhorizon') this.updateHorizon(dt, mobs);
    else if (u.id === 'pandemic') this.updatePandemic(dt, mobs);
    else if (u.id === 'fortress') this.updateFortress(dt, mobs);
    else if (u.id === 'barrage') this.updateBarrage(dt, mobs);
    else if (u.id === 'tempest') this.updateTempest(dt, mobs);
    else if (u.t >= ULTS[u.id].dur) this.ult = null;
  }

  // ---- Hive Collapse ----
  updateHive(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, bays = this.bays();
    const R = t.shieldR + 30, n = Math.max(1, bays.reduce((a, b) => a + b.drones.length, 0));
    if (u.phase === 'recall') {
      let i = 0;
      for (const bay of bays) for (const d of bay.drones) {
        d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.target = null;
        const a = u.t * 2 + i * TAU / n, tx = t.x + Math.cos(a) * R, ty = t.y + Math.sin(a) * R, k = Math.min(1, dt * 6);
        d.x += (tx - d.x) * k; d.y += (ty - d.y) * k; d.vx = Math.cos(a + Math.PI / 2) * 200; d.vy = Math.sin(a + Math.PI / 2) * 200; d.armT = 9; i++;
      }
      if (Math.random() < dt * 30) { const a = Math.random() * TAU; sc.fx.trailAt(t.x + Math.cos(a) * R, t.y + Math.sin(a) * R, COLORS.gold); }
      if (u.t >= T.recallT) { u.phase = 'build'; u.t = 0; sc.fx.ripple(t.x, t.y, COLORS.gold, R, R + 120); sc.sfx.play('shieldBreak'); }
    } else if (u.phase === 'build') {
      let i = 0;
      for (const bay of bays) for (const d of bay.drones) { const a = u.t * 3 + i * TAU / n; d.x = t.x + Math.cos(a) * (R + u.t * 40); d.y = t.y + Math.sin(a) * (R + u.t * 40); d.armT = 9; i++; }
      if (Math.random() < dt * 60) { const a = Math.random() * TAU, rr = R + Math.random() * 40; sc.fx.spark(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr, COLORS.gold, 2); }
      if (u.t >= T.buildT) this.launchHive(mobs);
    }
  }
  launchHive(mobs) {
    const sc = this.scene, t = sc.tower, bays = this.bays(), p = this.ult.power;
    const kz = bays.find(b => b.type === 'kamikaze') || bays[0];
    const dmg = (kz.type === 'kamikaze' ? kz.dmg : kz.dmg * 8) * T.strikeMul * p, blast = kz.blastRadius || 90, range = kz.range;
    const count = Math.max(6, Math.round(2 * bays.reduce((a, b) => a + b.drones.length, 0) * p));
    const targets = mobs.filter(m => !m.dead && dist(t, m) <= range).sort((a, b) => b.hpMax - a.hpMax);
    const R = t.shieldR + 30;
    for (let i = 0; i < count; i++) {
      const a = i * TAU / count, tg = targets.length ? targets[i % targets.length] : null;
      sc.spawnMissile({ x: t.x + Math.cos(a) * R, y: t.y + Math.sin(a) * R, vx: Math.cos(a) * T.strikeSpeed, vy: Math.sin(a) * T.strikeSpeed,
        speed: T.strikeSpeed, turn: T.strikeTurn, dmg, weapon: kz, splash: blast, color: COLORS.gold, life: T.strikeLife, target: tg,
        onImpact: (m) => { m.marked = Math.max(m.marked || 0, T.markDur); sc.stats.procs.kamikaze = (sc.stats.procs.kamikaze || 0) + 1; } });
    }
    this.capBosses(targets);
    sc.enemyBullets = [];
    for (const m of targets) m.marked = Math.max(m.marked || 0, T.markDur);
    for (const bay of bays) for (const d of bay.drones) { d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.armT = 0.6; d.target = null; }
    this.boom(R, range, COLORS.gold);
    sc.tweens.add({ targets: sc.screenFlash, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
    this.ult = null;
  }

  // ---- Coherence: one beam sweeps the ring twice ----
  updateCoherence(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, C = T.coherence, dur = ULTS.coherence.dur;
    const a = (u.t / dur) * TAU * C.sweeps, range = t.maxRange();
    const dps = u.dps * C.dpsMul * u.power;
    if (u.phase === 'start') { u.phase = 'sweep'; this.capBosses(mobs.filter(m => !m.dead)); }
    const gun = t.weapons.find(w => ULTS.coherence.match.includes(w.type)) || t.weapons[0];
    for (const m of mobs) {
      if (m.dead || dist(t, m) > range + m.r) continue;
      const rel = angleTo(t, m) - a, da = Math.abs(Math.atan2(Math.sin(rel), Math.cos(rel)));
      if (da <= C.window) sc.hit(m, gun, m.x, m.y, { dmg: dps * dt, color: '#ffffff', size: 13, quiet: Math.random() > 0.2 });
    }
    for (const w of t.weapons) w.angle = a;
    if (Math.random() < dt * 40) { const rr = Math.random() * range; sc.fx.trailAt(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr, COLORS.white); }
    if (u.t >= dur) { this.ult = null; sc.fx.ripple(t.x, t.y, COLORS.white, t.shieldR, range); }
  }

  // ---- Event Horizon: everything is dragged in, then crushed ----
  updateHorizon(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, H = T.horizon, dur = ULTS.eventhorizon.dur, range = t.maxRange();
    for (const m of mobs) {
      if (m.dead || dist(t, m) > range + m.r || BOSS.includes(m.type)) continue;
      const a = angleTo(m, t), d = dist(t, m), pull = H.pull * u.power * (0.4 + 0.6 * (1 - d / range));
      m.x += Math.cos(a) * pull * dt; m.y += Math.sin(a) * pull * dt; m.slow = Math.min(m.slow, H.slow);
    }
    for (const b of sc.enemyBullets) b.chrono = H.slow;
    sc.enemyBullets = sc.enemyBullets.filter(b => dist(t, b) > t.shieldR + 20);
    if (Math.random() < dt * 40) { const a = Math.random() * TAU, rr = t.shieldR + Math.random() * (range - t.shieldR); sc.fx.trailAt(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr, COLORS.violet); }
    if (u.t >= dur) {
      const crushR = t.shieldR + t.r + H.crushR, crushed = mobs.filter(m => !m.dead && dist(t, m) <= crushR + m.r);
      this.capBosses(crushed);
      const w = t.weapons.find(x => ULTS.eventhorizon.match.includes(x.type)) || t.weapons[0];
      for (const m of crushed) sc.hit(m, w, m.x, m.y, { dmg: m.hpMax * H.crushFrac * u.power, color: '#c084fc', size: 16 });
      const sg = t.weapons.find(x => x.type === 'singularity'); if (sg) { sg.charge = 1; sg.fire(null, mobs); }
      this.boom(t.shieldR, range, COLORS.violet);
      this.ult = null;
    }
  }

  // ---- Pandemic: everything rots, deaths burst ----
  startPandemic(mobs) {
    const sc = this.scene, t = sc.tower, range = t.maxRange();
    const ns = t.weapons.find(w => w.type === 'nanite');
    this.ult.hosts = mobs.filter(m => !m.dead && dist(t, m) <= range + m.r);
    this.capBosses(this.ult.hosts);
    for (const m of this.ult.hosts) { if (ns) ns.infect(m, 5); sc.fx.ripple(m.x, m.y, COLORS.green, m.r, m.r + 20); }
    this.boom(t.shieldR, range, COLORS.green);
  }
  updatePandemic(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, P = T.pandemic, dur = ULTS.pandemic.dur;
    const w = t.weapons.find(x => ULTS.pandemic.match.includes(x.type)) || t.weapons[0];
    for (const m of u.hosts) {
      if (m.dead) { if (!m.burst) { m.burst = true; sc.damageRadius(m.x, m.y, P.burstR, m.hpMax * P.burstMul * u.power, COLORS.green, w); sc.fx.explode(m.x, m.y, COLORS.green, 10); } continue; }
      m.lastHit = w.type; m.takeDamage(m.hpMax * P.frac * u.power / dur * dt, m.x, m.y, true); sc.addDmg(w.type, m.lastDealt ?? 0);
      if (Math.random() < dt * 3) sc.fx.spark(m.x, m.y, COLORS.green, 1);
    }
    if (u.t >= dur) this.ult = null;
  }

  // ---- Fortress: the wall ----
  updateFortress(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, F = T.fortress, dur = ULTS.fortress.dur, R = t.shieldR + 40;
    const w = t.weapons.find(x => ULTS.fortress.match.includes(x.type)) || t.weapons[0];
    // every shot reaching the ring goes back at its shooter
    const keep = [];
    for (const b of sc.enemyBullets) {
      if (dist(t, b) > R) { keep.push(b); continue; }
      const owner = b.owner && !b.owner.dead ? b.owner : null, back = owner ? angleTo(b, owner) : Math.atan2(-b.vy, -b.vx), sp = Math.max(400, Math.hypot(b.vx, b.vy) * 1.2);
      sc.spawnBullet({ x: b.x, y: b.y, vx: Math.cos(back) * sp, vy: Math.sin(back) * sp, dmg: b.dmg * F.reflectMul * u.power, weapon: w, color: COLORS.ice, life: 1.6, target: owner, reflected: true });
      sc.fx.spark(b.x, b.y, COLORS.ice, 3);
    }
    sc.enemyBullets = keep;
    // rams die on the ring and blast their neighbours
    for (const m of mobs) {
      if (m.dead || BOSS.includes(m.type) || dist(t, m) > R + m.r) continue;
      sc.damageRadius(m.x, m.y, F.ramR, m.dmg * 2 * u.power + m.hpMax * 0.1, COLORS.ice, w);
      sc.fx.explode(m.x, m.y, m.def.color, 12); m.die(false);
    }
    u.pulseT += dt;
    if (u.pulseT >= F.pulseEvery) {
      u.pulseT = 0;
      const shock = t.weapons.find(x => x.type === 'shock');
      if (shock) shock.fire(null, mobs);
      else for (const m of mobs) { if (m.dead || BOSS.includes(m.type) || dist(t, m) > t.maxRange()) continue; const a = angleTo(t, m); m.dodgeVx += Math.cos(a) * F.push * 0.5; m.dodgeVy += Math.sin(a) * F.push * 0.5; }
      sc.fx.ripple(t.x, t.y, COLORS.ice, R, t.maxRange() * 0.6);
    }
    if (u.t >= dur) {
      for (const m of mobs) { if (m.dead || BOSS.includes(m.type)) continue; const a = angleTo(t, m); m.dodgeVx += Math.cos(a) * F.push * u.power; m.dodgeVy += Math.sin(a) * F.push * u.power; }
      const mr = t.weapons.find(x => x.type === 'mirrors'); if (mr) mr.fortress = false;
      this.boom(R, t.maxRange(), COLORS.ice);
      this.ult = null;
    }
  }

  // ---- Barrage: saturation fire ----
  updateBarrage(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, B = T.barrage, dur = ULTS.barrage.dur, range = t.maxRange();
    const w = t.weapons.find(x => ULTS.barrage.match.includes(x.type)) || t.weapons[0];
    if (u.phase === 'start') { u.phase = 'fire'; this.capBosses(mobs.filter(m => !m.dead)); }
    u.fireT += dt;
    while (u.fireT >= B.every) {
      u.fireT -= B.every;
      const targets = mobs.filter(m => !m.dead && dist(t, m) <= range + m.r).sort((a, b) => b.hpMax - a.hpMax);
      for (let i = 0; i < B.volley; i++) {
        const tg = targets.length ? targets[(u.n = (u.n || 0) + 1) % Math.min(targets.length, 12)] : null, a = Math.random() * TAU;
        sc.spawnMissile({ x: t.x + Math.cos(a) * t.r, y: t.y + Math.sin(a) * t.r, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, speed: 620, turn: 9,
          dmg: u.dps * B.budget / (dur / B.every * B.volley) * u.power, weapon: w, splash: B.splash, color: COLORS.orange, life: 3, target: tg });
      }
      sc.fx.flash(t.x, t.y, COLORS.orange, 0.8);
    }
    if (u.t >= dur) this.ult = null;
  }

  // ---- Tempest: the whole range is a storm ----
  updateTempest(dt, mobs) {
    const sc = this.scene, t = sc.tower, u = this.ult, S = T.tempest, dur = ULTS.tempest.dur, range = t.maxRange();
    const w = t.weapons.find(x => ULTS.tempest.match.includes(x.type)) || t.weapons[0];
    if (u.phase === 'start') { u.phase = 'storm'; this.capBosses(mobs.filter(m => !m.dead)); }
    sc.enemyBullets = sc.enemyBullets.filter(b => dist(t, b) > range);
    u.boltT += dt;
    if (u.boltT >= S.every) {
      u.boltT = 0;
      const inside = mobs.filter(m => !m.dead && dist(t, m) <= range + m.r).sort(() => Math.random() - 0.5).slice(0, S.bolts);
      const per = u.dps * S.budget / (dur / S.every * S.bolts) * u.power;   // the whole storm is `budget` seconds of your DPS
      for (const m of inside) {
        const a = Math.random() * TAU, rr = range * (0.6 + Math.random() * 0.4);
        sc.fx.bolt(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr, m.x, m.y, COLORS.ice);
        sc.hit(m, w, m.x, m.y, { dmg: per, color: '#9be7ff', size: 12 });
        if (!BOSS.includes(m.type)) { m.stun = Math.max(m.stun, S.stun); m.dodgeVx = 0; m.dodgeVy = 0; }
      }
      sc.sfx.shot('tesla', t.x);
    }
    if (Math.random() < dt * 30) { const a = Math.random() * TAU, rr = Math.random() * range; sc.fx.trailAt(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr, COLORS.ice); }
    if (u.t >= dur) { this.ult = null; sc.fx.ripple(t.x, t.y, COLORS.ice, range, t.shieldR); }
  }

  /** bosses lose at most bossCap of max hp to an ultimate (enforced in damage.js via ultCap) */
  capBosses(list) { for (const m of list) if (BOSS.includes(m.type)) m.ultCap = Math.max(0, m.hp - m.hpMax * T.bossCap); }
  boom(r0, r1, color) {
    const sc = this.scene, t = sc.tower;
    sc.fx.ripple(t.x, t.y, color, r0, r1); sc.fx.explode(t.x, t.y, color, 40); sc.fx.shake(0.02, 600); sc.sfx.play('bigExplode', null, t.x);
  }

  /** Swarm Protocol: every drone hunts what the beam drones hold */
  shareTargets(mobs) {
    const bays = this.bays(), beams = bays.find(b => b.type === 'beamdrones');
    if (!beams) return;
    const held = new Set(); for (const d of beams.drones) if (d.alive && d.beams) for (const m of d.beams) if (!m.dead) held.add(m);
    if (!held.size) return;
    const list = [...held];
    for (const bay of bays) { if (bay === beams) continue; let i = 0; for (const d of bay.drones) { if (!d.alive) continue; if (!d.target || !held.has(d.target)) d.target = list[i++ % list.length]; } }
  }

  draw(g) {
    const sc = this.scene, t = sc.tower;
    if (this.tempKz) this.tempKz.draw(g);
    if (this.overdriveT > 0) { const k = 0.5 + 0.5 * Math.sin(sc.time.now / 60); g.lineStyle(3, COLORS.orange, 0.3 + 0.4 * k); g.strokeCircle(t.x, t.y, t.shieldR + 14); }
    if (!this.ult) return;
    const u = this.ult, range = t.maxRange();
    if (u.id === 'hivecollapse') { const R = t.shieldR + 30, k = 0.5 + 0.5 * Math.sin(u.t * 12); g.lineStyle(3, COLORS.gold, 0.5 + 0.4 * k); g.strokeCircle(t.x, t.y, R); g.lineStyle(1, COLORS.white, 0.3); g.strokeCircle(t.x, t.y, R + 8 + u.t * 10); }
    if (u.id === 'coherence') {
      const a = (u.t / ULTS.coherence.dur) * TAU * T.coherence.sweeps;
      for (let i = 0; i < 5; i++) { const aa = a - i * 0.06; g.lineStyle(12 - i * 2, COLORS.white, 0.5 - i * 0.08); g.lineBetween(t.x, t.y, t.x + Math.cos(aa) * range, t.y + Math.sin(aa) * range); }
      g.lineStyle(3, COLORS.cyan, 0.9); g.lineBetween(t.x, t.y, t.x + Math.cos(a) * range, t.y + Math.sin(a) * range);
    }
    if (u.id === 'fortress') { const R = t.shieldR + 40, k = 0.5 + 0.5 * Math.sin(u.t * 10); g.lineStyle(9, COLORS.ice, 0.45 + 0.3 * k); g.strokeCircle(t.x, t.y, R); g.lineStyle(2, COLORS.white, 0.7); g.strokeCircle(t.x, t.y, R + 5); }
    if (u.id === 'tempest') { const k = u.t / ULTS.tempest.dur; g.fillStyle(COLORS.ice, 0.05 + 0.03 * Math.sin(u.t * 9)); g.fillCircle(t.x, t.y, range); g.lineStyle(2, COLORS.ice, 0.5); g.strokeCircle(t.x, t.y, range); for (let i = 0; i < 4; i++) { const a0 = u.t * (i % 2 ? -1.2 : 1.6) + i * 1.5; g.lineStyle(1.5, COLORS.white, 0.3); g.beginPath(); g.arc(t.x, t.y, range * (0.4 + i * 0.15), a0, a0 + 1.2, false); g.strokePath(); } }
    if (u.id === 'pandemic') { g.lineStyle(2, COLORS.green, 0.4 + 0.3 * Math.sin(u.t * 6)); g.strokeCircle(t.x, t.y, range); }
    if (u.id === 'barrage') { g.lineStyle(3, COLORS.orange, 0.5 + 0.4 * Math.sin(u.t * 20)); g.strokeCircle(t.x, t.y, t.shieldR + 10); }
    if (u.id === 'eventhorizon') {
      const k = u.t / ULTS.eventhorizon.dur;
      g.fillStyle(COLORS.violet, 0.06 + 0.1 * k); g.fillCircle(t.x, t.y, range);
      for (let i = 0; i < 4; i++) { const rr = range * (1 - ((k * 1.5 + i * 0.25) % 1)); g.lineStyle(2, COLORS.violet, 0.5); g.strokeCircle(t.x, t.y, rr); }
      g.fillStyle(0x05060d, 0.6 * k); g.fillCircle(t.x, t.y, t.shieldR + t.r + T.horizon.crushR);
    }
  }
}
