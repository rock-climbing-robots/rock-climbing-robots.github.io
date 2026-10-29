// The climbing wall of the rules, drawn live: the plywood board (1400 x 800
// mm), its grid of M3 holes (pitch 15 mm, 52 x 93 holes), the holds bolted
// on two horizontally adjacent holes, the ArUco markers of the four corners
// (DICT_4X4_50, IDs 1-4), and the hold graph used to talk about planning.
//
// Everything is placed in WALL millimetres (origin at the bottom-left corner
// of the board, y up) and mapped to the slide by a `WallView`.

import { Mobject, Group, Rectangle, Polygon, Line, Dot, text, seeded,
         FG, MUTED, ACCENT, ACCENT2, ACCENT3, GOLD, LIGHT } from "../../engine/index.js";

export const WALL = { W: 800, H: 1400, pitch: 15, nx: 52, ny: 93, x0: 17.5, y0: 10 };
export const PLYWOOD = LIGHT ? "#D8B98C" : "#B89565";
export const HOLD_COLOR = LIGHT ? "#2E9E4F" : "#3FBF62";

/** Hole (i, j) of the grid, in wall millimetres. */
export const hole = (i, j) => [WALL.x0 + WALL.pitch * i, WALL.y0 + WALL.pitch * j];

/** Where the wall sits on the slide: `height` units tall, centred on `at`. */
export class WallView {
  constructor(height, at) {
    this.k = height / WALL.H;
    this.at = at;
  }
  /** Wall millimetres to slide units. */
  p([x, y]) {
    return [this.at[0] + (x - WALL.W / 2) * this.k, this.at[1] + (y - WALL.H / 2) * this.k];
  }
  len(mm) { return mm * this.k; }
  get width() { return WALL.W * this.k; }
  get height() { return WALL.H * this.k; }
}

/** The holes, drawn in one path: 4836 of them would be too many mobjects. */
class HoleGrid extends Mobject {
  constructor(view, { color = "#3A2A18", every = 1 } = {}) {
    super();
    this.c = view.p([WALL.W / 2, WALL.H / 2]);
    this.k = view.k;
    this.every = every;
    this.fillColor = color;
    this.fillOpacity = 0.85;
  }
  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.k *= k; }
  boundsPoints() {
    const hw = (WALL.W / 2) * this.k, hh = (WALL.H / 2) * this.k;
    return [[this.c[0] - hw, this.c[1] - hh], [this.c[0] + hw, this.c[1] + hh]];
  }
  drawSelf(r, alpha) {
    const { ctx } = r;
    const s = Math.max(1.7 * this.k, 0.6 / r.S);   // never thinner than a pixel
    ctx.beginPath();
    for (let i = 0; i < WALL.nx; i += this.every) {
      for (let j = 0; j < WALL.ny; j += this.every) {
        const [x, y] = hole(i, j);
        ctx.rect(this.c[0] + (x - WALL.W / 2) * this.k - s, this.c[1] + (y - WALL.H / 2) * this.k - s, 2 * s, 2 * s);
      }
    }
    r.fill(this, alpha);
  }
}

/** The board and its holes. */
export function board(view, { holes = true } = {}) {
  const plate = new Rectangle({ width: view.width, height: view.height, centre: view.at,
                                color: LIGHT ? "#8A6A40" : "#E0C79F", strokeWidth: 2,
                                fill: PLYWOOD, fillOpacity: 1 });
  plate.appearAs = "fade";
  const g = new Group(plate);
  g.plate = plate;
  if (holes) {
    g.holes = new HoleGrid(view);
    g.holes.appearAs = "fade";
    g.add(g.holes);
  }
  return g;
}

/** A hold seen from the front, bolted on holes (i, j) and (i + 1, j): a
    rounded bucket about 50 mm wide. */
export function holdShape(view, i, j, { color = HOLD_COLOR, size = 1 } = {}) {
  const [x, y] = hole(i + 0.5, j);
  const pts = [];
  const w = 26 * size, h = 22 * size;
  for (let a = 0; a <= 16; a++) {             // the lip, a half ellipse under the bolts
    const t = Math.PI + (Math.PI * a) / 16;
    pts.push([x + w * Math.cos(t), y - 4 * size + h * Math.sin(t)]);
  }
  pts.push([x + w * 0.8, y + 12 * size], [x - w * 0.8, y + 12 * size]);
  const shape = new Polygon(pts.map((p) => view.p(p)), { color, width: 2, fill: color, fillOpacity: 0.95 });
  shape.appearAs = "fade";
  return shape;
}

// --- the three difficulty levels ------------------------------------------

// Illustrations only: the rules say what each level IS (a ladder; a ladder
// with missing holds; a route going right or left), not where the holds go.
const RUNG_J = [5, 13, 21, 29, 37, 45, 53, 61, 69, 77, 85];
const LADDER_I = [16, 34];
const MISSING = new Set(["0-3", "1-4", "0-6", "1-7", "1-8", "0-9"]);   // side-rung

/** The holds of a level, each as [i, j], keyed so that the same hold can be
    followed from one level to the next. */
export function levelHolds(level) {
  const out = [];
  RUNG_J.forEach((j, r) => {
    LADDER_I.forEach((i, side) => {
      const key = `${side}-${r}`;
      if (level === 2 && MISSING.has(key)) return;
      let di = 0;
      if (level === 3) {                       // the route drifts right, then back left
        const shift = [0, 0, 3, 7, 11, 14, 14, 11, 6, 2, 0][r];
        di = shift - 5;
      }
      out.push({ key, i: i + di, j });
    });
  });
  return out;
}

