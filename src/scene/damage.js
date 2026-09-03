// Hit resolution: type bonus, crit rolls, damage bookkeeping, floating numbers, and area damage.
import { CRIT } from '../config.js';
import { distXY, pushBucket, sumWindow } from '../utils.js';

const MARKED_MUL = 1.5;                // marked ships take 50% more from everything
const CRIT_COLOR = '#ffb703', CRIT_TINT = 0xffb703;
const SUPER_COLOR = '#ff5e5b', SUPER_TINT = 0xff5e5b;
const SUPER_SIZE = 34;
const CRIT_MIN_SIZE = 18;

export function freshStats() {
  return { dmg: {}, crits: {}, killsBy: {}, kills: {}, procs: {}, abilities: {}, hits: {}, critExtra: {}, supers: {}, superExtra: {}, taken: 0, takenBy: {}, total: 0 };
}

const DPS_WINDOW = 20;   // seconds of damage history kept for recentDps

/** Average per second over the last `window` seconds of a per-second bucket log; the log itself keeps DPS_WINDOW. */
function rate(log, now, window) {
  sumWindow(log, now, DPS_WINDOW);   // trims old buckets
  const from = Math.floor(now) - window, span = Math.min(window, Math.max(1, now));
  let sum = 0; for (const e of log) if (e[0] > from) sum += e[1];
  return sum / span;
}

/** Damage dealt per second. Default window is the sustained 20 s figure bosses scale from; the HUD asks for 2 s. */
export function recentDps(scene, window = DPS_WINDOW) { return rate(scene.dmgLog, scene.state.time, window); }

/** Damage the core took per second, same windows. */
export function recentTaken(scene, window = DPS_WINDOW) { return rate(scene.takenLog, scene.state.time, window); }
export function logTaken(scene, amount) { pushBucket(scene.takenLog, Math.floor(scene.state.time), amount); }

export function addDmg(scene, source, amount, crit = false) {
  const st = scene.stats;
  if (amount > 0) pushBucket(scene.dmgLog, Math.floor(scene.state.time), amount);
  st.dmg[source] = (st.dmg[source] || 0) + amount;
  st.total += amount;
  if (crit) st.crits[source] = (st.crits[source] || 0) + 1;
}

/** Base damage for this hit: explicit override, else the weapon's damage (with type bonus), scaled by mul and mark. */
function baseDamage(m, weapon, bonus, opts) {
  let d = opts.dmg ?? (bonus ? weapon.dmgVs(m) : (weapon ? weapon.dmg : 0));
  if (opts.mul) d *= opts.mul;
  if (m.marked > 0) d *= MARKED_MUL;
  return d;
}

/** Crit chance = weapon's own chance (or the global one) plus tree and level bonuses. No weapon means no crit. */
function rollCrit(scene, weapon, opts) {
  const chance = weapon ? (weapon.def.crit ?? CRIT.chance) + scene.tree.mods.crit + scene.levelMods.crit : 0;
  return !opts.noCrit && (scene.afterglow > 0 || Math.random() < chance);
}

function rollSuperCrit(crit) { return crit && Math.random() < CRIT.superChance; }

/** Multiply for a crit, record the extra damage, and play the crit feedback. Returns the new damage and label. */
function applyCrit(scene, m, weapon, d, srcKey, x, y, label) {
  const dBase = d;
  d *= (weapon.def.critMul ?? CRIT.mul) + scene.tree.mods.critMul;
  scene.stats.critExtra[srcKey] = (scene.stats.critExtra[srcKey] || 0) + (d - dBase);
  label.text = Math.round(d) + '!'; label.color = CRIT_COLOR; label.size = Math.max(label.size, CRIT_MIN_SIZE);
  scene.fx.spark(x, y, CRIT_TINT, 6);
  scene.fx.ripple(m.x, m.y, CRIT_TINT, m.r, m.r + 18);
  scene.sfx.play('crit', null, m.x);
  return d;
}

