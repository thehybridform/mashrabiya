// Run: npm test
// Drag-follow on the mirror card (dist/mashrabiya-logic.js): once a horizontal drag passes the slop,
// the page moves with the finger and the neighbour it is uncovering comes along beside it. On release the
// move commits (a quarter of the page, or a recognised swipe) or springs back. These are the pure parts.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const W = 1440;
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= (eps || 1e-9), `${a} != ${b}`);

test("DRAG: commit at a quarter of the page, settle within the slide / spring budgets, 60 % parallax", () => {
  assert.equal(L.DRAG.commitFrac, 0.25);
  assert.ok(L.DRAG.commitMaxMs <= 320 && L.DRAG.commitMaxMs === L.MOTION.slideMs, L.DRAG.commitMaxMs);
  assert.ok(L.DRAG.springMaxMs <= 250, L.DRAG.springMaxMs);
  assert.ok(L.DRAG.minMs > 0 && L.DRAG.minMs <= L.DRAG.springMaxMs, L.DRAG.minMs);
  assert.equal(L.DRAG.depth, 0.6);
});

test("dragNeighbour: finger left uncovers the NEXT page (on the right), finger right the previous", () => {
  assert.equal(L.dragNeighbour(-1), "next");
  assert.equal(L.dragNeighbour(-500), "next");
  assert.equal(L.dragNeighbour(1), "prev");
  assert.equal(L.dragNeighbour(0), null);
  assert.equal(L.dragNeighbour(NaN), null);
  assert.equal(L.dragNeighbour(undefined), null);
});

test("dragDecision: a quarter of the page commits, less springs back", () => {
  assert.equal(L.dragDecision(-W * 0.25, W, null), "next");
  assert.equal(L.dragDecision(-W * 0.25 + 1, W, null), "stay");
  assert.equal(L.dragDecision(W * 0.25, W, null), "prev");
  assert.equal(L.dragDecision(W * 0.25 - 1, W, null), "stay");
  assert.equal(L.dragDecision(-W, W, null), "next");
  assert.equal(L.dragDecision(0, W, null), "stay");
});

test("dragDecision: a recognised (fast) swipe commits even when short", () => {
  assert.equal(L.dragDecision(-200, W, "left"), "next");
  assert.equal(L.dragDecision(200, W, "right"), "prev");
  // A classification that disagrees with where the finger ended is ignored (cannot come from one gesture).
  assert.equal(L.dragDecision(200, W, "left"), "stay");
  assert.equal(L.dragDecision(-200, W, "up"), "stay");
});

test("dragDecision: bad input stays put", () => {
  assert.equal(L.dragDecision(NaN, W, "left"), "stay");
  assert.equal(L.dragDecision(-W, 0, null), "stay");
  assert.equal(L.dragDecision(-W, NaN, null), "stay");
  assert.equal(L.dragDecision(undefined, W, null), "stay");
});

test("dragOffsets: dragging left, the current page follows 1:1 and the next page sits flush on its right", () => {
  const o = L.dragOffsets(-300, W);
  assert.equal(o.cur, -300);
  assert.equal(o.nb, W - 300);
  // Chrome (edge rails) travels at 60 % of its page: the layer's own offset inside the page.
  near(o.cur + o.curChrome, 0.6 * o.cur);
  near(o.nb + o.nbChrome, 0.6 * o.nb);
  // The wipe line on the seam: the current page's right edge, in % of the screen.
  near(o.seam, ((W - 300) / W) * 100);
});

test("dragOffsets: dragging right, the previous page sits flush on the left", () => {
  const o = L.dragOffsets(300, W);
  assert.equal(o.cur, 300);
  assert.equal(o.nb, 300 - W);
  near(o.cur + o.curChrome, 0.6 * o.cur);
  near(o.nb + o.nbChrome, 0.6 * o.nb);
  near(o.seam, (300 / W) * 100);
});

test("dragOffsets: matches where slideFrames resumes, so a commit has no jump", () => {
  for (const dx of [-360, 360, -1000]) {
    const o = L.dragOffsets(dx, W);
    const dir = dx < 0 ? "left" : "right";
    const f = L.slideFrames(dir, Math.abs(dx) / W);
    near((o.cur / W) * 100, f.out[0]);
    near((o.nb / W) * 100, f.in[0]);
    near(o.seam, L.wipeFrames(dir, Math.abs(dx) / W)[0]);
    const c = L.chromeFrames(dir, 0.6, Math.abs(dx) / W);
    near((o.curChrome / W) * 100, c.out[0]);
    near((o.nbChrome / W) * 100, c.in[0]);
  }
});

test("dragOffsets: clamped to one page, no neighbour at rest, safe on bad input", () => {
  assert.equal(L.dragOffsets(-5000, W).cur, -W);
  assert.equal(L.dragOffsets(-5000, W).nb, 0);
  const z = L.dragOffsets(0, W);
  assert.equal(z.cur, 0);
  assert.equal(z.nb, null);
  assert.equal(L.dragOffsets(NaN, W), null);
  assert.equal(L.dragOffsets(-100, 0), null);
  for (const v of Object.values(L.dragOffsets(0, W))) assert.ok(!Object.is(v, -0), "never -0");
});

test("settleMs: scaled to the distance left, within the budget, never a jarring snap", () => {
  const D = L.DRAG;
  // Commit: the rest of the page.
  assert.equal(L.settleMs(W, W, D.commitMaxMs), D.commitMaxMs);
  assert.equal(L.settleMs(W * 0.5, W, D.commitMaxMs), Math.round(D.commitMaxMs * 0.5));
  assert.equal(L.settleMs(W * 2, W, D.commitMaxMs), D.commitMaxMs);
  assert.equal(L.settleMs(1, W, D.commitMaxMs), D.minMs);
  // Spring back: measured against the commit threshold (the farthest a spring-back can start).
  assert.equal(L.settleMs(W * 0.25, W * 0.25, D.springMaxMs), D.springMaxMs);
  assert.ok(L.settleMs(W * 0.1, W * 0.25, D.springMaxMs) < D.springMaxMs);
  assert.equal(L.settleMs(NaN, W, D.springMaxMs), D.minMs);
  assert.equal(L.settleMs(10, 0, D.springMaxMs), D.springMaxMs);
});

// The card wires these in (source checks; the DOM side was driven in a browser).
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");
const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  const j = CARD.indexOf("\n  }\n", i);
  return CARD.slice(i, j);
};

// HIG: the edge names became Previous (left) and Next (right) buttons labelled by _paintNav.
test("card: Previous sits on the left and Next on the right, each named for its page (L.navTargets)", () => {
  const src = method("_paintNav");
  assert.match(src, /L\.navTargets\(/);
  assert.match(CARD, /\n\.nav\.prev \{[^}]*left:/);
  assert.match(CARD, /\n\.nav\.next, \.rooms-btn \{[^}]*right:/);
});

test("card: drag-follow uses the pure helpers and never reads layout per move", () => {
  const move = method("_gestureMove");
  assert.match(CARD, /L\.dragOffsets\(/);
  assert.match(CARD, /L\.dragDecision\(/);
  assert.match(CARD, /L\.settleMs\(/);
  for (const bad of ["getBoundingClientRect", "getComputedStyle", "offsetWidth", "clientWidth", "_mmPx()"]) {
    assert.ok(!move.includes(bad), `_gestureMove reads layout: ${bad}`);
  }
});