// --- ArUco markers ---------------------------------------------------------

// The 4x4 bits of DICT_4X4_50, IDs 1 to 5 (cv2.aruco.drawMarker), row by row
// from the top; "1" is a white cell.
export const ARUCO_BITS = {
  1: ["0000", "1111", "1001", "1010"],
  2: ["0011", "0011", "0010", "1101"],
  3: ["1001", "1001", "0100", "0110"],
  4: ["0101", "0100", "1001", "1110"],
  5: ["0111", "1001", "1100", "1101"],
};

/** A marker `code` units wide (the black code: 6 x 6 cells, its border
    included), in a white border of `border` units, centred on `at`. */
export function aruco(id, code, border, at) {
  const cell = code / 6;
  const white = new Rectangle({ width: code + 2 * border, height: code + 2 * border, centre: at,
                                color: MUTED, strokeWidth: 1, fill: "#FFFFFF", fillOpacity: 1 });
  const black = new Rectangle({ width: code, height: code, centre: at, strokeWidth: 0,
                                fill: "#000000", fillOpacity: 1 });
  const cells = [];
  ARUCO_BITS[id].forEach((row, r) => [...row].forEach((b, c) => {
    if (b !== "1") return;
    cells.push(new Rectangle({ width: cell * 1.02, height: cell * 1.02, strokeWidth: 0,
                               centre: [at[0] - code / 2 + cell * (c + 1.5), at[1] + code / 2 - cell * (r + 1.5)],
                               fill: "#FFFFFF", fillOpacity: 1 }));
  }));
  const g = new Group(white, black, ...cells);
  for (const m of g.walk()) m.appearAs = "fade";
  return g;
}

/** The four wall markers: 100 mm code, 18 mm white border, the outer corner
    of the border on the corner of the wall. */
export function wallMarkers(view) {
  const half = 68;
  const corners = { 1: [half, WALL.H - half], 2: [WALL.W - half, WALL.H - half],
                    3: [half, half], 4: [WALL.W - half, half] };
  return Object.entries(corners).map(([id, c]) => {
    const m = aruco(Number(id), view.len(100), view.len(18), view.p(c));
    m.id = Number(id);
    return m;
  });
}

// --- planning: the holds as a graph ----------------------------------------

// A scattered wall: holds drawn at random once, at module load (seeded), at
// least 110 mm apart. A limb reaches from one hold to another within REACH.
export const REACH = 290;
const rnd = seeded(7);
export const GRAPH_HOLDS = (() => {
  const pts = [];
  let guard = 0;
  while (pts.length < 34 && guard++ < 5000) {
    const i = Math.floor(3 + rnd() * 44), j = Math.floor(4 + rnd() * 86);
    const p = hole(i + 0.5, j);
    if (pts.every((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) > 120)) pts.push({ i, j, p });
  }
  return pts;
})();

/** Edges between holds within reach. */
export const GRAPH_EDGES = (() => {
  const e = [];
  GRAPH_HOLDS.forEach((a, u) => GRAPH_HOLDS.forEach((b, v) => {
    if (v > u && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) <= REACH) e.push([u, v]);
  }));
  return e;
})();

/** A* (or Dijkstra with `heuristic: false`) from the lowest hold to the
    highest: the order in which nodes are expanded, and the path found. */
export function search({ heuristic = true } = {}) {
  const H = GRAPH_HOLDS;
  const start = H.reduce((b, h, k) => (h.p[1] < H[b].p[1] ? k : b), 0);
  const goal = H.reduce((b, h, k) => (h.p[1] > H[b].p[1] ? k : b), 0);
  const d = (u, v) => Math.hypot(H[u].p[0] - H[v].p[0], H[u].p[1] - H[v].p[1]);
  const adj = H.map(() => []);
  for (const [u, v] of GRAPH_EDGES) { adj[u].push(v); adj[v].push(u); }
  const g = H.map(() => Infinity), prev = H.map(() => -1), closed = new Set();
  g[start] = 0;
  const open = new Set([start]);
  const order = [];
  while (open.size) {
    let u = -1, best = Infinity;
    for (const x of open) {
      const f = g[x] + (heuristic ? d(x, goal) : 0);
      if (f < best - 1e-9 || (Math.abs(f - best) < 1e-9 && x < u)) { best = f; u = x; }
    }
    open.delete(u);
    closed.add(u);
    order.push(u);
    if (u === goal) break;
    for (const v of adj[u]) {
      if (closed.has(v)) continue;
      const ng = g[u] + d(u, v);
      if (ng < g[v]) { g[v] = ng; prev[v] = u; open.add(v); }
    }
  }
  const path = [];
  for (let x = goal; x !== -1; x = prev[x]) path.unshift(x);
  return { start, goal, order, path };
}

/** The graph over the holds: one dot per hold, one line per edge. */
export function holdGraph(view) {
  const dots = GRAPH_HOLDS.map((h) => new Dot(view.p(h.p), { radius: 0.085, color: FG }));
  const edges = GRAPH_EDGES.map(([u, v]) => new Line(view.p(GRAPH_HOLDS[u].p), view.p(GRAPH_HOLDS[v].p),
                                                     { color: MUTED, width: 2 }));
  edges.forEach((e) => e.setOpacity(0.7));
  const holds = GRAPH_HOLDS.map((h) => holdShape(view, h.i, h.j, { size: 0.9 }));
  return { dots, edges, holds };
}

export const SEARCH_COLORS = { visited: ACCENT2, path: GOLD, start: ACCENT3, goal: ACCENT };
export { text };
