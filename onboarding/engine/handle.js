// Something to move during the class: a handle.
//
// A slider gives one NUMBER. Some figures ask for a POINT: the head of a
// vector, a point to walk around a plane, a corner to drag. A handle is that
// point, grabbable.
//
// It is built like the slider (engine/slider.js), and for the same reason:
// real HTML laid over the canvas (engine/overlay.js) rather than a drawing.
// A <div> already knows how to be grabbed with a mouse and a finger (pointer
// capture: the drag survives leaving the circle), it can take the focus, and
// the arrow keys then nudge it -- without that, a point one can only reach
// with a mouse is a point half the room cannot reach at all.
//
// It is positioned at every frame from the world point it holds, so it
// follows fades and moves like everything else, and it draws nothing on the
// canvas: what the audience sees at that point (a dot, an arrow head, a
// label) is drawn by the lecture, in a `redraw` that reads `h.pos`.
//
// The player replays the scene from its start on every slide jump: the point
// therefore lives in the LAYER, not in the scene, or coming back to the slide
// would put it back where it started. `construct` reads it again on every
// pass, and the pass that is running owns the handlers.

import { Mobject } from "./mobject.js";
import { clamp } from "./math.js";
import { VIOLET } from "./palette.js";
import { overlayEntry } from "./overlay.js";

// Frame units per CSS pixel before the renderer exists (the 1280x720
// default). Only ever used if something drags a handle never drawn.
const REF = 90;

const KEYS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
};

export class Handle extends Mobject {
  /**
   * @param key     identifies the handle from one pass to the next (the point
   *                lives there), and must be unique in the lecture
   * @param at      where it starts, in world units, the very first time
   * @param bounds  where it may go: [x0, y0, x1, y1] to fence it in a
   *                rectangle, or a FUNCTION taking the point the hand asks
   *                for and returning the one it settles on -- that is how a
   *                point stays on a circle, on a line, or out of the way of
   *                another one (null: the whole world)
   * @param label   what a screen reader announces ("the point P"); without
   *                it, only a sighted mouse knows what this ring is
   * @param rad     the radius of the grab circle, in world units
   * @param color   its ring; the colour of what it moves
   * @param step    how far one arrow key moves it (four times that with shift)
   * @param reset   true: back to `at` whenever the slide is entered again,
   *                rather than where the user left it. The player replays
   *                `construct` on every jump, so this suits a scene of ONE
   *                slide: a move inside the scene would reset it too.
   * @param onMove  called on every move, and once when built
   */
  constructor(key, {
    at = [0, 0], bounds = null, label = null, rad = 0.32, color = VIOLET,
    step = 0.1, reset = false, onMove = null,
  } = {}) {
    super();
    this.rad = rad;
    this.color = color;
    this.bounds = bounds;
    this.label = label || key;
    this.step = step;
    this.onMove = onMove;
    this.entry = overlayEntry(`handle|${key}`, () => {
      const el = document.createElement("div");
      el.className = "deck-handle";
      el.tabIndex = 0;
      el.setAttribute("role", "application");
      return el;
    });
    // First time: where the lecture puts it. Afterwards: where the user left
    // it, so that coming back to the slide finds it again -- unless the
    // lecture wants the slide to start afresh every time (`reset`).
    if (reset || this.entry.value === undefined) this.entry.value = at.slice();
    this.bind(this.entry);
    if (onMove) onMove(this.entry.value);
  }

  /** The point it holds, in world units. */
  get pos() { return this.entry.value; }

  /**
   * Move it where the hand asks, as far as `bounds` allows, and tell the
   * lecture. `onMove` is handed the point it SETTLED on, to read -- not to
   * correct: a constraint belongs in `bounds`, which is consulted before
   * anything on screen has seen the new point.
   */
  moveHandle(p) {
    const b = this.bounds;
    const q = typeof b === "function" ? b([p[0], p[1]])
      : b ? [clamp(p[0], b[0], b[2]), clamp(p[1], b[1], b[3])]
        : p;
    this.entry.value = [q[0], q[1]];
    if (this.onMove) this.onMove(this.entry.value);
  }

  /** The pointer and the keyboard, on the element of one layer. The scene is
      rebuilt on every jump, so the handlers are REPLACED, not added. */
  bind(rec) {
    const { el } = rec;
    el.style.color = this.color;
    el.setAttribute("aria-label", this.label);
    el.onpointerdown = (e) => {
      if (e.button) return;
      // Reveal must not read the drag as a swipe to the next slide.
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add("held");
      const unit = rec.unit || REF;
      const from = this.pos.slice();
      const [sx, sy] = [e.clientX, e.clientY];
      const move = (ev) => this.moveHandle([
        from[0] + (ev.clientX - sx) / unit,
        from[1] - (ev.clientY - sy) / unit,      // y goes UP in the world
      ]);
      const up = () => {
        el.classList.remove("held");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    };
    el.onkeydown = (e) => {
      const d = KEYS[e.key];
      if (!d) return;
      // Without this, the arrows would also turn the page.
      e.preventDefault();
      e.stopPropagation();
      const k = this.step * (e.shiftKey ? 4 : 1);
      const v = this.pos;
      this.moveHandle([v[0] + d[0] * k, v[1] + d[1] * k]);
    };
  }

  mapPoints(fn) { this.entry.value = fn(this.pos); }
  onScale(k) { this.rad *= k; this.step *= k; }

  boundsPoints() {
    const [x, y] = this.pos, r = this.rad;
    return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
  }

  drawSelf(r, alpha) {
    const rec = this.entry.at(r);
    if (rec !== this.entry) this.bind(rec);    // the handle of another layer
    rec.unit = r.unit || REF;
    const { el } = rec;
    const d = 2 * this.rad * r.unit;
    const [x, y] = this.pos;
    el.style.width = `${d}px`;
    el.style.height = `${d}px`;
    el.style.left = `${r.cssX(x - this.rad)}px`;
    el.style.top = `${r.cssY(y + this.rad)}px`;
    el.style.opacity = String(alpha);
    // A half-faded handle must not be grabbable.
    el.style.pointerEvents = alpha > 0.9 ? "auto" : "none";
    rec.want = true;
  }
}

export const handle = (key, opts) => new Handle(key, opts);
