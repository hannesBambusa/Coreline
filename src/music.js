// Procedural music: a slow bass pulse, an arpeggio and a hi-hat, layered in as threat rises. No sustained pad: a
// constant drone under the game read as a stray beam sound.
// Drops to a heartbeat when the hull is low. All WebAudio, no files.
const NOTES = { root: 55 }; // A1
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17]; // minor pentatonic-ish, semitones above root
const hz = (semi, oct = 0) => NOTES.root * Math.pow(2, (semi + oct * 12) / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.enabled = true;
    this.volume = 0.6;
    this.started = false;
    this.intensity = 0;      // 0..1, from threat
    this.danger = 0;         // 0..1, from hull
    this.step = 0;
    this.bpm = 84;
  }

  start() {
    const c = this.sfx.ctx; if (!c || this.started) return;
    this.started = true;
    this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(this.sfx.master);
    this.bus.gain.linearRampToValueAtTime(this.enabled ? this.volume * 0.5 : 0, c.currentTime + 6);
    // hat noise source reused
    this.stepTimer = setInterval(() => this.tick(), 60000 / this.bpm / 2);
  }

  setState({ tier, hullFrac, siege, paused }) {
    this.intensity = Math.min(1, (tier - 1) / 30) + (siege ? 0.35 : 0);
    this.danger = hullFrac < 0.3 ? 1 - hullFrac / 0.3 : 0;
    this.paused = paused;
  }

  tone(type, f, dur, peak, dest, attack = 0.005) {
    const c = this.sfx.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.bus); o.start(t); o.stop(t + dur + 0.05);
  }

  tick() {
    if (!this.started || !this.enabled || !this.sfx.ok) return;
    const s = this.step++, beat = s % 8, bar = Math.floor(s / 8) % 4;
    const I = this.intensity, D = this.danger, quiet = this.paused;
    if (quiet) return;
    // heartbeat when in danger: two thumps per bar, everything else fades
    if (D > 0.2) {
      if (beat === 0 || beat === 1) this.tone('sine', hz(0, 0), 0.25, 0.35 * D, this.bus);
      if (beat === 0) this.tone('sine', hz(0, -1), 0.5, 0.25 * D, this.bus);
      if (D > 0.6) return;
    }
    // bass pulse on beats 0 and 4, adds an off-beat as intensity grows
    if (beat === 0 || beat === 4 || (I > 0.5 && beat === 6)) this.tone('triangle', hz(bar === 3 ? 3 : 0, 0), 0.35, 0.16 + 0.1 * I, this.bus);
    // arpeggio from intensity 0.25, faster and brighter with intensity
    if (I > 0.25 && (beat % 2 === 0 || I > 0.7)) {
      const n = SCALE[(s * 3 + bar) % SCALE.length];
      this.tone('square', hz(n, 2), 0.14, 0.03 + 0.03 * I, this.bus, 0.002);
    }
    // hat from intensity 0.45
    if (I > 0.45 && beat % 2 === 1) this.sfx.burst({ dur: 0.05, peak: 0.02 + 0.03 * I, f0: 9000, f1: 6000, type: 'highpass', wet: 0.1 });
    // chord stab at bar start from intensity 0.6
    if (I > 0.6 && beat === 0 && bar % 2 === 0) for (const n of [0, 3, 7]) this.tone('sawtooth', hz(n, 1), 0.6, 0.03, this.bus, 0.05);
  }

  setEnabled(v) { this.enabled = v; if (this.bus) this.bus.gain.setTargetAtTime(v ? this.volume * 0.5 : 0, this.sfx.ctx.currentTime, 0.3); }
  setVolume(v) { this.volume = v; if (this.bus && this.enabled) this.bus.gain.setTargetAtTime(v * 0.5, this.sfx.ctx.currentTime, 0.3); }
}
