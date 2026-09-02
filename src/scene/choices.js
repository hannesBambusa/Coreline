// Scene-side glue for the threat-level choice cards. The card data and the mod maths live in ../choices.js.
import { SPAWN } from '../config.js';
import { CHOICES, applyChoice, baseLevelMods, rollChoices } from '../choices.js';
import { ICONS_CHOICE } from './icons.js';
import { pickType } from './spawner.js';

const PARADE_BURST = [10, 20];   // elites spawned the moment Elite parade lands
const STORM = { total: [200, 280], groups: 12, gapMs: 350 };   // Swarm storm opener: this many swarm ships over groups × gap

const CHOICE_COLOR = 0xffd166;

/** Seconds of game time until the next choice tier, from the current run time. */
function secondsUntilNextChoice(scene) {
  const period = SPAWN.tierSeconds * SPAWN.choiceEvery;
  return period - (scene.state.time % period);
}

/** Roll two cards, let fate pick one, apply it at once and show the result top centre. The game keeps running. */
export function offerChoice(scene, tierInt) {
  const opts = rollChoices(scene, tierInt);
  const id = opts[Math.floor(Math.random() * opts.length)];
  scene.ui.showChoice({ tier: tierInt, opts: [id], auto: true });
  scene.tx.say('choice', 120);
  applyPick(scene, id);
}

/** Manual pick (kept for the keyboard shortcut path and old saves with an open choice). */
export function pickChoice(scene, id) {
  if (!scene.choice) return;
  scene.ui.hideChoice(id);
  scene.choice = null;
  scene.choosing = false;
  scene.paused = false;
  document.getElementById('btn-pause').classList.remove('on');
  applyPick(scene, id);
}

/** Apply a card for the coming levels and show its effect chip. */
function applyPick(scene, id) {
  scene.levelMods = applyChoice(id, baseLevelMods());
  scene.levelChoice = id === 'nothing' ? null : id;
  scene.tower.recompute();
  if (id === 'parade') paradeBurst(scene);
  if (id === 'swarmStorm') swarmStorm(scene);
  const c = CHOICES[id];
  if (id !== 'nothing') {
    const tip = c.name + '\n+ ' + c.good + (c.bad ? '\n- ' + c.bad : '') + '\nlasts ' + SPAWN.choiceEvery + ' threat levels';
    scene.ui.addEffect('choice', { name: c.name, color: CHOICE_COLOR, dur: secondsUntilNextChoice(scene), sub: c.good, icon: ICONS_CHOICE, tip });
  }
  scene.sfx.play('buy');
}

/** Elite parade opener: a ring of elites arrives at once (every spawn is elite while the card is active). */
function paradeBurst(scene) {
  const n = Phaser.Math.Between(PARADE_BURST[0], PARADE_BURST[1]), a0 = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    let type = pickType(scene);
    if (type === 'swarm') type = 'raider';   // swarm never goes elite
    scene.spawnMob(type, a0 + i * Math.PI * 2 / n);
  }
  scene.ui.banner(`Elite parade · ${n} elites inbound`, true);
  scene.fx.shake(0.006, 300);
}

/** Swarm storm opener: hundreds of swarm ships pour in from a few directions over a couple of seconds. */
function swarmStorm(scene) {
  const total = Phaser.Math.Between(STORM.total[0], STORM.total[1]), per = Math.ceil(total / STORM.groups);
  const lanes = [0, 1, 2].map(() => Math.random() * Math.PI * 2);
  for (let g = 0; g < STORM.groups; g++) {
    scene.time.delayedCall(g * STORM.gapMs, () => {
      if (scene.gameOver) return;
      const lane = lanes[g % lanes.length];
      for (let i = 0; i < per; i++) scene.spawnMob('swarm', lane + (Math.random() - 0.5) * 0.6);
    });
  }
  scene.ui.banner(`Swarm storm · ${total} swarm inbound`, true);
  scene.tx.say('surge', 0);
  scene.fx.shake(0.008, 400);
}
