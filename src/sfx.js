// Procedural WebAudio sound. No assets. Everything is synthesized from oscillators and noise.
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Kenney Sci-fi Sounds (CC0) in assets/sfx/kenney. Each key lists variants picked at random.
const SAMPLE_DIR = 'assets/sfx/kenney/';
const SAMPLES = {
  laserSmall: ['laserSmall_000', 'laserSmall_001', 'laserSmall_002', 'laserSmall_003', 'laserSmall_004'],
  laserLarge: ['laserLarge_000', 'laserLarge_001', 'laserLarge_002', 'laserLarge_003', 'laserLarge_004'],
  laserRetro: ['laserRetro_000', 'laserRetro_001', 'laserRetro_002', 'laserRetro_003', 'laserRetro_004'],
  thruster: ['thrusterFire_000', 'thrusterFire_001', 'thrusterFire_002', 'thrusterFire_003', 'thrusterFire_004'],
  explosion: ['explosionCrunch_000', 'explosionCrunch_001', 'explosionCrunch_002', 'explosionCrunch_003', 'explosionCrunch_004'],
  lowExplosion: ['lowFrequency_explosion_000', 'lowFrequency_explosion_001'],
  forceField: ['forceField_000', 'forceField_001', 'forceField_002', 'forceField_003', 'forceField_004'],
  impact: ['impactMetal_000', 'impactMetal_001', 'impactMetal_002', 'impactMetal_003', 'impactMetal_004'],
  computer: ['computerNoise_000', 'computerNoise_001', 'computerNoise_002', 'computerNoise_003'],
  doorOpen: ['doorOpen_000', 'doorOpen_001', 'doorOpen_002'],
  doorClose: ['doorClose_000', 'doorClose_001', 'doorClose_002'],
  engineLarge: ['spaceEngineLarge_000'],
  engineLow: ['spaceEngineLow_000'],
};

