// Slides review: the threads of the board, one tab per stage of the workflow.
//
// A thread is shown by its LAST step, the one to act on; everything before it
// unfolds under "History". The tab is never remembered: the page always opens
// on "To review", even empty -- that is the reader's own queue.
//
// The request form is a view of the same page, at /new: the deck's "!!!"
// opens it with the slide in the query string, the "New request" button
// without one. Header, tabs and theme are the board's, so from the form the
// reader is one click from any tab.

var TABS = [
  ["requests", "User requests"],
  ["suggestions", "Suggestions"],
  ["review", "To review"],
  ["done", "Done"],
];
var EMPTY = {
  requests: "Nothing waiting for Claude.",
  suggestions: "No suggestion to read.",
  review: "Nothing to review right now.",
  done: "Nothing done yet.",
};
// What a stage label means, in a sentence, on the card itself.
var WAITING = {
  "new request": "Waiting for Claude: a new request.",
  "reopened": "Waiting for Claude: reopened with a comment.",
  "follow-up": "Waiting for Claude: a comment to follow up.",
  "do it": "Waiting for Claude: you said to go ahead with this suggestion.",
  "rollback, to check": "Rolled back on disk. Waiting for Claude to check the deck still works.",
  "rollback failed": "The rollback could not be applied: nothing was changed on disk. Waiting for Claude.",
};
var SEVERITY = {
  5: "an error, or a result the rest of the course leans on",
  4: "a missing step, or a promise the course does not keep",
  3: "a clear gain, though nothing is wrong",
  2: "comfort",
  1: "cosmetic",
};

var GENERAL = "the course in general (no slide)";   // where a request from "New request" is
var tab = location.pathname === "/new" ? "new" : "review";
var lastTab = "review";   // where "back" from the form goes
// The slide a request is about, when the deck sent it; null for a request on
// the course in general.
var context = requestContext();
var draft = "";           // what is typed in the form survives a refresh
var slidesPort = 9090;  // where the slides are served, as the board reports it
var threads = [];
var unfolded = {};      // thread id -> history shown
// Every tab shows its cards by pages: Done alone runs to hundreds, each with
// its two screenshots.
var PAGE_SIZE = 25;
var pages = {};         // tab -> page shown (from 0)

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

/** A paragraph of text where **bold** is bold: everything else is escaped,
    so nothing in an entry is ever read as markup. */
function rich(tag, cls, text) {
  var e = el(tag, cls);
  var esc = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  e.innerHTML = esc.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return e;
}

/** A button: its mark, then its name. */
function button(cls, sign, label, onclick) {
  var b = el("button", cls);
  if (sign) b.appendChild(el("i", null, sign));
  b.appendChild(document.createTextNode(label));
  b.onclick = onclick;
  return b;
}

function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = !msg;
}

function act(id, action, comment) {
  return fetch("/api/act", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: id, action: action, comment: comment || "" }),
  }).then(answer).then(function (out) {
    toast(out.ok ? "" : "Could not " + action + ": " + out.error);
    return refresh();
  }).catch(function (e) { toast("The board did not answer: " + e); });
}

/** The slide a card links to; "17-18" lands on the first. */
function slideAt(slide) {
  var n = parseInt(String(slide || ""), 10);
  return Number.isFinite(n) && n > 0 ? "#/" + (n - 1) : "";
}

