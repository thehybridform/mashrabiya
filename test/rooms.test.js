// Run: npm test
// Rooms page (dist/mashrabiya-logic.js): rooms discovered from the HA frontend registries on
// `hass` (areas, devices, entities) and what each room shows. Read-only: the logic only describes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const st = (state, attrs = {}) => ({ state, attributes: attrs });
const ent = (entity_id, extra = {}) => ({ entity_id, area_id: null, device_id: null, hidden: false, entity_category: null, ...extra });

// Shapes as on hass.areas / hass.devices / hass.entities in the HA frontend.
function registries() {
  const areas = {
    living_room: { area_id: "living_room", name: "Living Room" },
    kitchen: { area_id: "kitchen", name: "Kitchen" },
    basement: { area_id: "basement", name: "Basement" },
    attic: { area_id: "attic", name: "Attic" }, // nothing relevant -> omitted
    music_room: { area_id: "music_room", name: "Music Room", temperature_entity_id: "sensor.music_b_temp" },
  };
  const devices = {
    d_thermo: { id: "d_thermo", area_id: "living_room" },
    d_presence: { id: "d_presence", area_id: "kitchen" },
    d_server: { id: "d_server", area_id: "basement" },
    d_music: { id: "d_music", area_id: "music_room" },
  };
  const list = [
    ent("climate.thermostat", { device_id: "d_thermo" }),
    ent("sensor.thermostat_temperature", { device_id: "d_thermo" }),
    ent("sensor.thermostat_humidity", { device_id: "d_thermo" }),
    ent("binary_sensor.thermostat_occupancy", { device_id: "d_thermo" }),
    ent("binary_sensor.living_room_occupancy", { area_id: "living_room" }),
    ent("light.living_room_lamp", { area_id: "living_room" }),
    ent("light.living_room_ceiling", { area_id: "living_room" }),
    ent("light.living_room_group", { area_id: "living_room" }),
    ent("light.living_room_presence_esp32_led", { area_id: "living_room" }),
    ent("media_player.living_room_tv", { area_id: "living_room" }),
    ent("media_player.living_room_speaker", { area_id: "living_room" }),
    ent("fan.purifier", { area_id: "living_room" }),
    ent("sensor.purifier_air_quality", { area_id: "living_room" }),
    ent("binary_sensor.entry_door", { area_id: "living_room" }),
    ent("sensor.thermostat_battery_temp", { device_id: "d_thermo", entity_category: "diagnostic" }),
    ent("light.hidden_one", { area_id: "living_room", hidden: true }),
    // Kitchen: entity area comes from its device; own area_id wins over device's.
    ent("binary_sensor.kitchen_occupancy", { device_id: "d_presence" }),
    ent("binary_sensor.patio_door", { device_id: "d_presence" }),
    ent("binary_sensor.kitchen_window", { device_id: "d_presence" }),
    ent("sensor.kitchen_co2", { device_id: "d_presence" }),
    ent("sensor.moved_temp", { device_id: "d_presence", area_id: "basement" }),
    ent("cover.kitchen_blind", { area_id: "kitchen" }),
    // Basement: server temperatures must not pass for the room's temperature.
    ent("sensor.server_cpu1_temp", { device_id: "d_server" }),
    ent("sensor.server_system_board_inlet_temp", { device_id: "d_server" }),
    ent("sensor.nas_disk_1_temperature", { device_id: "d_server" }),
    ent("binary_sensor.cellar_door", { area_id: "basement" }),
    // Music room: the area's chosen temperature sensor wins.
    ent("sensor.music_a_temp", { device_id: "d_music" }),
    ent("sensor.music_b_temp", { device_id: "d_music" }),
    ent("sensor.music_humidity", { device_id: "d_music" }),
    ent("sensor.music_pm25", { device_id: "d_music" }),
    ent("sensor.unassigned_temp"),
  ];
  const entities = Object.fromEntries(list.map((e) => [e.entity_id, e]));
  const states = {
    "climate.thermostat": st("heat", { current_temperature: 71, temperature: 68, current_humidity: 49 }),
    "sensor.thermostat_temperature": st("71.06", { device_class: "temperature", unit_of_measurement: "°F" }),
    "sensor.thermostat_humidity": st("49.0", { device_class: "humidity", unit_of_measurement: "%" }),
    "binary_sensor.thermostat_occupancy": st("off", { device_class: "occupancy" }),
    "binary_sensor.living_room_occupancy": st("on", { device_class: "occupancy" }),
    "light.living_room_lamp": st("on", { friendly_name: "Living Room Lamp", brightness: 128, rgb_color: [255, 200, 150] }),
    "light.living_room_ceiling": st("off", { friendly_name: "Ceiling" }),
    "light.living_room_group": st("on", { friendly_name: "Living Room", brightness: 255, entity_id: ["light.living_room_lamp", "light.living_room_ceiling"] }),
    "light.living_room_presence_esp32_led": st("off", { friendly_name: "Living room presence ESP32 LED" }),
    "media_player.living_room_tv": st("playing", { friendly_name: "Living Room TV", media_title: "The Naked Now", app_name: "Plex" }),
    "media_player.living_room_speaker": st("idle", { friendly_name: "Speaker" }),
    "fan.purifier": st("on", { friendly_name: "Air Purifier", percentage: 40 }),
    "sensor.purifier_air_quality": st("high", { device_class: "enum", friendly_name: "Air Purifier Air quality" }),
    "binary_sensor.entry_door": st("off", { device_class: "door", friendly_name: "Entry Door" }),
    "sensor.thermostat_battery_temp": st("90", { device_class: "temperature", unit_of_measurement: "°F" }),
    "light.hidden_one": st("on", { brightness: 255 }),
    "binary_sensor.kitchen_occupancy": st("off", { device_class: "occupancy" }),
    "binary_sensor.patio_door": st("on", { device_class: "door", friendly_name: "Patio Door" }),
    "binary_sensor.kitchen_window": st("off", { device_class: "window", friendly_name: "Kitchen Window" }),
    "sensor.kitchen_co2": st("950", { device_class: "carbon_dioxide", unit_of_measurement: "ppm" }),
    "sensor.moved_temp": st("60", { device_class: "temperature", unit_of_measurement: "°F" }),
    "cover.kitchen_blind": st("open", { friendly_name: "Kitchen Blind", current_position: 40 }),
    "sensor.server_cpu1_temp": st("95", { device_class: "temperature", unit_of_measurement: "°F" }),
    "sensor.server_system_board_inlet_temp": st("62.6", { device_class: "temperature", unit_of_measurement: "°F" }),
    "sensor.nas_disk_1_temperature": st("91", { device_class: "temperature", unit_of_measurement: "°F" }),
    "binary_sensor.cellar_door": st("off", { device_class: "door", friendly_name: "Cellar Door" }),
    "sensor.music_a_temp": st("50", { device_class: "temperature", unit_of_measurement: "°F" }),
    "sensor.music_b_temp": st("60.9", { device_class: "temperature", unit_of_measurement: "°F" }),
    "sensor.music_humidity": st("54.5", { device_class: "humidity", unit_of_measurement: "%" }),
    "sensor.music_pm25": st("8", { device_class: "pm25", unit_of_measurement: "µg/m³" }),
    "sensor.unassigned_temp": st("70", { device_class: "temperature", unit_of_measurement: "°F" }),
  };
  return { areas, devices, entities, states };
}

