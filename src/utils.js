// Small shared helpers. Keep this file dependency-free.

export const TAU = Math.PI * 2;

/** 0xff00aa -> '#ff00aa' */
export const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** distance between two objects that have x/y */
export const dist = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
export const distXY = (x1, y1, x2, y2) => Phaser.Math.Distance.Between(x1, y1, x2, y2);
export const angleTo = (a, b) => Phaser.Math.Angle.Between(a.x, a.y, b.x, b.y);

/** random float in [a, b), random pick, random sign */
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const randomSign = () => (Math.random() < 0.5 ? 1 : -1);

/** element of list with the smallest / largest score; null when the list is empty */
export function minBy(list, score) {
  let best = null, bestScore = Infinity;
  for (const item of list) { const s = score(item); if (s < bestScore) { bestScore = s; best = item; } }
  return best;
}
export function maxBy(list, score) {
  let best = null, bestScore = -Infinity;
  for (const item of list) { const s = score(item); if (s > bestScore) { bestScore = s; best = item; } }
  return best;
}

/** nearest live object to (x, y) within maxDist, optionally filtered */
/** a ship that can currently be shot at: alive and not covered by a shoal-mate in front of it */
export const targetable = (o) => !o.dead && !(o.cover && !o.cover.dead);

export function nearest(list, x, y, maxDist = Infinity, filter = null) {
  let best = null, bd = maxDist;
  for (const o of list) {
    if (!targetable(o) || (filter && !filter(o))) continue;
    const d = distXY(x, y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/** geometric scaling used for costs and threat growth: base * growth^steps */
export const scaleBy = (base, growth, steps) => base * Math.pow(growth, steps);

/**
 * Per-second history buckets: one [second, total] entry per second of run time, appended in order.
 * Beams and auras add every frame, so per-event entries would run into the hundreds of thousands.
 */
export function pushBucket(log, sec, value) {
  const last = log[log.length - 1];
  if (last && last[0] === sec) last[1] += value; else log.push([sec, value]);
}

/** Drop buckets older than windowSec, then total what is left. */
export function sumWindow(log, now, windowSec) {
  while (log.length && log[0][0] < now - windowSec) log.shift();
  let sum = 0;
  for (const e of log) sum += e[1];
  return sum;
}

/** clamp helper */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** "1.2k", "3.40M", "512" */
export const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toString();
export const fmtTime = (t) => { t = Math.floor(t); const m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
