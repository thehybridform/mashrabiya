// Run: npm test
// Pure logic for the mirror card (dist/mashrabiya-logic.js). The file is a plain script that
// assigns globalThis.MashrabiyaLogic, so it runs in this realm (deepStrictEqual compares prototypes).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const TZ = "America/Los_Angeles";

const st = (state, attrs = {}) => ({ state, attributes: attrs });
// Everything fine: all locked, all closed, internet up, air good.
function calm() {
  return {
    "lock.entry_door": st("locked", { friendly_name: "Entry Door" }),
    "lock.patio_door": st("locked", { friendly_name: "Patio Door" }),
    "lock.cellar_door": st("locked", { friendly_name: "Cellar Door" }),
    "lock.studio_door": st("locked", { friendly_name: "Studio Door" }),
    "binary_sensor.entry_door": st("off", { friendly_name: "Entry Door" }),
    "binary_sensor.patio_door": st("off", { friendly_name: "Patio Door" }),
    "binary_sensor.cellar_door": st("off", { friendly_name: "Cellar Door" }),
    "binary_sensor.studio_door": st("off", { friendly_name: "Studio Door" }),
    "binary_sensor.internet_check": st("on"),
    "sensor.living_room_air_quality": st("high"),
  };
}
// This test file exercises the logic with one concrete house; the card itself ships no defaults for it.
const HOUSE = {
  locks: ["lock.entry_door", "lock.patio_door", "lock.cellar_door", "lock.studio_door"],
  doors: ["binary_sensor.entry_door", "binary_sensor.patio_door", "binary_sensor.cellar_door", "binary_sensor.studio_door"],
  internet: "binary_sensor.internet_check",
  air: "sensor.living_room_air_quality",
};
const texts = (s) => L.exceptions(s, HOUSE).map((e) => e.text);

test("loads as a global", () => {
  assert.equal(typeof L, "object");
  assert.equal(typeof L.exceptions, "function");
});

test("formatId falls back to a readable name", () => {
  assert.equal(L.formatId("lock.entry_door"), "Entry Door");
  assert.equal(L.formatId("binary_sensor.studio_door"), "Studio Door");
});

test("joinNames reads as English", () => {
  assert.equal(L.joinNames(["A"]), "A");
  assert.equal(L.joinNames(["A", "B"]), "A and B");
  assert.equal(L.joinNames(["A", "B", "C"]), "A, B and C");
});

test("all clear: no exceptions", () => {
  assert.deepEqual(L.exceptions(calm(), HOUSE), []);
});

test("unlocked locks are grouped into one red line", () => {
  const s = calm();
  s["lock.entry_door"].state = "unlocked";
  s["lock.patio_door"].state = "unlocked";
  assert.deepEqual(L.exceptions(s, HOUSE), [{ level: "security", text: "Entry Door and Patio Door unlocked" }]);
});

test("three or more unlocked collapse to a count so the line fits the glass", () => {
  const s = calm();
  for (const id of ["lock.entry_door", "lock.patio_door", "lock.studio_door"]) s[id].state = "unlocked";
  assert.deepEqual(texts(s), ["3 doors unlocked"]);
  s["lock.cellar_door"].state = "unlocked";
  assert.deepEqual(texts(s), ["All 4 doors unlocked"]);
});

test("lock friendly name ending in 'Lock' is not doubled", () => {
  const s = calm();
  s["lock.entry_door"] = st("unavailable", { friendly_name: "Entry Door Lock" });
  assert.deepEqual(L.exceptions(s, HOUSE), [{ level: "attention", text: "Entry Door lock offline" }]);
});

test("unavailable and unknown locks are 'offline', not 'unlocked'", () => {
  const s = calm();
  s["lock.entry_door"].state = "unavailable";
  s["lock.patio_door"].state = "unknown";
  assert.deepEqual(texts(s), ["Entry Door and Patio Door locks offline"]);
});

test("jammed lock is a security line", () => {
  const s = calm();
  s["lock.studio_door"].state = "jammed";
  assert.deepEqual(L.exceptions(s, HOUSE), [{ level: "security", text: "Studio Door lock jammed" }]);
});

test("open doors are a red alert line (the glass breathes red), grouped", () => {
  const s = calm();
  s["binary_sensor.cellar_door"].state = "on";
  assert.deepEqual(L.exceptions(s, HOUSE), [{ level: "alert", text: "Cellar Door open" }]);
});

