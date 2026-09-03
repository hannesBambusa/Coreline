// Wiki tab: every ship with its picture, what it does, and its numbers at threat 1 and at the current threat.
import { MOBS, SPAWN, WEAPONS, hpGrowthAt } from '../config.js';
import { ULTS, MIN_MATCH } from '../combos/quad.js';
import { COMBOS } from '../combos.js';
import { ICONS } from '../icons.js';
import { fmt, hex, attrQuote } from './dom.js';

const DANGER_WORD = { 1: 'low', 2: 'mild', 3: 'serious', 4: 'high', 5: 'extreme' };
import { row } from './rows.js';

const BOSSES = ['boss', 'warlord', 'pylon', 'titan', 'warden', 'mine'];
// boss -> the ships that only appear with it, shown as sub cards under the boss
const ESCORTS = { boss: [], warlord: ['pylon'], titan: ['warden', 'mine'] };
const ESCORT_NOTE = { pylon: 'Escort · summoned at 66 % and 33 % hp', warden: 'Escort · arrives with the Dreadnought', mine: 'Escort · dropped by the Dreadnought' };
const pics = {};   // mob type -> data url of its ship texture, rendered once

/** what each ship does, for the ones whose config has no desc */
const BLURB = {
  drone: 'The basic ram. Flies straight at the core and hits it on contact.',
  raider: 'Circles at range and fires single shots. Dodges some bullets.',
  swarm: 'Comes in packs of 8 to 12 fast, fragile darts that ram the core.',
  orbiter: 'Fast orbiter with a quick gun. Dodges often, hard for slow weapons to pin.',
  shielder: 'Slow gunship with its own regenerating shield that has to be broken first.',
  boss: 'Threat boss every 5th level. Bursts of three shots, launches drones, enrages at half health.',
  warlord: 'Every 10th level. Adapts to your best weapon (immune for a while), hides behind relay pylons at 66 % and 33 %, flaks your drones, and its armour caps how fast it can die.',
  pylon: 'Orbits a Warlord and keeps it invulnerable while alive. Destroy all three to hurt the boss.',
  titan: 'Siege boss at threat 30 and 60. Rotating shield sector, siege beam, drone bays, blink teleport, mines, hardpoint jamming, adaptive armour. Wardens heal it.',
  warden: 'Dreadnought escort. Three-shot bursts and heals the Dreadnought every second it lives. Kill these first.',
  mine: 'Dropped by the Dreadnought. Drifts toward the core and detonates on the shield ring or when its fuse runs out.',
};

function picOf(scene, type) {
  if (pics[type] !== undefined) return pics[type];
  try { pics[type] = scene.textures.exists('ship_' + type) ? scene.textures.getBase64('ship_' + type) : null; }
  catch (e) { pics[type] = null; }
  return pics[type];
}

function statsLine(d, scene) {
  const tier = Math.max(1, scene.tier), diff = scene.diff;
  const hpNow = d.hp * hpGrowthAt(tier) * diff.hp;
  const dmgNow = d.dmg * Math.pow(SPAWN.dmgGrowth, tier - 1) * diff.dmg;
  const scrapNow = d.scrap * Math.pow(SPAWN.scrapGrowth, tier - 1);
  const how = d.fireRate ? `${d.burst ? d.burst + '-shot burst' : 'shot'} every ${(1 / d.fireRate).toFixed(1)} s, range ${d.range}` : d.drain ? `drains ${d.drain}/s` : d.blast ? `blast ${d.blast} px` : 'ram';
  return `HP <b>${fmt(d.hp * SPAWN.hpBase)}</b> · dmg <b>${d.dmg}</b> (${how}) · scrap <b>${d.scrap}</b> · speed ${d.speed}<br>` +
    `<span class="muted">Now at threat ${Math.floor(tier)}: HP <b>${fmt(hpNow)}</b> · dmg <b>${dmgNow.toFixed(1)}</b> · scrap <b>${fmt(scrapNow)}</b></span>`;
}

