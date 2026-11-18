// Run: npm test
// The mirror's Radar page (dist/mashrabiya-logic.js): every mmWave presence radar found in states
// (LD2450-style: up to three targets with x / y, an active flag, a zone and a max distance), unit
// conversion, and the pure geometry of each scope. READ-ONLY: nothing here acts on the house.
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
const SIN60 = Math.sin(Math.PI / 3);

// The living room radar as it really reports (dump of 2026-11-15): inches, cm, mm.
function livingRoom(extra = {}) {
  const s = {
    "sensor.living_room_presence_target_1_x": st("-15.7", { unit_of_measurement: "in" }),
    "sensor.living_room_presence_target_1_y": st("57.1", { unit_of_measurement: "in" }),
    "sensor.living_room_presence_target_1_speed": st("0.0", { unit_of_measurement: "mph" }),
    "binary_sensor.living_room_presence_target_1_active": st("on"),
    "sensor.living_room_presence_target_2_x": st("0.0", { unit_of_measurement: "in" }),
    "sensor.living_room_presence_target_2_y": st("0.0", { unit_of_measurement: "in" }),
    "binary_sensor.living_room_presence_target_2_active": st("off"),
    "sensor.living_room_presence_target_3_x": st("0.0", { unit_of_measurement: "in" }),
    "sensor.living_room_presence_target_3_y": st("0.0", { unit_of_measurement: "in" }),
    "binary_sensor.living_room_presence_target_3_active": st("off"),
    "number.living_room_presence_max_distance": st("500.0", { unit_of_measurement: "cm" }),
    "number.living_room_presence_zone_1_begin_x": st("-1700.0", { unit_of_measurement: "mm" }),
    "number.living_room_presence_zone_1_end_x": st("1300.0", { unit_of_measurement: "mm" }),
    "number.living_room_presence_zone_1_begin_y": st("0.0", { unit_of_measurement: "mm" }),
    "number.living_room_presence_zone_1_end_y": st("3900.0", { unit_of_measurement: "mm" }),
  };
  return Object.assign(s, extra);
}

// --- units -------------------------------------------------------------------------------------
test("toMm: mm, cm, m, in and ft to millimetres; no unit means mm; unknown units and junk are null", () => {
  assert.equal(L.toMm(12, "mm"), 12);
  assert.equal(L.toMm("500", "cm"), 5000);
  assert.equal(L.toMm(1.5, "m"), 1500);
  near(L.toMm(10, "in"), 254);
  near(L.toMm(1, "ft"), 304.8);
  assert.equal(L.toMm(7, undefined), 7);
  assert.equal(L.toMm(7, ""), 7);
  assert.equal(L.toMm(7, "furlong"), null);
  assert.equal(L.toMm("unknown", "mm"), null);
  assert.equal(L.toMm(null, "mm"), null);
});

// --- discovery ---------------------------------------------------------------------------------
test("radarPrefixes: every prefix with a target x sensor, once, sorted", () => {
  const s = Object.assign(livingRoom(), {
    "sensor.bathroom_presence_target_1_x": st("0"),
    "sensor.bathroom_presence_target_2_x": st("0"),
    "sensor.kitchen_presence_target_3_x": st("0"),
    "sensor.kitchen_presence_target_4_x": st("0"), // LD2450 has three targets
    "sensor.office_presence_zone_1_target_count": st("0"), // no target sensors: not a radar
    "sensor.unrelated_x": st("1"),
  });
  assert.deepEqual(L.radarPrefixes(s), ["bathroom", "kitchen", "living_room"]);
  assert.deepEqual(L.radarPrefixes({}), []);
  assert.deepEqual(L.radarPrefixes(undefined), []);
});

test("radarList: named by area (entity area, else device area), else the prettified prefix", () => {
  const s = Object.assign(livingRoom(), {
    "sensor.bathroom_presence_target_1_x": st("0"),
    "sensor.garage_bay_presence_target_1_x": st("0"),
  });
  const areas = { living_room: { area_id: "living_room", name: "Living Room" }, bath: { area_id: "bath", name: "Main Bath" } };
  const devices = { d1: { id: "d1", area_id: "bath" } };
  const entities = {
    "sensor.living_room_presence_target_1_x": { entity_id: "sensor.living_room_presence_target_1_x", area_id: "living_room" },
    "sensor.bathroom_presence_target_1_x": { entity_id: "sensor.bathroom_presence_target_1_x", device_id: "d1" },
  };
  const list = L.radarList(s, entities, devices, areas);
  assert.deepEqual(list.map((r) => [r.prefix, r.name, r.areaId]), [
    ["garage_bay", "Garage Bay", null],
    ["living_room", "Living Room", "living_room"],
    ["bathroom", "Main Bath", "bath"],
  ]);
  // Sorted by the shown name.
  assert.deepEqual(L.radarList(s, undefined, undefined, undefined).map((r) => r.name), ["Bathroom", "Garage Bay", "Living Room"]);
});

