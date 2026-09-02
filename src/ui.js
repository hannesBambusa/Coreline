// The scene talks to `scene.ui`; this class wires the DOM once and delegates the work to src/ui/*.js.
import { hex, $, $$, swapHtml, bindBuy, askConfirm } from './ui/dom.js';
import { WEAPONS } from './config.js';
import { ICONS } from './icons.js';
import * as hud from './ui/hud.js';
import * as fx from './ui/effects.js';
import { renderTowerTab, renderUpgradesTab, renderSkillsTab } from './ui/panel.js';
import { statsHtml } from './ui/stats.js';
import { purchase, isFreeInstall } from './ui/purchases.js';
import { initSettings, initResize, syncSettings, syncMute } from './ui/settings.js';

const RENDER_MS = 150;
const TAB_BUILDERS = { tower: renderTowerTab, upgrades: renderUpgradesTab, skills: renderSkillsTab, stats: (ui) => statsHtml(ui.scene) };
const TEXT_INPUTS = ['INPUT', 'TEXTAREA'];

export class UI {
  constructor(scene) {
    this.scene = scene;
    this.panel = $('#panel');
    this.effects = {};          // id -> effect card (effects.js)
    this.cooldownRows = {};     // slot -> cooldown card (effects.js)
    this.abilityButtons = [];   // filled by hud.buildAbilityBar
    this.tipAnchor = null;
    this.combosOpen = false;
    this.activeTab = 'tower';
    this.bannerTimer = null;
    this.cbTimer = null;
    this.tabEls = {};
    for (const el of $$('.tab')) this.tabEls[el.id.replace('tab-', '')] = el;

    $('#panel-toggle').onclick = () => { this.panel.classList.toggle('hidden'); this.render(); };
    for (const b of $$('#tabs button')) b.onclick = () => this.showTab(b.dataset.tab);
    $('#tabs button[data-tab=skills]').hidden = false;
    initSettings(this);
    this.applyPanelWidth = initResize(this);
    hud.buildAbilityBar(this);
    $('#btn-offline-ok').onclick = () => { $('#offline').hidden = true; };
    $('#btn-start').onclick = () => scene.beginRun();
    $('#start-weapons').onclick = (e) => { const b = e.target.closest('[data-start]'); if (b) scene.setStartWeapon(b.dataset.start); };
    $('#btn-pause').onclick = () => scene.setPaused(!scene.paused);
    $('#btn-auto').onclick = () => this.toggleAuto(true);
    $('#auto-reserve').oninput = (e) => { scene.autobuy.reserve = Math.max(0, +e.target.value || 0); };
    window.addEventListener('keydown', (e) => this.onKey(e));
    $('#btn-rebuild').onclick = () => { $('#overlay').hidden = true; scene.prestige(); this.showTab('skills'); };
    $('#btn-prestige').onclick = () => this.confirmPrestige();
    $('#btn-endrun').onclick = () => this.confirmEndRun();
    this.render();
    setInterval(() => this.render(), RENDER_MS);
  }

  panelHidden() { return this.panel.classList.contains('hidden'); }

  onKey(e) {
    const scene = this.scene;
    if (e.code === 'Space' && !TEXT_INPUTS.includes(document.activeElement.tagName)) { e.preventDefault(); scene.setPaused(!scene.paused); }
    if (scene.choosing && (e.key === '1' || e.key === '2')) { const b = $$('#choice .ch-card')[+e.key - 1]; if (b) b.click(); }
  }

  // ---- Rendering ----------------------------------------------------------

  /** Runs every RENDER_MS. The HUD is always refreshed; the panel only builds the tab that is showing. */
  render() {
    const scene = this.scene;
    hud.renderTopBar(scene);
    hud.renderCoreBars(scene);
    hud.renderAbilities(this);
    hud.renderQuickBuy(this);
    hud.renderBossBar(scene);
    hud.renderThreatTimer(scene);
    hud.renderQueue(this);
    if (!this.panelHidden()) this.renderTab(this.activeTab);
  }

  renderTab(name) {
    const build = TAB_BUILDERS[name];   // the settings tab is static markup
    if (build) this.setTab(this.tabEls[name], build(this));
  }

  /** Swap a tab's markup only when it changed; drop a tooltip anchored inside it first. */
  setTab(el, html) {
    if (this.tipAnchor && el.dataset.last !== html && el.contains(this.tipAnchor)) this.hideTip();
    swapHtml(el, html, (root) => { bindBuy(root, (id) => this.buy(id)); fx.bindTips(this, root); });
  }