// The card passes hass's own temperature unit; the library default (no unit given) is Celsius.
const F = { tempUnit: "°F" };
const build = (opts) => {
  const r = registries();
  return L.roomsFromRegistries(r.areas, r.devices, r.entities, r.states, { ...F, ...opts });
};
const room = (rooms, id) => rooms.find((x) => x.id === id);
const kinds = (r) => r.items.map((i) => i.kind);
const item = (r, key) => r.items.find((i) => i.key === key);

test("roomIndex: area from the entity, else its device; hidden and categorised skipped", () => {
  const r = registries();
  const idx = L.roomIndex(r.areas, r.devices, r.entities);
  const lr = idx.find((x) => x.id === "living_room");
  assert.ok(lr.entityIds.includes("climate.thermostat")); // via device
  assert.ok(lr.entityIds.includes("light.living_room_lamp")); // own area
  assert.ok(!lr.entityIds.includes("sensor.thermostat_battery_temp")); // diagnostic
  assert.ok(!lr.entityIds.includes("light.hidden_one")); // hidden
  const base = idx.find((x) => x.id === "basement");
  assert.ok(base.entityIds.includes("sensor.moved_temp")); // own area beats device area
  const kitchen = idx.find((x) => x.id === "kitchen");
  assert.ok(!kitchen.entityIds.includes("sensor.moved_temp"));
  assert.ok(!idx.some((x) => x.entityIds.includes("sensor.unassigned_temp")));
});

