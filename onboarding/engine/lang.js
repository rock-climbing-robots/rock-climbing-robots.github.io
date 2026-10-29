// The language the slides are drawn in.
//
// A lecture is written in ONE language, CONFIG.lang, and stays so in its
// source. Every other language (CONFIG.translations) is a dictionary,
// lectures/i18n/<code>.js, keyed by the string EXACTLY as the lecture hands
// it to text(), tex() or math():
//
//   export const DICT = { "Dynamic programming": "Programmation dynamique" };
//   export const TOKENS = [["play", "jouer"]];     // optional, see trMath
//
// A string the dictionary does not know is drawn as it was written: a lecture
// not yet translated simply stays in the source language.
//
// A formula often carries a number computed on the fly, so no exact key could
// hold it: the few WORDS living inside formulas are substituted token by token
// instead (TOKENS).
//
// Read ONCE at load, like the palette: `?lang=xx` forces one page; otherwise
// the choice remembered by "d" three times (engine/deck.js) or by the language
// button of the other pages (theme-toggle.js). `?i18n=collect` records every
// string that went through tr(), for tools/strings.js to list what is still
// untranslated.

import { CONFIG, LANGS, LANG_KEY } from "./config.js";

export { LANG_KEY, LANGS };

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
let saved = null;
try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* private mode */ }
const wanted = (params && params.get("lang")) || saved;

/** The language in force: one of LANGS. */
export const LANG = LANGS.includes(wanted) ? wanted : CONFIG.lang;
const TRANSLATED = LANG !== CONFIG.lang;

let DICT = {};
let TOKENS = [];

/**
 * Fetch the dictionary of the language in force. engine/deck.js awaits it
 * before anything is built -- a mobject keeps the words it was built with.
 */
export async function loadLanguage() {
  if (!TRANSLATED) return;
  try {
    const m = await import(`../lectures/i18n/${LANG}.js`);
    DICT = m.DICT || {};
    TOKENS = m.TOKENS || [];
  } catch (e) {
    console.warn(`no dictionary for "${LANG}": the slides stay in ${CONFIG.lang}`, e);
  }
}

const has = (str) => Object.prototype.hasOwnProperty.call(DICT, str);
const seen = params && params.get("i18n") === "collect" ? new Set() : null;
if (seen) window.__i18n = { seen, lang: LANG, missing: () => [...seen].filter((s) => !has(s)) };

/** The string in the language in force; as written when none is known. */
export function tr(str) {
  if (typeof str !== "string") return str;
  if (seen) seen.add(str);
  return TRANSLATED && has(str) ? DICT[str] : str;
}

/** The same for a formula: a whole-string entry first, then the word tokens. */
export function trMath(str) {
  if (typeof str !== "string") return str;
  if (seen) seen.add(str);
  if (!TRANSLATED) return str;
  if (has(str)) return DICT[str];
  let out = str;
  for (const [src, dst] of TOKENS) out = out.split(src).join(dst);
  return out;
}

/** The language after this one, for "d" three times and the language button. */
export function nextLang() {
  return LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length];
}
