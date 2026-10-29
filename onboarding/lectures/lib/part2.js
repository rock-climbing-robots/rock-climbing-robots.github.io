// Part 2: the challenge, as the rulebook says it (~/rcr_rules/rulebook.tex,
// v1.1), section by section: overview, robots, wall, holds, setup, ArUco
// markers, perception, simulation, evaluation and scoring.

import { Group, Rectangle, Circle, Line, DoubleArrow, Dot, Value, text, tex, math, link,
         slideTitle, dimension, redraw, lagged, appear, to, FadeIn, FadeOut, Write, Create,
         TransformFromCopy, valueTo, linear,
         FG, MUTED, ACCENT, ACCENT2, ACCENT3, GOLD, ORANGE, LEFT, DOWN, RIGHT,
         TITLE_FONT } from "../../engine/index.js";
import { clip, picture, plated, bullets, leftAt, topLeft, wrapped, card } from "./kit.js";
import { WallView, WALL, board, holdShape, hole, levelHolds, wallMarkers, aruco,
         HOLD_COLOR } from "./wall.js";
import { SIMULATOR } from "./part1.js";

export const PART2_IMAGES = ["microban_front.png", "microban_side.png", "hold_iso.png", "rules_setup.png",
                             "mapping.jpg"];

const sub = (str, y, { color = GOLD, x = null } = {}) => {
  const t = text(str, { size: 30, weight: "medium", font: TITLE_FONT, color });
  return x === null ? t.moveTo([0, y]) : leftAt(t, x, y);
};

// --- overview ------------------------------------------------------------------

export function overviewSlide() {
  const title = slideTitle("The challenge");
  const film = clip("microban_climb", 16 / 9, 6.3, [-3.55, 0.45]);
  const cap = text("Microban climbing in simulation", { size: 25, color: MUTED }).moveTo([-3.55, -1.6]);
  const list = bullets([
    "Small \\textbf{legged robots}",
    "\\textbf{Climb} from start zone to top",
    "\\textbf{Safety rope} over a pulley",
    "\\textbf{Teams} of 2 to 6",
    "\\textbf{Two evaluations}: sim and real",
  ], { size: 29, gap: 0.38 });
  leftAt(list, 0.6, 0.2);
  return { parts: [title, film, cap, list], clips: [film] };
}

// The three challenges of the website, which can be tackled independently.
const CHALLENGES = [
  ["1", "Perception", ACCENT2, ["3D model of the wall", "Robot pose, real time"],
   "skip it: use markers"],
  ["2", "Planning", GOLD, ["Path and", "contact sequence"],
   "skip it: plan provided"],
  ["3", "Control", ACCENT3, ["Whole-body execution", "on the real robot"],
   ""],
];

export function challengesSlide() {
  const title = slideTitle("Three challenges");
  const parts = [title];
  CHALLENGES.forEach(([n, name, color, lines, note], k) => {
    const x = -4.6 + k * 4.6;
    parts.push(card(4.25, 5.0, [x, -0.05], { color }));
    parts.push(text(`${n}. ${name}`, { size: 36, weight: "medium", font: TITLE_FONT, color }).moveTo([x, 1.95]));
    parts.push(new Group(...lines.map((l) => text(l, { size: 28 }))).arrange(DOWN, { buff: 0.18 }).moveTo([x, 0.5]));
    if (note) parts.push(text(note, { size: 25, color: MUTED }).moveTo([x, -1.4]));
  });
  parts.push(text("Independent: pick one, or combine", { size: 30, color: FG }).moveTo([0, -3.3]));
  return { parts };
}

// --- robots --------------------------------------------------------------------

