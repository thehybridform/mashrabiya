#!/usr/bin/env node
// The tokenizer and hash behind test/privacy.test.js, and a helper that prints the digest to add there.
//
//   node test/privacy-hash.js sub  "<text>"   any text without spaces, matched anywhere (substring)
//   node test/privacy-hash.js word "<word>"   a whole word (letters, digits, underscore)
//   node test/privacy-hash.js pre  "<start>"  the start of a word
//   node test/privacy-hash.js pair "<a> <b>"  a two-word phrase, matched anywhere: the end of a word,
//                                            one space, the start of the next (prints two digests)
//
// Copy the printed digest into DIGESTS in test/privacy.test.js (a pair's two digests into PAIRS). Never
// commit the token itself: not in a comment, a commit message or a test fixture. Everything is lowercased
// first (the scan ignores case).
//
// How a text becomes candidate tokens (each hashed as SHA-256 of SALT + "<kind>:<token>"):
//   sub   every substring, SUB_MIN to SUB_MAX characters long, of every run of [a-z0-9_.@:/\-]
//         (identifiers, dotted entity ids, host:port/paths, addresses, e-mail fragments, file paths);
//   word  every whole \w+ word;
//   pre   every prefix, PRE_MIN characters or longer, of every \w+ word;
//   pair  two \w+ words separated by exactly one space: a suffix of the first ("pairL:<suffix>") and
//         a prefix of the second ("pairR:<prefix>") are hashed apart, per word, and a phrase is banned
//         as one [left, right] digest pair, so "a b" is caught wherever the regex /a b/ would be
//         without hashing every substring of every line.
"use strict";
const crypto = require("node:crypto");

const SALT = "mashrabiya-privacy-v1\u0000";
const SUB_MIN = 4;
const SUB_MAX = 40;
const PRE_MIN = 2;
const PRE_MAX = 24;
const KINDS = ["sub", "word", "pre", "pair"];

const digest = (kind, token) => crypto.createHash("sha256").update(SALT + kind + ":" + token).digest("hex");

// A phrase "<left> <right>" as its two digests.
function pairDigests(phrase) {
  const at = phrase.indexOf(" ");
  if (at <= 0 || at === phrase.length - 1 || phrase.indexOf(" ", at + 1) >= 0 || !/^\w+ \w+$/.test(phrase)) {
    throw new Error("a pair is two words of letters, digits or underscore with one space between");
  }
  return [digest("pairL", phrase.slice(0, at)), digest("pairR", phrase.slice(at + 1))];
}

const RUN = /[a-z0-9_.@:/\\-]+/g;
const WORD = /\w+/g;
const PAIR = /(\w+) (\w+)/;

// Yields [kind, token] for every single-token candidate in `text` (already lowercased). Duplicates are
// left in; callers dedupe.
function* candidates(text) {
  for (const [run] of text.matchAll(RUN)) {
    for (let len = SUB_MIN; len <= Math.min(SUB_MAX, run.length); len++) {
      for (let i = 0; i + len <= run.length; i++) yield ["sub", run.slice(i, i + len)];
    }
  }
  for (const [w] of text.matchAll(WORD)) {
    yield ["word", w];
    for (let len = PRE_MIN; len <= Math.min(PRE_MAX, w.length); len++) yield ["pre", w.slice(0, len)];
  }
}

// Every [first, second] pair of \w+ words separated by exactly one space, overlapping ("a b c" gives
// "a b" and "b c").
function* wordPairs(text) {
  const re = new RegExp(PAIR.source, "g");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    yield [m[1], m[2]];
    re.lastIndex = m.index + m[1].length + 1;
  }
}

// A scanner over fixed digests (`digests`: single tokens; `pairs`: [left, right] phrase digests). Hashes
// are memoised per candidate and per word, so a token that appears in many files is hashed once.
function scanner(digests, pairs) {
  const banned = new Set(digests);
  const pairList = (pairs || []).map(([l, r]) => [l, r]);
  const lefts = new Set(pairList.map(([l]) => l));
  const rights = new Set(pairList.map(([, r]) => r));
  const seen = new Map();
  const ends = new Map();
  // The pair-half digests of `w`'s suffixes (side "L") or prefixes (side "R") that are banned halves.
  const halves = (w, side) => {
    const key = side + w;
    let got = ends.get(key);
    if (got) return got;
    got = new Map();
    for (let len = 1; len <= Math.min(PRE_MAX, w.length); len++) {
      const part = side === "L" ? w.slice(w.length - len) : w.slice(0, len);
      const d = digest("pair" + side, part);
      if ((side === "L" ? lefts : rights).has(d)) got.set(d, part);
    }
    ends.set(key, got);
    return got;
  };
  return function hits(text) {
    const lower = String(text).toLowerCase();
    const out = [];
    for (const [kind, token] of candidates(lower)) {
      const key = kind + ":" + token;
      let bad = seen.get(key);
      if (bad === undefined) {
        bad = banned.has(digest(kind, token));
        seen.set(key, bad);
      }
      if (bad) out.push(key);
    }
    if (pairList.length) {
      for (const [a, b] of wordPairs(lower)) {
        const l = halves(a, "L");
        if (!l.size) continue;
        const r = halves(b, "R");
        for (const [dl, dr] of pairList) if (l.has(dl) && r.has(dr)) out.push(`pair:${l.get(dl)} ${r.get(dr)}`);
      }
    }
    return out;
  };
}

module.exports = { SALT, KINDS, digest, pairDigests, candidates, wordPairs, scanner };

if (require.main === module) {
  const [kind, token] = process.argv.slice(2);
  if (!KINDS.includes(kind) || typeof token !== "string" || token === "") {
    console.error(`usage: node test/privacy-hash.js <${KINDS.join("|")}> "<token>"`);
    process.exit(2);
  }
  const t = token.toLowerCase();
  console.log(kind === "pair" ? JSON.stringify(pairDigests(t)) : digest(kind, t));
}
