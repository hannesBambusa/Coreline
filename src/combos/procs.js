// Second wave of weapon combos. Each weapon calls the hook for its event; the hook rolls the combos that pair it
// with whatever else is mounted and applies the effect. Card text lives in ../combos.js (COMBOS).
import { COLORS } from '../config.js';
import { dist, angleTo, nearest, minBy, TAU } from '../utils.js';

const DEAD_AGE = 999;
const T = {
  sabot: { count: 6, spread: 0.12, dmgMul: 1.5, speedMul: 1.3 },
  orbital: { count: 8, dmgMul: 2 },
  flak: { count: 16, dmgMul: 1.2, dur: 10 },
  gunrun: { burst: 3, spread: 0.15 },
  slingshot: { dpsMul: 2 },
  spotter: { markDur: 10 },
  ionwarhead: { reach: 200, count: 4, dmgMul: 0.8 },
  guided: { dmgMul: 2 },
  concussion: { splashMul: 2, volley: 12, dmgMul: 1.5 },
  conductor: { chains: 3, dmgMul: 2 },
  lensing: { dur: 3, dmgMul: 0.5 },
  relay: { reach: 160, dmgMul: 0.7 },
  orbitstrike: { markDur: 10, boost: 10 },
  dilation: { boost: 10, rollPerSec: 0.5 },
  staticfield: { stun: 1 },
  spore: { gen: 1 },
  accretion: { boost: 10 },
  collapsar: { count: 3, dmgMul: 3 },
  prism: { dur: 10 },
  lattice: { dmgMul: 0.8 },
  thunderhead: { dmgMul: 0.9 },
  downburst: { dmgMul: 4 },
  seekers: { dmgMul: 2 },
  painted: { markDur: 10 },
  escortvolley: { burst: 3, spread: 0.15 },
  laserguided: { dmgMul: 2, turnMul: 3 },
  wingmen: { boost: 10, burst: 3, spread: 0.15 },
  targetlock: { dmgMul: 2 },
  chainblast: { salvo: 2 },
  prismcannon: { dmgMul: 3 },
  ricochetfield: { pierce: 2 },
  focalpoint: { dmgMul: 2 },
};

const mounted = (tower, type) => tower.weapons.find(w => w.type === type);
const anyBay = (tower) => tower.weapons.find(w => Array.isArray(w.drones));   // drone bay or beam drones
const bulletLife = (w) => w.range / w.def.speed + 0.2;

function bullet(sc, w, x, y, a, dmg, speed = w.def.speed, target = null) {
  sc.spawnBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, weapon: w, color: w.color, life: bulletLife(w), target });
}
function liveDrones(bay) { return bay ? bay.drones.filter(d => d.alive) : []; }

// ---- pulse cannon shot ----
export function onPulseShot(w, target, mobs) {
  const sc = w.scene, tw = w.tower;
  // Orbital rounds: a ring of bullets bursts out of the active well
  const well = sc.wells[0];
  if (well && mounted(tw, 'gravity') && sc.combos.roll('orbital')) {
    for (let i = 0; i < T.orbital.count; i++) bullet(sc, w, well.x, well.y, i * TAU / T.orbital.count, w.dmg * T.orbital.dmgMul);
    sc.fx.ripple(well.x, well.y, w.color, 6, well.r);
  }
  // Gun run: every drone with a target fires a burst at it
  const bay = anyBay(tw), ds = liveDrones(bay).filter(d => d.target && !d.target.dead);
  if (ds.length && sc.combos.roll('gunrun')) {
    for (const d of ds) {
      const a = angleTo(d, d.target);
      for (let i = 0; i < T.gunrun.burst; i++) bullet(sc, bay, d.x, d.y, a + (i - 1) * T.gunrun.spread, bay.dmg, bay.def.speed, d.target);
      sc.fx.flash(d.x, d.y, bay.color, 0.5);
    }
  }
}

