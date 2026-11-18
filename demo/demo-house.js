// The demo house: a made-up home with a fake `hass`, for trying the card in a plain browser and for
// the README screenshots. Nothing here talks to Home Assistant: every service call is logged and
// dropped, and the weather forecast is a fixed list. See demo/README.md.
//
//   /demo/?scene=main-calm        Main, everything locked, "All clear" (the default)
//   /demo/?scene=main-exceptions  Main with an unlocked lock and an open door
//   /demo/?scene=more             the More page
//   /demo/?scene=room             the Living Room page
//   /demo/?scene=radar            the Radar page, one target walking
//   /demo/?scene=night            Main at night, with one exception on the status line
//   /demo/?scene=ticker           Main with the scrolling ticker (ticker: scroll), for a crop of the bottom edge
//   /demo/?scene=touch            Main with a drag in progress, frozen mid-drag
//   &font=system                  system fonts instead of fetching Atkinson Hyperlegible
//
// When the scene has settled, <html> gets data-ready="1" (for screenshot tools).

const SCENES = ["main-calm", "main-exceptions", "more", "room", "radar", "night", "ticker", "touch"];
const params = new URLSearchParams(location.search);
const scene = SCENES.includes(params.get("scene")) ? params.get("scene") : "main-calm";

// --- a fixed clock --------------------------------------------------------------------------------
// The card reads the time only through Date.now(). Pin it to a fixed moment that then runs on in real
// time, so the clock shows 10:24 AM (day) or 11:12 PM (night window) whenever the page is opened.
// This must happen before the card loads, hence the dynamic import below.
const DAY = Date.UTC(2026, 3, 14, 10, 24, 5);
const NIGHT = Date.UTC(2026, 3, 14, 23, 12, 5);
const realNow = Date.now.bind(Date);
const offset = (scene === "night" ? NIGHT : DAY) - realNow();
Date.now = () => realNow() + offset;

await import("../dist/mashrabiya-card.js");

// --- the house ------------------------------------------------------------------------------------
const AREAS = {
  hallway: { area_id: "hallway", name: "Hallway" },
  kitchen: { area_id: "kitchen", name: "Kitchen", temperature_entity_id: "sensor.demo_kitchen_temperature" },
  living_room: {
    area_id: "living_room", name: "Living Room",
    temperature_entity_id: "sensor.demo_living_room_temperature", humidity_entity_id: "sensor.demo_living_room_humidity",
  },
  study: { area_id: "study", name: "Study" },
};

const states = {};
const entities = {};
// One entity: its state, attributes, and (optionally) the area the registry puts it in.
function add(id, state, attributes, area) {
  states[id] = {
    entity_id: id, state: String(state), attributes: attributes || {},
    last_changed: new Date(Date.now()).toISOString(), last_updated: new Date(Date.now()).toISOString(), context: {},
  };
  if (area) entities[id] = { entity_id: id, area_id: area, device_id: null, hidden: false, entity_category: null };
}
const set = (id, state, attrs) => {
  states[id] = { ...states[id], state: String(state), attributes: { ...states[id].attributes, ...(attrs || {}) } };
};

add("weather.demo_home", "partlycloudy", { friendly_name: "Home", temperature: 14, temperature_unit: "°C" });
add("person.demo_resident", "home", { friendly_name: "Resident" });
add("binary_sensor.demo_internet", "on", { friendly_name: "Internet", device_class: "connectivity" });
add("script.demo_leaving", "off", { friendly_name: "Leaving" });

// Locks and their doors, paired by position in the config.
add("lock.demo_front_door", "locked", { friendly_name: "Front Door Lock" }, "hallway");
add("lock.demo_back_door", "locked", { friendly_name: "Back Door Lock" }, "kitchen");
add("lock.demo_garage_door", "locked", { friendly_name: "Garage Door Lock" });
add("binary_sensor.demo_front_door", "off", { friendly_name: "Front Door", device_class: "door" }, "hallway");
add("binary_sensor.demo_back_door", "off", { friendly_name: "Back Door", device_class: "door" }, "kitchen");
add("binary_sensor.demo_garage_door", "off", { friendly_name: "Garage Door", device_class: "garage_door" });

