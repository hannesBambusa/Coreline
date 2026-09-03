// Left-hand effect tray and cooldown cards, tooltips, and the modal overlays (choice, offline, game over).
import { WEAPONS, MOBS } from '../config.js';
import { ICONS } from '../icons.js';
import { CHOICES } from '../choices.js';
import { $, $$, fmt, fmtTime, hex, TAU, restartAnimation } from './dom.js';
import { statsHtml } from './stats.js';

const RING_R = 17;
const RING_C = TAU * RING_R;          // circumference of the countdown ring, for stroke-dasharray
const EFFECT_PERMANENT_S = 9999;      // effects with dur at or above this show no countdown
const EFFECT_FADE_MS = 250;
const CHOICE_FADE_MS = 350;
const CHOICE_AUTO_MS = 4500;   // auto-assigned card stays this long
const ENDING_S = 1;                   // blink when less than this is left
const WHOLE_SECONDS_FROM_S = 10;      // above this show whole seconds, below one decimal
const TIP_GAP = 12, TIP_MARGIN = 8, TIP_DEFAULT_W = 260, TIP_DEFAULT_H = 80;
const DRONE_CARD_NAME = { drones: 'Drones', beamdrones: 'Beam drones', missiledrones: 'Missile drones', kamikaze: 'Kamikaze' };
const COOLDOWN_TYPES = ['drones', 'beamdrones', 'missiledrones', 'kamikaze', 'mirrors', 'railgun', 'shock', 'singularity', 'chrono', 'ionstorm'];   // weapons that get a cooldown card

// ---- Card markup shared by effects and cooldowns -------------------------

const ringSvg = `<svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="${RING_R}"/><circle class="fg" cx="20" cy="20" r="${RING_R}"/></svg>`;
const fxCard = (icon = '', name = '', sub = '') =>
  `<div class="fx-ring">${ringSvg}<div class="fx-icon">${icon}</div></div>` +
  `<div class="fx-text"><div class="fx-name">${name}</div><div class="fx-sub">${sub}</div></div><div class="fx-time"></div>`;

/** The pieces of a card that get updated every tick, looked up once. */
const cardParts = (el) => ({
  el, fg: el.querySelector('.fg'), icon: el.querySelector('.fx-icon'),
  nameEl: el.querySelector('.fx-name'), subEl: el.querySelector('.fx-sub'), timeEl: el.querySelector('.fx-time'),
});
const setRing = (card, f) => { card.fg.style.strokeDasharray = `${RING_C * f} ${RING_C}`; };
const fadeOut = (el) => { el.classList.remove('show'); setTimeout(() => el.remove(), EFFECT_FADE_MS); };
const secondsText = (t) => (t >= WHOLE_SECONDS_FROM_S ? Math.ceil(t) : t.toFixed(1)) + 's';

// ---- Effect tray ----------------------------------------------------------

