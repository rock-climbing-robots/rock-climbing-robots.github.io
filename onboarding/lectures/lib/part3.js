// Part 3: recommended tools and leads. For each tool, when there is one: its
// install command, its GitHub repository and its documentation. Films and the
// PlaCo material come from the Rhoban team's deck (~/slides_rhoban), the
// Stable Baselines3 / mjlab ones from the RL course (~/intro_rl, "RL in
// practice").

import { Group, Rectangle, Line, Dot, Value, text, tex, math, link, icon, slideTitle, redraw,
         lagged, appear, to, FadeIn, FadeOut, Write, Create, valueTo, linear,
         FG, MUTED, ACCENT, ACCENT2, ACCENT3, GOLD, ORANGE, VIOLET, LEFT, DOWN, RIGHT,
         TITLE_FONT } from "../../engine/index.js";
import { clip, picture, plated, bullets, leftAt, topLeft, wrapped, card, getIt, linkRow, snippet,
         pills } from "./kit.js";
import { WallView, board, holdGraph, search, GRAPH_HOLDS, SEARCH_COLORS } from "./wall.js";

export const PART3_IMAGES = ["pinocchio.png", "placo_architecture.png", "discord_qr.png"];

const DISCORD = "https://discord.gg/uhJsQwQcX";
// Tabler icons (MIT) of the closing slide: the website, the rules, the contact.
export const CLOSING_ICONS = ["world.svg", "file-text.svg", "mail.svg"];

const head = (str, color = GOLD, size = 30) => text(str, { size, weight: "medium", font: TITLE_FONT, color });

// --- the toolbox ---------------------------------------------------------------

const TOOLBOX = [
  ["Robot & CAD", ACCENT2, ["Microban", "Onshape", "onshape-to-robot"]],
  ["Modelling", ACCENT2, ["Pinocchio", "MuJoCo"]],
  ["Inverse kinematics", ACCENT3, ["pink", "placo", "mink"]],
  ["Planning", GOLD, ["Dijkstra", "A*", "RRT", "RRT-Connect"]],
  ["Learning", VIOLET, ["Gymnasium", "Stable Baselines3", "mjlab"]],
  ["Identification", ORANGE, ["BAM"]],
  ["Whole-body dynamics", ACCENT, ["TSID", "Crocoddyl"]],
];

export function toolboxSlide() {
  const title = slideTitle("A toolbox: recommended tools and leads");
  const parts = [title];
  TOOLBOX.forEach(([name, color, tools], k) => {
    const y = 2.35 - k * 0.86;
    parts.push(leftAt(head(name, color, 29), -6.4, y));
    const row = pills(tools, [0, y], { size: 26, color });
    const dx = -1.6 - row[0].bbox().x0;
    row.forEach((m) => m.shift([dx, 0]));
    parts.push(...row);
  });
  return { parts, runTime: 2.2 };
}

// --- Microban --------------------------------------------------------------------

const ONSHAPE_MICROBAN = "https://cad.onshape.com/documents/d424992a192a8ce34ffce163/v/7de3e6e40f0e1185d169e6d9/e/b34620a03cc3a684006c5867";

export function microbanSlide() {
  const title = slideTitle("Microban");
  const film = clip("microban", 16 / 9, 6.4, [-3.6, 0.55]);
  const about = bullets([
    "\\textbf{30 cm}, \\textbf{3D-printable}",
    "\\textbf{19} XL330 servos, RPi Zero 2W",
    "About \\textbf{600 USD}",
    "\\textbf{Repo}: BOM, guides, CAD",
  ], { size: 28, gap: 0.32 });
  topLeft(about, 0.35, 2.4);
  const links = new Group(
    linkRow("github", "Rhoban/microban", "https://github.com/Rhoban/microban", { size: 28 }),
    link("Onshape assembly", ONSHAPE_MICROBAN, { size: 28, color: ORANGE }),
  ).arrange(DOWN, { buff: 0.3, aligned: LEFT });
  links.children[1].shift([0.75, 0]);
  topLeft(links, 0.1, about.bbox().y0 - 0.55);
  const climber = tex("Base of the \\textbf{hackathon climber}", { size: 30, color: ACCENT3 }).moveTo([0, -3.2]);
  return { parts: [title, film, about, links, climber], clips: [film] };
}

