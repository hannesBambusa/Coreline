// One-shot sound recipes, keyed by sound name ('shot:<weapon>', 'ability:<name>', or a plain event).
//
// Recipe shape:
//   gate:        ms   rate limit; the sound is dropped if the same key fired more recently
//   always:      [..] layers played regardless of the sample (before it is attempted)
//   sample:      { key, ...opts }  Kenney sample to try first
//   also:        [..] layers played only when the sample played
//   synth:       [..] layers played when there is no sample or it could not play (buffers not loaded)
//   synthAlways: true  play `synth` even when the sample played (sample is a layer, not a replacement)
//
// Layer shape: { kind: 'tone' | 'burst' | 'sample', ...opts } or seq(n | array, (v, i) => layer).
// Option values may be PAN (the caller's stereo position) or R(a, b) (a fresh random in [a, b) per play).
import { rnd } from '../utils.js';

export const PAN = Symbol('pan');
const R = (a, b) => ({ rnd: [a, b] });
const seq = (over, make) => ({ kind: 'seq', over: typeof over === 'number' ? [...Array(over).keys()] : over, make });

const tone = (opts) => ({ kind: 'tone', ...opts });
const burst = (opts) => ({ kind: 'burst', ...opts });
const sample = (key, opts) => ({ kind: 'sample', key, ...opts });