// ---- railgun shot: `a` is the beam angle, `m` the muzzle ----
export function onRailShot(w, target, mobs, a, m) {
  const sc = w.scene, tw = w.tower;
  // Sabot volley: pulse bullets fan out along the beam
  const pulse = mounted(tw, 'pulse');
  if (pulse && sc.combos.roll('sabot')) {
    for (let i = 0; i < T.sabot.count; i++) bullet(sc, pulse, m.x, m.y, a + (i - (T.sabot.count - 1) / 2) * T.sabot.spread, pulse.dmg * T.sabot.dmgMul, pulse.def.speed * T.sabot.speedMul);
  }
  // Slingshot: the nearest well is yanked onto the target and doubles its damage
  const well = sc.wells.length && mounted(tw, 'gravity') ? minBy(sc.wells, x => dist(x, target)) : null;
  if (well && !target.dead && sc.combos.roll('slingshot')) {
    sc.fx.ripple(well.x, well.y, COLORS.violet, well.r, 4);
    well.x = target.x; well.y = target.y; well.dps *= T.slingshot.dpsMul;
    sc.fx.ripple(well.x, well.y, COLORS.violet, 4, well.r);
  }
  // Spotter: the target is marked and every drone goes for it
  const bay = anyBay(tw);
  if (bay && !target.dead && sc.combos.roll('spotter')) {
    target.marked = Math.max(target.marked || 0, sc.combos.dur(T.spotter.markDur));
    for (const d of liveDrones(bay)) d.target = target;
    sc.fx.ripple(target.x, target.y, COLORS.sky, target.r, target.r + 30);
  }
}

// ---- missile launch: may retarget / buff the missile object before it flies ----
export function onMissileLaunch(w, missile) {
  const sc = w.scene, laser = mounted(w.tower, 'laser');
  // Guided burn: the missile homes on the laser's target for double damage
  if (laser && laser.target && !laser.target.dead && sc.combos.roll('guided')) {
    missile.target = laser.target; missile.dmg *= T.guided.dmgMul; missile.color = COLORS.magenta; missile.turn *= 2;
  }
}

// ---- missile impact (after its own splash) ----
export function onMissileImpact(scene, m) {
  const tw = scene.tower, tesla = mounted(tw, 'tesla'), ns = mounted(tw, 'nanite');
  // Ion warheads: arcs from the impact into nearby ships
  if (tesla && scene.combos.roll('ionwarhead')) {
    const pool = scene.mobs.filter(o => !o.dead && dist(o, m) <= T.ionwarhead.reach).sort((p, q) => dist(p, m) - dist(q, m)).slice(0, T.ionwarhead.count);
    for (const o of pool) { scene.fx.bolt(m.x, m.y, o.x, o.y, tesla.color); scene.hit(o, tesla, o.x, o.y, { mul: T.ionwarhead.dmgMul, color: '#9be7ff' }); }
  }
  // Spore warheads: everything in the splash is infected
  if (ns && scene.combos.roll('spore')) {
    for (const o of scene.mobs) if (!o.dead && dist(o, m) <= m.splash + o.r) ns.infect(o, T.spore.gen);
    scene.fx.ripple(m.x, m.y, ns.color, 6, m.splash);
  }
}

// ---- tesla: called before the chain with the first target; returns extra chains and a damage multiplier ----
export function onTeslaShot(w, target) { return { chains: 0, mul: 1 }; }

