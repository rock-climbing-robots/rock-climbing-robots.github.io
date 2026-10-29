// 2D drawing helpers shared by the lectures: frames, arrows, angles.
//
// Several chapters draw the same picture (a frame and its basis, a vector, an
// angle whose sign must be readable): it is built here once, so that a
// student recognises it from one chapter to the next.

import { Group, group } from "./mobject.js";
import { Arrow, DoubleArrow, Dot, Line, DashedLine, CurvedArrow, ParametricCurve } from "./shapes.js";
import { math } from "./text.js";
import { X_COLOR, Y_COLOR, Z_COLOR, FG, MUTED } from "./theme.js";
import { PI, add, sub, mul, norm, normalize, perp, mid, fromAngle } from "./math.js";
import { redraw } from "./scene.js";
import { Dot3D, Arrow3D, group3 } from "./three.js";
import { FG as INK } from "./palette.js";

export const dirAt = (angle, radius = 1) => fromAngle(angle, radius);

/** Curved arrow sweeping from a1 to a2: the sweep direction, hence the sign
    of the angle, must be readable (course convention). */
export function angleArc(vertex, a1, a2, radius, color, {
  label = null, size = 32, labOffset = 0.38, width = 4,
} = {}) {
  const arc = new CurvedArrow(add(vertex, dirAt(a1, radius)),
    add(vertex, dirAt(a2, radius)),
    { angle: a2 - a1, color, width, tipLength: 0.18 });
  if (!label) return arc;
  const lab = math(label, { size, color })
    .moveTo(add(vertex, dirAt((a1 + a2) / 2, radius + labOffset)));
  return group(arc, lab);
}

/**
 * A 2D frame drawn at `origin`, turned by `angle`: origin dot, the two basis
 * arrows and their names, and optionally the names of the origin point and of
 * the frame itself. Returned as an object so a scene can animate the pieces
 * separately.
 */
export function frame2d(origin, angle, unit, {
  names = ["\\vec i", "\\vec j"], point = null, frame = null,
  xcol = X_COLOR, ycol = Y_COLOR, off = 0.34, pointAt = null, frameAt = null,
  width = 5, dotColor = FG, sideI = -1, sideJ = 1,
} = {}) {
  const vi = new Arrow(origin, add(origin, dirAt(angle, unit)),
    { buff: 0, color: xcol, width, tipLength: 0.22 });
  const vj = new Arrow(origin, add(origin, dirAt(angle + PI / 2, unit)),
    { buff: 0, color: ycol, width, tipLength: 0.22 });
  const li = math(names[0], { size: 34, color: xcol }).moveTo(
    add(add(origin, dirAt(angle, unit * 0.55)), dirAt(angle + sideI * PI / 2, off)));
  const lj = math(names[1], { size: 34, color: ycol }).moveTo(
    add(add(origin, dirAt(angle + PI / 2, unit * 0.55)),
        dirAt(angle + PI / 2 + sideJ * PI / 2, off)));
  const dot = new Dot(origin, { radius: 0.075, color: dotColor }).setZ(2);
  const out = { origin: [...origin], angle, unit, i: vi, j: vj, li, lj, dot,
                basis: group(vi, vj, li, lj) };
  const parts = [dot, vi, vj, li, lj];
  if (point) {
    out.lp = math(point, { size: 38 })
      .moveTo(add(origin, pointAt || [-0.38, 0.32]));
    parts.push(out.lp);
  }
  if (frame) {
    out.lf = math(frame, { size: 32, color: MUTED })
      .moveTo(add(origin, frameAt || [-0.45, -0.48]));
    parts.push(out.lf);
  }
  out.all = group(...parts);
  return out;
}

// Colour of a frame origin, as in the course figures.
export const ORIGIN_DOT = "#D3A4E0";

/**
 * A frame in space: the origin dot, the three basis arrows and their names.
 *
 * `place` maps the frame's own coordinates onto the world, so a scene moves
 * and turns the frame by animating trackers rather than by mutating anything
 * — and every piece is rebuilt from that function on each frame. The names
 * are flat 2D text put at a projected point, so they stay upright whatever
 * the frame does.
 */
