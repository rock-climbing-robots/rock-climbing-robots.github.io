// SVG icons drawn on the canvas.
//
// The file is parsed once into a list of Path2D outlines (transforms baked
// in) and then behaves like any other mobject. The icons of the course are
// Tabler outlines: stroked, never filled.

import { Mobject } from "./mobject.js";
import { add, sub, rot, norm, angleOf } from "./math.js";
import { rgba } from "./render.js";
import { matrixTo, boxIn } from "./svgutil.js";
import { FG as INK } from "./palette.js";

const loaded = new Map();

/** Fetch and parse the icons; call once before building the scenes. */
export async function preloadIcons(names, base = "assets/icons/") {
  await Promise.all(names.map(async (name) => {
    if (loaded.has(name)) return;
    const text = await fetch(base + name).then((r) => r.text());
    loaded.set(name, parseSvg(text));
  }));
}

function parseSvg(source) {
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden";
  holder.innerHTML = source;
  document.body.appendChild(holder);
  const svg = holder.querySelector("svg");
  const paths = [];
  let box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const el of svg.querySelectorAll("path, line, circle, rect, polyline, polygon")) {
    const bb = el.getBBox();
    if (!bb.width && !bb.height) continue;
    const m = matrixTo(el, svg);
    const p = new Path2D();
    p.addPath(new Path2D(outlineOf(el)), m);
    paths.push(p);
    const ink = boxIn(el, svg, m);
    box = {
      x0: Math.min(box.x0, ink.x0), y0: Math.min(box.y0, ink.y0),
      x1: Math.max(box.x1, ink.x1), y1: Math.max(box.y1, ink.y1),
    };
  }
  document.body.removeChild(holder);
  return { paths, box };
}

function outlineOf(el) {
  const a = (n) => parseFloat(el.getAttribute(n) || 0);
  switch (el.tagName.toLowerCase()) {
    case "path": return el.getAttribute("d");
    case "line": return `M${a("x1")} ${a("y1")}L${a("x2")} ${a("y2")}`;
    case "circle": {
      const [cx, cy, r] = [a("cx"), a("cy"), a("r")];
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    }
    case "rect": return `M${a("x")} ${a("y")}h${a("width")}v${a("height")}h${-a("width")}Z`;
    default: {
      const pts = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      let d = "";
      for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? "L" : "M"}${pts[i]} ${pts[i + 1]}`;
      return d + (el.tagName.toLowerCase() === "polygon" ? "Z" : "");
    }
  }
}

/** An icon, scaled to `height` frame units and centred on the origin. */
export class Icon extends Mobject {
  constructor(name, { height = 0.5, color = INK, width = 2.5 } = {}) {
    super();
    const svg = loaded.get(name);
    if (!svg) throw new Error(`icon "${name}" was not preloaded`);
    this.paths = svg.paths;
    this.box = svg.box;
    this.strokeColor = color;
    this.strokeWidth = width;
    const k = height / (svg.box.y1 - svg.box.y0);
    this.o = [0, 0];
    this.h = [k, 0];
    this.moveTo([0, 0]);
  }

  get unit() { return norm(sub(this.h, this.o)); }
  get angle() { return angleOf(sub(this.h, this.o)); }
  mapPoints(fn) { this.o = fn(this.o); this.h = fn(this.h); }

  toWorld(p) {
    const k = this.unit;
    return add(this.o, rot([k * p[0], -k * p[1]], this.angle));
  }

  boundsPoints() {
    const b = this.box;
    return [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map((p) => this.toWorld(p));
  }

  drawSelf(r, alpha) {
    const { ctx } = r;
    const a = this.angle, c = Math.cos(a), s = Math.sin(a);
    const f = r.S * this.unit;
    ctx.save();
    ctx.setTransform(f * c, -f * s, f * s, f * c, r.OX + r.S * this.o[0], r.OY - r.S * this.o[1]);
    ctx.strokeStyle = rgba(this.strokeColor, alpha);
    ctx.lineWidth = (this.strokeWidth * 0.01) / this.unit;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ratio = this.drawRatio === undefined ? 1 : this.drawRatio;
    if (ratio < 1) {
      ctx.globalAlpha = ratio;
    }
    for (const p of this.paths) ctx.stroke(p);
    ctx.restore();
  }
}

export const icon = (name, opts) => new Icon(name, opts);
