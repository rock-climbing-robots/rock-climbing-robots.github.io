// Animations.
//
// An animation is a small object with begin() / update(alpha) / finish().
// The player drives alpha from 0 to 1 in real time; to jump to the end of a
// slide it simply calls begin(); update(1); finish() with no frames drawn —
// which is what makes instant navigation possible.

import { Mobject } from "./mobject.js";
import { smooth, linear, add, sub, mul, lerp, lerpV, clamp } from "./math.js";
import { mixColor, rgba } from "./render.js";
import { FG as INK } from "./palette.js";
import { CONFIG } from "./config.js";

export class Animation {
  constructor(mobject, { runTime = 1, rateFunc = smooth, remover = false, introducer = true } = {}) {
    this.mobject = mobject;
    this.runTime = runTime;
    this.rateFunc = rateFunc;
    this.remover = remover;      // mobject leaves the scene at the end
    this.introducer = introducer; // mobject joins the scene at the start
  }

  begin() {}
  interpolate(t) {}   // eslint-disable-line no-unused-vars
  /** Hooks for animations that swap mobjects in and out of the scene. */
  onBegin(scene) {}   // eslint-disable-line no-unused-vars
  onFinish(scene) {}  // eslint-disable-line no-unused-vars
  update(alpha) { this.interpolate(this.rateFunc(clamp(alpha, 0, 1))); }
  finish() { this.interpolate(1); }
}

// --- fades ------------------------------------------------------------------

export class FadeIn extends Animation {
  constructor(mob, { shift = null, scale = null, ...opts } = {}) {
    super(mob, opts);
    this.shiftBy = shift;
    this.scaleBy = scale;
  }

  begin() {
    this.start = this.mobject.copy();
    if (this.shiftBy) this.mobject.shift(mul(this.shiftBy, -1));
    if (this.scaleBy) this.mobject.scale(this.scaleBy);
    this.from = this.mobject.copy();
  }

  interpolate(t) {
    if (this.shiftBy || this.scaleBy) interpolateMob(this.mobject, this.from, this.start, t);
    this.mobject.setOpacity(t);
  }

  finish() { copyInto(this.mobject, this.start); this.mobject.setOpacity(1); }
}

/**
 * manim's TransformFromCopy: `src` stays where it is, a copy of it flies onto
 * `dst`. Between two formulas the glyphs travel (as in TransformMatching);
 * anything else is interpolated shape by shape.
 */
export function TransformFromCopy(src, dst, opts = {}) {
  const morphable = onlyGlyphs(src) && onlyGlyphs(dst);
  return morphable
    ? new TransformMatching(src, dst, { keepSource: true, ...opts })
    : new CopyOnto(src, dst, opts);
}

/** True for formulas: everything that draws is a glyph. Anything else (an
    arrow, a dashed step) has to travel as a shape, not as letters. */
function onlyGlyphs(mob) {
  let found = false;
  for (const m of mob.walk()) {
    if (m.glyphs) { found = true; continue; }
    if (m.children.length === 0 && m.constructor.name !== "Mobject") return false;
  }
  return found;
}

class CopyOnto extends Animation {
  constructor(src, dst, opts = {}) {
    super(null, opts);
    this.src = src;
    this.dst = dst;
  }
  begin() {
    this.flying = this.src.copy();
    this.from = this.flying.copy();
  }
  interpolate(t) { interpolateMob(this.flying, this.from, this.dst, t); }
  onBegin(scene) { scene.add(this.flying); }
  onFinish(scene) { scene.remove(this.flying); scene.add(this.dst); }
}

/** manim's Flash: a burst of lines radiating from a point. */
export class Flash extends Animation {
  constructor(point, {
    color = INK, lines = 12, radius = 1, length = 0.3, width = 3, ...opts
  } = {}) {
    super(null, { runTime: 1, ...opts });
    this.burst = new Burst(point, color, lines, radius, length, width);
  }
  begin() { this.burst.t = 0; }
  interpolate(t) { this.burst.t = t; }
  onBegin(scene) { scene.add(this.burst); }
  onFinish(scene) { scene.remove(this.burst); }
}

