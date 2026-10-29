// The handles of a slide, taken hold of without a screen.
//
//   node tools/serve.js 9090 &
//   node tools/drag.js http://localhost:9090/02_vectors.html 7
//   node tools/drag.js "http://localhost:9090/read.html?l=02_vectors" '#live'
//   node tools/drag.js http://localhost:9090/02_vectors.html 7 --only 1
//
// A `handle()` (engine/handle.js) is a point of the figure one DRAGS: the
// only thing a screenshot cannot tell you about it is whether the picture
// follows. This drags every handle on screen, says whether anything changed,
// and reports what the page logged while it happened -- an updater that
// throws on a pose one can only reach by hand shows up here and nowhere else.
//
// The second argument is the SLIDE INDEX (0-based) on a lecture page, or a
// CSS selector to scroll to on a text page (`#a-section`, `figure:nth-of-type(2)`).
// --reset also checks that leaving the slide and coming back puts the handles
// where the lecture starts them (`reset: true`).
// BROWSER=firefox uses the other engine. Needs puppeteer-core, like shots.js.

import puppeteer from "puppeteer-core";

const FIREFOX = process.env.BROWSER === "firefox";
const argv = process.argv.slice(2);
const RESET = argv.includes("--reset");
// --only <n>: take hold of that handle alone (0-based, in the order the page
// holds them). A constraint BETWEEN two points -- one pushing the other away,
// one staying on the other's circle -- can only be seen one hand at a time.
const onlyAt = argv.indexOf("--only");
const ONLY = onlyAt < 0 ? null : Number(argv[onlyAt + 1]);
const args = argv.filter((a, i) => a !== "--reset"
  && (onlyAt < 0 || (i !== onlyAt && i !== onlyAt + 1)));
const [url, where, dx = "110", dy = "-70", shot] = args;
if (!url) {
  console.error("usage: node tools/drag.js <url> [slide|selector] [dx dy] [out.png] [--reset]");
  process.exit(1);
}

const browser = await puppeteer.launch(FIREFOX ? {
  browser: "firefox",
  executablePath: process.env.FIREFOX || "/snap/bin/firefox",
  headless: true,
  userDataDir: process.env.HOME + "/snap/firefox/common/pp-profile",
  defaultViewport: { width: 1280, height: 900 },
} : {
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push(`[error] ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") logs.push(`[console] ${m.text()}`); });

await page.goto(url, { waitUntil: "load", timeout: 60000 });
// A number is a slide of a lecture, a selector a place in a text: the deck
// only exists in the first case, and only once it has booted.
const slides = /^\d+$/.test(where ?? "");
if (slides) {
  await page.waitForFunction(() => window.__deck && !document.getElementById("booting"),
    { timeout: 60000 }).catch(() => logs.push("[boot] the deck never finished loading"));
}
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Where the handles on screen are, in CSS pixels, and what they are called
    (a handle with no name of its own is announced by its key alone). */
const spots = () => page.evaluate(() => [...document.querySelectorAll(".deck-handle")]
  .filter((el) => el.style.display !== "none")
  .map((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2,
             label: el.getAttribute("aria-label") || "" };
  }));
const round = (ps) => ps.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join("  ");

const go = async () => {
  if (where === undefined) return;
  if (slides) await page.evaluate((n) => window.__deck.deck.slide(Number(n)), where);
  else {
    // A text builds its sections from the lecture's module: the selector
    // does not exist yet when the page has merely loaded.
    await page.waitForSelector(where, { timeout: 30000 })
      .catch(() => logs.push(`[text] nothing matches ${where}`));
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: "center" });
    }, where);
    // A figure only draws when it comes near the screen, and its handles
    // appear with it.
    await page.waitForFunction(() => [...document.querySelectorAll(".deck-handle")]
      .some((el) => el.style.display !== "none"), { timeout: 10000 })
      .catch(() => logs.push("[text] no handle showed up"));
  }
  await settle(2500);
};

await go();
const start = await spots();
logs.push(`[handles] ${start.length} on screen: ${round(start)}`);
for (const p of start) logs.push(`[name] ${p.label || "(unnamed)"}`);
if (!start.length) {
  console.log(logs.join("\n"));
  await browser.close();
  process.exit(0);
}

const before = await page.screenshot({ encoding: "base64" });
const taken = ONLY === null ? start : start.filter((_, i) => i === ONLY);
if (ONLY !== null) logs.push(`[only] handle ${ONLY}: ${taken[0] ? taken[0].label : "none"}`);
for (const p of taken) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  // In steps: one jump would not tell a drag from a click.
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(p.x + (Number(dx) * k) / 8, p.y + (Number(dy) * k) / 8);
    await settle(20);
  }
  await page.mouse.up();
  await settle(120);
}
await settle(400);
const after = await page.screenshot({ encoding: "base64" });
const moved = await spots();
logs.push(`[dragged] ${round(moved)}`);
logs.push(`[picture] ${before === after ? "DID NOT FOLLOW" : "followed"}`);

if (RESET && slides) {
  await page.evaluate((n) => window.__deck.deck.slide(Number(n) - 1), where);
  await settle(1500);
  await go();
  const back = await spots();
  const same = round(back) === round(start);
  logs.push(`[reset] leaving and coming back: ${same ? "back where it starts" : `left at ${round(back)}`}`);
}

if (shot) await page.screenshot({ path: shot });
logs.push(`[errors] ${logs.some((l) => l.startsWith("[error]") || l.startsWith("[console]"))
  ? "see above" : "none"}`);
console.log(logs.join("\n"));
await browser.close();