export function morphologySlide() {
  const title = slideTitle("Robots: morphology and size");
  const robot = picture("microban_front.png", 3.4, 5.4, [-4.6, -0.3]);
  const b = robot.bbox();
  const size = new DoubleArrow([b.x1 + 0.45, b.y0], [b.x1 + 0.45, b.y1], { color: GOLD, width: 3, tipLength: 0.2 });
  const sizeLab = new Group(text("≤ 400 mm", { size: 30, color: GOLD }),
                            text("upright", { size: 25, color: MUTED }))
    .arrange(DOWN, { buff: 0.1, aligned: LEFT });
  leftAt(sizeLab, b.x1 + 0.7, -0.3);
  const morpho = bullets([
    "Climbs with its \\textbf{limbs}; trunk may touch",
    "\\textbf{Humanoid} = 4 limbs + trunk",
    "\\textbf{Non-humanoid} allowed (×1.1)",
    "Attached \\textbf{only through holds}",
  ], { size: 28, gap: 0.3 });
  topLeft(morpho, -0.3, 2.3);
  const dims = bullets([
    "Height \\textbf{$\\le$ 400 mm} (upright posture)",
    "Width, depth: \\textbf{free}",
    "Mass \\textbf{$\\le$ 2 kg}",
  ], { size: 28, gap: 0.3, color: GOLD });
  topLeft(dims, -0.3, morpho.bbox().y0 - 0.4);
  return { parts: [title, robot, morpho], steps: [{ parts: [size, sizeLab, dims] }] };
}

export function powerSlide() {
  const title = slideTitle("Robots: power, control and autonomy");
  const left = [sub("Power", 1.9, { color: ACCENT2, x: -6.4 }), bullets([
    "\\textbf{Batteries}, or",
    "\\textbf{External supply} along the rope",
    "Tether \\textbf{never load-bearing}",
  ], { size: 29, gap: 0.36 })];
  topLeft(left[1], -6.2, 1.35);
  const right = [sub("Control", 1.9, { color: ACCENT3, x: 0.6 }), bullets([
    "Computing \\textbf{on- or off-board}",
    "Any link: Ethernet, Wi-Fi, BT...",
  ], { size: 29, gap: 0.36 })];
  topLeft(right[1], 0.8, 1.35);
  const auto = text("Autonomous: no teleoperation", { size: 40, weight: "medium", font: TITLE_FONT, color: ACCENT });
  auto.moveTo([0, -2.1]);
  const box = new Rectangle({ width: auto.bbox().x1 - auto.bbox().x0 + 0.8, height: 1.0, centre: [0, -2.1],
                              corner: 0.15, color: ACCENT, strokeWidth: 3 });
  return { parts: [title, ...left, ...right], steps: [{ parts: [box, auto] }] };
}

export function providedSlide() {
  const title = slideTitle("Provided robots: Microban");
  const front = picture("microban_front.png", 2.5, 4.4, [-5.7, -0.2]);
  const side = picture("microban_side.png", 2.6, 4.4, [-3.3, -0.4]);
  const intro = bullets(["Open-source, \\textbf{3D-printable} (Rhoban)", "\\textbf{Limbs adapted} for climbing",
                         "\\textbf{4 robots}: one per wall"],
                        { size: 28, gap: 0.3 });
  topLeft(intro, -1.1, 2.6);
  const rows = [["Actuators", "19 × XL330-M288-T"], ["DoF", "6 per leg, 3 per arm"],
                ["Height", "≈ 300 mm"]];
  const table = [];
  rows.forEach(([k, v], r) => {
    const y = 0.2 - r * 0.62;
    table.push(leftAt(text(k, { size: 28, color: MUTED }), -1.1, y));
    table.push(leftAt(text(v, { size: 28 }), 1.0, y));
  });
  const repo = link("github.com/Rhoban/microban", "https://github.com/Rhoban/microban", { size: 26, color: ORANGE });
  leftAt(repo, 1.0, 0.2 - 3 * 0.62);
  table.push(leftAt(text("Repo", { size: 28, color: MUTED }), -1.1, 0.2 - 3 * 0.62), repo);
  const note = text("Photos: Microban repository", { size: 22, color: MUTED }).moveTo([-4.0, -3.2]);
  return { parts: [title, front, side, intro, ...table, note] };
}

// --- the wall ------------------------------------------------------------------

const VIEW = new WallView(5.9, [-3.9, -0.1]);

/** The wall, its dimensions, and what the rules say about it. */
function wallPicture() {
  const b = board(VIEW);
  const p = (x, y) => VIEW.p([x, y]);
  const h = dimension(p(0, 0), p(0, WALL.H), "1400", { size: 30, offset: 0.4 });
  const w = dimension(p(WALL.W, 0), p(0, 0), "800", { size: 30, offset: 0.35 });
  return { b, dims: [h, w] };
}

