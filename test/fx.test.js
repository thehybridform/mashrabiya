// Run: npm test
// Choices behind the mirror card's motion (dist/mashrabiya-logic.js): which weather animation,
// which clock digits changed, when a sub-label counts instead of crossfading, light colours.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

test("weatherAnim: condition -> icon animation", () => {
  assert.equal(L.weatherAnim("sunny"), "sun");
  assert.equal(L.weatherAnim("clear-night"), "moon");
  assert.equal(L.weatherAnim("partlycloudy"), "partly");
  assert.equal(L.weatherAnim("cloudy"), "cloud");
  assert.equal(L.weatherAnim("fog"), "fog");
  assert.equal(L.weatherAnim("rainy"), "rain");
  assert.equal(L.weatherAnim("pouring"), "rain");
  assert.equal(L.weatherAnim("lightning"), "storm");
  assert.equal(L.weatherAnim("lightning-rainy"), "storm");
  assert.equal(L.weatherAnim("snowy"), "snow");
  assert.equal(L.weatherAnim("snowy-rainy"), "snow");
  assert.equal(L.weatherAnim("hail"), "snow");
  assert.equal(L.weatherAnim("windy"), "wind");
  assert.equal(L.weatherAnim("windy-variant"), "wind");
  assert.equal(L.weatherAnim("exceptional"), null);
  assert.equal(L.weatherAnim("unavailable"), null);
  assert.equal(L.weatherAnim(undefined), null);
});

test("digitChanges: only the characters that changed move", () => {
  assert.deepEqual(L.digitChanges("9:41", "9:42"), [false, false, false, true]);
  assert.deepEqual(L.digitChanges("9:59", "9:59"), [false, false, false, false]);
  assert.deepEqual(L.digitChanges("12:09", "12:10"), [false, false, false, true, true]);
});

test("digitChanges: a length change or no previous value moves everything", () => {
  assert.deepEqual(L.digitChanges("9:59", "10:00"), [true, true, true, true, true]);
  assert.deepEqual(L.digitChanges(undefined, "7:00"), [true, true, true, true]);
  assert.deepEqual(L.digitChanges("", ""), []);
});

test("numberTween: same words, different count -> count", () => {
  const t = L.numberTween("5 on", "7 on");
  assert.equal(t.from, 5);
  assert.equal(t.to, 7);
  assert.equal(t.prefix, "");
  assert.equal(t.suffix, " on");
  assert.ok(t.ms > 0 && t.ms <= 600, t.ms);
  assert.equal(L.numberTween("2 unlocked", "1 unlocked").to, 1);
});

test("numberTween: duration grows with the gap and is capped", () => {
  assert.ok(L.numberTween("1 on", "2 on").ms < L.numberTween("1 on", "4 on").ms);
  assert.equal(L.numberTween("1 on", "90 on").ms, 600);
});

test("numberTween: different words or no number -> null (crossfade instead)", () => {
  assert.equal(L.numberTween("All off", "1 on"), null);
  assert.equal(L.numberTween("1 unlocked", "All locked"), null);
  assert.equal(L.numberTween("3 on", "3 on"), null);
  assert.equal(L.numberTween("", "2 on"), null);
  assert.equal(L.numberTween(undefined, "2 on"), null);
  assert.equal(L.numberTween("2 doors", "3 locks"), null);
});

test("tweenAt: rounded value along the way", () => {
  const t = L.numberTween("0 on", "10 on");
  assert.equal(L.tweenAt(t, 0), "0 on");
  assert.equal(L.tweenAt(t, 1), "10 on");
  assert.equal(L.tweenAt(t, 0.5), "5 on");
  assert.equal(L.tweenAt(t, 2), "10 on");
});

test("kelvinRgb: warm is orange-ish, 6500 K is near white", () => {
  const warm = L.kelvinRgb(2700);
  assert.equal(warm[0], 255);
  assert.ok(warm[1] > 140 && warm[1] < 190, String(warm));
  assert.ok(warm[2] < 120, String(warm));
  const day = L.kelvinRgb(6500);
  assert.ok(day.every((c) => c >= 240), String(day));
  const cold = L.kelvinRgb(10000);
  assert.ok(cold[2] === 255 && cold[0] < 220, String(cold));
  assert.equal(L.kelvinRgb(NaN), null);
});

test("lightColor: rgb_color, then hs_color, then colour temperature", () => {
  assert.equal(L.lightColor({ rgb_color: [255, 0, 10], hs_color: [200, 50] }), "rgb(255, 0, 10)");
  assert.equal(L.lightColor({ hs_color: [0, 100] }), "rgb(255, 0, 0)");
  assert.equal(L.lightColor({ hs_color: [120, 100] }), "rgb(0, 255, 0)");
  assert.equal(L.lightColor({ hs_color: [240, 0] }), "rgb(255, 255, 255)");
  assert.match(L.lightColor({ color_temp_kelvin: 2700 }), /^rgb\(255, \d+, \d+\)$/);
  assert.equal(L.lightColor({ brightness: 200 }), null);
  assert.equal(L.lightColor({ rgb_color: [1, 2] }), null);
  assert.equal(L.lightColor(undefined), null);
});