function openSlide(x) {
  if (!x.page) return null;
  var a = el("a", "goto", "↗ Open slide");
  a.href = "http://localhost:" + slidesPort + "/" + x.page + slideAt(x.slide);
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function whereOf(x) {
  if (x.entry === "request") {
    if (!x.lecture && !x.page && !x.scene && !x.slide) return GENERAL;
    return (x.lecture || x.page || "")
      + (x.scene ? " · " + x.scene : "")
      + (x.slide ? " · slide " + x.slide : "");
  }
  if (x.entry === "suggestion") return x.lecture + (x.slide ? " · slide " + x.slide : "");
  return x.where || "";
}

function titleOf(x) {
  if (x.entry === "request") return "Request";
  return x.title || x.id;
}

function when(at) {
  if (!at) return "";
  var d = new Date(at);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", "
    + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function sev(n) {
  var v = Number(n) || 3;
  var b = el("span", "sev s" + v);
  b.title = SEVERITY[v] || "";
  b.appendChild(el("b", null, "●".repeat(v) + "○".repeat(5 - v)));
  return b;
}

function shots(x, small) {
  var box = el("div", "shots" + (small ? " small" : ""));
  [["before", x.before], ["after", x.after]].forEach(function (pair, i) {
    if (!pair[1]) return;
    var s = el("figure", "shot" + (i ? " after" : ""));
    var img = el("img");
    img.src = "/shots/" + pair[1];
    img.alt = pair[0];
    img.loading = "lazy";
    s.appendChild(img);
    s.appendChild(el("figcaption", null, pair[0]));
    box.appendChild(s);
  });
  return box;
}

/** The body of an entry: what it says, and what it shows. */
function body(x, small) {
  var b = el("div", "body");
  if (x.entry === "request") {
    b.appendChild(el("p", "text", x.text));
  } else if (x.entry === "suggestion") {
    b.appendChild(el("p", "label", "What I see"));
    b.appendChild(rich("p", "text", x.why));
    b.appendChild(el("p", "label", "What I suggest"));
    b.appendChild(rich("p", "text", x.what));
    if (x.shot && !small) {
      var f = el("figure", "shot wide");
      var img = el("img");
      img.src = "/shots/" + x.shot;
      img.loading = "lazy";
      f.appendChild(img);
      if (x.caption) f.appendChild(el("figcaption", null, x.caption));
      b.appendChild(f);
    }
  } else {
    b.appendChild(rich("p", "text", x.why));
    b.appendChild(shots(x, small));
  }
  return b;
}

/** A text box and the button that sends it. */
function commentBox(id, label, placeholder) {
  var wrap = el("div", "comment");
  var note = el("textarea");
  note.placeholder = placeholder;
  wrap.appendChild(note);
  wrap.appendChild(button("note", "✎", label, function () {
    if (note.value.trim()) act(id, "comment", note.value.trim());
    else note.focus();
  }));
  return wrap;
}

var VERDICT = {
  accepted: "accepted", refused: "refused", dismissed: "dismissed",
  rollback: "rolled back", rolledback: "rollback checked by Claude", done: "marked done",
};

/** Everything that happened in the thread, oldest first. */
function historyOf(t) {
  var box = el("ol", "history");
  var byId = {};
  t.items.forEach(function (x) { byId[x.id] = x; });
  t.events.forEach(function (e) {
    var x = byId[e.id] || {};
    var li = el("li", "event " + e.type);
    var who = e.type === "filed" && x.entry !== "request" ? "Claude" : "You";
    var what = e.type === "filed"
      ? (x.entry === "request" ? "request" : x.entry === "suggestion" ? "suggestion" : "change " + x.id.split("-")[0])
      : e.type === "comment" ? "comment" : VERDICT[e.status] || e.status;
    var meta = el("p", "meta");
    meta.appendChild(el("b", null, who));
    meta.appendChild(document.createTextNode(" · " + what + " · " + when(e.at)));
    li.appendChild(meta);
    if (e.type === "filed") {
      if (x.entry !== "request") li.appendChild(el("p", "title", x.title));
      li.appendChild(body(x, true));
    } else if (e.type === "comment") {
      li.appendChild(el("p", "quote", e.text));
    } else if (e.rollback && e.rollback.ok === false) {
      li.appendChild(el("pre", "error", e.rollback.error || "the patch did not apply"));
    }
    box.appendChild(li);
  });
  return box;
}

function card(t) {
  var x = t.last;
  var c = el("article", "card " + t.stage + " " + x.entry);

  var head = el("div", "head");
  head.appendChild(el("span", "where", whereOf(x)));
  if (x.entry === "suggestion") {
    head.appendChild(sev(x.severity));
    if (x.kind) head.appendChild(el("span", "tag", x.kind));
  }
  head.appendChild(el("span", "badge " + t.label.replace(/[^a-z]+/g, "-"), t.label));
  c.appendChild(head);
  var title = el("h2", "title", titleOf(x));
  c.appendChild(title);

  // Done cards are shown whole, screenshots included: pages keep the list
  // short. The date says when the thread was closed.
  if (t.stage === "done") c.appendChild(el("p", "stamp", when(t.updated)));

  if (t.stage === "requests") {
    c.appendChild(el("p", "waiting", WAITING[t.label] || "Waiting for Claude."));
    var lastNote = (x.comments || []).slice(-1)[0];
    if (lastNote) c.appendChild(el("p", "quote", lastNote.text));
    if (x.rollback && x.rollback.ok === false) {
      c.appendChild(el("pre", "error", x.rollback.error || "the patch did not apply"));
    }
  }
  if (x.entry !== "request" || t.stage !== "requests" || !(x.comments || []).length) {
    c.appendChild(body(x, false));
  }

  var actions = el("div", "actions");
  if (t.stage === "review") {
    actions.appendChild(button("accept", "✓", "Accept", function () { act(x.id, "accept"); }));
    actions.appendChild(button("rollback", "↶", "Rollback", function () { act(x.id, "rollback"); }));
    actions.appendChild(commentBox(x.id, "Comment", "Not quite? Say what to change: Claude makes a new version."));
  } else if (t.stage === "suggestions") {
    actions.appendChild(button("accept", "✓", "Do it", function () { act(x.id, "doit"); }));
    actions.appendChild(button("rollback", "✕", "Dismiss", function () { act(x.id, "dismiss"); }));
    actions.appendChild(commentBox(x.id, "Comment", "A remark on the suggestion: Claude takes it into account."));
  } else if (t.stage === "requests") {
    if (x.entry === "request" && x.status === "open") {
      actions.appendChild(button("rollback", "✕", "Withdraw", function () { act(x.id, "withdraw"); }));
    }
    actions.appendChild(commentBox(x.id, "Add", "Something to add for Claude."));
  } else {
    actions.appendChild(commentBox(x.id, "Reopen", "Reopen with a comment: it goes back to Claude."));
  }
  var go = openSlide(x);
  if (go) actions.appendChild(go);
  c.appendChild(actions);

  if (t.events.length > 1) {
    var toggle = button("history-toggle", unfolded[t.id] ? "▾" : "▸",
      "History (" + t.events.length + ")", function () {
        unfolded[t.id] = !unfolded[t.id];
        render();
      });
    c.appendChild(toggle);
    if (unfolded[t.id]) c.appendChild(historyOf(t));
  }
  return c;
}

function inTab(name) {
  var list = threads.filter(function (t) { return t.stage === name; });
  if (name === "suggestions") {
    return list.sort(function (a, b) {
      return (b.last.severity || 3) - (a.last.severity || 3)
        || String(a.last.lecture).localeCompare(String(b.last.lecture));
    });
  }
  // Queues read oldest first; what is done, newest first.
  var sign = name === "done" ? -1 : 1;
  return list.sort(function (a, b) { return sign * String(a.updated).localeCompare(String(b.updated)); });
}

/** The $...$ of titles and texts, composed like the slides. */
function typeset(board, tries) {
  var mj = window.MathJax;
  if (mj && mj.startup && mj.startup.promise) {
    mj.startup.promise.then(function () { return mj.typesetPromise([board]); }).catch(function () {});
  } else if ((tries || 0) < 100) {
    setTimeout(function () { typeset(board, (tries || 0) + 1); }, 100);
  }
}

// --- the request form ----------------------------------------------------------

/** What the deck put in the query string of /new, or null. */
function requestContext() {
  if (location.pathname !== "/new") return null;
  var q = new URLSearchParams(location.search);
  var c = {
    page: q.get("page") || "", slide: q.get("slide") || "", title: q.get("title") || "",
    from: q.get("from") || "", scene: q.get("scene") || "", block: q.get("block") || "",
  };
  return c.page || c.slide || c.scene ? c : null;
}

/** Go to a view: a tab, or "new". The address follows, so that the browser's
    back button and a reload land on the same view. (The thread's own history
    is `historyOf()`: a top-level `function history` would replace the
    browser's `history` object in a classic script.) */
function go(view, ctx) {
  if (view !== "new") lastTab = view;
  if (view === "new") context = ctx || null;
  var url = view === "new" ? "/new" + (ctx ? location.search : "") : "/";
  if (location.pathname + location.search !== url) history.pushState({ view: view }, "", url);
  tab = view;
  document.getElementById("notice").hidden = true;
  render();
}

window.addEventListener("popstate", function () {
  context = requestContext();
  tab = location.pathname === "/new" ? "new" : lastTab;
  render();
});

function requestForm() {
  var f = el("section", "newreq");
  f.appendChild(el("h2", "", "New request"));
  // The scene is the anchor that survives an inserted slide; the number is
  // shown because it is what the reader has under the eyes.
  f.appendChild(context
    ? el("p", "ctx", (context.title || context.page)
         + (context.scene ? "  ·  " + context.scene : "")
         + (context.slide ? "  ·  slide " + context.slide : ""))
    : el("p", "ctx general", "On the course in general, not on one slide. It goes to User requests, for Claude."));
  var text = el("textarea");
  text.placeholder = context
    ? "What is wrong on this slide, or what you would like instead."
    : "What you would like changed or added.";
  text.value = draft;
  text.oninput = function () { draft = text.value; };
  f.appendChild(text);
  var row = el("p", "row");
  row.appendChild(button("note", null, "Send", function () {
    if (!text.value.trim()) { text.focus(); return; }
    var c = context || {};
    fetch("/api/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page: c.page || "", slide: c.slide || "", title: c.title || "",
                            scene: c.scene || "", block: c.block || "", text: text.value.trim() }),
    }).then(answer).then(function (out) {
      draft = "";
      var back = context && context.from;
      go("requests");
      var n = document.getElementById("notice");
      n.textContent = "Request " + out.id + " saved: it is in User requests, for Claude."
        + (back ? " You can close this window, or go back to the slide." : "");
      n.hidden = false;
      return refresh();
    }).catch(function (e) { toast("The board did not answer: " + e); });
  }));
  // Opened from a slide: the way back to it.
  if (context && (window.opener || context.from)) {
    var back = el("a", "", window.opener ? "close this window" : "\u2190 back to the slide");
    back.href = context.from || "#";
    if (window.opener) back.onclick = function (e) { e.preventDefault(); window.close(); };
    row.appendChild(back);
  }
  f.appendChild(row);
  setTimeout(function () { text.focus(); }, 0);
  return f;
}