// --- Onshape + onshape-to-robot --------------------------------------------------------

export function onshapeSlide() {
  const title = slideTitle("Onshape and onshape-to-robot");
  const film = clip("otr_sigmaban", 1024 / 576, 6.3, [-3.65, 0.75]);
  film.hold(4);                       // the film opens on black
  const list = bullets([
    "\\textbf{Onshape}: CAD in the browser",
    "Export to \\textbf{URDF}, \\textbf{MJCF}, SDF",
    "\\textbf{Climber design} available",
  ], { size: 29, gap: 0.36 });
  topLeft(list, 0.35, 2.7);
  list.children[2].children.forEach((m) => m.setColor(ACCENT3));
  const get = getIt("pip install onshape-to-robot", "rhoban/onshape-to-robot",
                    "https://onshape-to-robot.readthedocs.io/");
  topLeft(get, 0.1, list.bbox().y0 - 0.5);
  const osLink = link("onshape.com", "https://www.onshape.com/", { size: 26, color: ORANGE }).moveTo([-3.65, -1.55]);
  return { parts: [title, film, osLink, list, get], clips: [film] };
}

// --- Pinocchio ---------------------------------------------------------------------------

const PIN_CODE = `import numpy as np
import pinocchio as pin

model = pin.buildModelFromUrdf("robot.urdf")   # or MJCF, SDF
data = model.createData()
q = pin.neutral(model)
v = a = np.zeros(model.nv)

pin.framesForwardKinematics(model, data, q)
hand = model.getFrameId("left_hand")
print(data.oMf[hand])                     # placement of the hand
J = pin.computeFrameJacobian(model, data, q, hand)
com = pin.centerOfMass(model, data, q)
tau = pin.rnea(model, data, q, v, a)      # inverse dynamics`;

export function pinocchioSlide() {
  const title = slideTitle("Pinocchio: the Swiss army knife");
  const logo = plated("pinocchio.png", 4.6, 1.3, [-4.35, 2.35]);
  const list = bullets([
    "\\textbf{Kinematics}, Jacobians",
    "\\textbf{Dynamics}: RNEA, ABA, CRBA",
    "Analytical \\textbf{derivatives}",
    "Loads \\textbf{URDF}, \\textbf{MJCF}, SDF",
    "\\textbf{C++} core, \\textbf{Python} API",
    "Under pink, placo, TSID...",
  ], { size: 29, gap: 0.3 });
  topLeft(list, -6.4, 1.4);
  const get = getIt("pip install pin", "stack-of-tasks/pinocchio",
                    "https://stack-of-tasks.github.io/pinocchio/");
  topLeft(get, 1.0, 1.0);
  return { parts: [title, logo, list, get] };
}

export function pinocchioCodeSlide() {
  const title = slideTitle("Pinocchio in a few lines");
  const listing = snippet(PIN_CODE, { size: 18 });
  topLeft(listing, -listing.w / 2, 2.85);
  const ex = linkRow("github", "examples: stack-of-tasks/pinocchio/examples",
                     "https://github.com/stack-of-tasks/pinocchio/tree/devel/examples");
  ex.moveTo([0, -3.7]);
  return { parts: [title, listing, ex] };
}

// --- inverse kinematics --------------------------------------------------------------------

export const IK_QP = "\\begin{aligned}"
  + "\\min_{\\Delta q}\\quad & \\sum_i w_i \\lVert J_i(q)\\,\\Delta q + e_i(q) \\rVert^2"
  + " + \\epsilon \\lVert \\Delta q \\rVert^2 \\\\[6pt]"
  + "\\text{s.t.}\\quad & J^h_i(q)\\,\\Delta q + e^h_i(q) = 0 \\\\[2pt]"
  + "& q_{min} \\le q + \\Delta q \\le q_{max}, \\quad |\\Delta q| \\le \\Delta t\\, \\dot q_{max}"
  + "\\end{aligned}";

