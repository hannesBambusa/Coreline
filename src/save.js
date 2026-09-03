import { OFFLINE, SIEGE, SLOT_COSTS, SPAWN } from './config.js';
import { CHOICES, applyChoice, baseLevelMods } from './choices.js';
import { sumWindow } from './utils.js';

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
      savedAt: Date.now(),   // cloud sync: the newer of local and cloud wins
      run: {
        difficulty: s.state.difficulty || 'normal', scrap: s.state.scrap, time: s.state.time, tier: s.state.tier, kills: s.state.kills, swapsUsed: s.state.swapsUsed || 0,
        hull: t.hull, shield: t.shield, upgrades: { ...t.upgrades },
        slots: t.slots.map(w => w ? { type: w.type, level: w.level, focus: w.focus || false } : null),
        abilities: s.abilities.serialize(),
        autobuy: s.autobuy.serialize(),
        siegesCleared: s.siegesCleared,
        surgeType: s.surgeType || null,
        stats: s.stats,
        levelChoice: s.levelChoice || null,
        openChoice: s.choice ? { tier: s.choice.tier, opts: s.choice.opts } : null,
        mobs: s.mobs.filter(m => !m.dead && !['titan', 'warden', 'mine', 'warlord', 'pylon'].includes(m.type)).slice(0, 300).map(m => ({
          t: m.type, x: Math.round(m.x - t.x), y: Math.round(m.y - t.y), hp: Math.round(m.hp), sh: m.shield ? Math.round(m.shield) : undefined,
          e: m.elite || undefined, g: m.gen || undefined, tier: m.tierAtSpawn,
        })),
        drones: t.weapons.filter(w => Array.isArray(w.drones)).map(w => ({ slot: w.slot, d: w.drones.map(d => ({ alive: d.alive, hp: Math.round(d.hp), r: +d.respawnT.toFixed(1) })) })),
        scrapRate: this.scrapRate(),
        gameOver: s.gameOver,
      },
      profile: {
        fragments: s.state.fragments, bestTime: s.state.bestTime, totalKills: (s.profile.totalKills || 0),
        prestige: s.profile.prestige || 0, tree: s.tree.serialize(), bestTiers: s.profile.bestTiers || {}, seenIntro: !!s.profile.seenIntro,
      },
      settings: { ...s.settings },
    };
  }

  // scrap per second over the last 5 minutes of play
  scrapRate() {
    const s = this.scene, now = s.state.time, windowSec = 300;
    const span = Math.min(windowSec, Math.max(30, now));
    return sumWindow(s.scrapLog, now, windowSec) / span;
  }

  save() {
    if (this.suspend) return;   // a cloud save is being installed: do not overwrite it with the old state
    let json;
    try { json = JSON.stringify(this.serialize()); }
    catch (e) { console.error('Coreline: could not build the save', e); this.toast('Save failed · ' + e.message); return; }
    try { localStorage.setItem(SAVE_KEY, json); this.toast(); if (this.scene.cloud) this.scene.cloud.noteSaved(); }
    catch (e) { console.error('Coreline: could not write the save', e); this.toast('Save blocked · ' + (e.name === 'QuotaExceededError' ? 'storage full' : 'storage disabled')); }
  }

  /** true when localStorage can be written at all (private windows and some browser settings block it) */
  static storageWorks() {
    try { localStorage.setItem('core-defence-probe', '1'); localStorage.removeItem('core-defence-probe'); return true; } catch (e) { return false; }
  }

  toast(problem = null, where = 'local') {
    const el = document.getElementById('saved-toast');
    if (!el) return;
    const d = new Date();
    el.classList.toggle('failed', !!problem);
    const label = where === 'cloud' ? 'Saved ☁' : 'Saved';
    el.innerHTML = problem ? `<span class="st-main">${problem}</span>` : `<span class="st-main">${label}</span><span class="st-time">` + d.toTimeString().slice(0, 8) + '</span>';
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('flash'), 2500);
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
    s.profile.seenIntro = data.profile?.seenIntro ?? true;   // an old save has played before: no intro
    if (data.profile?.bestTiers && Object.keys(data.profile.bestTiers).length) s.profile.bestTiers = data.profile.bestTiers;
    else {   // save from before difficulty unlocks: credit the best run to every tier so nothing already reachable is taken away
      const t = Math.floor(1 + (data.profile?.bestTime || 0) / SPAWN.tierSeconds);
      s.profile.bestTiers = { normal: t, hard: t, brutal: t };
    }
    s.tree.restore(data.profile?.tree);
    if (data.settings) { Object.assign(s.settings, data.settings); s.sfx.setEnabled(s.settings.sound !== false); }
    if (r.gameOver) return { offline: null };
    s.state.difficulty = r.difficulty || 'normal'; s.state.scrap = r.scrap || 0; s.state.time = r.time || 0; s.state.tier = r.tier || 1; s.state.kills = r.kills || 0; s.state.swapsUsed = r.swapsUsed || 0;
    if (r.upgrades) { Object.assign(t.upgrades, r.upgrades); t.recompute(); }
    t.hull = Number.isFinite(r.hull) ? Math.min(t.hullMax, r.hull) : t.hullMax;
    t.shield = Number.isFinite(r.shield) ? Math.min(t.shieldMax, r.shield) : t.shieldMax;
    if (r.slots) {
      t.slots = [];
      r.slots.slice(0, SLOT_COSTS.length).forEach((sl, i) => { t.slots.push(null); if (sl) { t.installWeapon(i, sl.type); t.slots[i].level = sl.level; if (sl.focus) t.slots[i].focus = true; } });
      if (!t.slots.length) t.slots = [null], t.installWeapon(0, 'pulse');
    }
    s.abilities.restore(r.abilities);
    s.siegesCleared = Number.isInteger(r.siegesCleared) ? r.siegesCleared : Math.floor(s.tier / SIEGE.every);
    s.surgeType = r.surgeType || null;
    if (r.levelChoice) { s.levelChoice = r.levelChoice; s.levelMods = applyChoice(r.levelChoice, baseLevelMods()); }
    if (r.openChoice && r.openChoice.opts.every(id => CHOICES[id])) { s.choice = { tier: r.openChoice.tier, opts: r.openChoice.opts }; s.choosing = true; s.paused = true; s.ui.showChoice(s.choice); }
    if (r.stats) { s.stats = Object.assign(s.freshStats(), r.stats); if (!r.stats.hits) { s.stats.crits = {}; s.stats.critExtra = {}; } }   // older saves counted crits before hits: restart the ratio cleanly
    // ships that were alive: recreate them where they were
    if (Array.isArray(r.mobs)) {
      for (const m of r.mobs) {
        try {
          const mob = s.spawnMob(m.t, 0, m.tier, m.g);
          mob.x = t.x + m.x; mob.y = t.y + m.y;
          if (m.e && !mob.elite) mob.makeElite(m.e);
          mob.hp = Math.min(mob.hpMax, m.hp || mob.hpMax);
          if (m.sh !== undefined && mob.shieldMax) mob.shield = Math.min(mob.shieldMax, m.sh);
        } catch (e) { /* unknown type from an older save */ }
      }
    }
    if (Array.isArray(r.drones)) for (const b of r.drones) {
      const w = t.slots[b.slot]; if (!w || !Array.isArray(w.drones)) continue;
      w.sync();
      b.d.forEach((d, i) => { if (!w.drones[i]) return; w.drones[i].alive = d.alive; w.drones[i].hp = d.hp; w.drones[i].respawnT = d.r || 0; });
    }
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
