// Claude's side of the board: the threads waiting on Claude ("User
// requests"), with what each one needs.
//
//   node tools/review/queue.js                     what is waiting, in full
//   node tools/review/queue.js --all               every thread, one line each
//   node tools/review/queue.js --rollback-ok <id>  the deck was checked after a
//                                                  rollback: the thread is done
//
// A rollback is applied on disk by the board the moment the reader clicks it;
// what it leaves to Claude is to check the deck still works (another change
// may have leaned on the one undone) before closing the thread here.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildThreads, findEntry } from "./threads.js";
import { withLock } from "./lock.js";

const ROOT = process.env.REVIEW_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE = join(ROOT, ".review", "proposals.json");
const load = async () => JSON.parse(await readFile(STATE, "utf8"));
const one = (s) => String(s || "").replace(/\s+/g, " ").trim();

const [flag, id] = process.argv.slice(2);

if (flag === "--rollback-ok") {
  await withLock(ROOT, async () => {
    const state = await load();
    const e = findEntry(state, id);
    if (!e || e.kind !== "change" || e.x.status !== "rollback") {
      throw new Error(`${id} is not a change waiting for its rollback to be checked`);
    }
    e.x.status = "rolledback";
    e.x.rollback_checked_at = new Date().toISOString();
    await writeFile(STATE, JSON.stringify(state, null, 2));
  });
  console.log(`${id} rolled back, checked: done`);
  process.exit(0);
}

const threads = buildThreads(await load());
if (flag === "--all") {
  for (const t of threads.sort((a, b) => String(a.updated).localeCompare(String(b.updated)))) {
    console.log(`${t.stage.padEnd(11)} ${t.last.id.padEnd(10)} ${t.label.padEnd(18)} `
      + one(t.last.title || t.last.text).slice(0, 70));
  }
  process.exit(0);
}

const mine = threads.filter((t) => t.stage === "requests")
  .sort((a, b) => String(a.updated).localeCompare(String(b.updated)));
if (!mine.length) console.log("nothing waiting for Claude");
for (const t of mine) {
  const x = t.last;
  console.log(`\n[${x.id}] ${t.label}  (thread ${t.id}, ${t.items.length} step${t.items.length > 1 ? "s" : ""})`);
  console.log(`  where: ${x.where || [x.lecture, x.scene, x.slide && "slide " + x.slide].filter(Boolean).join(" · ") || "the course in general (no slide)"}`
    + (x.page ? `  (${x.page}${x.slide ? " #" + x.slide : ""})` : ""));
  console.log(`  ${x.entry}: ${one(x.title || x.text).slice(0, 300)}`);
  if (x.entry === "change" && x.file) console.log(`  file: ${x.file}`);
  for (const c of (x.comments || []).slice(-2)) console.log(`  comment: « ${one(c.text).slice(0, 600)} »`);
  if (x.rollback && x.rollback.ok === false) console.log(`  rollback error: ${one(x.rollback.error)}`);
}
