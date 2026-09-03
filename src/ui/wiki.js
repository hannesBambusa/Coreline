// Wiki tab: every ship with its picture, what it does, and its numbers at threat 1 and at the current threat.
import { MOBS, SPAWN } from '../config.js';
import { fmt, hex } from './dom.js';
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
  const hpNow = d.hp * SPAWN.hpBase * Math.pow(SPAWN.hpGrowth, tier - 1) * diff.hp;
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
  return row({
    cls: sub ? 'wiki-row wiki-sub' : 'wiki-row', style: `--mc:${c}`, lead, name: d.name, sub: subLine,
    desc: `${d.desc || BLURB[type] || ''}${extras.length ? ` <span class="muted">(${extras.join(', ')})</span>` : ''}<br>${statsLine(d, scene)}`,
  });
}

export function wikiHtml(scene) {
  const all = Object.entries(MOBS).filter(([k, d]) => d.name && typeof d.hp === 'number');
  const regular = all.filter(([k]) => !BOSSES.includes(k)).sort((a, b) => (a[1].fromWave || 0) - (b[1].fromWave || 0));
  const bosses = Object.keys(ESCORTS).map(k => [k, MOBS[k]]);
  let html = `<div class="muted" style="margin-bottom:6px">Base numbers are threat 1 on Normal. Ship HP grows ×${SPAWN.hpGrowth} and damage ×${SPAWN.dmgGrowth} per threat level, then difficulty multiplies.</div>`;
  html += '<h3>Ships</h3>' + regular.map(([k, d]) => mobRow(scene, k, d)).join('');
  html += '<h3>Bosses and their escorts</h3>' + bosses.map(([k, d]) => mobRow(scene, k, d) + ESCORTS[k].map(e => mobRow(scene, e, MOBS[e], true)).join('')).join('');
  return html;
}
