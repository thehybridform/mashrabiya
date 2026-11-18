// Run: npm test
// Guards on the card SOURCE (dist/*.js) read as text: lock-only, read-only fences, compositor-only
// motion, one scroll owner, no house-specific ids, the minimum text size, and the element registration.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CARD_JS = Object.fromEntries(
  fs.readdirSync(DIST).filter((n) => n.endsWith(".js")).sort().map((n) => [n, fs.readFileSync(path.join(DIST, n), "utf8")]),
);
const CARD = CARD_JS["mashrabiya-card.js"];
const LOGIC = CARD_JS["mashrabiya-logic.js"];
const DESIGN = fs.readFileSync(path.join(ROOT, "docs", "DESIGN.md"), "utf8");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const must = (m, what) => {
  assert.ok(m, `${what} missing`);
  return m;
};
const all = (re, s) => [...s.matchAll(re)];

test("both dist files are present", () => {
  assert.deepEqual(Object.keys(CARD_JS), ["mashrabiya-card.js", "mashrabiya-logic.js"]);
});

// --- lock-only ---------------------------------------------------------------------------------

test("never unlocks", () => {
  // The card may lock only; unlocking stays on an authenticated path (a phone, not a public wall).
  for (const forbidden of ["lock.unlock", "lock.open", "unlock_door"]) {
    for (const [name, src] of Object.entries(CARD_JS)) assert.ok(!src.includes(forbidden), `${name}: ${forbidden}`);
  }
});

