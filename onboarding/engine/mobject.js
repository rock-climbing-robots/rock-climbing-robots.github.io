// Mobject: the base drawable object.
//
// Like in manim, a mobject owns its geometry in WORLD coordinates: moving it
// means moving its points. Subclasses declare their geometry through three
// hooks — mapPoints (positions), onScale (radii, font sizes) and onRotate
// (intrinsic orientation) — and everything else (shift, rotate, nextTo,
// bounding boxes, cloning, interpolation) comes for free.

import { add, sub, mul, rot, ORIGIN } from "./math.js";

let ID = 0;

export class Mobject {
  constructor() {
    this.id = ID++;
    this.children = [];
    this.strokeColor = null;
    this.strokeWidth = 0;     // in manim units: 1 unit = 0.01 frame unit
    this.strokeDash = null;   // [on, off] in frame units
    this.fillColor = null;
    this.fillOpacity = 0;
    this.opacity = 1;         // multiplier used by fades
    this.zIndex = 0;
    this.updaters = [];
  }

  // --- tree -----------------------------------------------------------------

  add(...mobs) {
    for (const m of mobs) if (m && !this.children.includes(m)) this.children.push(m);
    return this;
  }

  remove(...mobs) {
    this.children = this.children.filter((c) => !mobs.includes(c));
    return this;
  }

  /** Is `m` this mobject or one of its descendants? */
  contains(m) {
    for (const x of this.walk()) if (x === m) return true;
    return false;
  }

  /** Every mobject of the subtree, this one included. */
  *walk() {
    yield this;
    for (const c of this.children) yield* c.walk();
  }

  get submobjects() { return this.children; }

  // --- geometry hooks (overridden by subclasses) ----------------------------

  /** Apply `fn` to every point this mobject owns (not its children). */
  mapPoints(fn) {}       // eslint-disable-line no-unused-vars
  /** Scale the intrinsic sizes (radius, font size, tip length...). */
  onScale(k) {}          // eslint-disable-line no-unused-vars
  /** Turn the intrinsic orientation. */
  onRotate(a) {}         // eslint-disable-line no-unused-vars
  /** Points that define this mobject's extent (not its children's). */
  boundsPoints() { return []; }

  // --- transforms -----------------------------------------------------------

  apply(fn) {
    this.mapPoints(fn);
    for (const c of this.children) c.apply(fn);
    return this;
  }

  shift(d) { return this.apply((p) => add(p, d)); }

  scale(k, about = null) {
    const c = about || this.center();
    this.apply((p) => add(c, mul(sub(p, c), k)));
    for (const m of this.walk()) m.onScale(k);
    return this;
  }

  rotate(a, about = null) {
    const c = about || this.center();
    this.apply((p) => rot(p, a, c));
    for (const m of this.walk()) m.onRotate(a);
    return this;
  }

  moveTo(p) { return this.shift(sub(p, this.center())); }

  /** Move so that the given edge/corner direction lands on `p`. */
  alignPointTo(dir, p) { return this.shift(sub(p, this.corner(dir))); }

  // --- bounding box ---------------------------------------------------------