// --- the model of one radar --------------------------------------------------------------------
test("radarModel: targets in mm, range from max distance, zone from the zone numbers", () => {
  const m = L.radarModel("living_room", livingRoom());
  assert.equal(m.prefix, "living_room");
  assert.equal(m.rangeMm, 5000);
  assert.deepEqual(m.zone, { x0: -1700, x1: 1300, y0: 0, y1: 3900 });
  assert.equal(m.targets.length, 3);
  const t = m.targets[0];
  assert.equal(t.n, 1);
  assert.equal(t.active, true);
  near(t.x, -15.7 * 25.4, 1e-9);
  near(t.y, 57.1 * 25.4, 1e-9);
  assert.equal(m.targets[1].active, false);
  assert.equal(m.count, 1);
  assert.equal(m.active, true);
});

test("radarModel: no max distance means the LD2450's 6 m; a missing or empty zone is null", () => {
  const s = livingRoom();
  delete s["number.living_room_presence_max_distance"];
  delete s["number.living_room_presence_zone_1_end_y"];
  const m = L.radarModel("living_room", s);
  assert.equal(m.rangeMm, 6000);
  assert.equal(m.zone, null);
  const z = livingRoom({
    "number.living_room_presence_zone_1_begin_x": st("0", { unit_of_measurement: "mm" }),
    "number.living_room_presence_zone_1_end_x": st("0", { unit_of_measurement: "mm" }),
  });
  assert.equal(L.radarModel("living_room", z).zone, null);
});

test("radarModel: begin/end in either order; zone in cm converts", () => {
  const s = livingRoom({
    "number.living_room_presence_zone_1_begin_x": st("130", { unit_of_measurement: "cm" }),
    "number.living_room_presence_zone_1_end_x": st("-170", { unit_of_measurement: "cm" }),
  });
  const z = L.radarModel("living_room", s).zone;
  assert.equal(z.x0, -1700);
  assert.equal(z.x1, 1300);
});

test("radarModel: active comes from the active sensor; without one, a non-zero position counts", () => {
  const s = livingRoom();
  s["binary_sensor.living_room_presence_target_1_active"] = st("off");
  assert.equal(L.radarModel("living_room", s).targets[0].active, false);
  delete s["binary_sensor.living_room_presence_target_1_active"];
  delete s["binary_sensor.living_room_presence_target_2_active"];
  const m = L.radarModel("living_room", s);
  assert.equal(m.targets[0].active, true); // (-15.7, 57.1)
  assert.equal(m.targets[1].active, false); // (0, 0)
});

test("radarModel: an unavailable position is never an active target; nothing active dims the scope", () => {
  const s = livingRoom({ "sensor.living_room_presence_target_1_x": st("unavailable") });
  const m = L.radarModel("living_room", s);
  assert.equal(m.targets[0].active, false);
  assert.equal(m.count, 0);
  assert.equal(m.active, false);
});

test("radarModel: speed and its unit ride along", () => {
  const s = livingRoom({ "sensor.living_room_presence_target_1_speed": st("-1.25", { unit_of_measurement: "mph" }) });
  const t = L.radarModel("living_room", s).targets[0];
  assert.equal(t.speed, -1.25);
  assert.equal(t.speedUnit, "mph");
});

test("radarSpeedText: shown only when moving, unsigned, one decimal, in the sensor's unit", () => {
  assert.equal(L.radarSpeedText(0, "mph"), null);
  assert.equal(L.radarSpeedText(0.04, "mph"), null);
  assert.equal(L.radarSpeedText(-1.26, "mph"), "1.3 mph");
  assert.equal(L.radarSpeedText(0.5, "m/s"), "0.5 m/s");
  assert.equal(L.radarSpeedText(3, "cm/s"), null); // 0.03 m/s: standing still
  assert.equal(L.radarSpeedText(30, "cm/s"), "30.0 cm/s");
  assert.equal(L.radarSpeedText(null, "mph"), null);
});

// --- geometry ----------------------------------------------------------------------------------
test("radarBox: the field's bounding box, +/-60 degrees wide and one range tall", () => {
  const b = L.radarBox(100);
  near(b.w, 200 * SIN60);
  assert.equal(b.h, 100);
});

test("radarProject: origin at the sensor, y up the page (negative SVG y), scaled to size", () => {
  const p = L.radarProject(0, 2500, 5000, 100);
  near(p.x, 0); near(p.y, -50);
  assert.equal(p.clamped, false);
  const q = L.radarProject(-1000, 1000, 5000, 100);
  near(q.x, -20); near(q.y, -20);
  // Beyond the range: pulled back onto the rim along the same bearing.
  const r = L.radarProject(0, 10000, 5000, 100);
  near(r.x, 0); near(r.y, -100);
  assert.equal(r.clamped, true);
  // Behind the sensor never draws below it.
  assert.ok(L.radarProject(100, -500, 5000, 100).y <= 0);
  assert.equal(L.radarProject(NaN, 1, 5000, 100), null);
  assert.equal(L.radarProject(0, 1, 0, 100), null);
});

