// Slides review: the board where the reader and Claude pass work back and
// forth.
//
//   node tools/review/server.js 7777
//
// Everything is a THREAD (threads.js): a request sent from a slide ("!!!"
// opens /new here), or a suggestion of Claude's, then each version of the
// change it led to, the reader's comments and verdicts. Four tabs, one per
// stage of the workflow:
//
//   User requests  Claude's turn: a new request, a comment to follow up, a
//                  suggestion the reader said to do, a rollback to check
//   Suggestions    the reader's turn: Claude's remarks on the course
//   To review      the reader's turn: a change Claude has ALREADY applied
//   Done           accepted, rolled back and checked, dismissed, withdrawn
//
// A change is applied when it is filed; "Rollback" undoes it on disk here
// (the reverse of the patch stored with it, dry-run first so a patch that no
// longer applies changes nothing) and hands the thread back to Claude, who
// checks the deck still works before the thread is done.
//
// Nothing here belongs to the site: it is tooling, and .review/ is
// git-ignored. REVIEW_ROOT points it at another copy, for testing.

import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { buildThreads, findEntry } from "./threads.js";
import { withLock as lockAt } from "./lock.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.REVIEW_ROOT || join(HERE, "..", "..");
const STATE = join(ROOT, ".review", "proposals.json");
const SHOTS = join(ROOT, ".review", "shots");
const port = Number(process.argv[2] || 7777);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

async function load() {
  if (!existsSync(STATE)) return { proposals: [] };
  return JSON.parse(await readFile(STATE, "utf8"));
}

// The file is also written by the proposing side: read, change, write back,
// and keep the window as small as possible.
/** A change asked for from a slide (the "!!!" shortcut of the deck). */
async function request(body) {
  const state = await load();
  state.requests = state.requests || [];
  const id = "r" + String(state.requests.length + 1).padStart(3, "0")
    + "-" + Date.now().toString(36).slice(-4);
  state.requests.push({
    id,
    page: String(body.page || "").slice(0, 80),
    slide: String(body.slide || "").slice(0, 8),
    lecture: String(body.title || "").slice(0, 80),
    // The anchor that survives a slide inserted before this one.
    scene: String(body.scene || "").slice(0, 80),
    block: String(body.block || "").slice(0, 8),
    text: String(body.text || "").slice(0, 4000),
    status: "open",
    created_at: new Date().toISOString(),
  });
  await mkdir(dirname(STATE), { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2));
  return { ok: true, id };
}

async function requestDone(id) {
  const state = await load();
  const r = (state.requests || []).find((x) => x.id === id);
  if (!r) return { ok: false, error: "unknown request" };
  r.status = r.status === "open" ? "done" : "open";
  await writeFile(STATE, JSON.stringify(state, null, 2));
  return { ok: true, status: r.status };
}

// --- the workflow --------------------------------------------------------

/**
 * Undo a change on disk: its stored patch, backwards. A dry run first -- if a
 * later change touched the same lines the patch no longer applies, and then
 * NOTHING is modified: the thread goes back to Claude with the reason.
 */
