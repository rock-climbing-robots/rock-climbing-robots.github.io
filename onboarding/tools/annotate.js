// A slide, marked up: a screenshot with what a remark is about circled,
// underlined, struck through or pointed at.
//
//   node tools/annotate.js <url> <slide> <out.png> <<'JSON'
//   [ { "type": "circle", "world": [-5.63, 0.08, -1.17, 1.12], "label": "here" },
//     { "type": "strike", "world": [1.2, -0.4, 3.0, 0.1] } ]
//   JSON
//
// Boxes are given in WORLD units (x0, y0, x1, y1 — manim frame units, y up,
// origin centred), the ones tools/probe.js prints. Types:
//   circle    an ellipse around the box        box      a rounded rectangle
//   underline a line under the box             strike   a line through it
//   arrow     an arrow pointing at the box     label    just the caption
// Each takes an optional "label" (drawn beside it), "color" ("red" by
// default, also "blue", "green", "gold") and "pad" (world units, 0.15).

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const [url, slide, out] = process.argv.slice(2);
if (!url || !slide || !out) {
  console.error("usage: node tools/annotate.js <url> <slide> <out.png> < marks.json");
  process.exit(1);
}
const marks = JSON.parse(await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data || "[]"));
}));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[error]", e.message));
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => !document.getElementById("booting"), { timeout: 60000 });
await page.evaluate((n) => window.__deck.deck.slide(n - 1), Number(slide));
await page.waitForFunction(() => !window.__deck.player.pending, { timeout: 15000 })
  .catch(() => {});
await new Promise((r) => setTimeout(r, 500));

await page.evaluate((marks) => {
  const player = window.__deck.player;
  const rect = player.renderer.canvas.getBoundingClientRect();
  const unit = player.renderer.unit;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const X = (x) => cx + x * unit, Y = (y) => cy - y * unit;
  const COLORS = { red: "#FC6255", blue: "#58C4DD", green: "#83C167", gold: "#F0AC5F" };

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("style", "position:fixed;inset:0;width:100vw;height:100vh;"
    + "z-index:99999;pointer-events:none");
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  for (const m of marks) {
    const color = COLORS[m.color] || COLORS.red;
    const pad = m.pad === undefined ? 0.15 : m.pad;
    const [wx0, wy0, wx1, wy1] = m.world;
    const x0 = X(wx0 - pad), x1 = X(wx1 + pad);
    const y0 = Y(wy1 + pad), y1 = Y(wy0 - pad);   // y flips
    const w = x1 - x0, h = y1 - y0;
    const common = { fill: "none", stroke: color, "stroke-width": 3.5,
                     "stroke-linecap": "round" };
    if (m.type === "circle") {
      svg.appendChild(mk("ellipse", { ...common, cx: x0 + w / 2, cy: y0 + h / 2,
        rx: w / 2 + 6, ry: h / 2 + 6 }));
    } else if (m.type === "box") {
      svg.appendChild(mk("rect", { ...common, x: x0, y: y0, width: w, height: h,
        rx: 8, ry: 8 }));
    } else if (m.type === "underline") {
      svg.appendChild(mk("line", { ...common, x1: x0, y1: y1 + 3, x2: x1, y2: y1 + 3 }));
    } else if (m.type === "strike") {
      svg.appendChild(mk("line", { ...common, x1: x0, y1: y0 + h / 2,
        x2: x1, y2: y0 + h / 2 }));
    } else if (m.type === "arrow") {
      // Comes in from the free side, and stops short of the box.
      const from = m.from === "left" ? [x0 - 90, y0 + h / 2 - 40]
        : m.from === "below" ? [x0 + w / 2 + 40, y1 + 80]
        : m.from === "above" ? [x0 + w / 2 - 40, y0 - 80]
        : [x1 + 90, y0 + h / 2 - 40];
      const to = m.from === "left" ? [x0 - 10, y0 + h / 2]
        : m.from === "below" ? [x0 + w / 2, y1 + 10]
        : m.from === "above" ? [x0 + w / 2, y0 - 10]
        : [x1 + 10, y0 + h / 2];
      svg.appendChild(mk("line", { ...common, x1: from[0], y1: from[1],
        x2: to[0], y2: to[1] }));
      const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
      const tip = (k) => [to[0] - 16 * Math.cos(a + k), to[1] - 16 * Math.sin(a + k)];
      const [p, q] = [tip(0.4), tip(-0.4)];
      svg.appendChild(mk("polygon", { fill: color,
        points: `${to[0]},${to[1]} ${p[0]},${p[1]} ${q[0]},${q[1]}` }));
    }
    if (m.label) {
      // Above the mark by default, below it when there is no room.
      const above = y0 > 46;
      const tx = x0 + w / 2, ty = above ? y0 - 12 : y1 + 26;
      const t = mk("text", { x: tx, y: ty, fill: color, "text-anchor": "middle",
        "font-family": "Lato, system-ui, sans-serif", "font-size": 20,
        "font-weight": 600, "paint-order": "stroke",
        stroke: getComputedStyle(document.body).backgroundColor || "#000",
        "stroke-width": 5, "stroke-linejoin": "round" });
      t.textContent = m.label;
      svg.appendChild(t);
    }
  }
  document.body.appendChild(svg);
}, marks);

await new Promise((r) => setTimeout(r, 150));
await page.screenshot({ path: out });
console.log(out);
await browser.close();