export function frame3d(cam, {
  place = (p) => p, unit = 1.2, width = 5, tipLength = 0.2,
  names = ["\\vec i", "\\vec j", "\\vec k"], size = 30, labOff = 0.34,
  // Extra screen offset per axis name, for the cases where "just past the
  // tip" is not where the name belongs.
  labShift = [[0, 0], [0, 0], [0, 0]],
  colors = [X_COLOR, Y_COLOR, Z_COLOR], dotColor = ORIGIN_DOT, dotRadius = 0.11,
  point = null, pointAt = [-0.38, 0.12], frame = null, frameAt = [-0.42, -0.45],
} = {}) {
  const O = () => cam.project(place([0, 0, 0]));
  const axis = (k) => [0, 1, 2].map((i) => (i === k ? unit : 0));
  const arrow = (k) => redraw(() => new Arrow3D(cam, place([0, 0, 0]), place(axis(k)),
    { color: colors[k], width, tipLength }));
  // Just beyond the tip, on the line from the origin: never on the arrow.
  const label = (k) => redraw(() => {
    const o = O(), t = cam.project(place(axis(k)));
    const d = sub(t, o), n = norm(d) || 1;
    return math(names[k], { size, color: colors[k] })
      .moveTo(add(add(t, mul(d, labOff / n)), labShift[k]));
  });
  const out = {
    place,
    dot: redraw(() => new Dot3D(cam, place([0, 0, 0]), { radius: dotRadius, color: dotColor })),
    i: arrow(0), j: arrow(1), k: arrow(2),
    li: label(0), lj: label(1), lk: label(2),
  };
  out.basis = group(out.i, out.j, out.k, out.li, out.lj, out.lk);
  const parts = [out.dot, out.i, out.j, out.k, out.li, out.lj, out.lk];
  if (point) {
    out.lp = redraw(() => math(point, { size: size + 4 }).moveTo(add(O(), pointAt)));
    parts.push(out.lp);
  }
  if (frame) {
    out.lf = redraw(() => math(frame, { size, color: MUTED }).moveTo(add(O(), frameAt)));
    parts.push(out.lf);
  }
  out.all = group(...parts);
  return out;
}

/** Arrow from a to b, its name written alongside. */
export function stepArrow(a, b, color, {
  label = null, side = 1, off = 0.34, size = 30, width = 5, at = 0.5,
} = {}) {
  const arr = new Arrow(a, b, { buff: 0, color, width, tipLength: 0.2 });
  if (!label) return group(arr);
  const d = sub(b, a);
  const n = mul([-d[1], d[0]], (off * side) / norm(d));
  return group(arr, math(label, { size, color })
    .moveTo(add(add(a, mul(d, at)), n)));
}

export const dashedTo = (a, b, { color = MUTED, width = 2.5 } = {}) =>
  new DashedLine(a, b, { dashLength: 0.11, dashRatio: 0.55, width, color });

/**
 * A pair of axes to plot a function on (manim's `Axes`): `ax.at(x, y)` maps
 * data coordinates to the slide, `ax.plot(fn, [x0, x1])` draws a curve.
 */
export function axes2d({
  xRange = [-1, 1], yRange = [-1, 1], width = 5, height = 2.5,
  centre = [0, 0], color = MUTED, strokeWidth = 2,
} = {}) {
  const sx = width / (xRange[1] - xRange[0]);
  const sy = height / (yRange[1] - yRange[0]);
  const ox = centre[0] - ((xRange[0] + xRange[1]) / 2) * sx;
  const oy = centre[1] - ((yRange[0] + yRange[1]) / 2) * sy;
  const at = (x, y) => [ox + x * sx, oy + y * sy];
  const g = group(
    new Line(at(xRange[0], 0), at(xRange[1], 0), { color, width: strokeWidth }),
    new Line(at(0, yRange[0]), at(0, yRange[1]), { color, width: strokeWidth }),
  );
  g.at = at;
  g.plot = (fn, [a, b], opts = {}) => new ParametricCurve(
    (t) => at(t, fn(t)), [a, b], { color: INK, width: 3, samples: 160, ...opts });
  return g;
}

/** Bracketed coordinates, small enough to sit inside a sentence. */
export const smat = (...rows) =>
  `\\left[\\begin{smallmatrix} ${rows.join(" \\\\ ")} \\end{smallmatrix}\\right]`;

/**
 * A dimension line: the length of the segment p-q, drawn beside it the way a
 * technical drawing does -- two extension lines, a double arrow between them,
 * and the name of the length. It stands on the LEFT of p->q (swap the two
 * ends, or give a negative offset, for the other side).
 */
export function dimension(p, q, label, { offset = 0.45, color = MUTED, size = 36 } = {}) {
  const n = mul(normalize(perp(sub(q, p))), offset);
  const arrow = new DoubleArrow(add(p, n), add(q, n),
    { color, width: 2, tipLength: 0.15, buff: 0 });
  const ext = new Group(
    new Line(p, add(p, mul(n, 1.2)), { width: 1.5, color }),
    new Line(q, add(q, mul(n, 1.2)), { width: 1.5, color }),
  );
  const lab = math(label, { size, color })
    .moveTo(add(add(mid(p, q), n), mul(normalize(n), 0.3)));
  return new Group(ext, arrow, lab);
}
