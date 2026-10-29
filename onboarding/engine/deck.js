// Turning a lecture into a reveal.js presentation.
//
// reveal.js provides the shell (navigation, the URL hash, the progress bar,
// speaker view); every slide is an empty <section> and all the drawing
// happens on one full-screen canvas behind them. Moving to a slide asks the
// player to run that slide's animations — no video anywhere.

import { Renderer } from "./render.js";
import { Player } from "./scene.js";
import { initMathJax } from "./mathjax.js";
import { calibrate, setFont, FONTS } from "./text.js";
import { preloadIcons } from "./svg.js";
import { preloadImages } from "./image.js";
import { initHighlight } from "./code.js";
import { BG } from "./theme.js";
import { makeBackdrop } from "./background.js";
import { LANG, tr, loadLanguage, nextLang } from "./lang.js";
import { CONFIG, LANGS, THEME_KEY, LANG_KEY } from "./config.js";
import { studentRoulette } from "./roulette.js";

/**
 * Everything a lecture needs before its first frame: its words, MathJax, the
 * fonts, the icons and images, highlight.js, and the calibration of the text
 * sizes. Shared by the slides and the text mode (engine/reader.js).
 */
export async function boot(lecture) {
  // The words first: every text is translated as it is built.
  await loadLanguage();
  document.title = tr(lecture.title);
  document.documentElement.lang = LANG;
  // The body font: Computer Modern by default, `?font=lato` for the old look.
  const font = setFont(new URLSearchParams(location.search).get("font"));
  await initMathJax();
  if (document.fonts) {
    // Every face the slides use, before calibrate() measures anything.
    // Lato too, always: the titles stay in it whatever the body font is.
    const faces = new Set([...FONTS.lato.faces, ...font.faces]);
    await Promise.all([...faces].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  }
  if (lecture.icons) await preloadIcons(lecture.icons);
  if (lecture.images) await preloadImages(lecture.images);
  await initHighlight();
  calibrate();
}

/** The page of a lecture, without its ".html": what the text mode is asked for. */
export const lectureName = (path = location.pathname) =>
  decodeURIComponent(path.split("/").pop()).replace(/\.html$/, "");

export async function present(lecture, { root = document } = {}) {
  await boot(lecture);

  const canvas = root.getElementById("scene");
  const renderer = new Renderer(canvas, { background: BG });
  renderer.resize();

  const player = new Player(renderer, lecture.scenes);
  // A low-poly mesh behind every slide; ?bg=none turns it off.
  player.backdrop = makeBackdrop(new URLSearchParams(location.search).get("bg"));
  const count = await player.indexSlides();

  const slides = root.querySelector(".reveal .slides");
  slides.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const s = document.createElement("section");
    s.dataset.slide = String(i);
    slides.appendChild(s);
  }

  const deck = new window.Reveal({
    controls: true,
    progress: true,
    hash: true,
    slideNumber: "c/t",
    transition: "none",
    backgroundTransition: "none",
    display: "block",
    keyboard: true,
    touch: true,
    // The canvas is the picture; reveal only has to count.
    disableLayout: true,
  });
  await deck.initialize();

  player.onAutoNext = () => deck.next();
  deck.on("slidechanged", (e) => player.goTo(e.indexh));
  player.goTo(deck.getIndices().h || 0);

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (renderer.resize() !== false) player.tick(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.addEventListener("resize", () => renderer.resize());
  askForChange(slideOnScreen(deck, player));
  textModeButton(deck);
  // "rrr" / "iii": off unless the course asks for it (deck.config.js), and
  // silent anyway without the class list.
  if (CONFIG.roulette) studentRoulette();
  switchOnTriple("t", "theme", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* private mode */ }
  });
  if (LANGS.length > 1) {
    switchOnTriple("d", "lang", () => {
      try { localStorage.setItem(LANG_KEY, nextLang()); } catch (err) { /* private mode */ }
    });
  }
  return { player, deck };
}

/**
 * The way to the text of the lecture (read.html, engine/reader.js), for a
 * lecture that has one (`text: true` in lectures/manifest.js): a word INSIDE
 * reveal's slide number, on its line, which opens the text where the slide
 * is. "x" three times does the same while presenting.
 */