test("roomIndex: tolerates missing registries", () => {
  assert.deepEqual(L.roomIndex(undefined, undefined, undefined), []);
  assert.deepEqual(L.roomsFromRegistries(null, null, null, null), []);
});

test("rooms ordered by name; rooms with nothing relevant omitted", () => {
  assert.deepEqual(build().map((x) => x.name), ["Basement", "Kitchen", "Living Room", "Music Room"]);
});

test("rooms option sets order and which areas show", () => {
  assert.deepEqual(build({ order: ["music_room", "living_room", "nope"] }).map((x) => x.id), ["music_room", "living_room"]);
});

test("living room: climate replaces the temperature sensor; one humidity; air; occupancy", () => {
  const lr = room(build(), "living_room");
  assert.deepEqual(kinds(lr), ["climate", "humidity", "air", "occupancy", "door", "light", "light", "fan", "media"]);
  const cl = item(lr, "climate:climate.thermostat");
  assert.equal(cl.label, "Heat");
  assert.equal(cl.value, "71° → 68°");
  assert.equal(cl.tone, "green"); // the arc's colour: 71 °F is comfortable
  assert.equal(cl.modeTone, "orange"); // the mode word: heating
  const h = item(lr, "humidity");
  assert.equal(h.value, "49%");
  assert.equal(h.tone, "green"); // inside the 30-60 % band
  const air = item(lr, "air");
  assert.equal(air.value, "Good");
  assert.equal(air.tone, "green");
});

test("occupancy: any occupancy/motion/presence sensor on -> Occupied (green); all off -> Empty", () => {
  assert.deepEqual(
    (({ value, tone }) => ({ value, tone }))(item(room(build(), "living_room"), "occupancy")),
    { value: "Occupied", tone: "green" },
  );
  assert.equal(item(room(build(), "kitchen"), "occupancy").value, "Empty");
  assert.equal(item(room(build(), "kitchen"), "occupancy").tone, "dim");
});

test("lights: groups whose members are listed and indicator LEDs are skipped; name loses the area", () => {
  const lr = room(build(), "living_room");
  const lights = lr.items.filter((i) => i.kind === "light");
  assert.deepEqual(lights.map((l) => l.label), ["Ceiling", "Lamp"]);
  const lamp = item(lr, "light:light.living_room_lamp");
  assert.equal(lamp.value, "50%");
  assert.equal(lamp.tone, "yellow");
  assert.equal(lamp.color, "rgb(255, 200, 150)");
  const off = item(lr, "light:light.living_room_ceiling");
  assert.equal(off.value, "Off");
  assert.equal(off.tone, "dim");
  assert.equal(off.color, null);
});

test("light that is on without brightness reads On", () => {
  const r = L.roomDetails([{ id: "a", name: "A", area: {}, entityIds: ["light.x"] }], { "light.x": st("on", { friendly_name: "X" }) });
  assert.equal(r[0].items[0].value, "On");
});

test("lightName strips a repeated area name, never to nothing", () => {
  assert.equal(L.lightName("Living Room Lamp", "Living Room"), "Lamp");
  assert.equal(L.lightName("living room  lamp", "Living Room"), "lamp");
  assert.equal(L.lightName("Living Room", "Living Room"), "Living Room");
  assert.equal(L.lightName("Hue color  1 of 3", "Living Room"), "Hue color 1 of 3");
  assert.equal(L.lightName("Master bedroom dimmer", "Bedroom"), "Master bedroom dimmer");
});

