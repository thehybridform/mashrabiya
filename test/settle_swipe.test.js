// Run: npm test
// Settle in on a swipe (docs/DESIGN.md, "Entrance budget" and "Page move extras"): the page a drag
// uncovers plays its entrance (stagger, draw-in, settle, roll, track-in) as the finger brings it in, in
// fade and slide modes alike. A reversal swaps it for the other neighbour's; a spring-back cancels it
// (the page is left at its true values); a commit lets it run on, never a second entrance. Source checks.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "dist");
const CARD = fs.readFileSync(path.join(dir, "mashrabiya-card.js"), "utf8");
const DESIGN = fs.readFileSync(path.join(__dirname, "..", "docs", "DESIGN.md"), "utf8");
const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};

test("card: one entrance builder (stagger, draw-in, settle) shared by navigation and drags", () => {
  const e = method("_entrance");
  assert.match(e, /this\._stagger\(el\)/);
  assert.match(e, /this\._drawIn\(el\)/);
  assert.match(e, /this\._settleIn\(el\)/);
  assert.match(method("_enter"), /this\._entrance\(toEl\)/);
});

test("card: a drag starts the uncovered page's entrance at once, after painting it, in both modes", () => {
  const n = method("_dragNeighbourSet");
  const prep = n.indexOf("this._preparePage(idx)");
  const start = n.indexOf("d.entrance = this._entrance(el)");
  assert.ok(prep >= 0 && start > prep, "entrance must start after the page is painted");
  // Not inside the fade-only branch: slide mode gets it too.
  const fadeIf = n.indexOf("if (this._fade()) {\n      el.style.opacity");
  assert.ok(fadeIf >= 0);
  const fadeEnd = n.indexOf("}", fadeIf);
  assert.ok(start < fadeIf || start > fadeEnd, "entrance must not depend on the fade mode");
});

test("card: a reversal (or the finger back over its start) stops the old neighbour's entrance first", () => {
  const n = method("_dragNeighbourSet");
  const stop = n.indexOf("this._stopEntrance(d)");
  assert.ok(stop >= 0 && stop < n.indexOf("d.side = side"), "the old entrance stops before the neighbour changes");
  const s = method("_stopEntrance");
  assert.match(s, /d\.entrance/);
  assert.match(s, /\.cancel\(\)/);
  assert.match(s, /d\.entrance = null/);
});

test("card: a spring-back cancels the entrance (the page is left at its true values)", () => {
  assert.match(method("_dragSpringBack"), /this\._stopEntrance\(d\)/);
});

test("card: a commit hands the running entrance to the move (cancelled with it if interrupted), no second one", () => {
  const go = method("_go");
  assert.match(go, /d\.nbEl === toEl/);
  assert.match(go, /carried/);
  assert.match(go, /this\._slides = \[outA, inA, \.\.\.outs, \.\.\.carried\]/);
  assert.match(go, /this\._slides = \[outA, inA, wipe, \.\.\.rails, \.\.\.carried\]/);
  // Still exactly one entrance per move: none after a drag commit.
  assert.match(go, /if \(!drag\) this\._enter\(toEl, ft\.inDelayMs\)/);
  assert.match(go, /if \(drag\) return;[^\n]*\n\s*this\._enter\(toEl\);/);
  // A drag handed over to another page (its neighbour vanished) stops its entrance.
  assert.match(go, /this\._stopEntrance\(/);
});

test("card: reduced motion still gets no drag and no entrance", () => {
  assert.match(method("_dragStart"), /if \(this\._reduced\(\)/);
  assert.match(method("_settleIn"), /if \(this\._reduced\(\)\) return \[\]/);
});

test("docs: a drag no longer skips the entrance", () => {
  assert.ok(!/skips the entrance/.test(DESIGN), "DESIGN.md still says a drag skips the entrance");
  assert.ok(!/skips its entrance/.test(CARD), "mashrabiya-card.js still says a drag skips the entrance");
  assert.ok(!/no second entrance\)/.test(CARD.slice(0, 12000)), "header still says a drag has no entrance");
  assert.match(DESIGN, /as the finger brings it in/);
});
