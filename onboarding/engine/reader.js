// The text mode: a lecture as a text to read, beside its slides.
//
//   read.html?l=00_introduction#slide-7
//
// Not the slides pasted into a page: a lecture WRITTEN for reading, in the
// same order as the slides, whose figures are the illustrations of the
// slides alone -- no title, no frame, no line of prose drawn on the canvas.
// The slides are one button away, and the text one button away from them.
//
// The text of a lecture lives in lectures/text/<lecture>.js, as DATA, in
// the course's language and in each of its translations
// ({ en: "...", fr: "..." }: the language in force, else the source one). Its figures are declared by the lecture itself
// (`export const figures = [figure(name, view, construct)]`), built from the
// same functions as the slide that shows them: each one is a canvas with its
// own player, showing how the illustration ends, and ▶ plays it live.
// Nothing is pre-rendered, like everywhere else in the course.
//
// A section is anchored by the NAME of a scene and the rank of a slide in it
// (as the review board files a request), never by the slide number: a slide
// added before it would shift every number. The section covers every slide up
// to the next one's anchor, which is how a slide finds its text and the text
// its slide:
//
//   the slides   "Text", beside the slide number ("x" three times), opens
//                read.html at the section that covers the slide;
//   the text     each section has its slides in the right margin, and
//                "Slides" at the top opens the slides where one is reading.
//
// The shape of a section:
//
//   { at: ["Branches of machine learning", 1],      // scene, slide in it (0 = first)
//     title: { en: "...", fr: "..." },              // optional; `level: 3` for a sub-heading
//     body: [
//       { en: "prose, \\(math\\)", fr: "..." },       // a paragraph: HTML, formulas in \\( \\)
//       { figure: "k-means", caption: { en, fr } },  // a figure of the lecture's `figures`
//                                                     // (`width: 0.8` of the column)
//       { image: "media/go.jpeg", caption },         // a photograph
//       { video: "media/lace.mp4", caption },        // a video, with its controls
//     ] }
//
// Figures, photographs and videos are numbered in order, and their caption
// says "Figure n".

import { boot, askForChange } from "./deck.js";
import { Renderer } from "./render.js";
import { Player } from "./scene.js";
import { BG, LIGHT } from "./palette.js";
import { polyBackdrop } from "./background.js";
import { FRAME_WIDTH, FRAME_HEIGHT } from "./math.js";
import { LANG, tr } from "./lang.js";
import { CONFIG } from "./config.js";
import { texToSvg } from "./mathjax.js";
import { tableOfContents } from "./toc.js";

/** A word of the page's furniture, in the course's language (deck.config.js). */
const W = (key) => CONFIG.words[key];
/** A string of the transcript in the language in force (English if missing). */
const inLang = (x) => (typeof x === "string" ? x
  : x[LANG] || x[CONFIG.lang] || Object.values(x)[0] || "");

