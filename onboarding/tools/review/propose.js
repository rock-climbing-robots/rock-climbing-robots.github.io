// Put a proposal in the review board.
//
//   node tools/review/propose.js <<'EOF'
//   { "where": "02 · slide 28", "title": "...", "why": "...",
//     "before": "/tmp/before.png", "after": "/tmp/after.png",
//     "file": "lectures/02_vectors.js", "snap": ".review/snap/x.js",
//     "page": "02_vectors.html", "slide": 28, "parent": "r058" }
//   EOF
//
// "parent" is what this change answers -- a request, a suggestion, or an
// earlier version the reader commented on (full or short id). The change
// joins its thread on the board; without a parent it starts one of its own.
// A request it answers is marked done.
//
// The two PNGs are copied into .review/shots/, and the difference between
// the snapshot and the file as it stands is kept with the proposal, so that
// the board's Rollback button can undo it (patch -R, dry run first).

import { readFile, writeFile, copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE = join(ROOT, ".review", "proposals.json");
const SHOTS = join(ROOT, ".review", "shots");

const input = JSON.parse(await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
}));

for (const field of ["where", "title", "why", "before", "after"]) {
  if (!input[field]) throw new Error(`missing field: ${field}`);
}

// Several reviewers may be proposing at once: hold a lock across the
// read-change-write, or one of them loses its proposal.
const LOCK = join(ROOT, ".review", ".lock");
// A crash used to leave the lock behind for ever: it now carries the time it
// was taken, and a lock older than two minutes is broken rather than waited on.
const STALE = 120000;

async function takeLock() {
  await mkdir(join(ROOT, ".review"), { recursive: true });
  for (let tries = 0; ; tries++) {
    try {
      await mkdir(LOCK);
      await writeFile(join(LOCK, "taken"), String(Date.now()));
      return;
    } catch (e) {
      let age = 0;
      try {
        age = Date.now() - Number(await readFile(join(LOCK, "taken"), "utf8"));
      } catch (_) { age = STALE + 1; }        // no stamp: an old crash
      if (age > STALE) {
        try { await rm(LOCK, { recursive: true, force: true }); } catch (_) {}
        continue;
      }
      if (tries > 300) throw new Error("the review board stayed locked");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

const freeLock = () => rm(LOCK, { recursive: true, force: true }).catch(() => {});

let id;
await takeLock();
try {
  const state = existsSync(STATE)
    ? JSON.parse(await readFile(STATE, "utf8"))
    : { proposals: [] };
  // Numbering from the highest so far, not from the count: a removed entry
  // must not make the next one reuse its number.
  const seen = state.proposals.map((x) => Number(x.id.slice(1, 4)) || 0);
  id = "p" + String(Math.max(0, ...seen) + 1).padStart(3, "0")
    + "-" + Date.now().toString(36).slice(-4);

  await mkdir(SHOTS, { recursive: true });
  const shots = {};
  for (const kind of ["before", "after"]) {
    const name = `${id}-${kind}${extname(input[kind]) || ".png"}`;
    await copyFile(input[kind], join(SHOTS, name));
    shots[kind] = name;
  }

  // diff exits 1 when the files differ: that is the normal case here.
  let patch = "";
  if (input.file && input.snap) {
    try {
      patch = execFileSync("diff", ["-u", input.snap, join(ROOT, input.file)], {
        encoding: "utf8",
      });
    } catch (e) {
      patch = e.stdout || "";
    }
  }

  // The thread this change belongs to.
  let thread = id, parent = null;
  if (input.parent) {
    const all = [...(state.requests || []), ...state.proposals, ...(state.ideas || [])];
    const par = all.find((x) => x.id === input.parent || x.id.split("-")[0] === input.parent);
    if (!par) throw new Error(`unknown parent: ${input.parent}`);
    parent = par.id;
    thread = par.thread || par.id;
    if ((state.requests || []).includes(par) && par.status === "open") par.status = "done";
  }

  state.proposals.push({
    id,
    thread,
    parent,
    where: input.where,
    title: input.title,
    why: input.why,
    file: input.file || null,
    // Which slide to open: the chapter number in `where` is the one of the
    // day, and the lectures have been renumbered once already.
    page: input.page || null,
    slide: input.slide === undefined ? null : String(input.slide),
    patch,
    before: shots.before,
    after: shots.after,
    status: "pending",
    created_at: new Date().toISOString(),
    comments: [],
  });

  await writeFile(STATE, JSON.stringify(state, null, 2));
} finally {
  await freeLock();          // a failure must not leave the board locked
}
console.log(id);