  // icon row on the start screen: every unlocked weapon type, current slot-1 weapon highlighted
  renderStartWeapons() {
    const scene = this.scene, cur = scene.tower.slots[0] ? scene.tower.slots[0].type : 'pulse';
    const html = Object.entries(WEAPONS).filter(([type]) => scene.tree.unlocked(type)).map(([type, d]) =>
      `<button class="swap-ic ${type === cur ? 'cur' : ''}" data-start="${type}" style="color:${hex(d.color)}" title="${d.name}">${ICONS[type]}</button>`).join('');
    $('#start-weapons').innerHTML = html;
    $('#start-weapon-name').textContent = WEAPONS[cur].name + ' · ' + WEAPONS[cur].desc;
  }

  showTab(name) {
    this.activeTab = name;
    for (const b of $$('#tabs button')) b.classList.toggle('active', b.dataset.tab === name);
    for (const t of $$('.tab')) t.classList.toggle('active', t.id === 'tab-' + name);
    if (!this.panelHidden()) this.renderTab(name);
  }

  // ---- Buying -------------------------------------------------------------

  /**
   * Handle a data-buy id. Panel-only actions (collapsing combos, auto-buy order, skills, prestige) are handled here;
   * everything that spends scrap goes through purchases.purchase. Plays buy/deny unless silent (auto-buy).
   */
  buy(id, silent = false) {
    const scene = this.scene, [kind, arg] = id.split(':');
    let changed = false;
    if (kind === 'toggle') { if (arg === 'combos') this.combosOpen = !this.combosOpen; }
    else if (kind === 'auto') this.autoAction(id);
    else if (kind === 'skill') scene.sfx.play(scene.tree.buy(arg) ? 'buy' : 'deny');
    else if (kind === 'prestige') this.confirmPrestige();
    else changed = purchase(scene, id);
    if (!silent) scene.sfx.play(changed || isFreeInstall(id) ? 'buy' : 'deny');
    this.render();
  }

  autoAction(id) {
    const ab = this.scene.autobuy, [, what, key] = id.split(':');
    if (what === 'toggle') { this.toggleAuto(false); return; }
    if (what === 'up') ab.move(key, -1);
    else if (what === 'down') ab.move(key, 1);
    else if (what === 'on') ab.enabled[key] = !ab.enabled[key];
    this.syncAuto();
  }

  /** Turning auto-buy on hands the screen to the queue by collapsing the panel. */
  toggleAuto(playSound) {
    const scene = this.scene, ab = scene.autobuy;
    ab.on = !ab.on;
    if (ab.on) this.panel.classList.add('hidden');
    this.syncAuto();
    if (playSound) scene.sfx.play(ab.on ? 'buy' : 'deny');
  }

  syncAuto() {
    const ab = this.scene.autobuy, btn = $('#btn-auto');
    btn.classList.toggle('on', ab.on);
    btn.textContent = ab.on ? 'AUTO ON' : 'AUTO';
    $('#auto-reserve').value = ab.reserve;
    this.render();
  }

  // End the run now: prestige when eligible, otherwise a plain reset with no fragments
  confirmEndRun() {
    const scene = this.scene;
    if (scene.canPrestige()) return this.confirmPrestige();
    askConfirm('End this run?', 'You are below threat 10, so no fragments for it. Scrap, weapons and tower upgrades reset. Skills stay.', { okLabel: 'End run' })
      .then(ok => { if (ok) { scene.resetRun(); this.showTab('tower'); this.render(); } });
  }

  confirmPrestige() {
    const scene = this.scene, n = scene.fragmentsForRun();
    if (!scene.canPrestige()) return;
    askConfirm('End run and prestige?', `You get ${n} fragment${n === 1 ? '' : 's'} for this run. Scrap, weapons and tower upgrades reset. Skills stay.`, { okLabel: 'Prestige', danger: false })
      .then(ok => { if (ok) { scene.prestige(); this.render(); } });
  }

  abilityClick(k) { hud.abilityClick(this, k); }
  renderQuickBuy() { hud.renderQuickBuy(this); }

  // ---- Delegations --------------------------------------------------------

  syncSettings() { syncSettings(this); }
  syncMute() { syncMute(this); }

  banner(text, boss = false) { hud.banner(this, text, boss); }
  comboBanner(c) { hud.comboBanner(this, c); }

  addEffect(id, def) { fx.addEffect(this, id, def); }
  removeEffect(id) { fx.removeEffect(this, id); }
  clearEffects() { fx.clearEffects(this); }
  updateEffects(dt) { fx.updateEffects(this, dt); }
  updateCooldowns() { fx.updateCooldowns(this); }

  showTip(anchor, text) { fx.showTip(this, anchor, text); }
  hideTip() { fx.hideTip(this); }

  showChoice(ch) { fx.showChoice(this, ch); }
  hideChoice(id) { fx.hideChoice(id); }
  showOffline(o) { fx.showOffline(o); }
  showGameOver() { fx.showGameOver(this.scene); }
}