function mobRow(scene, type, d, sub = false) {
  const pic = picOf(scene, type), c = hex(d.color);
  const lead = pic
    ? `<div class="icon wiki-pic" style="--pic:url('${pic}');--mc:${c}"><span></span></div>`
    : `<div class="icon" style="color:${c}">?</div>`;
  const extras = [];
  if (d.shield) extras.push(`shield ${d.shield} (+${d.shieldRegen}/s)`);
  if (d.dodge) extras.push(`dodges ${Math.round(d.dodge * 100)} %`);
  if (d.armour) extras.push(`armour ${Math.round(d.armour * 100)} %`);
  if (d.group) extras.push(`packs of ${d.group[0]}–${d.group[1]}`);
  if (d.noSolo) extras.push('never alone');
  const from = d.fromWave && d.fromWave < 999 ? `threat ${d.fromWave}+` : BOSSES.includes(type) ? (d.every ? `every ${d.every}th threat` : 'boss fights') : '';
  const subLine = sub ? ESCORT_NOTE[type] || 'Escort' : [from, d.chance ? `${Math.round(d.chance * 100)} % of spawns` : ''].filter(Boolean).join(' · ');
  const meter = d.danger ? `<span class="danger d${d.danger}" data-tip="${attrQuote('Danger ' + d.danger + ' of 5\n' + (d.why || ''))}">${'<i></i>'.repeat(5)}<em>${DANGER_WORD[d.danger]}</em></span>` : '';
  return row({
    cls: sub ? 'wiki-row wiki-sub' : 'wiki-row', style: `--mc:${c}`, lead, name: d.name, sub: subLine, tag: meter,
    desc: `${d.desc || BLURB[type] || ''}${extras.length ? ` <span class="muted">(${extras.join(', ')})</span>` : ''}<br>${statsLine(d, scene)}`,
  });
}

const CHARGE_WORD = { droneKills: 'drone kills', crits: 'crits', held: 'seconds of ships held in wells or the chrono field', infections: 'infections and splash hits', blocks: 'reflections, drone absorbs and plate rams', hits: 'hits from its weapons', arcs: 'arcs and reflections', taken: 'shield damage taken (in shields\' worth)' };

/** One ultimate card: weapon group with mounted ones lit, charge source, timings, and whether it is on your bar now. */
function ultRow(scene, id, u) {
  const qs = scene.quads, c = hex(u.color), n = u.match.length ? qs.matches(id) : 0, onBar = qs.bar().some(b => b.id === id);
  const group = u.match.length
    ? u.match.map(p => `<span class="wg${qs.mounted(p) ? ' on' : ''}" style="--wc:${hex(WEAPONS[p].color)}" data-tip="${attrQuote(WEAPONS[p].name + (qs.mounted(p) ? ' · mounted' : ' · not mounted'))}">${ICONS[p]}</span>`).join('')
    : `<span class="wg on" style="--wc:${c}">${ICONS.level}</span>`;
  const rule = u.match.length ? `needs ${MIN_MATCH} of these 4 weapons mounted · ${n} of 4 now` : 'universal · fills the bar when fewer than 2 groups are complete';
  const stats = `charge: <b>${CHARGE_WORD[u.charge] || u.charge}</b> · needs <b>${qs.need(id)}</b> now (${u.need} +${u.needPerTier} per threat level) · lasts <b>${u.dur} s</b> · cooldown <b>${u.cd} s</b>`;
  return row({
    cls: 'wiki-row ult-row' + (onBar ? ' on-bar' : ''), style: `--mc:${c}`, lead: `<div class="icon ult-group">${group}</div>`, name: u.name,
    sub: rule, tag: onBar ? '<span class="danger d5" style="--dc:' + c + '"><em>on your bar</em></span>' : '',
    desc: `${u.desc}<br><span class="muted">${stats}</span>`,
  });
}

const WIKI_TABS = { ships: 'Ships', combos: 'Combos', ultimates: 'Ultimates' };

