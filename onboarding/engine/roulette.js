// The student roulette: "r" three times during a presentation draws a name,
// with enough suspense for the class to see it coming; "i" three times draws
// one in a brief spin, to question someone quickly. Off unless deck.config.js
// sets `roulette: true`.
//
// It reads the class list at the root of the site (CONFIG.rouletteCsv,
// etudiants.csv by default): the roll exported by the registrar -- semicolons,
// two header lines, the name in the first column. That file is PERSONAL: it is
// in .gitignore, never versioned, and the publishing command excludes it
// explicitly (see CLAUDE.md). It never leaves the teacher's machine.
//
// Without the file nothing happens: the shortcut only fetches the list on its
// first use, and a 404 leaves it silent. That is what lets the code stay in
// place on the public site.
//
// A name drawn is out of the hat until everyone has been called -- the list
// then refills by itself -- or until the page is reloaded.

import { CONFIG } from "./config.js";

const CSV = CONFIG.rouletteCsv;
const TEXT = CONFIG.rouletteText;

/** The rotation: those not called yet. */
let everyone = null;      // null until the list is read; [] when it is missing
let remaining = [];
let open = false;

/**
 * The first column of every data row. The registrar's file starts with a
 * BOM, a header line and an empty sub-header line; fields are quoted.
 */
export function parseNames(text) {
  const out = [];
  for (const row of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const cell = (row.split(";")[0] || "").trim().replace(/^"|"$/g, "").trim();
    if (!cell || cell.toLowerCase() === "nom") continue;
    // The registrar's export doubles the hyphen of compound names.
    out.push(cell.replace(/-{2,}/g, "-"));
  }
  return out;
}

async function load() {
  if (everyone !== null) return everyone;
  try {
    const res = await fetch(CSV, { cache: "no-store" });
    everyone = res.ok ? parseNames(await res.text()) : [];
  } catch (e) {
    everyone = [];
  }
  remaining = [...everyone];
  return everyone;
}

const shuffled = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// The drum carries at least this many slots: with a whole class it is one
// permutation, all the way round; when only a few names are left, the
// permutation is repeated until the circle is full.
const MIN_SLOTS = 18;

/** The slots of the wheel. Two neighbours never carry the same name -- the
    seam between two permutations included, and the circle closes. */
function wheelSlots(pool) {
  const slots = [];
  while (slots.length < MIN_SLOTS) {
    const next = shuffled(pool);
    if (slots.length && pool.length > 1 && next[0] === slots[slots.length - 1]) {
      [next[0], next[1]] = [next[1], next[0]];
    }
    slots.push(...next);
  }
  // The wheel is a circle: the last slot touches the first.
  if (pool.length > 1 && slots[0] === slots[slots.length - 1]) {
    [slots[0], slots[1]] = [slots[1], slots[0]];
  }
  return slots;
}

const ROWS = 7;           // height of the window, in slots

// Two paces. "rrr" sends someone to the board: a fling, then a slow approach
// of random length, which makes the suspense. "iii" questions someone quickly
// (checking a notion at the start of a class): a brief spin that stops
// cleanly, keeping nobody waiting.
const PACES = {
  suspense: {
    title: TEXT.suspense,
    fling: 2400,          // the fling
    creepMin: 1600,       // the approach: slow, and of random length
    creepMax: 3800,
    creepSlots: 2,        // what is left to travel when it starts
    turns: 36,            // slots travelled in all, to within a turn
  },
  quick: {
    title: TEXT.quick,
    fling: 800,
    creepMin: 250,
    creepMax: 250,
    creepSlots: 0.6,
    turns: 20,
  },
};

/**
 * The motion, in two phases, both at constant deceleration: a fling that
 * starts fast and hands over at a still visible speed, then an approach that
 * creeps to a stop. The second phase makes the suspense, and its length is
 * drawn at random.
 *
 * Returns the angle travelled, in slots, at time t (ms).
 */
function motion(total, pace) {
  const { fling, creepMin, creepMax, creepSlots } = pace;
  const creep = creepMin + Math.random() * (creepMax - creepMin);
  const a2 = Math.min(creepSlots, total / 3);
  const a1 = total - a2;
  const w1 = (2 * a2) / creep;                  // speed at the hand-over
  const w0 = (2 * a1) / fling - w1;             // speed at release
  const at = (t) => {
    if (t < fling) return w0 * t - ((w0 - w1) * t * t) / (2 * fling);
    const u = Math.min(t - fling, creep);
    return a1 + w1 * u - (w1 * u * u) / (2 * creep);
  };
  at.duration = fling + creep;
  return at;
}

/** Build the screen and show it; returns it, to close it later. */
function build(title) {
  const veil = document.createElement("div");
  veil.className = "roulette";
  veil.innerHTML = `
    <div class="roulette-box">
      <div class="roulette-title">${title}</div>
      <div class="roulette-window">
        <div class="roulette-drum"></div>
        <div class="roulette-marker"></div>
      </div>
      <div class="roulette-left"></div>
    </div>`;
  document.body.appendChild(veil);
  return veil;
}

/**
 * One draw: the winner is chosen FIRST, then the wheel is spun to stop on it.
 * The animation decides nothing, it tells the story.
 *
 * It is a real wheel: the names sit on a CSS 3D cylinder, each in its slot,
 * and the cylinder turns. Only part of it shows -- slots flatten as they move
 * away from the centre, and the back is hidden by `backface-visibility`, as
 * on a drum.
 */
