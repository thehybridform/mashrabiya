// Run: npm test
// The documents are written for a stranger: every option documented, links that resolve, the
// lock-only promise and the licence stated, the hard-won kiosk details kept.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const LOGIC = read("dist/mashrabiya-logic.js");
const DOCS = ["README.md", "RELEASE-CHECKLIST.md", "docs/INSTALL.md", "docs/KIOSK.md", "docs/DESIGN.md", "docs/HARDWARE.md"];
const MARKDOWN = [...DOCS, "CHANGELOG.md"];

// Top-level option names resolveConfig returns (derived from the code, not typed here).
function optionKeys() {
  const fn = LOGIC.split("function resolveConfig")[1];
  assert.ok(fn, "resolveConfig missing");
  const body = fn.split("// Players the More page")[0];
  const ret = body.split("return {")[1];
  assert.ok(ret, "resolveConfig's return object missing");
  return [...ret.matchAll(/^      (\w+):/gm)].map((m) => m[1]);
}

test("all documents exist and are not empty", () => {
  for (const name of DOCS) assert.ok(read(name).length > 1500, name);
});

test("every option is in the configuration reference table", () => {
  const keys = optionKeys();
  assert.ok(keys.length >= 20, keys.join()); // the extraction found the real list
  const install = read("docs/INSTALL.md");
  const table = install.split("## Configuration reference")[1].split("## News feeds")[0];
  for (const key of keys) {
    // nested options (scenes) are documented as scenes.title etc.
    assert.match(table, new RegExp(`\\| \`${key}(?:\\.\\w+)?\` \\|`), `INSTALL.md table lacks ${key}`);
  }
});

test("the README says lock-only and states the MIT licence", () => {
  const readme = read("README.md");
  assert.ok(readme.split(/\s+/).join(" ").includes("never unlock"));
  assert.match(readme, /## Licence\n\nMIT\./);
  const licence = read("LICENSE");
  assert.match(licence, /^MIT License\n\nCopyright \(c\) 2026 thehybridform\n/);
  assert.ok(licence.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
  assert.equal(JSON.parse(read("package.json")).license, "MIT");
});

test("the kiosk guide carries the hard-won details", () => {
  const kiosk = read("docs/KIOSK.md");
  for (const needle of [
    "--kiosk", "--force-device-scale-factor", "--disable-pinch", "--overscroll-history-navigation=0",
    "--noerrdialogs", "--disable-infobars", "--no-first-run", "--password-store=basic",
    "--ozone-platform=wayland", "--disable-session-crashed-bubble",
    "--autoplay-policy=no-user-gesture-required", "--check-for-update-interval=31536000",
    "lwrespawn", "systemctl restart lightdm", "transform 90", "xcursorgen", "XCURSOR_THEME",
    "`labwc -m`", 'category="touch"', "silently ignored", "calibrationMatrix", 'mouseEmulation="no"',
    "instance-id", "regulatory-domain", "singular `user:`", "grim", "?fps=1", "unmounted frame is live",
  ]) {
    assert.ok(kiosk.includes(needle), needle);
  }
});

test("the install guide explains the cache-buster, the feeds' polling and the recorder", () => {
  const install = read("docs/INSTALL.md");
  for (const needle of ["?v=", "scan_interval", "recorder"]) assert.ok(install.includes(needle), needle);
});

test("both install paths use this repository's paths and the new element name", () => {
  const install = read("docs/INSTALL.md");
  assert.ok(install.includes("/hacsfiles/mashrabiya/mashrabiya-card.js"));
  assert.ok(install.includes("/local/mashrabiya/mashrabiya-card.js?v="));
  assert.ok(install.includes("type: custom:mashrabiya-card"));
  for (const name of MARKDOWN) {
    const text = read(name);
    assert.ok(!text.includes("/local/mirror/"), `${name}: old /local/mirror/ path`);
    assert.ok(!/mirror-(card|logic)\.js/.test(text), `${name}: old file name`);
  }
});

test("mirror-panel-card appears only as the documented legacy alias", () => {
  for (const name of MARKDOWN) {
    for (const line of read(name).split("\n")) {
      if (line.includes("mirror-panel-card")) assert.match(line, /legacy|earlier name|alias/i, `${name}: ${line}`);
    }
  }
});

test("relative links in the documents point at files that exist", () => {
  for (const name of MARKDOWN) {
    const dir = path.dirname(path.join(ROOT, name));
    for (const [, target] of read(name).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const file = target.split("#")[0];
      assert.ok(fs.existsSync(path.join(dir, file)), `${name} links to missing ${target}`);
    }
  }
});

test("hacs.json names the card file that ships in dist/", () => {
  const hacs = JSON.parse(read("hacs.json"));
  assert.equal(hacs.name, "Mashrabiya");
  assert.equal(hacs.filename, "mashrabiya-card.js");
  assert.equal(hacs.render_readme, true);
  assert.ok(fs.existsSync(path.join(ROOT, "dist", hacs.filename)));
});

test("the changelog's newest release is the package version (an Unreleased section may sit above it)", () => {
  const version = JSON.parse(read("package.json")).version;
  const headings = [...read("CHANGELOG.md").matchAll(/^## \[([^\]]+)\]/gm)].map((m) => m[1]);
  assert.ok(!headings.slice(1).includes("Unreleased"), "Unreleased must be the first section, if present");
  const first = headings.find((h) => h !== "Unreleased");
  assert.ok(first, "CHANGELOG.md has no release heading");
  assert.equal(first, version);
});
