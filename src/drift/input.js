// Movement input for drift mode: WASD / arrow keys, or hold the left button to swim toward the pointer.
// Blink is T on the keyboard and right-click on the mouse; both jump the way the blob is heading.
// The keyboard state is global (window), the pointer state comes from Phaser so clicks on the
// sidebar and the HUD never move the blob.
import { DRIFT } from '../config.js';
import { blink, canBlink } from './blink.js';

const TEXT_INPUTS = ['INPUT', 'TEXTAREA'];
const BLINK_KEY = 'KeyT';
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
    this.lastDir = { x: 0, y: -1 };   // where a blink goes when the blob has never moved

    window.addEventListener('keydown', (e) => {
      if (scene.mode !== 'drift' || TEXT_INPUTS.includes(document.activeElement.tagName)) return;
      if (e.code === BLINK_KEY) { if (!e.repeat) this.tryBlink(); return; }
      if (!KEY_AXIS[e.code]) return;
      e.preventDefault();   // arrow keys would scroll the page
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => { this.held.clear(); this.pointerDown = false; });

    scene.input.mouse.disableContextMenu();   // right-click is the blink, not a browser menu
    scene.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) { this.tryBlink(); return; }
      this.pointerDown = true;
    });
    scene.input.on('pointerup', () => { this.pointerDown = false; });
    scene.input.on('pointerupoutside', () => { this.pointerDown = false; });
  }

  /** T or right-click: jump the way the blob is heading, or say no when it is still cooling. */
  tryBlink() {
    const scene = this.scene;
    if (!canBlink(scene)) {
      if (scene.mode === 'drift' && !scene.paused && (scene.tower.blinkCd || 0) > 0) scene.sfx.play('deny');
      return;
    }
    blink(scene, this.heading());
  }

  /**
   * Which way the blob counts as heading: what is being steered right now, else the way it is still
   * drifting, else the last direction it moved in.
   */
  heading() {
    const v = this.vector();
    if (v.x || v.y) return v;
    const t = this.scene.tower, sp = Math.hypot(t.vx || 0, t.vy || 0);
    if (sp > 1) return { x: t.vx / sp, y: t.vy / sp };
    return this.lastDir;
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
    if (x || y) { const len = Math.hypot(x, y); return this.remember(x / len, y / len); }
    if (!this.pointerDown) return { x: 0, y: 0 };
    const p = this.scene.input.activePointer, t = this.scene.tower;
    const dx = p.worldX - t.x, dy = p.worldY - t.y, d = Math.hypot(dx, dy);
    if (d < DRIFT.pointerDead) return { x: 0, y: 0 };
    return this.remember(dx / d, dy / d);
  }

  remember(x, y) {
    this.lastDir = { x, y };
    return this.lastDir;
  }
}