const IK_TOOLS = [
  ["pink", "Pinocchio, Python", "pip install pin-pink", "stephane-caron/pink",
   "https://stephane-caron.github.io/pink/"],
  ["placo", "Pinocchio, C++", "pip install placo", "rhoban/placo", "https://placo.readthedocs.io/"],
  ["mink", "MuJoCo, Python", "pip install mink", "kevinzakka/mink", "https://kevinzakka.github.io/mink/"],
];

export function ikSlide() {
  const title = slideTitle("Inverse kinematics: a task-space QP");
  const qp = math(IK_QP, { size: 27 }).moveTo([0, 1.85]);
  const what = text("Tasks + constraints, solved as a QP", { size: 28, color: MUTED }).moveTo([0, 0.65]);
  const cards = IK_TOOLS.map(([name, base, pip, gh, docs], k) => {
    const x = -4.7 + k * 4.7;
    const c = card(4.5, 3.4, [x, -1.55], { color: ACCENT3 });
    const n = head(name, ACCENT3, 32).moveTo([x, -0.25]);
    const b = text(base, { size: 24, color: MUTED }).moveTo([x, -0.72]);
    const g = getIt(pip, gh, null, { size: 19, linkSize: 22 });
    topLeft(g, x - 2.0, -1.0);
    const d = linkRow("readthedocs", "documentation", docs, { size: 22 });
    topLeft(d, x - 2.0, g.bbox().y0 - 0.15);
    return new Group(c, n, b, g, d);
  });
  return { parts: [title, qp, what], steps: [{ parts: cards }] };
}

/** PlaCo: its architecture, and how to get it. */
export function placoSlide() {
  const title = slideTitle("PlaCo");
  const fig = plated("placo_architecture.png", 6.3, 5.0, [-3.6, -0.2]);
  const list = bullets([
    "QP \\textbf{inverse kinematics}",
    "Tasks: frames, CoM, joints...",
    "Constraints: limits, collisions...",
  ], { size: 29, gap: 0.34 });
  topLeft(list, 0.25, 2.3);
  const get = getIt("pip install placo", "rhoban/placo", "https://placo.readthedocs.io/");
  topLeft(get, 0.05, list.bbox().y0 - 0.4);
  const ex = linkRow("github", "rhoban/placo-examples", "https://github.com/rhoban/placo-examples");
  topLeft(ex, 0.05, get.bbox().y0 - 0.3);
  return { parts: [title, fig, list, get, ex] };
}

/** PlaCo's task-space inverse kinematics, in six examples. */
export function placoGallery() {
  const title = slideTitle("PlaCo: task-space inverse kinematics");
  const names = ["placo_megabot", "placo_humanoid", "placo_omniwheel",
                 "placo_megabot_real", "placo_orbita", "placo_humanoid_collisions"];
  const w = 4.3, h = w * 9 / 16, gap = 0.25;
  const films = names.map((n, i) => {
    const c = i % 3, r = Math.floor(i / 3);
    return clip(n, 16 / 9, w, [(c - 1) * (w + gap), 1.25 - r * (h + gap)]);
  });
  return { parts: [title, ...films], clips: films };
}

const PLACO_CODE = `import placo

robot = placo.RobotWrapper("microban_climber/")   # folder with robot.urdf
# (frame names depend on your model)
solver = placo.KinematicsSolver(robot)

# Three limbs stay on their holds (hard constraints)...
for limb in ["left_foot", "right_foot", "left_hand"]:
    task = solver.add_position_task(limb, holds[limb])
    task.configure(limb, "hard")

# ... the fourth one reaches for the next hold (soft)
reach = solver.add_position_task("right_hand", next_hold)
reach.configure("reach", "soft", 1.0)

for _ in range(100):
    solver.solve(True)          # one QP step, applied to the robot
    robot.update_kinematics()`;

