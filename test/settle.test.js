// Run: npm test
// "Settle in" (docs/DESIGN.md, principle 2 and "Entrance budget"): on page entry gauges, bars and
// vials arrive a little short of their real value, overshoot it slightly and settle on it; readings roll
// up into place character by character (always the real reading, never a count); micro-labels track in.
// Nothing is ever far from the truth: every keyframe stays within max(15 % of the value, 3 % of full
// scale) of it, so a glance mid-entrance never reads a false "0°". Pure logic plus source wiring checks.
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
const M = L.MOTION;

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= (eps || 1e-9), `${a} != ${b}`);
const bound = (f) => Math.max(0.15 * f, 0.03);

// --- pure logic --------------------------------------------------------------------------------
test("MOTION: settle 600 ms from 85 % with a 3 % overshoot; the roll and the label track-in", () => {
  assert.equal(M.settleMs, 600);
  assert.equal(M.settleFrom, 0.85);
  assert.equal(M.settleOver, 0.03);
  assert.ok(M.settleOverAt > 0.3 && M.settleOverAt < 0.9, M.settleOverAt);
  assert.ok(M.rollMs <= 450, M.rollMs);
  assert.equal(M.rollStepMs, 30);
  assert.ok(M.rollCharMs > 0 && M.rollCharMs < M.rollMs, M.rollCharMs);
  assert.equal(M.rollLift, 60);
  assert.ok(M.labelMs >= 300 && M.labelMs <= 450, M.labelMs);
  assert.ok(M.labelScale > 1 && M.labelScale <= 1.1, M.labelScale);
});

test("settleFrames: from 85 % of the value, a 3 % (of full scale) overshoot, then the value", () => {
  const k = L.settleFrames(0.5);
  assert.equal(k.length, 3);
  near(k[0], 0.425);
  near(k[1], 0.53);
  assert.equal(k[2], 0.5);
});

test("settleFrames: the overshoot is clamped to full scale", () => {
  const k = L.settleFrames(1);
  near(k[0], 0.85);
  assert.equal(k[1], 1);
  assert.equal(k[2], 1);
  near(L.settleFrames(0.99)[1], 1);
});

test("settleFrames: no reading (null, NaN, junk) and a zero value do not move", () => {
  for (const f of [null, undefined, NaN, "0.5", 0, -0.2]) assert.equal(L.settleFrames(f), null, String(f));
});

test("settleFrames: honesty contract, every keyframe within max(15 % of the value, 3 %) of it", () => {
  for (let i = 1; i <= 1000; i++) {
    const f = i / 1000;
    const k = L.settleFrames(f);
    assert.ok(k, `no frames for ${f}`);
    assert.equal(k[k.length - 1], f, `does not end on ${f}`);
    for (const x of k) {
      assert.ok(x >= 0 && x <= 1, `${x} outside [0, 1] for ${f}`);
      assert.ok(Math.abs(x - f) <= bound(f) + 1e-12, `${x} too far from ${f}`);
      assert.ok(x > 0, `a nonzero value ${f} shows zero`);
    }
  }
});

test("rollDelays: 30 ms per character, the whole roll inside rollMs, long text compressed", () => {
  assert.deepEqual(L.rollDelays(0), []);
  assert.deepEqual(L.rollDelays(-1), []);
  assert.deepEqual(L.rollDelays(1), [0]);
  assert.deepEqual(L.rollDelays(4), [0, 30, 60, 90]);
  for (const n of [1, 3, 6, 9, 12, 40]) {
    const d = L.rollDelays(n);
    assert.equal(d.length, n);
    assert.ok(d[n - 1] + M.rollCharMs <= M.rollMs, `${n}: ${d[n - 1]} + ${M.rollCharMs}`);
    for (let i = 1; i < n; i++) assert.ok(d[i] >= d[i - 1], `${n}: delays go backwards`);
  }
});

test("budget: the whole entrance (stagger + settle, roll, labels, the settle pulse) ends inside 950 ms", () => {
  const last = Math.max(...L.staggerDelays(30));
  assert.ok(M.entranceMs <= 950, M.entranceMs);
  assert.ok(last + M.settleMs <= M.entranceMs, last + M.settleMs);
  assert.ok(last + M.rollMs <= M.entranceMs, last + M.rollMs);
  assert.ok(last + M.labelMs <= M.entranceMs, last + M.labelMs);
  assert.ok(last + M.settleMs * M.settleOverAt + M.settlePulseMs <= M.entranceMs, "settle pulse");
});