export class SFX {
  constructor() {
    this.enabled = true;
    this.volume = 0.7;
    this.ctx = null;
    this.last = {};
    this.loops = {};
    const resume = () => { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); this.ambient(true); };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    this.width = 1200;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.enabled ? this.volume * 0.32 : 0;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -24; this.comp.ratio.value = 4; this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
      this.master.connect(this.comp); this.comp.connect(c.destination);
      // reverb send
      this.verb = c.createConvolver(); this.verb.buffer = this.impulse(1.6, 2.2);
      this.verbGain = c.createGain(); this.verbGain.gain.value = 0.35;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      this.noise = this.makeNoise();
      this.loadSamples();
    } catch (e) { this.ctx = null; }
  }

  async loadSamples() {
    this.buffers = {};
    const names = new Set(Object.values(SAMPLES).flat());
    await Promise.all([...names].map(async (n) => {
      try {
        const res = await fetch(SAMPLE_DIR + n + '.ogg');
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers[n] = buf;
      } catch (e) { /* missing sample: synth fallback stays */ }
    }));
    this.samplesReady = true;
  }

  // play one sample variant. rate = playback speed (pitch), peak = gain, pan, wet = reverb send
  sample(key, { peak = 0.3, pan = 0, rate = 1, wet = 0.25, delay = 0, offset = 0, dur } = {}) {
    if (!this.buffers) return false;
    const name = pick(SAMPLES[key] || []), buf = this.buffers[name];
    if (!buf) return false;
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const t0 = this.now() + delay, len = dur ?? (buf.duration / rate);
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.setValueAtTime(peak, t0 + Math.max(0.01, len - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t0 + len);
    src.connect(g);
    let tail = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(this.master);
    if (wet > 0) { const w = c.createGain(); w.gain.value = wet; tail.connect(w); w.connect(this.verb); }
    src.start(t0, offset); src.stop(t0 + len + 0.05);
    return true;
  }

  loopSample(key, peak = 0.1, rate = 1, fade = 2) {
    const name = SAMPLES[key] && SAMPLES[key][0], buf = this.buffers && this.buffers[name];
    if (!buf) return null;
    const c = this.ctx, src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(peak, c.currentTime + fade);
    src.connect(g); g.connect(this.master);
    const w = c.createGain(); w.gain.value = 0.4; g.connect(w); w.connect(this.verb);
    src.start();
    return { src, g };
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate, len = rate * seconds, buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  get ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; }
  now() { return this.ctx.currentTime; }
  panFor(x) { if (x === undefined) return 0; return Math.max(-1, Math.min(1, (x - this.width / 2) / (this.width / 2))) * 0.7; }

  // output chain for one voice: gain envelope -> optional panner -> master (+ reverb send)
  out(node, t0, attack, peak, dur, pan = 0, wet = 0.3) {
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    let tail = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(this.master);
    if (wet > 0) { const w = c.createGain(); w.gain.value = wet; tail.connect(w); w.connect(this.verb); }
    return g;
  }

  tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.2, peak = 0.2, attack = 0.005, pan = 0, wet = 0.3, detune = 0, delay = 0 }) {
    const o = this.ctx.createOscillator(); o.type = type; o.detune.value = detune;
    const t0 = this.now() + delay;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    this.out(o, t0, attack, peak, dur, pan, wet);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  burst({ dur = 0.3, peak = 0.3, f0 = 4000, f1 = 200, type = 'lowpass', q = 0.7, pan = 0, wet = 0.3, attack = 0.003, delay = 0 }) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    src.playbackRate.value = rnd(0.9, 1.1);
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    const t0 = this.now() + delay;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    src.connect(f);
    this.out(f, t0, attack, peak, dur, pan, wet);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  gate(key, ms) {
    const t = performance.now();
    if (this.last[key] && t - this.last[key] < ms) return false;
    this.last[key] = t; return true;
  }

  // ---------- weapons ----------
  shot(weapon, x) {
    if (!this.ok) return;
    const pan = this.panFor(x);
    switch (weapon) {
      case 'pulse':
        if (!this.gate('pulse', 55)) return;
        if (this.sample('laserSmall', { peak: 0.07, pan, rate: rnd(1.1, 1.4), wet: 0.1, dur: 0.25 })) break;
        this.tone({ type: 'square', f0: rnd(1000, 1300), f1: 350, dur: 0.06, peak: 0.035, pan, wet: 0.1 });
        break;
      case 'railgun':
        if (this.sample('laserLarge', { peak: 0.22, pan, rate: rnd(0.75, 0.9), wet: 0.5 })) {
          this.sample('lowExplosion', { peak: 0.16, pan, rate: 1.3, wet: 0.3, dur: 0.5 });
          break;
        }
        this.tone({ type: 'sawtooth', f0: 220, f1: 35, dur: 0.4, peak: 0.16, pan, wet: 0.5 });
        this.tone({ type: 'sine', f0: 70, f1: 24, dur: 0.5, peak: 0.22, pan, wet: 0.2 });
        this.burst({ dur: 0.3, peak: 0.16, f0: 9000, f1: 300, type: 'highpass', pan, wet: 0.5 });
        break;
      case 'missile':
        if (!this.gate('missile', 80)) return;
        if (this.sample('thruster', { peak: 0.12, pan, rate: rnd(1.3, 1.7), wet: 0.4, dur: 0.45 })) break;
        this.burst({ dur: 0.4, peak: 0.07, f0: 500, f1: 2600, type: 'bandpass', q: 1.5, pan, wet: 0.4, attack: 0.03 });
        break;
      case 'tesla':
        if (!this.gate('tesla', 60)) return;
        this.burst({ dur: 0.14, peak: 0.08, f0: 9000, f1: 1500, type: 'highpass', pan, wet: 0.4 });
        if (this.sample('laserRetro', { peak: 0.06, pan, rate: rnd(1.4, 2.0), wet: 0.3, dur: 0.2 })) break;
        for (let i = 0; i < 3; i++) this.tone({ type: 'sawtooth', f0: rnd(1500, 2600), f1: rnd(200, 500), dur: 0.05, peak: 0.03, pan, wet: 0.2, delay: i * 0.03 });
        break;
      case 'gravity':
        this.tone({ type: 'sine', f0: 110, f1: 28, dur: 0.9, peak: 0.14, pan, wet: 0.6, attack: 0.05 });
        this.tone({ type: 'triangle', f0: 180, f1: 720, dur: 0.7, peak: 0.03, pan, wet: 0.7, attack: 0.2 });
        break;
    }
  }

  // continuous laser hum: call every frame with on/off and ramp (1..3)
  laserHum(on, ramp = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.loops.laser) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 140;
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 141.5;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 1.5;
      const g = c.createGain(); g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      const w = c.createGain(); w.gain.value = 0.15; g.connect(w); w.connect(this.verb);
      o.start(); o2.start();
      this.loops.laser = { o, o2, f, g };
    }
    const l = this.loops.laser;
    if (!l) return;
    const target = on && this.enabled ? 0.006 + 0.004 * (ramp - 1) : 0;
    l.g.gain.setTargetAtTime(target, c.currentTime, 0.08);
    l.f.frequency.setTargetAtTime(350 + 250 * (ramp - 1), c.currentTime, 0.1);
    l.o.frequency.setTargetAtTime(140 + 30 * (ramp - 1), c.currentTime, 0.1);
    l.o2.frequency.setTargetAtTime(141.5 + 30 * (ramp - 1), c.currentTime, 0.1);
  }

  // ---------- hits and deaths ----------
  explode(size = 10, x) {
    if (!this.ok || !this.gate('explode', 45)) return;
    const pan = this.panFor(x), k = Math.min(1.6, 0.6 + size / 20);
    if (this.sample('explosion', { peak: 0.16 * k, pan, rate: rnd(1.0, 1.5) / Math.sqrt(k), wet: 0.4, dur: 0.6 * k })) return;
    this.tone({ type: 'sine', f0: rnd(90, 130) * (2 - k), f1: 28, dur: 0.3 * k, peak: 0.14 * k, pan, wet: 0.3 });
    this.burst({ dur: 0.28 * k, peak: 0.09 * k, f0: 3000, f1: 90, type: 'lowpass', pan, wet: 0.5 });
    this.burst({ dur: 0.07, peak: 0.05, f0: 8000, f1: 3000, type: 'highpass', pan, wet: 0.2 });
  }

  bigExplode(x) {
    if (!this.ok) return;
    const pan = this.panFor(x);
    this.sample('lowExplosion', { peak: 0.6, pan, rate: 0.8, wet: 0.7 });
    for (let i = 0; i < 4; i++) this.sample('explosion', { peak: 0.25, pan: rnd(-0.6, 0.6), rate: rnd(0.7, 1.1), wet: 0.6, delay: 0.1 + i * rnd(0.08, 0.2) });
    this.tone({ type: 'sine', f0: 80, f1: 20, dur: 1.6, peak: 0.6, pan, wet: 0.5 });
    this.burst({ dur: 1.4, peak: 0.5, f0: 2500, f1: 50, type: 'lowpass', pan, wet: 0.7 });
    for (let i = 0; i < 6; i++) this.burst({ dur: 0.12, peak: 0.2, f0: rnd(2000, 6000), f1: 500, type: 'bandpass', q: 3, pan: rnd(-0.6, 0.6), wet: 0.5, delay: 0.1 + i * rnd(0.05, 0.15) });
    this.tone({ type: 'sawtooth', f0: 60, f1: 30, dur: 1.2, peak: 0.15, pan, wet: 0.6, delay: 0.05 });
  }

  play(kind, arg, x) {
    if (!this.ok) return;
    const pan = this.panFor(x);
    switch (kind) {
      case 'explode': this.explode(arg, x); break;
      case 'bigExplode': this.bigExplode(x); break;
      case 'shieldHit':
        if (!this.gate('shieldHit', 70)) return;
        if (this.sample('forceField', { peak: 0.09, pan, rate: rnd(1.6, 2.2), wet: 0.5, dur: 0.18 })) break;
        this.tone({ type: 'triangle', f0: rnd(1500, 1900), f1: 900, dur: 0.1, peak: 0.035, pan, wet: 0.6 });
        this.tone({ type: 'sine', f0: rnd(2600, 3200), f1: 1800, dur: 0.06, peak: 0.015, pan, wet: 0.5 });
        break;
      case 'shieldBreak':
        this.sample('forceField', { peak: 0.3, rate: 0.6, wet: 0.7 });
        for (let i = 0; i < 5; i++) this.tone({ type: 'triangle', f0: 2200 - i * 300, f1: 400 - i * 40, dur: 0.35, peak: 0.12, pan: rnd(-0.5, 0.5), wet: 0.7, delay: i * 0.04 });
        this.burst({ dur: 0.5, peak: 0.25, f0: 6000, f1: 300, type: 'highpass', wet: 0.6 });
        this.tone({ type: 'sawtooth', f0: 400, f1: 60, dur: 0.6, peak: 0.25, wet: 0.5 });
        break;
      case 'hullHit':
        if (!this.gate('hullHit', 60)) return;
        if (this.sample('impact', { peak: 0.28, pan, rate: rnd(0.8, 1.1), wet: 0.4 })) { this.tone({ type: 'sine', f0: 120, f1: 45, dur: 0.2, peak: 0.12, pan, wet: 0.2 }); break; }
        this.burst({ dur: 0.18, peak: 0.18, f0: 700, f1: 60, type: 'lowpass', pan, wet: 0.3 });
        this.tone({ type: 'sine', f0: 140, f1: 45, dur: 0.25, peak: 0.18, pan, wet: 0.2 });
        this.tone({ type: 'triangle', f0: rnd(280, 340), f1: 200, dur: 0.3, peak: 0.04, pan, wet: 0.7 });
        break;
      case 'tier':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'sine', f0: f, f1: f, dur: 0.5, peak: 0.12, wet: 0.8, delay: i * 0.09, attack: 0.01 }));
        this.tone({ type: 'triangle', f0: 262, f1: 262, dur: 0.9, peak: 0.08, wet: 0.8, delay: 0.27 });
        break;
      case 'boss':
        this.sample('lowExplosion', { peak: 0.5, rate: 0.6, wet: 0.8 });
        this.tone({ type: 'sawtooth', f0: 55, f1: 40, dur: 2.0, peak: 0.35, wet: 0.7 });
        this.tone({ type: 'sawtooth', f0: 82, f1: 60, dur: 2.0, peak: 0.2, wet: 0.7, detune: 8 });
        this.burst({ dur: 1.5, peak: 0.2, f0: 600, f1: 80, type: 'lowpass', wet: 0.8 });
        [0, 0.5, 1.0].forEach(d => this.tone({ type: 'square', f0: 110, f1: 110, dur: 0.25, peak: 0.1, wet: 0.6, delay: d }));
        break;
      case 'combo':
        [660, 880, 1320, 1760].forEach((f, i) => this.tone({ type: 'square', f0: f, f1: f * 1.02, dur: 0.18, peak: 0.08, wet: 0.7, delay: i * 0.06 }));
        this.burst({ dur: 0.4, peak: 0.1, f0: 4000, f1: 9000, type: 'highpass', wet: 0.8, delay: 0.2, attack: 0.1 });
        break;
      case 'superCrit':
        this.tone({ type: 'square', f0: 600, f1: 2400, dur: 0.2, peak: 0.12, pan, wet: 0.6 });
        this.tone({ type: 'sawtooth', f0: 1200, f1: 3600, dur: 0.3, peak: 0.08, pan, wet: 0.7, delay: 0.06 });
        this.burst({ dur: 0.25, peak: 0.12, f0: 5000, f1: 500, type: 'lowpass', pan, wet: 0.5 });
        break;
      case 'sweep': this.tone({ type: 'sawtooth', f0: 300, f1: 1800, dur: 0.6, peak: 0.14, pan, wet: 0.7, attack: 0.05 }); this.burst({ dur: 0.6, peak: 0.08, f0: 2000, f1: 9000, type: 'highpass', wet: 0.7, attack: 0.1 }); break;
      case 'crit':
        if (!this.gate('crit', 80)) return;
        this.tone({ type: 'square', f0: 900, f1: 1800, dur: 0.1, peak: 0.05, pan, wet: 0.5 });
        this.tone({ type: 'sine', f0: 1800, f1: 2400, dur: 0.15, peak: 0.03, pan, wet: 0.6, delay: 0.05 });
        break;
      case 'shock':
        this.sample('forceField', { peak: 0.18, pan, rate: 0.7, wet: 0.7 });
        this.tone({ type: 'sine', f0: 220, f1: 40, dur: 0.5, peak: 0.18, pan, wet: 0.5 });
        this.burst({ dur: 0.35, peak: 0.1, f0: 2000, f1: 200, type: 'lowpass', pan, wet: 0.6 });
        break;
      case 'transmission': for (let i = 0; i < 3; i++) this.tone({ type: 'square', f0: 1200 + i * 300, f1: 1200 + i * 300, dur: 0.05, peak: 0.04, wet: 0.4, delay: i * 0.07 }); this.burst({ dur: 0.3, peak: 0.03, f0: 3000, f1: 1500, type: 'bandpass', q: 3, wet: 0.5 }); break;
      case 'buy':
        if (this.sample('computer', { peak: 0.12, rate: 1.6, wet: 0.3, dur: 0.25 })) break;
        this.tone({ type: 'triangle', f0: 700, f1: 1400, dur: 0.12, peak: 0.1, wet: 0.4 });
        this.tone({ type: 'sine', f0: 1400, f1: 2100, dur: 0.15, peak: 0.06, wet: 0.5, delay: 0.06 });
        break;
      case 'deny': if (this.sample('doorClose', { peak: 0.12, rate: 1.2, wet: 0.2, dur: 0.3 })) break; this.tone({ type: 'square', f0: 220, f1: 160, dur: 0.15, peak: 0.08, wet: 0.2 }); break;
      case 'pause': this.tone({ type: 'sine', f0: 600, f1: 300, dur: 0.2, peak: 0.1, wet: 0.5 }); break;
      case 'unpause': this.tone({ type: 'sine', f0: 300, f1: 600, dur: 0.2, peak: 0.1, wet: 0.5 }); break;
      case 'death':
        this.burst({ dur: 2.5, peak: 0.6, f0: 3000, f1: 30, type: 'lowpass', wet: 0.8 });
        this.tone({ type: 'sawtooth', f0: 220, f1: 18, dur: 2.5, peak: 0.4, wet: 0.7 });
        this.tone({ type: 'sine', f0: 60, f1: 15, dur: 3, peak: 0.5, wet: 0.5 });
        break;
      case 'ability':
        if (arg === 'emp') {
          this.tone({ type: 'sine', f0: 2400, f1: 60, dur: 0.8, peak: 0.3, wet: 0.7 });
          this.burst({ dur: 0.6, peak: 0.2, f0: 9000, f1: 300, type: 'highpass', wet: 0.6 });
          for (let i = 0; i < 6; i++) this.tone({ type: 'sawtooth', f0: rnd(1500, 3000), f1: rnd(200, 600), dur: 0.06, peak: 0.06, pan: rnd(-0.8, 0.8), wet: 0.4, delay: 0.1 + i * 0.07 });
        } else if (arg === 'overcharge') {
          this.tone({ type: 'sawtooth', f0: 150, f1: 1800, dur: 0.7, peak: 0.2, wet: 0.6, attack: 0.05 });
          this.tone({ type: 'square', f0: 300, f1: 3600, dur: 0.7, peak: 0.08, wet: 0.6, attack: 0.05, detune: 10 });
        } else if (arg === 'burst') {
          [330, 415, 494, 660].forEach((f, i) => this.tone({ type: 'triangle', f0: f, f1: f, dur: 0.6, peak: 0.12, wet: 0.8, delay: i * 0.03 }));
          this.burst({ dur: 0.4, peak: 0.2, f0: 2000, f1: 9000, type: 'highpass', wet: 0.7 });
        } else if (arg === 'nuke') {
          this.tone({ type: 'sine', f0: 40, f1: 15, dur: 3, peak: 0.7, wet: 0.5 });
          this.burst({ dur: 3, peak: 0.7, f0: 8000, f1: 30, type: 'lowpass', wet: 0.9 });
          this.tone({ type: 'sawtooth', f0: 100, f1: 20, dur: 2, peak: 0.3, wet: 0.7, delay: 0.1 });
        }
        break;
    }
  }

  // ---------- loops ----------
  ambient(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.loops.amb) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.4;
      const o3 = c.createOscillator(); o3.type = 'sine'; o3.frequency.value = 27.5;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; f.Q.value = 2;
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.05;
      const lfoG = c.createGain(); lfoG.gain.value = 60; lfo.connect(lfoG); lfoG.connect(f.frequency);
      const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.022, c.currentTime + 4);
      o.connect(f); o2.connect(f); o3.connect(g); f.connect(g); g.connect(this.master);
      const w = c.createGain(); w.gain.value = 0.5; g.connect(w); w.connect(this.verb);
      // faint wind
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.4;
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.08; const l2g = c.createGain(); l2g.gain.value = 500; lfo2.connect(l2g); l2g.connect(nf.frequency);
      const ng = c.createGain(); ng.gain.value = 0.006;
      src.connect(nf); nf.connect(ng); ng.connect(this.master);
      o.start(); o2.start(); o3.start(); lfo.start(); lfo2.start(); src.start();
      this.loops.amb = { g, ng };
    }
  }

  bossHum(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.loops.boss && this.buffers && this.buffers.spaceEngineLarge_000) {
      const l = this.loopSample('engineLarge', 0.14, 0.7, 2.5);
      if (l) { this.loops.boss = { nodes: [l.src], g: l.g }; return; }
    }
    if (on && !this.loops.boss) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38;
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 57;
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.5;
      const lg = c.createGain(); lg.gain.value = 5; lfo.connect(lg); lg.connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 3;
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.2; const l2 = c.createGain(); l2.gain.value = 120; lfo2.connect(l2); l2.connect(f.frequency);
      const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.08, c.currentTime + 2);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      const w = c.createGain(); w.gain.value = 0.6; g.connect(w); w.connect(this.verb);
      o.start(); o2.start(); lfo.start(); lfo2.start();
      this.loops.boss = { nodes: [o, o2, lfo, lfo2], g };
    } else if (!on && this.loops.boss) {
      const { nodes, g } = this.loops.boss; this.loops.boss = null;
      g.gain.linearRampToValueAtTime(0, c.currentTime + 1.5); setTimeout(() => nodes.forEach(n => n.stop()), 1600);
    }
  }

  setEnabled(v) { this.enabled = v; this.applyVolume(); if (!v) { this.bossHum(false); this.laserHum(false); } }
  setVolume(v) { this.volume = v; this.applyVolume(); }
  applyVolume() { if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.32 : 0, this.ctx.currentTime, 0.05); }
}