class Burst extends Mobject {
  constructor(point, color, lines, radius, length, width) {
    super();
    this.point = [...point];
    this.strokeColor = color;
    this.strokeWidth = width;
    this.n = lines;
    this.radius = radius;
    this.len = length;
    this.t = 0;
  }
  mapPoints(fn) { this.point = fn(this.point); }
  drawSelf(r, alpha) {
    const { ctx } = r;
    const t = this.t;
    ctx.beginPath();
    for (let i = 0; i < this.n; i++) {
      const a = (i / this.n) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const r0 = this.radius * t, r1 = r0 + this.len * (1 - t);
      ctx.moveTo(this.point[0] + c * r0, this.point[1] + s * r0);
      ctx.lineTo(this.point[0] + c * r1, this.point[1] + s * r1);
    }
    r.stroke(this, alpha * (1 - t));
  }
}

export class FadeOut extends Animation {
  constructor(mob, { shift = null, ...opts } = {}) {
    super(mob, { remover: true, introducer: false, ...opts });
    this.shiftBy = shift;
  }

  begin() { this.from = this.mobject.copy(); }

  interpolate(t) {
    if (this.shiftBy) {
      const target = this.from.copy().shift(this.shiftBy);
      interpolateMob(this.mobject, this.from, target, t);
    }
    // From the opacity it HAS: a mobject already faded (a robot at 20%)
    // jumped back to full and faded from there.
    this.mobject.setOpacity(this.from.opacity * (1 - t));
  }

  /** The mobject is removed from the scene, so restore it for later reuse
      (with the opacity it had). */
  finish() { copyInto(this.mobject, this.from); }
}

// --- drawing ----------------------------------------------------------------

/** manim's Write: outlines are traced, then filled in. A course that sets
    `write: false` in deck.config.js gets a plain fade instead, wherever text
    comes in (appear() and every explicit Write alike). */
const FADE_TEXT = CONFIG.write === false;

export class Write extends Animation {
  constructor(mob, opts = {}) {
    // Course preference: twice as fast as manim's default.
    super(mob, { runTime: FADE_TEXT ? 0.6 : 0.5 + 0.3 * Math.min(3, countGlyphs(mob) / 12), ...opts });
  }

  begin() {
    if (FADE_TEXT) { this.opacity0 = this.mobject.opacity; this.mobject.setOpacity(0); return; }
    for (const m of this.mobject.walk()) if (canWrite(m)) m.writeAlpha = 0;
  }
  interpolate(t) {
    if (FADE_TEXT) { this.mobject.setOpacity(t * this.opacity0); return; }
    for (const m of this.mobject.walk()) if (canWrite(m)) m.writeAlpha = t;
  }
  finish() {
    if (FADE_TEXT) { this.mobject.setOpacity(this.opacity0); return; }
    for (const m of this.mobject.walk()) delete m.writeAlpha;
  }
}

const canWrite = (m) => "writeAlpha" in m || m.glyphs || m.lines;

function countGlyphs(mob) {
  let n = 0;
  for (const m of mob.walk()) n += (m.glyphs || m.lines || []).length;
  return n || 6;
}

/** manim's Create: the outline is drawn progressively. */
export class Create extends Animation {
  begin() { for (const m of this.mobject.walk()) m.drawRatio = 0; }
  interpolate(t) { for (const m of this.mobject.walk()) m.drawRatio = t; }
  finish() { for (const m of this.mobject.walk()) m.drawRatio = 1; }
}

export class Uncreate extends Animation {
  constructor(mob, opts = {}) { super(mob, { remover: true, introducer: false, ...opts }); }
  interpolate(t) { for (const m of this.mobject.walk()) m.drawRatio = 1 - t; }
  finish() { for (const m of this.mobject.walk()) m.drawRatio = 1; }
}

/** An arrow that grows from its tail. */
export class GrowArrow extends Animation {
  begin() { this.from = this.mobject.p1; this.to = this.mobject.p2; }
  interpolate(t) { this.mobject.p2 = lerpV(this.from, this.to, Math.max(t, 0.001)); }
  finish() { this.mobject.p2 = this.to; }
}

// --- moving -----------------------------------------------------------------

/** Generic "apply this change, animated" (manim's .animate).
 *  to(mob, m => m.shift(DOWN)) */
export class Apply extends Animation {
  constructor(mob, fn, opts = {}) { super(mob, opts); this.fn = fn; }
  begin() {
    this.from = this.mobject.copy();
    this.target = this.fn(this.mobject.copy()) || this.mobject.copy();
  }
  interpolate(t) { interpolateMob(this.mobject, this.from, this.target, t); }
  finish() { copyInto(this.mobject, this.target); }
}