export function placoCodeSlide() {
  const title = slideTitle("PlaCo: reaching for a hold");
  const listing = snippet(PLACO_CODE, { size: 17 });
  topLeft(listing, -listing.w / 2, 2.85);
  return { parts: [title, listing] };
}

// --- learning ---------------------------------------------------------------------------

const SB3_CODE = `import gymnasium as gym
from stable_baselines3 import PPO

class ClimbPlanning(gym.Env):   # which limb, which hold next?
    def reset(self, seed=None, options=None):
        ...   # -> obs, info
    def step(self, action):
        ...   # -> obs, reward, terminated, truncated, info

model = PPO("MlpPolicy", ClimbPlanning(), verbose=1)
model.learn(total_timesteps=200_000)
model.save("planner")`;

export function sb3Slide() {
  const title = slideTitle("Gymnasium and Stable Baselines3");
  const list = bullets([
    "\\textbf{Gymnasium}: standard env API (reset, step)",
    "\\textbf{SB3}: PPO, SAC, TD3... (+ Contrib: CrossQ)",
    "\\textbf{CPU}-friendly: e.g. \\textbf{high-level planning}",
  ], { size: 29, gap: 0.34 });
  topLeft(list, -6.4, 2.3);
  const g1 = getIt("pip install gymnasium", "Farama-Foundation/Gymnasium", "https://gymnasium.farama.org/");
  const g2 = getIt("pip install stable-baselines3", "DLR-RM/stable-baselines3",
                   "https://stable-baselines3.readthedocs.io/");
  topLeft(g1, -6.6, list.bbox().y0 - 0.55);
  topLeft(g2, 0.4, list.bbox().y0 - 0.55);
  return { parts: [title, list, g1, g2] };
}

export function sb3CodeSlide() {
  const title = slideTitle("Gymnasium and Stable Baselines3");
  const listing = snippet(SB3_CODE, { size: 18 });
  topLeft(listing, -6.9, 2.8);
  const film = clip("frasa_standup", 16 / 9, 4.0, [4.8, 0.9]);
  const cap = text("FRASA (Rhoban), CrossQ", { size: 26, color: MUTED });
  cap.moveTo([4.8, -0.65]);
  return { parts: [title, listing, film, cap], clips: [film] };
}

export function mjlabSlide() {
  const title = slideTitle("mjlab: whole-body training on GPU");
  const film = clip("mjlab_g1_walk", 1, 4.6, [-4.3, 0.15]);
  const cap = text("Unitree G1 walking", { size: 26, color: MUTED }).moveTo([-4.3, -2.45]);
  const list = bullets([
    "Isaac Lab API on \\textbf{MuJoCo Warp}",
    "\\textbf{Whole-body} RL, massively parallel",
    "Needs an \\textbf{NVIDIA GPU}",
  ], { size: 29, gap: 0.32 });
  topLeft(list, -1.3, 2.3);
  const get = getIt(["pip install mjlab", "train Mjlab-Velocity-Flat-Unitree-G1"], "mujocolab/mjlab",
                    "https://mujocolab.github.io/mjlab/", { size: 20 });
  topLeft(get, -1.5, list.bbox().y0 - 0.35);
  return { parts: [title, film, cap, list, get], clips: [film] };
}

// --- identification -----------------------------------------------------------------------

export function bamSlide() {
  const title = slideTitle("BAM: Better Actuator Models");
  const film = clip("bam_doc", 16 / 9, 6.6, [-3.4, 0.6]);
  const list = bullets([
    "Identifies \\textbf{servo models}",
    "Smaller \\textbf{sim-to-real gap}",
    "\\textbf{Used on Microban}",
  ], { size: 29, gap: 0.34 });
  topLeft(list, 0.6, 2.6);
  list.children[2].children.forEach((m) => m.setColor(ACCENT3));
  const get = getIt("pip install better-actuator-models", "rhoban/bam", "https://bam.readthedocs.io/",
                    { size: 19 });
  topLeft(get, 0.4, list.bbox().y0 - 0.5);
  const ref = text("Duclusaud et al., ICRA 2025", { size: 24, color: MUTED });
  ref.moveTo([-3.4, -2.0]);
  return { parts: [title, film, list, get, ref], clips: [film] };
}