function reversePatch(p) {
  if (!p.patch || !p.file) return { ok: false, error: "no patch recorded for this change" };
  const args = ["-R", "-p0", "--batch", join(ROOT, p.file)];
  const run = (extra) => execFileSync("patch", [...extra, ...args],
    { input: p.patch, stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" });
  try {
    run(["--dry-run"]);
  } catch (e) {
    return { ok: false, error: String((e.stdout || "") + (e.stderr || "") || e.message).trim() };
  }
  run([]);
  return { ok: true };
}

/**
 * What the reader does on a thread, always on its LAST entry:
 *   accept    a change: it stays                        -> Done
 *   rollback  a change: undone on disk                   -> User requests (to check)
 *   comment   anything: what to do next                  -> User requests
 *   doit      a suggestion: go ahead                     -> User requests
 *   dismiss   a suggestion: not worth it                 -> Done
 *   withdraw  a request: never mind                      -> Done
 */
async function act({ id, action, comment }) {
  return lockAt(ROOT, async () => {
    const state = await load();
    const e = findEntry(state, id);
    if (!e) return { ok: false, error: "unknown entry" };
    const { kind, x } = e;
    const now = new Date().toISOString();
    const note = String(comment || "").trim().slice(0, 4000);
    let out = { ok: true };
    if (action === "accept" && kind === "change") {
      x.status = "accepted";
    } else if (action === "rollback" && kind === "change") {
      const r = reversePatch(x);
      x.status = "rollback";
      x.rollback = { ok: r.ok, at: now, ...(r.ok ? {} : { error: r.error.slice(0, 2000) }) };
      out = { ok: true, rollback: x.rollback };
    } else if (action === "comment" && note) {
      // A comment always hands the thread back to Claude; on a request that
      // was closed, it reopens it.
      x.status = kind === "request" ? "open" : "commented";
      x.comments = [...(x.comments || []), { text: note, at: now }];
    } else if (action === "doit" && kind === "suggestion") {
      x.status = "accepted";
    } else if (action === "dismiss" && kind === "suggestion") {
      x.status = "dismissed";
    } else if (action === "withdraw" && kind === "request") {
      x.status = "done";
      x.withdrawn = true;
    } else {
      return { ok: false, error: `cannot ${action} a ${kind}` };
    }
    if (note && action !== "comment") {
      x.comments = [...(x.comments || []), { text: note, at: now }];
    }
    x.reviewed_at = now;
    await writeFile(STATE, JSON.stringify(state, null, 2));
    return out;
  });
}

/** A verdict on a pedagogical suggestion: same three answers. */
async function ideaVerdict(id, value, comment) {
  const state = await load();
  const idea = (state.ideas || []).find((x) => x.id === id);
  if (!idea) return { ok: false, error: "unknown idea" };
  idea.status = value;
  idea.reviewed_at = new Date().toISOString();
  if (comment) {
    idea.comments = [...(idea.comments || []), { text: comment, at: idea.reviewed_at }];
  }
  await mkdir(dirname(STATE), { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2));
  return { ok: true };
}

async function verdict(id, value, comment) {
  const state = await load();
  const p = state.proposals.find((x) => x.id === id);
  if (!p) return { ok: false, error: "unknown proposal" };
  p.status = value;
  p.reviewed_at = new Date().toISOString();
  if (comment) p.comments = [...(p.comments || []), { text: comment, at: p.reviewed_at }];
  await mkdir(dirname(STATE), { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2));
  return { ok: true };
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error("too large"));
    });
    req.on("end", () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, type, data) => {
    res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
    res.end(data);
  };

  try {
    if (req.method === "POST" && url.pathname === "/api/request") {
      return send(200, TYPES[".json"], JSON.stringify(await request(JSON.parse(await body(req)))));
    }
    if (req.method === "POST" && url.pathname === "/api/request-done") {
      const { id } = JSON.parse(await body(req));
      return send(200, TYPES[".json"], JSON.stringify(await requestDone(id)));
    }
    // The request form is a view of the board, with its header and tabs: the
    // deck's "!!!" opens it here, with the slide in the query string, and the
    // board's own "New request" button opens it without.
    if (url.pathname === "/new") {
      return send(200, TYPES[".html"], await readFile(join(HERE, "index.html")));
    }
    if (req.method === "POST" && url.pathname === "/api/idea-verdict") {
      const { id, status, comment } = JSON.parse(await body(req));
      return send(200, TYPES[".json"], JSON.stringify(await ideaVerdict(id, status, comment)));
    }
    if (req.method === "POST" && url.pathname === "/api/verdict") {
      const { id, status, comment } = JSON.parse(await body(req));
      return send(200, TYPES[".json"], JSON.stringify(await verdict(id, status, comment)));
    }
    // The site's own icon: the board is part of the same work.
    if (url.pathname === "/favicon.ico" || url.pathname === "/favicon.svg") {
      return send(200, "image/svg+xml", await readFile(join(HERE, "..", "..", "favicon.svg")));
    }
    if (url.pathname === "/api/board") {
      // The port the slides are served on, for the links to them (make serve
      // passes it; 9090 otherwise).
      const slides = Number(process.env.SLIDES_PORT || 9090);
      return send(200, TYPES[".json"], JSON.stringify({ threads: buildThreads(await load()), slides }));
    }
    if (req.method === "POST" && url.pathname === "/api/act") {
      return send(200, TYPES[".json"], JSON.stringify(await act(JSON.parse(await body(req)))));
    }
    if (url.pathname === "/api/proposals") {
      return send(200, TYPES[".json"], JSON.stringify(await load()));
    }
    // MathJax, taken from the site's vendor/: the remarks are full of
    // {}^a R_b, and the board has to read like the slides.
    if (url.pathname === "/vendor/tex-svg-full.js") {
      return send(200, TYPES[".js"], await readFile(join(ROOT, "vendor", "mathjax", "tex-svg-full.js")));
    }
    if (url.pathname.startsWith("/shots/")) {
      const name = url.pathname.slice("/shots/".length);
      if (name.includes("..") || name.includes("/")) return send(400, "text/plain", "no");
      return send(200, TYPES[".png"], await readFile(join(SHOTS, name)));
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (file.includes("..") || file.includes("/")) return send(404, "text/plain", "not found");
    return send(200, TYPES[extname(file)] || "text/plain", await readFile(join(HERE, file)));
  } catch (e) {
    send(404, "text/plain", "not found");
  }
});

// Every interface: the board is meant to be opened from another machine.
server.listen(port, "0.0.0.0", () => {
  console.log(`review board on http://0.0.0.0:${port}/`);
});