export const to = (mob, fn, opts) => new Apply(mob, fn, opts);

export class Rotate extends Animation {
  constructor(mob, angle, { about = null, ...opts } = {}) {
    super(mob, opts);
    this.angle = angle;
    this.about = about;
  }
  begin() { this.from = this.mobject.copy(); this.centre = this.about || this.mobject.center(); }
  interpolate(t) {
    copyInto(this.mobject, this.from);
    this.mobject.rotate(this.angle * t, this.centre);
  }
}

/** Constant-speed rotation, for looping slides. */
export const Rotating = (mob, angle, opts = {}) =>
  new Rotate(mob, angle, { rateFunc: linear, runTime: 6, ...opts });

/** Morph one mobject into another (same structure: manim's Transform). */
export class Transform extends Animation {
  constructor(mob, target, opts = {}) { super(mob, opts); this.target = target; }
  begin() { this.from = this.mobject.copy(); }
  interpolate(t) { interpolateMob(this.mobject, this.from, this.target, t); }
  finish() { copyInto(this.mobject, this.target); }
}

/** Free-form animation: fn(mobject, alpha). */
export class UpdateFromAlpha extends Animation {
  constructor(mob, fn, opts = {}) { super(mob, opts); this.fn = fn; }
  interpolate(t) { this.fn(this.mobject, t); }
}

// --- values -----------------------------------------------------------------

/** manim's ValueTracker: a number figures can follow through an updater. */
export class Value {
  constructor(v = 0) { this.v = v; }
  get() { return this.v; }
  set(v) { this.v = v; return this; }
  clone() { return new Value(this.v); }
}

export class ValueAnim extends Animation {
  constructor(tracker, target, opts = {}) {
    super(null, { rateFunc: smooth, ...opts });
    this.tracker = tracker;
    this.target = target;
  }
  begin() { this.from = this.tracker.get(); }
  interpolate(t) { this.tracker.set(lerp(this.from, this.target, t)); }
}

export const valueTo = (tr, v, opts) => new ValueAnim(tr, v, opts);
export const valueBy = (tr, dv, opts) => new ValueAnim(tr, tr.get() + dv, opts);

// --- groups -----------------------------------------------------------------

export class AnimationGroup extends Animation {
  constructor(anims, { lag = 0, ...opts } = {}) {
    const runTime = Math.max(...anims.map((a) => a.runTime), 0.001) * (1 + lag * (anims.length - 1));
    super(null, { runTime, rateFunc: linear, ...opts });
    this.anims = anims;
    this.lag = lag;
  }
  begin() { for (const a of this.anims) a.begin(); }
  interpolate(t) {
    const n = this.anims.length;
    const total = 1 + this.lag * (n - 1);
    this.anims.forEach((a, i) => {
      const start = (i * this.lag) / total;
      const span = 1 / total;
      a.update(clamp((t - start) / span, 0, 1));
    });
  }
  finish() { for (const a of this.anims) a.finish(); }
}

export const lagged = (anims, opts = {}) => new AnimationGroup(anims, { lag: 0.15, ...opts });

/**
 * The manim entrance of whatever it is handed — the one place that knows which
 * animation belongs to which kind of thing, so a slide can say "let this
 * appear" and get the right gesture:
 *
 *   a straight arrow GROWS from its tail       (GrowArrow)
 *   a curve, a circle, a square is DRAWN       (Create)
 *   a dot swells from its centre               (Create — Dot scales its radius)
 *   prose and formulas are WRITTEN             (Write)
 *   a group does all of that, its parts staggered
 *
 * Nothing here imports shapes.js: the kind is read off the fields a mobject
 * carries, which keeps anim.js free of a cycle through render.js.
 */
