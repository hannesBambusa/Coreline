import { OFFLINE, SIEGE, SLOT_COSTS } from './config.js';

export const SAVE_KEY = 'core-defence-v1';
const VERSION = 1;

export class SaveSystem {
  constructor(scene) {
    this.scene = scene;
    this.timer = 0;
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  serialize() {
    const s = this.scene, t = s.tower;
    return {
      v: VERSION,
      lastTick: Date.now(),
      run: {
        scrap: s.state.scrap, time: s.state.time, tier: s.state.tier, kills: s.state.kills,
        hull: t.hull, shield: t.shield, upgrades: { ...t.upgrades },
        slots: t.slots.map(w => w ? { type: w.type, level: w.level } : null),
        abilities: s.abilities.serialize(),
        autobuy: s.autobuy.serialize(),
        siegesCleared: s.siegesCleared,
        surgeType: s.surgeType || null,
        scrapRate: this.scrapRate(),
        gameOver: s.gameOver,
      },
      profile: {
        fragments: s.state.fragments, bestTime: s.state.bestTime, totalKills: (s.profile.totalKills || 0),
        prestige: s.profile.prestige || 0, tree: s.tree.serialize(),
      },
      settings: { ...s.settings },
    };
  }

  // scrap per second over the last 5 minutes of play
  scrapRate() {
    const s = this.scene, now = s.state.time, window = 300;
    const log = s.scrapLog.filter(([t]) => now - t <= window);
    s.scrapLog = log;
    const span = Math.min(window, Math.max(30, now));
    return log.reduce((a, [, v]) => a + v, 0) / span;
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); } catch (e) { /* storage full or blocked */ }
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data || data.v !== VERSION) return null;
    return data;
  }

  apply(data) {
    const s = this.scene, t = s.tower, r = data.run || {};
    s.state.fragments = data.profile?.fragments || 0;
    s.state.bestTime = data.profile?.bestTime || 0;
    s.profile.totalKills = data.profile?.totalKills || 0;
    s.profile.prestige = data.profile?.prestige || 0;
    s.tree.restore(data.profile?.tree);
    if (data.settings) { Object.assign(s.settings, data.settings); s.sfx.setEnabled(s.settings.sound !== false); }
    if (r.gameOver) return { offline: null };
    s.state.scrap = r.scrap || 0; s.state.time = r.time || 0; s.state.tier = r.tier || 1; s.state.kills = r.kills || 0;
    if (r.upgrades) { Object.assign(t.upgrades, r.upgrades); t.recompute(); }
    t.hull = Number.isFinite(r.hull) ? Math.min(t.hullMax, r.hull) : t.hullMax;
    t.shield = Number.isFinite(r.shield) ? Math.min(t.shieldMax, r.shield) : t.shieldMax;
    if (r.slots) {
      t.slots = [];
      r.slots.slice(0, SLOT_COSTS.length).forEach((sl, i) => { t.slots.push(null); if (sl) { t.installWeapon(i, sl.type); t.slots[i].level = sl.level; } });
      if (!t.slots.length) t.slots = [null], t.installWeapon(0, 'pulse');
    }
    s.abilities.restore(r.abilities);
    s.siegesCleared = Number.isInteger(r.siegesCleared) ? r.siegesCleared : Math.floor(s.tier / SIEGE.every);
    s.surgeType = r.surgeType || null;
    s.autobuy.restore(r.autobuy); s.ui.syncAuto();

    // offline scrap
    const gap = (Date.now() - (data.lastTick || Date.now())) / 1000;
    if (gap > OFFLINE.threshold && r.scrapRate > 0) {
      const capH = OFFLINE.capHours + s.tree.mods.offlineCap, rate = OFFLINE.rate + s.tree.mods.offlineRate;
      const secs = Math.min(gap, capH * 3600);
      const earned = Math.floor(r.scrapRate * rate * secs);
      s.state.scrap += earned;
      return { offline: { gap, earned, capped: gap > capH * 3600, capH } };
    }
    return { offline: null };
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= 10) { this.timer = 0; this.save(); }
  }

  export() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.serialize())))); }
  import(str) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (!data || data.v !== VERSION) return false;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
}
