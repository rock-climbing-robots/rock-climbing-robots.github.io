// Vector shapes.
//
// Every shape exposes its outline as one or more polylines (`outline()`), so
// stroking, filling and the progressive "Create" animation are implemented
// once, in VMobject, and work for any shape.

import { Mobject } from "./mobject.js";
import {
  add, sub, mul, norm, normalize, perp, rot, angleOf, fromAngle, lerpV,
  TAU, PI, clamp,
} from "./math.js";
import { FG as INK } from "./palette.js";

export class VMobject extends Mobject {
  constructor() {
    super();
    this.drawRatio = 1;      // < 1 while being drawn by Create()
    this.strokeOpacity = 1;
  }

  /** [{ pts: [[x,y],...], closed: bool }, ...] in world coordinates. */
  outline() { return []; }

  boundsPoints() {
    const out = [];
    for (const sp of this.outline()) out.push(...sp.pts);
    return out;
  }

  tracePath(ctx, ratio = 1) {
    ctx.beginPath();
    for (const { pts, closed } of this.outline()) {
      if (pts.length < 2) continue;
      let list = pts;
      if (ratio < 1) {
        list = closed ? partial([...pts, pts[0]], ratio) : partial(pts, ratio);
        if (list.length < 2) continue;
        ctx.moveTo(list[0][0], list[0][1]);
        for (let i = 1; i < list.length; i++) ctx.lineTo(list[i][0], list[i][1]);
        continue;
      }
      ctx.moveTo(list[0][0], list[0][1]);
      for (let i = 1; i < list.length; i++) ctx.lineTo(list[i][0], list[i][1]);
      if (closed) ctx.closePath();
    }
  }

  drawSelf(r, alpha) {
    const ratio = clamp(this.drawRatio, 0, 1);
    if (ratio <= 0) return;
    this.tracePath(r.ctx, ratio);
    if (ratio >= 1) r.fill(this, alpha);
    r.stroke(this, alpha);
  }
}

/** First `ratio` of a polyline, by arc length. */
function partial(pts, ratio) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(d);
    total += d;
  }
  if (total === 0) return [pts[0]];
  let want = total * ratio;
  const out = [pts[0]];
  for (let i = 0; i < lens.length; i++) {
    if (want >= lens[i]) {
      out.push(pts[i + 1]);
      want -= lens[i];
    } else {
      out.push(lerpV(pts[i], pts[i + 1], lens[i] ? want / lens[i] : 0));
      break;
    }
  }
  return out;
}

// --- lines ------------------------------------------------------------------

export class Line extends VMobject {
  constructor(p1, p2, { color = INK, width = 4, dash = null } = {}) {
    super();
    this.p1 = [...p1];
    this.p2 = [...p2];
    this.strokeColor = color;
    this.strokeWidth = width;
    this.strokeDash = dash;
  }

  mapPoints(fn) { this.p1 = fn(this.p1); this.p2 = fn(this.p2); }
  outline() { return [{ pts: [this.p1, this.p2], closed: false }]; }

  setPoints(p1, p2) { this.p1 = [...p1]; this.p2 = [...p2]; return this; }
  get start() { return this.p1; }
  get end() { return this.p2; }
  get vector() { return sub(this.p2, this.p1); }
  get length() { return norm(this.vector); }
  pointAt(t) { return lerpV(this.p1, this.p2, t); }
}

/** Dashed line: the dash pattern is derived from the length, so the dashes
    stay regular whatever the segment (manim's DashedLine). */
export class DashedLine extends Line {
  constructor(p1, p2, opts = {}) {
    super(p1, p2, opts);
    this.dashLength = opts.dashLength || 0.12;
    this.dashRatio = opts.dashRatio || 0.55;   // fraction of the pattern drawn
  }

  drawSelf(r, alpha) {
    const L = this.length;
    const n = Math.max(1, Math.round(L / (this.dashLength / this.dashRatio)));
    const period = L / n;
    this.strokeDash = [period * this.dashRatio, period * (1 - this.dashRatio)];
    super.drawSelf(r, alpha);
  }
}

// --- arrows -----------------------------------------------------------------

export class Arrow extends VMobject {
  constructor(p1, p2, {
    color = INK, width = 4, buff = 0, tipLength = 0.25, both = false,
    dashes = 0,
  } = {}) {
    super();
    this.p1 = [...p1];
    this.p2 = [...p2];
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = color;
    this.fillOpacity = 1;
    this.buff = buff;
    this.tipLength = tipLength;
    this.both = both;
    this.dashes = dashes;        // dashed shaft (the head stays solid)
  }

