// Run: npm test
// The More page as instruments (docs/DESIGN.md "The More page"): one row of large padlocks for the
// doors, the room pages' arc gauge for the thermostat with − and + either side, one row of scene glyphs,
// the media equaliser with a larger title, and the House line; sections size to their content. Pure layout
// helpers, plus source wiring checks (the card is a browser module, so its DOM work is checked as source).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dir = path.join(__dirname, "..", "dist");
const SRC = path.join(dir, "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(dir, "mashrabiya-card.js"), "utf8");
const DESIGN = fs.readFileSync(path.join(__dirname, "..", "docs", "DESIGN.md"), "utf8");

const method = (name) => {
  const i = CARD.indexOf(`\n  ${name}(`);
  assert.ok(i >= 0, `${name} not found`);
  return CARD.slice(i, CARD.indexOf("\n  }\n", i));
};
const STYLE = CARD.match(/const STYLE = `([\s\S]*?)`;\n/)[1];
const TEMPLATE = CARD.match(/const TEMPLATE = `([\s\S]*?)`;\n/)[1];
const MORE = TEMPLATE.split('<div class="page more', 2)[1].split('<div class="pager"', 1)[0];
const rule = (sel) => {
  const i = STYLE.indexOf(`\n${sel} {`);
  assert.ok(i >= 0, `CSS rule ${sel} not found`);
  return STYLE.slice(i, STYLE.indexOf("}", i));
};

// --- pure layout ----------------------------------------------------------------------------------
test("rowColumns: one row up to the maximum", () => {
  for (let n = 1; n <= 5; n++) assert.equal(L.rowColumns(n, 5), n, String(n));
  for (let n = 1; n <= 4; n++) assert.equal(L.rowColumns(n, 4), n, String(n));
});

test("rowSplit: beyond the maximum, the fewest rows, filled evenly (no orphan on a row of its own)", () => {
  for (const max of [3, 4, 5]) { // from three across an orphan never has to happen
    for (let n = max + 1; n <= 13; n++) {
      const r = L.rowSplit(n, max);
      assert.equal(r.length, Math.ceil(n / max), `${n}/${max}: fewest rows`);
      assert.equal(r.reduce((a, b) => a + b, 0), n, `${n}/${max}: every item placed`);
      assert.ok(Math.max(...r) <= max, `${n}/${max}: ${r}`);
      assert.ok(Math.max(...r) - Math.min(...r) <= 1, `${n}/${max}: uneven ${r}`);
      assert.ok(Math.min(...r) >= 2, `${n}/${max}: orphan in ${r}`);
      assert.deepEqual(r, [...r].sort((a, b) => b - a), `${n}/${max}: longer rows first`);
      assert.equal(L.rowColumns(n, max), r[0], "the widest row sets the columns");
    }
  }
  assert.deepEqual(L.rowSplit(5, 4), [3, 2]);
  assert.deepEqual(L.rowSplit(6, 5), [3, 3]);
  assert.deepEqual(L.rowSplit(7, 3), [3, 2, 2]);
  assert.deepEqual(L.rowSplit(4, 4), [4]);
});

test("rowColumns: nothing, junk and a bad maximum give one column", () => {
  for (const [n, max] of [[0, 4], [-1, 4], [NaN, 4], ["4", 4], [3, 0], [3, NaN], [3, undefined]]) {
    assert.equal(L.rowColumns(n, max), 1, `${n}/${max}`);
    assert.deepEqual(L.rowSplit(n, max), [1], `${n}/${max}`);
  }
});

test("moreColumns: the house fits one row (4 doors, 5 scenes); the demo house 3 and 3", () => {
  assert.equal(L.moreColumns("doors", 4, 1), 4);
  assert.equal(L.moreColumns("doors", 3, 1), 3);
  assert.equal(L.moreColumns("scenes", 5, 1), 5);
  assert.equal(L.moreColumns("scenes", 3, 1), 3);
  assert.deepEqual(L.moreRows("doors", 5, 1), [3, 2]);
  assert.deepEqual(L.moreRows("scenes", 6, 1), [3, 3]);
});

test("moreColumns: large text (over TWO_COLUMN_MAX_SCALE) takes fewer across, still evenly", () => {
  const big = L.TWO_COLUMN_MAX_SCALE + 0.25;
  assert.ok(L.moreColumns("doors", 4, big) < 4);
  assert.ok(L.moreColumns("scenes", 5, big) < 5);
  for (let n = 2; n <= 8; n++) {
    for (const kind of ["doors", "scenes"]) {
      const r = L.moreRows(kind, n, big);
      assert.ok(Math.min(...r) >= 2 || r.length === 1, `${kind} ${n}: ${r}`);
    }
  }
  assert.equal(L.moreColumns("doors", 4, L.TWO_COLUMN_MAX_SCALE), 4, "at the limit itself, still one row");
});

test("doorLabel: the section says Doors, so a door's name drops a trailing Lock and Door", () => {
  assert.equal(L.doorLabel("Front Door Lock"), "Front");
  assert.equal(L.doorLabel("Basement Door"), "Basement");
  assert.equal(L.doorLabel("Back lock"), "Back");
  assert.equal(L.doorLabel("Shop"), "Shop");
  assert.equal(L.doorLabel("Garage Door Lock "), "Garage");
});

test("doorLabel: never empties a name (a lock called just Door or Lock keeps it)", () => {
  assert.equal(L.doorLabel("Door"), "Door");
  assert.equal(L.doorLabel("Door Lock"), "Door");
  assert.equal(L.doorLabel("Lock"), "Lock");
  assert.equal(L.doorLabel(""), "");
  assert.equal(L.doorLabel(undefined), "");
});

// --- the page -----------------------------------------------------------------------------------
test("More: doors are one row of padlock instruments, laid out by moreColumns (not a fixed two-up grid)", () => {
  assert.doesNotMatch(MORE, /class="grid g2 doors"/);
  assert.match(MORE, /class="[^"]*\binst-row\b[^"]*\bdoors\b/);
  const b = method("_buildDetailButtons");
  assert.match(b, /L\.moreRows\("doors", c\.locks\.length, c\.text_scale\)/);
  assert.match(b, /b\.className = "padlock-inst"/);
  // Its name under it, state under that: the label is the door's own (doorLabel).
  assert.match(method("_renderDetail"), /L\.doorLabel\(L\.entityName\(s, b\.dataset\.lock\)\)/);
});

test("More: a padlock tap may only lock (lockOne, lock.lock), and no door control does anything else", () => {
  const b = method("_buildDetailButtons");
  const doors = b.slice(0, b.indexOf("scenes.textContent"));
  assert.deepEqual(doors.match(/dataset\.action = "(\w+)"/g), ['dataset.action = "lockOne"']);
  const act = method("_action");
  const lockOne = act.slice(act.indexOf('case "lockOne":'), act.indexOf('case "scene":'));
  assert.match(lockOne, /h\.callService\('lock', 'lock', \{ entity_id: d\.lock \}\)/);
  assert.doesNotMatch(CARD, /unlock\b['"]/);
});

test("More: the thermostat is the room pages' arc gauge (_gaugeNode / _paintGauge), not a fork of it", () => {
  assert.doesNotMatch(MORE, /class="cur"|class="tgt"/, "the old Inside / Target readouts are gone");
  const t = method("_renderThermo");
  assert.match(t, /this\._gaugeNode\(/);
  assert.match(t, /this\._paintGauge\(/);
  assert.match(t, /kind: "climate"/);
  assert.match(t, /L\.tempScale\(/);
  // One gauge drawing in the whole card.
  assert.equal(CARD.split('viewBox="0 0 120 88"').length - 1, 1);
  // − and + either side of it, and the target readable under it.
  const thermo = MORE.slice(MORE.indexOf('class="thermo-sec'), MORE.indexOf('class="media-sec'));
  const down = thermo.indexOf('data-action="tempDown"'), dial = thermo.indexOf('class="dial"'), up = thermo.indexOf('data-action="tempUp"');
  assert.ok(down >= 0 && dial > down && up > dial, "− dial +");
  assert.match(thermo, />−</, "a real minus sign, not a hyphen");
  assert.match(thermo, /class="target-line"/);
  assert.ok(thermo.indexOf('data-action="modeHeat"') > up, "Heat / Off under the dial");
});

test("More: a target step repaints the dial at once (the pending target), not a text field", () => {
  const act = method("_action");
  const step = act.slice(act.indexOf('case "tempUp":'), act.indexOf('case "modeHeat":'));
  assert.match(step, /this\._renderThermo\(\)/);
  assert.doesNotMatch(step, /this\._el\.tgt\b/);
  assert.match(method("_renderDetail"), /this\._renderThermo\(\)/);
});

test("More: scenes are one row of larger glyphs; Off sits in the heading, so the row never orphans it", () => {
  assert.doesNotMatch(MORE, /class="grid g3 scenes"/);
  assert.match(MORE, /class="[^"]*\binst-row\b[^"]*\bscenes\b/);
  assert.match(MORE, /class="sec-head"[\s\S]*?scenes-title[\s\S]*?class="scenes-off"/);
  const b = method("_buildDetailButtons");
  assert.match(b, /L\.moreRows\("scenes", c\.scenes\.entities\.length, c\.text_scale\)/);
  assert.match(b, /this\._el\.scenesOff/);
});

test("More: Now Playing has the equaliser (animated while playing, a loop), a larger title and play/pause", () => {
  const m = method("_renderMedia");
  assert.match(m, /ic eq loop/);
  assert.match(m, /classList\.toggle\("playing"/);
  assert.match(m, /dataset\.action = "playPause"/);
  assert.match(STYLE, /\.media\.playing \.eq\.loop i \{ animation: eq /);
  const title = rule(".media .title");
  const size = Number(title.match(/font-size: calc\(([\d.]+) \* var\(--tmm\)\)/)[1]);
  assert.ok(size > 9, `title ${size} mm`);
});

test("More: the House line is a little larger than body text", () => {
  const size = Number(rule(".facts").match(/font-size: calc\(([\d.]+) \* var\(--tmm\)\)/)[1]);
  assert.ok(size > 9 && size <= 13, String(size));
});

test("More: sections size to their content (no space-between spreading them over the glass)", () => {
  const p = rule(".panes");
  assert.doesNotMatch(p, /space-between/);
  assert.match(p, /justify-content: flex-start/);
});

test("More: every instrument is in a staggered block, so the entrance picks it up", () => {
  for (const sec of ["doors-sec", "scenes-sec", "thermo-sec", "media-sec", "house-sec"]) {
    assert.match(MORE, new RegExp(`<section class="${sec} brk"[^>]* data-stagger`), sec);
  }
  // The gauge settles, the padlocks and scene glyphs (button svg) pop and draw, the equaliser (.ic) pops.
  assert.match(method("_settleIn"), /querySelectorAll\("\.gauge"\)/);
  const draw = method("_drawIn");
  assert.match(draw, /"\.ic, button svg, \.vial svg"/);
  assert.match(draw, /"\.draw, \.gi \.m"/);
  // The dial is painted before the page is seen, so the settle has its fraction (_f).
  assert.match(method("_preparePage"), /this\._renderDetail\(\)/);
});

test("More: every target is at least the detail-page minimum (15 mm) and text keeps the 9 mm floor", () => {
  const mm = (r, prop) => Number((r.match(new RegExp(`${prop}: calc\\(([\\d.]+) \\* var\\(--t?mm\\)\\)`)) || [])[1]);
  assert.ok(mm(rule(".padlock-inst"), "min-height") >= 15);
  assert.ok(mm(rule(".scene-inst"), "min-height") >= 15);
  assert.ok(mm(rule(".thermo .step"), "width") >= 15 && mm(rule(".thermo .step"), "height") >= 15);
  assert.ok(mm(rule(".scenes-off"), "min-height") >= 15);
});

test("DESIGN.md describes the More page as instruments", () => {
  assert.match(DESIGN, /## The More page/);
  for (const w of ["padlock", "rowSplit", "moreRows", "arc gauge", "equaliser"]) assert.match(DESIGN, new RegExp(w), w);
});

test("More: an Unlocked / Jammed door word (sub.sec) is not drawn as the ticker's 2 px divider", () => {
  // Found while rendering this page: the ticker's unscoped `.sec` rule (width 2px, a gradient bar) also
  // matched a door's `.sub.sec`, so "Unlocked" was laid out 2 px wide, off centre, behind a stray bar.
  assert.doesNotMatch(STYLE, /\n\.sec \{/);
  assert.match(STYLE, /\n\.ticker \.sec \{ display: inline-block; flex: none; width: 2px;/);
});