export function appear(mob, { lag = 0.12, ...opts } = {}) {
  if (!mob) return null;
  // `mob.appearAs = "fade"` overrides the guess: a shape with no stroke has
  // no outline to trace, and Create would leave it invisible until the last
  // frame and then pop it in.
  if (mob.appearAs === "fade") return new FadeIn(mob, opts);
  if (!mob || typeof mob.walk !== "function") {
    throw new Error(`appear() needs a mobject, got ${mob && mob.constructor ? mob.constructor.name : typeof mob}`
      + (mob && mob.all ? " (a figure object: pass its .all)" : ""));
  }
  // A shape of its own: it has an outline to trace.
  if (typeof mob.outline === "function") {
    if ("bulge" in mob) return new Create(mob, opts);          // CurvedArrow
    if ("tipLength" in mob && "p1" in mob) return new GrowArrow(mob, opts);
    return new Create(mob, opts);
  }
  // Text, or a formula: something MathJax or the canvas has set glyphs on.
  if (isWritable(mob) && !hasOutline(mob)) return new Write(mob, opts);
  if (mob.children && mob.children.length) {
    const parts = mob.children.map((c) => appear(c, { lag, ...opts })).filter(Boolean);
    if (!parts.length) return new FadeIn(mob, opts);
    return parts.length === 1 ? parts[0] : new AnimationGroup(parts, { lag, ...opts });
  }
  return new FadeIn(mob, opts);
}

const isWritable = (mob) => {
  for (const m of mob.walk()) if (m.glyphs || m.lines) return true;
  return false;
};

const hasOutline = (mob) => {
  for (const m of mob.walk()) if (typeof m.outline === "function") return true;
  return false;
};

// --- structural interpolation ----------------------------------------------

// Fields that are structure, not state: never interpolated.
const SKIP = new Set(["id", "updaters", "children", "fn", "path", "paths", "box"]);

/** Interpolate every numeric field of `a` towards `b`, into `out`. */
/** Lerp two arrays of numbers, of points, of anything nested. */
function lerpDeep(a, b, t) {
  return a.map((x, i) => {
    const y = b[i] === undefined ? x : b[i];
    if (typeof x === "number" && typeof y === "number") return lerp(x, y, t);
    if (Array.isArray(x) && Array.isArray(y)) return lerpDeep(x, y, t);
    return t >= 0.5 ? y : x;
  });
}

export function interpolateMob(out, a, b, t) {
  for (const key of Object.keys(a)) {
    if (SKIP.has(key)) continue;
    const va = a[key], vb = b[key];
    if (vb === undefined) continue;
    // Named parts and trackers keep their identity, exactly as in copyInto():
    // the halfway swap below would hand the mobject the COPY's `link1` or the
    // COPY's tracker, and everything the scene still drives -- an updater, a
    // slider -- would then be writing to an object nothing draws. A part is
    // restored by the recursion over children just below; a tracker holds a
    // value the animation has no business replacing.
    if (va instanceof Mobject) continue;
    if (va && typeof va.clone === "function" && typeof va.set === "function") continue;
    if (typeof va === "number" && typeof vb === "number") {
      out[key] = lerp(va, vb, t);
    } else if (Array.isArray(va) && Array.isArray(vb)) {
      // Nested too: a Polygon holds its points as an array of [x, y], and
      // treating that as "not a number list" made it JUMP half way instead
      // of travelling.
      out[key] = lerpDeep(va, vb, t);
    } else if (typeof va === "string" && typeof vb === "string"
               && va[0] === "#" && vb[0] === "#") {
      out[key] = mixColor(va, vb, t);
    } else if (t >= 0.5) {
      // Text that changes, glyph lists: swap them over half way.
      out[key] = vb;
    }
  }
  const n = Math.min(a.children.length, b.children.length);
  for (let i = 0; i < n; i++) interpolateMob(out.children[i], a.children[i], b.children[i], t);
  // Extra children on either side simply fade.
  for (let i = n; i < out.children.length; i++) out.children[i].setOpacity(1 - t);
}

/**
 * Overwrite `out` with the state of `src` (same class), IN PLACE.
 *
 * Nothing that other code holds a reference to is ever swapped for a clone:
 * children are restored one by one, named parts (the arm's `joint1`, which is
 * also one of its children) are left alone, and trackers keep their identity
 * and only take back their value. Replacing them would leave the scene
 * drawing one set of objects while the updaters moved another.
 */
export function copyInto(out, src) {
  const fresh = src.copy();
  const sameShape = out.children.length === src.children.length;
  for (const key of Object.keys(fresh)) {
    if (key === "id") continue;
    if (key === "children") {
      if (!sameShape) out.children = fresh.children;
      continue;
    }
    const mine = out[key];
    if (mine instanceof Mobject) continue;            // restored as a child
    if (mine && typeof mine.clone === "function" && typeof mine.set === "function") {
      mine.set(src[key].get());                       // a tracker keeps its identity
      continue;
    }
    out[key] = fresh[key];
  }
  if (sameShape) {
    for (let i = 0; i < out.children.length; i++) copyInto(out.children[i], src.children[i]);
  }
  return out;
}

