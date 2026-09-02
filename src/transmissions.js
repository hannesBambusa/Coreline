// Typewriter display for the Overseer's lines. Text lives in src/content/lines.js.
import { LINES } from './content/lines.js';
export { LINES };

const TYPE_MS = 22;        // per character
const HOLD_MS = 3200;      // fully typed line stays on screen this long
const GAP_MS = 500;        // pause before the next queued line starts
const MAX_QUEUE = 2;       // older queued lines are dropped beyond this

export class Transmissions {
  constructor(scene) {
    this.scene = scene;
    this.el = document.getElementById('transmission');
    this.queue = [];
    this.busy = false;
    this.last = {};
    this.enabled = true;
    this.typeTimer = null;
    this.holdTimer = null;
  }
  say(event, minGap = 20) {
    if (!this.enabled || !LINES[event]) return;
    const now = performance.now() / 1000;
    if (this.last[event] && now - this.last[event] < minGap) return;
    this.last[event] = now;
    const lines = LINES[event];
    this.queue.push(lines[Math.floor(Math.random() * lines.length)]);
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
    this.next();
  }
  next() {
    if (this.busy || !this.queue.length || !this.el) return;
    const text = this.queue.shift();
    this.busy = true;
    this.el.textContent = '';
    this.el.classList.add('show');
    let i = 0;
    const type = () => {
      if (i <= text.length) {
        this.el.textContent = text.slice(0, i) + (i < text.length ? '▌' : '');
        i++;
        this.typeTimer = setTimeout(type, TYPE_MS);
      } else {
        this.holdTimer = setTimeout(() => {
          this.el.classList.remove('show');
          this.busy = false;
          setTimeout(() => this.next(), GAP_MS);
        }, HOLD_MS);
      }
    };
    if (this.scene.sfx) this.scene.sfx.play('transmission');
    type();
  }
}
