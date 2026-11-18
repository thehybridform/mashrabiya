// Run: npm test
// Mashrabiya, vivid: more colour and more motion on the mirror card (dist/mashrabiya-logic.js).
// Three hues per page instead of one accent, the slow ambient loops' timing, the richer entrance, the
// page-move parallax and wipe, what a changed reading does, and the radar's coloured rings and
// speed vectors. All pure; the card only applies them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// --- colour helpers ----------------------------------------------------------------------------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const c = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrastOnBlack = (hex) => (luminance(hex) + 0.05) / 0.05;
function hsv(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = null;
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0 };
}
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const MEANING = ["#30d158", "#64d2ff", "#ffd60a", "#ffa214", "#ff453a", "#bf5af2", "#ff9d96"];

const KEYS = ["main", "more", "radar", "room:living_room", "room:kitchen", "room:office", "room:garage", "room:", "nonsense"];

// --- palettes ----------------------------------------------------------------------------------
test("pagePalette: three distinct hues per page, the first being the page's accent", () => {
  for (const k of KEYS) {
    const p = L.pagePalette(k);
    assert.equal(p.length, 3, k);
    assert.equal(new Set(p).size, 3, `${k}: ${p}`);
    assert.equal(p[0], L.pageAccent(k), k);
    for (const c of p) assert.match(c, /^#[0-9a-f]{6}$/, `${k}: ${c}`);
  }
});

test("pagePalette: every hue legible on black (4.5:1)", () => {
  for (const k of KEYS) for (const c of L.pagePalette(k)) assert.ok(contrastOnBlack(c) >= 4.5, `${k} ${c} ${contrastOnBlack(c)}`);
});

// HIG: 40 degrees from every meaning colour (was 15), and a palette may end in a near-neutral tint
// (saturation under 0.2, reads as white): only two bright families are left that clear 40 degrees.
test("pagePalette: every hue is a bright family 40 degrees clear of every meaning colour, or a neutral tint", () => {
  for (const k of KEYS) {
    for (const c of L.pagePalette(k)) {
      const { h, s } = hsv(c);
      if (s < 0.2) continue;
      assert.ok(s >= 0.4, `${k} ${c}: chrome hues are saturated (the glass dims pastels)`);
      for (const m of MEANING) assert.ok(hueGap(h, hsv(m).h) >= 40, `${k}: ${c} too close to ${m}`);
    }
  }
});

test("pagePalette: the saturated hues of a page are well apart (30 degrees or more)", () => {
  for (const k of KEYS) {
    const sat = L.pagePalette(k).map(hsv).filter((x) => x.s >= 0.4);
    for (let i = 0; i < sat.length; i++) {
      for (let j = i + 1; j < sat.length; j++) assert.ok(hueGap(sat[i].h, sat[j].h) >= 30, `${k}: ${sat[i].h} vs ${sat[j].h}`);
    }
  }
});

test("pagePalette: stable per room, and rooms do not all share one palette", () => {
  assert.deepEqual(L.pagePalette("room:kitchen"), L.pagePalette("room:kitchen"));
  const ids = ["living_room", "kitchen", "bathroom", "bedroom", "guest_bedroom", "office", "studio", "garage"];
  const sigs = new Set(ids.map((id) => L.pagePalette(`room:${id}`).join()));
  assert.ok(sigs.size >= 4, `only ${sigs.size} palettes for ${ids.length} rooms`);
  assert.deepEqual(L.pagePalette("nonsense"), L.pagePalette("main"));
  assert.deepEqual(L.pagePalette(undefined), L.pagePalette("main"));
});

test("pagePalette: returns a copy (callers cannot recolour a page by mutating it)", () => {
  const p = L.pagePalette("more");
  p[1] = "#000000";
  assert.notEqual(L.pagePalette("more")[1], "#000000");
});

// --- ambient loops -----------------------------------------------------------------------------
// HIG (calm Main): the colon no longer beats and the control-row shimmer is gone (hig.test.js).
test("LOOPS: ambient chrome is slow", () => {
  const P = L.LOOPS;
  assert.ok(P.railMs >= 5000, P.railMs);
  assert.ok(P.driftMs >= 8000, P.driftMs);
  assert.ok(P.pulseMs >= 600 && P.pulseMs * P.pulseCount <= 4000, `${P.pulseMs} x ${P.pulseCount}`);
});


// --- entrance ----------------------------------------------------------------------------------
// The whole entrance, settle-in included, is held to L.MOTION.entranceMs (950 ms) in settle.test.js.
test("MOTION: icons pop and rails draw inside 650 ms of page entry", () => {
  const M = L.MOTION;
  const last = Math.max(...L.staggerDelays(30));
  assert.ok(M.popMs >= 200, M.popMs);
  assert.ok(last + M.popMs <= 650, last + M.popMs);
  assert.ok(M.railMs <= 650, M.railMs);
  assert.ok(M.wipeMs === M.slideMs, "the wipe line rides the page edge, so it lasts exactly as long as the slide");
  assert.ok(M.popScale > 0.6 && M.popScale < 1, M.popScale);
  assert.ok(M.popOvershoot > 1 && M.popOvershoot <= 1.12, M.popOvershoot);
});

// --- page move: parallax chrome and the wipe line ------------------------------------------------
test("chromeFrames: the chrome layer moves at `depth` of the page (parallax)", () => {
  for (const dir of ["right", "left"]) {
    const page = L.slideFrames(dir), chrome = L.chromeFrames(dir, 0.6);
    for (const k of ["out", "in"]) {
      for (let i = 0; i < 2; i++) near(page[k][i] + chrome[k][i], 0.6 * page[k][i], 1e-9);
    }
  }
  assert.deepEqual(L.chromeFrames("right", 1), { out: [0, 0], in: [0, 0] });
  assert.equal(L.chromeFrames("up", 0.6), null);
  // Default depth is 0.6.
  assert.deepEqual(L.chromeFrames("left"), L.chromeFrames("left", 0.6));
  // From a drag: the same parallax, starting where the drag left the page.
  for (const dir of ["right", "left"]) {
    const page = L.slideFrames(dir, 0.3), chrome = L.chromeFrames(dir, 0.6, 0.3);
    for (const k of ["out", "in"]) {
      for (let i = 0; i < 2; i++) near(page[k][i] + chrome[k][i], 0.6 * page[k][i], 1e-9);
    }
  }
});

test("wipeFrames: the coloured line rides the seam between the two pages", () => {
  // Swipe right: the leaving page moves right, so the seam (its left edge) runs 0 -> 100 %.
  assert.deepEqual(L.wipeFrames("right"), [0, 100]);
  // Swipe left: the leaving page moves left, so the seam (its right edge) runs 100 -> 0 %.
  assert.deepEqual(L.wipeFrames("left"), [100, 0]);
  assert.equal(L.wipeFrames(null), null);
  const s = L.slideFrames("right");
  assert.equal(L.wipeFrames("right")[1], s.out[1]); // ends where the leaving page's left edge ends
  // From a drag: the seam starts where the finger left it.
  assert.deepEqual(L.wipeFrames("left", 0.25), [75, 0]);
  assert.deepEqual(L.wipeFrames("right", 0.25), [25, 100]);
  assert.deepEqual(L.wipeFrames("left", 0.25)[0], 100 + L.slideFrames("left", 0.25).out[0]);
});

// --- a reading changes ---------------------------------------------------------------------------
test("valueChange: a new reading rolls in; a number of the same shape also counts", () => {
  const a = L.valueChange("71°F", "73°F");
  assert.equal(a.roll, true);
  assert.equal(a.flash, true);
  assert.deepEqual([a.count.from, a.count.to, a.count.suffix], [71, 73, "°F"]);
  const b = L.valueChange("Closed", "Open");
  assert.equal(b.roll, true);
  assert.equal(b.count, null);
  assert.equal(b.flash, true);
  // Direction: up rolls from below, down from above.
  assert.equal(L.valueChange("40%", "45%").dir, 1);
  assert.equal(L.valueChange("45%", "40%").dir, -1);
  assert.equal(L.valueChange("Closed", "Open").dir, 1);
});

test("valueChange: nothing on first paint or when nothing changed", () => {
  assert.equal(L.valueChange(undefined, "71°F"), null);
  assert.equal(L.valueChange("", "71°F"), null);
  assert.equal(L.valueChange("71°F", "71°F"), null);
  assert.equal(L.valueChange(null, null), null);
});

test("fractionMoved: a gauge marker pulses only when its value really moved", () => {
  assert.equal(L.fractionMoved(0.4, 0.5), true);
  assert.equal(L.fractionMoved(0.4, 0.402), false);
  assert.equal(L.fractionMoved(null, 0.5), false);
  assert.equal(L.fractionMoved(undefined, 0.5), false);
  assert.equal(L.fractionMoved(0.5, null), false);
});

// --- radar ---------------------------------------------------------------------------------------
test("ringMix: range rings shade from the second hue (near) to the third (far)", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => L.ringMix(i, 5)), [0, 25, 50, 75, 100]);
  assert.equal(L.ringMix(0, 1), 0);
  assert.equal(L.ringMix(3, 0), 0);
  assert.equal(L.ringMix(9, 5), 100);
});

