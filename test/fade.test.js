// Run: npm test
// Fade page transition (config `transition: fade`): pages crossfade instead of sliding, and a drag
// drives the crossfade instead of moving the pages. These are the pure parts plus source wiring checks.
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

const W = 1440;
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= (eps || 1e-9), `${a} != ${b}`);

test("fadeProgress: tracks the drag, full fade at 40 % of the width, clamped, never NaN", () => {
  assert.equal(L.DRAG.fadeFrac, 0.4);
  assert.equal(L.fadeProgress(0, W), 0);
  near(L.fadeProgress(-W * 0.2, W), 0.5);
  near(L.fadeProgress(W * 0.2, W), 0.5);
  assert.equal(L.fadeProgress(-W * 0.4, W), 1);
  assert.equal(L.fadeProgress(-W, W), 1);
  assert.equal(L.fadeProgress(NaN, W), 0);
  assert.equal(L.fadeProgress(-100, 0), 0);
  assert.equal(L.fadeProgress(undefined, W), 0);
});

test("fadeProgress: a committing drag (a quarter of the page) is already past half way", () => {
  const p = L.fadeProgress(-W * L.DRAG.commitFrac, W);
  assert.ok(p > 0.5 && p < 1, p);
});

test("fadeFrames: outgoing 1 -> 0, incoming 0 -> 1, from where the drag got to", () => {
  const f = L.fadeFrames(0);
  assert.deepEqual(f.out, [1, 0]);
  assert.deepEqual(f.in, [0, 1]);
  const h = L.fadeFrames(0.25);
  near(h.out[0], 0.75);
  near(h.in[0], 0.25);
  assert.equal(h.out[1], 0);
  assert.equal(h.in[1], 1);
  assert.deepEqual(L.fadeFrames(NaN).in, [0, 1]);
  assert.deepEqual(L.fadeFrames(7).out, [0, 0]);
});

test("fadeFrames: a very slight scale on the incoming page, 0.985 -> 1", () => {
  assert.deepEqual(L.fadeFrames(0).scale, [0.985, 1]);
  near(L.fadeFrames(0.5).scale[0], 0.9925);
  assert.deepEqual(L.fadeFrames(1).scale, [1, 1]);
  assert.equal(L.fadeScale(0), 0.985);
  assert.equal(L.fadeScale(1), 1);
});

test("MOTION.crossfadeMs is the 360 ms fade; the reduced-motion crossfade stays 140 ms", () => {
  assert.equal(L.MOTION.crossfadeMs, 360);
  assert.equal(L.MOTION.fadeMs, 140);
});

test("resolveConfig: transition is slide unless fade is asked for", () => {
  assert.equal(L.resolveConfig({}, null).transition, "slide");
  assert.equal(L.resolveConfig({ transition: "fade" }, null).transition, "fade");
  assert.equal(L.resolveConfig({ transition: "slide" }, null).transition, "slide");
  assert.equal(L.resolveConfig({ transition: "wipe" }, null).transition, "slide");
  assert.equal(L.resolveConfig({ transition: 3 }, null).transition, "slide");
});

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};

