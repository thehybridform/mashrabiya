// Run: npm test
// "Mashrabiya", the mirror card's design language (dist/mashrabiya-logic.js): everything is drawn in
// light on the glass. These are its pure parts: per-page accent hues, gradient stops along the gauge
// arcs, tick marks, entrance timing, and the opt-in

// frame-rate meter used to measure the Pi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "dist", "mashrabiya-logic.js");
vm.runInThisContext(fs.readFileSync(SRC, "utf8"), { filename: SRC });
const L = globalThis.MashrabiyaLogic;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// --- colour helpers for the checks -------------------------------------------------------------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const c = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrastOnBlack = (hex) => (luminance(hex) + 0.05) / 0.05;
function hue(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
// The meaning colours (the card's --green --blue --yellow --orange --red --purple).
const MEANING = ["#30d158", "#64d2ff", "#ffd60a", "#ffa214", "#ff453a", "#bf5af2", "#ff9d96"];


// --- accents -----------------------------------------------------------------------------------
// HIG: the gap to the meaning colours is now 40 degrees (was 15), which leaves only two bright families
// (chartreuse ~92 deg, periwinkle ~238 deg); the full check, against the card's tokens, is hig.test.js.
test("ACCENTS: six or more bright hues, legible on black, 40 degrees clear of every meaning colour", () => {
  const A = L.ACCENTS;
  assert.ok(A.length >= 6 && A.length <= 10, A.length);
  assert.equal(new Set(A).size, A.length);
  for (const c of A) {
    assert.match(c, /^#[0-9a-f]{6}$/);
    assert.ok(contrastOnBlack(c) >= 4.5, `${c} contrast ${contrastOnBlack(c)}`);
    for (const m of MEANING) assert.ok(hueGap(hue(c), hue(m)) >= 40, `${c} too close to ${m}`);
  }
});

test("roomAccent: deterministic per area, always from the set, and spread across it", () => {
  assert.equal(L.roomAccent("living_room"), L.roomAccent("living_room"));
  const ids = ["living_room", "kitchen", "bathroom", "bedroom", "guest_bedroom", "office", "studio", "music_room", "garage", "basement"];
  const got = ids.map((id) => L.roomAccent(id));
  for (const c of got) assert.ok(L.ACCENTS.includes(c), c);
  assert.ok(new Set(got).size >= 5, `only ${new Set(got).size} distinct hues for 10 rooms`);
  assert.ok(L.ACCENTS.includes(L.roomAccent("")));
  assert.ok(L.ACCENTS.includes(L.roomAccent(undefined)));
});

test("pageAccent: Main, More and Radar have their own fixed accents; rooms use roomAccent", () => {
  const main = L.pageAccent("main"), more = L.pageAccent("more"), radar = L.pageAccent("radar");
  assert.equal(new Set([main, more, radar]).size, 3);
  for (const c of [main, more, radar]) assert.ok(contrastOnBlack(c) >= 4.5, c);
  assert.equal(L.pageAccent("room:kitchen"), L.roomAccent("kitchen"));
  assert.equal(L.pageAccent("nonsense"), main);
});

test("RADAR.targetColors: three distinct bright colours, one per target", () => {
  const c = L.RADAR.targetColors;
  assert.equal(c.length, 3);
  assert.equal(new Set(c).size, 3);
  for (const x of c) assert.ok(contrastOnBlack(x) >= 4.5, x);
});

// --- gauge gradients and ticks -----------------------------------------------------------------
test("gaugeStops: temperature runs blue -> green (comfort band) -> orange along the scale", () => {
  const g = { min: 50, max: 90, band: [64, 76] };
  const s = L.gaugeStops("temperature", g);
  assert.deepEqual([s[0].tone, s[s.length - 1].tone], ["blue", "orange"]);
  assert.ok(s.some((x) => x.tone === "green"));
  for (let i = 1; i < s.length; i++) assert.ok(s[i].f >= s[i - 1].f, "fractions in order");
  assert.equal(s[0].f, 0);
  assert.equal(s[s.length - 1].f, 1);
  // Green covers the band.
  const greens = s.filter((x) => x.tone === "green").map((x) => x.f);
  assert.ok(Math.min(...greens) <= 0.35 + 0.06 && Math.max(...greens) >= 0.65 - 0.06, greens.join());
});

test("gaugeStops: humidity runs orange -> green -> blue; climate is temperature", () => {
  const s = L.gaugeStops("humidity", { min: 0, max: 100, band: [30, 60] });
  assert.deepEqual([s[0].tone, s[s.length - 1].tone], ["orange", "blue"]);
  assert.ok(s.some((x) => x.tone === "green"));
  const c = L.gaugeStops("climate", { min: 50, max: 90, band: [64, 76] });
  assert.deepEqual(c, L.gaugeStops("temperature", { min: 50, max: 90, band: [64, 76] }));
});

test("gradientOffsets: arc fractions become 0-1 offsets of a left-to-right gradient", () => {
  // The 240 degree arc starts lower-left and ends lower-right: fraction 0.5 is the top (x = centre).
  near(L.gradientOffset(0.5), 0.5, 1e-9);
  assert.ok(L.gradientOffset(0.2) < L.gradientOffset(0.5));
  assert.ok(L.gradientOffset(0.8) > L.gradientOffset(0.5));
  for (const f of [0, 0.1, 0.9, 1]) {
    const o = L.gradientOffset(f);
    assert.ok(o >= 0 && o <= 1, `${f} -> ${o}`);
  }
});

test("arcTicks: n radial ticks spread evenly along the arc, one SVG path", () => {
  const d = L.arcTicks(0, 0, 10, 12, 0, 90, 3);
  const segs = d.trim().split(/(?=M)/);
  assert.equal(segs.length, 3);
  const nums = (s) => s.match(/-?[\d.]+/g).map(Number);
  const [a, b, c] = segs.map(nums);
  near(a[0], 10, 0.01); near(a[1], 0, 0.01); near(a[2], 12, 0.01); near(a[3], 0, 0.01);
  near(b[0], 10 * Math.cos(Math.PI / 4), 0.01);
  near(c[1], 10, 0.01); near(c[3], 12, 0.01);
  assert.equal(L.arcTicks(0, 0, 10, 12, 0, 90, 0), "");
});

// --- data arrives --------------------------------------------------------------------------------
// HIG (no false values on arrival): the text decode (decodeText) and the count up from zero (countFrom)
// are gone, with their tests; readings appear at their real value at once (hig.test.js).
test("MOTION: draw-ins finish inside 600 ms of page entry", () => {
  const M = L.MOTION;
  const last = Math.max(...L.staggerDelays(30));
  assert.ok(last + M.drawMs <= 600, last + M.drawMs);
  assert.ok(last + M.staggerMs <= 600, last + M.staggerMs);
});


// --- frame-rate meter --------------------------------------------------------------------------
test("fpsEnabled: card config debug_fps: true or ?fps=1 in the page URL; off otherwise", () => {
  assert.equal(L.fpsEnabled({ debug_fps: true }, ""), true);
  assert.equal(L.fpsEnabled({}, "?fps=1"), true);
  assert.equal(L.fpsEnabled({}, "?kiosk&fps=1"), true);
  assert.equal(L.fpsEnabled({}, "?fps=0"), false);
  assert.equal(L.fpsEnabled({ debug_fps: "yes" }, ""), false);
  assert.equal(L.fpsEnabled(undefined, undefined), false);
  assert.equal(L.fpsEnabled({}, "?fps=10"), false);
});

test("fpsStats: frames in the last second, and the worst gap in the last five", () => {
  const times = [];
  for (let t = 0; t <= 6000; t += 1000 / 60) times.push(t);
  times.push(6100); // one 83 ms hitch at the end
  const s = L.fpsStats(times, 6100);
  assert.ok(s.fps >= 55 && s.fps <= 62, s.fps);
  near(s.worstMs, 6100 - times[times.length - 2], 1e-6);
  // A hitch older than 5 s no longer counts.
  const old = [0, 200]; // 200 ms gap
  for (let t = 300; t <= 7000; t += 20) old.push(t);
  assert.ok(L.fpsStats(old, 7000).worstMs < 100);
  assert.deepEqual(L.fpsStats([], 100), { fps: 0, worstMs: 0 });
});

test("fpsTrim: keeps only the last five seconds of frame times", () => {
  const t = [0, 1000, 4000, 6000, 9000];
  assert.deepEqual(L.fpsTrim(t, 9000), [4000, 6000, 9000]);
  assert.deepEqual(L.fpsTrim([], 1), []);
});