const WALL_FACTS = [
  "\\textbf{4 identical walls}",
  "\\textbf{1400 × 800 mm}, plywood 10 mm",
  "\\textbf{M3 holes}, 15 mm grid",
  "Holds bolted, \\textbf{nuts at the rear}",
];

export function wallSlide() {
  const title = slideTitle("The climbing wall");
  const { b, dims } = wallPicture();
  const list = bullets(WALL_FACTS, { size: 30, gap: 0.42 });
  leftAt(list, -0.6, 0.0);
  return { parts: [title, b, ...dims, list] };
}

// The three levels: a ladder; a ladder with missing holds; a route that
// moves right or left. The holds of one level travel to the next.
const LEVELS = [
  ["Level 1", "\\textbf{Ladder}", "×1.5"],
  ["Level 2", "\\textbf{Missing holds}", "×1.25"],
  ["Level 3", "Moves \\textbf{left / right}", "×1"],
];

export function levelsSlide() {
  const title = slideTitle("Three difficulty levels");
  const { b } = wallPicture();
  const rows = LEVELS.map(([name, what, factor], k) => {
    const y = 1.8 - k * 1.55;
    const n = leftAt(text(name, { size: 32, weight: "medium", font: TITLE_FONT }), -0.6, y);
    const d = leftAt(tex(what, { size: 29 }), 1.6, y);
    const f = leftAt(text(factor, { size: 29, color: GOLD }), 5.5, y);
    return new Group(n, d, f);
  });
  const note = text("Holds reconfigured during the event\n(layouts shown: illustrations)", { size: 25, color: MUTED });
  topLeft(note, -0.6, -2.6);
  const H = [1, 2, 3].map((l) => new Map(levelHolds(l).map((h) => [h.key, h])));
  const holds = [...H[0].values()].map((h) => holdShape(VIEW, h.i, h.j));
  const keys = [...H[0].keys()];
  const marker = new Rectangle({ width: 7.7, height: 1.2, centre: [3.15, 1.8], corner: 0.15, color: GOLD, strokeWidth: 3 });
  const parts = [title, b, ...rows, note, ...holds, marker];
  return {
    parts,
    async play(s) {
      s.add(title, b);
      await s.play(lagged(rows.map((r) => appear(r)), { lag: 0.2 }), { runTime: 1.2 });
      await s.play(new Create(marker), lagged(holds.map((m) => new FadeIn(m, { scale: 0.5 })), { lag: 0.03 }),
                   { runTime: 1.2 });
      await s.nextSlide();
      // Level 2: some holds go.
      await s.play(to(marker, (m) => m.moveTo([3.15, rows[1].center()[1]])),
                   ...keys.map((k, n) => (H[1].has(k) ? null : to(holds[n], (m) => m.setOpacity(0))))
                     .filter(Boolean), { runTime: 1.0 });
      await s.nextSlide();
      // Level 3: they come back, and the route drifts sideways.
      await s.play(to(marker, (m) => m.moveTo([3.15, rows[2].center()[1]])),
                   ...keys.map((k, n) => to(holds[n], (m) => {
                     const h = H[2].get(k), h0 = H[0].get(k);
                     return m.shift([VIEW.len(WALL.pitch * (h.i - h0.i)), 0]).setOpacity(1);
                   })), new FadeIn(note), { runTime: 1.4 });
      await s.nextSlide();
    },
  };
}

// --- mounting the holds -----------------------------------------------------------

/** The holds of a new layout are projected on the wall, where they go; then a
    call for hands to bolt them on. */
export function mappingSlide() {
  const title = slideTitle("Mounting the holds");
  const photo = picture("mapping.jpg", 3.6, 6.4, [-4.6, -0.45]);
  const list = bullets([
    "A \\textbf{video projector} shows the layout",
    "Each hold \\textbf{outlined} where it goes",
    "Bolt each hold \\textbf{on its outline}",
    "Same for every \\textbf{level change}",
  ], { size: 29, gap: 0.34 });
  topLeft(list, -2.1, 2.3);
  const help = card(8.6, 1.7, [2.2, -2.2], { color: GOLD });
  const ask = text("Your help is welcome to mount the holds!", { size: 30, weight: "medium", font: TITLE_FONT,
                                                                 color: GOLD }).moveTo([2.2, -1.95]);
  const thanks = text("Many hands, quick setup: thank you!", { size: 26, color: MUTED }).moveTo([2.2, -2.55]);
  return { parts: [title, photo, list], steps: [{ parts: [help, ask, thanks] }] };
}

