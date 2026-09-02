// Scene-side glue for the threat-level choice cards. The card data and the mod maths live in ../choices.js.
import { SPAWN } from '../config.js';
import { CHOICES, applyChoice, baseLevelMods, rollChoices } from '../choices.js';
import { ICONS_CHOICE } from './icons.js';

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
  const c = CHOICES[id];
  if (id !== 'nothing') {
    const tip = c.name + '\n+ ' + c.good + (c.bad ? '\n- ' + c.bad : '') + '\nlasts ' + SPAWN.choiceEvery + ' threat levels';
    scene.ui.addEffect('choice', { name: c.name, color: CHOICE_COLOR, dur: secondsUntilNextChoice(scene), sub: c.good, icon: ICONS_CHOICE, tip });
  }
  scene.sfx.play('buy');
}
