// Vectors, angles and rate functions.
//
// Points are plain [x, y] arrays in "frame units": the slide is 14.222 x 8
// units, x to the right, y UP, origin at the centre — the same coordinate
// system manim uses, so figures can be positioned with the same numbers.

export const PI = Math.PI;
export const TAU = 2 * Math.PI;
export const DEG = Math.PI / 180;

export const ORIGIN = [0, 0];
export const UP = [0, 1];
export const DOWN = [0, -1];
export const LEFT = [-1, 0];
export const RIGHT = [1, 0];
export const UR = [1, 1];
export const UL = [-1, 1];
export const DR = [1, -1];
export const DL = [-1, -1];

// Slide geometry (16:9, 8 units tall).
export const FRAME_HEIGHT = 8;
export const FRAME_WIDTH = 16 / 9 * FRAME_HEIGHT;

export const v = (x, y) => [x, y];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const neg = (a) => [-a[0], -a[1]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const norm = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const angleOf = (a) => Math.atan2(a[1], a[0]);
export const fromAngle = (t, r = 1) => [r * Math.cos(t), r * Math.sin(t)];
export const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export function normalize(a) {
  const n = Math.hypot(a[0], a[1]);
  return n < 1e-12 ? [0, 0] : [a[0] / n, a[1] / n];
}

/** Rotate `a` by `t` radians around `about`. */
export function rot(a, t, about = ORIGIN) {
  const c = Math.cos(t), s = Math.sin(t);
  const x = a[0] - about[0], y = a[1] - about[1];
  return [about[0] + c * x - s * y, about[1] + s * x + c * y];
}

/** Unit vector perpendicular to `a`, turned 90 degrees counterclockwise. */
export const perp = (a) => [-a[1], a[0]];

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpV = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/**
 * A seeded stream of numbers in [0, 1). The player replays a scene from its
 * start on every jump, so a lecture that samples anything MUST draw from one
 * of these and never from Math.random — otherwise the slide changes each time
 * you come back to it.
 */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Angle in [-PI, PI]. */
export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// --- rate functions ---------------------------------------------------------

export const linear = (t) => t;

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** manim's default easing: a sigmoid, flat at both ends. */
export function smooth(t, inflection = 10) {
  const err = sigmoid(-inflection / 2);
  return clamp((sigmoid(inflection * (t - 0.5)) - err) / (1 - 2 * err), 0, 1);
}

export const rushInto = (t) => 2 * smooth(t / 2);
export const rushFrom = (t) => 2 * smooth(t / 2 + 0.5) - 1;
export const thereAndBack = (t) => smooth(t < 0.5 ? 2 * t : 2 * (1 - t));
export const easeInOut = smooth;

/** Piece of a lagged sequence: `n` items, each easing over a window. */
export function laggedAlpha(alpha, index, count, lagRatio = 0.5) {
  // Total duration = 1 + (count - 1) * lagRatio (in units of one item's run).
  const total = 1 + (count - 1) * lagRatio;
  const start = index * lagRatio / total;
  const end = start + 1 / total;
  return clamp((alpha - start) / (end - start), 0, 1);
}