/** Triple crit (shown as TRIPLE) on top of a crit: bigger multiplier, bigger show. Returns the new damage. */
function applySuperCrit(scene, m, d, srcKey, label) {
  const st = scene.stats, dCrit = d;
  d *= CRIT.superMul;
  st.supers[srcKey] = (st.supers[srcKey] || 0) + 1;
  st.superExtra[srcKey] = (st.superExtra[srcKey] || 0) + (d - dCrit);
  label.text = 'TRIPLE ' + Math.round(d) + '!!'; label.color = SUPER_COLOR; label.size = SUPER_SIZE;
  scene.fx.explode(m.x, m.y, SUPER_TINT, 22); scene.fx.explode(m.x, m.y, 0xffffff, 10);
  scene.fx.ripple(m.x, m.y, SUPER_TINT, m.r, m.r + 70); scene.fx.ripple(m.x, m.y, 0xffffff, m.r, m.r + 40);
  scene.fx.flash(m.x, m.y, SUPER_TINT, 2.5);
  scene.fx.shake(0.004, 150);
  scene.sfx.play('superCrit', null, m.x);
  st.superCrits = (st.superCrits || 0) + 1;
  return d;
}

/** Floating damage number above the ship. Quiet hits still show crits. */
function showNumber(scene, m, label, crit, superCrit, opts) {
  if (superCrit) scene.fx.critFloater(m.x, m.y - m.r - 14, label.text, label.color, label.size, true);
  else if (crit) scene.fx.critFloater(m.x, m.y - m.r - 10, label.text, label.color, label.size);
  else if (!opts.quiet && scene.perf.numbers) scene.fx.floater(m.x, m.y - m.r - 6, (opts.tag ? opts.tag + ' ' : '') + label.text, label.color, label.size);
}

/**
 * Resolve one hit: type bonus, crit roll, damage, floating number. Returns damage dealt.
 * opts: { dmg (override base), mul, color, size, quiet, tag, noCrit, source, from }
 */
export function hit(scene, m, weapon, x, y, opts = {}) {
  if (m.dead) return 0;
  const bonus = weapon && weapon.prefers(m);
  let d = baseDamage(m, weapon, bonus, opts);
  const crit = rollCrit(scene, weapon, opts);
  const superCrit = rollSuperCrit(crit);
  const label = { color: opts.color || (bonus ? '#ffe66d' : '#dbe7ff'), size: opts.size || 12, text: Math.round(d) };
  const st = scene.stats, srcKey = weapon ? weapon.type : (opts.source || 'other');
  st.hits[srcKey] = (st.hits[srcKey] || 0) + 1;
  if (crit) d = applyCrit(scene, m, weapon, d, srcKey, x, y, label);
  if (superCrit) d = applySuperCrit(scene, m, d, srcKey, label);
  m.lastHit = srcKey;
  if (m.ultCap !== undefined) { d = Math.max(0, Math.min(d, m.hp - m.ultCap)); if (d <= 0) { m.ultCap = undefined; return 0; } }   // Hive Collapse: bosses lose at most a fixed share
  m.takeDamage(d, x, y, opts.quiet, crit, opts.from || scene.tower);
  addDmg(scene, srcKey, m.lastDealt ?? 0, crit);
  showNumber(scene, m, label, crit, superCrit, opts);
  return d;
}

/** Splash: hit every live ship whose body overlaps the circle, then the burst effect. */
export function damageRadius(scene, x, y, r, dmg, color, weapon) {
  for (const m of scene.mobs) {
    if (m.dead) continue;
    if (distXY(x, y, m.x, m.y) <= r + m.r) {
      const d = weapon && weapon.prefers(m) ? dmg * weapon.def.bonus : dmg;
      scene.hit(m, weapon, m.x, m.y, { dmg: d, color: '#ffb86b', from: { x, y } });
    }
  }
  scene.fx.explode(x, y, color, 18);
  scene.fx.ripple(x, y, color, 10, r);
}

/** Hurt friendly drones in an area (bomber blasts, mines) or along a line (siege beam). */
export function damageDrones(scene, x, y, r, dmg, line = null) {
  for (const bay of scene.tower.weapons) {
    if (!Array.isArray(bay.drones)) continue;
    for (const d of bay.drones) {
      if (!d.alive) continue;
      let inRange;
      if (line) {
        const p = Phaser.Geom.Line.GetNearestPoint(line, d, new Phaser.Geom.Point());
        inRange = distXY(p.x, p.y, d.x, d.y) <= r;
      } else inRange = distXY(x, y, d.x, d.y) <= r + d.r;
      if (inRange) bay.hurt(d, dmg);
    }
  }
}