export async function read() {
  const name = new URLSearchParams(location.search).get("l") || "";
  const main = document.getElementById("text");
  if (!/^[\w-]+$/.test(name)) {
    main.textContent = "No lecture given: read.html?l=00_introduction";
    return;
  }
  const [lecture, transcript, { lectures }] = await Promise.all([
    import(`../lectures/${name}.js`),
    import(`../lectures/text/${name}.js`),
    import("../lectures/manifest.js"),
  ]);
  await boot(lecture);
  const slidesPage = `${name}.html`;
  const entry = lectures.find((l) => l.page === slidesPage) || {};
  document.title = `${tr(lecture.title)} · ${W("text").toLowerCase()}`;

  // Every slide of the lecture, once: the figures share the list.
  const indexer = new Player(null, lecture.scenes);
  await indexer.indexSlides();
  const slides = indexer.slides;
  const slideOf = ([scene, k]) => {
    const own = slides.flatMap((s, i) => (lecture.scenes[s.scene].name === scene ? [i] : []));
    if (!own.length) throw new Error(`text of ${name}: no scene "${scene}"`);
    if (!(k >= 0 && k < own.length)) {
      throw new Error(`text of ${name}: scene "${scene}" has ${own.length} slides, not a slide ${k}`);
    }
    return own[k];
  };

  // The sections, each with the slides it covers.
  const sections = transcript.sections.map((sec) => ({ ...sec, from: slideOf(sec.at) }));
  sections.forEach((sec, i) => {
    if (i && sec.from <= sections[i - 1].from) {
      throw new Error(`text of ${name}: section ${i} ("${sec.at[0]}", ${sec.at[1]}) is not after the one before`);
    }
    sec.to = i + 1 < sections.length ? sections[i + 1].from - 1 : slides.length - 1;
  });
  if (sections.length && sections[0].from !== 0) {
    console.warn(`text of ${name}: slides 1 to ${sections[0].from} have no text`);
  }
  const sectionOf = (k) => [...sections].reverse().find((s) => s.from <= k) || sections[0];

  // --- the page ---------------------------------------------------------------

  const bar = document.getElementById("bar");
  bar.innerHTML = `<a class="home" href="index.html">← ${W("course")}</a>`
    + `<span class="where">${entry.number ? entry.number + " · " : ""}${escapeHtml(tr(lecture.title))}</span>`
    + `<a class="slides" href="${slidesPage}">${W("slides")} ↗</a>`;
  const toSlides = bar.querySelector(".slides");

  main.innerHTML = "";
  const head = document.createElement("header");
  head.className = "tx-head";
  head.innerHTML = (entry.number ? `<p class="overline">${W("lecture")} ${entry.number}</p>` : "")
    + `<h1>${escapeHtml(tr(lecture.title))}</h1>`;
  // Until the author says otherwise: the text is written by Claude from the
  // slides, and the reader should know it. A course turns it off with
  // `textWarning: false` in deck.config.js, when its author asks.
  if (CONFIG.textWarning !== false) head.innerHTML += `<p class="tx-warning">${W("generated")}</p>`;
  main.appendChild(head);

  const figures = [];
  let count = 0;
  for (const sec of sections) {
    const el = document.createElement("section");
    el.className = "tx";
    el.id = `slide-${sec.from}`;
    sec.el = el;
    const go = document.createElement("a");
    go.className = "tx-go";
    go.href = `${slidesPage}#/${sec.from}`;
    go.title = W("openSlides");
    go.textContent = sec.to > sec.from
      ? `${W("slidesRange")} ${sec.from + 1}–${sec.to + 1}`
      : `${W("slide")} ${sec.from + 1}`;
    el.appendChild(go);
    // A titled section is anchored by its title -- in the SOURCE language, so
    // that a link is the same in every language -- and the title carries its
    // permalink. An untitled one keeps #slide-<index>.
    sec.anchor = `slide-${sec.from}`;
    if (sec.title) {
      const h = document.createElement(sec.level === 3 ? "h3" : "h2");
      sec.anchor = slug(typeof sec.title === "string" ? sec.title
        : sec.title[CONFIG.lang] || inLang(sec.title));
      h.id = sec.anchor;
      h.innerHTML = withMath(inLang(sec.title));
      h.appendChild(permalink(sec.anchor));
      el.appendChild(h);
    }
    for (const item of sec.body || []) {
      if (item.figure || item.image || item.video) {
        const n = ++count;
        let fig;
        if (item.figure) {
          const def = (lecture.figures || []).find((f) => f.name === item.figure);
          if (!def) throw new Error(`text of ${name}: the lecture has no figure "${item.figure}"`);
          fig = new Figure(def);
          figures.push(fig);
        } else {
          fig = { el: media(item) };
        }
        fig.el.id = `figure-${n}`;
        // `width`: a fraction of the column, for a figure whose lettering
        // would otherwise dwarf the prose.
        if (item.width) fig.el.style.setProperty("--fig-width", `${100 * item.width}%`);
        const cap = document.createElement("figcaption");
        cap.innerHTML = `<b>${W("figure")} ${n}.</b> ` + withMath(inLang(item.caption || ""));
        fig.el.appendChild(cap);
        el.appendChild(fig.el);
      } else {
        const p = document.createElement("p");
        p.innerHTML = withMath(inLang(item));
        el.appendChild(p);
      }
    }
    main.appendChild(el);
  }
  typesetIn(main);
  tableOfContents(main);

  // --- the figures: drawn when they come near the screen, stopped when they leave

  const near = new IntersectionObserver((seen) => {
    for (const e of seen) {
      const f = e.target.figure;
      if (e.isIntersecting) f.show();
      else f.stop();
    }
  }, { rootMargin: "600px 0px" });
  for (const f of figures) { f.el.figure = f; near.observe(f.el); }

  const behind = backdrop();
  let last = performance.now();
  // A figure at rest draws once, at the pixel ratio of that moment. Zooming
  // in, or dragging the window to a screen of another density, changes the
  // ratio without always changing the size of the page in CSS pixels, so the
  // resize below does not always fire: the figure would then be stretched
  // from its old backing store, and go soft. The ratio is watched here, where
  // a frame is already being counted.
  let dpr = devicePixelRatio;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (behind) behind(dt);
    if (devicePixelRatio !== dpr) {
      dpr = devicePixelRatio;
      for (const f of figures) f.redraw();
    }
    for (const f of figures) if (f.live) f.tick(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.addEventListener("resize", () => { for (const f of figures) f.redraw(); });

  // The palette and the words are read once, at load: the page is reloaded on them.
  window.addEventListener("themechange", () => location.reload());
  window.addEventListener("langchange", () => location.reload());

  // --- where one is reading -----------------------------------------------------

  /** The section being read: the last one whose top is above a third of the
      window -- or the last of all, once the page is scrolled to its end. */
  const current = () => {
    const root = document.documentElement;
    if (innerHeight + scrollY >= root.scrollHeight - 4) return sections[sections.length - 1];
    let at = sections[0];
    for (const s of sections) if (s.el.getBoundingClientRect().top < innerHeight / 3) at = s;
    return at;
  };
  let reading = null;
  const follow = () => {
    const s = current();
    if (!s || s === reading) return;
    reading = s;
    toSlides.href = `${slidesPage}#/${s.from}`;
    for (const x of sections) x.el.classList.toggle("reading", x === s);
    history.replaceState(null, "", `#${s.anchor}`);
  };

  // "!!!" files a request on the review board, like on the slides: about the
  // section being read -- its first slide, and the text's own page, so that
  // the board's "Open slide" comes back here (#/<index>, as for a slide).
  askForChange(() => {
    const s = current();
    const at = slides[s.from];
    return {
      page: `read.html?l=${name}`, slide: s.from + 1,
      scene: lecture.scenes[at.scene].name || "", block: at.block,
    };
  });

  // Arriving from a slide (#slide-<index>, or #/<index> from the board): the
  // section that covers it. Or from a permalink (#<title>): that section.
  const m = /^#(?:slide-|\/)(\d+)$/.exec(location.hash);
  const sec = m ? sectionOf(Math.min(+m[1], slides.length - 1))
    : sections.find((x) => `#${x.anchor}` === decodeURIComponent(location.hash));
  if (sec) {
    sec.el.scrollIntoView({ block: "start" });
  }
  follow();
  addEventListener("scroll", follow, { passive: true });
}

// --- the backdrop -------------------------------------------------------------------

/**
 * The low-poly mesh of the slides (engine/background.js), behind the whole
 * page and fixed: the text scrolls over it, on a band of plain ground
 * (reader.css). `?bg=none` turns it off, as on the slides.
 *
 * The mesh is drawn for the 16:9 frame; the window is rarely 16:9, so the
 * renderer shows the part of the frame that FILLS it (cover, not contain).
 */
function backdrop() {
  const bg = new URLSearchParams(location.search).get("bg");
  if (bg === "none" || bg === "off") return null;
  // Three times as many facets as on a slide (9 x 5 cells, not 5 x 3): the
  // page is seen closer and longer than a slide, and larger facets read as
  // stains in the margins. The drift shrinks with the cells. And about
  // more contrast (four times in light, twice in dark, where white facets
  // glare sooner): the mesh lives in the margins only, never under the
  // words, so it can afford to be seen.
  const draw = polyBackdrop({ cols: 9, rows: 5, drift: 0.3,
                              fill: LIGHT ? [0.03, 0.13] : [0.02, 0.10] });
  const canvas = document.createElement("canvas");
  canvas.id = "backdrop";
  document.body.prepend(canvas);
  const r = new Renderer(canvas, { background: BG });
  const fit = () => {
    const k = Math.min(FRAME_WIDTH / innerWidth, FRAME_HEIGHT / innerHeight);
    const w = (innerWidth * k) / 2, h = (innerHeight * k) / 2;
    r.view = [-w, -h, w, h];
  };
  return (dt) => {
    fit();
    if (r.resize() === false) return;
    r.begin();
    draw(r, dt);
    r.end();
  };
}

// --- one figure -------------------------------------------------------------------

let playing = null;       // the figure that plays; one at a time

/** A photograph or a video of the course, as an HTML figure. */
function media(item) {
  const el = document.createElement("figure");
  el.className = "tx-fig tx-media";
  const m = document.createElement(item.video ? "video" : "img");
  // `#t=0.1`: a video shows its first frame, not a black box, before it plays.
  m.src = item.video ? `${item.video}#t=0.1` : item.image;
  if (item.video) {
    m.controls = true;
    m.muted = true;
    m.loop = true;
    m.playsInline = true;
    m.preload = "metadata";
  } else {
    m.alt = inLang(item.caption || "");
  }
  el.appendChild(m);
  return el;
}

/**
 * A figure of the lecture (engine/index.js, `figure`): a scene of its own,
 * in the part of the world it names, on its own canvas and HTML layer.
 */
class Figure {
  constructor(def) {
    this.live = false;
    this.drawn = false;
    const [x0, y0, x1, y1] = def.view;

    this.el = document.createElement("figure");
    this.el.className = "tx-fig";
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.style.aspectRatio = `${x1 - x0} / ${y1 - y0}`;
    this.canvas = document.createElement("canvas");
    const layer = document.createElement("div");
    layer.className = "fig-layer";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "play";
    stage.append(this.canvas, layer, this.button);
    this.el.append(stage);

    // On the light theme the page is white, whiter than the slide: the
    // figure takes the page's ground, so that it is not a grey box on it.
    this.renderer = new Renderer(this.canvas, { background: LIGHT ? "#FFFFFF" : BG, layer, view: def.view });
    this.player = new Player(this.renderer, [def]);
    this.player.onSlideEnd = (i) => this.ended(i);
    // A figure that only draws (no play(), no wait) has no slide of its own:
    // it is then one still picture, rather than an index out of range.
    this.ready = this.player.indexSlides().then((n) => {
      if (!n) this.player.slides = [{ scene: 0, block: 0, opts: {} }];
    });
    this.paint();
    // A figure is only redrawn every frame while it plays: a slider moved on
    // a still one (before ▶, or once it has ended) must redraw it itself, or
    // the knob moves and the picture does not follow.
    layer.addEventListener("input", () => { if (!this.live) this.redraw(); });
    // The same for a handle dragged on a still figure. Only for a handle:
    // the layer also holds code listings, and a mouse merely crossing one
    // would otherwise redraw the figure at every pointer event.
    layer.addEventListener("pointermove", (e) => {
      if (!this.live && e.target.closest(".deck-handle")) this.redraw();
    });
    this.button.addEventListener("click", () => (this.live ? this.stop() : this.play()));
    this.canvas.addEventListener("click", () => (this.live ? this.stop() : this.play()));
  }

  get last() { return this.player.slides.length - 1; }

  paint() {
    this.button.textContent = this.live ? "■" : "▶";
    const label = this.live ? W("stop") : W("play");
    this.button.title = label;
    this.button.setAttribute("aria-label", label);
    this.el.classList.toggle("live", this.live);
  }

  /** How the figure ends, drawn once. */
  async show() {
    if (this.drawn || this.live) return;
    this.drawn = true;
    await this.ready;
    await this.player.still(this.last);
    this.redraw();
  }

  redraw() {
    if (!this.drawn || this.live) return;
    if (this.renderer.resize() !== false) this.player.tick(0);
  }

  tick(dt) {
    if (this.renderer.resize() !== false) this.player.tick(dt);
  }

  async play() {
    if (playing && playing !== this) playing.stop();
    playing = this;
    this.live = true;
    this.drawn = true;
    this.paint();
    await this.ready;
    this.player.goTo(0);
  }

  /** A step of the figure is over: the next one, or the end. */
  ended(i) {
    if (!this.live || i !== this.player.index) return;
    if (i < this.last) {
      setTimeout(() => { if (this.live && this.player.index === i) this.player.goTo(i + 1); }, 400);
      return;
    }
    if (this.player.slides[i].opts.loop) return;   // a looping step goes on until stopped
    this.live = false;
    if (playing === this) playing = null;
    this.paint();
  }

  /** Back to how it ends, still. */
  async stop() {
    if (!this.live) return;
    this.live = false;
    if (playing === this) playing = null;
    this.paint();
    await this.player.still(this.last);
    this.redraw();
  }
}

// --- permalinks ---------------------------------------------------------------------

/** "Branches of machine learning" -> "branches-of-machine-learning". */
const slug = (str) => String(str).replace(/<[^>]*>|\\\(.*?\\\)/g, "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The "#" after a title: a link to it, which also copies itself. */
function permalink(anchor) {
  const a = document.createElement("a");
  a.className = "permalink";
  a.href = `#${anchor}`;
  a.textContent = "#";
  a.dataset.copied = W("copied");
  a.title = W("permalink");
  a.setAttribute("aria-label", a.title);
  a.addEventListener("click", () => {
    const url = new URL(location.href);
    url.hash = anchor;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).then(() => {
        a.classList.add("copied");
        setTimeout(() => a.classList.remove("copied"), 1200);
      }, () => {});
    }
  });
  return a;
}

// --- prose and formulas -------------------------------------------------------------

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * `\(...\)` and `\[...\]` become placeholders, typeset by typesetIn(). Not
 * `$...$`: the transcripts are template strings, where `${` is taken.
 */
const withMath = (html) => html.replace(/\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g, (m, display, inline) => (
  `<span class="${display ? "tx-math display" : "tx-math"}" data-tex="${escapeHtml(display || inline)}"></span>`));

function typesetIn(root) {
  for (const el of root.querySelectorAll(".tx-math")) {
    try {
      el.appendChild(texToSvg(el.dataset.tex, { display: el.classList.contains("display") }));
    } catch (e) {
      console.error(e);
      el.textContent = el.dataset.tex;
    }
  }
}