// --- planning as a graph ----------------------------------------------------------------------

const GVIEW = new WallView(6.6, [-4.2, -0.4]);

/** The holds become a graph, A* searches it from the lowest hold to the
    highest, and the path found is lit. */
export function graphSlide() {
  const title = slideTitle("Planning: climbing as a graph search");
  const b = board(GVIEW, { holes: false });
  const { dots, edges, holds } = holdGraph(GVIEW);
  const res = search();
  const k = new Value(0);
  const live = redraw(() => {
    const n = Math.floor(k.get());
    const g = new Group();
    res.order.slice(0, n).forEach((u) => {
      g.add(new Dot(GVIEW.p(GRAPH_HOLDS[u].p), { radius: 0.12, color: SEARCH_COLORS.visited }));
    });
    return g;
  });
  const path = res.path.slice(1).map((v, i) => new Line(GVIEW.p(GRAPH_HOLDS[res.path[i]].p), GVIEW.p(GRAPH_HOLDS[v].p),
                                                        { color: SEARCH_COLORS.path, width: 9 }));
  const ends = [new Dot(GVIEW.p(GRAPH_HOLDS[res.start].p), { radius: 0.16, color: SEARCH_COLORS.start }),
                new Dot(GVIEW.p(GRAPH_HOLDS[res.goal].p), { radius: 0.16, color: SEARCH_COLORS.goal })];
  // A node is a limb on a hold, not a hold: the figure draws one limb's graph.
  const l1 = bullets(["Node = \\textbf{(limb, hold)}, moves = \\textbf{edges}"], { size: 29 });
  const n1 = text("Drawn: the holds, for one limb", { size: 24, color: MUTED });
  const l2 = bullets(["\\textbf{Dijkstra}, \\textbf{A*}"], { size: 29 });
  const l3 = bullets(["\\textbf{RRT}, \\textbf{RRT-Connect}, PRM"], { size: 29 });
  const l4 = bullets(["State = \\textbf{stance}, moves checked by \\textbf{IK}"], { size: 29, color: GOLD });
  const col = new Group(l1, n1, l2, l3, l4).arrange(DOWN, { buff: 0.35, aligned: LEFT });
  n1.shift([0.45, 0.15]);
  topLeft(col, -0.9, 2.3);
  const libs = new Group(
    getIt("pip install networkx", null, "https://networkx.org/", { size: 19, linkSize: 22 }),
    getIt("pip install ompl", null, "https://ompl.kavrakilab.org/", { size: 19, linkSize: 22 }),
  ).arrange(RIGHT, { buff: 0.5, aligned: [0, 1] });
  topLeft(libs, -0.9, col.bbox().y0 - 0.4);
  const parts = [title, b, ...holds, ...edges, ...dots, live, ...path, ...ends, col, libs];
  return {
    parts,
    async play(s) {
      s.add(title);
      await s.play(new FadeIn(b), lagged(holds.map((m) => new FadeIn(m)), { lag: 0.02 }), { runTime: 1.0 });
      await s.nextSlide();
      await s.play(lagged(edges.map((m) => new Create(m)), { lag: 0.01 }),
                   lagged(dots.map((m) => new Create(m)), { lag: 0.01 }), appear(l1), new FadeIn(n1),
                   { runTime: 1.5 });
      await s.nextSlide();
      s.add(live);
      await s.play(...ends.map((m) => new Create(m)), appear(l2), { runTime: 0.6 });
      await s.play(valueTo(k, res.order.length, { rateFunc: linear }), { runTime: 3.0 });
      await s.play(lagged(path.map((m) => new Create(m)), { lag: 0.3 }), { runTime: 1.5 });
      await s.nextSlide();
      await s.play(appear(l3), { runTime: 0.8 });
      await s.nextSlide();
      await s.play(appear(l4), new FadeIn(libs), { runTime: 1.0 });
      await s.nextSlide();
    },
  };
}

