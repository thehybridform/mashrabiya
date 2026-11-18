// Run: npm test
// Config resolution for the mirror card (dist/mashrabiya-logic.js): with NO user config the card must
// work from what Home Assistant itself says (hass.config, the states) and hide every feature that needs
// configuration. Nothing here knows any particular house.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const st = (state, attributes = {}) => ({ state, attributes });
const hass = (states = {}, config = {}) => ({
  states,
  config: { time_zone: "Europe/Berlin", unit_system: { temperature: "°C" }, ...config },
});

test("resolveConfig: empty config and empty hass is safe and hides everything optional", () => {
  const c = L.resolveConfig(undefined, undefined);
  assert.deepEqual(c.locks, []);
  assert.deepEqual(c.doors, []);
  assert.deepEqual(c.news, []);
  assert.deepEqual(c.scenes, { title: "", entities: [], off: null });
  assert.equal(c.leaving_script, null);
  assert.equal(c.person, null);
  assert.equal(c.climate, null);
  assert.equal(c.internet, null);
  assert.equal(c.air, null);
  assert.equal(c.weather, null);
  assert.equal(c.media_players, null);
  assert.equal(c.radar, true);
  assert.equal(c.radar_pattern, "{prefix}_presence");
  assert.equal(c.night_start, "22:00");
  assert.equal(c.night_end, "06:30");
});

test("resolveConfig: timezone and unit come from hass.config, the user can override", () => {
  const h = hass({}, { time_zone: "Asia/Tokyo", unit_system: { temperature: "°F" } });
  assert.equal(L.resolveConfig({}, h).time_zone, "Asia/Tokyo");
  assert.equal(L.resolveConfig({}, h).temperature_unit, "°F");
  assert.equal(L.resolveConfig({ time_zone: "UTC" }, h).time_zone, "UTC");
  assert.equal(L.resolveConfig({}, undefined).time_zone, "UTC");
  assert.equal(L.resolveConfig({}, undefined).temperature_unit, "°C");
});

test("resolveConfig: weather defaults to the first weather entity, sorted", () => {
  const h = hass({ "weather.zeta": st("sunny"), "weather.alpha": st("rainy"), "sensor.x": st("1") });
  assert.equal(L.resolveConfig({}, h).weather, "weather.alpha");
  assert.equal(L.resolveConfig({ weather: "weather.zeta" }, h).weather, "weather.zeta");
});

test("resolveConfig: locks default to every lock entity (lock-only), doors never guessed", () => {
  const h = hass({ "lock.b": st("locked"), "lock.a": st("locked"), "binary_sensor.a": st("off") });
  const c = L.resolveConfig({}, h);
  assert.deepEqual(c.locks, ["lock.a", "lock.b"]);
  assert.deepEqual(c.doors, []);
  assert.deepEqual(L.resolveConfig({ locks: ["lock.b"], doors: ["binary_sensor.a"] }, h).locks, ["lock.b"]);
  assert.deepEqual(L.resolveConfig({ locks: [] }, h).locks, []);
});

test("resolveConfig: scenes are normalised; strings take their names from the states", () => {
  const h = hass({ "scene.cosy": st("unknown", { friendly_name: "Cosy" }) });
  const c = L.resolveConfig({ scenes: { title: "Lounge", entities: ["scene.cosy", { entity: "scene.x_y", name: "Why" }, "scene.plain_one"], off: "light.lounge" } }, h);
  assert.equal(c.scenes.title, "Lounge");
  assert.deepEqual(c.scenes.entities, [
    { entity: "scene.cosy", name: "Cosy" },
    { entity: "scene.x_y", name: "Why" },
    { entity: "scene.plain_one", name: "Plain One" },
  ]);
  assert.deepEqual(c.scenes.off, { entity: "light.lounge", name: L.STRINGS.off });
});

test("resolveConfig: news is a list; tones default and invalid entries are dropped", () => {
  const c = L.resolveConfig({ news: [
    { label: "Local", entity: "sensor.a", tone: "green" },
    { label: "World", entity: "sensor.b" },
    { label: "Bad tone", entity: "sensor.c", tone: "pink" },
    { label: "No entity" },
    "junk",
  ] }, hass());
  assert.deepEqual(c.news.map((n) => [n.label, n.entity]), [["Local", "sensor.a"], ["World", "sensor.b"], ["Bad tone", "sensor.c"]]);
  assert.equal(c.news[0].tone, "green");
  for (const n of c.news) assert.ok(["green", "blue", "yellow", "orange", "purple"].includes(n.tone), n.tone);
});

