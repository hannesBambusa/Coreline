// Elite affixes: stat mods applied on spawn, a per-frame tick (healer aura) and the ring drawn around the ship.
// Called through Mob.makeElite / eliteTick / drawElite so subclasses can still override them.
import { ELITES } from '../config.js';
import { TAU, hex, distXY } from '../utils.js';

/** launch speed of the swarm spawned by a dying splitter */
const SPLIT_IMPULSE = 200;
/** spawn offset of split swarm from the dying mob */
const SPLIT_OFFSET = 10;
/** glow enlargement for elites */
const ELITE_GLOW_SCALE = 1.8;

export function makeElite(mob, mod) {
  const d = ELITES.mods[mod];
  mob.elite = mod; mob.eliteDef = d;
  if (d.hp) { mob.hpMax *= d.hp; mob.hp = mob.hpMax; }
  if (d.speed) mob.speedMul = d.speed;
  if (d.alpha) { mob.baseAlpha = d.alpha; mob.sprite.setAlpha(d.alpha); mob.glow.setAlpha(0.2); }
  mob.scrap *= ELITES.scrapMul;
  mob.glow.setScale(mob.glow.scaleX * ELITE_GLOW_SCALE);
  mob.scene.fx.floater(mob.x, mob.y - mob.r - 14, d.name + ' ' + mob.def.name, hex(d.color), 12);
}

export function eliteTick(mob, dt) {
  if (mob.elite !== 'healer') return;
  // heal every damaged mob inside the aura
  for (const o of mob.scene.mobs) {
    if (o.dead || o.hp >= o.hpMax) continue;
    if (distXY(mob.x, mob.y, o.x, o.y) <= mob.eliteDef.radius) {
      o.hp = Math.min(o.hpMax, o.hp + o.hpMax * mob.eliteDef.heal * dt);
    }
  }
  // ~6 aura motes per second at a random point inside the radius
  if (Math.random() < dt * 6) {
    const a = Math.random() * TAU, rr = Math.random() * mob.eliteDef.radius;
    mob.scene.fx.trailAt(mob.x + Math.cos(a) * rr, mob.y + Math.sin(a) * rr, mob.eliteDef.color);
  }
}

export function drawElite(mob, g) {
  if (!mob.elite) return;
  const p = 0.5 + 0.5 * Math.sin(mob.scene.time.now / 150);
  g.lineStyle(2, mob.eliteDef.color, 0.5 + p * 0.4);
  g.strokeCircle(mob.x, mob.y, mob.r + 6);
  if (mob.elite === 'healer') { g.lineStyle(1, mob.eliteDef.color, 0.15); g.strokeCircle(mob.x, mob.y, mob.eliteDef.radius); }
}

/** splitter death: scatter `eliteDef.spawn` swarm in random directions */
export function spawnSplit(mob) {
  for (let i = 0; i < mob.eliteDef.spawn; i++) mob.spawnChild('swarm', SPLIT_IMPULSE, { offset: SPLIT_OFFSET });
}
