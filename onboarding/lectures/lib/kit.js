// Furniture shared by the slides of the on-boarding: films, figures on a
// white plate, bullets, links, terminal commands and the "how to get it"
// block of a tool (pip install, GitHub, documentation). Adapted from the
// Rhoban team's deck (~/slides_rhoban/lectures/lib/contributions.js).

import { Group, Rectangle, Dot, text, tex, image, link, code, video, slideTitle,
         FG, MUTED, ORANGE, LEFT, DOWN, LIGHT } from "../../engine/index.js";

// The GitHub and Read the Docs logos: dark ink on the light theme, a white
// copy on the dark one.
const LOGO = (n) => `logo_${n}${LIGHT ? "" : "_dark"}.png`;
export const KIT_IMAGES = [LOGO("github"), LOGO("readthedocs")];

const V = "assets/videos/";

/** A film, `width` units wide, centred on `at`. */
export function clip(name, aspect, width, at) {
  return video(`${V}${name}.mp4`, { width, at, aspect }).hold(0);
}

/** A picture fitted in a `w` x `h` box centred on `at` (aspect kept). */
export function picture(name, w, h, at) {
  const img = image(name, { height: 1 });
  const k = Math.min(w / img.w, h / img.h);
  img.scale(k).moveTo(at);
  img.appearAs = "fade";
  return img;
}

/** A picture on a white plate (figures drawn on white, logos in dark ink),
    fitted in a `w` x `h` box centred on `at`. */
export function plated(name, w, h, at, { pad = 0.15 } = {}) {
  const img = picture(name, w - 2 * pad, h - 2 * pad, at);
  const b = img.bbox();
  const plate = new Rectangle({ width: b.x1 - b.x0 + 2 * pad, height: b.y1 - b.y0 + 2 * pad, centre: at,
                                corner: 0.12, color: MUTED, strokeWidth: 2, fill: "#FFFFFF", fillOpacity: 1 });
  plate.appearAs = "fade";
  return new Group(plate, img);
}

/** A long string broken into lines no wider than `width`. */
export function wrapped(str, width, opts = {}) {
  const t = text(str, opts);
  const ctx = (wrapped.ctx ||= document.createElement("canvas").getContext("2d"));
  ctx.font = `${t.style}${t.weight} 100px ${t.family}`;
  const wide = (s) => (ctx.measureText(s).width / 100) * t.unit;
  const lines = [];
  let cur = "";
  for (const w of t.str.split(" ")) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (cur && wide(tryLine) > width) { lines.push(cur); cur = w; }
    else cur = tryLine;
  }
  if (cur) lines.push(cur);
  t.str = lines.join("\n");
  t.measure();
  return t.moveTo([0, 0]);
}

/** Bullets, left aligned, a dot each; `tex` so that \textbf works. */
export function bullets(lines, { size = 28, color = FG, gap = 0.3 } = {}) {
  const rows = lines.map((l) => {
    const t = tex(l, { size, color });
    const d = new Dot([0, 0], { radius: 0.055, color });
    d.moveTo([t.bbox().x0 - 0.28, t.bbox().y1 - (size / 48) * 0.22]);
    return new Group(d, t);
  });
  return new Group(...rows).arrange(DOWN, { buff: gap, aligned: LEFT });
}

/** Pin a mobject by its LEFT edge and its vertical middle. */
export const leftAt = (m, x, y) => {
  const b = m.bbox();
  return m.shift([x - b.x0, y - (b.y0 + b.y1) / 2]);
};

/** Pin a mobject by its LEFT edge and its TOP. */
export const topLeft = (m, x, y) => {
  const b = m.bbox();
  return m.shift([x - b.x0, y - b.y1]);
};

/** A row: an icon in a slot of fixed width, then a clickable link. */
const ICON_SLOT = 0.55, ICON_W = 0.46;
export function linkRow(iconName, label, href, { size = 24 } = {}) {
  const ic = image(LOGO(iconName), { height: 1 });
  ic.appearAs = "fade";
  const b = ic.bbox();
  ic.scale(ICON_W / (b.x1 - b.x0)).moveTo([ICON_SLOT / 2, 0]);
  const a = link(label, href, { size, color: ORANGE });
  a.shift([ICON_SLOT + 0.2 - a.bbox().x0, -a.center()[1]]);
  return new Group(ic, a);
}

