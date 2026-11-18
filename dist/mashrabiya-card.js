/*
 * mashrabiya-card (legacy alias: mirror-panel-card): full-screen Lovelace card for a two-way-mirror smart display (a panel-view card; see docs/).
 *
 * CONTEXT OF USE (ISO 9241-11)
 *   Users: the household; visitors can see the glass too, so presence is "Home"/"Away", never a name.
 *   Tasks: a <3 s glance while leaving or arriving ("do I need to act?"), use as a real mirror,
 *          occasional taps: Leaving, Lock all, Lights off, scenes, thermostat (each only if configured).
 *   Equipment: large portrait LCD (300 nit) behind ~40% two-way glass; Chromium kiosk scaled so that
 *          1 CSS px = 0.236 mm (reference build: 1440x2560 CSS px); USB IR touch frame (no hover, palms register).
 *   Environment: a hallway or entry, mixed day/night light, hands often full; reference mount: screen top 1829 mm above the floor.
 *
 * USABILITY TARGETS
 *   Effectiveness: every exception that needs action is on the glance layer in words; nothing can unlock.
 *   Efficiency: the answer to "do I need to act?" is one status line read at eye-level-minus-a-bit;
 *               the common actions are one tap each, in one row at hand height (1254-1369 mm).
 *   Satisfaction: reads as a plain mirror when calm; instant press feedback, a word when done.
 *
 * VISUAL DECISIONS
 *   - Sized in physical mm (--mm) so legibility at 0.5-1.5 m is designed, not guessed per zoom level.
 *   - Pure black, no fills/borders/shadows: anything lit glows through the glass as a rectangle.
 *   - Hierarchy from type size and weight only; Atkinson Hyperlegible for character distinctness.
 *   - On Main, 170-400 mm from the top is left empty and still: that is where the face reflects. Detail
 *     pages (More, each room) are for reading at arm's length, so they use the whole height (content
 *     20-546 mm, a navigation row on the bottom edge 552-600 mm, the lowest and easiest reach).
 *   - Colour carries meaning on icons, state words and values (green ok, orange needs a look, red act
 *     now, blue water/cold, yellow light, purple media), always beside the words, in saturated system
 *     colours because the glass dims light; body text stays white. Chrome takes the page's accent (see
 *     MASHRABIYA). Night turns decoration amber; attention and alert keep their hues. Tone choices
 live in mashrabiya-logic.js (…Tone functions).
 *   - Status line sits directly above the buttons, so the eye that finds the problem finds the fix.
 *   - Touch affordance is a 1 px top hairline per button in the faint accent: ~0.24 mm of lit area tells
 *     a finger "this is a shelf of targets" where an outline or fill would glow as a box.
 *   - Night (22:00-06:30): clock and exceptions only, amber and dim; a tap wakes the controls.
 *   - News ticker, bottom 35 mm: one headline at a time from the configured feeds, swapped every 8 s with
 *     a short fade (L.tickerMode; `ticker: scroll` scrolls them at 25 mm/s instead, never under reduced
 *     motion); night hides it. Calm Main: nothing else on Main loops but the weather glyph (no colon beat,
 *     no control-row highlight, lightning flashes once in 30 s). No fills or boxes, never takes touches.

 *   - No unlock or open action exists anywhere in this file (test/source.test.js).
 *
 * CONFIGURATION: the card names no house. Its config (docs/INSTALL.md) is resolved by
 * L.resolveConfig(config, hass): timezone and units from hass.config, the weather entity and the locks
 * discovered, everything else configured (more_button: false drops Main's More button, page 2 stays one swipe away); a feature without its config is hidden (no Leaving button
 * without a script, no ticker without feeds, no scenes without a list). Every UI word is in L.STRINGS.
 *
 * MASHRABIYA (the design language: the interface is a reflection that knows things; everything is
 * drawn in light on the glass, never in panels). Original; it borrows ideas, not screens, from screen
 * sci-fi: no show's shapes, fonts, logos or names.
 *   1. Light only: hairline strokes, dots and text. No filled panels (black is the mirror). Glow is a
 *      thin bright stroke over a wider faint stroke of the same colour, never filter or box-shadow.
 *   2. Data arrives true: on page entry blocks fade up, brackets open and lines draw in (stroke-dashoffset
 *      on pathLength="1"), and the data settles in: gauges, bars and vials arrive within a few percent of
 *      their real value and settle on it, readings roll up into place showing the real reading all along,
 *      all inside 950 ms (L.MOTION). Never a count from zero, a sweep from zero or a decode: every frame is
 *      within max(15 % of the value, 3 % of full scale) of the truth (L.settleFrames). Only real changes
 *      move after that.
 *   3. Calm at rest, alive under the hand: only slow ambient motion when idle; a touch wakes the
 *      reticle, trail and burst.
 *   4. One shape vocabulary: corner BRACKETS group things (never boxes), ARCS show amounts, RINGS mark
 *      places, SWEEPS show time and scanning. Small uppercase letter-spaced MICRO-LABELS carry real
 *      units ("TEMP °F", "HUM %", "AIR").
 *   5. Colour keeps its meaning (above). Chrome (brackets, ticks, heading underline, rails,
 *      touch reticle) is in the page's ACCENT (L.pageAccent): Main a cool ice white, More a pale
 *      lavender tint, Radar a chartreuse, and each room a hue of its own (L.roomAccent: a stable hash of the
 *      area id into six bright hues kept 40+ degrees from every meaning colour and 4.5:1 on black). Gauge
 *      arcs carry their scale's colours along their length (L.gaugeStops); radar targets one colour each.
 *   6. Main keeps its empty middle (the face); detail pages fill the glass.
 *   VIVID (docs/DESIGN.md): each page has THREE hues (L.pagePalette: the accent plus two from
 *   ACCENTS) as --accent/--accent2/--accent3. Brackets run accent -> accent2; micro-labels and the pager are
 *   neutral (--fg2 / --fg); underlines/hairlines/ticker ruler are gradients through all three. Detail pages carry edge
 *   rails (.rails.loop: a travelling highlight and a hue drift, two loops). Page moves add parallax rails
 *   (L.chromeFrames) and a seam wipe line (L.wipeFrames). Every icon is a "constructed instrument glyph"
 *   from glyph(): duotone strokes with nodes in accent2, drawn in on entrance.
 *   SEVERITY (L.SEVERITY): ok, attention and alert are one token each (--ok, --attention, --alert, and
 *   --alert-text for alert words) on the status line, padlocks, Lock all, More's door buttons and room chips.
 *   At night attention and alert keep their hues (dimmed night tokens, words >= 4.5:1); the rest is amber.
 *   OPEN-DOOR ALERT: a configured open door makes its alert's MARKS (the status line's ring, the room chip's
 *   icon, More's door glyph) breathe (WAAPI, L.doorAlertMode); its words stay steady. Steady under reduced motion.
 *   PADLOCKS (LOCK_GLYPH, _paintPadlock): visual only, from L.lockVisual / L.lockTransition.
 *   SCENT: discovered diffusers (L.scentDevices) drawn as vials on room pages, read-only.
 *
 * PAGES AND NAVIGATION
 *   - A loop: Main -> More -> Radar (when any radar exists) -> one page per room -> Main (L.pageKeys; the `pages:` option reorders it, L.orderPages: Main always first), laid out left to right like a carousel. Swipe
 *     LEFT (finger moves right to left) = the next page, coming in from the right edge; swipe RIGHT = the
 *     previous one, from the left; both wrap, so there is no dead end and nothing to "bounce" off.
 *     Taps: More (Main); Rooms (More, to the first room); Home (every detail page, centred in the bottom
 *     row: one name and one house glyph for the way back); Previous and Next (room and radar pages, each
 *     labelled with its page; hidden where the neighbour is Main, L.navTargets). A tap
 *     or the idle return takes the shorter way round (L.pageDirection) and plays the same slide a swipe
 *     would (forward = content moving left), so the page always moves the way the loop says it should.
 *   - Drag-follow: past the 8 mm slop a horizontal drag moves the page with the finger 1:1, the
 *     neighbour it uncovers flush beside it (rails at 60 %, the wipe line on the seam), already playing its
 *     entrance (_dragNeighbourSet; cancelled on a spring-back, _stopEntrance). Release commits
 *     at a quarter of the page width or on a recognised swipe and finishes the slide from there (the
 *     rest of the 320 ms, scaled to the distance left), else springs back (up to 250 ms) (L.DRAG,
 *     L.dragDecision, L.dragOffsets, L.settleMs). The width is read once per touch. Reduced motion: no
 *     follow; a recognised swipe crossfades. A second finger springs it back.
 *   - The room list is live (registries and states). The current page is tracked by KEY ("room:<area>"),
 *     never by index: rooms appearing, going or reordering leave the viewer on the same room
 *     (L.pageIndexFor); if the room on screen goes, the card crossfades to Main.
 *   - Page indicator (detail pages only, centred at the bottom under Home, Apple HIG page control): a thin
 *     segmented track, one segment per page, Main first, neutral white with the current one brighter and
 *     thicker. Never takes touches.

 *   - Idle 60 s on any detail page slides back to Main; any touch restarts the 60 s.
 *   - Swipes never press buttons: travel past 8 mm or a classified swipe suppresses the click.
 *   - Stuck pointers are tolerated: something blocking the IR beams can report a touch that never ends,
 *     and Chromium then flags every real touch as a second finger. The card tracks the pointers still
 *     down; a "second" pointer whose every companion has been silent for L.TOUCH.staleMs (1.5 s) is read
 *     as the one finger (L.treatAsPrimary): it taps (activated by the card, as Chromium sends it no
 *     click), swipes, ripples, and releases the ghost's stuck press or drag. One live companion keeps
 *     today's rule: multi-touch is neither tap nor swipe. Never more than a single real touch can do.
 *   - Any three-finger swipe toggles the screen (mirror mode, L.multiGesture): any direction, or toward /
 *     away from the fingers' centre; decided when the first finger lifts (_multiTrack). Two fingers do
 *     nothing. Off with mirror_mode.
 *   - Room pages are READ-ONLY: information, no controls but Main (test/source.test.js holds
 *     the ROOM_PAGE template and the marked render section to that). Rooms come from the HA registries
 *     on hass (areas, devices, entities): entity area, else device area; hidden and config/diagnostic
 *     entities skipped; one temperature / humidity / air reading per room (the area's chosen sensor
 *     first; equipment sensors such as CPU or disk never count); empty rooms get no page.
 *   - FITTING THE PAGE (docs/DESIGN.md): room and radar pages are a fixed header (the name), a
 *     body, and the navigation row; the body ends 58 mm from the bottom, above the row (52 mm) and the
 *     pager, so nothing is ever under them. The body is made to fit first, never under the 9 mm floor:
 *     rows two columns from three (L.gridColumns, one column above text_scale 1.25), diffusers side by
 *     side, one chips row (L.roomChips), media playing first and at most two (L.mediaVisible), radar
 *     scopes sized to the height left (L.scopeSize).
 *   - A room, radar or More page that still outgrows the screen scrolls its body by a vertical drag read
 *     from the same pointer stream as swipes (touch-action stays none everywhere): a horizontal swipe can
 *     never be stolen by a native scroll, and it works whether the IR frame reports touch or mouse. A
 *     fade at the cut edge and a "More" hint above the navigation row say there is more (L.scrollCue);
 *     every entry starts at the top.
 *   - The Radar page is READ-ONLY too (RADAR_PAGE and its marked section; same test). Radars are
 *     DISCOVERED, never configured by id: every sensor.<prefix>_presence_target_<n>_x in the states
 *     (L.radarList), named by its area (entity area, else device area) or the prettified prefix.
 *     config radar: false hides the page.
 *
 * MORE PAGE AS INSTRUMENTS (home controls; docs/DESIGN.md "The More page"). Sections stack from the
 * top 15 mm apart and size to their content (no space-between), each in corner brackets:
 *   - Doors: one row of large padlocks (LOCK_GLYPH, 34 mm), each with its name (L.doorLabel: "Front Door
 *     Lock" says "Front" under the Doors heading) and its state word under it. A tap may only lock
 *     (lockOne -> lock.lock); the padlock's state is visual only (_paintPadlock).
 *   - Scenes: one row of scene glyphs (24 mm) with their names; the room's Off sits in the heading beside
 *     the title, so it never leaves a scene alone on a second row.
 *   - Both rows: up to 4 padlocks / 5 scenes across (3 above text_scale 1.25), beyond that the fewest rows
 *     filled evenly with the shorter row centred (L.moreRows / L.rowSplit, _layoutRow on half-columns).
 *   - Thermostat: the room pages' arc gauge (_gaugeNode / _paintGauge, up to 175 mm wide): the inside
 *     temperature sweeps the arc in the scale's colours, a tick marks the target; − and + either side
 *     (26 mm), "Target 73°" under it (the pending target at once after a tap), Heat / Off below.
 *   - Now Playing: per player the media equaliser (moving while it plays, a loop), its name as a
 *     micro-label over a 13 mm title, and play/pause.
 *   - House: the presence / air / internet line at 11 mm.
 *   The entrance treats them like a room page's: padlocks and glyphs pop and draw in, the gauge settles
 *   and its reading rolls in (_drawIn, _settleIn). At text_scale 1 the house (4 doors, 5 scenes and Off,
 *   the thermostat, two players, the House line) fits the glass without scrolling.
 *
 * RADAR PAGE (one scope per mmWave radar; stacked, or two columns from three up, L.scopeSize)
 *   - The field is the sensor's +/-60 degree wedge with the sensor at the bottom centre, range rings
 *     every metre (micro-labelled), rim ticks every 15 degrees, the configured zone 1 as a dashed
 *     rectangle (mm/cm/in/ft converted, L.toMm), and a scan line sweeping across with a fading tail
 *     (an ambient loop: off at night, under reduced motion and off screen).
 *   - Each active target: a ring and dot in its own colour at its real (x, y), a short fading trail of
 *     its last positions (L.radarTrailPush) and its speed when moving (L.radarSpeedText). Target and
 *     trail nodes are a fixed pool per scope, moved by a % translate of the field box (no layout reads,
 *     no DOM churn) with a 300 ms transform transition to bridge the ~0.3 s updates. A scope with
 *     nobody in view dims. Geometry is pure and tested (L.radarProject, L.radarWedgePath, L.radarRings,
 *     L.radarZoneRect).
 *
 * FPS METER (for measuring the device): debug_fps: true in the card config, or ?fps=1 in the page URL,
 * shows frames in the last second and the worst frame gap in the last 5 s, top right (L.fpsStats). Off
 * by default; never takes touches.
 *
 * ROOM PAGE INDICATORS (each beside its words: value and unit always in text; colour never alone)
 *   - Name 20 mm bold with a short accent underline (the fixed header), then bracketed groups: arc gauges for temperature
 *     (or the thermostat) and humidity, 240 degrees, gap at the bottom: the scale's colours along a
 *     faint track (blue -> green -> orange for temperature, orange -> green -> blue for humidity), accent
 *     tick marks outside it, the comfort band beyond them (64-76 °F / 18-24 °C, 30-60 %), the value arc
 *     in the same colours over a faint halo, a ring marker at the value in its tone, a micro-label with
 *     the unit ("TEMP °F", "HUM %"), and for the thermostat a tick at the target plus "HEAT · TARGET 68°". Temperature tone: cool blue, comfortable green, warm orange
 *     (L.tempTone); humidity green inside the band, orange outside (L.humidityTone). Scale 50-90 °F or
 *     10-32 °C (L.tempScale). Geometry is pure and tested (L.arcPath, L.arcDash, L.gaugeFraction).
 *   - Air: the word or reading (PM<sub>2.5</sub>, CO<sub>2</sub> with real subscripts) and a segmented
 *     meter, one thin segment per level, faint in its own colour, the current one lit and taller
 *     (L.airSegment: 5 enum levels, or the AQI / PM / CO2 thresholds; VOC has none, so text only).
 *   - Occupancy: the person icon lit green and heavier when occupied, a dim outline when empty. Doors
 *     and windows: drawn ajar when open (orange), closed otherwise.
 *   - Lights, fans, blinds: a row each, icon, name, a thin outlined bar, value. A light's inner bar is
 *     the light's own colour at its brightness (only the dim outline when off). Media: an equaliser and
 *     the title.
 *   - Strokes, 1 px outlines and bars at most 3.4 mm tall: no panel is lit anywhere on the page.
 *
 * MOTION (animation was a deliberate product choice; every piece is transform, opacity or SVG stroke, so the Pi 5
 * compositor does the work; no animated filters, blur or shadows)
 *   - Page move: both pages slide together, 320 ms ease-out, the leaving page going the way the finger
 *     went (after a drag: the rest of the way from where the finger let go). A swipe gets the same entrance
 *     as a tap: it starts the moment the drag uncovers the page and plays as the finger brings it in
 *     (a reversal swaps it for the other neighbour's, a spring-back cancels it, a commit lets it run on). The arriving page's blocks then fade up 4 mm one after another (40 ms + 45 ms steps,
 *     220 ms each, capped at 220 ms of delay). With them brackets open and lines draw, and the data
 *     settles in (_settleIn): gauge arcs and markers, bars and vials start at 85 % of their value,
 *     overshoot by 3 % of full scale and settle on it (600 ms, L.settleFrames), the marker sending one ring
 *     from the overshoot; readings roll up into place a character at a time (30 ms apart, each 300 ms from
 *     60 % below, all inside 450 ms; the real characters throughout, L.rollDelays); micro-labels and the
 *     room heading track in (scaleX 1.08 -> 1 with a fade, 400 ms). Nothing counts or sweeps up from zero.
 *     A live change mid-settle stops that settle where it is on screen and transitions on from there. The
 *     whole entrance ends inside 950 ms. Timings live in L.MOTION.
 *   - State changes: clock digits that changed slide down into place (420 ms); status lines fade up;
 *     sub-labels count ("5 on" -> "2 on", up to 600 ms) or crossfade; the lock shackle lifts while any
 *     door is unlocked and snaps shut when all are locked; the bulb glows up once when lights come on;
 *     room gauges and bars travel from the old value to the new (CSS transition on stroke-dashoffset /
 *     transform, 600-700 ms); the lit air segment moves; room words crossfade.
 *   - Touch: a reticle (ring plus four ticks, in the page's accent) opens and turns from the exact touch
 *     point and fades (450 ms) anywhere on any page; on a
 *     button the button's own ring in its tone is the one effect instead. A drag leaves a short trail
 *     of up to 8 fading dots behind the finger (gone within 280 ms, L.trailPush / L.trailFrame); a
 *     recognised swipe fires a chevron burst from the release point the way it went (L.burstAngle).
 *     One overlay above every page (.touch-fx, pointer-events: none) and a fixed pool of nodes, moved by
 *     transform/opacity only; it reads the same pointer stream as the swipe code and changes nothing in
 *     it. It also shows where the IR frame thinks the finger is. Success draws a tick, failure shakes
 *     the button (380 ms).
 *   - Ambient loops, all small and slow and never in Main's face zone: the weather glyph (sun rays
 *     turning once every 36 s, clouds drifting, rain and snow falling, a rare lightning flicker), a fan
 *     icon turning while its fan runs (faster with speed, L.fanSpinSeconds), an equaliser while media
 *     plays, ticker labels fading in, the radar scan. Loops on off-screen pages are paused.
 *   - Night: the same state-change and touch motion in amber; no ambient loops (.loop).
 *   - prefers-reduced-motion: no animation or transition at all; a page change is a 140 ms crossfade,
 *     gauges simply show their value, nothing draws, settles, rolls or counts, there is no radar scan, and a
 *     touch shows a static dot for 140 ms (no trail, no burst).
 */

// The logic file is a plain script that assigns globalThis.MashrabiyaLogic (Node tests load it too).
// Carry this module's ?v= cache-buster over so both files update together.
await import(new URL("./mashrabiya-logic.js" + new URL(import.meta.url).search, import.meta.url).href);
const L = globalThis.MashrabiyaLogic;
const VERSION = "0.3.0";
const T = L.STRINGS; // every UI word (English; a translation replaces the table in mashrabiya-logic.js)

// Config (resolved by L.resolveConfig, documented in docs/INSTALL.md). Defaults, all generic:
//   time_zone, temperature_unit  from hass.config      weather  the first weather entity    locks  every lock entity
//   doors, internet, air, outdoor_temperature, leaving_script, climate, person  unset: the feature is hidden
//   scenes {title, entities, off}, media_players, news [{label, entity, tone}]  unset: hidden (players: any playing)
//   rooms: null, radar: true, radar_pattern: "{prefix}_presence", night_start: "22:00", night_end: "06:30",
//   debug_fps: false (or ?fps=1 in the URL), font_url: Google Fonts (null = system fonts), font_family.

const FLASH_MS = 1500;
const FAIL_MS = 3000;
const DETAIL_IDLE_MS = 60000;
const NIGHT_WAKE_MS = 30000;
const SWIPE_MM = 40; // minimum horizontal travel for a swipe
const SLOP_MM = 8; // travel beyond this is a drag, never a tap
const TICKER_MM_PER_S = 25;
const TICKER_SWAP_MS = 8000;
const M = L.MOTION;
const EASE_OUT = "cubic-bezier(0.22, 0.8, 0.24, 1)";

