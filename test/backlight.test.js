// Run: npm test
// Backlight off while asleep (dist/mashrabiya-logic.js, mashrabiya-card.js). A black veil leaves the
// LCD backlight on; with display_power_url set, the card asks a helper on the kiosk host
// (kiosk/display_power.py: POST /off, POST /on) to power the screen off when it sleeps and on
// when it wakes, and on whenever the card connects, so a reload never leaves the glass dark.
// Every dark screen powers off, however it went dark (sleep, a three-finger swipe, a double tap):
// once the veil has faded in, so the fade is still seen; leaving powers it on at once.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");

test("resolveConfig: display_power_url unset by default, trailing slashes dropped", () => {
  assert.equal(L.resolveConfig({}, null).display_power_url, null);
  assert.equal(L.resolveConfig({ display_power_url: "http://127.0.0.1:8765" }, null).display_power_url, "http://127.0.0.1:8765");
  assert.equal(L.resolveConfig({ display_power_url: "http://127.0.0.1:8765//" }, null).display_power_url, "http://127.0.0.1:8765");
  assert.equal(L.resolveConfig({ display_power_url: "" }, null).display_power_url, null);
  assert.equal(L.resolveConfig({ display_power_url: 5 }, null).display_power_url, null);
});

test("displayPowerUrl: the helper's /on or /off, or nothing without a base", () => {
  assert.equal(L.displayPowerUrl("http://127.0.0.1:8765", true), "http://127.0.0.1:8765/on");
  assert.equal(L.displayPowerUrl("http://127.0.0.1:8765", false), "http://127.0.0.1:8765/off");
  assert.equal(L.displayPowerUrl(null, true), null);
});

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};

test("card: _displayPower posts fire-and-forget and never throws", () => {
  const m = method("_displayPower");
  assert.match(m, /L\.displayPowerUrl\(/);
  assert.match(m, /method: "POST"/);
  assert.match(m, /mode: "no-cors"/);
  assert.match(m, /\.catch\(/);
});

test("card: going dark, by any route, powers the screen off once the veil has faded in", () => {
  const m = method("_mirrorEnter");
  assert.doesNotMatch(m, /if \(sleep\) this\._displayPower/);
  assert.match(m, /\.finished\.then\(/);
  assert.match(m, /this\._mirror && this\._veilAnim === \w+\) this\._displayPower\(false\)/);
});

test("card: leaving mirror mode, by any route, powers the screen on at once", () => {
  assert.match(method("_mirrorExit"), /this\._displayPower\(true\)/);
});

test("card: connecting powers the screen on (a reload never leaves it dark)", () => {
  assert.match(method("connectedCallback"), /this\._displayPower\(true\)/);
});