test("resolveConfig: font_url keeps the default, null means system fonts", () => {
  assert.match(L.resolveConfig({}, hass()).font_url, /^https:\/\/fonts\.googleapis\.com\//);
  assert.equal(L.resolveConfig({ font_url: null }, hass()).font_url, null);
  assert.equal(L.resolveConfig({ font_url: "/local/f.css" }, hass()).font_url, "/local/f.css");
  assert.equal(L.resolveConfig({}, hass()).font_family, "Atkinson Hyperlegible");
  assert.equal(L.resolveConfig({ font_family: "Inter" }, hass()).font_family, "Inter");
});

test("resolveConfig: the user's own values pass through", () => {
  const c = L.resolveConfig({ internet: "binary_sensor.wan", air: "sensor.aq", person: "person.me", climate: "climate.t", leaving_script: "script.go", outdoor_temperature: "sensor.out", rooms: ["a"], radar: false, debug_fps: true }, hass());
  assert.deepEqual([c.internet, c.air, c.person, c.climate, c.leaving_script, c.outdoor_temperature, c.radar, c.debug_fps], ["binary_sensor.wan", "sensor.aq", "person.me", "climate.t", "script.go", "sensor.out", false, true]);
  assert.deepEqual(c.rooms, ["a"]);
});

test("resolveConfig: media players configurable (strings or objects), else null for 'whatever is playing'", () => {
  const c = L.resolveConfig({ media_players: ["media_player.tv", { entity: "media_player.sp", name: "Speaker" }] }, hass({ "media_player.tv": st("idle", { friendly_name: "TV" }) }));
  assert.deepEqual(c.media_players, [{ entity: "media_player.tv", name: "TV" }, { entity: "media_player.sp", name: "Speaker" }]);
});

test("mediaPlayers: configured list filtered to playing/paused; unconfigured lists every playing one", () => {
  const s = {
    "media_player.a": st("playing", { friendly_name: "A" }), "media_player.b": st("off", { friendly_name: "B" }),
    "media_player.c": st("paused", { friendly_name: "C" }),
  };
  assert.deepEqual(L.mediaPlayers({ media_players: null }, s).map((m) => m.entity), ["media_player.a", "media_player.c"]);
  assert.deepEqual(L.mediaPlayers({ media_players: [{ entity: "media_player.b", name: "B" }, { entity: "media_player.c", name: "C" }] }, s).map((m) => m.entity), ["media_player.c"]);
  assert.deepEqual(L.mediaPlayers({ media_players: [{ entity: "media_player.gone", name: "G" }] }, s), []);
});

test("outdoorTemp: the configured sensor, else the weather entity's own temperature", () => {
  const s = { "sensor.out": st("12.4"), "weather.w": st("sunny", { temperature: 9.6 }) };
  assert.equal(L.outdoorTemp(s, { outdoor_temperature: "sensor.out", weather: "weather.w" }), "12.4");
  assert.equal(L.outdoorTemp(s, { outdoor_temperature: null, weather: "weather.w" }), 9.6);
  assert.equal(L.outdoorTemp(s, { outdoor_temperature: null, weather: null }), undefined);
});

test("exceptions: with no configuration there is nothing to report", () => {
  const s = { "lock.x": st("unlocked", { friendly_name: "X" }), "binary_sensor.x": st("on") };
  assert.deepEqual(L.exceptions(s), []);
  assert.deepEqual(L.exceptions(s, { locks: ["lock.x"] }).map((e) => e.text), ["X unlocked"]);
});

test("room temperatures default to Celsius when no unit is passed (the card passes hass's)", () => {
  const rooms = L.roomDetails([{ id: "r", name: "Room", area: {}, entityIds: ["climate.t"] }], { "climate.t": st("heat", { current_temperature: 21, temperature: 22 }) });
  assert.equal(rooms[0].items[0].gauge.unit, "°C");
  assert.equal(rooms[0].items[0].gauge.max, 32);
});

test("STRINGS: one English table holds the UI words (a translation drops in here)", () => {
  assert.equal(typeof L.STRINGS, "object");
  assert.equal(L.STRINGS.locale, "en-US");
  for (const k of ["leaving", "lockAll", "lightsOff", "more", "allClear", "internetDown", "airPoor", "off"]) {
    assert.equal(typeof L.STRINGS[k], "string", k);
  }
  assert.equal(L.STRINGS.allClear, "All clear");
  assert.equal(L.STRINGS.internetDown, "Internet down");
});

test("tickerSegments: built from the configured news list, in order, empty feeds skipped", () => {
  const news = [
    { label: "A", entity: "sensor.a", tone: "green" },
    { label: "B", entity: "sensor.b", tone: "blue" },
    { label: "C", entity: "sensor.c", tone: "yellow" },
  ];
  assert.deepEqual(L.tickerSegments(news, { "sensor.c": ["c1"], "sensor.a": ["a1", "a2"], "sensor.b": [] }), [
    { label: "A", tone: "green", titles: ["a1", "a2"] },
    { label: "C", tone: "yellow", titles: ["c1"] },
  ]);
  assert.deepEqual(L.tickerSegments([], {}), []);
  assert.deepEqual(L.tickerSegments(undefined, undefined), []);
});

test("radar discovery pattern is configurable; the default suits Everything-Presence-style devices", () => {
  const s = { "sensor.hall_presence_target_1_x": st("0"), "sensor.den_zone_target_2_x": st("0") };
  assert.deepEqual(L.radarPrefixes(s), ["hall"]);
  assert.deepEqual(L.radarPrefixes(s, "{prefix}_presence"), ["hall"]);
  assert.deepEqual(L.radarPrefixes(s, "{prefix}_zone"), ["den"]);
  const m = L.radarModel("den", { "sensor.den_zone_target_2_x": st("500", { unit_of_measurement: "mm" }), "sensor.den_zone_target_2_y": st("1500", { unit_of_measurement: "mm" }) }, "{prefix}_zone");
  assert.equal(m.targets[0].n, 2);
  assert.equal(m.targets[0].x, 500);
});
