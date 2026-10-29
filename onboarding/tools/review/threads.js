// The board as threads.
//
// A thread is everything one piece of work went through: the request that
// started it (from a slide, or a suggestion of Claude's), each version of the
// change it led to, the reader's comments, and the verdicts. A tab shows the
// thread's LAST step -- the thing to act on -- and the rest unfolds on demand.
//
// Entries join a thread through `thread`, the id of its first entry: written
// when they are filed (propose.js takes a "parent"), and, for the entries
// filed before threads existed, once by migrate-threads.js.

/** Each entry of the board, tagged with what it is. */
export function entries(state) {
  const tag = (list, kind) => (list || []).map((x) => ({ kind, x }));
  return [...tag(state.requests, "request"), ...tag(state.proposals, "change"),
          ...tag(state.ideas, "suggestion")];
}

/**
 * Where a thread stands, read from its last entry: the tab it belongs to,
 * and a label saying what is expected -- of the reader in "review" and
 * "suggestions", of Claude in "requests".
 */
export function stageOf({ kind, x }) {
  if (x.archived) return { stage: "done", label: "archived" };
  if (kind === "request") {
    if (x.status === "open") {
      return { stage: "requests", label: (x.comments || []).length ? "reopened" : "new request" };
    }
    return { stage: "done", label: x.withdrawn ? "withdrawn" : "handled" };
  }
  if (kind === "suggestion") {
    if (x.status === "pending") return { stage: "suggestions", label: "to read" };
    if (x.status === "accepted") return { stage: "requests", label: "do it" };
    if (x.status === "commented") return { stage: "requests", label: "follow-up" };
    if (x.status === "done") return { stage: "done", label: "done" };
    return { stage: "done", label: "dismissed" };           // refused, dismissed
  }
  // A change, already applied to the files.
  if (x.status === "pending") return { stage: "review", label: "to review" };
  if (x.status === "commented") return { stage: "requests", label: "follow-up" };
  if (x.status === "rollback") {
    return { stage: "requests", label: x.rollback && x.rollback.ok === false
      ? "rollback failed" : "rollback, to check" };
  }
  if (x.status === "rolledback") return { stage: "done", label: "rolled back" };
  if (x.status === "refused") return { stage: "done", label: "refused" };   // before rollback
  return { stage: "done", label: "accepted" };
}

const later = (a, b) => (String(a || "") > String(b || "") ? a : b);

/** What happened in a thread, oldest first. */
function timeline(list) {
  const ev = [];
  for (const { kind, x } of list) {
    ev.push({ at: x.created_at, type: "filed", entry: kind, id: x.id });
    for (const c of x.comments || []) ev.push({ at: c.at, type: "comment", entry: kind, id: x.id, text: c.text });
    const verdict = x.status === "rollback" || x.status === "rolledback"
      || x.status === "accepted" || x.status === "refused" || x.status === "dismissed";
    if (verdict && x.reviewed_at) {
      ev.push({ at: x.reviewed_at, type: "verdict", entry: kind, id: x.id, status: x.status,
                rollback: x.rollback || null });
    }
    if (x.rollback_checked_at) {
      ev.push({ at: x.rollback_checked_at, type: "verdict", entry: kind, id: x.id, status: "rolledback" });
    }
    if (x.done_at) ev.push({ at: x.done_at, type: "verdict", entry: kind, id: x.id, status: "done" });
  }
  return ev.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}

/** Every thread of the board, with its stage, its entries and its history. */
export function buildThreads(state) {
  const groups = new Map();
  for (const e of entries(state)) {
    const key = e.x.thread || e.x.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const threads = [];
  for (const [id, list] of groups) {
    list.sort((a, b) => String(a.x.created_at || "").localeCompare(String(b.x.created_at || "")));
    const last = list[list.length - 1];
    const events = timeline(list);
    threads.push({
      id,
      ...stageOf(last),
      // `entry`, not `kind`: a suggestion has a `kind` of its own (its
      // category), which would overwrite it.
      last: { ...last.x, entry: last.kind },
      items: list.map(({ kind, x }) => ({ ...x, entry: kind })),
      events,
      updated: events.reduce((m, e) => later(m, e.at), ""),
    });
  }
  return threads;
}

/** Find an entry by its full id or its short one ("p042"). */
export function findEntry(state, id) {
  for (const e of entries(state)) {
    if (e.x.id === id || e.x.id.split("-")[0] === id) return e;
  }
  return null;
}
