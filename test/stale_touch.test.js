// Run: npm test
// Stale-touch tolerance (dist/mashrabiya-logic.js, mashrabiya-card.js). The IR frame can report a pointer
// that goes down and never comes up (something blocking the beams): a stuck ghost. Chromium keeps it as
// the primary pointer, so every real touch after it arrives with isPrimary === false, and the card used
// to read every such touch as multi-touch (no tap, no swipe) until the ghost cleared. Now a non-primary
// pointer counts as primary when every other pointer still down has been silent for L.TOUCH.staleMs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

test("TOUCH.staleMs: long enough for a resting finger, short enough to recover from a ghost", () => {
  const s = L.TOUCH.staleMs;
  assert.equal(typeof s, "number");
  assert.ok(s >= 1000 && s <= 3000, s);
});

test("treatAsPrimary: a primary pointer is always primary", () => {
  assert.equal(L.treatAsPrimary(true, [], 5000, 1500), true);
  assert.equal(L.treatAsPrimary(true, [4999], 5000, 1500), true); // a live other never demotes the primary
  assert.equal(L.treatAsPrimary(undefined, [4999], 5000, 1500), true); // no isPrimary (old events): as before
});

test("treatAsPrimary: non-primary with no other tracked pointer counts as primary", () => {
  // The ghost went down before the card listened (or was cleared on hide): nothing the card knows is live.
  assert.equal(L.treatAsPrimary(false, [], 5000, 1500), true);
  assert.equal(L.treatAsPrimary(false, undefined, 5000, 1500), true);
});

test("treatAsPrimary: non-primary with every other pointer stale counts as primary", () => {
  assert.equal(L.treatAsPrimary(false, [0], 5000, 1500), true);
  assert.equal(L.treatAsPrimary(false, [0, 1000, 3000], 5000, 1500), true);
});

test("treatAsPrimary: non-primary with one live other stays multi-touch", () => {
  assert.equal(L.treatAsPrimary(false, [4900], 5000, 1500), false);
  assert.equal(L.treatAsPrimary(false, [0, 4900], 5000, 1500), false); // one stale, one live: still multi-touch
});

test("treatAsPrimary: the boundary is inclusive at staleMs", () => {
  assert.equal(L.treatAsPrimary(false, [3500], 5000, 1500), true); // exactly staleMs silent: stale
  assert.equal(L.treatAsPrimary(false, [3501], 5000, 1500), false); // 1 ms short: live
});

test("treatAsPrimary: an unreadable timestamp is not evidence of a live finger", () => {
  assert.equal(L.treatAsPrimary(false, [NaN], 5000, 1500), true);
  assert.equal(L.treatAsPrimary(false, [NaN, 4900], 5000, 1500), false);
});

test("staleIds: lists the tracked pointers silent for at least staleMs", () => {
  const m = new Map([[1, 0], [2, 4900], [3, 3500]]);
  assert.deepEqual(L.staleIds(m, 5000, 1500), [1, 3]);
  assert.deepEqual(L.staleIds(new Map(), 5000, 1500), []);
  assert.deepEqual(L.staleIds(undefined, 5000, 1500), []);
});

// --- the card goes through it (source checks; the DOM side was driven in headless Chrome) ----------
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");
const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  const j = CARD.indexOf("\n  }\n", i);
  return CARD.slice(i, j);
};

test("card: isPrimary is read only in _primary (through L.treatAsPrimary) and _promoted (which defers to it)", () => {
  const src = method("_primary");
  assert.match(src, /L\.treatAsPrimary\(/);
  assert.match(src, /L\.TOUCH\.staleMs/);
  const promoted = method("_promoted");
  assert.match(promoted, /this\._primary\(e\)/);
  const outside = CARD.replace(src, "").replace(promoted, "");
  assert.doesNotMatch(outside, /isPrimary/, "isPrimary read outside _primary / _promoted");
});

test("card: _gestureDown and _ripple decide through _primary", () => {
  assert.match(method("_gestureDown"), /this\._primary\(e\)/);
  assert.match(method("_ripple"), /this\._primary\(e\)/);
});

test("card: a button press ripples through _ripple (and so _primary)", () => {
  const src = method("_bind");
  assert.match(src, /addEventListener\("pointerdown"[\s\S]*this\._ripple\(b, e\)/);
});

test("card: live pointers are tracked from capture-phase listeners on the shadow root", () => {
  for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
    assert.match(CARD, new RegExp(`shadowRoot\\.addEventListener\\("${t}", [^\\n]*_trackPointer[^\\n]*, true\\)`), t);
  }
  const src = method("_trackPointer");
  assert.match(src, /this\._pointers\.set\(/);
  assert.match(src, /this\._pointers\.delete\(/);
  assert.match(CARD, /visibilitychange/);
});

test("card: promoting a pointer drops the stale ones, releases a stuck press and a stuck drag", () => {
  const src = method("_gestureDown");
  assert.match(src, /L\.staleIds\(/);
  assert.match(src, /this\._releasePressed\(\)/);
  assert.match(src, /this\._dragSpringBack\(\)/);
});

test("card: a promoted pointer's tap activates its button (Chromium sends no click for a non-primary touch)", () => {
  const down = method("_gestureDown");
  assert.match(down, /promoted/);
  const up = method("_gestureUp");
  assert.match(up, /g\.promoted/);
  assert.match(up, /this\._activate\(/);
  assert.match(up, /_suppressClick/);
});
