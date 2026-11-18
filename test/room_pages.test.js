// Run: npm test
// One page per room (dist/mashrabiya-logic.js): the dynamic page list, tracking the current page by
// key when rooms come and go, and the pure maths behind each room's visual indicators (arc gauges,
// comfort bands, the air meter, fan spin speed). Read-only: nothing here acts on the house.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const st = (state, attrs = {}) => ({ state, attributes: attrs });

// --- pages -------------------------------------------------------------------------------------
test("pageKeys: Main, More, then one key per room in room order", () => {
  const rooms = [{ id: "basement" }, { id: "living_room" }];
  assert.deepEqual(L.pageKeys(rooms), ["main", "more", "room:basement", "room:living_room"]);
  assert.deepEqual(L.pageKeys([]), ["main", "more"]);
  assert.deepEqual(L.pageKeys(undefined), ["main", "more"]);
  assert.equal(L.roomKey("bedroom"), "room:bedroom");
});

test("pageIndexFor: the current page is tracked by key, not by index", () => {
  const before = ["main", "more", "room:a", "room:b", "room:c"];
  // A room is added in front of the one being viewed: the same room stays current.
  const grown = ["main", "more", "room:0", "room:a", "room:b", "room:c"];
  assert.equal(L.pageIndexFor(grown, before[3]), 4);
  // Reordered.
  assert.equal(L.pageIndexFor(["main", "more", "room:c", "room:b", "room:a"], "room:b"), 3);
  // The viewed room disappears: Main.
  assert.equal(L.pageIndexFor(["main", "more", "room:a", "room:c"], "room:b"), 0);
  assert.equal(L.pageIndexFor(["main", "more"], undefined), 0);
  assert.equal(L.pageIndexFor(undefined, "more"), 0);
});

test("firstRoomIndex: where More's Rooms button goes; -1 when there are no rooms", () => {
  assert.equal(L.firstRoomIndex(["main", "more", "room:a", "room:b"]), 2);
  assert.equal(L.firstRoomIndex(["main", "more"]), -1);
});

test("nextPage on the dynamic list: the loop wraps across every room", () => {
  const keys = L.pageKeys([{ id: "a" }, { id: "b" }, { id: "c" }]);
  assert.equal(L.nextPage(keys.length - 1, "left", keys.length), 0); // last room, swipe left -> Main
  assert.equal(L.nextPage(0, "right", keys.length), keys.length - 1); // Main, swipe right -> last room
  assert.equal(L.nextPage(1, "left", keys.length), 2); // More, swipe left -> first room
});

// HIG: the pager's edge names (neighbours, pagerLabels) gave way to Previous / Next buttons (navTargets).
test("navTargets: Next is the page a swipe left brings in from the right, Previous the one from the left", () => {
  const keys = ["main", "more", "room:basement", "room:bedroom"];
  const n = keys.length;
  for (const i of [1, 2]) {
    const t = L.navTargets(keys, i);
    assert.equal(t.next, L.nextPage(i, "left", n));
    if (t.prev !== null) assert.equal(t.prev, L.nextPage(i, "right", n));
  }
});

// --- gauge geometry ----------------------------------------------------------------------------
test("gaugeFraction: position on a scale, clamped; null without a number", () => {
  assert.equal(L.gaugeFraction(70, 50, 90), 0.5);
  assert.equal(L.gaugeFraction(40, 50, 90), 0);
  assert.equal(L.gaugeFraction(95, 50, 90), 1);
  assert.equal(L.gaugeFraction("60", 50, 90), 0.25);
  assert.equal(L.gaugeFraction(null, 0, 100), null);
  assert.equal(L.gaugeFraction("unknown", 0, 100), null);
  assert.equal(L.gaugeFraction(5, 10, 10), null); // empty scale
});

test("GAUGE: a 240 degree arc with the gap at the bottom", () => {
  assert.equal(L.GAUGE.sweepDeg, 240);
  // Start and end mirror each other about the vertical: the gap is centred on 90 deg (down).
  near((L.GAUGE.startDeg + L.GAUGE.sweepDeg / 2) % 360, 270);
});

test("arcPoint: SVG angles (0 = right, 90 = down)", () => {
  const p = L.arcPoint(50, 50, 10, 0);
  near(p.x, 60); near(p.y, 50);
  const q = L.arcPoint(50, 50, 10, 90);
  near(q.x, 50); near(q.y, 60);
});