// --- holds ---------------------------------------------------------------------

/** The hold seen from the front, large: the two bolts on adjacent holes, the
    envelope (diameter 60 mm) centred between them. */
function holdSpec(at) {
  const k = 0.042;                                     // units per mm
  const P = (x, y) => [at[0] + x * k, at[1] + y * k];
  const grid = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    if (Math.abs(j) < 3) grid.push(new Dot(P(15 * i, 15 * j), { radius: 0.035, color: MUTED }));
  }
  const bolts = [-7.5, 7.5].map((x) => new Circle(P(x, 0), 1.8 * k * 2.2, { color: GOLD, width: 4 }));
  const env = new Circle(at, 30 * k, { color: ACCENT2, width: 4 });
  const pitch = dimension(P(7.5, 0), P(-7.5, 0), "15", { size: 28, offset: 0.65, color: GOLD });
  const dia = dimension(P(30, 0), P(-30, 0), "\\varnothing\\,60", { size: 28, offset: 1.75, color: ACCENT2 });
  const cap = text("front view (mm)", { size: 23, color: MUTED }).moveTo([at[0], at[1] + 1.65]);
  return [...grid, env, ...bolts, pitch, dia, cap];
}

export function holdsSlide() {
  const title = slideTitle("Holds");
  const iso = picture("hold_iso.png", 2.8, 2.8, [-5.4, 0.85]);
  const spec = holdSpec([-1.9, 0.9]);
  const top = bullets([
    "\\textbf{Provided} holds",
    "\\textbf{Your own} allowed",
  ], { size: 29, gap: 0.35 });
  leftAt(top, 1.4, 0.9);
  const rules = bullets([
    "\\textbf{2 × M3 bolts}, adjacent holes (15 mm), nuts at the rear",
    "Fits in a \\textbf{cylinder Ø 60 × 100 mm}, normal to the wall",
  ], { size: 28, gap: 0.32, color: FG });
  topLeft(rules, -6.3, -1.3);
  return { parts: [title, iso, ...spec, top], steps: [{ parts: [rules] }] };
}

// --- setup ---------------------------------------------------------------------

export function setupSlide() {
  const title = slideTitle("Setup around a wall");
  const fig = plated("rules_setup.png", 6.0, 6.6, [-3.75, -0.45]);
  const list = bullets([
    "\\textbf{2 USB cameras} per wall",
    "Placed by the organizers",
    "\\textbf{You plug} them in",
    "\\textbf{RGB only}",
    "Cables \\textbf{along the rope}",
    "Robot needs an \\textbf{anchor point}",
  ], { size: 29, gap: 0.34 });
  leftAt(list, -0.2, -0.45);
  return { parts: [title, fig, list] };
}

// --- ArUco markers -------------------------------------------------------------

const AVIEW = new WallView(6.2, [-4.0, -0.35]);

export function arucoSlide() {
  const title = slideTitle("ArUco markers");
  const b = board(AVIEW);
  const marks = wallMarkers(AVIEW);
  const labels = marks.map((m) => {
    const c = m.center(), right = c[0] > AVIEW.at[0];
    return text(`ID ${m.id}`, { size: 26, color: GOLD }).moveTo([c[0] + (right ? 1.0 : -1.0), c[1]]);
  });
  // ID 5 on a robot, anywhere, any size: a box standing for it.
  const rc = AVIEW.p([420, 520]);
  const robot = new Rectangle({ width: 1.0, height: 1.3, centre: rc, corner: 0.1, color: FG, strokeWidth: 3,
                                fill: MUTED, fillOpacity: 0.5 });
  const m5 = aruco(5, 0.42, 0.07, [rc[0], rc[1] + 0.25]);
  const l5t = text("ID 5: robot", { size: 25, color: "#111111" }).moveTo([rc[0], rc[1] - 1.0]);
  const l5 = new Group(new Rectangle({ width: l5t.bbox().x1 - l5t.bbox().x0 + 0.3, height: 0.5, centre: l5t.center(),
                                       corner: 0.1, strokeWidth: 0, fill: "#ffffff", fillOpacity: 0.95 }), l5t);
  const facts = bullets([
    "\\textbf{IDs 1–4}: wall corners",
    "\\textbf{DICT_4X4_50}",
    "100 mm code + 18 mm border",
    "Gives camera \\textbf{extrinsics}",
  ], { size: 29, gap: 0.34 });
  topLeft(facts, 0.3, 2.3);
  const robotFact = bullets(["\\textbf{ID 5}: robot, any place, any size"],
                            { size: 29, color: ACCENT3 });
  topLeft(robotFact, 0.3, facts.bbox().y0 - 0.35);
  return { parts: [title, b, ...marks, ...labels, facts],
           steps: [{ parts: [robot, m5, l5, robotFact] }] };
}