test("name falls back to the formatted id when friendly_name is missing", () => {
  const s = calm();
  s["binary_sensor.patio_door"] = st("on");
  assert.deepEqual(texts(s), ["Patio Door open"]);
});

test("internet down and poor air", () => {
  const s = calm();
  s["binary_sensor.internet_check"].state = "off";
  s["sensor.living_room_air_quality"].state = "lowest";
  assert.deepEqual(L.exceptions(s, HOUSE), [
    { level: "attention", text: "Internet down" },
    { level: "attention", text: "Indoor air poor" },
  ]);
  s["sensor.living_room_air_quality"].state = "low";
  assert.ok(texts(s).includes("Indoor air poor"));
  s["sensor.living_room_air_quality"].state = "medium";
  assert.ok(!texts(s).includes("Indoor air poor"));
});

test("internet unavailable is not 'down' (unknown is not an exception)", () => {
  const s = calm();
  s["binary_sensor.internet_check"].state = "unavailable";
  assert.deepEqual(texts(s), []);
});

test("severity order: security first, then open, offline, internet, air", () => {
  const s = calm();
  s["sensor.living_room_air_quality"].state = "low";
  s["binary_sensor.entry_door"].state = "on";
  s["lock.patio_door"].state = "unlocked";
  assert.deepEqual(texts(s), ["Patio Door unlocked", "Entry Door open", "Indoor air poor"]);
});

test("at most three lines; overflow folds into the third", () => {
  const s = calm();
  s["lock.patio_door"].state = "unlocked";
  s["binary_sensor.entry_door"].state = "on";
  s["lock.studio_door"].state = "unavailable";
  s["binary_sensor.internet_check"].state = "off";
  s["sensor.living_room_air_quality"].state = "low";
  const ex = L.exceptions(s, HOUSE);
  assert.equal(ex.length, 3);
  assert.deepEqual(ex.map((e) => e.text), ["Patio Door unlocked", "Entry Door open", "3 more: tap More"]);
  assert.equal(ex[2].level, "attention");
});

test("missing entities never throw and are skipped", () => {
  assert.deepEqual(L.exceptions({}), []);
  assert.deepEqual(L.exceptions(undefined), []);
});

test("entity ids can be overridden", () => {
  const s = { "lock.garage": st("unlocked", { friendly_name: "Garage" }) };
  assert.deepEqual(L.exceptions(s, { locks: ["lock.garage"], doors: [], internet: null, air: null }), [
    { level: "security", text: "Garage unlocked" },
  ]);
});

// Hourly forecast at the top of each hour starting from `start`.
function hourly(start, conditions, probs = []) {
  return conditions.map((c, i) => ({
    datetime: new Date(start + i * 3600e3).toISOString(),
    condition: c,
    precipitation_probability: probs[i] ?? 0,
  }));
}
// 2026-11-15 17:29 PST = 01:29Z next day.
const NOW = Date.parse("2026-11-16T01:29:00Z");
const HOUR = Date.parse("2026-11-16T01:00:00Z");

test("rain within 4 h: 'Rain from 9 PM'", () => {
  const f = hourly(HOUR, ["cloudy", "cloudy", "cloudy", "cloudy", "rainy", "rainy"]);
  assert.equal(L.rainWindow(f, NOW, TZ), "Rain from 9 PM");
});

test("rain at +3 h", () => {
  const f = hourly(HOUR, ["cloudy", "cloudy", "cloudy", "pouring"]);
  assert.equal(L.rainWindow(f, NOW, TZ), "Rain from 8 PM");
});

test("rain in the current hour reads 'Rain now'", () => {
  assert.equal(L.rainWindow(hourly(HOUR, ["rainy"]), NOW, TZ), "Rain now");
});

test("snow and sleet are named", () => {
  assert.equal(L.rainWindow(hourly(HOUR, ["cloudy", "snowy"]), NOW, TZ), "Snow from 6 PM");
  assert.equal(L.rainWindow(hourly(HOUR, ["cloudy", "snowy-rainy"]), NOW, TZ), "Sleet from 6 PM");
});