export function addEffect(ui, id, { name, icon, color, dur, sub, tip, crit = false }) {
  let e = ui.effects[id];
  if (!e) {
    const el = document.createElement('div');
    el.className = 'fx-item';
    el.innerHTML = fxCard();
    $('#effects').appendChild(el);
    e = ui.effects[id] = cardParts(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }
  e.dur = dur; e.left = dur; e.name = name;
  e.el.classList.toggle('crit', crit);
  e.el.style.setProperty('--fx', typeof color === 'number' ? hex(color) : color);
  e.icon.innerHTML = icon;
  e.nameEl.textContent = name;
  e.subEl.textContent = sub || '';
  e.el.dataset.tip = tip || '';
  e.el.onpointerenter = () => showTip(ui, e.el, e.el.dataset.tip || (name + (sub ? '\n' + sub : '')));
  e.el.onpointerleave = () => hideTip(ui);
  restartAnimation(e.el, 'pop');
}

export function removeEffect(ui, id) {
  const e = ui.effects[id];
  if (!e) return;
  if (ui.tipAnchor === e.el) hideTip(ui);
  fadeOut(e.el);
  delete ui.effects[id];
}

export function clearEffects(ui) {
  for (const id of Object.keys(ui.effects)) removeEffect(ui, id);
  hideTip(ui);
}

export function updateEffects(ui, dt) {
  for (const id in ui.effects) {
    const e = ui.effects[id];
    e.left -= dt;
    if (e.left <= 0) { fadeOut(e.el); delete ui.effects[id]; continue; }
    setRing(e, e.left / e.dur);
    e.timeEl.textContent = e.dur >= EFFECT_PERMANENT_S ? '' : secondsText(e.left);
    e.el.classList.toggle('ending', e.left < ENDING_S);
  }
}

// ---- Cooldown cards -------------------------------------------------------

const cooldownCard = (w) =>
  `<div class="fx-item cd show" data-slot="${w.slot}" style="--fx:${hex(w.color)}">${fxCard(ICONS[w.type], w.def.name, 'cooldown')}</div>`;

function updateMirrorCard(card, w) {
  setRing(card, 1);
  const alive = w.plateState.filter(p => p.alive).length, rebuilding = w.plateState.filter(p => !p.alive).sort((a, b) => a.respawnT - b.respawnT)[0];
  setRing(card, rebuilding ? 1 - rebuilding.respawnT / w.def.rebuild : 1);
  card.nameEl.textContent = 'Mirrors';
  card.subEl.textContent = w.jammed > 0 ? 'jammed' : `${alive} / ${w.plates} · ${rebuilding ? 'rebuilding' : w.reflected + ' reflected'}`;
  card.timeEl.textContent = rebuilding ? rebuilding.respawnT.toFixed(1) + 's' : '';
  card.el.classList.toggle('ready', !rebuilding);
  card.el.classList.toggle('jammed', w.jammed > 0);
}

function updateStormCard(card, w) {
  const hunting = w.clouds.filter(c => c.vx * c.vx + c.vy * c.vy > 100).length;
  setRing(card, 1);
  card.nameEl.textContent = `Ion storm ×${w.clouds.length}`;
  card.subEl.textContent = w.jammed > 0 ? 'jammed' : hunting ? 'hunting a pack' : 'drifting';
  card.timeEl.textContent = '';
  card.el.classList.toggle('ready', true);
  card.el.classList.toggle('jammed', w.jammed > 0);
}

function updateChargeCard(card, w) {
  const c = w.charge, full = c >= 1;
  setRing(card, c);
  card.nameEl.textContent = `Singularity ${Math.floor(c * 100)}%`;
  card.subEl.textContent = w.jammed > 0 ? 'jammed' : full ? 'waiting for a target' : 'charging from scrap';
  card.timeEl.textContent = '';
  card.el.classList.toggle('ready', full);
  card.el.classList.toggle('jammed', w.jammed > 0);
}

function updateChronoCard(card, w) {
  const can = w.canRewind, f = can ? 1 - w.rewindCd / w.def.rewindEvery : 0;
  setRing(card, f);
  card.nameEl.textContent = `Chrono ×${w.ratio.toFixed(2)}`;
  card.subEl.textContent = w.jammed > 0 ? 'jammed' : can ? 'rewind' : `rewind at Lv ${w.def.rewindAt}`;
  card.timeEl.textContent = can ? w.rewindCd.toFixed(1) + 's' : '';
  card.el.classList.toggle('ready', can && f >= 1);
  card.el.classList.toggle('jammed', w.jammed > 0);
}

function updateDroneCard(card, w) {
  const alive = w.drones.filter(d => d.alive).length;
  const building = w.drones.filter(d => !d.alive).sort((a, b) => a.respawnT - b.respawnT)[0];
  setRing(card, Math.min(1, building ? 1 - building.respawnT / w.respawn : 1));
  card.nameEl.textContent = DRONE_CARD_NAME[w.type] || 'Drones';
  card.subEl.textContent = `${alive} / ${w.droneCount} · ` + (w.jammed > 0 ? 'jammed' : building ? 'building' : 'deployed');
  card.timeEl.textContent = building ? building.respawnT.toFixed(1) + 's' : '';
  card.el.classList.toggle('ready', !building);
  card.el.classList.toggle('jammed', w.jammed > 0);
}

function updateWeaponCard(card, w) {
  const total = 1 / w.rate, left = Math.max(0, w.cd), ready = left <= 0, jam = w.jammed > 0;
  setRing(card, Math.min(1, 1 - left / total));
  card.timeEl.textContent = ready ? '' : left.toFixed(1) + 's';
  card.subEl.textContent = jam ? 'jammed' : ready ? 'ready' : 'recharging';
  card.el.classList.toggle('ready', ready);
  card.el.classList.toggle('jammed', jam);
}

/** One permanent card per slow weapon. Cards are rebuilt only when the set of weapons changes. */
export function updateCooldowns(ui) {
  const el = $('#cooldowns'), ws = ui.scene.tower.weapons.filter(w => COOLDOWN_TYPES.includes(w.type));
  const key = ws.map(w => w.type + w.slot).join(',');
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = ws.map(cooldownCard).join('');
    ui.cooldownRows = {};
    for (const r of $$('.fx-item', el)) ui.cooldownRows[r.dataset.slot] = cardParts(r);
  }
  for (const w of ws) {
    const card = ui.cooldownRows[w.slot];
    if (!card) continue;
    if (Array.isArray(w.drones)) updateDroneCard(card, w); else if (w.type === 'mirrors') updateMirrorCard(card, w); else if (w.type === 'ionstorm') updateStormCard(card, w); else if (w.type === 'singularity') updateChargeCard(card, w); else if (w.type === 'chrono') updateChronoCard(card, w); else updateWeaponCard(card, w);
  }
}

