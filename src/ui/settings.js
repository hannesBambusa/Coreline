// Settings tab, volume controls, panel resize grip, export / import.
import { $, askConfirm } from './dom.js';

const DEFAULT_VOLUME = 0.7;
const PANEL_MIN_W = 260;
const PANEL_MAX_W = 640;
const PANEL_MAX_FRACTION = 0.45;   // of window width
const PANEL_DEFAULT_W = 320;

const volume = (settings) => settings.volume ?? DEFAULT_VOLUME;
const toSlider = (v) => Math.round(v * 100);

export function syncMute(ui) {
  const s = ui.scene.settings, on = s.sound !== false && volume(s) > 0;
  $('#btn-mute').textContent = on ? '🔊' : '🔇';
  $('#vol').classList.toggle('muted', !on);
}

export function syncSettings(ui) {
  const scene = ui.scene, st = scene.settings;
  if (st.panelWidth && ui.applyPanelWidth) ui.applyPanelWidth(st.panelWidth);
  $('#opt-shake').checked = st.shake !== false;
  $('#opt-sound').checked = st.sound !== false;
  $('#opt-music').checked = st.music !== false; scene.music.setEnabled(st.music !== false);
  $('#opt-transmissions').checked = st.transmissions !== false; scene.tx.enabled = st.transmissions !== false;
  $('#opt-flash').checked = st.flash !== false;
  $('#opt-perf').value = st.perf || 'auto'; scene.perf.set(st.perf || 'auto');
  ui.setSpeed([0.25, 0.5, 1, 2, 4].includes(st.speed) ? st.speed : 1);
  $('#opt-volume').value = toSlider(volume(st));
  $('#vol-slider').value = toSlider(volume(st));
  syncMute(ui);
  scene.sfx.setVolume(volume(st));
}

export function initSettings(ui) {
  const scene = ui.scene;
  $('#opt-shake').onchange = (e) => { scene.settings.shake = e.target.checked; };
  $('#opt-sound').onchange = (e) => { scene.settings.sound = e.target.checked; scene.sfx.setEnabled(e.target.checked); };
  const setVol = (v) => {
    scene.settings.volume = v; scene.sfx.setVolume(v);
    $('#opt-volume').value = toSlider(v); $('#vol-slider').value = toSlider(v);
    syncMute(ui);
  };
  $('#opt-volume').oninput = (e) => setVol(+e.target.value / 100);
  $('#opt-music').onchange = (e) => { scene.settings.music = e.target.checked; scene.music.setEnabled(e.target.checked); };
  $('#opt-transmissions').onchange = (e) => { scene.settings.transmissions = e.target.checked; scene.tx.enabled = e.target.checked; };
  $('#opt-flash').onchange = (e) => { scene.settings.flash = e.target.checked; };
  $('#opt-perf').onchange = (e) => { scene.settings.perf = e.target.value; scene.perf.set(e.target.value); };
  $('#vol-slider').oninput = (e) => setVol(+e.target.value / 100);
  $('#btn-mute').onclick = () => {
    scene.settings.sound = !scene.settings.sound;
    scene.sfx.setEnabled(scene.settings.sound);
    $('#opt-sound').checked = scene.settings.sound;
    syncMute(ui);
  };
  $('#btn-reset').onclick = () => askConfirm('Hard reset?', 'Wipes everything, including fragments, skills and best time. No undo.', { okLabel: 'Wipe everything' }).then(ok => { if (ok) { scene.saves.clear(); location.reload(); } });
  $('#btn-export').onclick = () => { $('#save-text').value = scene.saves.export(); $('#save-text').select(); };
  $('#btn-import').onclick = () => {
    if (scene.saves.import($('#save-text').value)) location.reload(); else askConfirm('Import failed', 'Could not read that save code.', { okLabel: null, cancelLabel: 'OK' });
  };
}

/** Drag the panel's left edge to resize it. Width is clamped and saved in settings. Returns apply(width). */
export function initResize(ui) {
  const grip = $('#panel-grip'), panel = ui.panel, scene = ui.scene;
  const maxW = () => Math.min(PANEL_MAX_W, Math.floor(window.innerWidth * PANEL_MAX_FRACTION));
  const apply = (w) => {
    w = Math.max(PANEL_MIN_W, Math.min(maxW(), Math.round(w)));
    panel.style.width = w + 'px';
    scene.settings.panelWidth = w;
    document.documentElement.style.setProperty('--panel-w', w + 'px');
  };
  if (scene.settings.panelWidth) apply(scene.settings.panelWidth);
  let dragging = false, startX = 0, startW = 0;
  grip.addEventListener('pointerdown', (e) => {
    dragging = true; startX = e.clientX; startW = panel.getBoundingClientRect().width;
    grip.setPointerCapture(e.pointerId); document.body.classList.add('resizing'); e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => { if (dragging) apply(startW + (startX - e.clientX)); });
  const stop = () => { if (!dragging) return; dragging = false; document.body.classList.remove('resizing'); scene.saves.save(); };
  grip.addEventListener('pointerup', stop); grip.addEventListener('pointercancel', stop);
  grip.addEventListener('dblclick', () => apply(PANEL_DEFAULT_W));
  window.addEventListener('resize', () => { if (scene.settings.panelWidth) apply(scene.settings.panelWidth); });
  return apply;
}