  bbox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of this.walk()) {
      for (const p of m.boundsPoints()) {
        if (p[0] < x0) x0 = p[0];
        if (p[0] > x1) x1 = p[0];
        if (p[1] < y0) y0 = p[1];
        if (p[1] > y1) y1 = p[1];
      }
    }
    if (x0 === Infinity) return { x0: 0, y0: 0, x1: 0, y1: 0 };
    return { x0, y0, x1, y1 };
  }

  center() {
    const b = this.bbox();
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  }

  get width() { const b = this.bbox(); return b.x1 - b.x0; }
  get height() { const b = this.bbox(); return b.y1 - b.y0; }

  /** Point on the bounding box in direction `dir` ([0,1] = top centre...). */
  corner(dir) {
    const b = this.bbox();
    return [
      dir[0] < 0 ? b.x0 : dir[0] > 0 ? b.x1 : (b.x0 + b.x1) / 2,
      dir[1] < 0 ? b.y0 : dir[1] > 0 ? b.y1 : (b.y0 + b.y1) / 2,
    ];
  }

  top() { return this.corner([0, 1]); }
  bottom() { return this.corner([0, -1]); }
  left() { return this.corner([-1, 0]); }
  right() { return this.corner([1, 0]); }

  // --- layout ---------------------------------------------------------------

  /** Place this mobject next to `target` in direction `dir`, `buff` away. */
  nextTo(target, dir = [1, 0], buff = 0.25) {
    const anchor = target instanceof Mobject ? target.corner(dir) : target;
    const mine = this.corner(mul(dir, -1));
    return this.shift(add(sub(anchor, mine), mul(dir, buff)));
  }

  /** Align one edge with the same edge of `target` (manim's align_to). */
  alignTo(target, dir) {
    const anchor = target instanceof Mobject ? target.corner(dir) : target;
    const mine = this.corner(dir);
    const d = [dir[0] !== 0 ? anchor[0] - mine[0] : 0,
               dir[1] !== 0 ? anchor[1] - mine[1] : 0];
    return this.shift(d);
  }

  /** Push against a slide edge (manim's to_edge). */
  toEdge(dir, buff = 0.5) {
    const half = [16 / 9 * 4, 4];
    const target = [dir[0] * (half[0] - buff), dir[1] * (half[1] - buff)];
    const mine = this.corner(dir);
    return this.shift([dir[0] !== 0 ? target[0] - mine[0] : 0,
                       dir[1] !== 0 ? target[1] - mine[1] : 0]);
  }

  toCorner(dir, buff = 0.5) { return this.toEdge([dir[0], 0], buff).toEdge([0, dir[1]], buff); }

  matchX(target) { return this.shift([target.center()[0] - this.center()[0], 0]); }
  matchY(target) { return this.shift([0, target.center()[1] - this.center()[1]]); }

  // --- style ----------------------------------------------------------------

  setColor(c) {
    for (const m of this.walk()) {
      if (m.strokeColor) m.strokeColor = c;
      if (m.fillColor) m.fillColor = c;
    }
    return this;
  }

  setStroke({ color, width, opacity, dash } = {}) {
    for (const m of this.walk()) {
      if (color !== undefined) m.strokeColor = color;
      if (width !== undefined) m.strokeWidth = width;
      if (dash !== undefined) m.strokeDash = dash;
      if (opacity !== undefined) m.strokeOpacity = opacity;
    }
    return this;
  }

  setFill({ color, opacity } = {}) {
    for (const m of this.walk()) {
      if (color !== undefined) m.fillColor = color;
      if (opacity !== undefined) m.fillOpacity = opacity;
    }
    return this;
  }

  /** Fade the whole subtree. The opacity of a parent MULTIPLIES that of its
      children while drawing, so it is set on this node only — setting it all
      the way down would compound (0.35 twice over is 0.12). */
  setOpacity(o) { this.opacity = o; return this; }
  setZ(z) { this.zIndex = z; return this; }

  // --- updaters -------------------------------------------------------------

  addUpdater(fn, { call = true } = {}) {
    this.updaters.push(fn);
    if (call) fn(this);
    return this;
  }

  removeUpdater(fn) { this.updaters = this.updaters.filter((u) => u !== fn); return this; }
  clearUpdaters({ recurse = true } = {}) {
    this.updaters = [];
    if (recurse) for (const c of this.children) c.clearUpdaters();
    return this;
  }

  update() {
    for (const fn of this.updaters) fn(this);
    for (const c of this.children) c.update();
    return this;
  }

  // --- copying --------------------------------------------------------------

  /** Deep copy. `seen` keeps the aliasing: a mobject that is both a child
      and a named field (the arm's `joint1`) stays ONE object in the copy. */
  copy(seen = new Map()) {
    if (seen.has(this)) return seen.get(this);
    const out = Object.create(Object.getPrototypeOf(this));
    seen.set(this, out);
    for (const [k, val] of Object.entries(this)) out[k] = cloneValue(val, seen);
    out.id = ID++;
    return out;
  }

  // --- drawing --------------------------------------------------------------

  /** Subclasses draw themselves here; `r` is the renderer (see render.js). */
  drawSelf(r, alpha) {}   // eslint-disable-line no-unused-vars

  draw(r, alpha = 1) {
    const a = alpha * this.opacity;
    if (a <= 0.001) return;
    this.drawSelf(r, a);
    const kids = this.children.length > 1
      ? [...this.children].sort((p, q) => (p.zIndex || 0) - (q.zIndex || 0))
      : this.children;
    for (const c of kids) c.draw(r, a);
  }
}

function cloneValue(val, seen) {
  if (val instanceof Mobject) return val.copy(seen);
  if (Array.isArray(val)) return val.map((v) => cloneValue(v, seen));
  if (val && typeof val.clone === "function") {          // Value trackers
    if (!seen.has(val)) seen.set(val, val.clone());
    return seen.get(val);
  }
  return val;   // numbers, strings, Path2D, functions, shared caches
}

/** A bare container (manim's VGroup / Group). */
export class Group extends Mobject {
  constructor(...mobs) {
    super();
    this.add(...mobs.flat());
  }

  /** Stack the children along `dir`, aligned on one edge (manim's arrange).
      Like manim's, the arranged group ends up centred on the origin unless
      `center` is false. */
  arrange(dir = [0, -1], { buff = 0.25, aligned = null, center = true } = {}) {
    for (let i = 1; i < this.children.length; i++) {
      this.children[i].nextTo(this.children[i - 1], dir, buff);
      if (aligned) this.children[i].alignTo(this.children[i - 1], aligned);
    }
    return center ? this.moveTo([0, 0]) : this;
  }

  get(i) { return this.children[i]; }
}

export const group = (...m) => new Group(...m);
