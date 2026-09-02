// Panel tab markup: Tower (hardpoints, combos), Upgrades (core, tower upgrades, auto-buy) and Skills (prestige, tree).
// Every function returns an HTML string; ui.js swaps it into the tab and binds the buttons.
import { TOWER_UPGRADES, TOWER, WEAPONS, CRIT, PRESTIGE, SLOT_COSTS } from '../config.js';
import { ICONS } from '../icons.js';
import { TREE, BRANCHES } from '../tree.js';
import { AUTO_ITEMS } from '../autobuy.js';
import { fmt, hex, attrQuote } from './dom.js';
import { row, buyBtn, disabledBtn, nextLine, gateLine, vsLine } from './rows.js';
import { isMounted } from './purchases.js';
import { weaponTip } from './effects.js';

/** How many auto-buy entries the queue card and the side list show. */
export const QUEUE_LEN = 8;
const SUPER_CRIT_COLOR = '#ff5e5b';
const BORDER_ALPHA = '55';     // hex alpha appended to a weapon's colour for its card border
const OWNED_ALPHA = '66';      // same for owned skills and active combos

// ---- Tower tab ------------------------------------------------------------

const critLine = (def) =>
  `<span class="crit">${Math.round((def.crit ?? CRIT.chance) * 100)}% crit ×${def.critMul ?? CRIT.mul}</span> · ` +
  `<span class="crit" style="color:${SUPER_CRIT_COLOR}">${Math.round(CRIT.superChance * 100)}% of crits ×${CRIT.superMul} again</span>`;

function swapReason(cur, dup, swapsLeft, scrap, install) {
  if (cur) return 'mounted in this slot';
  if (dup) return 'already mounted in another slot';
  if (swapsLeft <= 0) return 'no swaps left this run';
  if (scrap < install) return 'need ' + fmt(install) + ' scrap';
  return 'swap in · starts at Lv 1 · ' + fmt(install) + ' scrap';
}

function swapButton(scene, w, slot, type, swapsLeft) {
  const d = WEAPONS[type], scrap = scene.state.scrap;
  const cur = type === w.type, dup = !cur && isMounted(scene.tower, type, slot);
  const can = !cur && !dup && swapsLeft > 0 && scrap >= d.install;
  const tip = attrQuote(weaponTip(type, swapReason(cur, dup, swapsLeft, scrap, d.install)));
  return `<button class="swap-ic${cur ? ' cur' : ''}${dup ? ' dup' : ''}" data-buy="doswap:${slot}:${type}" ` +
    `${cur || !can ? 'disabled' : ''} style="color:${hex(d.color)}" data-tip="${tip}">${ICONS[type]}</button>`;
}

/** Row of weapon icons under a mounted weapon: click one to refit the slot. */
function swapStrip(scene, w, slot) {
  const swapsLeft = scene.swapsLeft();
  const buttons = Object.keys(WEAPONS).filter(type => scene.tree.unlocked(type))
    .map(type => swapButton(scene, w, slot, type, swapsLeft)).join('');
  return `<div class="swap-strip"><span class="swap-lbl">swap<b class="${swapsLeft ? '' : 'none'}">${swapsLeft} left</b></span>${buttons}</div>`;
}

function droneModeRow(w, slot) {
  if (w.type !== 'drones') return '';
  return `<div class="mode-row"><span class="swap-lbl">drones</span>` +
    `<button class="mode ${w.focus ? '' : 'on'}" data-buy="dmode:${slot}:spread">Spread</button>` +
    `<button class="mode ${w.focus ? 'on' : ''}" data-buy="dmode:${slot}:focus">Focus fire</button>` +
    `<span class="muted" style="font-size:11px">${w.focus ? 'all drones on one target' : 'each drone its own target'}</span></div>`;
}

function weaponRow(scene, w, slot) {
  const cost = w.upgradeCost(), c = hex(w.color);
  return row({
    cls: 'weapon', style: `border-color:${c}${BORDER_ALPHA}`, icon: ICONS[w.type], iconStyle: `color:${c}`,
    name: w.def.name, sub: `Lv ${w.level}`,
    desc: `${w.statLine()}<br>${nextLine(`Lv ${w.level + 1}: ${w.nextLine()}`)}<br>${vsLine(w.def)} · ${critLine(w.def)}`,
    button: buyBtn('weapon:' + slot, cost, scene.state.scrap >= cost),
    extra: droneModeRow(w, slot) + swapStrip(scene, w, slot),
  });
}

/** Empty hardpoint: a header row and one pick row per weapon type. */
function emptySlotRows(scene, slot) {
  const scrap = scene.state.scrap;
  let html = row({ cls: 'slot-empty', icon: ICONS.slot, name: `Hardpoint ${slot + 1}`, desc: 'Choose a weapon to mount' });
  for (const [type, d] of Object.entries(WEAPONS)) {
    const c = hex(d.color), ok = scene.tree.unlocked(type), dup = isMounted(scene.tower, type);
    const button = !ok ? disabledBtn('Locked')
      : dup ? disabledBtn('Mounted')
      : buyBtn(`install:${slot}:${type}`, d.install, scrap >= d.install, 'Mount');
    html += row({
      cls: `pick${ok && !dup ? '' : ' gated'}`, icon: ICONS[type], iconStyle: `color:${c}`, name: d.name, nameStyle: `color:${c}`,
      desc: `${d.desc}<br>${vsLine(d)}${ok ? '' : '<br>' + gateLine('Unlock in Skills with fragments')}`, button,
    });
  }
  return html;
}

