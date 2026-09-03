// The scene talks to `scene.ui`; this class wires the DOM once and delegates the work to src/ui/*.js.
import { hex, $, $$, swapHtml, bindBuy, askConfirm } from './ui/dom.js';
import { WEAPONS, DIFFICULTY } from './config.js';
import { ICONS } from './icons.js';
import * as hud from './ui/hud.js';
import * as fx from './ui/effects.js';
import { renderTowerTab, renderUpgradesTab, renderSkillsTab } from './ui/panel.js';
import { statsHtml } from './ui/stats.js';
import { wikiHtml } from './ui/wiki.js';
import { VERSION, watchVersion } from './version.js';
import { purchase, isFreeInstall } from './ui/purchases.js';
import { initSettings, initResize, syncSettings, syncMute } from './ui/settings.js';

const RENDER_MS = 150;
const TAB_BUILDERS = { tower: renderTowerTab, upgrades: renderUpgradesTab, skills: renderSkillsTab, stats: (ui) => statsHtml(ui.scene), wiki: (ui) => wikiHtml(ui.scene, ui.wikiTab) };
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
    for (const b of $$('#tabs button')) { b.innerHTML = ICONS['tab_' + b.dataset.tab] || b.dataset.tab; b.onclick = () => this.showTab(b.dataset.tab); }
    fx.bindTips(this, $('#tabs'));
    this.wikiTab = 'ships';
    $('#tab-wiki').addEventListener('click', (e) => { const b = e.target.closest('[data-wiki]'); if (b) { this.wikiTab = b.dataset.wiki; this.renderTab('wiki'); } });
    $('#tabs button[data-tab=skills]').hidden = false;
    initSettings(this);
    this.applyPanelWidth = initResize(this);
    hud.buildAbilityBar(this);
    $('#btn-offline-ok').onclick = () => { $('#offline').hidden = true; };
    $('#btn-start').onclick = () => scene.beginRun();
    $('#btn-intro-ok').onclick = () => { $('#intro').hidden = true; scene.profile.seenIntro = true; };
    $('#btn-intro-show').onclick = () => { $('#intro').hidden = false; };
    $('#start-weapons').onclick = (e) => { const b = e.target.closest('[data-start]'); if (b) scene.setStartWeapon(b.dataset.start); };
    $('#start-diff').onclick = (e) => { const b = e.target.closest('[data-diff]'); if (b) scene.setDifficulty(b.dataset.diff); };
    $('#btn-pause').onclick = () => { if (!scene.starting) scene.setPaused(!scene.paused); };
    $('#speed').onclick = (e) => { const b = e.target.closest('[data-speed]'); if (b) this.setSpeed(+b.dataset.speed); };
    $('#btn-auto').onclick = () => this.toggleAuto(true);
    $('#auto-reserve').oninput = (e) => { scene.autobuy.reserve = Math.max(0, +e.target.value || 0); };
    window.addEventListener('keydown', (e) => this.onKey(e));
    $('#btn-rebuild').onclick = () => { $('#overlay').hidden = true; scene.prestige(); this.showTab('skills'); };
    $('#btn-prestige').onclick = () => this.confirmPrestige();
    $('#btn-endrun').onclick = () => this.confirmEndRun();
    this.initAccount();
    $('#version-num').textContent = 'v' + VERSION; $('#version-settings').textContent = 'v' + VERSION; $('#login-version').textContent = 'Coreline v' + VERSION;
    $('#version-update').onclick = () => location.reload();
    watchVersion((remote) => { const b = $('#version-update'); b.textContent = `v${remote} available · reload`; b.hidden = false; });
    this.render();
    setInterval(() => this.render(), RENDER_MS);
  }

  panelHidden() { return this.panel.classList.contains('hidden'); }

  // ---- Cloud account (start card + settings) ----
  initAccount() {
    const scene = this.scene, cloud = scene.cloud, msg = (t) => { $('#acc-msg').textContent = t || ''; };
    const creds = () => [$('#acc-email').value.trim(), $('#acc-pass').value];
    $('#acc-signin').onclick = async () => { const [e, p] = creds(); msg('…'); msg(await cloud.signIn(e, p)); };
    $('#acc-signup').onclick = async () => { const [e, p] = creds(); if (p.length < 6) return msg('Password needs 6+ characters'); msg('…'); msg(await cloud.signUp(e, p)); };
    $('#acc-magic').onclick = async () => { const [e] = creds(); if (!e) return msg('Type your email first'); msg('…'); msg(await cloud.magicLink(e)); };
    $('#acc-google').onclick = async () => { msg('…'); msg(await cloud.signInGoogle()); };
    $('#acc-offline').onclick = () => { this.offlineOk = true; this.syncAccount(); };
    $('#acc-signout').onclick = $('#acc-settings-out').onclick = async () => msg(await cloud.signOut());
    $('#acc-pass').onkeydown = (e) => { if (e.key === 'Enter') $('#acc-signin').click(); };
    fx.bindTips(this, $('#topbar'));
    cloud.onChange(() => this.syncAccount());
    this.syncAccount();
  }
  /** true while the player must sign in before a run can start */
  loginGate() {
    const c = this.scene.cloud;
    return c.enabled && c.status !== 'in' && !(c.status === 'error' && this.offlineOk);
  }
  syncAccount() {
    const c = this.scene.cloud, scene = this.scene, on = c.enabled, who = c.user ? (c.user.email || 'signed in') : '';
    const gate = scene.starting && this.loginGate();
    $('#login').hidden = !gate;
    document.body.classList.toggle('login', gate);
    $('#start').hidden = !scene.starting || gate;
    $('#acc-offline').hidden = c.status !== 'error';
    $('#account-out').hidden = c.status === 'in';
    $('#account-in').hidden = c.status !== 'in';
    $('#acc-who').textContent = who ? `Signed in as ${who}` : '';
    if (c.loginError && c.status !== 'in') $('#acc-msg').textContent = 'Sign-in failed: ' + c.loginError;   // sticky until the next sign-in attempt
    else if (c.status === 'loading') $('#acc-msg').textContent = 'Connecting…';
    else if (c.status === 'error') $('#acc-msg').textContent = 'Cloud unavailable right now, playing locally';
    else if (c.status === 'out') $('#acc-msg').textContent = 'Sign in to keep your progress across devices';
    else $('#acc-msg').textContent = 'Progress syncs after every save';
    $('#acc-settings').hidden = !(on && c.status === 'in');
    $('#acc-settings-who').textContent = who;
  }

  /** game speed from the top bar: ¼, ½, 1, 2 or 4. Remembered in settings. */
  setSpeed(v) {
    const scene = this.scene;
    scene.speed = v; scene.settings.speed = v;
    for (const b of $$('#speed button')) b.classList.toggle('on', +b.dataset.speed === v);
  }

  onKey(e) {
    const scene = this.scene;
    if (e.code === 'Space' && !TEXT_INPUTS.includes(document.activeElement.tagName)) { e.preventDefault(); scene.setPaused(!scene.paused); }
    const ultKey = { q: 0, w: 1, e: 2, r: 3 }[e.key.toLowerCase()];
    if (ultKey !== undefined && !e.ctrlKey && !e.metaKey && !TEXT_INPUTS.includes(document.activeElement.tagName) && !scene.paused && !scene.starting) { const u = scene.quads.bar()[ultKey]; if (u) this.fireUltimate(u.id); }
    if (scene.choosing && (e.key === '1' || e.key === '2')) { const b = $$('#choice .ch-card')[+e.key - 1]; if (b) b.click(); }
  }

  // ---- Rendering ----------------------------------------------------------

  /** Runs every RENDER_MS. The HUD is always refreshed; the panel only builds the tab that is showing. */
  render() {
    const scene = this.scene;
    hud.renderTopBar(scene);
    hud.renderAbilities(this);
    hud.renderUltimates(this);
    hud.renderBossBar(scene);
    hud.renderThreatTimer(scene);
    hud.renderQueue(this);
    hud.renderLoadout(this);
    if (this.panelHidden()) return;
    if (this.activeTab === 'settings') { const el = $('#perf-now'); if (el.textContent !== scene.perf.label) el.textContent = scene.perf.label; }
    this.renderTab(this.activeTab);
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
    const html = Object.entries(WEAPONS).filter(([type, d]) => scene.tree.unlocked(type) && !d.support).map(([type, d]) =>
      `<button class="swap-ic ${type === cur ? 'cur' : ''}" data-start="${type}" style="color:${hex(d.color)}" title="${d.name}">${ICONS[type]}</button>`).join('');
    $('#start-weapons').innerHTML = html;
    $('#start-weapon-name').textContent = WEAPONS[cur].name + ' · ' + WEAPONS[cur].desc;
    const dk = scene.state.difficulty, d = scene.diff, x = (v) => '×' + v;
    $('#start-diff').innerHTML = Object.entries(DIFFICULTY).map(([k, o]) => {
      const locked = !scene.diffUnlocked(k), u = o.unlock;
      const tip = locked ? `Locked&#10;Reach threat ${u.tier} on ${DIFFICULTY[u.on].name} to unlock` : `${o.name}&#10;Ship HP ×${o.hp}, damage ×${o.dmg}, spawns ×${o.spawn}`;
      return `<button class="diff-btn ${k === dk ? 'cur' : ''} ${locked ? 'locked' : ''}" data-diff="${k}" style="color:${o.color}" data-tip="${tip}">${locked ? '🔒 ' : ''}${o.name}</button>`;
    }).join('');
    fx.bindTips(this, $('#start-diff'));
    $('#start-diff-desc').innerHTML = `Ship HP ${x(d.hp)} · damage ${x(d.dmg)} · spawns ${x(d.spawn)} · ship cap ${x(d.cap)} · speed ${x(d.speed)} · elites ${x(d.elite)}<br><span style="color:${d.color}">scrap ${x(d.scrap)}, fragments ${x(d.frag)}</span>`;
  }

  showTab(name) {
    if ((name === 'tower' || name === 'upgrades') && this.scene.starting) return;   // Tower and Upgrades are for a running game
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
    else if (kind === 'skill') { const ok = scene.tree.buy(arg); scene.sfx.play(ok ? 'buy' : 'deny'); if (ok) scene.saves.save(); }   // a skill is permanent: write it now, not at the next autosave
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
  fireUltimate(id) { const ok = this.scene.quads.fireUltimate(id); this.scene.sfx.play(ok ? 'buy' : 'deny'); }

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
