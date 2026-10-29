// Part 1: welcome and logistics. Everything here comes from the website
// (rock-climbing-robots.github.io, index.html): the teams, the organisers,
// the venue, the schedule and the practical information.

import { Group, Rectangle, Line, text, tex, link, icon, slideTitle, chapterTitle,
         lagged, appear, to, Create, Transform,
         FG, MUTED, ACCENT, ACCENT2, ACCENT3, GOLD, ORANGE, LEFT, DOWN, RIGHT,
         TITLE_FONT } from "../../engine/index.js";
import { clip, picture, plated, bullets, leftAt, topLeft, wrapped } from "./kit.js";

// Flags of the teams' countries, as the website shows them (flagcdn.com).
const FLAGS = { Taiwan: "flag_tw.png", Germany: "flag_de.png", France: "flag_fr.png", Scotland: "flag_gb-sct.png" };

export const PART1_IMAGES = ["smart.jpg", "smart_climbing_wall.jpg", "ntnu.png", "university_bordeaux.jpg",
                             "university_ostfalia.png", "aquitaine_robotics.png", "pollen.png",
                             ...Object.values(FLAGS)];

const RULES_PDF = "https://github.com/rock-climbing-robots/rules/releases/download/v1.1/rcr-rules-v1.1.pdf";
export const SIMULATOR = "https://github.com/rock-climbing-robots/simulator";
export const WEBSITE = "https://rock-climbing-robots.github.io/";
export const EMAIL = "rock-climbing-robots@diff.u-bordeaux.fr";

/** The title: the event's name on the left, a climbing film on the right. */
export function titleSlide() {
  const film = clip("climbing_portrait", 480 / 854, 3.9, [4.5, 0]);
  const name = chapterTitle("Rock Climbing Robots", { size: 66 });
  const sub = text("Hackathon on-boarding", { size: 44, weight: "medium", font: TITLE_FONT, color: GOLD });
  const when = text("29 October – 1 November 2026", { size: 30, color: FG });
  const where = text("SMART facility, University of Bordeaux", { size: 30, color: MUTED });
  const site = link("rock-climbing-robots.github.io", WEBSITE, { size: 26, color: ORANGE });
  const col = new Group(name, sub, when, where, site).arrange(DOWN, { buff: 0.35, aligned: LEFT });
  col.children[2].shift([0, -0.25]);
  leftAt(col, -6.6, 0);
  return { parts: [film, name, sub, when, where, site], clips: [film], runTime: 1.6 };
}

// --- the teams -----------------------------------------------------------------

const TEAMS = [
  ["Taiwan", "Taipei", "National Taiwan Normal University (NTNU)"],
  ["Germany", "Wolfenbüttel", "Ostfalia University of Applied Sciences"],
  ["France", "Talence", "ENSEIRB-MATMECA, Robotique Autonome (Team A)"],
  ["France", "Talence", "ENSEIRB-MATMECA, Robotique Autonome (Team B)"],
  [["Scotland", "France"], ["Edinburgh", "Toulouse"], ["University of Edinburgh", "LAAS-CNRS"]],
  ["France", "Talence", "Inria, Mnemosyne team"],
  ["France", "Bordeaux", "University of Bordeaux, DROBOTIQUE"],
];