test("radarVector: direction from the last two trail points, length from the speed", () => {
  // Moving straight away from the sensor (y grows) is straight UP the screen: -90 degrees.
  const up = L.radarVector([{ x: 0, y: 1000 }, { x: 0, y: 1200 }], 0.5, "m/s");
  near(up.deg, -90, 1e-9);
  // Moving toward +x is to the right: 0 degrees.
  near(L.radarVector([{ x: 0, y: 1000 }, { x: 300, y: 1000 }], 0.5, "m/s").deg, 0, 1e-9);
  // Toward the sensor is down the screen: +90.
  near(L.radarVector([{ x: 0, y: 1000 }, { x: 0, y: 600 }], 0.5, "m/s").deg, 90, 1e-9);
  // Faster is longer, clamped to 0.3-1.
  const slow = L.radarVector([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0.1, "m/s").len;
  const fast = L.radarVector([{ x: 0, y: 0 }, { x: 100, y: 0 }], 1.0, "m/s").len;
  assert.ok(fast > slow, `${fast} > ${slow}`);
  assert.equal(L.radarVector([{ x: 0, y: 0 }, { x: 100, y: 0 }], 9, "m/s").len, 1);
  assert.ok(slow >= 0.3, slow);
  // Units: 100 cm/s is 1 m/s.
  near(L.radarVector([{ x: 0, y: 0 }, { x: 1, y: 0 }], 100, "cm/s").len, fast, 1e-9);
});

test("radarVector: nothing when standing still or without a direction", () => {
  assert.equal(L.radarVector([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0, "m/s"), null);
  assert.equal(L.radarVector([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0.01, "m/s"), null);
  assert.equal(L.radarVector([{ x: 0, y: 0 }], 0.5, "m/s"), null);
  assert.equal(L.radarVector([], 0.5, "m/s"), null);
  assert.equal(L.radarVector(undefined, 0.5, "m/s"), null);
  assert.equal(L.radarVector([{ x: 0, y: 0 }, { x: 100, y: 0 }], null, "m/s"), null);
});
