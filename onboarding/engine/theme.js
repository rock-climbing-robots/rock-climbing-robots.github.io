// Shared look and feel of the course: colours, type, slide layout.
//
// The palette and the conventions are those of the manim lectures: black
// background, white text in Lato Light, the 3b1b accents, and the axes
// always coloured x = red, y = green, z = blue.

import { Group, group } from "./mobject.js";
import { Text, MathTex, text, math, tex } from "./text.js";
import { Line, Rectangle } from "./shapes.js";
import { icon } from "./svg.js";
import { CONFIG } from "./config.js";
import { Write, FadeIn, Rotate } from "./anim.js";
import { UP, DOWN, LEFT, RIGHT, TAU, linear, normalize, sub, add, mul } from "./math.js";

// The palette depends on the theme; engine/palette.js resolves it once.
// LIGHT goes with them: a COLOURED illustration (a photograph, a painted
// background) is not ink and does not swap by itself, but it may still have
// to sit differently on a white ground than on a black one.
export { BG, FG, MUTED, ACCENT, ACCENT2, ACCENT3, GOLD, ORANGE, VIOLET, YELLOW, LINK, GRID_COLOR,
         MESH, LIGHT } from "./palette.js";
import { ACCENT, ACCENT2, ACCENT3, GOLD, FG, BG, MUTED, GRID_COLOR } from "./palette.js";

// Course convention: x red, y green, z blue.
export const X_COLOR = ACCENT;
export const Y_COLOR = ACCENT3;
export const Z_COLOR = ACCENT2;


// The titles keep the font of the course whatever the body text is set to
// (see the ?font= switch): they are the furniture of the deck, not prose.
export const TITLE_FONT = "lato";

/** Section title, at the top of the slide. */
export function slideTitle(str, { color = FG, size = 44, buff = 0.4 } = {}) {
  // Above everything: the scene sorts its top-level mobjects by zIndex, and
  // a reference grid handed to the scene inside a GROUP (the group carries
  // the default 0, not the grid's -1) was drawing its lines over the title.
  return text(str, { size, weight: "medium", color, font: TITLE_FONT })
    .toEdge(UP, buff)
    .setZ(5);
}

/** The name of a lecture, on its opening slide. */
export function chapterTitle(str, { size = 64 } = {}) {
  return text(str, { size, weight: "medium", font: TITLE_FONT });
}

/** The guiding question of a slide: bigger, gold, slightly heavier. */
export function question(str) {
  return text(str, { size: 30, color: GOLD, weight: "normal", lineSpacing: 0.8 });
}

// Layout of the illustration slides: the figure sits on the left, the text
// column starts here and is centred vertically.
export const TEXT_LEFT = -0.2;
export const TEXT_CENTER_Y = -0.3;

/** Stack mobjects in the right-hand column, left aligned. */
export function textColumn(mobs, { gap = 0.45, centerY = TEXT_CENTER_Y } = {}) {
  const col = new Group(...mobs).arrange(DOWN, { buff: gap, aligned: LEFT });
  col.shift([TEXT_LEFT - col.bbox().x0, 0]);
  col.shift([0, centerY - col.center()[1]]);
  return col;
}

/** Place a label just outside the middle of an angle arc. */
export function angleLabel(arcMob, vertex, tex, color, dist = 0.35) {
  const midPoint = arcMob.pointAt ? arcMob.pointAt(0.5) : arcMob.center();
  const out = normalize(sub(midPoint, vertex));
  return math(tex, { size: 36, color }).moveTo(add(midPoint, mul(out, dist)));
}


/** Faint reference grid, one cell per `unit`, aligned on `origin`. */
export function referenceGrid(origin, unit, { xSpan = [-7.2, 7.2], ySpan = [-4.1, 4.1] } = {}) {
  const g = new Group();
  for (let k = Math.floor((xSpan[0] - origin[0]) / unit); ; k++) {
    const x = origin[0] + k * unit;
    if (x > xSpan[1]) break;
    if (x >= xSpan[0]) g.add(new Line([x, ySpan[0]], [x, ySpan[1]], { width: 1.2, color: GRID_COLOR }));
  }
  for (let k = Math.floor((ySpan[0] - origin[1]) / unit); ; k++) {
    const y = origin[1] + k * unit;
    if (y > ySpan[1]) break;
    if (y >= ySpan[0]) g.add(new Line([xSpan[0], y], [xSpan[1], y], { width: 1.2, color: GRID_COLOR }));
  }
  g.zIndex = -1;
  return g;
}

// --- section titles and exercise cards --------------------------------------

/** Section title slide: a big number above the section name. */
export async function sectionSplash(s, number, name) {
  const num = text(number, { size: 96, weight: "medium", color: GOLD, font: TITLE_FONT });
  const nm = text(name, { size: 48, weight: "medium", font: TITLE_FONT });
  group(num, nm).arrange(DOWN, { buff: 0.5 });
  await s.play(new Write(num), new Write(nm));
  await s.nextSlide();
}

/**
 * Banner posing an exercise: a gear (spun while the students work) beside
 * the wording. Returns [card, gear].
 */
export function makeExercise(lines, { at = null } = {}) {
  const gear = icon("settings.svg", { height: 0.85, color: GOLD, width: 2.5 });
  const label = group(
    text(CONFIG.words.exercise, { size: 28, weight: "medium", color: GOLD }),
    ...lines.map((l) => tex(l, { size: 26 })),
  ).arrange(DOWN, { buff: 0.18, aligned: LEFT });
  const body = group(gear, label).arrange(RIGHT, { buff: 0.5 });
  // Opaque: the banner is also laid over figures.
  const box = new Rectangle({
    width: body.width + 1.0, height: body.height + 0.55, corner: 0.15,
    color: GOLD, strokeWidth: 2.5, fill: BG, fillOpacity: 1,
  });
  body.moveTo(box.center());
  const card = group(box, body);
  if (at) card.moveTo(at); else card.toEdge(DOWN, 0.35);
  return [card, gear];
}

/** Discreet banner (grey) holding a hint, given as ready-made mobjects. */
export function makeHint(mobs, { title = CONFIG.words.hint, at = null } = {}) {
  const body = group(
    text(title, { size: 26, weight: "medium", color: MUTED }), ...mobs,
  ).arrange(DOWN, { buff: 0.25, aligned: LEFT });
  const box = new Rectangle({
    width: body.width + 0.7, height: body.height + 0.6, corner: 0.12,
    color: MUTED, strokeWidth: 2, fill: BG, fillOpacity: 1,
  });
  body.moveTo(box.center());
  const card = group(box, body);
  if (at) card.moveTo(at); else card.toEdge(DOWN, 0.4);
  return card;
}

/** One turn of an exercise gear, to be played on a looping slide. */
export const spinGear = (gear, runTime = 6) =>
  new Rotate(gear, -TAU, { about: gear.center(), rateFunc: linear, runTime });

/**
 * Standard reveal of an exercise card: it fades in on its own slide
 * (autoNext, otherwise an empty slide shows before the gear turns), then the
 * gear turns while the students work.
 */
export async function poseExercise(s, card, gear, extra = []) {
  await s.nextSlide({ autoNext: true });
  await s.play(new FadeIn(card), ...extra);
  await s.nextSlide({ loop: true });
  await s.play(spinGear(gear));
  // The loop is armed by the NEXT nextSlide(): without this one the gear
  // would turn once and stop, and anything the scene plays afterwards would
  // be swallowed into the looping slide.
  await s.nextSlide();
}

export { Text, MathTex, text, math, tex };