test("doors and windows: Open orange, Closed dim; media shows the playing title", () => {
  const k = room(build(), "kitchen");
  const back = item(k, "door:binary_sensor.patio_door");
  assert.deepEqual([back.label, back.value, back.tone], ["Patio Door", "Open", "attention"]);
  const win = item(k, "door:binary_sensor.kitchen_window");
  assert.deepEqual([win.label, win.value, win.tone, win.kind, win.icon], ["Window", "Closed", "dim", "door", "window"]);
  assert.equal(back.icon, "door");
  const lr = room(build(), "living_room");
  const tv = item(lr, "media:media_player.living_room_tv");
  assert.deepEqual([tv.label, tv.value, tv.tone], ["TV", "The Naked Now", "purple"]);
  assert.equal(item(lr, "media:media_player.living_room_speaker"), undefined); // idle
});

test("fans show on/off and speed; covers show position", () => {
  const lr = room(build(), "living_room");
  const fan = item(lr, "fan:fan.purifier");
  assert.deepEqual([fan.label, fan.value, fan.tone], ["Air Purifier", "On 40%", "blue"]);
  const blind = item(room(build(), "kitchen"), "cover:cover.kitchen_blind");
  assert.deepEqual([blind.label, blind.value, blind.tone], ["Blind", "Open 40%", "yellow"]);
});

test("air: CO2 carries its subscript and a threshold tone", () => {
  const air = item(room(build(), "kitchen"), "air");
  assert.equal(air.label, "CO");
  assert.equal(air.labelSub, "2");
  assert.equal(air.value, "950 ppm");
  assert.equal(air.tone, "yellow");
});

test("air: PM2.5 and tones by level", () => {
  const air = item(room(build(), "music_room"), "air");
  assert.equal(air.label, "PM");
  assert.equal(air.labelSub, "2.5");
  assert.equal(air.value, "8 µg/m³");
  assert.equal(air.tone, "green");
  assert.equal(L.airLevelTone("co2", 700), "green");
  assert.equal(L.airLevelTone("co2", 1500), "orange");
  assert.equal(L.airLevelTone("co2", 2500), "red");
  assert.equal(L.airLevelTone("pm25", 40), "orange");
  assert.equal(L.airLevelTone("aqi", 42), "green");
  assert.equal(L.airLevelTone("aqi", 160), "red");
  assert.equal(L.airLevelTone("volatile_organic_compounds", 300), null);
});

test("temperature: the area's chosen sensor wins; equipment sensors never count", () => {
  const music = room(build(), "music_room");
  assert.equal(item(music, "temperature").value, "61°F");
  assert.equal(item(music, "temperature").tone, "blue"); // 61 °F is cool
  const base = room(build(), "basement");
  // cpu, disk and board sensors are equipment; the moved room sensor is the room's
  assert.equal(item(base, "temperature").value, "60°F");
  assert.equal(item(base, "temperature").key, "temperature");
});

test("temperature: a room with only equipment sensors shows no temperature", () => {
  const r = registries();
  delete r.entities["sensor.moved_temp"];
  const base = room(L.roomsFromRegistries(r.areas, r.devices, r.entities, r.states, F), "basement");
  assert.equal(item(base, "temperature"), undefined);
  assert.deepEqual(kinds(base), ["door"]);
});

test("unavailable and unknown states are skipped", () => {
  const r = registries();
  r.states["sensor.music_b_temp"].state = "unavailable";
  r.states["sensor.music_a_temp"].state = "unknown";
  r.states["sensor.music_pm25"].state = "unavailable";
  const music = room(L.roomsFromRegistries(r.areas, r.devices, r.entities, r.states, F), "music_room");
  assert.deepEqual(kinds(music), ["humidity"]);
});

test("roomsSignature changes with structure, not with values", () => {
  const r = registries();
  const a = L.roomsSignature(L.roomsFromRegistries(r.areas, r.devices, r.entities, r.states));
  r.states["sensor.music_humidity"].state = "60";
  r.states["light.living_room_lamp"].attributes.brightness = 20;
  const b = L.roomsSignature(L.roomsFromRegistries(r.areas, r.devices, r.entities, r.states));
  assert.equal(a, b);
  r.states["media_player.living_room_speaker"].state = "playing";
  const c = L.roomsSignature(L.roomsFromRegistries(r.areas, r.devices, r.entities, r.states));
  assert.notEqual(a, c);
});

test("rooms items never carry an action: the page is read-only", () => {
  for (const r of build()) for (const i of r.items) {
    assert.deepEqual(Object.keys(i).filter((k) => /action|service|call/i.test(k)), [], i.key);
  }
});
