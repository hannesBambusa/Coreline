import { TOWER_UPGRADES, TOWER, WEAPONS, MOBS, ABILITIES, CRIT } from './config.js';
import { ICONS } from './icons.js';
import { COMBOS } from './combos.js';
import { TREE, BRANCHES } from './tree.js';
import { AUTO_ITEMS } from './autobuy.js';
import { PRESTIGE, SPAWN, SLOT_COSTS } from './config.js';

const $ = (s) => document.querySelector(s);
const fmtTime = (t) => { t = Math.floor(t); const m = Math.floor(t / 60), sec = t % 60; return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec; };
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toString();

export class UI {
  constructor(scene) {
    this.scene = scene;
    this.bannerTimer = null;
    this.panel = $('#panel');
    $('#panel-toggle').onclick = () => { this.panel.classList.toggle('hidden'); this.render(); };
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => this.showTab(b.dataset.tab));
    $('#opt-shake').onchange = (e) => { scene.settings.shake = e.target.checked; };
    $('#opt-sound').onchange = (e) => { scene.settings.sound = e.target.checked; scene.sfx.setEnabled(e.target.checked); };
    const setVol = (v) => { scene.settings.volume = v; scene.sfx.setVolume(v); $('#opt-volume').value = Math.round(v * 100); $('#vol-slider').value = Math.round(v * 100); this.syncMute(); };
    $('#opt-volume').oninput = (e) => setVol(+e.target.value / 100);
    $('#vol-slider').oninput = (e) => setVol(+e.target.value / 100);
    $('#btn-mute').onclick = () => { scene.settings.sound = !scene.settings.sound; scene.sfx.setEnabled(scene.settings.sound); $('#opt-sound').checked = scene.settings.sound; this.syncMute(); };
    $('#btn-reset').onclick = () => { if (confirm('Wipe everything, including fragments and best time?')) { scene.saves.clear(); location.reload(); } };
    $('#btn-export').onclick = () => { $('#save-text').value = scene.saves.export(); $('#save-text').select(); };
    $('#btn-import').onclick = () => {
      if (scene.saves.import($('#save-text').value)) location.reload(); else { alert('Could not read that save.'); }
    };
    $('#btn-offline-ok').onclick = () => { $('#offline').hidden = true; };
    $('#btn-start').onclick = () => scene.beginRun();
    this.buildAbilityBar();
    this.initResize();
    $('#btn-pause').onclick = () => scene.setPaused(!scene.paused);
    $('#btn-auto').onclick = () => {
      scene.autobuy.on = !scene.autobuy.on;
      if (scene.autobuy.on && !this.panel.classList.contains('hidden')) this.panel.classList.add('hidden');   // hand the screen to the queue
      this.syncAuto(); scene.sfx.play(scene.autobuy.on ? 'buy' : 'deny');
    };
    $('#auto-reserve').oninput = (e) => { scene.autobuy.reserve = Math.max(0, +e.target.value || 0); };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); scene.setPaused(!scene.paused); }
    });
    $('#btn-rebuild').onclick = () => { $('#overlay').hidden = true; scene.prestige(); this.showTab('skills'); };
    $('#btn-prestige').onclick = () => {
      const n = scene.fragmentsForRun();
      if (!scene.canPrestige()) return;
      if (confirm(`Prestige now for ${n} fragment${n === 1 ? '' : 's'}? Scrap, weapons and tower upgrades reset. Skills stay.`)) { scene.prestige(); this.render(); }
    };
    this.render();
    setInterval(() => this.render(), 150);
  }

  // Vertical queue shown on the right when the panel is collapsed and auto-buy is on.
  renderQueue(q) {
    const el = $('#auto-queue'), ab = this.scene.autobuy;
    el.hidden = !ab.on || !q.length || !this.panel.classList.contains('hidden');
    if (el.hidden) return;
    const html = q.slice(0, 8).map((e, i) => {
      const hex = '#' + (e.color || 0x4ff2ff).toString(16).padStart(6, '0');
      const lv = e.from === null ? 'unlock' : `Lv ${e.from} <b>&rarr; ${e.to}</b>`;
      return `<li class="${e.now ? 'now' : ''}" style="--qc:${hex}"><span class="ic">${ICONS[e.icon] || ICONS.level}</span><span class="txt"><span class="l">${e.label}</span><span class="lv">${lv}</span></span><span class="c">${fmt(e.cost)}</span></li>`;
    }).join('');
    if (el.dataset.last !== html) { el.dataset.last = html; el.querySelector('ol').innerHTML = html; }
  }

  // Drag the panel's left edge to resize it. Width is clamped and saved in settings.
  initResize() {
    const grip = $('#panel-grip'), panel = this.panel, scene = this.scene;
    const MIN = 260, maxW = () => Math.min(640, Math.floor(window.innerWidth * 0.45));
    const apply = (w) => { w = Math.max(MIN, Math.min(maxW(), Math.round(w))); panel.style.width = w + 'px'; scene.settings.panelWidth = w; document.documentElement.style.setProperty('--panel-w', w + 'px'); };
    if (scene.settings.panelWidth) apply(scene.settings.panelWidth);
    let dragging = false, startX = 0, startW = 0;
    grip.addEventListener('pointerdown', (e) => { dragging = true; startX = e.clientX; startW = panel.getBoundingClientRect().width; grip.setPointerCapture(e.pointerId); document.body.classList.add('resizing'); e.preventDefault(); });
    grip.addEventListener('pointermove', (e) => { if (dragging) apply(startW + (startX - e.clientX)); });
    const stop = () => { if (!dragging) return; dragging = false; document.body.classList.remove('resizing'); scene.saves.save(); };
    grip.addEventListener('pointerup', stop); grip.addEventListener('pointercancel', stop);
    grip.addEventListener('dblclick', () => apply(320));
    window.addEventListener('resize', () => { if (scene.settings.panelWidth) apply(scene.settings.panelWidth); });
    this.applyPanelWidth = apply;
  }

  // Panel collapsed and auto-buy off: clickable cards for everything affordable right now.
  renderQuickBuy() {
    const el = $('#quick-buy'), s = this.scene, st = s.state, t = s.tower, ab = s.autobuy;
    el.hidden = ab.on || !this.panel.classList.contains('hidden') || s.gameOver;
    if (el.hidden) return;
    const items = [];
    t.slots.forEach((w, i) => { if (w) items.push({ id: 'weapon:' + i, icon: w.type, color: w.color, label: w.def.name, from: w.level, to: w.level + 1, cost: w.upgradeCost() }); });
    for (const key of ['shieldRegen', 'shieldMax', 'hull']) items.push({ id: 'tower:' + key, icon: key, color: 0x4ff2ff, label: AUTO_ITEMS[key].name, from: t.upgrades[key], to: t.upgrades[key] + 1, cost: t.upgradeCost(key) });
    const sc = t.nextSlotCost(); if (sc !== null) items.push({ id: 'slot', icon: 'slot', color: 0x4ff2ff, label: 'Hardpoint', from: t.slots.length, to: t.slots.length + 1, cost: sc });
    for (const k in s.abilities.state) if (!s.abilities.state[k].unlocked) items.push({ id: 'ability:' + k, icon: 'ab_' + k, color: 0x9be7ff, label: ABILITIES[k].name, from: null, cost: ABILITIES[k].cost });
    const ready = items.filter(e => e.cost <= st.scrap).sort((a, b) => a.cost - b.cost);
    const html = ready.length ? ready.map(e => {
      const hex = '#' + e.color.toString(16).padStart(6, '0');
      const lv = e.from === null ? 'unlock' : `Lv ${e.from} <b>&rarr; ${e.to}</b>`;
      return `<li class="now" data-buy="${e.id}" style="--qc:${hex}"><span class="ic">${ICONS[e.icon] || ICONS.level}</span><span class="txt"><span class="l">${e.label}</span><span class="lv">${lv}</span></span><span class="c">${fmt(e.cost)}</span></li>`;
    }).join('') : '<li class="empty">Nothing affordable yet</li>';
    if (el.dataset.last !== html) {
      el.dataset.last = html; el.querySelector('ol').innerHTML = html;
      el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => this.buy(b.dataset.buy));
    }
  }

  syncAuto() {
    const ab = this.scene.autobuy;
    $('#btn-auto').classList.toggle('on', ab.on);
    $('#btn-auto').textContent = ab.on ? 'AUTO ON' : 'AUTO';
    $('#auto-reserve').value = ab.reserve;
    this.render();
  }

  syncMute() {
    const s = this.scene.settings, on = s.sound !== false && (s.volume ?? 0.7) > 0;
    $('#btn-mute').textContent = on ? '🔊' : '🔇';
    $('#vol').classList.toggle('muted', !on);
  }

  syncSettings() {
    if (this.scene.settings.panelWidth && this.applyPanelWidth) this.applyPanelWidth(this.scene.settings.panelWidth);
    $('#opt-shake').checked = this.scene.settings.shake !== false;
    $('#opt-sound').checked = this.scene.settings.sound !== false;
    $('#opt-volume').value = Math.round((this.scene.settings.volume ?? 0.7) * 100);
    $('#vol-slider').value = Math.round((this.scene.settings.volume ?? 0.7) * 100);
    this.syncMute();
    this.scene.sfx.setVolume(this.scene.settings.volume ?? 0.7);
  }

  showOffline(o) {
    const h = Math.floor(o.gap / 3600), m = Math.floor((o.gap % 3600) / 60);
    $('#offline-text').innerHTML = `Away for <b>${h ? h + 'h ' : ''}${m}m</b>. Salvage crews recovered <b class="gold">${fmt(o.earned)} scrap</b>${o.capped ? ` (${o.capH}h cap)` : ''}.`;
    $('#offline').hidden = false;
  }

  // Active effect tray (left side): icon, name, countdown ring.
  addEffect(id, { name, icon, color, dur, sub }) {
    this.effects = this.effects || {};
    const hex = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
    let e = this.effects[id];
    if (!e) {
      const el = document.createElement('div');
      el.className = 'fx-item';
      el.innerHTML = `<div class="fx-ring"><svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="17"/><circle class="fg" cx="20" cy="20" r="17"/></svg><div class="fx-icon"></div></div><div class="fx-text"><div class="fx-name"></div><div class="fx-sub"></div></div><div class="fx-time"></div>`;
      $('#effects').appendChild(el);
      e = this.effects[id] = { el, fg: el.querySelector('.fg') };
      requestAnimationFrame(() => el.classList.add('show'));
    }
    e.dur = dur; e.left = dur; e.name = name;
    e.el.style.setProperty('--fx', hex);
    e.el.querySelector('.fx-icon').innerHTML = icon;
    e.el.querySelector('.fx-name').textContent = name;
    e.el.querySelector('.fx-sub').textContent = sub || '';
    e.el.classList.remove('pop'); void e.el.offsetWidth; e.el.classList.add('pop');
  }

  removeEffect(id) {
    if (!this.effects || !this.effects[id]) return;
    const e = this.effects[id]; e.el.classList.remove('show'); setTimeout(() => e.el.remove(), 250); delete this.effects[id];
  }

  sourceMeta(src) {
    if (WEAPONS[src]) return { name: WEAPONS[src].name, color: '#' + WEAPONS[src].color.toString(16).padStart(6, '0'), icon: ICONS[src] };
    if (src === 'nova') return { name: 'Nova', tag: 'ability', color: '#ffffff', icon: ICONS.ab_nuke };
    return { name: 'Other', color: '#7d8bb0', icon: ICONS.level };
  }

  statsHtml(compact = false) {
    const st = this.scene.stats, s = this.scene.state, total = st.total || 1;
    const sources = Object.entries(st.dmg).sort((a, b) => b[1] - a[1]);
    let html = '';
    if (!compact) html += `<h3>Run</h3><div class="item stat-sum"><div class="icon">${ICONS.level}</div><div class="name">Totals</div>
      <div class="desc">Damage dealt <b>${fmt(st.total)}</b> · taken <b>${fmt(st.taken)}</b><br>Kills <b>${fmt(s.kills)}</b> · dps <b>${fmt(st.total / Math.max(1, s.time))}</b> avg</div></div>`;
    html += `<h3>Damage by weapon</h3>`;
    if (!sources.length) html += '<div class="muted">No damage yet.</div>';
    for (const [src, v] of sources) {
      const m = this.sourceMeta(src), pct = v / total * 100, kills = st.killsBy[src] || 0, crits = st.crits[src] || 0;
      html += `<div class="item stat-row" style="--sc:${m.color}"><div class="icon" style="color:${m.color}">${m.icon}</div>
        <div class="name">${m.name}<small>${pct.toFixed(1)}%</small>${m.tag ? `<span class="tag">${m.tag}</span>` : ''}</div>
        <div class="desc"><div class="stat-bar"><div style="width:${pct.toFixed(1)}%"></div></div><b>${fmt(v)}</b> dmg · <b>${fmt(kills)}</b> kills${crits ? ' · ' + fmt(crits) + ' crits' : ''}</div></div>`;
    }
    const procs = Object.entries(st.procs || {}).sort((a, b) => b[1] - a[1]);
    html += `<h3>Combo procs</h3>`;
    if (!procs.length) html += '<div class="muted">No combos yet.</div>';
    else html += `<div class="kill-grid">` + procs.map(([id, n]) => { const c = COMBOS[id] || { name: id, color: 0x7d8bb0 }; return `<div class="kill-cell" style="--kc:#${c.color.toString(16).padStart(6, '0')}"><span class="dot"></span><span class="kn">${c.name}</span><b>${fmt(n)}</b></div>`; }).join('') + `</div>`;
    const abs = Object.entries(st.abilities || {}).sort((a, b) => b[1] - a[1]);
    if (abs.length) html += `<h3>Abilities used</h3><div class="kill-grid">` + abs.map(([k, n]) => `<div class="kill-cell" style="--kc:#9be7ff"><span class="dot"></span><span class="kn">${ABILITIES[k] ? ABILITIES[k].name : k}</span><b>${fmt(n)}</b></div>`).join('') + `</div>`;
    const kills = Object.entries(st.kills).sort((a, b) => b[1] - a[1]);
    html += `<h3>Ships destroyed</h3>`;
    if (!kills.length) html += '<div class="muted">None yet.</div>';
    else html += `<div class="kill-grid">` + kills.map(([type, n]) => { const d = MOBS[type] || { name: type, color: 0x7d8bb0 }; return `<div class="kill-cell" style="--kc:#${d.color.toString(16).padStart(6, '0')}"><span class="dot"></span><span class="kn">${d.name}</span><b>${fmt(n)}</b></div>`; }).join('') + `</div>`;
    return html;
  }

  renderThreatTimer() {
    const el = $('#threat-timer'), s = this.scene, T = SPAWN.tierSeconds;
    if (s.siege) { el.classList.add('siege'); $('#threat-timer .tt-num').textContent = 'SIEGE'; $('#threat-timer .tt-fill').style.transform = 'scaleX(1)'; return; }
    el.classList.remove('siege');
    const into = s.state.time % T, left = T - into, f = left / T;
    $('#threat-timer .tt-fill').style.transform = `scaleX(${f})`;
    $('#threat-timer .tt-num').textContent = Math.ceil(left);
    el.classList.toggle('soon', left < 5);
  }

  renderBossBar() {
    const el = $('#boss-bar'), sg = this.scene.siege;
    el.hidden = !sg;
    if (!sg) return;
    const t = sg.titan, f = Math.max(0, t.hp / t.hpMax);
    const w = sg.wardens.filter(x => !x.dead).length;
    $('#boss-fill').style.transform = `scaleX(${f})`;
    $('#boss-name').textContent = `${t.def.name}${sg.level > 1 ? ' Mk ' + sg.level : ''} · ${Math.ceil(f * 100)}%`;
    $('#boss-sub').textContent = t.dead ? 'destroyed' : (w ? `${w} warden${w > 1 ? 's' : ''} healing it` : 'wardens down · shield sector rotates') + (t.beamState === 'charge' ? ' · CHARGING BEAM' : t.beamState === 'fire' ? ' · FIRING' : t.blinkState === 'charge' ? ' · BLINKING' : '');
    el.classList.toggle('charge', t.beamState !== 'idle' || t.blinkState === 'charge');
  }

  // Cooldown bars for slow weapons (cooldown of 1 s or more), left side above the effect tray.
  // Same card design as procs, permanent, one per slow weapon (cooldown of 1 s or more). Ring fills as it recharges.
  updateCooldowns() {
    const el = $('#cooldowns'), ws = this.scene.tower.weapons.filter(w => w.type === 'drones' || (w.type !== 'laser' && 1 / w.rate >= 1));
    const key = ws.map(w => w.type + w.slot).join(',');
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.innerHTML = ws.map(w => `<div class="fx-item cd show" data-slot="${w.slot}" style="--fx:#${w.color.toString(16).padStart(6, '0')}">
        <div class="fx-ring"><svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="17"/><circle class="fg" cx="20" cy="20" r="17"/></svg><div class="fx-icon">${ICONS[w.type]}</div></div>
        <div class="fx-text"><div class="fx-name">${w.def.name}</div><div class="fx-sub">cooldown</div></div><div class="fx-time"></div></div>`).join('');
    }
    const C = 2 * Math.PI * 17;
    for (const w of ws) {
      const row = el.querySelector(`.fx-item[data-slot="${w.slot}"]`); if (!row) continue;
      if (w.type === 'drones') {
        const alive = w.drones.filter(d => d.alive).length, total = w.droneCount;
        const building = w.drones.filter(d => !d.alive).sort((a, b) => a.respawnT - b.respawnT)[0];
        const f = building ? 1 - building.respawnT / w.respawn : 1;
        row.querySelector('.fg').style.strokeDasharray = `${C * Math.min(1, f)} ${C}`;
        row.querySelector('.fx-name').textContent = `Drones ${alive} / ${total}`;
        row.querySelector('.fx-sub').textContent = w.jammed > 0 ? 'jammed' : building ? 'building' : 'all deployed';
        row.querySelector('.fx-time').textContent = building ? building.respawnT.toFixed(1) + 's' : '';
        row.classList.toggle('ready', !building);
        row.classList.toggle('jammed', w.jammed > 0);
        continue;
      }
      const total = 1 / w.rate, left = Math.max(0, w.cd), f = Math.min(1, 1 - left / total), ready = left <= 0, jam = w.jammed > 0;
      row.querySelector('.fg').style.strokeDasharray = `${C * f} ${C}`;
      row.querySelector('.fx-time').textContent = ready ? '' : left.toFixed(1) + 's';
      row.querySelector('.fx-sub').textContent = jam ? 'jammed' : ready ? 'ready' : 'recharging';
      row.classList.toggle('ready', ready);
      row.classList.toggle('jammed', jam);
    }
  }

  updateEffects(dt) {
    if (!this.effects) return;
    const C = 2 * Math.PI * 17;
    for (const id in this.effects) {
      const e = this.effects[id];
      e.left -= dt;
      if (e.left <= 0) {
        e.el.classList.remove('show');
        setTimeout(() => e.el.remove(), 250);
        delete this.effects[id];
        continue;
      }
      const f = e.left / e.dur;
      e.fg.style.strokeDasharray = `${C * f} ${C}`;
      e.el.querySelector('.fx-time').textContent = e.dur >= 9999 ? '' : e.left >= 10 ? Math.ceil(e.left) + 's' : e.left.toFixed(1) + 's';
      e.el.classList.toggle('ending', e.left < 1);
    }
  }

  comboBanner(c) {
    const b = $('#combo-banner');
    const hex = '#' + c.color.toString(16).padStart(6, '0');
    b.style.setProperty('--cb', hex);
    b.querySelector('.cb-icons').innerHTML = c.pair.map(p => `<span style="color:#${WEAPONS[p].color.toString(16).padStart(6, '0')}">${ICONS[p]}</span>`).join('<i>+</i>');
    b.querySelector('.cb-name').textContent = c.name;
    b.querySelector('.cb-pair').textContent = 'COMBO · ' + c.pair.map(p => WEAPONS[p].name).join(' + ');
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.cbTimer);
    this.cbTimer = setTimeout(() => { b.classList.remove('show'); setTimeout(() => { b.hidden = true; }, 300); }, 1600);
  }

  buildAbilityBar() {
    const bar = $('#abilities');
    bar.innerHTML = Object.entries(ABILITIES).map(([k, d]) => `
      <button class="ab" data-ab="${k}" title="${d.desc}">
        <span class="key">${d.key}</span>
        <span class="cdmask"></span>
        <span class="ab-icon">${ICONS['ab_' + k]}</span>
        <span class="ab-name">${d.name}</span>
        <span class="ab-cost">${d.cost} scrap</span>
      </button>`).join('');
    bar.querySelectorAll('.ab').forEach(b => b.onclick = () => this.abilityClick(b.dataset.ab));
  }

  abilityClick(k) {
    const a = this.scene.abilities, s = this.scene.state, d = ABILITIES[k];
    if (!a.state[k].unlocked) {
      if (s.scrap >= d.cost) { s.scrap -= d.cost; a.unlock(k); this.scene.sfx.play('buy'); }
      else this.scene.sfx.play('deny');
    } else if (!a.use(k)) this.scene.sfx.play('deny');
    this.render();
  }

  renderAbilities() {
    const a = this.scene.abilities, s = this.scene.state;
    document.querySelectorAll('#abilities .ab').forEach(b => {
      const k = b.dataset.ab, st = a.state[k], d = ABILITIES[k];
      b.classList.toggle('locked', !st.unlocked);
      b.classList.toggle('afford', !st.unlocked && s.scrap >= d.cost);
      b.classList.toggle('ready', st.unlocked && st.cd <= 0);
      b.classList.toggle('active', st.active > 0);
      const frac = st.unlocked ? st.cd / d.cd : 0;
      b.querySelector('.cdmask').style.height = (frac * 100) + '%';
      b.querySelector('.ab-cost').textContent = st.unlocked ? (st.cd > 0 ? Math.ceil(st.cd) + 's' : 'ready') : d.cost + ' scrap';
    });
  }

  showTab(name) {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  }

  banner(text, boss = false) {
    const b = $('#banner');
    b.textContent = text; b.classList.toggle('boss', boss); b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), 1800);
  }

  showGameOver() {
    const n = this.scene.fragmentsForRun();
    $('#overlay-text').innerHTML = `You held the core for <b>${fmtTime(this.scene.state.time)}</b> at threat level <b>${this.scene.state.tier}</b>. ${this.scene.state.kills} ships destroyed.<br><br>Salvaged <b class="violet">${n} core fragment${n === 1 ? '' : 's'}</b> for the skill tree.`;
    $('#overlay-stats').innerHTML = this.statsHtml(true);
    $('#overlay').hidden = false;
  }

  buyBtn(id, cost, canAfford, label = 'Upgrade') {
    return `<button class="buy" data-buy="${id}" ${canAfford ? '' : 'disabled'}>${label}<span class="cost">${fmt(cost)} scrap</span></button>`;
  }

  render() {
    const s = this.scene.state, t = this.scene.tower;
    $('#scrap').textContent = fmt(s.scrap);
    $('#fragments').textContent = fmt(s.fragments);
    $('#time').textContent = fmtTime(s.time);
    $('#tier').textContent = s.tier;
    $('#kills').textContent = fmt(s.kills);

    this.renderAbilities();
    this.renderQuickBuy();
    this.renderBossBar();
    this.renderThreatTimer();

    // core status bars
    const sf = t.shield / t.shieldMax, hf = t.hull / t.hullMax;
    const sb = $('.bar.shield'), hb = $('.bar.hull');
    $('#shield-fill').style.transform = `scaleX(${sf})`;
    $('#hull-fill').style.transform = `scaleX(${hf})`;
    $('#shield-txt').textContent = `Shield ${Math.ceil(t.shield)} / ${t.shieldMax}`;
    $('#hull-txt').textContent = `Hull ${Math.ceil(t.hull)} / ${t.hullMax}`;
    const regen = t.shieldRegen * (t.regenDelay > 0 ? TOWER.underFireRegen : t.calm ? TOWER.calmRegenMul + this.scene.tree.mods.calmMul : 1);
    $('#shield-regen').textContent = `+${regen.toFixed(0)}/s${t.regenDelay > 0 ? ' under fire' : t.calm ? ' calm' : ''}`;
    sb.classList.toggle('calm', t.calm && sf < 1);
    sb.classList.toggle('down', t.shield <= 0);
    hb.classList.toggle('warn', hf <= 0.5 && hf > 0.25);
    hb.classList.toggle('crit', hf <= 0.25);

    // tower tab: slots
    let html = `<h3>Hardpoints <span class="muted" style="float:right;letter-spacing:0">swaps left: <b>${this.scene.swapsLeft()}</b></span></h3>`;
    t.slots.forEach((w, i) => {
      if (w) {
        const cost = w.upgradeCost();
        const hex = '#' + w.color.toString(16).padStart(6, '0');
        const swapsLeft = this.scene.swapsLeft();
        const strip = Object.entries(WEAPONS).filter(([type]) => this.scene.tree.unlocked(type)).map(([type, d]) => {
          const h2 = '#' + d.color.toString(16).padStart(6, '0'), cur = type === w.type, can = !cur && swapsLeft > 0 && s.scrap >= d.install;
          return `<button class="swap-ic ${cur ? 'cur' : ''}" data-buy="doswap:${i}:${type}" ${cur || !can ? 'disabled' : ''} style="color:${h2}" title="${cur ? 'mounted' : d.name + ' · starts at Lv 1 · ' + fmt(d.install) + ' scrap'}">${ICONS[type]}</button>`;
        }).join('');
        html += `<div class="item weapon" style="border-color:${hex}55">
          <div class="icon" style="color:${hex}">${ICONS[w.type]}</div>
          <div class="name">${w.def.name}<small>Lv ${w.level}</small></div>
          <div class="desc">${w.statLine()}<br>
            <span class="next">Lv ${w.level + 1}: ${w.nextLine()}</span><br>
            <span class="vs">×${w.def.bonus} vs ${w.def.prefer.map(p => MOBS[p].name).join(', ')}</span> · <span class="crit">${Math.round((w.def.crit ?? CRIT.chance) * 100)}% crit ×${w.def.critMul ?? CRIT.mul}</span></div>
          ${this.buyBtn('weapon:' + i, cost, s.scrap >= cost)}
          ${w.type === 'drones' ? `<div class="mode-row"><span class="swap-lbl">drones</span><button class="mode ${w.focus ? '' : 'on'}" data-buy="dmode:${i}:spread">Spread</button><button class="mode ${w.focus ? 'on' : ''}" data-buy="dmode:${i}:focus">Focus fire</button><span class="muted" style="font-size:11px">${w.focus ? 'all drones on one target' : 'each drone its own target'}</span></div>` : ''}
          <div class="swap-strip"><span class="swap-lbl">swap<b class="${swapsLeft ? '' : 'none'}">${swapsLeft} left</b></span>${strip}</div>
        </div>`;
      } else {
        html += `<div class="item slot-empty"><div class="icon">${ICONS.slot}</div><div class="name">Hardpoint ${i + 1}</div><div class="desc">Choose a weapon to mount</div></div>`;
        for (const [type, d] of Object.entries(WEAPONS)) {
          const hex = '#' + d.color.toString(16).padStart(6, '0');
          const ok = this.scene.tree.unlocked(type);
          html += `<div class="item pick ${ok ? '' : 'gated'}">
            <div class="icon" style="color:${hex}">${ICONS[type]}</div>
            <div class="name" style="color:${hex}">${d.name}</div>
            <div class="desc">${d.desc}<br><span class="vs">×${d.bonus} vs ${d.prefer.map(p => MOBS[p].name).join(', ')}</span>${ok ? '' : '<br><span class="gate">Unlock in Skills with fragments</span>'}</div>
            ${ok ? this.buyBtn('install:' + i + ':' + type, d.install, s.scrap >= d.install, 'Mount') : '<button class="buy" disabled>Locked</button>'}
          </div>`;
        }
      }
    });
    const slotCost = t.nextSlotCost();
    if (slotCost !== null) {
      html += `<div class="item slot-empty">
        <div class="icon">${ICONS.slot}</div>
        <div class="name">Locked hardpoint</div>
        <div class="desc">Slot ${t.slots.length + 1} of ${SLOT_COSTS.length}<br><span class="next">Unlock: mount any weapon here, fires on its own</span></div>
        ${this.buyBtn('slot', slotCost, s.scrap >= slotCost, 'Unlock')}
      </div>`;
    }
    const combos = this.scene.combos.list(), activeN = combos.filter(c => c.available).length;
    this.combosOpen = this.combosOpen ?? false;
    html += `<h3 class="collapsible" data-buy="toggle:combos">Combos <span class="muted" style="letter-spacing:0">${activeN} active</span><span class="chev">${this.combosOpen ? '▾' : '▸'}</span></h3>`;
    if (this.combosOpen) html += '<div class="muted" style="margin-bottom:8px">Mount both weapons. Each shot has a small chance to trigger the combo.</div>';
    for (const c of combos) {
      if (!this.combosOpen && !c.available) continue;
      const names = c.pair.map(p => WEAPONS[p].name).join(' + ');
      const hex = '#' + c.color.toString(16).padStart(6, '0');
      const ic = c.pair.map(p => { const wc = '#' + WEAPONS[p].color.toString(16).padStart(6, '0'); const on = this.scene.combos.mounted(p); return `<span class="pi ${on ? 'on' : ''}" style="color:${wc}" title="${WEAPONS[p].name}">${ICONS[p]}</span>`; }).join('<span class="plus">+</span>');
      html += `<div class="item combo ${c.available ? 'on' : ''}" style="${c.available ? 'border-color:' + hex + '66' : ''}">
        <div class="icon pair">${ic}</div>
        <div class="name" style="${c.available ? 'color:' + hex : ''}">${c.name}<small>${names}</small></div>
        <div class="desc">${c.desc}<br><span class="next">${Math.round(c.chance * 100)}% chance · ${c.cd > 0 ? Math.ceil(c.cd) + 's cooldown' : (c.available ? 'ready' : 'not mounted')}</span></div>
      </div>`;
    }
    this.setHtml('#tab-tower', html);

    // upgrades tab
    const shieldTxt = Math.ceil(t.shield) + ' of ' + t.shieldMax;
    const hullTxt = Math.ceil(t.hull) + ' of ' + t.hullMax;
    html = `<h3>Status</h3><div class="item"><div class="icon">${ICONS.hull}</div><div class="name">Core</div>
      <div class="desc">Shield <b>${shieldTxt}</b> · regen <b>${t.shieldRegen.toFixed(1)}</b> per s${t.calm ? ' <b>(calm ×' + TOWER.calmRegenMul + ')</b>' : ''}<br>Hull <b>${hullTxt}</b></div></div>
      <h3>Tower upgrades</h3>`;
    for (const key of Object.keys(TOWER_UPGRADES)) {
      const u = TOWER_UPGRADES[key], cost = t.upgradeCost(key), lvl = t.upgrades[key];
      const cur = key === 'shieldMax' ? t.shieldMax : key === 'shieldRegen' ? t.shieldRegen : t.hullMax;
      const fmtU = (v) => key === 'shieldRegen' ? v.toFixed(1) + '/s' : Math.round(v);
      html += `<div class="item">
        <div class="icon">${ICONS[key]}</div>
        <div class="name">${u.name}<small>Lv ${lvl}</small></div>
        <div class="desc">Now <b>${fmtU(cur)}</b><br><span class="next">Lv ${lvl + 1}: <b>${fmtU(cur + u.add)}</b> (+${u.add})</span></div>
        ${this.buyBtn('tower:' + key, cost, s.scrap >= cost)}
      </div>`;
    }
    // auto-buy section
    const ab = this.scene.autobuy;
    const q = ab.queue(8);
    this.renderQueue(q);
    html += `<h3>Auto-buy</h3>
      <div class="item auto ${ab.on ? 'on' : ''}"><div class="icon">${ICONS.level}</div>
        <div class="name">Auto-buy<small>${ab.on ? 'running' : 'off'}</small></div>
        <div class="desc">Every 0.5 s buys the first affordable item in this order.${ab.lastBuy ? '<br><span class="next">Last: ' + ab.lastBuy.label + '</span>' : ''}</div>
        <button class="buy" data-buy="auto:toggle">${ab.on ? 'Turn off' : 'Turn on'}</button></div>`;
    if (q.length) {
      html += `<div class="item queue"><div class="icon">${ICONS.level}</div><div class="name">Queue<small>next ${q.length}</small></div>
        <div class="desc">${q.map((e, i) => `<span class="${e.now ? 'now' : ''}">${i + 1}. ${e.label}${e.from === null ? '' : ' Lv ' + e.from + '&rarr;' + e.to} <em>${fmt(e.cost)}</em></span>`).join('<br>')}</div></div>`;
    }
    ab.order.forEach((key, i) => {
      const it = AUTO_ITEMS[key], o = ab.option(key), en = ab.enabled[key];
      html += `<div class="item auto-row ${en ? '' : 'gated'}">
        <div class="prio">${i + 1}</div>
        <div class="name">${it.name}<small>${o ? fmt(o.cost) + ' scrap' : 'nothing to buy'}</small></div>
        <div class="desc">${it.desc}</div>
        <div class="auto-btns">
          <button class="mini" data-buy="auto:up:${key}" ${i === 0 ? 'disabled' : ''} title="Higher priority">▲</button>
          <button class="mini" data-buy="auto:down:${key}" ${i === ab.order.length - 1 ? 'disabled' : ''} title="Lower priority">▼</button>
          <button class="mini ${en ? 'on' : ''}" data-buy="auto:on:${key}" title="Enable or skip">${en ? '✓' : '–'}</button>
        </div></div>`;
    });
    this.setHtml('#tab-upgrades', html);

    // skills tab
    const tr = this.scene.tree, canP = this.scene.canPrestige(), nf = this.scene.fragmentsForRun();
    html = `<div class="item prestige"><div class="icon" style="color:var(--violet)">${ICONS.ab_nuke}</div>
      <div class="name">Prestige<small>×${this.scene.profile.prestige}</small></div>
      <div class="desc">Fragments now: <b class="violet">${fmt(s.fragments)}</b><br>
        <span class="next">This run would give <b>${nf}</b>. ${canP ? 'Ready.' : 'Available from threat ' + PRESTIGE.minTier + '.'}</span></div>
      <button class="buy" data-buy="prestige" ${canP ? '' : 'disabled'}>Prestige<span class="cost">+${nf} frag</span></button></div>`;
    for (const [bk, b] of Object.entries(BRANCHES)) {
      const hex = '#' + b.color.toString(16).padStart(6, '0');
      html += `<h3 style="color:${hex}">${b.name}</h3>`;
      for (const [id, n] of Object.entries(TREE)) {
        if (n.branch !== bk) continue;
        const lvl = tr.level(id), maxed = lvl >= n.max, locked = n.requires && !tr.level(n.requires);
        const cost = maxed ? 0 : tr.cost(id);
        const icon = n.unlock ? ICONS[n.unlock] : (ICONS[id] || ICONS.level);
        html += `<div class="item skill ${lvl ? 'owned' : ''} ${locked ? 'gated' : ''}" style="${lvl ? 'border-color:' + hex + '66' : ''}">
          <div class="icon" style="color:${lvl ? hex : 'var(--muted)'}">${icon}</div>
          <div class="name">${n.name}<small>${lvl} / ${n.max}</small></div>
          <div class="desc">${lvl ? '<b>' + n.text(lvl) + '</b>' : n.text(1).replace(/^/, 'Lv 1: ')}${lvl && !maxed ? '<br><span class="next">Lv ' + (lvl + 1) + ': ' + n.text(lvl + 1) + '</span>' : ''}${locked ? '<br><span class="gate">Requires ' + TREE[n.requires].name + '</span>' : ''}</div>
          ${maxed ? '<button class="buy" disabled>Max</button>' : `<button class="buy" data-buy="skill:${id}" ${tr.canBuy(id) ? '' : 'disabled'}>Buy<span class="cost violet">${cost} frag</span></button>`}
        </div>`;
      }
    }
    this.setHtml('#tab-skills', html);
    if ($('#tab-stats').classList.contains('active')) this.setHtml('#tab-stats', this.statsHtml());
    $('#tabs button[data-tab=skills]').hidden = false;
  }

  setHtml(sel, html) {
    const el = $(sel);
    if (el.dataset.last === html) return;
    el.dataset.last = html; el.innerHTML = html;
    el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => this.buy(b.dataset.buy));
  }

  buy(id, silent = false) {
    const s = this.scene.state, t = this.scene.tower;
    const [kind, arg] = id.split(':');
    const before = s.scrap;
    this.doBuy(id, kind, arg, s, t);
    if (!silent && kind !== 'swap') this.scene.sfx.play(s.scrap !== before || (kind === 'install' && WEAPONS[id.split(':')[2]].install === 0) ? 'buy' : 'deny');
    this.render();
  }

  doBuy(id, kind, arg, s, t) {
    if (kind === 'weapon') {
      const w = t.slots[+arg], cost = w.upgradeCost();
      if (s.scrap >= cost) { s.scrap -= cost; w.level++; }
    } else if (kind === 'slot') {
      const cost = t.nextSlotCost();
      if (cost !== null && s.scrap >= cost) { s.scrap -= cost; t.unlockSlot(); }
    } else if (kind === 'install') {
      const [, idx, type] = id.split(':'), cost = WEAPONS[type].install;
      if (t.slots[+idx] === null && s.scrap >= cost) { s.scrap -= cost; t.installWeapon(+idx, type); }
    } else if (kind === 'toggle') {
      if (arg === 'combos') this.combosOpen = !this.combosOpen;
      return;
    } else if (kind === 'dmode') {
      const [, idx, mode] = id.split(':'), w = t.slots[+idx];
      if (w && w.type === 'drones') w.focus = mode === 'focus';
      return;
    } else if (kind === 'swap') {
      this.swapping = this.swapping === +arg ? null : +arg;
    } else if (kind === 'doswap') {
      const [, idx, type] = id.split(':'), cost = WEAPONS[type].install;
      if (t.slots[+idx] && t.slots[+idx].type !== type && this.scene.swapsLeft() > 0 && s.scrap >= cost) { s.scrap -= cost; s.swapsUsed = (s.swapsUsed || 0) + 1; t.swapWeapon(+idx, type); this.scene.fx.floater(t.x, t.y - 80, 'Refit: ' + WEAPONS[type].name, '#' + WEAPONS[type].color.toString(16).padStart(6, '0'), 16); }
    } else if (kind === 'ability') {
      const a = this.scene.abilities, d = ABILITIES[arg];
      if (!a.state[arg].unlocked && s.scrap >= d.cost) { s.scrap -= d.cost; a.unlock(arg); }
    } else if (kind === 'auto') {
      const ab = this.scene.autobuy, [, what, key] = id.split(':');
      if (what === 'toggle') { ab.on = !ab.on; if (ab.on) this.panel.classList.add('hidden'); }
      else if (what === 'up') ab.move(key, -1);
      else if (what === 'down') ab.move(key, 1);
      else if (what === 'on') ab.enabled[key] = !ab.enabled[key];
      this.syncAuto();
      return;
    } else if (kind === 'skill') {
      if (!t) return;
      this.scene.tree.buy(arg) ? this.scene.sfx.play('buy') : this.scene.sfx.play('deny');
      return;
    } else if (kind === 'prestige') {
      $('#btn-prestige').click();
      return;
    } else if (kind === 'tower') {
      const cost = t.upgradeCost(arg);
      if (s.scrap >= cost) { s.scrap -= cost; t.buyUpgrade(arg); }
    }
  }
}
