// Run: npm test
// Fragrance diffusers (Pura-style: two vials, an intensity select, a timer) on the room pages and the
// Main status line. READ-ONLY: discovered from the registries and states by entity pattern, never
// configured by id, and never controlled (dist/mashrabiya-logic.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

// --- fakes ---------------------------------------------------------------------------------------
const st = (state, attributes) => ({ state: String(state), attributes: attributes || {} });

// One diffuser's entities: object-id `prefix`, on device `dev`.
function diffuser(prefix, dev, o = {}) {
  const s = {
    [`sensor.${prefix}_slot_1_fragrance_remaining`]: st(o.r1 === undefined ? 92 : o.r1, { unit_of_measurement: "%" }),
    [`sensor.${prefix}_slot_2_fragrance_remaining`]: st(o.r2 === undefined ? 40 : o.r2, { unit_of_measurement: "%" }),
    [`sensor.${prefix}_slot_1_fragrance`]: st(o.n1 || "Volcano", o.c1 ? { color: o.c1 } : {}),
    [`sensor.${prefix}_slot_2_fragrance`]: st(o.n2 || "Fig", {}),
    [`sensor.${prefix}_active_fragrance`]: st(o.active || "Volcano"),
    [`select.${prefix}_intensity`]: st(o.intensity || "medium", { options: ["off", "gentle", "subtle", "medium", "strong", "intense"] }),
    [`select.${prefix}_fragrance`]: st(o.slot || "slot_1", { options: ["off", "slot_1", "slot_2"] }),
    [`binary_sensor.${prefix}_slot_1_low_fragrance`]: st(o.low1 || "off", { device_class: "problem" }),
    [`binary_sensor.${prefix}_slot_2_low_fragrance`]: st(o.low2 || "off", { device_class: "problem" }),
    [`sensor.${prefix}_timer`]: st(o.timer || "unknown", { device_class: "timestamp" }),
    [`switch.${prefix}_auto_alternate_fragrances`]: st(o.alt || "on"),
    [`binary_sensor.${prefix}_connected`]: st(o.connected || "on", { device_class: "connectivity" }),
  };
  const e = {};
  for (const id of Object.keys(s)) e[id] = { entity_id: id, device_id: dev, area_id: null, entity_category: /remaining|low_fragrance|connected/.test(id) ? "diagnostic" : null };
  return { states: s, entities: e };
}

function house() {
  const a = diffuser("lounge_pura", "dev1");
  const b = diffuser("lounge_tv_pura", "dev2", { slot: "slot_2", intensity: "intense", low2: "on", r2: 8 });
  const c = diffuser("bath_bath", "dev3", { slot: "off", intensity: "off", active: "none" }); // no "pura" in the name
  const states = { ...a.states, ...b.states, ...c.states, "light.lounge_lamp": st("on") };
  const entities = { ...a.entities, ...b.entities, ...c.entities, "light.lounge_lamp": { entity_id: "light.lounge_lamp", area_id: "lounge" } };
  const devices = {
    dev1: { id: "dev1", area_id: "lounge", name: "Lounge" },
    dev2: { id: "dev2", area_id: "lounge", name: "Lounge tv", name_by_user: "Lounge TV" },
    dev3: { id: "dev3", area_id: "bath", name: "Bath" },
  };
  const areas = { lounge: { area_id: "lounge", name: "Lounge" }, bath: { area_id: "bath", name: "Bath" } };
  return { states, entities, devices, areas };
}

const NOW = Date.parse("2026-11-16T05:00:00Z");

// --- discovery -----------------------------------------------------------------------------------
test("scentDevices: one per device with *_slot_<n>_fragrance_remaining sensors, whatever the name", () => {
  const h = house();
  const d = L.scentDevices(h.states, h.entities, h.devices, h.areas);
  assert.deepEqual(d.map((x) => x.prefix).sort(), ["bath_bath", "lounge_pura", "lounge_tv_pura"]);
  const tv = d.find((x) => x.prefix === "lounge_tv_pura");
  assert.equal(tv.deviceId, "dev2");
  assert.equal(tv.areaId, "lounge");
  assert.equal(tv.name, "Lounge TV"); // the user's device name wins
  assert.deepEqual(tv.slots, [1, 2]);
  assert.equal(d.find((x) => x.prefix === "bath_bath").name, "Bath");
});

