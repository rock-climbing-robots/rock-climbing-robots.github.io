// Text and formulas.
//
// Both are "placed" mobjects: they own a local 2D frame (origin + a handle
// point that carries scale and rotation) and their content is laid out in
// that frame, y pointing DOWN. Sizes follow manim's `font_size` convention —
// the two calibration constants below are measured once at start-up so a
// `size: 30` here has exactly the height it has in the manim lectures.

import { Mobject, Group } from "./mobject.js";
import { add, sub, rot, norm, angleOf } from "./math.js";
import { typeset, xHeight } from "./mathjax.js";
import { rgba } from "./render.js";
import { FG as INK } from "./palette.js";
import { tr, trMath } from "./lang.js";

// manim yardsticks: heights, in frame units, at font_size 48.
const MANIM_TEXT_HXG = 0.594531;   // Text("Hxg")
const MANIM_MATH_X = 0.225654;     // MathTex("x")

let EM_PER_SIZE = 0.0133;   // frame units per font_size point, for Text
let MATH_PER_SIZE = 0.0002; // frame units per typeset unit, per font_size

/**
 * The body font of the slides. The course is set in Computer Modern (CMU
 * Serif), the same design as the maths MathJax draws, so a formula inside a
 * sentence is part of the sentence. `?font=lato` on the URL brings back the
 * manim look. The titles keep Lato either way (see theme.js).
 */
export const FONTS = {
  lato: {
    family: "Lato, sans-serif",
    weights: { light: 300, normal: 400, medium: 500, bold: 700 },
    faces: ["300 40px Lato", "400 40px Lato", "italic 300 40px Lato"],
  },
  cm: {
    family: '"CMU Serif", serif',
    // CMU has two weights only: the titles take the bold one.
    weights: { light: 500, normal: 500, medium: 700, bold: 700 },
    faces: ['500 40px "CMU Serif"', '700 40px "CMU Serif"',
            'italic 500 40px "CMU Serif"'],
  },
};
// Two ways of making prose and formulas the same SIZE as well as the same
// design, so a maths island stops looking smaller than its sentence:
// cm2 takes the prose em from the maths (the prose shrinks), cm3 takes the
// maths em from the prose (the formulas grow).
FONTS.cm2 = { ...FONTS.cm, matchMath: "text" };
FONTS.cm3 = { ...FONTS.cm, matchMath: "math" };

let CURRENT = FONTS.cm;
export let FONT = CURRENT.family;

/** Pick the body font. Must be called BEFORE calibrate(). */
export function setFont(name) {
  CURRENT = FONTS[name] || FONTS.cm;
  FONT = CURRENT.family;
  return CURRENT;
}

export const currentFont = () => CURRENT;

let measureCtx = null;
function measurer() {
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  return measureCtx;
}

/** Measure the font and MathJax so that sizes match manim's. */
export function calibrate() {
  const ctx = measurer();
  // Every font, not only the active one: a title can be set in another one
  // and must still have the height manim gave it.
  for (const f of Object.values(FONTS)) {
    ctx.font = `${f.weights.light} 100px ${f.family}`;
    const m = ctx.measureText("Hxg");
    const h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 100;
    f.emPerSize = MANIM_TEXT_HXG / 48 / h;
  }
  EM_PER_SIZE = CURRENT.emPerSize;
  MATH_PER_SIZE = MANIM_MATH_X / 48 / xHeight();
  // MathJax works in units of 1/1000 em, so 1000 units is one em.
  if (CURRENT.matchMath === "text") EM_PER_SIZE = 1000 * MATH_PER_SIZE;
  if (CURRENT.matchMath === "math") MATH_PER_SIZE = EM_PER_SIZE / 1000;
  CURRENT.emPerSize = EM_PER_SIZE;
}

/** The font a mobject is set in: the current one, or a named one — the
    titles stay in the font of the course whatever the body is set to. */
const fontOf = (name) => (name && FONTS[name]) || CURRENT;
const emOf = (f) => (f === CURRENT ? EM_PER_SIZE : (f.emPerSize || EM_PER_SIZE));

/** Local frame shared by Text and MathTex: `o` is the origin of the local
    (y-down) coordinates, `h` the handle giving unit length and rotation. */
class Placed extends Mobject {
  constructor(unit) {
    super();
    this.o = [0, 0];
    this.h = [unit, 0];
  }

