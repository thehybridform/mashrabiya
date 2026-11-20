// Run: npm test
// Sleep (dist/mashrabiya-logic.js, mashrabiya-card.js). After sleep_timeout seconds with no touch (and no
// motion on a wake entity) the card goes dark: mirror mode, but with no mirror_timeout, so it stays dark
// until woken. A wake entity turning on (a motion or presence sensor), a three-finger swipe, a double
// tap, or a new door alert wakes it. A wake entity that is on keeps it awake. Motion never ends mirror
// mode someone asked for by hand (they are standing in front of it). Off by default (sleep_timeout 0).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");

test("resolveConfig: sleep_timeout off by default; a positive number of seconds turns it on", () => {
  assert.equal(L.resolveConfig({}, null).sleep_timeout, 0);
  assert.equal(L.resolveConfig({ sleep_timeout: 300 }, null).sleep_timeout, 300);
  for (const bad of [0, -5, "x", NaN, null, Infinity, "300"]) assert.equal(L.resolveConfig({ sleep_timeout: bad }, null).sleep_timeout, 0, String(bad));
});

test("resolveConfig: wake_entities takes one entity id or a list; none by default", () => {
  assert.deepEqual(L.resolveConfig({}, null).wake_entities, []);
  assert.deepEqual(L.resolveConfig({ wake_entities: "binary_sensor.a" }, null).wake_entities, ["binary_sensor.a"]);
  assert.deepEqual(L.resolveConfig({ wake_entities: ["binary_sensor.a", "", 3, "binary_sensor.b"] }, null).wake_entities, ["binary_sensor.a", "binary_sensor.b"]);
});

test("sleepDue: once the timeout has passed since the last activity", () => {
  assert.equal(L.sleepDue(0, 299999, 300), false);
  assert.equal(L.sleepDue(0, 300000, 300), true);
  assert.equal(L.sleepDue(1000, 5000, 0), false); // off
  assert.equal(L.sleepDue(NaN, 5e9, 300), false); // no known activity time: never
  assert.equal(L.sleepDue(0, NaN, 300), false);
});

test("wakeOn: any wake entity reading on", () => {
  const s = { "binary_sensor.a": { state: "off" }, "binary_sensor.b": { state: "on" } };
  assert.equal(L.wakeOn(s, ["binary_sensor.a"]), false);
  assert.equal(L.wakeOn(s, ["binary_sensor.a", "binary_sensor.b"]), true);
  assert.equal(L.wakeOn(s, ["binary_sensor.missing"]), false);
  assert.equal(L.wakeOn(s, []), false);
  assert.equal(L.wakeOn(null, ["binary_sensor.b"]), false);
});

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};

test("card: every second, _tick checks for sleep before its once-a-minute early return", () => {
  const t = method("_tick");
  assert.ok(t.indexOf("_sleepCheck(") >= 0 && t.indexOf("_sleepCheck(") < t.indexOf("return;"), "_sleepCheck must run on every tick");
  const m = method("_sleepCheck");
  assert.match(m, /L\.sleepDue\(/);
  assert.match(m, /L\.wakeOn\(/);
  assert.match(m, /this\._mirror/); // never while already dark
  assert.match(m, /_mirrorEnter\(true\)/);
});

test("card: asleep has no mirror_timeout; the hand-asked mirror mode keeps it", () => {
  const m = method("_mirrorEnter");
  assert.match(m, /_mirrorEnter\(sleep\)|_mirrorEnter\(sleep = false\)/);
  assert.match(m, /this\._asleep = /);
  assert.match(m, /if \(!sleep\)[^\n]*\n?[^\n]*_mirrorTimer = setTimeout/);
});

test("card: a wake entity turning on wakes it only when asleep, and keeps it awake while on", () => {
  const m = method("_syncWake");
  assert.match(m, /L\.wakeOn\(/);
  assert.match(m, /this\._asleep/);
  assert.match(m, /_mirrorExit\(false\)/);
  assert.match(m, /this\._lastActive = /);
  assert.match(method("set hass"), /_syncWake\(\)/);
});

test("card: any touch counts as activity; leaving mirror mode restarts the count", () => {
  assert.match(method("_gestureDown"), /this\._lastActive = Date\.now\(\)/);
  assert.match(method("_mirrorExit"), /this\._lastActive = Date\.now\(\)/);
  assert.match(method("_mirrorExit"), /this\._asleep = false/);
});