// --- whole-body inverse dynamics -------------------------------------------------------------

const DYN = "M(q)\\,\\ddot q + h(q, \\dot q) = S^\\top \\tau + \\sum_c J_c(q)^\\top f_c,"
  + "\\qquad f_c \\in \\mathcal{K}_c";

const WBC_TOOLS = [
  ["TSID", "QP inverse dynamics", "pip install tsid", "stack-of-tasks/tsid",
   "https://github.com/stack-of-tasks/tsid/wiki"],
  ["Crocoddyl", "optimal control (DDP)", "pip install crocoddyl", "loco-3d/crocoddyl",
   "https://gepettoweb.laas.fr/doc/loco-3d/crocoddyl/master/doxygen-html/"],
];

export function wbcSlide() {
  const title = slideTitle("Going further: whole-body inverse dynamics");
  const eq = math(DYN, { size: 40 }).moveTo([0, 2.3]);
  const what = text("contact forces, friction, torques", { size: 28, color: MUTED }).moveTo([0, 1.3]);
  const cards = WBC_TOOLS.map(([name, about, pip, gh, docs], k) => {
    const x = (k - (WBC_TOOLS.length - 1) / 2) * 4.7;
    const c = card(4.5, 3.9, [x, -1.4], { color: ACCENT });
    const n = head(name, ACCENT, 34).moveTo([x, 0.15]);
    const b = text(about, { size: 25, color: MUTED }).moveTo([x, -0.45]);
    const g = getIt(pip, gh, null, { size: 19, linkSize: 21 });
    topLeft(g, x - 2.1, -1.15);
    const d = link("documentation", docs, { size: 21, color: ORANGE });
    topLeft(d, x - 2.1 + 0.75, g.bbox().y0 - 0.2);
    return new Group(c, n, b, g, d);
  });
  return { parts: [title, eq, what], steps: [{ parts: cards }] };
}

// --- closing ----------------------------------------------------------------------------------

export function closingSlide() {
  const t = text("Happy climbing!", { size: 72, weight: "medium", font: TITLE_FONT, color: GOLD }).moveTo([-2.6, 1.2]);
  const links = new Group(
    link("rock-climbing-robots.github.io", "https://rock-climbing-robots.github.io/", { size: 30, color: ORANGE }),
    link("rules v1.1", "https://github.com/rock-climbing-robots/rules/releases", { size: 30, color: ORANGE }),
    link("rock-climbing-robots@diff.u-bordeaux.fr", "mailto:rock-climbing-robots@diff.u-bordeaux.fr",
         { size: 30, color: ORANGE }),
  ).arrange(DOWN, { buff: 0.35, aligned: LEFT });
  // The links as a left-aligned column, centred with their icons.
  const w = links.bbox().x1 - links.bbox().x0 + 0.75;
  const x0 = -2.6 - w / 2;
  topLeft(links, x0 + 0.75, -0.3);
  const icons = CLOSING_ICONS.map((n, k) => icon(n, { height: 0.45, color: GOLD })
    .moveTo([x0 + 0.22, links.children[k].center()[1]]));
  // The Discord server, on the right: its QR code, and the link under it.
  const join = text("Join the Discord", { size: 34, weight: "medium", font: TITLE_FONT }).moveTo([4.3, 2.3]);
  const qr = picture("discord_qr.png", 3.2, 3.2, [4.3, 0.2]);
  const dl = link("discord.gg/uhJsQwQcX", DISCORD, { size: 28, color: ORANGE }).moveTo([4.3, -1.85]);
  return { parts: [t, ...icons, ...links.children, join, qr, dl] };
}