function nextSlotRow(t, scrap) {
  const cost = t.nextSlotCost(), gate = t.nextSlotGate(), where = `Slot ${t.slots.length + 1} of ${SLOT_COSTS.length}<br>`;
  if (cost !== null) {
    return row({
      cls: 'slot-empty', icon: ICONS.slot, name: 'Locked hardpoint',
      desc: where + nextLine('Unlock: mount any weapon here, fires on its own'), button: buyBtn('slot', cost, scrap >= cost, 'Unlock'),
    });
  }
  if (gate) {
    return row({
      cls: 'slot-empty gated', icon: ICONS.slot, name: 'Sealed hardpoint',
      desc: where + gateLine(`Opens at threat level ${gate} · ${fmt(SLOT_COSTS[t.slots.length])} scrap`), button: disabledBtn(`Threat ${gate}`),
    });
  }
  return '';
}

function comboRow(scene, c) {
  const col = hex(c.color), names = c.pair.map(p => WEAPONS[p].name).join(' + ');
  const icons = c.pair.map(p =>
    `<span class="pi ${scene.combos.mounted(p) ? 'on' : ''}" style="color:${hex(WEAPONS[p].color)}" title="${WEAPONS[p].name}">${ICONS[p]}</span>`,
  ).join('<span class="plus">+</span>');
  const status = c.cd > 0 ? Math.ceil(c.cd) + 's cooldown' : c.available ? 'ready' : 'not mounted';
  return row({
    cls: `combo${c.available ? ' on' : ''}`, style: c.available ? `border-color:${col}${OWNED_ALPHA}` : '',
    icon: icons, iconCls: 'pair', name: c.name, nameStyle: c.available ? `color:${col}` : '', sub: names,
    desc: `${c.desc}<br>${nextLine(`${Math.round(c.chance * 100)}% chance · ${status}`)}`,
  });
}

/** Collapsible combo list: collapsed shows only the combos that are currently mounted. */
function combosSection(ui) {
  const scene = ui.scene, combos = scene.combos.list(), open = ui.combosOpen;
  const activeN = combos.filter(c => c.available).length;
  let html = `<h3 class="collapsible" data-buy="toggle:combos">Combos ` +
    `<span class="muted" style="letter-spacing:0">${activeN} active</span><span class="chev">${open ? '▾' : '▸'}</span></h3>`;
  if (open) html += '<div class="muted" style="margin-bottom:8px">Mount both weapons. Each shot has a small chance to trigger the combo.</div>';
  for (const c of combos) if (open || c.available) html += comboRow(scene, c);
  return html;
}

export function renderTowerTab(ui) {
  const scene = ui.scene, t = scene.tower;
  let html = `<h3>Hardpoints <span class="muted" style="float:right;letter-spacing:0">swaps left: <b>${scene.swapsLeft()}</b></span></h3>`;
  t.slots.forEach((w, i) => { html += w ? weaponRow(scene, w, i) : emptySlotRows(scene, i); });
  html += nextSlotRow(t, scene.state.scrap);
  html += combosSection(ui);
  return html;
}

// ---- Upgrades tab ---------------------------------------------------------

function coreStatusRow(t) {
  const calm = t.calm ? ` <b>(calm ×${TOWER.calmRegenMul})</b>` : '';
  return row({
    icon: ICONS.hull, name: 'Core',
    desc: `Shield <b>${Math.ceil(t.shield)} of ${t.shieldMax}</b> · regen <b>${t.shieldRegen.toFixed(1)}</b> per s${calm}<br>` +
      `Hull <b>${Math.ceil(t.hull)} of ${t.hullMax}</b>`,
  });
}

function towerUpgradeRow(t, key, scrap) {
  const u = TOWER_UPGRADES[key], cost = t.upgradeCost(key), lvl = t.upgrades[key];
  const cur = key === 'shieldMax' ? t.shieldMax : key === 'shieldRegen' ? t.shieldRegen : t.hullMax;
  const fmtU = (v) => key === 'shieldRegen' ? v.toFixed(1) + '/s' : Math.round(v);
  return row({
    icon: ICONS[key], name: u.name, sub: `Lv ${lvl}`,
    desc: `Now <b>${fmtU(cur)}</b><br>${nextLine(`Lv ${lvl + 1}: <b>${fmtU(cur + u.add)}</b> (+${u.add})`)}`,
    button: buyBtn('tower:' + key, cost, scrap >= cost),
  });
}

