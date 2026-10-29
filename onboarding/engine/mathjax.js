// LaTeX -> canvas glyphs, through MathJax's SVG output.
//
// MathJax typesets the formula into an off-screen SVG; we walk that SVG,
// bake each glyph outline into a Path2D (with its own transform applied) and
// keep its bounding box, colour and outline length. The result is a plain
// list of glyphs the canvas can draw, scale and animate — the equivalent of
// manim's MathTex submobjects.

import { matrixTo, boxIn } from "./svgutil.js";
import { ACCENT, ACCENT2, ACCENT3, GOLD, ORANGE, VIOLET, MUTED, FG } from "./palette.js";

let ready = null;

/** Load MathJax once and resolve when it can typeset. */
// tex-svg-full: the plain tex-svg build fetches extensions (color, html)
// lazily over HTTP; the full build has them all in one file.
export function initMathJax(src = "vendor/mathjax/tex-svg-full.js") {
  if (ready) return ready;
  window.MathJax = {
    tex: {
      packages: { "[+]": ["color", "html", "ams", "boldsymbol"] },
      inlineMath: [],
      displayMath: [],
    },
    svg: { fontCache: "none", displayAlign: "left" },
    options: { enableMenu: false },
    startup: { typeset: false },
  };
  ready = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => window.MathJax.startup.promise.then(resolve, reject);
    s.onerror = () => reject(new Error("MathJax could not be loaded"));
    document.head.appendChild(s);
  });
  return ready;
}

let sandbox = null;
function getSandbox() {
  if (!sandbox) {
    sandbox = document.createElement("div");
    // Off screen but laid out: getCTM/getBBox need a rendered element.
    sandbox.style.cssText =
      "position:absolute;left:-99999px;top:0;width:2000px;font-size:16px;visibility:hidden";
    document.body.appendChild(sandbox);
  }
  return sandbox;
}

// The course accents, usable as \color{accred} inside any formula (and
// inside matrix environments, where isolating a substring is not possible).
// MathJax has no \definecolor, but it passes an unknown colour name through
// as a CSS colour, so the names are substituted here.
// accink is the current ink: it is what one wants to come BACK to the body
// colour inside a coloured group (the T of a transpose in a blue matrix).
// Writing \color{white} there worked only as long as the stage was black.
const PALETTE = {
  accred: ACCENT, accgreen: ACCENT3, accblue: ACCENT2,
  accgold: GOLD, accviolet: VIOLET, accorange: ORANGE, muted: MUTED, accink: FG,
};
const withColors = (tex) =>
  tex.replace(/\\color\{(\w+)\}/g, (m, name) => (PALETTE[name] ? `\\color{${PALETTE[name]}}` : m));

// MathJax's TeX fonts have no precomposed accented letters: an "é" written
// inside \text{...} is DROPPED, silently. The TeX accent commands do work
// (they stack an accent glyph over the letter), so they are substituted here
// — a lecture can then write French straight into a formula.
const ACCENTS = {
  "à": "\\`a", "â": "\\^a", "ä": '\\"a', "á": "\\'a",
  "é": "\\'e", "è": "\\`e", "ê": "\\^e", "ë": '\\"e',
  "î": "\\^i", "ï": '\\"i', "í": "\\'i",
  "ô": "\\^o", "ö": '\\"o', "ó": "\\'o",
  "ù": "\\`u", "û": "\\^u", "ü": '\\"u', "ú": "\\'u",
  "À": "\\`A", "Â": "\\^A", "É": "\\'E", "È": "\\`E", "Ê": "\\^E",
  "Î": "\\^I", "Ô": "\\^O", "Û": "\\^U",
  // No cedilla in the TeX text macros: the letter is kept, bare.
  "ç": "c", "Ç": "C",
};
const withAccents = (tex) =>
  tex.replace(/[\u00c0-\u017f]/g, (c) => {
    if (ACCENTS[c]) return `{${ACCENTS[c]}}`;
    console.warn(`MathJax cannot draw "${c}"; write it with tex() instead`);
    return c;
  });

const ZERO_BOX = { x0: 0, y0: 0, x1: 0, y1: 0 };
const cache = new Map();

/**
 * Typeset `tex` and return { glyphs, bbox, parts }.
 *
 *   glyphs: [{ path, d, x0, y0, x1, y1, color, len, part }]
 *   bbox:   { x0, y0, x1, y1 } of the whole formula
 *   parts:  bbox per \class{P<i>}{...} group, in part order
 *
 * All coordinates are in MathJax's own units (1000 per em), y pointing
 * DOWN, and are turned into frame units by the MathTex mobject.
 */