test("high probability counts even if the condition is cloudy", () => {
  assert.equal(L.rainWindow(hourly(HOUR, ["cloudy", "cloudy"], [10, 70]), NOW, TZ), "Rain from 6 PM");
  assert.equal(L.rainWindow(hourly(HOUR, ["cloudy", "cloudy"], [10, 30]), NOW, TZ), null);
});

test("rain beyond 4 h is ignored", () => {
  const f = hourly(HOUR, ["cloudy", "cloudy", "cloudy", "cloudy", "cloudy", "cloudy", "rainy"]);
  assert.equal(L.rainWindow(f, NOW, TZ), null);
});

test("past hours and bad input are ignored", () => {
  assert.equal(L.rainWindow(hourly(HOUR - 3 * 3600e3, ["rainy", "cloudy"]), NOW, TZ), null);
  assert.equal(L.rainWindow(null, NOW, TZ), null);
  assert.equal(L.rainWindow([{ condition: "rainy" }], NOW, TZ), null);
});

const at = (iso) => Date.parse(iso);
test("isNight: 22:00 to 06:30 local", () => {
  // PST = UTC-8 in November.
  assert.equal(L.isNight(at("2026-11-16T05:59:00Z"), TZ), false); // 21:59
  assert.equal(L.isNight(at("2026-11-16T06:00:00Z"), TZ), true); // 22:00
  assert.equal(L.isNight(at("2026-11-16T10:00:00Z"), TZ), true); // 02:00
  assert.equal(L.isNight(at("2026-11-16T14:29:00Z"), TZ), true); // 06:29
  assert.equal(L.isNight(at("2026-11-16T14:30:00Z"), TZ), false); // 06:30
  assert.equal(L.isNight(at("2026-11-16T20:00:00Z"), TZ), false); // 12:00
});

test("isNight honours the time zone and DST", () => {
  // 2026-07-01 22:30 PDT = 05:30Z; same instant is 01:30 in New York.
  assert.equal(L.isNight(at("2026-07-02T05:30:00Z"), TZ), true);
  assert.equal(L.isNight(at("2026-07-02T03:00:00Z"), TZ), false); // 20:00 PDT
  assert.equal(L.isNight(at("2026-07-02T15:00:00Z"), "America/New_York"), false); // 11:00
});

test("isNight with custom bounds and a bad zone falls back to UTC", () => {
  assert.equal(L.isNight(at("2026-11-16T07:30:00Z"), TZ, "23:45", "06:00"), false); // 23:30 PST
  assert.equal(L.isNight(at("2026-11-16T07:30:00Z"), TZ, "23:00", "06:00"), true);
  assert.equal(L.isNight(at("2026-11-16T20:00:00Z"), TZ, "09:00", "17:00"), true); // same-day window
  assert.equal(L.isNight(at("2026-11-16T06:00:00Z"), "Not/AZone"), true);
});

test("clock: 12 h time, small meridiem, long date", () => {
  assert.deepEqual(L.clock(NOW, TZ), { time: "5:29", ampm: "PM", date: "Sunday, November 15", key: "2026-11-15 17:29" });
  assert.equal(L.clock(at("2026-11-16T08:05:00Z"), TZ).time, "12:05");
  assert.equal(L.clock(at("2026-11-16T08:05:00Z"), TZ).ampm, "AM");
});

test("lock counts and sublabels", () => {
  const s = calm();
  assert.equal(L.unlockedCount(s, HOUSE.locks), 0);
  assert.equal(L.lockSublabel(0), "All locked");
  s["lock.entry_door"].state = "unlocked";
  s["lock.patio_door"].state = "unavailable";
  assert.equal(L.unlockedCount(s, HOUSE.locks), 1); // offline is not counted as unlocked
  assert.equal(L.lockSublabel(2), "2 unlocked");
  assert.equal(L.lockSublabel(null), "—");
});

test("locksToLock skips locked, offline and missing locks", () => {
  const s = calm();
  s["lock.entry_door"].state = "unlocked";
  s["lock.patio_door"].state = "unavailable";
  delete s["lock.studio_door"];
  assert.deepEqual(L.locksToLock(s, HOUSE.locks), ["lock.entry_door"]);
});