// Hallway: the thermostat and a presence radar.
add("climate.demo_thermostat", "heat", {
  friendly_name: "Thermostat", hvac_modes: ["off", "heat"], current_temperature: 20.5, temperature: 21,
  current_humidity: 44, min_temp: 7, max_temp: 30, target_temp_step: 0.5,
}, "hallway");
add("light.demo_hallway", "off", { friendly_name: "Hallway Light" }, "hallway");

// Living room: both gauges, the air meter, occupancy, lights in their own colours, a speaker.
add("sensor.demo_living_room_temperature", 21.4, { friendly_name: "Living Room Temperature", device_class: "temperature", unit_of_measurement: "°C" }, "living_room");
add("sensor.demo_living_room_humidity", 46, { friendly_name: "Living Room Humidity", device_class: "humidity", unit_of_measurement: "%" }, "living_room");
add("sensor.demo_living_room_air_quality", "high", { friendly_name: "Living Room Air Quality", device_class: "enum" }, "living_room");
add("binary_sensor.demo_living_room_motion", "on", { friendly_name: "Living Room Motion", device_class: "occupancy" }, "living_room");
add("light.demo_living_room_floor_lamp", "on", { friendly_name: "Living Room Floor Lamp", brightness: 191, color_mode: "color_temp", color_temp_kelvin: 2700 }, "living_room");
add("light.demo_living_room_ceiling", "on", { friendly_name: "Living Room Ceiling", brightness: 128, color_mode: "color_temp", color_temp_kelvin: 4000 }, "living_room");
add("light.demo_living_room_shelf", "on", { friendly_name: "Living Room Shelf", brightness: 102, color_mode: "hs", hs_color: [262, 62] }, "living_room");
add("light.demo_living_room_reading_lamp", "off", { friendly_name: "Living Room Reading Lamp" }, "living_room");
add("media_player.demo_living_room_speaker", "playing", {
  friendly_name: "Living Room Speaker", media_title: "Morning Light — The Example Band", volume_level: 0.3,
}, "living_room");
// The scenes' "Off" button target: a group of the living room lights (not in a room, so not listed twice).
add("light.demo_living_room", "on", {
  friendly_name: "Living Room Lights",
  entity_id: ["light.demo_living_room_floor_lamp", "light.demo_living_room_ceiling", "light.demo_living_room_shelf", "light.demo_living_room_reading_lamp"],
});
add("scene.demo_bright", "scening", { friendly_name: "Bright" });
add("scene.demo_relax", "scening", { friendly_name: "Relax" });
add("scene.demo_evening", "scening", { friendly_name: "Evening" });

// Kitchen and study.
add("sensor.demo_kitchen_temperature", 22.1, { friendly_name: "Kitchen Temperature", device_class: "temperature", unit_of_measurement: "°C" }, "kitchen");
add("sensor.demo_kitchen_humidity", 51, { friendly_name: "Kitchen Humidity", device_class: "humidity", unit_of_measurement: "%" }, "kitchen");
add("light.demo_kitchen_pendants", "on", { friendly_name: "Kitchen Pendants", brightness: 230, color_mode: "color_temp", color_temp_kelvin: 3000 }, "kitchen");
add("light.demo_kitchen_counter", "off", { friendly_name: "Kitchen Counter" }, "kitchen");
add("sensor.demo_study_temperature", 19.8, { friendly_name: "Study Temperature", device_class: "temperature", unit_of_measurement: "°C" }, "study");
add("light.demo_study_desk_lamp", "on", { friendly_name: "Study Desk Lamp", brightness: 160, color_mode: "color_temp", color_temp_kelvin: 3500 }, "study");
add("cover.demo_study_blind", "open", { friendly_name: "Study Blind", current_position: 60, device_class: "blind" }, "study");

