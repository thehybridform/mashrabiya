// Run: npm test
// News ticker logic (dist/mashrabiya-logic.js): headline extraction from the rest sensors' `item`
// attribute (xmltodict output) and the ordered, toned segments the card renders.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const st = (state, attrs = {}) => ({ state, attributes: attrs });
const NOW = Date.parse("2026-11-15T20:00:00Z");
const feed = (item, state = "3") => st(state, { item });
const rfc = (msAgo) => new Date(NOW - msAgo).toUTCString();
const HOUR = 3600e3;

test("newsHeadlines: array of items gives clean titles in order", () => {
  const s = feed([{ title: "One", pubDate: rfc(HOUR) }, { title: "Two", pubDate: rfc(2 * HOUR) }]);
  assert.deepEqual(L.newsHeadlines(s, { nowMs: NOW }), ["One", "Two"]);
});

test("newsHeadlines: a single item object (xmltodict) is accepted", () => {
  assert.deepEqual(L.newsHeadlines(feed({ title: "Solo" }, "1"), { nowMs: NOW }), ["Solo"]);
});

test("newsHeadlines: title object with #text", () => {
  assert.deepEqual(L.newsHeadlines(feed([{ title: { "#text": "Wrapped", "@x": "y" } }]), { nowMs: NOW }), ["Wrapped"]);
});

test("newsHeadlines: decodes entities, named and numeric, and trims", () => {
  const s = feed([
    { title: "  Tom &amp; Jerry &#39;return&#39;  " },
    { title: "&quot;Quoted&quot; &lt;b&gt; it&#x2019;s &#8212; ok" },
    { title: "Double &amp;#39;encoded&amp;#39;" },
  ]);
  assert.deepEqual(L.newsHeadlines(s, { nowMs: NOW }), [
    "Tom & Jerry 'return'",
    "\"Quoted\" <b> it’s — ok",
    "Double 'encoded'",
  ]);
});

test("newsHeadlines: dedupes, drops empty and non-string titles", () => {
  const s = feed([{ title: "A" }, { title: " A " }, { title: "" }, { title: 7 }, {}, { title: "B" }]);
  assert.deepEqual(L.newsHeadlines(s, { nowMs: NOW }), ["A", "B"]);
});

test("newsHeadlines: drops items older than maxAgeH, keeps unparseable dates", () => {
  const s = feed([
    { title: "fresh", pubDate: rfc(23 * HOUR) },
    { title: "stale", pubDate: rfc(25 * HOUR) },
    { title: "garbled", pubDate: "not a date" },
    { title: "nodate" },
  ]);
  assert.deepEqual(L.newsHeadlines(s, { nowMs: NOW }), ["fresh", "garbled", "nodate"]);
  assert.deepEqual(L.newsHeadlines(s, { nowMs: NOW, maxAgeH: 48 }), ["fresh", "stale", "garbled", "nodate"]);
});

test("newsHeadlines: max defaults to 6 and is overridable", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ title: `H${i}` }));
  assert.equal(L.newsHeadlines(feed(items, "10"), { nowMs: NOW }).length, 6);
  assert.equal(L.newsHeadlines(feed(items, "10"), { nowMs: NOW, max: 2 }).length, 2);
});

test("newsHeadlines: missing, unavailable or item-less state is empty", () => {
  assert.deepEqual(L.newsHeadlines(undefined), []);
  assert.deepEqual(L.newsHeadlines(null), []);
  assert.deepEqual(L.newsHeadlines(st("unavailable", { item: [{ title: "x" }] })), []);
  assert.deepEqual(L.newsHeadlines(st("unknown")), []);
  assert.deepEqual(L.newsHeadlines(st("0", {})), []);
  assert.deepEqual(L.newsHeadlines(st("2", { item: "oops" })), []);
});

test("tickerSeconds: constant speed regardless of length", () => {
  assert.equal(L.tickerSeconds(2540, 4.235, 25), 2540 / 4.235 / 25);
  assert.ok(L.tickerSeconds(5080, 4.235, 25) > L.tickerSeconds(2540, 4.235, 25));
  assert.equal(L.tickerSeconds(0, 4.235, 25), 0);
  assert.equal(L.tickerSeconds(NaN, 4.235, 25), 0);
});
