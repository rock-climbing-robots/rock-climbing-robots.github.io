// Everything a lecture needs, in one import:
//
//   import * as m from "../engine/index.js";
//
// or, more usually, `import { text, math, FadeIn, ... } from "../engine/index.js"`.
//
// A course that needs drawings of its own (a mechanism, a graph of states)
// puts them in lectures/lib/, never here: engine/ is overwritten when the
// skill updates it.

export * from "./math.js";
export * from "./mobject.js";
export * from "./shapes.js";
export * from "./text.js";
export * from "./svg.js";
export * from "./image.js";
export * from "./three.js";
export * from "./anim.js";
export * from "./scene.js";
export * from "./theme.js";
export * from "./geometry.js";
export * from "./code.js";
export * from "./video.js";
export * from "./link.js";
export * from "./slider.js";
export * from "./handle.js";
export * from "./robot3d.js";
export { CONFIG, LANGS } from "./config.js";
export { LANG, tr, trMath } from "./lang.js";
export { Renderer, mixColor, rgba, onBeginFrame, onEndFrame } from "./render.js";
export { initMathJax } from "./mathjax.js";
export { polyBackdrop, makeBackdrop } from "./background.js";

/** Declare a scene of a lecture. */
export const scene = (name, construct) => ({ name, construct });

/**
 * Declare a figure of the lecture's TEXT (read.html, engine/reader.js): a
 * small scene that plays one illustration alone -- no title, no frame, no
 * caption, the text says it -- in the part `view` = [x0, y0, x1, y1] of the
 * world. It is built from the same functions as the slide that shows it.
 */
export const figure = (name, view, construct) => ({ name, view, construct });
