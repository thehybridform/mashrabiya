// Run: npm test
// The open-door alert (the whole glass breathes red) and the padlock visualisation of each lock
// (dist/mashrabiya-logic.js). Visual only: the card stays lock-only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const st = (state, attributes) => ({ state, attributes: attributes || {} });
const CFG = { locks: ["lock.a", "lock.b"], doors: ["binary_sensor.a", "binary_sensor.b"] };
const calm = () => ({
  "lock.a": st("locked"), "lock.b": st("locked"),
  "binary_sensor.a": st("off", { friendly_name: "Front" }), "binary_sensor.b": st("off", { friendly_name: "Back" }),
});

// --- open-door alert ---------------------------------------------------------------------------
test("openDoors: configured doors that are on; unavailable and unknown never count", () => {
  const s = calm();
  assert.deepEqual(L.openDoors(s, CFG), []);
  s["binary_sensor.b"].state = "on";
  assert.deepEqual(L.openDoors(s, CFG), ["binary_sensor.b"]);
  s["binary_sensor.a"].state = "unavailable";
  assert.deepEqual(L.openDoors(s, CFG), ["binary_sensor.b"]);
  s["binary_sensor.a"].state = "unknown";
  assert.deepEqual(L.openDoors(s, CFG), ["binary_sensor.b"]);
  // Only the configured list: another open door elsewhere does not raise the alert.
  s["binary_sensor.garden_gate"] = st("on");
  assert.deepEqual(L.openDoors(s, CFG), ["binary_sensor.b"]);
  assert.deepEqual(L.openDoors(s, {}), []);
  assert.deepEqual(L.openDoors(undefined, undefined), []);
});

// HIG: the night dimming moved into the night colour tokens (hig.test.js), so the breath no longer
// changes at night, and the alert TEXT is steady (only its marks breathe).
test("doorAlertMode: the marks breathe by day and at night, steady under reduced motion, off when shut", () => {
  const day = L.doorAlertMode(1, false, false);
  assert.equal(day.mode, "breathe");
  assert.equal(day.peak, 1);
  assert.equal(day.min, 0.35);
  assert.ok(day.periodMs >= 2000 && day.periodMs <= 3000, day.periodMs);
  const night = L.doorAlertMode(2, true, false);
  assert.equal(night.mode, "breathe"); // a safety alert, not ambient: it runs at night too
  assert.ok(night.min < night.peak);
  const still = L.doorAlertMode(1, false, true);
  assert.equal(still.mode, "steady");
  assert.equal(still.peak, 1);
  assert.equal(L.doorAlertMode(1, true, true).mode, "steady");
  assert.equal(L.doorAlertMode(0, false, false).mode, "off");
  assert.equal(L.doorAlertMode(undefined, false, false).mode, "off");
  assert.ok(L.ALERT.fadeOutMs <= 400 && L.ALERT.fadeOutMs >= 200, L.ALERT.fadeOutMs);
});

test("exceptions: an open configured door is a red 'alert' line; door_alert: false keeps it orange", () => {
  const s = calm();
  s["binary_sensor.a"].state = "on";
  assert.deepEqual(L.exceptions(s, CFG), [{ level: "alert", text: "Front open" }]);
  assert.deepEqual(L.exceptions(s, Object.assign({ door_alert: false }, CFG)), [{ level: "attention", text: "Front open" }]);
  assert.equal(L.statusTone("alert"), "alert");
});

test("exceptions: the overflow line keeps the most severe level it folds", () => {
  const s = calm();
  s["binary_sensor.a"].state = "on";
  s["binary_sensor.b"].state = "on";
  const cfg = Object.assign({}, CFG, { internet: "binary_sensor.net", air: "sensor.air", locks: ["lock.a", "lock.b", "lock.c"] });
  s["lock.a"].state = "unlocked";
  s["lock.c"] = st("unavailable");
  s["binary_sensor.net"] = st("off");
  s["sensor.air"] = st("low");
  const ex = L.exceptions(s, cfg);
  assert.equal(ex.length, 3);
  assert.deepEqual(ex.map((e) => e.level), ["security", "alert", "attention"]);
});

test("resolveConfig: door_alert is on unless set to false", () => {
  assert.equal(L.resolveConfig({}, null).door_alert, true);
  assert.equal(L.resolveConfig({ door_alert: false }, null).door_alert, false);
});