  mapPoints(fn) { this.p1 = fn(this.p1); this.p2 = fn(this.p2); }
  onScale(k) { this.tipLength *= k; this.buff *= k; }

  /** Endpoints after the buffer is applied. */
  ends() {
    const d = sub(this.p2, this.p1), L = norm(d);
    if (L < 1e-9) return [this.p1, this.p2];
    const u = mul(d, 1 / L);
    const b = Math.min(this.buff, L / 2 - 1e-3);
    return [add(this.p1, mul(u, this.both ? b : b)), sub(this.p2, mul(u, b))];
  }

  outline() {
    const [a, b] = this.ends();
    const d = sub(b, a), L = norm(d);
    if (L < 1e-9) return [];
    const u = mul(d, 1 / L);
    const tip = Math.min(this.tipLength, L * 0.9);
    // Shaft stops just inside the tip so the point stays sharp.
    const shaftEnd = sub(b, mul(u, tip * 0.85));
    const shaftStart = this.both ? add(a, mul(u, tip * 0.85)) : a;
    const out = [{ pts: [shaftStart, shaftEnd], closed: false }];
    out.push({ pts: tipPts(b, u, tip), closed: true });
    if (this.both) out.push({ pts: tipPts(a, mul(u, -1), tip), closed: true });
    return out;
  }

  get start() { return this.p1; }
  get end() { return this.p2; }

  drawSelf(r, alpha) {
    const [shaft, ...tips] = this.outline();
    if (!shaft) return;
    const ratio = clamp(this.drawRatio, 0, 1);
    const { ctx } = r;
    ctx.beginPath();
    const pts = ratio < 1 ? partial(shaft.pts, ratio) : shaft.pts;
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (this.dashes) {
      const period = norm(sub(shaft.pts[1], shaft.pts[0])) / this.dashes;
      this.strokeDash = [period * 0.55, period * 0.45];
    }
    r.stroke(this, alpha);
    if (ratio >= 1) {
      ctx.beginPath();
      for (const t of tips) {
        t.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
      }
      r.fill(this, alpha);
    }
  }
}

function tipPts(point, u, len) {
  const n = perp(u);
  const base = sub(point, mul(u, len));
  const halfW = len * 0.42;
  return [point, add(base, mul(n, halfW)), sub(base, mul(n, halfW))];
}

export class DoubleArrow extends Arrow {
  constructor(p1, p2, opts = {}) { super(p1, p2, { ...opts, both: true }); }
}

// --- round things -----------------------------------------------------------

export class Arc extends VMobject {
  constructor(centre, radius, startAngle, angle, {
    color = INK, width = 4, fill = null, fillOpacity = 0,
  } = {}) {
    super();
    this.c = [...centre];
    this.r = radius;
    this.a0 = startAngle;
    this.da = angle;
    this.rotation = 0;
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = fill;
    this.fillOpacity = fillOpacity;
    this.closedShape = false;
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.r *= k; }
  onRotate(a) { this.a0 += a; }

  outline() {
    const n = Math.max(8, Math.ceil(Math.abs(this.da) / (TAU / 96)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      pts.push(add(this.c, fromAngle(this.a0 + (this.da * i) / n, this.r)));
    }
    return [{ pts, closed: this.closedShape }];
  }

  pointAt(t) { return add(this.c, fromAngle(this.a0 + this.da * t, this.r)); }
}

/** Arc marking the angle at `vertex`, from direction `da` to direction `db`
    (the short way round, keeping the sign). */
export function angleBetween(vertex, da, db, { radius = 0.6, color = INK, width = 4 } = {}) {
  const a0 = angleOf(da);
  const delta = Math.atan2(Math.sin(angleOf(db) - a0), Math.cos(angleOf(db) - a0));
  return new Arc(vertex, radius, a0, delta, { color, width });
}

export class Circle extends Arc {
  constructor(centre, radius, opts = {}) {
    super(centre, radius, 0, TAU, opts);
    this.closedShape = true;
  }
}

export class Dot extends VMobject {
  constructor(centre = [0, 0], { radius = 0.08, color = INK } = {}) {
    super();
    this.c = [...centre];
    this.r = radius;
    this.fillColor = color;
    this.fillOpacity = 1;
    this.strokeWidth = 0;
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.r *= k; }
  boundsPoints() {
    return [[this.c[0] - this.r, this.c[1] - this.r], [this.c[0] + this.r, this.c[1] + this.r]];
  }

