// The one Phaser scene. Owns the run state and the game objects; the mechanics live in ./scene/*.js as
// plain functions that take the scene first. The thin methods at the bottom keep the old `scene.x()` API
// for everything else in the game (mobs, weapons, ui, saves).
import { COLORS, PRESTIGE, ABILITIES } from './config.js';
import { Tree } from './tree.js';
import { Abilities } from './abilities.js';
import { SFX } from './sfx.js';
import { SaveSystem } from './save.js';
import { Combos } from './combos.js';
import { AutoBuy } from './autobuy.js';
import { baseLevelMods } from './choices.js';
import { Transmissions } from './transmissions.js';
import { Music } from './music.js';
import { Tower } from './tower.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { makeTextures, makeStarfield } from './scene/textures.js';
import * as spawner from './scene/spawner.js';
import * as siege from './scene/siege.js';
import * as choices from './scene/choices.js';
import * as damage from './scene/damage.js';
import * as projectiles from './scene/projectiles.js';

const BG_COLOR = 0x05060d;
const MAX_DT = 0.05;                  // clamp frame time so tab switches do not teleport everything
const MUSIC_TICK = 0.5;               // seconds between music state updates
const HULL_LOW_FRAC = 0.3;
const STAR_DRIFT = 4;
const STAR_WRAP = 1.4;                // stars live over 1.4x the viewport width (see textures.js)

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    makeTextures(this);

    // run + meta state
    this.state = { scrap: 0, fragments: 0, time: 0, tier: 1, kills: 0, bestTime: 0, swapsUsed: 0 };
    this.profile = { totalKills: 0, prestige: 0 };
    this.settings = { shake: true, sound: true, volume: 0.7, music: true, transmissions: true };
    this.stats = this.freshStats();
    this.scrapLog = [];
    this.seen = {};                    // mob types already announced this session

    // entities
    this.mobs = []; this.bullets = []; this.enemyBullets = [];
    this.missiles = []; this.wellShots = []; this.wells = [];

    // flow flags
    this.gameOver = false;
    this.paused = false;
    this.starting = false;
    this.choosing = false;
    this.choice = null;
    this.levelMods = baseLevelMods();
    this.levelChoice = null;
    this.spawnTimer = 2;
    this.siege = null; this.siegesCleared = 0;
    this.surgeType = null;
    this.slowTimer = 0; this.timeScale = 1;
    this.musicTimer = 0;

    // systems
    this.sfx = new SFX();
    this.sfx.width = this.scale.width;
    this.tree = new Tree(this);
    this.abilities = new Abilities(this);
    this.combos = new Combos(this);
    this.autobuy = new AutoBuy(this);
    this.tx = new Transmissions(this);
    this.music = new Music(this.sfx);

    // display
    const { width, height } = this.scale;
    this.bg = this.add.rectangle(0, 0, width, height, BG_COLOR).setOrigin(0).setDepth(-1);
    makeStarfield(this, width, height);
    this.fx = new FX(this);
    this.tower = new Tower(this, width / 2, height / 2);
    this.tree.recompute();
    this.mobGfx = this.add.graphics().setDepth(5);
    this.screenFlash = this.add.rectangle(0, 0, width, height, 0xffffff).setOrigin(0).setDepth(20).setAlpha(0);
    this.bulletGfx = this.add.graphics().setDepth(4);
    if (this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1, 1.15, 4);
    }
    this.scale.on('resize', this.onResize, this);

    // ui + saves last: they read everything above
    this.ui = new UI(this);
    this.saves = new SaveSystem(this);
    const data = this.saves.load();
    if (data) {
      const res = this.saves.apply(data);
      this.ui.syncSettings();
      if (res.offline) this.ui.showOffline(res.offline);
    }
    if (this.state.time < 1) this.showStart();
  }

  onResize(gs) {
    this.bg.setSize(gs.width, gs.height);
    this.sfx.width = gs.width;
    this.screenFlash.setSize(gs.width, gs.height);
    this.tower.setPosition(gs.width / 2, gs.height / 2);
  }

  spawnRadius() { return Math.hypot(this.scale.width, this.scale.height) / 2 + 60; }

  // ---------- run lifecycle ----------
  // Fresh run: hold everything until the player presses start, so skills and weapons can be set up first.
  // the start screen lets the player pick the slot-1 weapon from what the tree has unlocked
  setStartWeapon(type) {
    if (!this.tree.unlocked(type) || this.tower.slots[0]?.type === type) return;
    this.tower.installWeapon(0, type);
    this.ui.renderStartWeapons();
    this.ui.render();
  }

  showStart() {
    this.starting = true;
    this.paused = true;
    this.ui.renderStartWeapons();
    document.getElementById('start').hidden = false;
    document.getElementById('paused').hidden = true;
    document.getElementById('btn-pause').classList.add('on');
  }

  beginRun() {
    if (!this.starting) return;
    this.starting = false;
    document.getElementById('start').hidden = true;
    this.setPaused(false);
    this.ui.banner('Hold the line', false);
    this.tx.say('start', 0);
  }

  setPaused(v) {
    if (this.choosing) return;   // a choice is open: pick a card to continue
    if (this.starting) { if (!v) this.beginRun(); return; }
    this.paused = v;
    this.sfx.play(v ? 'pause' : 'unpause');
    if (v) this.sfx.laserHum(false);
    document.getElementById('paused').hidden = !v;
    document.getElementById('btn-pause').classList.toggle('on', v);
    if (v) this.saves.save();
  }

  slowMo(scale = 0.4, seconds = 0.4) {
    this.timeScale = scale; this.slowTimer = seconds;
  }

  flashScreen(alpha = 0.6, color = 0xffffff) {
    this.screenFlash.setFillStyle(color);
    this.screenFlash.setAlpha(alpha);
    this.tweens.add({ targets: this.screenFlash, alpha: 0, duration: 500, ease: 'Quad.easeOut' });
  }

  abilityCost(k) { return ABILITIES[k].cost; }
  swapsLeft() { return Math.max(0, 1 + this.tree.mods.swaps - (this.state.swapsUsed || 0)); }

  fragmentsForRun() {
    return Math.floor(Math.pow(this.tier / PRESTIGE.divisor, PRESTIGE.power));
  }
  canPrestige() { return this.tier >= PRESTIGE.minTier; }

  // End the run: bank fragments, keep the tree, reset everything else.
  prestige() {
    const earned = this.fragmentsForRun();
    this.state.fragments += earned;
    this.profile.prestige++;
    this.resetRun();
    this.ui.render();
    this.fx.floater(this.tower.x, this.tower.y - 90, `+${earned} fragments`, '#c084fc', 20);
    this.tx.say('prestige', 0);
    this.saves.save();
    return earned;
  }

  onKill(m) {
    this.state.kills++;
    this.profile.totalKills++;
    this.stats.kills[m.type] = (this.stats.kills[m.type] || 0) + 1;
    const src = m.lastHit || 'other';
    this.stats.killsBy[src] = (this.stats.killsBy[src] || 0) + 1;
    const lm = this.levelMods;
    const scrap = Math.round(m.scrap * this.tree.mods.scrap * lm.scrap * (m.type === 'swarm' ? lm.swarmScrap : 1) * (m.elite ? lm.eliteScrap : 1));
    this.state.scrap += scrap;
    this.scrapLog.push([this.state.time, scrap]);
    this.sfx.play(m.type === 'boss' ? 'bigExplode' : 'explode', m.r, m.x);
    this.fx.floater(m.x, m.y + 6, `+${scrap}`, '#ffd166', 13);
  }

  onTowerDestroyed() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.fx.explode(this.tower.x, this.tower.y, COLORS.cyan, 60);
    this.fx.shake(0.02, 600);
    this.sfx.play('death'); this.sfx.bossHum(false);
    this.tx.say('death', 0);
    this.saves.save();
    this.time.delayedCall(700, () => this.ui.showGameOver());
  }

  resetRun() {
    for (const m of this.mobs) if (!m.dead) m.die(false);
    this.mobs = []; this.bullets = []; this.enemyBullets = [];
    this.missiles = []; this.wellShots = []; this.wells = [];
    this.tower.gfx.destroy(); this.tower.glow.destroy();
    this.tower = new Tower(this, this.scale.width / 2, this.scale.height / 2);
    this.state.scrap = this.tree.mods.startScrap; this.state.time = 0; this.state.tier = 1; this.state.kills = 0; this.state.swapsUsed = 0;
    this.showStart();
    this.spawnTimer = 2; this.scrapLog = []; this.siege = null; this.siegesCleared = 0; this.surgeType = null; this.ui.removeEffect('surge');
    this.stats = this.freshStats();
    this.levelMods = baseLevelMods(); this.levelChoice = null; this.choice = null; this.choosing = false; this.ui.hideChoice();
    this.combos.cd = {}; this.combos.count = 0;
    this.slowTimer = 0; this.timeScale = 1;
    this.autobuy.lastBuy = null;
    this.ui.clearEffects();
    this.ui.removeEffect('siege');
    for (const k in this.abilities.state) this.abilities.state[k] = { unlocked: false, cd: 0, active: 0 };
    this.autobuy.on = false; this.ui.syncAuto();
    this.gameOver = false;
    this.saves.save();
  }

  // ---------- frame ----------
  update(time, delta) {
    let dt = Math.min(delta / 1000, MAX_DT);
    if (!this.paused && !this.gameOver) { this.ui.updateEffects(dt); this.ui.updateCooldowns(); }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      dt *= this.slowTimer > 0 ? this.timeScale : 1;
    }
    if (this.gameOver) { this.fx.update(dt); return; }
    if (this.paused) { this.saves.update(dt); this.tower.draw(0); this.music.setState(this.musicState(true)); return; }
    this.driftStars(dt);
    this.abilities.update(dt);
    this.autobuy.update(dt);
    this.updateMusic(dt);
    this.combos.update(dt);
    this.saves.update(dt);
    this.tower.update(dt, this.mobs);
    for (const m of this.mobs) if (!m.dead) { if (m.marked > 0) m.marked -= dt; if (m.stun > 0) m.stunned(dt); else m.update(dt); }
    this.updateHums();
    this.mobs = this.mobs.filter(m => !m.dead);
    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.mobs = this.mobs.filter(m => !m.dead);
    this.updateSpawning(dt);
    this.drawBullets();
    this.drawMobBars();
    this.fx.update(dt);
  }

  /** Slow parallax drift; stars wrap once they leave the left edge. */
  driftStars(dt) {
    const w = this.scale.width * STAR_WRAP;
    for (const s of this.starLayers) {
      s.x -= (0.5 + s.layer * 0.8) * dt * STAR_DRIFT; if (s.x < -10) s.x += w;
    }
  }

  musicState(paused) {
    return { tier: this.tier, hullFrac: this.tower.hull / this.tower.hullMax, siege: !!this.siege, paused };
  }

  /** Start the music once audio is unlocked, then feed it the game state a couple of times a second. */
  updateMusic(dt) {
    if (this.sfx.ctx && !this.music.started) { this.music.start(); this.music.setEnabled(this.settings.music !== false); }
    this.musicTimer += dt;
    if (this.musicTimer <= MUSIC_TICK) return;
    this.musicTimer = 0;
    this.music.setState(this.musicState(this.paused));
    if (this.tower.hull / this.tower.hullMax < HULL_LOW_FRAC) this.tx.say('hullLow', 120);
  }

  /** Boss drone and laser hum follow what is on screen. */
  updateHums() {
    this.sfx.bossHum(this.mobs.some(m => m.type === 'boss'));
    let lr = 0; for (const w of this.tower.weapons) if (w.type === 'laser' && w.target && !w.target.dead) lr = Math.max(lr, w.ramp || 1);
    this.sfx.laserHum(lr > 0, lr);
  }

  // ---------- delegates: spawning ----------
  get tier() { return spawner.tierOf(this); }
  surgeMultiplier() { return spawner.surgeMultiplier(this); }
  spawnRate() { return spawner.spawnRate(this); }
  pickSurge(tierInt) { return spawner.pickSurge(this, tierInt); }
  pickType() { return spawner.pickType(this); }
  spawnMob(type, angle, tierOverride, gen) { return spawner.spawnMob(this, type, angle, tierOverride, gen); }
  updateSpawning(dt) { spawner.updateSpawning(this, dt); }

  // ---------- delegates: sieges ----------
  nextSiegeTier() { return siege.nextSiegeTier(this); }
  startSiege(level) { siege.startSiege(this, level); }
  updateSiege(dt) { siege.updateSiege(this, dt); }

  // ---------- delegates: threat-level choices ----------
  offerChoice(tierInt) { choices.offerChoice(this, tierInt); }
  pickChoice(id) { choices.pickChoice(this, id); }

  // ---------- delegates: damage ----------
  freshStats() { return damage.freshStats(); }
  addDmg(source, amount, crit = false) { damage.addDmg(this, source, amount, crit); }
  hit(m, weapon, x, y, opts = {}) { return damage.hit(this, m, weapon, x, y, opts); }
  damageRadius(x, y, r, dmg, color, weapon) { damage.damageRadius(this, x, y, r, dmg, color, weapon); }
  damageDrones(x, y, r, dmg, line = null) { damage.damageDrones(this, x, y, r, dmg, line); }

  // ---------- delegates: projectiles ----------
  spawnBullet(b) { projectiles.spawnBullet(this, b); }
  spawnEnemyBullet(b) { projectiles.spawnEnemyBullet(this, b); }
  spawnMissile(m) { projectiles.spawnMissile(this, m); }
  spawnWellShot(w) { projectiles.spawnWellShot(this, w); }
  updateBullets(dt) { projectiles.updateBullets(this, dt); }
  updateMissiles(dt) { projectiles.updateMissiles(this, dt); }
  drawBullets() { projectiles.drawBullets(this); }
  drawMobBars() { projectiles.drawMobBars(this); }
}