// ---- tesla: after the chain, with the set of ships hit ----
export function onTeslaChain(w, hitSet, mobs) {
  const sc = w.scene, tw = w.tower, hits = [...hitSet].filter(o => !o.dead);
  if (!hits.length) return;
  // Relay net: the arc jumps to every drone and from each drone into the nearest fresh ship
  const bay = anyBay(tw), ds = liveDrones(bay);
  if (ds.length && sc.combos.roll('relay')) {
    const last = hits[hits.length - 1];
    for (const d of ds) {
      sc.fx.bolt(last.x, last.y, d.x, d.y, w.color);
      const o = nearest(mobs, d.x, d.y, T.relay.reach, x => !hitSet.has(x));
      if (o) { hitSet.add(o); sc.fx.bolt(d.x, d.y, o.x, o.y, w.color); sc.hit(o, w, o.x, o.y, { mul: T.relay.dmgMul, color: '#9be7ff' }); }
    }
  }
  // Conductor: the arc leaps onto the laser target and runs three hot extra hops from there
  const laser = mounted(tw, 'laser'), lt = laser && laser.target && !laser.target.dead ? laser.target : null;
  if (lt && dist(tw, lt) <= w.range && sc.combos.roll('conductor')) {
    let from = hitSet.has(lt) ? lt : hits[hits.length - 1], cur = lt, mul = T.conductor.dmgMul;
    for (let i = 0; i <= T.conductor.chains && cur; i++) {
      if (cur !== from) sc.fx.bolt(from.x, from.y, cur.x, cur.y, COLORS.magenta);
      sc.hit(cur, w, cur.x, cur.y, { mul, color: '#ff3df2', size: 14 });
      hitSet.add(cur); hits.push(cur); from = cur; mul *= 0.8;
      cur = nearest(mobs, cur.x, cur.y, w.def.chainRange, x => !hitSet.has(x));
    }
  }
  // Arc lattice: an arc that hit a beamed ship jumps to every ship the beam drones hold
  const bd = mounted(tw, 'beamdrones');
  if (bd) {
    const beamed = new Set(); for (const d of bd.drones) if (d.alive && d.beams) for (const o of d.beams) if (!o.dead) beamed.add(o);
    if (hits.some(o => beamed.has(o)) && sc.combos.roll('lattice')) {
      const last = hits[hits.length - 1];
      for (const o of beamed) if (!hitSet.has(o)) { hitSet.add(o); sc.fx.bolt(last.x, last.y, o.x, o.y, bd.color); sc.hit(o, w, o.x, o.y, { mul: T.lattice.dmgMul, color: '#ff3df2' }); }
    }
  }
  // Thunderhead: an arc that reached a ship inside the storm jumps to everything in that cloud
  const storm = mounted(tw, 'ionstorm');
  if (storm) {
    const seed = hits.find(o => storm.shipsAround(o.x, o.y, mobs).length);
    if (seed && sc.combos.roll('thunderhead')) {
      for (const o of storm.shipsAround(seed.x, seed.y, mobs)) if (!hitSet.has(o)) { hitSet.add(o); sc.fx.bolt(seed.x, seed.y, o.x, o.y, storm.color); sc.hit(o, w, o.x, o.y, { mul: T.thunderhead.dmgMul, color: '#9be7ff' }); }
    }
  }
  // Static field: ships arced inside the chrono field lock up
  const cf = mounted(tw, 'chrono');
  if (cf && hits.some(o => dist(tw, o) <= cf.range) && sc.combos.roll('staticfield')) {
    for (const o of hits) if (dist(tw, o) <= cf.range) { o.stun = Math.max(o.stun, T.staticfield.stun); o.dodgeVx = 0; o.dodgeVy = 0; }
  }
}

