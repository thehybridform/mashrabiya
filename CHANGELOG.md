# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `more_button` option (default `true`). `false` removes Main's More button; the remaining buttons
  share the row evenly (wider, never smaller), and the status overflow reads "N more" instead of
  "N more: tap More". Page 2 stays reachable by swiping and the navigation row.

### Changed

- More page redrawn as instruments: one row of large padlocks (door names drop a trailing "Lock" or
  "Door"), one row of scene glyphs with Off moved into the section heading, the thermostat as the
  room pages' arc gauge with − and + either side and the target under the dial, Now playing with the
  media equaliser and a larger title, and a larger House line. Sections size to their content and
  stack 15 mm apart; rows beyond four padlocks or five scenes (three above `text_scale` 1.25) split
  into the fewest even rows. The instruments get the room pages' entrance.
- README screenshots re-taken from the demo house.

### Fixed

- The news ticker's feed divider rule (`.sec`) is scoped to the ticker. Unscoped, it also matched a
  door's state word on More ("Unlocked"), laying it out 2 px wide behind a stray bar.

## [0.1.1] - 2026-11-17

### Added

- HACS validation action in CI, for submission to the HACS default list.

## [0.1.0] - 2026-11-17

First public release.

### Added

- `mashrabiya-card`: a full-screen panel-view card for a two-way-mirror smart display, sized in
  physical millimetres and drawn only in light on black.
- Main glance page: clock, date, weather with an animated glyph and a rain warning, one status line
  that says in words whether you need to act, and Leaving, Lock all, Lights off and More buttons.
- More page: per-lock padlocks with door state, scenes, thermostat, Now playing, a house summary.
- Radar page for LD2450-style mmWave presence radars, discovered by entity pattern (`radar_pattern`).
- One read-only page per Home Assistant area: temperature and humidity gauges, air quality, occupancy,
  doors and windows, locks, lights in their real colour, fans, blinds, media, fragrance diffusers.
- Detail pages fit the glass: a fixed header and navigation row, two-column rows, paired diffusers and
  two-up radar scopes where safe, one chips row, at most two media players per room, and a body that
  scrolls by drag with a "More ▾" cue when it still does not fit.
- Settle-in entrance on every page entry, tap or swipe: gauges, bars and vials settle onto their value,
  readings roll into place and micro-labels track in, never further than a few percent from the truth.
- Configurable page order (`pages`), slide or fade transitions, swipe-to-navigate with drag-follow.
- Guest privacy (`privacy: auto | always | off`), a stale-data state ("Connection lost"), night mode,
  mirror mode (double tap for pure glass), an open-door alert, an RSS news ticker (`ticker: fade | scroll`).
- `text_scale` (0.8 to 2) with a 9 mm minimum text size at the default; `prefers-contrast: more` and
  `prefers-reduced-motion` honoured.
- A demo house (`demo/`): the card in a plain browser with a made-up home and a fake `hass`, whose
  service calls do nothing; the README screenshots are taken from it (`node demo/capture.mjs`).
- Optional frame-rate meter (`debug_fps`, or `?fps=1` on the dashboard URL).
- A version banner in the browser console and a `window.customCards` entry ("Mashrabiya") for the card picker.
- Documentation: installation (HACS and manual), Raspberry Pi 5 kiosk recipe, design rationale, hardware guide.
- Tests on Node's built-in runner, including source guards (lock-only, read-only pages, compositor-only
  motion) and a repository privacy scan.

### Legacy

- Legacy alias: `mirror-panel-card`, the card's earlier name, is registered as a subclass of
  `mashrabiya-card`, so legacy dashboards (`type: custom:mirror-panel-card`) keep working. It is
  deprecated; use `type: custom:mashrabiya-card` in new dashboards.

### Security

- Lock-only by construction: the card can lock and can never unlock or open; a test fails if an unlock
  or open call is added.

[0.1.1]: https://github.com/thehybridform/mashrabiya/releases/tag/v0.1.1
[0.1.0]: https://github.com/thehybridform/mashrabiya/releases/tag/v0.1.0