  drawSelf(r, alpha) {
    const { ctx } = r;
    ctx.beginPath();
    ctx.arc(this.c[0], this.c[1], this.r * clamp(this.drawRatio, 0, 1), 0, TAU);
    r.fill(this, alpha);
    r.stroke(this, alpha);
  }

  get pos() { return this.c; }
}

// --- polygons ---------------------------------------------------------------

/** Open polyline (a Polygon that is not closed). */
export class Polyline extends VMobject {
  constructor(pts, { color = INK, width = 4 } = {}) {
    super();
    this.pts = pts.map((p) => [...p]);
    this.strokeColor = color;
    this.strokeWidth = width;
  }

  mapPoints(fn) { this.pts = this.pts.map(fn); }
  outline() { return [{ pts: this.pts, closed: false }]; }
}

/** The little square marking a right angle at `vertex` (manim's RightAngle). */
export function rightAngle(vertex, dirA, dirB, {
  length = 0.4, color = INK, width = 3,
} = {}) {
  const a = mul(normalize(dirA), length), b = mul(normalize(dirB), length);
  return new Polyline([add(vertex, a), add(vertex, add(a, b)), add(vertex, b)],
    { color, width });
}

export class Polygon extends VMobject {
  constructor(pts, {
    color = INK, width = 4, fill = null, fillOpacity = 0,
  } = {}) {
    super();
    this.pts = pts.map((p) => [...p]);
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = fill;
    this.fillOpacity = fillOpacity;
  }

  mapPoints(fn) { this.pts = this.pts.map(fn); }
  outline() { return [{ pts: this.pts, closed: true }]; }
}

/**
 * Comic-book splash: a spiky closed ring, for putting BEHIND something that
 * has to catch the eye -- a value on an arrow, the end of a story.
 *
 * `wobble: 0` (the default use) gives a plain regular star; anything above
 * roughs the spikes up. It is a fixed function of the spike's index, never
 * random: a scene is replayed from its start on every slide jump, and a shape
 * that changed each time would flicker.
 */
export function burst(centre, rx, ry, {
  spikes = 11, inner = 0.56, phase = 0.35, wobble = 0,
  color = INK, width = 0, fill = null, fillOpacity = 1,
} = {}) {
  const n = spikes * 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU;
    const k = (i % 2 ? inner : 1) * (1 + wobble * Math.sin(i * 2.3999632));
    pts.push([centre[0] + rx * k * Math.cos(a), centre[1] + ry * k * Math.sin(a)]);
  }
  return new Polygon(pts, { color, width, fill, fillOpacity });
}

export class Rectangle extends VMobject {
  constructor({
    width: w = 2, height: h = 1, centre = [0, 0], corner = 0,
    color = INK, strokeWidth = 4, fill = null, fillOpacity = 0,
  } = {}) {
    super();
    this.c = [...centre];
    this.w = w;
    this.h = h;
    this.rad = corner;         // corner radius ('corner' is a Mobject method)
    this.angle = 0;
    this.strokeColor = color;
    this.strokeWidth = strokeWidth;
    this.fillColor = fill;
    this.fillOpacity = fillOpacity;
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.w *= k; this.h *= k; this.rad *= k; }
  onRotate(a) { this.angle += a; }

  outline() {
    const { w, h } = this;
    const rad = Math.min(this.rad, w / 2, h / 2);
    const pts = [];
    const push = (x, y) => pts.push(add(this.c, rot([x, y], this.angle)));
    const quarter = (cx, cy, a0) => {
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (PI / 2) * (i / n);
        push(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
      }
    };
    const x = w / 2, y = h / 2;
    if (rad <= 1e-6) {
      push(x, y); push(-x, y); push(-x, -y); push(x, -y);
    } else {
      quarter(x - rad, y - rad, 0);
      quarter(-x + rad, y - rad, PI / 2);
      quarter(-x + rad, -y + rad, PI);
      quarter(x - rad, -y + rad, -PI / 2);
    }
    return [{ pts, closed: true }];
  }
}

