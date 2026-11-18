// Run: npm test
// Detail pages fit the glass (docs/DESIGN.md, "Fitting the page"): a fixed header, a body that
// scrolls between the header and the navigation row (never under it), denser layouts where they are
// safe without going under the 9 mm text floor, and a clear cue when a page still has more below.
// Pure layout decisions from dist/mashrabiya-logic.js, plus the structure parsed out of mashrabiya-card.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");
const tpl = (name) => new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(CARD)[1];
const rule = (sel) => {
  const m = new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(CARD);
  assert.ok(m, `${sel} rule missing`);
  return m[1];
};
const mmOf = (decl, prop) => {
  const m = new RegExp(`(?:^|[;\\s])${prop}: calc\\(([\\d.]+) \\* var\\(--mm\\)\\)`).exec(decl);
  assert.ok(m, `${prop} in ${decl}`);
  return Number(m[1]);
};

// --- pure helpers -----------------------------------------------------------------------------------
test("gridColumns: one column up to two items, two columns from three", () => {
  assert.equal(L.gridColumns(0), 1);
  assert.equal(L.gridColumns(1), 1);
  assert.equal(L.gridColumns(2), 1);
  assert.equal(L.gridColumns(3), 2);
  assert.equal(L.gridColumns(4), 2);
  assert.equal(L.gridColumns(11), 2);
  assert.equal(L.gridColumns(undefined), 1);
  assert.equal(L.gridColumns(NaN), 1);
  // Large text (text_scale over 1.25): half a column would cut names, so one column (the body scrolls).
  assert.equal(L.gridColumns(3, 1.25), 2);
  assert.equal(L.gridColumns(3, 1.3), 1);
  assert.equal(L.gridColumns(4, 2), 1);
  assert.equal(L.gridColumns(4, "junk"), 2);
  assert.equal(L.TWO_COLUMN_MAX_SCALE, 1.25);
  // Diffusers pair up from two.
  assert.equal(L.gridColumns(1, 1, 2), 1);
  assert.equal(L.gridColumns(2, 1, 2), 2);
  assert.equal(L.gridColumns(2, 1.5, 2), 1);
});

test("mediaVisible: playing before paused, at most two by default, the rest counted", () => {
  const a = { key: "a", playing: false }, b = { key: "b", playing: true }, c = { key: "c", playing: true };
  assert.deepEqual(L.mediaVisible([a, b, c]), { shown: [b, c], more: 1 });
  assert.deepEqual(L.mediaVisible([a, b]), { shown: [b, a], more: 0 });
  assert.deepEqual(L.mediaVisible([a, b, c], 1), { shown: [b], more: 2 });
  assert.deepEqual(L.mediaVisible([a, b, c], 5), { shown: [b, c, a], more: 0 });
  assert.deepEqual(L.mediaVisible([]), { shown: [], more: 0 });
  assert.deepEqual(L.mediaVisible(undefined), { shown: [], more: 0 });
  assert.equal(L.MEDIA_MAX, 2);
  assert.equal(L.STRINGS.moreN(1), "+1 more");
});

test("roomChips: a door paired with a lock in the room is said once, by the lock (which says Open)", () => {
  const items = [
    { key: "lock:lock.front", kind: "lock", door: "binary_sensor.front" },
    { key: "occupancy", kind: "occupancy" },
    { key: "door:binary_sensor.front", kind: "door" },
    { key: "door:binary_sensor.window", kind: "door" },
    { key: "light:light.a", kind: "light" },
  ];
  assert.deepEqual(L.roomChips(items).map((i) => i.key), ["lock:lock.front", "occupancy", "door:binary_sensor.window"]);
  // A lock with no paired door hides nothing.
  assert.deepEqual(L.roomChips([{ key: "lock:x", kind: "lock", door: null }, { key: "door:d", kind: "door" }]).map((i) => i.key), ["lock:x", "door:d"]);
  assert.deepEqual(L.roomChips(undefined), []);
});

test("scrollCue: above / below say which edges have more, with a 2 px tolerance", () => {
  assert.deepEqual(L.scrollCue(0, 500, 500), { above: false, below: false });
  assert.deepEqual(L.scrollCue(0, 500, 501), { above: false, below: false });
  assert.deepEqual(L.scrollCue(0, 500, 900), { above: false, below: true });
  assert.deepEqual(L.scrollCue(400, 500, 900), { above: true, below: false });
  assert.deepEqual(L.scrollCue(200, 500, 900), { above: true, below: true });
  assert.deepEqual(L.scrollCue(undefined, undefined, undefined), { above: false, below: false });
});