  get unit() { return norm(sub(this.h, this.o)); }
  get angle() { return angleOf(sub(this.h, this.o)); }

  mapPoints(fn) { this.o = fn(this.o); this.h = fn(this.h); }

  /** Local (y-down) point to world. */
  toWorld(p) {
    const k = this.unit;
    return add(this.o, rot([k * p[0], -k * p[1]], this.angle));
  }

  localBounds() { return { x0: 0, y0: 0, x1: 0, y1: 0 }; }

  boundsPoints() {
    const b = this.localBounds();
    return [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map((p) => this.toWorld(p));
  }

  /** Device transform mapping local coordinates to canvas pixels. */
  deviceMatrix(r, scale = this.unit) {
    const a = this.angle, c = Math.cos(a), s = Math.sin(a);
    const S = r.S, f = S * scale;
    return [f * c, -f * s, f * s, f * c, r.OX + S * this.o[0], r.OY - S * this.o[1]];
  }

  /** Same, but WITHOUT any scaling: the origin and the rotation only. Text
      is drawn in this frame, at a real pixel font size, so the glyphs are
      hinted and crisp instead of being a scaled-up 1px font. */
  deviceFrame(r) {
    const a = this.angle, c = Math.cos(a), s = Math.sin(a);
    return [c, -s, s, c, r.OX + r.S * this.o[0], r.OY - r.S * this.o[1]];
  }
}

// --- Text -------------------------------------------------------------------

export class Text extends Placed {
  constructor(str, {
    size = 48, color = INK, weight = "light", lineSpacing = 0.3,
    italic = false, font = null,
  } = {}) {
    super(1);
    this.str = tr(str);
    this.size = size;
    this.font = fontOf(font);
    this.family = this.font.family;
    this.weight = this.font.weights[weight] || weight;
    this.style = italic ? "italic " : "";
    this.lineSpacing = lineSpacing;
    this.fillColor = color;
    this.fillOpacity = 1;
    this.h = [emOf(this.font) * size, 0];   // unit = one em, in frame units
    this.measure();
    this.moveTo([0, 0]);   // like manim, a fresh mobject sits at the centre
  }

  onScale(k) {}   // handled by the o/h pair

  get em() { return this.unit; }

  measure() {
    const ctx = measurer();
    ctx.font = `${this.style}${this.weight} 100px ${this.family}`;
    this.lines = String(this.str).split("\n").map((t) => {
      const m = ctx.measureText(t);
      return {
        text: t,
        w: m.width / 100,
        asc: m.actualBoundingBoxAscent / 100,
        desc: m.actualBoundingBoxDescent / 100,
      };
    });
    // manim's line pitch: font_size * (1 + line_spacing) / 96 frame units.
    this.pitch = (this.size * (1 + this.lineSpacing)) / 96 / (emOf(this.font) * this.size);
  }

  localBounds() {
    const last = this.lines.length - 1;
    return {
      x0: 0,
      x1: Math.max(...this.lines.map((l) => l.w)),
      y0: -this.lines[0].asc,
      y1: last * this.pitch + this.lines[last].desc,
    };
  }

  /** Per-character boxes of one line, for the writing animation. */
  charBoxes(line) {
    if (line.chars) return line.chars;
    const ctx = measurer();
    ctx.font = `${this.style}${this.weight} 100px ${this.family}`;
    const out = [];
    let prev = 0;
    for (let i = 1; i <= line.text.length; i++) {
      const w = ctx.measureText(line.text.slice(0, i)).width / 100;
      out.push({ ch: line.text[i - 1], x: prev, w: w - prev });
      prev = w;
    }
    line.chars = out;
    return out;
  }

