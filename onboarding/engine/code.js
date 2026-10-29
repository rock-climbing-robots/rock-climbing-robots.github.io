// Source code on a slide.
//
// Unlike everything else in a lecture, a listing is NOT drawn on the canvas:
// it is real HTML text, laid over the canvas and coloured by highlight.js.
// The reason is the text itself — it stays selectable, copyable and crisp at
// any zoom, and the highlighting comes from a library that knows Python
// rather than from a handful of regexps.
//
// The element is positioned from the mobject's centre on every frame, so a
// listing shifts, fades and takes part in animations like any other mobject
// (rotating or shearing it is the exception: an HTML box only follows
// position and size).

import { Mobject } from "./mobject.js";
import { add } from "./math.js";
import { overlayEntry } from "./overlay.js";

// Frame units per CSS pixel used to measure a listing before the renderer
// exists (the 1280x720 default). Only the ratio matters: the box is measured
// again at the real scale as soon as it is drawn.
const REF = 90;

let hljs = null;

/** Load highlight.js (core + Python) once. */
export async function initHighlight(base = "../vendor/highlight/") {
  if (hljs) return hljs;
  const [core, python] = await Promise.all([
    import(`${base}core.js`), import(`${base}python.js`),
  ]);
  hljs = core.default;
  hljs.registerLanguage("python", python.default);
  return hljs;
}

/** The DOM element for one listing, built once and reused. A listing shown
    twice at once would share it — no lecture does that. `bar` adds the
    title bar with its three buttons (off by default: see the guide). */
function element(key, html, lineHeight, bar) {
  return overlayEntry(key, () => {
    const el = document.createElement("div");
    el.className = bar ? "code-window" : "code-window code-plain";
    el.style.lineHeight = String(lineHeight);
    el.innerHTML = (bar ? '<div class="code-bar"><i></i><i></i><i></i></div>' : "")
      + `<pre><code class="hljs">${html}</code></pre>`;
    return el;
  });
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// --- the mobject ------------------------------------------------------------

/**
 * A code listing, in a plain dark box, dark in both themes. `size` is the
 * font size in the same units as Text; `bar: true` adds a title bar with
 * the three "Mac" buttons -- only when the user asks for it.
 */
export class Code extends Mobject {
  constructor(source, { size = 19, lineSpacing = 0.55, language = "python", bar = false } = {}) {
    super();
    this.source = String(source).replace(/\s+$/, "");
    this.em = size * 0.0133;                   // frame units, as Text does
    this.c = [0, 0];
    const html = hljs
      ? hljs.highlight(this.source, { language }).value
      : escapeHtml(this.source);
    this.entry = element(`${language}|${size}|${lineSpacing}|${bar ? 1 : 0}|${this.source}`,
                         html, 1 + lineSpacing, bar);
    this.layout(REF);
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.em *= k; this.entry.unit = 0; this.unit = 0; }

  /** Lay the element out at `unit` CSS pixels per frame unit, and read back
      its size in frame units. Only done when the scale actually changes.
      The element is SHARED by every mobject of the same listing (a scene
      replayed, an animation's copy, the original put back by finish()), so
      the scale it was measured at is remembered on BOTH: a mobject measured
      at another scale (REF, at construction) measures again even though the
      element is already laid out -- or its box keeps a stale width and the
      listing jumps when an animation ends. */
  layout(unit) {
    const e = this.entry;
    if (e.unit === unit && this.unit === unit) return;
    e.unit = unit;
    this.unit = unit;
    const { el } = e;
    el.style.fontSize = `${this.em * unit}px`;
    const hidden = el.style.display === "none";
    if (hidden) el.style.display = "block";
    this.w = el.offsetWidth / unit;
    this.h = el.offsetHeight / unit;
    if (hidden) el.style.display = "none";
  }

  boundsPoints() {
    const hw = this.w / 2, hh = this.h / 2;
    return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map((p) => add(this.c, p));
  }

  drawSelf(r, alpha) {
    this.layout(r.unit);
    const rec = this.entry.at(r);
    const { el } = rec;
    // Measured on the element of the slides; another layer's copy follows it.
    if (rec !== this.entry) el.style.fontSize = this.entry.el.style.fontSize;
    el.style.left = `${r.cssX(this.c[0] - this.w / 2)}px`;
    el.style.top = `${r.cssY(this.c[1] + this.h / 2)}px`;
    el.style.opacity = String(alpha);
    rec.want = true;
  }
}

export const code = (src, opts) => new Code(src, opts);
