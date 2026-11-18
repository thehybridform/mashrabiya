// Run: npm test
// Touch feedback on the mirror card (dist/mashrabiya-logic.js): a ring where a tap lands, a short
// fading trail behind a dragging finger, a chevron burst on a recognised swipe. The card draws them in
// one pointer-events:none overlay from a fixed pool of nodes; these are the pure parts.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const T = () => L.TOUCH;
const p = (x, y, t) => ({ x, y, t });

test("TOUCH: ripple about 450 ms, trail fades within 300 ms, a small fixed pool", () => {
  assert.ok(T().rippleMs >= 400 && T().rippleMs <= 500, T().rippleMs);
  assert.ok(T().trailMs > 0 && T().trailMs <= 300, T().trailMs);
  assert.ok(T().trailMax >= 4 && T().trailMax <= 12, T().trailMax);
  assert.ok(T().reducedDotMs <= 150, T().reducedDotMs);
  assert.ok(T().burstMs > 0 && T().burstMs <= 500, T().burstMs);
});

test("trailPush: appends, never mutates the input", () => {
  const a = [p(0, 0, 0)];
  const b = L.trailPush(a, p(20, 0, 10));
  assert.equal(a.length, 1);
  assert.deepEqual(b, [p(0, 0, 0), p(20, 0, 10)]);
  assert.deepEqual(L.trailPush(undefined, p(1, 1, 1)), [p(1, 1, 1)]);
});

test("trailPush: decimates moves shorter than trailMinPx", () => {
  const a = [p(0, 0, 0)];
  assert.equal(L.trailPush(a, p(T().trailMinPx - 1, 0, 5)).length, 1);
  assert.equal(L.trailPush(a, p(T().trailMinPx + 1, 0, 5)).length, 2);
});

test("trailPush: points older than trailMs age out; at most trailMax kept", () => {
  let tr = [];
  for (let i = 0; i < 40; i++) tr = L.trailPush(tr, p(i * 50, 0, i * 10));
  assert.ok(tr.length <= T().trailMax, tr.length);
  assert.equal(tr[tr.length - 1].x, 39 * 50); // newest kept
  const old = L.trailPush([p(0, 0, 0)], p(100, 0, T().trailMs + 1));
  assert.deepEqual(old, [p(100, 0, T().trailMs + 1)]);
});

test("trailPush: ignores non-finite points", () => {
  const a = [p(0, 0, 0)];
  assert.deepEqual(L.trailPush(a, p(NaN, 0, 1)), a);
  assert.deepEqual(L.trailPush(a, null), a);
});

test("trailFrame: newer dots are brighter and bigger; dots past trailMs are gone", () => {
  const tr = [p(0, 0, 0), p(50, 0, 100), p(100, 0, 200)];
  const f = L.trailFrame(tr, 250);
  assert.equal(f.length, tr.filter((d) => 250 - d.t < T().trailMs).length);
  assert.ok(f.length >= 2);
  for (let i = 1; i < f.length; i++) {
    assert.ok(f[i].alpha > f[i - 1].alpha);
    assert.ok(f[i].scale >= f[i - 1].scale);
  }
  for (const d of f) assert.ok(d.alpha > 0 && d.alpha <= 1);
  assert.deepEqual(L.trailFrame(tr, 10000), []);
  assert.deepEqual(L.trailFrame(undefined, 0), []);
});

test("burstAngle: the chevron points the way the swipe went", () => {
  assert.equal(L.burstAngle("right"), 0);
  assert.equal(L.burstAngle("left"), 180);
  assert.equal(L.burstAngle(null), null);
  assert.equal(L.burstAngle("up"), null);
});
