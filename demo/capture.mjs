#!/usr/bin/env node
// Re-takes the README screenshots (docs/img/*.png) from the demo house, in headless Chrome.
//
//   node demo/capture.mjs                     from anywhere in the repository (Node 22 or later)
//   CHROME=/path/to/chromium node demo/capture.mjs
//
// It serves the repository on 127.0.0.1 (a random port) for as long as it runs, opens each scene of
// demo/index.html, waits for the scene to say it has settled (<html data-ready="1">), and saves a PNG.
//
// Geometry: the reference kiosk is a 1080x1920 portrait panel that Chromium shows at a 0.75 scale factor,
// a 1440x2560 CSS-pixel viewport (docs/KIOSK.md). The card is sized in CSS millimetres (--mm), so the same
// CSS viewport reproduces the glass's layout; the shots are taken at a 0.5 device scale (720x1280 pixels)
// to keep them small. Only the image chunks are kept in each PNG (no text, time or colour-profile chunks).
// Needs Chrome or Chromium, and network access for the Atkinson Hyperlegible web font.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "img");
const VIEW = { width: 1440, height: 2560, scale: 0.5 };
const SHOTS = [
  { scene: "main-calm" },
  { scene: "main-exceptions" },
  { scene: "more" },
  { scene: "room" },
  { scene: "radar" },
  { scene: "night" },
  { scene: "touch" },
  // The ticker is the bottom edge of Main: its lowest 176 CSS pixels (about 42 mm).
  { scene: "ticker", clip: { x: 0, y: VIEW.height - 176, width: VIEW.width, height: 176 } },
];
const CHROME = process.env.CHROME || {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "chromium",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
}[process.platform];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- a static server for the repository, on loopback only ---------------------------------------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
  if (rel.endsWith("/")) file = path.join(file, "index.html");
  fs.readFile(file, (err, body) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- Chrome over the DevTools protocol ------------------------------------------------------------
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mashrabiya-capture-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--hide-scrollbars", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
const exited = new Promise((r) => chrome.once("exit", r));
const cleanup = async () => {
  chrome.kill();
  server.close();
  await exited; // Chrome writes to its profile until it is gone
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
};

try {
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
  const [port, wsPath] = fs.readFileSync(portFile, "utf8").trim().split("\n");
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  };
  const send = (method, params, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page("Page.enable");
  await page("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.scale, mobile: false });

  fs.mkdirSync(OUT, { recursive: true });
  for (const { scene, clip } of SHOTS) {
    await page("Page.navigate", { url: `${base}/demo/?scene=${scene}` });
    let ready = false;
    for (let i = 0; i < 900 && !ready; i++) { // up to 90 s: the ticker scene waits for a label
      await sleep(100);
      const r = await page("Runtime.evaluate", { expression: 'document.documentElement.dataset.ready === "1"', returnByValue: true });
      ready = r.result.value === true;
    }
    if (!ready) throw new Error(`${scene}: never became ready`);
    await sleep(300); // a few more frames on screen
    const shot = await page("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    const file = path.join(OUT, `${scene}.png`);
    fs.writeFileSync(file, imageChunksOnly(Buffer.from(shot.data, "base64")));
    console.log(`${path.relative(ROOT, file)}  ${pngSize(fs.readFileSync(file)).join("x")}`);
  }
  ws.close();
} finally {
  await cleanup();
}

// Keep IHDR, PLTE, tRNS, IDAT and IEND: everything that draws the image, nothing else.
function imageChunksOnly(png) {
  const sig = png.subarray(0, 8);
  if (!sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Error("not a PNG");
  const keep = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  const out = [sig];
  for (let i = 8; i < png.length;) {
    const n = png.readUInt32BE(i);
    const kind = png.toString("latin1", i + 4, i + 8);
    if (keep.has(kind)) out.push(png.subarray(i, i + 12 + n));
    i += 12 + n;
  }
  return Buffer.concat(out);
}

function pngSize(png) {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}