// ---- shock pulse ----
export function onShockPulse(w, mobs) {
  const sc = w.scene, tw = w.tower, t = tw;
  // Flak burst: while active, every pulse throws pulse rounds in every direction (the roll only starts the window)
  const pulse = mounted(tw, 'pulse');
  if (pulse) {
    if (w.flakT <= 0 && sc.combos.roll('flak')) w.flakT = sc.combos.dur(T.flak.dur);
    if (w.flakT > 0) for (let i = 0; i < T.flak.count; i++) { const a = i * TAU / T.flak.count; bullet(sc, pulse, t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r, a, pulse.dmg * T.flak.dmgMul); }
  }
  // Concussion: every missile in flight detonates where it is with a bigger splash, and the pod answers the pulse
  // with a volley at the ships it just threw back
  const pod = mounted(tw, 'missile');
  if (pod && sc.combos.roll('concussion')) {
    // missiles inside the wave pop as the front reaches them, so the detonations ripple outward with the pulse
    const R = w.range, waveT = 0.35;
    for (const m of sc.missiles) {
      if (m.age >= DEAD_AGE) continue;
      const d = dist(t, m); if (d > R + 40) continue;
      const splash = m.splash * T.concussion.splashMul, dmg = m.dmg, color = m.color, weapon = m.weapon;
      m.age = DEAD_AGE;   // gone from flight now; the bang lands when the wave gets there
      sc.time.delayedCall(Math.min(1, d / R) * waveT * 1000, () => {
        if (sc.gameOver) return;
        sc.damageRadius(m.x, m.y, splash, dmg, color, weapon);
        sc.fx.explode(m.x, m.y, color, 26); sc.fx.explode(m.x, m.y, 0xffffff, 8);
        sc.fx.ripple(m.x, m.y, color, 6, splash);
        sc.fx.flash(m.x, m.y, color, 1.4);
        sc.sfx.play('explode', 12, m.x);
      });
    }
    // a ring of heavy missiles out of the pulse, one per nearest ship
    const pool = mobs.filter(o => !o.dead && dist(t, o) <= pod.range).sort((p, q) => dist(t, p) - dist(t, q));
    const n = Math.min(T.concussion.volley, Math.max(pool.length, 1));
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, tg = pool.length ? pool[i % pool.length] : null;
      sc.spawnMissile({ x: t.x + Math.cos(a) * t.r, y: t.y + Math.sin(a) * t.r, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
        speed: pod.def.speed * 1.3, turn: pod.def.turn * 1.5, dmg: pod.dmg * T.concussion.dmgMul, weapon: pod,
        splash: pod.def.splash * pod.wm.splash * (pod.lm.missileSplash || 1) * 1.3, color: 0xff9f43, life: 4, target: tg });
    }
    sc.fx.ripple(t.x, t.y, 0xff9f43, t.shieldR, pod.range * 0.5);
    sc.sfx.shot('missile', t.x);
  }
  // Cluster drop: every missile drone dumps a salvo
  const md = mounted(tw, 'missiledrones'), mds = liveDrones(md).filter(d => d.target && !d.target.dead);
  if (mds.length && sc.combos.roll('cluster')) for (const d of mds) md.launch(d, d.target, Math.max(2, md.salvo));
  // Flashpoint: a fully ramped laser sweeps the ring at once
  const laser = mounted(tw, 'laser');
  if (laser && laser.target && laser.held >= laser.rampTime && sc.combos.roll('flashpoint')) laser.sweep(mobs);
}

// ---- laser: per frame with its current target ----
export function onLaserTick(w, dt, mobs) {
  const sc = w.scene, tw = w.tower;
  // Prism: a fully ramped laser sharpens the drone beams
  const bd = mounted(tw, 'beamdrones');
  if (bd && w.held >= w.rampTime * 0.8 && bd.prismT <= 0 && Math.random() < dt * 2 && sc.combos.roll('prism')) bd.prismT = sc.combos.dur(T.prism.dur);
  // Lensing: the beam through a well refracts onto every ship the well holds
  if (w.lensT > 0) {
    w.lensT -= dt;
    const well = w.lensWell;
    if (well && well.age < well.life) {
      for (const o of mobs) if (!o.dead && o !== w.target && dist(o, well) <= well.r) w.beamDamage(o, w.dmgVs(o) * w.ramp * T.lensing.dmgMul * dt);
      if (Math.random() < dt * 20) sc.fx.trailAt(well.x + (Math.random() - 0.5) * well.r, well.y + (Math.random() - 0.5) * well.r, w.color);
    } else w.lensT = 0;
    return;
  }
  const well = sc.wells.find(x => dist(x, w.target) <= x.r);
  if (well && mounted(tw, 'gravity') && Math.random() < dt * 2 && sc.combos.roll('lensing')) { w.lensT = T.lensing.dur; w.lensWell = well; }
}