test("card: _go crossfades in fade mode (no translate, no wipe) and drags use the fade helpers", () => {
  const go = method("_go");
  assert.match(go, /L\.fadeFrames\(/);
  const fadeBranch = go.slice(go.indexOf("L.fadeFrames("), go.indexOf("L.slideFrames("));
  assert.ok(!/translateX|wipe/.test(fadeBranch), "fade branch must not translate or wipe");
  assert.match(method("_dragTo"), /L\.fadeProgress\(/);
  assert.match(method("_dragEnd"), /L\.fadeProgress\(/);
});

test("card: reduced motion still takes the 140 ms crossfade before any transition branch", () => {
  const go = method("_go");
  assert.ok(go.indexOf("this._reduced()") < go.indexOf("L.fadeFrames("));
});

// --- asymmetric fade: out as before, in slower, ease-out, overlapping (Apple HIG: brief, interruptible) ---

test("fadeTiming: navigation fades out in 360 ms and in over 700 ms, ease-out, starting half way through the out", () => {
  const t = L.fadeTiming(0);
  assert.equal(t.outMs, 360);
  assert.equal(t.inMs, 700);
  assert.equal(t.inDelayMs, 180);
  assert.equal(t.outEase, "ease-in-out");
  assert.equal(t.inEase, "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.deepEqual(L.fadeTiming(undefined), t);
  assert.deepEqual(L.fadeTiming(NaN), t);
});

test("fadeTiming: no dead black gap (the in starts before the out ends) and the whole move stays under a second", () => {
  const t = L.fadeTiming(0);
  assert.ok(t.inDelayMs > 0 && t.inDelayMs < t.outMs);
  assert.ok(t.inDelayMs + t.inMs < 1000);
});

test("fadeTiming: a committed drag finishes the out at the old speed, the in on the slow curve scaled to what is left, capped at 600 ms", () => {
  const p = 0.6;
  const t = L.fadeTiming(p);
  assert.equal(t.outMs, L.settleMs(1 - p, 1, L.MOTION.crossfadeMs));
  assert.equal(t.inDelayMs, 0);
  assert.equal(t.inEase, L.fadeTiming(0).inEase);
  assert.equal(t.inMs, Math.round(700 * (1 - p)));
  assert.equal(L.fadeTiming(0.01).inMs, 600);
  assert.equal(L.fadeTiming(1).inMs, L.DRAG.minMs);
});

test("fadeFrames: starts the out and in from given opacities (an interrupted fade continues from where it was)", () => {
  const f = L.fadeFrames(0, 0.4, 0.7);
  assert.deepEqual(f.out, [0.4, 0]);
  assert.deepEqual(f.in, [0.7, 1]);
  near(f.scale[0], L.fadeScale(0.7));
  assert.deepEqual(L.fadeFrames(0).out, [1, 0]);
  assert.deepEqual(L.fadeFrames(0, NaN, NaN).in, [0, 1]);
});

test("currentOpacity: a finite computed value clamped to 0..1, else the fallback", () => {
  assert.equal(L.currentOpacity("0.35", 1), 0.35);
  assert.equal(L.currentOpacity(0.5, 1), 0.5);
  assert.equal(L.currentOpacity("", 1), 1);
  assert.equal(L.currentOpacity("abc", 0), 0);
  assert.equal(L.currentOpacity("7", 0), 1);
  assert.equal(L.currentOpacity("-2", 1), 0);
  assert.equal(L.currentOpacity(undefined, 0.2), 0.2);
});

test("card: _go uses fadeTiming (separate out/in timing) and continues an in-flight fade without snapping it", () => {
  const go = method("_go");
  assert.match(go, /L\.fadeTiming\(/);
  assert.match(go, /inDelayMs/);
  assert.match(go, /L\.currentOpacity\(/);
  assert.match(go, /_fadeAnims/);
  assert.match(go, /\.cancel\(\)/);
  const fadeBranch = go.slice(go.indexOf("L.fadeFrames("), go.indexOf("L.slideFrames("));
  assert.ok(!/crossfadeMs/.test(fadeBranch), "timing comes from fadeTiming, not a literal duration");
});

test("card: _go never refuses or defers input while a transition runs (no busy guard)", () => {
  const go = method("_go");
  assert.ok(!/if \(this\._(busy|animating|transitioning)/.test(go));
  assert.ok(!/this\._slides\.length\)\s*return/.test(go));
});

// HIG (no false values on arrival): the entrance no longer decodes or counts, so there is nothing left to
// defer on a timer; only the shifted animations remain.
test("card: fade navigation starts the entrance at inDelayMs (shifted animations); drag commit and slide do not", () => {
  const go = method("_go");
  const fadeBranch = go.slice(go.indexOf("L.fadeFrames("), go.indexOf("L.slideFrames("));
  assert.match(fadeBranch, /if \(!drag\) this\._enter\(toEl, ft\.inDelayMs\)/);
  const slideTail = go.slice(go.indexOf("L.slideFrames("));
  assert.match(slideTail, /this\._enter\(toEl\);/);
  const enter = method("_enter");
  assert.match(enter, /delayMs/);
  assert.match(enter, /updateTiming\(/);
});


test("card: a double tap during a veil fade reverses it from the opacity it has reached", () => {
  assert.match(method("_mirrorEnter"), /L\.currentOpacity\(getComputedStyle\(v\)\.opacity/);
  assert.match(method("_mirrorExit"), /L\.currentOpacity\(getComputedStyle\(v\)\.opacity/);
});
