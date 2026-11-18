# Design

Why the card looks and behaves the way it does. Read this before changing it: most rules exist
because the display sits behind a sheet of two-way glass, and some obvious design choices (a card with a
background, a drop shadow, a blurred panel) are wrong there.

The authoritative version of the rationale is the header comment of `dist/mashrabiya-card.js`; this document
explains it in prose.

## Context of use (ISO 9241-11)

ISO 9241-11 defines usability as effectiveness, efficiency and satisfaction *in a specified context
of use*. The card is designed for this one.

| | |
|---|---|
| **Users** | The household, plus anyone who walks past: visitors can read the glass. Nobody is expected to learn it. |
| **Tasks** | A glance of under three seconds while leaving or arriving: "do I need to do something?" Using it as a real mirror. Occasional taps: leave the house, lock up, lights off, a scene, the thermostat. Browsing rooms and radar at arm's length. |
| **Equipment** | A large portrait LCD (about 300 nit) behind roughly 40 % reflective two-way glass, a Chromium kiosk scaled so one CSS pixel is 0.236 mm, and a USB infrared touch frame (no hover, and a palm or sleeve registers as a touch). |
| **Environment** | A hallway or entry, mixed day and night light, hands often full, standing, moving. Reference mount: the top of the screen 1829 mm above the floor, the controls at 1254 to 1369 mm, which is hand height. |

Usability targets that follow:

- **Effectiveness.** Everything that needs action is on the first screen, in words. Nothing can unlock.
- **Efficiency.** The answer to "do I need to act?" is a single status line you can read at eye level
  minus a little. The common actions are one tap each, in one row at hand height. The status line sits
  directly above the buttons so the eye that finds the problem finds the fix.
- **Satisfaction.** When everything is fine it reads as a plain mirror. A press gives instant
  feedback, and a word when it has worked.

## Two-way-mirror constraints

- **Black is the mirror.** A pixel that is off lets the room behind the glass reflect. Anything lit
  glows through. So the page is pure `#000`, and the card draws no filled panels, borders, boxes or
  shadows: a filled button would appear as a glowing rectangle. Structure comes from hairline strokes,
  dots, text, and corner brackets.
- **Brightness loss.** The glass passes only part of the monitor's light, so colours are saturated
  system colours (a pale tint would vanish) and body text is white. Pastels and greys on black are
  poor choices.
- **Size in millimetres, not pixels.** Legibility at 0.5 to 1.5 m is a physical question. Every
  dimension is expressed through `--mm`, one millimetre of glass, so the design holds on any panel once
  the kiosk's scale factor is right ([KIOSK.md](KIOSK.md#scale-factor)).
- **The reflection zone.** On the Main page, the band from 170 to 400 mm from the top of the screen is
  left empty and still, because that is where a standing adult's face is reflected. Time, weather and
  headline numbers stay above it; status and buttons below it. Detail pages (More, rooms, radar) are
  for reading at arm's length, so they may use the whole height.
- **Mount height drives the layout.** The top band (20 to 170 mm) is at eye level or above; the
  controls (445 to 560 mm) fall at hand height; the ticker owns the bottom 35 mm; on detail pages the
  navigation row is on the bottom edge (552 to 600 mm), the lowest and easiest reach. If your mounting
  height differs a lot, the bands are the thing to revisit.
- **Touch affordance without a box.** Each button has a one-pixel top hairline in the faint accent:
  about a quarter of a millimetre of lit area that says "a shelf of targets" where an outline or fill
  would glow.

## Fitting the page

Detail pages (More, every room, Radar) are laid out the same way, top to bottom, so nothing is ever
cut off and the way out is always in reach:

