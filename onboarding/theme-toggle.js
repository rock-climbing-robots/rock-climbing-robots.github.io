// Light or dark -- and, for a course in several languages, which language --
// for every page of the site: the landing page, the practical subjects and
// the slides, which all follow the same choices.
//
// It reads deck.config.js (window.DECK_CONFIG, loaded just before it): the
// prefix of what the browser remembers, the default theme, the languages.
// The choices are written on <html> (data-theme, lang) early enough that the
// page never paints in the wrong colours.
//
// Two pages out of three want the buttons. A lecture does not (its slide
// fills the window): it asks for the theme alone with
// <html data-theme-button="off">, and "t" / "d" three times replace the
// buttons there (engine/deck.js). `?theme=light` or `?lang=xx` force one page
// without touching what is remembered.

(function () {
  var cfg = window.DECK_CONFIG || {};
  var id = cfg.id || "slides";
  var KEY = id + "-theme";
  var LANG_KEY = id + "-lang";
  var source = cfg.lang || "en";
  var langs = [source].concat((cfg.translations || []).filter(function (l) { return l !== source; }));
  var root = document.documentElement;

  function apply(name) { root.dataset.theme = name; }
  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function stored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }   // private mode
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  var theme = param("theme") || stored(KEY) || cfg.theme || "light";
  apply(theme === "dark" ? "dark" : "light");

  var lang = param("lang") || stored(LANG_KEY);
  root.lang = langs.indexOf(lang) >= 0 ? lang : source;

  function button(cls, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.title = label;
    b.setAttribute("aria-label", label);
    document.body.appendChild(b);
    return b;
  }

  function addButtons() {
    var b = button("theme-toggle", "Light or dark theme");
    function paint() { b.textContent = root.dataset.theme === "light" ? "☾" : "☀"; }
    paint();
    b.addEventListener("click", function () {
      apply(root.dataset.theme === "light" ? "dark" : "light");
      paint();
      // The figures and the background are drawn on canvases: they repaint.
      window.dispatchEvent(new Event("themechange"));
      store(KEY, root.dataset.theme);
    });
    onTriple("t", function () { b.click(); });

    if (langs.length < 2) return;
    // Beside it, the language: the button names the one it switches TO.
    var l = button("theme-toggle lang-toggle", "Language");
    function next() { return langs[(langs.indexOf(root.lang) + 1) % langs.length]; }
    function paintLang() { l.textContent = next().toUpperCase(); }
    paintLang();
    l.addEventListener("click", function () {
      root.lang = next();
      paintLang();
      store(LANG_KEY, root.lang);
      window.dispatchEvent(new Event("langchange"));
    });
    onTriple("d", function () { l.click(); });
  }

  // The shortcuts of the slides, here too: a key pressed three times.
  function onTriple(key, act) {
    var hits = [];
    window.addEventListener("keydown", function (e) {
      if (e.key.toLowerCase() !== key || e.metaKey || e.ctrlKey || e.altKey) { hits = []; return; }
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var now = Date.now();
      hits = hits.filter(function (h) { return now - h < 1500; }).concat(now);
      if (hits.length < 3) return;
      hits = [];
      act();
    });
  }

  if (root.dataset.themeButton === "off") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButtons);
  } else {
    addButtons();
  }
})();
