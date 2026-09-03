// Quad combos: four specific weapons mounted together unlock a combo that can escalate into an ultimate.
// First one: the four drone bays → Swarm Protocol, with the Hive Collapse ultimate.
import { COLORS } from '../config.js';
import { ICONS } from '../icons.js';
import { dist, angleTo, TAU } from '../utils.js';

export const QUADS = {
  swarmprotocol: {
    name: 'Swarm Protocol', pair: ['drones', 'beamdrones', 'missiledrones', 'kamikaze'], chance: 0.08, cd: 30, color: 0x60a5fa, effectDur: 10,
    ultimate: { id: 'hivecollapse', name: 'Hive Collapse', chance: 0.25, cd: 90, color: 0xffd166 },
    desc: 'All four drone bays mounted: a drone kill can trigger Swarm Protocol. Every lost drone is rebuilt at once and all bays run at double speed for 10 s, hunting the ships the beam drones hold. One in four procs escalates into the Hive Collapse ultimate.',
    ultDesc: 'Hive Collapse: every drone recalls to the core, the bays overbuild a double swarm, and the whole hive launches as kamikazes in a ring, one per ship, biggest first, each blast at 3× kamikaze damage. Survivors are marked for 10 s and every enemy shot is wiped.',
  },
};

const T = {
  recallT: 1.4, buildT: 0.9,       // ultimate phases: recall to the ring, overbuild, then launch
  ringMul: 1.0,                    // ring radius = shield radius × this + 30
  strikeMul: 3, strikeTurn: 14, strikeSpeed: 520, strikeLife: 3,
  markDur: 10, bossCap: 0.15,
  darken: 0.45,
};

export class Quads {
  constructor(scene) {
    this.scene = scene;
    this.swarmT = 0;           // seconds of Swarm Protocol left
    this.ultCd = 0;
    this.ult = null;           // running Hive Collapse: { phase, t, drones }
    this.pending = false;      // a quad proc waiting for the ultimate roll
  }
  bays() { return this.scene.tower.weapons.filter(w => Array.isArray(w.drones)); }
  available(id) { const q = QUADS[id]; return q.pair.every(t => this.scene.tower.weapons.some(w => w.type === t)); }

  /** called on every kill made by a drone bay */
  onDroneKill() {
    const sc = this.scene, q = QUADS.swarmprotocol;
    if (!this.available('swarmprotocol') || this.ult || this.swarmT > 0) return;
    if (!sc.combos.roll('swarmprotocol')) return;
    // Swarm Protocol itself
    this.swarmT = sc.combos.dur(q.effectDur);
    for (const bay of this.bays()) {
      for (const d of bay.drones) if (!d.alive) { d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.x = sc.tower.x; d.y = sc.tower.y; }
      bay.boost = Math.max(bay.boost, this.swarmT);
    }
    sc.ui.banner('SWARM PROTOCOL', true);
    // the ultimate roll: crit procs always escalate
    const u = q.ultimate;
    if (this.ultCd <= 0 && (sc.combos.lastCrit || Math.random() < u.chance) && !(sc.siege && sc.siege.t < 10)) this.startUltimate();
  }

  startUltimate() {
    const sc = this.scene, u = QUADS.swarmprotocol.ultimate;
    this.ultCd = u.cd;
    this.ult = { phase: 'recall', t: 0 };
    sc.stats.procs[u.id] = (sc.stats.procs[u.id] || 0) + 1;
    sc.ui.addEffect('ult:' + u.id, { name: u.name, color: u.color, dur: T.recallT + T.buildT + 1, sub: 'ULTIMATE', crit: true, icon: QUADS.swarmprotocol.pair.map(p => ICONS[p]).join('') });
    sc.ui.banner('HIVE COLLAPSE', true);
    sc.sfx.play('boss');
    sc.screenFlash.setFillStyle(0x000000); sc.screenFlash.setAlpha(T.darken);
    for (const bay of this.bays()) for (const d of bay.drones) d.target = null;
  }

