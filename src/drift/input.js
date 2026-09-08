// Movement input for drift mode: WASD / arrow keys, or hold the pointer to swim toward it.
// The keyboard state is global (window), the pointer state comes from Phaser so clicks on the
// sidebar and the HUD never move the blob.
import { DRIFT } from '../config.js';
import { blink, canBlink } from './blink.js';

const TEXT_INPUTS = ['INPUT', 'TEXTAREA'];
const KEY_AXIS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class DriftInput {
  constructor(scene) {
    this.scene = scene;
    this.held = new Set();
    this.pointerDown = false;
    this.lastTap = {};      // key code -> time of its last fresh press, for the double-tap blink

    window.addEventListener('keydown', (e) => {
      if (!KEY_AXIS[e.code] || TEXT_INPUTS.includes(document.activeElement.tagName)) return;
      if (scene.mode !== 'drift') return;
      e.preventDefault();   // arrow keys would scroll the page
      const fresh = !e.repeat && !this.held.has(e.code);
      this.held.add(e.code);
      if (fresh) this.onTap(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => { this.held.clear(); this.pointerDown = false; });
    scene.input.on('pointerdown', () => { this.pointerDown = true; });
    scene.input.on('pointerup', () => { this.pointerDown = false; });
    scene.input.on('pointerupoutside', () => { this.pointerDown = false; });
  }

  /**
   * A second press of the same key inside DRIFT.blinkWindow is a blink. The direction is the whole
   * held vector, so holding W and double-tapping D jumps diagonally.
   */
  onTap(code) {
    const now = performance.now() / 1000, prev = this.lastTap[code] || -99;
    this.lastTap[code] = now;
    if (now - prev > DRIFT.blinkWindow) return;
    this.lastTap[code] = -99;                       // a third tap has to start a fresh pair
    const scene = this.scene;
    if (!canBlink(scene)) { if (scene.mode === 'drift' && (scene.tower.blinkCd || 0) > 0) scene.sfx.play('deny'); return; }
    const v = this.vector(), a = KEY_AXIS[code];
    blink(scene, v.x || v.y ? v : { x: a[0], y: a[1] });
  }

  /** true while the player is steering, so the blob can stretch and trail */
  get active() { return this.held.size > 0 || this.pointerDown; }

  /**
   * Direction the blob should swim in, as a unit-ish vector ({0,0} when idle).
   * Keys win over the pointer, so a held finger never fights the keyboard.
   */
  vector() {
    let x = 0, y = 0;
    for (const code of this.held) { const a = KEY_AXIS[code]; x += a[0]; y += a[1]; }
    if (x || y) { const len = Math.hypot(x, y); return { x: x / len, y: y / len }; }
    if (!this.pointerDown) return { x: 0, y: 0 };
    const p = this.scene.input.activePointer, t = this.scene.tower;
    const dx = p.worldX - t.x, dy = p.worldY - t.y, d = Math.hypot(dx, dy);
    if (d < DRIFT.pointerDead) return { x: 0, y: 0 };
    return { x: dx / d, y: dy / d };
  }
}
