// Put a PEDAGOGICAL suggestion in the review board.
//
// Unlike a proposal, an idea changes nothing yet: it is a remark about the
// course itself (an order, a missing step, an ambiguous notation), waiting
// for the reader to say whether it is worth doing.
//
//   node tools/review/idea.js <<'EOF'
//   { "lecture": "04 · Matrices", "page": "04_matrices.html",
//     "slide": "42", "kind": "notation", "severity": 4,
//     "title": "...", "why": "...", "what": "...",
//     "shot": "/tmp/marked.png", "caption": "what the slide shows" }
//   EOF
//
// "shot" is a marked-up screenshot of the slide (tools/annotate.js), when the
// remark is about one slide one can point at. "parent" (optional) puts it in
// the thread of the entry it follows up, like propose.js.
//
// Marking one as dealt with:  node tools/review/idea.js --done <id>
// Attaching a marked-up slide to one already filed:
//   node tools/review/idea.js --shot <id> <png> ["caption"]
// Rewording one already filed (only the fields given are replaced):
//   node tools/review/idea.js --edit <id> <<'JSON'
//   { "why": "...", "what": "...", "severity": 4 }
//   JSON

import { readFile, writeFile, copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE = join(ROOT, ".review", "proposals.json");
const SHOTS = join(ROOT, ".review", "shots");
const LOCK = join(ROOT, ".review", ".lock");

// A crash used to leave the lock behind for ever: it now carries the time it
// was taken, and a lock older than two minutes is broken rather than waited on.
const STALE = 120000;

async function lock() {
  await mkdir(join(ROOT, ".review"), { recursive: true });
  for (let tries = 0; ; tries++) {
    try {
      await mkdir(LOCK);
      await writeFile(join(LOCK, "taken"), String(Date.now()));
      return;
    } catch (e) {
      let age;
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

const unlock = () => rm(LOCK, { recursive: true, force: true }).catch(() => {});

const load = async () => (existsSync(STATE)
  ? JSON.parse(await readFile(STATE, "utf8")) : { proposals: [] });

// --done <id>: the suggestion has been carried out (or dropped for good).
if (process.argv[2] === "--done") {
  const id = process.argv[3];
  await lock();
  const state = await load();
  const idea = (state.ideas || []).find((x) => x.id === id);
  if (!idea) { await unlock(); throw new Error(`unknown idea: ${id}`); }
  idea.status = "done";
  idea.done_at = new Date().toISOString();
  await writeFile(STATE, JSON.stringify(state, null, 2));
  await unlock();
  console.log(`${id} done`);
  process.exit(0);
}

/** One already on the board, by id. */
async function pick(state, id) {
  const idea = (state.ideas || []).find((x) => x.id === id);
  if (!idea) {
    await unlock();
    throw new Error(`unknown idea: ${id}`);
  }
  return idea;
}

if (process.argv[2] === "--shot") {
  const [, , , id, png, caption] = process.argv;
  if (!id || !png) throw new Error("usage: --shot <id> <png> [caption]");
  await lock();
  const state = await load();
  const idea = await pick(state, id);
  await mkdir(SHOTS, { recursive: true });
  idea.shot = `${id}-shot${extname(png) || ".png"}`;
  await copyFile(png, join(SHOTS, idea.shot));
  if (caption) idea.caption = String(caption).slice(0, 200);
  await writeFile(STATE, JSON.stringify(state, null, 2));
  await unlock();
  console.log(`${id} ${idea.shot}`);
  process.exit(0);
}

if (process.argv[2] === "--edit") {
  const id = process.argv[3];
  const patch = JSON.parse(await new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  }));
  await lock();
  const state = await load();
  const idea = await pick(state, id);
  for (const field of ["title", "why", "what", "kind", "slide", "caption"]) {
    if (patch[field] !== undefined) idea[field] = String(patch[field]).slice(0, 4000);
  }
  if (patch.severity !== undefined) {
    idea.severity = Math.max(1, Math.min(5, Number(patch.severity) || 3));
  }
  await writeFile(STATE, JSON.stringify(state, null, 2));
  await unlock();
  console.log(`${id} edited`);
  process.exit(0);
}

const input = JSON.parse(await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
}));

for (const field of ["lecture", "title", "why", "what"]) {
  if (!input[field]) throw new Error(`missing field: ${field}`);
}

await lock();
const state = await load();
state.ideas = state.ideas || [];
// Numbering from the highest so far, not from the count: a removed
// entry must not make the next one reuse its number.
const seen = state.ideas.map((x) => Number(x.id.slice(1, 4)) || 0);
const id = "i" + String(Math.max(0, ...seen) + 1).padStart(3, "0")
  + "-" + Date.now().toString(36).slice(-4);

let shot = null;
if (input.shot) {
  await mkdir(SHOTS, { recursive: true });
  shot = `${id}-shot${extname(input.shot) || ".png"}`;
  await copyFile(input.shot, join(SHOTS, shot));
}

let thread = id, parent = null;
if (input.parent) {
  const all = [...(state.requests || []), ...state.proposals, ...state.ideas];
  const par = all.find((x) => x.id === input.parent || x.id.split("-")[0] === input.parent);
  if (!par) { await unlock(); throw new Error(`unknown parent: ${input.parent}`); }
  parent = par.id;
  thread = par.thread || par.id;
}

state.ideas.push({
  id,
  thread,
  parent,
  lecture: String(input.lecture).slice(0, 80),
  page: input.page || null,
  slide: input.slide === undefined ? null : String(input.slide),
  scene: input.scene || null,
  // What sort of remark it is: order, gap, notation, clarity, exercise...
  kind: String(input.kind || "pedagogy").slice(0, 24),
  // How much the course loses without it: 5 = an error on screen or a
  // result the rest of the course leans on, 2 = a comfort.
  severity: Math.max(1, Math.min(5, Number(input.severity) || 3)),
  title: String(input.title).slice(0, 200),
  why: String(input.why).slice(0, 4000),
  what: String(input.what).slice(0, 4000),
  shot,
  caption: input.caption ? String(input.caption).slice(0, 200) : null,
  status: "pending",
  created_at: new Date().toISOString(),
  comments: [],
});

await writeFile(STATE, JSON.stringify(state, null, 2));
await unlock();
console.log(id);