test("scentDevices: a remaining sensor that is not a percentage is not a diffuser", () => {
  const h = house();
  h.states["sensor.bath_bath_slot_1_fragrance_remaining"].attributes.unit_of_measurement = "h";
  h.states["sensor.bath_bath_slot_2_fragrance_remaining"].attributes.unit_of_measurement = "h";
  const d = L.scentDevices(h.states, h.entities, h.devices, h.areas);
  assert.ok(!d.some((x) => x.prefix === "bath_bath"));
});

test("scentDevices: works without registries (prefix as the device, no area)", () => {
  const h = house();
  const d = L.scentDevices(h.states, {}, {}, {});
  assert.equal(d.length, 3);
  assert.equal(d.find((x) => x.prefix === "lounge_pura").areaId, null);
  assert.equal(d.find((x) => x.prefix === "lounge_pura").name, "Lounge Pura");
  assert.deepEqual(L.scentDevices(undefined, undefined, undefined, undefined), []);
});

test("scentDevices: an entity's own area beats its device's", () => {
  const h = house();
  h.entities["sensor.bath_bath_slot_1_fragrance_remaining"].area_id = "lounge";
  assert.equal(L.scentDevices(h.states, h.entities, h.devices, h.areas).find((x) => x.prefix === "bath_bath").areaId, "lounge");
});

// --- model ---------------------------------------------------------------------------------------
test("scentModel: slots with remaining %, scent names, colours, low flags; the active slot", () => {
  const h = house();
  const devs = L.scentDevices(h.states, h.entities, h.devices, h.areas);
  const tv = L.scentModel(devs.find((x) => x.prefix === "lounge_tv_pura"), h.states, { nowMs: NOW, tz: "UTC" });
  assert.equal(tv.online, true);
  assert.equal(tv.active, 2);
  assert.equal(tv.running, true);
  assert.equal(tv.slots.length, 2);
  assert.deepEqual(tv.slots.map((s) => s.pct), [92, 8]);
  assert.deepEqual(tv.slots.map((s) => s.name), ["Volcano", "Fig"]);
  assert.deepEqual(tv.slots.map((s) => s.low), [false, true]);
  assert.equal(tv.anyLow, true);
  assert.equal(tv.alternate, true);
  assert.deepEqual([tv.intensity.step, tv.intensity.level, tv.intensity.word], [5, 10, "Intense"]);
  for (const s of tv.slots) assert.match(s.color, /^#[0-9a-f]{6}$/);
});

test("scentModel: off, offline, unknown values", () => {
  const h = house();
  const devs = L.scentDevices(h.states, h.entities, h.devices, h.areas);
  const bath = L.scentModel(devs.find((x) => x.prefix === "bath_bath"), h.states, { nowMs: NOW, tz: "UTC" });
  assert.equal(bath.active, null);
  assert.equal(bath.running, false);
  assert.equal(bath.intensity.step, 0);
  assert.equal(bath.timer, null);
  h.states["binary_sensor.lounge_pura_connected"] = st("off");
  h.states["sensor.lounge_pura_slot_1_fragrance_remaining"] = st("unavailable");
  const lounge = L.scentModel(devs.find((x) => x.prefix === "lounge_pura"), h.states, { nowMs: NOW, tz: "UTC" });
  assert.equal(lounge.online, false);
  assert.equal(lounge.running, false); // nothing runs while offline
  assert.equal(lounge.slots[0].pct, null);
});

test("scentModel: a pending timer reads 'until <time>' and fills a 12-hour dial", () => {
  const h = house();
  h.states["sensor.lounge_pura_timer"] = st("2026-11-16T06:55:00+00:00", { device_class: "timestamp" });
  const devs = L.scentDevices(h.states, h.entities, h.devices, h.areas);
  const m = L.scentModel(devs.find((x) => x.prefix === "lounge_pura"), h.states, { nowMs: NOW, tz: "America/New_York" });
  assert.equal(m.timer.text, "until 1:55 AM");
  assert.ok(Math.abs(m.timer.fraction - 115 / 720) < 1e-9, m.timer.fraction);
});

test("scentTimer: past, unknown or garbage timestamps show nothing; far ones are clamped", () => {
  assert.equal(L.scentTimer("unknown", NOW, "UTC"), null);
  assert.equal(L.scentTimer("2026-11-16T04:00:00Z", NOW, "UTC"), null);
  assert.equal(L.scentTimer(undefined, NOW, "UTC"), null);
  assert.equal(L.scentTimer("2026-11-18T04:00:00Z", NOW, "UTC").fraction, 1);
  assert.equal(L.scentTimer("2026-11-16T05:30:00Z", NOW, "UTC").text, "until 5:30 AM");
});

test("intensityStep: the select's six options become a 0-5 step, the device level and a word", () => {
  assert.deepEqual(["off", "gentle", "subtle", "medium", "strong", "intense"].map((o) => L.intensityStep(o).step), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(["off", "gentle", "subtle", "medium", "strong", "intense"].map((o) => L.intensityStep(o).level), [0, 1, 3, 5, 7, 10]);
  assert.equal(L.intensityStep("medium").word, "Medium");
  assert.equal(L.intensityStep("turbo"), null);
  assert.equal(L.intensityStep(undefined), null);
});

// --- colour --------------------------------------------------------------------------------------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function contrastOnBlack(hex) {
  const c = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05) / 0.05;
}

