// Say out loud what the reader does on the board, so that it wakes Claude up.
//
//   node tools/review/watch.js [interval in ms]
//
// One event per stdout line block, so a watcher upstream (Claude's Monitor)
// turns each into a notification:
//
//   WAITING  a thread is Claude's turn -- a request sent from a slide ("!!!") or
//            with "New request", a comment on a change, a suggestion to do, a
//            rollback to check. Printed for EVERY such thread at start-up,
//            then each time a thread becomes Claude's turn or gets something
//            new while it is (a second comment, a reopening).
//   verdict  what the reader decided on a change or a suggestion (accepted,
//            rolled back, dismissed...), or a request withdrawn: nothing to
//            do, but Claude should know.
//
// "Claude's turn" is the board's own stage "requests", computed by threads.js
// like the board and queue.js do: the three can never disagree on it. That is
// why the start-up pass matters: a request sent while no watch was running
// used to be taken as part of the board "as it stands" and never announced.
//
// The board is a single JSON file rewritten whole on every action, so this
// polls it and compares two snapshots rather than watching for writes: a
// write is not atomic, and half of it parses as nothing. A board that cannot
// be read for a while is said once on stderr, not ignored for ever.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildThreads } from "./threads.js";

const ROOT = process.env.REVIEW_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE = join(ROOT, ".review", "proposals.json");
const EVERY = Number(process.argv[2] || 2000);

const one = (s) => String(s || "").replace(/\s+/g, " ").trim();
const cut = (s, n) => (one(s).length > n ? one(s).slice(0, n - 1) + "…" : one(s));

/** Where a thread's last entry is, in words. */
function whereOf(x) {
  if (x.where) return x.where;
  const w = [x.lecture || x.page, x.scene, x.slide && "slide " + x.slide].filter(Boolean).join(" · ");
  return w || "the course in general (no slide)";
}

/** What the reader said last on a thread: a comment, or the request itself. */
function saidOf(t) {
  const x = t.last;
  const note = (x.comments || []).slice(-1)[0];
  if (note) return note.text;
  return x.entry === "request" ? x.text : x.title || x.text;
}

/**
 * What makes a waiting thread "the same" from one poll to the next: its last
 * entry, what the board calls it, and how much was said on it. Anything new
 * the reader adds changes one of them.
 */
const signature = (t) => [t.last.id, t.label, (t.last.comments || []).length, t.events.length].join("|");

/** Every entry by id, for the verdicts, which are not a thread's business. */
function statuses(state) {
  const out = new Map();
  for (const [entry, list] of [["change", state.proposals], ["suggestion", state.ideas],
                                ["request", state.requests]]) {
    for (const x of list || []) out.set(x.id, { entry, x });
  }
  return out;
}

const SAY = {
  change: { accepted: "change accepted", rolledback: "rollback checked",
            refused: "change refused" },
  suggestion: { dismissed: "suggestion dismissed", refused: "suggestion dismissed",
                done: "suggestion done" },
  request: {},
};

function announce(t, why) {
  const x = t.last;
  console.log(`WAITING [${t.id}] ${why}: ${t.label} — ${whereOf(x)}`
    + (x.page ? `  (${x.page}${x.slide ? " #" + x.slide : ""})` : "")
    + `\n  « ${cut(saidOf(t), 900)} »`
    + `\n  -> node tools/review/queue.js`);
}

let waiting = null;          // thread id -> signature, for Claude's turn
let before = null;           // entry id -> status, for the verdicts
let unreadable = 0;

async function poll() {
  let state;
  try {
    state = JSON.parse(await readFile(STATE, "utf8"));
    if (unreadable >= 5) process.stderr.write("the board can be read again\n");
    unreadable = 0;
  } catch (e) {
    // Mid-write, or not there yet: try again. Said once if it lasts.
    if (++unreadable === 5) process.stderr.write(`cannot read ${STATE}: ${e.message}\n`);
    return;
  }
  const threads = buildThreads(state);
  const now = new Map(threads.filter((t) => t.stage === "requests").map((t) => [t.id, signature(t)]));
  const first = waiting === null;
  for (const t of threads) {
    if (t.stage !== "requests") continue;
    if (first) announce(t, "already waiting");
    else if (!waiting.has(t.id)) announce(t, "new");
    else if (waiting.get(t.id) !== now.get(t.id)) announce(t, "updated");
  }
  // The reader's verdicts: nothing to do, but worth knowing.
  const cur = statuses(state);
  if (before) {
    for (const [id, { entry, x }] of cur) {
      const was = before.get(id);
      if (!was || was === x.status) continue;
      const said = entry === "request" && x.withdrawn ? "request withdrawn" : SAY[entry][x.status];
      if (said) console.log(`verdict [${id}] ${said} — ${cut(x.title || x.text, 90)}`);
    }
  }
  if (first) {
    process.stderr.write(`watching ${threads.length} threads, ${now.size} waiting for Claude\n`);
    if (!now.size) console.log("watching: nothing waiting for Claude");
  }
  waiting = now;
  before = new Map([...cur].map(([id, { x }]) => [id, x.status]));
}

await poll();
setInterval(poll, EVERY);