export const RoundedRectangle = (opts) => new Rectangle({ corner: 0.15, ...opts });

/** Box drawn around an existing mobject (manim's SurroundingRectangle). */
export function surround(mob, { buff = 0.1, ...opts } = {}) {
  const b = mob.bbox();
  return new Rectangle({
    centre: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2],
    width: b.x1 - b.x0 + 2 * buff,
    height: b.y1 - b.y0 + 2 * buff,
    ...opts,
  });
}

// --- curves -----------------------------------------------------------------

export class ParametricCurve extends VMobject {
  constructor(fn, [t0, t1], {
    color = INK, width = 4, samples = 200, dashes = 0,
  } = {}) {
    super();
    this.pts = [];
    for (let i = 0; i <= samples; i++) this.pts.push(fn(t0 + ((t1 - t0) * i) / samples));
    this.strokeColor = color;
    this.strokeWidth = width;
    this.dashes = dashes;
  }

  mapPoints(fn) { this.pts = this.pts.map(fn); }
  outline() { return [{ pts: this.pts, closed: false }]; }

  drawSelf(r, alpha) {
    if (this.dashes) {
      let L = 0;
      for (let i = 1; i < this.pts.length; i++) L += norm(sub(this.pts[i], this.pts[i - 1]));
      const period = L / this.dashes;
      this.strokeDash = [period * 0.55, period * 0.45];
    }
    super.drawSelf(r, alpha);
  }
}

/** Arc from `start` to `end`, bulging by `angle`, with an arrow head. */
export class CurvedArrow extends VMobject {
  constructor(start, end, {
    angle = PI / 2, color = INK, width = 4, tipLength = 0.2,
  } = {}) {
    super();
    this.p1 = [...start];
    this.p2 = [...end];
    this.bulge = angle;
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = color;
    this.fillOpacity = 1;
    this.tipLength = tipLength;
  }

  mapPoints(fn) { this.p1 = fn(this.p1); this.p2 = fn(this.p2); }
  onScale(k) { this.tipLength *= k; }

  arcPoints(ratio = 1) {
    const chord = sub(this.p2, this.p1);
    const L = norm(chord);
    if (L < 1e-9) return [this.p1];
    const a = this.bulge;
    if (Math.abs(a) < 1e-6) return [this.p1, this.p2];
    const r = L / (2 * Math.sin(a / 2));
    const mid = mul(add(this.p1, this.p2), 0.5);
    const h = r * Math.cos(a / 2);
    const c = add(mid, mul(normalize(perp(chord)), h));
    const a0 = angleOf(sub(this.p1, c));
    const n = Math.max(8, Math.ceil((Math.abs(a) / TAU) * 96));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(add(c, fromAngle(a0 + a * ratio * (i / n), Math.abs(r))));
    return pts;
  }

  /** The arc, stopping just inside the head so the line does not stick out
      past the point (the head is drawn separately). */
  shaft(ratio = 1) {
    const pts = this.arcPoints(ratio);
    let left = this.tipLength * 0.85;
    while (pts.length > 2 && left > 0) {
      const d = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
      if (d > left) {
        const t = 1 - left / d;
        pts[pts.length - 1] = lerpV(pts[pts.length - 2], pts[pts.length - 1], t);
        break;
      }
      pts.pop();
      left -= d;
    }
    return pts;
  }

  outline() {
    const pts = this.arcPoints();
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last;
    const u = normalize(sub(last, prev));
    return [{ pts: this.shaft(), closed: false },
            { pts: tipPts(last, u, this.tipLength), closed: true }];
  }

  drawSelf(r, alpha) {
    const ratio = clamp(this.drawRatio, 0, 1);
    const full = this.arcPoints(ratio);
    const pts = ratio >= 1 ? this.shaft() : full;
    const { ctx } = r;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    r.stroke(this, alpha);
    if (ratio >= 1 && full.length > 1) {
      const u = normalize(sub(full[full.length - 1], full[full.length - 2]));
      ctx.beginPath();
      tipPts(full[full.length - 1], u, this.tipLength)
        .forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      r.fill(this, alpha);
    }
  }
}

// --- convenience factories --------------------------------------------------
// (Shapes are built with `new`: a lowercase `dot` would collide with the dot
// product of math.js in the barrel.)

export const rect = (o) => new Rectangle(o);
export const arc = (c, r, a0, da, o) => new Arc(c, r, a0, da, o);