export const RECIPES = {
  // ---------- weapons ----------
  'shot:pulse': {
    gate: 55,
    sample: { key: 'laserSmall', peak: 0.07, pan: PAN, rate: R(1.1, 1.4), wet: 0.1, dur: 0.25 },
    synth: [tone({ type: 'square', f0: R(1000, 1300), f1: 350, dur: 0.06, peak: 0.035, pan: PAN, wet: 0.1 })],
  },
  'shot:railgun': {
    sample: { key: 'laserLarge', peak: 0.22, pan: PAN, rate: R(0.75, 0.9), wet: 0.5 },
    also: [sample('lowExplosion', { peak: 0.16, pan: PAN, rate: 1.3, wet: 0.3, dur: 0.5 })],
    synth: [
      tone({ type: 'sawtooth', f0: 220, f1: 35, dur: 0.4, peak: 0.16, pan: PAN, wet: 0.5 }),
      tone({ type: 'sine', f0: 70, f1: 24, dur: 0.5, peak: 0.22, pan: PAN, wet: 0.2 }),
      burst({ dur: 0.3, peak: 0.16, f0: 9000, f1: 300, type: 'highpass', pan: PAN, wet: 0.5 }),
    ],
  },
  'shot:missile': {
    gate: 80,
    sample: { key: 'thruster', peak: 0.12, pan: PAN, rate: R(1.3, 1.7), wet: 0.4, dur: 0.45 },
    synth: [burst({ dur: 0.4, peak: 0.07, f0: 500, f1: 2600, type: 'bandpass', q: 1.5, pan: PAN, wet: 0.4, attack: 0.03 })],
  },
  'shot:tesla': {
    gate: 60,
    always: [burst({ dur: 0.14, peak: 0.08, f0: 9000, f1: 1500, type: 'highpass', pan: PAN, wet: 0.4 })],
    sample: { key: 'laserRetro', peak: 0.06, pan: PAN, rate: R(1.4, 2.0), wet: 0.3, dur: 0.2 },
    synth: [seq(3, (_, i) => tone({ type: 'sawtooth', f0: R(1500, 2600), f1: R(200, 500), dur: 0.05, peak: 0.03, pan: PAN, wet: 0.2, delay: i * 0.03 }))],
  },
  'shot:nanite': {
    gate: 70,
    sample: { key: 'laserSmall', peak: 0.06, pan: PAN, rate: R(0.6, 0.8), wet: 0.3, dur: 0.3 },
    synth: [tone({ type: 'triangle', f0: R(500, 700), f1: 1400, dur: 0.12, peak: 0.04, pan: PAN, wet: 0.3 })],
  },
  rewind: {
    synth: [
      tone({ type: 'sine', f0: 1200, f1: 200, dur: 0.5, peak: 0.12, pan: PAN, wet: 0.6 }),
      tone({ type: 'triangle', f0: 300, f1: 900, dur: 0.4, peak: 0.05, pan: PAN, wet: 0.6, delay: 0.1 }),
    ],
  },
  singularity: {
    sample: { key: 'lowExplosion', peak: 0.5, rate: 0.5, wet: 0.8, pan: PAN },
    synthAlways: true,
    synth: [
      tone({ type: 'sine', f0: 40, f1: 20, dur: 1.6, peak: 0.35, pan: PAN, wet: 0.6 }),
      tone({ type: 'sawtooth', f0: 900, f1: 60, dur: 0.8, peak: 0.12, pan: PAN, wet: 0.7 }),
      burst({ dur: 1.0, peak: 0.2, f0: 4000, f1: 100, type: 'lowpass', pan: PAN, wet: 0.8 }),
    ],
  },
  'shot:gravity': {
    synth: [
      tone({ type: 'sine', f0: 110, f1: 28, dur: 0.9, peak: 0.14, pan: PAN, wet: 0.6, attack: 0.05 }),
      tone({ type: 'triangle', f0: 180, f1: 720, dur: 0.7, peak: 0.03, pan: PAN, wet: 0.7, attack: 0.2 }),
    ],
  },

  // ---------- tower ----------
  shieldHit: {
    gate: 70,
    sample: { key: 'forceField', peak: 0.09, pan: PAN, rate: R(1.6, 2.2), wet: 0.5, dur: 0.18 },
    synth: [
      tone({ type: 'triangle', f0: R(1500, 1900), f1: 900, dur: 0.1, peak: 0.035, pan: PAN, wet: 0.6 }),
      tone({ type: 'sine', f0: R(2600, 3200), f1: 1800, dur: 0.06, peak: 0.015, pan: PAN, wet: 0.5 }),
    ],
  },
  shieldBreak: {
    sample: { key: 'forceField', peak: 0.3, rate: 0.6, wet: 0.7 },
    synthAlways: true,
    synth: [
      seq(5, (_, i) => tone({ type: 'triangle', f0: 2200 - i * 300, f1: 400 - i * 40, dur: 0.35, peak: 0.12, pan: R(-0.5, 0.5), wet: 0.7, delay: i * 0.04 })),
      burst({ dur: 0.5, peak: 0.25, f0: 6000, f1: 300, type: 'highpass', wet: 0.6 }),
      tone({ type: 'sawtooth', f0: 400, f1: 60, dur: 0.6, peak: 0.25, wet: 0.5 }),
    ],
  },
  hullHit: {
    gate: 60,
    sample: { key: 'impact', peak: 0.28, pan: PAN, rate: R(0.8, 1.1), wet: 0.4 },
    also: [tone({ type: 'sine', f0: 120, f1: 45, dur: 0.2, peak: 0.12, pan: PAN, wet: 0.2 })],
    synth: [
      burst({ dur: 0.18, peak: 0.18, f0: 700, f1: 60, type: 'lowpass', pan: PAN, wet: 0.3 }),
      tone({ type: 'sine', f0: 140, f1: 45, dur: 0.25, peak: 0.18, pan: PAN, wet: 0.2 }),
      tone({ type: 'triangle', f0: R(280, 340), f1: 200, dur: 0.3, peak: 0.04, pan: PAN, wet: 0.7 }),
    ],
  },
  shock: {
    sample: { key: 'forceField', peak: 0.18, pan: PAN, rate: 0.7, wet: 0.7 },
    synthAlways: true,
    synth: [
      tone({ type: 'sine', f0: 220, f1: 40, dur: 0.5, peak: 0.18, pan: PAN, wet: 0.5 }),
      burst({ dur: 0.35, peak: 0.1, f0: 2000, f1: 200, type: 'lowpass', pan: PAN, wet: 0.6 }),
    ],
  },
  sweep: {
    synth: [
      tone({ type: 'sawtooth', f0: 300, f1: 1800, dur: 0.6, peak: 0.14, pan: PAN, wet: 0.7, attack: 0.05 }),
      burst({ dur: 0.6, peak: 0.08, f0: 2000, f1: 9000, type: 'highpass', wet: 0.7, attack: 0.1 }),
    ],
  },
  crit: {
    gate: 80,
    synth: [
      tone({ type: 'square', f0: 900, f1: 1800, dur: 0.1, peak: 0.05, pan: PAN, wet: 0.5 }),
      tone({ type: 'sine', f0: 1800, f1: 2400, dur: 0.15, peak: 0.03, pan: PAN, wet: 0.6, delay: 0.05 }),
    ],
  },
  superCrit: {
    synth: [
      tone({ type: 'square', f0: 600, f1: 2400, dur: 0.2, peak: 0.12, pan: PAN, wet: 0.6 }),
      tone({ type: 'sawtooth', f0: 1200, f1: 3600, dur: 0.3, peak: 0.08, pan: PAN, wet: 0.7, delay: 0.06 }),
      burst({ dur: 0.25, peak: 0.12, f0: 5000, f1: 500, type: 'lowpass', pan: PAN, wet: 0.5 }),
    ],
  },

  // ---------- events ----------
  tier: {
    synth: [
      seq([523, 659, 784, 1047], (f, i) => tone({ type: 'sine', f0: f, f1: f, dur: 0.5, peak: 0.12, wet: 0.8, delay: i * 0.09, attack: 0.01 })),
      tone({ type: 'triangle', f0: 262, f1: 262, dur: 0.9, peak: 0.08, wet: 0.8, delay: 0.27 }),
    ],
  },
  boss: {
    sample: { key: 'lowExplosion', peak: 0.5, rate: 0.6, wet: 0.8 },
    synthAlways: true,
    synth: [
      tone({ type: 'sawtooth', f0: 55, f1: 40, dur: 2.0, peak: 0.35, wet: 0.7 }),
      tone({ type: 'sawtooth', f0: 82, f1: 60, dur: 2.0, peak: 0.2, wet: 0.7, detune: 8 }),
      burst({ dur: 1.5, peak: 0.2, f0: 600, f1: 80, type: 'lowpass', wet: 0.8 }),
      seq([0, 0.5, 1.0], (d) => tone({ type: 'square', f0: 110, f1: 110, dur: 0.25, peak: 0.1, wet: 0.6, delay: d })),
    ],
  },
  combo: {
    synth: [
      seq([660, 880, 1320, 1760], (f, i) => tone({ type: 'square', f0: f, f1: f * 1.02, dur: 0.18, peak: 0.08, wet: 0.7, delay: i * 0.06 })),
      burst({ dur: 0.4, peak: 0.1, f0: 4000, f1: 9000, type: 'highpass', wet: 0.8, delay: 0.2, attack: 0.1 }),
    ],
  },
  transmission: {
    synth: [
      seq(3, (_, i) => tone({ type: 'square', f0: 1200 + i * 300, f1: 1200 + i * 300, dur: 0.05, peak: 0.04, wet: 0.4, delay: i * 0.07 })),
      burst({ dur: 0.3, peak: 0.03, f0: 3000, f1: 1500, type: 'bandpass', q: 3, wet: 0.5 }),
    ],
  },
  buy: {
    sample: { key: 'computer', peak: 0.12, rate: 1.6, wet: 0.3, dur: 0.25 },
    synth: [
      tone({ type: 'triangle', f0: 700, f1: 1400, dur: 0.12, peak: 0.1, wet: 0.4 }),
      tone({ type: 'sine', f0: 1400, f1: 2100, dur: 0.15, peak: 0.06, wet: 0.5, delay: 0.06 }),
    ],
  },
  deny: {
    sample: { key: 'doorClose', peak: 0.12, rate: 1.2, wet: 0.2, dur: 0.3 },
    synth: [tone({ type: 'square', f0: 220, f1: 160, dur: 0.15, peak: 0.08, wet: 0.2 })],
  },
  pause: { synth: [tone({ type: 'sine', f0: 600, f1: 300, dur: 0.2, peak: 0.1, wet: 0.5 })] },
  unpause: { synth: [tone({ type: 'sine', f0: 300, f1: 600, dur: 0.2, peak: 0.1, wet: 0.5 })] },
  death: {
    synth: [
      burst({ dur: 2.5, peak: 0.6, f0: 3000, f1: 30, type: 'lowpass', wet: 0.8 }),
      tone({ type: 'sawtooth', f0: 220, f1: 18, dur: 2.5, peak: 0.4, wet: 0.7 }),
      tone({ type: 'sine', f0: 60, f1: 15, dur: 3, peak: 0.5, wet: 0.5 }),
    ],
  },

  // ---------- abilities ----------
  'ability:emp': {
    synth: [
      tone({ type: 'sine', f0: 2400, f1: 60, dur: 0.8, peak: 0.3, wet: 0.7 }),
      burst({ dur: 0.6, peak: 0.2, f0: 9000, f1: 300, type: 'highpass', wet: 0.6 }),
      seq(6, (_, i) => tone({ type: 'sawtooth', f0: R(1500, 3000), f1: R(200, 600), dur: 0.06, peak: 0.06, pan: R(-0.8, 0.8), wet: 0.4, delay: 0.1 + i * 0.07 })),
    ],
  },
  'ability:overcharge': {
    synth: [
      tone({ type: 'sawtooth', f0: 150, f1: 1800, dur: 0.7, peak: 0.2, wet: 0.6, attack: 0.05 }),
      tone({ type: 'square', f0: 300, f1: 3600, dur: 0.7, peak: 0.08, wet: 0.6, attack: 0.05, detune: 10 }),
    ],
  },
  'ability:burst': {
    synth: [
      seq([330, 415, 494, 660], (f, i) => tone({ type: 'triangle', f0: f, f1: f, dur: 0.6, peak: 0.12, wet: 0.8, delay: i * 0.03 })),
      burst({ dur: 0.4, peak: 0.2, f0: 2000, f1: 9000, type: 'highpass', wet: 0.7 }),
    ],
  },
  'ability:nuke': {
    synth: [
      tone({ type: 'sine', f0: 40, f1: 15, dur: 3, peak: 0.7, wet: 0.5 }),
      burst({ dur: 3, peak: 0.7, f0: 8000, f1: 30, type: 'lowpass', wet: 0.9 }),
      tone({ type: 'sawtooth', f0: 100, f1: 20, dur: 2, peak: 0.3, wet: 0.7, delay: 0.1 }),
    ],
  },
};

