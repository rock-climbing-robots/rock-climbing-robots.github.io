// Layout check: text that leaves the slide, text that grazes an edge, and
// pairs of texts whose boxes overlap.
//
//   node tools/serve.js 9090 &
//   node tools/layout.js http://localhost:9090/00_introduction.html
//
// tools/overflow.js only reports what falls off the slide; two blocks
// sitting on top of each other is the other half of "the layout is a mess",
// and that is what this adds. It also checks the OPAQUE panels (exercise
// cards, hints) against everything else: a card laid over a label hides it
// completely, and comparing text with text alone never sees it. It is a
// hint, not a verdict: a label ON a figure is often deliberate, so read the
// slides it points at.
//
// Needs puppeteer-core and Chrome, like tools/shots.js (not part of the site).

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const [url, ...only] = process.argv.slice(2);
const MARGIN = Number(process.env.MARGIN || 0.18);   // how close to the edge is too close
if (!url) {
  console.error("usage: node tools/layout.js <url> [slide...]");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[error]", e.message));
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => !document.getElementById("booting"), { timeout: 60000 });

const count = await page.evaluate(() => window.__deck.player.slides.length);
const wanted = only.length ? only.map(Number) : [...Array(count).keys()];
let edges = 0, overlaps = 0, covered = 0;

for (const i of wanted) {
  await page.evaluate((n) => window.__deck.deck.slide(n), i);
  await new Promise((r) => setTimeout(r, 220));
  await page.waitForFunction(() => !window.__deck.player.pending, { timeout: 4000 })
    .catch(() => {});
  const hits = await page.evaluate((margin) => {
    const HW = 14.222 / 2, HH = 4;
    const out = { edge: [], overlap: [], covered: [] };
    const items = [];
    const panels = [];
    const seen = new Set();
    for (const top of window.__deck.player.scene.mobjects) {
      for (const m of top.walk()) {
        const label = m.str !== undefined ? String(m.str)
          : (m.tex !== undefined ? String(m.tex) : null);
        if (label === null || seen.has(m.id)) continue;
        seen.add(m.id);
        const b = m.bbox();
        if (b.x1 - b.x0 <= 0.01 || b.y1 - b.y0 <= 0.01) continue;
        if (m.opacity !== undefined && m.opacity < 0.05) continue;
        items.push({ b, label: label.replace(/\s+/g, " ").slice(0, 46) });
      }
    }
    // The opaque panels, collected in the same walk as the texts.
    for (const top of window.__deck.player.scene.mobjects) {
      for (const m of top.walk()) {
        if (!(m.fillOpacity >= 0.9 && m.w !== undefined && m.h !== undefined)) continue;
        const b = m.bbox();
        if ((b.x1 - b.x0) < 1 || (b.y1 - b.y0) < 0.4) continue;
        panels.push(b);
      }
    }
    // A text that a panel covers only PARTLY is a text the panel hides; one
    // entirely inside it is the panel's own wording.
    for (const p of panels) {
      for (const it of items) {
        const b = it.b;
        const w = Math.min(p.x1, b.x1) - Math.max(p.x0, b.x0);
        const h = Math.min(p.y1, b.y1) - Math.max(p.y0, b.y0);
        if (w <= 0.02 || h <= 0.02) continue;
        const inside = b.x0 > p.x0 - 0.02 && b.x1 < p.x1 + 0.02
          && b.y0 > p.y0 - 0.02 && b.y1 < p.y1 + 0.02;
        if (inside) continue;
        out.covered.push(`${(w * h).toFixed(2)} hidden — "${it.label}"`);
      }
    }

    for (const it of items) {
      const { b } = it;
      const over = [];
      if (b.x0 < -HW + margin) over.push(`left ${(b.x0 + HW).toFixed(2)}`);
      if (b.x1 > HW - margin) over.push(`right ${(HW - b.x1).toFixed(2)}`);
      if (b.y0 < -HH + margin) over.push(`bottom ${(b.y0 + HH).toFixed(2)}`);
      if (b.y1 > HH - margin) over.push(`top ${(HH - b.y1).toFixed(2)}`);
      if (over.length) out.edge.push(`${over.join(", ")} — ${it.label}`);
    }
    // Overlapping pairs: the shared area has to be worth mentioning, and
    // one box entirely inside another is a piece of the same formula.
    for (let a = 0; a < items.length; a++) {
      for (let c = a + 1; c < items.length; c++) {
        const A = items[a].b, B = items[c].b;
        const w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const h = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (w <= 0.04 || h <= 0.04) continue;
        const area = w * h;
        const sa = (A.x1 - A.x0) * (A.y1 - A.y0);
        const sb = (B.x1 - B.x0) * (B.y1 - B.y0);
        const inside = area > 0.9 * Math.min(sa, sb);
        if (inside || area < 0.06) continue;
        out.overlap.push(`${area.toFixed(2)} — "${items[a].label}" / "${items[c].label}"`);
      }
    }
    return out;
  }, MARGIN);
  for (const h of hits.edge) { console.log(`slide ${i + 1} [edge] ${h}`); edges++; }
  for (const h of hits.overlap) { console.log(`slide ${i + 1} [over] ${h}`); overlaps++; }
  for (const h of hits.covered) { console.log(`slide ${i + 1} [card] ${h}`); covered++; }
}

console.log(`${wanted.length} slides — ${edges} near the edge, `
  + `${overlaps} overlapping pairs, ${covered} covered by a panel`);
await browser.close();
