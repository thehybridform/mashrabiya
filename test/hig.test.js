// Run: npm test
// The Apple HIG alignment of the mirror card (docs/DESIGN.md, "Apple HIG alignment"): one colour
// per severity, legible alert text, decoration kept away from meaning colours, privacy for guests, a
// stale-data state, a calm Main page, no false values on arrival, navigation, contrast and text size.
// Pure logic from dist/mashrabiya-logic.js, plus the colour tokens parsed out of mashrabiya-card.js's CSS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;
const CARD = fs.readFileSync(path.join(__dirname, "..", "dist", "mashrabiya-card.js"), "utf8");

// --- colour maths ------------------------------------------------------------------------------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const c = rgb(hex).map(lin);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const onScreen = (hex) => (luminance(hex) + 0.05) / 0.05;
// The audit's glass estimate (derived, not measured): ~60 % transmission plus a reflected veil of 3 % of
// display white from a lit hall, against black (which shows only the veil).
const throughGlass = (hex) => (0.6 * luminance(hex) + 0.03 + 0.05) / (0.03 + 0.05);
function hsv(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = null;
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0 };
}
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// Custom properties of one CSS block of the card's stylesheet ("--name: #hex"), by its exact selector.
function tokens(selector) {
  const at = CARD.indexOf(`\n${selector} {`);
  assert.ok(at >= 0, `no "${selector} {" block in mashrabiya-card.js`);
  const body = CARD.slice(at, CARD.indexOf("}", at));
  const out = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

// --- 1 and 3: one colour per severity, legible alert text ------------------------------------------
test("severity: one tone per level, everywhere", () => {
  assert.deepEqual(L.SEVERITY, { ok: "ok", attention: "attention", alert: "alert" });
  assert.equal(L.severityOf("calm"), "ok");
  assert.equal(L.severityOf("attention"), "attention");
  assert.equal(L.severityOf("security"), "alert");
  assert.equal(L.severityOf("alert"), "alert");
  assert.equal(L.severityOf("anything else"), "attention");
  for (const level of ["calm", "attention", "security", "alert"]) assert.equal(L.statusTone(level), L.SEVERITY[L.severityOf(level)], level);
});

test("severity: an unlocked lock is the same colour on the status line, the padlock, Lock all and More", () => {
  const unlocked = L.statusTone("security");
  assert.equal(unlocked, "alert");
  assert.equal(L.lockVisual("unlocked").tone, unlocked);
  assert.equal(L.lockVisual("jammed").tone, unlocked);
  assert.equal(L.lockTone(1), unlocked);
  assert.equal(L.lockAggregate({ "lock.a": { state: "unlocked" } }, ["lock.a"]).tone, unlocked);
  assert.equal(L.doorTone("Unlocked"), unlocked);
  assert.equal(L.doorTone("Jammed"), unlocked);
  // Fine is the "ok" tone everywhere.
  assert.equal(L.lockVisual("locked").tone, "ok");
  assert.equal(L.lockTone(0), "ok");
  assert.equal(L.doorTone("Locked"), "ok");
  assert.equal(L.statusTone("calm"), "ok");
  // Offline is attention, as its status line ("... lock offline") is.
  assert.equal(L.lockVisual("unavailable").tone, "attention");
  assert.equal(L.doorTone("Offline"), "attention");
  // An open configured door is the alert, unless door_alert is off.
  assert.equal(L.doorTone("Open"), "alert");
  assert.equal(L.doorTone("Open", false), "attention");
  assert.equal(L.doorTone("—"), "dim");
});

test("severity: internet down and a low scent vial are attention, as on the status line", () => {
  assert.equal(L.internetTone("off"), "attention");
  assert.equal(L.internetTone("on"), "ok");
  assert.equal(L.internetTone("unavailable"), "dim");
  const areas = { hall: { name: "Hall" } };
  const ents = { "binary_sensor.d": { entity_id: "binary_sensor.d", area_id: "hall" } };
  const st = { "binary_sensor.d": { state: "on", attributes: { device_class: "door", friendly_name: "Hall Side" } } };
  assert.equal(L.roomsFromRegistries(areas, {}, ents, st)[0].items[0].tone, "attention");
  const scent = { areaId: "hall", name: "Diffuser", online: true, anyLow: true, running: false, slots: [] };
  const items = L.roomsFromRegistries(areas, {}, ents, st, { scents: [scent] })[0].items;
  assert.equal(items.find((i) => i.kind === "scent").tone, "attention");
});

test("open-door alert: the text is steady; only the marks (ring, chip icon, More's glyph) breathe", () => {
  const day = L.doorAlertMode(1, false, false);
  assert.equal(day.mode, "breathe");
  assert.equal(day.peak, 1);
  assert.equal(day.min, 0.35);
  assert.equal("textMin" in day, false, "alert text never dims");
  // Night dims through the night colour tokens, so the breath itself is the same.
  assert.deepEqual(L.doorAlertMode(1, true, false), day);
  assert.equal(L.doorAlertMode(1, true, true).mode, "steady");
  assert.equal(L.doorAlertMode(0, true, false).mode, "off");
});

test("severity colours: text legible through the glass by day (>= 4.5:1, audit estimate)", () => {
  const day = tokens(":host");
  for (const k of ["ok", "attention", "alert", "alert-text"]) assert.ok(day[k], `--${k} missing from :host`);
  for (const k of ["ok", "attention", "alert-text"]) {
    assert.ok(throughGlass(day[k]) >= 4.5, `--${k} ${day[k]}: ${throughGlass(day[k]).toFixed(2)}:1 through the glass`);
  }
  // The alert text is a lighter red: the same hue family as the alert marks, not orange or pink.
  assert.ok(hueGap(hsv(day["alert-text"]).h, hsv(day.alert).h) <= 10, day["alert-text"]);
  assert.ok(hueGap(hsv(day["alert-text"]).h, hsv(day.attention).h) >= 25, "alert text must not read as attention");
  assert.ok(luminance(day["alert-text"]) > luminance(day.alert));
});

test("severity colours at night: attention and alert keep their hues, dimmed but >= 4.5:1; the rest is amber", () => {
  const day = tokens(":host"), night = tokens(":host(.night)");
  for (const k of ["attention", "alert", "alert-text"]) {
    assert.ok(night[k], `--${k} missing from :host(.night)`);
    assert.ok(hueGap(hsv(night[k]).h, hsv(day[k]).h) <= 6, `${k}: night ${night[k]} keeps the hue of ${day[k]}`);
    assert.ok(luminance(night[k]) < luminance(day[k]), `${k} is dimmer at night`);
  }
  for (const k of ["attention", "alert-text"]) assert.ok(onScreen(night[k]) >= 4.5, `night --${k} ${night[k]}: ${onScreen(night[k]).toFixed(2)}:1`);
  assert.ok(onScreen(night.alert) >= 3, "the alert ring and glyph are graphics: 3:1");
  for (const k of ["ok", "green", "blue", "yellow", "orange", "red", "purple"]) assert.equal(night[k], "#ffb347", `--${k} is amber at night`);
});

// --- 2: decoration colours stay away from meaning colours ----------------------------------------
// Every colour that MEANS something: the tone tokens, the severity tokens and the alert words.
const meaning = () => {
  const day = tokens(":host");
  return ["green", "blue", "yellow", "orange", "red", "purple", "ok", "attention", "alert", "alert-text"].map((k) => {
    assert.ok(day[k], `--${k} missing`);
    return day[k];
  });
};
// A chrome colour either has a hue (saturation >= 0.2) at least 40 degrees from every meaning colour, or is
// a near-neutral tint (saturation < 0.2) that reads as white through the glass.
function assertDecoration(c, where) {
  assert.match(c, /^#[0-9a-f]{6}$/, `${where}: ${c}`);
  assert.ok(onScreen(c) >= 4.5, `${where}: ${c} is ${onScreen(c).toFixed(2)}:1 on black`);
  const { h, s } = hsv(c);
  if (s < 0.2) return;
  for (const m of meaning()) assert.ok(hueGap(h, hsv(m).h) >= 40, `${where}: ${c} (${h.toFixed(0)} deg) is within 40 deg of meaning colour ${m}`);
}
const PAGES = ["main", "more", "radar", "room:living_room", "room:kitchen", "room:office", "room:garage", "room:bathroom", "room:", "nonsense"];

test("decoration: every accent and every page palette is 40 degrees from every meaning colour", () => {
  for (const c of L.ACCENTS) assertDecoration(c, "ACCENTS");
  for (const k of PAGES) for (const c of L.pagePalette(k)) assertDecoration(c, `pagePalette(${k})`);
  for (const k of ["main", "more", "radar"]) assertDecoration(L.pageAccent(k), `pageAccent(${k})`);
  for (const c of L.RADAR.targetColors) assertDecoration(c, "RADAR.targetColors");
  const day = tokens(":host");
  for (const k of ["accent", "accent2", "accent3"]) assertDecoration(day[k], `:host --${k}`);
});

test("decoration: no pinks or reds anywhere in the chrome (Main's #ff6b98 and More's #ff5fd2 are gone)", () => {
  for (const pink of ["#ff6b98", "#ff5fd2"]) {
    assert.equal(CARD.toLowerCase().includes(pink), false, `mashrabiya-card.js still uses ${pink}`);
    assert.equal(fs.readFileSync(SRC, "utf8").toLowerCase().includes(pink), false, `mashrabiya-logic.js still uses ${pink}`);
  }
});

test("decoration: an icon without a tone (More, Home) is drawn in the secondary white, not a hue", () => {
  assert.match(CARD, /button:not\(\[data-tone\]\):not\(\.pressed\) svg \{ color: var\(--fg2\); \}/);
});

// --- 4: privacy for guests ---------------------------------------------------------------------------
const person = (state) => ({ state, attributes: { friendly_name: "Somebody" } });

test("privacy option: auto by default; off and always; YAML's bare off/on (booleans) are understood", () => {
  assert.equal(L.resolveConfig({}, null).privacy, "auto");
  assert.equal(L.resolveConfig({ privacy: "off" }, null).privacy, "off");
  assert.equal(L.resolveConfig({ privacy: "always" }, null).privacy, "always");
  assert.equal(L.resolveConfig({ privacy: false }, null).privacy, "off");
  assert.equal(L.resolveConfig({ privacy: true }, null).privacy, "always");
  assert.equal(L.resolveConfig({ privacy: "sometimes" }, null).privacy, "auto");
});

test("privacyActive: auto hides while the configured person is not home (unknown counts as not home)", () => {
  const cfg = { privacy: "auto", person: "person.a" };
  assert.equal(L.privacyActive(cfg, { "person.a": person("home") }), false);
  for (const s of ["not_home", "Work", "unknown", "unavailable"]) assert.equal(L.privacyActive(cfg, { "person.a": person(s) }), true, s);
  assert.equal(L.privacyActive(cfg, {}), true, "a configured person that does not exist: fail private");
});

test("privacyActive: auto without a configured person looks at every person; none at all means nothing to go on", () => {
  const cfg = { privacy: "auto", person: null };
  assert.equal(L.privacyActive(cfg, { "person.a": person("not_home"), "person.b": person("home") }), false);
  assert.equal(L.privacyActive(cfg, { "person.a": person("not_home"), "person.b": person("unknown") }), true);
  assert.equal(L.privacyActive(cfg, { "light.x": person("on") }), false);
});

test("privacyActive: always and off ignore presence", () => {
  assert.equal(L.privacyActive({ privacy: "always", person: "person.a" }, { "person.a": person("home") }), true);
  assert.equal(L.privacyActive({ privacy: "off", person: "person.a" }, { "person.a": person("not_home") }), false);
  assert.equal(L.privacyActive(L.resolveConfig({}, null), {}), false);
});

test("privacy: the Radar page leaves the loop, even when the pages option lists it", () => {
  const rooms = [{ id: "a" }];
  const radars = [{ prefix: "x" }];
  assert.deepEqual(L.pageKeys(rooms, radars, null, { private: false }), ["main", "more", "radar", "room:a"]);
  assert.deepEqual(L.pageKeys(rooms, radars, null, { private: true }), ["main", "more", "room:a"]);
  assert.deepEqual(L.pageKeys(rooms, radars, ["main", "radar", "rooms"], { private: true }), ["main", "room:a"]);
  assert.deepEqual(L.pageKeys(rooms, radars), ["main", "more", "radar", "room:a"]);
});

test("privacy: room pages show their rooms without occupancy; a room that only had occupancy has no page", () => {
  const areas = { hall: { name: "Hall" }, den: { name: "Den" } };
  const ents = {
    "binary_sensor.hall_motion": { entity_id: "binary_sensor.hall_motion", area_id: "hall" },
    "light.hall": { entity_id: "light.hall", area_id: "hall" },
    "binary_sensor.den_motion": { entity_id: "binary_sensor.den_motion", area_id: "den" },
  };
  const st = {
    "binary_sensor.hall_motion": { state: "on", attributes: { device_class: "occupancy" } },
    "light.hall": { state: "on", attributes: { friendly_name: "Hall" } },
    "binary_sensor.den_motion": { state: "on", attributes: { device_class: "motion" } },
  };
  const open = L.roomsFromRegistries(areas, {}, ents, st, {});
  assert.deepEqual(open.map((r) => r.id).sort(), ["den", "hall"]);
  const priv = L.roomsFromRegistries(areas, {}, ents, st, { private: true });
  assert.deepEqual(priv.map((r) => r.id), ["hall"]);
  assert.equal(priv[0].items.some((i) => i.kind === "occupancy"), false);
});

test("privacy: the card asks privacyActive and passes it to the pages, the rooms and More's presence fact", () => {
  assert.match(CARD, /L\.privacyActive\(/);
  assert.match(CARD, /L\.pageKeys\([^)]*\{ private:/);
  assert.match(CARD, /roomDetails\([^;]*private:/);
  assert.match(CARD, /if \(c\.person && !this\._private\)/);
});

// --- 5: stale data -----------------------------------------------------------------------------------
test("connectionDown: hass.connected false, or the frontend's connection-status event said disconnected", () => {
  assert.equal(L.connectionDown(true, undefined), false);
  assert.equal(L.connectionDown(undefined, undefined), false, "an older frontend without the flag is not down");
  assert.equal(L.connectionDown(false, undefined), true);
  assert.equal(L.connectionDown(undefined, "disconnected"), true);
  assert.equal(L.connectionDown(true, "connected"), false);
});

test("connectionLost: only after the link has been down for the grace period (a quick reconnect never flashes)", () => {
  const g = L.CONNECTION.graceMs;
  assert.ok(g >= 5000 && g <= 30000, g);
  assert.equal(L.connectionLost(null, 1e6), false);
  assert.equal(L.connectionLost(undefined, 1e6), false);
  assert.equal(L.connectionLost(1e6 - g + 1, 1e6), false);
  assert.equal(L.connectionLost(1e6 - g, 1e6), true);
  assert.equal(L.connectionLost(0, 1e6), true);
});

test("statusLines: a lost connection is an attention line first, and suppresses All clear", () => {
  assert.equal(L.STRINGS.connectionLost, "Connection lost");
  assert.deepEqual(L.statusLines([], false), [{ level: "calm", text: "All clear" }]);
  assert.deepEqual(L.statusLines([], true), [{ level: "attention", text: "Connection lost", conn: true }]);
  const one = [{ level: "security", text: "Front unlocked" }];
  assert.deepEqual(L.statusLines(one, false), one);
  assert.deepEqual(L.statusLines(one, true), [{ level: "attention", text: "Connection lost", conn: true }, one[0]]);
  // Still at most three lines: the overflow folds as before, keeping the most severe level it hides.
  const three = [{ level: "security", text: "a" }, { level: "alert", text: "b" }, { level: "attention", text: "c" }];
  const out = L.statusLines(three, true);
  assert.equal(out.length, 3);
  assert.equal(out[0].conn, true);
  assert.deepEqual(out[1], three[0]);
  assert.deepEqual(out[2], { level: "alert", text: "2 more: tap More" });
  assert.deepEqual(L.statusLines(undefined, false), [{ level: "calm", text: "All clear" }]);
});

test("stale data: the card follows hass.connected and the connection-status event, and dims readings", () => {
  assert.match(CARD, /addEventListener\("connection-status"/);
  assert.match(CARD, /removeEventListener\("connection-status"/);
  assert.match(CARD, /L\.statusLines\(/);
  assert.match(CARD, /L\.connectionLost\(/);
  assert.match(CARD, /:host\(\.stale\)[^{]*\{[^}]*opacity:/);
});

// --- 6: a calm Main page ------------------------------------------------------------------------------
test("calm Main: no clock-colon beat, no button shimmer; lightning is rare", () => {
  assert.equal("colonMs" in L.LOOPS, false);
  assert.equal("shimmerMs" in L.LOOPS, false);
  assert.equal(L.shimmerDelays, undefined);
  assert.ok(L.LOOPS.flickerMs >= 30000, L.LOOPS.flickerMs);
  assert.doesNotMatch(CARD, /shim/);
  assert.doesNotMatch(CARD, /@keyframes colon/);
  assert.doesNotMatch(CARD, /class="clock loop"/);
  assert.match(CARD, /\.wx \.bolt \{ animation: flicker \$\{L\.LOOPS\.flickerMs\}ms/);
});

test("calm Main: the headlines change one at a time by default; scrolling is opt-in, never under reduced motion", () => {
  assert.equal(L.resolveConfig({}, null).ticker, "fade");
  assert.equal(L.resolveConfig({ ticker: "scroll" }, null).ticker, "scroll");
  assert.equal(L.resolveConfig({ ticker: "zoom" }, null).ticker, "fade");
  assert.equal(L.tickerMode({ ticker: "fade" }, false), "fade");
  assert.equal(L.tickerMode({ ticker: "scroll" }, false), "scroll");
  assert.equal(L.tickerMode({ ticker: "scroll" }, true), "fade");
  assert.equal(L.tickerMode(undefined, false), "fade");
  assert.match(CARD, /L\.tickerMode\(/);
});

// --- 7: no false values on arrival ---------------------------------------------------------------------
test("no false values: no count from zero, no gauge sweep from zero, no decode scramble on page entry", () => {
  assert.equal(L.countFrom, undefined);
  assert.equal(L.decodeText, undefined);
  assert.equal("decodeMs" in L.MOTION, false);
  for (const gone of ["_countIn", "_sweepIn", "_decodeIn", "_finishDecode", "data-decode", "dataset.decode", "countFrom", "decodeText"]) {
    assert.equal(CARD.includes(gone), false, `mashrabiya-card.js still has ${gone}`);
  }
  // Real changes still animate from the old value to the new one.
  assert.ok(L.valueChange("71°F", "73°F").count);
  assert.match(CARD, /L\.valueChange\(prev, text\)/);
});

test("no false values: the entrance keeps the fade-up, brackets, rails and icon draw-in (no data in them)", () => {
  const enter = CARD.slice(CARD.indexOf("\n  _entrance("), CARD.indexOf("\n  }\n", CARD.indexOf("\n  _entrance(")));
  assert.match(enter, /this\._stagger\(el\)/);
  assert.match(enter, /this\._drawIn\(el\)/);
});

test("no false values: the settle-in keeps every gauge and bar near its real value (settle.test.js)", () => {
  // Arrives short by at most 15 % of the value, overshoots by at most 3 % of full scale; never at zero.
  for (const f of [0.02, 0.1, 0.5, 0.97, 1]) {
    for (const k of L.settleFrames(f)) assert.ok(k > 0 && Math.abs(k - f) <= Math.max(0.15 * f, 0.03) + 1e-12, `${k} for ${f}`);
  }
  const enter = CARD.slice(CARD.indexOf("\n  _entrance("), CARD.indexOf("\n  }\n", CARD.indexOf("\n  _entrance(")));
  assert.match(enter, /this\._settleIn\(el\)/);
});

// --- 8: navigation -------------------------------------------------------------------------------------
const tpl = (name) => {
  const m = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(CARD);
  assert.ok(m, `${name} template missing`);
  return m[1];
};
const actions = (html) => Array.from(html.matchAll(/data-action="(\w+)"/g), (m) => m[1]);

test("navigation words: the way back is Home everywhere; presence no longer says Home", () => {
  assert.equal(L.STRINGS.homePage, "Home");
  assert.equal(L.STRINGS.close, undefined, "no Close: More goes Home like every other page");
  assert.equal(L.STRINGS.main, undefined, "no Main: the first page is called Home");
  assert.equal(L.presenceWord("home"), "Someone home");
  assert.equal(L.presenceWord("not_home"), "Away");
  assert.notEqual(L.presenceWord("home"), L.STRINGS.homePage);
  assert.equal(L.presenceTone(L.presenceWord("home")), "green");
  assert.equal(L.STRINGS.goPrev("Kitchen"), "Previous: Kitchen");
  assert.equal(L.STRINGS.goNext("Radar"), "Next: Radar");
});

test("navTargets: Previous and Next go to the neighbouring pages; never to Home (the Home button does)", () => {
  const keys = ["main", "more", "radar", "room:a", "room:b"];
  assert.deepEqual(L.navTargets(keys, 2), { prev: 1, next: 3 });
  assert.deepEqual(L.navTargets(keys, 1), { prev: null, next: 2 });
  assert.deepEqual(L.navTargets(keys, 4), { prev: 3, next: null });
  assert.deepEqual(L.navTargets(keys, 0), { prev: null, next: null }, "Main has no row at all");
  assert.deepEqual(L.navTargets(["main", "room:a"], 1), { prev: null, next: null });
  assert.deepEqual(L.navTargets([], 0), { prev: null, next: null });
  assert.deepEqual(L.navTargets(undefined, 3), { prev: null, next: null });
});

test("navigation: room and radar pages carry Previous, Home and Next; More carries Rooms and Home", () => {
  for (const name of ["ROOM_PAGE", "RADAR_PAGE"]) {
    const t = tpl(name);
    assert.deepEqual(actions(t), ["prev", "home", "next"], name);
    assert.match(t, /\$\{ICONS\.home\}<span class="label">\$\{T\.homePage\}<\/span>/, name);
    assert.match(t, /aria-label="\$\{T\.homePage\}"/, name);
  }
  const main = tpl("TEMPLATE");
  const more = main.slice(main.indexOf('<div class="page more'), main.indexOf('<div class="pager"'));
  assert.deepEqual(actions(more).slice(-2), ["rooms", "home"]);
  assert.match(more, /\$\{ICONS\.home\}<span class="label">\$\{T\.homePage\}<\/span>/);
  assert.doesNotMatch(CARD, /T\.(main|close)\b/);
  assert.doesNotMatch(CARD, /data-action="close"/);
  assert.doesNotMatch(CARD, /role="dialog"/, "More and the rooms are peer pages, not dialogs");
});

test("navigation: Previous / Next are at least 15 mm tall and labelled with the neighbour's name", () => {
  const rule = /\n\.nav \{([^}]*)\}/.exec(CARD);
  assert.ok(rule, ".nav rule missing");
  const h = /height: calc\(([\d.]+) \* var\(--mm\)\)/.exec(rule[1]);
  assert.ok(h && Number(h[1]) >= 15, rule[1]);
  assert.match(CARD, /T\.goPrev\(/);
  assert.match(CARD, /T\.goNext\(/);
  assert.match(CARD, /L\.navTargets\(/);
});

test("page indicator: bottom centre of detail pages, neutral (no hue), current segment brighter; no edge names", () => {
  const pager = /\n\.pager \{([^}]*)\}/.exec(CARD);
  assert.ok(pager, ".pager rule missing");
  assert.match(pager[1], /bottom:/);
  assert.doesNotMatch(pager[1], /\btop:/);
  assert.match(pager[1], /left: calc\(50% - /);
  const seg = /\n\.ptrack i \{([^}]*)\}/.exec(CARD)[1];
  const on = /\n\.ptrack i\.on \{([^}]*)\}/.exec(CARD)[1];
  for (const r of [seg, on]) assert.doesNotMatch(r, /accent|chrome/, r);
  assert.match(on, /var\(--fg\)/);
  assert.doesNotMatch(CARD, /class="nb /);
});

// --- 9: sharper small labels ----------------------------------------------------------------------------
test("micro-labels: drawn in the secondary white (>= 7:1), not in a page hue at 85 %", () => {
  const fg2 = tokens(":host").fg2;
  assert.ok(fg2, "--fg2 is a plain colour on :host");
  assert.ok(onScreen(fg2) >= 7, `--fg2 ${fg2}: ${onScreen(fg2).toFixed(2)}:1`);
  assert.match(CARD, /\n\.micro \{[^}]*color: var\(--fg2\);/);
  assert.match(CARD, /\nh2\.micro \{[^}]*color: var\(--fg2\);/);
  assert.match(CARD, /\n\.rl \{[^}]*color: var\(--fg2\);/);
  assert.doesNotMatch(CARD, /\n\.micro \{[^}]*chrome/);
});

test("prefers-contrast: more: full white secondary text and heavier strokes", () => {
  const m = /@media \(prefers-contrast: more\) \{([\s\S]*?)\n\}/.exec(CARD);
  assert.ok(m, "no prefers-contrast: more block");
  assert.match(m[1], /--fg2: #ffffff/);
  assert.match(m[1], /--fg: #ffffff/);
  const w = /\.gi \.m \{ stroke-width: ([\d.]+)/.exec(m[1]);
  assert.ok(w && Number(w[1]) >= 2, "glyph strokes at least 2 units");
  assert.match(m[1], /\.brk::before[^{]*\{[^}]*--w:/);
});

// --- 10: text size --------------------------------------------------------------------------------------
test("text_scale: a number from 0.8 to 2, default 1 (clamped, junk ignored)", () => {
  assert.equal(L.resolveConfig({}, null).text_scale, 1);
  assert.equal(L.resolveConfig({ text_scale: 1.5 }, null).text_scale, 1.5);
  assert.equal(L.resolveConfig({ text_scale: 3 }, null).text_scale, 2);
  assert.equal(L.resolveConfig({ text_scale: 0.5 }, null).text_scale, 0.8);
  assert.equal(L.resolveConfig({ text_scale: "big" }, null).text_scale, 1);
  assert.equal(L.resolveConfig({ text_scale: "1.25" }, null).text_scale, 1.25);
});

test("text_scale: icons scale with the text; Main's lower half grows upward; More scrolls", () => {
  for (const sel of ["\\.big svg", "\\.ic", "\\.wx", "\\.close svg, \\.rooms-btn svg, \\.nav svg"]) {
    assert.match(CARD, new RegExp(`\\n${sel} \\{[^}]*width: calc\\([\\d.]+ \\* var\\(--tmm\\)\\)`), sel);
  }
  assert.match(CARD, /\n\.lower \{[^}]*bottom:[^}]*flex-direction: column/);
  assert.match(CARD, /\n\.panes \{[^}]*overflow-y: auto/);
  assert.match(CARD, /kind === "more"[^\n]*\.panes/);
});

test("calm Main: an unlocked padlock does not bob on Main (it still does on detail pages)", () => {
  assert.match(CARD, /\.controls \.padlock\.loop\[data-lock="unlocked"\] \.bob \{ animation: none; \}/);
});
