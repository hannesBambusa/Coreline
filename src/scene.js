import { COLORS, SPAWN, MOBS, ELITES, CRIT, PRESTIGE, ABILITIES, SIEGE } from './config.js';
import { Titan, Warden } from './mobs.js';
import { Tree } from './tree.js';
import { Abilities } from './abilities.js';
import { SFX } from './sfx.js';
import { SaveSystem } from './save.js';
import { Combos } from './combos.js';
import { AutoBuy } from './autobuy.js';
import { Tower } from './tower.js';
import { createMob } from './mobs.js';
import { FX } from './fx.js';
import { UI } from './ui.js';

const ICONS_SURGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 17l5-5 4 4 7-8"/><path d="M14 8h6v6"/></svg>`;
const ICONS_SIEGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2l3 6 6 1-4.5 4 1.5 6-6-3-6 3 1.5-6L3 9l6-1z"/></svg>`;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.makeTextures();
    this.state = { scrap: 0, fragments: 0, time: 0, tier: 1, kills: 0, bestTime: 0, swapsUsed: 0 };
    this.mobs = []; this.bullets = []; this.enemyBullets = [];
    this.missiles = []; this.wellShots = []; this.wells = [];
    this.scrapLog = [];
    this.stats = this.freshStats();
    this.gameOver = false;
    this.settings = { shake: true, sound: true, volume: 0.7 };
    this.paused = false;
    this.profile = { totalKills: 0, prestige: 0 };
    this.sfx = new SFX();
    this.sfx.width = this.scale.width;
    this.tree = new Tree(this);
    this.abilities = new Abilities(this);
    this.combos = new Combos(this);
    this.autobuy = new AutoBuy(this);

    const { width, height } = this.scale;
    this.bg = this.add.rectangle(0, 0, width, height, 0x05060d).setOrigin(0).setDepth(-1);
    this.makeStarfield(width, height);
    this.fx = new FX(this);
    this.tower = new Tower(this, width / 2, height / 2);
    this.tree.recompute();
    this.mobGfx = this.add.graphics().setDepth(5);
    this.screenFlash = this.add.rectangle(0, 0, width, height, 0xffffff).setOrigin(0).setDepth(20).setAlpha(0);
    this.bulletGfx = this.add.graphics().setDepth(4);

    if (this.renderer.type === Phaser.WEBGL) {
      this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1, 1.15, 4);
    }

    this.spawnTimer = 2;
    this.siege = null; this.siegesCleared = 0;
    this.scale.on('resize', this.onResize, this);
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

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8); g.generateTexture('dot', 16, 16); g.clear();
    const cv = this.textures.createCanvas('glow', 64, 64);
    const ctx = cv.context, grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64); cv.refresh();
    // drone: small dart
    g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.25);
    g.beginPath(); g.moveTo(22, 12); g.lineTo(4, 3); g.lineTo(9, 12); g.lineTo(4, 21); g.closePath(); g.fillPath(); g.strokePath();
    g.generateTexture('ship_drone', 24, 24); g.clear();
    // raider: wider wing shape
    g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.2);
    g.beginPath(); g.moveTo(30, 16); g.lineTo(10, 4); g.lineTo(2, 10); g.lineTo(12, 16); g.lineTo(2, 22); g.lineTo(10, 28); g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0xffffff, 1); g.fillCircle(16, 16, 3);
    g.generateTexture('ship_raider', 32, 32); g.clear();
    // swarm: tiny dart
    g.lineStyle(1.5, 0xffffff, 1); g.fillStyle(0xffffff, 0.5);
    g.beginPath(); g.moveTo(14, 8); g.lineTo(2, 3); g.lineTo(5, 8); g.lineTo(2, 13); g.closePath(); g.fillPath(); g.strokePath();
    g.generateTexture('ship_swarm', 16, 16); g.clear();
    // orbiter: ring with three fins
    g.lineStyle(2, 0xffffff, 1); g.strokeCircle(16, 16, 8); g.fillStyle(0xffffff, 1); g.fillCircle(16, 16, 3);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.lineBetween(16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15); }
    g.generateTexture('ship_orbiter', 32, 32); g.clear();
    // shielder: bulky hexagon
    g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.2);
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const px = 20 + Math.cos(a) * 15, py = 20 + Math.sin(a) * 15; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0xffffff, 0.9); g.fillRect(24, 17, 12, 6);
    g.generateTexture('ship_shielder', 40, 40); g.clear();
    // boss: layered star
    g.lineStyle(3, 0xffffff, 1); g.fillStyle(0xffffff, 0.15);
    g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? 22 : 36; const px = 40 + Math.cos(a) * rr, py = 40 + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fillPath(); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.8); g.strokeCircle(40, 40, 14); g.fillStyle(0xffffff, 1); g.fillCircle(40, 40, 6);
    g.generateTexture('ship_boss', 80, 80); g.clear();
    // titan: heavy gear hull
    g.lineStyle(3, 0xffffff, 1); g.fillStyle(0xffffff, 0.12);
    g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? 30 : 40; const px = 44 + Math.cos(a) * rr, py = 44 + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fillPath(); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.8); g.strokeCircle(44, 44, 20); g.strokeCircle(44, 44, 10);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.lineBetween(44 + Math.cos(a) * 10, 44 + Math.sin(a) * 10, 44 + Math.cos(a) * 20, 44 + Math.sin(a) * 20); }
    g.fillStyle(0xffffff, 1); g.fillCircle(44, 44, 5);
    g.generateTexture('ship_titan', 88, 88); g.clear();
    // warden: armoured arrowhead
    g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.2);
    g.beginPath(); g.moveTo(36, 20); g.lineTo(14, 6); g.lineTo(4, 12); g.lineTo(12, 20); g.lineTo(4, 28); g.lineTo(14, 34); g.closePath(); g.fillPath(); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.8); g.strokeCircle(18, 20, 5);
    g.generateTexture('ship_warden', 40, 40); g.clear();
    // mine: spiked ball
    g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.3);
    g.fillCircle(12, 12, 6); g.strokeCircle(12, 12, 6);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6, 12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11); }
    g.generateTexture('ship_mine', 24, 24); g.clear();
    const shape = (key, size, fn) => { fn(size / 2); g.generateTexture(key, size, size); g.clear(); };
    // bomber: fat dart with a bulb
    shape('ship_bomber', 28, (c) => { g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.3); g.beginPath(); g.moveTo(c + 12, c); g.lineTo(c - 8, c - 8); g.lineTo(c - 4, c); g.lineTo(c - 8, c + 8); g.closePath(); g.fillPath(); g.strokePath(); g.fillStyle(0xffffff, 1); g.fillCircle(c - 2, c, 3); });
    // leech: crescent
    shape('ship_leech', 24, (c) => { g.lineStyle(2, 0xffffff, 1); g.beginPath(); g.arc(c, c, 9, 0.6, 5.7, false); g.strokePath(); g.fillStyle(0xffffff, 0.8); g.fillCircle(c + 6, c - 6, 2); g.fillCircle(c + 6, c + 6, 2); });
    // phantom: thin diamond
    shape('ship_phantom', 30, (c) => { g.lineStyle(1.5, 0xffffff, 1); g.fillStyle(0xffffff, 0.15); g.beginPath(); g.moveTo(c + 14, c); g.lineTo(c, c - 6); g.lineTo(c - 14, c); g.lineTo(c, c + 6); g.closePath(); g.fillPath(); g.strokePath(); });
    // hydra: three-lobed
    shape('ship_hydra', 32, (c) => { g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.25); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.fillCircle(c + Math.cos(a) * 6, c + Math.sin(a) * 6, 6); g.strokeCircle(c + Math.cos(a) * 6, c + Math.sin(a) * 6, 6); } g.fillStyle(0xffffff, 1); g.fillCircle(c, c, 3); });
    // sniper: long needle
    shape('ship_sniper', 34, (c) => { g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.3); g.beginPath(); g.moveTo(c + 16, c); g.lineTo(c - 6, c - 4); g.lineTo(c - 14, c); g.lineTo(c - 6, c + 4); g.closePath(); g.fillPath(); g.strokePath(); g.lineBetween(c - 2, c - 8, c - 2, c + 8); });
    // carrier: wide slab with bays
    shape('ship_carrier', 44, (c) => { g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.2); g.beginPath(); g.moveTo(c + 18, c - 6); g.lineTo(c + 18, c + 6); g.lineTo(c - 16, c + 12); g.lineTo(c - 20, c); g.lineTo(c - 16, c - 12); g.closePath(); g.fillPath(); g.strokePath(); g.fillStyle(0xffffff, 0.9); g.fillRect(c - 8, c - 3, 12, 6); });
    // jammer: ring with antennae
    shape('ship_jammer', 30, (c) => { g.lineStyle(2, 0xffffff, 1); g.strokeCircle(c, c, 7); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.lineBetween(c + Math.cos(a) * 7, c + Math.sin(a) * 7, c + Math.cos(a) * 14, c + Math.sin(a) * 14); } g.fillStyle(0xffffff, 1); g.fillCircle(c, c, 2.5); });
    // siphon: droplet
    shape('ship_siphon', 30, (c) => { g.lineStyle(2, 0xffffff, 1); g.fillStyle(0xffffff, 0.25); g.beginPath(); g.moveTo(c + 14, c); g.lineTo(c - 4, c - 9); g.lineTo(c - 10, c); g.lineTo(c - 4, c + 9); g.closePath(); g.fillPath(); g.strokePath(); g.strokeCircle(c - 2, c, 3); });
    // beacon: hexagonal frame
    shape('ship_beacon', 34, (c) => { g.lineStyle(2, 0xffffff, 1); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const px = c + Math.cos(a) * 13, py = c + Math.sin(a) * 13; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.strokePath(); g.strokeCircle(c, c, 5); });
    // behemoth: blocky hull
    shape('ship_behemoth', 56, (c) => { g.lineStyle(3, 0xffffff, 1); g.fillStyle(0xffffff, 0.25); g.beginPath(); g.moveTo(c + 22, c - 10); g.lineTo(c + 26, c); g.lineTo(c + 22, c + 10); g.lineTo(c - 18, c + 16); g.lineTo(c - 24, c); g.lineTo(c - 18, c - 16); g.closePath(); g.fillPath(); g.strokePath(); g.lineStyle(2, 0xffffff, 0.7); g.lineBetween(c - 10, c - 10, c - 10, c + 10); g.lineBetween(c, c - 12, c, c + 12); g.lineBetween(c + 10, c - 8, c + 10, c + 8); });
    g.destroy();
  }

  makeStarfield(w, h) {
    this.starLayers = [];
    const nebulas = [[COLORS.violet, 0.10], [COLORS.blue, 0.08], [COLORS.magenta, 0.05]];
    const ng = this.add.graphics().setDepth(0);
    for (const [c, a] of nebulas) {
      const nx = Math.random() * w, ny = Math.random() * h, R = 260 + Math.random() * 260;
      for (let i = 24; i > 0; i--) { ng.fillStyle(c, a / 12); ng.fillCircle(nx, ny, R * i / 24); }
    }
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 90; i++) {
        const s = this.add.image(Math.random() * w * 1.4, Math.random() * h * 1.4, 'dot')
          .setScale(0.08 + layer * 0.07 + Math.random() * 0.05)
          .setAlpha(0.25 + layer * 0.25 * Math.random()).setDepth(0);
        s.layer = layer;
        this.tweens.add({ targets: s, alpha: 0.05 + Math.random() * 0.3, duration: 1500 + Math.random() * 3000, yoyo: true, repeat: -1 });
        this.starLayers.push(s);
      }
    }
  }

  onResize(gs) {
    this.bg.setSize(gs.width, gs.height);
    this.sfx.width = gs.width;
    this.screenFlash.setSize(gs.width, gs.height);
    this.tower.setPosition(gs.width / 2, gs.height / 2);
  }

  spawnRadius() { return Math.hypot(this.scale.width, this.scale.height) / 2 + 60; }

  // ---------- continuous spawning ----------
  get tier() { return 1 + this.state.time / SPAWN.tierSeconds; }
  surgeMultiplier() {
    if (!this.surgeType) return 1;
    const hp = MOBS[this.surgeType].hp;
    return hp <= SPAWN.surgeLightHp ? SPAWN.surgeMul.light : hp <= SPAWN.surgeMediumHp ? SPAWN.surgeMul.medium : SPAWN.surgeMul.heavy;
  }
  spawnRate() { return Math.min(SPAWN.maxRate * 2, (SPAWN.baseRate + SPAWN.ratePerSecond * this.state.time) * this.surgeMultiplier()); }

  pickSurge(tierInt) {
    const pool = Object.keys(MOBS).filter(t => MOBS[t].fromWave <= tierInt && !['boss', 'titan', 'warden', 'mine'].includes(t));
    return pool[Math.floor(Math.random() * pool.length)] || 'drone';
  }

  pickType() {
    if (this.surgeType) return this.surgeType;
    const tier = this.tier, roll = Math.random();
    let acc = 0;
    for (const t in MOBS) {
      const d = MOBS[t];
      if (!d.chance || d.fromWave > tier) continue;
      acc += d.chance;
      if (roll < acc) return t;
    }
    const raiderFrac = Math.min(SPAWN.raiderMax, Math.max(0, (tier - 1.5) * SPAWN.raiderPerTier));
    return MOBS.raider.fromWave <= tier && roll < acc + raiderFrac ? 'raider' : 'drone';
  }

  spawnMob(type, angle, tierOverride) {
    const a = angle ?? Math.random() * Math.PI * 2, R = this.spawnRadius() + Math.random() * 80;
    const tier = tierOverride ?? this.tier;
    const m = createMob(this, type, tier, this.tower.x + Math.cos(a) * R, this.tower.y + Math.sin(a) * R);
    m.tierAtSpawn = tier;
    if (tierOverride === undefined && type !== 'boss' && type !== 'swarm') {
      const chance = Math.min(ELITES.chanceMax, ELITES.chanceBase + ELITES.chancePerTier * this.tier);
      if (Math.random() < chance) {
        const mods = Object.keys(ELITES.mods);
        m.makeElite(mods[Math.floor(Math.random() * mods.length)]);
      }
    }
    if (type === 'boss' && tierOverride === undefined) this.sfx.play('boss');
    this.seen = this.seen || {};
    if (tierOverride === undefined && !this.seen[type] && MOBS[type].desc) { this.seen[type] = true; this.ui.banner('New threat: ' + MOBS[type].name, true); this.fx.floater(m.x, m.y - m.r - 20, MOBS[type].desc, '#ff9f43', 12); }
    this.mobs.push(m);
    return m;
  }

  slowMo(scale = 0.4, seconds = 0.4) {
    this.timeScale = scale; this.slowTimer = seconds;
  }

  // hurt friendly drones in an area (bomber blasts, mines) or along a line (siege beam)
  damageDrones(x, y, r, dmg, line = null) {
    for (const bay of this.tower.weapons) {
      if (bay.type !== 'drones') continue;
      for (const d of bay.drones) {
        if (!d.alive) continue;
        let hit;
        if (line) { const p = Phaser.Geom.Line.GetNearestPoint(line, d, new Phaser.Geom.Point()); hit = Phaser.Math.Distance.Between(p.x, p.y, d.x, d.y) <= r; }
        else hit = Phaser.Math.Distance.Between(x, y, d.x, d.y) <= r + d.r;
        if (hit) bay.hurt(d, dmg);
      }
    }
  }

  flashScreen(alpha = 0.6, color = 0xffffff) {
    this.screenFlash.setFillStyle(color);
    this.screenFlash.setAlpha(alpha);
    this.tweens.add({ targets: this.screenFlash, alpha: 0, duration: 500, ease: 'Quad.easeOut' });
  }

  // ---------- sieges ----------
  nextSiegeTier() { return SIEGE.every * (this.siegesCleared + 1); }

  startSiege(level) {
    const R = this.spawnRadius(), a = Math.random() * Math.PI * 2;
    const titan = new Titan(this, this.tier, this.tower.x + Math.cos(a) * R, this.tower.y + Math.sin(a) * R, level);
    this.mobs.push(titan);
    const n = SIEGE.wardens + SIEGE.wardensPerLevel * (level - 1), wardens = [];
    for (let i = 0; i < n; i++) {
      const wa = a + (i - (n - 1) / 2) * 0.35;
      const w = new Warden(this, this.tier, this.tower.x + Math.cos(wa) * (R + 60), this.tower.y + Math.sin(wa) * (R + 60), titan);
      this.mobs.push(w); wardens.push(w);
    }
    this.siege = { level, titan, wardens, t: 0 };
    this.ui.banner(`SIEGE · ${titan.def.name} ${level > 1 ? 'Mk ' + level : ''}`, true);
    this.sfx.play('boss'); this.flashScreen(0.35, 0xff4d6d); this.slowMo(0.3, 0.8);
    this.ui.addEffect('siege', { name: 'Siege', color: 0xff4d6d, dur: 9999, sub: 'kill wardens first', icon: ICONS_SIEGE });
  }

  updateSiege(dt) {
    const sg = this.siege; sg.t += dt;
    const alive = this.mobs.filter(m => !m.dead && (m.type === 'titan' || m.type === 'warden'));
    if (alive.length) return;
    // cleared
    this.siegesCleared++;
    this.siege = null;
    const frag = SIEGE.fragments + SIEGE.fragmentsPerLevel * (sg.level - 1);
    this.state.fragments += frag;
    this.state.time = SIEGE.every * sg.level * SPAWN.tierSeconds + 0.01;   // jump to next threat level
    this.ui.banner('Siege broken', false);
    this.fx.floater(this.tower.x, this.tower.y - 110, `+${frag} fragments`, '#c084fc', 22);
    this.sfx.play('tier');
    this.ui.removeEffect('siege');
    this.saves.save();
  }

  updateSpawning(dt) {
    if (this.siege) { this.updateSiege(dt); return; }
    // reaching a siege threat: freeze time and start it
    const nextT = this.nextSiegeTier() - 1;   // tier = 1 + time/tierSeconds, so tier 30 is time >= 29*tierSeconds
    if (this.state.time + dt >= nextT * SPAWN.tierSeconds) {
      this.state.time = nextT * SPAWN.tierSeconds;
      this.state.tier = Math.floor(this.tier);
      this.startSiege(this.siegesCleared + 1);
      return;
    }
    this.state.time += dt;
    this.state.bestTime = Math.max(this.state.bestTime, this.state.time);
    const tierInt = Math.floor(this.tier);
    if (tierInt !== this.state.tier) {
      this.state.tier = tierInt;
      this.sfx.play('tier');
      this.surgeType = tierInt % SPAWN.surgeEvery === 0 ? this.pickSurge(tierInt) : null;
      if (this.surgeType) {
        const d = MOBS[this.surgeType];
        this.time.delayedCall(1200, () => { if (!this.gameOver) { this.ui.banner(`${d.name} surge`, true); this.fx.floater(this.tower.x, this.tower.y - 120, `Only ${d.name.toLowerCase()}s this level`, '#ff9f43', 14); } });
        const mul = this.surgeMultiplier();
        this.ui.addEffect('surge', { name: d.name + ' surge', color: d.color, dur: SPAWN.tierSeconds, sub: 'only ' + d.name.toLowerCase() + 's' + (mul > 1 ? ' · ×' + mul.toFixed(1) + ' numbers' : ''), icon: ICONS_SURGE });
      } else this.ui.removeEffect('surge');
      if (tierInt % MOBS.boss.every === 0) {
        this.ui.banner('Overseer approaching', true);
        this.time.delayedCall(1500, () => { if (!this.gameOver) this.spawnMob('boss'); });
      } else this.ui.banner(`Threat level ${tierInt}`);
      const bonus = Math.round(20 * Math.pow(SPAWN.scrapGrowth, tierInt));
      this.state.scrap += bonus;
      this.fx.floater(this.tower.x, this.tower.y - 70, `+${bonus}`, '#ffd166', 16);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.mobs.length < SPAWN.softCap) {
      const n = Phaser.Math.Between(SPAWN.burst[0], SPAWN.burst[1]);
      const a = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const type = this.pickType();
        if (type === 'swarm') {
          const k = Phaser.Math.Between(MOBS.swarm.group[0], MOBS.swarm.group[1]);
          for (let j = 0; j < k; j++) this.spawnMob('swarm', a + (Math.random() - 0.5) * 0.4);
        } else this.spawnMob(type, a + (Math.random() - 0.5) * 0.6);
      }
      this.spawnTimer = n / this.spawnRate();
    }
  }

  // ---------- projectiles ----------
  spawnBullet(b) { b.age = 0; this.bullets.push(b); }
  spawnEnemyBullet(b) {
    b.age = 0; b.life = 3;
    // some shooters go for your drones instead of the core
    if (Math.random() < SPAWN.droneAggro) {
      let best = null, bd = 420;
      for (const bay of this.tower.weapons) if (bay.type === 'drones') for (const d of bay.drones) { if (!d.alive) continue; const dd = Phaser.Math.Distance.Between(b.x, b.y, d.x, d.y); if (dd < bd) { bd = dd; best = d; } }
      if (best) {
        const sp = Math.hypot(b.vx, b.vy), a = Phaser.Math.Angle.Between(b.x, b.y, best.x + best.vx * (bd / sp), best.y + best.vy * (bd / sp));
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.atDrone = true;
      }
    }
    this.enemyBullets.push(b);
  }
  spawnMissile(m) { m.age = 0; this.missiles.push(m); }
  spawnWellShot(w) { w.age = 0; this.wellShots.push(w); }

  freshStats() { return { dmg: {}, crits: {}, killsBy: {}, kills: {}, procs: {}, abilities: {}, taken: 0, total: 0 }; }
  addDmg(source, amount, crit = false) {
    const st = this.stats;
    st.dmg[source] = (st.dmg[source] || 0) + amount;
    st.total += amount;
    if (crit) st.crits[source] = (st.crits[source] || 0) + 1;
  }

  // Resolve one hit: type bonus, crit roll, damage, floating number. Returns damage dealt.
  // opts: { dmg (override base), mul, color, size, quiet, tag }
  hit(m, weapon, x, y, opts = {}) {
    if (m.dead) return 0;
    const bonus = weapon && weapon.prefers(m);
    let d = opts.dmg ?? (bonus ? weapon.dmgVs(m) : (weapon ? weapon.dmg : 0));
    if (opts.mul) d *= opts.mul;
    const chance = weapon ? (weapon.def.crit ?? CRIT.chance) + this.tree.mods.crit : 0;
    const crit = !opts.noCrit && Math.random() < chance;
    let color = opts.color || (bonus ? '#ffe66d' : '#dbe7ff'), size = opts.size || 12, text = Math.round(d);
    if (crit) {
      d *= (weapon.def.critMul ?? CRIT.mul) + this.tree.mods.critMul;
      text = Math.round(d) + '!'; color = '#ffb703'; size = Math.max(size, 30);
      this.fx.spark(x, y, 0xffb703, 10);
      this.fx.ripple(m.x, m.y, 0xffb703, m.r, m.r + 30);
      this.fx.flash(m.x, m.y, 0xffb703, 1.4);
      this.sfx.play('crit', null, m.x);
    }
    const src = weapon ? weapon.type : (opts.source || 'other');
    const dealt = Math.min(d, Math.max(0, m.hp + (m.shield || 0)));
    this.addDmg(src, dealt, crit);
    m.lastHit = src;
    m.takeDamage(d, x, y, opts.quiet, crit);
    if (crit) this.fx.critFloater(m.x, m.y - m.r - 10, 'CRIT ' + text, color, size);
    else if (!opts.quiet) this.fx.floater(m.x, m.y - m.r - 6, (opts.tag ? opts.tag + ' ' : '') + text, color, size);
    return d;
  }

  damageRadius(x, y, r, dmg, color, weapon) {
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (Phaser.Math.Distance.Between(x, y, m.x, m.y) <= r + m.r) {
        this.hit(m, weapon, m.x, m.y, { dmg: weapon && weapon.prefers(m) ? undefined : dmg, color: '#ffb86b' });
      }
    }
    this.fx.explode(x, y, color, 18);
    this.fx.ripple(x, y, color, 10, r);
  }

  updateMissiles(dt) {
    for (const m of this.missiles) {
      m.age += dt;
      if (!m.target || m.target.dead) {
        let best = null, bd = 400;
        for (const o of this.mobs) { const d = Phaser.Math.Distance.Between(m.x, m.y, o.x, o.y); if (!o.dead && d < bd) { bd = d; best = o; } }
        m.target = best;
      }
      const cur = Math.atan2(m.vy, m.vx);
      let a = cur;
      if (m.target) {
        const want = Phaser.Math.Angle.Between(m.x, m.y, m.target.x, m.target.y);
        a = Phaser.Math.Angle.RotateTo(cur, want, m.turn * dt);
      }
      const sp = Math.min(m.speed, Math.hypot(m.vx, m.vy) + m.speed * 2 * dt);
      m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp;
      m.x += m.vx * dt; m.y += m.vy * dt;
      this.fx.trailAt(m.x, m.y, m.color);
      for (const o of this.mobs) {
        if (o.dead) continue;
        if (Phaser.Math.Distance.Between(m.x, m.y, o.x, o.y) < o.r + 5) {
          const well = this.wells.find(w => Phaser.Math.Distance.Between(w.x, w.y, m.x, m.y) <= w.r);
          if (well && this.combos.roll('singularity')) {
            this.damageRadius(well.x, well.y, well.r * 1.3, m.dmg * 3, 0xc084fc, m.weapon);
            this.fx.ripple(well.x, well.y, 0xffffff, 10, well.r * 1.3);
            this.fx.explode(well.x, well.y, 0xffffff, 40);
            this.fx.shake(0.008, 250);
            well.age = well.life; // collapse the well
          } else this.damageRadius(m.x, m.y, m.splash, m.dmg, m.color, m.weapon);
          m.age = 99; break;
        }
      }
      if (m.age >= m.life && m.age < 99) { this.damageRadius(m.x, m.y, m.splash, m.dmg, m.color, m.weapon); m.age = 99; }
    }
    this.missiles = this.missiles.filter(m => m.age < 99);

    for (const w of this.wellShots) {
      w.age += dt; w.x += w.vx * dt; w.y += w.vy * dt;
      this.fx.trailAt(w.x, w.y, w.color);
      if (Phaser.Math.Distance.Between(w.x, w.y, w.tx, w.ty) < 12 || w.age > 3) {
        this.wells.push({ x: w.x, y: w.y, age: 0, spin: 0, ...w.well });
        this.fx.ripple(w.x, w.y, w.color, 10, w.well.r);
        w.age = 99;
      }
    }
    this.wellShots = this.wellShots.filter(w => w.age < 99);

    for (const w of this.wells) {
      w.age += dt; w.spin += dt * 3;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const d = Phaser.Math.Distance.Between(w.x, w.y, m.x, m.y);
        if (d > w.r) continue;
        m.slow = w.slow;
        const a = Phaser.Math.Angle.Between(m.x, m.y, w.x, w.y);
        const pull = w.pull * (1 - d / w.r) + 20;
        m.x += Math.cos(a) * pull * dt; m.y += Math.sin(a) * pull * dt;
        const wd = (w.weapon ? w.weapon.dmgVs(m) : w.dps) * dt;
        this.addDmg('gravity', Math.min(wd, Math.max(0, m.hp))); m.lastHit = 'gravity';
        m.takeDamage(wd, m.x, m.y, true);
      }
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2, rr = w.r * (0.6 + Math.random() * 0.4);
        this.fx.trailAt(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, w.color);
      }
    }
    this.wells = this.wells.filter(w => w.age < w.life);
  }

  updateBullets(dt) {
    const t = this.tower;
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      this.fx.trailAt(b.x, b.y, b.color);
      if (b.target && !b.target.dead && !b.dodgeChecked) {
        if (Phaser.Math.Distance.Between(b.x, b.y, b.target.x, b.target.y) < 70) {
          b.dodgeChecked = true; b.target.tryDodge();
        }
      }
      for (const m of this.mobs) {
        if (m.dead) continue;
        if (Phaser.Math.Distance.Between(b.x, b.y, m.x, m.y) < m.r + 4) {
          const opts = {};
          if (b.weapon && b.weapon.type === 'pulse') {
            const laser = this.tower.weapons.find(w => w.type === 'laser');
            if (laser && laser.target === m && this.combos.roll('focus')) {
              opts.mul = 3; opts.color = '#ff3df2'; opts.size = 18;
              this.fx.explode(m.x, m.y, 0xff3df2, 28);
              this.fx.explode(m.x, m.y, 0xffffff, 12);
              this.fx.ripple(m.x, m.y, 0xff3df2, m.r, m.r + 90);
              this.fx.ripple(m.x, m.y, 0xffffff, m.r, m.r + 50);
              this.fx.flash(m.x, m.y, 0xff3df2, 2.5);
              this.fx.floater(m.x, m.y - m.r - 26, 'CRIT', '#ff3df2', 16);
              laser.flare = 0.6;
              const mz = laser.muzzle(10);
              this.fx.line(mz.x, mz.y, m.x, m.y, 0xffffff, 10, 0.5);
              this.fx.line(mz.x, mz.y, m.x, m.y, 0xff3df2, 26, 0.4);
              this.fx.shake(0.003, 120);
            }
          }
          if (b.weapon) this.hit(m, b.weapon, b.x, b.y, opts);
          else { m.takeDamage(b.dmg, b.x, b.y); this.fx.floater(m.x, m.y - m.r - 6, Math.round(b.dmg), '#dbe7ff', 12); }
          b.age = 99; break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.age < b.life);

    const bays = t.weapons.filter(w => w.type === 'drones');
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      if (bays.length && bays.some(w => w.absorb(b))) { b.age = 99; continue; }
      const d = Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y);
      const hitR = t.shield > 0 ? t.shieldR : t.r + 4;
      if (d < hitR) { t.takeDamage(b.dmg, b.x, b.y); b.age = 99; }
    }
    this.enemyBullets = this.enemyBullets.filter(b => b.age < b.life);
  }

  drawBullets() {
    const g = this.bulletGfx; g.clear();
    for (const b of this.bullets) {
      const l = 10, a = Math.atan2(b.vy, b.vx);
      g.lineStyle(3, b.color, 1);
      g.lineBetween(b.x - Math.cos(a) * l, b.y - Math.sin(a) * l, b.x, b.y);
      g.fillStyle(0xffffff, 1); g.fillCircle(b.x, b.y, 2);
    }
    for (const b of this.enemyBullets) {
      g.fillStyle(b.color, 0.9); g.fillCircle(b.x, b.y, 3.5);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(b.x, b.y, 1.5);
    }
    for (const m of this.missiles) {
      const a = Math.atan2(m.vy, m.vx);
      g.fillStyle(m.color, 1);
      g.fillTriangle(m.x + Math.cos(a) * 7, m.y + Math.sin(a) * 7,
        m.x + Math.cos(a + 2.5) * 5, m.y + Math.sin(a + 2.5) * 5,
        m.x + Math.cos(a - 2.5) * 5, m.y + Math.sin(a - 2.5) * 5);
    }
    for (const w of this.wellShots) { g.fillStyle(w.color, 1); g.fillCircle(w.x, w.y, 5); g.fillStyle(0xffffff, 1); g.fillCircle(w.x, w.y, 2); }
    for (const w of this.wells) {
      const f = Math.min(1, w.age * 4) * Math.min(1, (w.life - w.age) * 2);
      g.fillStyle(w.color, 0.06 * f); g.fillCircle(w.x, w.y, w.r);
      g.lineStyle(1, w.color, 0.35 * f); g.strokeCircle(w.x, w.y, w.r);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(2, w.color, 0.7 * f);
        g.beginPath(); g.arc(w.x, w.y, 10 + i * 9, w.spin + i * 2.1, w.spin + i * 2.1 + 2.2, false); g.strokePath();
      }
      g.fillStyle(0xffffff, 0.9 * f); g.fillCircle(w.x, w.y, 4);
    }
  }

  drawMobBars() {
    const g = this.mobGfx; g.clear();
    for (const m of this.mobs) {
      if (m.drawExtra) m.drawExtra(g);
      m.drawElite(g);
      if (m.hp >= m.hpMax) continue;
      const w = m.r * 2 + 6, f = m.hp / m.hpMax;
      g.fillStyle(0x000000, 0.6); g.fillRect(m.x - w / 2, m.y - m.r - 10, w, 3);
      g.fillStyle(m.def.color, 1); g.fillRect(m.x - w / 2, m.y - m.r - 10, w * f, 3);
    }
  }

  // ---------- events ----------
  onKill(m) {
    this.state.kills++;
    this.profile.totalKills++;
    this.stats.kills[m.type] = (this.stats.kills[m.type] || 0) + 1;
    const src = m.lastHit || 'other';
    this.stats.killsBy[src] = (this.stats.killsBy[src] || 0) + 1;
    const scrap = Math.round(m.scrap * this.tree.mods.scrap);
    this.state.scrap += scrap;
    this.scrapLog.push([this.state.time, scrap]);
    this.sfx.play(m.type === 'boss' ? 'bigExplode' : 'explode', m.r, m.x);
    this.fx.floater(m.x, m.y + 6, `+${scrap}`, '#ffd166', 13);
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
    this.saves.save();
    return earned;
  }

  onTowerDestroyed() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.fx.explode(this.tower.x, this.tower.y, COLORS.cyan, 60);
    this.fx.shake(0.02, 600);
    this.sfx.play('death'); this.sfx.bossHum(false);
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
    this.ui.removeEffect('siege');
    for (const k in this.abilities.state) this.abilities.state[k] = { unlocked: false, cd: 0, active: 0 };
    this.autobuy.on = false; this.ui.syncAuto();
    this.saves.save();
    this.gameOver = false;
  }

  // Fresh run: hold everything until the player presses start, so skills and weapons can be set up first.
  showStart() {
    this.starting = true;
    this.paused = true;
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
  }

  setPaused(v) {
    if (this.starting) { if (!v) this.beginRun(); return; }
    this.paused = v;
    this.sfx.play(v ? 'pause' : 'unpause');
    if (v) this.sfx.laserHum(false);
    document.getElementById('paused').hidden = !v;
    document.getElementById('btn-pause').classList.toggle('on', v);
    if (v) this.saves.save();
  }

  update(time, delta) {
    let dt = Math.min(delta / 1000, 0.05);
    if (!this.paused && !this.gameOver) { this.ui.updateEffects(dt); this.ui.updateCooldowns(); }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      dt *= this.slowTimer > 0 ? this.timeScale : 1;
    }
    if (this.gameOver) { this.fx.update(dt); return; }
    if (this.paused) { this.saves.update(dt); this.tower.draw(0); return; }
    // slow parallax drift
    const w = this.scale.width * 1.4;
    for (const s of this.starLayers) {
      s.x -= (0.5 + s.layer * 0.8) * dt * 4; if (s.x < -10) s.x += w;
    }
    this.abilities.update(dt);
    this.autobuy.update(dt);
    this.combos.update(dt);
    this.saves.update(dt);
    this.tower.update(dt, this.mobs);
    for (const m of this.mobs) if (!m.dead) { if (m.stun > 0) m.stunned(dt); else m.update(dt); }
    this.sfx.bossHum(this.mobs.some(m => m.type === 'boss'));
    let lr = 0; for (const w of this.tower.weapons) if (w.type === 'laser' && w.target && !w.target.dead) lr = Math.max(lr, w.ramp || 1);
    this.sfx.laserHum(lr > 0, lr);
    this.mobs = this.mobs.filter(m => !m.dead);
    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.mobs = this.mobs.filter(m => !m.dead);
    this.updateSpawning(dt);
    this.drawBullets();
    this.drawMobBars();
    this.fx.update(dt);
  }
}