test("scopeSize: two columns from three scopes; scopes sized to the height left, never wider than a column", () => {
  const aspect = 2 * Math.sin(Math.PI / 3);
  // One scope: the full width when the height allows it.
  const one = L.scopeSize(1, 470, 282, { headMm: 10 });
  assert.equal(one.cols, 1);
  assert.equal(one.rows, 1);
  assert.ok(Math.abs(one.width - 282) < 1e-9, String(one.width));
  // Two stacked: limited by height (470 - 2*(10+3) - 14) / 2 = 209 tall, so 282 wide still fits.
  assert.equal(L.scopeSize(2, 470, 282, { headMm: 10 }).cols, 1);
  // Three and up: two columns.
  for (const n of [3, 4, 5, 6]) assert.equal(L.scopeSize(n, 470, 282, { headMm: 10 }).cols, 2, String(n));
  const five = L.scopeSize(5, 470, 282, { headMm: 10 });
  assert.equal(five.rows, 3);
  assert.ok(five.width <= (282 - 14) / 2 + 1e-9, "never wider than a column");
  // Short on height: the width follows the height left per row.
  const tight = L.scopeSize(5, 250, 282, { headMm: 10 });
  const fieldH = (250 - 3 * (10 + 3) - 2 * 14) / 3;
  assert.ok(Math.abs(tight.width - fieldH * aspect) < 1e-6, `${tight.width} vs ${fieldH * aspect}`);
  // Far too short: a floor, and the page scrolls (never a scope too small to read).
  assert.equal(L.scopeSize(6, 60, 282, { headMm: 10 }).width, L.RADAR.minScopeMm);
  assert.deepEqual(L.scopeSize(0, 470, 282), { cols: 1, rows: 0, width: 0 });
});

// --- the card --------------------------------------------------------------------------------------
test("room and radar pages: a fixed header, then a body that scrolls between it and the navigation row", () => {
  for (const name of ["ROOM_PAGE", "RADAR_PAGE"]) {
    const t = tpl(name);
    assert.match(t, /<div class="room-frame">\s*<div class="room-head"><\/div>\s*<div class="room-body[^"]*"><\/div>\s*<\/div>/, name);
  }
  const frame = rule(".room-frame");
  assert.match(frame, /display: flex/);
  assert.match(frame, /flex-direction: column/);
  const body = rule(".room-body");
  assert.match(body, /overflow-y: auto/);
  assert.match(body, /min-height: 0/);
  assert.doesNotMatch(body, /position: absolute/, "the body is a flex child of the frame, below the header");
  // The room name and the radar title are drawn into the header, not the scrolling body.
  assert.match(CARD, /el\.querySelector\("\.room-head"\)/);
});

test("nothing scrolls under the navigation row or the pager", () => {
  const nav = rule(".nav");
  const navTop = mmOf(rule(".close, .rooms-btn, .nav"), "bottom") + mmOf(nav, "height");
  for (const sel of [".room-frame", ".panes"]) {
    const bottom = mmOf(rule(sel), "bottom");
    assert.ok(bottom >= navTop, `${sel} ends ${bottom} mm from the bottom; the navigation row starts at ${navTop} mm`);
  }
});

test("a page that still has more below says so: a fade at the cut edge and a 'more' hint, never taking touches", () => {
  for (const name of ["ROOM_PAGE", "RADAR_PAGE"]) assert.match(tpl(name), /<span class="more-hint micro" aria-hidden="true" hidden>\$\{T\.moreBelow\}<\/span>/, name);
  const more = tpl("TEMPLATE").split('<div class="page more', 2)[1].split('<div class="pager"', 1)[0];
  assert.match(more, /<span class="more-hint micro" aria-hidden="true" hidden>\$\{T\.moreBelow\}<\/span>/);
  assert.equal(L.STRINGS.moreBelow, "More ▾");
  const hint = rule(".more-hint");
  assert.match(hint, /pointer-events: none/);
  assert.match(hint, /position: absolute/);
  // The fade is shared by every scrolling body (rooms, radar, More).
  assert.match(CARD, /\n\.room-body\.below, \.panes\.below \{[^}]*mask-image/);
  assert.match(CARD, /L\.scrollCue\(/);
});

test("scroll position resets on page entry, More included", () => {
  const prep = /\n  _preparePage\(to\) \{([\s\S]*?)\n  \}\n/.exec(CARD)[1];
  const more = prep.slice(prep.indexOf('kind === "more"'), prep.indexOf('kind === "room" || kind === "radar"'));
  assert.match(more, /scrollTop = 0/);
  assert.match(more, /_scrollCue\(/);
});

test("denser rooms: rows in two columns from three, diffusers side by side, chips on one row, media capped", () => {
  assert.match(CARD, /L\.gridColumns\(/);
  assert.match(CARD, /L\.mediaVisible\(/);
  assert.match(CARD, /L\.roomChips\(/);
  assert.match(CARD, /L\.scopeSize\(/);
  assert.match(CARD, /\n\.rows\[data-cols="2"\] \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(CARD, /\n\.scents\[data-cols="2"\] \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  // Radar: the fixed 72 % for three scopes is gone; scopeSize sets the width.
  assert.doesNotMatch(CARD, /\.radar-grid\[data-n="3"\] \.field/);
  assert.match(rule(".field"), /width: min\(100%, var\(--fw, 100%\)\)/);
});

test("radar: the turning scan is clipped to its field, so it never makes the body scroll (or show 'More')", () => {
  assert.match(rule(".scan-clip"), /overflow: hidden/);
  assert.match(CARD, /clip\.className = "scan-clip"/);
  assert.match(CARD, /clip\.appendChild\(scan\)/);
});