// GLYPHS: "constructed instrument glyphs", the one icon family of the card. Every glyph is built by
// glyph() from geometric primitives (circles, arcs, straight segments) on a 24-unit grid:
//   - main strokes (.m) in the element's tone, 1.4 units, over a faint 4-unit copy (.gw) for the glow;
//   - one secondary detail (.s) and small solid NODES (.n) at joints and ends in the page's second hue;
//   - one node may be the idle-motion hook (.mo): it breathes on the drift timeline where loops are
//     allowed (room pages), never at night or under reduced motion;
//   - main strokes carry pathLength="1", so every glyph draws itself in on page entrance.
// Parts may sit in a group (cls) that CSS moves (weather rays, drops, the padlock shackle), with
// their nodes travelling inside it.
const NODE_R = 1.15;
const node = ([x, y, mo, cls]) => `<circle class="n${mo ? " mo" : ""}${cls ? " " + cls : ""}" cx="${x}" cy="${y}" r="${NODE_R}"/>`;
function glyph(spec) {
  const part = (pt) => {
    const inner = pt.s ? `<path class="s" d="${pt.d}"/>` : `<path class="gw" d="${pt.d}"/><path class="m" pathLength="1" d="${pt.d}"/>`;
    const body = inner + (pt.nodes || []).map(node).join("");
    const g = pt.cls ? `<g class="${pt.cls}">${body}</g>` : body;
    return pt.wrap ? `<g class="${pt.wrap}">${g}</g>` : g;
  };
  return `<svg class="gi" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
    (spec.parts || []).map(part).join("") + (spec.raw || "") + (spec.nodes || []).map(node).join("") + `</svg>`;
}
const ring = (cx, cy, r) => `M${cx + r} ${cy}a${r} ${r} 0 1 1 ${-2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0z`;
const CLOUD = "M7 14h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 14z";
const BULB = `${ring(12, 9, 5)}M10 14v3h4v-3M10.5 20h3`;
const ICONS = {
  // Main controls and navigation
  leaving: glyph({ parts: [{ d: "M13 9V3H5v18h8v-6" }, { d: "M9.5 12H21M18 9l3 3-3 3" }], nodes: [[13, 9], [13, 15], [9.5, 12, 1]] }),
  lights: glyph({ parts: [{ d: BULB }, { d: "M4 3.5l16 16" }], nodes: [[10, 17], [14, 17], [12, 9, 1]] }),
  more: glyph({ parts: [{ s: true, d: "M3 12h18" }, { d: ring(6, 12, 2.2) + ring(12, 12, 2.2) + ring(18, 12, 2.2) }], nodes: [[6, 12], [12, 12, 1], [18, 12]] }),
  scene: glyph({ parts: [{ d: "M12 3v5M12 16v5M3 12h5M16 12h5" + ring(12, 12, 2.5) }, { s: true, d: "M6.5 6.5l1.6 1.6M17.5 6.5l-1.6 1.6M6.5 17.5l1.6-1.6M17.5 17.5l-1.6-1.6" }], nodes: [[12, 3, 1], [21, 12], [12, 21], [3, 12]] }),
  prev: glyph({ parts: [{ d: "M15 5l-7 7 7 7" }, { s: true, d: "M8 12h11" }], nodes: [[8, 12, 1], [19, 12]] }),
  next: glyph({ parts: [{ d: "M9 5l7 7-7 7" }, { s: true, d: "M16 12H5" }], nodes: [[16, 12, 1], [5, 12]] }),
  rooms: glyph({ parts: [{ d: "M3 11l9-7 9 7M5 9.5V20h14V9.5" }, { s: true, d: "M9.5 20v-5h5v5" }], nodes: [[12, 4, 1], [3, 11], [21, 11]] }),
  home: glyph({ parts: [{ d: "M3 11l9-7 9 7M5 9.5V20h14V9.5" }, { s: true, d: ring(12, 14.5, 2.4) }], nodes: [[12, 4, 1], [3, 11], [21, 11]] }),
  power: glyph({ parts: [{ d: "M12 3v7M6.4 6.6a7.5 7.5 0 1 0 11.2 0" }], nodes: [[12, 3], [12, 10, 1]] }),
  play: glyph({ parts: [{ d: "M8 5v14l11-7z" }], nodes: [[8, 5], [8, 19], [19, 12, 1]] }),
  pause: glyph({ parts: [{ d: "M8 5v14M16 5v14" }], nodes: [[8, 5], [8, 19], [16, 5], [16, 19, 1]] }),
  // The padlock: a round body, a shackle that lifts and swings open about its right leg (.bob moves it
  // while unlocked), a seal ring while locked, a turning dashed ring while locking or unlocking, a
  // slash when offline and a ring that bursts out when it snaps shut. State is data-lock on .padlock.
  padlock: glyph({
    parts: [
      { cls: "seal", s: true, d: ring(12, 13, 10.2) },
      { cls: "spin", s: true, d: ring(12, 13, 10.2) },
      { cls: "shackle", wrap: "bob", d: "M8.6 11.6V8a3.4 3.4 0 0 1 6.8 0v3.6", nodes: [[8.6, 11.6]] },
      { d: ring(12, 15.6, 5) },
      { s: true, d: "M12 15.6v2.4" },
      { cls: "slash", d: "M4 4l16 16" },
    ],
    raw: `<circle class="burst" cx="12" cy="15.6" r="6"/>`,
    nodes: [[12, 15.2, 1], [15.4, 11.6]],
  }),
  // Room page stats
  climate: glyph({ parts: [{ d: "M12 21c-3.3 0-6-2.5-6-5.8 0-3 2.3-4.8 3.2-7.7.9 1.5 1.3 2.6 1.3 4 1.8-1.4 2.6-4 2.3-7.5C16 6.3 18 10.4 18 15.2 18 18.5 15.3 21 12 21z" }, { s: true, d: "M12 18.6a2.2 2.2 0 0 1-2.2-2.2c0-1.4 1-2.2 2.2-3.6 1.2 1.4 2.2 2.2 2.2 3.6a2.2 2.2 0 0 1-2.2 2.2z" }], nodes: [[12, 21], [14.8, 3.5, 1]] }),
  temperature: glyph({ parts: [{ d: "M10 14.6V5a2 2 0 0 1 4 0v9.6a4 4 0 1 1-4 0zM12 9v8.5" }, { s: true, d: "M16.5 6h2M16.5 9h2M16.5 12h2" }], nodes: [[12, 17.6, 1]] }),
  humidity: glyph({ parts: [{ d: "M12 3.5c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0c0-3.2 3-6.5 6-10.5z" }, { s: true, d: "M9 14.5a3 3 0 0 0 3 3" }], nodes: [[12, 3.5, 1]] }),
  air: glyph({ parts: [{ d: "M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3" }, { s: true, d: "M3 16h7" }], nodes: [[3, 8], [3, 12], [10, 16], [11, 5, 1]] }),
  person: glyph({ parts: [{ d: ring(12, 7, 3.5) + "M5 21a7 7 0 0 1 14 0" }], nodes: [[5, 21], [19, 21], [12, 14, 1]] }),
  door: glyph({ parts: [{ d: "M6 21V3h12v18" }, { s: true, d: "M3.5 21h17" }], nodes: [[15, 12, 1], [6, 3], [18, 3]] }),
  doorOpen: glyph({ parts: [{ d: "M6 21V3h12v18M6 3l7 2.5v15L6 21" }, { s: true, d: "M3.5 21h17M13 20.5a7 7 0 0 0 5-2.3" }], nodes: [[11, 12.5, 1], [6, 3], [18, 3]] }),
  window: glyph({ parts: [{ d: "M5 3h14v18H5zM12 3v18M5 12h14" }], nodes: [[12, 12, 1], [5, 3], [19, 21]] }),
  windowOpen: glyph({ parts: [{ d: "M5 3h14v18H5zM5 12h14" }, { s: true, d: "M8 6l8 3M8 15l8 3" }], nodes: [[8, 6], [8, 15, 1], [16, 9], [16, 18]] }),
  light: glyph({ parts: [{ d: BULB }, { s: true, d: "M12 1v1.2M3.8 3.8l.9.9M20.2 3.8l-.9.9M2 9h1.2M22 9h-1.2" }], nodes: [[10, 17], [14, 17], [12, 9, 1]] }),
  lightOff: glyph({ parts: [{ d: BULB }], nodes: [[10, 17], [14, 17]] }),
  fan: glyph({ parts: [{ d: ring(12, 12, 1.6) + "M12 10.4C11 6 12 3 14.5 3.5S15 8 13.4 11.2M13.5 12.5c4.4 1 6.6 3.4 5.4 5.4s-4.6-.7-6.4-3.5M10.6 12.7C7.4 15.8 4.4 16.5 3.7 14.2s3.7-3.1 6.9-2.6" }], nodes: [[12, 12, 1]] }),
  cover: glyph({ parts: [{ d: "M4 4h16M5 4v16M19 4v16M5 8h14M5 12h14" }, { s: true, d: "M12 12v6" }], nodes: [[4, 4], [20, 4], [12, 18, 1]] }),
  media: glyph({ parts: [{ d: "M9 18V5l11-2v13" + ring(6.5, 18, 2.5) + ring(17.5, 16, 2.5) }], nodes: [[9, 5], [20, 3, 1]] }),
  globe: glyph({ parts: [{ d: ring(12, 12, 8.5) + "M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z" }, { s: true, d: "M3.5 12h17" }], nodes: [[12, 3.5], [12, 20.5, 1]] }),
  scent: glyph({ parts: [{ d: "M10.5 3v3.2C7.8 7 6.5 9 6.5 11.5V18a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3v-6.5c0-2.5-1.3-4.5-4-5.3V3" }, { s: true, d: "M8.5 14h7" }], nodes: [[10.5, 3], [13.5, 3], [12, 17.5, 1]] }),
  // Weather (Main's top band): the moving parts are groups the CSS loops (rays, drift, drop, flake,
  // bolt, twinkle, gust); their nodes ride along.
  wxSun: glyph({ parts: [{ d: ring(12, 12, 4) }, { cls: "rays", d: "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8", nodes: [[12, 2.5], [21.5, 12], [12, 21.5], [2.5, 12]] }], nodes: [[12, 12, 1]] }),
  wxMoon: glyph({ parts: [{ d: "M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" }, { cls: "twinkle", s: true, d: "M18 3.5v3M16.5 5h3" }, { cls: "twinkle t2", s: true, d: "M21 9v2M20 10h2" }], nodes: [[9.5, 5], [19, 14.5]] }),
  wxPartly: glyph({ parts: [{ cls: "rays", d: "M8 2.5v1.8M2.5 8h1.8M4.1 4.1l1.3 1.3M11.9 4.1l-1.3 1.3" }, { d: "M5.2 10.4A3.5 3.5 0 0 1 11.3 6.6" }, { cls: "drift", d: "M8 19h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8 19z", nodes: [[8, 19], [17.5, 19]] }] }),
  wxCloud: glyph({ parts: [{ cls: "drift", d: "M7 18h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18z", nodes: [[7, 18], [17.5, 18]] }] }),
  wxFog: glyph({ parts: [{ d: "M6 11h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 6 11z" }, { cls: "drift", s: true, d: "M4 15h14M6 18.5h14M3 22h10", nodes: [[18, 15], [20, 18.5], [13, 22]] }] }),
  wxRain: glyph({ parts: [{ d: CLOUD }, { cls: "drop", d: "M8 17v2" }, { cls: "drop t2", d: "M12 17v2" }, { cls: "drop t3", d: "M16 17v2" }], nodes: [[7, 14], [17.5, 14]] }),
  wxSnow: glyph({ parts: [{ d: CLOUD }], nodes: [[7, 14], [17.5, 14], [8, 17.5, 0, "flake"], [12, 17.5, 0, "flake t2"], [16, 17.5, 0, "flake t3"]] }),
  wxStorm: glyph({ parts: [{ d: CLOUD }, { cls: "bolt", d: "M13 13l-3 5h4l-2.5 4.5", nodes: [[11.5, 22.5]] }], nodes: [[7, 14], [17.5, 14]] }),
  wxWind: glyph({ parts: [{ cls: "gust", d: "M3 9h10a3 3 0 1 0-3-3", nodes: [[3, 9]] }, { cls: "gust t2", d: "M3 14h14a3 3 0 1 1-3 3", nodes: [[3, 14]] }] }),
};
// L.weatherAnim's names -> glyph keys.
const WX = { sun: "wxSun", moon: "wxMoon", partly: "wxPartly", cloud: "wxCloud", fog: "wxFog", rain: "wxRain", snow: "wxSnow", storm: "wxStorm", wind: "wxWind" };
// A padlock with its door beside it (shown when that door is open); state set by _paintPadlock.
const LOCK_GLYPH = `<span class="lk"><span class="padlock loop" data-lock="offline">${ICONS.padlock}</span><span class="lk-door">${ICONS.doorOpen}</span></span>`;
// The media equaliser's three bars (room rows and More's Now Playing); they move while it plays (.eq.loop).
const EQ_BARS = "<i></i><i></i><i></i>";
// Edge rails (detail pages): a gradient hairline down each side, a second gradient that fades in and out
// over it (the hue drift) and a bright highlight that travels its length. Transform and opacity only.
const RAIL_BARS = '<span class="rail l"><i class="base"></i><i class="alt"></i><i class="hi"></i></span><span class="rail r"><i class="base"></i><i class="alt"></i><i class="hi"></i></span>';
// A diffuser vial (0 0 30 60): two wisps rising from the neck while it runs, the glass, a thin liquid bar
// and a level line at the remaining %. Outlines and a 3-unit bar only: nothing wide is lit.
const VIAL = `<svg viewBox="0 0 30 60" aria-hidden="true" focusable="false">` +
  `<g class="wisps loop"><path d="M13 9.5c-2-1.8 1.8-2.8 0-4.6s1.8-2.8 0-4.4"/><path d="M17 9.5c2-1.8-1.8-2.8 0-4.6s-1.8-2.8 0-4.4"/></g>` +
  `<path class="glass" d="M11.5 11h7M12 11v6c-3.5 1-6 3.5-6 8v29a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V25c0-4.5-2.5-7-6-8v-6"/>` +
  `<path class="glass-glow" d="M12 17c-3.5 1-6 3.5-6 8v29a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V25c0-4.5-2.5-7-6-8"/>` +
  `<rect class="lq" x="13.5" y="24" width="3" height="32" rx="1.5"/>` +
  `<g class="lvl"><line x1="8.5" y1="56" x2="21.5" y2="56"/><circle class="n" cx="8.5" cy="56" r="1.3"/><circle class="n" cx="21.5" cy="56" r="1.3"/></g>` +
  `<circle class="n" cx="11.5" cy="11" r="1.1"/><circle class="n" cx="18.5" cy="11" r="1.1"/></svg>`;
const VIAL_H = 32; // the liquid column's full height in the vial's units
// Room page arc gauges: SVG user units (one unit is a little over 1 mm on the glass).
const GX = 60, GY = 56, GR = 46, GBAND = GR + 7.5, GTICKS = 13;
// Radar scopes: SVG user units, the full range is SCOPE tall; the field box is the +/-60 degree wedge.
const SCOPE = 100, SCOPE_W = L.radarBox(SCOPE).w;
const SWEEP_MS = 700;

const STYLE = `
:host {
  --mm: 4.235px;
  /* Text unit: --mm times the text_scale option (--ts, 0.8-2, set by _applyConfig). Every font size and
     every icon beside text uses --tmm; layout bands and gaps stay in --mm. */
  --ts: 1; --tmm: calc(var(--mm) * var(--ts));
  --fg: rgb(240, 240, 240);
  --fg2: #bfbfbf; /* secondary white: 11:1 on black, so small labels clear 7:1 (Apple HIG dark mode) */
  --rule: rgba(255, 255, 255, 0.35);
  --green: #30d158; --blue: #64d2ff; --yellow: #ffd60a; --orange: #ffa214; --red: #ff453a; --purple: #bf5af2;
  /* SEVERITY (L.SEVERITY): one colour per level on every surface. --alert marks (rings, glyphs);
     --alert-text is the alert's words, a lighter red that is >= 4.5:1 through the glass (est.). */
  --ok: #30d158; --attention: #ffa214; --alert: #ff453a; --alert-text: #ff9d96;
  --accent: #cfeaff; /* the page's chrome hue (L.pageAccent); every page and the touch layer set their own */
  --accent2: #8f91ff; --accent3: #9bf050; /* the page palette's second and third hues (L.pagePalette) */
  display: block; position: relative; width: 100%; height: 100vh; overflow: hidden;
  background: #000; color: var(--fg);
  font-family: var(--mirror-font, 'Atkinson Hyperlegible'), system-ui, sans-serif; font-weight: 400;
  font-variant-numeric: tabular-nums;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
  touch-action: none; /* nothing scrolls; none delivers horizontal moves as pointermove, not pointercancel */
}
/* Night: everything decorative or calm is amber; attention and alert keep their hues, dimmed but still
   >= 4.5:1 for words (one rule, docs/DESIGN.md "Colour meanings"). */
:host(.night) {
  --fg: #ffb347; --fg2: #ffb347; --rule: rgba(255, 179, 71, 0.35);
  --green: #ffb347; --blue: #ffb347; --yellow: #ffb347; --orange: #ffb347; --red: #ffb347; --purple: #ffb347;
  --ok: #ffb347; --attention: #b3710e; --alert: #b33029; --alert-text: #b36e69;
}
/* Night is amber everywhere: !important beats each page's inline palette. */
:host(.night), :host(.night) .page, :host(.night) .pager, :host(.night) .touch-fx, :host(.night) .fps, :host(.night) .wipe { --accent: #ffb347 !important; --accent2: #ffb347 !important; --accent3: #ffb347 !important; }
/* MASHRABIYA chrome tokens, derived where the palette is set so a page's own hues flow into them. */
:host, .page, .pager, .touch-fx, .fps, .wipe {
  --chrome: color-mix(in srgb, var(--accent) 70%, transparent);
  --chrome-faint: color-mix(in srgb, var(--accent) 22%, transparent);
  --chrome2: color-mix(in srgb, var(--accent2) 85%, transparent);
  --chrome2-faint: color-mix(in srgb, var(--accent2) 24%, transparent);
  --chrome3: color-mix(in srgb, var(--accent3) 85%, transparent);
  --chrome3-faint: color-mix(in srgb, var(--accent3) 24%, transparent);
}
/* Corner brackets group things (never boxes): eight hairline arms on ::before, a faint wider copy on
   ::after for the glow (no filter or shadow). Painted once; only opacity/transform ever animate. */
.brk { position: relative; }
.brk::before, .brk::after {
  content: ""; position: absolute; inset: calc(-3 * var(--mm)) calc(-4 * var(--mm)); pointer-events: none;
  --arm: calc(6 * var(--mm)); --w: 1.5px; --c: var(--chrome); --c2: var(--chrome2);
  --cm: color-mix(in srgb, var(--c) 50%, var(--c2));
  /* Corners run from the first hue (top left) to the second (bottom right): a gradient around the group. */
  background:
    linear-gradient(90deg, var(--c), var(--cm)) left top / var(--arm) var(--w), linear-gradient(var(--c), var(--cm)) left top / var(--w) var(--arm),
    linear-gradient(90deg, var(--cm), var(--cm)) right top / var(--arm) var(--w), linear-gradient(var(--cm), var(--c2)) right top / var(--w) var(--arm),
    linear-gradient(90deg, var(--cm), var(--c2)) left bottom / var(--arm) var(--w), linear-gradient(var(--cm), var(--cm)) left bottom / var(--w) var(--arm),
    linear-gradient(90deg, var(--cm), var(--c2)) right bottom / var(--arm) var(--w), linear-gradient(var(--cm), var(--c2)) right bottom / var(--w) var(--arm);
  background-repeat: no-repeat;
}
.brk::after { --w: 5px; --c: var(--chrome-faint); --c2: var(--chrome2-faint); }
/* Micro-labels: small, uppercase, letter-spaced, with real units, in the secondary white (a hue at 85 %
   was under 7:1 on screen and about 3:1 through the glass). Hue stays on strokes, never on small words. */
.micro { font-size: calc(9 * var(--tmm)); line-height: 1.1; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fg2); }
/* Line draw-ins: pathLength="1" strokes drawn by stroke-dashoffset on page entry. */
.draw { stroke-dasharray: 1 1; }
/* Tone -> colour. Tones come from mashrabiya-logic.js; "dim" is the secondary text colour. Severity tones
   (ok, attention, alert: L.SEVERITY) are the same token wherever they appear. --tone colours marks;
   --tone-text colours words (it differs only for alert: the lighter, legible --alert-text). */
[data-tone] { --tone-text: var(--tone); }
[data-tone="green"] { --tone: var(--green); } [data-tone="blue"] { --tone: var(--blue); }
[data-tone="yellow"] { --tone: var(--yellow); } [data-tone="orange"] { --tone: var(--orange); }
[data-tone="red"] { --tone: var(--red); } [data-tone="purple"] { --tone: var(--purple); }
[data-tone="dim"] { --tone: var(--fg2); }
[data-tone="ok"] { --tone: var(--ok); }
[data-tone="attention"] { --tone: var(--attention); }
[data-tone="alert"] { --tone: var(--alert); --tone-text: var(--alert-text); }
.cond[data-tone], .rain[data-tone], .line[data-tone], .facts b[data-tone] { color: var(--tone-text); }
.target-line b[data-tone], .target-line .sub[data-tone]:not(.ok):not(.fail) { color: var(--tone-text); }
button[data-tone]:not(.pressed) svg { color: var(--tone); }
button[data-tone]:not(.pressed) .sub:not(.ok):not(.fail) { color: var(--tone-text); }
* { box-sizing: border-box; }
p { margin: 0; }
[hidden] { display: none !important; }

/* PAGES: Main, More and one page per room, side by side in a loop. Only the current page is visible; during a move the
   leaving and arriving pages slide together (transform only, see _go). visibility (not display) keeps
   the ticker's animation running while Main is off screen. */
.page { position: absolute; inset: 0; background: #000; }
.page.off { visibility: hidden; }
.glance { position: absolute; inset: 0; }
/* Night dims what is decorative or calm; severity (attention, alert) is left at full strength in its own
   night colours, so its words stay >= 4.5:1 (the alert used to sink to about 1.5:1 at its trough). */
:host(.night) .glance > .top, :host(.night) .lower > .controls, :host(.night) .pager,
:host(.night) .detail > :not(.panes), :host(.night) .panes > :not(.doors-sec), :host(.night) .doors-sec > h2,
:host(.night) .doors > button:not([data-tone="attention"], [data-tone="alert"], .alert),
:host(.night) .room-page > :not(.room-body), :host(.night) .room-body > :not(.chips),
:host(.night) .chip:not([data-tone="attention"], [data-tone="alert"], .alert) { opacity: 0.45; }
:host(.night) .doors-sec.brk::before, :host(.night) .doors-sec.brk::after, :host(.night) .chips.brk::before, :host(.night) .chips.brk::after { opacity: 0.45; }
/* Off-screen pages keep their ambient loops paused (the ticker strip is not a .loop and keeps running). */
.page.off .loop, .page.off .loop * { animation-play-state: paused !important; }

/* TOP BAND 20-170 mm */
.top { position: absolute; top: calc(20 * var(--mm)); left: calc(20 * var(--mm)); right: calc(20 * var(--mm)); }
.clock { display: flex; align-items: baseline; gap: calc(3 * var(--mm)); line-height: 1; }
.time .d { display: inline-block; }
.time { font-size: calc(50 * var(--tmm)); font-weight: 700; letter-spacing: -0.01em; }
.ampm { font-size: calc(14 * var(--tmm)); font-weight: 700; }
.date { font-size: calc(14 * var(--tmm)); line-height: 1.2; margin-top: calc(3 * var(--mm)); }
.weather { display: flex; align-items: baseline; flex-wrap: wrap; column-gap: calc(5 * var(--mm)); margin-top: calc(3 * var(--mm)); line-height: 1.1; }
.temp { font-size: calc(26 * var(--tmm)); font-weight: 700; }
/* Weather glyph: slow, small loops in the condition's tone; sits in the top band, never the face zone. */
.wx { align-self: center; width: calc(20 * var(--tmm)); height: calc(20 * var(--tmm)); color: var(--tone, var(--fg2)); }
.wx[hidden] { display: none; }
.wx svg { width: 100%; height: 100%; display: block; overflow: visible; }
.wx svg * { transform-box: view-box; }
.wx .rays { transform-origin: 12px 12px; animation: spin 36s linear infinite; }
.wx[data-anim="partly"] .rays { transform-origin: 8px 8px; }
.wx .drift { animation: drift 7s ease-in-out infinite alternate; }
.wx .drop { animation: fall 1.4s linear infinite; }
.wx .flake { animation: fall-slow 3.2s linear infinite; }
.wx .t2 { animation-delay: -0.5s; } .wx .t3 { animation-delay: -1s; }
.wx .flake.t2 { animation-delay: -1.1s; } .wx .flake.t3 { animation-delay: -2.2s; }
.wx .bolt { animation: flicker ${L.LOOPS.flickerMs}ms linear infinite; }
.wx .twinkle { animation: breathe 4s ease-in-out infinite; } .wx .twinkle.t2 { animation-delay: -2s; }
.wx .gust { animation: gust 3.5s ease-in-out infinite; } .wx .gust.t2 { animation-delay: -1.2s; }
/* Two-tone glyph: the moving parts mix the condition's tone with the page's second hue. */
.wx .rays, .wx .drift, .wx .drop, .wx .flake, .wx .bolt, .wx .twinkle, .wx .gust { color: color-mix(in srgb, var(--tone, var(--fg2)) 62%, var(--accent2)); }
/* The clock separator is steady (Apple HIG: no motion without purpose; a per-second beat at eye level pulls the gaze). */
.time .sep { color: var(--accent2); }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes drift { from { transform: translateX(-0.8px); } to { transform: translateX(0.8px); } }
@keyframes fall { from { transform: translateY(-1.5px); opacity: 0; } 30% { opacity: 1; } to { transform: translateY(3px); opacity: 0; } }
@keyframes fall-slow { from { transform: translate(0, -1.5px); opacity: 0; } 30% { opacity: 1; } to { transform: translate(0.6px, 3.5px); opacity: 0; } }
/* A rare double flash at the end of each L.LOOPS.flickerMs cycle (about 0.7 s of it): otherwise a still bolt. */
@keyframes flicker { 0%, 97.7%, 100% { opacity: 0.35; } 98.1% { opacity: 1; } 98.5% { opacity: 0.5; } 98.9% { opacity: 1; } }
@keyframes breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes gust { 0%, 100% { transform: translateX(-1px); opacity: 0.6; } 50% { transform: translateX(1px); opacity: 1; } }
.cond { font-size: calc(14 * var(--tmm)); color: var(--fg2); }
.rain { font-size: calc(14 * var(--tmm)); font-weight: 700; line-height: 1.2; margin-top: calc(1 * var(--mm)); }
:host(.night) .date, :host(.night) .weather, :host(.night) .rain { display: none; }

/* LOWER HALF: the status line (380-440 mm) and the controls (445-560 mm) stack up from 44 mm above the
   bottom edge, so a larger text_scale grows them UPWARD (into the face zone) rather than into the ticker. */
.lower {
  position: absolute; bottom: calc(44 * var(--mm)); left: calc(20 * var(--mm)); right: calc(20 * var(--mm));
  display: flex; flex-direction: column; gap: calc(5 * var(--mm));
}
/* STATUS 380-440 mm: grows upward from the controls */
.status {
  min-height: calc(60 * var(--mm));
  display: flex; flex-direction: column; justify-content: flex-end;
  font-size: calc(13.5 * var(--tmm)); line-height: 1.15;
}
.line { font-weight: 700; }
/* A small ring in the line's tone marks each status line (rings mark places). */
.line::before {
  content: ""; display: inline-block; width: 0.42em; height: 0.42em; margin: 0 0.45em 0.08em 0; border-radius: 50%;
  border: 1.5px solid var(--tone, var(--chrome)); vertical-align: middle;
}
.line, .sub, .mv { will-change: opacity; }
.line.calm { font-weight: 400; }
/* Security and open-door lines: words in --alert-text (via their tone), a heavier ring in --alert. */
.line.alert::before { border-color: var(--alert); border-width: 2px; }
.chip.alert { --tone: var(--alert) !important; --tone-text: var(--alert-text) !important; }

/* OPEN-DOOR ALERT: only the marks breathe (the status line's ring, the room chip's icon, More's door glyph),
   by opacity through WAAPI (L.doorAlertMode); the words stay steady and legible. It runs at night (in the
   night severity colours) and is steady under reduced motion. */
:host(.night) .line.calm { display: none; }
/* STALE DATA (L.connectionLost): every reading dims until Home Assistant is back; the "Connection lost"
   line itself (.conn) and the clock (local time, still true) stay at full strength. */
:host(.stale) .weather, :host(.stale) .rain, :host(.stale) .controls .sub, :host(.stale) .status .line:not(.conn),
:host(.stale) .panes, :host(.stale) .room-body { opacity: 0.4; }

/* CONTROLS 445-560 mm (the ticker owns 569-604); nothing within 25 mm of the side edges */
.controls {
  position: relative; min-height: calc(115 * var(--mm)); margin: 0 calc(5 * var(--mm));
  display: grid; grid-template-columns: repeat(4, 1fr); column-gap: calc(10 * var(--mm));
}
:host(.night:not(.awake)) .controls, :host(.night:not(.awake)) .close, :host(.night:not(.awake)) .rooms-btn, :host(.night:not(.awake)) .nav { visibility: hidden; }

button {
  font: inherit; color: inherit; border: 0; border-radius: 0; margin: 0; cursor: default; touch-action: none;
  /* The 1 px top hairline, now a gradient through the page's three hues. */
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 40%, transparent), color-mix(in srgb, var(--accent2) 40%, transparent), color-mix(in srgb, var(--accent3) 40%, transparent)) top / 100% 1px no-repeat;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; transition: transform 120ms ease-out; position: relative; overflow: visible;
}
/* Press ripple: a thin ring in the button's tone, from the touch point, gone in under half a second. */
.ripple {
  position: absolute; width: calc(26 * var(--mm)); height: calc(26 * var(--mm));
  margin: calc(-13 * var(--mm)) 0 0 calc(-13 * var(--mm)); border-radius: 50%;
  border: calc(0.5 * var(--mm)) solid var(--tone, var(--fg)); pointer-events: none;
  animation: ripple 460ms ease-out forwards;
}
@keyframes ripple { from { transform: scale(0.15); opacity: 0.8; } to { transform: scale(1); opacity: 0; } }
/* GLYPHS (see glyph()): thin main strokes over a faint glow copy, nodes and one detail in the second hue. */
.gi { overflow: visible; }
.gi .m { stroke-width: 1.4; stroke-dasharray: 1 1; }
.gi .gw { stroke-width: 4; opacity: 0.16; }
.gi .s { stroke: var(--accent2); stroke-width: 1.1; }
.gi .n { fill: var(--accent2); stroke: none; }
/* The idle hook: on room pages one node per glyph breathes on the hue-drift timeline (a loop). */
.room-body.loop .gi .n.mo { transform-box: fill-box; transform-origin: center; animation: node-breathe ${L.LOOPS.driftMs}ms ease-in-out infinite alternate; }
@keyframes node-breathe { from { opacity: 0.45; transform: scale(0.75); } to { opacity: 1; transform: scale(1.3); } }

/* PADLOCKS (visual only; the card can lock, never unlock). data-lock on .padlock: locked = shackle shut, a
   seal ring; unlocked = shackle lifted and swung open about its right leg, gently bobbing (a loop);
   moving = half open with a turning dashed ring (locking / unlocking); jammed = red; offline = dim with a
   slash. Changes spring with overshoot; a snap shut bursts a green ring (_paintPadlock). */
.lk { position: relative; display: inline-flex; align-items: center; gap: calc(1 * var(--mm)); }
.padlock { display: inline-flex; color: var(--tone, var(--fg)); }
.padlock svg * { transform-box: view-box; }
.padlock .shackle { transform-origin: 15.4px 11.6px; transition: transform 450ms cubic-bezier(0.3, 1.6, 0.5, 1); }
.padlock[data-lock="unlocked"] .shackle { transform: translateY(-2.4px) rotate(-32deg); }
.padlock[data-lock="moving"] .shackle { transform: translateY(-1.4px) rotate(-14deg); }
.padlock .seal, .padlock .spin, .padlock .slash, .padlock .burst { opacity: 0; transition: opacity 300ms ease-out; }
.padlock[data-lock="locked"] .seal { opacity: 0.7; }
.padlock[data-lock="moving"] .spin { opacity: 0.9; }
.padlock .spin path { stroke-dasharray: 3 3; }
.padlock[data-lock="offline"] .slash { opacity: 1; }
.padlock[data-lock="offline"] { opacity: 0.55; }
.padlock .burst { fill: none; stroke: var(--ok); stroke-width: 1.4; transform-box: fill-box; transform-origin: center; }
.padlock.loop[data-lock="unlocked"] .bob { animation: bob 2600ms ease-in-out infinite; }
.padlock.loop[data-lock="moving"] .bob { animation: bob 800ms ease-in-out infinite; }
.padlock.loop[data-lock="moving"] .spin { transform-origin: 12px 13px; animation: spin 1600ms linear infinite; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.2px); } }
/* Calm Main: Lock all's padlock shows unlocked by its open shackle and colour, without bobbing. */
.controls .padlock.loop[data-lock="unlocked"] .bob { animation: none; }
.lk-door { display: none; --tone: var(--attention); color: var(--tone); }
.lk.door-open .lk-door { display: inline-flex; }
.lk.alert .lk-door { --tone: var(--alert); }
/* Success tick: the stroke draws itself. */
.check { display: inline-block; width: 0.95em; height: 0.95em; vertical-align: -0.12em; margin-right: 0.2em; }
.check path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 360ms ease-out 60ms forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
button:focus { outline: none; }
button:focus-visible { outline: 2px solid var(--fg); outline-offset: calc(1 * var(--mm)); }
button.pressed { transform: scale(0.97); transition: none; }
button.pressed, button.pressed * { color: #fff; }
:host(.night) button.pressed, :host(.night) button.pressed * { color: #ffc77a; }
button svg { display: block; }
button:not([data-tone]):not(.pressed) svg { color: var(--fg2); }
/* Content hangs just under the hairline so rule and label read as one target; the empty lower part is
   still hit area (palms and sleeves land low). */
.big { justify-content: flex-start; gap: calc(2.5 * var(--mm)); padding: calc(9 * var(--mm)) 0 calc(4 * var(--mm)); }
.big svg { width: calc(20 * var(--tmm)); height: calc(20 * var(--tmm)); }
.big .label { font-size: calc(14 * var(--tmm)); font-weight: 700; line-height: 1.05; }
.big .sub { font-size: calc(13 * var(--tmm)); line-height: 1.05; color: var(--fg2); min-height: 1.05em; }
.sub.fail { color: var(--attention); font-weight: 700; }
.sub.ok { color: var(--fg); font-weight: 700; }

/* DETAIL PAGES (More, room pages): denser (user is within arm's reach); targets >= 15 mm, gaps >= 8 mm,
   text >= 9 mm. Only Main keeps the face zone empty: detail pages use the whole height, 20-546 mm for
   content and a navigation row on the bottom edge (552-600 mm), the lowest and easiest reach. */
.detail {
  position: absolute; inset: 0; background: #000;
  font-size: calc(9 * var(--tmm)); line-height: 1.15;
}
/* Scrolls (by drag, _gestureMove) when its content outgrows it: larger text, or a long scene list. Ends
   above the navigation row; the padding keeps the first and last brackets inside (else they alone overflow).
   Sections size to their content and stack from the top, 15 mm apart (each bracket reaches 3 mm out, so
   9 mm of black between the arms): spreading them over the glass left wide empty bands between them. */
.panes {
  position: absolute; top: calc(20 * var(--mm)); left: calc(25 * var(--mm)); right: calc(25 * var(--mm));
  bottom: calc(58 * var(--mm)); display: flex; flex-direction: column; justify-content: flex-start;
  gap: calc(15 * var(--mm)); overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
  padding: calc(4 * var(--mm)) 0;
}
.panes::-webkit-scrollbar { display: none; }
.panes > * { flex: none; }
h2 { margin: 0 0 calc(3 * var(--mm)); font-size: calc(9 * var(--tmm)); font-weight: 400; color: var(--fg2); }
h2.micro { font-size: calc(9 * var(--tmm)); font-weight: 700; color: var(--fg2); margin-bottom: calc(4 * var(--mm)); }
.grid { display: grid; gap: calc(8 * var(--mm)); }
.g2 { grid-template-columns: repeat(2, 1fr); }
.g3 { grid-template-columns: repeat(3, 1fr); }
.small { min-height: calc(24 * var(--mm)); padding: calc(2 * var(--mm)) calc(1 * var(--mm)); gap: calc(1 * var(--mm)); }
.small .label { font-weight: 700; }
.small .sub { color: var(--fg2); font-size: calc(9 * var(--tmm)); }
.small svg { width: calc(10 * var(--tmm)); height: calc(10 * var(--tmm)); }
.chip .lk .ic, .chip .lk svg { width: calc(13 * var(--tmm)); height: calc(13 * var(--tmm)); }
.small[aria-pressed="true"] .label { text-decoration: underline; text-decoration-thickness: calc(0.6 * var(--mm)); text-underline-offset: calc(1.5 * var(--mm)); }
/* THE MORE PAGE AS INSTRUMENTS (docs/DESIGN.md "The More page"). Doors and scenes: one row each
   (L.moreRows, _layoutRow: half-columns, so a shorter second row sits centred). Each instrument is a
   glyph over its name and state, under the button's hairline; the whole column is the target. */
.inst-row { display: grid; column-gap: calc(4 * var(--mm)); row-gap: calc(8 * var(--mm)); }
.padlock-inst { min-height: calc(15 * var(--mm)); justify-content: flex-start; gap: calc(1.5 * var(--mm)); padding: calc(5 * var(--mm)) 0 calc(3 * var(--mm)); min-width: 0; }
.padlock-inst .lk svg { width: calc(34 * var(--tmm)); height: calc(34 * var(--tmm)); }
.padlock-inst .lk-door svg { width: calc(14 * var(--tmm)); height: calc(14 * var(--tmm)); }
.padlock-inst .label, .scene-inst .label { font-size: calc(10 * var(--tmm)); font-weight: 700; line-height: 1.1; max-width: 100%; overflow-wrap: anywhere; }
.padlock-inst .sub { font-size: calc(10 * var(--tmm)); line-height: 1.1; color: var(--fg2); min-height: 1.1em; }
.padlock-inst .sub.sec, .padlock-inst .sub.att { font-weight: 700; }
.scene-inst { min-height: calc(15 * var(--mm)); justify-content: flex-start; gap: calc(2 * var(--mm)); padding: calc(5 * var(--mm)) 0 calc(3 * var(--mm)); min-width: 0; }
.scene-inst svg { width: calc(24 * var(--tmm)); height: calc(24 * var(--tmm)); }
.scene-inst .sub { font-size: calc(9 * var(--tmm)); color: var(--fg2); }
.scene-inst .sub:empty { display: none; }
/* The scenes heading: the title on the left, the room's Off on the right (a power glyph and the word). */
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: calc(6 * var(--mm)); margin-bottom: calc(2 * var(--mm)); }
.sec-head h2.micro { margin: 0; }
.scenes-off { display: flex; margin-left: auto; min-height: calc(16 * var(--mm)); }
.scenes-off:empty { display: none; }
.scenes-off > button { flex-direction: row; gap: calc(2.5 * var(--mm)); min-width: calc(34 * var(--mm)); padding: 0 calc(3 * var(--mm)); }
.scenes-off .label { font-size: calc(10 * var(--tmm)); font-weight: 700; }
.scenes-off .sub:empty { display: none; }
.scenes-off svg { width: calc(11 * var(--tmm)); height: calc(11 * var(--tmm)); }
/* Thermostat: − and + either side of the room pages' arc gauge, the target written under it, then Heat / Off. */
.thermo { display: grid; grid-template-columns: auto minmax(0, calc(175 * var(--mm))) auto; justify-content: center; align-items: center; column-gap: calc(12 * var(--mm)); }
.thermo .step { width: calc(26 * var(--tmm)); height: calc(26 * var(--tmm)); font-size: calc(22 * var(--tmm)); font-weight: 700; line-height: 1; }
.thermo .gl { display: none; } /* the mode is the Heat / Off pair; the target is the line below */
.dial .gv { font-size: calc(32 * var(--tmm)); }
.target-line { margin: calc(1 * var(--mm)) 0 0; text-align: center; font-size: calc(13 * var(--tmm)); color: var(--fg2); }
.target-line b { color: var(--fg); }
.target-line .sub:not(:empty)::before { content: " · "; }
.modes { margin-top: calc(6 * var(--mm)); }
/* Now Playing: the equaliser glyph, the player's name over a larger title, play/pause. */
.media { display: grid; grid-template-columns: calc(14 * var(--tmm)) minmax(0, 1fr) calc(46 * var(--mm)); align-items: center; column-gap: calc(6 * var(--mm)); }
.media + .media { margin-top: calc(6 * var(--mm)); }
.media .ic.eq { width: calc(14 * var(--tmm)); height: calc(14 * var(--tmm)); }
.media .eq i { width: calc(2 * var(--mm)); }
.media.playing .eq.loop i { animation: eq 900ms ease-in-out infinite alternate; }
.media.playing .eq.loop i:nth-child(2) { animation-delay: -300ms; } .media.playing .eq.loop i:nth-child(3) { animation-delay: -600ms; }
.mtext { min-width: 0; }
.mname { margin-bottom: calc(1 * var(--mm)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media .title { font-size: calc(13 * var(--tmm)); line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media .small { min-height: calc(22 * var(--mm)); }
/* House: the one summary line, a little larger than body text. */
.facts { display: flex; flex-wrap: wrap; column-gap: calc(14 * var(--mm)); row-gap: calc(3 * var(--mm)); font-size: calc(11 * var(--tmm)); }
.facts .ic { width: calc(11 * var(--tmm)); height: calc(11 * var(--tmm)); }
.facts span { color: var(--fg2); }
.facts .fact { display: inline-flex; align-items: center; gap: calc(2 * var(--mm)); }
.facts b { color: var(--fg); }
/* NAVIGATION ROW (detail pages, bottom edge 554-600 mm, the easiest reach): Home in the centre on every
   detail page (one name and one glyph for the way back), Previous on the left and Next on the right on
   room and radar pages, each labelled with the page it goes to (a tap alternative to the swipe). More has
   Rooms where Next would be. Targets 46 mm tall, gaps over 25 mm. */
.close, .rooms-btn, .nav {
  position: absolute; bottom: calc(6 * var(--mm));
  flex-direction: row; justify-content: center; align-items: center; padding: 0 calc(2 * var(--mm)); gap: calc(3 * var(--mm));
}
.nav { height: calc(46 * var(--mm)); width: calc(85 * var(--mm)); min-width: 0; }
.close, .rooms-btn { height: calc(46 * var(--mm)); }
/* Centred by auto margins (not a transform: the press scale owns transform), and as wide as its label. */
.close { left: 0; right: 0; margin: 0 auto; width: fit-content; min-width: calc(65 * var(--mm)); padding: 0 calc(4 * var(--mm)); }
.nav.prev { left: calc(25 * var(--mm)); justify-content: flex-start; }
.nav.next, .rooms-btn { right: calc(25 * var(--mm)); width: calc(85 * var(--mm)); }
.nav.next { justify-content: flex-end; }
.close svg, .rooms-btn svg, .nav svg { flex: none; width: calc(12 * var(--tmm)); height: calc(12 * var(--tmm)); }
.close .sub, .rooms-btn .sub, .nav .sub { display: none; }
.nav .label { font-size: calc(11 * var(--tmm)); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* PAGE INDICATOR (Apple HIG page control): centred at the bottom of detail pages, under Home. One thin
   segment per page (Main first) in neutral white, the current one brighter and thicker; no hue (a
   coloured indicator weakens the current one), no names (Previous and Next carry them). Never takes touches. */
.pager {
  position: absolute; bottom: calc(1.5 * var(--mm)); left: calc(50% - 40 * var(--mm)); width: calc(80 * var(--mm));
  height: calc(3 * var(--mm)); display: flex; align-items: center; z-index: 5; pointer-events: none;
}
.ptrack { display: flex; align-items: center; gap: calc(1.2 * var(--mm)); width: 100%; }
.ptrack i { flex: 1 1 0; height: calc(0.5 * var(--mm)); background: color-mix(in srgb, var(--fg2) 45%, transparent); transition: transform 240ms ease-out, opacity 240ms ease-out; }
.ptrack i.on { background: var(--fg); transform: scaleY(3); }

/* ROOM PAGES 18-546 mm: one per room, read-only. A fixed header (the name), then the body: arc gauges
   (temperature, humidity), the air meter, occupancy and door icons, the diffusers, a bar per light / fan /
   blind, now playing. Strokes and thin bars only, never panels: a filled area glows through the glass.
   FITTING THE PAGE: the frame ends 58 mm from the bottom, above the navigation row (52 mm) and the pager,
   so nothing is ever under them; the body between the header and that edge scrolls (by drag, see
   _gestureMove) when a room still outgrows it, with a fade at the cut edge and a "More" hint. */
.room-frame {
  position: absolute; top: calc(18 * var(--mm)); left: calc(25 * var(--mm)); right: calc(25 * var(--mm));
  bottom: calc(58 * var(--mm)); display: flex; flex-direction: column;
}
.room-head { flex: none; }
.room-body {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
  font-size: calc(10 * var(--tmm)); line-height: 1.15;
  padding-top: calc(4 * var(--mm)); padding-bottom: calc(4 * var(--mm));
}
.room-body::-webkit-scrollbar { display: none; }
/* The cut edge fades (every scrolling body: rooms, radar, More), so a half-shown row reads as "more". */
.room-body.below, .panes.below { -webkit-mask-image: linear-gradient(#000 85%, transparent); mask-image: linear-gradient(#000 85%, transparent); }
.room-body.above, .panes.above { -webkit-mask-image: linear-gradient(transparent, #000 15%); mask-image: linear-gradient(transparent, #000 15%); }
.room-body.above.below, .panes.above.below { -webkit-mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent); mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent); }
/* "More" with a down chevron, centred just above the navigation row while the body has more below it. */
.more-hint {
  position: absolute; left: 0; right: 0; bottom: calc(59 * var(--mm)); text-align: center;
  pointer-events: none; color: var(--fg2);
}
.room-name { margin: calc(4 * var(--mm)) 0 calc(6 * var(--mm)); padding-bottom: calc(2.5 * var(--mm)); font-size: calc(20 * var(--tmm)); font-weight: 700; line-height: 1.05; }
/* Heading underline: a short accent hairline over a faint wider one (the glow), not a rule across. */
.room-name, .radar-title {
  background:
    linear-gradient(90deg, var(--accent), var(--accent2) 55%, var(--accent3)) left bottom / calc(60 * var(--mm)) 1.5px no-repeat,
    linear-gradient(90deg, var(--chrome-faint), var(--chrome2-faint) 60%, transparent) left bottom / calc(100 * var(--mm)) 5px no-repeat;
}
/* Blocks on detail pages sit inside brackets; keep the brackets clear of each other (each reaches 3 mm
   out, so 12 mm between blocks leaves 6 mm of black between the arms). */
.room-body > .brk, .panes > .brk, .scents > .brk { margin-left: calc(4 * var(--mm)); margin-right: calc(4 * var(--mm)); }
.room-body > * + * { margin-top: calc(12 * var(--mm)); }
.ml { color: var(--fg2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml sub { font-size: 0.7em; vertical-align: -0.25em; line-height: 0; }
.ml:empty { display: none; }
.mv { font-weight: 700; color: var(--tone-text, var(--tone, var(--fg))); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; will-change: opacity; }
/* Stat icons always carry colour: their tone, a light's own colour (--ic), or the page's third hue when
   the stat is off or empty ("dim"): chrome never carries meaning, the words beside it do. */
.ic { position: relative; flex: none; display: inline-flex; width: calc(9 * var(--tmm)); height: calc(9 * var(--tmm)); color: var(--ic, var(--tone, var(--fg2))); }
.ic svg { width: 100%; height: 100%; display: block; }
[data-tone="dim"] .ic, .ic[data-tone="dim"] { --ic: var(--chrome3); }
:host(.night) .ic { color: var(--fg) !important; }
:host(.night) :is([data-tone="attention"], [data-tone="alert"], .alert) > .ic { color: var(--tone) !important; }
/* A reading changed: a small ring flashes at its icon (transform/opacity, gone in half a second). */
.flash { position: absolute; left: 50%; top: 50%; width: calc(14 * var(--mm)); height: calc(14 * var(--mm)); margin: calc(-7 * var(--mm)) 0 0 calc(-7 * var(--mm));
  border-radius: 50%; border: 1.5px solid var(--tone, var(--accent2)); pointer-events: none; opacity: 0; }
[data-tone="dim"] .flash { border-color: var(--accent2); }
.gv .mv, .vial .pct { display: inline-block; }
/* Settle in: a reading's characters roll up one at a time (inline-block so each can move; spaces kept),
   and micro-labels track in from their reading edge (the gauge's centred line from its centre). */
.ch { display: inline-block; white-space: pre; }
.ml, .gl, .room-name { transform-origin: left center; }
.gauge .gl { transform-origin: center; }

/* EDGE RAILS (More, Radar, rooms): 1-2 px gradient lines down both sides, beside the content (never on
   Main). Two ambient loops per page: a highlight travelling the length, and the hue drift (a second
   gradient fading in and out over the first). Both pause off screen and stop at night. */
.rails { position: absolute; inset: 0; pointer-events: none; }
.rail { position: absolute; top: calc(20 * var(--mm)); bottom: calc(58 * var(--mm)); width: 2px; overflow: hidden; transform-origin: 50% 0; }
.rail.l { left: calc(11 * var(--mm)); } .rail.r { right: calc(11 * var(--mm)); }
.rail i { position: absolute; left: 0; right: 0; top: 0; bottom: 0; }
.rail .base { background: linear-gradient(var(--accent), var(--accent2) 50%, var(--accent3)); opacity: 0.6; }
.rail .alt { background: linear-gradient(var(--accent3), var(--accent) 50%, var(--accent2)); opacity: 0; }
.rail .hi { bottom: auto; height: 22%; opacity: 0; will-change: transform, opacity;
  background: linear-gradient(transparent, var(--accent2), #fff 50%, var(--accent3), transparent); }
.rails.loop .alt { animation: hue-drift ${L.LOOPS.driftMs}ms ease-in-out infinite alternate; }
.rails.loop .hi { animation: rail-run ${L.LOOPS.railMs}ms linear infinite; }
.rails.loop .rail.r .hi { animation-direction: reverse; animation-delay: -${L.LOOPS.railMs / 2}ms; }
@keyframes hue-drift { from { opacity: 0; } to { opacity: 0.5; } }
@keyframes rail-run { 0% { transform: translateY(-100%); opacity: 0; } 10% { opacity: 0.9; } 90% { opacity: 0.9; } 100% { transform: translateY(455%); opacity: 0; } }

/* PAGE MOVE: a coloured line rides the seam between the two pages (L.wipeFrames), over a faint wide copy. */
.wipe { position: absolute; inset: 0; z-index: 4; pointer-events: none; opacity: 0; will-change: transform, opacity; }
.wipe i { position: absolute; top: 0; bottom: 0; left: -1px; width: 2px; background: linear-gradient(var(--accent), var(--accent2) 50%, var(--accent3)); }
.wipe i.g { left: calc(-3 * var(--mm)); width: calc(6 * var(--mm)); opacity: 0.16; }

/* Arc gauge: 240 degrees, gap at the bottom. Hairline track, faint comfort band outside it, the value
   arc in its tone (stroke-dashoffset), a ring marker at the value and a tick at the target (rotate). */
.gauges { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: calc(10 * var(--mm)); }
.gauges[data-n="1"] { grid-template-columns: minmax(0, calc(150 * var(--mm))); justify-content: center; }
.gauge { position: relative; text-align: center; }
.gauge svg { display: block; width: 100%; height: auto; overflow: visible; }
.gauge svg * { transform-box: view-box; transform-origin: ${GX}px ${GY}px; }
/* The scale is drawn in its colours (L.gaugeStops: a gradient along the arc, faint on the track, full
   on the value arc over a wider faint copy for the glow); tick marks in the accent outside it. */
.gauge stop { stop-color: var(--tone); }
.gauge .track { fill: none; stroke-width: 0.8; opacity: 0.35; }
.gauge .ticks { fill: none; stroke: var(--chrome); stroke-width: 0.6; stroke-linecap: round; }
.gauge .band { fill: none; stroke: var(--chrome); stroke-width: 1.1; opacity: 0.6; }
.gauge .val, .gauge .halo { fill: none; stroke-linecap: round; transition: stroke-dashoffset ${SWEEP_MS}ms ${EASE_OUT}; }
.gauge .val { stroke-width: 3; }
.gauge .halo { stroke-width: 7; opacity: 0.14; }
:host(.night) .gauge .val, :host(.night) .gauge .halo, :host(.night) .gauge .track { stroke: var(--fg); }
.gauge .mark { transition: transform ${SWEEP_MS}ms ${EASE_OUT}; }
.gauge .mark circle { fill: #000; stroke: var(--tone, var(--fg)); stroke-width: 1.4; }
.gauge .mark circle.glow { fill: none; stroke-width: 4; opacity: 0.2; }
/* A moved value: a ring pulses out of the marker a few times (L.LOOPS.pulseCount), then stops. */
.gauge .mark circle.pulse { fill: none; stroke-width: 1; opacity: 0; transform-box: fill-box; transform-origin: center; }
.gl .ic { width: calc(9 * var(--tmm)); height: calc(9 * var(--tmm)); vertical-align: calc(-1.8 * var(--tmm)); margin-right: calc(1.5 * var(--mm)); }
.gauge .tgt { stroke: var(--fg); stroke-width: 1.4; stroke-linecap: round; transition: transform ${SWEEP_MS}ms ${EASE_OUT}; }
.gv { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-62%); margin: 0; font-size: calc(22 * var(--tmm)); line-height: 1; }
.gl { margin: calc(-5 * var(--mm)) 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gl b { color: var(--tone-text, var(--tone, var(--fg))); }
.gl b:empty { display: none; }
.gl b:not(:empty) + span::before { content: " · "; }

/* Air meter: one thin segment per level, the current one lit and taller (scaleY), the rest faint in
   their own colours so the scale reads at a glance. */
.meter-row { display: grid; grid-template-columns: auto auto auto minmax(0, 1fr); align-items: center; column-gap: calc(4 * var(--mm)); }
.meter { display: flex; align-items: center; gap: calc(2.5 * var(--mm)); height: calc(6 * var(--mm)); margin-left: calc(4 * var(--mm)); }
.meter[hidden] { display: none; }
.meter i { flex: 1; height: calc(0.9 * var(--mm)); border-radius: calc(0.5 * var(--mm)); background: var(--tone); opacity: 0.35; transition: transform 400ms ${EASE_OUT}, opacity 400ms ease-out; }
.meter i.on { opacity: 1; transform: scaleY(2.6); }

/* Occupancy and doors: icon plus word. Occupied lights the person green; open doors draw ajar. */
.chips { display: flex; flex-wrap: wrap; column-gap: calc(14 * var(--mm)); row-gap: calc(5 * var(--mm)); }
.chip { display: inline-flex; align-items: center; gap: calc(3 * var(--mm)); min-width: 0; max-width: 100%; }
.chip .ic { width: calc(13 * var(--tmm)); height: calc(13 * var(--tmm)); }
.chip.lit .ic svg { stroke-width: 2.2; }

/* Lights, fans, blinds, media: icon, name, a thin outlined bar, value. */
.cap { margin: 0 0 calc(4 * var(--mm)); }
.rows { display: grid; grid-template-columns: calc(9 * var(--tmm)) minmax(0, 1fr) minmax(calc(30 * var(--mm)), calc(86 * var(--mm))) minmax(calc(26 * var(--tmm)), auto); align-items: center; column-gap: calc(4 * var(--mm)); row-gap: calc(5 * var(--mm)); }
.row { display: contents; }
/* Two columns from three rows (L.gridColumns): each row its own small grid, icon, name and value on one
   line, the bar under the name. Same text sizes; half the height. */
.rows[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: calc(12 * var(--mm)); row-gap: calc(5 * var(--mm)); }
.rows[data-cols="2"] .row { display: grid; grid-template-columns: calc(9 * var(--tmm)) minmax(0, 1fr) auto; align-items: center; column-gap: calc(3 * var(--mm)); row-gap: calc(1.5 * var(--mm)); }
.rows[data-cols="2"] .row .bar { grid-column: 2 / 4; grid-row: 2; }
.rows[data-cols="2"] .row .title { grid-column: 2 / 4; }
.row .ml { color: var(--fg); }
.row .mv { text-align: right; }
.bar { position: relative; height: calc(3.4 * var(--mm)); border: 1px solid var(--chrome-faint); border-radius: calc(1.7 * var(--mm)); overflow: hidden; }
.bar i { position: absolute; inset: 1px; border-radius: inherit; background: var(--c, var(--tone, var(--fg))); transform-origin: left center; transform: scaleX(0); transition: transform 600ms ${EASE_OUT}; }
:host(.night) .bar i { background: var(--fg); }
.row .title { grid-column: 3 / 5; }
/* Fan icon turns while on, faster with speed (L.fanSpinSeconds); a loop, so never at night. */
.row.on .fan-spin.loop svg { animation: spin var(--spin, 2s) linear infinite; }
/* Media: a small equaliser moves while playing; a loop, so never at night. */
.eq { align-items: flex-end; justify-content: center; gap: calc(1 * var(--mm)); padding: calc(1 * var(--mm)) 0; }
.eq i { width: calc(1.4 * var(--mm)); height: 100%; background: var(--tone, var(--fg2)); transform-origin: bottom; transform: scaleY(0.3); }
.row.playing .eq.loop i { animation: eq 900ms ease-in-out infinite alternate; }
.row.playing .eq.loop i:nth-child(2) { animation-delay: -300ms; } .row.playing .eq.loop i:nth-child(3) { animation-delay: -600ms; }
@keyframes eq { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }

/* SCENT (fragrance diffusers, read-only): per device two outlined vials, each with a thin liquid bar and a
   level line at the remaining % in the scent's colour (L.scentColor); the active vial brighter, with
   wisps rising while it runs (a loop: never at night or off screen). Low vials are orange and say so.
   Beside them the intensity as a five-step meter with its word, the timer as a 12-hour countdown ring. */
.scent { display: grid; grid-template-columns: auto auto minmax(0, 1fr); column-gap: calc(8 * var(--mm)); row-gap: calc(3 * var(--mm)); align-items: end; }
.scent.offline .vial, .scent.offline .imeter { opacity: 0.45; }
/* Diffusers side by side from two (L.gridColumns, from = 2): the intensity, timer and
   alternation go under the vials instead of beside them, so each fits half the width. */
.scents { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: calc(10 * var(--mm)); row-gap: calc(12 * var(--mm)); }
.scents[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.scents[data-cols="2"] .scent { grid-template-columns: auto auto minmax(0, 1fr); }
.scents[data-cols="2"] .scent-info { grid-column: 1 / -1; padding-bottom: 0; }
.scent .cap { grid-column: 1 / -1; display: flex; align-items: center; gap: calc(2 * var(--mm)); }
.scent .cap .ic { width: calc(9 * var(--tmm)); height: calc(9 * var(--tmm)); }
.vial { position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(1 * var(--mm)); width: calc(32 * var(--mm)); color: var(--vc, var(--fg)); }
.vial.low { --vc: var(--attention) !important; }
:host(.night) .vial { --vc: var(--fg) !important; }
.vial svg { width: calc(17 * var(--mm)); height: calc(34 * var(--mm)); display: block; overflow: visible; }
.vial svg * { transform-box: view-box; }
.vial .glass { fill: none; stroke: currentColor; stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; opacity: 0.5; transition: opacity 400ms ease-out; }
.vial .glass-glow { fill: none; stroke: currentColor; stroke-width: 3.5; opacity: 0; transition: opacity 400ms ease-out; }
.vial.on .glass { opacity: 1; stroke-width: 1.6; }
.vial.on .glass-glow { opacity: 0.14; }
.vial .lq { fill: currentColor; opacity: 0.85; transform-box: fill-box; transform-origin: 50% 100%; transition: transform 800ms ${EASE_OUT}; }
.vial .lvl { stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; transition: transform 800ms ${EASE_OUT}; }
.vial .wisps path { fill: none; stroke: currentColor; stroke-width: 0.9; stroke-linecap: round; opacity: 0; transform-box: fill-box; transform-origin: 50% 100%; }
.vial.on.run .wisps.loop path { animation: wisp 3200ms ease-out infinite; }
.vial.on.run .wisps.loop path + path { animation-delay: -1600ms; }
@keyframes wisp { 0% { transform: translateY(2px) scale(0.8); opacity: 0; } 30% { opacity: 0.9; } 100% { transform: translateY(-7px) scale(1.15); opacity: 0; } }
.vial .pct { font-weight: 700; color: var(--vc, var(--fg)); }
.vial .nm { max-width: 100%; font-size: calc(9 * var(--tmm)); }
.vial .lowtag { color: var(--attention); }
.vial .lowtag:empty { display: none; }
.scent-info { display: flex; flex-direction: column; gap: calc(3 * var(--mm)); min-width: 0; padding-bottom: calc(2 * var(--mm)); }
.scent-info .iw { color: var(--iw, var(--fg)); }
:host(.night) .scent-info .iw { color: var(--fg); }
.imeter { display: flex; align-items: center; gap: calc(1.5 * var(--mm)); height: calc(5 * var(--mm)); }
.imeter i { flex: 1; height: calc(0.9 * var(--mm)); border-radius: calc(0.5 * var(--mm)); background: var(--chrome2); opacity: 0.28; transition: transform 400ms ${EASE_OUT}, opacity 400ms ease-out; }
.imeter i.on { opacity: 1; transform: scaleY(2.2); background: linear-gradient(90deg, var(--accent), var(--accent2)); }
.timer { display: flex; align-items: center; gap: calc(3 * var(--mm)); min-width: 0; }
.timer[hidden] { display: none; }
.timer svg { flex: none; width: calc(9 * var(--tmm)); height: calc(9 * var(--tmm)); transform: rotate(-90deg); }
.timer circle { fill: none; stroke-width: 2; }
.timer .tk { stroke: var(--chrome3-faint); }
.timer .arc { stroke: var(--accent3); stroke-linecap: round; stroke-dasharray: 1 1; transition: stroke-dashoffset 800ms ${EASE_OUT}; }
.scent .alt:empty { display: none; }

/* TOUCH FEEDBACK: one overlay above every page, never takes touches. A ring where a tap lands (buttons
   keep their own tone ripple instead), a short fading trail behind a dragging finger (a fixed pool of
   dots, moved by transform), a chevron burst the way a recognised swipe went. Shows where the IR frame
   thinks the finger is, which also helps while it is uncalibrated. */
/* MIRROR MODE: a pure-black veil above everything (it also takes the touches, so the glass can be groomed). */
.mirror-veil { position: absolute; inset: 0; background: #000; z-index: 9; opacity: 0; touch-action: none; }
.touch-fx { position: absolute; inset: 0; z-index: 6; pointer-events: none; overflow: hidden; color: var(--accent); }
.touch-fx > span { position: absolute; left: 0; top: 0; opacity: 0; will-change: transform, opacity; }
/* A reticle, not a plain ring: a hairline circle over a faint wide one (glow) and four ticks. */
.touch-fx .tap { width: calc(28 * var(--mm)); height: calc(28 * var(--mm)); margin: calc(-14 * var(--mm)) 0 0 calc(-14 * var(--mm)); }
.touch-fx .tap svg { width: 100%; height: 100%; display: block; overflow: visible; }
.touch-fx .tdot { width: calc(3 * var(--mm)); height: calc(3 * var(--mm)); margin: calc(-1.5 * var(--mm)) 0 0 calc(-1.5 * var(--mm)); border-radius: 50%; background: currentColor; }
.touch-fx .burst { width: calc(24 * var(--mm)); height: calc(12 * var(--mm)); margin: calc(-6 * var(--mm)) 0 0 calc(-12 * var(--mm)); }
.touch-fx .burst svg { width: 100%; height: 100%; display: block; }
.touch-fx .tap line { stroke: var(--accent2); }

/* RADAR PAGE: one scope per mmWave radar (read-only). The field is the sensor's +/-60 degree wedge with
   the sensor at the bottom centre: range rings every metre, the configured zone dashed, a scan line
   sweeping across (an ambient loop: off at night, under reduced motion and off screen). Each target
   is a ring and dot in its own colour at its real position, with a short fading trail; its node is
   reused and moved by transform (a translate in % of the field box, so no layout reads). */
.radar-title { margin: calc(4 * var(--mm)) 0 calc(4 * var(--mm)); padding-bottom: calc(2.5 * var(--mm)); font-size: calc(20 * var(--tmm)); font-weight: 700; line-height: 1.05; }
.radar-sub { margin: 0 0 calc(2 * var(--mm)); }
.radar-grid { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: calc(14 * var(--mm)); row-gap: calc(14 * var(--mm)); margin: 0 calc(4 * var(--mm)); }
.radar-grid[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.radar-grid[data-cols="2"] > .scope:last-child:nth-child(odd) { grid-column: 1 / -1; justify-self: center; width: calc(50% - 7 * var(--mm)); }
.scope { display: flex; flex-direction: column; gap: calc(3 * var(--mm)); min-width: 0; }
.scope-head { display: flex; align-items: baseline; justify-content: space-between; gap: calc(4 * var(--mm)); min-width: 0; }
/* Half a column is too narrow for a room name and "CLEAR · 3.5 M" on one line: they stack, nothing cut. */
.radar-grid[data-cols="2"] .scope-head { flex-direction: column; align-items: flex-start; gap: calc(1 * var(--mm)); }
.radar-grid[data-cols="2"] .scope-count { white-space: nowrap; }
.scope-name { font-size: calc(9 * var(--tmm)); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scope-count[data-tone] { color: var(--tone-text); }
/* --fw: the width L.scopeSize leaves each scope for the height on screen (_fitScopes). */
.field { position: relative; width: min(100%, var(--fw, 100%)); aspect-ratio: ${(2 * Math.sin(Math.PI / 3)).toFixed(4)} / 1; margin: 0 auto; transition: opacity 400ms ease-out; }
.scope.idle .field { opacity: 0.45; }
.field > svg, .scan-clip > .scan, .field > .tg, .field > .tr { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.field svg { display: block; }
.field .wedge { fill: none; stroke: var(--chrome); stroke-width: 0.6; }
.field .wedge-glow { fill: none; stroke: var(--chrome-faint); stroke-width: 2.4; }
/* Range rings shade from the second hue (near) to the third (far): --k from L.ringMix. */
.field .ring { fill: none; stroke: color-mix(in srgb, var(--accent3) var(--k, 0%), var(--accent2)); stroke-width: 0.5; opacity: 0.6; }
.field .rim-ticks { fill: none; stroke: var(--chrome2); stroke-width: 0.5; }
.field .zone { fill: none; stroke: var(--accent3); stroke-width: 0.6; stroke-dasharray: 2.5 2; opacity: 0.9; }
.field .zone-glow { fill: none; stroke: var(--accent3); stroke-width: 2.4; opacity: 0.14; }
.field .origin { fill: none; stroke: var(--accent); stroke-width: 0.8; }
.rl { position: absolute; transform: translate(-115%, -50%); font-size: calc(9 * var(--tmm)); letter-spacing: 0.1em; color: var(--fg2); white-space: nowrap; }
/* The scan turns its whole field-sized box about the sensor, whose corners would swing out below the
   field and grow the body's scroll height (a false "More"): it turns inside a clip the size of the field. */
.scan-clip { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.scan { transform-origin: 50% 100%; opacity: 0; will-change: transform, opacity; }
.scan line { stroke: var(--accent); stroke-linecap: round; }
.scan.loop { animation: scan 5.5s linear infinite; }
@keyframes scan {
  0% { transform: rotate(-62deg); opacity: 0; } 8% { opacity: 0.9; } 92% { opacity: 0.9; } 100% { transform: rotate(62deg); opacity: 0; }
}
.tg, .tr { opacity: 0; color: var(--tc); }
.tg { transition: transform 300ms linear, opacity 300ms ease-out; will-change: transform; }
.tg.on { opacity: 1; }
.tg i, .tr i { position: absolute; left: 50%; top: 100%; border-radius: 50%; }
.tg .ring-o { width: calc(7 * var(--mm)); height: calc(7 * var(--mm)); margin: calc(-3.5 * var(--mm)) 0 0 calc(-3.5 * var(--mm)); border: 1.5px solid currentColor; }
.tg .ring-g { width: calc(10 * var(--mm)); height: calc(10 * var(--mm)); margin: calc(-5 * var(--mm)) 0 0 calc(-5 * var(--mm)); border: 4px solid currentColor; opacity: 0.18; }
/* A halo: a second, thinner ring outside the target's own, mixed toward the page's second hue. */
.tg .ring-h { width: calc(13 * var(--mm)); height: calc(13 * var(--mm)); margin: calc(-6.5 * var(--mm)) 0 0 calc(-6.5 * var(--mm)); border: 1px solid color-mix(in srgb, currentColor 55%, var(--accent2)); opacity: 0.75; }
/* Speed vector: from the target the way it is moving, longer when faster (L.radarVector). */
.tg .vec { width: calc(16 * var(--mm)); height: 2px; margin-top: -1px; border-radius: 1px; transform-origin: 0 50%; opacity: 0;
  background: linear-gradient(90deg, currentColor, var(--accent2)); transition: transform 300ms linear, opacity 300ms ease-out; }
.tg .vec.on { opacity: 0.9; }
.tg .dot-c { width: calc(2 * var(--mm)); height: calc(2 * var(--mm)); margin: calc(-1 * var(--mm)) 0 0 calc(-1 * var(--mm)); background: currentColor; }
.tr i { width: calc(1.6 * var(--mm)); height: calc(1.6 * var(--mm)); margin: calc(-0.8 * var(--mm)) 0 0 calc(-0.8 * var(--mm)); background: currentColor; }
.tg .spd { position: absolute; left: 50%; top: 100%; transform: translate(calc(5 * var(--mm)), -50%); font-size: calc(9 * var(--tmm)); font-weight: 700; letter-spacing: 0.06em; white-space: nowrap; }
:host(.night) .tg, :host(.night) .tr { --tc: var(--fg) !important; }

/* FPS METER (opt-in: debug_fps: true or ?fps=1): measured frames per second and the worst frame time
   in the last 5 s, top-right, tiny, never takes touches. Off by default. */
.fps {
  position: absolute; top: calc(1 * var(--mm)); right: calc(2 * var(--mm)); z-index: 8; pointer-events: none;
  font-size: calc(5 * var(--tmm)); line-height: 1; letter-spacing: 0.08em; color: var(--accent); white-space: pre;
}

/* Night: state changes still move; nothing loops. */
:host(.night) .loop, :host(.night) .loop * { animation: none !important; }

/* NEWS TICKER 569-604 mm: one line, pinned to the bottom edge, never takes touches. */
.ticker {
  position: absolute; left: 0; right: 0; bottom: 0; height: calc(35 * var(--mm));
  overflow: hidden; pointer-events: none;
  display: flex; align-items: center;
  /* A gradient hairline and a ruler of ticks cycling through the page's three hues along the top edge. */
  background:
    linear-gradient(90deg, var(--chrome-faint), var(--chrome2-faint), var(--chrome3-faint)) left top / 100% 1px no-repeat,
    repeating-linear-gradient(90deg, var(--chrome) 0 1px, transparent 1px calc(20 * var(--mm)), var(--chrome2) calc(20 * var(--mm)) calc(20 * var(--mm) + 1px),
      transparent calc(20 * var(--mm) + 1px) calc(40 * var(--mm)), var(--chrome3) calc(40 * var(--mm)) calc(40 * var(--mm) + 1px), transparent calc(40 * var(--mm) + 1px) calc(60 * var(--mm)))
      left top / 100% calc(1.6 * var(--mm)) no-repeat;
  font-size: calc(13.5 * var(--tmm)); line-height: 1; white-space: nowrap;
}
.ticker[hidden] { display: none !important; }
:host(.night) .ticker { display: none; }
.strip { display: flex; flex: none; will-change: transform; animation: tick var(--dur, 60s) linear infinite; }
.half { display: flex; flex: none; align-items: center; }
.lab { font-size: calc(9 * var(--tmm)); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; margin-right: calc(4 * var(--mm)); color: var(--tone); animation: fade-in 700ms ease-out both; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.hl { color: var(--fg); }
.dot { color: var(--tone, var(--fg2)); margin: 0 calc(4 * var(--mm)); }
/* Section divider before each feed: a short vertical gradient bar. */
.ticker .sec { display: inline-block; flex: none; width: 2px; height: 0.9em; margin: 0 calc(5 * var(--mm)) 0 calc(2 * var(--mm)); background: linear-gradient(var(--accent2), var(--accent3)); }
.single { padding: 0 calc(20 * var(--mm)); overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
@keyframes tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* Increase Contrast (prefers-contrast: more): secondary text full white, no translucent chrome on words,
   heavier glyph strokes, brackets and indicator (Apple HIG: honour the higher-contrast setting). */
@media (prefers-contrast: more) {
  :host { --fg: #ffffff; --fg2: #ffffff; }
  .gi .m { stroke-width: 2.2; }
  .gi .s { stroke-width: 1.6; }
  .brk::before { --w: 2.5px; }
  .line::before { border-width: 2.5px; }
  .ptrack i { height: calc(0.9 * var(--mm)); }
  .ptrack i:not(.on) { background: color-mix(in srgb, var(--fg2) 70%, transparent); }
}

@media (prefers-reduced-motion: reduce) {

  *, *::before, *::after { animation: none !important; transition: none !important; }
  button, button.pressed { transform: none; }
  .strip { animation: none; }
  .ripple { display: none; }
  .check path { stroke-dashoffset: 0; }
}
`;

const TEMPLATE = `
<style>${STYLE}</style><style class="font"></style>
<div class="page main">
<div class="glance">
  <div class="top brk" data-stagger>
    <div class="clock"><span class="time"></span><span class="ampm"></span></div>
    <p class="date"></p>
    <p class="weather"><span class="wx loop" aria-hidden="true" hidden></span><span class="temp"></span><span class="cond"></span><span class="micro wx-label">${T.outside}</span></p>
    <p class="rain" data-tone="blue" hidden></p>
  </div>
  <div class="lower">
  <div class="status" role="status" aria-live="polite" data-stagger></div>
  <div class="controls brk" data-stagger>
    <button class="big" data-action="leaving" data-tone="blue">${ICONS.leaving}<span class="label">${T.leaving}</span><span class="sub"></span></button>
    <button class="big" data-action="lockAll">${LOCK_GLYPH}<span class="label">${T.lockAll}</span><span class="sub"></span></button>
    <button class="big" data-action="lightsOff">${ICONS.lights}<span class="label">${T.lightsOff}</span><span class="sub"></span></button>
    <button class="big" data-action="more">${ICONS.more}<span class="label">${T.more}</span><span class="sub"></span></button>
  </div>
  </div>
</div>
<div class="ticker" role="marquee" aria-label="${T.headlines}" hidden></div>
</div>
<div class="page more detail off" role="region" aria-label="${T.homeControls}" inert>
  <div class="rails loop" aria-hidden="true">${RAIL_BARS}</div>
  <div class="panes">
    <section class="doors-sec brk" data-stagger><h2 class="micro">${T.doors}</h2><div class="inst-row doors"></div></section>
    <section class="scenes-sec brk" data-stagger><div class="sec-head"><h2 class="micro scenes-title"></h2><div class="scenes-off"></div></div><div class="inst-row scenes"></div></section>
    <section class="thermo-sec brk" data-stagger><h2 class="micro">${T.thermostat}</h2>
      <div class="thermo">
        <button class="small step" data-action="tempDown" aria-label="${T.lowerTarget}">−</button>
        <div class="dial"></div>
        <button class="small step" data-action="tempUp" aria-label="${T.raiseTarget}">+</button>
      </div>
      <p class="target-line">${T.target} <b class="tgt-v">—</b><span class="sub tgt-sub"></span></p>
      <div class="grid g2 modes">
        <button class="small" data-action="modeHeat" aria-pressed="false">${ICONS.climate}<span class="label">${T.heat}</span><span class="sub"></span></button>
        <button class="small" data-action="modeOff" aria-pressed="false">${ICONS.power}<span class="label">${T.off}</span><span class="sub"></span></button>
      </div>
    </section>
    <section class="media-sec brk" hidden data-stagger><h2 class="micro">${T.nowPlaying}</h2><div class="media-list"></div></section>
    <section class="house-sec brk" data-stagger><h2 class="micro">${T.house}</h2><p class="facts"></p></section>
  </div>
  <span class="more-hint micro" aria-hidden="true" hidden>${T.moreBelow}</span>
  <button class="big rooms-btn" data-action="rooms" aria-label="${T.rooms}" data-stagger>${ICONS.rooms}<span class="label">${T.rooms}</span><span class="sub"></span></button>
  <button class="big close" data-action="home" aria-label="${T.homePage}" data-stagger>${ICONS.home}<span class="label">${T.homePage}</span><span class="sub"></span></button>
</div>
<div class="pager" hidden><span class="ptrack" role="img"></span></div>
<div class="wipe" aria-hidden="true"><i class="g"></i><i></i></div>
<div class="touch-fx" aria-hidden="true"></div>
<div class="fps" aria-hidden="true" hidden></div>
<div class="mirror-veil" aria-hidden="true" hidden></div>
`;

// One per room, created as rooms appear (_makePage). READ-ONLY: the only controls are the navigation row.
const ROOM_PAGE = `
<div class="page room-page off" role="region" aria-label="${T.room}" inert>
  <div class="rails loop" aria-hidden="true">${RAIL_BARS}</div>
  <div class="room-frame">
    <div class="room-head"></div>
    <div class="room-body loop"></div>
  </div>
  <span class="more-hint micro" aria-hidden="true" hidden>${T.moreBelow}</span>
  <button class="big nav prev" data-action="prev" data-stagger>${ICONS.prev}<span class="label"></span><span class="sub"></span></button>
  <button class="big close" data-action="home" aria-label="${T.homePage}" data-stagger>${ICONS.home}<span class="label">${T.homePage}</span><span class="sub"></span></button>
  <button class="big nav next" data-action="next" data-stagger><span class="label"></span>${ICONS.next}<span class="sub"></span></button>
</div>`;

// The Radar page, created when the first radar is discovered (_makeRadarPage). READ-ONLY like a room.
const RADAR_PAGE = `
<div class="page radar-page off" role="region" aria-label="${T.radar}" inert>
  <div class="rails loop" aria-hidden="true">${RAIL_BARS}</div>
  <div class="room-frame">
    <div class="room-head"></div>
    <div class="room-body radar-body"></div>
  </div>
  <span class="more-hint micro" aria-hidden="true" hidden>${T.moreBelow}</span>
  <button class="big nav prev" data-action="prev" data-stagger>${ICONS.prev}<span class="label"></span><span class="sub"></span></button>
  <button class="big close" data-action="home" aria-label="${T.homePage}" data-stagger>${ICONS.home}<span class="label">${T.homePage}</span><span class="sub"></span></button>
  <button class="big nav next" data-action="next" data-stagger><span class="label"></span>${ICONS.next}<span class="sub"></span></button>
</div>`;

// Touch reticle: a hairline ring over a faint wide copy (the glow) and four ticks, in a 0-100 box.
const RETICLE = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round">
<circle cx="50" cy="50" r="34" stroke-width="9" opacity="0.18"/><circle cx="50" cy="50" r="34" stroke-width="2.2"/>
<line x1="50" y1="2" x2="50" y2="14" stroke-width="2.4"/><line x1="50" y1="86" x2="50" y2="98" stroke-width="2.4"/>
<line x1="2" y1="50" x2="14" y2="50" stroke-width="2.4"/><line x1="86" y1="50" x2="98" y2="50" stroke-width="2.4"/>
</svg>`;

// url: the stylesheet that declares the face (config font_url); null fetches nothing and the card uses
// the system fonts. @font-face inside a shadow root is ignored by Chromium, so the face is also
// declared on the document.
function ensureDocumentFont(url) {
  if (!url || typeof document === "undefined" || Array.from(document.querySelectorAll("link[rel=stylesheet]")).some((l) => l.getAttribute("href") === url)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

// A page's three hues (L.pagePalette) as the custom properties every chrome rule reads.
function paintPalette(el, key) {
  const [a, b, c] = L.pagePalette(key);
  el.style.setProperty("--accent", a);
  el.style.setProperty("--accent2", b);
  el.style.setProperty("--accent3", c);
}

const setText = (el, v) => {
  if (el && el.textContent !== v) el.textContent = v;
};

class MashrabiyaCard extends HTMLElement {
  constructor() {
    super();
    this._user = {}; // the card config as written in the dashboard
    this._config = L.resolveConfig({}, null); // resolved against hass (_resolve)
    this._cfgSig = null;
    this._flashes = new Map();
    this._last = new Map();
    this._keys = {};
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = TEMPLATE;
    const $ = (s) => this.shadowRoot.querySelector(s);
    this._el = {
      time: $(".time"), ampm: $(".ampm"), date: $(".date"), temp: $(".temp"), cond: $(".cond"), rain: $(".rain"),
      ticker: $(".ticker"), status: $(".status"), glance: $(".glance"), detail: $(".detail"),
      doors: $(".doors"), scenes: $(".scenes"), scenesOff: $(".scenes-off"), dial: $(".dial"), tgtV: $(".tgt-v"), tgtSub: $(".tgt-sub"),
      mediaSec: $(".media-sec"), mediaList: $(".media-list"), facts: $(".facts"), wx: $(".wx"),
      pager: $(".pager"), ptrack: $(".ptrack"),
      fx: $(".touch-fx"), roomsBtn: $(".rooms-btn"), fps: $(".fps"), controls: $(".controls"), font: $("style.font"),
      doorsSec: $(".doors-sec"), scenesSec: $(".scenes-sec"), scenesTitle: $(".scenes-title"), thermoSec: $(".thermo-sec"), houseSec: $(".house-sec"),
      wipe: $(".wipe"), veil: $(".mirror-veil"),
    };
    // The loop: Main, More, then one page per room (L.pageKeys). The current page is tracked by key
    // and element, so rooms appearing, going or reordering never move the viewer to another room.
    this._pageKeys = L.PAGES.slice();
    this._pageEls = new Map([["main", $(".page.main")], ["more", $(".page.more")]]);
    const panes = $(".panes");
    panes.addEventListener("scroll", () => this._scrollCue(panes), { passive: true });
    this._page = 0;
    this._cur = this._pageEls.get("main");
    this._rooms = [];
    this._radars = [];
    this._radarTrails = new Map(); // "<prefix>:<n>" -> recent positions (mm), for the fading trails
    this._gone = new Set();
    this._slides = [];
    this._tweens = new Map();
    this._el.roomsBtn.hidden = true;
    for (const [k, el] of this._pageEls) paintPalette(el, k);
    this._buildTouchFx();
    this._resolve();
    this._reduceMq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (this._reduceMq && this._reduceMq.addEventListener) {
      this._reduceMq.addEventListener("change", () => {
        this._keys.news = undefined;
        this._renderNews();
        this._alertKey = undefined; // reduced motion: steady instead of breathing
        if (this._hass) this._syncDoorAlert();
      });
    }
    this.shadowRoot.querySelectorAll("button[data-action]").forEach((b) => this._bind(b));
    // Pointers still down (id -> timeStamp of their last event), read by _primary. Registered first, so
    // every gesture handler sees the map already up to date for the event it is handling.
    this._pointers = new Map();
    this.shadowRoot.addEventListener("pointerdown", (e) => this._trackPointer(e), true);
    this.shadowRoot.addEventListener("pointermove", (e) => this._trackPointer(e), true);
    this.shadowRoot.addEventListener("pointerup", (e) => this._trackPointer(e), true);
    this.shadowRoot.addEventListener("pointercancel", (e) => this._trackPointer(e), true);
    this.shadowRoot.addEventListener("pointerdown", (e) => this._multiTrack(e), true);
    this.shadowRoot.addEventListener("pointermove", (e) => this._multiTrack(e), true);
    this.shadowRoot.addEventListener("pointerup", (e) => this._multiTrack(e), true);
    this.shadowRoot.addEventListener("pointercancel", (e) => this._multiTrack(e), true);
    this.shadowRoot.addEventListener("pointerdown", (e) => this._gestureDown(e), true);
    this.shadowRoot.addEventListener("pointermove", (e) => this._gestureMove(e), true);
    this.shadowRoot.addEventListener("pointerup", (e) => this._gestureUp(e), true);
    this.shadowRoot.addEventListener("pointercancel", (e) => this._gestureCancel(e), true);
  }

  // --- swipe navigation ---------------------------------------------------------------------
  // A gesture that travels past SLOP_MM, or is classified as a swipe, must never activate the button
  // it started on: _suppressClick is set and checked by every button's click handler, and cleared
  // by the next primary pointerdown.
  _mmPx() {
    const v = parseFloat(getComputedStyle(this).getPropertyValue("--mm"));
    return Number.isFinite(v) && v > 0 ? v : 4.235;
  }

  _releasePressed() {
    this.shadowRoot.querySelectorAll("button.pressed").forEach((b) => b.classList.remove("pressed"));
  }

  // --- stale-touch tolerance -----------------------------------------------------------------
  // Something blocking the IR frame's beams can report a pointer that goes down and never comes up: a
  // stuck ghost. Chromium keeps it as the primary pointer, so every real touch after it arrives flagged
  // secondary and would read as multi-touch (no tap, no swipe) until the ghost cleared. The card
  // tracks the pointers it has seen go down, and a non-primary pointer counts as primary when every other
  // one has been silent for L.TOUCH.staleMs (L.treatAsPrimary). A move only refreshes a pointer already
  // down (a hovering mouse is never "down"). lostpointercapture does not end a pointer: it follows every
  // pointerup anyway, and on its own (the captured node left the DOM) the finger is still on the glass.
  _trackPointer(e) {
    if (e.type === "pointerup" || e.type === "pointercancel") this._pointers.delete(e.pointerId);
    else if (e.type === "pointerdown" || this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, e.timeStamp);
  }

  // --- three-finger toggle ---------------------------------------------------------------------
  // Runs after _trackPointer on the same capture-phase stream. When a pointerdown leaves exactly three
  // live fingers on the glass (tracked and not stale: a stuck ghost is never a finger), their positions
  // then are the gesture's start; any other count abandons it. The first of the three to lift decides
  // (L.multiGesture): any three-finger swipe, in any direction or toward / away from their centre,
  // toggles the screen (mirror mode). A pointercancel decides nothing. _gestureDown already reads
  // multi-touch as neither tap nor swipe, so no page changes and no button fires. Off with mirror_mode.
  _multiTrack(e) {
    const xy = this._fingerXY || (this._fingerXY = new Map());
    const m = this._multi;
    const id = e.pointerId;
    const at = { x: e.clientX, y: e.clientY };
    if (e.type === "pointercancel") {
      xy.delete(id);
      if (m && m.ids.includes(id)) this._multi = null;
      return;
    }
    if (e.type === "pointerup") {
      xy.delete(id);
      if (!m || !m.ids.includes(id)) return;
      this._multi = null;
      const end = m.ids.map((f) => (f === id ? at : m.last.get(f)));
      const what = L.multiGesture(m.start, end, this._mmPx());
      if (what === "toggle") this._mirror ? this._mirrorExit(false) : this._mirrorEnter();
      return;
    }
    if (e.type === "pointermove") {
      if (xy.has(id)) xy.set(id, at);
      if (m && m.ids.includes(id)) m.last.set(id, at);
      return;
    }
    if (e.type !== "pointerdown") return;
    xy.set(id, at);
    for (const f of [...xy.keys()]) if (!this._pointers.has(f)) xy.delete(f); // lifted where the card never saw it
    if (!this._config.mirror_mode) {
      this._multi = null;
      return;
    }
    const stale = new Set(L.staleIds(this._pointers, e.timeStamp, L.TOUCH.staleMs));
    const live = [...xy.keys()].filter((f) => f === id || !stale.has(f));
    this._multi = live.length === 3 ? { ids: live, start: live.map((f) => xy.get(f)), last: new Map(live.map((f) => [f, xy.get(f)])) } : null;
  }

  // Whether the card reads this pointer as the one finger: the browser's primary flag, overruled only when
  // stuck ghosts alone make it secondary.
  _primary(e) {
    const others = [];
    for (const [id, t] of this._pointers) if (id !== e.pointerId) others.push(t);
    return L.treatAsPrimary(e.isPrimary, others, e.timeStamp, L.TOUCH.staleMs);
  }

  // Primary for the card although the browser says secondary. Chromium sends no click for such a pointer,
  // so _gestureUp activates the button its tap lands on itself.
  _promoted(e) {
    return e.isPrimary === false && this._primary(e);
  }

  // The page width and the mm scale are read here, once per touch, so a drag never reads layout per move.
  _gestureDown(e) {
    const primary = this._primary(e);
    if (primary) {
      // Any other pointer still tracked is a stuck ghost: forget it, and let go of the press it held (this
      // runs in the capture phase, before the new button's own pointerdown marks it pressed).
      const stale = L.staleIds(this._pointers, e.timeStamp, L.TOUCH.staleMs).filter((id) => id !== e.pointerId);
      for (const id of stale) this._pointers.delete(id);
      if (stale.length) this._releasePressed();
    }
    if (!this._mirror) {
      this._onAnyTouch();
      this._fxDown(e); // touch feedback reads the same stream; it never changes what the gesture means
    }
    if (this._drag) this._dragSpringBack(); // a second finger, a lost pointerup or a stale ghost: the drag is over
    if (!primary) {
      this._gesture = null; // multi-touch: not a swipe, and not a tap either
      this._suppressClick = true;
      return;
    }
    this._suppressClick = false;
    const w = (this._fxRect && this._fxRect.width) || this.clientWidth;
    const promoted = this._promoted(e);
    const path = promoted && typeof e.composedPath === "function" ? e.composedPath() : [];
    const btn = path.find((n) => n && n.tagName === "BUTTON" && n.dataset && n.dataset.action) || null;
    this._gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, w, mm: this._mmPx(), promoted, btn };
  }

  // --- mirror mode (double tap) ----------------------------------------------------------------
  // A tap that lands on a button or other control is never part of a double tap (those keep working as two
  // presses, undelayed). Two taps on bare glass (L.isDoubleTap) black the screen out until mirror_timeout,
  // another double tap, or a new door alert.
  _isInteractive(e) {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    return path.some((n) => n && n.tagName && (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(n.tagName) || (n.getAttribute && n.getAttribute("role") === "button")));
  }

  _tapUp(e, g, enter) {
    const pt = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (enter && (this._isInteractive(e) || !this._config.mirror_mode)) {
      this._lastTap = null;
      return;
    }
    if (L.isDoubleTap(this._lastTap, pt, g.mm)) {
      this._lastTap = null;
      if (enter) this._mirrorEnter();
      else this._mirrorExit(false);
    } else {
      this._lastTap = pt;
    }
  }

  _mirrorEnter() {
    if (this._mirror) return;
    this._mirror = true;
    this.classList.add("mirrored");
    this._navToken = (this._navToken || 0) + 1;
    clearTimeout(this._detailTimer); // no page change while mirrored; _mirrorExit re-arms it
    this._fpsStop();
    this._releasePressed();
    // Every ambient loop behind the veil stops (and resumes on exit).
    this._mirrorPaused = this.shadowRoot.getAnimations().filter((a) => a.playState === "running" && a.effect && a.effect.getComputedTiming().iterations === Infinity);
    for (const a of this._mirrorPaused) a.pause();
    const v = this._el.veil;
    v.hidden = false;
    // Reverse from where the veil actually is (read before cancelling): a double tap mid-fade never jumps.
    const from = L.currentOpacity(getComputedStyle(v).opacity, 0);
    if (this._veilAnim) this._veilAnim.cancel();
    this._veilAnim = v.animate([{ opacity: from }, { opacity: 1 }], { duration: L.mirrorFadeMs("in", this._reduced()), easing: "ease-in-out" });
    v.style.opacity = "1";
    clearTimeout(this._mirrorTimer);
    this._mirrorTimer = setTimeout(() => this._mirrorExit(false), this._config.mirror_timeout * 1000);
  }

  _mirrorExit(urgent) {
    if (!this._mirror) return;
    this._mirror = false;
    this._lastTap = null;
    clearTimeout(this._mirrorTimer);
    this.classList.remove("mirrored");
    for (const a of this._mirrorPaused || []) a.play();
    this._mirrorPaused = null;
    this._fpsSync();
    if (this._page !== 0) this._armDetailTimer();
    const v = this._el.veil;
    const from = L.currentOpacity(getComputedStyle(v).opacity, 1);
    if (this._veilAnim) this._veilAnim.cancel();
    const ms = urgent ? L.MIRROR.alertOutMs : L.mirrorFadeMs("out", this._reduced());
    const a = (this._veilAnim = v.animate([{ opacity: from }, { opacity: 0 }], { duration: ms, easing: "ease-in-out" }));
    v.style.opacity = "0";
    const done = () => {
      if (this._veilAnim === a && !this._mirror) v.hidden = true;
    };
    a.finished.then(done, done);
  }

  // The scrollable body of the room or radar page on screen, if any.
  _scroller() {
    const kind = this._pageKind();
    if (kind === "more") return this._cur.querySelector(".panes"); // More scrolls when its content outgrows it (text_scale)
    return kind === "room" || kind === "radar" ? this._cur.querySelector(".room-body") : null;
  }

  // On a room page, a drag that is more vertical than horizontal scrolls the body from this same
  // pointer stream (touch-action stays none everywhere), so a horizontal swipe is never stolen by a
  // native scroll and the IR frame works whether it reports touch or mouse. A drag that is more
  // horizontal than vertical when it passes the slop follows the finger instead (_dragStart).
  _gestureMove(e) {
    const g = this._gesture;
    if (!g || e.pointerId !== g.id || this._mirror) return;
    this._fxMove(e);
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.scroll) {
      g.el.scrollTop = g.top - dy;
      return;
    }
    if (g.drag) {
      this._dragTo(dx);
      return;
    }
    if (this._suppressClick) return;
    if (L.movedPast(dx, dy, SLOP_MM * g.mm)) {
      this._suppressClick = true;
      this._releasePressed();
      const list = this._scroller();
      if (list && Math.abs(dy) > Math.abs(dx) && list.scrollHeight > list.clientHeight) {
        g.scroll = true;
        g.el = list;
        g.top = list.scrollTop + dy;
        list.scrollTop = g.top - dy;
      } else if (Math.abs(dx) > Math.abs(dy) && this._dragStart(g)) {
        this._dragTo(dx);
      }
    }
  }

  _gestureUp(e) {
    const g = this._gesture;
    if (!g || e.pointerId !== g.id) return;
    this._gesture = null;
    if (g.scroll) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (this._mirror) {
      // Mirrored: single taps do nothing, a double tap ends it.
      if (!L.movedPast(dx, dy, SLOP_MM * g.mm)) this._tapUp(e, g, false);
      return;
    }
    if (L.movedPast(dx, dy, SLOP_MM * g.mm)) this._suppressClick = true;
    const dir = L.swipeDirection(dx, dy, e.timeStamp - g.t, SWIPE_MM * g.mm);
    if (!g.drag && !dir && !L.movedPast(dx, dy, SLOP_MM * g.mm)) {
      this._tapUp(e, g, true);
      // A promoted pointer's tap gets no click from Chromium: activate its button here, under exactly the
      // rules a click obeys (a tap, not suppressed; _activate's 700 ms debounce stops a double if one comes).
      if (g.promoted && g.btn && g.btn.isConnected && !g.btn.hidden && !g.btn.disabled && !this._suppressClick) this._activate(g.btn);
    }
    if (g.drag) {
      this._dragEnd(e, dx, dir);
      return;
    }
    if (!dir) return;
    this._suppressClick = true;
    this._releasePressed();
    this._fxBurst(e, dir);
    this._go(L.nextPage(this._page, dir, this._pageKeys.length), dir);
  }

  // --- drag-follow ---------------------------------------------------------------------------
  // Past the slop, a horizontal drag moves the page with the finger 1:1 and the neighbour it uncovers
  // (the next page from the right when the finger goes left, the previous from the left) comes along
  // flush beside it, rails at 60 % (parallax), the wipe line on the seam. Inline transforms only, from
  // the width cached on pointerdown (L.dragOffsets). Release commits (L.dragDecision) through _go,
  // which finishes the slide from there, or springs back. Not under reduced motion: there a recognised
  // swipe simply changes page (_go's crossfade).
  _dragStart(g) {
    if (this._reduced() || this._pageKeys.length < 2 || !this._cur || !(g.w > 0)) return false;
    for (const a of this._fadeAnims || []) a.cancel(); // a fade still settling snaps to its logical state (the page on screen at 1)
    this._fadeAnims = [];
    for (const a of this._slides) a.finish(); // a move still settling snaps to its end
    this._slides = [];
    this._navToken = (this._navToken || 0) + 1; // ...and leaves its pages to the drag
    for (const p of new Set([...this._pageEls.values(), ...this._gone])) {
      if (p !== this._cur) p.classList.add("off");
      p.style.zIndex = "";
    }
    const cur = this._cur;
    this._drag = { w: g.w, dx: 0, side: null, nb: null, nbEl: null, nbRails: null, entrance: null, curEl: cur, curRails: cur.querySelector(":scope > .rails") };
    g.drag = true;
    return true;
  }

  _dragTo(dx) {
    const d = this._drag;
    if (!d) return;
    const side = L.dragNeighbour(dx);
    if (side !== d.side) this._dragNeighbourSet(side);
    d.dx = dx;
    const o = L.dragOffsets(dx, d.w, L.DRAG.depth);
    if (!o) return;
    if (this._fade()) {
      // Nothing moves: the crossfade tracks the finger (L.fadeProgress), the arriving page also settles 0.985 -> 1.
      const p = L.fadeProgress(dx, d.w);
      d.curEl.style.opacity = String(1 - p);
      if (d.nbEl) {
        d.nbEl.style.opacity = String(p);
        d.nbEl.style.transform = `scale(${L.fadeScale(p)})`;
      }
      return;
    }
    const tx = (el, px) => el && (el.style.transform = `translateX(${px}px)`);
    tx(d.curEl, o.cur);
    tx(d.curRails, o.curChrome);
    tx(d.nbEl, o.nb);
    tx(d.nbRails, o.nbChrome);
    const wipe = this._el.wipe.style;
    wipe.transform = `translateX(${o.seam}%)`;
    wipe.opacity = d.nbEl ? "1" : "0";
  }

  // The finger crossed back over its start (or set off): show the page on the other side. The page it
  // uncovers plays its entrance at once (stagger, draw-in, settle in), so it comes to life as the finger
  // brings it in; the page it leaves behind drops its entrance (back at its true values).
  _dragNeighbourSet(side) {
    const d = this._drag;
    this._stopEntrance(d);
    if (d.nbEl) {
      d.nbEl.classList.add("off");
      d.nbEl.style.transform = "";
      d.nbEl.style.opacity = d.nbEl.style.zIndex = "";
      if (this._fade()) d.curEl.style.opacity = "";
      if (d.nbRails) d.nbRails.style.transform = "";
    }
    d.side = side;
    d.nb = d.nbEl = d.nbRails = null;
    if (!side) return;
    const idx = L.nextPage(this._page, side === "next" ? "left" : "right", this._pageKeys.length);
    const el = this._pageList()[idx];
    if (!el || el === d.curEl) return;
    this._preparePage(idx);
    el.classList.remove("off");
    if (this._fade()) {
      el.style.opacity = "0";
      el.style.zIndex = "2"; // above the page on screen, fading in over it
    }
    d.nb = idx;
    d.nbEl = el;
    d.nbRails = el.querySelector(":scope > .rails");
    paintPalette(this._el.wipe, this._pageKeys[idx]);
    d.entrance = this._entrance(el);
  }

  // A drag's entrance on the page it uncovered stops (reversal, spring-back): cancelled, every block,
  // gauge and reading is simply at its true value again.
  _stopEntrance(d) {
    const anims = d && d.entrance;
    if (!anims) return;
    d.entrance = null;
    for (const a of anims) a.cancel();
  }

  _dragClearStyles(d) {
    for (const el of [d.curEl, d.curRails, d.nbEl, d.nbRails]) if (el) el.style.transform = "";
    for (const el of [d.curEl, d.nbEl]) if (el) el.style.opacity = el.style.zIndex = "";
    this._el.wipe.style.transform = this._el.wipe.style.opacity = "";
  }

  _dragEnd(e, dx, swipe) {
    const d = this._drag;
    if (!d) return;
    this._dragTo(dx);
    const decision = L.dragDecision(dx, d.w, swipe);
    // The page list can change under a drag (rooms come and go): only commit to the page on screen.
    if (decision === "stay" || d.nb === null || this._pageList()[d.nb] !== d.nbEl) {
      this._dragSpringBack();
      return;
    }
    const dir = decision === "next" ? "left" : "right";
    this._releasePressed();
    this._fxBurst(e, dir);
    if (this._fade()) {
      const p = L.fadeProgress(dx, d.w);
      this._go(d.nb, dir, { progress: p, ms: L.settleMs(1 - p, 1, L.MOTION.crossfadeMs) });
      return;
    }
    const moved = Math.min(d.w, Math.abs(dx));
    this._go(d.nb, dir, { progress: moved / d.w, ms: L.settleMs(d.w - moved, d.w, L.DRAG.commitMaxMs) });
  }

  // Not far enough: the page and its neighbour ease back to where they were.
  _dragSpringBack() {
    const d = this._drag;
    if (!d) return;
    this._drag = null;
    if (this._gesture) this._gesture.drag = false;
    this._stopEntrance(d);
    const o = L.dragOffsets(d.dx, d.w, L.DRAG.depth);
    const fp = L.fadeProgress(d.dx, d.w);
    this._dragClearStyles(d);
    const token = (this._navToken = (this._navToken || 0) + 1);
    const hide = () => token === this._navToken && d.nbEl && d.nbEl !== this._cur && d.nbEl.classList.add("off");
    if (!o || !o.cur) {
      hide();
      return;
    }
    if (this._fade()) {
      // Fade back: the page on screen returns to full, the neighbour to nothing (it was above, so no z-index needed
      // for the hide: it goes `off` when this finishes).
      const fo = { duration: L.settleMs(fp, L.fadeProgress(L.DRAG.commitFrac * d.w, d.w), L.DRAG.springMaxMs), easing: "ease-in-out" };
      const anims = [d.curEl.animate([{ opacity: 1 - fp }, { opacity: 1 }], fo)];
      if (d.nbEl) {
        d.nbEl.style.zIndex = "2";
        anims.push(d.nbEl.animate([{ opacity: fp, transform: `scale(${L.fadeScale(fp)})` }, { opacity: 0, transform: `scale(${L.fadeScale(0)})` }], fo));
      }
      this._slides = anims;
      const clear = () => {
        if (d.nbEl) d.nbEl.style.zIndex = "";
        hide();
      };
      anims[0].finished.then(clear, clear);
      return;
    }
    const opts = { duration: L.settleMs(Math.abs(o.cur), L.DRAG.commitFrac * d.w, L.DRAG.springMaxMs), easing: EASE_OUT };
    const x = (px) => ({ transform: `translateX(${px}px)` });
    const home = o.cur < 0 ? d.w : -d.w; // where the neighbour rests, just off screen
    const anims = [d.curEl.animate([x(o.cur), x(0)], opts)];
    if (d.curRails) anims.push(d.curRails.animate([x(o.curChrome), x(0)], opts));
    if (d.nbEl) anims.push(d.nbEl.animate([x(o.nb), x(home)], opts));
    if (d.nbEl && d.nbRails) anims.push(d.nbRails.animate([x(o.nbChrome), x(home * (L.DRAG.depth - 1))], opts));
    if (d.nbEl) {
      anims.push(this._el.wipe.animate(
        [{ transform: `translateX(${o.seam}%)`, opacity: 1 }, { transform: `translateX(${o.cur < 0 ? 100 : 0}%)`, opacity: 0 }], opts));
    }
    this._slides = anims;
    anims[0].finished.then(hide, hide);
  }

  // --- touch feedback (overlay, pointer-events: none) ------------------------------------------
  // A fixed pool of nodes, built once: three tap rings (rapid taps overlap), L.TOUCH.trailMax trail
  // dots, one burst. Every move is a transform/opacity write on an existing node.
  _buildTouchFx() {
    const fx = this._el.fx;
    const mk = (cls) => {
      const n = document.createElement("span");
      n.className = cls;
      fx.appendChild(n);
      return n;
    };
    this._fxTaps = [mk("tap"), mk("tap"), mk("tap")];
    for (const t of this._fxTaps) t.innerHTML = RETICLE;
    this._fxTapAt = 0;
    this._fxDots = Array.from({ length: L.TOUCH.trailMax }, () => mk("tdot"));
    this._fxDots.forEach((d, i) => (d.style.background = `var(--accent${["", "2", "3"][i % 3]})`)); // the trail cycles the palette
    this._fxBurstEl = mk("burst");
    this._fxBurstEl.innerHTML = '<svg viewBox="0 0 48 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5l7 7-7 7"/><path opacity=".8" style="stroke: var(--accent2)" d="M20 5l7 7-7 7"/><path opacity=".6" style="stroke: var(--accent3)" d="M32 5l7 7-7 7"/></svg>';
    this._trail = [];
  }

  _fxPoint(e) {
    const r = this._fxRect || this.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // A reticle from the touch point (it turns a little as it opens), unless the touch is on a button (its own tone ripple is the one
  // effect there). Reduced motion: a static dot for a moment instead, on buttons too.
  _fxDown(e) {
    this._fxRect = this.getBoundingClientRect();
    const p = this._fxPoint(e);
    this._fxStart = p;
    this._trail = [];
    const at = `translate(${p.x}px, ${p.y}px)`;
    if (this._reduced()) {
      const d = this._fxDots[0];
      d.style.transform = at;
      d.style.opacity = "1";
      clearTimeout(this._fxDotTimer);
      this._fxDotTimer = setTimeout(() => (d.style.opacity = "0"), L.TOUCH.reducedDotMs);
      return;
    }
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.some((n) => n && n.tagName === "BUTTON" && n.dataset && n.dataset.action)) return;
    const ring = this._fxTaps[this._fxTapAt++ % this._fxTaps.length];
    ring.animate(
      [{ transform: `${at} scale(0.15) rotate(-45deg)`, opacity: 0.9 }, { transform: `${at} scale(1) rotate(0deg)`, opacity: 0 }],
      { duration: L.TOUCH.rippleMs, easing: "ease-out" },
    );
  }

  _fxMove(e) {
    if (this._reduced()) return;
    const now = performance.now();
    if (this._fxStart) {
      // The trail starts at the touch point, but only once the finger has really moved.
      const s = this._fxStart;
      this._fxStart = null;
      this._trail = L.trailPush([], { x: s.x, y: s.y, t: now });
    }
    const p = this._fxPoint(e);
    this._trail = L.trailPush(this._trail, { x: p.x, y: p.y, t: now });
    if (!this._fxRaf) this._fxRaf = requestAnimationFrame((t) => this._fxFrame(t));
  }

  _fxFrame() {
    const f = L.trailFrame(this._trail, performance.now());
    this._fxDots.forEach((d, i) => {
      const q = f[i];
      if (q) {
        d.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) scale(${q.scale})`;
        d.style.opacity = String(q.alpha);
      } else if (d.style.opacity !== "0") {
        d.style.opacity = "0";
      }
    });
    if (f.length) {
      this._fxRaf = requestAnimationFrame((t) => this._fxFrame(t));
    } else {
      this._fxRaf = 0;
      this._trail = [];
    }
  }

  // A recognised swipe: chevrons fly from the release point the way the swipe went.
  _fxBurst(e, dir) {
    const a = L.burstAngle(dir);
    if (a === null || this._reduced()) return;
    const p = this._fxPoint(e);
    const m = this._mmPx();
    const at = (dx) => `translate(${p.x}px, ${p.y}px) rotate(${a}deg) translateX(${dx * m}px)`;
    this._fxBurstEl.animate(
      [{ transform: at(0), opacity: 0 }, { transform: at(6), opacity: 1, offset: 0.3 }, { transform: at(18), opacity: 0 }],
      { duration: L.TOUCH.burstMs, easing: "ease-out" },
    );
  }

  _gestureCancel(e) {
    if (this._gesture && e.pointerId === this._gesture.id) {
      this._gesture = null;
      this._suppressClick = true; // the browser took the gesture; never also fire a click
      this._releasePressed();
      this._dragSpringBack();
    }
  }

  setConfig(config) {
    if (config && typeof config !== "object") throw new Error("mashrabiya-card: config must be a mapping");
    this._user = config || {};
    this._cfgSig = null; // force a fresh resolve
    this._resolve();
    if (this.isConnected) this._fpsSync();
    if (this._hass) this._render();
  }

  // Resolve the dashboard's config against hass (L.resolveConfig). Discovery means the result can change
  // when entities appear, so this runs on every hass update; the card only reacts when it really changed.
  _resolve() {
    const c = L.resolveConfig(this._user, this._hass);
    const sig = JSON.stringify(c);
    if (sig === this._cfgSig) return;
    this._cfgSig = sig;
    this._config = c;
    this._roomIdx = null;
    this._pagesSig = undefined;
    this._applyConfig();
  }

  // Build everything that depends on the config, and hide the features it does not configure.
  _applyConfig() {
    const c = this._config, el = this._el;
    this._buildDetailButtons(); // also resets the render keys
    const leaving = this._btn("leaving"), lockAll = this._btn("lockAll");
    leaving.hidden = !c.leaving_script;
    lockAll.hidden = !c.locks.length;
    this._btn("more").hidden = !c.more_button; // hidden: out of the layout, the focus order and the a11y tree
    const shown = Array.from(el.controls.children).filter((b) => !b.hidden).length;
    el.controls.style.gridTemplateColumns = `repeat(${Math.max(1, shown)}, 1fr)`;
    el.doorsSec.hidden = !c.locks.length;
    el.scenesSec.hidden = !(c.scenes.entities.length || c.scenes.off);
    el.scenesTitle.hidden = !c.scenes.title;
    setText(el.scenesTitle, c.scenes.title);
    el.thermoSec.hidden = !c.climate;
    el.houseSec.hidden = !(c.person || c.air || c.internet);
    // Not on `this`: a custom element constructor may not set attributes (this runs from it). The @import must come first.
    el.font.textContent = (c.font_url ? `@import url('${c.font_url}');` : "") + `:host { --mirror-font: '${c.font_family}'; --ts: ${c.text_scale}; }`;

    if (this.isConnected) ensureDocumentFont(c.font_url);
    this._renderNews(); // the feed list may have changed
  }

  getCardSize() {
    return 20;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._syncConnection(false);
    this._resolve();
    if (first) this._tick(true);
    this._subscribeForecast();
    this._render();
  }

  connectedCallback() {
    ensureDocumentFont(this._config.font_url);
    // The frontend announces websocket drops on window ("connected" / "disconnected"); hass.connected too.
    if (!this._onConn) {
      this._onConn = (e) => {
        const d = e && e.detail;
        this._connStatus = typeof d === "string" ? d : d && typeof d.status === "string" ? d.status : undefined;
        this._syncConnection(true);
      };
    }
    window.addEventListener("connection-status", this._onConn);
    // A hidden page gets no pointerup for touches that end meanwhile: start the tracking afresh.
    if (!this._onVis)
      this._onVis = () => {
        if (!document.hidden) return;
        if (this._pointers) this._pointers.clear();
        if (this._fingerXY) this._fingerXY.clear();
        this._multi = null;
      };
    document.addEventListener("visibilitychange", this._onVis);
    this._timer = setInterval(() => this._tick(false), 1000);
    this._tick(true);
    this._subscribeForecast();
    this._fpsSync();
  }

  disconnectedCallback() {
    if (this._onConn) window.removeEventListener("connection-status", this._onConn);
    if (this._onVis) document.removeEventListener("visibilitychange", this._onVis);
    clearInterval(this._timer);
    for (const id of this._tweens.values()) cancelAnimationFrame(id);
    this._tweens.clear();
    clearTimeout(this._detailTimer);
    clearTimeout(this._wakeTimer);
    clearTimeout(this._mirrorTimer);
    clearInterval(this._swapTimer);
    this._swapTimer = null;
    cancelAnimationFrame(this._fxRaf);
    this._fxRaf = 0;
    this._fpsStop();
    const p = this._unsub;
    this._unsub = null;
    if (p) p.then((u) => typeof u === "function" && u()).catch(() => {});
  }

  // --- data -------------------------------------------------------------------------------
  _states() {
    return (this._hass && this._hass.states) || {};
  }

  _state(id) {
    const s = this._states()[id];
    return s ? s.state : undefined;
  }

  _tz() {
    return this._config.time_zone;
  }

  _subscribeForecast() {
    const conn = this._hass && this._hass.connection;
    const weather = this._config.weather;
    if (this._unsub && this._subWeather !== weather) {
      // The weather entity changed (config edit, or discovery found one): follow it.
      const old = this._unsub;
      this._unsub = null;
      this._forecast = null;
      old.then((u) => typeof u === "function" && u()).catch(() => {});
    }
    if (!conn || !weather || this._unsub || !this.isConnected) return;
    this._subWeather = weather;
    if (this._subFailedAt && Date.now() - this._subFailedAt < 60000) return;
    try {
      this._unsub = Promise.resolve(
        conn.subscribeMessage(
          (msg) => {
            this._forecast = (msg && msg.forecast) || null;
            this._renderRain();
          },
          { type: "weather/subscribe_forecast", forecast_type: "hourly", entity_id: weather },
        ),
      ).catch(() => {
        this._subFailedAt = Date.now();
        this._unsub = null;
        return null;
      });
    } catch (e) {
      this._subFailedAt = Date.now();
      this._unsub = null;
    }
  }

  // Lost connection (L.connectionDown / L.connectionLost): down for the grace period turns on the stale
  // state (.stale dims the readings; the status line leads with "Connection lost" and never says All clear).
  _syncConnection(render) {
    const down = L.connectionDown(this._hass ? this._hass.connected : undefined, this._connStatus);
    if (!down) this._downSince = null;
    else if (this._downSince === null || this._downSince === undefined) this._downSince = Date.now();
    const lost = L.connectionLost(this._downSince, Date.now());
    if (lost === !!this._lost) return;
    this._lost = lost;
    this.classList.toggle("stale", lost);
    if (render && this._hass) this._render();
  }

  // --- clock (re-renders only when the minute changes) --------------------------------------
  _tick(force) {
    if (this._hass) this._syncConnection(true); // the grace period ends between hass updates
    const now = Date.now();
    const c = L.clock(now, this._tz());
    if (!force && c.key === this._minuteKey) return;
    this._minuteKey = c.key;
    this._renderTime(c.time);
    setText(this._el.ampm, c.ampm);
    setText(this._el.date, c.date);
    this.classList.toggle("night", L.isNight(now, this._tz(), this._config.night_start, this._config.night_end));
    if (this._hass) this._syncDoorAlert(); // night dims the alert (still red)
    this._renderRain();
    this._fitTicker(); // the strip has no width while night hides it
  }

  // One span per character so only the digits that changed slide in (9:41 -> 9:42 moves one).
  _renderTime(text) {
    const box = this._el.time;
    const prev = this._timeText;
    if (prev === text) return;
    this._timeText = text;
    const changed = L.digitChanges(prev, text);
    if (!prev || prev.length !== text.length) {
      box.textContent = "";
      for (const ch of text) {
        const d = document.createElement("span");
        d.className = ch === ":" ? "d sep" : "d";
        d.textContent = ch;
        box.appendChild(d);
      }
    } else {
      Array.from(text).forEach((ch, i) => setText(box.children[i], ch));
    }
    if (prev === undefined || !this._canAnimate(0)) return;
    Array.from(box.children).forEach((d, i) => {
      if (!changed[i]) return;
      d.animate(
        [{ transform: "translateY(-40%)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 420, easing: EASE_OUT, delay: i * 30, fill: "backwards" },
      );
    });
  }

  _renderWeatherIcon(condition) {
    const anim = L.weatherAnim(condition);
    const wx = this._el.wx;
    wx.hidden = !anim;
    wx.dataset.tone = L.conditionTone(condition);
    if (!anim || wx.dataset.anim === anim) return;
    wx.dataset.anim = anim;
    wx.innerHTML = ICONS[WX[anim]];
  }

  _renderRain() {
    const r = L.rainWindow(this._forecast, Date.now(), this._tz(), 4);
    setText(this._el.rain, r || "");
    this._el.rain.hidden = !r;
  }

  // --- hass-driven parts, each behind a cheap key ------------------------------------------
  _changed(part, key) {
    if (this._keys[part] === key) return false;
    this._keys[part] = key;
    return true;
  }

  _render() {
    if (!this._hass) return;
    const s = this._states(), c = this._config;
    this._scents = this._scentsModel();

    const temp = L.tempText(L.outdoorTemp(s, c));
    setText(this._el.temp, temp);
    setText(this._el.cond, L.conditionWord(this._state(c.weather)));
    this._el.cond.dataset.tone = L.conditionTone(this._state(c.weather));
    this._renderWeatherIcon(this._state(c.weather));

    const lines = L.statusLines(L.exceptions(s, c, this._scents), !!this._lost, c.more_button);
    if (this._changed("status", JSON.stringify(lines))) this._renderStatus(lines);

    const anyLock = c.locks.some((id) => s[id]);
    const unlocked = anyLock ? L.unlockedCount(s, c.locks) : null;
    this._setSub("lockAll", anyLock ? L.lockSublabel(unlocked) : "—");
    this._btn("lockAll").dataset.tone = L.lockTone(unlocked);
    // The padlock sums up every lock (L.lockAggregate) in the severity colours: sealed ok, lifted or jammed alert.

    const agg = L.lockAggregate(s, c.locks);
    this._paintPadlock(this._btn("lockAll").querySelector(".lk"), agg.kind, false, this._canAnimate(0));
    const lit = L.lightsOn(s);
    this._setSub("lightsOff", L.lightsSublabel(lit));
    this._btn("lightsOff").dataset.tone = L.lightsTone(lit);
    if (this._lit === 0 && lit > 0 && this._canAnimate(0)) {
      // Lights came on: the bulb glows up once (opacity only).
      this._btn("lightsOff").querySelector("svg").animate(
        [{ opacity: 0.25 }, { opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }],
        { duration: 900, easing: "ease-in-out" },
      );
    }
    this._lit = lit;
    this._setSub("leaving", "");
    this._setSub("more", "");

    this._renderNews();

    // Privacy (L.privacyActive): Radar and occupancy leave the glass while it is active; _syncRooms takes
    // the Radar page out of the loop (to Main if it was on screen) and puts it back when it ends.
    this._private = L.privacyActive(c, s);
    this._syncRooms();
    const kind = this._pageKind();
    if (kind === "more") this._renderDetail();
    else if (kind === "room") this._renderRoomPage(this._cur, this._roomAt(this._page), true);
    else if (kind === "radar") this._renderRadar(this._cur);
    this._syncDoorAlert();
  }

  // --- news ticker --------------------------------------------------------------------------
  // hass updates arrive constantly; the strip is rebuilt (and its animation restarted) only when the
  // headline set itself changes.
  _renderNews() {
    const news = this._config.news;
    const s = this._states();
    const feeds = {};
    for (const n of news) feeds[n.entity] = L.newsHeadlines(s[n.entity]);
    const segs = L.tickerSegments(news, feeds);
    const reduce = !!(this._reduceMq && this._reduceMq.matches);
    const mode = L.tickerMode(this._config, reduce);
    const key = mode + "|" + (reduce ? "r|" : "m|") + JSON.stringify(segs);
    if (!this._changed("news", key)) return;
    this._segs = segs;
    const box = this._el.ticker;
    clearInterval(this._swapTimer);
    this._swapTimer = null;
    box.textContent = "";
    box.hidden = segs.length === 0;
    if (!segs.length) return;
    if (mode === "fade") this._buildSingle(box, segs, reduce);
    else this._buildStrip(box, segs);
  }

  _segNodes(segs) {
    const frag = document.createDocumentFragment();
    const dot = () => {
      const d = document.createElement("span");
      d.className = "dot";
      d.textContent = "\u2022";
      return d;
    };
    for (const seg of segs) {
      const sec = document.createElement("span");
      sec.className = "sec";
      frag.appendChild(sec);
      const lab = document.createElement("span");
      lab.className = "lab";
      lab.dataset.tone = seg.tone;
      lab.textContent = seg.label;
      frag.appendChild(lab);
      for (const t of seg.titles) {
        const h = document.createElement("span");
        h.className = "hl";
        h.textContent = t;
        const d = dot();
        d.dataset.tone = seg.tone;
        frag.append(h, d);
      }
    }
    return frag;
  }

  _buildStrip(box, segs) {
    const strip = document.createElement("div");
    strip.className = "strip";
    for (let i = 0; i < 2; i++) {
      const half = document.createElement("div");
      half.className = "half";
      if (i) half.setAttribute("aria-hidden", "true");
      half.appendChild(this._segNodes(segs));
      strip.appendChild(half);
    }
    box.appendChild(strip);
    this._strip = strip;
    this._stripSecs = 0;
    this._fitTicker();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this._fitTicker());
  }

  // Duration from the measured half width, so speed is constant whatever the content length. Only the
  // duration is touched (never the animation itself), and only when the width really changed.
  _fitTicker() {
    const strip = this._strip;
    if (!strip || !strip.isConnected) return;
    const half = strip.firstElementChild;
    const w = half ? half.getBoundingClientRect().width : 0;
    const secs = L.tickerSeconds(w, this._mmPx(), TICKER_MM_PER_S);
    if (!secs || Math.abs(secs - (this._stripSecs || 0)) < 0.5) return;
    this._stripSecs = secs;
    strip.style.setProperty("--dur", `${secs.toFixed(2)}s`);
  }

  // The default (ticker: fade), and always under reduced motion: one headline at a time, swapped every 8 s
  // with a short fade (none under reduced motion), ellipsis if it is too long. Main stays still between.
  _buildSingle(box, segs, reduce) {
    const flat = [];
    for (const seg of segs) for (const t of seg.titles) flat.push({ label: seg.label, tone: seg.tone, title: t });
    let i = 0;
    const show = () => {
      const it = flat[i % flat.length];
      box.textContent = "";
      const p = document.createElement("p");
      p.className = "single";
      p.style.margin = "0";
      const lab = document.createElement("span");
      lab.className = "lab";
      lab.dataset.tone = it.tone;
      lab.textContent = it.label;
      const h = document.createElement("span");
      h.className = "hl";
      h.textContent = it.title;
      p.append(lab, h);
      box.appendChild(p);
      if (!reduce && typeof p.animate === "function") p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease-out" });
    };
    show();
    if (flat.length > 1) {
      this._swapTimer = setInterval(() => {
        i += 1;
        show();
      }, TICKER_SWAP_MS);
    }
  }

  // `lines` from L.statusLines: the exceptions, "Connection lost" first when it is, or the calm line.
  _renderStatus(lines) {
    const box = this._el.status;
    box.textContent = "";
    const animate = this._statusShown && this._canAnimate(0);
    this._statusShown = true;
    lines.forEach((l, i) => {
      const p = document.createElement("p");
      p.className = `line ${l.level}${l.conn ? " conn" : ""}`;

      p.dataset.tone = L.statusTone(l.level);
      p.textContent = l.text;
      box.appendChild(p);
      if (animate) {
        p.animate(
          [{ opacity: 0, transform: `translateY(${2 * this._mmPx()}px)` }, { opacity: 1, transform: "none" }],
          { duration: 280, delay: i * 50, easing: EASE_OUT, fill: "backwards" },
        );
      }
    });
  }

  // The thermostat on More is the room pages' arc gauge (_gaugeNode, painted by _paintGauge): the inside
  // temperature sweeps the arc and a tick marks the target. − and + sit either side and the target is
  // written under it; a tap shows the pending target at once (tick and words) until HA confirms it or
  // 8 s pass. Built once per unit (its scale and colours depend on it), then only painted.
  _renderThermo() {
    const c = this._config;
    if (!c.climate) return;
    const cl = this._states()[c.climate];
    const a = (cl && cl.attributes) || {};
    if (this._pendingTarget !== undefined && (a.temperature === this._pendingTarget || Date.now() - this._pendingAt > 8000)) {
      this._pendingTarget = undefined;
    }
    const target = this._pendingTarget !== undefined ? this._pendingTarget : a.temperature;
    const mode = cl ? cl.state : undefined;
    const unit = c.temperature_unit;
    const reading = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    const it = {
      key: "thermostat", kind: "climate", icon: "climate", label: T.modes[mode] || (mode ? L.formatId(mode) : ""),
      tone: L.tempTone(a.current_temperature, unit), modeTone: L.modeTone(mode),
      gauge: Object.assign({ value: reading(a.current_temperature), unit }, L.tempScale(unit), { target: reading(target) }),
    };
    let g = this._thermoGauge;
    if (!g || g._unit !== unit) {
      g = this._gaugeNode(it);
      g._unit = unit;
      this._paintGauge(g, it, false); // painted before it is attached: no transition from nothing
      this._el.dial.replaceChildren(g);
      this._thermoGauge = g;
    } else this._paintGauge(g, it, true);
    setText(this._el.tgtV, L.tempText(target));
    this._el.tgtV.dataset.tone = L.modeTone(mode);
    const heat = this._btn("modeHeat"), off = this._btn("modeOff");
    heat.setAttribute("aria-pressed", String(mode === "heat"));
    heat.dataset.tone = "orange";
    off.setAttribute("aria-pressed", String(mode === "off"));
  }

  _renderDetail() {
    const s = this._states(), c = this._config;
    for (const b of this._el.doors.children) {
      setText(b.querySelector(".label"), L.doorLabel(L.entityName(s, b.dataset.lock)));
      const word = L.doorWord(this._state(b.dataset.lock), this._state(b.dataset.door));
      const lv = L.lockVisual(this._state(b.dataset.lock), this._state(b.dataset.door));
      this._paintPadlock(b.querySelector(".lk"), this._state(b.dataset.lock), lv.doorOpen, this._canAnimateEl(b), this._alertDoors && this._alertDoors.has(b.dataset.door));
      this._setSub(b, word);
      b.dataset.tone = L.doorTone(word, c.door_alert);
      const sub = b.querySelector(".sub");
      sub.classList.toggle("sec", word === T.unlocked || word === T.jammed);
      sub.classList.toggle("att", word === T.open || word === T.offline);
    }

    this._renderThermo();

    const playing = L.mediaPlayers(c, s);
    const mkey = JSON.stringify(playing.map((m) => [m.entity, this._state(m.entity), (s[m.entity].attributes || {}).media_title]));
    if (this._changed("media", mkey)) this._renderMedia(playing);

    // Only what is configured: presence (never a name, and not at all while privacy is active: "Away"
    // tells a visitor the house is empty), indoor air, the internet check.
    const facts = [];
    if (c.person && !this._private) {

      const word = L.presenceWord(this._state(c.person));
      facts.push(["", word, L.presenceTone(word), "person"]);
    }
    if (c.air) facts.push([T.airLabel, L.airWord(this._state(c.air)), L.airTone(this._state(c.air)), "air"]);
    if (c.internet) {
      const internet = this._state(c.internet);
      facts.push([T.internetLabel, internet === "on" ? T.internetOk : internet === "off" ? T.internetBad : T.none, L.internetTone(internet), "globe"]);
    }
    this._el.houseSec.hidden = !facts.length;
    if (this._changed("facts", JSON.stringify(facts))) {
      this._el.facts.innerHTML = "";
      for (const [k, v, tone, icon] of facts) {
        const span = document.createElement("span");
        span.className = "fact";
        const ic = document.createElement("span");
        ic.className = "ic";
        ic.dataset.tone = tone;
        ic.setAttribute("aria-hidden", "true");
        ic.innerHTML = ICONS[icon];
        span.append(ic, k);
        const b = document.createElement("b");
        b.textContent = v;
        b.dataset.tone = tone;
        span.appendChild(b);
        this._el.facts.appendChild(span);
      }
    }
  }

  // --- room pages: model and page bookkeeping ---------------------------------------------------
  // The area -> entities index only changes when HA replaces a registry object, so it is cached on
  // their identity; the per-room values are recomputed from states on every render.
  _roomsModel() {
    const h = this._hass;
    if (!h) return [];
    if (!this._roomIdx || h.areas !== this._regA || h.devices !== this._regD || h.entities !== this._regE) {
      this._regA = h.areas;
      this._regD = h.devices;
      this._regE = h.entities;
      this._roomIdx = L.roomIndex(h.areas, h.devices, h.entities, { order: this._config.rooms });
    }
    const unit = this._config.temperature_unit;
    return L.roomDetails(this._roomIdx, this._states(), { tempUnit: unit, scents: this._scents || [], doorFor: L.doorPairs(this._config), private: !!this._private });
  }

  // Fragrance diffusers, discovered from the registries and states (L.scentDevices); none when scent: false.
  _scentsModel() {
    const h = this._hass;
    if (!h || this._config.scent === false) return [];
    const devs = L.scentDevices(h.states, h.entities, h.devices, h.areas);
    return devs.map((d) => L.scentModel(d, h.states, { nowMs: Date.now(), tz: this._tz() }));
  }

  _pageKind(index) {
    const k = this._pageKeys[index === undefined ? this._page : index];
    return k === "main" || k === "more" || k === L.RADAR_KEY ? k : k ? "room" : null;
  }

  // mmWave radars, discovered from the states by entity pattern (L.radarList); none when disabled.
  _radarsModel() {
    const h = this._hass;
    if (!h || this._config.radar === false) return [];
    return L.radarList(h.states, h.entities, h.devices, h.areas, this._config.radar_pattern);
  }

  _pageList() {
    return this._pageKeys.map((k) => this._pageEls.get(k));
  }

  _roomAt(index) {
    const k = this._pageKeys[index];
    return this._rooms.find((r) => L.roomKey(r.id) === k) || null;
  }

  // Keep one page per room, and the Radar page while any radar exists. Pages that appear are made;
  // pages that go are dropped. The current page keeps its key (L.pageIndexFor); if the page on screen is
  // the one that went, slide home to Main.
  _syncRooms() {
    const rooms = this._roomsModel();
    this._rooms = rooms;
    this._radars = this._radarsModel();
    const keys = L.pageKeys(rooms, this._radars, this._config.pages, { private: !!this._private });
    const sig = keys.join("|") + "#" + rooms.map((r) => r.name).join("|") + "#" + this._radars.map((r) => r.prefix + "=" + r.name).join("|");
    if (sig === this._pagesSig) return;
    this._pagesSig = sig;
    const curKey = this._pageKeys[this._page];
    for (const k of keys) {
      if (this._pageEls.has(k)) continue;
      if (k === L.RADAR_KEY) this._pageEls.set(k, this._makePage(RADAR_PAGE, k));
      else if (k.startsWith("room:")) this._pageEls.set(k, this._makePage(ROOM_PAGE, k));
    }
    for (const [k, el] of Array.from(this._pageEls)) {
      if (keys.includes(k)) continue;
      this._pageEls.delete(k);
      if (el === this._cur) this._gone.add(el);
      else el.remove();
    }
    this._pageKeys = keys;
    this._el.roomsBtn.hidden = L.firstRoomIndex(keys) < 0;
    if (keys.includes(curKey)) {
      this._page = L.pageIndexFor(keys, curKey);
      this._renderPager();
    } else {
      this._page = -1;
      this._go(0);
    }
  }

  // A room or radar page from its template. The one button is the way home; it is bound like every
  // other navigation button. The page carries its own accent (L.pageAccent).
  _makePage(template, key) {
    const t = document.createElement("template");
    t.innerHTML = template.trim();
    const el = t.content.firstElementChild;
    paintPalette(el, key);
    el.querySelectorAll("button[data-action]").forEach((b) => this._bind(b));
    const body = el.querySelector(".room-body");
    body.addEventListener("scroll", () => this._scrollCue(body), { passive: true });
    this.shadowRoot.insertBefore(el, this._el.pager);
    el.inert = true;
    return el;
  }

  // A page's name as Previous / Next say it: the first page is Home.
  _pageTitle(idx) {
    const k = this._pageKeys[idx];
    return k === "main" ? T.homePage : k === "more" ? T.more : k === L.RADAR_KEY ? T.radar : (this._roomAt(idx) || {}).name || "";
  }

  // Previous / Next on a room or radar page (L.navTargets): the neighbour's name, hidden where the
  // neighbour is Main (the Home button goes there). Labels only; the taps go through _action.
  _paintNav(el, index) {
    if (!el) return;
    const t = L.navTargets(this._pageKeys, index);
    const paint = (side, to, spoken) => {
      const b = el.querySelector(`:scope > .nav.${side}`);
      if (!b) return;
      b.hidden = to === null;
      const name = to === null ? "" : this._pageTitle(to);
      setText(b.querySelector(".label"), name);
      b.setAttribute("aria-label", spoken(name));
    };
    paint("prev", t.prev, (name) => T.goPrev(name));
    paint("next", t.next, (name) => T.goNext(name));
  }

  // A neutral track segment for every page (Main first), the current one bright, and the current page's
  // Previous / Next labels. The touch layer takes the current page's accent.
  _renderPager() {
    const n = this._pageKeys.length, i = this._page;
    this._el.pager.hidden = i <= 0;
    for (const el of [this._el.pager, this._el.fx, this._el.fps, this._el.wipe]) paintPalette(el, this._pageKeys[i]);
    const track = this._el.ptrack;
    if (track.children.length !== n) {
      track.textContent = "";
      for (let k = 0; k < n; k++) track.appendChild(document.createElement("i"));
    }
    Array.from(track.children).forEach((d, k) => d.classList.toggle("on", k === i));
    track.setAttribute("aria-label", T.pageOf(i + 1, n));
    this._paintNav(this._cur, i);
  }

  // === ROOM PAGES: READ-ONLY ===
  // Everything that draws a room page. Information only: nothing in this section creates a control,
  // binds an action or calls a service (test/source.test.js holds it to that).
  // Rebuilt only when the room's items come or go; otherwise every indicator updates in place and its
  // CSS transition (stroke-dashoffset / transform) moves it from the old value to the new one.
  _renderRoomPage(el, room, animate) {
    if (!el || !room) return;
    // Which players are shown (playing first, L.mediaVisible) is part of the layout too.
    const media = L.mediaVisible(room.items.filter((i) => i.kind === "media")).shown.map((i) => i.key).join(",");
    const sig = `${room.name}|${room.items.map((i) => i.key).join(",")}|${media}|${this._config.text_scale}`;
    if (el._sig !== sig) {
      el._sig = sig;
      this._roomContent(el, room);
      return;
    }
    for (const it of room.items) {
      const n = el._nodes.get(it.key);
      if (n) this._paintItem(n, it, animate);
    }
  }

  _roomContent(el, room) {
    const body = el.querySelector(".room-body");
    const head = el.querySelector(".room-head");
    body.textContent = "";
    head.textContent = "";
    el.setAttribute("aria-label", room.name);
    el._nodes = new Map();
    const block = (cls, parent) => {
      const d = document.createElement("div");
      d.className = `${cls} brk`;
      d.dataset.stagger = "";
      (parent || body).appendChild(d);
      return d;
    };
    const add = (parent, node, it) => {
      el._nodes.set(it.key, node);
      this._paintItem(node, it, false); // painted before it is attached: no transition from nothing
      parent.appendChild(node);
    };
    const name = document.createElement("h2");
    name.className = "room-name";
    name.dataset.stagger = "";
    name.textContent = room.name;
    head.appendChild(name); // the header stays put while the body scrolls under it

    const gauges = room.items.filter((i) => i.gauge);
    if (gauges.length) {
      const g = block("gauges");
      g.dataset.n = String(gauges.length);
      for (const it of gauges) add(g, this._gaugeNode(it), it);
    }
    const air = room.items.find((i) => i.kind === "air");
    if (air) {
      const a = block("air-block");
      add(a, this._meterNode(air), air);
    }
    // One row of chips: a door paired with a lock here is said by the lock (L.roomChips).
    const chips = L.roomChips(room.items);
    if (chips.length) {
      const c = block("chips");
      for (const it of chips) add(c, this._chipNode(it), it);
    }
    const scents = room.items.filter((i) => i.kind === "scent");
    if (scents.length) {
      const w = document.createElement("div");
      w.className = "scents";
      w.dataset.cols = String(L.gridColumns(scents.length, this._config.text_scale, 2)); // diffusers side by side
      body.appendChild(w);
      for (const it of scents) add(block("scent-block", w), this._scentNode(it), it);
    }
    for (const [kind, caption] of [["light", T.lights], ["fan", T.fans], ["cover", T.blinds], ["media", T.playing]]) {
      let list = room.items.filter((i) => i.kind === kind);
      let more = 0;
      if (kind === "media") ({ shown: list, more } = L.mediaVisible(list)); // playing first, at most two
      if (!list.length) continue;
      const b = block("rows-block");
      const cap = document.createElement("p");
      cap.className = "cap micro";
      cap.textContent = more ? `${caption} · ${T.moreN(more)}` : caption;
      const grid = document.createElement("div");
      grid.className = "rows";
      grid.dataset.cols = String(L.gridColumns(list.length, this._config.text_scale));
      b.append(cap, grid);
      for (const it of list) add(grid, this._rowNode(it), it);
    }
    this._scrollCue(body);
  }

  _paintItem(node, it, animate) {
    const t = node.dataset.type;
    if (t === "gauge") this._paintGauge(node, it, animate);
    else if (t === "meter") this._paintMeter(node, it, animate);
    else if (t === "chip") this._paintChip(node, it, animate);
    else if (t === "scent") this._paintScent(node, it, animate);
    else this._paintRow(node, it, animate);
  }

  _setValue(node, sel, text, animate) {
    const v = node.querySelector(sel);
    if (!v) return;
    if (this._tweens.has(v)) {
      if (v._final === text) return; // an entrance count is on its way to this very reading
      cancelAnimationFrame(this._tweens.get(v)); // a new reading wins over the count
      this._tweens.delete(v);
    }
    const prev = v._final;
    v._final = text;
    if (v.textContent === text) return;
    const roll = v._roll; // a new reading mid-roll: the roll stops and the plain new text goes in
    v._roll = null;
    if (roll) for (const a of roll) a.cancel();
    v.textContent = text;
    const fx = animate && this._canAnimateEl(node) ? L.valueChange(prev, text) : null;
    if (!fx) return;
    // The new reading rolls in (from below when it went up), counts if it can, and a ring flashes at its icon.
    if (fx.count) this._count(v, fx.count);
    v.animate([{ transform: `translateY(${45 * fx.dir}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 380, easing: EASE_OUT });
    this._flashAt(node.querySelector(".ic") || node);
  }

  _tone(node, tone) {
    if (tone) node.dataset.tone = tone;
    else node.dataset.tone = "dim";
  }

  _labelNode(it, cls) {
    const label = document.createElement("span");
    label.className = cls ? `ml ${cls}` : "ml";
    label.textContent = it.label;
    if (it.labelSub) {
      const sub = document.createElement("sub");
      sub.textContent = it.labelSub;
      label.appendChild(sub);
    }
    return label;
  }

  _iconNode(name, cls) {
    const ic = document.createElement("span");
    ic.className = cls ? `ic ${cls}` : "ic";
    ic.setAttribute("aria-hidden", "true");
    ic.innerHTML = ICONS[name] || "";
    ic.dataset.icon = name;
    return ic;
  }

  // Arc gauge: the scale's colours as a gradient along the arc (L.gaugeStops; faint track, full value
  // arc over a wider faint halo), accent tick marks outside it, the comfort band, a ring marker at the
  // value (rotate) and a tick at the target (rotate).
  _gaugeNode(it) {
    const g = it.gauge;
    const { startDeg: a0, sweepDeg: sw } = L.GAUGE;
    const f0 = L.gaugeFraction(g.band[0], g.min, g.max), f1 = L.gaugeFraction(g.band[1], g.min, g.max);
    const len = L.arcDash(0, GR, sw).length.toFixed(2);
    const p = L.arcPoint(GX, GY, GR, a0);
    const t0 = L.arcPoint(GX, GY, GR - 5, a0), t1 = L.arcPoint(GX, GY, GR + 5, a0);
    const id = `gg${(this._gradSeq = (this._gradSeq || 0) + 1)}`;
    let last = 0;
    const stops = L.gaugeStops(it.kind, g).map((s) => {
      last = Math.max(last, L.gradientOffset(s.f)); // stop offsets may never go backwards
      return `<stop offset="${last.toFixed(3)}" data-tone="${s.tone}"/>`;
    }).join("");
    const arc = L.arcPath(GX, GY, GR, a0, sw);
    const n = document.createElement("div");
    n.className = "gauge";
    n.dataset.type = "gauge";
    n.dataset.kind = it.kind;
    n.setAttribute("role", "img");
    n.innerHTML =
      `<svg viewBox="0 0 120 88" aria-hidden="true" focusable="false">` +
      `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${GX - GR}" y1="${GY}" x2="${GX + GR}" y2="${GY}">${stops}</linearGradient></defs>` +
      `<path class="track draw" pathLength="1" d="${arc}" stroke="url(#${id})"/>` +
      `<path class="ticks draw" pathLength="1" d="${L.arcTicks(GX, GY, GR + 2.5, GR + 4.5, a0, sw, GTICKS)}"/>` +
      `<path class="band" d="${L.arcPath(GX, GY, GBAND, a0 + f0 * sw, (f1 - f0) * sw)}"/>` +
      `<path class="halo sweep" d="${arc}" stroke="url(#${id})" stroke-dasharray="${len} ${len}" data-len="${len}"/>` +
      `<path class="val sweep" d="${arc}" stroke="url(#${id})" stroke-dasharray="${len} ${len}" data-len="${len}"/>` +
      `<line class="tgt sweep" x1="${t0.x.toFixed(2)}" y1="${t0.y.toFixed(2)}" x2="${t1.x.toFixed(2)}" y2="${t1.y.toFixed(2)}"/>` +
      `<g class="mark sweep"><circle class="pulse" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.2"/><circle class="glow" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.2"/><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.2"/></g>` +
      `</svg><p class="gv"><b class="mv"></b></p><p class="gl micro"><b class="gm"></b><span class="gs"></span></p>`;
    n.querySelector(".gl").prepend(this._iconNode(it.kind === "humidity" ? "humidity" : "temperature", "gic"));
    return n;
  }

  _paintGauge(n, it, animate) {
    const g = it.gauge, sw = L.GAUGE.sweepDeg;
    const f = L.gaugeFraction(g.value, g.min, g.max);
    this._tone(n, it.tone);
    const mark = n.querySelector(".mark"), tgt = n.querySelector(".tgt");
    for (const val of n.querySelectorAll(".val, .halo")) {
      this._setMotion(val, "strokeDashoffset", L.arcDash(f, GR, sw).offset.toFixed(2));
      val.style.opacity = f === null ? "0" : "";
    }
    this._setMotion(mark, "transform", `rotate(${((f || 0) * sw).toFixed(1)}deg)`);
    if (animate && L.fractionMoved(n._f, f) && this._canAnimateEl(n)) this._pulse(mark.querySelector(".pulse"));
    n._f = f;
    mark.style.opacity = f === null ? "0" : "";
    const tf = g.target === null ? null : L.gaugeFraction(g.target, g.min, g.max);
    tgt.style.transform = `rotate(${((tf || 0) * sw).toFixed(1)}deg)`;
    tgt.style.opacity = tf === null ? "0" : "";
    const temp = it.kind !== "humidity";
    const t = L.tempText(g.value);
    const big = temp ? (t === "\u2014" ? t : t + String(g.unit || "").replace(/^°/, "")) : it.value;
    this._setValue(n, ".gv .mv", big, animate);
    const gm = n.querySelector(".gm");
    setText(gm, it.kind === "climate" ? it.label : "");
    gm.dataset.tone = it.modeTone || "dim";
    // Micro-label with the real unit: "TEMP °F", "HUM %", or the thermostat's "HEAT · TARGET 68°".
    const unit = temp ? `°${String(g.unit || "°C").replace(/^°/, "")}` : "%";
    const words = it.kind === "climate" ? `${T.targetWord} ${L.tempText(g.target)}` : temp ? `${T.tempMicro} ${unit}` : `${T.humMicro} ${unit}`;
    setText(n.querySelector(".gs"), words);
    const spoken = it.kind === "climate" ? T.spokenClimate(it.label, big, L.tempText(g.target)) : (temp ? T.spokenTemp(big) : T.spokenHum(big));
    n.setAttribute("aria-label", spoken);
  }

  // Air: label, word or reading, then the segmented meter (current segment lit in its tone).
  _meterNode(it) {
    const n = document.createElement("div");
    n.className = "meter-row";
    n.dataset.type = "meter";
    const v = document.createElement("b");
    v.className = "mv";
    const m = document.createElement("span");
    m.className = "meter";
    m.setAttribute("aria-hidden", "true");
    n.append(this._iconNode(it.icon), this._labelNode(it, "micro"), v, m);
    return n;
  }

  _paintMeter(n, it, animate) {
    this._tone(n, it.tone);
    n.querySelector(".ic").dataset.tone = it.tone || "dim";
    this._setValue(n, ".mv", it.value, animate);
    const m = n.querySelector(".meter");
    const meter = it.meter;
    m.hidden = !meter;
    if (!meter) return;
    if (m.children.length !== meter.count) {
      m.textContent = "";
      for (let k = 0; k < meter.count; k++) m.appendChild(document.createElement("i"));
    }
    Array.from(m.children).forEach((seg, k) => {
      seg.dataset.tone = meter.tones[k] || "dim";
      seg.classList.toggle("on", k === meter.index);
    });
  }

  // Occupancy and doors: icon (person lit / door ajar) and the word.
  _chipNode(it) {
    const n = document.createElement("span");
    n.className = "chip";
    n.dataset.type = "chip";
    const v = document.createElement("b");
    v.className = "mv";
    let ic = this._iconNode(it.icon);
    if (it.kind === "lock") {
      ic = document.createElement("span");
      ic.className = "ic lock-ic";
      ic.setAttribute("aria-hidden", "true");
      ic.innerHTML = LOCK_GLYPH;
    }
    n.append(ic, this._labelNode(it), v);
    return n;
  }

  _paintChip(n, it, animate) {
    this._tone(n, it.tone);
    // A configured door that is open: the stat goes alert red and breathes.
    const alert = !!this._alertDoors && ((it.kind === "door" && it.open && this._alertDoors.has(it.key.slice(5))) || (it.kind === "lock" && it.lock.doorOpen && this._alertDoors.has(it.door)));
    n.classList.toggle("alert", alert);
    if (it.kind === "lock") {
      this._paintPadlock(n.querySelector(".lk"), it.state, it.lock.doorOpen, animate && this._canAnimateEl(n), alert);
      this._setValue(n, ".mv", it.value, animate);
      return;
    }
    const want = it.kind === "door" && it.open ? (it.icon === "window" ? "windowOpen" : "doorOpen") : it.icon;
    const ic = n.querySelector(".ic");
    if (ic.dataset.icon !== want) {
      ic.dataset.icon = want;
      ic.innerHTML = ICONS[want] || "";
    }
    n.classList.toggle("lit", it.kind === "occupancy" ? !!it.on : !!it.open);
    this._setValue(n, ".mv", it.value, animate);
  }

  // Light / fan / blind / media row: icon, name, thin outlined bar (or the title), value.
  _rowNode(it) {
    const n = document.createElement("div");
    n.className = "row";
    n.dataset.type = "row";
    n.dataset.kind = it.kind;
    let ic;
    if (it.kind === "fan") ic = this._iconNode("fan", "fan-spin loop");
    else if (it.kind === "media") {
      ic = document.createElement("span");
      ic.className = "ic eq loop";
      ic.setAttribute("aria-hidden", "true");
      ic.innerHTML = EQ_BARS;
    } else ic = this._iconNode(it.icon);
    const label = this._labelNode(it);
    const v = document.createElement("b");
    v.className = "mv";
    if (it.kind === "media") {
      v.classList.add("title");
      n.append(ic, label, v);
    } else {
      const bar = document.createElement("span");
      bar.className = "bar";
      bar.setAttribute("aria-hidden", "true");
      bar.appendChild(document.createElement("i"));
      n.append(ic, label, bar, v);
    }
    return n;
  }

  _paintRow(n, it, animate) {
    this._tone(n, it.tone);
    n.classList.toggle("on", !!it.on);
    n.classList.toggle("playing", !!it.playing);
    setText(n.querySelector(".ml"), it.label);
    this._setValue(n, ".mv", it.value, animate);
    if (it.kind === "fan") n.style.setProperty("--spin", `${it.spin || 2}s`);
    const ic = n.querySelector(".ic");
    if (ic && it.kind === "light") {
      const want = it.on ? "light" : "lightOff"; // on and off are different glyphs, not just colours
      if (ic.dataset.icon !== want) {
        ic.dataset.icon = want;
        ic.innerHTML = ICONS[want];
      }
    }
    if (ic && it.color) ic.style.setProperty("--ic", it.color);
    else if (ic) ic.style.removeProperty("--ic");
    const fill = n.querySelector(".bar i");
    if (!fill) return;
    const pct = Math.max(0, Math.min(100, Number(it.pct) || 0));
    fill._f = pct / 100;
    this._setMotion(fill, "transform", `scaleX(${(pct / 100).toFixed(3)})`);
    if (it.color) fill.style.setProperty("--c", it.color);
    else fill.style.removeProperty("--c");
  }

  // A diffuser: a caption, one vial per slot (glass, liquid bar, level line, %, scent name, "Low") and the
  // intensity meter, timer ring and alternation beside them. Information only.
  _scentNode(it) {
    const n = document.createElement("div");
    n.className = "scent";
    n.dataset.type = "scent";
    n.setAttribute("role", "img");
    const cap = document.createElement("p");
    cap.className = "cap micro";
    const capText = document.createElement("span");
    capText.className = "ct";
    capText.textContent = it.label ? `${T.scent} · ${it.label}` : T.scent;
    cap.append(this._iconNode("scent"), capText);
    n.appendChild(cap);
    n._vials = it.scent.slots.map(() => {
      const v = document.createElement("div");
      v.className = "vial";
      v.innerHTML = `${VIAL}<b class="pct"></b><span class="nm ml"></span><span class="lowtag micro"></span>`;
      n.appendChild(v);
      return v;
    });
    const info = document.createElement("div");
    info.className = "scent-info";
    info.innerHTML =
      `<b class="iw mv"></b><span class="imeter" aria-hidden="true">${"<i></i>".repeat(5)}</span>` +
      `<span class="timer" hidden><svg viewBox="0 0 20 20" aria-hidden="true"><circle class="tk" cx="10" cy="10" r="8"/><circle class="arc" cx="10" cy="10" r="8" pathLength="1"/></svg><span class="tt ml"></span></span>` +
      `<span class="alt micro"></span>`;
    n.appendChild(info);
    return n;
  }

  _paintScent(n, it, animate) {
    const m = it.scent;
    this._tone(n, it.tone);
    n.classList.toggle("offline", !m.online);
    const spoken = [];
    m.slots.forEach((slot, k) => {
      const v = n._vials[k];
      if (!v) return;
      v.style.setProperty("--vc", slot.color);
      v.classList.toggle("on", m.active === slot.n);
      v.classList.toggle("run", m.running);
      v.classList.toggle("low", slot.low);
      const f = slot.pct === null ? 0 : slot.pct / 100;
      v._f = slot.pct === null ? null : f;
      this._setMotion(v.querySelector(".lq"), "transform", `scaleY(${f.toFixed(3)})`);
      this._setMotion(v.querySelector(".lvl"), "transform", `translate(0px, ${(-VIAL_H * f).toFixed(2)}px)`);
      this._setValue(v, ".pct", slot.pct === null ? T.none : `${slot.pct}%`, animate);
      setText(v.querySelector(".nm"), slot.name || "");
      setText(v.querySelector(".lowtag"), slot.low ? T.low : "");
      spoken.push(T.spokenVial(slot.n, slot.name, slot.pct, slot.low));
    });
    this._setValue(n, ".iw", it.value, animate);
    const act = m.slots.find((x) => x.n === m.active);
    const iw = n.querySelector(".iw");
    if (m.running && act) iw.style.setProperty("--iw", act.color);
    else iw.style.removeProperty("--iw");
    const step = m.running && m.intensity ? m.intensity.step : 0;
    Array.from(n.querySelectorAll(".imeter i")).forEach((seg, k) => seg.classList.toggle("on", k < step));
    const timer = n.querySelector(".timer");
    timer.hidden = !m.timer;
    if (m.timer) {
      n.querySelector(".timer .arc").style.strokeDashoffset = (1 - m.timer.fraction).toFixed(3);
      setText(n.querySelector(".tt"), m.timer.text);
    }
    setText(n.querySelector(".alt"), m.alternate ? T.alternating : "");
    n.setAttribute("aria-label", T.spokenScent(m.name, it.value, spoken.join(", ")));
  }

  // The fade at a cut edge and the "More" hint above the navigation row (L.scrollCue), for every
  // scrolling body: rooms, radar and More.
  _scrollCue(body) {
    if (!body) return;
    const cue = L.scrollCue(body.scrollTop, body.clientHeight, body.scrollHeight);
    body.classList.toggle("above", cue.above);
    body.classList.toggle("below", cue.below);
    const page = body.closest(".page");
    const hint = page && page.querySelector(".more-hint");
    if (hint) hint.hidden = !cue.below;
  }

  // === END ROOM PAGES ===

  // === RADAR PAGE: READ-ONLY ===
  // One scope per discovered radar (this._radars, from L.radarList). Information only: nothing in this
  // section creates a control, binds an action or calls a service (test/source.test.js).
  // Built once per radar set; every hass update then moves the existing target nodes (transform only).
  _renderRadar(el) {
    if (!el) return;
    const list = this._radars;
    const sig = list.map((r) => `${r.prefix}=${r.name}`).join("|");
    if (el._sig !== sig) {
      el._sig = sig;
      this._radarContent(el, list);
    }
    const s = this._states();
    for (const r of list) {
      const node = el._scopes.get(r.prefix);
      if (node) this._paintScope(node, L.radarModel(r.prefix, s, this._config.radar_pattern));
    }
  }

  _radarContent(el, list) {
    const body = el.querySelector(".room-body");
    const head = el.querySelector(".room-head");
    body.textContent = "";
    head.textContent = "";
    el._scopes = new Map();
    const text = (tag, cls, value) => {
      const n = document.createElement(tag);
      n.className = cls;
      n.textContent = value;
      return n;
    };
    const title = text("h2", "radar-title", T.radar);
    title.dataset.stagger = "";
    const sub = text("p", "radar-sub micro", T.radarSub(list.length));
    const grid = document.createElement("div");
    grid.className = "radar-grid";
    grid.dataset.n = String(list.length);
    for (const r of list) {
      const node = this._scopeNode(r);
      el._scopes.set(r.prefix, node);
      grid.appendChild(node);
    }
    head.append(title, sub); // fixed: the scopes scroll under it if they must
    body.appendChild(grid);
    this._fitScopes(el);
  }

  // Columns and scope size for the height on screen (L.scopeSize): read once when the scopes are built and
  // on each entry (text_scale moves the header), never per update.
  _fitScopes(el) {
    const body = el && el.querySelector(".room-body");
    const grid = body && body.querySelector(".radar-grid");
    if (!grid) return;
    const mm = this._mmPx();
    const cs = getComputedStyle(body);
    const n = grid.children.length;
    const h = (body.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0)) / mm;
    // The columns first (they depend on the count only): in two columns a scope's name and count stack,
    // so the name line is measured after.
    grid.dataset.cols = String(L.scopeSize(n, h, grid.clientWidth / mm).cols);
    const headEl = grid.querySelector(".scope-head");
    const fit = L.scopeSize(n, h, grid.clientWidth / mm, { headMm: headEl ? headEl.getBoundingClientRect().height / mm : undefined });
    grid.style.setProperty("--fw", `calc(${fit.width.toFixed(1)} * var(--mm))`);
    this._scrollCue(body);
  }

  // A scope: name and counts, then the field (geometry SVG, the sweep, and per target a fixed pool of
  // trail dots plus the target itself, each a full-field box moved by a % translate).
  _scopeNode(r) {
    const n = document.createElement("div");
    n.className = "scope brk";
    n.dataset.stagger = "";
    n.setAttribute("role", "img");
    const head = document.createElement("div");
    head.className = "scope-head";
    const name = document.createElement("span");
    name.className = "scope-name";
    name.textContent = r.name;
    const count = document.createElement("span");
    count.className = "scope-count micro";
    head.append(name, count);
    const field = document.createElement("div");
    field.className = "field";
    const geo = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    geo.setAttribute("aria-hidden", "true");
    geo.setAttribute("viewBox", `${(-SCOPE_W / 2).toFixed(3)} ${-SCOPE} ${SCOPE_W.toFixed(3)} ${SCOPE}`);
    const scan = document.createElement("div");
    scan.className = "scan loop";
    scan.setAttribute("aria-hidden", "true");
    const id = `sw${(this._gradSeq = (this._gradSeq || 0) + 1)}`;
    // The scan line fades toward the sensor, with a long tail of fainter lines behind it that shades from
    // the page's third hue (oldest) through the second to the accent at the leading edge.
    const tail = [[-18, 0.05, 3], [-16, 0.07, 3], [-14, 0.09, 3], [-12, 0.12, 2], [-10, 0.15, 2], [-8, 0.19, 2], [-6, 0.24, 2], [-4, 0.3, 1], [-2, 0.42, 1]];
    const grad = (k, v) => `<linearGradient id="${id}${k}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${-SCOPE}">` +
      `<stop offset="0" style="stop-color: var(${v}); stop-opacity: 0.1"/><stop offset="1" style="stop-color: var(${v}); stop-opacity: 1"/></linearGradient>`;
    scan.innerHTML =
      `<svg viewBox="${(-SCOPE_W / 2).toFixed(3)} ${-SCOPE} ${SCOPE_W.toFixed(3)} ${SCOPE}">` +
      `<defs>${grad("", "--accent")}${grad("b", "--accent2")}${grad("c", "--accent3")}</defs>` +
      tail.map(([a, o, k]) => `<line x1="0" y1="0" x2="0" y2="${-SCOPE}" transform="rotate(${a})" stroke="url(#${id}${["", "", "b", "c"][k]})" stroke-width="0.6" opacity="${o}"/>`).join("") +
      `<line x1="0" y1="0" x2="0" y2="${-SCOPE}" stroke="url(#${id})" stroke-width="3" opacity="0.2"/>` +
      `<line x1="0" y1="0" x2="0" y2="${-SCOPE}" stroke="url(#${id})" stroke-width="0.9"/></svg>`;
    const clip = document.createElement("div");
    clip.className = "scan-clip";
    clip.setAttribute("aria-hidden", "true");
    clip.appendChild(scan);
    field.append(geo, clip);
    n._targets = [];
    L.RADAR.targetColors.forEach((color, i) => {
      const trail = [];
      for (let k = 0; k < L.RADAR.trailMax - 1; k++) {
        const d = document.createElement("span");
        d.className = "tr";
        d.style.setProperty("--tc", color);
        d.appendChild(document.createElement("i"));
        field.appendChild(d);
        trail.push(d);
      }
      const t = document.createElement("span");
      t.className = "tg";
      t.style.setProperty("--tc", color);
      t.innerHTML = `<i class="vec"></i><i class="ring-g"></i><i class="ring-h"></i><i class="ring-o"></i><i class="dot-c"></i><b class="spd"></b>`;
      field.appendChild(t);
      n._targets[i] = { el: t, spd: t.querySelector(".spd"), vec: t.querySelector(".vec"), trail };
    });
    n.append(head, field);
    n._name = r.name;
    n._prefix = r.prefix;
    n._count = count;
    n._geo = geo;
    n._field = field;
    return n;
  }

  // Range rings, rim ticks every 15 degrees, the zone and the sensor: rebuilt only when the range or
  // the zone changes. Ring labels are HTML (crisp at any scope size), placed by % of the field.
  _scopeGeometry(node, m) {
    const key = `${m.rangeMm}|${JSON.stringify(m.zone)}`;
    if (node._geoKey === key) return;
    node._geoKey = key;
    const rings = L.radarRings(m.rangeMm, SCOPE);
    const z = L.radarZoneRect(m.zone, m.rangeMm, SCOPE);
    const half = L.RADAR.halfDeg;
    node._geo.innerHTML =
      `<path class="wedge-glow" d="${L.radarWedgePath(SCOPE)}"/>` +
      `<path class="wedge draw" pathLength="1" d="${L.radarWedgePath(SCOPE)}"/>` +
      rings.map((r, i) => `<path class="ring draw" pathLength="1" style="--k: ${L.ringMix(i, rings.length)}%" d="${L.radarRingArc(r.r)}"/>`).join("") +
      `<path class="rim-ticks" d="${L.arcTicks(0, 0, SCOPE, SCOPE + 3, -90 - half, 2 * half, (2 * half) / 15 + 1)}"/>` +
      (z ? `<rect class="zone-glow" x="${z.x.toFixed(2)}" y="${z.y.toFixed(2)}" width="${z.w.toFixed(2)}" height="${z.h.toFixed(2)}"/><rect class="zone" x="${z.x.toFixed(2)}" y="${z.y.toFixed(2)}" width="${z.w.toFixed(2)}" height="${z.h.toFixed(2)}"/>` : "") +
      `<circle class="origin" cx="0" cy="0" r="2.2"/>`;
    node._field.querySelectorAll(".rl").forEach((l) => l.remove());
    const sin = Math.sin((half * Math.PI) / 180), cos = Math.cos((half * Math.PI) / 180);
    for (const r of rings) {
      const l = document.createElement("span");
      l.className = "rl";
      l.textContent = r.label;
      l.style.left = `${(((SCOPE_W / 2 - r.r * sin) / SCOPE_W) * 100).toFixed(2)}%`;
      l.style.top = `${(((SCOPE - r.r * cos) / SCOPE) * 100).toFixed(2)}%`;
      node._field.insertBefore(l, node._geo.nextSibling);
    }
  }

  _paintScope(node, m) {
    this._scopeGeometry(node, m);
    node.classList.toggle("idle", !m.active);
    setText(node._count, `${m.count ? T.targetsN(m.count) : T.clear} · ${(m.rangeMm / 1000).toFixed(1)} m`);
    node._count.dataset.tone = m.count ? "green" : "dim";
    node.setAttribute("aria-label", T.peopleInView(node._name, m.count));
    const pct = (p) => `translate(${((p.x / SCOPE_W) * 100).toFixed(2)}%, ${((p.y / SCOPE) * 100).toFixed(2)}%)`;
    node._targets.forEach((slot, i) => {
      const t = m.targets.find((x) => x.n === i + 1);
      const key = `${node._prefix}:${i + 1}`;
      const p = t && t.active ? L.radarProject(t.x, t.y, m.rangeMm, SCOPE) : null;
      if (!p) {
        slot.el.classList.remove("on");
        slot.vec.classList.remove("on");
        this._radarTrails.delete(key);
        for (const d of slot.trail) if (d.style.opacity !== "0") d.style.opacity = "0";
        return;
      }
      slot.el.style.transform = pct(p);
      slot.el.classList.add("on");
      setText(slot.spd, L.radarSpeedText(t.speed, t.speedUnit) || "");
      const trail = L.radarTrailPush(this._radarTrails.get(key), { x: t.x, y: t.y });
      this._radarTrails.set(key, trail);
      // Speed vector: which way and how fast (L.radarVector), from the target's own colour to the page's second hue.
      const vec = L.radarVector(trail, t.speed, t.speedUnit);
      slot.vec.classList.toggle("on", !!vec);
      if (vec) slot.vec.style.transform = `rotate(${vec.deg.toFixed(1)}deg) scaleX(${vec.len})`;
      const older = trail.slice(0, -1).reverse(); // newest first; the newest position is the target itself
      slot.trail.forEach((d, k) => {
        const q = older[k] && L.radarProject(older[k].x, older[k].y, m.rangeMm, SCOPE);
        if (!q) {
          d.style.opacity = "0";
          return;
        }
        d.style.transform = pct(q);
        d.style.opacity = (0.5 * (1 - k / slot.trail.length)).toFixed(2);
      });
    });
  }
  // === END RADAR PAGE ===

  // Now Playing: per player the equaliser glyph (moving while it plays: a loop, so never at night, off
  // screen or under reduced motion), its name as a micro-label over a larger title, and play/pause.
  _renderMedia(playing) {
    const list = this._el.mediaList;
    list.textContent = "";
    this._el.mediaSec.hidden = playing.length === 0;
    for (const m of playing) {
      const st = this._states()[m.entity];
      const a = st.attributes || {};
      const on = st.state === "playing";
      const row = document.createElement("div");
      row.className = "media";
      row.classList.toggle("playing", on);
      const eq = document.createElement("span");
      eq.className = "ic eq loop";
      eq.setAttribute("aria-hidden", "true");
      eq.dataset.tone = on ? "purple" : "dim";
      eq.innerHTML = EQ_BARS;
      const text = document.createElement("div");
      text.className = "mtext";
      const name = document.createElement("p");
      name.className = "micro mname";
      name.textContent = m.name;
      const title = document.createElement("p");
      title.className = "title";
      title.textContent = a.media_title || a.app_name || T.playing;
      text.append(name, title);
      const btn = document.createElement("button");
      btn.className = "small";
      btn.dataset.action = "playPause";
      btn.dataset.entity = m.entity;
      btn.setAttribute("aria-label", `${on ? T.pause : T.play}: ${m.name}`);
      btn.innerHTML = `${on ? ICONS.pause : ICONS.play}<span class="label">${on ? T.pause : T.play}</span><span class="sub"></span>`;
      btn.dataset.tone = "purple";
      this._bind(btn);
      row.append(eq, text, btn);
      list.appendChild(row);
    }
  }

  // More's instruments: one padlock per lock (a tap may only lock: lockOne) and one glyph per scene, each
  // a row laid out by L.moreRows (_layoutRow); a scenes `off` sits in the heading beside the title, so
  // it never pushes a scene onto a row of its own.
  _buildDetailButtons() {
    const c = this._config;
    const doors = this._el.doors, scenes = this._el.scenes;
    doors.textContent = "";
    c.locks.forEach((lock, i) => {
      const b = document.createElement("button");
      b.className = "padlock-inst";
      b.dataset.action = "lockOne";
      b.dataset.lock = lock;
      b.dataset.door = c.doors[i] || "";
      b.innerHTML = `${LOCK_GLYPH}<span class="label"></span><span class="sub"></span>`;
      b.querySelector(".label").textContent = L.doorLabel(L.formatId(lock));
      doors.appendChild(b);
      this._bind(b);
    });
    this._layoutRow(doors, L.moreRows("doors", c.locks.length, c.text_scale));
    scenes.textContent = "";
    this._el.scenesOff.textContent = "";
    const item = (it, action, cls, icon) => {
      const b = document.createElement("button");
      b.className = cls;
      b.dataset.action = action;
      b.dataset.entity = it.entity;
      b.innerHTML = `${icon}<span class="label"></span><span class="sub"></span>`;
      b.querySelector(".label").textContent = it.name;
      this._bind(b);
      return b;
    };
    for (const it of c.scenes.entities) {
      const b = item(it, "scene", "scene-inst", ICONS.scene);
      b.dataset.tone = "yellow";
      scenes.appendChild(b);
    }
    this._layoutRow(scenes, L.moreRows("scenes", c.scenes.entities.length, c.text_scale));
    if (c.scenes.off) this._el.scenesOff.appendChild(item(c.scenes.off, "roomOff", "small off-btn", ICONS.power));
    this._keys = {};
  }

  // A row of instruments split into rows by L.moreRows (e.g. [3, 2]): twice as many half-columns as the
  // widest row, every item two half-columns wide, and each row's first item placed so a shorter row sits
  // centred under the longer one. The children stay flat (door alerts and painting walk them).
  _layoutRow(box, split) {
    const cols = split[0] || 1;
    box.style.gridTemplateColumns = `repeat(${2 * cols}, minmax(0, 1fr))`;
    const kids = Array.from(box.children);
    let i = 0;
    for (const k of split) {
      kids.slice(i, i + k).forEach((b, j) => {
        b.style.gridColumn = j === 0 ? `${1 + cols - k} / span 2` : "span 2";
      });
      i += k;
    }
  }

  // --- buttons ------------------------------------------------------------------------------
  _btn(ref) {
    return typeof ref === "string" ? this.shadowRoot.querySelector(`[data-action="${ref}"]`) : ref;
  }

  // Normal sub-label; a pending flash ("Locked", "Failed — try again") wins until it expires.
  // A changed sub-label counts ("5 on" -> "7 on") or crossfades; an unchanged one is left alone so a
  // count in progress is not cut short by the next hass update.
  _setSub(ref, text) {
    const b = this._btn(ref);
    if (!b) return;
    const old = b._sub;
    if (old === text) return;
    b._sub = text;
    if (this._flashes.has(b)) return;
    this._paintSub(b, text, "");
    const sub = b.querySelector(".sub");
    if (old === undefined || !sub || !this._canAnimateEl(b)) return;
    const t = L.numberTween(old, text);
    if (t) this._count(sub, t);
    else if (text) this._fadeIn(sub);
  }

  _count(el, t) {
    cancelAnimationFrame(this._tweens.get(el));
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / t.ms);
      setText(el, L.tweenAt(t, 1 - Math.pow(1 - p, 3)));
      if (p < 1) this._tweens.set(el, requestAnimationFrame(step));
      else this._tweens.delete(el);
    };
    setText(el, L.tweenAt(t, 0));
    this._tweens.set(el, requestAnimationFrame(step));
  }

  // A padlock glyph (LOCK_GLYPH) for an HA lock state, or an aggregate kind. A real change plays its
  // transition (L.lockTransition): "lift" springs the shackle open (the CSS transition overshoots),
  // "snap" drops it shut with a green ring burst, "jam" shakes once.
  _paintPadlock(lk, state, doorOpen, animate, alert) {
    if (!lk) return;
    const pad = lk.querySelector(".padlock");
    const v = L.lockVisual(state);
    const kind = ["locked", "unlocked", "jammed", "moving", "offline"].includes(state) ? state : v.kind;
    const prev = lk._state;
    lk._state = state;
    pad.dataset.lock = kind;
    pad.dataset.tone = L.lockVisual(kind === "moving" ? "locking" : kind).tone;
    lk.classList.toggle("door-open", !!doorOpen);
    lk.classList.toggle("alert", !!alert);
    const tr = animate && !this._reduced() ? L.lockTransition(prev, state) : null;
    if (tr === "snap") {
      const burst = pad.querySelector(".burst");
      burst.animate([{ transform: "scale(0.6)", opacity: 0.95 }, { transform: "scale(1.9)", opacity: 0 }], { duration: 420, easing: "ease-out" });
    } else if (tr === "jam") {
      pad.animate([0, -1.5, 1.5, -1, 1, 0].map((x) => ({ transform: `translateX(${x * this._mmPx()}px)` })), { duration: 380, easing: "ease-in-out" });
    }
  }

  // OPEN-DOOR ALERT: any configured door open (L.openDoors) makes its alert breathe red: the Main status
  // line (text and ring), the door's chip on its room page, its button on More. All share one start time
  // so every visible instance pulses together. The mode (L.doorAlertMode) follows night (dimmer, still
  // red) and reduced motion (steady); a door that closes drops its alert class and the breath stops.
  _syncDoorAlert() {
    const c = this._config;
    const open = c.door_alert === false ? [] : L.openDoors(this._states(), c);
    const before = this._alertDoors;
    this._alertDoors = new Set(open);
    if (this._mirror && L.mirrorAlertExit(before, open)) this._mirrorExit(true); // safety: a new door alert ends mirror mode
    const m = L.doorAlertMode(open.length, this.classList.contains("night"), this._reduced());
    const key = `${m.mode}|${m.peak}`;
    if (key !== this._alertKey) {
      this._alertKey = key;
      this._alertT0 = m.mode === "breathe" ? document.timeline.currentTime : undefined;
    }
    for (const b of this._el.doors.children) b.classList.toggle("alert", this._alertDoors.has(b.dataset.door));
    this._alertMarks(m);
  }

  // Only the marks breathe, between m.min and m.peak: the status line's ring (::before), the room chip's
  // icon and padlock door, More's door glyph. The words stay steady (Apple HIG: legible, never hidden by motion).
  _alertMarks(m) {
    const q = (root, sel) => Array.from(root.querySelectorAll(sel));
    const marks = [
      ...q(this._el.status, ".line.alert").map((el) => [el, "::before"]),
      ...q(this.shadowRoot, ".chip.alert .ic, .lk.alert .lk-door, .doors button.alert .lk").map((el) => [el, null]),
    ];
    const live = new Set();
    for (const [el, pseudoElement] of marks) {
      const slot = `_breath_ring${pseudoElement ? "p" : ""}`;
      live.add(el);
      if (el[slot + "Key"] === this._alertKey && el[slot] && el[slot].playState !== "idle") continue;
      if (el[slot]) el[slot].cancel();
      el[slot] = null;
      el[slot + "Key"] = this._alertKey;
      if (m.mode !== "breathe") continue;
      const opts = { duration: m.periodMs, iterations: Infinity, easing: "ease-in-out" };
      if (pseudoElement) opts.pseudoElement = pseudoElement;
      el[slot] = el.animate([{ opacity: m.min }, { opacity: m.peak }, { opacity: m.min }], opts);
      if (this._alertT0 !== undefined) el[slot].startTime = this._alertT0;
    }
    // Anything that stopped being an alert (door closed) stops breathing.
    for (const el of this.shadowRoot.querySelectorAll(".line, .chip, .chip *, .doors button, .doors button *")) {
      if (live.has(el)) continue;
      for (const slot of ["_breath_ring", "_breath_ringp"]) {
        if (!el[slot]) continue;
        const from = Number(getComputedStyle(el, slot === "_breath_ringp" ? "::before" : null).opacity);
        el[slot].cancel();
        el[slot] = null;
        el[slot + "Key"] = undefined;
        if (!this._reduced() && from > 0 && from < 1) {
          const o = { duration: L.ALERT.fadeOutMs, easing: "ease-out" };
          if (slot === "_breath_ringp") o.pseudoElement = "::before";
          el.animate([{ opacity: from }, { opacity: 1 }], o);
        }
      }
    }
  }

  // A small ring in the stat's tone flashes out from `host` (a changed reading).
  _flashAt(host) {
    if (!host || this._reduced()) return;
    const f = document.createElement("span");
    f.className = "flash";
    f.setAttribute("aria-hidden", "true");
    host.appendChild(f);
    const a = f.animate([{ transform: "scale(0.3)", opacity: 0.95 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 520, easing: "ease-out" });
    a.finished.then(() => f.remove(), () => f.remove());
  }

  // A gauge marker whose value moved: a ring pulses out of it L.LOOPS.pulseCount times, then stops.
  _pulse(ring) {
    if (!ring || this._reduced()) return;
    ring.animate([{ transform: "scale(1)", opacity: 0.9 }, { transform: "scale(3)", opacity: 0 }], { duration: L.LOOPS.pulseMs, iterations: L.LOOPS.pulseCount, easing: "ease-out" });
  }

  // Sets a transform or stroke-dashoffset that a CSS transition carries to its new value. When the value
  // really changed while an entrance settle is still playing on `el`, the settle stops where it is on
  // screen first, so the transition runs on from there (never a jump back to where it started).
  _setMotion(el, prop, value) {
    if (el._want === value) return;
    el._want = value;
    this._unsettle(el);
    el.style[prop] = value;
  }

  // Stops `el`'s entrance settle, keeping what is on screen (commitStyles) without a transition to it.
  _unsettle(el) {
    const anims = el._settle;
    if (!anims) return;
    el._settle = null;
    el.style.transition = "none";
    for (const a of anims) {
      if (a.playState !== "finished") {
        try {
          a.commitStyles();
        } catch (e) {
          // not rendered (a hidden page): nothing on screen to keep
        }
      }
      a.cancel();
    }
    getComputedStyle(el).getPropertyValue("transform"); // flush: the kept value lands with no transition
    el.style.removeProperty("transition");
  }

  _fadeIn(el, ms) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms || 240, easing: "ease-out" });
  }

  _paintSub(b, text, cls) {
    const sub = b.querySelector(".sub") || (b.dataset.action.startsWith("temp") ? this._el.tgtSub : null);
    if (!sub) return;
    cancelAnimationFrame(this._tweens.get(sub));
    this._tweens.delete(sub);
    const tick = sub.querySelector(".check");
    if (tick) tick.remove();
    setText(sub, text);
    sub.classList.toggle("ok", cls === "ok");
    sub.classList.toggle("fail", cls === "fail");
    const label = b.querySelector(".label");
    if (label && !b.classList.contains("step")) b.setAttribute("aria-label", text ? `${label.textContent}, ${text}` : label.textContent);
  }

  _flash(b, text, cls, ms) {
    clearTimeout(this._flashes.get(b));
    this._paintSub(b, text, cls);
    if (cls === "ok") {
      // The tick draws itself (stroke-dashoffset); under reduced motion it is simply there.
      const sub = b.querySelector(".sub") || this._el.tgtSub;
      if (sub) sub.insertAdjacentHTML("afterbegin", '<svg class="check" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M4 12.5l5 5L20 6.5"/></svg>');
    } else if (cls === "fail" && !this._reduced()) {
      const m = this._mmPx();
      b.animate(
        [0, -2, 2, -1.5, 1, 0].map((x) => ({ transform: `translateX(${x * m}px)` })),
        { duration: 380, easing: "ease-in-out" },
      );
    }
    this._flashes.set(b, setTimeout(() => {
      this._flashes.delete(b);
      if (b.dataset.action.startsWith("temp")) this._paintSub(b, "", ""); // the step's word (Set, Failed) goes
      else this._paintSub(b, b._sub || "", "");
    }, ms));
  }

  _bind(b) {
    const release = () => b.classList.remove("pressed");
    b.addEventListener("pointerdown", (e) => {
      b.classList.add("pressed");
      this._ripple(b, e);
      this.dispatchEvent(new CustomEvent("mirror-tap", { bubbles: true, composed: true, detail: { action: b.dataset.action } }));
    });
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    b.addEventListener("pointerleave", release);
    b.addEventListener("click", () => {
      if (this._suppressClick) return; // the touch was a drag or swipe, not a tap
      this._activate(b);
    });
  }

  // A thin ring in the button's tone expands from the finger and fades (CSS keyframes, 460 ms).
  _ripple(b, e) {
    if (this._reduced() || !this._primary(e)) return;
    const r = b.getBoundingClientRect();
    const rip = document.createElement("span");
    rip.className = "ripple";
    rip.style.left = `${e.clientX - r.left}px`;
    rip.style.top = `${e.clientY - r.top}px`;
    b.appendChild(rip);
    setTimeout(() => rip.remove(), 600);
  }

  _activate(b) {
    const now = Date.now();
    if (!L.debounceOk(this._last.get(b), now, 700)) return;
    this._last.set(b, now);
    const spec = this._action(b);
    if (!spec) return;
    if (!spec.call) {
      if (spec.done) this._flash(b, spec.done, "ok", FLASH_MS);
      return;
    }
    let p;
    try {
      p = Promise.resolve(spec.call()); // synchronously, so the call leaves within the tap's frame
    } catch (e) {
      p = Promise.reject(e);
    }
    p.then(() => spec.done && this._flash(b, spec.done, "ok", FLASH_MS))
      .catch(() => this._flash(b, T.failed, "fail", FAIL_MS));
  }

  // Every service this card can call. Locks: lock.lock only.
  _action(b) {
    const h = this._hass, c = this._config, d = b.dataset;
    const call = (domain, service, data) => () => {
      if (!h) throw new Error("no hass");
      return h.callService(domain, service, data);
    };
    switch (d.action) {
      case "leaving":
        return { call: call("script", "turn_on", { entity_id: c.leaving_script }), done: T.done };
      case "lockAll": {
        // Only locks that are reachable and not locked: one offline lock must not fail the whole call.
        const targets = L.locksToLock(this._states(), c.locks);
        if (!targets.length) return { done: c.locks.some((id) => this._state(id) === "locked") ? T.locked : T.offline };
        return { call: () => h.callService('lock', 'lock', { entity_id: targets }), done: T.locked };
      }
      case "lightsOff":
        return { call: call("light", "turn_off", { entity_id: "all" }), done: T.done };
      case "more":
        this._go(this._pageKeys.indexOf("more"));
        return null;
      case "rooms": {
        const first = L.firstRoomIndex(this._pageKeys);
        if (first > 0) this._go(first);
        return null;
      }
      case "prev":
      case "next": {
        const t = L.navTargets(this._pageKeys, this._page);
        const to = d.action === "prev" ? t.prev : t.next;
        if (to !== null) this._go(to, d.action === "prev" ? "right" : "left");
        return null;
      }
      case "home":
        this._go(0);
        return null;
      case "lockOne":
        return { call: () => h.callService('lock', 'lock', { entity_id: d.lock }), done: T.locked };
      case "scene":
        return { call: call("scene", "turn_on", { entity_id: d.entity }), done: T.done };
      case "roomOff":
        return { call: call("light", "turn_off", { entity_id: d.entity }), done: T.done };
      case "tempUp":
      case "tempDown": {
        const cl = this._states()[c.climate];
        const a = (cl && cl.attributes) || {};
        const cur = this._pendingTarget !== undefined ? this._pendingTarget : a.temperature;
        const fahrenheit = /f$/i.test(c.temperature_unit);
        const next = L.stepTarget(cur, d.action === "tempUp" ? 1 : -1, Number(a.min_temp) || (fahrenheit ? 45 : 7), Number(a.max_temp) || (fahrenheit ? 90 : 32));
        if (next === null) return { call: () => Promise.reject(new Error("no target")) };
        this._pendingTarget = next;
        this._pendingAt = Date.now();
        this._renderThermo(); // the tick and the words move at once; HA confirms later
        return { call: call("climate", "set_temperature", { entity_id: c.climate, temperature: next }), done: T.set };
      }
      case "modeHeat":
      case "modeOff":
        return { call: call("climate", "set_hvac_mode", { entity_id: c.climate, hvac_mode: d.action === "modeHeat" ? "heat" : "off" }), done: T.done };
      case "playPause":
        return { call: call("media_player", "media_play_pause", { entity_id: d.entity }), done: T.done };
      default:
        return null;
    }
  }

  // --- pages ------------------------------------------------------------------------------
  // Pages crossfade instead of sliding (config `transition: fade`); reduced motion keeps its own paths.
  _fade() {
    return this._config.transition === "fade" && !this._reduced();
  }

  _reduced() {
    return !!(this._reduceMq && this._reduceMq.matches);
  }

  // Scripted motion only on the page being looked at, and never under reduced motion.
  _canAnimate(index) {
    return !this._reduced() && this._page === index && this.isConnected;
  }

  _canAnimateEl(el) {
    return !this._reduced() && this.isConnected && !!el.closest && el.closest(".page") === this._cur;
  }

  // Bring page `to` up to date before it is seen (it is about to slide in, or a drag is uncovering it).
  _preparePage(to) {
    const el = this._pageList()[to];
    const kind = this._pageKind(to);
    if (kind === "more") {
      this._keys.media = this._keys.facts = undefined;
      this._renderDetail();
      const panes = el.querySelector(".panes"); // every entry starts at the top
      panes.scrollTop = 0;
      this._scrollCue(panes);
    }
    if (kind === "room" || kind === "radar") this._paintNav(el, to);
    if (kind === "room") {
      this._renderRoomPage(el, this._roomAt(to), false);
      const body = el.querySelector(".room-body");
      body.scrollTop = 0;
      this._scrollCue(body);
    } else if (kind === "radar") {
      this._radarTrails.clear(); // trails from the last visit would draw a jump across the field
      this._renderRadar(el);
      const body = el.querySelector(".room-body");
      body.scrollTop = 0;
      this._fitScopes(el);
    }
  }

  // Move to page `to`. Swipes pass their direction (the way the finger went); taps and the idle return
  // take the shorter way round the loop (L.pageDirection), so every move is the same slide a real swipe
  // would make: forward, the content moves left. When the page on screen has just vanished (its room
  // went), there is no "way round": a short crossfade. A committed drag passes `drag` ({progress, ms}):
  // the slide resumes where the finger let go, and the arriving page's entrance, started when the drag
  // uncovered it, runs on (carried into this move's animations; never a second one).
  _go(to, dir, drag) {
    const pages = this._pageList();
    const fromEl = this._cur, toEl = pages[to];
    let carried = [];
    if (this._drag) {
      // A drag in progress hands over to this move (its commit, or a page that vanished under it).
      const d = this._drag;
      if (drag && d.nbEl === toEl && d.entrance) carried = d.entrance;
      else this._stopEntrance(d);
      this._dragClearStyles(d);
      this._drag = null;
      this._gesture = null;
    }
    if (!toEl || toEl === fromEl) {
      for (const a of carried) a.cancel();
      return;
    }
    const from = pages.indexOf(fromEl);
    const direction = dir || (from >= 0 ? L.pageDirection(from, to, pages.length) : null);
    // An interrupted fade is not snapped to its end (that would jump): read what is on screen, cancel it,
    // and let the new fade continue from there. Everything else (entrances, slides) snaps as before.
    const fa = this._fadeAnims || [];
    const live = fa.some((a) => a.playState === "running");
    const opacityOf = (el) => (live && el ? L.currentOpacity(getComputedStyle(el).opacity, 1) : null);
    const startOut = opacityOf(fromEl), startIn = opacityOf(toEl);
    const leaving = live ? this._fadeLeaving || [] : [];
    const leavingFrom = leaving.filter((el) => el !== toEl && el !== fromEl).map((el) => [el, opacityOf(el)]);
    for (const a of fa) a.cancel();
    this._fadeAnims = [];
    this._fadeLeaving = [];
    for (const a of this._slides) if (!fa.includes(a)) a.finish(); // an interrupted move snaps to its end first
    this._slides = [];
    const token = (this._navToken = (this._navToken || 0) + 1);
    this._page = to;
    this._cur = toEl;
    const all = new Set([...this._pageEls.values(), ...this._gone]);
    for (const p of all) {
      if (p !== fromEl && p !== toEl && !leavingFrom.some(([el]) => el === p)) p.classList.add("off");
      p.inert = p !== toEl;
      p.style.zIndex = p === toEl ? "2" : p === fromEl ? "1" : "";
    }
    toEl.classList.remove("off");
    this._preparePage(to);
    this._renderPager();
    if (this._hass) this._syncDoorAlert();
    if (to === 0) clearTimeout(this._detailTimer);
    else this._armDetailTimer();

    const done = () => {
      if (token !== this._navToken) return;
      if (fromEl) fromEl.classList.add("off");
      for (const [el] of leavingFrom) if (el !== this._cur) el.classList.add("off");
      for (const p of all) p.style.zIndex = "";
      for (const g of this._gone) {
        if (g === this._cur) continue;
        g.remove();
        this._gone.delete(g);
      }
    };
    if (this._reduced() || !direction) {
      // No slide, no stagger: a short crossfade.
      const a = toEl.animate([{ opacity: 0 }, { opacity: getComputedStyle(toEl).opacity }], { duration: M.fadeMs, easing: "linear" });
      this._slides = [a, ...carried];
      a.finished.then(done, done);
      return;
    }
    const progress = drag ? drag.progress : 0;
    if (this._fade()) {
      // Crossfade: opacity (and a hair of scale) only, nothing travels. The arriving page was not visible before
      // (unless a drag showed it part way), so it plays its normal entrance below.
      const ff = L.fadeFrames(progress, startOut === null ? undefined : startOut, startIn === null ? undefined : startIn);
      const ft = L.fadeTiming(progress);
      // Out: as ever. In: later, slower, decelerating (the delay holds it at its start opacity, then it rises).
      const outA = fromEl.animate(ff.out.map((opacity) => ({ opacity })), { duration: drag ? drag.ms : ft.outMs, easing: ft.outEase });
      const inA = toEl.animate(ff.in.map((opacity, i) => ({ opacity, transform: `scale(${ff.scale[i]})` })),
        { duration: ft.inMs, delay: ft.inDelayMs, easing: ft.inEase, fill: "backwards" });
      // A page still on its way out from the interrupted fade carries on to nothing, quickly.
      const outs = leavingFrom.map(([el, op]) => el.animate([{ opacity: op === null ? 0 : op }, { opacity: 0 }], { duration: ft.outMs, easing: ft.outEase }));
      this._fadeAnims = [outA, inA, ...outs];
      this._fadeLeaving = [fromEl];
      this._slides = [outA, inA, ...outs, ...carried];
      inA.finished.then(done, done);
      if (!drag) this._enter(toEl, ft.inDelayMs);
      return;
    }
    const f = L.slideFrames(direction, progress);
    const opts = { duration: drag ? drag.ms : M.slideMs, easing: EASE_OUT };
    const x = (v) => ({ transform: `translateX(${v}%)` });
    const outA = fromEl.animate(f.out.map(x), opts);
    const inA = toEl.animate(f.in.map(x), opts);
    // Parallax: the edge rails travel 60 % of the page's distance (L.chromeFrames).
    const cf = L.chromeFrames(direction, L.DRAG.depth, progress);
    const rails = [];
    const ro = fromEl.querySelector(":scope > .rails"), ri = toEl.querySelector(":scope > .rails");
    if (ro) rails.push(ro.animate(cf.out.map(x), opts));
    if (ri) rails.push(ri.animate(cf.in.map(x), opts));
    // A coloured line in the arriving page's hues rides the seam between the pages (L.wipeFrames).
    const w = L.wipeFrames(direction, progress);
    const wipe = this._el.wipe.animate(
      [{ transform: `translateX(${w[0]}%)`, opacity: drag ? 1 : 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { transform: `translateX(${w[1]}%)`, opacity: 0 }],
      { duration: drag ? drag.ms : M.wipeMs, easing: EASE_OUT },
    );
    this._slides = [outA, inA, wipe, ...rails, ...carried];
    inA.finished.then(done, done);
    if (drag) return; // its entrance started with the drag and is still running (carried): no second one
    this._enter(toEl);
  }

  // The arriving page's entrance: blocks fade up (stagger), brackets open, rails and glyph strokes draw in,
  // and the data settles in (_settleIn). No reading ever shows a value it does not have: numbers are the
  // real reading on every frame, and gauges and bars stay within a few percent of theirs (Apple HIG: motion
  // never carries false information; after the entrance only real changes animate, old to new, in
  // _setValue and the CSS transitions). `delayMs` (fade navigation: L.fadeTiming's inDelayMs)
  // shifts the animations so they play while the page is visible (backwards-filled meanwhile).
  _enter(toEl, delayMs) {
    const d = delayMs > 0 ? delayMs : 0;
    const anims = this._entrance(toEl);
    if (d) {
      for (const a of anims) {
        const t = a.effect.getTiming();
        a.effect.updateTiming({ delay: (t.delay || 0) + d, fill: "backwards" });
      }
    }
    this._slides.push(...anims);
  }

  // Every entrance animation of page `el`, starting now: blocks fade up, lines draw in, data settles in.
  _entrance(el) {
    return [...this._stagger(el), ...this._drawIn(el), ...this._settleIn(el)];
  }

  // MASHRABIYA entrance, in step with the stagger: brackets open (opacity/scale on ::before/::after) and
  // pathLength="1" strokes (.draw) draw themselves (stroke-dashoffset). All inside L.MOTION.drawMs.
  _drawIn(pageEl) {
    const blocks = Array.from(pageEl.querySelectorAll("[data-stagger]")).filter((b) => !b.hidden);
    const delays = L.staggerDelays(blocks.length);
    const out = [];
    blocks.forEach((b, i) => {
      const opts = { duration: M.drawMs, delay: delays[i], easing: EASE_OUT, fill: "backwards" };
      const brackets = b.classList.contains("brk") ? [b] : [];
      brackets.push(...b.querySelectorAll(".brk"));
      for (const k of brackets) {
        for (const pseudoElement of ["::before", "::after"]) {
          // The corners fly in from outside the group (a scale of the whole bracket set).
          out.push(k.animate([{ opacity: 0, transform: "scale(1.12)" }, { opacity: 1, transform: "none" }], { ...opts, pseudoElement }));
        }
      }
      b.querySelectorAll(".draw, .gi .m").forEach((d) => out.push(d.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], opts)));
      // Stat icons and control glyphs pop: a little small, a little over, then home.
      b.querySelectorAll(".ic, button svg, .vial svg").forEach((ic) => out.push(ic.animate(
        [{ transform: `scale(${M.popScale})`, opacity: 0 }, { transform: `scale(${M.popOvershoot})`, opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }],
        { duration: M.popMs, delay: delays[i], easing: "ease-out", fill: "backwards" },
      )));
    });
    // The edge rails draw from the top down.
    pageEl.querySelectorAll(".rail").forEach((r) => out.push(r.animate([{ transform: "scaleY(0)" }, { transform: "none" }], { duration: M.railMs, easing: EASE_OUT })));
    return out;
  }

  // Settle in, in step with each block's stagger: gauges, bars and vials come in a little short of their
  // value, overshoot it slightly and settle on it (L.settleFrames: never far from the truth, never zero for
  // a nonzero value); readings roll up into place a character at a time (the real characters throughout);
  // micro-labels and the room heading track in. A live change mid-settle stops it where it is
  // (_setMotion, _setValue). Inside L.MOTION.entranceMs with the stagger.
  _settleIn(pageEl) {
    if (this._reduced()) return [];
    const blocks = Array.from(pageEl.querySelectorAll("[data-stagger]")).filter((b) => !b.hidden);
    const delays = L.staggerDelays(blocks.length);
    const out = [];
    blocks.forEach((b, i) => {
      const at = delays[i];
      b.querySelectorAll(".gauge").forEach((g) => this._settleGauge(g, at, out));
      b.querySelectorAll(".bar i").forEach((fill) => this._settleTo(fill, fill._f, (k) => ({ transform: `scaleX(${k.toFixed(3)})` }), at, out));
      b.querySelectorAll(".vial").forEach((v) => {
        this._settleTo(v.querySelector(".lq"), v._f, (k) => ({ transform: `scaleY(${k.toFixed(3)})` }), at, out);
        this._settleTo(v.querySelector(".lvl"), v._f, (k) => ({ transform: `translate(0px, ${(-VIAL_H * k).toFixed(2)}px)` }), at, out);
      });
      b.querySelectorAll(".mv, .pct").forEach((v) => this._rollIn(v, at, out));
      const labels = Array.from(b.querySelectorAll(".ml, .gl"));
      if (b.classList.contains("room-name")) labels.push(b);
      for (const el of labels) this._trackIn(el, at, el === b, out);
    });
    return out;
  }

  // One element settles onto fraction `f` (frame(k): its style at fraction k), starting `at` ms in.
  _settleTo(el, f, frame, at, out) {
    const k = el ? L.settleFrames(f) : null;
    if (!k) return;
    const a = el.animate(
      [{ ...frame(k[0]), easing: EASE_OUT }, { ...frame(k[1]), offset: M.settleOverAt, easing: "ease-in-out" }, frame(k[2])],
      { duration: M.settleMs, delay: at, fill: "backwards" },
    );
    el._settle = [a];
    out.push(a);
  }

  // A gauge's arc (.val, .halo) and marker (.mark) settle together; the marker sends one ring from the
  // overshoot. The thermostat target (.tgt) is a setting and stays still.
  _settleGauge(g, at, out) {
    if (!L.settleFrames(g._f)) return;
    const sw = L.GAUGE.sweepDeg;
    for (const val of g.querySelectorAll(".val, .halo")) {
      this._settleTo(val, g._f, (k) => ({ strokeDashoffset: L.arcDash(k, GR, sw).offset.toFixed(2) }), at, out);
    }
    const mark = g.querySelector(".mark");
    this._settleTo(mark, g._f, (k) => ({ transform: `rotate(${(k * sw).toFixed(1)}deg)` }), at, out);
    const ring = mark && mark.querySelector(".pulse");
    if (!ring) return;
    // Transparent until its moment, so a backwards fill (fade navigation) never shows a resting ring.
    out.push(ring.animate(
      [{ transform: "scale(1)", opacity: 0 }, { transform: "scale(1)", opacity: 0.9, offset: 0.05 }, { transform: "scale(3)", opacity: 0 }],
      { duration: M.settlePulseMs, delay: at + M.settleMs * M.settleOverAt, easing: "ease-out" },
    ));
  }

  // A reading rolls up into place a character at a time (L.rollDelays). The characters are the reading's
  // own, so textContent is the real reading throughout; plain text again once the roll ends or stops.
  // Media titles and long words just fade with their block.
  _rollIn(v, at, out) {
    const text = v.textContent;
    const chars = Array.from(text);
    if (!chars.length || chars.length > M.rollMaxChars || v.classList.contains("title")) return;
    const delays = L.rollDelays(chars.length);
    v.textContent = "";
    const anims = chars.map((ch, i) => {
      const c = document.createElement("span");
      c.className = "ch";
      c.textContent = ch;
      v.appendChild(c);
      return c.animate(
        [{ transform: `translateY(${M.rollLift}%)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: M.rollCharMs, delay: at + delays[i], easing: EASE_OUT, fill: "backwards" },
      );
    });
    v._roll = anims;
    const done = () => {
      if (v._roll !== anims) return; // a new reading already replaced the characters (_setValue)
      v._roll = null;
      v.textContent = v._final === undefined ? text : v._final;
    };
    Promise.all(anims.map((a) => a.finished)).then(done, done);
    out.push(...anims);
  }

  // A micro-label tracks in: a hair wide and faint, then its own width. A block that is itself staggered
  // (the room heading) already fades and lifts, so it only narrows, added onto the lift.
  _trackIn(el, at, isBlock, out) {
    const wide = { transform: `scaleX(${M.labelScale})` };
    const home = { transform: "none" };
    const opts = { duration: M.labelMs, delay: at, easing: EASE_OUT, fill: "backwards" };
    out.push(isBlock
      ? el.animate([wide, home], { ...opts, composite: "add" })
      : el.animate([{ ...wide, opacity: 0 }, { ...home, opacity: 1 }], opts));
  }

  // The arriving page's blocks fade up one after another (L.staggerDelays: under 500 ms in all).
  _stagger(pageEl) {
    const blocks = Array.from(pageEl.querySelectorAll("[data-stagger]")).filter((b) => !b.hidden);
    const delays = L.staggerDelays(blocks.length);
    const lift = 4 * this._mmPx();
    return blocks.map((b, i) =>
      b.animate(
        [{ opacity: 0, transform: `translateY(${lift}px)` }, { opacity: 1, transform: "none" }],
        { duration: M.staggerMs, delay: delays[i], easing: EASE_OUT, fill: "backwards" },
      ),
    );
  }

  // Idle on any detail page: slide home, exactly as a swipe would.
  _armDetailTimer() {
    clearTimeout(this._detailTimer);
    if (this._mirror) return; // no page change while mirrored
    this._detailTimer = setTimeout(() => this._go(0), DETAIL_IDLE_MS);
  }

  // --- frame-rate meter (opt-in: debug_fps: true or ?fps=1) ------------------------------------
  // A rAF loop records frame times; twice a second the readout shows frames in the last second and
  // the worst frame gap in the last five (L.fpsStats). The loop itself is the only cost, and only
  // while enabled.
  _fpsSync() {
    const search = typeof location !== "undefined" ? location.search : "";
    if (L.fpsEnabled(this._config, search)) this._fpsStart();
    else this._fpsStop();
  }

  _fpsStart() {
    if (this._fpsRaf) return;
    this._el.fps.hidden = false;
    this._fpsTimes = [];
    this._fpsShownAt = 0;
    const frame = (now) => {
      this._fpsTimes.push(now);
      if (now - this._fpsShownAt >= 500) {
        this._fpsShownAt = now;
        this._fpsTimes = L.fpsTrim(this._fpsTimes, now);
        const s = L.fpsStats(this._fpsTimes, now);
        setText(this._el.fps, `${s.fps} FPS  WORST ${Math.round(s.worstMs)} MS`);
      }
      this._fpsRaf = requestAnimationFrame(frame);
    };
    this._fpsRaf = requestAnimationFrame(frame);
  }

  _fpsStop() {
    cancelAnimationFrame(this._fpsRaf);
    this._fpsRaf = 0;
    if (this._el && this._el.fps) this._el.fps.hidden = true;
  }

  // Any touch: keeps a detail page open, and at night wakes the controls for 30 s.
  _onAnyTouch() {
    if (this._page !== 0) this._armDetailTimer();
    if (this.classList.contains("night")) {
      this.classList.add("awake");
      clearTimeout(this._wakeTimer);
      this._wakeTimer = setTimeout(() => this.classList.remove("awake"), NIGHT_WAKE_MS);
    }
  }
}

// `mashrabiya-card` is the element; `mirror-panel-card` is the legacy name it was first published
// under, kept as a subclass so existing dashboards keep working (a constructor may only be defined once).
class MirrorPanelCardLegacy extends MashrabiyaCard {}

if (!customElements.get("mashrabiya-card")) {
  customElements.define("mashrabiya-card", MashrabiyaCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "mashrabiya-card", name: "Mashrabiya", description: "Full-screen two-way-mirror smart display card" });
  console.info(`%c MASHRABIYA %c ${VERSION} `, "color:#000;background:#ffb347", "color:#ffb347;background:#000");
}
if (!customElements.get("mirror-panel-card")) customElements.define("mirror-panel-card", MirrorPanelCardLegacy);