test("radarWedgePath: from the sensor out to the +/-60 degree rim and back", () => {
  const d = L.radarWedgePath(100);
  const m = /^M 0 0 L ([\d.-]+) ([\d.-]+) A 100 100 0 0 1 ([\d.-]+) ([\d.-]+) Z$/.exec(d);
  assert.ok(m, d);
  near(Number(m[1]), -100 * SIN60, 0.01); near(Number(m[2]), -50, 0.01);
  near(Number(m[3]), 100 * SIN60, 0.01); near(Number(m[4]), -50, 0.01);
});

test("radarRingArc: one arc across the field at radius r", () => {
  const d = L.radarRingArc(40);
  const m = /^M ([\d.-]+) ([\d.-]+) A 40 40 0 0 1 ([\d.-]+) ([\d.-]+)$/.exec(d);
  assert.ok(m, d);
  near(Number(m[1]), -40 * SIN60, 0.01); near(Number(m[4]), -20, 0.01);
});

test("radarRings: a ring every whole metre inside the range, labelled in metres", () => {
  const r = L.radarRings(5000, 100);
  assert.deepEqual(r.map((x) => x.label), ["1 m", "2 m", "3 m", "4 m"]);
  near(r[0].r, 20); near(r[3].r, 80);
  assert.deepEqual(L.radarRings(4500, 90).map((x) => x.label), ["1 m", "2 m", "3 m", "4 m"]);
  near(L.radarRings(4500, 90)[3].r, 80);
  assert.deepEqual(L.radarRings(800, 100), []);
  assert.deepEqual(L.radarRings(0, 100), []);
});

test("radarZoneRect: the configured zone in scope pixels, clipped to the field box", () => {
  const z = L.radarZoneRect({ x0: -1700, x1: 1300, y0: 0, y1: 3900 }, 5000, 100);
  near(z.x, -34); near(z.y, -78); near(z.w, 60); near(z.h, 78);
  const wide = L.radarZoneRect({ x0: -9000, x1: 9000, y0: -500, y1: 9000 }, 5000, 100);
  near(wide.x, -100 * SIN60); near(wide.w, 200 * SIN60);
  near(wide.y, -100); near(wide.h, 100);
  assert.equal(L.radarZoneRect(null, 5000, 100), null);
});

test("radarTrailPush: last few distinct positions, newest last, never mutating", () => {
  const a = [];
  const b = L.radarTrailPush(a, { x: 0, y: 1000 });
  assert.equal(a.length, 0);
  assert.deepEqual(b, [{ x: 0, y: 1000 }]);
  // Jitter below trailMinMm is not a move.
  assert.equal(L.radarTrailPush(b, { x: 10, y: 1010 }), b);
  let t = b;
  for (let i = 1; i <= 20; i++) t = L.radarTrailPush(t, { x: i * 200, y: 1000 });
  assert.equal(t.length, L.RADAR.trailMax);
  assert.equal(t[t.length - 1].x, 4000);
  assert.deepEqual(L.radarTrailPush(b, { x: NaN, y: 0 }), b);
});

test("RADAR: +/-60 degree field, three targets, a short trail", () => {
  assert.equal(L.RADAR.halfDeg, 60);
  assert.equal(L.RADAR.targets, 3);
  assert.ok(L.RADAR.trailMax >= 3 && L.RADAR.trailMax <= 8, L.RADAR.trailMax);
});

test("radar models never carry an action: the page is read-only", () => {
  const m = L.radarModel("living_room", livingRoom());
  const keys = (o) => Object.keys(o).filter((k) => /action|service|call/i.test(k));
  assert.deepEqual(keys(m), []);
  for (const t of m.targets) assert.deepEqual(keys(t), []);
});

// --- the page in the loop ----------------------------------------------------------------------
test("pageKeys: Radar sits right after More when any radar exists", () => {
  const rooms = [{ id: "a" }];
  assert.deepEqual(L.pageKeys(rooms, [{ prefix: "living_room" }]), ["main", "more", "radar", "room:a"]);
  assert.deepEqual(L.pageKeys(rooms, []), ["main", "more", "room:a"]);
  assert.deepEqual(L.pageKeys(rooms), ["main", "more", "room:a"]);
  assert.equal(L.firstRoomIndex(L.pageKeys(rooms, [{ prefix: "x" }])), 3);
  assert.equal(L.RADAR_KEY, "radar");
});