// A presence radar in the hallway (the ld2450-style entity pattern the card discovers).
const R = "demo_hallway_presence";
for (const n of [1, 2, 3]) {
  add(`sensor.${R}_target_${n}_x`, 0, { unit_of_measurement: "mm" }, "hallway");
  add(`sensor.${R}_target_${n}_y`, 0, { unit_of_measurement: "mm" }, "hallway");
  add(`sensor.${R}_target_${n}_speed`, 0, { unit_of_measurement: "m/s" }, "hallway");
  add(`binary_sensor.${R}_target_${n}_active`, "off", {}, "hallway");
}
add(`number.${R}_max_distance`, 6000, { unit_of_measurement: "mm" }, "hallway");
add(`number.${R}_zone_1_begin_x`, -1500, { unit_of_measurement: "mm" }, "hallway");
add(`number.${R}_zone_1_end_x`, 1500, { unit_of_measurement: "mm" }, "hallway");
add(`number.${R}_zone_1_begin_y`, 600, { unit_of_measurement: "mm" }, "hallway");
add(`number.${R}_zone_1_end_y`, 4200, { unit_of_measurement: "mm" }, "hallway");

// News feeds, in the shape the `rest` integration gives an RSS feed (headlines in the `item` attribute).
const feed = (titles) => ({ friendly_name: "News", item: titles.map((title) => ({ title })) });
add("sensor.demo_news_local", 3, feed([
  "City library extends weekend hours",
  "New bike lanes open along the river path",
  "Farmers market returns to the old square on Saturday",
]));
add("sensor.demo_news_world", 2, feed([
  "Solar output sets a new spring record",
  "Researchers map a deep-sea reef in fine detail",
]));

// --- the scene ------------------------------------------------------------------------------------
if (scene === "main-exceptions") {
  set("lock.demo_back_door", "unlocked");
  set("binary_sensor.demo_garage_door", "on");
}
// At night only the clock and the exceptions show: leave one, so the status line is there to see.
if (scene === "night") set("lock.demo_back_door", "unlocked");

const CONFIG = {
  weather: "weather.demo_home",
  locks: ["lock.demo_front_door", "lock.demo_back_door", "lock.demo_garage_door"],
  doors: ["binary_sensor.demo_front_door", "binary_sensor.demo_back_door", "binary_sensor.demo_garage_door"],
  internet: "binary_sensor.demo_internet",
  air: "sensor.demo_living_room_air_quality",
  leaving_script: "script.demo_leaving",
  climate: "climate.demo_thermostat",
  person: "person.demo_resident",
  scenes: {
    title: "Living room",
    entities: ["scene.demo_bright", "scene.demo_relax", "scene.demo_evening"],
    off: "light.demo_living_room",
  },
  media_players: [{ entity: "media_player.demo_living_room_speaker", name: "Living Room Speaker" }],
  news: [
    { label: "Local", entity: "sensor.demo_news_local", tone: "green" },
    { label: "World", entity: "sensor.demo_news_world", tone: "yellow" },
  ],
  rooms: ["living_room", "kitchen", "study", "hallway"],
};
if (params.get("font") === "system") CONFIG.font_url = null;
// The ticker scene scrolls the strip, so more than one headline (and both feeds) are in view at once.
if (scene === "ticker") CONFIG.ticker = "scroll";

// --- a fake hass -----------------------------------------------------------------------------------
const forecast = Array.from({ length: 12 }, (_, i) => ({
  datetime: new Date(Date.now() + (i + 1) * 3600e3).toISOString(), condition: "partlycloudy", temperature: 14 + (i < 6 ? i * 0.5 : 3),
}));
const connection = {
  // Weather forecast subscription: answered once, with a dry day (no rain warning).
  subscribeMessage(callback) {
    setTimeout(() => callback({ type: "hourly", forecast }), 0);
    return Promise.resolve(() => {});
  },
  sendMessagePromise: () => Promise.resolve(null),
};
const hassBase = {
  areas: AREAS, devices: {}, entities,
  config: { time_zone: "UTC", unit_system: { temperature: "°C", length: "km" } },
  connected: true, connection, language: "en", user: { name: "Demo", is_admin: false },
  // Nothing in the demo can act: every service call is logged and dropped.
  callService(domain, service, data) {
    console.info("[demo] service call ignored:", `${domain}.${service}`, data);
    return Promise.resolve();
  },
  callWS: () => Promise.resolve(null),
  callApi: () => Promise.resolve(null),
};
// Like Home Assistant, a new hass object (and states object) on every change; registries keep their identity.
const hass = () => ({ ...hassBase, states: { ...states } });

