// The passage from one slide to the next, frame by frame.
//
//   node tools/serve.js 9090 &
//   node tools/transition.js http://localhost:9090/00_introduction.html 37 out
//
// tools/shots.js photographs a slide once its animation is over, which is
// exactly what a remark about a FADE cannot show. This lands on slide n, asks
// for the next one and shoots every FRAMES ms while it plays, so the way one
// slide gives way to the next becomes visible.

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const STEP = Number(process.env.STEP || 130);     // ms between frames
const COUNT = Number(process.env.COUNT || 8);
const [url, from, outdir] = process.argv.slice(2);
if (!url || !from || !outdir) {
  console.error("usage: node tools/transition.js <url> <slide> <outdir>");
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
page.on("pageerror", (e) => console.error("[error]", e.message));
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => !document.getElementById("booting"), { timeout: 60000 });

// Land on the slide we leave, and let it settle.
await page.evaluate((n) => window.__deck.deck.slide(n - 1), Number(from));
await page.waitForFunction(() => !window.__deck.player.pending, { timeout: 15000 })
  .catch(() => {});
await new Promise((r) => setTimeout(r, 400));

await page.evaluate((n) => window.__deck.deck.slide(n), Number(from));
for (let k = 0; k < COUNT; k++) {
  await page.screenshot({ path: `${outdir}/${String(k).padStart(2, "0")}.png` });
  await new Promise((r) => setTimeout(r, STEP));
}

console.log(`${COUNT} frames de ${from} vers ${Number(from) + 1} dans ${outdir}`);
await browser.close();