/** "‹ 26–50 of 267 ›", with the page numbers between: above and below the
    list, and only when there is more than one page. */
function pager(total) {
  var n = Math.ceil(total / PAGE_SIZE);
  var at = pages[tab] || 0;
  var bar = el("div", "pager");
  if (n <= 1) { bar.hidden = true; return bar; }
  var goTo = function (k) {
    pages[tab] = Math.max(0, Math.min(n - 1, k));
    render();
    window.scrollTo(0, 0);
  };
  var prev = button("ghost", null, "\u2039 Previous", function () { goTo(at - 1); });
  prev.disabled = at === 0;
  bar.appendChild(prev);
  for (var k = 0; k < n; k++) {
    (function (k) {
      var b = button("page" + (k === at ? " on" : ""), null, String(k + 1), function () { goTo(k); });
      bar.appendChild(b);
    })(k);
  }
  var next = button("ghost", null, "Next \u203a", function () { goTo(at + 1); });
  next.disabled = at === n - 1;
  bar.appendChild(next);
  bar.appendChild(el("span", "range", (at * PAGE_SIZE + 1) + "\u2013"
    + Math.min(total, (at + 1) * PAGE_SIZE) + " of " + total));
  return bar;
}

function render() {
  var nav = document.getElementById("tabs");
  nav.innerHTML = "";
  TABS.forEach(function (pair) {
    var n = threads.filter(function (t) { return t.stage === pair[0]; }).length;
    var b = el("button", pair[0] === tab ? "on" : "");
    b.appendChild(document.createTextNode(pair[1]));
    b.appendChild(el("span", "count" + (n && pair[0] !== "done" ? " live" : ""), String(n)));
    b.onclick = function () { go(pair[0]); };
    nav.appendChild(b);
  });
  document.getElementById("newreq").className = "primary" + (tab === "new" ? " on" : "");

  var board = document.getElementById("board");
  board.innerHTML = "";
  if (tab === "new") {
    board.appendChild(requestForm());
    document.getElementById("empty").hidden = true;
    return;
  }
  var all = inTab(tab);
  // A page that no longer exists (the list got shorter): the last one.
  var last = Math.max(0, Math.ceil(all.length / PAGE_SIZE) - 1);
  if ((pages[tab] || 0) > last) pages[tab] = last;
  var from = (pages[tab] || 0) * PAGE_SIZE;
  var shown = all.slice(from, from + PAGE_SIZE);
  board.appendChild(pager(all.length));
  shown.forEach(function (t) { board.appendChild(card(t)); });
  board.appendChild(pager(all.length));
  var empty = document.getElementById("empty");
  empty.textContent = EMPTY[tab];
  empty.hidden = shown.length > 0;
  typeset(board);
}