// ---- gravity well landed ----
export function onWellLand(scene, well) {
  const tw = scene.tower, bay = anyBay(tw);
  // Downburst: a well inside the storm collapses the cloud onto everything in it
  const storm = mounted(tw, 'ionstorm');
  if (storm) {
    const inCloud = storm.shipsAround(well.x, well.y, scene.mobs);
    if (inCloud.length && scene.combos.roll('downburst')) {
      for (const o of inCloud) { scene.fx.bolt(well.x, well.y, o.x, o.y, storm.color); scene.hit(o, storm, o.x, o.y, { mul: T.downburst.dmgMul, color: '#9be7ff', size: 15 }); }
      scene.fx.ripple(well.x, well.y, storm.color, storm.cloudRadius, 6);
    }
  }
  // Orbit strike: ships in the well are marked and the drones dive on them
  if (!bay) return;
  const inside = scene.mobs.filter(o => !o.dead && dist(o, well) <= well.r);
  if (!inside.length || !scene.combos.roll('orbitstrike')) return;
  for (const o of inside) o.marked = Math.max(o.marked || 0, scene.combos.dur(T.orbitstrike.markDur));
  for (const d of liveDrones(bay)) d.target = minBy(inside, o => dist(d, o));
  bay.boost = Math.max(bay.boost, scene.combos.dur(T.orbitstrike.boost));
  scene.fx.ripple(well.x, well.y, COLORS.sky, well.r, well.r * 0.3);
}

// ---- chrono field: per frame ----
export function onChronoTick(w, dt) {
  const sc = w.scene, bay = anyBay(w.tower);
  // Time dilation: drones run on tower time, everything else crawls
  if (bay && liveDrones(bay).length && Math.random() < dt * T.dilation.rollPerSec && sc.combos.roll('dilation')) bay.boost = Math.max(bay.boost, sc.combos.dur(T.dilation.boost));
}

// ---- nanite shot ----
export function onNaniteShot(w) {
  const sc = w.scene, bay = anyBay(w.tower);
  // Carrier strain: every drone's target is infected
  const ds = liveDrones(bay).filter(d => d.target && !d.target.dead);
  if (ds.length && sc.combos.roll('carrierstrain')) for (const d of ds) { sc.fx.bolt(d.x, d.y, d.target.x, d.target.y, w.color); w.infect(d.target, 1); }
}

// ---- singularity blast ----
export function onSingularityBlast(w, mobs) {
  const sc = w.scene, tw = w.tower, t = tw;
  // Accretion: the blast rebuilds every lost drone at once
  const bay = anyBay(tw);
  if (bay && bay.drones.some(d => !d.alive) && sc.combos.roll('accretion')) {
    for (const d of bay.drones) if (!d.alive) { d.alive = true; d.hp = bay.droneHp; d.respawnT = 0; d.x = t.x; d.y = t.y; sc.fx.flash(t.x, t.y, bay.color, 0.8); }
    bay.boost = Math.max(bay.boost, sc.combos.dur(T.accretion.boost));
  }
  // Collapsar rounds: the three biggest ships in range each eat a triple railgun hit
  const rail = mounted(tw, 'railgun');
  if (rail && sc.combos.roll('collapsar')) {
    const big = mobs.filter(o => !o.dead && dist(t, o) <= w.range + o.r).sort((p, q) => q.hpMax - p.hpMax).slice(0, T.collapsar.count);
    for (const o of big) { sc.fx.line(t.x, t.y, o.x, o.y, rail.color, 4, 0.3); sc.hit(o, rail, o.x, o.y, { mul: T.collapsar.dmgMul, color: '#ffffff', size: 16 }); }
  }
}

// ---- beam drones: once a second while a drone holds a beam ----
export function onBeamTick(w, d, target) {
  const sc = w.scene, bay = mounted(w.tower, 'drones');
  // Painted targets: the beamed ship is marked and the interceptors dive on it
  if (bay && sc.combos.roll('painted')) {
    target.marked = Math.max(target.marked || 0, sc.combos.dur(T.painted.markDur));
    for (const o of liveDrones(bay)) o.target = target;
    sc.fx.ripple(target.x, target.y, w.color, target.r, target.r + 24);
  }
}

