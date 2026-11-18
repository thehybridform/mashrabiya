# Installing the card

The card is two plain JavaScript files in `dist/`. There is no build step.

| File | Role |
|---|---|
| `mashrabiya-card.js` | The custom element `mashrabiya-card` (an ES module) |
| `mashrabiya-logic.js` | Pure logic and the English string table; the card loads it itself, from the same folder |

Requirements: Home Assistant with a modern frontend (the card uses ES modules, top-level `await` and
shadow DOM), and a browser to show it. The kiosk recipe in [KIOSK.md](KIOSK.md) uses Chromium.

Install it **either** through HACS **or** by hand, not both.

## 1a. Install with HACS

Until Mashrabiya is in the HACS default list, add it as a custom repository:

1. HACS, three-dot menu, **Custom repositories**.
2. Repository: the URL of this repository on GitHub. Type: **Dashboard**. Add.
3. Find **Mashrabiya** in HACS, open it, **Download**.

HACS copies both files of the release into `/config/www/community/mashrabiya/` and, in storage-mode
dashboards, registers the resource for you as:

```
/hacsfiles/mashrabiya/mashrabiya-card.js
```

HACS appends its own `?hacstag=` cache-buster to that URL when it registers it, and updates it on every
release; the card forwards whatever query string it was loaded with to `mashrabiya-logic.js`, so both
files always update together. If you manage resources in YAML, add the URL yourself (step 2, with
`/hacsfiles/mashrabiya/` instead of `/local/mashrabiya/`). Then go to step 3.

## 1b. Install by hand

Put both files in your Home Assistant `www` folder so they are served under `/local/`:

```
/config/www/mashrabiya/mashrabiya-card.js
/config/www/mashrabiya/mashrabiya-logic.js
```

(`/config/www` may need creating; restart Home Assistant once if it did not exist, so it is served.)
Keep the two files in the same folder: the card loads the logic file relative to its own URL.

## 2. Register the module resource (manual installs)

Settings, Dashboards, three-dot menu, Resources (turn on Advanced mode in your user profile if you do
not see it), Add resource:

| Field | Value |
|---|---|
| URL | `/local/mashrabiya/mashrabiya-card.js?v=1` |
| Resource type | JavaScript module |

Or in YAML mode, in `configuration.yaml`:

```yaml
lovelace:
  resources:
    - url: /local/mashrabiya/mashrabiya-card.js?v=1
      type: module
```

**Bump `?v=` every time you update the files** (`?v=2`, `?v=3`, ...). Browsers, and especially a
kiosk that is never restarted, cache JavaScript aggressively, so without a new query string the
display keeps running the old code. The card forwards the same query string when it loads
`mashrabiya-logic.js`, so one number versions both files. Only the resource URL needs editing.

## 3. Add a dashboard

Create a dashboard with a **panel** view: it gives one card the whole screen, which is what the card
expects. A minimal one:

```yaml
title: Mirror
views:
  - title: Mirror
    path: mirror
    type: panel
    cards:
      - type: custom:mashrabiya-card
```

Dashboards written for the card's earlier name, `type: custom:mirror-panel-card`, keep working: that
name is registered as a legacy alias of `mashrabiya-card`. New dashboards should use `mashrabiya-card`.

With no further configuration the card shows the clock, the first weather entity it finds, and a
Lock all button for every lock in your system. A fuller example:

```yaml
title: Mirror
views:
  - title: Mirror
    path: mirror
    type: panel
    cards:
      - type: custom:mashrabiya-card
        weather: weather.home
        outdoor_temperature: sensor.outdoor_temperature
        locks:
          - lock.entry_door
          - lock.garage_door
        doors:                       # same order as locks: doors[i] belongs to locks[i]
          - binary_sensor.entry_door_contact
          - binary_sensor.garage_door_contact
        internet: binary_sensor.internet_check
        air: sensor.living_room_air_quality
        leaving_script: script.leaving
        climate: climate.thermostat
        person: person.owner
        scenes:
          title: Living room
          entities:
            - entity: scene.living_room_evening
              name: Evening
            - scene.living_room_relax          # a bare id takes its friendly name
          off: light.living_room_lamps          # adds an "Off" button for this light or group
        media_players:
          - entity: media_player.living_room_speaker
            name: Speaker
        news:
          - label: Local
            entity: sensor.news_local
            tone: green
          - label: World
            entity: sensor.news_world
            tone: yellow
```

