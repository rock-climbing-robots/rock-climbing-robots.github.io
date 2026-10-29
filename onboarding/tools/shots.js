// Screenshots of a lecture, for checking it without a screen.
//
//   node tools/serve.js 9090 &
//   node tools/shots.js http://localhost:9090/00_introduction.html out [3 4 5]
//
// BROWSER=firefox uses Firefox instead of Chrome (worth doing: the two do
// not agree on SVG geometry).
// Needs a browser and puppeteer-core, which are NOT part of the site:
//   npm install puppeteer-core        (creates js/node_modules, git-ignored)
// Each slide is opened, its animations are played to the end, and a PNG is
// written. Assemble a contact sheet with ImageMagick:
//   montage out/*.png -tile 5x -geometry +2+2 -resize 480x270 sheet.png

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

// BROWSER=firefox checks the other engine (they disagree on SVG geometry).
const FIREFOX = process.env.BROWSER === "firefox";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const [url, outdir, ...only] = process.argv.slice(2);
if (!url || !outdir) {
  console.error("usage: node tools/shots.js <url> <outdir> [slide...]");
  process.exit(1);
}
mkdirSync(outdir, { recursive: true });

const browser = await puppeteer.launch(FIREFOX ? {
  browser: "firefox",
  executablePath: process.env.FIREFOX || "/snap/bin/firefox",
  headless: true,
  // The snap-packaged Firefox cannot read a profile under /tmp.
  userDataDir: process.env.HOME + "/snap/firefox/common/pp-profile",
  defaultViewport: { width: 1280, height: 720 },
} : {
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[error] ${e.message}\n${e.stack}`));

await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => !document.getElementById("booting"), { timeout: 60000 })
  .catch(() => logs.push("[boot] the deck never finished loading"));

const count = await page.evaluate(() => (window.__deck ? window.__deck.player.slides.length : -1));
const wanted = count < 0 ? [] : (only.length ? only.map(Number) : [...Array(count).keys()]);
logs.push(`[slides] ${count}`);

for (const i of wanted) {
  await page.evaluate((n) => window.__deck.deck.slide(n), i);
  await new Promise((r) => setTimeout(r, 300));
  // Wait for the slide's animations to settle (looping slides never do).
  await page.waitForFunction(() => !window.__deck.player.pending, { timeout: 11000 })
    .catch(() => logs.push(`[loop] slide ${i} is still animating`));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${outdir}/${String(i).padStart(2, "0")}.png` });
}

console.log(logs.join("\n"));
await browser.close();
