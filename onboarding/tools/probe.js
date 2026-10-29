// What is on a slide, and where — so a remark can point at it.
//
//   node tools/serve.js 9090 &
//   node tools/probe.js http://localhost:9090/00_introduction.html 89
//
// Prints one line per top-level mobject: its kind, its text if it has any,
// its bounding box in WORLD units (manim frame units, y up, origin centred)
// and in page pixels. tools/annotate.js takes the world box back.

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const [url, slide] = process.argv.slice(2);
if (!url || !slide) {
  console.error("usage: node tools/probe.js <url> <slide>");
  process.exit(1);
}

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
await new Promise((r) => setTimeout(r, 400));

const found = await page.evaluate(() => {
  const player = window.__deck.player;
  const rect = player.renderer.canvas.getBoundingClientRect();
  const unit = player.renderer.unit;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const px = (b) => ({
    x: Math.round(cx + b.x0 * unit),
    y: Math.round(cy - b.y1 * unit),
    w: Math.round((b.x1 - b.x0) * unit),
    h: Math.round((b.y1 - b.y0) * unit),
  });
  const label = (m) => {
    if (typeof m.str === "string") return m.str;
    if (Array.isArray(m.tex)) return m.tex.join(" | ");
    if (typeof m.tex === "string") return m.tex;
    const kids = [...m.walk()].map((k) => k.str || (Array.isArray(k.tex) && k.tex.join(" ")))
      .filter(Boolean);
    return kids.slice(0, 3).join(" / ");
  };
  return player.scene.mobjects.map((m, i) => {
    const b = m.bbox();
    return {
      i,
      kind: m.constructor.name,
      z: m.zIndex || 0,
      text: String(label(m) || "").replace(/\s+/g, " ").slice(0, 90),
      world: { x0: +b.x0.toFixed(2), y0: +b.y0.toFixed(2),
               x1: +b.x1.toFixed(2), y1: +b.y1.toFixed(2) },
      px: px(b),
    };
  });
});

console.log(JSON.stringify(found, null, 1));
await browser.close();
