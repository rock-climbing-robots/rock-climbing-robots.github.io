# Rock Climbing Robots — notes for Claude

@docs/anim-slides.md

The file above is the guide to the slides kit (engine, conventions, review
board, publishing). It is MANAGED by the make-anim-slides skill and
overwritten on update: do not edit it here. Everything specific to this
course goes below.

## The course

- **Subject:** On-boarding of the Rock Climbing Robots 2026 hackathon competitors: logistics, rules, recommended tools
- **Audience:** Hackathon competitors (students, PhD students, researchers in robotics/AI)
- **Language of the slides:** en
- **Deck:** one lecture, `01_onboarding`, in three scenes (one per part):
  logistics (from the website `../index.html`), the rules step by step
  (`~/rcr_rules/rulebook.tex`, v1.1), recommended tools. Slides are makers in
  `lectures/lib/part{1,2,3}.js`, run by `lectures/lib/runner.js`; the wall,
  holds, ArUco markers and hold graph are drawn live by `lectures/lib/wall.js`.
  Material reused from `~/slides_rhoban` (PlaCo, BAM, onshape-to-robot) and
  `~/intro_rl` (SB3, mjlab).
- **Notations and conventions:** a tool slide gives, when there is one, its
  install command, GitHub repository and documentation (`getIt` in
  `lectures/lib/kit.js`).

## Course-specific code

Drawings of its own (a mechanism, a graph, a simulation) go in
`lectures/lib/`, never in `engine/`.

## Lectures with a text

A lecture marked `text: true` in `lectures/manifest.js` also has a text
(`lectures/text/<NN_slug>.js`, read on `read.html?l=<NN_slug>`). Every change
to its slides updates its text in the same change, and its illustrations are
functions the text plays as figures: see "The text mode" in the guide.
