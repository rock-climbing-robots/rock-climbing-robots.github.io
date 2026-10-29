// Every string a lecture draws, and which ones have no translation yet.
//
//   node tools/strings.js http://localhost:9090/00_introduction.html --lang fr [--all]
//
// Loads the lecture in that language with ?i18n=collect: indexing the slides
// replays every scene, so every text(), tex() and math() goes through
// engine/lang.js once. Prints a JSON array of the strings missing from
// lectures/i18n/<lang>.js (or of all of them with --all). No screenshot.

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--lang");
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
const flag = args.includes("--all") ? "--all" : null;
if (!url || (!lang && !flag)) {
  console.error("usage: node tools/strings.js <url> --lang <code> [--all]");
  process.exit(1);
}
const target = new URL(url);
target.searchParams.set("i18n", "collect");
if (lang) target.searchParams.set("lang", lang);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new", args: ["--no-sandbox"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[error]", e.message));
await page.goto(target.toString(), { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => !document.getElementById("booting"), { timeout: 60000 });
const out = await page.evaluate((all) => (all ? [...window.__i18n.seen] : window.__i18n.missing()),
                                flag === "--all");
// Numbers painted frame by frame are not words: leave them out.
console.log(JSON.stringify(out.filter((s) => /[A-Za-z]{2,}/.test(s)), null, 1));
await browser.close();
