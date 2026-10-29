// The outline of a page, fixed in the top left corner: the text mode
// (read.html) and the practicals (tp.html) both have one.
//
// Every title of the page (h1, h2, h3) is listed, indented by its level; a
// click scrolls to it. The titles already scrolled past -- above the top of
// the window, under the bar -- are struck through and faded: what is left to
// read stands out. It only shows where the window leaves room for it beside
// the text (reader.css, #toc).
//
// Self-contained on purpose (no import): a page that is not a module of the
// engine -- a practical made by pandoc -- loads it just as well.

/** Build the outline of the titles inside `root`, and keep it up to date. */
export function tableOfContents(root) {
  const titles = [...root.querySelectorAll("h1, h2, h3")];
  if (titles.length < 2) return null;
  const nav = document.createElement("nav");
  nav.id = "toc";
  nav.setAttribute("aria-label", document.documentElement.lang === "fr" ? "Plan" : "Outline");
  const items = titles.map((h) => {
    const a = document.createElement("a");
    a.className = `toc-${h.tagName.toLowerCase()}`;
    // The title as it is set, formulas included, without its permalink "#".
    const copy = h.cloneNode(true);
    copy.querySelectorAll(".permalink").forEach((x) => x.remove());
    a.innerHTML = copy.innerHTML;
    a.href = h.id ? `#${h.id}` : "#";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (h.tagName === "H1") scrollTo({ top: 0, behavior: "smooth" });
      else h.scrollIntoView({ behavior: "smooth", block: "start" });
      if (h.id) history.replaceState(null, "", `#${h.id}`);
    });
    nav.appendChild(a);
    return { h, a };
  });
  document.body.appendChild(nav);

  // The scroll line: the bottom of the sticky bar, or the top of the window
  // on a page that has none.
  const bar = document.getElementById("bar");
  let queued = false;
  const paint = () => {
    queued = false;
    const line = bar ? bar.getBoundingClientRect().bottom : 0;
    for (const { h, a } of items) a.classList.toggle("passed", h.getBoundingClientRect().top < line);
    // A long outline scrolls on its own: the first title still ahead stays in view.
    const next = items.find(({ a }) => !a.classList.contains("passed"));
    if (next && nav.scrollHeight > nav.clientHeight) {
      const top = next.a.offsetTop - nav.clientHeight / 3;
      if (Math.abs(nav.scrollTop - top) > nav.clientHeight / 3) nav.scrollTop = top;
    }
  };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  addEventListener("scroll", later, { passive: true });
  addEventListener("resize", later);
  paint();
  return nav;
}
