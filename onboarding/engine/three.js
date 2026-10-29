// A thin 3D layer: a camera and a few primitives that project themselves onto
// the 2D canvas at draw time.
//
// Nothing here is a renderer in its own right — a 3D mobject computes where
// its points land on the slide and then draws like any other shape, so 2D and
// 3D objects mix freely (a formula written beside a rotating frame is simply
// a 2D mobject: manim's `add_fixed_in_frame_mobjects` needs no equivalent).

import { Mobject, Group } from "./mobject.js";
import { VMobject, Arrow, Dot } from "./shapes.js";
import { Value } from "./anim.js";
import { PI, lerp } from "./math.js";
import { FG as INK, MESH } from "./palette.js";

export const v3 = (x, y, z) => [x, y, z];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const mid3 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
export function normalize3(a) {
  const n = norm3(a);
  return n < 1e-12 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
}
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Turn `p` by `angle` around `axis`, about `about` (Rodrigues). */
export function rotate3(p, angle, axis = [0, 0, 1], about = [0, 0, 0]) {
  const k = normalize3(axis);
  const v = sub3(p, about);
  const c = Math.cos(angle), s = Math.sin(angle);
  const kv = cross3(k, v), kd = dot3(k, v);
  return add3(about, [
    v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
  ]);
}

/**
 * manim's ThreeDCamera, orthographic. `phi` is the tilt away from the z axis
 * and `theta` the azimuth; the defaults (phi = 0, theta = -90 degrees) look
 * straight down at the xy plane, where the projection is the identity — a 3D
 * figure then looks exactly like the 2D one.
 */
export class Camera3D {
  constructor({ phi = 0, theta = -PI / 2, shift = [0, 0] } = {}) {
    this.phi = new Value(phi);
    this.theta = new Value(theta);
    this.shift = shift;         // where the figure sits on the slide
  }

  /** Screen basis: `u` to the right, `v` up, `w` towards the viewer. */
  basis() {
    const phi = this.phi.get(), theta = this.theta.get();
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    return {
      u: [-st, ct, 0],
      v: [-cp * ct, -cp * st, sp],
      w: [sp * ct, sp * st, cp],
    };
  }

  project(p) {
    const { u, v } = this.basis();
    return [dot3(p, u) + this.shift[0], dot3(p, v) + this.shift[1]];
  }

  /** Distance towards the viewer: bigger is nearer, for depth sorting. */
  depth(p) { return dot3(p, this.basis().w); }
}

// --- the 3D mobjects --------------------------------------------------------

/** Base class: owns 3D points, and draws their projection. */
export class Mobject3D extends VMobject {
  constructor(cam) {
    super();
    this.cam = cam;
  }

  /** Points, in 3D, that this mobject is made of. */
  points3() { return []; }

  /** Mean depth, for painter's-algorithm sorting. */
  depth() {
    const ps = this.points3();
    if (!ps.length) return 0;
    return ps.reduce((d, p) => d + this.cam.depth(p), 0) / ps.length;
  }
}

export class Dot3D extends Mobject3D {
  constructor(cam, p, { radius = 0.08, color = INK } = {}) {
    super(cam);
    this.p = [...p];
    this.r = radius;
    this.fillColor = color;
    this.fillOpacity = 1;
    this.strokeWidth = 0;
  }
  points3() { return [this.p]; }
  boundsPoints() {
    const c = this.cam.project(this.p);
    return [[c[0] - this.r, c[1] - this.r], [c[0] + this.r, c[1] + this.r]];
  }
  drawSelf(r, alpha) {
    const c = this.cam.project(this.p);
    r.ctx.beginPath();
    r.ctx.arc(c[0], c[1], this.r, 0, 2 * PI);
    r.fill(this, alpha);
  }
}

export class Line3D extends Mobject3D {
  constructor(cam, a, b, { color = INK, width = 4, dashLength = 0 } = {}) {
    super(cam);
    this.a = [...a];
    this.b = [...b];
    this.strokeColor = color;
    this.strokeWidth = width;
    this.dashLength = dashLength;    // > 0 for a dashed segment
  }
  points3() { return [this.a, this.b]; }
  outline() {
    return [{ pts: [this.cam.project(this.a), this.cam.project(this.b)], closed: false }];
  }
  drawSelf(r, alpha) {
    if (this.dashLength) {
      const [p, q] = this.outline()[0].pts;
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const n = Math.max(1, Math.round(L / (this.dashLength / 0.55)));
      const period = L / n;
      this.strokeDash = [period * 0.55, period * 0.45];
    }
    super.drawSelf(r, alpha);
  }
}