// ---- Tooltips -------------------------------------------------------------

export function weaponTip(type, extra = '') {
  const d = WEAPONS[type];
  const rate = d.rate >= 1 || type === 'laser' ? `${d.rate}/s` : `every ${(1 / d.rate).toFixed(1)} s`;
  const prefer = d.prefer.map(p => MOBS[p].name).join(', ');
  return `${d.name}\n${d.desc}\n${d.dmg} dmg · ${rate} · range ${d.range}\n×${d.bonus} vs ${prefer}${extra ? '\n' + extra : ''}`;
}

export function bindTips(ui, root) {
  for (const el of $$('[data-tip]', root)) {
    el.onpointerenter = () => showTip(ui, el, el.dataset.tip);
    el.onpointerleave = () => hideTip(ui);
  }
}

/** Multi-line tip beside `anchor`: first line is the heading. Flips to the left when it would overflow. */
export function showTip(ui, anchor, text) {
  if (!text) return;
  const tip = $('#tooltip');
  tip.innerHTML = text.split('\n').map((l, i) => `<div class="${i ? 'tt-line' : 'tt-head'}">${l}</div>`).join('');
  const r = anchor.getBoundingClientRect();
  tip.hidden = false;
  ui.tipAnchor = anchor;
  const w = tip.offsetWidth || TIP_DEFAULT_W, h = tip.offsetHeight || TIP_DEFAULT_H;
  const left = r.right + TIP_GAP + w > window.innerWidth ? r.left - TIP_GAP - w : r.right + TIP_GAP;
  tip.style.left = Math.max(TIP_MARGIN, left) + 'px';
  tip.style.top = Math.min(window.innerHeight - h - TIP_MARGIN, r.top) + 'px';
}

export function hideTip(ui) {
  $('#tooltip').hidden = true;
  ui.tipAnchor = null;
}

// ---- Overlays -------------------------------------------------------------

const choiceCard = (id) => {
  const c = CHOICES[id];
  return `<button class="ch-card" data-choice="${id}"><div class="ch-name">${c.name}</div><div class="ch-good">${c.good}</div>` +
    `${c.bad ? `<div class="ch-bad">${c.bad}</div>` : ''}</button>`;
};

/** the auto-assigned modifier: a clean notice, not a card to click */
const modNote = (id) => {
  const c = CHOICES[id];
  return `<div class="mod-note"><div class="mn-kicker">New modifier · next 3 threat levels</div><div class="mn-name">${c.name}</div>` +
    `<div class="mn-line good"><span>▲</span>${c.good}</div>${c.bad ? `<div class="mn-line bad"><span>▼</span>${c.bad}</div>` : ''}</div>`;
};

export function showChoice(ui, ch) {
  const el = $('#choice');
  el.classList.toggle('auto', !!ch.auto);
  el.querySelector('.ch-title').textContent = ch.auto ? '' : 'Threat rising. Choose.';
  el.querySelector('.ch-hint').textContent = ch.auto ? '' : 'Game paused until you pick';
  el.querySelector('.ch-cards').innerHTML = ch.auto ? modNote(ch.opts[0]) : ch.opts.map(choiceCard).join('');
  if (!ch.auto) for (const b of $$('.ch-card', el)) b.onclick = () => ui.scene.pickChoice(b.dataset.choice);
  el.hidden = false;
  restartAnimation(el, 'show');
  clearTimeout(ui.choiceTimer);
  if (ch.auto) ui.choiceTimer = setTimeout(() => hideChoice(), CHOICE_AUTO_MS);
}

export function hideChoice(id) {
  const el = $('#choice');
  if (id) for (const b of $$('.ch-card', el)) b.classList.toggle('picked', b.dataset.choice === id);
  el.classList.remove('show');
  setTimeout(() => { el.hidden = true; }, CHOICE_FADE_MS);
}

export function showOffline(o) {
  const h = Math.floor(o.gap / 3600), m = Math.floor((o.gap % 3600) / 60);
  $('#offline-text').innerHTML = `Away for <b>${h ? h + 'h ' : ''}${m}m</b>. ` +
    `Salvage crews recovered <b class="gold">${fmt(o.earned)} scrap</b>${o.capped ? ` (${o.capH}h cap)` : ''}.`;
  $('#offline').hidden = false;
}

export function showGameOver(scene) {
  const s = scene.state, n = scene.fragmentsForRun();
  $('#overlay-text').innerHTML = `You held the core for <b>${fmtTime(s.time)}</b> at threat level <b>${s.tier}</b> on <b style="color:${scene.diff.color}">${scene.diff.name}</b>. ${s.kills} ships destroyed.` +
    `<br><br>Salvaged <b class="violet">${n} core fragment${n === 1 ? '' : 's'}</b> for the skill tree.`;
  $('#overlay-stats').innerHTML = statsHtml(scene, true);
  $('#overlay').hidden = false;
}
