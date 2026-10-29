// The slides that LOOP, caught at several instants.
//
//   node tools/serve.js 9090 &
//   node tools/loops.js http://localhost:9090/00_introduction.html out
//
// tools/shots.js gives one image per slide, which for a looping slide is one
// pose out of the whole movement: a label that only collides halfway through
// the loop never shows up. This walks the lecture, finds the slides that
// loop (the player keeps a loopSource for them) and writes several frames of
// each, named <slide>-<k>.png.
//
// Needs puppeteer-core and Chrome, like tools/shots.js (not part of the site).

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const FRAMES = Number(process.env.FRAMES || 5);
const SPACING = Number(process.env.SPACING || 700);   // ms between frames
const [url, outdir, ...only] = process.argv.slice(2);
if (!url || !outdir) {
  console.error("usage: node tools/loops.js <url> <outdir> [slide...]");
  process.exit(1);
}
mkdirSync(outdir, { recursive: true });

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
const loops = [];

for (const i of wanted) {
  await page.evaluate((n) => window.__deck.deck.slide(n), i);
  // Wait for the slide's own animation to finish: the player only arms the
  // loop when the block ends, so asking too early reports the PREVIOUS
  // slide's answer.
  await page.waitForFunction(() => !window.__deck.player.pending, { timeout: 12000 })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 250));
  const looping = await page.evaluate(() => !!window.__deck.player.loopSource);
  if (!looping) continue;
  loops.push(i + 1);
  for (let k = 0; k < FRAMES; k++) {
    await new Promise((r) => setTimeout(r, SPACING));
    await page.screenshot({ path: `${outdir}/${String(i + 1).padStart(3, "0")}-${k}.png` });
  }
}

console.log(`${wanted.length} slides, ${loops.length} of them loop: ${loops.join(" ")}`);
await browser.close();