// --- perception ----------------------------------------------------------------

export function perceptionSlide() {
  const title = slideTitle("Perception: two modes");
  const L = [card(6.4, 4.0, [-3.4, 0.35], { color: GOLD }),
    text("With ArUco markers", { size: 34, weight: "medium", font: TITLE_FONT, color: GOLD }).moveTo([-3.4, 1.85]),
    text("time × 1.25", { size: 27, color: GOLD }).moveTo([-3.4, 1.25])];
  const lb = bullets([
    "Extrinsics \\textbf{given}",
    "Robot: marker ID 5,",
    "or detected (e.g. learned)",
  ], { size: 29, gap: 0.32 });
  topLeft(lb, -6.2, 0.75);
  const R = [card(6.4, 4.0, [3.4, 0.35], { color: ACCENT3 }),
    text("Markerless", { size: 34, weight: "medium", font: TITLE_FONT, color: ACCENT3 }).moveTo([3.4, 1.85]),
    text("time × 1", { size: 27, color: ACCENT3 }).moveTo([3.4, 1.25])];
  const rb = bullets([
    "\\textbf{No marker} at all",
    "Extrinsics \\textbf{not given}",
    "Cameras \\textbf{moved} each attempt",
  ], { size: 29, gap: 0.32 });
  topLeft(rb, 0.6, 0.75);
  const foot = text("On-board cameras allowed, same two modes",
                    { size: 28, color: MUTED }).moveTo([0, -2.55]);
  return { parts: [title, ...L, lb], steps: [{ parts: [...R, rb] }, { parts: [foot] }] };
}

// --- simulation ----------------------------------------------------------------

export function simulationSlide() {
  const title = slideTitle("Simulation");
  const film = clip("microban_climb", 16 / 9, 5.8, [-3.9, 0.3]);
  const list = bullets([
    "\\textbf{MuJoCo} (CPU)",
    "Robot, walls, holds \\textbf{provided}",
    "Same \\textbf{3 levels}",
    "\\textbf{Rendered} camera images",
    "Same \\textbf{modes and ranking}",
  ], { size: 29, gap: 0.36 });
  leftAt(list, 0.0, 0.3);
  const repo = link("github.com/rock-climbing-robots/simulator", SIMULATOR, { size: 24, color: ORANGE });
  repo.moveTo([-3.75, -2.2]);
  return { parts: [title, film, list, repo], clips: [film] };
}

// --- evaluation ----------------------------------------------------------------

export function evaluationSlide() {
  const title = slideTitle("Evaluation");
  const top = bullets([
    "\\textbf{Two separate rankings}: simulation, real robot",
    "Goal: \\textbf{top of the wall, fastest}",
    "Start \\textbf{on the ground} or \\textbf{at the bottom of the wall}",
    "\\textbf{Height} = highest hold touched",
  ], { size: 30, gap: 0.38 });
  topLeft(top, -6.3, 2.35);
  const rank = new Group(
    text("Ranking", { size: 32, weight: "medium", font: TITLE_FONT, color: GOLD }),
    tex("1. \\textbf{Height} (always first)", { size: 30 }),
    tex("2. \\textbf{Time} × factors", { size: 30 }),
  ).arrange(DOWN, { buff: 0.2, aligned: LEFT });
  topLeft(rank, -6.3, top.bbox().y0 - 0.45);
  return { parts: [title, top], steps: [{ parts: [rank] }] };
}

const FACTORS = [
  [["Level 3", "1", ACCENT3], ["Level 2", "1.25", ORANGE],
   ["Level 1", "1.5", ACCENT]],
  [["Start on the ground", "1", ACCENT3],
   ["Start at the bottom", "1.1", GOLD]],
  [["Markerless", "1", ACCENT3], ["ArUco markers", "1.25", ORANGE]],
  [["Humanoid", "1", ACCENT3], ["Non-humanoid", "1.1", GOLD]],
];

