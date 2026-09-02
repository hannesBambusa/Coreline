// Markup builders for the panel: item rows, buttons, small text pieces.
import { MOBS } from '../config.js';
import { fmt, hex } from './dom.js';

const attr = (name, v) => v ? ` ${name}="${v}"` : '';

/**
 * One `.item` card. Every field is raw HTML.
 *   lead      replaces the icon cell entirely (auto-buy priority number)
 *   iconCls   extra class on the icon cell ("pair" for combos)
 *   sub       goes into <small> after the name
 *   tag       extra markup after the name's <small>
 *   button    the action button (or '' for none)
 *   extra     trailing rows (swap strip, drone mode row)
 */
export function row({
  cls = '', style = '', lead = '', icon = '', iconCls = '', iconStyle = '',
  name = '', nameStyle = '', sub = '', tag = '', desc = '', button = '', extra = '',
}) {
  const iconCell = lead || `<div class="icon${iconCls ? ' ' + iconCls : ''}"${attr('style', iconStyle)}>${icon}</div>`;
  const small = sub === '' ? '' : `<small>${sub}</small>`;
  return `<div class="item${cls ? ' ' + cls : ''}"${attr('style', style)}>${iconCell}` +
    `<div class="name"${attr('style', nameStyle)}>${name}${small}${tag}</div>` +
    `<div class="desc">${desc}</div>${button}${extra}</div>`;
}

export function buyBtn(id, cost, canAfford, label = 'Upgrade') {
  return `<button class="buy" data-buy="${id}" ${canAfford ? '' : 'disabled'}>${label}<span class="cost">${fmt(cost)} scrap</span></button>`;
}

export const disabledBtn = (label) => `<button class="buy" disabled>${label}</button>`;

/** Small stat lines used inside .desc */
export const nextLine = (html) => `<span class="next">${html}</span>`;
export const gateLine = (html) => `<span class="gate">${html}</span>`;
export const preferNames = (def) => def.prefer.map(p => MOBS[p].name).join(', ');
export const vsLine = (def) => `<span class="vs">×${def.bonus} vs ${preferNames(def)}</span>`;

/** "Lv 3 → 4" or "unlock" for queue / quick-buy entries */
const levelText = (e) => e.from === null ? 'unlock' : `Lv ${e.from} <b>&rarr; ${e.to}</b>`;

/** One <li> for the auto-buy queue and the quick-buy list. */
export function queueItem(e, icon, cls, attrs = '') {
  return `<li class="${cls}"${attrs} style="--qc:${hex(e.color || 0x4ff2ff)}">` +
    `<span class="ic">${icon}</span>` +
    `<span class="txt"><span class="l">${e.label}</span><span class="lv">${levelText(e)}</span></span>` +
    `<span class="c">${fmt(e.cost)}</span></li>`;
}

/** One cell of a .kill-grid (kills, combo procs, abilities used). */
export function gridCell(color, label, value) {
  return `<div class="kill-cell" style="--kc:${color}"><span class="dot"></span><span class="kn">${label}</span><b>${fmt(value)}</b></div>`;
}
