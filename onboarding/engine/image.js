// Bitmap images on the canvas (manim's ImageMobject).

import { Mobject } from "./mobject.js";
import { add, sub, rot, norm, angleOf } from "./math.js";
import { LIGHT } from "./palette.js";

const images = new Map();
const mipmaps = new WeakMap();   // source image -> [full size, half, quarter, ...]

/**
 * The half-size chain of an image ("mipmaps"), built once and kept.
 *
 * A canvas `drawImage` filters with FOUR neighbouring pixels, whatever the
 * reduction: asked to fit a 1000 px picture into 55, it keeps a 2x2 sample out
 * of every 18x18 block and throws the rest away -- a photograph shrunk that
 * much comes out crawling with jagged edges, and `imageSmoothingQuality` does
 * not save it. Halving repeatedly, on the other hand, is exactly the case
 * those four taps DO cover: every level averages the whole of the one above,
 * so nothing is skipped. Drawing then picks the level just bigger than the
 * size on screen and shrinks it by less than two.
 */
function mips(img) {
  let chain = mipmaps.get(img);
  if (chain) return chain;
  chain = [img];
  let w = img.width, h = img.height, src = img;
  while (w > 2 && h > 2) {
    w = Math.max(1, Math.round(w / 2));
    h = Math.max(1, Math.round(h / 2));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(src, 0, 0, w, h);
    chain.push(cv);
    src = cv;
  }
  mipmaps.set(img, chain);
  return chain;
}

/** The level to draw from for a target `width` in device pixels. */
function levelFor(img, width) {
  const chain = mips(img);
  let best = chain[0];
  for (const level of chain) {
    if (level.width >= width) best = level; else break;
  }
  return best;
}

/** Load the images a lecture uses; call once before building the scenes. */
export async function preloadImages(names, base = "assets/images/") {
  await Promise.all(names.map((name) => new Promise((resolve, reject) => {
    if (images.has(name)) return resolve();
    const img = new Image();
    img.onload = () => { images.set(name, img); mips(img); resolve(); };
    img.onerror = () => reject(new Error(`image "${name}" could not be loaded`));
    img.src = base + name;
  })));
}

/** An image, `height` frame units tall, centred on the origin. */
export class ImageMob extends Mobject {
  /**
   * `lineArt` marks a drawing made of white strokes on nothing: on the light
   * theme it is drawn inverted, otherwise it disappears into the page. A
   * shaded or coloured illustration must NOT be marked (inverting it would
   * turn it into a negative).
   */
  constructor(name, { height = 1, angle = 0, lineArt = false, pixelated = false } = {}) {
    super();
    const img = images.get(name);
    if (!img) throw new Error(`image "${name}" was not preloaded`);
    this.img = img;
    // Pixel art (a 32 px sprite blown up to a cell of the slide) keeps its
    // square pixels: no smoothing, drawn from the full-size image.
    this.pixelated = pixelated;
    this.h = height;
    this.w = (height * img.width) / img.height;
    this.c = [0, 0];
    this.dir = [Math.cos(angle), Math.sin(angle)];   // rotates with the mobject
    this.invert = lineArt && LIGHT;
  }

  mapPoints(fn) {
    const tip = fn(add(this.c, this.dir));
    this.c = fn(this.c);
    this.dir = sub(tip, this.c);
    const n = norm(this.dir);
    if (n > 1e-9) this.dir = [this.dir[0] / n, this.dir[1] / n];
  }

  onScale(k) { this.w *= k; this.h *= k; }
  get angle() { return angleOf(this.dir); }

  boundsPoints() {
    const hw = this.w / 2, hh = this.h / 2;
    return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]
      .map((p) => add(this.c, rot(p, this.angle)));
  }

  drawSelf(r, alpha) {
    const { ctx } = r;
    const a = this.angle, c = Math.cos(a), s = Math.sin(a);
    ctx.save();
    ctx.setTransform(c, -s, s, c, r.OX + r.S * this.c[0], r.OY - r.S * this.c[1]);
    ctx.globalAlpha = alpha;
    const w = this.w * r.S, h = this.h * r.S;
    if (this.invert) ctx.filter = "invert(1)";
    if (this.pixelated) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(levelFor(this.img, w), -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
}

export const image = (name, opts) => new ImageMob(name, opts);
