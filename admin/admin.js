// Coreline admin: users and their cloud saves. Talks to Supabase through the dev server's /_admin proxy, which adds
// the secret key server-side (see serve.py). Open http://localhost:8765/admin/ with `python3 serve.py` running.
import { CLOUD } from '../src/config/cloud.js';
import { TREE, BRANCHES } from '../src/tree.js';

const $ = (s) => document.querySelector(s);
const PROXY = location.origin + '/_admin';
let client = null, users = [], saves = new Map(), current = null;

const fmtDate = (s) => s ? new Date(s).toLocaleString() : '';
const tierOf = (save) => save && save.profile ? Math.floor(1 + (save.profile.bestTime || 0) / 40) : 0;

async function connect() {
  $('#gate-msg').textContent = 'Connecting…';
  try {
    const st = await fetch(PROXY + '/status').then(r => r.json()).catch(() => null);
    if (!st) throw new Error('the dev server is not running with the proxy (restart python3 serve.py)');
    if (!st.configured) throw new Error('the dev server has no secret key: create .supabase-secret or set CORELINE_SECRET, then restart it');
    // the proxy replaces the key; the client just needs something non-empty here
    client = window.supabase.createClient(PROXY, 'proxy', { auth: { persistSession: false, autoRefreshToken: false } });
    await loadAll();
    $('#gate').hidden = true; $('main').hidden = false; $('#btn-refresh').hidden = false; $('#btn-disconnect').hidden = false;
    $('#conn').textContent = `connected to ${CLOUD.url} via local proxy`;
  } catch (e) {
    client = null;
    $('#gate-msg').textContent = 'Could not connect: ' + (e.message || e);
  }
}

async function loadAll() {
  const all = []; let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 200) break;
    page++;
  }
  users = all;
  const { data, error } = await client.from(CLOUD.table).select('user_id, data, updated_at');
  if (error) throw error;
  saves = new Map(data.map(r => [r.user_id, r]));
  render();
}

function render() {
  const q = $('#filter').value.trim().toLowerCase(), onlySaves = $('#only-saves').checked;
  const rows = users.filter(u => (!q || (u.email || '').toLowerCase().includes(q) || u.id.includes(q)) && (!onlySaves || saves.has(u.id)));
  $('#totals').innerHTML = `<div><b>${users.length}</b>users</div><div><b>${saves.size}</b>saves</div><div><b>${users.filter(u => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at) < 7 * 864e5).length}</b>active last 7 days</div>`;
  $('#users tbody').innerHTML = rows.map(u => {
    const row = saves.get(u.id), s = row && row.data, p = s && s.profile, r = s && s.run;
    return `<tr data-id="${u.id}"><td>${u.email || '<i>no email</i>'}<br><span class="muted">${u.id.slice(0, 8)}… · ${(u.app_metadata && u.app_metadata.provider) || ''}</span></td>` +
      `<td>${fmtDate(u.created_at)}</td><td>${fmtDate(u.last_sign_in_at)}</td>` +
      (s ? `<td>${p.prestige || 0}</td><td>${p.fragments || 0}</td><td>threat ${tierOf(s)}</td><td>${r && r.difficulty || 'normal'}</td><td>${fmtDate(row.updated_at)}</td>` : '<td class="none" colspan="5">no save</td>') +
      `<td><button data-edit="${u.id}">Open</button></td></tr>`;
  }).join('');
}

function openEditor(id) {
  const u = users.find(x => x.id === id), row = saves.get(id), s = row ? row.data : null;
  current = { u, s };
  $('#ed-title').textContent = `${u.email || u.id}${s ? '' : ' · no save yet'}`;
  $('#ed-frag').value = s ? s.profile.fragments || 0 : 0;
  $('#ed-prestige').value = s ? s.profile.prestige || 0 : 0;
  $('#ed-diff').value = s && s.run && s.run.difficulty || 'normal';
  $('#ed-scrap').value = s && s.run ? Math.round(s.run.scrap || 0) : 0;
  $('#ed-json').value = s ? JSON.stringify(s, null, 2) : '';
  const bt = (s && s.profile.bestTiers) || {};
  for (const k of ['normal', 'hard', 'brutal', 'insane']) $('#ed-bt-' + k).value = bt[k] || 0;
  current.tree = { ...((s && s.profile.tree) || {}) };
  renderSkills();
  $('#ed-msg').textContent = '';
  for (const b of ['#ed-save', '#ed-export', '#ed-wipe']) $(b).disabled = !s;
  $('#editor').showModal();
  loadHistory(id);
}

const summary = (d) => d && d.profile ? `prestige ${d.profile.prestige || 0} · ${d.profile.fragments || 0} frag · ${Object.keys(d.profile.tree || {}).length} skills · best threat ${tierOf(d)}` : 'empty';

async function loadHistory(id) {
  const el = $('#ed-history'); el.textContent = 'Loading…';
  const { data, error } = await client.from('save_history').select('id, saved_at, data').eq('user_id', id).order('id', { ascending: false }).limit(20);
  if (error) { el.textContent = error.code === '42P01' ? 'No history table yet: run the history block of docs/supabase.sql in the SQL editor.' : 'Could not load history: ' + error.message; return; }
  if (!data.length) { el.textContent = 'No previous versions yet (history starts with the first overwrite).'; return; }
  el.innerHTML = data.map(h => `<div class="hist"><span>${fmtDate(h.saved_at)} · ${summary(h.data)}</span><button data-hist="${h.id}">Restore</button></div>`).join('');
  for (const b of el.querySelectorAll('[data-hist]')) b.onclick = async () => {
    const h = data.find(x => String(x.id) === b.dataset.hist);
    if (!confirm(`Restore the version from ${fmtDate(h.saved_at)} (${summary(h.data)})? The current cloud save goes into history.`)) return;
    const d = h.data; d.savedAt = Date.now();
    const { error: e2 } = await client.from(CLOUD.table).upsert({ user_id: id, data: d, updated_at: new Date().toISOString() });
    $('#ed-msg').textContent = e2 ? 'Restore failed: ' + e2.message : 'Restored. The player gets it on their next sign-in or page load.';
    if (!e2) { await loadAll(); openEditor(id); }
  };
}

