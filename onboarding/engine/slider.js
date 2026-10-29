// Something to operate during the class: a slider.
//
// The one object of a lecture one INTERACTS with, so, like a code listing, it
// is real HTML laid over the canvas (engine/overlay.js) rather than a
// drawing: an <input type="range"> already knows how to be grabbed with a
// mouse, a finger or the keyboard, and it is accessible.
//
// It is positioned at every frame from the centre of its mobject, so it
// follows fades and moves like everything else.
//
// The player replays the scene from its start on every slide jump: the value
// of the slider therefore lives in the layer, NOT in the scene, or coming back
// to the slide would reset it. `construct` reads it again on every pass.

import { Mobject } from "./mobject.js";
import { add } from "./math.js";
import { overlayEntry } from "./overlay.js";

// Frame units per CSS pixel, to measure before the renderer exists (the
// 1280x720 default). Only the ratio matters.
const REF = 90;

export class Slider extends Mobject {
  /**
   * @param key    identifies the slider from one pass to the next (its value lives there)
   * @param min,max,step  the range
   * @param value  the value the very first time it shows
   * @param width  the width on the slide, in frame units
   * @param reset  true: back to `value` whenever the slide is entered again,
   *               rather than where the user left it (see engine/handle.js)
   * @param onInput  called on every move, and once when built
   */
  constructor(key, {
    min = 0, max = 1, step = 0.01, value = 0, width = 5, reset = false,
    onInput = null,
  } = {}) {
    super();
    this.c = [0, 0];
    this.w = width;
    this.entry = overlayEntry(`slider|${key}`, () => {
      const el = document.createElement("input");
      el.type = "range";
      el.className = "deck-slider";
      return el;
    });
    const { el } = this.entry;
    el.min = String(min);
    el.max = String(max);
    el.step = String(step);
    // First time: the value asked for. Afterwards: the one the user left, so
    // that coming back to the slide finds it again -- unless the lecture
    // wants the slide to start afresh every time (`reset`).
    if (reset || this.entry.value === undefined) this.entry.value = value;
    el.value = String(this.entry.value);
    this.onInput = onInput;
    // The scene is rebuilt on every jump, so the tracker this handler talks
    // to changes: it is replaced, not added.
    el.oninput = () => {
      this.entry.value = Number(el.value);
      if (this.onInput) this.onInput(this.entry.value);
    };
    if (onInput) onInput(this.entry.value);
    this.h = 0.5;
  }

  /** The current value, also readable without going through `onInput`. */
  get value() { return this.entry.value; }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.w *= k; this.h *= k; }

  boundsPoints() {
    const hw = this.w / 2, hh = this.h / 2;
    return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map((p) => add(this.c, p));
  }

  drawSelf(r, alpha) {
    const rec = this.entry.at(r);
    const { el } = rec;
    if (rec !== this.entry) {
      // The slider of another layer (a figure of the text mode): the same
      // range, value and handler as the one of the slides.
      const home = this.entry.el;
      for (const k of ["min", "max", "step"]) el[k] = home[k];
      if (document.activeElement !== el) el.value = String(this.entry.value);
      el.oninput = () => { home.value = el.value; home.oninput(); };
      el.style.accentColor = home.style.accentColor;
    }
    const unit = r.unit || REF;
    el.style.width = `${this.w * unit}px`;
    el.style.left = `${r.cssX(this.c[0] - this.w / 2)}px`;
    el.style.top = `${r.cssY(this.c[1] + this.h / 2)}px`;
    el.style.height = `${this.h * unit}px`;
    el.style.opacity = String(alpha);
    // A half-faded slider must not be grabbable.
    el.style.pointerEvents = alpha > 0.9 ? "auto" : "none";
    rec.want = true;
  }
}

export const slider = (key, opts) => new Slider(key, opts);