export class Arrow3D extends Mobject3D {
  constructor(cam, a, b, { color = INK, width = 4, tipLength = 0.22 } = {}) {
    super(cam);
    this.a = [...a];
    this.b = [...b];
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = color;
    this.fillOpacity = 1;
    this.tipLength = tipLength;
  }
  points3() { return [this.a, this.b]; }
  flat() {
    return new Arrow(this.cam.project(this.a), this.cam.project(this.b), {
      color: this.strokeColor, width: this.strokeWidth,
      tipLength: this.tipLength, buff: 0,
    });
  }
  outline() { return this.flat().outline(); }
  drawSelf(r, alpha) {
    const a = this.flat();
    a.opacity = this.opacity;
    a.drawRatio = this.drawRatio;
    a.drawSelf(r, alpha);
  }
}

/** Flat polygon in space (a face of a surface, a slice of a sphere...). */
export class Poly3D extends Mobject3D {
  constructor(cam, pts, {
    color = null, width = 0, fill = null, fillOpacity = 1, closed = true,
  } = {}) {
    super(cam);
    this.pts3 = pts.map((p) => [...p]);
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = fill;
    this.fillOpacity = fillOpacity;
    this.closedShape = closed;
  }
  points3() { return this.pts3; }
  outline() {
    return [{ pts: this.pts3.map((p) => this.cam.project(p)), closed: this.closedShape }];
  }
}

/** Circle in space, given by its centre, radius and plane (two axes). */
export class Circle3D extends Mobject3D {
  constructor(cam, centre, radius, uAxis, vAxis, {
    color = INK, width = 3, from = 0, to = 2 * PI, samples = 96,
    fill = null, fillOpacity = 0,
  } = {}) {
    super(cam);
    this.c = [...centre];
    this.r = radius;
    this.u = normalize3(uAxis);
    this.v = normalize3(vAxis);
    this.from = from;
    this.to = to;
    this.samples = samples;
    this.strokeColor = color;
    this.strokeWidth = width;
    this.fillColor = fill;
    this.fillOpacity = fillOpacity;
  }
  at(t) {
    return add3(this.c, add3(mul3(this.u, this.r * Math.cos(t)),
                             mul3(this.v, this.r * Math.sin(t))));
  }
  points3() {
    const out = [];
    for (let i = 0; i <= this.samples; i++) {
      out.push(this.at(this.from + ((this.to - this.from) * i) / this.samples));
    }
    return out;
  }
  outline() {
    return [{ pts: this.points3().map((p) => this.cam.project(p)), closed: false }];
  }
}

/**
 * Rotation (angle and axis) taking the pair (srcA, srcB) onto (dstA, dstB).
 *
 * Used to turn a figure until one of its planes faces the camera: the plane
 * normal goes onto the viewing direction, and a chosen direction of the plane
 * onto the top of the screen.
 */
export function rotationBetween(srcA, srcB, dstA, dstB) {
  const basis = (a, b) => {
    const u = normalize3(a);
    const v = normalize3(sub3(b, mul3(u, dot3(b, u))));
    const w = cross3(u, v);
    return [u, v, w];                       // columns
  };
  const A = basis(srcA, srcB), B = basis(dstA, dstB);
  // M = B * A^T, with the bases held as columns.
  const m = [0, 1, 2].map((i) => [0, 1, 2].map((j) =>
    B[0][i] * A[0][j] + B[1][i] * A[1][j] + B[2][i] * A[2][j]));
  const trace = m[0][0] + m[1][1] + m[2][2];
  const angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));
  const sin = Math.sin(angle);
  if (Math.abs(sin) < 1e-9) return { angle: 0, axis: [0, 0, 1] };
  return {
    angle,
    axis: normalize3([m[2][1] - m[1][2], m[0][2] - m[2][0], m[1][0] - m[0][1]]),
  };
}

/** World direction that points to the right of the screen / to its top. */
export const screenRight = (cam) => cam.basis().u;
export const screenUp = (cam) => cam.basis().v;
export const viewDir = (cam) => cam.basis().w;

/** World translation that moves a figure by (dx, dy) on the slide. */
export const screenOffset = (cam, [dx, dy]) => {
  const { u, v } = cam.basis();
  return add3(mul3(u, dx), mul3(v, dy));
};

/**
 * Arc of a great circle, from direction `a` to direction `b` on a sphere of
 * radius `r`, with an optional arrow head at its end. Longitudes, latitudes
 * and the shortest path between two cities are all of this shape.
 */