/** The table of time factors, then the rulebook's example: a level-2 wall,
    a start at the bottom, markers: 1.25 × 1.1 × 1.25. */
export function factorsSlide() {
  const title = slideTitle("Time factors");
  const rows = [], vals = {};
  let y = 2.35;
  FACTORS.forEach((group, g) => {
    if (g) {
      rows.push(new Line([-6.4, y + 0.27], [-0.6, y + 0.27], { color: MUTED, width: 1.5 }));
      y -= 0.13;
    }
    for (const [what, f, color] of group) {
      const a = leftAt(text(what, { size: 28 }), -6.3, y);
      const v = math(`\\times ${f}`, { size: 30, color });
      v.moveTo([-1.4, y]);
      vals[what] = v;
      rows.push(new Group(a, v));
      y -= 0.5;
    }
  });
  const ex = text("Example", { size: 30, weight: "medium", font: TITLE_FONT, color: GOLD });
  leftAt(ex, 0.6, 1.6);
  const exWhat = text("level 2, bottom start, markers", { size: 27, color: MUTED });
  topLeft(exWhat, 0.6, 1.15);
  const eq = math(["1.25", "\\times", "1.1", "\\times", "1.25", "\\approx 1.72"], { size: 42 });
  leftAt(eq, 0.6, -0.1);
  const lit = ["Level 2", "Start at the bottom", "ArUco markers"]
    .map((k) => new Rectangle({ width: 1.1, height: 0.48, centre: vals[k].center(), corner: 0.1,
                                color: GOLD, strokeWidth: 3 }));
  const parts = [title, ...rows, ex, exWhat, ...lit, eq];
  return {
    parts,
    async play(s) {
      s.add(title);
      await s.play(lagged(rows.map((r) => appear(r)), { lag: 0.06 }), { runTime: 2.0 });
      await s.nextSlide();
      await s.play(new Write(ex), new FadeIn(exWhat), ...lit.map((m) => new Create(m)), { runTime: 1.0 });
      const keys = ["Level 2", "Start at the bottom", "ArUco markers"];
      await s.play(...[0, 2, 4].map((p, k) => TransformFromCopy(vals[keys[k]], eq.part(p))),
                   new FadeIn(eq.part(1)), new FadeIn(eq.part(3)), { runTime: 1.2 });
      await s.play(new Write(eq.part(5)), { runTime: 0.8 });
      await s.nextSlide();
    },
  };
}

/** The timer, on two time lines: when it starts, when it stops. */
export function timerSlide() {
  const title = slideTitle("Timer");
  const X0 = -5.0, X1 = 5.6;
  const line = (y, label, startX, startText) => {
    const axis = new Line([X0, y], [X1, y], { color: MUTED, width: 3 });
    const lab = leftAt(text(label, { size: 28, weight: "medium", font: TITLE_FONT }), -6.4, y + 0.75);
    const bar = new Line([startX, y], [4.2, y], { color: GOLD, width: 9 });
    const s0 = new Dot([startX, y], { radius: 0.13, color: ACCENT3 });
    const st = text(startText, { size: 24, color: ACCENT3 }).moveTo([startX, y - 0.5]);
    const s1 = new Dot([4.2, y], { radius: 0.13, color: ACCENT });
    return { axis, lab, bar, s0, st, s1 };
  };
  const a = line(1.3, "Start on the ground", -1.6, "leaves the ground");
  const b = line(-1.0, "Start at the bottom", X0, "run starts");
  b.st.shift([1.4, 0]);
  const stop = text("stops: last hold touched, or failure (ranked on height)",
                    { size: 27, color: ACCENT });
  stop.moveTo([0.6, -2.85]);
  const arrows = [a.s1, b.s1].map((d) => new Line(d.pos, [4.2, -2.3], { color: ACCENT, width: 2 }));
  arrows.forEach((m) => m.setOpacity(0.6));
  return { parts: [title, a.axis, a.lab, b.axis, b.lab, a.s0, a.st, a.bar, b.s0, b.st, b.bar],
           steps: [{ parts: [a.s1, b.s1, ...arrows, stop] }] };
}
