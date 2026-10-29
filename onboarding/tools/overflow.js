// Text that runs off the slide, on every slide of a lecture.
//
//   node tools/serve.js 9090 &
//   node tools/overflow.js http://localhost:9090/00_introduction.html
//
// Changing the body font changes every line length at once; this walks the
// scene of each slide and reports the pieces of TEXT whose box leaves the
// frame. It says nothing about two blocks overlapping — that still needs
// eyes on a contact sheet.
//
// Needs puppeteer-core and Chrome, like tools/shots.js (not part of the site).

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const [url, ...only] = process.argv.slice(2);
if (!url) {
  console.error("usage: node tools/overflow.js <url> [slide...]");
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
let bad = 0;

for (const i of wanted) {
  await page.evaluate((n) => window.__deck.deck.slide(n), i);
  await new Promise((r) => setTimeout(r, 250));
  await page.waitForFunction(() => !window.__deck.player.pending, { timeout: 4000 })
    .catch(() => {});
  const hits = await page.evaluate(() => {
    const HW = 14.222 / 2, HH = 4;
    const out = [];
    const seen = new Set();
    for (const top of window.__deck.player.scene.mobjects) {
      for (const m of top.walk()) {
        // Text and MathTex: the mobjects a font change moves.
        const label = m.str !== undefined ? String(m.str)
          : (m.tex !== undefined ? String(m.tex) : null);
        if (label === null || seen.has(m.id)) continue;
        seen.add(m.id);
        const b = m.bbox();
        if (b.x1 - b.x0 <= 0 && b.y1 - b.y0 <= 0) continue;
        const over = [];
        if (b.x0 < -HW) over.push(`left ${(-HW - b.x0).toFixed(2)}`);
        if (b.x1 > HW) over.push(`right ${(b.x1 - HW).toFixed(2)}`);
        if (b.y0 < -HH) over.push(`bottom ${(-HH - b.y0).toFixed(2)}`);
        if (b.y1 > HH) over.push(`top ${(b.y1 - HH).toFixed(2)}`);
        if (over.length) {
          out.push(`${over.join(", ")} — ${label.replace(/\s+/g, " ").slice(0, 70)}`);
        }
      }
    }
    return out;
  });
  for (const h of hits) { console.log(`slide ${i}: ${h}`); bad++; }
}

console.log(`${wanted.length} slides, ${bad} overflowing pieces`);
await browser.close();
