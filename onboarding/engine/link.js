// A hyperlink on a slide.
//
// The canvas cannot be clicked through, so a link is a real <a> in the HTML
// layer (engine/overlay.js), positioned at every frame from its mobject like a
// code listing, and hidden with its slide. It opens in a new tab, so following
// it never leaves the presentation.
//
// With `box: [w, h]` (frame units) the link is an invisible rectangle instead
// of a line of text: laid over a picture drawn on the canvas, it makes the
// picture itself clickable. `label` then only names it for screen readers.

import { Mobject } from "./mobject.js";
import { add } from "./math.js";
import { FG } from "./palette.js";
import { overlayEntry } from "./overlay.js";

const REF = 60;                               // layout unit before the first frame

export class Link extends Mobject {
  constructor(label, href, { size = 26, color = FG, box = null } = {}) {
    super();
    this.em = size * 0.0133;                   // frame units, as Text does
    this.box = box && [...box];
    this.c = [0, 0];
    const key = `link|${href}|${label}|${size}|${box ? box.join("x") : ""}`;
    this.entry = overlayEntry(key, () => {
      const a = document.createElement("a");
      a.className = box ? "slide-link slide-link-box" : "slide-link";
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      if (box) a.setAttribute("aria-label", label);
      else a.textContent = label;
      a.style.color = color;
      return a;
    });
    this.layout(REF);
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) {
    this.em *= k;
    if (this.box) this.box = this.box.map((v) => v * k);
    this.entry.unit = 0;
  }

  layout(unit) {
    const e = this.entry;
    if (e.unit === unit && this.w) return;
    e.unit = unit;
    const { el } = e;
    if (this.box) {
      [this.w, this.h] = this.box;
      el.style.width = `${this.w * unit}px`;
      el.style.height = `${this.h * unit}px`;
      return;
    }
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
    if (rec !== this.entry) {
      // Measured on the element of the slides; another layer's copy follows it.
      for (const k of ["fontSize", "width", "height"]) el.style[k] = this.entry.el.style[k];
    }
    el.style.left = `${r.cssX(this.c[0] - this.w / 2)}px`;
    el.style.top = `${r.cssY(this.c[1] + this.h / 2)}px`;
    el.style.opacity = String(alpha);
    rec.want = true;
  }
}

export const link = (label, href, opts) => new Link(label, href, opts);
