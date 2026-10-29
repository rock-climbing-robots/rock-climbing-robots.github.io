// A backdrop drawn behind every slide.
//
// `?bg=poly` puts a low-poly mesh there: a handful of very large triangles,
// white, at an opacity low enough to read as texture rather than as content.
// The vertices drift on their own periods, so the mesh breathes instead of
// looping; nothing is pre-computed, it is a few dozen triangles per frame.

import { FRAME_WIDTH, FRAME_HEIGHT } from "./math.js";
import { LIGHT } from "./palette.js";

// The facets are a step in value over the ground: white on the black
// stage, black on the light one.
const INK_RGB = LIGHT ? "0,0,0" : "255,255,255";

/** Small deterministic PRNG: the same mesh on every reload. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A jittered grid, split into triangles. A real Delaunay would not read any
 * differently at this size, and this way the mesh can never fold over
 * itself: each vertex stays inside its own cell.
 */
export function polyBackdrop({
  cols = 5, rows = 3, over = 1.6, seed = 20260904,
  drift = 0.5, jitter = 0.42,
  // Fills only: the facets read through the step in value alone, which is
  // why the range is wider than it would be with edges to carry the shape.
  // Nothing is ever stroked — a translucent outline in the SAME colour as
  // the fill still adds its alpha along the edge, and that reads as exactly
  // the white contour it was meant to hide.
  // Black on a light ground carries further than white on a black one at
  // the same alpha: the light theme takes about two thirds.
  fill = LIGHT ? [0.006, 0.030] : [0.008, 0.048],
} = {}) {
  const rand = rng(seed);
  const W = FRAME_WIDTH + 2 * over, H = FRAME_HEIGHT + 2 * over;
  const x0 = -W / 2, y0 = -H / 2;
  const dx = W / cols, dy = H / rows;

  // One vertex per grid node: a rest position, a jitter, and its own way of
  // drifting around it.
  const nodes = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      nodes.push({
        x: x0 + i * dx + (rand() - 0.5) * 2 * jitter * dx,
        y: y0 + j * dy + (rand() - 0.5) * 2 * jitter * dy,
        ax: drift * (0.5 + rand()), ay: drift * (0.5 + rand()),
        // Periods of one to three minutes: the mesh should be noticed only
        // by someone who looks for it.
        wx: 0.006 + rand() * 0.012, wy: 0.006 + rand() * 0.012,
        px: rand() * Math.PI * 2, py: rand() * Math.PI * 2,
      });
    }
  }
  const at = (i, j) => nodes[j * (cols + 1) + i];

  // Two triangles per cell, each with its own slow breathing of opacity.
  const faces = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const flip = rand() < 0.5;
      const pair = flip ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const tri of pair) {
        faces.push({ tri, w: 0.004 + rand() * 0.010, p: rand() * Math.PI * 2 });
      }
    }
  }

  let t = 0;
  return (r, dt = 0) => {
    t += dt;
    const { ctx } = r;
    for (const n of nodes) {
      n.cx = n.x + n.ax * Math.sin(t * n.wx * Math.PI * 2 + n.px);
      n.cy = n.y + n.ay * Math.sin(t * n.wy * Math.PI * 2 + n.py);
    }
    ctx.save();
    for (const f of faces) {
      const [a, b, c] = f.tri;
      ctx.beginPath();
      ctx.moveTo(a.cx, a.cy);
      ctx.lineTo(b.cx, b.cy);
      ctx.lineTo(c.cx, c.cy);
      ctx.closePath();
      const k = 0.5 + 0.5 * Math.sin(t * f.w * Math.PI * 2 + f.p);
      ctx.fillStyle = `rgba(${INK_RGB},${(fill[0] + (fill[1] - fill[0]) * k).toFixed(4)})`;
      ctx.fill();
    }
    ctx.restore();
  };
}

/** The backdrop named by `?bg=`. The low-poly mesh is the default; `none`
    (or `off`) turns it off. */
export function makeBackdrop(name) {
  if (name === "none" || name === "off") return null;
  return polyBackdrop();
}
