// Public sound API: play(kind, arg, x) and shot(weapon, x) on top of the engine, driven by the recipe table.
import { SFXEngine } from './engine.js';
import { playRecipe } from './recipes.js';

export class SFX extends SFXEngine {
  // ---------- weapons ----------
  shot(weapon, x) {
    if (!this.ok) return;
    playRecipe(this, 'shot:' + weapon, undefined, this.panFor(x));
  }

  play(kind, arg, x) {
    if (!this.ok) return;
    if (kind === 'explode') { this.explode(arg, x); return; }
    if (kind === 'bigExplode') { this.bigExplode(x); return; }
    playRecipe(this, kind === 'ability' ? 'ability:' + arg : kind, arg, this.panFor(x));
  }
}
