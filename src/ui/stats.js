// Run statistics markup (Stats tab and the game-over card).
import { WEAPONS, MOBS, ABILITIES } from '../config.js';
import { ICONS } from '../icons.js';
import { COMBOS } from '../combos.js';
import { fmt, hex } from './dom.js';
import { row, gridCell } from './rows.js';

const SUPER_COLOR = '#ff5e5b';
const CRIT_ICON_COLOR = '#ffb703';
const OTHER_COLOR = '#7d8bb0';
const superSpan = (html) => `<span style="color:${SUPER_COLOR}">${html}</span>`;
const pct = (n, of, digits) => (of ? (n / of * 100).toFixed(digits) : 0);
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

export function sourceMeta(src) {
  if (WEAPONS[src]) return { name: WEAPONS[src].name, color: hex(WEAPONS[src].color), icon: ICONS[src] };
  if (src === 'nova') return { name: 'Nova', tag: 'ability', color: '#ffffff', icon: ICONS.ab_nuke };
  return { name: 'Other', color: OTHER_COLOR, icon: ICONS.level };
}

function totalsRows(st, s) {
  const allHits = sum(st.hits), allCrits = sum(st.crits), allSup = sum(st.supers);
  const allCe = sum(st.critExtra), allSe = sum(st.superExtra);
  const totals = row({
    cls: 'stat-sum', icon: ICONS.level, name: 'Totals',
    desc: `Damage dealt <b>${fmt(st.total)}</b> · taken <b>${fmt(st.taken)}</b><br>` +
      `Kills <b>${fmt(s.kills)}</b> · dps <b>${fmt(st.total / Math.max(1, s.time))}</b> avg`,
  });
  const crits = row({
    cls: 'stat-sum', icon: ICONS.critMul || ICONS.level, iconStyle: `color:${CRIT_ICON_COLOR}`, name: 'Crits',
    desc: `<span class="crit">${pct(allCrits, allHits, 1)}%</span> of ${fmt(allHits)} hits crit · ` +
      `<span class="crit">+${fmt(allCe)}</span> dmg (${pct(allCe, st.total, 0)}% of total)<br>` +
      `${superSpan(pct(allSup, allHits, 2) + '%')} super crit (${fmt(allSup)}) · ` +
      `${superSpan('+' + fmt(allSe))} dmg (${pct(allSe, st.total, 1)}% of total)`,
  });
  return `<h3>Run</h3>${totals}${crits}`;
}

function sourceRow(st, src, v, total, compact) {
  const m = sourceMeta(src), share = v / total * 100, kills = st.killsBy[src] || 0, crits = st.crits[src] || 0;
  const hits = (st.hits || {})[src] || 0, sup = (st.supers || {})[src] || 0;
  const ce = (st.critExtra || {})[src] || 0, se = (st.superExtra || {})[src] || 0;
  const critLine = hits
    ? `<br><span class="crit">crit ${pct(crits, hits, 1)}%</span> (${fmt(crits)} of ${fmt(hits)} hits) · <span class="crit">+${fmt(ce)}</span> dmg from crits`
    : '';
  const superLine = sup
    ? `<br>${superSpan('super ' + pct(sup, hits, 2) + '%')} (${fmt(sup)}) · ${superSpan('+' + fmt(se))} dmg from supers`
    : '';
  const compactCrits = crits ? ' · ' + fmt(crits) + ' crits' : '';
  return row({
    cls: 'stat-row', style: `--sc:${m.color}`, icon: m.icon, iconStyle: `color:${m.color}`,
    name: m.name, sub: `${share.toFixed(1)}%`, tag: m.tag ? `<span class="tag">${m.tag}</span>` : '',
    desc: `<div class="stat-bar"><div style="width:${share.toFixed(1)}%"></div></div>` +
      `<b>${fmt(v)}</b> dmg · <b>${fmt(kills)}</b> kills${compact ? compactCrits : critLine + superLine}`,
  });
}

const grid = (cells) => `<div class="kill-grid">${cells.join('')}</div>`;
const byCount = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);

export function statsHtml(scene, compact = false) {
  const st = scene.stats, s = scene.state, total = st.total || 1;
  const sources = Object.entries(st.dmg).sort((a, b) => b[1] - a[1]);
  let html = compact ? '' : totalsRows(st, s);

  html += '<h3>Damage by weapon</h3>';
  if (!sources.length) html += '<div class="muted">No damage yet.</div>';
  for (const [src, v] of sources) html += sourceRow(st, src, v, total, compact);

  const procs = byCount(st.procs);
  html += '<h3>Combo procs</h3>';
  if (!procs.length) html += '<div class="muted">No combos yet.</div>';
  else html += grid(procs.map(([id, n]) => { const c = COMBOS[id] || { name: id, color: 0x7d8bb0 }; return gridCell(hex(c.color), c.name, n); }));

  const abs = byCount(st.abilities);
  if (abs.length) html += '<h3>Abilities used</h3>' + grid(abs.map(([k, n]) => gridCell('#9be7ff', ABILITIES[k] ? ABILITIES[k].name : k, n)));

  const kills = byCount(st.kills);
  html += '<h3>Ships destroyed</h3>';
  if (!kills.length) html += '<div class="muted">None yet.</div>';
  else html += grid(kills.map(([type, n]) => { const d = MOBS[type] || { name: type, color: 0x7d8bb0 }; return gridCell(hex(d.color), d.name, n); }));
  return html;
}