test("lights on count and sublabel", () => {
  const s = { "light.a": st("on"), "light.b": st("off"), "light.c": st("on"), "switch.x": st("on") };
  assert.equal(L.lightsOn(s), 2);
  assert.equal(L.lightsSublabel(2), "2 on");
  assert.equal(L.lightsSublabel(0), "All off");
  assert.equal(L.lightsOn(undefined), 0);
});

test("air words", () => {
  assert.equal(L.airWord("highest"), "Excellent");
  assert.equal(L.airWord("high"), "Good");
  assert.equal(L.airWord("medium"), "Fair");
  assert.equal(L.airWord("low"), "Poor");
  assert.equal(L.airWord("lowest"), "Very poor");
  assert.equal(L.airWord("unavailable"), "—");
  assert.equal(L.airWord(undefined), "—");
});

test("presence never names the person and never reveals a zone", () => {
  assert.equal(L.presenceWord("home"), "Someone home"); // HIG: "Home" now names the first page
  assert.equal(L.presenceWord("not_home"), "Away");
  assert.equal(L.presenceWord("Work"), "Away");
  assert.equal(L.presenceWord("unknown"), "—");
  assert.equal(L.presenceWord(undefined), "—");
});

test("door words: open beats lock state", () => {
  assert.equal(L.doorWord("locked", "off"), "Locked");
  assert.equal(L.doorWord("unlocked", "off"), "Unlocked");
  assert.equal(L.doorWord("locked", "on"), "Open");
  assert.equal(L.doorWord("unavailable", "off"), "Offline");
  assert.equal(L.doorWord(undefined, undefined), "—");
});

test("weather words and temperature", () => {
  assert.equal(L.conditionWord("partlycloudy"), "Partly cloudy");
  assert.equal(L.conditionWord("clear-night"), "Clear");
  assert.equal(L.conditionWord("sunny"), "Sunny");
  assert.equal(L.conditionWord("unavailable"), "");
  assert.equal(L.tempText("52.4"), "52°");
  assert.equal(L.tempText("-3.6"), "−4°");
  assert.equal(L.tempText("unavailable"), "—");
  assert.equal(L.tempText(undefined), "—");
});

test("thermostat step clamps to min/max", () => {
  assert.equal(L.stepTarget(68, 1, 45, 90), 69);
  assert.equal(L.stepTarget(68.5, -1, 45, 90), 68);
  assert.equal(L.stepTarget(90, 1, 45, 90), 90);
  assert.equal(L.stepTarget(45, -1, 45, 90), 45);
  assert.equal(L.stepTarget(undefined, 1, 45, 90), null);
});

test("debounce: ignore repeats inside 700 ms", () => {
  assert.equal(L.debounceOk(undefined, 1000), true);
  assert.equal(L.debounceOk(1000, 1699), false);
  assert.equal(L.debounceOk(1000, 1700), true);
});

// --- swipe navigation -------------------------------------------------------------------
const MIN = 169; // ~40 mm at 4.235 px/mm

test("swipeDirection: clear horizontal moves", () => {
  assert.equal(L.swipeDirection(-200, 10, 300, MIN), "left");
  assert.equal(L.swipeDirection(200, -10, 300, MIN), "right");
});

test("swipeDirection: distance threshold is inclusive", () => {
  assert.equal(L.swipeDirection(-169, 0, 300, MIN), "left");
  assert.equal(L.swipeDirection(-168.9, 0, 300, MIN), null);
  assert.equal(L.swipeDirection(169, 0, 300, MIN), "right");
});

test("swipeDirection: must be at least 2x more horizontal than vertical", () => {
  assert.equal(L.swipeDirection(-200, 100, 300, MIN), "left"); // exactly 2:1
  assert.equal(L.swipeDirection(-200, 101, 300, MIN), null);
  assert.equal(L.swipeDirection(200, 200, 300, MIN), null); // diagonal
  assert.equal(L.swipeDirection(10, 300, 300, MIN), null); // vertical
});

test("swipeDirection: slow drags are not swipes (800 ms inclusive)", () => {
  assert.equal(L.swipeDirection(-200, 0, 800, MIN), "left");
  assert.equal(L.swipeDirection(-200, 0, 801, MIN), null);
});

