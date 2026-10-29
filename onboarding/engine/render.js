// The canvas renderer: sets up a world coordinate system on a 16:9 canvas and
// hands mobjects a few primitives to draw with.
//
// World coordinates are manim's frame units (x right, y UP, origin centred),
// so the canvas transform is a flip: (x, y) -> (W/2 + s x, H/2 - s y).
// Stroke widths are given in manim units, where 1 = 0.01 frame unit.

import { FRAME_HEIGHT, FRAME_WIDTH } from "./math.js";
import { BG } from "./palette.js";

export const STROKE_UNIT = 0.01;   // one manim stroke_width in frame units

/** "#RRGGBB" (or "#RGB") with an alpha, as a canvas colour string. */
export function rgba(color, alpha = 1) {
  if (alpha >= 0.999) return color;
  const [r, g, b] = parseColor(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

const colorCache = new Map();

export function parseColor(color) {
  let c = colorCache.get(color);
  if (c) return c;
  let hex = color.trim();
  if (hex[0] === "#") hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
  c = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  colorCache.set(color, c);
  return c;
}

const hex2 = (x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0");

/** Blend two colours (used when interpolating mobjects). */
export function mixColor(a, b, t) {
  if (a === b || t <= 0) return a;
  if (t >= 1) return b;
  const ca = parseColor(a), cb = parseColor(b);
  return "#" + hex2(ca[0] + (cb[0] - ca[0]) * t)
             + hex2(ca[1] + (cb[1] - ca[1]) * t)
             + hex2(ca[2] + (cb[2] - ca[2]) * t);
}

// Frame hooks: an overlay drawn in HTML rather than on the canvas hides
// itself at the start of a frame and shows itself again if it was drawn.
// Both are handed the renderer: each canvas has its own layer.
const beginHooks = [], endHooks = [];
export const onBeginFrame = (fn) => beginHooks.push(fn);
export const onEndFrame = (fn) => endHooks.push(fn);

export class Renderer {
  /** `layer`: the HTML layer laid over THIS canvas (engine/overlay.js);
      none means the full-screen one of the slides. `view`: [x0, y0, x1, y1],
      the part of the world to show, the whole frame without it. */
  constructor(canvas, { background = BG, layer = null, view = null } = {}) {
    this.canvas = canvas;
    this.layer = layer;
    this.view = view;
    this.ctx = canvas.getContext("2d");
    this.background = background;
    this.unit = 1;     // pixels per frame unit (CSS pixels)
  }

  /** Match the canvas backing store to its CSS size and the pixel ratio. */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return false;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    // Fit the 16:9 frame inside the canvas (letterbox if the ratio differs),
    // or, with `view`, only that part of the world: a figure of the text
    // mode shows the illustration of a slide, not the whole slide.
    const v = this.view;
    const vw = v ? v[2] - v[0] : FRAME_WIDTH, vh = v ? v[3] - v[1] : FRAME_HEIGHT;
    const cx = v ? (v[0] + v[2]) / 2 : 0, cy = v ? (v[1] + v[3]) / 2 : 0;
    this.unit = Math.min(w / vw, h / vh);
    this.dpr = dpr;
    this.cssW = w;
    this.cssH = h;
    // Device-space mapping, used by anything that must draw at real pixel
    // sizes (text, glyph outlines): device = (OX + S x, OY - S y).
    this.S = this.unit * dpr;
    this.OX = (w * dpr) / 2 - this.S * cx;
    this.OY = (h * dpr) / 2 + this.S * cy;
    return true;
  }

  /** A world point in CSS pixels from the canvas corner: where the HTML
      layer (engine/overlay.js) puts an element. */
  cssX(x) { return this.OX / this.dpr + this.unit * x; }
  cssY(y) { return this.OY / this.dpr - this.unit * y; }

  begin() {
    const { ctx } = this;
    for (const fn of beginHooks) fn(this);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.background) {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.setTransform(this.S, 0, 0, -this.S, this.OX, this.OY);
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
  }

  end() { for (const fn of endHooks) fn(this); }

  // --- primitives -----------------------------------------------------------

  /** Stroke the current path with a mobject's stroke style. */
  stroke(mob, alpha, path = null) {
    const { ctx } = this;
    if (!mob.strokeColor || !mob.strokeWidth) return;
    const op = (mob.strokeOpacity === undefined ? 1 : mob.strokeOpacity) * alpha;
    if (op <= 0.001) return;
    ctx.strokeStyle = rgba(mob.strokeColor, op);
    ctx.lineWidth = mob.strokeWidth * STROKE_UNIT;
    if (mob.strokeDash) ctx.setLineDash(mob.strokeDash);
    path ? ctx.stroke(path) : ctx.stroke();
    if (mob.strokeDash) ctx.setLineDash([]);
  }

  fill(mob, alpha, path = null) {
    const { ctx } = this;
    if (!mob.fillColor || !mob.fillOpacity) return;
    const op = mob.fillOpacity * alpha;
    if (op <= 0.001) return;
    ctx.fillStyle = rgba(mob.fillColor, op);
    path ? ctx.fill(path) : ctx.fill();
  }

  /** World point to device pixels. */
  toDevice(p) { return [this.OX + this.S * p[0], this.OY - this.S * p[1]]; }

  /** Trace a polyline (open by default). */
  poly(points, close = false) {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (close) ctx.closePath();
  }
}