Hide Home Assistant's own header and sidebar on the kiosk (for example with the Kiosk Mode
integration from HACS, or by using a dedicated non-admin user with the sidebar hidden). That is a
Home Assistant setting, not something the card does.

A dedicated, non-administrator Home Assistant user for the kiosk is strongly recommended; see
[KIOSK.md](KIOSK.md).

## Configuration reference

Every option is optional. Defaults are resolved by `resolveConfig(config, hass)` in `mashrabiya-logic.js`;
when this table and the code disagree, the code wins (and that is a bug to fix here).

| Option | Type | Default | Description |
|---|---|---|---|
| `time_zone` | string (IANA zone) | `hass.config.time_zone`, else `UTC` | Zone for the clock, the date and the night window |
| `temperature_unit` | string (`°C` or `°F`) | `hass.config.unit_system.temperature`, else `°C` | Unit for room gauges and the thermostat's fallback limits |
| `weather` | entity id (`weather.*`) | The first `weather.*` entity (alphabetical), else none | Source of the condition word, the glyph and the hourly forecast behind the rain warning |
| `outdoor_temperature` | entity id (`sensor.*`) | None: the weather entity's `temperature` attribute | The reading beside the weather |
| `locks` | list of `lock.*` ids | Every `lock.*` entity (alphabetical); `[]` for none | What the Lock all button, the Doors section and the status line cover. Lock-only |
| `doors` | list of `binary_sensor.*` ids | `[]` | Door or contact sensors; `doors[i]` belongs to `locks[i]`. State `on` means open |
| `internet` | entity id (`binary_sensor.*`) | None: hidden | A connectivity check; `off` raises "Internet down" |
| `air` | entity id (`sensor.*`) | None: hidden | An enum air-quality sensor whose state is `highest`, `high`, `medium`, `low` or `lowest`; `low` and `lowest` raise "Indoor air poor" |
| `leaving_script` | entity id (`script.*`) | None: the Leaving button is hidden | Run (`script.turn_on`) by the Leaving button. Make sure it cannot unlock anything |
| `climate` | entity id (`climate.*`) | None: the Thermostat section is hidden | Thermostat shown on More as an arc gauge (inside temperature, a tick at the target): target up and down by one with − and +, Heat and Off |
| `person` | entity id (`person.*`) | None: hidden | Shown on More as "Someone home" or "Away", never by name ("Home" is the way back to the first page) |
| `privacy` | `auto`, `off` (or `false`) or `always` (or `true`) | `auto` | Guest privacy. While it is active the Radar page leaves the swipe loop (the card goes to Main if it was on it), room pages show their rooms without occupancy, and More shows no presence word. `auto`: active while `person` is not home (a missing or unknown person counts as not home), or, with no `person` set, while no `person.*` entity is home; with no person entities at all it stays off. `always`: always active. `off`: never. Names are never shown either way |
| `scenes.title` | string | `""` | Heading of the scenes section on More; the section is hidden when it has no scenes and no `off` |
| `scenes.entities` | list of `scene.*` ids or `{entity, name}` | `[]` | One glyph each in one row on More (`scene.turn_on`; five fit across, more wrap evenly); a bare id takes its friendly name |
| `scenes.off` | entity id or `{entity, name}` | None | Adds an "Off" button, in the scenes heading beside the title, that turns this light or light group off |
| `media_players` | list of `media_player.*` ids or `{entity, name}`, or omitted | Omitted: every player that is playing or paused | Players listed under Now playing, with a Play/Pause button, while playing or paused |
| `news` | list of `{label, entity, tone}` | `[]`: the ticker is hidden | Headline sources, shown in this order. `tone` is `green`, `blue`, `yellow`, `orange` or `purple`, default cycling in that order. See [News feeds](#news-feeds) |
| `rooms` | list of area ids, or null | null: every area that has something to show, by name | Which areas get a room page, and in what order |
| `pages` | ordered list of `main`, `more`, `radar`, `room:<area_id>`, and the wildcard `rooms` | Omitted: Main, More, Radar, then rooms (by name, or the `rooms` list) | The swipe order, left to right: swiping left moves along this list (the next page comes in from the right), swiping right moves back, and both wrap. `main` is always first, whether listed or not. A listed page that does not exist right now (no radars, a room with nothing to show, an unknown area) is skipped and appears in place when it does. Rooms not listed go where `rooms` stands, else at the end, so a new room never vanishes. `more` and `radar` that are not listed are left out (an explicit opt-out). Duplicates are ignored. More's Rooms button opens the first room in this order. Example: `[main, more, room:kitchen, rooms, radar]` |
| `transition` | `slide` or `fade` | `slide` | How pages change. `slide` moves the pages sideways (with rail parallax and a seam line); `fade` crossfades them with no movement (the old page fades out in 360 ms, the new one fades in more slowly, over 700 ms, starting half way through; a new swipe or tap during a fade takes effect at once), and a drag drives the crossfade (full at 40 % of the width; letting go at a quarter or on a swipe finishes it, else it fades back). Reduced motion always uses a 140 ms crossfade |
| `ticker` | `fade` or `scroll` | `fade` | How the headlines from `news` appear. `fade`: one headline at a time, swapped every 8 s with a short fade, so nothing on Main moves between swaps but the weather glyph. `scroll`: a strip scrolling right to left at 25 mm/s (a constant motion in the corner of the eye). Reduced motion always shows one at a time, without the fade |
| `text_scale` | number, `0.8` to `2` | `1` | Multiplies every text size, and the icons that sit beside text, without moving the layout bands. Main's status line and controls grow upward from their row, and More, room and radar pages scroll between their fixed header and the navigation row when the text no longer fits (above `1.25`, room rows and diffusers also stay one column, so names are not cut). At `1` no text is smaller than 9 mm; below `1` it can be |
| `radar` | boolean | `true` | `false` hides the Radar page. Radars are discovered, see [Radar](#radar) |
| `radar_pattern` | string containing `{prefix}` | `{prefix}_presence` | The entity-id stem the radar sensors share, with `{prefix}` standing for the device name |
| `more_button` | boolean | `true` | Main's fourth button, More, jumps to page 2. `false` removes it: Main shows its other buttons spread evenly across the full width (same size and spacing), and the status overflow reads "N more" instead of "N more: tap More". Page 2 stays reachable by swiping, the page indicator and the detail pages' navigation row. Leaving and Lock all are shown only when configured, so with `false` and neither, Lights off stands alone |
| `door_alert` | boolean | `true` | An open door from `doors` is the alert: its status line, room-page stat and More button turn red, and their marks (the ring, the icon, the door glyph) breathe while the words stay steady. `false` makes it attention (orange) with no breathing |
| `scent` | boolean | `true` | `false` hides fragrance diffusers on the room pages and their "scent low" status line. Diffusers are discovered, see [Fragrance diffusers](#fragrance-diffusers) |
| `night_start` | string `HH:MM` | `22:00` | Start of the night window (may wrap midnight) |
| `night_end` | string `HH:MM` | `06:30` | End of the night window |
| `mirror_mode` | boolean | `true` | A double tap (two taps within 350 ms and 10 mm) on bare glass, not on a button, blacks the screen out so the glass is a pure mirror. Any three-finger swipe (any direction, or fingers gathering or spreading) toggles it. `false` turns all of it off |
| `mirror_timeout` | number (seconds) | `180` | How long mirror mode lasts before the screen fades back (600 ms) to the page you were on. Another double tap, a three-finger swipe, or a new open-door alert, ends it sooner |
| `debug_fps` | boolean | `false` | Shows a frame-rate readout, top right. `?fps=1` in the page URL does the same without editing the dashboard |
| `font_url` | string (URL) or null | Google Fonts stylesheet for Atkinson Hyperlegible | Stylesheet that declares the face. `null` fetches nothing and uses system fonts (offline kiosks, privacy) |
| `font_family` | string | `Atkinson Hyperlegible` | Family name the stylesheet declares; set it when you change `font_url` |

Notes:

- **Discovery** (`weather`, `locks`, media players) is re-evaluated as entities appear, so a lock that
  comes online later shows up without a reload.
- **Doors pair with locks by position.** If you let locks be discovered, also give `doors`, or leave
  it out: a door list in a different order from the discovered locks would be mismatched.
- **Strings.** Every word the card shows is in one `STRINGS` table at the top of `mashrabiya-logic.js`.
  There is no translation mechanism yet; a translation replaces those values.
- **Units.** Room gauges use the unit Home Assistant reports. The thermostat step is one degree in
  whichever unit the thermostat uses.
- **Sizing.** The layout assumes one CSS pixel is 0.236 mm (`--mm` is 4.235 px), which the kiosk sets
  through Chromium's scale factor. See [KIOSK.md](KIOSK.md#scale-factor).

## News feeds

The ticker reads the `item` attribute of a sensor built with Home Assistant's `rest` integration,
which converts an RSS (XML) response to JSON. The sensor's state is the item count and the headlines
ride in the attribute. Any RSS 2.0 feed works. In `configuration.yaml`:

```yaml
rest:
  - resource: https://example.com/feeds/local.rss
    scan_interval: 900
    headers:
      User-Agent: Mozilla/5.0 (Home Assistant)
    sensor:
      - name: News Local
        unique_id: news_local
        value_template: "{{ value_json.rss.channel.item | length if value_json.rss.channel.item is defined else 0 }}"
        json_attributes_path: "$.rss.channel"
        json_attributes: ["item"]
  - resource: https://example.org/feeds/world.rss
    scan_interval: 900
    headers:
      User-Agent: Mozilla/5.0 (Home Assistant)
    sensor:
      - name: News World
        unique_id: news_world
        value_template: "{{ value_json.rss.channel.item | length if value_json.rss.channel.item is defined else 0 }}"
        json_attributes_path: "$.rss.channel"
        json_attributes: ["item"]

recorder:
  exclude:
    entities:
      - sensor.news_local
      - sensor.news_world
```

- **`scan_interval`**: 900 seconds (15 minutes) is plenty for a ticker and polite to the publisher.
  Do not go much below ten minutes.
- **`headers`**: some publishers refuse requests with no user agent.
- **Recorder exclude**: the `item` attribute holds every headline, summary and link, which is large,
  and it changes every poll. Left in the recorder it bloats the database for no benefit; the ticker
  only needs the current value.
- Then point the card at the sensors with `news:` (see the example above). Entity ids come from the
  sensor names (`News Local` becomes `sensor.news_local`).
- The card keeps up to six headlines per feed, drops items older than 24 hours, removes duplicates,
  and decodes HTML entities.

## Radar

The Radar page appears on its own when the card finds mmWave presence radars. Nothing is configured
by entity id; the card looks in the states for the entity pattern an ESPHome `ld2450`-style device
exposes:

| Entity | Meaning |
|---|---|
| `sensor.<prefix>_presence_target_<n>_x` | Target `n` (1 to 3), sideways position, mm by default |
| `sensor.<prefix>_presence_target_<n>_y` | Target `n`, distance from the sensor |
| `binary_sensor.<prefix>_presence_target_<n>_active` | Optional: whether target `n` is present |
| `sensor.<prefix>_presence_target_<n>_speed` | Optional: shown while a target is moving |
| `number.<prefix>_presence_zone_1_begin_x`, `_end_x`, `_begin_y`, `_end_y` | Optional: the detection zone, drawn dashed |
| `number.<prefix>_presence_max_distance` | Optional: the range of the scope (default 6 m) |

Distances may be in mm, cm, m, in or ft; they are converted. Each radar is named after the area of its
target sensor (the entity's own area, else its device's), or the prettified prefix. The scope draws
the sensor's 120 degree field with the sensor at the bottom centre.

If your device names its entities differently, set `radar_pattern`. The pattern is the part of the
entity id between `sensor.` and `_target_<n>_x`, with `{prefix}` standing for the device name:

| Your entity | `radar_pattern` |
|---|---|
| `sensor.hall_presence_target_1_x` | `{prefix}_presence` (the default) |
| `sensor.hall_radar_target_1_x` | `{prefix}_radar` |
| `sensor.ld2450_hall_target_1_x` | `ld2450_{prefix}` |

Set `radar: false` to hide the page. The page is read-only.

## Fragrance diffusers

Fragrance diffusers (the Pura integration's entity shape) appear on their room's page on their own.
Nothing is configured by entity id: a **device** that has `sensor.<prefix>_slot_<n>_fragrance_remaining`
sensors in `%` is a diffuser, whatever its name, and the card reads its other entities by the same
object-id prefix:

| Entity | Meaning |
|---|---|
| `sensor.<prefix>_slot_<n>_fragrance_remaining` | Required: how full vial `n` is, in % |
| `sensor.<prefix>_slot_<n>_fragrance` | Optional: the scent's name (its `color` attribute, if any, tints the vial) |
| `sensor.<prefix>_active_fragrance` | Optional: `none` means nothing is running |
| `select.<prefix>_fragrance` | Optional: `slot_1`, `slot_2` or `off`: which vial is active |
| `select.<prefix>_intensity` | Optional: `off`, `gentle`, `subtle`, `medium`, `strong`, `intense` |
| `binary_sensor.<prefix>_slot_<n>_low_fragrance` | Optional: `on` marks the vial Low and raises "<device> scent low" on Main |
| `sensor.<prefix>_timer` | Optional: a timestamp, shown as "until 10:55 PM" with a 12-hour countdown ring |
| `switch.<prefix>_auto_alternate_fragrances` | Optional: shown as Alternating |
| `binary_sensor.<prefix>_connected` | Optional: `off` dims the group and says Offline |

The diffuser shows on the page of its device's area (or the remaining sensor's own area), named by the
device's name. It is read-only: the card never changes the intensity, the slot or the timer. Set
`scent: false` to hide diffusers and their status line.

## Open doors and locks

- **Open-door alert.** While any door in `doors` reports `on`, the "… open" status line on Main turns red and
  breathes (2.4 s; the text never drops below about half brightness, its ring goes lower), and the door's
  stat on its room page and its padlock on More breathe in step. There is no screen border. It also runs
  at night, still red but dimmer, and is steady under reduced motion. It stops within 0.4 s once the door is shut; doors that
  are unavailable or unknown never trigger it. `door_alert: false` turns it off.
- **Padlocks.** Every lock is drawn as a padlock that follows its real state: sealed and green when
  locked, the shackle lifted and swung open in orange when unlocked, red when jammed, half open with a
  turning ring while locking or unlocking, dim with a slash when unavailable. Real changes animate,
  whoever made them. The paired door (`doors[i]` with `locks[i]`) is drawn beside it when open. They
  appear on Lock all (a summary of every lock), on More's row of padlocks (one per lock, a tap only locks) and on the room page of the area
  that holds the lock. This is a picture of the state only: the card still cannot unlock anything.

## Updating the card

- **HACS:** update from HACS; it bumps its own cache-buster on the resource. Then reload the kiosk.
- **Manual:**
  1. Copy the new files over the old ones in `/config/www/mashrabiya/`.
  2. Bump `?v=` in the resource URL.
  3. Reload the kiosk (see [KIOSK.md](KIOSK.md#restarting-the-kiosk)); a hard refresh on a desktop
   browser also works.
