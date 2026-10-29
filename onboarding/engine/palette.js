// The two palettes of the deck, and which one is in force.
//
// The slides are drawn on a black stage by default. The landing page and
// the practical subjects can be switched to a light theme (theme-toggle.js
// writes data-theme on <html> and remembers it), and the slides follow: the
// same choice, read once here, decides the ink of every stroke, the colour
// of the accents and the ground the canvas is cleared to.
//
// Read ONCE at load: a mobject keeps the colour it was built with, so the
// page has to be reloaded to change theme -- which is what happens anyway,
// the switch living on another page.
//
// It carries no import, on purpose: engine/theme.js and engine/mathjax.js
// both need it, and mathjax.js is reached from theme.js through text.js.

const url = typeof location !== "undefined"
  ? new URLSearchParams(location.search).get("theme") : null;
const attr = typeof document !== "undefined"
  ? document.documentElement.dataset.theme : null;

/** True when the slides are drawn on a light ground. */
export const LIGHT = (url || attr) === "light";

const pick = (dark, light) => (LIGHT ? light : dark);

// The ground, and the ink drawn on it.
export const BG = pick("#000000", "#F4F4F1");
export const FG = pick("#FFFFFF", "#1B1B21");
export const MUTED = pick("#BBBBBB", "#63636E");

// The 3b1b accents. Chosen for a black ground, they turn pale on a white
// one: the light column is the same hue, darkened until it reads.
export const ACCENT = pick("#FC6255", "#B93B2E");    // red
export const ACCENT2 = pick("#58C4DD", "#17708F");   // blue
export const ACCENT3 = pick("#83C167", "#3D7A2A");   // green
export const GOLD = pick("#F0AC5F", "#9C6410");
// A true orange, a step warmer and more saturated than GOLD, for when the two
// must be told apart on the same slide.
export const ORANGE = pick("#FF862F", "#C4530A");
export const VIOLET = pick("#A98BE8", "#6B46C1");
// A true yellow, for a box that has to be SEEN (a turn in the lecture) --
// lighter and greener than GOLD.
export const YELLOW = pick("#F7E26B", "#B89600");

// A neutral grey for the segments of a mechanism, a chain, a graph edge.
export const LINK = pick("#888888", "#8E8E99");
export const GRID_COLOR = pick("#2E2E33", "#DEDEDA");
// The wireframe of a solid carries the shape, so it is a step darker than the
// reference grid, which is only a ruler.
export const MESH = pick("#2E2E33", "#BEBEB8");