// --- morphing formulas ------------------------------------------------------

/**
 * manim's TransformMatchingShapes, for formulas: glyphs present in both
 * sides (same outline) travel to their new place, the others cross-fade.
 */
export class TransformMatching extends Animation {
  constructor(src, dst, { keepSource = false, ...opts } = {}) {
    super(null, { runTime: 1, ...opts });
    this.src = src;
    this.dst = dst;
    this.keepSource = keepSource;   // TransformFromCopy leaves the source be
  }

  begin() {
    const from = collectGlyphs(this.src);
    const to = collectGlyphs(this.dst);
    const used = new Set();
    this.pairs = [];
    this.out = [];
    for (const g of from) {
      const j = g.clip ? -1
        : to.findIndex((h, i) => !used.has(i) && !h.clip && h.d === g.d);
      if (j >= 0) { used.add(j); this.pairs.push([g, to[j]]); } else this.out.push(g);
    }
    this.in = to.filter((_, i) => !used.has(i));
    this.morph = new GlyphMorph(this);
    this.morph.zIndex = this.src.zIndex;
  }

  interpolate(t) { this.morph.t = t; }

  onBegin(scene) {
    if (!this.keepSource) hide(scene, this.src);
    scene.add(this.morph);
  }

  onFinish(scene) {
    scene.remove(this.morph);
    scene.add(this.dst);
  }
}

/** Take `mob` out of the picture, wherever it lives: on its own in the scene,
    or inside a group that stays. */
function hide(scene, mob) {
  scene.remove(mob);
  for (const top of scene.mobjects) {
    for (const m of top.walk()) {
      if (m.children.includes(mob)) m.remove(mob);
    }
  }
}

function collectGlyphs(mob) {
  const out = [];
  for (const m of mob.walk()) {
    if (!m.glyphs || !m.toWorld) continue;
    for (const g of m.glyphs) {
      const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
      out.push({
        d: g.d, path: g.path, len: g.len, clip: g.clip,
        colour: g.color || m.fillColor,
        centre: m.toWorld([cx, cy]),
        local: [cx, cy],
        part: m,
      });
    }
  }
  return out;
}

/** The transient mobject drawn while a TransformMatching runs. */
class GlyphMorph extends Mobject {
  constructor(anim) { super(); this.anim = anim; this.t = 0; }

  drawSelf(r, alpha) {
    const { ctx } = r;
    const t = this.t;
    const drawGlyph = (g, matrix, op) => {
      ctx.save();
      ctx.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
      if (g.clip) {      // stretchy pieces overflow their box on purpose
        ctx.beginPath();
        ctx.rect(g.clip.x0, g.clip.y0, g.clip.x1 - g.clip.x0, g.clip.y1 - g.clip.y0);
        ctx.clip();
      }
      ctx.fillStyle = rgba(g.colour, op * alpha);
      ctx.fill(g.path);
      ctx.restore();
    };
    for (const g of this.anim.out) {
      drawGlyph(g, g.part.deviceMatrix(r), 1 - Math.min(1, t * 2));
    }
    for (const [a, b] of this.anim.pairs) {
      const m = a.part.deviceMatrix(r);
      const [ax, ay] = r.toDevice(a.centre);
      const [bx, by] = r.toDevice(b.centre);
      const ratio = lerp(1, b.part.unit / a.part.unit, t);
      const dx = lerp(ax, bx, t) - ax, dy = lerp(ay, by, t) - ay;
      const M = new DOMMatrix([m[0], m[1], m[2], m[3], m[4], m[5]]);
      const T = new DOMMatrix()
        .translateSelf(ax + dx, ay + dy).scaleSelf(ratio).translateSelf(-ax, -ay)
        .multiplySelf(M);
      drawGlyph({ ...a, colour: mixColor(a.colour, b.colour, t) },
                [T.a, T.b, T.c, T.d, T.e, T.f], 1);
    }
    for (const g of this.anim.in) {
      drawGlyph(g, g.part.deviceMatrix(r), Math.max(0, t * 2 - 1));
    }
  }
}

