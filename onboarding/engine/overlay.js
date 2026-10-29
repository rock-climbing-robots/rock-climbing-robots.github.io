// The HTML layer laid over the canvas.
//
// Nearly everything in a lecture is drawn on the canvas. A few things are
// not: a code listing, which must stay REAL text -- selectable, coloured by
// highlight.js -- and the things one interacts with: a slider, a link. They
// live in this layer, above the canvas AND above reveal.js (or reveal swallows
// the clicks), positioned at every frame from the centre of their mobject.
//
// Every element is hidden at the start of a frame and shown again if it was
// drawn: that is what makes it disappear with its slide. The layer lets the
// pointer through everywhere but on the elements themselves, so swiping and
// clicking still navigate.
//
// One layer PER CANVAS. The slides have one canvas, full screen, and its
// layer is `#html-layer`; the text mode (engine/reader.js) puts a figure in
// the page, each with its own canvas and layer (`Renderer.layer`). An entry
// (a listing, a slider) is therefore one element per layer it is drawn in:
// `entry.at(r)` returns the one of the renderer that draws. The element of
// the slides' layer, `entry.el`, always exists: a listing is also measured on
// it.

import { onBeginFrame, onEndFrame } from "./render.js";

let home = null;
const pool = new Map();     // key -> entry
const byLayer = new Map();  // layer -> the records that live in it

/** The slides' layer, full screen. */
function homeLayer() {
  if (home) return home;
  home = document.createElement("div");
  home.id = "html-layer";
  document.body.appendChild(home);
  byLayer.set(home, new Set());
  return home;
}

const layerOf = (r) => (r && r.layer) || homeLayer();

// A renderer hides and shows only what lives in ITS layer: redrawing one
// figure of the text mode does not switch off its neighbour's listing.
onBeginFrame((r) => {
  for (const rec of byLayer.get(layerOf(r)) || []) rec.want = false;
});
onEndFrame((r) => {
  for (const rec of byLayer.get(layerOf(r)) || []) {
    if (rec.want === rec.shown) continue;
    rec.el.style.display = rec.want ? "block" : "none";
    rec.shown = rec.want;
  }
});

function place(el, layer) {
  el.style.display = "none";
  layer.appendChild(el);
  if (!byLayer.has(layer)) byLayer.set(layer, new Set());
}

/**
 * The layer entry for a key, built once and reused. The player replays the
 * scene on every jump: without this cache, each pass would add one more
 * element.
 *
 * `make()` only returns the element; the rest of the entry belongs to the
 * caller (that is where a slider keeps its value from one pass to the next).
 *
 * The entry IS the record of the slides' layer (`el`, `want`, `shown`);
 * `at(r)` returns the record of the layer `r` draws in, and `peek(r)` the
 * same without creating it.
 */
export function overlayEntry(key, make) {
  let entry = pool.get(key);
  if (entry) return entry;
  const layer = homeLayer();
  const el = make();
  place(el, layer);
  entry = { el, shown: false, want: false, unit: 0, entry: null, recs: new Map() };
  entry.entry = entry;
  entry.recs.set(layer, entry);
  entry.peek = (r) => entry.recs.get(layerOf(r));
  entry.at = (r) => {
    const l = layerOf(r);
    let rec = entry.recs.get(l);
    if (!rec) {
      rec = { el: make(), shown: false, want: false, entry };
      place(rec.el, l);
      entry.recs.set(l, rec);
    }
    byLayer.get(l).add(rec);
    return rec;
  };
  byLayer.get(layer).add(entry);
  pool.set(key, entry);
  return entry;
}