export function arc3(cam, centre, r, a, b, {
  color = INK, width = 4, tip = 0, samples = 64, from = 0, to = 1,
} = {}) {
  const u = normalize3(a);
  let w = sub3(normalize3(b), mul3(u, dot3(normalize3(b), u)));
  w = normalize3(w);
  const total = Math.acos(Math.max(-1, Math.min(1, dot3(u, normalize3(b)))));
  const at = (t) => add3(centre, mul3(add3(mul3(u, Math.cos(t * total)),
                                           mul3(w, Math.sin(t * total))), r));
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(at(from + (to - from) * (i / samples)));
  const g = new Group3D(new Poly3D(cam, pts, { color, width, closed: false }));
  if (tip) {
    // The head is a flat triangle in the plane of the arc, at its end.
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const dir = normalize3(sub3(end, prev));
    const side = normalize3(cross3(dir, sub3(end, centre)));
    g.add(new Poly3D(cam, [
      end,
      add3(sub3(end, mul3(dir, tip)), mul3(side, tip * 0.42)),
      sub3(sub3(end, mul3(dir, tip)), mul3(side, tip * 0.42)),
    ], { fill: color, fillOpacity: 1 }));
  }
  return g;
}

/**
 * Arc turning around `axis`, with an arrow head: whenever the SENSE of a
 * rotation matters (and in 3D it always does), it has to be readable.
 * `from` and `to` are angles in the plane perpendicular to the axis.
 */
export function turn3(cam, centre, axis, r, {
  color = INK, width = 3, tip = 0.16, samples = 48,
  from = 0, to = 1.55 * PI, dash = 0,
} = {}) {
  const w = normalize3(axis);
  // Any two directions of the plane, the second turning towards the first by
  // the right-hand rule, so a growing angle turns the direct way.
  const seed = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize3(sub3(seed, mul3(w, dot3(seed, w))));
  const v = cross3(w, u);
  const at = (t) => add3(centre, mul3(add3(mul3(u, Math.cos(t)), mul3(v, Math.sin(t))), r));
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(at(from + (to - from) * (i / samples)));
  const line = new Poly3D(cam, pts, { color, width, closed: false });
  if (dash) line.strokeDash = [dash, dash * 0.8];
  const g = new Group3D(line);
  if (tip) {
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const dir = normalize3(sub3(end, prev));
    const side = normalize3(cross3(dir, w));
    g.add(new Poly3D(cam, [
      end,
      add3(sub3(end, mul3(dir, tip)), mul3(side, tip * 0.45)),
      sub3(sub3(end, mul3(dir, tip)), mul3(side, tip * 0.45)),
    ], { fill: color, fillOpacity: 1 }));
  }
  return g;
}

/**
 * Short cylinder around `axis`: the way a joint axis is drawn on a mechanism
 * diagram. Two rims, the body between them, and the two silhouette lines.
 */
export function cylinder3(cam, centre, axis, radius, height, {
  color = INK, width = 2.5, fill = null, fillOpacity = 0.18, samples = 48,
} = {}) {
  const w = normalize3(axis);
  const seed = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize3(sub3(seed, mul3(w, dot3(seed, w))));
  const v = cross3(w, u);
  const a = add3(centre, mul3(w, height / 2));
  const b = sub3(centre, mul3(w, height / 2));
  const rim = (c) => new Circle3D(cam, c, radius, u, v, { color, width, samples });
  const g = new Group3D(rim(a), rim(b));
  // The body, as a quad between the two rims on the silhouette.
  const side = normalize3(cross3(w, viewDir(cam)));
  const pts = [add3(a, mul3(side, radius)), add3(b, mul3(side, radius)),
               sub3(b, mul3(side, radius)), sub3(a, mul3(side, radius))];
  g.add(new Poly3D(cam, pts, { fill: fill || color, fillOpacity, color, width }));
  return g;
}

/** Faint wireframe sphere: meridians and parallels. */
export function sphereMesh(cam, r, {
  meridians = 12, parallels = 7, color = MESH, width = 1, centre = [0, 0, 0],
} = {}) {
  const g = new Group3D();
  for (let i = 0; i < meridians; i++) {
    const a = (i / meridians) * PI;
    g.add(new Circle3D(cam, centre, r, [Math.cos(a), Math.sin(a), 0], [0, 0, 1],
      { color, width }));
  }
  for (let j = 1; j < parallels; j++) {
    const b = -PI / 2 + (j / parallels) * PI;
    const rr = r * Math.cos(b);
    g.add(new Circle3D(cam, add3(centre, [0, 0, r * Math.sin(b)]), rr,
      [1, 0, 0], [0, 1, 0], { color, width }));
  }
  return g;
}

/**
 * A group of 3D mobjects, drawn back to front. Put 3D things in one of these
 * so that near objects hide far ones.
 */
export class Group3D extends Group {
  draw(r, alpha = 1) {
    const a = alpha * this.opacity;
    if (a <= 0.001) return;
    const kids = [...this.children].sort((p, q) => {
      const dz = (p.depth ? p.depth() : 0) - (q.depth ? q.depth() : 0);
      return dz || (p.zIndex || 0) - (q.zIndex || 0);
    });
    for (const c of kids) c.draw(r, a);
  }
}

export const group3 = (...m) => new Group3D(...m);