// --- card wiring --------------------------------------------------------------------------------
test("card: the entrance settles in (through _enter, so it shifts with the fade and is cancelled with _slides)", () => {
  assert.match(method("_enter"), /this\._entrance\(toEl\)/);
  const enter = method("_entrance");
  assert.match(enter, /this\._settleIn\(el\)/);
  assert.match(enter, /this\._stagger\(el\)/);
  assert.match(enter, /this\._drawIn\(el\)/);
  const s = method("_settleIn");
  assert.match(s, /L\.staggerDelays\(/);
  assert.match(s, /if \(this\._reduced\(\)\) return \[\]/);
  // A drag commit still skips the entrance (no _enter after a drag).
  const go = method("_go");
  assert.match(go, /if \(drag\) return;[^\n]*\n\s*this\._enter\(toEl\);/);
});

test("card: gauges, bars and vials settle through L.settleFrames; the marker pulses once", () => {
  const all = ["_settleIn", "_settleTo", "_settleGauge"].map(method).join("\n");
  assert.match(all, /L\.settleFrames\(/);
  assert.match(all, /\.val, \.halo/);
  assert.match(all, /\.mark/);
  assert.match(all, /\.bar i/);
  assert.match(all, /\.lq/);
  assert.match(all, /\.lvl/);
  assert.match(all, /M\.settlePulseMs/);
  assert.ok(!/pulseCount/.test(all), "the entrance pulse is one ring, not pulseCount");
  assert.ok(!/this\._pulse\(/.test(all), "the entrance pulse is its own single ring");
});

test("card: readings roll up character by character with L.rollDelays, from their own real text", () => {
  const r = method("_rollIn");
  assert.match(r, /L\.rollDelays\(/);
  assert.match(r, /M\.rollLift/);
  assert.match(r, /M\.rollMaxChars/);
  // The characters are the reading's own (never a count or a stand-in), and plain text comes back after.
  assert.match(r, /const text = v\.textContent/);
  assert.match(r, /v\.textContent = v\._final/);
  assert.ok(!/Math\.random|tweenAt|numberTween/.test(r));
});

test("card: micro-labels and the room heading track in (scaleX and opacity, transform-origin set in CSS)", () => {
  const s = method("_settleIn");
  assert.match(s, /\.ml, \.gl/);
  assert.match(s, /room-name/);
  assert.match(method("_trackIn"), /M\.labelScale/);
  assert.match(CARD, /\.ml, \.gl, \.room-name \{[^}]*transform-origin/);
});

test("card: settle-in animates only transform, opacity and stroke-dashoffset", () => {
  const all = ["_settleIn", "_settleTo", "_settleGauge", "_rollIn", "_trackIn"].map(method).join("\n");
  // As keyframe properties (`filter:`), not words: _settleIn filters hidden blocks with Array.filter.
  for (const bad of ["letterSpacing", "letter-spacing", "width", "height", "filter", "left", "top", "fontSize", "blur"]) {
    assert.ok(!new RegExp(`["']?\\b${bad}\\b["']?\\s*:`).test(all), `settle-in animates ${bad}`);
  }
  assert.ok(!/blur\(/.test(all), "settle-in blurs");
  const props = new Set();
  for (const m of all.matchAll(/\b([a-zA-Z]+):\s/g)) props.add(m[1]); // every object key in the methods
  const keyframeProps = [...props].filter((p) => !["duration", "delay", "easing", "fill", "offset", "iterations", "composite"].includes(p));
  for (const p of keyframeProps) assert.ok(["transform", "opacity", "strokeDashoffset"].includes(p), `animates ${p}`);
  // The parse saw the real keyframes (a check that found nothing would pass vacuously).
  for (const p of ["transform", "opacity", "strokeDashoffset"]) assert.ok(keyframeProps.includes(p), `parse missed ${p}`);
});

test("card: a live change mid-settle stops that element's settle from where it is on screen", () => {
  const u = method("_unsettle");
  assert.match(u, /commitStyles\(\)/);
  assert.match(u, /\.cancel\(\)/);
  const set = method("_setMotion");
  assert.match(set, /this\._unsettle\(el\)/);
  for (const m of ["_paintGauge", "_paintRow", "_paintScent"]) assert.match(method(m), /this\._setMotion\(/, m);
  // A number that changes mid-roll: the roll stops, the plain new reading goes in and rolls as a change.
  const sv = method("_setValue");
  assert.match(sv, /v\._roll/);
});

test("card: the old dishonest entrances stay gone", () => {
  for (const gone of ["_countIn", "_sweepIn", "_decodeIn", "_finishDecode", "data-decode", "countFrom", "decodeText"]) {
    assert.equal(CARD.includes(gone), false, gone);
  }
  assert.equal("decodeMs" in M, false);
});