async function textModeButton(deck) {
  const { lectures } = await import("../lectures/manifest.js");
  const name = lectureName();
  const entry = lectures.find((l) => l.page === `${name}.html`);
  if (!entry || !entry.text) return;
  const go = () => {
    location.href = `read.html?l=${encodeURIComponent(name)}#slide-${deck.getIndices().h || 0}`;
  };
  const b = document.createElement("button");
  b.type = "button";
  b.className = "to-text";
  b.title = CONFIG.words.readText;
  b.setAttribute("aria-label", b.title);
  b.textContent = CONFIG.words.text;
  b.addEventListener("click", go);
  // Reveal rewrites the number whenever it likes (after "slidechanged",
  // too), which throws the button out: it is put back as soon as it happens.
  const num = document.querySelector(".reveal .slide-number");
  if (num) {
    const place = () => { if (b.parentNode !== num) num.appendChild(b); };
    new MutationObserver(place).observe(num, { childList: true });
    place();
  }
  switchOnTriple("x", null, go);
}

/**
 * "!" three times in a row opens a change request on the review board, on the
 * slide it was pressed on. The board is a development tool (tools/review, on
 * the port of deck.config.js): away from it the shortcut simply leads nowhere,
 * which is why it takes three deliberate presses and no key of its own.
 *
 * `where()` says what the request is about: { page, slide (1-based), scene,
 * block }. The slides give the slide on screen; the text mode
 * (engine/reader.js) gives the section being read, with its own page, so
 * that the board's "Open slide" leads back to the text.
 */
export function askForChange(where) {
  const BOARD = `http://localhost:${CONFIG.board}/new`;
  let bangs = [];
  window.addEventListener("keydown", (e) => {
    if (e.key !== "!") { bangs = []; return; }
    const now = Date.now();
    bangs = bangs.filter((t) => now - t < 1500).concat(now);
    if (bangs.length < 3) return;
    bangs = [];
    const w = where();
    const url = new URL(BOARD);
    url.searchParams.set("page", w.page);
    url.searchParams.set("slide", String(w.slide));
    url.searchParams.set("title", document.title);
    url.searchParams.set("from", location.href);
    // The number of a slide moves as soon as one is added before it. The
    // scene and the block inside it do not: that is what the request is
    // filed under, the number being only a hint.
    if (w.scene) {
      url.searchParams.set("scene", w.scene);
      url.searchParams.set("block", String(w.block));
    }
    // In its own window: the page stays where it is, and closing the form
    // is enough to come back to it.
    window.open(url.toString(), "_blank", "noopener");
  });
}

/** What a request sent from the slides is about: the slide on screen. */
const slideOnScreen = (deck, player) => () => {
  const n = deck.getIndices().h || 0;
  const at = player.slides[n];
  return {
    page: location.pathname.split("/").pop(), slide: n + 1,
    scene: at ? player.scenes[at.scene].name || "" : "", block: at ? at.block : "",
  };
};

/**
 * A key pressed three times flips a site-wide choice: "t" light and dark,
 * "d" the next language (when the course has more than one). A lecture carries no button — its slide fills the
 * window — and this is what replaces it while presenting.
 *
 * Both are read ONCE at load (a mobject keeps the colour and the words it
 * was built with), so `remember` writes the choice down and the page is
 * reloaded on it. Reveal keeps the slide in the hash, so it comes back where
 * it was.
 */
function switchOnTriple(key, param, remember) {
  let hits = [];
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== key) { hits = []; return; }
    if (e.metaKey || e.ctrlKey || e.altKey) { hits = []; return; }
    const now = Date.now();
    hits = hits.filter((t) => now - t < 1500).concat(now);
    if (hits.length < 3) return;
    hits = [];
    remember();
    if (!param) return;             // an action, not a remembered choice
    // `?theme=` / `?lang=` force one page and would win over the choice just made.
    const url = new URL(location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      location.replace(url);
    } else {
      location.reload();
    }
  });
}
