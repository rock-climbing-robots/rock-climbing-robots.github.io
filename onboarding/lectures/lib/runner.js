// A scene made of slides, one after the other, each fading out as the next
// comes in (the pattern of the Rhoban deck's `slideScene`).
//
// A slide maker returns { parts, clips, runTime, steps, play }:
// - `parts`: what it shows, all of it on screen when it ends;
// - `clips`: its films, started when the slide comes;
// - `steps`: more of the same, a click each, added on top;
// - `play(s)`: an animated slide, which does its own plays and nextSlides
//   (its `parts` are then what it leaves on screen).
// `carry` is the maker of the slide the previous scene ended on: the scene
// takes that picture over and removes it, for continuity.

import { scene, chapterTitle, text, lagged, appear, FadeOut, Write, Group,
         GOLD, MUTED, DOWN, TITLE_FONT } from "../../engine/index.js";

async function show(s, slide) {
  await s.play(lagged(slide.parts.map((m) => appear(m)), { lag: 0.12 }), { runTime: slide.runTime || 1.3 });
  (slide.clips || []).forEach((c) => c.run());
}

export const slideScene = (name, makers, { carry = null } = {}) => scene(name, async (s) => {
  const left = carry && carry();
  let prev = left ? [...left.parts, ...(left.steps || []).flatMap((st) => st.parts)] : [];
  s.add(...prev);
  for (const make of makers) {
    const slide = make();
    if (prev.length) await s.play(...prev.map((m) => new FadeOut(m)), { runTime: 0.5 });
    prev = [...slide.parts];
    if (slide.play) {
      await slide.play(s);
      prev = [...slide.parts];
      continue;
    }
    await show(s, slide);
    await s.nextSlide();
    for (const step of slide.steps || []) {
      await show(s, step);
      await s.nextSlide();
      prev.push(...step.parts);
    }
  }
});

/** The opening of a part: its number, big and gold, and its name. */
export const splash = (number, name, sub = null) => () => {
  const num = text(number, { size: 110, weight: "medium", color: GOLD, font: TITLE_FONT });
  const nm = text(name, { size: 54, weight: "medium", font: TITLE_FONT });
  const rows = [num, nm];
  if (sub) rows.push(text(sub, { size: 30, color: MUTED }));
  new Group(...rows).arrange(DOWN, { buff: 0.45 });
  return { parts: rows, clips: [], runTime: 1.0 };
};

export { chapterTitle, Write };
