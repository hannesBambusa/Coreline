// Always-visible HUD: top bar numbers and core bars, threat timer, boss bar, banners,
// the ability bar, the auto-buy queue and the loadout card.
import { WEAPONS, ABILITIES, SPAWN, SLOT_COSTS } from '../config.js';
import { ICONS } from '../icons.js';
import { QUADS } from '../combos/quad.js';
import { bindTips, weaponTip } from './effects.js';
import { isMounted } from './purchases.js';
import { $, $$, fmt, fmtTime, hex, swapHtml, restartAnimation, bindBuy, attrQuote } from './dom.js';
import { queueItem } from './rows.js';
import { QUEUE_LEN } from './panel.js';

const BANNER_MS = 1800;
const COMBO_BANNER_MS = 1600;
const COMBO_BANNER_FADE_MS = 300;
const HUD_DPS_WINDOW = 2;          // seconds: the top-bar dps readouts follow the fight; Stats and boss scaling use 20 s
const THREAT_SOON_S = 5;           // timer blinks red below this
const ABILITY_COLOR = 0x9be7ff;

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

/** Ultimate buttons above the ability bar: the loadout's matched ultimates plus the universal ones, keys Q W E R. */
export function renderUltimates(ui) {
  const bar = $('#ultimates'), scene = ui.scene, qs = scene.quads;
  if (scene.starting || scene.gameOver) { bar.hidden = true; return; }
  bar.hidden = false;
  const list = qs.bar();
  const key = list.map(u => u.id + ':' + qs.matches(u.id)).join(',');
  if (bar.dataset.key !== key) {
    bar.dataset.key = key;
    bar.innerHTML = list.map(u => {
      const icons = (u.match.length ? u.match : ['level']).map(p => `<span style="color:${p === 'level' ? hex(u.color) : hex(WEAPONS[p].color)}${u.match.length && !qs.mounted(p) ? ';opacity:.25' : ''}">${ICONS[p] || ICONS.level}</span>`).join('');
      const pw = Math.round(qs.powerOf(u.id) * 100), match = u.match.length ? `${qs.matches(u.id)} of 4 weapons mounted · ${pw} % power\n` : '';
      return `<button class="ult-btn" data-ult="${u.id}" style="--uc:${hex(u.color)}" data-tip="${attrQuote(u.name + '\n' + u.desc + '\n' + match + 'Press ' + u.key + ' or click when full.')}">` +
        `<span class="fill"></span><span class="icons ${u.match.length ? '' : 'one'}">${icons}</span><span class="txt"><span class="nm">${u.name}</span><span class="st"></span></span><span class="key">${u.key}</span></button>`;
    }).join('');
    for (const b of $$('.ult-btn', bar)) b.onclick = () => ui.fireUltimate(b.dataset.ult);
    bindTips(ui, bar);
  }
  for (const u of list) {
    const b = bar.querySelector(`[data-ult="${u.id}"]`); if (!b) continue;
    const running = qs.ult && qs.ult.id === u.id, busy = qs.ult && !running, ready = qs.ready(u.id), siegeBlock = scene.siege && scene.siege.t < 10, cd = (qs.cd[u.id] || 0) > 0, ch = qs.charge[u.id] || 0;
    b.querySelector('.fill').style.height = (running ? 100 : ch * 100) + '%';
    b.querySelector('.st').textContent = running ? 'firing' : ready ? 'READY' : busy ? 'wait' : siegeBlock ? 'siege' : cd ? `${Math.ceil(qs.cd[u.id])}s` : `${Math.floor(ch * 100)}%`;
    b.classList.toggle('ready', ready); b.classList.toggle('firing', !!running); b.classList.toggle('blocked', !ready && !running);
  }
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

// ---- Auto-buy queue ------------------------------------------------------

/** Vertical queue shown on the right when the panel is collapsed and auto-buy is on. */
/** Right side while the panel is hidden: the mounted weapons with their levels, then every available combo as its icon pair. */
export function renderLoadout(ui) {
  const el = $('#loadout'), scene = ui.scene, t = scene.tower, scrap = scene.state.scrap;
  const show = ui.panelHidden() && !scene.starting && !scene.gameOver;
  el.hidden = !show;
  if (!show) { ui.loPick = null; return; }
  const strip = (html) => html.replace(/<[^>]+>/g, '');
  if (ui.loPick !== null && ui.loPick !== undefined && t.slots[ui.loPick] !== null) ui.loPick = null;   // slot got filled
  // one tile per hardpoint: mounted weapon (click = upgrade), empty (click = pick a weapon), then the next locked one
  let weapons = t.slots.map((w, i) => {
    if (w) {
      const cost = w.upgradeCost(), can = !w.atCap && scrap >= cost;
      const tip = w.def.name + '\nLv ' + w.level + ' · ' + strip(w.statLine()) + '\n' + (w.atCap ? 'max level' : (can ? 'click: upgrade · ' : 'upgrade ') + fmt(cost) + ' scrap');
      return `<div class="lo-w ${w.jammed > 0 ? 'jam' : ''} ${can ? 'can up' : ''}" style="--lc:${hex(w.color)}" ${can ? `data-buy="weapon:${i}"` : ''} data-tip="${attrQuote(tip)}">${ICONS[w.type]}<span class="lv">${w.level}</span></div>`;
    }
    return `<div class="lo-w empty ${ui.loPick === i ? 'open' : ''}" data-pick="${i}" data-tip="${attrQuote(`Hardpoint ${i + 1}\nEmpty · click to choose a weapon`)}">${ICONS.slot}</div>`;
  }).join('');
  const slotCost = t.nextSlotCost(), gate = t.nextSlotGate();
  if (slotCost !== null) {
    const can = scrap >= slotCost;
    weapons += `<div class="lo-w lock ${can ? 'can' : ''}" ${can ? 'data-buy="slot"' : ''} data-tip="${attrQuote(`Locked hardpoint\nSlot ${t.slots.length + 1} of ${SLOT_COSTS.length}\n${can ? 'click: unlock · ' : 'unlock '}${fmt(slotCost)} scrap`)}">${ICONS.slot}<span class="lv">${fmt(slotCost)}</span></div>`;
  } else if (gate) {
    weapons += `<div class="lo-w lock gated" data-tip="${attrQuote(`Sealed hardpoint\nSlot ${t.slots.length + 1} of ${SLOT_COSTS.length}\nOpens at threat level ${gate}`)}">${ICONS.slot}<span class="lv">T${gate}</span></div>`;
  }
  // weapon picker for the open empty slot
  const pickEl = $('#lo-pick'), pick = ui.loPick;
  pickEl.hidden = pick === null || pick === undefined;
  if (!pickEl.hidden) {
    const html = Object.entries(WEAPONS).filter(([type]) => scene.tree.unlocked(type)).map(([type, d]) => {
      const dup = isMounted(t, type), can = !dup && scrap >= d.install;
      const why = dup ? 'already mounted' : (can ? 'click: mount · ' : 'need ') + fmt(d.install) + ' scrap';
      return `<div class="lo-w pick ${can ? 'can' : 'gated'}" style="--lc:${hex(d.color)}" ${can ? `data-buy="install:${pick}:${type}"` : ''} data-tip="${attrQuote(weaponTip(type, why))}">${ICONS[type]}<span class="lv">${d.install ? fmt(d.install) : 'free'}</span></div>`;
    }).join('');
    swapHtml($('#lo-pick-list'), html, (root) => { bindBuy(root, (id) => ui.buy(id)); bindTips(ui, root); });
  }
  const combos = scene.combos.list().filter(c => c.available).map(c => {
    const fx = ui.effects['combo:' + c.id], active = fx && fx.left > 0 && c.effectDur;
    return `<div class="lo-c ${active ? 'active' : c.cd > 0 ? 'cd' : ''}" data-tip="${attrQuote(c.name + '\n' + c.desc + (c.cd > 0 ? '\ncooldown ' + Math.ceil(c.cd) + ' s' : '\nready'))}">` +
      c.pair.map(p => `<span style="color:${hex(WEAPONS[p].color)}">${ICONS[p]}</span>`).join('<span class="plus">+</span>') + '</div>';
  }).join('');
  swapHtml($('#lo-weapons'), weapons, (root) => {
    bindBuy(root, (id) => ui.buy(id));
    bindTips(ui, root);
    for (const b of $$('[data-pick]', root)) b.onclick = () => { ui.loPick = ui.loPick === +b.dataset.pick ? null : +b.dataset.pick; renderLoadout(ui); };
  });
  swapHtml($('#lo-combos'), combos || '<span class="muted" style="font-size:12px">none with this loadout</span>', (root) => bindTips(ui, root));
}

export function renderQueue(ui) {
  const el = $('#auto-queue'), scene = ui.scene, ab = scene.autobuy;
  const q = ui.panelHidden() && !scene.starting && !scene.gameOver ? ab.queue(QUEUE_LEN) : [];
  el.hidden = !q.length;
  if (el.hidden) return;
  el.classList.toggle('manual', !ab.on);
  el.querySelector('.aq-title').textContent = ab.on ? 'Auto-buy queue' : 'Upgrades';
  el.querySelector('.aq-hint').hidden = ab.on;
  // auto off: an affordable entry is a button, everything else is a preview of what auto-buy would do
  const html = q.map(e => {
    const can = !ab.on && e.now && e.id;
    return queueItem(e, ICONS[e.icon] || ICONS.level, (e.now ? 'now' : '') + (can ? ' can' : ''), can ? ` data-buy="${e.id}"` : '');
  }).join('');
  swapHtml(el.querySelector('ol'), html, (root) => bindBuy(root, (id) => ui.buy(id)));
}
