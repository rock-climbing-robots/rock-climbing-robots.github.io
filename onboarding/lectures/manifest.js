// The lectures of the course, in order. The landing page builds its table of
// contents from this list; each entry points at the page that presents the
// lecture. A title may be a string, or one per language: { en: "...", fr: "..." }.
//
// `node ~/.claude/skills/make-anim-slides/install.mjs deck . <NN_slug> "<Title>"`
// adds an entry here, with its page and its lecture module. `text: true` marks
// a lecture that has its text (lectures/text/<NN_slug>.js, read.html): the
// landing page and the slides then lead to it (`deck ... --text`, or `text`).

export const lectures = [
  { number: "01", title: "Hackathon on-boarding", page: "01_onboarding.html" },
];

/** The practicals: the subject pages, and the archive each one hands out.
    { number: 1, title, page: "tp_slug.html", zip: "files/tp_slug.zip" } --
    the landing page shows the number (or "TP" without one) and an "archive"
    chip inside the card when there is a `zip`. */
export const practicals = [
];
