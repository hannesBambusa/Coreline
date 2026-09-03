// Always-visible HUD: top bar numbers and core bars, threat timer, boss bar, banners,
// the ability bar, the auto-buy queue and the quick-buy list.
import { WEAPONS, ABILITIES, SPAWN } from '../config.js';
import { ICONS } from '../icons.js';
import { AUTO_ITEMS } from '../autobuy.js';
import { $, $$, fmt, fmtTime, hex, swapHtml, restartAnimation, bindBuy } from './dom.js';
import { queueItem } from './rows.js';
import { QUEUE_LEN } from './panel.js';

const BANNER_MS = 1800;
const COMBO_BANNER_MS = 1600;
const COMBO_BANNER_FADE_MS = 300;
const HUD_DPS_WINDOW = 2;          // seconds: the top-bar dps readouts follow the fight; Stats and boss scaling use 20 s
const THREAT_SOON_S = 5;           // timer blinks red below this
const CORE_COLOR = 0x4ff2ff;       // quick-buy colour for tower upgrades and slots
const ABILITY_COLOR = 0x9be7ff;
const QUICK_BUY_TOWER_KEYS = ['shieldRegen', 'shieldMax', 'hull'];

// Elements read every frame, looked up once.
let els = null;
const topEls = () => els || (els = {
  scrap: $('#scrap'), fragments: $('#fragments'), time: $('#time'), tier: $('#tier'), kills: $('#kills'), diff: $('#hud-diff'), dps: $('#hud-dps'), dtaken: $('#hud-dtaken'), regen: $('#hud-regen'),
  threat: $('#threat-timer'), threatFill: $('#threat-timer .tt-fill'), threatNum: $('#threat-timer .tt-num'),
  boss: $('#boss-bar'), bossFill: $('#boss-fill'), bossName: $('#boss-name'), bossSub: $('#boss-sub'),
});

// ---- Top bar --------------------------------------------------------------

export function renderTopBar(scene) {
  const s = scene.state, e = topEls();
  e.scrap.textContent = fmt(s.scrap);
  e.fragments.textContent = fmt(s.fragments);
  e.time.textContent = fmtTime(s.time);
  e.tier.textContent = s.tier;
  e.kills.textContent = fmt(s.kills);
  const t = scene.tower, rg = t.regenNow();
  e.regen.textContent = `${fmt(rg)}/s`; e.regen.style.color = t.regenDelay > 0 ? 'var(--red)' : t.calm ? '#fff' : '';
  e.dps.textContent = fmt(scene.recentDps(HUD_DPS_WINDOW)); e.dtaken.textContent = fmt(scene.recentTaken(HUD_DPS_WINDOW));
  const d = scene.diff; if (e.diff.textContent !== d.name) { e.diff.textContent = d.name; e.diff.style.color = d.color; }
}


// ---- Threat timer and boss bar -------------------------------------------

export function renderThreatTimer(scene) {
  const e = topEls(), T = SPAWN.tierSeconds;
  if (scene.siege) {
    e.threat.classList.add('siege');
    e.threatNum.textContent = 'SIEGE · time frozen';
    e.threatFill.style.transform = 'scaleX(1)';
    return;
  }
  e.threat.classList.remove('siege');
  const left = T - scene.state.time % T;
  e.threatFill.style.transform = `scaleX(${left / T})`;   // shrinks from both edges into the centre as the level runs out
  e.threatNum.textContent = `THREAT ${scene.state.tier + 1} IN ${Math.ceil(left)} S`;
  e.threat.classList.toggle('soon', left < THREAT_SOON_S);
}

function bossStatus(titan, wardens) {
  if (titan.dead) return 'destroyed';
  const base = titan.adapt ? `immune to ${WEAPONS[titan.adapt].name} · ${Math.ceil(titan.adaptT)} s`
    : wardens ? `${wardens} warden${wardens > 1 ? 's' : ''} healing it` : 'wardens down · shield sector rotates';
  const phase = titan.beamState === 'charge' ? ' · CHARGING BEAM'
    : titan.beamState === 'fire' ? ' · FIRING'
    : titan.blinkState === 'charge' ? ' · BLINKING' : '';
  return base + phase;
}

export function renderBossBar(scene) {
  const e = topEls(), sg = scene.siege, wl = !sg && scene.warlord && !scene.warlord.dead ? scene.warlord : null;
  e.boss.hidden = !sg && !wl;
  if (wl) {
    const f = Math.max(0, wl.hp / wl.hpMax);
    e.bossFill.style.transform = `scaleX(${f})`;
    e.bossName.textContent = `${wl.def.name} · ${Math.ceil(f * 100)}%`;
    e.bossSub.textContent = wl.status();
    e.boss.classList.toggle('charge', !!wl.adapt || wl.shielded);
    return;
  }
  if (!sg) return;
  const t = sg.titan, f = Math.max(0, t.hp / t.hpMax), wardens = sg.wardens.filter(x => !x.dead).length;
  e.bossFill.style.transform = `scaleX(${f})`;
  e.bossName.textContent = `${t.def.name}${sg.level > 1 ? ' Mk ' + sg.level : ''} · ${Math.ceil(f * 100)}%`;
  e.bossSub.textContent = bossStatus(t, wardens);
  e.boss.classList.toggle('charge', t.beamState !== 'idle' || t.blinkState === 'charge');
}

// ---- Banners --------------------------------------------------------------

export function banner(ui, text, boss = false) {
  const b = $('#banner');
  b.textContent = text; b.classList.toggle('boss', boss); b.classList.add('show');
  clearTimeout(ui.bannerTimer);
  ui.bannerTimer = setTimeout(() => b.classList.remove('show'), BANNER_MS);
}