  update(dt, mobs) {
    const sc = this.scene;
    this.ultCd = Math.max(0, this.ultCd - dt);
    if (this.swarmT > 0) { this.swarmT -= dt; this.shareTargets(mobs); }
    if (!this.ult) return;
    const t = sc.tower, u = this.ult, bays = this.bays();
    u.t += dt;
    const R = t.shieldR * T.ringMul + 30;
    if (u.phase === 'recall') {
      // every drone pulls into a spinning ring on the shield radius
      let i = 0, n = bays.reduce((a, b) => a + b.drones.length, 0);
      for (const bay of bays) for (const d of bay.drones) {
        d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.target = null;
        const a = u.t * 2 + i * TAU / n, tx = t.x + Math.cos(a) * R, ty = t.y + Math.sin(a) * R, k = Math.min(1, dt * 6);
        d.x += (tx - d.x) * k; d.y += (ty - d.y) * k; d.vx = Math.cos(a + Math.PI / 2) * 200; d.vy = Math.sin(a + Math.PI / 2) * 200;
        d.armT = 9; i++;
      }
      if (Math.random() < dt * 30) { const a = Math.random() * TAU; sc.fx.trailAt(t.x + Math.cos(a) * R, t.y + Math.sin(a) * R, COLORS.gold); }
      if (u.t >= T.recallT) { u.phase = 'build'; u.t = 0; sc.fx.ripple(t.x, t.y, COLORS.gold, R, R + 120); sc.sfx.play('shieldBreak'); }
    } else if (u.phase === 'build') {
      let i = 0, n = bays.reduce((a, b) => a + b.drones.length, 0);
      for (const bay of bays) for (const d of bay.drones) { const a = u.t * 3 + i * TAU / n; d.x = t.x + Math.cos(a) * (R + u.t * 40); d.y = t.y + Math.sin(a) * (R + u.t * 40); d.armT = 9; i++; }
      if (Math.random() < dt * 60) { const a = Math.random() * TAU, rr = R + Math.random() * 40; sc.fx.spark(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr, COLORS.gold, 2); }
      if (u.t >= T.buildT) this.launch(mobs);
    }
  }

  /** the collapse: a double swarm launches as kamikazes, one per ship, biggest first */
  launch(mobs) {
    const sc = this.scene, t = sc.tower, bays = this.bays();
    const kz = bays.find(b => b.type === 'kamikaze');
    const count = 2 * bays.reduce((a, b) => a + b.drones.length, 0);
    const targets = mobs.filter(m => !m.dead && dist(t, m) <= kz.range).sort((a, b) => b.hpMax - a.hpMax);
    const R = t.shieldR + 30;
    for (let i = 0; i < count; i++) {
      const a = i * TAU / count, tg = targets.length ? targets[i % targets.length] : null;
      sc.spawnMissile({
        x: t.x + Math.cos(a) * R, y: t.y + Math.sin(a) * R, vx: Math.cos(a) * T.strikeSpeed, vy: Math.sin(a) * T.strikeSpeed,
        speed: T.strikeSpeed, turn: T.strikeTurn, dmg: kz.dmg * T.strikeMul, weapon: kz, splash: kz.blastRadius, color: COLORS.gold, life: T.strikeLife, target: tg,
        onImpact: (m) => { m.marked = Math.max(m.marked || 0, T.markDur); sc.stats.procs.kamikaze = (sc.stats.procs.kamikaze || 0) + 1; },
      });
    }
    // bosses: the strikes still hit, but a hard cap keeps the ultimate a dent, not a delete
    for (const m of targets) if (['boss', 'warlord', 'titan'].includes(m.type)) m.ultCap = m.hp - m.hpMax * T.bossCap;
    sc.enemyBullets = [];
    for (const m of targets) m.marked = Math.max(m.marked || 0, T.markDur);
    // the real drones are rebuilt in place and go back to work
    for (const bay of bays) for (const d of bay.drones) { d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.armT = 0.6; d.target = null; }
    sc.fx.ripple(t.x, t.y, COLORS.gold, R, kz.range);
    sc.fx.explode(t.x, t.y, COLORS.gold, 40);
    sc.fx.shake(0.02, 600);
    sc.sfx.play('bigExplode', null, t.x);
    sc.tweens.add({ targets: sc.screenFlash, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
    this.ult = null;
  }

  /** Swarm Protocol: every drone hunts what the beam drones hold; otherwise its own target */
  shareTargets(mobs) {
    const bays = this.bays(), beams = bays.find(b => b.type === 'beamdrones');
    if (!beams) return;
    const held = new Set(); for (const d of beams.drones) if (d.alive && d.beams) for (const m of d.beams) if (!m.dead) held.add(m);
    if (!held.size) return;
    const list = [...held];
    for (const bay of bays) { if (bay === beams) continue; let i = 0; for (const d of bay.drones) { if (!d.alive) continue; if (!d.target || !held.has(d.target)) d.target = list[i++ % list.length]; } }
  }

  draw(g) {
    if (!this.ult) return;
    const t = this.scene.tower, R = t.shieldR + 30, k = 0.5 + 0.5 * Math.sin(this.ult.t * 12);
    g.lineStyle(3, COLORS.gold, 0.5 + 0.4 * k); g.strokeCircle(t.x, t.y, R);
    g.lineStyle(1, COLORS.white, 0.3); g.strokeCircle(t.x, t.y, R + 8 + this.ult.t * 10);
  }
}
