// Run: npm test
// Mirror mode: a double tap on a non-interactive area blacks the glass out (a pure mirror) until a timeout,
// another double tap, or a new door alert. Pure parts plus source wiring checks.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dir = path.join(__dirname, "..", "dist");
const SRC = path.join(dir, "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(dir, "mashrabiya-card.js"), "utf8");

const MM = 4;
const tap = (t, x, y) => ({ t, x, y });

test("DOUBLE_TAP: 350 ms and 10 mm", () => {
  assert.equal(L.DOUBLE_TAP.ms, 350);
  assert.equal(L.DOUBLE_TAP.mm, 10);
});

test("isDoubleTap: two taps close in time and place", () => {
  assert.equal(L.isDoubleTap(tap(1000, 100, 100), tap(1200, 105, 100), MM), true);
  assert.equal(L.isDoubleTap(tap(1000, 100, 100), tap(1350, 100, 100), MM), true); // boundary counts
  assert.equal(L.isDoubleTap(tap(1000, 100, 100), tap(1351, 100, 100), MM), false);
  assert.equal(L.isDoubleTap(tap(1000, 100, 100), tap(1100, 100 + 10 * MM, 100), MM), true);
  assert.equal(L.isDoubleTap(tap(1000, 100, 100), tap(1100, 100 + 10 * MM + 1, 100), MM), false);
  assert.equal(L.isDoubleTap(tap(1000, 0, 0), tap(1100, 8 * MM, 8 * MM), MM), false); // diagonal > 10 mm
});

test("isDoubleTap: nothing to compare, out of order, or bad input is not a double tap", () => {
  assert.equal(L.isDoubleTap(null, tap(1, 0, 0), MM), false);
  assert.equal(L.isDoubleTap(tap(1, 0, 0), null, MM), false);
  assert.equal(L.isDoubleTap(tap(2000, 0, 0), tap(1000, 0, 0), MM), false);
  assert.equal(L.isDoubleTap(tap(NaN, 0, 0), tap(1, 0, 0), MM), false);
  assert.equal(L.isDoubleTap(tap(1, 0, 0), tap(2, 0, 0), 0), false);
  assert.equal(L.isDoubleTap(tap(1, 0, 0), tap(2, 0, 0), undefined), false);
});

test("resolveConfig: mirror_mode on by default, timeout 180 s", () => {
  const d = L.resolveConfig({}, null);
  assert.equal(d.mirror_mode, true);
  assert.equal(d.mirror_timeout, 180);
  assert.equal(L.resolveConfig({ mirror_mode: false }, null).mirror_mode, false);
  assert.equal(L.resolveConfig({ mirror_timeout: 60 }, null).mirror_timeout, 60);
  for (const bad of [0, -5, "x", NaN, null, Infinity]) assert.equal(L.resolveConfig({ mirror_timeout: bad }, null).mirror_timeout, 180, String(bad));
});

test("MIRROR: 400 ms in, 600 ms out, reduced motion at most 140 ms", () => {
  assert.equal(L.MIRROR.inMs, 400);
  assert.equal(L.MIRROR.outMs, 600);
  assert.ok(L.MIRROR.reducedMs <= 140);
  assert.equal(L.mirrorFadeMs("in", false), 400);
  assert.equal(L.mirrorFadeMs("out", false), 600);
  assert.equal(L.mirrorFadeMs("in", true), L.MIRROR.reducedMs);
  assert.equal(L.mirrorFadeMs("out", true), L.MIRROR.reducedMs);
});

test("mirrorAlertExit: only a door that was not already alerting ends mirror mode", () => {
  assert.equal(L.mirrorAlertExit(new Set(), ["a"]), true);
  assert.equal(L.mirrorAlertExit(undefined, ["a"]), true);
  assert.equal(L.mirrorAlertExit(new Set(["a"]), ["a"]), false);
  assert.equal(L.mirrorAlertExit(new Set(["a"]), ["a", "b"]), true);
  assert.equal(L.mirrorAlertExit(new Set(["a"]), []), false);
  assert.equal(L.mirrorAlertExit(new Set(), []), false);
  assert.equal(L.mirrorAlertExit(new Set(), undefined), false);
});

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};

test("card: the double tap only counts on non-interactive areas and never after a drag", () => {
  assert.match(method("_tapUp"), /L\.isDoubleTap\(/);
  assert.match(method("_gestureUp"), /!g\.drag && !dir/); // a drag or a swipe is never a tap
  assert.match(CARD, /_isInteractive\(/);
});

test("card: mirror mode stops the FPS meter, the idle return and touch feedback, and ends on a new alert", () => {
  assert.match(method("_mirrorEnter"), /_fpsStop\(\)/);
  assert.match(method("_mirrorEnter"), /clearTimeout\(this\._detailTimer\)/);
  assert.match(method("_mirrorExit"), /_fpsSync\(\)/);
  assert.match(method("_armDetailTimer"), /this\._mirror/);
  assert.match(method("_gestureDown"), /this\._mirror/);
  assert.match(method("_syncDoorAlert"), /L\.mirrorAlertExit\(/);
  assert.match(method("disconnectedCallback"), /_mirrorTimer/);
});