export function comboBanner(ui, c) {
  const b = $('#combo-banner');
  b.style.setProperty('--cb', hex(c.color));
  b.querySelector('.cb-icons').innerHTML = c.pair.map(p => `<span style="color:${hex(WEAPONS[p].color)}">${ICONS[p]}</span>`).join('<i>+</i>');
  b.querySelector('.cb-name').textContent = c.name;
  b.querySelector('.cb-pair').textContent = 'COMBO · ' + c.pair.map(p => WEAPONS[p].name).join(' + ');
  b.hidden = false;
  restartAnimation(b, 'show');
  clearTimeout(ui.cbTimer);
  ui.cbTimer = setTimeout(() => {
    b.classList.remove('show');
    setTimeout(() => { b.hidden = true; }, COMBO_BANNER_FADE_MS);
  }, COMBO_BANNER_MS);
}

// ---- Ability bar ----------------------------------------------------------

const abilityButton = (k, d) =>
  `<button class="ab" data-ab="${k}" title="${d.desc}">` +
  `<span class="key">${d.key}</span><span class="cdmask"></span><span class="ab-icon">${ICONS['ab_' + k]}</span>` +
  `<span class="ab-name">${d.name}</span><span class="ab-cost">${d.cost} scrap</span></button>`;

/** Builds the buttons once and caches the parts renderAbilities touches every tick. */
export function buildAbilityBar(ui) {
  const bar = $('#abilities');
  bar.innerHTML = Object.entries(ABILITIES).map(([k, d]) => abilityButton(k, d)).join('');
  ui.abilityButtons = [...$$('.ab', bar)].map(el => ({ key: el.dataset.ab, el, mask: el.querySelector('.cdmask'), cost: el.querySelector('.ab-cost') }));
  for (const b of ui.abilityButtons) b.el.onclick = () => ui.abilityClick(b.key);
}

export function renderAbilities(ui) {
  const a = ui.scene.abilities, scrap = ui.scene.state.scrap;
  for (const b of ui.abilityButtons) {
    const st = a.state[b.key], d = ABILITIES[b.key];
    b.el.classList.toggle('locked', !st.unlocked);
    b.el.classList.toggle('afford', !st.unlocked && scrap >= d.cost);
    b.el.classList.toggle('ready', st.unlocked && st.cd <= 0);
    b.el.classList.toggle('active', st.active > 0);
    b.mask.style.height = (st.unlocked ? st.cd / d.cd * 100 : 0) + '%';
    b.cost.textContent = st.unlocked ? (st.cd > 0 ? Math.ceil(st.cd) + 's' : 'ready') : d.cost + ' scrap';
  }
}

/** Click on an ability button: unlock it if affordable, otherwise use it. */
export function abilityClick(ui, k) {
  const scene = ui.scene, a = scene.abilities, s = scene.state, d = ABILITIES[k];
  if (!a.state[k].unlocked) {
    if (s.scrap >= d.cost) { s.scrap -= d.cost; a.unlock(k); scene.sfx.play('buy'); }
    else scene.sfx.play('deny');
  } else if (!a.use(k)) scene.sfx.play('deny');
  ui.render();
}

// ---- Auto-buy queue and quick-buy list ------------------------------------

/** Vertical queue shown on the right when the panel is collapsed and auto-buy is on. */
export function renderQueue(ui) {
  const el = $('#auto-queue'), ab = ui.scene.autobuy;
  const q = ab.on && ui.panelHidden() ? ab.queue(QUEUE_LEN) : [];
  el.hidden = !q.length;
  if (el.hidden) return;
  swapHtml(el.querySelector('ol'), q.map(e => queueItem(e, ICONS[e.icon] || ICONS.level, e.now ? 'now' : '')).join(''));
}

function quickBuyItems(scene) {
  const t = scene.tower, items = [];
  t.slots.forEach((w, i) => {
    if (w && !w.atCap) items.push({ id: 'weapon:' + i, icon: w.type, color: w.color, label: w.def.name, from: w.level, to: w.level + 1, cost: w.upgradeCost() });
  });
  for (const key of QUICK_BUY_TOWER_KEYS) {
    const lvl = t.upgrades[key];
    if (t.atCap(key)) continue;
    items.push({ id: 'tower:' + key, icon: key, color: CORE_COLOR, label: AUTO_ITEMS[key].name, from: lvl, to: lvl + 1, cost: t.upgradeCost(key) });
  }
  const slotCost = t.nextSlotCost();
  if (slotCost !== null) {
    items.push({ id: 'slot', icon: 'slot', color: CORE_COLOR, label: 'Hardpoint', from: t.slots.length, to: t.slots.length + 1, cost: slotCost });
  }
  for (const k in scene.abilities.state) {
    if (scene.abilities.state[k].unlocked) continue;
    items.push({ id: 'ability:' + k, icon: 'ab_' + k, color: ABILITY_COLOR, label: ABILITIES[k].name, from: null, cost: ABILITIES[k].cost });
  }
  return items;
}

/** Panel collapsed and auto-buy off: clickable cards for everything affordable right now. */
export function renderQuickBuy(ui) {
  const el = $('#quick-buy'), scene = ui.scene;
  el.hidden = scene.autobuy.on || !ui.panelHidden() || scene.gameOver;
  if (el.hidden) return;
  const ready = quickBuyItems(scene).filter(e => e.cost <= scene.state.scrap).sort((a, b) => a.cost - b.cost);
  const html = ready.length
    ? ready.map(e => queueItem(e, ICONS[e.icon] || ICONS.level, 'now', ` data-buy="${e.id}"`)).join('')
    : '<li class="empty">Nothing affordable yet</li>';
  swapHtml(el.querySelector('ol'), html, (ol) => bindBuy(ol, (id) => ui.buy(id)));
}