function spin(veil, winner, pool, left, pace) {
  const drum = veil.querySelector(".roulette-drum");
  const win = veil.querySelector(".roulette-window");

  const slots = wheelSlots(pool);
  const N = slots.length;
  const STEP = 360 / N;                          // the angle of one slot
  // The visible band, in degrees either side of the front slot. Opacity falls
  // to zero right at the edge: that stands in for clipping, and it is also
  // what gives the window its height.
  const HALF = Math.min(88, (ROWS * STEP) / 2);

  drum.innerHTML = "";
  // The name is in a <span>: an absolutely positioned block stretches from
  // edge to edge, while an inline one measures exactly the text.
  const rows = slots.map((name) => {
    const el = document.createElement("div");
    el.className = "roulette-row";
    const inner = document.createElement("span");
    inner.textContent = name;
    el.appendChild(inner);
    drum.appendChild(el);
    return el;
  });

  // The radius follows from the height of a slot: that is what makes the
  // names touch on the wheel without overlapping.
  const h = rows[0].getBoundingClientRect().height;
  const R = h / 2 / Math.tan((STEP * Math.PI) / 360);
  const DEPTH = 3.2;                       // the perspective, in radii
  win.style.perspective = `${Math.round(R * DEPTH)}px`;
  // The slots are absolutely positioned: they no longer carry the width of
  // the window, so it has to be set. And the front slot is ENLARGED by the
  // perspective -- by DEPTH / (DEPTH - 1) -- so it is the enlarged width that
  // must be reserved, or the longest name is cut.
  const mag = DEPTH / (DEPTH - 1);
  const wide = Math.max(...rows.map((el) => el.firstChild.getBoundingClientRect().width));
  // The extra leaves room for the aiming arrow, on either side.
  win.style.width = `${Math.ceil(wide * mag) + 96}px`;
  // The height: where the last visible slot lands on screen. Not
  // `R sin(HALF)` -- the perspective pushes the edge slots FURTHER out than
  // the circle, and a naive half-height let them spill onto the title.
  const rad = (HALF * Math.PI) / 180;
  const edge = (DEPTH * Math.sin(rad)) / (DEPTH - Math.cos(rad));
  win.style.height = `${Math.ceil(2 * R * edge)}px`;
  rows.forEach((el, i) => {
    el.style.transform = `rotateX(${i * STEP}deg) translateZ(${R}px)`;
  });

  // The winning slot, and how many slots to travel to bring it to the front:
  // one or two whole turns, plus what it takes.
  const winAt = slots.indexOf(winner);
  const turns = Math.max(1, Math.round((pace.turns - winAt) / N));
  const at = motion(winAt + turns * N, pace);

  const paint = (rot) => {
    drum.style.transform = `rotateX(${-rot * STEP}deg)`;
    for (let i = 0; i < N; i++) {
      // The angular distance to the front slot, brought into [0, 180].
      const d = Math.abs(((i * STEP - rot * STEP + 180) % 360 + 360) % 360 - 180);
      rows[i].style.opacity = d >= HALF ? "0" : String(Math.pow(1 - d / HALF, 1.2));
    }
  };

  const t0 = performance.now();
  const step = (now) => {
    const t = now - t0;
    if (t < at.duration) { paint(at(t)); requestAnimationFrame(step); return; }
    paint(winAt + turns * N);
    rows[winAt].classList.add("won");
    veil.querySelector(".roulette-left").textContent = left;
  };
  requestAnimationFrame(step);
}

/** "r" three times: draw a name among those not called yet, with suspense;
    "i" three times: the same in a brief spin. Both draw from the same
    rotation. */
export function studentRoulette() {
  let hits = [];
  let hitKey = null;
  let veil = null;
  let shownPace = null;

  const close = () => {
    if (!veil) return;
    veil.remove();
    veil = null;
    open = false;
  };

  const draw = async (pace) => {
    const all = await load();
    if (!all.length) return;              // no list: the shortcut sleeps
    if (!remaining.length) remaining = [...all];   // everyone has been called
    const pool = [...remaining];
    const winner = pool[Math.floor(Math.random() * pool.length)];
    remaining = remaining.filter((n) => n !== winner);
    const left = remaining.length
      ? TEXT.left.replace("{left}", remaining.length).replace("{total}", all.length)
      : TEXT.everyone;
    open = true;
    shownPace = pace;
    veil = build(pace.title);
    veil.addEventListener("click", close);
    spin(veil, winner, pool, left, pace);
  };

  window.addEventListener("keydown", (e) => {
    if (open) {
      // While the roulette is up it eats the keys: the arrows must not move
      // the presentation behind it.
      e.preventDefault();
      e.stopPropagation();
      // After a brief spin, the down arrow spins again at once: the student
      // drawn is absent, or another answer is wanted.
      const again = e.key === "ArrowDown" && shownPace === PACES.quick;
      close();
      if (again) draw(PACES.quick);
      return;
    }
    const key = e.key.toLowerCase();
    const pace = key === "r" ? PACES.suspense : key === "i" ? PACES.quick : null;
    if (!pace || e.metaKey || e.ctrlKey || e.altKey) { hits = []; return; }   // not a Ctrl-R
    if (key !== hitKey) { hits = []; hitKey = key; }
    const now = Date.now();
    hits = hits.filter((t) => now - t < 1500).concat(now);
    if (hits.length < 3) return;
    hits = [];
    draw(pace);
  }, true);   // capture phase: before reveal.js sees the key
}
