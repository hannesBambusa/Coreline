// Scene-side glue for the threat-level choice cards. The card data and the mod maths live in ../choices.js.
import { SPAWN } from '../config.js';
import { CHOICES, applyChoice, baseLevelMods, rollChoices } from '../choices.js';

const ICONS_CHOICE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/></svg>`;
const CHOICE_COLOR = 0xffd166;

/** Seconds of game time until the next choice tier, from the current run time. */
function secondsUntilNextChoice(scene) {
  const period = SPAWN.tierSeconds * SPAWN.choiceEvery;
  return period - (scene.state.time % period);
}

/** Roll the cards, freeze the game and show them. The pause button lights up so the state is visible. */
export function offerChoice(scene, tierInt) {
  const opts = rollChoices(tierInt);
  scene.choice = { tier: tierInt, opts };
  scene.choosing = true;
  scene.paused = true;
  document.getElementById('btn-pause').classList.add('on');
  scene.ui.showChoice(scene.choice);
  scene.tx.say('choice', 120);
}

/** Apply the picked card, unfreeze, and show the effect chip for the levels it lasts. */
export function pickChoice(scene, id) {
  if (!scene.choice) return;
  scene.levelMods = applyChoice(id, baseLevelMods());
  scene.levelChoice = id === 'nothing' ? null : id;
  scene.tower.recompute();
  scene.ui.hideChoice(id);
  scene.choice = null;
  scene.choosing = false;
  scene.paused = false;
  document.getElementById('btn-pause').classList.remove('on');
  const c = CHOICES[id];
  if (id !== 'nothing') {
    const tip = c.name + '\n+ ' + c.good + (c.bad ? '\n- ' + c.bad : '') + '\nlasts ' + SPAWN.choiceEvery + ' threat levels';
    scene.ui.addEffect('choice', { name: c.name, color: CHOICE_COLOR, dur: secondsUntilNextChoice(scene), sub: c.good, icon: ICONS_CHOICE, tip });
  }
  scene.sfx.play('buy');
}