/** replace PAN and R(a, b) markers with concrete values */
function resolve(opts, pan) {
  const out = {};
  for (const k in opts) {
    const v = opts[k];
    out[k] = v === PAN ? pan : (v && v.rnd) ? rnd(v.rnd[0], v.rnd[1]) : v;
  }
  return out;
}

function playLayers(engine, layers, pan) {
  if (!layers) return;
  for (const layer of layers) playLayer(engine, layer, pan);
}

function playLayer(engine, layer, pan) {
  const { kind, ...opts } = layer;
  switch (kind) {
    case 'tone': engine.tone(resolve(opts, pan)); break;
    case 'burst': engine.burst(resolve(opts, pan)); break;
    case 'sample': { const { key, ...rest } = opts; engine.sample(key, resolve(rest, pan)); break; }
    case 'seq': opts.over.forEach((v, i) => playLayer(engine, opts.make(v, i), pan)); break;
  }
}

/**
 * Play one recipe. Returns false when the key is unknown or rate-limited.
 * Order: gate, `always`, sample attempt, then `also` on success and `synth` on failure (or always with synthAlways).
 */
export function playRecipe(engine, key, arg, pan) {
  const r = RECIPES[key];
  if (!r) return false;
  if (r.gate && !engine.gate(key, r.gate)) return false;
  playLayers(engine, r.always, pan);
  let sampled = false;
  if (r.sample) { const { key: sk, ...opts } = r.sample; sampled = engine.sample(sk, resolve(opts, pan)); }
  if (sampled) playLayers(engine, r.also, pan);
  if (!sampled || r.synthAlways) playLayers(engine, r.synth, pan);
  return true;
}