export function teamsSlide() {
  const title = slideTitle("Welcome to the teams!");
  const X = [-5.95, -3.85, -1.6], y0 = 2.0, dy = 0.66;
  const head = ["Country", "City", "Structure"].map((h, k) =>
    leftAt(text(h, { size: 28, weight: "medium", font: TITLE_FONT, color: GOLD }), k ? X[k] : -6.65, y0 + 0.75));
  const rule = new Line([-6.7, y0 + 0.38], [6.8, y0 + 0.38], { color: MUTED, width: 2 });
  // A joint team gives two lines per cell (two countries, two cities...).
  const lines = (c) => [].concat(c);
  let y = y0 + dy / 2;
  const spans = [];                                   // [top, bottom] of each row
  const rows = TEAMS.map((row, r) => {
    const top = y;
    const n = lines(row[0]).length;
    y -= dy / 2 + (n - 1) * 0.22;
    const ys = lines(row[0]).map((_, i) => y + (n - 1) * 0.22 - i * 0.44);
    const flags = lines(row[0]).flatMap((country, i) => {
      const flag = picture(FLAGS[country], 0.5, n > 1 ? 0.32 : 0.36, [-6.4, ys[i]]);
      const flagLine = new Rectangle({ width: flag.w, height: flag.h, centre: [-6.4, ys[i]], color: MUTED,
                                       strokeWidth: 1 });
      flagLine.appearAs = "fade";
      return [flag, flagLine];
    });
    const cells = row.flatMap((c, k) => lines(c).map((l, i) =>
      leftAt(text(l, { size: k === 2 ? 24 : 26, color: k === 2 ? FG : MUTED }), X[k], ys[i])));
    y -= dy / 2 + (n - 1) * 0.22;
    spans.push([top, y]);
    // Alternate rows on a faint band, so the eye follows a line across.
    const band = new Rectangle({ width: 13.5, height: top - y, centre: [0.05, (top + y) / 2], strokeWidth: 0,
                                 fill: FG, fillOpacity: r % 2 ? 0 : 0.07 });
    band.appearAs = "fade";
    return new Group(band, ...flags, ...cells);
  });
  const foot = text("Teams of 2 to 6 members", { size: 27, color: MUTED }).moveTo([0, -3.3]);
  // A gold frame "selects" each team in turn, as it introduces itself.
  const frames = spans.map(([top, bottom]) =>
    new Rectangle({ width: 13.6, height: top - bottom + 0.04, centre: [0.05, (top + bottom) / 2], corner: 0.1,
                    color: GOLD, strokeWidth: 3 }));
  const frame = frames[0];
  const parts = [title, ...head, rule, ...rows, foot];
  return {
    parts: [...parts, frame],
    async play(s) {
      await s.play(lagged(parts.map((m) => appear(m)), { lag: 0.12 }), { runTime: 1.3 });
      await s.nextSlide();
      await s.play(new Create(frame), { runTime: 0.6 });
      await s.nextSlide();
      for (const next of frames.slice(1)) {
        await s.play(new Transform(frame, next), { runTime: 0.6 });
        await s.nextSlide();
      }
    },
  };
}

// --- the organisers ------------------------------------------------------------

const ORGANISERS = [
  ["ntnu.png", "NTNU", "Taiwan", ["Jacky Baltes"]],
  ["university_bordeaux.jpg", "University\nof Bordeaux", "France", ["Grégoire Passault", "Clément Gaspard"]],
  ["university_ostfalia.png", "Ostfalia\nUniversity", "Germany", ["Reinhard Gerndt"]],
  ["aquitaine_robotics.png", "Aquitaine\nRobotics", "companies cluster", []],
];

export function organisersSlide() {
  const title = slideTitle("Organizers");
  const parts = [title];
  ORGANISERS.forEach(([logo, name, where, people], k) => {
    const x = -5.25 + k * 3.5;
    parts.push(plated(logo, 3.0, 1.7, [x, 1.3]));
    const nm = text(name, { size: 28, weight: "medium", font: TITLE_FONT });
    topLeft(nm, x - (nm.bbox().x1 - nm.bbox().x0) / 2, 0.15);
    parts.push(nm);
    parts.push(text(where, { size: 25, color: MUTED }).moveTo([x, -1.05]));
    people.forEach((p, i) => parts.push(text(p, { size: 26, color: FG }).moveTo([x, -1.75 - i * 0.5])));
  });
  return { parts };
}

// --- the venue -----------------------------------------------------------------

export function venueSlide() {
  const title = slideTitle("Venue: the SMART facility");
  const a = picture("smart.jpg", 6.2, 3.9, [-3.35, 0.65]);
  const b = picture("smart_climbing_wall.jpg", 6.2, 3.9, [3.35, 0.65]);
  const t1 = tex("\\textbf{Sports science} facility, University of Bordeaux", { size: 30 });
  const t2 = tex("Motion capture, force platforms, \\textbf{climbing wall}", { size: 30, color: MUTED });
  const col = new Group(t1, t2).arrange(DOWN, { buff: 0.25 });
  col.moveTo([0, -2.5]);
  return { parts: [title, a, b, t1, t2] };
}

// --- the schedule --------------------------------------------------------------

const KIND = { hack: ACCENT3, meet: ACCENT2, social: GOLD, other: MUTED, end: ACCENT };
const DAYS = [
  ["Wed 28 Oct", [["10:00", "Pollen Robotics visit", "social"], ["Afternoon", "Setup", "other"]]],
  ["Thu 29 Oct", [["09:00", "Kick-off", "end"], ["", "Tutorials", "meet"],
                  ["12:00", "Buffet lunch", "social"], ["Afternoon", "Hackathon", "hack"]]],
  ["Fri 30 Oct", [["09:00", "Meeting, tutorials", "meet"], ["10:00", "Hackathon", "hack"],
                  ["12:00", "Pizza lunch", "social"]]],
  ["Sat 31 Oct", [["09:00", "Meeting, tutorials", "meet"], ["10:00", "Hackathon", "hack"],
                  ["14:00", "Internships & PhDs", "social"], ["", "Hackathon", "hack"]]],
  ["Sun 1 Nov", [["Morning", "Final sprint", "hack"], ["11:00", "Demos, trophies", "end"],
                 ["Afternoon", "Dismantling", "other"]]],
];

