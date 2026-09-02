// Spending scrap: weapons, slots, installs, swaps, abilities, tower upgrades, drone mode.
// Pure game logic: no DOM here. The UI plays sounds and re-renders around it.
import { WEAPONS, ABILITIES } from '../config.js';
import { hex } from '../utils.js';

/** true when `type` is mounted in any slot other than exceptSlot */
export function isMounted(tower, type, exceptSlot = -1) {
  return tower.slots.some((w, i) => w && w.type === type && i !== exceptSlot);
}

/** Buy ids like "weapon:2", "install:1:laser", "doswap:0:railgun". Returns true when scrap changed. */
export function purchase(scene, id) {
  const s = scene.state, t = scene.tower;
  const [kind, arg] = id.split(':');
  const before = s.scrap;
  const spend = (cost) => { s.scrap -= cost; };

  if (kind === 'weapon') {
    const w = t.slots[+arg], cost = w.upgradeCost();
    if (!w.atCap && s.scrap >= cost) { spend(cost); w.level++; }
  } else if (kind === 'slot') {
    const cost = t.nextSlotCost();
    if (cost !== null && s.scrap >= cost) { spend(cost); t.unlockSlot(); }
  } else if (kind === 'install') {
    const [, idx, type] = id.split(':'), cost = WEAPONS[type].install;
    if (t.slots[+idx] === null && !isMounted(t, type) && s.scrap >= cost) { spend(cost); t.installWeapon(+idx, type); }
  } else if (kind === 'dmode') {
    const [, idx, mode] = id.split(':'), w = t.slots[+idx];
    if (w && Array.isArray(w.drones)) w.focus = mode === 'focus';
  } else if (kind === 'doswap') {
    const [, idx, type] = id.split(':'), cost = WEAPONS[type].install, cur = t.slots[+idx];
    const ok = cur && cur.type !== type && !isMounted(t, type, +idx) && scene.swapsLeft() > 0 && s.scrap >= cost;
    if (ok) {
      spend(cost);
      s.swapsUsed = (s.swapsUsed || 0) + 1;
      t.swapWeapon(+idx, type);
      scene.fx.floater(t.x, t.y - 80, 'Refit: ' + WEAPONS[type].name, hex(WEAPONS[type].color), 16);
    }
  } else if (kind === 'ability') {
    const a = scene.abilities, d = ABILITIES[arg];
    if (!a.state[arg].unlocked && s.scrap >= d.cost) { spend(d.cost); a.unlock(arg); }
  } else if (kind === 'tower') {
    const cost = t.upgradeCost(arg);
    if (!t.atCap(arg) && s.scrap >= cost) { spend(cost); t.buyUpgrade(arg); }
  }
  return s.scrap !== before;
}

/** Original quirk: mounting a free weapon counts as a buy for the sound even though scrap did not move. */
export const isFreeInstall = (id) => id.split(':')[0] === 'install' && WEAPONS[id.split(':')[2]].install === 0;