  drawSelf(r, alpha) {
    const { ctx } = r;
    const m = this.deviceFrame(r);
    const F = r.S * this.em;      // pixels per em
    ctx.save();
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.font = `${this.style}${this.weight} ${F}px ${this.family}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = rgba(this.fillColor, alpha * this.fillOpacity);
    const write = this.writeAlpha;
    this.lines.forEach((line, i) => {
      const y = i * this.pitch * F;
      if (write === undefined) {
        ctx.fillText(line.text, 0, y);
        return;
      }
      // Writing: the line is wiped in character by character, outline first,
      // fill catching up. The WHOLE line is drawn every time, clipped to one
      // character's box: the glyphs therefore sit exactly where the finished
      // line puts them (drawing characters one by one loses the kerning and
      // makes the text jump when the animation ends).
      const boxes = this.charBoxes(line);
      const n = this.totalChars;
      let index = this.lineOffsets[i];
      for (const b of boxes) {
        const p = charProgress(write, index++, n);
        if (p <= 0) continue;
        const wipe = Math.min(1, p / 0.6);
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x * F, y - 1.4 * F, b.w * F * wipe, 2.4 * F);
        ctx.clip();
        if (p < 1) {
          ctx.strokeStyle = rgba(this.fillColor, alpha * Math.min(1, 2 * (1 - p)) * 0.9);
          ctx.lineWidth = Math.max(0.6, F * 0.02);
          ctx.strokeText(line.text, 0, y);
        }
        ctx.fillStyle = rgba(this.fillColor, alpha * this.fillOpacity * smoothIn(p));
        ctx.fillText(line.text, 0, y);
        ctx.restore();
      }
    });
    ctx.restore();
  }

  get totalChars() {
    return this.lines.reduce((n, l) => n + l.text.length, 0);
  }

  get lineOffsets() {
    const out = [];
    let n = 0;
    for (const l of this.lines) { out.push(n); n += l.text.length; }
    return out;
  }
}

const smoothIn = (p) => (p <= 0.35 ? 0 : Math.min(1, (p - 0.35) / 0.65));

function charProgress(alpha, i, n) {
  // Each character writes over a window; the windows overlap heavily so the
  // whole line is written in one gesture.
  const lag = 0.55;
  const total = 1 + (n - 1) * lag;
  const start = (i * lag) / total;
  const end = start + 1 / total;
  return Math.max(0, Math.min(1, (alpha - start) / (end - start)));
}

// --- MathTex ----------------------------------------------------------------

/** One \class{P<i>} group of a formula: its own mobject, so a formula can be
    written, coloured or positioned part by part (manim's `eq[1]`). */
export class MathPart extends Placed {
  constructor(glyphs, bbox, size, color) {
    super(MATH_PER_SIZE * size);
    this.glyphs = glyphs;
    this.box = bbox;
    this.size = size;
    this.fillColor = color;
    this.fillOpacity = 1;
  }

  localBounds() { return this.box; }

  drawSelf(r, alpha) {
    const { ctx } = r;
    const m = this.deviceMatrix(r);
    ctx.save();
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    const write = this.writeAlpha;
    const n = this.glyphs.length;
    const lineWidth = 0.02 / this.unit;   // ~0.02 frame units, whatever the size
    this.glyphs.forEach((g, i) => {
      const color = g.color || this.fillColor;
      // Stretchy pieces (brace and arrow extenders) are overdrawn inside a
      // nested viewport and must be clipped to it.
      if (g.clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(g.clip.x0, g.clip.y0, g.clip.x1 - g.clip.x0, g.clip.y1 - g.clip.y0);
        ctx.clip();
      }
      if (write === undefined) {
        ctx.fillStyle = rgba(color, alpha * this.fillOpacity);
        ctx.fill(g.path);
      } else {
        const p = charProgress(write, i, n);
        if (p > 0) {
          if (p < 1 && g.len > 0) {
            ctx.strokeStyle = rgba(color, alpha * Math.min(1, 2.2 * (1 - p)));
            ctx.lineWidth = lineWidth;
            ctx.setLineDash([g.len * Math.min(1, p / 0.55), g.len]);
            ctx.stroke(g.path);
            ctx.setLineDash([]);
          }
          ctx.fillStyle = rgba(color, alpha * this.fillOpacity * smoothIn(p));
          ctx.fill(g.path);
        }
      }
      if (g.clip) ctx.restore();
    });
    ctx.restore();
  }
}

/**
 * A formula. `tex` is a string, or an array of parts that become children
 * (`eq.children[1]`, or `eq.part(1)`), typeset together so the spacing is
 * the one LaTeX would produce.
 */
export class MathTex extends Mobject {
  constructor(tex, { size = 48, color = INK, template = null } = {}) {
    super();
    // Each part is looked up on its own: a translation must keep the cuts.
    const parts = (Array.isArray(tex) ? tex : [tex]).map(trMath);
    const wrapped = parts.map((p, i) => `\\class{P${i}}{${p}}`);
    // `template` places the parts inside a bigger expression (a matrix);
    // by default they simply follow one another.
    const src = template ? template(wrapped) : wrapped.join("");
    const { glyphs, parts: boxes } = typeset(src);
    this.size = size;
    this.tex = parts;
    for (let i = 0; i < parts.length; i++) {
      const gs = glyphs.filter((g) => g.part === i);
      const box = boxes[i] || { x0: 0, y0: 0, x1: 0, y1: 0 };
      this.add(new MathPart(gs, box, size, color));
    }
    // Whatever LaTeX added around the parts (the brackets of a matrix, a
    // fraction rule) becomes one last part, so nothing is dropped.
    const rest = glyphs.filter((g) => g.part < 0);
    if (rest.length) {
      const box = {
        x0: Math.min(...rest.map((g) => g.x0)), x1: Math.max(...rest.map((g) => g.x1)),
        y0: Math.min(...rest.map((g) => g.y0)), y1: Math.max(...rest.map((g) => g.y1)),
      };
      this.add(new MathPart(rest, box, size, color));
    }
    // Same local frame for every part: they were typeset together.
    const k = MATH_PER_SIZE * size;
    for (const p of this.children) { p.o = [0, 0]; p.h = [k, 0]; }
    this.moveTo([0, 0]);
  }

  part(i) { return this.children[i]; }
}

/**
 * A sentence mixing prose and maths: `tex("reculé de $d$ mètres")`.
 *
 * The prose is set in Lato (the course's text font) and the `$...$` islands
 * by MathJax — NOT the whole thing in the maths font, as manim's `Tex` does:
 * MathJax's TeX fonts have no accented letters and silently drop them, which
 * turns "coordonnées" into "coordonn es".
 *
 * The pieces are laid out on a common baseline, which both kinds of mobject
 * put at the origin of their own frame.
 */
export function tex(src, {
  size = 36, color = INK, weight = "light", lineSpacing = 0.35, font = null,
} = {}) {
  const g = new Group();
  src = tr(src);
  const pitch = (size * (1 + lineSpacing)) / 96;      // as in Text
  textLines(src).forEach((line, row) => {
    let x = 0;
    const y = -row * pitch;
    for (const piece of pieces(line)) {
      const m = piece.math
        ? new MathTex(piece.text, { size, color })
        : new Text(piece.text, {
          size, color, italic: piece.italic, font,
          weight: piece.bold ? "medium" : weight,
        });
      // Both kinds of mobject carry their baseline at the origin of their
      // own frame; a MathTex holds that frame on its parts.
      const frame = m.o ? m : m.children[0];
      if (!frame) continue;
      m.shift([x - frame.o[0], y - frame.o[1]]);
      x = piece.math ? m.bbox().x1 + 0.06 : x + m.localBounds().x1 * m.unit;
      g.add(m);
    }
  });
  return g;
}

/** Cut the source on `\\`, but only outside the maths islands — a matrix
    row separator is not a line break.

    Each line is trimmed: a source string is usually cut across several JS
    fragments, and the space that separates two words on ONE line becomes an
    indent when it lands right after a break. */
function textLines(src) {
  const out = [];
  let buf = "", math = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "$") { math = !math; buf += c; continue; }
    if (!math && c === "\\" && src[i + 1] === "\\") { out.push(buf.trim()); buf = ""; i++; continue; }
    buf += c;
  }
  out.push(buf.trim());
  return out;
}

/**
 * Split a line into runs: bold or not, prose or maths. \textbf{...} is taken
 * out FIRST (it may wrap maths islands), then each region is split on the
 * dollars. A few LaTeX spacings and \dots become plain text.
 */
function pieces(line) {
  const out = [];
  for (const region of styledRegions(String(line))) {
    region.text.split("$").forEach((part, i) => {
      if (!part) return;
      if (i % 2) {
        out.push({ text: part, math: true, bold: region.bold });
        return;
      }
      const prose = part
        .replace(/\\dots/g, "…")
        .replace(/\\[,;!:] ?/g, " ")
        .replace(/~/g, " ");
      if (prose) out.push({ text: prose, bold: region.bold, italic: region.italic });
    });
  }
  return out.filter((p) => p.text.length);
}

/**
 * The line, cut into \textbf{...} and \textit{...} regions and the rest.
 * They are taken out before the dollars because a region may wrap a maths
 * island; the two nest, so \textbf{\textit{...}} gives a bold italic.
 */
function styledRegions(line, style = {}) {
  const out = [];
  let at = 0;
  for (;;) {
    const bold = line.indexOf("\\textbf{", at);
    const ital = line.indexOf("\\textit{", at);
    const start = bold < 0 ? ital : (ital < 0 ? bold : Math.min(bold, ital));
    if (start < 0) break;
    const isBold = start === bold;
    let depth = 1, i = start + 8;
    while (i < line.length && depth > 0) {
      if (line[i] === "{") depth++;
      else if (line[i] === "}") depth--;
      i++;
    }
    if (start > at) out.push({ text: line.slice(at, start), ...style });
    out.push(...styledRegions(line.slice(start + 8, i - 1),
      { ...style, [isBold ? "bold" : "italic"]: true }));
    at = i;
  }
  if (at < line.length) out.push({ text: line.slice(at), ...style });
  return out;
}

/**
 * Curly brace running along one side of `target`, its tip pointing in `dir`
 * (manim's Brace). It is a LaTeX brace — \overbrace over an empty box of the
 * right width — so it has the shape, the weight and the tapered tips of the
 * maths font instead of a hand-drawn approximation.
 */
export function brace(target, {
  dir = [0, -1], buff = 0.15, color = INK, size = 44,
} = {}) {
  const b = target.bbox();
  const vertical = Math.abs(dir[1]) >= Math.abs(dir[0]);
  const span = vertical ? b.x1 - b.x0 : b.y1 - b.y0;
  const cmd = dir[1] > 0 || (!vertical && dir[0] > 0) ? "\\overbrace" : "\\underbrace";
  // \overbrace{X} is exactly as wide as X, so the box width is the span; one
  // correction pass absorbs whatever side bearing LaTeX adds.
  let em = span / (1000 * MATH_PER_SIZE * size);
  let m = new MathTex(`${cmd}{\\hspace{${em.toFixed(4)}em}}`, { size, color });
  const err = m.width > 1e-6 ? span / m.width : 1;
  if (Math.abs(err - 1) > 0.01) {
    em *= err;
    m = new MathTex(`${cmd}{\\hspace{${em.toFixed(4)}em}}`, { size, color });
  }
  if (!vertical) m.rotate(dir[0] > 0 ? -Math.PI / 2 : Math.PI / 2);
  return m.nextTo(target, dir, buff);
}

// --- factories --------------------------------------------------------------

export const text = (s, o) => new Text(s, o);
export const math = (t, o) => new MathTex(t, o);

/**
 * A matrix whose entries can be addressed and animated one by one
 * (manim's `Matrix`): `m.entry(i, j)`, `m.row(i)`, `m.col(j)`, `m.brackets`.
 * It is a single LaTeX bmatrix, so the brackets and the spacing are LaTeX's.
 */
export class MatrixMob extends MathTex {
  constructor(rows, { size = 36, color = INK, hBuff = 1.0 } = {}) {
    const cols = rows[0].length;
    const gap = `\\hspace{${(hBuff * 0.35).toFixed(2)}em}`;
    super(rows.flat(), {
      size, color,
      template: (w) => "\\begin{bmatrix}" + rows
        .map((_, i) => w.slice(i * cols, (i + 1) * cols).join(` &${gap} `))
        .join(" \\\\[2pt] ") + "\\end{bmatrix}",
    });
    this.nrows = rows.length;
    this.ncols = cols;
  }

  entry(i, j) { return this.children[i * this.ncols + j]; }
  row(i) { return new Group(...Array.from({ length: this.ncols }, (_, j) => this.entry(i, j))); }
  col(j) { return new Group(...Array.from({ length: this.nrows }, (_, i) => this.entry(i, j))); }
  get brackets() { return this.children[this.nrows * this.ncols]; }
  get entries() { return new Group(...this.children.slice(0, this.nrows * this.ncols)); }
}

export const matrix = (rows, opts) => new MatrixMob(rows, opts);

/** Matrix/vector with square brackets (course convention). */
export function bmat(...rows) {
  const body = rows
    .map((r) => (Array.isArray(r) ? r : [r]).join(" & "))
    .join(" \\\\ ");
  return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
}