/** The week, a column per day; `days` are the columns, built one by one. */
export function scheduleSlide() {
  const title = slideTitle("Schedule");
  const W = 2.66, gap = 0.13, top = 2.85;
  const PAST = 1;                                      // days already over, dimmed
  const NOW = "Kick-off";                              // this presentation, framed
  let now = null;
  const days = DAYS.map(([day, items], d) => {
    const x = -6.95 + d * (W + gap) + W / 2;
    const head = text(day, { size: 27, weight: "medium", font: TITLE_FONT, color: d ? FG : MUTED }).moveTo([x, top]);
    const blocks = [];
    let y = top - 0.38;
    for (const [time, what, kind] of items) {
      const label = wrapped(what, W - 0.26, { size: 26, color: FG });
      const rows = [label];
      if (time) rows.unshift(text(time, { size: 24, color: KIND[kind] }));
      const content = new Group(...rows).arrange(DOWN, { buff: 0.06, aligned: LEFT });
      const h = content.bbox().y1 - content.bbox().y0 + 0.24;
      const box = new Rectangle({ width: W, height: h, centre: [x, y - h / 2], corner: 0.12,
                                  color: KIND[kind], strokeWidth: 2, fill: KIND[kind], fillOpacity: 0.12 });
      topLeft(content, x - W / 2 + 0.13, y - 0.12);
      if (what === NOW) now = new Rectangle({ width: W + 0.16, height: h + 0.16, centre: [x, y - h / 2],
                                              corner: 0.18, color: GOLD, strokeWidth: 5 });
      blocks.push(new Group(box, content));
      y -= h + 0.1;
    }
    return new Group(head, ...blocks);
  });
  const foot = text("Unlisted time = hackathon time", { size: 27, color: MUTED }).moveTo([0, -3.55]);
  // appear() would add a column's pieces, not the column: the past days fade
  // in as a whole, straight to their low opacity.
  const past = days.slice(0, PAST), rest = [title, ...days.slice(PAST), foot];
  return {
    parts: [title, ...days, foot, now],
    async play(s) {
      past.forEach((m) => m.setOpacity(0));
      await s.play(lagged(rest.map((m) => appear(m)), { lag: 0.12 }),
                   ...past.map((m) => to(m, (c) => c.setOpacity(0.3))), { runTime: 2.4 });
      await s.play(new Create(now), { runTime: 0.6 });
      await s.nextSlide();
    },
  };
}

// --- practical information -----------------------------------------------------

// Tabler icons (MIT): the rules, the simulator, the contact.
export const PRACTICAL_ICONS = ["file-text.svg", "device-desktop.svg", "mail.svg"];

export function practicalSlide() {
  const title = slideTitle("Practical information");
  const list = bullets([
    "\\textbf{4 Microban climbers} provided (one per wall)",
    "\\textbf{Own robot} welcome",
    "\\textbf{Markers} available: perception optional",
  ], { size: 31, gap: 0.4 });
  topLeft(list, -6.2, 2.6);
  const links = new Group(
    link("Rules v1.1 (PDF)", RULES_PDF, { size: 28, color: ORANGE }),
    link("github.com/rock-climbing-robots/simulator", SIMULATOR, { size: 28, color: ORANGE }),
    link(EMAIL, `mailto:${EMAIL}`, { size: 28, color: ORANGE }),
  ).arrange(DOWN, { buff: 0.3, aligned: LEFT });
  const labels = new Group(...["Rules", "Simulator", "Contact"].map((l) => text(l, { size: 28, color: MUTED })));
  topLeft(links, -3.3, list.bbox().y0 - 0.75);
  labels.children.forEach((l, k) => leftAt(l, -5.55, links.children[k].center()[1]));
  const icons = PRACTICAL_ICONS.map((n, k) => icon(n, { height: 0.42, color: GOLD })
    .moveTo([-6.0, links.children[k].center()[1]]));
  return { parts: [title, list, ...icons, ...labels.children, ...links.children] };
}