export function typeset(tex) {
  const hit = cache.get(tex);
  if (hit) return hit;

  const box = getSandbox();
  const node = window.MathJax.tex2svg(withAccents(withColors(tex)), { display: false });
  box.appendChild(node);
  const svg = node.querySelector("svg");

  const glyphs = [];
  const parts = new Map();
  for (const el of svg.querySelectorAll("path, rect")) {
    if (el.closest("defs")) continue;
    const bb = el.getBBox();
    if (!isFinite(bb.width) || !isFinite(bb.height)) continue;

    // Stretchy delimiters and arrows live inside NESTED <svg> viewports; the
    // chain is composed by hand (see svgutil.js) because getScreenCTM does
    // not agree between browsers on what an inner <svg> contributes.
    const m = matrixTo(el, svg);
    const path = new Path2D();
    let d;
    if (el.tagName.toLowerCase() === "rect") {
      d = `M${bb.x} ${bb.y}h${bb.width}v${bb.height}h${-bb.width}Z`;
    } else {
      d = el.getAttribute("d");
    }
    path.addPath(new Path2D(d), m);

    const ink = boxIn(el, svg, m);       // in the formula's own coordinates
    const clip = clipOf(el, svg);
    const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    const len = el.tagName.toLowerCase() === "rect"
      ? 2 * (bb.width + bb.height) * scale
      : el.getTotalLength() * scale;

    const partEl = el.closest("[class]");
    let part = -1;
    if (partEl) {
      const mm = /(?:^|\s)P(\d+)(?:\s|$)/.exec(partEl.getAttribute("class") || "");
      if (mm) part = +mm[1];
    }
    const g = {
      path, d, part, len, clip,
      x0: Math.max(ink.x0, clip ? clip.x0 : -Infinity),
      x1: Math.min(ink.x1, clip ? clip.x1 : Infinity),
      y0: Math.max(ink.y0, clip ? clip.y0 : -Infinity),
      y1: Math.min(ink.y1, clip ? clip.y1 : Infinity),
      color: colorOf(el, svg),
    };
    if (g.x1 <= g.x0 || g.y1 <= g.y0) continue;   // entirely clipped away
    glyphs.push(g);
    if (part >= 0) {
      const p = parts.get(part) || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      p.x0 = Math.min(p.x0, g.x0); p.y0 = Math.min(p.y0, g.y0);
      p.x1 = Math.max(p.x1, g.x1); p.y1 = Math.max(p.y1, g.y1);
      parts.set(part, p);
    }
  }
  box.removeChild(node);

  const bbox = glyphs.length
    ? {
        x0: Math.min(...glyphs.map((g) => g.x0)),
        y0: Math.min(...glyphs.map((g) => g.y0)),
        x1: Math.max(...glyphs.map((g) => g.x1)),
        y1: Math.max(...glyphs.map((g) => g.y1)),
      }
    : { x0: 0, y0: 0, x1: 0, y1: 0 };

  const out = {
    glyphs,
    bbox,
    parts: [...parts.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]),
  };
  cache.set(tex, out);
  return out;
}

/**
 * Clipping box of a glyph, in root coordinates.
 *
 * MathJax builds stretchy braces, arrows and delimiters by OVERDRAWING a
 * repeated piece inside a nested <svg>, which clips it to its viewBox. Miss
 * that and an \underbrace turns into a rule across the whole slide.
 */
function clipOf(el, root) {
  let box = null;
  for (let n = el.parentElement; n && n !== root; n = n.parentElement) {
    if (n.tagName.toLowerCase() !== "svg") continue;
    const m = matrixTo(n, root);
    const vb = n.viewBox && n.viewBox.baseVal;
    const r = vb && vb.width
      ? [vb.x, vb.y, vb.width, vb.height]
      : [0, 0, n.width.baseVal.value, n.height.baseVal.value];
    const pts = [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const here = {
      x0: Math.min(...pts.map((q) => q[0])), x1: Math.max(...pts.map((q) => q[0])),
      y0: Math.min(...pts.map((q) => q[1])), y1: Math.max(...pts.map((q) => q[1])),
    };
    box = box ? {
      x0: Math.max(box.x0, here.x0), x1: Math.min(box.x1, here.x1),
      y0: Math.max(box.y0, here.y0), y1: Math.min(box.y1, here.y1),
    } : here;
  }
  return box;
}

/**
 * Colour set by \color{...}: the nearest ancestor with a real fill.
 *
 * The walk must NOT stop at the first <svg>: stretchy arrows and delimiters
 * are drawn inside nested viewports, and the \color that wraps them sits
 * outside. Stopping there left half of an \overrightarrow white while its
 * tip was coloured.
 */
function colorOf(el, root) {
  for (let n = el; n && n.tagName; n = n.parentElement) {
    const f = n.getAttribute && n.getAttribute("fill");
    if (f && f !== "currentColor" && f !== "none") return f;
    if (n === root) break;
  }
  return null;
}

/** Height of "x" in typeset units: the yardstick used to match manim's
    font sizes (see text.js). */
export function xHeight() {
  const { bbox } = typeset("x");
  return bbox.y1 - bbox.y0;
}

/**
 * A formula as an <svg> element, for HTML prose (the text mode,
 * engine/reader.js): the same colour names and accents as on the slides.
 *
 * Only the <svg>, displayed or not: the container MathJax wraps it in also
 * holds an accessibility copy of the formula (mjx-assistive-mml), which
 * MathJax's own stylesheet hides -- a stylesheet this page never loads, so the
 * copy showed as a second, plain formula under every displayed one. The
 * caller's element does the centring; `aria-label` carries the source.
 */
export function texToSvg(tex, { display = false } = {}) {
  const node = window.MathJax.tex2svg(withAccents(withColors(tex)), { display });
  const svg = node.querySelector("svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", tex);
  return svg;
}