test("arcPath: one SVG arc command, large-arc flag set past 180 degrees", () => {
  const d = L.arcPath(60, 60, 50, 150, 240);
  const m = /^M ([\d.-]+) ([\d.-]+) A 50 50 0 1 1 ([\d.-]+) ([\d.-]+)$/.exec(d);
  assert.ok(m, d);
  const s = L.arcPoint(60, 60, 50, 150), e = L.arcPoint(60, 60, 50, 390);
  near(Number(m[1]), s.x, 0.01); near(Number(m[2]), s.y, 0.01);
  near(Number(m[3]), e.x, 0.01); near(Number(m[4]), e.y, 0.01);
  assert.match(L.arcPath(0, 0, 10, 0, 90), / A 10 10 0 0 1 /);
});

test("arcDash: dash length is the arc length; the offset hides the unfilled part", () => {
  const full = 2 * Math.PI * 10 * (240 / 360);
  const a = L.arcDash(0.25, 10, 240);
  near(a.length, full);
  near(a.offset, full * 0.75);
  near(L.arcDash(1, 10, 240).offset, 0);
  near(L.arcDash(0, 10, 240).offset, full);
  near(L.arcDash(2, 10, 240).offset, 0); // clamped
  near(L.arcDash(null, 10, 240).offset, full); // nothing to show
});

// --- tones and scales --------------------------------------------------------------------------
test("tempScale: 50-90 °F, or the same span in °C; comfort band inside it", () => {
  assert.deepEqual(L.tempScale("°F"), { min: 50, max: 90, band: [64, 76] });
  assert.deepEqual(L.tempScale("°C"), { min: 10, max: 32, band: [18, 24] });
  assert.deepEqual(L.tempScale(undefined), L.tempScale("°F"));
});

test("tempTone: cool blue, comfortable green, warm orange; works in °C", () => {
  assert.equal(L.tempTone(60, "°F"), "blue");
  assert.equal(L.tempTone(64, "°F"), "green");
  assert.equal(L.tempTone(70, "°F"), "green");
  assert.equal(L.tempTone(76, "°F"), "green");
  assert.equal(L.tempTone(80, "°F"), "orange");
  assert.equal(L.tempTone(15, "°C"), "blue");
  assert.equal(L.tempTone(21, "°C"), "green");
  assert.equal(L.tempTone(27, "°C"), "orange");
  assert.equal(L.tempTone("x", "°F"), null);
});

test("humidityTone: green inside the 30-60 % comfort band, orange outside", () => {
  assert.equal(L.humidityTone(45), "green");
  assert.equal(L.humidityTone(30), "green");
  assert.equal(L.humidityTone(60), "green");
  assert.equal(L.humidityTone(25), "orange");
  assert.equal(L.humidityTone(72), "orange");
  assert.equal(L.humidityTone(undefined), null);
});

test("airSegment: five segments for the enum, threshold segments for numbers", () => {
  assert.deepEqual(L.airSegment("enum", "highest"), { index: 0, count: 5, tones: ["green", "green", "yellow", "orange", "red"] });
  assert.equal(L.airSegment("enum", "medium").index, 2);
  assert.equal(L.airSegment("enum", "lowest").index, 4);
  assert.equal(L.airSegment("enum", "bogus"), null);
  assert.deepEqual(L.airSegment("carbon_dioxide", 950), { index: 1, count: 4, tones: ["green", "yellow", "orange", "red"] });
  assert.equal(L.airSegment("pm25", 8).index, 0);
  assert.equal(L.airSegment("aqi", 400).index, 3);
  assert.equal(L.airSegment("volatile_organic_compounds", 300), null); // no agreed thresholds
  assert.equal(L.airSegment("pm25", "n/a"), null);
});

test("fanSpinSeconds: faster with speed, bounded; null when off", () => {
  assert.equal(L.fanSpinSeconds(null, false), null);
  const slow = L.fanSpinSeconds(10, true), fast = L.fanSpinSeconds(100, true);
  assert.ok(fast < slow, `${fast} !< ${slow}`);
  assert.ok(fast >= 0.6 && slow <= 4.5, `${fast} ${slow}`);
  assert.ok(L.fanSpinSeconds(null, true) > 0); // on, speed unknown: still turns
  assert.equal(L.fanSpinSeconds(0, true), L.fanSpinSeconds(1, true)); // clamped low end
});

