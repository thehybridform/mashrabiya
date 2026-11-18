// Run: npm test
// Page model and motion timing for the mirror card (dist/mashrabiya-logic.js).
// Pages wrap in a loop (Main, More, one page per room, Main, ...) laid out left to right like a carousel.
// Swipe LEFT (finger right -> left) brings in the NEXT page from the right edge; swipe RIGHT brings in the
// previous page from the left edge. Directions are the way the finger (and the content) moves.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

test("PAGES: Main and More head the loop; one page per room follows (pageKeys)", () => {
  assert.deepEqual(L.PAGES, ["main", "more"]);
});

test("nextPage: left is +1 (next), right is -1 (previous), both wrap", () => {
  assert.equal(L.nextPage(0, "left", 3), 1);
  assert.equal(L.nextPage(1, "left", 3), 2);
  assert.equal(L.nextPage(2, "left", 3), 0); // last page, swipe left -> Main
  assert.equal(L.nextPage(0, "right", 3), 2); // Main, swipe right -> last page
  assert.equal(L.nextPage(2, "right", 3), 1);
  assert.equal(L.nextPage(1, "right", 3), 0);
});

test("nextPage: generalises to more pages", () => {
  assert.equal(L.nextPage(3, "left", 4), 0);
  assert.equal(L.nextPage(0, "right", 4), 3);
  assert.equal(L.nextPage(2, "left", 4), 3);
});

test("nextPage: no direction stays put; bad input is safe", () => {
  assert.equal(L.nextPage(1, null, 3), 1);
  assert.equal(L.nextPage(1, "up", 3), 1);
  assert.equal(L.nextPage(5, null, 3), 2); // normalised
  assert.equal(L.nextPage(-1, "left", 3), 0);
  assert.equal(L.nextPage(1, "left", 1), 0);
  assert.equal(L.nextPage(1, "left", 0), 0);
  assert.equal(L.nextPage(NaN, "left", 3), 1);
  assert.equal(L.nextPage(undefined, "right", 3), 2);
});

test("pageDirection: shortest way round, ties go forward; forward is content moving LEFT", () => {
  assert.equal(L.pageDirection(0, 1, 3), "left"); // Main -> More: More comes in from the right
  assert.equal(L.pageDirection(1, 2, 3), "left");
  assert.equal(L.pageDirection(2, 0, 3), "left"); // idle return from the last page wraps forward
  assert.equal(L.pageDirection(1, 0, 3), "right"); // idle return / Close from More: Main comes in from the left
  assert.equal(L.pageDirection(0, 2, 3), "right");
  assert.equal(L.pageDirection(0, 2, 4), "left"); // tie
  assert.equal(L.pageDirection(1, 1, 3), null);
  assert.equal(L.pageDirection(0, 1, 0), null);
});

test("pageDirection agrees with nextPage: the slide it picks is the swipe that would get there", () => {
  for (const n of [2, 3, 5]) {
    for (let i = 0; i < n; i++) {
      assert.equal(L.nextPage(i, L.pageDirection(i, (i + 1) % n, n), n), (i + 1) % n);
    }
  }
});

test("slideFrames: the page follows the finger", () => {
  // Swipe left: current exits to the left, the next page enters from the right.
  assert.deepEqual(L.slideFrames("left"), { out: [0, -100], in: [100, 0] });
  // Swipe right: current exits to the right, the previous page enters from the left.
  assert.deepEqual(L.slideFrames("right"), { out: [0, 100], in: [-100, 0] });
  assert.equal(L.slideFrames(null), null);
});

test("slideFrames: a drag that commits finishes the move from where the finger left it", () => {
  assert.deepEqual(L.slideFrames("left", 0.25), { out: [-25, -100], in: [75, 0] });
  assert.deepEqual(L.slideFrames("right", 0.4), { out: [40, 100], in: [-60, 0] });
  assert.deepEqual(L.slideFrames("left", 0), L.slideFrames("left"));
  // Clamped and safe.
  assert.deepEqual(L.slideFrames("left", 2), { out: [-100, -100], in: [0, 0] });
  assert.deepEqual(L.slideFrames("right", -1), L.slideFrames("right"));
  assert.deepEqual(L.slideFrames("right", NaN), L.slideFrames("right"));
  for (const v of [...L.slideFrames("left", 1).out, ...L.slideFrames("left", 1).in, ...L.slideFrames("right", 0).out]) {
    assert.ok(!Object.is(v, -0), "never -0");
  }
});

test("MOTION: slide 300-350 ms; stagger whole entrance under 500 ms", () => {
  const M = L.MOTION;
  assert.ok(M.slideMs >= 300 && M.slideMs <= 350, M.slideMs);
  assert.ok(M.fadeMs <= 150, M.fadeMs);
  assert.ok(M.staggerStep >= 40 && M.staggerStep <= 60, M.staggerStep);
  const d = L.staggerDelays(20);
  assert.ok(Math.max(...d) + M.staggerMs < 500, Math.max(...d) + M.staggerMs);
});

test("staggerDelays: each block one step after the previous, capped", () => {
  const M = L.MOTION;
  const d = L.staggerDelays(4);
  assert.equal(d.length, 4);
  assert.equal(d[0], M.staggerBase);
  assert.equal(d[1] - d[0], M.staggerStep);
  assert.equal(d[3] - d[2], M.staggerStep);
  const long = L.staggerDelays(30);
  assert.equal(long[29], long[M.staggerCap]);
  assert.deepEqual(L.staggerDelays(0), []);
  assert.deepEqual(L.staggerDelays(-2), []);
});