// --- padlocks ----------------------------------------------------------------------------------
test("lockVisual: HA lock state (and its door) -> glyph kind, tone and word", () => {
  assert.deepEqual(L.lockVisual("locked", "off"), { kind: "locked", tone: "ok", word: "Locked", doorOpen: false });
  assert.deepEqual(L.lockVisual("unlocked", "off"), { kind: "unlocked", tone: "alert", word: "Unlocked", doorOpen: false });
  assert.deepEqual(L.lockVisual("jammed"), { kind: "jammed", tone: "alert", word: "Jammed", doorOpen: false });
  const locking = L.lockVisual("locking");
  assert.equal(locking.kind, "moving");
  assert.equal(locking.word, "Locking");
  assert.equal(L.lockVisual("unlocking").word, "Unlocking");
  assert.equal(L.lockVisual("unavailable").kind, "offline");
  assert.equal(L.lockVisual("unknown").kind, "offline");
  assert.equal(L.lockVisual("unknown").tone, "attention"); // offline is attention, as on the status line
  assert.equal(L.lockVisual(undefined).kind, "offline");
  // A door open beside its lock: the glyph gains an open door, the word says Open.
  const open = L.lockVisual("locked", "on");
  assert.equal(open.doorOpen, true);
  assert.equal(open.kind, "locked");
  assert.equal(open.word, "Open");
  assert.equal(L.lockVisual("locked", "unavailable").doorOpen, false);
});

test("lockTransition: which animation a real state change plays", () => {
  assert.equal(L.lockTransition("locked", "unlocked"), "lift");
  assert.equal(L.lockTransition("unlocking", "unlocked"), "lift");
  assert.equal(L.lockTransition("unlocked", "locked"), "snap");
  assert.equal(L.lockTransition("locking", "locked"), "snap");
  assert.equal(L.lockTransition("jammed", "locked"), "snap");
  assert.equal(L.lockTransition("locked", "jammed"), "jam");
  assert.equal(L.lockTransition("unlocked", "jammed"), "jam");
  assert.equal(L.lockTransition("locked", "locking"), null); // the moving glyph shows that itself
  assert.equal(L.lockTransition("locked", "locked"), null);
  assert.equal(L.lockTransition(undefined, "locked"), null); // first paint: no animation
  assert.equal(L.lockTransition("unavailable", "locked"), null); // coming back online is not a lock
  assert.equal(L.lockTransition("locked", "unavailable"), null);
});

test("lockAggregate: Lock all's glyph sums up every lock", () => {
  const s = calm();
  assert.deepEqual(L.lockAggregate(s, CFG.locks), { kind: "locked", tone: "ok", unlocked: 0 });
  s["lock.a"].state = "unlocked";
  assert.deepEqual(L.lockAggregate(s, CFG.locks), { kind: "unlocked", tone: "alert", unlocked: 1 });
  s["lock.b"].state = "jammed";
  assert.equal(L.lockAggregate(s, CFG.locks).kind, "jammed");
  const moving = calm();
  moving["lock.a"].state = "locking";
  assert.equal(L.lockAggregate(moving, CFG.locks).kind, "moving");
  const off = { "lock.a": st("unavailable") };
  assert.equal(L.lockAggregate(off, ["lock.a"]).kind, "offline");
  assert.equal(L.lockAggregate({}, []).kind, "offline");
});

test("roomItems: a lock in the room is a read-only padlock item paired with its door", () => {
  const areas = { hall: { area_id: "hall", name: "Hall" } };
  const entities = {
    "lock.a": { entity_id: "lock.a", area_id: "hall" },
    "binary_sensor.a": { entity_id: "binary_sensor.a", area_id: "hall" },
  };
  const states = {
    "lock.a": st("unlocked", { friendly_name: "Hall Front Lock" }),
    "binary_sensor.a": st("on", { device_class: "door", friendly_name: "Hall Front" }),
  };
  const rooms = L.roomsFromRegistries(areas, {}, entities, states, { doorFor: { "lock.a": "binary_sensor.a" } });
  const lock = rooms[0].items.find((i) => i.kind === "lock");
  assert.equal(lock.key, "lock:lock.a");
  assert.equal(lock.lock.kind, "unlocked");
  assert.equal(lock.lock.doorOpen, true);
  assert.equal(lock.value, "Open");
  assert.equal(lock.label, "Front");
  // Without a pairing the door is unknown, so nothing is drawn open.
  const bare = L.roomsFromRegistries(areas, {}, entities, states, {});
  assert.equal(bare[0].items.find((i) => i.kind === "lock").lock.doorOpen, false);
});

test("doorPairs: config doors pair with locks by position", () => {
  assert.deepEqual(L.doorPairs({ locks: ["lock.a", "lock.b"], doors: ["binary_sensor.a"] }), { "lock.a": "binary_sensor.a" });
  assert.deepEqual(L.doorPairs({}), {});
});