// ---- missile drones: after a drone launched at `target`; returns a damage multiplier for that launch ----
export function onDroneMissile(w, d, target) {
  const sc = w.scene, tw = w.tower;
  // Escort volley: the interceptors put bursts into the same ship
  const bay = mounted(tw, 'drones'), ds = liveDrones(bay);
  if (ds.length && sc.combos.roll('escortvolley')) {
    for (const o of ds) { const a = angleTo(o, target); for (let i = 0; i < T.escortvolley.burst; i++) bullet(sc, bay, o.x, o.y, a + (i - 1) * T.escortvolley.spread, bay.dmg, bay.def.speed, target); o.target = target; }
  }
  // Laser guided: a missile at a beamed ship hits for double and turns hard
  const bd = mounted(tw, 'beamdrones');
  if (bd && bd.drones.some(x => x.alive && x.beams && x.beams.includes(target)) && sc.combos.roll('laserguided')) {
    for (const m of sc.missiles) if (m.weapon === w && m.target === target && m.age < 0.05) { m.dmg *= T.laserguided.dmgMul; m.turn *= T.laserguided.turnMul; m.color = bd.color; }
  }
  // Well seekers: a missile at a ship in a well hits for double
  const gw = mounted(tw, 'gravity');
  if (gw && sc.wells.some(x => dist(x, target) <= x.r) && sc.combos.roll('seekers')) {
    for (const m of sc.missiles) if (m.weapon === w && m.target === target && m.age < 0.05) { m.dmg *= T.seekers.dmgMul; m.color = COLORS.violet; }
  }
}

// ---- kamikaze blast at drone `d` (after its own area damage) ----
export function onKamikazeBlast(w, d, mobs) {
  const sc = w.scene, tw = w.tower, R = w.blastRadius;
  const caught = mobs.filter(o => !o.dead && dist(o, d) <= R + o.r);
  // Wingmen: interceptors surge and burst the nearest survivor
  const bay = mounted(tw, 'drones'), ds = liveDrones(bay);
  if (ds.length && sc.combos.roll('wingmen')) {
    bay.boost = Math.max(bay.boost, sc.combos.dur(T.wingmen.boost));
    for (const o of ds) { const tg = nearest(mobs, d.x, d.y, R * 2); if (!tg) break; const a = angleTo(o, tg); for (let i = 0; i < T.wingmen.burst; i++) bullet(sc, bay, o.x, o.y, a + (i - 1) * T.wingmen.spread, bay.dmg, bay.def.speed, tg); }
  }
  // Chain detonation: missile drones salvo everything the blast caught
  const md = mounted(tw, 'missiledrones'), mds = liveDrones(md);
  if (mds.length && caught.length && sc.combos.roll('chainblast')) mds.forEach((o, i) => md.launch(o, caught[i % caught.length], T.chainblast.salvo));
  // Spore bomb: the blast infects
  const ns = mounted(tw, 'nanite');
  if (ns && caught.length && sc.combos.roll('sporebomb')) for (const o of caught) ns.infect(o, 1);
}

/** Target lock: called before the blast damage; returns the multiplier for a kamikaze diving into a beamed ship */
export function kamikazeMul(w, target) {
  const bd = mounted(w.tower, 'beamdrones');
  if (bd && target && bd.drones.some(x => x.alive && x.beams && x.beams.includes(target)) && w.scene.combos.roll('targetlock')) return T.targetlock.dmgMul;
  return 1;
}

// ---- mirrors: `b` is the enemy shot, `shot` the reflected bullet about to spawn (mutable) ----
export function onReflect(w, b, shot) {
  const sc = w.scene, tw = w.tower;
  // Ricochet field: reflected shots pierce
  if (mounted(tw, 'pulse') && sc.combos.roll('ricochetfield')) { shot.pierce = T.ricochetfield.pierce; shot.hitSet = new Set(); }
  // Focal point: a slowed shot comes back harder
  if (mounted(tw, 'chrono') && b.chrono && b.chrono < 1 && sc.combos.roll('focalpoint')) shot.dmg *= T.focalpoint.dmgMul;
  // Prism cannon: the laser fires from the plate at the farthest ship
  const laser = mounted(tw, 'laser');
  if (laser && sc.combos.roll('prismcannon')) {
    const far = sc.mobs.filter(o => !o.dead && dist(tw, o) <= laser.range).sort((p, q) => dist(tw, q) - dist(tw, p))[0];
    if (far) { sc.fx.line(shot.x, shot.y, far.x, far.y, laser.color, 4, 0.5); sc.hit(far, laser, far.x, far.y, { mul: T.prismcannon.dmgMul, color: '#ff3df2', size: 15 }); }
  }
}