// A command reads as one: white on black, like a terminal, in BOTH themes.
if (!document.getElementById("terminal-style")) {
  const st = document.createElement("style");
  st.id = "terminal-style";
  st.textContent = `
    .code-window.terminal, html[data-theme="light"] .code-window.terminal {
      background: #0d1117; border-color: #30363d; }
    .code-window.terminal .hljs, .code-window.terminal .hljs *,
    html[data-theme="light"] .code-window.terminal .hljs,
    html[data-theme="light"] .code-window.terminal .hljs * {
      color: #f0f6fc; background: none; }`;
  document.head.appendChild(st);
}

// A code example is dark in BOTH themes too: github-dark's colours, restored
// over the light theme's overrides (site.css).
const DARK_HLJS = [
  [".hljs", "#c9d1d9"],
  [".hljs-doctag, .hljs-keyword, .hljs-meta .hljs-keyword, .hljs-template-tag, .hljs-template-variable, " +
   ".hljs-type, .hljs-variable.language_", "#ff7b72"],
  [".hljs-title, .hljs-title.class_, .hljs-title.function_", "#d2a8ff"],
  [".hljs-attr, .hljs-attribute, .hljs-literal, .hljs-meta, .hljs-number, .hljs-operator, .hljs-variable, " +
   ".hljs-selector-attr, .hljs-selector-class, .hljs-selector-id", "#79c0ff"],
  [".hljs-meta .hljs-string, .hljs-regexp, .hljs-string", "#a5d6ff"],
  [".hljs-built_in, .hljs-symbol", "#ffa657"],
  [".hljs-code, .hljs-comment, .hljs-formula", "#8b949e"],
  [".hljs-name, .hljs-quote, .hljs-selector-pseudo, .hljs-selector-tag", "#7ee787"],
  [".hljs-subst", "#c9d1d9"],
];
if (!document.getElementById("dark-code-style")) {
  const st = document.createElement("style");
  st.id = "dark-code-style";
  const scope = 'html[data-theme="light"] .code-window.dark-code';
  st.textContent = `${scope} { background: #0d1117; border-color: #30363d; }\n${scope} .hljs { background: none; }\n` +
    DARK_HLJS.map(([sel, c]) => `${sel.split(", ").map((x) => `${scope} ${x}`).join(", ")} { color: ${c}; }`)
      .join("\n");
  document.head.appendChild(st);
}

/** A code example: no title bar, dark in both themes. */
export function snippet(src, { language = "python", size = 18 } = {}) {
  const c = code(src, { language, bar: false, size });
  c.entry.el.classList.add("dark-code");
  return c;
}

/** A shell command, in a terminal box. */
export function command(src, size = 22) {
  const c = code(src, { language: "python", bar: false, size });
  c.entry.el.classList.add("terminal");
  return c;
}

/** How to get a tool: its install command, its GitHub, its documentation.
    `install` is the whole command ("pip install placo"); `docs` a full URL. */
export function getIt(install, github, docs, { size = 22, linkSize = 24 } = {}) {
  const rows = [];
  for (const cmd of [].concat(install || [])) rows.push(command(`$ ${cmd}`, size));
  if (github) rows.push(linkRow("github", github, `https://github.com/${github}`, { size: linkSize }));
  if (docs) rows.push(linkRow("readthedocs", docs.replace(/^https?:\/\//, "").replace(/\/$/, ""), docs,
                              { size: linkSize }));
  return new Group(...rows).arrange(DOWN, { buff: 0.3, aligned: LEFT });
}

/** A rounded card behind a block. */
export function card(w, h, at, { color = MUTED } = {}) {
  const r = new Rectangle({ width: w, height: h, centre: at, corner: 0.18, color,
                            strokeWidth: 2, fill: color, fillOpacity: 0.07 });
  return r;
}

/** Words in rounded pills, on one row centred on `centre`. */
export function pills(words, centre, { size = 25, gap = 0.2, color = MUTED } = {}) {
  const labels = words.map((w) => text(w, { size }));
  const widths = labels.map((l) => l.bbox().x1 - l.bbox().x0 + 0.4);
  let x = centre[0] - (widths.reduce((t, w) => t + w, 0) + gap * (words.length - 1)) / 2;
  return labels.map((label, k) => {
    const at = [x + widths[k] / 2, centre[1]];
    x += widths[k] + gap;
    return new Group(new Rectangle({ width: widths[k], height: 0.54, centre: at, corner: 0.27,
                                     color, strokeWidth: 1.5, fill: color, fillOpacity: 0.1 }),
                     label.moveTo(at));
  });
}

export { slideTitle };