test("the card never calls unlock or open services", () => {
  for (const [name, src] of Object.entries(CARD_JS)) {
    for (const s of ["'unlock'", '"unlock"', "'open'"]) assert.ok(!src.includes(s), `${name}: ${s}`);
    for (const m of all(/callService\(\s*['"]lock['"]\s*,\s*['"](\w+)['"]/g, src)) assert.equal(m[1], "lock", name);
  }
  assert.ok(CARD.includes("callService('lock', 'lock'"));
});

// --- read-only fences --------------------------------------------------------------------------

test("navigation actions only navigate", () => {
  // Room and radar pages have Previous / Next beside Home. The read-only fence holds because those
  // three actions only move between pages: their handler calls no service at all.
  const body = must(CARD.match(/\n  _action\(b\) \{([\s\S]*?)\n  \}\n/), "_action")[1];
  const nav = must(body.match(/case "prev":([\s\S]*?)case "lockOne":/), "prev / next / home cases")[1];
  for (const action of ['case "next":', 'case "home":']) assert.ok(nav.includes(action), action);
  assert.ok(nav.includes("this._go("));
  for (const forbidden of ["callService", "call(", "return {"]) assert.ok(!nav.includes(forbidden), forbidden);
});

function readOnlySection(startMarker, endMarker) {
  const re = new RegExp(`// === ${startMarker} ===([\\s\\S]*?)// === ${endMarker} ===`);
  return must(CARD.match(re), `read-only section ${startMarker}`);
}

const NO_CONTROLS = ["callService", "button", "_bind(", "data-action", "dataset.action", "_activate"];

test("room pages are read-only", () => {
  // Each room page shows information only: its template holds the navigation buttons and nothing else,
  // and everything that renders a room page sits in one marked section that never creates buttons,
  // binds actions or calls services.
  const tpl = must(CARD.match(/const ROOM_PAGE = `([\s\S]*?)`;/), "ROOM_PAGE template")[1];
  assert.deepEqual(all(/data-action="(\w+)"/g, tpl).map((m) => m[1]), ["prev", "home", "next"]);
  assert.equal(all(/<button/g, tpl).length, 3);
  const sec = readOnlySection("ROOM PAGES: READ-ONLY", "END ROOM PAGES");
  assert.ok(sec[1].includes("_renderRoomPage("));
  for (const f of NO_CONTROLS) assert.ok(!sec[1].includes(f), f);
  const rest = CARD.replace(sec[0], "");
  assert.doesNotMatch(rest, /\n  _(renderRoomPage|roomContent|gaugeNode|meterNode|rowNode|scentNode|paintScent)\(/);
  assert.ok(!LOGIC.includes("callService"));
});

test("scent is read-only", () => {
  // Diffusers are shown, never driven: no select / switch / number service is called anywhere.
  const sec = readOnlySection("ROOM PAGES: READ-ONLY", "END ROOM PAGES")[1];
  assert.ok(sec.includes("_scentNode("));
  assert.ok(sec.includes("_paintScent("));
  for (const [name, src] of Object.entries(CARD_JS)) {
    assert.ok(!src.includes("select_option"), name);
    for (const m of all(/(?:callService|call)\(\s*['"](\w+)['"]/g, src)) {
      assert.ok(!["select", "switch", "number", "fan", "input_select"].includes(m[1]), `${name}: ${m[1]}`);
    }
  }
});

test("the radar page is read-only", () => {
  const tpl = must(CARD.match(/const RADAR_PAGE = `([\s\S]*?)`;/), "RADAR_PAGE template")[1];
  assert.deepEqual(all(/data-action="(\w+)"/g, tpl).map((m) => m[1]), ["prev", "home", "next"]);
  assert.equal(all(/<button/g, tpl).length, 3);
  const sec = readOnlySection("RADAR PAGE: READ-ONLY", "END RADAR PAGE");
  assert.ok(sec[1].includes("_renderRadar("));
  for (const f of NO_CONTROLS) assert.ok(!sec[1].includes(f), f);
  const rest = CARD.replace(sec[0], "");
  assert.doesNotMatch(rest, /\n  _(renderRadar|radarContent|scopeNode|paintScope)\(/);
});

test("mirror mode veil is opaque black above everything and calls nothing", () => {
  assert.match(CARD, /\.mirror-veil \{[^}]*background: #000[^}]*z-index: 9/);
  assert.ok(CARD.includes("mirror_mode"));
  assert.ok(!CARD.slice(CARD.indexOf("_mirrorEnter("), CARD.indexOf("_mirrorExit(")).includes("callService"));
});

// --- look and motion ---------------------------------------------------------------------------

test("edge rails on detail pages only, never on Main", () => {
  for (const name of ["ROOM_PAGE", "RADAR_PAGE"]) {
    const tpl = must(CARD.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`)), name)[1];
    assert.ok(tpl.includes('class="rails loop"'), name);
  }
  const tpl = must(CARD.match(/const TEMPLATE = `([\s\S]*?)`;/), "TEMPLATE")[1];
  const main = tpl.split('<div class="page main">')[1].split('<div class="page more')[0];
  const more = tpl.split('<div class="page more')[1].split('<div class="pager"')[0];
  assert.ok(!main.includes("rails"));
  assert.ok(more.includes('class="rails loop"'));
});

test("the fps meter is opt-in and never takes touches", () => {
  assert.ok(CARD.includes("debug_fps"));
  assert.ok(CARD.includes("fpsEnabled("));
  const rule = must(CARD.match(/\n\.fps \{([^}]*)\}/), ".fps rule")[1];
  assert.ok(rule.includes("pointer-events: none"));
  assert.match(CARD, /debug_fps: false/);
});

test("Mashrabiya accent per page, amber at night", () => {
  assert.match(CARD, /:host \{[^}]*--accent:/);
  assert.match(CARD, /:host\(\.night\)[^{]*\{[^}]*--accent: #ffb347 !important/);
  assert.match(CARD, /:host\(\.night\)[^{]*\{[^}]*--accent2: #ffb347 !important[^}]*--accent3: #ffb347 !important/);
  assert.ok(CARD.includes("pagePalette("));
});

test("the door alert breathes on its marks, not a screen frame", () => {
  for (const gone of ["alert-frame", "_alertFrame", "this._el.alert", "--alert-red"]) assert.ok(!CARD.includes(gone), gone);
  assert.match(CARD, /:host \{[^}]*--alert: #ff453a/);
  assert.match(CARD, /:host \{[^}]*--alert-text: #/);
  assert.ok(CARD.includes("doorAlertMode("));
  const body = must(CARD.match(/_alertMarks\(m\) \{([\s\S]*?)\n  \}\n/), "_alertMarks")[1];
  for (const t of [".line.alert", "::before", ".chip.alert", ".lk.alert", "min", ".doors button.alert"]) assert.ok(body.includes(t), t);
  for (const steady of ["textMin", '"text"', ".label", ".mv", ".sub"]) assert.ok(!body.includes(steady), steady);
  assert.ok(CARD.includes("_alertT0"));
});

test("night dims decoration but not severity", () => {
  assert.doesNotMatch(CARD, /:host\(\.night\) \.(glance|detail|room-page)\s*[,{]/);
  assert.match(CARD, /\[data-tone="alert"\]\s*\{[^}]*--tone: var\(--alert\)[^}]*--tone-text: var\(--alert-text\)/);
  assert.match(CARD, /\[data-tone="attention"\]\s*\{[^}]*--tone: var\(--attention\)/);
  assert.match(CARD, /\[data-tone="ok"\]\s*\{[^}]*--tone: var\(--ok\)/);
});

test("every icon used exists in the one glyph family", () => {
  const body = CARD.split("const ICONS = {")[1].split("\n};")[0];
  const keys = new Set(all(/^  (\w+): glyph\(/gm, body).map((m) => m[1]));
  assert.ok(keys.size >= 30, [...keys].join());
  assert.equal(all(/^  \w+:/gm, body).length, keys.size, "every icon is built by glyph()");
  const used = new Set();
  for (const m of all(/ICONS\.(\w+)/g, CARD)) used.add(m[1]);
  for (const m of all(/_iconNode\("(\w+)"/g, CARD)) used.add(m[1]);
  for (const m of all(/"(wx[A-Z]\w+)"/g, CARD)) used.add(m[1]);
  for (const m of all(/\bicon: "(\w+)"/g, LOGIC)) if (m[1] !== "lock") used.add(m[1]); // locks draw LOCK_GLYPH
  for (const m of all(/facts\.push\(\[.*, "(\w+)"\]\)/g, CARD)) used.add(m[1]);
  for (const k of ["doorOpen", "windowOpen", "lightOff", "light"]) used.add(k); // swapped in by state
  const missing = [...used].filter((k) => !keys.has(k)).sort();
  assert.deepEqual(missing, [], `missing glyphs: ${missing}`);
  assert.ok(!CARD.includes("ROOM_ICONS"));
  assert.ok(!CARD.includes("const svg ="));
});

test("the touch reticle has four ticks and a ring", () => {
  const m = must(CARD.match(/const RETICLE = `([\s\S]*?)`;/), "RETICLE")[1];
  assert.equal(all(/<line /g, m).length, 4);
  assert.ok(m.includes("<circle"));
});

test("the touch overlay never takes touches", () => {
  const rule = must(CARD.match(/\n\.touch-fx \{([^}]*)\}/), ".touch-fx rule")[1];
  assert.ok(rule.includes("pointer-events: none"));
  assert.ok(CARD.includes('class="touch-fx"'));
});

test("infinite animations are ambient loops", () => {
  // Every endlessly repeating animation hangs off a .loop element (so night stops it), or is the
  // weather glyph or the ticker strip (hidden at night).
  const found = all(/\n([^\n{}@]+)\{([^}]*infinite[^}]*)\}/g, CARD);
  assert.ok(found.length > 0, "no infinite animations found: the extraction is broken");
  for (const [, sel] of found) assert.ok([".loop", ".wx", ".strip"].some((k) => sel.includes(k)), sel);
  for (const cls of ["fan-spin loop", "eq loop", "wisps loop", "rails loop"]) assert.ok(CARD.includes(cls), cls);
});

test("motion is off under reduced motion", () => {
  const m = must(CARD.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/), "reduced-motion block")[1];
  assert.ok(m.includes("animation: none !important"));
  assert.ok(m.includes("transition: none !important"));
  assert.ok(CARD.includes("_reduced()"));
});

test("night has no ambient loops", () => {
  // !important: loop rules such as ".row.on .fan-spin.loop svg" out-specify ":host(.night) .loop *".
  assert.match(CARD, /:host\(\.night\) \.loop[^{]*\{[^}]*animation: none !important/);
});

test("animations stay on the compositor", () => {
  // Raspberry Pi 5: transform / opacity (and SVG stroke) only; no animated filters, blur or shadows.
  const frames = all(/@keyframes [\w-]+ \{([\s\S]*?)\}\s*\}/g, CARD);
  assert.ok(frames.length > 0, "no @keyframes found: the extraction is broken");
  const ok = new Set(["transform", "opacity", "stroke-dashoffset"]);
  for (const [, kf] of frames) {
    for (const [, prop] of all(/([a-z-]+)\s*:/g, kf)) assert.ok(ok.has(prop), `${prop} in ${kf}`);
  }
  for (const bad of ["filter:", "box-shadow:", "backdrop-filter"]) assert.ok(!CARD.includes(bad), bad);
});

test("only one scroll owner", () => {
  // touch-action: none everywhere so horizontal moves always reach the swipe classifier.
  assert.ok(!CARD.includes("pan-y"));
  assert.ok(CARD.includes("touch-action: none"));
});

// --- news ticker -------------------------------------------------------------------------------

test("the ticker band is accessible and inert", () => {
  assert.ok(CARD.includes('role="marquee"'));
  assert.ok(CARD.includes('aria-label="${T.headlines}"'));
  assert.ok(CARD.includes('aria-hidden="true"'));
  assert.match(CARD, /\.ticker \{[^}]*pointer-events: none/);
  assert.ok(CARD.includes("will-change: transform"));
});

test("night hides the ticker", () => {
  assert.match(CARD, /:host\(\.night\) \.ticker \{[^}]*display: none/);
});

test("reduced motion has no ticker scroll; one headline every 8 s", () => {
  const m = must(CARD.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/), "reduced-motion block")[1];
  assert.ok(m.includes("animation: none"));
  assert.ok(CARD.includes("8000"));
});

test("the card ships no feeds", () => {
  // Feeds are configuration (news: [{label, entity, tone}]); the card names none.
  for (const [name, src] of Object.entries(CARD_JS)) assert.doesNotMatch(src, /sensor\.news_\w+/, name);
});

// --- generic: the card names no house ---------------------------------------------------------

// Ids and words a particular house would hard-code. The card ships no defaults for any of them.
// (The real ids of the house it was first built for are in privacy.test.js, which scans every file.)
const HOUSE_LIKE = [
  "lock.entry_door", "binary_sensor.entry_door", "script.leaving", "weather.forecast_home", "sensor.outdoor_temperature", "climate.thermostat", "living_room",
  "homepod", "apple_tv", "HomePod", "Apple TV", "Living room", "America/Los_Angeles",
];

test("the card source contains no house-specific ids or words", () => {
  for (const [name, src] of Object.entries(CARD_JS)) {
    for (const token of HOUSE_LIKE) assert.ok(!src.includes(token), `${name} mentions ${token}`);
  }
});

test("radars are discovered, not hard-coded", () => {
  for (const [name, src] of Object.entries(CARD_JS)) {
    assert.doesNotMatch(src, /(living_room|bathroom|kitchen|bedroom)_presence/, name);
  }
});

test("the card has no default config with entity ids", () => {
  assert.doesNotMatch(CARD, /\b(?:person|script|climate|weather|scene|media_player|light|sensor|binary_sensor)\.[a-z0-9_]+/);
});

test("the logic has no entity ids either", () => {
  assert.doesNotMatch(LOGIC, /["'](?:lock|person|script|climate|weather|scene|media_player|binary_sensor)\.[a-z0-9_]+["']/);
});

test("UI words live in one STRINGS table", () => {
  assert.match(LOGIC, /const STRINGS = \{/);
  assert.ok(must(LOGIC.split("globalThis.MashrabiyaLogic = {")[1], "MashrabiyaLogic export").includes("STRINGS"));
  for (const word of ["Leaving", "Lock all", "Lights off", "All clear", "Failed", "Now playing", "Thermostat"]) {
    assert.ok(!CARD.includes(`>${word}<`), word);
    assert.ok(!CARD.includes(`"${word}"`), word);
  }
});

test("the font is optional", () => {
  assert.ok(CARD.includes("font_url"));
  assert.ok(CARD.includes("system-ui"));
});

// --- text size ----------------------------------------------------------------------------------
// Every text size scales with `text_scale` and none is below the minimum DESIGN.md states: the HIG's
// minimum sizes (iOS 11 pt at ~33 cm, tvOS 23 pt at 8 ft) both come to about 0.33 degrees of em height,
// which is 8.6 mm at 1.5 m. The card rounds that up to 9 mm.

const MIN_MM = 9;
const DERIVED_MIN_MM = 8.6;
// Selectors allowed below the minimum, each with its reason. Keep this list short and justified.
const EXCEPTIONS = {
  ".fps": "the opt-in frame-rate readout for measuring the device, never on in use",
  ".ml sub": "a typographic subscript (PM2.5, CO2), set below its base by convention; the base meets the minimum",
};

function style() {
  const m = must(CARD.match(/const STYLE = `([\s\S]*?)`;\n/), "STYLE");
  return m[1].replace(/\/\*[\s\S]*?\*\//g, ""); // comments are not selectors
}

function fontSizes() {
  const out = [];
  for (const [, sel, body] of all(/([^{}]+)\{([^{}]*)\}/g, style())) {
    for (const [, value] of all(/font-size:\s*([^;]+);/g, body)) out.push([sel.split(/\s+/).filter(Boolean).join(" "), value.trim()]);
  }
  return out;
}

test("text minimum is at least the derived HIG minimum", () => {
  assert.ok(MIN_MM >= DERIVED_MIN_MM);
});

test("the font-size extraction found the stylesheet", () => {
  assert.ok(fontSizes().length >= 25, JSON.stringify(fontSizes()));
});

test("no text below the minimum, and every size scales with text_scale", () => {
  for (const [sel, value] of fontSizes()) {
    if (sel in EXCEPTIONS) continue;
    const m = value.match(/^calc\(([\d.]+) \* var\(--tmm\)\)$/);
    assert.ok(m, `${sel}: font-size ${value} must be calc(<mm> * var(--tmm)) so text_scale reaches it`);
    assert.ok(Number(m[1]) >= MIN_MM, `${sel}: ${value} is below ${MIN_MM} mm`);
  }
});

test("text-size exceptions still exist", () => {
  const sels = new Set(fontSizes().map(([s]) => s));
  for (const sel of Object.keys(EXCEPTIONS)) assert.ok(sels.has(sel), `stale exception ${sel}`);
});

test("text_scale multiplies the text unit", () => {
  assert.match(style(), /:host \{[^}]*--ts: 1;[^}]*--tmm: calc\(var\(--mm\) \* var\(--ts\)\);/);
  const apply = must(CARD.split("\n  _applyConfig() {")[1], "_applyConfig").split("\n  }\n")[0];
  assert.ok(apply.includes("--ts:"));
});

test("DESIGN.md states the minimum the code enforces", () => {
  const stated = all(/text at least (\d+(?:\.\d+)?) mm/g, DESIGN).map((m) => Number(m[1]));
  assert.ok(stated.length > 0, "DESIGN.md states no text minimum");
  for (const s of stated) assert.equal(s, MIN_MM, "DESIGN.md and the code disagree on the minimum text size");
});

// --- packaging ----------------------------------------------------------------------------------

test("the element is mashrabiya-card, with mirror-panel-card kept as a legacy alias", () => {
  assert.match(CARD, /customElements\.define\("mashrabiya-card", MashrabiyaCard\)/);
  assert.match(CARD, /class MirrorPanelCardLegacy extends MashrabiyaCard \{\}/);
  assert.match(CARD, /customElements\.define\("mirror-panel-card", MirrorPanelCardLegacy\)/);
  assert.match(CARD, /window\.customCards\.push\(\{ type: "mashrabiya-card", name: "Mashrabiya",/);
});

test("the card loads its logic file relative to itself, forwarding the ?v= cache-buster", () => {
  assert.ok(CARD.includes('await import(new URL("./mashrabiya-logic.js" + new URL(import.meta.url).search, import.meta.url).href);'));
});

test("the card's version matches package.json", () => {
  const v = must(CARD.match(/const VERSION = "([^"]+)";/), "VERSION")[1];
  assert.equal(v, PKG.version);
});
