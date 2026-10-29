// The course's settings.
//
// They live in deck.config.js, at the root of the site: a CLASSIC script that
// every page loads first, and that sets window.DECK_CONFIG. Not a module, on
// purpose: the theme has to be settled in <head>, before the first paint, by
// theme-toggle.js -- which runs before any module does.
//
// Every value has a default, so a page without the file still works: in
// English, on the light theme, without the extras.

const given = (typeof window !== "undefined" && window.DECK_CONFIG) || {};

// What the student roulette writes on screen; "{left}" and "{total}" are
// filled in. A course in another language overrides them in deck.config.js.
const ROULETTE_TEXT = {
  suspense: "At the board…",
  quick: "Question…",
  left: "{left} of {total} not called yet",
  everyone: "Everyone has been called: the hat fills up again.",
};

// The few words the engine writes by itself: the exercise and hint banners,
// and the furniture of the text mode (engine/reader.js).
const WORDS = {
  exercise: "Exercise", hint: "Hint",
  text: "Text", readText: "Read the text of this slide", course: "Course",
  slides: "Slides", slide: "slide", slidesRange: "slides", lecture: "Lecture",
  openSlides: "Open the slides here", figure: "Figure",
  play: "Play the animation", stop: "Stop",
  permalink: "Link to this section (copied on click)", copied: "copied",
  generated: "This text was produced automatically from the lecture's slides. "
    + "The slides are the reference: when in doubt, open them.",
};

export const CONFIG = {
  id: "slides",           // prefix of what the browser remembers (theme, language)
  title: "",              // the course, as the landing page and the TP pages name it
  lang: "en",             // the language the lectures are WRITTEN in
  translations: [],       // other languages: a dictionary each, lectures/i18n/<code>.js
  theme: "light",         // "light" or "dark": before anyone chooses
  roulette: false,        // "rrr" / "iii": draw a student from the class list
  rouletteCsv: "etudiants.csv",
  board: 7777,            // the review board's port (tools/review)
  write: true,            // false: text and formulas fade in instead of being written
  ...given,
  rouletteText: { ...ROULETTE_TEXT, ...(given.rouletteText || {}) },
  words: { ...WORDS, ...(given.words || {}) },
};

/** Every language the slides can be read in, the source one first. */
export const LANGS = [CONFIG.lang,
  ...(CONFIG.translations || []).filter((l) => l !== CONFIG.lang)];

export const THEME_KEY = `${CONFIG.id}-theme`;
export const LANG_KEY = `${CONFIG.id}-lang`;