1. **A fixed header** on room and radar pages (the room's name, or Radar and its sensor count), 18 mm
   from the top. It stays put; it never scrolls away. More has no title: its body starts 20 mm down.
2. **The body**, between the header and a line 58 mm above the bottom edge. The navigation row starts
   52 mm above it and the pager sits under that, so the body can never run under or behind them.
3. **The navigation row** (Previous, Home, Next; on More, Home and Rooms) and the pager, fixed at the
   bottom.

What goes in the body is made to fit before anything scrolls (Simplicity: show what matters;
Familiarity: no surprises). None of it goes under the 9 mm text floor; it only uses the width better:

- Lights, fans, blinds and media are **two columns from three rows** (`gridColumns`): icon, name and
  value on one line, the bar under the name. Same sizes, half the height.
- **Diffusers pair up** side by side; the intensity, timer and alternation go under the vials.
- **One chips row.** A door that is paired with a lock in the room is said once, by the lock: its padlock
  already draws the door and its word turns *Open* (`roomChips`).
- **Media on a room page** lists what is playing before what is paused, at most two, and says
  "+N more" in the caption (`mediaVisible`). The More page still lists every player.
- **Radar scopes** go two to a row from three scopes, each as large as the height left on screen allows
  and never wider than its column (`scopeSize`); in two columns a scope's name and count stack, so
  neither is cut. The turning scan is clipped to its field, so it never makes the page scroll.
- With large text (`text_scale` over 1.25) the rows and diffusers stay one column: half a column would
  cut the names, and the body scrolls instead.

If a page still does not fit, its body scrolls by a vertical drag (see *One scroll owner*), never by a
native scroll. The cut edge fades and a small "More ▾" sits centred just above the navigation row while
there is more below (`scrollCue`); neither takes touches. Every entry to a page starts it at the top.

## The More page

More holds the home controls, drawn as instruments in the room pages' language rather than a list of
buttons. Its sections stack from the top, 15 mm apart, each sized to its content inside corner brackets
(they used to be spread over the whole height, which left wide empty bands between them):

- **Doors.** One row of large padlocks (34 mm), one per lock, with the door's name and its state word
  under each. The name drops a trailing "Lock" and "Door", because the heading already says Doors
  ("Front Door Lock" reads *Front*; a lock called just "Door" keeps it). A tap on a padlock may only
  lock it (`lock.lock`), exactly as before; the padlock itself is drawn from the lock's state.
- **Scenes.** One row of scene glyphs (24 mm) with their names. The room's *Off* sits in the heading
  beside the title, so a sixth button never ends up alone on a second row.
- **Rows that fit.** Up to four padlocks and five scenes go across one row at `text_scale` 1, three of
  either above 1.25. Beyond that the row splits into the fewest rows, filled evenly, longer rows first
  (`rowSplit`, `moreRows`: five doors are 3 + 2, seven scenes at large text 3 + 2 + 2), and a shorter
  row is centred under the longer one, so nothing is ever orphaned on a row of its own.
- **Thermostat.** The room pages' **arc gauge**, the same code: the inside temperature sweeps the arc
  in the temperature scale's colours with a ring at the value, and a tick marks the target. − and +
  sit either side (26 mm targets) and *Target 73°* is written under the dial in the mode's colour. A
  tap moves the tick and the words at once to the pending target, until Home Assistant confirms it.
  Heat and Off are below.
- **Now Playing.** The media **equaliser** from the room pages (it moves while the player plays, and
  is still when paused, at night and under reduced motion), the player's name as a micro-label over a
  larger title (13 mm), and play/pause.
- **House.** The one summary line (presence, air, internet), at 11 mm.

On entry the instruments get the same entrance as a room page: padlocks and scene glyphs pop and draw
in, the dial's arc and marker settle on the reading and the number rolls into place. At `text_scale`
1 the reference house (four doors, five scenes and Off, the thermostat, two players, the House line)
fits the glass without scrolling; larger text scrolls the body as on every detail page.

## Mashrabiya

The design language: the interface is a reflection that knows things; everything is drawn in light on
the glass, never in panels.

**The name.** A mashrabiya (Arabic مشربية, said mash-ra-BEE-ya) is the carved wooden lattice screen
set in the windows and balconies of traditional homes across the Arab world: it lets light and air
through while keeping the people inside private from the street. That is this card's situation exactly.
Light passes through a screen (the two-way glass), drawn as fine lines and points rather than solid
panels, and the surface sits at the threshold of a home, facing whoever is outside it, so it shows what
the household needs and keeps the rest private (no names, and privacy mode for guests).


1. **Light only.** Hairline strokes, dots and text. No filled panels. A glow is a thin bright stroke
   over a wider, fainter stroke of the same colour, never a filter or a shadow.
2. **Data arrives true.** On page entry, blocks fade up, brackets open and lines and glyph strokes
   draw in, and the data **settles in**: gauges, bars and vials arrive within a few percent of their
   real value, overshoot it slightly and settle on it; numbers roll up into place showing the real
   reading the whole time. All within 950 ms. Nothing counts up from zero, sweeps up from zero or
   decodes from stand-in characters: every frame of a settle is within 15 % of the value (or 3 % of
   full scale, whichever is larger) and never zero for a nonzero value, so a glance mid-entrance never
   reads a false "0°". After that only real changes move, old value to new.
3. **Calm at rest, alive under the hand.** Idle, only slow ambient motion. A touch wakes the reticle,
   the trail and the burst.
4. **One shape vocabulary.** Corner **brackets** group things (never boxes); **arcs** show amounts;
   **rings** mark places; **sweeps** show time and scanning. Small uppercase, letter-spaced
   **micro-labels** carry real units.
5. **Colour keeps its meaning; chrome stays out of its way.** Each page has a palette of three hues
   (`pagePalette`): its accent (Main a cool ice white, More a pale lavender tint, Radar a light
   chartreuse, each room a hue picked by a stable hash of its area id) plus a second hue from the other
   bright family and a near-white tint. Every hued chrome colour is 4.5:1 on black and at least
   **40 degrees** from every meaning colour, including the light red of alert words; only two bright
   families clear that, chartreuse (about 92 degrees) and periwinkle (about 239), so there are no pinks,
   reds, oranges, teals or mints in the chrome any more, and tints under 0.2 saturation read as white.
   Chrome wears them: brackets run from the first hue to the second around a group, heading underlines,
   button hairlines and the ticker ruler are gradients through all three, the edge rails and the radar's
   range rings shade from the second to the third. Small words (micro-labels) and untoned icons are in
   the secondary white, never a hue. Gauge arcs carry their scale's colours along their length; each
   radar target has its own colour; a diffuser vial is its scent's colour.
6. **Main keeps its empty middle** (the reflection zone); detail pages fill the glass.

## Icon language

Every icon is a **constructed instrument glyph**, one family built by one function (`glyph()` in
`dist/mashrabiya-card.js`) so it stays coherent, and a test fails if any icon the card asks for is missing:

- Built from geometric primitives (circles, arcs, straight segments) on a 24-unit grid.
- **Duotone.** Main strokes (1.4 units, a touch thinner than a typical icon set) in the element's tone,
  over a faint 4-unit copy for the glow. One secondary detail and small solid **nodes** at joints and
  ends are in the page's second hue. Nodes are the family's signature: they read as the measuring
  points of an instrument rather than as pictograms.
- **Draws itself in.** Main strokes carry `pathLength="1"` and draw in on page entrance.
- **One idle hook.** One node per glyph may breathe slowly on the hue-drift timeline, only on room
  pages (never on Main, never at night, never under reduced motion).
- **Meaning stays unambiguous.** Lights off has a slash; a light that is on has rays and a lit filament
  node, one that is off is a hollow bulb; a door that is open swings its leaf with a swing arc; the
  padlock's shackle is shut and sealed when locked and lifted and swung open when unlocked.
- **Moving parts are groups.** Weather rays, clouds, drops, flakes and gusts, the padlock's shackle:
  CSS moves the group, its nodes ride along.

## Colour meanings

Colour is always beside words or numbers, never the only signal (some viewers cannot tell the hues
apart, and the glass shifts them).

| Colour | Means |
|---|---|
| Green (ok) | Fine: locked, comfortable, someone present, internet OK |
| Orange (attention) | Take a look: an offline lock, poor air, internet down, a low scent vial, a door that is not a configured alert door, Connection lost; also warm or outside the comfort band on gauges |
| Red (alert) | Act now: an unlocked or jammed lock and an open configured door (the alert). Marks (rings, glyphs) in `--alert` #ff453a; words in `--alert-text` #ff9d96, a lighter red |
| Blue | Water or cold: rain, cool temperature, damp, and the Leaving action |
| Yellow | Light: lamps on, sun |
| Purple | Media: something playing |
| Dim white | Secondary: off, empty, closed, unknown |
| Amber | Night: everything decorative or calm becomes one dim amber. Attention and alert keep their hues (see below) |

**One colour per severity, everywhere.** `L.SEVERITY` maps each level to one tone and the card maps
each tone to one token: `ok` to `--ok`, `attention` to `--attention`, `alert` to `--alert` (plus
`--alert-text` for words). The status line, the padlocks, Lock all, More's padlocks and the room
chips all use it, so an unlocked door is the same red on the status line, on its padlock and on More,
and an offline lock is the same orange in all three.

**The night rule.** At night, attention and alert keep their severity hues, dimmed (night tokens
`--attention` #b3710e, `--alert-text` #b36e69, `--alert` #b33029 for marks) but still at least 4.5:1
on screen for words, and they are never dimmed further by the page: only what is decorative or calm
(the clock, chrome, the controls, calm room content) is dimmed and turned amber.

**Legibility through the glass (derived estimate).** Contrast against black through the glass is
estimated as 60 % transmission plus a reflected veil of 3 % of display white from a lit hall. By that
estimate the alert words (#ff9d96), attention (#ffa214) and ok (#30d158) are all about 4.5:1 or better
by day; the old alert red #ff453a was about 2.9:1 at full strength and about 1.9:1 at its breathing
trough. This is a model, not a measurement.

Status lines are ordered most severe first and there are at most three: security (red), an open door
(the alert, red), then attention (orange), and anything beyond three folds into the third line as
"N more: tap More" with the most severe level it folds, so nothing is silently dropped. While the
connection to Home Assistant is lost, "Connection lost" leads (see Stale data).

**Open-door alert.** While any configured door is open, the alert's marks breathe red, 2.4 s per breath
(35 % to full): the Main status line's ring, the door's chip icon on its room page, and the door's glyph
on More. The words never breathe; they stay at full strength in `--alert-text`. All marks share one start
time, so every visible instance pulses together. There is deliberately no screen border. It is a safety
state, not decoration, so unlike every ambient loop it runs at night (in the night severity colours), and
under reduced motion it is steady. It eases back to normal in 0.4 s when the door shuts.

**Stale data.** When the frontend reports the websocket down (`hass.connected` false, or a
`connection-status` "disconnected" event) for 10 s, the status line leads with "Connection lost"
(attention), "All clear" is never shown, and every reading (weather, sub-labels, status lines, More and
room content) dims to 40 % until the link is back. The clock stays bright: it is local time and still true.

**Privacy.** See `privacy` in [INSTALL.md](INSTALL.md#configuration-reference): while it is active
(by default, while the configured person is away) the Radar page leaves the loop, rooms show without
occupancy and More shows no presence word, because the glass faces whoever is in the hall.

## Motion rules

Animation is a deliberate part of the product, held to a budget so it never competes with the
glance.

- **Entrance budget.** A page move slides both pages together (320 ms, ease-out), the leaving page going
  the way the finger went. The arriving page's blocks then fade up one after another, 40 ms apart
  plus 45 ms per block, capped at 220 ms of delay. Brackets and lines ride the same stagger, and so do
  the vivid extras: bracket corners fly in from outside the group, the edge rails draw from top to bottom
  (420 ms), icons pop (scale 0.8, a 1.08 overshoot, then home, 360 ms) while their strokes draw in.
  **Settle in**, on the same stagger: gauge arcs and markers, light and blind bars and scent vials start
  at 85 % of their value, overshoot by 3 % of full scale and settle on it (600 ms); a gauge marker sends
  one ring out from the overshoot (320 ms). Readings roll up into place a character at a time (30 ms
  apart, each rising from 60 % below as it fades in, the whole roll inside 450 ms); the characters are
  the real reading throughout, never a count. Micro-labels and the room heading track in (a hair wide,
  scaleX 1.08 to 1, with a fade, 400 ms). A gauge or bar with no reading, or at zero, stays still; media
  titles and words over 12 characters only fade with their block. A live change that lands mid-settle
  stops the settle where it is on screen and the normal change transition carries on from there.
  Transform, opacity and stroke-dashoffset only. The whole entrance ends inside 950 ms.
- **Page move extras.** The edge rails travel at 60 % of the page's speed (parallax), and a coloured
  line in the arriving page's hues rides the seam between the two pages for the length of the slide.
  Taps and the idle return play the same slide a swipe would (forward, the content moves left). A
  swipe gets the same entrance (fade-up, draw-in, settle in, roll, track-in) as the finger brings it in:
  it starts the moment a drag uncovers the page, in fade and slide modes alike. If the finger reverses,
  the other neighbour's entrance replaces it; a spring-back cancels it (the page is simply at its true
  values); a commit lets it run on, so a page never plays its entrance twice.
- **State changes** are small: clock digits that changed slide into place, a status line fades up,
  sub-labels count ("5 on" to "2 on") or crossfade, gauges and bars travel from the old value to the
  new. A changed reading on a room page rolls in (from below when it rose), counts if it can, and a
  small ring flashes at its icon; a gauge marker whose value moved sends out three pulse rings. Padlocks
  follow real lock changes from anywhere: unlocking springs the shackle up and swings it open (450 ms,
  overshoot); locking drops it shut with a green ring burst (420 ms); a jam shakes it once.
- **Ambient loops** are small and slow, never in the reflection zone, and paused on pages that are off
  screen. Detail pages have at most two chrome loops: a highlight travelling each edge rail (7 s) and
  the hue drift (11 s, a second gradient fading over the rails; glyph nodes on room pages breathe on
  the same timeline), plus the radar sweeps on Radar. **Main is calm:** only the weather glyph moves
  (sun rays turn once in 36 s, clouds drift, rain falls, lightning flashes once in 30 s). The clock
  separator is steady, there is no control-row highlight, Lock all's padlock does not bob, and the
  headlines change one at a time.
  Content loops show state: a fan icon turning while the fan runs, an equaliser while media plays,
  wisps rising from a diffuser's running vial, an unlocked padlock's shackle bobbing, a turning ring
  while a lock is moving.
- **Night.** The same state-change and touch motion, in amber, but **no ambient loops** and no ticker.
  The open-door alert is not ambient: it keeps breathing, in red.
- **Reduced motion** (`prefers-reduced-motion: reduce`). No animation or transition at all. A page change
  is a 140 ms crossfade, gauges just show their value, nothing draws, settles, rolls or counts, there is no
  radar scan, the ticker shows one headline at a time (changing every 8 s), and a touch shows a static
  dot for 140 ms with no trail and no burst. The open-door alert is steady.
- **The ticker** shows one headline at a time, swapped every 8 s with a short fade (`ticker: fade`, the
  default). `ticker: scroll` brings back the strip scrolling at a constant 25 mm/s, a standing motion in
  the corner of the eye. It never takes touches and is hidden at night.

## Touch rules

- **Target size.** Main's buttons are large and spaced 10 mm apart, with nothing within 25 mm of the
  side edges (an IR frame's border registers sleeves). The option `more_button: false` removes Main's
  fourth button (More); the rest then share the row evenly (the grid is sized from the visible buttons),
  so each is wider, never smaller, and the status overflow stops saying "tap More". On detail pages, targets are at least 15 mm
  tall, gaps at least 8 mm and text at least 9 mm (the derived Apple HIG minimum at a 1.5 m glance is 8.6 mm; a
  test scans the stylesheet for anything smaller, with two justified exceptions).
- **Swipe versus tap.** A swipe is at least 40 mm of horizontal travel, at least twice the vertical
  travel, completed within 0.8 s. The pages sit in a row like a carousel: swiping LEFT brings in the
  next page from the right edge, swiping RIGHT the previous one from the left, and both wrap (from the
  last page a swipe left goes to Main; from Main a swipe right goes to the last page), so the pages are
  a loop with no dead end. Previous and Next match: Next, on the right, names the page a swipe left
  brings in from the right; Previous, on the left, the page a swipe right brings in. Both sit in the
  bottom navigation row of room and radar pages, each at least 15 mm tall (46 mm), labelled with the
  page it goes to, and hidden where that page is Main (Home goes there). They are the tap alternative
  to the swipe, so no page is reachable by gesture only.
- **Home.** Every detail page has one way back to Main, called Home with the house glyph, centred in
  the bottom row: More's former "Close" and the rooms' former "Main" are the same button now.
- **Page indicator.** Centred at the bottom of detail pages, under Home: one thin segment per page in
  neutral white, the current one brighter and thicker, no hue and no names. It never takes touches.
- **Drag-follow.** Once a mostly horizontal drag passes 8 mm, the page moves with the finger 1:1 and
  the page it is uncovering comes along flush beside it (rails at 60 %, the wipe line on the seam).
  Letting go at a quarter of the page width or more, or with a recognised swipe, finishes the move
  from there (the rest of the 320 ms slide, scaled to the distance left); anything less springs back
  (up to 250 ms). The page width is read once when the finger lands, never per move. A second finger
  springs it back. Under reduced motion nothing follows the finger; a recognised swipe crossfades.
  At night it works the same, because it only moves when someone is touching it.
- **Mirror mode.** Two taps within 350 ms and 10 mm on a non-interactive area (never on a button, whose
  taps are not delayed; never after a drag or swipe) fade a pure #000 veil over everything in 400 ms
  (L.isDoubleTap, L.MIRROR). Behind it the ambient loops are paused and the FPS meter stopped; touch
  feedback is off and single taps do nothing (the glass gets touched while grooming). It ends after
  `mirror_timeout` (180 s), on another double tap, or immediately when a NEW door alert begins
  (L.mirrorAlertExit); it fades out over 600 ms (150 ms for the alert) to the page you were on, and the
  idle-return timer, held while mirrored, is re-armed. Reduced motion fades in 100 ms. Limit: a black
  overlay still leaves the LCD backlight on, so some light leaks; a true backlight-off needs a host-side
  helper and is out of scope.
- **Fade transition** (`transition: fade`). Pages crossfade instead of sliding, and the fade is
  asymmetric (L.fadeTiming): the outgoing page leaves 1 to 0 over 360 ms (ease-in-out, as ever); the
  incoming page comes up 0 to 1 over 700 ms on a decelerating curve (cubic-bezier(0.16, 1, 0.3, 1)),
  starting 180 ms in, when the out is half done, so there is a brief dim beat but no black gap (880 ms
  end to end). It carries a 0.985 to 1 scale for depth over the same 700 ms. No seam line, no rail
  parallax, and the arriving page plays its normal entrance starting with the fade-in (180 ms in, so it plays while the page is visible). A drag moves
  nothing: it drives the crossfade 1:1 with the finger (L.fadeProgress, full at 40 % of the width, so the
  quarter-width commit point is already past 60 %), never slowed. Release commits as for slide
  (L.dragDecision): the out finishes at the old speed, the in reaches full on the slow curve scaled to
  the distance left (700 ms x remaining, at most 600 ms, at least 120 ms); else it fades back (up to
  250 ms). Reduced motion keeps the 140 ms crossfade and no drag-follow.
  **Interruptible.** `_go` has no busy guard: a swipe, tap or drag during any transition takes effect at
  once. An in-flight fade is not snapped to its end (that would jump): the opacities on screen are read
  (L.currentOpacity), the animations cancelled, and the new fade starts from those values; a page still
  leaving carries on to nothing. A drag begun mid-fade settles it to its logical state first. The
  mirror-mode veil does the same: a double tap during its fade reverses it from the opacity it has reached.
  *Apple HIG motion principles applied (paraphrased):* motion has a purpose, here to show one page
  replacing another, so nothing decorative is added; feedback is brief and precise, hence the out is
  kept short and only the arrival is eased; people are never made to wait for an animation to finish,
  hence the interruptible rule; motion follows the gesture predictably, hence drag-follow tracks the
  finger directly and the slow curve only applies once it is released; content that changes place
  fades out, then back in, which the delayed in-fade gives; and everything is opacity and a hair of
  transform, so it holds a steady frame rate.
- **Click suppression.** A touch that travels more than 8 mm, or is recognised as a swipe, never
  activates the button it started on. Multi-touch is neither swipe nor tap. Each button also ignores a
  second press within 700 ms.
- **Stuck pointers.** An IR frame can report a touch that never ends (a cloth, a bottle or a sleeve
  blocking the beams, or a missed release). Chromium keeps that ghost as the primary pointer and flags
  every real touch after it as a second finger, which the rule above would ignore until the ghost
  cleared. So the card tracks the pointers still down (id and time of their last event) and reads a
  "second" pointer as the one finger when every other pointer has been silent for at least
  `L.TOUCH.staleMs` (1.5 s; `L.treatAsPrimary`). It then taps, swipes and ripples like any single
  touch; because Chromium sends no click for it, the card activates the button itself on a tap, under
  the same rules (not moved, not suppressed, the 700 ms debounce). The stale ghosts are forgotten, and
  a press or a drag they were holding is let go. A companion that moved or landed within 1.5 s still
  makes it multi-touch. This never lets anything happen that a single real touch could not already do.
- **One scroll owner.** Pages never scroll natively (`touch-action: none`). A vertical drag on a room,
  radar or More page that outgrows the glass scrolls its body from the same pointer stream the swipes use,
  so a horizontal swipe can never be stolen by a native scroll, whether the frame reports touch or mouse
  events. The header and the navigation row stay put (see *Fitting the page*).
- **Idle return.** Any detail page slides back to Main after 60 s without a touch.
- **Feedback.** A reticle opens where a finger lands (on a button, the button's own ring in its tone
  instead), a short trail follows a drag, a chevron burst marks a recognised swipe, a tick draws when an
  action succeeds and the button shakes when it fails. The touch layer ignores pointer events itself.

## Apple HIG alignment

The card was audited against Apple's Human Interface Guidelines, which currently state eight design
principles. In paraphrase, and what each means on this glass:

- **Purpose** (make something meaningful, keep to what matters most). The glance answers one question,
  "do I need to act?", in one status line; everything else is one swipe or tap away.
- **Agency** (let people work their own way, explore freely and recover easily). Every swipe has a tap
  alternative (Previous, Next, Home), every transition can be interrupted, and the card never says
  "All clear" from a dead connection: "Connection lost" tells people the data may be out of date.
- **Responsibility** (act in people's best interest; keep information safe, show only what is needed).
  The glass faces whoever is in the hall, so it never shows names, and in privacy mode (by default while
  the household is away) it hides live positions, room occupancy and presence. It can lock, never unlock.
- **Familiarity** (build on what people know; be consistent). One colour per severity everywhere, one
  name and glyph for the way back (Home), presence words that do not reuse that name, and a page
  indicator where people expect one: centred at the bottom, neutral.
- **Flexibility** (design for everyone and every context). A `text_scale` option up to 200 %, a 9 mm
  text minimum (the derived HIG minimum at a 1.5 m glance is 8.6 mm), `prefers-contrast: more` with full
  white text and heavier strokes, `prefers-reduced-motion`, and a night rule that keeps warnings legible.
- **Simplicity** (include what is necessary, be concise, establish hierarchy). Main moves only where
  the weather glyph is; decoration keeps 40 degrees away from every colour that means something, so
  colour is hierarchy and meaning, not noise.
- **Craft** (care about every detail; test in the real setting). Contrast is estimated through the
  glass, not only on screen, and the CSS is scanned by a test for text below the minimum.
- **Delight** (make it human; delight is not decoration). The motion that remains shows something real:
  a value that changed, a lock that snapped shut, a page replacing another. Nothing on arrival shows a
  value it does not have.

What changed in that pass, briefly: alert words are steady and a lighter red (only their marks
breathe); severity colours are one table, kept at night; chrome hues moved 40 degrees clear of meaning
colours; privacy mode; a stale-data state; a calm Main (steady colon, no shimmer, rare lightning,
one-at-a-time headlines); real values on arrival; Home everywhere, Previous/Next and a bottom indicator;
micro-labels in the secondary white; `text_scale` and the 9 mm floor.

## Safety: read-only and lock-only


The display faces whoever is there. So:

- The card can lock and cannot unlock or open: no such service call exists in its source, and the
  test suite fails if one appears. Unlocking happens on an authenticated device.
- Room pages and the Radar page are read-only. Their only controls are the navigation row (Previous,
  Home, Next), which only changes page, and
  the tests hold the code that renders them to creating no buttons and calling no services.
- Only actions that fail safe are offered at all: lock, lights off, a scene, the thermostat, your own
  Leaving script. If a mistaken tap on any of these would matter, take it out of the configuration.
- Presence is "Someone home" or "Away", never a name, so the glass does not tell visitors who is in;
  while privacy is active it is not shown at all. ("Home" is the name of the way back to the first page,
  so presence does not use it.)

## Performance budget

The target is a Raspberry Pi 5 driving a portrait 1080p panel through Chromium on Wayland.

- Animations use `transform`, `opacity` and SVG stroke properties only, so the compositor does the
  work. No animated filters, blur or shadows; `filter`, `box-shadow` and `backdrop-filter` do not appear
  in the stylesheet, and a test enforces it.
- Touch effects are one overlay with a fixed pool of nodes, moved by transform and opacity; moves
  create no elements. Radar targets and trails are likewise a fixed pool per scope, positioned by a
  percentage transform with a 300 ms transition to bridge the sensor's update interval.
- Pages that are not on screen do no ambient work.
- The ambient chrome moves only small elements: 2 px rails, a 2 px highlight and

  nodes a millimetre across, by transform and opacity. The hue drift is a crossfade of two gradient
  layers (opacity), not an animated colour property, which would repaint every frame. The open-door
  alert breathes by opacity on the alert's own elements.
- Home Assistant updates arrive constantly, so the card guards each part behind a cheap key and
  rebuilds only what changed (the ticker strip restarts only when the headline set itself changes).
- **Measured on the reference build** (Pi 5, Chromium 156): the Main page holds 60 frames per second
  with a worst frame gap of 18 ms. Reproduce it with `?fps=1` ([KIOSK.md](KIOSK.md#frame-rate-meter)).
  Treat a regression there as a bug.
