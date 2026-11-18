# Demo house

A made-up home for trying the card in a plain browser, without Home Assistant. `demo-house.js` loads the
published card from `dist/`, gives it a fake `hass` (fixed states, area / device / entity registries, a dry
weather forecast) and a fixed clock, and picks a page. Nothing in it can act: every service call is logged
to the console and dropped, and nothing is fetched but the card's files and its web font.

The README screenshots in `docs/img/` are taken from it.

## Run it

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/demo/?scene=main-calm` with the browser window at the kiosk's shape
(portrait; the reference glass is 1440 x 2560 CSS pixels, see [KIOSK.md](../docs/KIOSK.md#scale-factor)).
The page is the card alone, so it can also be driven by hand: tap, swipe, double tap.

| `?scene=` | What it shows |
|---|---|
| `main-calm` | Main, everything locked: "All clear" (the default) |
| `main-exceptions` | Main with an unlocked lock and an open door |
| `more` | The More page: doors, scenes, thermostat, Now playing, House |
| `room` | The Living Room page: both gauges, the air meter, lights in their colours, a speaker |
| `radar` | The Radar page, one target walking through the zone |
| `night` | Main at 11:12 PM, with one exception on the status line |
| `ticker` | Main with `ticker: scroll`, held until a feed label is near the left edge |
| `touch` | Main with a drag in progress, frozen mid-drag (reticle and trail) |

Add `&font=system` to use system fonts instead of fetching Atkinson Hyperlegible.

The day scenes run at 10:24 AM and the night scene at 11:12 PM (UTC, on a made-up date): `Date.now()` is
pinned before the card loads and then runs on in real time. When a scene has settled, `<html>` gets
`data-ready="1"`. The touch scene is real pointer events dispatched into the card, after which the card's
animations are paused and the clock its touch trail is drawn against is stopped, so the frame holds still
for a screenshot; the demo draws nothing itself.

## Re-take the screenshots

```sh
node demo/capture.mjs                 # Node 22 or later, and Chrome
CHROME=/path/to/chromium node demo/capture.mjs
```

It serves the repository on `127.0.0.1` (a random port) while it runs, opens each scene in headless Chrome
with a 1440 x 2560 CSS-pixel viewport at a 0.5 device scale, waits for `data-ready`, and writes
`docs/img/<scene>.png` (720 x 1280; the ticker is a 720 x 88 crop of the bottom edge). Only the image
chunks are kept in each PNG: no text, time or colour-profile chunks.

These are pictures of a browser, not of glass: the two-way mirror dims everything and hides the black. For
a picture of a real display, see [KIOSK.md](../docs/KIOSK.md#screenshots-with-grim).

## Changing the house

Everything is in `demo-house.js`: `add(id, state, attributes, area)` makes an entity (and its registry
entry when it has an area), `AREAS` are the rooms, `CONFIG` is the card config. Keep it fictional: no real
names, places, outlets or entity ids. `npm test` scans these files too.