const card = document.createElement("mashrabiya-card");
card.setConfig(CONFIG);
document.body.appendChild(card);
card.hass = hass();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Ready once the face has loaded (or failed), so a screenshot never catches the fallback font.
const ready = async () => {
  await document.fonts.ready;
  document.documentElement.dataset.ready = "1";
};

// Page navigation uses the card's own move (the one a tap on Rooms or a swipe ends in), so the page
// arrives with its real slide and entrance.
function goTo(key) {
  const i = card._pageKeys.indexOf(key);
  if (i < 0) throw new Error(`demo: no page ${key} (pages: ${card._pageKeys.join(", ")})`);
  card._go(i);
}

// The radar's one target walks a loop through the zone at about walking pace, reporting every 300 ms like the device.
function walk() {
  const t0 = realNow();
  let last = null;
  const step = () => {
    const s = (realNow() - t0) / 1000;
    const x = Math.round(1300 * Math.sin(s * 0.8));
    const y = Math.round(2600 + 900 * Math.sin(s * 1.6 + 0.6));
    const speed = last ? Math.hypot(x - last.x, y - last.y) / 1000 / 0.3 : 0;
    last = { x, y };
    set(`sensor.${R}_target_1_x`, x);
    set(`sensor.${R}_target_1_y`, y);
    set(`sensor.${R}_target_1_speed`, speed.toFixed(2));
    set(`binary_sensor.${R}_target_1_active`, "on");
    card.hass = hass();
  };
  step();
  setInterval(step, 300);
}

// A drag in progress, from synthetic pointer events: the finger goes down on bare glass and moves left
// (the next page following it in), then everything is frozen so a still can be taken mid-drag. The
// freeze pauses the card's animations and stops the clock its touch trail is drawn against; nothing
// is drawn by the demo itself.
async function drag() {
  const root = card.shadowRoot;
  const start = { x: 1010, y: 1250 };
  const target = root.elementFromPoint(start.x, start.y) || card;
  const fire = (type, x, y) => target.dispatchEvent(new PointerEvent(type, {
    pointerId: 7, isPrimary: true, pointerType: "touch", clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1,
    bubbles: true, composed: true, cancelable: true,
  }));
  fire("pointerdown", start.x, start.y);
  for (let i = 1; i <= 9; i++) {
    await wait(16);
    fire("pointermove", start.x - i * 36, start.y + Math.round(30 * Math.sin(i / 3)));
  }
  await wait(20);
  for (const a of root.getAnimations()) a.pause();
  const frozen = performance.now();
  performance.now = () => frozen;
}

if (scene === "radar") walk();
await wait(600);
if (scene === "more") goTo("more");
else if (scene === "room") goTo("room:living_room");
else if (scene === "radar") goTo("radar");
// The entrance is over inside 950 ms; leave it room, then mark the scene ready.
await wait(scene === "radar" ? 3500 : 2000);
await document.fonts.load("700 40px 'Atkinson Hyperlegible'").catch(() => {});
if (scene === "touch") await drag();
// The scrolling ticker: wait for a moment when a feed label (LOCAL or WORLD) is near the left edge.
if (scene === "ticker") {
  const near = () => Array.from(card.shadowRoot.querySelectorAll(".ticker .lab")).some((l) => {
    const x = l.getBoundingClientRect().left;
    return x > 60 && x < 400;
  });
  for (let i = 0; i < 1200 && !near(); i++) await wait(50);
}
await ready();