function autoBuyRow(ab) {
  return row({
    cls: `auto${ab.on ? ' on' : ''}`, icon: ICONS.level, name: 'Auto-buy', sub: ab.on ? 'running' : 'off',
    desc: `Every 0.5 s buys the first affordable item in this order.${ab.lastBuy ? '<br>' + nextLine('Last: ' + ab.lastBuy.label) : ''}`,
    button: `<button class="buy" data-buy="auto:toggle">${ab.on ? 'Turn off' : 'Turn on'}</button>`,
  });
}

function queuePreviewRow(q) {
  if (!q.length) return '';
  const lines = q.map((e, i) =>
    `<span class="${e.now ? 'now' : ''}">${i + 1}. ${e.label}${e.from === null ? '' : ' Lv ' + e.from + '&rarr;' + e.to} <em>${fmt(e.cost)}</em></span>`,
  ).join('<br>');
  return row({ cls: 'queue', icon: ICONS.level, name: 'Queue', sub: `next ${q.length}`, desc: lines });
}

function priorityRow(ab, key, i) {
  const it = AUTO_ITEMS[key], o = ab.option(key), en = ab.enabled[key], last = i === ab.order.length - 1;
  const buttons = `<div class="auto-btns">` +
    `<button class="mini" data-buy="auto:up:${key}" ${i === 0 ? 'disabled' : ''} title="Higher priority">▲</button>` +
    `<button class="mini" data-buy="auto:down:${key}" ${last ? 'disabled' : ''} title="Lower priority">▼</button>` +
    `<button class="mini ${en ? 'on' : ''}" data-buy="auto:on:${key}" title="Enable or skip">${en ? '✓' : '–'}</button></div>`;
  return row({
    cls: `auto-row${en ? '' : ' gated'}`, lead: `<div class="prio">${i + 1}</div>`,
    name: it.name, sub: o ? fmt(o.cost) + ' scrap' : 'nothing to buy', desc: it.desc, extra: buttons,
  });
}

export function renderUpgradesTab(ui) {
  const scene = ui.scene, t = scene.tower, scrap = scene.state.scrap, ab = scene.autobuy;
  let html = '<h3>Status</h3>' + coreStatusRow(t) + '<h3>Tower upgrades</h3>';
  for (const key of Object.keys(TOWER_UPGRADES)) html += towerUpgradeRow(t, key, scrap);
  html += '<h3>Auto-buy</h3>' + autoBuyRow(ab) + queuePreviewRow(ab.queue(QUEUE_LEN));
  ab.order.forEach((key, i) => { html += priorityRow(ab, key, i); });
  return html;
}

// ---- Skills tab -----------------------------------------------------------

function prestigeCard(scene) {
  const canP = scene.canPrestige(), nf = scene.fragmentsForRun();
  return row({
    cls: 'prestige', icon: ICONS.ab_nuke, iconStyle: 'color:var(--violet)', name: 'Prestige', sub: `×${scene.profile.prestige}`,
    desc: `Fragments now: <b class="violet">${fmt(scene.state.fragments)}</b><br>` +
      nextLine(`This run would give <b>${nf}</b>. ${canP ? 'Ready.' : 'Available from threat ' + PRESTIGE.minTier + '.'}`),
    button: `<button class="buy" data-buy="prestige" ${canP ? '' : 'disabled'}>Prestige<span class="cost">+${nf} frag</span></button>`,
  });
}

function skillRow(tr, id, n, branchColor) {
  const lvl = tr.level(id), maxed = lvl >= n.max, locked = n.requires && !tr.level(n.requires);
  const cost = maxed ? 0 : tr.cost(id);
  const icon = n.unlock ? ICONS[n.unlock] : (ICONS[id] || ICONS.level);
  const desc = (lvl ? '<b>' + n.text(lvl) + '</b>' : 'Lv 1: ' + n.text(1)) +
    (lvl && !maxed ? '<br>' + nextLine('Lv ' + (lvl + 1) + ': ' + n.text(lvl + 1)) : '') +
    (locked ? '<br>' + gateLine('Requires ' + TREE[n.requires].name) : '');
  const button = maxed ? disabledBtn('Max')
    : `<button class="buy" data-buy="skill:${id}" ${tr.canBuy(id) ? '' : 'disabled'}>Buy<span class="cost violet">${cost} frag</span></button>`;
  return row({
    cls: `skill${lvl ? ' owned' : ''}${locked ? ' gated' : ''}`, style: lvl ? `border-color:${branchColor}${OWNED_ALPHA}` : '',
    icon, iconStyle: `color:${lvl ? branchColor : 'var(--muted)'}`, name: n.name, sub: `${lvl} / ${n.max}`, desc, button,
  });
}

export function renderSkillsTab(ui) {
  const scene = ui.scene, tr = scene.tree;
  let html = prestigeCard(scene);
  for (const [bk, b] of Object.entries(BRANCHES)) {
    const col = hex(b.color);
    html += `<h3 style="color:${col}">${b.name}</h3>`;
    for (const [id, n] of Object.entries(TREE)) if (n.branch === bk) html += skillRow(tr, id, n, col);
  }
  return html;
}
