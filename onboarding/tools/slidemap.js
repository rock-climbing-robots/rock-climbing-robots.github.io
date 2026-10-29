// Which slide number each scene of a lecture starts at.
//
//   node tools/serve.js 9090 &
//   node tools/slidemap.js http://localhost:9090/00_introduction.html
//
// The player anchors a slide on (scene, block); this prints the ranges, so a
// remark about a scene can name the slide the reader has to open.

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const url = process.argv[2];
if (!url) { console.error("usage: node tools/slidemap.js <url>"); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[error]", e.message));
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => !document.getElementById("booting"), { timeout: 60000 });

const map = await page.evaluate(() => window.__deck.player.slides.map((s, i) => ({
  slide: i + 1,
  scene: window.__deck.player.scenes[s.scene].name || String(s.scene),
  block: s.block,
})));

let run = null;
for (const s of map) {
  if (!run || run.scene !== s.scene) {
    if (run) console.log(`${String(run.from).padStart(3)}-${String(run.to).padStart(3)}  ${run.scene}`);
    run = { scene: s.scene, from: s.slide, to: s.slide };
  } else run.to = s.slide;
}
if (run) console.log(`${String(run.from).padStart(3)}-${String(run.to).padStart(3)}  ${run.scene}`);
console.log(`total: ${map.length} slides`);
await browser.close();
