// Sieges: every SIEGE.every threat levels a titan and its wardens arrive and time freezes until they are dead.
import { SPAWN, SIEGE } from '../config.js';
import { Titan, Warden } from '../mobs.js';
import { TAU } from '../utils.js';

const ICONS_SIEGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2l3 6 6 1-4.5 4 1.5 6-6-3-6 3 1.5-6L3 9l6-1z"/></svg>`;
const SIEGE_COLOR = 0xff4d6d;
const WARDEN_ANGLE_STEP = 0.35;      // radians between wardens fanned out around the titan
const WARDEN_EXTRA_RADIUS = 60;      // wardens spawn a bit further out than the titan
const EFFECT_UNTIL_REMOVED = 9999;   // effect chip duration for effects that are removed explicitly

/** The threat level at which the next siege starts. */
export function nextSiegeTier(scene) { return SIEGE.every * (scene.siegesCleared + 1); }

export function startSiege(scene, level) {
  const R = scene.spawnRadius(), a = Math.random() * TAU;
  const tower = scene.tower;
  const titan = new Titan(scene, scene.tier, tower.x + Math.cos(a) * R, tower.y + Math.sin(a) * R, level);
  scene.mobs.push(titan);
  const n = SIEGE.wardens + SIEGE.wardensPerLevel * (level - 1), wardens = [];
  for (let i = 0; i < n; i++) {
    const wa = a + (i - (n - 1) / 2) * WARDEN_ANGLE_STEP;   // centred fan around the titan's angle
    const wr = R + WARDEN_EXTRA_RADIUS;
    const w = new Warden(scene, scene.tier, tower.x + Math.cos(wa) * wr, tower.y + Math.sin(wa) * wr, titan);
    scene.mobs.push(w); wardens.push(w);
  }
  scene.siege = { level, titan, wardens, t: 0 };
  scene.ui.banner(`SIEGE · ${titan.def.name} ${level > 1 ? 'Mk ' + level : ''}`, true);
  scene.tx.say('siege');
  scene.sfx.play('boss'); scene.flashScreen(0.35, SIEGE_COLOR); scene.slowMo(0.3, 0.8);
  scene.ui.addEffect('siege', { name: 'Siege', color: SIEGE_COLOR, dur: EFFECT_UNTIL_REMOVED, sub: 'kill wardens first', icon: ICONS_SIEGE });
}

/** Tick the siege timer; once the titan and wardens are all dead, pay out and jump time to the next threat level. */
export function updateSiege(scene, dt) {
  const sg = scene.siege; sg.t += dt;
  const alive = scene.mobs.filter(m => !m.dead && (m.type === 'titan' || m.type === 'warden'));
  if (alive.length) return;
  // cleared
  scene.siegesCleared++;
  scene.siege = null;
  const frag = Math.round((SIEGE.fragments + SIEGE.fragmentsPerLevel * (sg.level - 1)) * scene.levelMods.fragments);
  scene.state.fragments += frag;
  scene.state.time = SIEGE.every * sg.level * SPAWN.tierSeconds + 0.01;   // jump to next threat level
  scene.ui.banner('Siege broken', false);
  scene.tx.say('siegeDead');
  scene.fx.floater(scene.tower.x, scene.tower.y - 110, `+${frag} fragments`, '#c084fc', 22);
  scene.sfx.play('tier');
  scene.ui.removeEffect('siege');
  scene.saves.save();
}
