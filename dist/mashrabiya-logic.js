// Pure logic for the Mashrabiya card (dist/mashrabiya-card.js). No DOM, no hass calls.
// A plain script that assigns globalThis.MashrabiyaLogic: the card imports it for its side effect in the
// browser, and test/*.test.js run it with vm.runInThisContext under node --test.
(function () {
  "use strict";

  // Every word the card shows or speaks (visible text, aria labels, status lines). English only for now;
  // a translation replaces this table (or its values) and nothing else. Entries that need a number or a
  // name are small functions. `locale` also drives date formatting.
  const STRINGS = {
    locale: "en-US",
    am: "AM", pm: "PM",
    // Main page
    leaving: "Leaving", lockAll: "Lock all", lightsOff: "Lights off", more: "More", outside: "Outside", headlines: "Headlines",
    allClear: "All clear", overflow: (n, moreButton) => (moreButton === false ? `${n} more` : `${n} more: tap More`), connectionLost: "Connection lost",
    internetDown: "Internet down", airPoor: "Indoor air poor",
    doorsUnlocked: (g) => `${g} unlocked`, doorsOpen: (g) => `${g} open`,
    locksJammed: (names, n) => `${names} ${n > 1 ? "locks" : "lock"} jammed`,
    locksOffline: (names, n) => `${names} ${n > 1 ? "locks" : "lock"} offline`,
    allDoors: (n) => `All ${n} doors`, someDoors: (n) => `${n} doors`, and: " and ",
    allLocked: "All locked", unlockedN: (n) => `${n} unlocked`, allOff: "All off", onN: (n) => `${n} on`,
    // Flashes after a tap
    done: "Done", set: "Set", locked: "Locked", failed: "Failed — try again",
    // More page
    homeControls: "Home controls", doors: "Doors", thermostat: "Thermostat", nowPlaying: "Now playing", house: "House",
    inside: "Inside", target: "Target", lowerTarget: "Lower target temperature", raiseTarget: "Raise target temperature",
    heat: "Heat", off: "Off", rooms: "Rooms", pause: "Pause", play: "Play",
    // Navigation: one name for the way back to the first page, on every page (Apple HIG: one name per concept).
    homePage: "Home", goPrev: (name) => `Previous: ${name}`, goNext: (name) => `Next: ${name}`,
    airLabel: "Air ", internetLabel: "Internet ", internetOk: "OK", internetBad: "Down",
    // Door states
    open: "Open", closed: "Closed", unlocked: "Unlocked", jammed: "Jammed", offline: "Offline",
    locking: "Locking", unlocking: "Unlocking",
    // Room and radar pages
    room: "Room", radar: "Radar", radarSub: (n) => `mmWave · ${n} ${n === 1 ? "sensor" : "sensors"}`,
    targetsN: (n) => `${n} ${n === 1 ? "target" : "targets"}`, clear: "Clear",
    peopleInView: (name, n) => `${name}: ${n ? n + (n === 1 ? " person" : " people") : "nobody"} in view`,
    lights: "Lights", fans: "Fans", blinds: "Blinds", playing: "Playing", paused: "Paused",
    occupied: "Occupied", empty: "Empty", on: "On", air: "Air", tempMicro: "Temp", humMicro: "Hum", targetWord: "target",
    pageOf: (i, n) => `Page ${i} of ${n}`,
    // Fragrance diffusers (room pages, status line)
    moreBelow: "More ▾", moreN: (n) => `+${n} more`,
    scent: "Scent", low: "Low", alternating: "Alternating", until: (t) => `until ${t}`,
    scentLow: (names) => `${names} scent low`, diffusersN: (n) => `${n} diffusers`,
    intensities: { off: "Off", gentle: "Gentle", subtle: "Subtle", medium: "Medium", strong: "Strong", intense: "Intense" },
    spokenScent: (name, word, slots) => `${name}: ${word}. ${slots}`,
    spokenVial: (n, scent, pct, low) => `slot ${n} ${scent || ""} ${pct === null ? "" : pct + "%"}${low ? " low" : ""}`,
    spokenTemp: (v) => `temperature ${v}`, spokenHum: (v) => `humidity ${v}`,
    spokenClimate: (mode, v, t) => `${mode}, temperature ${v}, target ${t}`,
    // Weather
    rainWord: "Rain", hailWord: "Hail", snowWord: "Snow", sleetWord: "Sleet",
    wetNow: (kind) => `${kind} now`, wetFrom: (kind, h, ampm) => `${kind} from ${h} ${ampm}`,
    conditions: {
      "clear-night": "Clear", cloudy: "Cloudy", exceptional: "Unusual weather", fog: "Fog", hail: "Hail",
      lightning: "Lightning", "lightning-rainy": "Thunderstorms", partlycloudy: "Partly cloudy",
      pouring: "Heavy rain", rainy: "Rain", snowy: "Snow", "snowy-rainy": "Sleet", sunny: "Sunny",
      windy: "Windy", "windy-variant": "Windy",
    },
    airWords: { highest: "Excellent", high: "Good", medium: "Fair", low: "Poor", lowest: "Very poor" },
    modes: { heat: "Heat", cool: "Cool", heat_cool: "Auto", auto: "Auto", dry: "Dry", fan_only: "Fan", off: "Off" },
    // Presence is visible to visitors: never a name. Not "Home": that word is the way back to the first page.
    home: "Someone home", away: "Away",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    none: "—",
  };
  const S = STRINGS;

  // Nothing in this file or in the card names a house: every entity comes from the card's config or is
  // discovered from the states (see resolveConfig). A bare card shows the clock and the weather it finds.
  const DEFAULTS = { locks: [], doors: [], internet: null, air: null };
  const FALLBACK_TZ = "UTC";
  const FALLBACK_UNIT = "°C";
  const DEFAULT_FONT_URL = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
  const RADAR_PATTERN = "{prefix}_presence";
  const NEWS_TONES = ["green", "blue", "yellow", "orange", "purple"];
  const OFFLINE = new Set(["unavailable", "unknown"]);
  const MAX_LINES = 3;

  function formatId(id) {
    const obj = String(id || "").split(".").pop();
    return obj.split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  }

  function entityName(states, id) {
    const n = states && states[id] && states[id].attributes && states[id].attributes.friendly_name;
    return n ? String(n) : formatId(id);
  }

  // "Front Door Lock" -> "Front Door", so "... lock offline" never reads "Lock lock".
  function lockName(states, id) {
    return entityName(states, id).replace(/\s+lock$/i, "");
  }

  function joinNames(names) {
    if (names.length <= 1) return names.join("");
    return names.slice(0, -1).join(", ") + S.and + names[names.length - 1];
  }

  // Three or more names would wrap past the glass width at 13 mm type, so they become a count.
  function group(names, total) {
    if (names.length < 3) return joinNames(names);
    return names.length === total ? S.allDoors(total) : S.someDoors(names.length);
  }

  function stateOf(states, id) {
    return id && states && states[id] ? states[id].state : undefined;
  }

  // Lines most severe first: security (red) then attention (orange). At most three; overflow folds
  // into the third line so nothing is silently dropped.
  function exceptions(states, cfg, scents) {
    const c = Object.assign({}, DEFAULTS, cfg || {});
    const s = states || {};
    const unlocked = [], jammed = [], offline = [], open = [];
    for (const id of c.locks || []) {
      const v = stateOf(s, id);
      if (v === undefined || v === "locked") continue;
      if (OFFLINE.has(v)) offline.push(lockName(s, id));
      else if (v === "jammed") jammed.push(lockName(s, id));
      else unlocked.push(lockName(s, id));
    }
    for (const id of c.doors || []) {
      if (stateOf(s, id) === "on") open.push(entityName(s, id));
    }
    const lines = [];
    if (unlocked.length) lines.push({ level: "security", text: S.doorsUnlocked(group(unlocked, (c.locks || []).length)) });
    if (jammed.length) lines.push({ level: "security", text: S.locksJammed(joinNames(jammed), jammed.length) });
    // An open door is an alert (red, and the glass breathes red) unless door_alert is off.
    if (open.length) lines.push({ level: c.door_alert === false ? "attention" : "alert", text: S.doorsOpen(group(open, (c.doors || []).length)) });
    if (offline.length) lines.push({ level: "attention", text: S.locksOffline(joinNames(offline), offline.length) });
    if (stateOf(s, c.internet) === "off") lines.push({ level: "attention", text: S.internetDown });
    if (["low", "lowest"].includes(stateOf(s, c.air))) lines.push({ level: "attention", text: S.airPoor });
    // Discovered diffusers (scentModel) with a vial running low: one line for all of them.
    const lowScent = (Array.isArray(scents) ? scents : []).filter((m) => m && m.anyLow).map((m) => m.name);
    if (lowScent.length) lines.push({ level: "attention", text: S.scentLow(lowScent.length < 3 ? joinNames(lowScent) : S.diffusersN(lowScent.length)) });
    return foldLines(lines, c.more_button);
  }

  function foldLines(lines, moreButton) {
    if (lines.length <= MAX_LINES) return lines;
    const rest = lines.slice(MAX_LINES - 1);
    const level = ["security", "alert"].find((k) => rest.some((l) => l.level === k)) || "attention";
    return lines.slice(0, MAX_LINES - 1).concat([{ level, text: S.overflow(rest.length, moreButton) }]);
  }

  // --- stale data (Apple HIG: keep people informed; never show a reassuring state that may be untrue) ----
  // The frontend sets hass.connected false while the websocket is down and fires a window
  // "connection-status" event ("connected" / "disconnected"). Down for CONNECTION.graceMs means lost: the
  // status line then says so first, "All clear" is never shown, and the card dims every reading.
  const CONNECTION = { graceMs: 10000 };
  const connectionDown = (connected, status) => connected === false || status === "disconnected";
  // `downSince`: when the card first saw the link down (ms), else null.
  function connectionLost(downSince, nowMs) {
    return finite(downSince) && finite(nowMs) && nowMs - downSince >= CONNECTION.graceMs;
  }

  // What the status line shows: the exceptions, led by "Connection lost" when it is; "All clear" only when
  // there is nothing to say AND the data is live. At most MAX_LINES, folded as exceptions() folds.
  function statusLines(ex, lost, moreButton) {
    const lines = Array.isArray(ex) ? ex.slice() : [];
    if (lost) return foldLines([{ level: "attention", text: S.connectionLost, conn: true }].concat(lines), moreButton);
    return lines.length ? foldLines(lines, moreButton) : [{ level: "calm", text: S.allClear }];
  }

  // --- time -----------------------------------------------------------------------------------
  const fmtCache = new Map();
  function parts(ms, tz) {
    let zone = tz || FALLBACK_TZ;
    let f = fmtCache.get(zone);
    if (!f) {
      try {
        f = new Intl.DateTimeFormat(S.locale, {
          timeZone: zone, hourCycle: "h23", year: "numeric", month: "long", day: "numeric",
          weekday: "long", hour: "numeric", minute: "2-digit",
        });
      } catch (e) {
        return parts(ms, FALLBACK_TZ);
      }
      fmtCache.set(zone, f);
    }
    const o = {};
    for (const p of f.formatToParts(new Date(Number(ms)))) o[p.type] = p.value;
    return { year: o.year, month: o.month, day: Number(o.day), weekday: o.weekday, hour: Number(o.hour) % 24, minute: Number(o.minute) };
  }

  const pad = (n) => String(n).padStart(2, "0");

  function hour12(h) {
    return { h: h % 12 === 0 ? 12 : h % 12, ampm: h < 12 ? S.am : S.pm };
  }

  function clock(ms, tz) {
    const p = parts(ms, tz);
    const { h, ampm } = hour12(p.hour);
    const month = S.months.indexOf(p.month) + 1; // S.months matches S.locale (it only builds the minute key)
    return {
      time: `${h}:${pad(p.minute)}`,
      ampm,
      date: `${p.weekday}, ${p.month} ${p.day}`,
      key: `${p.year}-${pad(month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`,
    };
  }

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h * 60 + (m || 0);
  };

  // Window may wrap midnight (22:00 -> 06:30). Start inclusive, end exclusive.
  function isNight(ms, tz, start, end) {
    const p = parts(ms, tz);
    const t = p.hour * 60 + p.minute;
    const a = toMinutes(start || "22:00"), b = toMinutes(end || "06:30");
    return a <= b ? t >= a && t < b : t >= a || t < b;
  }

  // --- weather --------------------------------------------------------------------------------
  const WET = { rainy: S.rainWord, pouring: S.rainWord, "lightning-rainy": S.rainWord, hail: S.hailWord, snowy: S.snowWord, "snowy-rainy": S.sleetWord };
  const HOUR_MS = 3600e3;

  // First hour within [now's hour, now + hours] expecting precipitation -> "Rain from 9 PM" / "Rain now".
  function rainWindow(forecast, now, tz, hours) {
    if (!Array.isArray(forecast)) return null;
    const horizon = Number(now) + (hours || 4) * HOUR_MS;
    for (const f of forecast) {
      const t = f && Date.parse(f.datetime);
      if (!Number.isFinite(t) || t + HOUR_MS <= Number(now) || t > horizon) continue;
      const kind = WET[f.condition] || (Number(f.precipitation_probability) >= 50 ? S.rainWord : null);
      if (!kind) continue;
      if (t <= Number(now)) return S.wetNow(kind);
      const { h, ampm } = hour12(parts(t, tz).hour);
      return S.wetFrom(kind, h, ampm);
    }
    return null;
  }

  function conditionWord(c) {
    return S.conditions[c] || "";
  }

  function tempText(v) {
    const n = Number.parseFloat(v);
    if (v === undefined || v === null || !Number.isFinite(n)) return S.none;
    const r = Math.round(n);
    return (r < 0 ? "−" + Math.abs(r) : String(r)) + "°";
  }

  // --- counts and words -----------------------------------------------------------------------
  function unlockedCount(states, locks) {
    return (locks || DEFAULTS.locks).filter((id) => {
      const v = stateOf(states, id);
      return v !== undefined && v !== "locked" && !OFFLINE.has(v);
    }).length;
  }

  function locksToLock(states, locks) {
    return (locks || DEFAULTS.locks).filter((id) => {
      const v = stateOf(states, id);
      return v !== undefined && v !== "locked" && !OFFLINE.has(v);
    });
  }

  function lockSublabel(n) {
    if (n === null || n === undefined) return S.none;
    return n === 0 ? S.allLocked : S.unlockedN(n);
  }

  function lightsOn(states) {
    if (!states) return 0;
    return Object.keys(states).filter((id) => id.startsWith("light.") && states[id] && states[id].state === "on").length;
  }

  function lightsSublabel(n) {
    return n === 0 ? S.allOff : S.onN(n);
  }

  const AIR = S.airWords;
  function airWord(v) {
    return AIR[v] || S.none;
  }

  // Visible to visitors: never the person's name, never which zone they are in.
  function presenceWord(v) {
    if (v === "home") return S.home;
    if (v === undefined || v === null || OFFLINE.has(v)) return S.none;
    return S.away;
  }

  function doorWord(lockState, doorState) {
    if (doorState === "on") return S.open;
    if (lockState === "locked") return S.locked;
    if (lockState === undefined) return S.none;
    if (OFFLINE.has(lockState)) return S.offline;
    if (lockState === "jammed") return S.jammed;
    return S.unlocked;
  }

  function stepTarget(current, delta, min, max) {
    const n = Number(current);
    if (current === undefined || current === null || !Number.isFinite(n)) return null;
    const next = delta > 0 ? Math.floor(n) + delta : Math.ceil(n) + delta;
    return Math.min(max, Math.max(min, next));
  }

  function debounceOk(last, now, ms) {
    return last === undefined || last === null || now - last >= (ms || 700);
  }

  const SWIPE_MAX_MS = 800;
  const finite = (v) => typeof v === "number" && Number.isFinite(v);

  // Classify a finished gesture. dx/dy in px (end minus start), ms = duration.
  function swipeDirection(dx, dy, ms, minPx) {
    if (![dx, dy, ms, minPx].every(finite) || ms < 0 || minPx <= 0) return null;
    if (ms > SWIPE_MAX_MS) return null;
    if (Math.abs(dx) < minPx || Math.abs(dx) < 2 * Math.abs(dy)) return null;
    return dx < 0 ? "left" : "right";
  }

  // --- pages ----------------------------------------------------------------------------------
  // Pages sit in a loop laid out left to right like a carousel: Main, More, then one page per room. A
  // direction is the way the finger (and the content) moves: swipe LEFT brings in the NEXT page from the
  // right edge, swipe RIGHT the previous one from the left; both wrap, so there is no dead end.
  // Rooms come and go with the registries, so the card tracks the current page by KEY, not index.
  const PAGES = ["main", "more"];
  const RADAR_KEY = "radar";

  const mod = (n, m) => ((n % m) + m) % m;

  const roomKey = (id) => `room:${id}`;
  // Default order: Main, More, Radar (only when at least one radar was discovered), then the rooms.
  // `pages` (the card's `pages:` option) reorders that with orderPages. `opts.private` (privacyActive)
  // leaves Radar out whatever the list says: live positions are not for guests.
  const pageKeys = (rooms, radars, pages, opts) => {
    const radar = Array.isArray(radars) && radars.length && !(opts && opts.private);
    const avail = PAGES.concat(radar ? [RADAR_KEY] : [], (rooms || []).map((r) => roomKey(r.id)));
    return orderPages(pages, avail);
  };

  // --- privacy (Apple HIG: act in people's best interest; redact on always-visible surfaces) ---------
  // The glass faces whoever is in the hall. `privacy` "always" hides the Radar page, room occupancy and
  // More's presence word; "off" never does; "auto" (the default) does while the configured `person`, or
  // without one every person.* entity, is not home. A configured person that is missing or unknown counts
  // as not home (fail private); with no person entities at all there is nothing to go on, so auto shows.
  function privacyActive(cfg, states) {
    const mode = cfg && cfg.privacy;
    if (mode === "always") return true;
    if (mode === "off") return false;
    const s = states || {};
    if (cfg && cfg.person) return stateOf(s, cfg.person) !== "home";
    const people = idsOf(s, "person");
    return people.length > 0 && !people.some((id) => stateOf(s, id) === "home");
  }

  // The configured swipe order. `config` is an ordered list of page keys (main, more, radar, room:<area_id>) with
  // the wildcard "rooms" for every room not named elsewhere; `available` is the default-ordered list of pages that
  // exist right now. Main is always first. Listed pages that do not exist now are skipped (they slot in when they
  // appear). Unlisted rooms go where "rooms" is, else at the end; unlisted more/radar are left out on purpose.
  // Without a list, the default order stands.
  function orderPages(config, available) {
    const avail = Array.isArray(available) ? available : [];
    if (!Array.isArray(config)) return avail.slice();
    const isRoom = (k) => String(k).startsWith("room:");
    const named = (k) => typeof k === "string" && k !== "";
    const listed = new Set(config.filter(named));
    const out = ["main"];
    const add = (k) => {
      if (!out.includes(k) && avail.includes(k)) out.push(k);
    };
    const rest = () => avail.filter((k) => isRoom(k) && !listed.has(k)).forEach(add);
    for (const k of config) {
      if (k === "rooms") rest();
      else if (named(k)) add(k);
    }
    if (!listed.has("rooms")) rest();
    return out;
  }

  // Index of `key` in the (possibly changed) list; a page that has gone falls back to Main.
  function pageIndexFor(keys, key) {
    const i = Array.isArray(keys) ? keys.indexOf(key) : -1;
    return i < 0 ? 0 : i;
  }

  function firstRoomIndex(keys) {
    return (keys || []).findIndex((k) => String(k).startsWith("room:"));
  }

  // Previous / Next on a detail page: the indexes either side of `index` in the loop, or null where that
  // neighbour is Main (the Home button already goes there) or there is no row (Main itself, a lone page).
  function navTargets(keys, index) {
    const n = Array.isArray(keys) ? keys.length : 0;
    const i = Math.floor(Number(index));
    if (n < 2 || !(i > 0) || i >= n) return { prev: null, next: null };
    const p = mod(i - 1, n), x = mod(i + 1, n);
    return { prev: p === 0 ? null : p, next: x === 0 ? null : x };
  }

  // Swipe LEFT (finger right -> left) is +1, swipe RIGHT is -1.
  function nextPage(index, direction, count) {
    const n = Math.floor(Number(count));
    if (!(n >= 1)) return 0;
    const i = Number.isFinite(Number(index)) && index !== null ? mod(Math.floor(Number(index)), n) : 0;
    if (direction === "left") return mod(i + 1, n);
    if (direction === "right") return mod(i - 1, n);
    return i;
  }

  // Which way to slide when jumping from one page to another (taps, idle return): the shorter way
  // round the loop, ties going forward. Forward is the content moving LEFT (the swipe that gets there).
  function pageDirection(from, to, count) {
    const n = Math.floor(Number(count));
    if (!(n >= 1) || from === to) return null;
    const fwd = mod(to - from, n);
    if (fwd === 0) return null;
    return fwd <= n - fwd ? "left" : "right";
  }

  const clamp01 = (p) => (typeof p === "number" && Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0);
  const nz = (v) => v + 0; // never -0

  // translateX percentages: the leaving page goes the way the finger went, the arriving page comes
  // in behind it. `progress` (0..1) is how far a drag already took it, so a committed drag finishes
  // the move from where the finger let go.
  function slideFrames(direction, progress) {
    if (direction !== "right" && direction !== "left") return null;
    const s = direction === "right" ? 1 : -1;
    const p = clamp01(progress);
    return { out: [nz(100 * s * p), 100 * s], in: [nz(-100 * s * (1 - p)), 0] };
  }

  // Parallax: the page's chrome layer (edge rails) is counter-moved so that it travels `depth` of the
  // page's distance during a slide. Percentages of the page width, like slideFrames.
  function chromeFrames(direction, depth, progress) {
    const f = slideFrames(direction, progress);
    if (!f) return null;
    const k = depth === undefined ? 0.6 : Number(depth);
    const rel = (v) => nz(v * k - v);
    return { out: f.out.map(rel), in: f.in.map(rel) };
  }

  // The wipe line sits on the seam between the leaving and the arriving page: translateX % of the screen.
  function wipeFrames(direction, progress) {
    const p = clamp01(progress);
    if (direction === "right") return [nz(100 * p), 100];
    if (direction === "left") return [nz(100 * (1 - p)), 0];
    return null;
  }

  // --- drag-follow ------------------------------------------------------------------------------
  // Past the slop, a horizontal drag moves the page with the finger and brings the neighbour it is
  // uncovering along beside it. Release commits at commitFrac of the page width (or on a recognised
  // swipe) and finishes the slide; otherwise the page springs back. Settle times scale with the
  // distance left and never exceed the slide (commit) or springMaxMs.
  const DRAG = { commitFrac: 0.25, commitMaxMs: 320, springMaxMs: 250, minMs: 120, depth: 0.6, fadeFrac: 0.4 };

  // Finger moving left uncovers the next page (it sits to the right), moving right the previous one.
  function dragNeighbour(dx) {
    if (!finite(dx) || dx === 0) return null;
    return dx < 0 ? "next" : "prev";
  }

  // `swipe` is swipeDirection's classification of the same gesture (the fast-swipe rule), or null.
  function dragDecision(dx, width, swipe) {
    if (!finite(dx) || !finite(width) || width <= 0) return "stay";
    const side = dragNeighbour(dx);
    if (!side) return "stay";
    const along = (dx < 0 && swipe === "left") || (dx > 0 && swipe === "right");
    return along || Math.abs(dx) >= DRAG.commitFrac * width ? side : "stay";
  }

  // Pixel offsets while dragging: the current page and its neighbour (flush beside it), each page's
  // chrome layer offset inside it (parallax at `depth`), and the seam in % of the screen (the wipe line).
  function dragOffsets(dx, width, depth) {
    if (!finite(dx) || !finite(width) || width <= 0) return null;
    const k = depth === undefined ? DRAG.depth : Number(depth);
    const cur = Math.max(-width, Math.min(width, dx));
    const nb = cur < 0 ? cur + width : cur > 0 ? cur - width : null;
    const rel = (v) => nz(v * k - v);
    return {
      cur: nz(cur), nb: nb === null ? null : nz(nb),
      curChrome: rel(cur), nbChrome: nb === null ? null : rel(nb),
      seam: nz(cur < 0 ? ((width + cur) / width) * 100 : (cur / width) * 100),
    };
  }

  // --- fade transition (config `transition: fade`) ---------------------------------------------------
  // Pages do not move: the outgoing one fades 1 -> 0 while the arriving one fades 0 -> 1 (with a very
  // slight 0.985 -> 1 scale for depth). A drag drives the crossfade: full at DRAG.fadeFrac of the width,
  // so the commit point (a quarter) is already past half way.
  function fadeProgress(dx, width) {
    if (!finite(dx) || !finite(width) || width <= 0) return 0;
    return clamp01(Math.abs(dx) / (DRAG.fadeFrac * width));
  }

  const fadeScale = (progress) => 0.985 + 0.015 * clamp01(progress);

  // Keyframes from `progress` (how far a drag already took it) to the end: opacity and scale. An
  // interrupted fade passes the opacities the pages have actually reached (outFrom, inFrom) so the
  // new fade continues from there instead of jumping.
  function fadeFrames(progress, outFrom, inFrom) {
    const p = clamp01(progress);
    const o = finite(outFrom) ? clamp01(outFrom) : 1 - p;
    const i = finite(inFrom) ? clamp01(inFrom) : p;
    return { out: [o, 0], in: [i, 1], scale: [fadeScale(i), 1] };
  }

  // Asymmetric fade (Apple HIG: fade out, then fade in; brief, never a dead pause). The outgoing page
  // leaves as it always did (crossfadeMs, ease-in-out); the arriving one comes up slower on a
  // decelerating curve, starting when the out is half done so there is a dim beat but no black gap.
  // After a drag (progress > 0) the out finishes at the old speed with no delay, and the in is scaled to
  // the distance left, capped at FADE.dragInMaxMs.
  const FADE = { inMs: 700, inDelayFrac: 0.5, inEase: "cubic-bezier(0.16, 1, 0.3, 1)", outEase: "ease-in-out", dragInMaxMs: 600 };
  function fadeTiming(progress) {
    const p = finite(progress) ? clamp01(progress) : 0;
    if (p === 0) {
      return { outMs: MOTION.crossfadeMs, inMs: FADE.inMs, inDelayMs: Math.round(MOTION.crossfadeMs * FADE.inDelayFrac), inEase: FADE.inEase, outEase: FADE.outEase };
    }
    const inMs = Math.max(DRAG.minMs, Math.min(FADE.dragInMaxMs, Math.round(FADE.inMs * (1 - p))));
    return { outMs: settleMs(1 - p, 1, MOTION.crossfadeMs), inMs, inDelayMs: 0, inEase: FADE.inEase, outEase: FADE.outEase };
  }

  // A computed opacity (string or number) as a finite 0..1 number, else `fallback`. Used to continue an
  // interrupted fade (page or mirror veil) from what is on screen rather than from its target.
  function currentOpacity(value, fallback) {
    const v = typeof value === "string" ? (value.trim() === "" ? NaN : Number(value)) : value;
    return finite(v) ? clamp01(v) : fallback;
  }

  // --- mirror mode ----------------------------------------------------------------------------------
  // Two taps within DOUBLE_TAP.ms and DOUBLE_TAP.mm of each other (prev/cur are {t, x, y}; `mm` is the
  // px per mm) on a non-interactive area black the glass out as a pure mirror (MashrabiyaCard._mirrorEnter).
  const DOUBLE_TAP = { ms: 350, mm: 10 };
  function isDoubleTap(prev, cur, mm) {
    if (!prev || !cur || !finite(mm) || mm <= 0) return false;
    if (![prev.t, prev.x, prev.y, cur.t, cur.x, cur.y].every(finite)) return false;
    const dt = cur.t - prev.t;
    return dt >= 0 && dt <= DOUBLE_TAP.ms && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DOUBLE_TAP.mm * mm;
  }

  // The veil fades in over inMs and out over outMs; under reduced motion nearly instantly.
  const MIRROR = { inMs: 400, outMs: 600, reducedMs: 100, alertOutMs: 150 };
  function mirrorFadeMs(which, reduced) {
    return reduced ? MIRROR.reducedMs : which === "in" ? MIRROR.inMs : MIRROR.outMs;
  }

  // A door alert that was not already on (ids in `after` missing from `before`) ends mirror mode at once.
  function mirrorAlertExit(before, after) {
    const had = before instanceof Set ? before : new Set();
    return Array.from(after || []).some((id) => !had.has(id));
  }

  // Settle time for `dist` px of a `span` px journey that takes maxMs in full; at least DRAG.minMs.
  function settleMs(dist, span, maxMs) {
    const max = Number(maxMs);
    if (!finite(span) || span <= 0) return max;
    const k = finite(dist) ? Math.max(0, Math.min(1, dist / span)) : 0;
    return Math.max(Math.min(DRAG.minMs, max), Math.round(max * k));
  }

  // drawMs: line and bracket draw-ins on page entry. With the stagger capped at 220 ms they are over
  // inside 600 ms. Vivid: stat icons pop in (scale popScale -> popOvershoot -> 1, popMs), edge rails draw
  // top to bottom (railMs), and a coloured wipe line rides the seam of a page move (wipeMs = slideMs).
  // Settle in (settleFrames): gauges, bars and vials arrive at settleFrom of their value, overshoot by
  // settleOver of full scale at settleOverAt of settleMs, and settle; the gauge marker sends one ring
  // (settlePulseMs) from the overshoot. Readings roll up into place a character at a time (rollDelays:
  // rollStepMs apart, each rollCharMs from rollLift % below, all inside rollMs; text longer than
  // rollMaxChars just fades with its block). Micro-labels track in (scaleX labelScale -> 1, labelMs).
  // The whole entrance, stagger included, ends inside entranceMs.
  const MOTION = {
    slideMs: 320, fadeMs: 140, staggerMs: 220, staggerBase: 40, staggerStep: 45, staggerCap: 4, drawMs: 340,
    crossfadeMs: 360, popMs: 360, popScale: 0.8, popOvershoot: 1.08, railMs: 420, wipeMs: 320,
    settleMs: 600, settleFrom: 0.85, settleOver: 0.03, settleOverAt: 0.6, settlePulseMs: 320,
    rollMs: 450, rollStepMs: 30, rollCharMs: 300, rollLift: 60, rollMaxChars: 12,
    labelMs: 400, labelScale: 1.08, entranceMs: 950,
  };

  // The keyframe fractions of an entrance settle onto `f` (a 0..1 fraction of full scale): a little
  // short, a little over, then exactly f. Honest by construction: every frame is within
  // max(15 % of f, 3 %) of f and above zero, so a glance mid-entrance reads (nearly) the truth. No
  // reading (not a finite number) or a zero value: null, nothing moves.
  function settleFrames(f) {
    if (typeof f !== "number" || !Number.isFinite(f)) return null;
    const to = Math.min(1, f);
    if (to <= 0) return null;
    const room = Math.max(0.15 * to, MOTION.settleOver);
    const from = Math.max(to * MOTION.settleFrom, to - room);
    const over = Math.min(1, to + Math.min(MOTION.settleOver, room));
    return [from, over, to];
  }

  // Start delay per character of an n-character reading rolling into place: rollStepMs apart, closer
  // together for long text so the last one lands inside rollMs.
  function rollDelays(n) {
    const k = Math.floor(Number(n) || 0);
    if (k <= 0) return [];
    const step = k > 1 ? Math.min(MOTION.rollStepMs, (MOTION.rollMs - MOTION.rollCharMs) / (k - 1)) : 0;
    return Array.from({ length: k }, (_, i) => Math.floor(i * step));
  }

  // Ambient loops (detail pages: at most the rail highlight and the hue drift, plus radar sweeps). Main is
  // calm (Apple HIG: purposeful motion only; peripheral motion pulls the gaze): only the weather glyph
  // moves there, and lightning flashes once per flickerMs. Slow on purpose. A gauge marker whose value
  // moved pulses pulseCount times, then stops.
  const LOOPS = { railMs: 7000, driftMs: 11000, flickerMs: 30000, pulseMs: 900, pulseCount: 3 };

  // The headline strip: "fade" (the default: one headline at a time) unless `ticker: scroll` asked for the
  // scrolling strip; reduced motion always fades (without the fade).
  const tickerMode = (cfg, reduced) => (cfg && cfg.ticker === "scroll" && !reduced ? "scroll" : "fade");

  // Entrance delay per content block: one step after the previous, capped so a long page still
  // finishes inside half a second.
  function staggerDelays(n) {
    const out = [];
    for (let i = 0; i < Math.floor(Number(n) || 0); i++) {
      out.push(MOTION.staggerBase + Math.min(i, MOTION.staggerCap) * MOTION.staggerStep);
    }
    return out;
  }

  // --- motion choices -------------------------------------------------------------------------
  const WEATHER_ANIM = {
    sunny: "sun", "clear-night": "moon", partlycloudy: "partly", cloudy: "cloud", fog: "fog",
    rainy: "rain", pouring: "rain", lightning: "storm", "lightning-rainy": "storm",
    snowy: "snow", "snowy-rainy": "snow", hail: "snow", windy: "wind", "windy-variant": "wind",
  };
  const weatherAnim = (c) => WEATHER_ANIM[c] || null;

  // Per character of `next`: did it change? Different lengths (9:59 -> 10:00) move everything.
  function digitChanges(prev, next) {
    const n = String(next === undefined || next === null ? "" : next);
    if (typeof prev !== "string" || prev.length !== n.length) return Array.from(n, () => true);
    return Array.from(n, (ch, i) => ch !== prev[i]);
  }

  // "5 on" -> "7 on": same words around one integer, so the number counts instead of crossfading.
  const NUM_RE = /^(\D*)(\d+)(\D*)$/;
  function numberTween(fromText, toText) {
    if (typeof fromText !== "string" || typeof toText !== "string") return null;
    const a = NUM_RE.exec(fromText), b = NUM_RE.exec(toText);
    if (!a || !b || a[1] !== b[1] || a[3] !== b[3]) return null;
    const from = Number(a[2]), to = Number(b[2]);
    if (from === to) return null;
    return { from, to, prefix: b[1], suffix: b[3], ms: Math.min(600, 150 + 90 * Math.abs(to - from)) };
  }

  // A reading on a room page changed: it rolls in (from below when it went up), counts when the words
  // around the number stayed the same, and a small ring flashes at it. Nothing on first paint.
  function valueChange(prev, next) {
    if (typeof prev !== "string" || !prev || prev === next || typeof next !== "string") return null;
    const count = numberTween(prev, next);
    return { roll: true, flash: true, count, dir: count && count.to < count.from ? -1 : 1 };
  }

  // A gauge marker pulses when its value really moved (not on jitter or first paint).
  const finiteNum = (v) => typeof v === "number" && Number.isFinite(v);
  function fractionMoved(prev, next) {
    return finiteNum(prev) && finiteNum(next) && Math.abs(next - prev) >= 0.005;
  }

  function tweenAt(t, p) {
    const k = Math.max(0, Math.min(1, Number(p) || 0));
    return `${t.prefix}${Math.round(t.from + (t.to - t.from) * k)}${t.suffix}`;
  }

  // Tanner Helland's black-body approximation, good enough for a 4 mm dot.
  function kelvinRgb(k) {
    const n = Number(k);
    if (!Number.isFinite(n) || n <= 0) return null;
    const t = n / 100;
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r), clamp(g), clamp(b)];
  }

  function hsRgb(h, s) {
    const hh = mod(Number(h), 360) / 60, ss = Math.max(0, Math.min(100, Number(s))) / 100;
    const c = ss, x = c * (1 - Math.abs((hh % 2) - 1));
    const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
    const m = 1 - c;
    return [r, g, b].map((v) => Math.round((v + m) * 255));
  }

  const rgbText = (a) => `rgb(${a[0]}, ${a[1]}, ${a[2]})`;
  const isNums = (a, n) => Array.isArray(a) && a.length === n && a.every((v) => Number.isFinite(Number(v)));

  function lightColor(attrs) {
    const a = attrs || {};
    if (isNums(a.rgb_color, 3)) return rgbText(a.rgb_color.map((v) => Math.round(Number(v))));
    if (isNums(a.hs_color, 2)) return rgbText(hsRgb(a.hs_color[0], a.hs_color[1]));
    const k = kelvinRgb(a.color_temp_kelvin);
    return k ? rgbText(k) : null;
  }

  // --- rooms (read-only) ----------------------------------------------------------------------
  // Area of an entity: its own area_id, else its device's. Hidden entities and config/diagnostic
  // ones (entity_category) never show.
  function roomIndex(areas, devices, entities, opts) {
    const A = areas || {}, D = devices || {}, E = entities || {};
    const byArea = new Map();
    for (const id of Object.keys(E)) {
      const e = E[id];
      if (!e || e.hidden || e.entity_category) continue;
      const areaId = e.area_id || (e.device_id && D[e.device_id] ? D[e.device_id].area_id : null);
      if (!areaId || !A[areaId]) continue;
      if (!byArea.has(areaId)) byArea.set(areaId, []);
      byArea.get(areaId).push(e.entity_id || id);
    }
    const order = opts && Array.isArray(opts.order) && opts.order.length ? opts.order : null;
    const ids = order
      ? order.filter((id) => A[id])
      : Object.keys(A).sort((x, y) => String(A[x].name || x).localeCompare(String(A[y].name || y)));
    return ids.map((id) => ({ id, name: String(A[id].name || formatId(id)), area: A[id], entityIds: byArea.get(id) || [] }));
  }

  const usable = (s) => s && !OFFLINE.has(s.state);
  const attrsOf = (s) => (s && s.attributes) || {};
  const num = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const tidy = (s) => String(s).replace(/\s+/g, " ").trim();

  function lightName(name, areaName) {
    const n = tidy(name || "");
    const a = tidy(areaName || "");
    if (a && n.toLowerCase().startsWith(a.toLowerCase() + " ")) {
      const rest = n.slice(a.length).trim();
      if (rest) return rest;
    }
    return n;
  }

  // Equipment temperatures (server CPU, NAS disks, batteries) say nothing about the room.
  const EQUIPMENT = /\b(cpu|gpu|disk|drive|nvme|ssd|hdd|exhaust|inlet|chip|core|processor|battery|board)\d*\b/i;
  const words = (id, s) => `${String(id).replace(/[._]/g, " ")} ${attrsOf(s).friendly_name || ""}`;
  // Indicator LEDs on sensors and voice satellites are not room lights.
  const INDICATOR = /\b(led|led ring|indicator)\b/i;

  const AIR_KINDS = [
    { dc: "aqi", label: "AQI", unit: "", limits: [50, 100, 150] },
    { dc: "pm25", label: "PM", sub: "2.5", limits: [12, 35, 55] },
    { dc: "carbon_dioxide", label: "CO", sub: "2", limits: [800, 1200, 2000] },
    { dc: "volatile_organic_compounds", label: "VOC" },
    { dc: "volatile_organic_compounds_parts", label: "VOC" },
  ];
  const LEVEL_TONES = ["green", "yellow", "orange", "red"];
  function airLevelTone(kind, value) {
    const k = AIR_KINDS.find((x) => x.dc === kind || (kind === "co2" && x.dc === "carbon_dioxide"));
    const v = num(value);
    if (!k || !k.limits || v === null) return null;
    const i = k.limits.findIndex((lim) => v <= lim);
    return LEVEL_TONES[i === -1 ? 3 : i];
  }

  const DOOR_CLASSES = new Set(["door", "window", "garage_door", "opening"]);
  const OCC_CLASSES = new Set(["occupancy", "motion", "presence"]);
  const unitText = (u) => (u ? String(u).replace(/^\s+/, "") : "");
  const roundTemp = (v, unit) => {
    const t = tempText(v);
    return t === S.none ? t : t + unitText(unit).replace(/^°/, "");
  };

  // --- room indicators: scales, tones, geometry -------------------------------------------------
  // Arc gauges are 240 degrees with the gap at the bottom (SVG angles: 0 = right, 90 = down).
  const GAUGE = { startDeg: 150, sweepDeg: 240 };
  const r3 = (v) => Math.round(v * 1000) / 1000;

  function gaugeFraction(value, min, max) {
    const v = num(value);
    if (v === null || !(Number(max) > Number(min))) return null;
    return Math.max(0, Math.min(1, (v - min) / (max - min)));
  }

  function arcPoint(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx, cy, r, startDeg, sweepDeg) {
    const s = arcPoint(cx, cy, r, startDeg), e = arcPoint(cx, cy, r, startDeg + sweepDeg);
    return `M ${r3(s.x)} ${r3(s.y)} A ${r} ${r} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${r3(e.x)} ${r3(e.y)}`;
  }

  // stroke-dasharray "length length" plus stroke-dashoffset `offset` draws `fraction` of the arc.
  function arcDash(fraction, radius, sweepDeg) {
    const length = 2 * Math.PI * radius * (sweepDeg / 360);
    const n = Number(fraction);
    const f = fraction === null || fraction === undefined || !Number.isFinite(n) ? 0 : Math.max(0, Math.min(1, n));
    return { length, offset: length * (1 - f) };
  }

  const isC = (unit) => /c$/i.test(String(unit || "").trim());
  function tempScale(unit) {
    return isC(unit) ? { min: 10, max: 32, band: [18, 24] } : { min: 50, max: 90, band: [64, 76] };
  }

  // Cool blue below the comfort band, green inside it, warm orange above (judged in °F).
  function tempTone(value, unit) {
    const v = num(value);
    if (v === null) return null;
    const f = isC(unit) ? (v * 9) / 5 + 32 : v;
    return f < 64 ? "blue" : f <= 76 ? "green" : "orange";
  }

  const HUMIDITY_BAND = [30, 60];
  function humidityTone(value) {
    const v = num(value);
    if (v === null) return null;
    return v >= HUMIDITY_BAND[0] && v <= HUMIDITY_BAND[1] ? "green" : "orange";
  }

  const AIR_ORDER = ["highest", "high", "medium", "low", "lowest"];
  // Which segment of the air meter is lit: the enum's five levels, or the kind's thresholds.
  function airSegment(kind, value) {
    if (kind === "enum") {
      const i = AIR_ORDER.indexOf(value);
      return i < 0 ? null : { index: i, count: AIR_ORDER.length, tones: AIR_ORDER.map((k) => AIR_TONE[k]) };
    }
    const k = AIR_KINDS.find((x) => x.dc === kind || (kind === "co2" && x.dc === "carbon_dioxide"));
    const v = num(value);
    if (!k || !k.limits || v === null) return null;
    const i = k.limits.findIndex((lim) => v <= lim);
    const count = k.limits.length + 1;
    return { index: i === -1 ? count - 1 : i, count, tones: LEVEL_TONES.slice(0, count) };
  }

  // Seconds per fan-icon turn: 4 s at the slowest, 0.8 s flat out; null when off.
  function fanSpinSeconds(pct, on) {
    if (!on) return null;
    const p = num(pct);
    const k = p === null ? 0.5 : Math.max(1, Math.min(100, p)) / 100;
    return r3(4 - 3.2 * k);
  }

  function roomItems(room, states, opts) {
    const s = states || {};
    const climateUnit = (opts && opts.tempUnit) || FALLBACK_UNIT;
    const area = room.area || {};
    const domain = (id) => String(id).split(".")[0];
    const list = room.entityIds.filter((id) => usable(s[id]));
    const dc = (id) => attrsOf(s[id]).device_class;
    const items = [];

    const climate = list.find((id) => domain(id) === "climate");
    if (climate) {
      const a = attrsOf(s[climate]);
      const mode = s[climate].state;
      items.push({
        key: `climate:${climate}`, kind: "climate", icon: "climate", label: S.modes[mode] || formatId(mode),
        value: `${tempText(a.current_temperature)} → ${tempText(a.temperature)}`,
        tone: tempTone(a.current_temperature, climateUnit), modeTone: modeTone(mode),
        gauge: Object.assign({ value: num(a.current_temperature), unit: climateUnit }, tempScale(climateUnit), { target: num(a.temperature) }),
      });
    }

    const pick = (cls, chosen) => {
      if (chosen && list.includes(chosen) && dc(chosen) === cls) return chosen;
      return list.find((id) => domain(id) === "sensor" && dc(id) === cls && num(s[id].state) !== null && !EQUIPMENT.test(words(id, s[id])));
    };
    const temp = pick("temperature", area.temperature_entity_id);
    if (temp && !climate) {
      const u = unitText(attrsOf(s[temp]).unit_of_measurement) || FALLBACK_UNIT;
      items.push({
        key: "temperature", kind: "temperature", icon: "temperature", label: "", value: roundTemp(s[temp].state, attrsOf(s[temp]).unit_of_measurement), tone: tempTone(s[temp].state, u),
        gauge: Object.assign({ value: num(s[temp].state), unit: u }, tempScale(u), { target: null }),
      });
    }
    const hum = pick("humidity", area.humidity_entity_id);
    const humVal = hum ? num(s[hum].state) : climate ? num(attrsOf(s[climate]).current_humidity) : null;
    if (humVal !== null) {
      items.push({
        key: "humidity", kind: "humidity", icon: "humidity", label: "", value: `${Math.round(humVal)}%`, tone: humidityTone(humVal),
        gauge: { value: humVal, unit: "%", min: 0, max: 100, band: HUMIDITY_BAND.slice(), target: null },
      });
    }

    const airEnum = list.find((id) => domain(id) === "sensor" && /air_quality$/.test(id) && AIR[s[id].state]);
    if (airEnum) {
      items.push({ key: "air", kind: "air", icon: "air", label: S.air, value: airWord(s[airEnum].state), tone: airTone(s[airEnum].state), meter: airSegment("enum", s[airEnum].state) });
    } else {
      for (const k of AIR_KINDS) {
        const id = list.find((x) => domain(x) === "sensor" && dc(x) === k.dc && num(s[x].state) !== null);
        if (!id) continue;
        const u = unitText(attrsOf(s[id]).unit_of_measurement);
        const it = { key: "air", kind: "air", icon: "air", label: k.label, value: `${Math.round(num(s[id].state))}${u ? " " + u : ""}`, tone: airLevelTone(k.dc, s[id].state), meter: airSegment(k.dc, s[id].state) };
        if (k.sub) it.labelSub = k.sub;
        items.push(it);
        break;
      }
    }

    // Locks in this room: a padlock each (read-only), with its paired door (opts.doorFor) drawn beside it.
    const doorFor = (opts && opts.doorFor) || {};
    const lockIds = room.entityIds.filter((id) => domain(id) === "lock" && s[id]);
    items.push(...lockIds.map((id) => {
      const v = lockVisual(s[id].state, stateOf(s, doorFor[id]));
      return { key: `lock:${id}`, kind: "lock", icon: "lock", label: lightName(lockName(s, id), room.name), value: v.word, tone: v.tone, lock: v, state: s[id].state, door: doorFor[id] || null };
    }).sort((a, b) => a.label.localeCompare(b.label)));

    // Occupancy says where people are: never shown while privacy is active (opts.private).
    const occ = list.filter((id) => domain(id) === "binary_sensor" && OCC_CLASSES.has(dc(id)));
    if (occ.length && !(opts && opts.private)) {
      const on = occ.some((id) => s[id].state === "on");
      items.push({ key: "occupancy", kind: "occupancy", icon: "person", label: "", value: on ? S.occupied : S.empty, tone: on ? "green" : "dim", on });
    }

    const named = (id) => lightName(attrsOf(s[id]).friendly_name || formatId(id), room.name);
    const byLabel = (a, b) => a.label.localeCompare(b.label);

    items.push(...list.filter((id) => domain(id) === "binary_sensor" && DOOR_CLASSES.has(dc(id))).map((id) => {
      const open = s[id].state === "on";
      return { key: `door:${id}`, kind: "door", icon: dc(id) === "window" ? "window" : "door", label: named(id), value: open ? S.open : S.closed, tone: open ? SEVERITY.attention : "dim", open };
    }).sort(byLabel));

    const lights = list.filter((id) => domain(id) === "light" && !INDICATOR.test(words(id, s[id])));
    // A group (Hue room) whose members are listed too would say everything twice.
    items.push(...lights.filter((id) => {
      const m = attrsOf(s[id]).entity_id;
      return !(Array.isArray(m) && m.some((x) => lights.includes(x)));
    }).map((id) => {
      const a = attrsOf(s[id]);
      const on = s[id].state === "on";
      const b = num(a.brightness);
      const pct = on ? (b !== null ? Math.max(1, Math.round((b / 255) * 100)) : 100) : 0;
      return {
        key: `light:${id}`, kind: "light", icon: "light", label: named(id),
        value: on ? (b !== null ? `${pct}%` : S.on) : S.off,
        tone: on ? "yellow" : "dim", color: on ? lightColor(a) : null, on, pct,
      };
    }).sort(byLabel));

    items.push(...list.filter((id) => domain(id) === "fan").map((id) => {
      const on = s[id].state === "on";
      const p = num(attrsOf(s[id]).percentage);
      const pct = on ? (p !== null ? Math.round(p) : 100) : 0;
      return { key: `fan:${id}`, kind: "fan", icon: "fan", label: named(id), value: on ? (p !== null ? `${S.on} ${Math.round(p)}%` : S.on) : S.off, tone: on ? "blue" : "dim", on, pct, spin: fanSpinSeconds(p, on) };
    }).sort(byLabel));

    items.push(...list.filter((id) => domain(id) === "cover").map((id) => {
      const st = s[id].state;
      const open = st !== "closed";
      const p = num(attrsOf(s[id]).current_position);
      const word = formatId(st);
      return { key: `cover:${id}`, kind: "cover", icon: "cover", label: named(id), value: open && p !== null ? `${word} ${Math.round(p)}%` : word, tone: open ? "yellow" : "dim", pct: p !== null ? Math.round(p) : open ? 100 : 0 };
    }).sort(byLabel));

    items.push(...list.filter((id) => domain(id) === "media_player" && ["playing", "paused"].includes(s[id].state)).map((id) => {
      const a = attrsOf(s[id]);
      const playing = s[id].state === "playing";
      return { key: `media:${id}`, kind: "media", icon: "media", label: named(id), value: tidy(a.media_title || a.app_name || (playing ? S.playing : S.paused)), tone: playing ? "purple" : "dim", playing };
    }).sort(byLabel));

    // Fragrance diffusers in this room (scentModel, discovered by the card): one item each.
    for (const m of (opts && Array.isArray(opts.scents) ? opts.scents : []).filter((x) => x && x.areaId === room.id)) {
      const short = lightName(m.name, room.name);
      items.push({
        key: `scent:${m.deviceId || m.prefix}`, kind: "scent", icon: "scent",
        label: short.toLowerCase() === tidy(room.name).toLowerCase() ? "" : short,
        value: !m.online ? S.offline : m.running && m.intensity ? m.intensity.word : S.off,
        tone: m.online && m.anyLow ? SEVERITY.attention : "dim", scent: m,
      });
    }

    return items;
  }

  function roomDetails(index, states, opts) {
    return (index || []).map((r) => ({ id: r.id, name: r.name, items: roomItems(r, states, opts) })).filter((r) => r.items.length);
  }

  function roomsFromRegistries(areas, devices, entities, states, opts) {
    return roomDetails(roomIndex(areas, devices, entities, opts), states, opts);
  }

  // Changes when rooms or their items appear or go; not when values change (those update in place).
  function roomsSignature(rooms) {
    return (rooms || []).map((r) => `${r.id}|${r.items.map((i) => i.key).join(",")}`).join(";");
  }

  // True once a pointer has travelled farther than slopPx from where it went down.
  function movedPast(dx, dy, slopPx) {
    if (![dx, dy, slopPx].every(finite)) return false;
    return Math.hypot(dx, dy) > slopPx;
  }

  // --- colour tones ---------------------------------------------------------------------------
  // Tone names map to CSS custom properties in the card (green blue yellow orange red purple), plus
  // "dim" for the secondary text colour. Colour never carries meaning alone: the words stay.
  const CONDITION_TONE = {
    rainy: "blue", pouring: "blue", snowy: "blue", "snowy-rainy": "blue", hail: "blue",
    sunny: "yellow", "clear-night": "yellow",
    lightning: "orange", "lightning-rainy": "orange", exceptional: "orange",
  };
  const conditionTone = (c) => CONDITION_TONE[c] || "dim";

  // One colour per severity, everywhere it shows: status lines, padlocks, Lock all, More's door buttons
  // and room-page chips (Apple HIG: one colour, one meaning). The card maps each tone to one token
  // (--ok, --attention, --alert, plus --alert-text for alert words); at night attention and alert keep
  // their hues, dimmed, while everything decorative goes amber.
  const SEVERITY = { ok: "ok", attention: "attention", alert: "alert" };
  const LEVEL_SEVERITY = { calm: "ok", attention: "attention", security: "alert", alert: "alert" };
  const severityOf = (level) => LEVEL_SEVERITY[level] || "attention";
  const statusTone = (level) => SEVERITY[severityOf(level)];

  const AIR_TONE = { highest: "green", high: "green", medium: "yellow", low: "orange", lowest: "red" };
  const airTone = (v) => AIR_TONE[v] || "dim";

  function lockTone(unlocked) {
    if (unlocked === null || unlocked === undefined) return "dim";
    return unlocked === 0 ? SEVERITY.ok : SEVERITY.alert;
  }

  const lightsTone = (n) => (n > 0 ? "yellow" : "dim");

  // `doorAlert` is the card's door_alert option: an open door is the alert unless it is false.
  function doorTone(word, doorAlert) {
    if (word === S.locked) return SEVERITY.ok;
    if (word === S.unlocked || word === S.jammed) return SEVERITY.alert;
    if (word === S.open) return doorAlert === false ? SEVERITY.attention : SEVERITY.alert;
    return word === S.offline ? SEVERITY.attention : "dim";
  }

  const presenceTone = (word) => (word === S.home ? "green" : "dim");
  const internetTone = (v) => (v === "on" ? SEVERITY.ok : v === "off" ? SEVERITY.attention : "dim");
  const modeTone = (mode) => (mode === "heat" ? "orange" : "dim");

  // --- news ticker ----------------------------------------------------------------------------
  // The rest sensors (configuration.yaml) expose the RSS channel's `item` attribute: an array, or a
  // single object when the feed has one entry (xmltodict). Titles may arrive as {"#text": ...}.
  const NEWS_MAX = 6;
  const NEWS_MAX_AGE_H = 24;
  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

  function decodeOnce(s) {
    return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g, (m, dec, hex, name) => {
      if (name) return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : m;
      const cp = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    });
  }

  // Two passes: some feeds double-encode (&amp;#39;).
  const decodeEntities = (s) => decodeOnce(decodeOnce(s));

  function newsHeadlines(stateObj, opts) {
    if (!stateObj || OFFLINE.has(stateObj.state)) return [];
    const o = opts || {};
    const max = o.max === undefined ? NEWS_MAX : o.max;
    const nowMs = o.nowMs === undefined ? Date.now() : o.nowMs;
    const cutoff = nowMs - (o.maxAgeH === undefined ? NEWS_MAX_AGE_H : o.maxAgeH) * 3600e3;
    let items = stateObj.attributes && stateObj.attributes.item;
    if (items && !Array.isArray(items) && typeof items === "object") items = [items];
    if (!Array.isArray(items)) return [];
    const seen = new Set(), out = [];
    for (const it of items) {
      if (out.length >= max) break;
      if (!it || typeof it !== "object") continue;
      let t = it.title;
      if (t && typeof t === "object") t = t["#text"];
      if (typeof t !== "string") continue;
      t = decodeEntities(t).replace(/\s+/g, " ").trim();
      if (!t || seen.has(t)) continue;
      const when = typeof it.pubDate === "string" ? Date.parse(it.pubDate) : NaN;
      if (Number.isFinite(when) && when < cutoff) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // `news` is the resolved config list ([{label, entity, tone}], in ticker order); `feeds` maps each
  // entity to its headlines (newsHeadlines). Feeds with nothing to show leave no segment.
  function tickerSegments(news, feeds) {
    const f = feeds || {};
    return (Array.isArray(news) ? news : [])
      .filter((n) => n && Array.isArray(f[n.entity]) && f[n.entity].length)
      .map((n) => ({ label: n.label, tone: n.tone, titles: f[n.entity] }));
  }

  // --- configuration --------------------------------------------------------------------------
  // The card ships NO house-specific defaults. resolveConfig(userConfig, hass) turns what the dashboard
  // YAML says plus what Home Assistant knows (hass.config, the states) into the one object the card
  // reads. Anything that needs configuration to mean something (a leaving script, a person, news feeds,
  // scenes, a thermostat) resolves to null / empty and the card hides that feature.
  const idsOf = (states, domain) => Object.keys(states || {}).filter((id) => id.startsWith(domain + ".")).sort();
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const stringOr = (v, fallback) => (typeof v === "string" && v ? v : fallback);

  // "light.x" or {entity, name} -> {entity, name}; the name falls back to the friendly name, then the id.
  function namedEntity(item, states, fallbackName) {
    const e = typeof item === "string" ? item : isObj(item) ? item.entity : null;
    if (typeof e !== "string" || !e) return null;
    const given = isObj(item) && typeof item.name === "string" && item.name ? item.name : null;
    return { entity: e, name: given || fallbackName || entityName(states, e) };
  }

  function entityList(list, states) {
    return (Array.isArray(list) ? list : []).map((x) => namedEntity(x, states)).filter(Boolean);
  }

  const TEXT_SCALE = { min: 0.8, max: 2 };
  function textScale(v) {
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
    return finite(n) ? Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, n)) : 1;
  }

  function resolveConfig(userConfig, hass) {
    const u = isObj(userConfig) ? userConfig : {};
    const states = (hass && hass.states) || {};
    const hc = (hass && hass.config) || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(u, k);
    const sc = isObj(u.scenes) ? u.scenes : {};
    const tone = (t, i) => (NEWS_TONES.includes(t) ? t : NEWS_TONES[i % NEWS_TONES.length]);
    return {
      time_zone: stringOr(u.time_zone, stringOr(hc.time_zone, FALLBACK_TZ)),
      temperature_unit: stringOr(u.temperature_unit, stringOr(hc.unit_system && hc.unit_system.temperature, FALLBACK_UNIT)),
      weather: stringOr(u.weather, idsOf(states, "weather")[0] || null),
      outdoor_temperature: stringOr(u.outdoor_temperature, null),
      locks: Array.isArray(u.locks) ? u.locks.slice() : idsOf(states, "lock"),
      doors: Array.isArray(u.doors) ? u.doors.slice() : [],
      internet: stringOr(u.internet, null),
      air: stringOr(u.air, null),
      leaving_script: stringOr(u.leaving_script, null),
      climate: stringOr(u.climate, null),
      person: stringOr(u.person, null),
      // YAML 1.1 reads a bare off / on as booleans, so false and true are accepted too.
      privacy: u.privacy === false || u.privacy === "off" ? "off" : u.privacy === true || u.privacy === "always" ? "always" : "auto",
      scenes: {
        title: stringOr(sc.title, ""),
        entities: entityList(sc.entities, states),
        off: namedEntity(sc.off, states, S.off),
      },
      media_players: Array.isArray(u.media_players) ? entityList(u.media_players, states) : null,
      news: (Array.isArray(u.news) ? u.news : [])
        .filter((n) => isObj(n) && typeof n.entity === "string" && n.entity)
        .map((n, i) => ({ label: typeof n.label === "string" ? n.label : "", entity: n.entity, tone: tone(n.tone, i) })),
      rooms: Array.isArray(u.rooms) ? u.rooms.slice() : null,
      pages: Array.isArray(u.pages) ? u.pages.slice() : null,
      transition: u.transition === "fade" ? "fade" : "slide",
      ticker: u.ticker === "scroll" ? "scroll" : "fade",
      // Text size multiplier (Apple HIG: let people enlarge text, ideally to 200 %), clamped to 0.8-2.
      text_scale: textScale(u.text_scale),
      mirror_mode: u.mirror_mode !== false,
      mirror_timeout: finite(u.mirror_timeout) && u.mirror_timeout > 0 ? u.mirror_timeout : 180,
      // The fourth Main control (jumps to page 2). false: Main shows the others, spread evenly; page 2 stays
      // reachable by swiping, the pager and the detail pages' navigation.
      more_button: u.more_button !== false,
      radar: u.radar !== false,
      radar_pattern: stringOr(u.radar_pattern, RADAR_PATTERN),
      door_alert: u.door_alert !== false,
      scent: u.scent !== false,
      debug_fps: u.debug_fps === true,
      night_start: stringOr(u.night_start, "22:00"),
      night_end: stringOr(u.night_end, "06:30"),
      // null is meaningful (system fonts only, nothing fetched), so it is told apart from "not set".
      font_family: stringOr(u.font_family, "Atkinson Hyperlegible"),
      font_url: has("font_url") ? (u.font_url === null ? null : stringOr(u.font_url, DEFAULT_FONT_URL)) : DEFAULT_FONT_URL,
    };
  }

  // Players the More page may list: the configured ones that are playing or paused, else any that are.
  function mediaPlayers(cfg, states) {
    const s = states || {};
    const live = (id) => s[id] && ["playing", "paused"].includes(s[id].state);
    const list = cfg && Array.isArray(cfg.media_players) ? cfg.media_players : idsOf(s, "media_player").map((id) => namedEntity(id, s));
    return list.filter((m) => live(m.entity));
  }

  // The reading beside the weather: the configured outdoor sensor, else the weather entity's own value.
  function outdoorTemp(states, cfg) {
    const s = states || {};
    if (cfg && cfg.outdoor_temperature) return stateOf(s, cfg.outdoor_temperature);
    const w = cfg && cfg.weather && s[cfg.weather];
    return w && w.attributes ? w.attributes.temperature : undefined;
  }

  // Seconds for one loop of a strip `widthPx` wide at a constant `mmPerSec`.
  function tickerSeconds(widthPx, mmPx, mmPerSec) {
    if (!(widthPx > 0) || !(mmPx > 0) || !(mmPerSec > 0)) return 0;
    return widthPx / mmPx / mmPerSec;
  }

  // --- touch feedback ---------------------------------------------------------------------------
  // A ring where a tap lands, a short fading trail behind a dragging finger, a chevron burst on a
  // recognised swipe. The card draws them from a fixed pool of trailMax dots (no per-move nodes).
  // staleMs: a pointer still down with no event for this long is a STUCK GHOST (something blocking the IR
  // frame's beams reports a touch that never ends), not a finger. 1500 ms: a deliberate two-finger touch
  // lands its fingers within a few hundred ms of each other, and a resting finger seldom stays dead still
  // (to the pixel) that long while a second one arrives. The card has no gesture that needs one finger
  // held still while another taps (three times Chromium's 500 ms long-press), and a ghost costs at most
  // a second and a half of dead glass after it appears. If a finger does rest that long, the second touch
  // reads as an ordinary single tap: never more than one real touch could already do.
  const TOUCH = { rippleMs: 450, trailMs: 280, trailMax: 8, trailMinPx: 12, burstMs: 420, reducedDotMs: 140, staleMs: 1500 };

  // Whether a pointerdown should be read as the one finger on the glass. `isPrimary` is the event's flag;
  // `others` the last-event timestamps of every OTHER pointer the card still has down. A primary pointer
  // (or an event without the flag) is primary. A non-primary one counts as primary when every other pointer
  // has been silent for at least staleMs: then the browser is only calling it secondary because of a stuck
  // ghost. One live other pointer keeps it multi-touch. An unreadable timestamp is no evidence of a finger.
  function treatAsPrimary(isPrimary, others, now, staleMs) {
    if (isPrimary !== false) return true;
    return (Array.isArray(others) ? others : []).every((t) => !(finite(t) && now - t < staleMs));
  }

  // The ids in a Map of pointer id -> last-event timestamp that have been silent for at least staleMs.
  function staleIds(pointers, now, staleMs) {
    if (!(pointers instanceof Map)) return [];
    const out = [];
    for (const [id, t] of pointers) if (!(finite(t) && now - t < staleMs)) out.push(id);
    return out;
  }

  // New trail with `pt` ({x, y, t}) added: points older than trailMs dropped, moves shorter than
  // trailMinPx skipped (decimation), at most trailMax kept.
  function trailPush(trail, pt) {
    const tr = Array.isArray(trail) ? trail : [];
    if (!pt || ![pt.x, pt.y, pt.t].every(finite)) return tr;
    const live = tr.filter((q) => pt.t - q.t < TOUCH.trailMs);
    const last = live[live.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < TOUCH.trailMinPx) return live.length === tr.length ? tr : live;
    return live.concat([pt]).slice(-TOUCH.trailMax);
  }

  // Dots to draw at time `now`: alpha and scale fall with age; expired dots are left out.
  function trailFrame(trail, now) {
    if (!Array.isArray(trail)) return [];
    const out = [];
    for (const q of trail) {
      const k = 1 - (now - q.t) / TOUCH.trailMs;
      if (k <= 0) continue;
      const c = Math.min(1, k);
      out.push({ x: q.x, y: q.y, alpha: r3(c), scale: r3(0.35 + 0.65 * c) });
    }
    return out;
  }

  const burstAngle = (direction) => (direction === "right" ? 0 : direction === "left" ? 180 : null);

  // --- Mashrabiya: accents ----------------------------------------------------------------------
  // Chrome (brackets, ticks, rails, touch reticle) takes the page's accent. Decoration must never look
  // like a meaning colour (green ok, orange look, red act, blue water/cold, yellow light, purple media,
  // and the light red of alert words): every hued chrome colour is at least 40 degrees from all of them
  // (Apple HIG: one colour, one meaning; the glass shifts hues and colour-blind viewers merge near ones).
  // That leaves two bright families, chartreuse (~92 deg) and periwinkle (~238 deg), alternating here so
  // a step of three always lands in the other family; near-neutral tints (saturation under 0.2) read as
  // white. Rooms get one by a stable hash; Main, More and Radar have fixed ones.
  const ACCENTS = ["#81e628", "#787bff", "#9bf050", "#8f91ff", "#bffa8c", "#6467ff"];
  const TINTS = ["#e9ffd9", "#dfe0ff"]; // the chartreuse and the periwinkle family's near-white tint
  const FIXED_ACCENTS = { main: "#cfeaff", more: "#dcd6ff", radar: "#bffa8c" };

  // FNV-1a: stable across sessions and browsers, so a room keeps its colour.
  function hashString(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text || "")) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  const roomAccent = (areaId) => ACCENTS[hashString(areaId) % ACCENTS.length];

  // Vivid: three hues per page. The first is the page's accent (brackets' start, the reticle); the second
  // is from the other bright family, the third the first family's near-white tint. All 4.5:1 on black and
  // 40 degrees clear of the meaning colours: bracket gradients, heading underlines, edge rails, ring shading.
  const FIXED_PALETTES = {
    main: ["#cfeaff", "#8f91ff", "#9bf050"],
    more: ["#dcd6ff", "#9bf050", "#8f91ff"],
    radar: ["#bffa8c", "#787bff", "#e9ffd9"],
  };
  function pagePalette(key) {
    const k = String(key || "");
    if (Object.prototype.hasOwnProperty.call(FIXED_PALETTES, k)) return FIXED_PALETTES[k].slice();
    if (!k.startsWith("room:")) return FIXED_PALETTES.main.slice();
    const n = ACCENTS.length, i = hashString(k.slice(5)) % n;
    return [ACCENTS[i], ACCENTS[(i + 3) % n], TINTS[i % 2]];
  }

  function pageAccent(key) {
    const k = String(key || "");
    if (Object.prototype.hasOwnProperty.call(FIXED_ACCENTS, k)) return FIXED_ACCENTS[k];
    return k.startsWith("room:") ? roomAccent(k.slice(5)) : FIXED_ACCENTS.main;
  }

  // --- Mashrabiya: gauge colour and ticks ---------------------------------------------------------
  // Colour runs along the arc's whole scale, so the gauge reads like a map: temperature cold blue ->
  // comfortable green -> warm orange; humidity dry orange -> comfortable green -> damp blue.
  const STOP_BLEND = 0.05;
  function gaugeStops(kind, g) {
    const tones = kind === "humidity" ? ["orange", "green", "blue"] : ["blue", "green", "orange"];
    const f0 = gaugeFraction(g.band[0], g.min, g.max), f1 = gaugeFraction(g.band[1], g.min, g.max);
    const c = (v) => Math.max(0, Math.min(1, v));
    return [
      { f: 0, tone: tones[0] }, { f: c(f0 - STOP_BLEND), tone: tones[0] }, { f: c(f0 + STOP_BLEND), tone: tones[1] },
      { f: c(f1 - STOP_BLEND), tone: tones[1] }, { f: c(f1 + STOP_BLEND), tone: tones[2] }, { f: 1, tone: tones[2] },
    ];
  }

  // A left-to-right linearGradient across the gauge (x from cx - r to cx + r) approximates colour along
  // the arc: fraction f of the arc sits at offset (cos(angle) + 1) / 2. SVG has no conic gradient.
  function gradientOffset(f) {
    const a = ((GAUGE.startDeg + Number(f) * GAUGE.sweepDeg) * Math.PI) / 180;
    return r3((Math.cos(a) + 1) / 2);
  }

  // n radial tick marks from radius r0 to r1, spread evenly from startDeg over sweepDeg, as one path.
  function arcTicks(cx, cy, r0, r1, startDeg, sweepDeg, n) {
    const count = Math.floor(Number(n) || 0);
    const out = [];
    for (let i = 0; i < count; i++) {
      const deg = startDeg + (count > 1 ? (sweepDeg * i) / (count - 1) : 0);
      const a = arcPoint(cx, cy, r0, deg), b = arcPoint(cx, cy, r1, deg);
      out.push(`M ${r3(a.x)} ${r3(a.y)} L ${r3(b.x)} ${r3(b.y)}`);
    }
    return out.join(" ");
  }

  // --- frame-rate meter (opt-in, for measuring the Pi) ---------------------------------------------
  const FPS_WINDOW_MS = 5000;
  function fpsEnabled(config, search) {
    if (config && config.debug_fps === true) return true;
    return /(?:^\?|&)fps=1(?:&|$)/.test(String(search || ""));
  }

  const fpsTrim = (times, now) => (times || []).filter((t) => t >= now - FPS_WINDOW_MS);

  // fps: frames drawn in the last second. worstMs: the longest gap between frames in the last 5 s.
  function fpsStats(times, now) {
    const t = fpsTrim(times, now);
    let worst = 0;
    for (let i = 1; i < t.length; i++) worst = Math.max(worst, t[i] - t[i - 1]);
    return { fps: t.filter((x) => x > now - 1000).length, worstMs: worst };
  }

  // --- radar (read-only) --------------------------------------------------------------------------
  // mmWave presence radars (LD2450-style, e.g. Everything Presence Lite) discovered from the states by
  // entity pattern: sensor.<prefix>_presence_target_<n>_x / _y (n = 1..3) with
  // binary_sensor.<prefix>_presence_target_<n>_active, number.<prefix>_presence_zone_1_{begin,end}_{x,y}
  // and number.<prefix>_presence_max_distance. x is across the sensor's view, y away from it.
  const SIN60 = Math.sin(Math.PI / 3), COS60 = 0.5;
  const RADAR = {
    halfDeg: 60, targets: 3, trailMax: 5, trailMinMm: 60, defaultRangeMm: 6000, movingMps: 0.05,
    targetColors: ["#9bf050", "#8f91ff", "#f2f2f2"],
    // Layout (scopeSize): columns from this many scopes; the gaps between scopes and under each name (mm);
    // the narrowest field drawn (below it the page scrolls rather than shrink a scope past reading).
    twoColsFrom: 3, colGapMm: 14, rowGapMm: 14, headGapMm: 3, minScopeMm: 60,
  };
  const MM_PER = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
  const MPS_PER = { "m/s": 1, "cm/s": 0.01, "mm/s": 0.001, "km/h": 1 / 3.6, mph: 0.44704 };
  // The pattern names the device stem around the prefix, e.g. "{prefix}_presence" finds sensor.<prefix>_presence_target_<n>_x.
  const escapeRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function radarRegex(pattern) {
    const p = typeof pattern === "string" && pattern.includes("{prefix}") ? pattern : RADAR_PATTERN;
    const [a, b] = p.split("{prefix}");
    return new RegExp("^sensor\\." + escapeRe(a) + "(.+)" + escapeRe(b) + "_target_([1-3])_x$");
  }

  function toMm(value, unit) {
    const n = num(value);
    if (n === null) return null;
    const u = String(unit || "").trim().toLowerCase();
    if (!u) return n;
    return Object.prototype.hasOwnProperty.call(MM_PER, u) ? n * MM_PER[u] : null;
  }

  function radarPrefixes(states, pattern) {
    const re = radarRegex(pattern);
    const out = new Set();
    for (const id of Object.keys(states || {})) {
      const m = re.exec(id);
      if (m) out.add(m[1]);
    }
    return Array.from(out).sort();
  }

  const radarId = (pattern, domain, prefix, rest) => `${domain}.${(typeof pattern === "string" && pattern.includes("{prefix}") ? pattern : RADAR_PATTERN).replace("{prefix}", prefix)}_${rest}`;

  // Each radar named by the area of its target sensor (entity area, else its device's), else by prefix.
  function radarList(states, entities, devices, areas, pattern) {
    const s = states || {}, E = entities || {}, D = devices || {}, A = areas || {};
    return radarPrefixes(s, pattern).map((prefix) => {
      let areaId = null;
      for (let n = 1; n <= RADAR.targets && !areaId; n++) {
        const e = E[radarId(pattern, "sensor", prefix, `target_${n}_x`)];
        if (!e) continue;
        const a = e.area_id || (e.device_id && D[e.device_id] ? D[e.device_id].area_id : null);
        if (a && A[a]) areaId = a;
      }
      const name = areaId ? String(A[areaId].name || formatId(areaId)) : formatId(prefix);
      return { prefix, name, areaId };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function radarModel(prefix, states, pattern) {
    const s = states || {};
    const mm = (id) => (usable(s[id]) ? toMm(s[id].state, attrsOf(s[id]).unit_of_measurement) : null);
    const targets = [];
    for (let n = 1; n <= RADAR.targets; n++) {
      const xId = radarId(pattern, "sensor", prefix, `target_${n}_x`);
      if (!s[xId]) continue;
      const x = mm(xId), y = mm(radarId(pattern, "sensor", prefix, `target_${n}_y`));
      const flag = s[radarId(pattern, "binary_sensor", prefix, `target_${n}_active`)];
      const placed = x !== null && y !== null;
      const active = placed && (flag ? flag.state === "on" : x !== 0 || y !== 0);
      const sp = s[radarId(pattern, "sensor", prefix, `target_${n}_speed`)];
      targets.push({
        n, active, x, y,
        speed: usable(sp) ? num(sp.state) : null,
        speedUnit: sp ? unitText(attrsOf(sp).unit_of_measurement) : "",
      });
    }
    const range = mm(radarId(pattern, "number", prefix, "max_distance"));
    const z = ["begin_x", "end_x", "begin_y", "end_y"].map((k) => mm(radarId(pattern, "number", prefix, `zone_1_${k}`)));
    let zone = null;
    if (z.every((v) => v !== null)) {
      const r = { x0: Math.min(z[0], z[1]), x1: Math.max(z[0], z[1]), y0: Math.min(z[2], z[3]), y1: Math.max(z[2], z[3]) };
      if (r.x1 > r.x0 && r.y1 > r.y0) zone = r;
    }
    const count = targets.filter((t) => t.active).length;
    return { prefix, rangeMm: range > 0 ? range : RADAR.defaultRangeMm, zone, targets, count, active: count > 0 };
  }

  // Range rings shade from the page's second hue (nearest) to its third (farthest): percent of the third.
  function ringMix(i, n) {
    const c = Math.floor(Number(n));
    if (!(c > 1)) return 0;
    return Math.max(0, Math.min(100, Math.round((100 * Number(i)) / (c - 1))));
  }

  // A speed vector for a moving target: direction from its last two trail points (screen degrees, 0 =
  // right, -90 = up = away from the sensor), length 0.3-1 of the vector's full size from the speed.
  function radarVector(trail, speed, unit) {
    if (!Array.isArray(trail) || trail.length < 2) return null;
    const v = num(speed);
    if (v === null) return null;
    const u = unitText(unit);
    const mps = Math.abs(v * (Object.prototype.hasOwnProperty.call(MPS_PER, u) ? MPS_PER[u] : 1));
    if (mps < RADAR.movingMps) return null;
    const a = trail[trail.length - 2], b = trail[trail.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    if (!finite(dx) || !finite(dy) || (dx === 0 && dy === 0)) return null;
    return { deg: (Math.atan2(-dy, dx) * 180) / Math.PI, len: r3(Math.max(0.3, Math.min(1, 0.3 + (0.7 * mps) / 1.2))) };
  }

  function radarSpeedText(speed, unit) {
    const v = num(speed);
    if (v === null) return null;
    const u = unitText(unit);
    const k = Object.prototype.hasOwnProperty.call(MPS_PER, u) ? MPS_PER[u] : 1;
    if (Math.abs(v * k) < RADAR.movingMps) return null;
    return `${Math.abs(v).toFixed(1)}${u ? " " + u : ""}`;
  }

  // Scope geometry: origin at the sensor (bottom centre), y up the page is negative SVG y, `size` px is
  // the full range. The field's bounding box is exactly the +/-60 degree wedge.
  const radarBox = (size) => ({ w: 2 * size * SIN60, h: size });

  function radarProject(x, y, maxRange, size) {
    const X = Number(x), Y = Math.max(0, Number(y)), R = Number(maxRange), S = Number(size);
    if (![X, Y, R, S].every(Number.isFinite) || !(R > 0) || !(S > 0)) return null;
    const d = Math.hypot(X, Y);
    const clamped = d > R;
    const k = (S / R) * (clamped ? R / d : 1);
    return { x: X * k, y: -Y * k, clamped };
  }

  const rim = (r) => `${r3(-r * SIN60)} ${r3(-r * COS60)} A ${r} ${r} 0 0 1 ${r3(r * SIN60)} ${r3(-r * COS60)}`;
  const radarRingArc = (r) => `M ${rim(r)}`;
  const radarWedgePath = (size) => `M 0 0 L ${rim(size)} Z`;

  function radarRings(rangeMm, size) {
    const out = [];
    if (!(rangeMm > 0)) return out;
    for (let m = 1; m * 1000 < rangeMm; m++) out.push({ r: (m * 1000 * size) / rangeMm, label: `${m} m` });
    return out;
  }

  function radarZoneRect(zone, rangeMm, size) {
    if (!zone || !(rangeMm > 0)) return null;
    const k = size / rangeMm, half = size * SIN60;
    const cx = (v) => Math.max(-half, Math.min(half, v * k));
    const cy = (v) => -Math.max(0, Math.min(size, v * k));
    const x0 = cx(zone.x0), x1 = cx(zone.x1), top = cy(zone.y1), bottom = cy(zone.y0);
    return { x: x0, y: top, w: x1 - x0, h: bottom - top };
  }

  // The last few distinct positions of a target (mm), newest last; jitter below trailMinMm is no move.
  function radarTrailPush(trail, pt) {
    const tr = Array.isArray(trail) ? trail : [];
    if (!pt || ![pt.x, pt.y].every(finite)) return tr;
    const last = tr[tr.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < RADAR.trailMinMm) return tr;
    return tr.concat([{ x: pt.x, y: pt.y }]).slice(-RADAR.trailMax);
  }

  // --- fragrance diffusers (read-only) --------------------------------------------------------------
  // Pura-style diffusers are DISCOVERED: a device with sensor.<prefix>_slot_<n>_fragrance_remaining (in %)
  // is one, whatever it is called. Its other entities share the object-id prefix: _slot_<n>_fragrance
  // (scent name, maybe a `color`), _active_fragrance, select _intensity and _fragrance (slot_1 / slot_2 /
  // off), binary_sensor _slot_<n>_low_fragrance and _connected, sensor _timer, switch
  // _auto_alternate_fragrances. Shown on the room page of the device's area, never controlled.
  const SCENT_RE = /^sensor\.(.+)_slot_(\d+)_fragrance_remaining$/;
  const INTENSITY = ["off", "gentle", "subtle", "medium", "strong", "intense"];
  const INTENSITY_LEVEL = [0, 1, 3, 5, 7, 10];
  const TIMER_DIAL_MIN = 720; // the countdown ring is a 12-hour dial

  function intensityStep(option) {
    const i = INTENSITY.indexOf(option);
    return i < 0 ? null : { step: i, level: INTENSITY_LEVEL[i], word: S.intensities[option] };
  }

  function scentDevices(states, entities, devices, areas) {
    const s = states || {}, E = entities || {}, D = devices || {}, A = areas || {};
    const groups = new Map();
    for (const id of Object.keys(s).sort()) {
      const m = SCENT_RE.exec(id);
      if (!m || unitText(attrsOf(s[id]).unit_of_measurement).trim() !== "%") continue;
      const e = E[id] || {};
      const dev = e.device_id && D[e.device_id] ? e.device_id : null;
      const key = dev || `prefix:${m[1]}`;
      if (!groups.has(key)) {
        const area = e.area_id || (dev ? D[dev].area_id : null);
        const d = dev ? D[dev] : null;
        groups.set(key, {
          deviceId: dev, prefix: m[1], areaId: area && A[area] ? area : null,
          name: d && (d.name_by_user || d.name) ? String(d.name_by_user || d.name) : formatId(m[1]), slots: [],
        });
      }
      const g = groups.get(key);
      if (g.prefix === m[1] && !g.slots.includes(Number(m[2]))) g.slots.push(Number(m[2]));
    }
    return Array.from(groups.values()).map((g) => Object.assign(g, { slots: g.slots.sort((a, b) => a - b) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // "#rrggbb" from hue (degrees), saturation and lightness (0-1).
  function hslHex(h, sat, light) {
    const c = (1 - Math.abs(2 * light - 1)) * sat, hh = mod(h, 360) / 60, x = c * (1 - Math.abs((hh % 2) - 1));
    const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
    const m = light - c / 2;
    return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }

  // A scent's colour: the brand colour's hue when the integration gives one (lifted: a navy vial would
  // vanish behind the glass), else a stable hue from the name. Always bright enough to read on black.
  function scentColor(name, brand) {
    let h = null;
    if (typeof brand === "string" && /^#[0-9a-f]{6}$/i.test(brand)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(brand.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      if (max > 0 && d / max > 0.15) {
        const k = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = mod(k * 60, 360);
      }
    }
    if (h === null) h = hashString(String(name || "").toLowerCase()) % 360;
    return hslHex(h, 0.85, 0.68);
  }

  // "until 10:55 PM" and how full the 12-hour countdown dial is; null when no timer is pending.
  function scentTimer(iso, nowMs, tz) {
    const t = typeof iso === "string" ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t) || !(t > Number(nowMs))) return null;
    const p = parts(t, tz);
    const { h, ampm } = hour12(p.hour);
    return { text: S.until(`${h}:${pad(p.minute)} ${ampm}`), fraction: Math.min(1, (t - Number(nowMs)) / 60000 / TIMER_DIAL_MIN) };
  }

  function scentModel(dev, states, opts) {
    const s = states || {}, o = opts || {}, p = dev.prefix;
    const at = (domain, rest) => s[`${domain}.${p}_${rest}`];
    const conn = at("binary_sensor", "connected");
    const online = conn ? conn.state === "on" : true;
    const slots = dev.slots.map((n) => {
      const r = at("sensor", `slot_${n}_fragrance_remaining`);
      const v = usable(r) ? num(r.state) : null;
      const nm = at("sensor", `slot_${n}_fragrance`);
      const name = usable(nm) && nm.state !== "none" ? tidy(nm.state) : null;
      const low = at("binary_sensor", `slot_${n}_low_fragrance`);
      return {
        n, pct: v === null ? null : Math.max(0, Math.min(100, Math.round(v))), name,
        color: scentColor(name || `slot ${n}`, attrsOf(nm).color), low: !!(low && low.state === "on"),
      };
    });
    const sel = at("select", "fragrance");
    const sm = sel && /^slot_(\d+)$/.exec(sel.state);
    const active = sm && dev.slots.includes(Number(sm[1])) ? Number(sm[1]) : null;
    const intensity = intensityStep((at("select", "intensity") || {}).state);
    const af = at("sensor", "active_fragrance");
    const running = online && active !== null && (!intensity || intensity.step > 0) && !(af && af.state === "none");
    const timer = at("sensor", "timer");
    const alt = at("switch", "auto_alternate_fragrances");
    return {
      deviceId: dev.deviceId, prefix: p, name: dev.name, areaId: dev.areaId, online, slots, active, running, intensity,
      timer: timer ? scentTimer(timer.state, o.nowMs === undefined ? Date.now() : o.nowMs, o.tz) : null,
      alternate: !!(alt && alt.state === "on"), anyLow: slots.some((x) => x.low),
    };
  }

  // --- open-door alert ------------------------------------------------------------------------------
  // A configured door that is open makes its alert MARKS breathe red (the status line's ring, the room
  // chip's icon, More's door glyph): a safety alert, not decoration, so it runs at night too and is
  // steady under reduced motion. The alert TEXT never breathes: it stays at full strength in --alert-text
  // so it is always legible (Apple HIG: never let motion carry or hide important information). Night
  // dims through the night colour tokens, not through this. min: the marks' trough.
  const ALERT = { periodMs: 2400, min: 0.35, fadeOutMs: 400 };

  function openDoors(states, cfg) {
    const s = states || {};
    return ((cfg && cfg.doors) || []).filter((id) => stateOf(s, id) === "on");
  }

  // `night` is accepted for the call sites' sake and deliberately unused (see ALERT).
  function doorAlertMode(openCount, night, reduced) {
    if (!(Number(openCount) > 0)) return { mode: "off", peak: 1, min: 0, periodMs: ALERT.periodMs };
    return { mode: reduced ? "steady" : "breathe", peak: 1, min: ALERT.min, periodMs: ALERT.periodMs };
  }

  // --- padlocks (visual only: the card can lock, never unlock) --------------------------------------
  const LOCK_TONE = { locked: SEVERITY.ok, unlocked: SEVERITY.alert, jammed: SEVERITY.alert, moving: "yellow", offline: SEVERITY.attention };
  const lockKind = (state) => {
    if (state === "locked" || state === "unlocked" || state === "jammed") return state;
    if (state === "locking" || state === "unlocking") return "moving";
    return "offline";
  };

  function lockVisual(lockState, doorState) {
    const kind = lockKind(lockState);
    const doorOpen = doorState === "on";
    const word = doorOpen ? S.open : lockState === "locking" ? S.locking : lockState === "unlocking" ? S.unlocking : kind === "offline" ? S.offline : S[kind];
    return { kind, tone: LOCK_TONE[kind], word, doorOpen };
  }

  // The animation a real state change plays: "lift" (the shackle springs up and swings open), "snap" (it
  // drops shut with a green ring burst), "jam" (a shake). Nothing on first paint, going offline or back.
  function lockTransition(prev, next) {
    if (prev === undefined || prev === null || prev === next) return null;
    const a = lockKind(prev), b = lockKind(next);
    if (a === "offline" || b === "offline" || a === b) return null;
    if (b === "unlocked") return "lift";
    if (b === "locked") return "snap";
    if (b === "jammed") return "jam";
    return null;
  }

  // Lock all's glyph: jammed beats unlocked beats moving beats locked; nothing reachable is offline.
  function lockAggregate(states, locks) {
    const kinds = (locks || []).map((id) => lockKind(stateOf(states || {}, id)));
    const unlocked = kinds.filter((k) => k === "unlocked").length;
    const kind = ["jammed", "unlocked", "moving", "locked"].find((k) => kinds.includes(k)) || "offline";
    return { kind, tone: LOCK_TONE[kind], unlocked };
  }

  // --- FITTING THE PAGE (docs/DESIGN.md "Fitting the page") ------------------------------------
  // Detail pages: a fixed header, a body that scrolls between it and the navigation row, and layouts that
  // get denser where that is safe without going under the 9 mm text floor.

  // Rows (lights, fans, blinds, media) on a room page: one column up to two, two columns from three
  // (`from`: diffusers, a tall block each, pair up from two). Not with large text (text_scale over
  // TWO_COLUMN_MAX_SCALE): half a column would cut the names, so one column, and the body scrolls instead.
  const TWO_COLUMN_MAX_SCALE = 1.25;
  function gridColumns(count, textScale, from) {
    if (finite(textScale) && textScale > TWO_COLUMN_MAX_SCALE) return 1;
    return finite(count) && count >= (finite(from) ? from : 3) ? 2 : 1;
  }

  // Media on a room page: playing before paused (each keeping its order), at most `max`, the rest counted
  // ("+N more" in the caption): the room page shows what matters, the More page lists every player.
  const MEDIA_MAX = 2;
  function mediaVisible(list, max) {
    const m = Number.isInteger(max) && max >= 0 ? max : MEDIA_MAX;
    const all = Array.isArray(list) ? list.filter(Boolean) : [];
    const sorted = [...all.filter((x) => x.playing), ...all.filter((x) => !x.playing)];
    return { shown: sorted.slice(0, m), more: Math.max(0, sorted.length - m) };
  }

  // The chips row (locks, occupancy, doors and windows). A door paired with a lock in the room is said
  // once, by the lock: its padlock draws the door and its word turns "Open" (lockVisual), so a second
  // "Front Door Closed" chip only repeats it and pushes the row onto two lines.
  function roomChips(items) {
    const list = Array.isArray(items) ? items : [];
    const paired = new Set(list.filter((i) => i && i.kind === "lock" && i.door).map((i) => i.door));
    return list.filter((i) => i && (i.kind === "lock" || i.kind === "occupancy" || (i.kind === "door" && !paired.has(String(i.key).slice(5)))));
  }

  // Which edges of a scrolling body have more beyond them (the fade and the "More" hint), 2 px tolerance.
  function scrollCue(top, client, height) {
    if (![top, client, height].every(finite)) return { above: false, below: false };
    return { above: top > 2, below: top + client < height - 2 };
  }

  // Radar scopes: one column, or two from RADAR.twoColsFrom; each field as wide as the height left per row
  // allows (the field is the +/-60 degree wedge, 2 sin 60 wide per unit tall), never wider than its column
  // and never under RADAR.minScopeMm (then the page scrolls). All in mm; opts.headMm is a scope's name line.
  function scopeSize(n, availH, availW, opts) {
    if (!finite(n) || n <= 0) return { cols: 1, rows: 0, width: 0 };
    const o = opts || {};
    const head = finite(o.headMm) ? o.headMm : 11;
    const cols = n >= RADAR.twoColsFrom ? 2 : 1;
    const rows = Math.ceil(n / cols);
    const colW = ((finite(availW) ? availW : 0) - (cols - 1) * RADAR.colGapMm) / cols;
    const fieldH = ((finite(availH) ? availH : 0) - rows * (head + RADAR.headGapMm) - (rows - 1) * RADAR.rowGapMm) / rows;
    const width = Math.min(colW, fieldH * 2 * SIN60);
    return { cols, rows, width: Math.max(RADAR.minScopeMm, Math.min(width, Math.max(colW, RADAR.minScopeMm))) };
  }

  // THE MORE PAGE (docs/DESIGN.md "The More page"): doors and scenes are one row of instruments.
  // rowSplit: up to `max` in one row; beyond that the fewest rows, filled evenly, longer rows first (5 of
  // max 4 is [3, 2], 6 of max 5 is [3, 3], 7 of max 3 is [3, 2, 2]), so nothing sits alone on a row of
  // its own. rowColumns: the widest row, which sets the column width. Junk is one row of one.
  function rowSplit(count, max) {
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(max) || max < 1) return [1];
    const rows = Math.ceil(count / max), base = Math.floor(count / rows), extra = count % rows;
    return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
  }
  const rowColumns = (count, max) => rowSplit(count, max)[0];

  // How many across on More: four padlocks and five scenes fit one row at text_scale 1 (the house has
  // 4 doors and 5 scenes); over TWO_COLUMN_MAX_SCALE the names need more room, so three (never two: an odd count would orphan).
  const MORE_ROW_MAX = { doors: [4, 3], scenes: [5, 3] };
  function moreRows(kind, count, textScale) {
    const m = MORE_ROW_MAX[kind] || [1, 1];
    return rowSplit(count, finite(textScale) && textScale > TWO_COLUMN_MAX_SCALE ? m[1] : m[0]);
  }
  const moreColumns = (kind, count, textScale) => moreRows(kind, count, textScale)[0];

  // A padlock's name under it, in a section headed Doors: "Front Door Lock" says "Front". A trailing
  // "Lock" and then "Door" go, but never the whole name ("Door Lock" stays "Door").
  function doorLabel(name) {
    let n = String(name === undefined || name === null ? "" : name).trim();
    for (const word of [/\s+lock$/i, /\s+door$/i]) {
      const cut = n.replace(word, "").trim();
      if (cut) n = cut;
    }
    return n;
  }

  // Doors pair with locks by position (config `locks[i]` with `doors[i]`).
  function doorPairs(cfg) {
    const out = {};
    const locks = (cfg && cfg.locks) || [], doors = (cfg && cfg.doors) || [];
    locks.forEach((id, i) => {
      if (doors[i]) out[id] = doors[i];
    });
    return out;
  }

  globalThis.MashrabiyaLogic = {
    ALERT, openDoors, doorAlertMode, lockVisual, lockTransition, lockAggregate, doorPairs,
    pagePalette, LOOPS, tickerMode, chromeFrames,
 wipeFrames, valueChange, fractionMoved, ringMix, radarVector,
    scentDevices, scentModel, scentColor, scentTimer, intensityStep,
    ACCENTS, roomAccent, pageAccent, gaugeStops, gradientOffset, arcTicks,
    fpsEnabled, fpsStats, fpsTrim,
    RADAR, RADAR_KEY, toMm, radarPrefixes, radarList, radarModel, radarSpeedText, radarBox, radarProject,
    radarWedgePath, radarRingArc, radarRings, radarZoneRect, radarTrailPush,
    TOUCH, trailPush, trailFrame, burstAngle, treatAsPrimary, staleIds,
    CONNECTION, connectionDown, connectionLost, statusLines,
    privacyActive, navTargets, gridColumns, rowSplit, rowColumns, moreRows, moreColumns, doorLabel, TWO_COLUMN_MAX_SCALE, MEDIA_MAX, mediaVisible, roomChips, scrollCue, scopeSize, roomKey, pageKeys, orderPages,


 pageIndexFor, firstRoomIndex,
    DRAG, dragNeighbour, dragDecision, dragOffsets, settleMs, DOUBLE_TAP, isDoubleTap, MIRROR, mirrorFadeMs, mirrorAlertExit, fadeProgress, fadeFrames, fadeScale, fadeTiming, FADE, currentOpacity,
    GAUGE, gaugeFraction, arcPoint, arcPath, arcDash, tempScale, tempTone, humidityTone, airSegment, fanSpinSeconds,
    newsHeadlines, tickerSegments, tickerSeconds,
    SEVERITY, severityOf, conditionTone, statusTone,
 airTone, lockTone, lightsTone, doorTone, presenceTone, internetTone, modeTone,
    swipeDirection, movedPast,
    PAGES, nextPage, pageDirection, slideFrames, MOTION, staggerDelays, settleFrames, rollDelays,
    weatherAnim, digitChanges, numberTween, tweenAt, kelvinRgb, lightColor,
    roomIndex, roomDetails, roomsFromRegistries, roomsSignature, lightName, airLevelTone,
    STRINGS, resolveConfig, mediaPlayers, outdoorTemp, DEFAULT_FONT_URL, RADAR_PATTERN,
    DEFAULTS, formatId, entityName, joinNames, exceptions, clock, isNight, rainWindow, conditionWord,
    tempText, unlockedCount, locksToLock, lockSublabel, lightsOn, lightsSublabel, airWord, presenceWord,
    doorWord, stepTarget, debounceOk,
  };
})();
