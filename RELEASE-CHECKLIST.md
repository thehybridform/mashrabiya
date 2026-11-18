# Release checklist

What is done, and what is left before Mashrabiya 0.1.0 is published and announced. The card is tested
and generic; what remains is publishing, verification on a real install, and assumptions that still
need a decision before 1.0.

## Done

- [x] **Licence.** MIT ([LICENSE](LICENSE)). Nothing bundled needs attribution: the Atkinson
      Hyperlegible font is loaded from Google Fonts at runtime (SIL OFL) and is not redistributed.
- [x] **Name.** `mashrabiya-card` is the element and the card type users write
      (`type: custom:mashrabiya-card`). The earlier name, `mirror-panel-card`, is registered as a
      legacy alias (a subclass) so existing dashboards keep working; see [CHANGELOG.md](CHANGELOG.md).
- [x] **Repository layout** for a HACS Dashboard ("plugin") repository: `dist/mashrabiya-card.js`,
      `dist/mashrabiya-logic.js`, `docs/`, `test/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `hacs.json`.
      The card loads the logic file relative to its own URL and forwards its `?v=` (or HACS's
      `?hacstag=`) query string, so both files update together.
- [x] **INSTALL.md** covers both install paths: HACS (`/hacsfiles/mashrabiya/`) and manual
      (`/local/mashrabiya/`).
- [x] **Version in the card**: a `console.info` banner and a `window.customCards` entry ("Mashrabiya");
      a test keeps the card's `VERSION` equal to `package.json`.
- [x] **CHANGELOG.md** (Keep a Changelog), starting at 0.1.0.
- [x] **Tests ported** to Node's built-in runner (`npm test`, no dependencies): the logic tests with
      generic fixtures, the card-source guards (lock-only, read-only pages, compositor-only motion, one
      scroll owner, minimum text size), the docs checks (every `resolveConfig` option documented, links
      resolve) and a repository-wide privacy scan.
- [x] **Continuous integration**: `.github/workflows/test.yml` runs a syntax check and `npm test` on
      Node LTS for every push and pull request.
- [x] Comments no longer name files of the project the card was extracted from.
- [x] Personal names, hostnames, addresses and house entity ids removed; the privacy test fails if
      they come back. It stores only salted SHA-256 digests of the banned strings
      (`node test/privacy-hash.js` prints one), never the strings or a reversible encoding of them.

## Before publishing

- [ ] **Publish from a fresh, single-commit history.** The first local commit (`d8c8cfc`, "Mashrabiya
      0.1.0: initial public release candidate") stores the privacy scan's banned strings base64-encoded,
      which anyone can decode. Later commits replace them with SHA-256 digests, but the old list is still
      in this repository's history, so **never push this history**. Publish a squashed snapshot instead:

      ```sh
      # 1. The old encoded list, kept OUTSIDE the repository, to check against:
      git show d8c8cfc:test/privacy.test.js | sed -n '/^const ENCODED = \[/,/^\];/p' \
        | grep -oE '"[A-Za-z0-9+/]+={0,2}"' | tr -d '"' > /tmp/old-b64.txt
      wc -l < /tmp/old-b64.txt   # 45
      # 2. A new root commit holding only the current tree (checkout, not switch: `git switch --orphan`
      #    empties the working tree):
      git checkout --orphan publish && git commit -m "Mashrabiya 0.1.0"
      # 3. Must print 0 (nothing from the old list anywhere in what will be pushed). The same command
      #    on the full local history prints a non-zero count, which is what it is there to catch:
      git log -p publish | grep -cF -f /tmp/old-b64.txt
      # 4. Also run the scan on that tree, and check only one commit is reachable:
      npm test && git rev-list --count publish   # 1
      ```

      Push only `publish` (as `main`): `git push -u origin publish:main`. Do not push any other branch or
      tag of this local repository, and delete `/tmp/old-b64.txt` afterwards.
- [ ] **Create the GitHub repository** (`mashrabiya`), add a one-line description and topics
      (`home-assistant`, `hacs`, `lovelace`, `custom-card`, `smart-mirror`, `kiosk`), push `main`.
- [ ] **Enable GitHub Actions** and confirm the first `test` run is green.
- [ ] **Screenshots.** Capture the files listed in [README.md](README.md#screenshots) into `docs/img/`,
      with alt text, and replace the TODO table in the README with the images. Add a short screen
      recording of a page swipe and the touch effects, and a photo of a mounted build.
- [ ] **Install through HACS from scratch** as a custom repository on a clean Home Assistant, following
      [docs/INSTALL.md](docs/INSTALL.md) exactly. Confirm that HACS copies **both** files into
      `www/community/mashrabiya/` (if releases attach assets, attach both JS files, or HACS fetches only
      the named one), that `/hacsfiles/mashrabiya/mashrabiya-card.js` loads, and that the logic file is
      fetched with the same `?hacstag=` query.
- [ ] **Install by hand from scratch** following the manual path; fix every step that surprised you.
- [ ] **State the minimum Home Assistant version.** `hacs.json` has no `homeassistant` key yet because
      it has not been measured. The card needs the `weather/subscribe_forecast` WebSocket message and
      the area / device / entity registries on the frontend `hass` object; test on the oldest version
      you want to support and add it to `hacs.json` and INSTALL.md. Also record the Chromium version tested.
- [ ] **Tag `v0.1.0`**, create a GitHub release with notes from CHANGELOG.md (change "Unreleased" to
      the date), and attach `mashrabiya-card.js` and `mashrabiya-logic.js`.
- [ ] **Submit to the HACS default list** (a pull request to `hacs/default`) once there is a tagged
      release, the README renders in HACS, and the HACS validation action passes. Consider adding the
      `hacs/action` validation and `home-assistant/actions/hassfest`-style checks to CI first.
- [ ] Build the kiosk from scratch following [docs/KIOSK.md](docs/KIOSK.md) on a fresh image.
- [ ] An issue template asking for the Home Assistant version, browser, card config and a console log
      (the console banner shows the card version).
- [ ] Dependabot for the workflow's actions.

## Remaining assumptions to remove (before 1.0)

- [ ] **English only.** All words are in one `STRINGS` table in `mashrabiya-logic.js`, but there is no
      language selection, `STRINGS.months` must match `STRINGS.locale`, plural forms are English
      (`n === 1`), and some words are composed by position in a sentence ("N more: tap More"). Add a
      `language` option and a second language (use the Home Assistant user language) before promising i18n.
- [ ] **Imperial/metric.** Room gauges follow the unit Home Assistant reports, but the comfort bands
      and gauge scales are two fixed sets (about 18 to 24 degrees C / 64 to 76 degrees F), the thermostat
      steps by one whole degree, and the radar range ring labels say "m".
- [ ] **Clock.** 12-hour with AM/PM only. Add a 24-hour option (and follow the user profile's format).
- [ ] **Sizing.** `--mm` is fixed at 4.235 px per mm (0.236 mm per CSS pixel). Make it an option
      (`mm_px`) so builds with a different panel do not need to bend Chromium's scale factor.
- [ ] **Climate modes.** The thermostat offers Heat and Off only; cooling-only and auto systems need
      their own buttons from the entity's `hvac_modes`.
- [ ] **Air quality.** The `air` option expects an enum sensor (`highest` to `lowest`); numeric AQI
      sensors only appear on room pages. Accept a numeric sensor with thresholds.
- [ ] **Radar.** Discovery assumes ESPHome `ld2450`-style names, three targets and a 120 degree field.
- [ ] **Doors and locks pair by position.** Replace the parallel lists with
      `doors: [{lock, sensor, name}]` before 1.0.
- [ ] **Font.** The default font is fetched from Google Fonts at runtime; vendoring it (SIL OFL) would
      make the default private and offline-capable.
- [ ] **Weather forecast.** Uses `weather/subscribe_forecast`; fall back to `weather.get_forecasts` on
      older versions, or document the minimum.
- [ ] **Kiosk.** KIOSK.md targets Raspberry Pi OS Trixie with labwc; re-check the labwc 0.20 behaviours
      it describes (the `category` quirk) against newer releases.
- [ ] **Optional:** a headless-browser smoke test that mounts the card with a fake `hass` and checks
      the bare-config and fully configured pages render without console errors.