// --- what each item carries for its indicator --------------------------------------------------
const one = (ids, states, opts) => L.roomDetails([{ id: "r", name: "Room", area: {}, entityIds: ids }], states, opts)[0];

test("climate item: gauge with current, target and band; arc tone from temperature, word tone from mode", () => {
  const r = one(["climate.t"], { "climate.t": st("heat", { current_temperature: 71, temperature: 68 }) }, { tempUnit: "°F" });
  const c = r.items[0];
  assert.deepEqual(c.gauge, { value: 71, unit: "°F", min: 50, max: 90, band: [64, 76], target: 68 });
  assert.equal(c.tone, "green");
  assert.equal(c.modeTone, "orange");
  assert.equal(c.label, "Heat");
});

test("climate item honours the configured unit system", () => {
  const r = one(["climate.t"], { "climate.t": st("off", { current_temperature: 21, temperature: 20 }) }, { tempUnit: "°C" });
  assert.equal(r.items[0].gauge.unit, "°C");
  assert.equal(r.items[0].gauge.min, 10);
  assert.equal(r.items[0].modeTone, "dim");
});

test("temperature and humidity items carry gauges", () => {
  const r = one(["sensor.t", "sensor.h"], {
    "sensor.t": st("60.9", { device_class: "temperature", unit_of_measurement: "°F" }),
    "sensor.h": st("72", { device_class: "humidity", unit_of_measurement: "%" }),
  });
  const t = r.items.find((i) => i.kind === "temperature");
  assert.deepEqual(t.gauge, { value: 60.9, unit: "°F", min: 50, max: 90, band: [64, 76], target: null });
  assert.equal(t.tone, "blue");
  const h = r.items.find((i) => i.kind === "humidity");
  assert.deepEqual(h.gauge, { value: 72, unit: "%", min: 0, max: 100, band: [30, 60], target: null });
  assert.equal(h.tone, "orange");
});

test("air item carries its meter", () => {
  const e = one(["sensor.x_air_quality"], { "sensor.x_air_quality": st("medium", { device_class: "enum" }) }).items[0];
  assert.equal(e.meter.index, 2);
  assert.equal(e.meter.count, 5);
  const c = one(["sensor.co2"], { "sensor.co2": st("1500", { device_class: "carbon_dioxide", unit_of_measurement: "ppm" }) }).items[0];
  assert.equal(c.meter.index, 2);
  const v = one(["sensor.voc"], { "sensor.voc": st("300", { device_class: "volatile_organic_compounds", unit_of_measurement: "µg/m³" }) }).items[0];
  assert.equal(v.meter, null); // text only
});

test("lights, fans and covers carry a 0-100 level and on/off", () => {
  const r = one(["light.a", "light.b", "light.c", "fan.f", "cover.c"], {
    "light.a": st("on", { friendly_name: "A", brightness: 128 }),
    "light.b": st("off", { friendly_name: "B", brightness: null }),
    "light.c": st("on", { friendly_name: "C" }),
    "fan.f": st("on", { friendly_name: "F", percentage: 40 }),
    "cover.c": st("open", { friendly_name: "C", current_position: 30 }),
  });
  const by = (k) => r.items.find((i) => i.key === k);
  assert.deepEqual([by("light:light.a").pct, by("light:light.a").on], [50, true]);
  assert.deepEqual([by("light:light.b").pct, by("light:light.b").on], [0, false]);
  assert.deepEqual([by("light:light.c").pct, by("light:light.c").on], [100, true]); // on, no dimmer
  const fan = by("fan:fan.f");
  assert.deepEqual([fan.pct, fan.on], [40, true]);
  assert.equal(fan.spin, L.fanSpinSeconds(40, true));
  assert.equal(by("cover:cover.c").pct, 30);
});

test("occupancy, doors and media carry their boolean state", () => {
  const r = one(["binary_sensor.m", "binary_sensor.d", "media_player.p"], {
    "binary_sensor.m": st("on", { device_class: "motion" }),
    "binary_sensor.d": st("on", { device_class: "door", friendly_name: "D" }),
    "media_player.p": st("playing", { friendly_name: "P", media_title: "Song" }),
  });
  assert.equal(r.items.find((i) => i.kind === "occupancy").on, true);
  assert.equal(r.items.find((i) => i.kind === "door").open, true);
  assert.equal(r.items.find((i) => i.kind === "media").playing, true);
});
