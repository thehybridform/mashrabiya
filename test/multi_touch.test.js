// Run: npm test
// Three-finger toggle (dist/mashrabiya-logic.js, mashrabiya-card.js). The IR frame reports up to 50 touch
// points, so besides the double tap the glass can be blacked out (mirror mode) and brought back with
// three fingers: ANY three-finger swipe toggles the display, whichever way it goes (up, down, sideways,
// diagonal, or toward / away from the fingers' centre). Two fingers do nothing. Decided when the first
// finger lifts.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");
const MM = 4; // px per mm

const P = (x, y) => ({ x: x * MM, y: y * MM }); // positions in mm, for readability
const S = [P(40, 50), P(60, 45), P(80, 50)];
const move = (ps, dx, dy) => ps.map((p) => ({ x: p.x + dx * MM, y: p.y + dy * MM }));

test("MULTI: a swipe is 25 mm of travel; a gather or spread 60 % (or 1/0.6) of the spread and 10 mm", () => {
  assert.equal(L.MULTI.swipeMm, 25);
  assert.equal(L.MULTI.gatherRatio, 0.6);
  assert.equal(L.MULTI.gatherMm, 10);
});

test("multiGesture: a three-finger swipe in any direction toggles", () => {
  for (const [dx, dy] of [[0, 40], [0, -40], [40, 0], [-40, 0], [30, 30], [-30, 30], [0, 25]]) {
    assert.equal(L.multiGesture(S, move(S, dx, dy), MM), "toggle", `${dx},${dy}`);
  }
});

test("multiGesture: three fingers toward or away from their centre toggle", () => {
  const wide = [P(20, 80), P(60, 20), P(100, 80)];
  const tight = [P(50, 65), P(60, 50), P(70, 65)];
  assert.equal(L.multiGesture(wide, tight, MM), "toggle");
  assert.equal(L.multiGesture(tight, wide, MM), "toggle");
});

test("multiGesture: too little movement is nothing", () => {
  assert.equal(L.multiGesture(S, move(S, 0, 20), MM), null); // 20 mm
  assert.equal(L.multiGesture(S, move(S, 15, 15), MM), null); // ~21 mm
  assert.equal(L.multiGesture(S, S, MM), null); // a three-finger touch, no swipe
  const wide = [P(20, 80), P(60, 20), P(100, 80)];
  assert.equal(L.multiGesture(wide, [P(26, 77), P(60, 26), P(94, 77)], MM), null); // ~85 % gather
  assert.equal(L.multiGesture([P(50, 55), P(55, 50), P(60, 55)], [P(54, 54), P(55, 53), P(56, 54)], MM), null); // tight: under 10 mm
});

test("multiGesture: two fingers do nothing, however they move", () => {
  assert.equal(L.multiGesture([P(0, 0), P(100, 0)], [P(30, 0), P(60, 0)], MM), null);
  assert.equal(L.multiGesture([P(40, 40), P(60, 60)], [P(0, 0), P(100, 100)], MM), null);
  assert.equal(L.multiGesture([P(0, 0), P(50, 0)], [P(0, 80), P(50, 80)], MM), null);
});

test("multiGesture: other finger counts and bad input are nothing", () => {
  assert.equal(L.multiGesture([P(0, 0)], [P(0, 50)], MM), null);
  assert.equal(L.multiGesture([P(0, 0), P(1, 1), P(2, 2), P(3, 3)], [P(0, 50), P(1, 51), P(2, 52), P(3, 53)], MM), null);
  assert.equal(L.multiGesture(S, move(S, 0, 40).slice(0, 2), MM), null); // mismatched
  assert.equal(L.multiGesture(S, [S[0], S[1], { x: NaN, y: 0 }], MM), null);
  assert.equal(L.multiGesture(S, move(S, 0, 40), 0), null);
  assert.equal(L.multiGesture(undefined, undefined, MM), null);
});

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};

test("card: finger positions are tracked from the capture-phase pointer stream", () => {
  for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
    assert.match(CARD, new RegExp(`addEventListener\\("${t}", \\(e\\) => this\\._multiTrack\\(e\\), true\\)`));
  }
});

test("card: only live fingers count (stuck ghosts are left out), and it honours mirror_mode", () => {
  const m = method("_multiTrack");
  assert.match(m, /L\.staleIds\(/);
  assert.match(m, /mirror_mode/);
});

test("card: the first finger up decides through L.multiGesture and toggles; a cancel decides nothing", () => {
  const m = method("_multiTrack");
  assert.match(m, /L\.multiGesture\(/);
  assert.match(m, /pointercancel/);
  assert.match(m, /this\._mirror \? this\._mirrorExit\(false\) : this\._mirrorEnter\(\)/);
});