export function wikiHtml(scene, tab = 'ships') {
  const nav = `<div class="subtabs">${Object.entries(WIKI_TABS).map(([k, l]) => `<button data-wiki="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (tab === 'combos') return nav + combosHtml(scene);
  if (tab === 'ultimates') {
    return nav + `<div class="muted" style="margin-bottom:6px">Ultimates are fired by you (Q W E R or click) once their charge is full. The core cannot be hurt while one runs. Bosses lose at most 15 % of max hp to one. At most 4 show on the bar.</div>` +
      Object.entries(ULTS).map(([id, u]) => ultRow(scene, id, u)).join('');
  }
  return nav + shipsHtml(scene);
}

/** One combo card: the weapon pair (mounted ones lit), chance, cooldown and effect length; active pairs sort first. */
function comboRow(scene, id, c) {
  const qs = scene.quads, col = hex(c.color), pair = [...new Set(c.pair)], active = scene.combos.available(id);
  const group = pair.map(p => `<span class="wg${qs.mounted(p) ? ' on' : ''}" style="--wc:${hex(WEAPONS[p].color)}" data-tip="${attrQuote(WEAPONS[p].name + (qs.mounted(p) ? ' · mounted' : ' · not mounted'))}">${ICONS[p]}</span>`).join('');
  const names = pair.map(p => WEAPONS[p].name).join(' + ');
  const stats = c.intrinsic ? '' : `<br><span class="muted">${Math.round(c.chance * 100)} % per trigger · ${c.effectDur ? `lasts <b>${c.effectDur} s</b>` : 'instant'} · cooldown <b>${c.cd} s</b> after (double on a crit proc)</span>`;
  return row({
    cls: 'wiki-row ult-row' + (active ? ' on-bar' : ''), style: `--mc:${col}`, lead: `<div class="icon ult-group">${group}</div>`, name: c.name,
    sub: (c.quad ? 'quad combo · ' : c.intrinsic ? 'built in · ' : '') + names, tag: active ? '<span class="danger d5" style="--dc:' + col + '"><em>active</em></span>' : '',
    desc: c.desc + stats,
  });
}

function combosHtml(scene) {
  const list = Object.entries(COMBOS).filter(([id, c]) => !ULTS[id] && c.name !== 'Hold steady');
  const pairs = list.filter(([, c]) => !c.intrinsic).sort((a, b) => scene.combos.available(b[0]) - scene.combos.available(a[0]) || a[1].name.localeCompare(b[1].name));
  const built = list.filter(([, c]) => c.intrinsic);
  let html = `<div class="muted" style="margin-bottom:6px">Mount both weapons of a pair and a shot from one can trigger the combo. Timed procs last 10 s, a crit proc twice that, and the cooldown starts when the effect ends. Active pairs are listed first.</div>`;
  html += '<h3>Weapon pairs</h3>' + pairs.map(([id, c]) => comboRow(scene, id, c)).join('');
  if (built.length) html += '<h3>Built-in procs</h3>' + built.map(([id, c]) => comboRow(scene, id, c)).join('');
  return html;
}

function shipsHtml(scene) {
  const all = Object.entries(MOBS).filter(([k, d]) => d.name && typeof d.hp === 'number');
  const regular = all.filter(([k]) => !BOSSES.includes(k)).sort((a, b) => (a[1].fromWave || 0) - (b[1].fromWave || 0));
  const bosses = Object.keys(ESCORTS).map(k => [k, MOBS[k]]);
  let html = `<div class="muted" style="margin-bottom:6px">Base numbers are threat 1 on Normal. Ship HP grows ×${SPAWN.hpGrowthEarly} per threat level up to threat ${SPAWN.earlyTiers}, then ×${SPAWN.hpGrowth}; damage ×${SPAWN.dmgGrowth}; then difficulty multiplies.</div>`;
  html += '<h3>Ships</h3>' + regular.map(([k, d]) => mobRow(scene, k, d)).join('');
  html += '<h3>Bosses and their escorts</h3>' + bosses.map(([k, d]) => mobRow(scene, k, d) + ESCORTS[k].map(e => mobRow(scene, e, MOBS[e], true)).join('')).join('');
  return html;
}