/** The body of an answer, or a readable reason why there is none. A server
    started before this page was written has no /api/board, and answers
    "not found" -- which JSON.parse turns into a baffling syntax error. */
function answer(r) {
  if (r.status === 404) {
    throw new Error("this board server is older than the page: restart it (make serve)");
  }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function refresh() {
  return fetch("/api/board", { cache: "no-store" })
    .then(answer)
    .then(function (data) {
      threads = data.threads || [];
      if (data.slides) slidesPort = data.slides;
      render();
    })
    .catch(function (e) { toast("The board did not answer: " + e); });
}

// --- light and dark: a button, or "t" three times like the slides ----------

function applyTheme(light) {
  if (light) document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("review-theme", light ? "light" : "dark"); } catch (e) { /* private */ }
  document.getElementById("theme").textContent = light ? "☾ Dark" : "☀ Light";
}
function isLight() { return document.documentElement.dataset.theme === "light"; }

document.getElementById("theme").onclick = function () { applyTheme(!isLight()); };
document.getElementById("theme").textContent = isLight() ? "☾ Dark" : "☀ Light";
document.getElementById("again").onclick = function () { refresh(); };
document.getElementById("newreq").onclick = function () { go("new", null); };
document.getElementById("home").onclick = function (e) { e.preventDefault(); go(lastTab); };

var hits = [];
window.addEventListener("keydown", function (e) {
  var typing = /^(TEXTAREA|INPUT|SELECT)$/.test((e.target && e.target.tagName) || "");
  if (typing || e.metaKey || e.ctrlKey || e.altKey || (e.key !== "t" && e.key !== "T")) {
    hits = [];
    return;
  }
  var now = Date.now();
  hits = hits.filter(function (h) { return now - h < 1500; }).concat(now);
  if (hits.length >= 3) { hits = []; applyTheme(!isLight()); }
});

refresh();