test("scentColor: stable per scent name, legible on black, and different scents differ", () => {
  assert.equal(L.scentColor("Volcano"), L.scentColor("Volcano"));
  const names = ["Volcano", "Fig", "Linen", "Cedar", "Lavender", "Citrus", "Ocean", "Rose"];
  for (const n of names) assert.ok(contrastOnBlack(L.scentColor(n)) >= 4.5, `${n} ${L.scentColor(n)}`);
  assert.ok(new Set(names.map((n) => L.scentColor(n))).size >= 6);
});

test("scentColor: a dark brand colour keeps its hue but is lifted to read on the glass", () => {
  const c = L.scentColor("Volcano", "#002F87"); // navy: invisible behind the glass as it is
  assert.ok(contrastOnBlack(c) >= 4.5, c);
  const [r, g, b] = rgb(c);
  assert.ok(b > r && b > g, `${c} is still blue`);
  assert.equal(L.scentColor("Volcano", "not a colour"), L.scentColor("Volcano"));
  assert.match(L.scentColor(""), /^#[0-9a-f]{6}$/);
});

// --- rooms and the status line ---------------------------------------------------------------------
test("roomDetails: a diffuser is a scent item on its room's page (two in one room, two items)", () => {
  const h = house();
  const scents = L.scentDevices(h.states, h.entities, h.devices, h.areas).map((d) => L.scentModel(d, h.states, { nowMs: NOW, tz: "UTC" }));
  const rooms = L.roomsFromRegistries(h.areas, h.devices, h.entities, h.states, { scents });
  const lounge = rooms.find((r) => r.id === "lounge");
  const sc = lounge.items.filter((i) => i.kind === "scent");
  assert.equal(sc.length, 2);
  assert.ok(sc.every((i) => i.key.startsWith("scent:")));
  assert.ok(sc.some((i) => i.scent.anyLow));
  // A room whose only device is a diffuser still gets a page.
  assert.ok(rooms.some((r) => r.id === "bath" && r.items.length === 1));
  // Without scents in the options nothing changes.
  assert.ok(!L.roomsFromRegistries(h.areas, h.devices, h.entities, h.states, {}).some((r) => r.items.some((i) => i.kind === "scent")));
});

test("exceptions: a low vial is an attention line naming the diffuser", () => {
  const h = house();
  const scents = L.scentDevices(h.states, h.entities, h.devices, h.areas).map((d) => L.scentModel(d, h.states, { nowMs: NOW, tz: "UTC" }));
  const lines = L.exceptions({}, {}, scents);
  assert.deepEqual(lines, [{ level: "attention", text: "Lounge TV scent low" }]);
  assert.deepEqual(L.exceptions({}, {}, []), []);
  assert.deepEqual(L.exceptions({}, {}), []);
  // Two low diffusers share one line.
  scents.forEach((m) => (m.anyLow = true));
  assert.equal(L.exceptions({}, {}, scents).length, 1);
});

test("resolveConfig: scent is on unless set to false", () => {
  assert.equal(L.resolveConfig({}, null).scent, true);
  assert.equal(L.resolveConfig({ scent: false }, null).scent, false);
});
