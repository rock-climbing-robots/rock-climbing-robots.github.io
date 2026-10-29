// A film on a slide, drawn INTO the canvas.
//
// Everything on a slide is computed and drawn at every frame. A film is the
// one exception a lecture may need: a physical scene rendered ahead of time,
// a recording. It is not laid OVER the canvas like a code listing -- it is
// drawn INTO it with drawImage, so it takes its place in the z-order, and the
// arrows, frames and labels of the slide are painted on top of it,
// vectorially. The film should carry nothing but its subject: whatever can be
// drawn is drawn by the engine.
//
// A .webm in VP9 can carry an ALPHA channel: only the subject is then opaque,
// the slide shows through around it, and one file serves both themes. Chrome
// and Firefox play alpha webm; Safari does not, and would show black there.
//
// Each file gets ONE <video>, shared by every slide that shows it: it plays
// muted, in a loop, and never enters the page layout.

import { Mobject } from "./mobject.js";
import { add } from "./math.js";

const players = new Map();     // src -> HTMLVideoElement

/** The <video> for a file, started once. */
function player(src) {
  let el = players.get(src);
  if (el) return el;
  el = document.createElement("video");
  el.src = src;
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = "auto";
  // Never laid out: it exists only as a source for drawImage.
  el.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px";
  document.body.appendChild(el);
  el.play().catch(() => {});   // muted autoplay is allowed; ignore a refusal
  players.set(src, el);
  return el;
}

export class Video extends Mobject {
  /**
   * @param src     the file, relative to the site: "assets/videos/demo.webm"
   * @param width   the width on the slide, in frame units
   * @param aspect  width / height of the film. GIVEN rather than read from the
   *                file: the layout of the slide must not move when the
   *                metadata arrives.
   */
  constructor(src, { width = 7, at = [0, 0], aspect = 16 / 9 } = {}) {
    super();
    this.src = src;
    this.el = player(src);
    this.w = width;
    this.h = width / aspect;
    this.c = at.slice();
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.w *= k; this.h *= k; }

  boundsPoints() {
    const hw = this.w / 2, hh = this.h / 2;
    return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map((p) => add(this.c, p));
  }

  /** A point of the picture, in world units: uv in [0, 1], v downwards. */
  point(uv) {
    return [this.c[0] + (uv[0] - 0.5) * this.w, this.c[1] - (uv[1] - 0.5) * this.h];
  }

  /** Freeze the film on the instant `t` (0 by default). The instant is PINNED,
      not "wherever it happens to be": the player replays `construct` on every
      jump, and a plain pause would open on a different picture each visit.
      `run()` starts it again. */
  hold(t = 0) {
    const el = this.el;
    el.pause();
    // The instant is kept ON THE ELEMENT (shared by every mobject showing the
    // file), and the latest one wins: a scene that holds 0, then the end,
    // before the metadata arrives must open on the end. A listener that kept
    // its own `t` brought the film back to 0.
    el.heldAt = t;
    if (Math.abs((el.currentTime || 0) - t) > 1e-3) {
      try { el.currentTime = t; } catch (e) { /* not seekable yet */ }
    }
    // Before the metadata arrives a seek is dropped: ask again then.
    if (!el.pinListener) {
      el.pinListener = true;
      el.addEventListener("loadedmetadata", () => {
        if (el.paused && el.heldAt != null) {
          try { el.currentTime = el.heldAt; } catch (e) { /* idem */ }
        }
      });
    }
    return this;
  }

  run() { this.el.heldAt = null; this.el.play().catch(() => {}); return this; }

  /** Keep this film on the same instant as another: two renders of the SAME
      motion can then be cross-faded without the picture jumping. */
  syncTo(other) {
    const a = this.el, b = other.el;
    if (b.paused) { if (!a.paused) a.pause(); } else if (a.paused) { a.play().catch(() => {}); }
    if (Math.abs((a.currentTime || 0) - (b.currentTime || 0)) > 0.12) {
      try { a.currentTime = b.currentTime; } catch (e) { /* not ready */ }
    }
    return this;
  }

  drawSelf(r, alpha) {
    const el = this.el;
    if (el.readyState < 2) return;            // nothing decoded yet
    const { ctx } = r;
    const [x, y] = r.toDevice([this.c[0] - this.w / 2, this.c[1] + this.h / 2]);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);       // device pixels, image upright
    ctx.globalAlpha = alpha;
    ctx.drawImage(el, x, y, this.w * r.S, this.h * r.S);
    ctx.restore();
  }
}

export const video = (src, opts) => new Video(src, opts);
