// Run: npm test
// The configurable swipe order: L.orderPages(configPages, availableKeys) and L.pageKeys(rooms, radars, pages).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const AVAIL = ["main", "more", "radar", "room:a", "room:b", "room:c"];

test("orderPages: no config keeps the default order", () => {
  assert.deepEqual(L.orderPages(null, AVAIL), AVAIL);
  assert.deepEqual(L.orderPages(undefined, AVAIL), AVAIL);
});

test("orderPages: main is always first, even when omitted or listed later", () => {
  assert.deepEqual(L.orderPages(["room:b", "room:a"], AVAIL), ["main", "room:b", "room:a", "room:c"]);
  assert.deepEqual(L.orderPages(["room:b", "main", "more"], AVAIL).slice(0, 2), ["main", "room:b"]);
});

test("orderPages: unavailable keys are skipped silently", () => {
  assert.deepEqual(L.orderPages(["main", "radar", "room:zzz", "room:a"], ["main", "room:a"]), ["main", "room:a"]);
});

test("orderPages: unlisted rooms are appended; unlisted more/radar are omitted", () => {
  assert.deepEqual(L.orderPages(["main", "room:c"], AVAIL), ["main", "room:c", "room:a", "room:b"]);
});

test("orderPages: the rooms wildcard places the remaining rooms in default order", () => {
  assert.deepEqual(L.orderPages(["main", "room:c", "rooms", "more"], AVAIL), ["main", "room:c", "room:a", "room:b", "more"]);
  assert.deepEqual(L.orderPages(["main", "rooms", "radar"], AVAIL), ["main", "room:a", "room:b", "room:c", "radar"]);
});

test("orderPages: duplicates are ignored; junk entries are ignored", () => {
  assert.deepEqual(L.orderPages(["main", "more", "more", "room:a", "room:a", 7, null, ""], AVAIL), ["main", "more", "room:a", "room:b", "room:c"]);
});

test("orderPages: empty or non-array config falls back sensibly", () => {
  assert.deepEqual(L.orderPages([], AVAIL), ["main", "room:a", "room:b", "room:c"]);
  assert.deepEqual(L.orderPages("main", AVAIL), AVAIL);
});

test("pageKeys: third argument applies the configured order; first room follows it", () => {
  const rooms = [{ id: "a" }, { id: "b" }];
  const keys = L.pageKeys(rooms, [{ prefix: "x" }], ["main", "more", "room:b", "room:a", "radar"]);
  assert.deepEqual(keys, ["main", "more", "room:b", "room:a", "radar"]);
  assert.equal(keys[L.firstRoomIndex(keys)], "room:b");
});

test("pageKeys: a listed radar is skipped with no radars and appears when they arrive", () => {
  const rooms = [{ id: "a" }];
  const cfg = ["main", "radar", "room:a"];
  assert.deepEqual(L.pageKeys(rooms, [], cfg), ["main", "room:a"]);
  assert.deepEqual(L.pageKeys(rooms, [{ prefix: "x" }], cfg), ["main", "radar", "room:a"]);
});

test("resolveConfig: pages is a list or null", () => {
  assert.equal(L.resolveConfig({}, null).pages, null);
  assert.deepEqual(L.resolveConfig({ pages: ["main", "rooms"] }, null).pages, ["main", "rooms"]);
  assert.equal(L.resolveConfig({ pages: "x" }, null).pages, null);
});
