// The board's lock: propose.js, idea.js, the server and queue.js all rewrite
// the same file, so each change is a read-change-write held under it.
//
// A crash used to leave the lock behind for ever: it carries the time it was
// taken, and one older than two minutes is broken rather than waited on.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const STALE = 120000;

export async function withLock(root, fn) {
  const dir = join(root, ".review", ".lock");
  await mkdir(join(root, ".review"), { recursive: true });
  for (let tries = 0; ; tries++) {
    try {
      await mkdir(dir);
      await writeFile(join(dir, "taken"), String(Date.now()));
      break;
    } catch (e) {
      let age;
      try { age = Date.now() - Number(await readFile(join(dir, "taken"), "utf8")); }
      catch (_) { age = STALE + 1; }        // no stamp: an old crash
      if (age > STALE) { await rm(dir, { recursive: true, force: true }); continue; }
      if (tries > 300) throw new Error("the review board stayed locked");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  try { return await fn(); } finally { await rm(dir, { recursive: true, force: true }); }
}
