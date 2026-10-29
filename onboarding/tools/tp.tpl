<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title$</title>
    <link rel="icon" href="favicon.svg">
    <link rel="stylesheet" href="vendor/fonts/fonts.css">
    <link rel="stylesheet" href="tp.css">
    <link rel="stylesheet" href="toc.css">
    <script src="deck.config.js"></script>
    <script src="theme-toggle.js"></script>
    <script>
      window.MathJax = { tex: { inlineMath: [["\\(", "\\)"], ["$$", "$$"]] },
                         svg: { fontCache: "none" } };
    </script>
    <script defer src="vendor/mathjax/tex-svg-full.js"></script>
  </head>
  <body>
    <canvas id="sketch"></canvas>
    <!-- The same bar as the text mode (read.html): back to the course, and
         where one is; the theme button sits in its right end. -->
    <nav id="bar">
      <a class="home" href="index.html">&larr; <span class="course"></span></a>
      <span class="where">$title$</span>
    </nav>
    <main>
      <h1 class="page-title">$title$</h1>
$body$
      <a class="back" href="index.html">&larr; <span class="course"></span></a>
    </main>
    <script src="tp.js"></script>
    <script>
      // The way back names the course, from deck.config.js.
      document.querySelectorAll(".course").forEach(function (el) {
        el.textContent = (window.DECK_CONFIG && window.DECK_CONFIG.title) || "Back";
      });
    </script>
    <script type="module">
      import { backgroundSketch } from "./sketch.js";
      import { tableOfContents } from "./engine/toc.js";
      backgroundSketch(document.getElementById("sketch"));
      // Figures drawn live (<canvas data-figure="name"> in the markdown): the
      // course draws them in its own figures.js, `export drawFigures()`.
      if (document.querySelector("canvas[data-figure]")) {
        import("./figures.js").then((m) => m.drawFigures());
      }
      // The outline, once MathJax has set the formulas of the titles; it
      // starts under the bar, as in the text mode.
      const outline = () => tableOfContents(document.querySelector("main"));
      if (window.MathJax && MathJax.startup) MathJax.startup.promise.then(outline);
      else addEventListener("load", outline);
    </script>
  </body>
</html>