// ---- skills editor: current.tree is the working copy, written into the save on Save changes ----
function renderSkills() {
  const t = current.tree, el = $('#ed-skills');
  let html = '';
  for (const [bk, b] of Object.entries(BRANCHES)) {
    html += `<div class="skills-branch" style="color:#${b.color.toString(16).padStart(6, '0')}">${b.name}</div>`;
    for (const [id, n] of Object.entries(TREE)) {
      if (n.branch !== bk) continue;
      const lvl = t[id] || 0, req = n.requires && !(t[n.requires] > 0) ? ` · needs ${TREE[n.requires].name}` : '';
      html += `<div class="skill ${lvl >= n.max ? 'maxed' : ''} ${lvl ? '' : 'zero'}"><div class="sk-name"><b>${n.name}</b><span>${n.text(Math.max(1, lvl))}${req}</span></div>` +
        `<div class="sk-ctl"><button type="button" data-sk="${id}" data-d="-1" ${lvl ? '' : 'disabled'}>−</button><span class="sk-lvl">${lvl} / ${n.max}</span><button type="button" data-sk="${id}" data-d="1" ${lvl >= n.max ? 'disabled' : ''}>+</button></div></div>`;
    }
  }
  el.innerHTML = html;
  $('#ed-skill-count').textContent = `· ${Object.values(t).filter(v => v > 0).length} owned`;
  for (const b of el.querySelectorAll('[data-sk]')) b.onclick = () => {
    const id = b.dataset.sk, d = +b.dataset.d, n = TREE[id];
    const next = Math.max(0, Math.min(n.max, (t[id] || 0) + d));
    if (next) t[id] = next; else delete t[id];
    // a skill that requires this one is dropped when this one goes to 0
    if (!next) for (const [k, m] of Object.entries(TREE)) if (m.requires === id) delete t[k];
    renderSkills();
  };
}
$('#ed-unlock-weapons').onclick = () => { for (const [id, n] of Object.entries(TREE)) if (n.unlock) current.tree[id] = 1; renderSkills(); };
$('#ed-max-all').onclick = () => { for (const [id, n] of Object.entries(TREE)) current.tree[id] = n.max; renderSkills(); };
$('#ed-reset-tree').onclick = () => { if (confirm('Remove every skill from this player?')) { current.tree = {}; renderSkills(); } };
for (const b of document.querySelectorAll('[data-addfrag]')) b.onclick = () => { $('#ed-frag').value = (+$('#ed-frag').value || 0) + +b.dataset.addfrag; };

async function saveEdits() {
  const { u } = current;
  let data;
  try { data = JSON.parse($('#ed-json').value); } catch (e) { $('#ed-msg').textContent = 'Raw JSON is not valid: ' + e.message; return false; }
  data.profile = data.profile || {}; data.run = data.run || {};
  data.profile.fragments = +$('#ed-frag').value; data.profile.prestige = +$('#ed-prestige').value;
  data.run.difficulty = $('#ed-diff').value; data.run.scrap = +$('#ed-scrap').value;
  data.profile.tree = { ...current.tree };
  data.profile.bestTiers = Object.fromEntries(['normal', 'hard', 'brutal', 'insane'].map(k => [k, +$('#ed-bt-' + k).value || 0]));
  data.savedAt = Date.now();   // newer than the player's local copy, so the game pulls it at their next sign-in
  const { error } = await client.from(CLOUD.table).upsert({ user_id: u.id, data, updated_at: new Date().toISOString() });
  $('#ed-msg').textContent = error ? 'Save failed: ' + error.message : 'Saved. The player gets it on their next sign-in or page load.';
  if (!error) await loadAll();
  return !error;
}

$('#btn-connect').onclick = () => connect();
$('#btn-refresh').onclick = () => loadAll();
$('#btn-disconnect').onclick = () => location.reload();
$('#filter').oninput = render; $('#only-saves').onchange = render;
$('#users').onclick = (e) => { const b = e.target.closest('[data-edit]'); if (b) openEditor(b.dataset.edit); };
$('#ed-save').onclick = async (e) => { e.preventDefault(); await saveEdits(); };
$('#ed-export').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('#ed-json').value], { type: 'application/json' }));
  a.download = `coreline-${(current.u.email || current.u.id).replace(/[^a-z0-9@.]/gi, '_')}.json`; a.click();
};
$('#ed-wipe').onclick = async () => {
  if (!confirm(`Delete the cloud save of ${current.u.email}? Their local copy on each device stays until they sign in.`)) return;
  const { error } = await client.from(CLOUD.table).delete().eq('user_id', current.u.id);
  $('#ed-msg').textContent = error ? 'Delete failed: ' + error.message : 'Save deleted.';
  if (!error) { await loadAll(); $('#editor').close(); }
};
$('#ed-delete-user').onclick = async () => {
  if (!confirm(`Delete the account ${current.u.email} and its save? This cannot be undone.`)) return;
  const { error } = await client.auth.admin.deleteUser(current.u.id);
  $('#ed-msg').textContent = error ? 'Delete failed: ' + error.message : 'User deleted.';
  if (!error) { await loadAll(); $('#editor').close(); }
};

connect();