test("swipeDirection: bad input is null", () => {
  assert.equal(L.swipeDirection(null, 0, 100, MIN), null);
  assert.equal(L.swipeDirection(-200, undefined, 100, MIN), null);
  assert.equal(L.swipeDirection(-200, 0, NaN, MIN), null);
  assert.equal(L.swipeDirection(-200, 0, -5, MIN), null);
  assert.equal(L.swipeDirection(-200, 0, 100, undefined), null);
  assert.equal(L.swipeDirection(-200, 0, 100, 0), null);
  assert.equal(L.swipeDirection(Infinity, 0, 100, MIN), null);
  assert.equal(L.swipeDirection(0, 0, 100, MIN), null);
});

test("swipeNav is gone: pages are a wrapping index (pages.test.js)", () => {
  assert.equal(L.swipeNav, undefined);
  assert.equal(typeof L.nextPage, "function");
});

test("movedPast: pointer travel beyond a slop radius (exclusive)", () => {
  assert.equal(L.movedPast(0, 0, 34), false);
  assert.equal(L.movedPast(34, 0, 34), false);
  assert.equal(L.movedPast(24, 24, 34), false); // hypot 33.94 < 34
  assert.equal(L.movedPast(25, 25, 34), true);
  assert.equal(L.movedPast(null, 5, 34), false);
});

// --- colour tones -----------------------------------------------------------------------------
test("conditionTone: weather condition -> tone", () => {
  for (const c of ["rainy", "pouring", "snowy", "snowy-rainy", "hail"]) assert.equal(L.conditionTone(c), "blue", c);
  for (const c of ["sunny", "clear-night"]) assert.equal(L.conditionTone(c), "yellow", c);
  for (const c of ["cloudy", "partlycloudy", "fog", "windy", "windy-variant"]) assert.equal(L.conditionTone(c), "dim", c);
  for (const c of ["lightning", "lightning-rainy", "exceptional"]) assert.equal(L.conditionTone(c), "orange", c);
  assert.equal(L.conditionTone("nonsense"), "dim");
  assert.equal(L.conditionTone(undefined), "dim");
});

// HIG: one tone per severity (L.SEVERITY), the same on every surface; see hig.test.js.
test("statusTone: exception level -> severity tone", () => {
  assert.equal(L.statusTone("calm"), "ok");
  assert.equal(L.statusTone("attention"), "attention");
  assert.equal(L.statusTone("security"), "alert");
  assert.equal(L.statusTone("other"), "attention");
});

test("airTone: air-quality state -> tone, matching airWord", () => {
  assert.equal(L.airTone("highest"), "green");
  assert.equal(L.airTone("high"), "green");
  assert.equal(L.airTone("medium"), "yellow");
  assert.equal(L.airTone("low"), "orange");
  assert.equal(L.airTone("lowest"), "red");
  assert.equal(L.airTone("unavailable"), "dim");
  assert.equal(L.airTone(undefined), "dim");
});

test("lockTone: ok when all locked, alert (as on the status line) when any unlocked, dim when unknown", () => {
  assert.equal(L.lockTone(0), "ok");
  assert.equal(L.lockTone(1), "alert");
  assert.equal(L.lockTone(4), "alert");
  assert.equal(L.lockTone(null), "dim");
  assert.equal(L.lockTone(undefined), "dim");
});

test("lightsTone: yellow while any light is on, dim when none", () => {
  assert.equal(L.lightsTone(0), "dim");
  assert.equal(L.lightsTone(5), "yellow");
});

test("doorTone: follows doorWord, by severity", () => {
  assert.equal(L.doorTone("Locked"), "ok");
  for (const w of ["Open", "Unlocked", "Jammed"]) assert.equal(L.doorTone(w), "alert", w);
  assert.equal(L.doorTone("Offline"), "attention");
  assert.equal(L.doorTone("—"), "dim");
});

test("presenceTone, internetTone, modeTone", () => {
  assert.equal(L.presenceTone("Someone home"), "green");
  assert.equal(L.presenceTone("Away"), "dim");
  assert.equal(L.presenceTone("—"), "dim");
  assert.equal(L.internetTone("on"), "ok");
  assert.equal(L.internetTone("off"), "attention"); // as its status line, "Internet down"
  assert.equal(L.internetTone("unavailable"), "dim");
  assert.equal(L.modeTone("heat"), "orange");
  assert.equal(L.modeTone("off"), "dim");
  assert.equal(L.modeTone(undefined), "dim");
});
