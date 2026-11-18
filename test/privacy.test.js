// Run: npm test
// Privacy scan: no file in the repository (every tracked-looking file, this one included), and no file
// name, names the people, places, network or devices of the house the card was first built for. The
// card and its docs are generic; this keeps them that way.
//
// The banned strings are stored only as SHA-256 digests, never as text or any reversible encoding, so
// publishing this guard does not publish what it guards. test/privacy-hash.js turns every file into
// candidate tokens (lowercased: substrings of identifier-like runs such as dotted entity ids, host:port
// paths and e-mail fragments; whole words; word prefixes), hashes each as SHA-256(fixed public salt +
// "<kind>:<token>") and looks it up in DIGESTS below. A two-word phrase is two digests in PAIRS: the end
// of one word and the start of the next, across exactly one space. The list covers: personal names and e-mail fragments, private LAN addresses and the old
// source host, the kiosk's old hostname, the home city and its news outlets, assistant and device
// nicknames, purchase and vendor details, the house's real entity ids, and the design language's old name.
//
// To ban another string, print its digest and paste the digest (only the digest) into DIGESTS, or for a
// phrase the printed pair into PAIRS:
//   node test/privacy-hash.js sub  "<text without spaces>"   matched anywhere, 4 to 40 characters
//   node test/privacy-hash.js word "<whole word>"            e.g. a short acronym that is also a substring
//   node test/privacy-hash.js pre  "<start of a word>"
//   node test/privacy-hash.js pair "<word> <word>"           a two-word phrase, matched anywhere
// Then plant the string in a scratch file, run `npm test` and watch this test fail before removing it.
// Keep the token itself out of the repository and out of commit messages.
//
// Honest limits: a salted hash is not a secret. The salt is public, so a digest of a short or common
// word can be recovered by hashing a dictionary of guesses; this list is a guard against regressions,
// not a vault. The tokenizer is also only as good as its token kinds: a string split across a line
// break, or written with characters outside [a-z0-9_.@:/\-] in the middle, is not seen.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { digest, pairDigests, scanner } = require("./privacy-hash.js");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules"]);

const DIGESTS = [
  "065e20fb50064ce19c6d1ce4af81d70f703d19c66daef96658968f4f10c62a29",
  "091f3a7c3cbbf8a4815f16dbf90818e53733856452d571843ad12c5d049d2b59",
  "11e52be33b25ad5a77eabe1364652209bafd88450626b7b4f07e475c99114dc4",
  "150e3f8c1e1ee3783d180ea1b94e51697fbefe5dd1e17a1bbd0ec72d3c745647",
  "185c73712b4747e890775ce59f8e5d96486afdc11b72ccaeb6fe2b968a350160",
  "2168af9b8b295f303ff551d17c50942d99d5949549a99575b29f6765a444e686",
  "39204d55f474fb20dff90fad29c5d1fdd9681a17f3c598cc425e4419d905d121",
  "468f5d55cd253661dca0a0585a47c56974ce0da6c448d1f21f50f917a62c6e09",
  "502efa1860724cb4bae9d3830ff870949f05c145a0808fb67722207c1c2703f1",
  "56622bfe9c540b23aabe1524039c728cefe309f0f7c790be1e55c9131dc4ae3b",
  "56f71d3d0ec493293392da1a99be40b3ef36110e114201f9adee02988c7b99ae",
  "5ff2193b04df1735f8ffdfee8d277534fbf2428c5b3eb686d72cde188e492bac",
  "62234a89498eb50d77527a56092e19c85ab5631f15c5e66fa2dcad0e01d97c43",
  "6365e4d518fcc31c6a7d6b74f9fc0734c517107c05a16d1cae7da5a6be15803a",
  "6768ca2a42c62f7f1f1ddbe717e6a001d635d795347e9ee1e9cafa344b6bc1ec",
  "7285872e5c9406e41afab9fd29e2b432a3b2d3a1159f5d27f35213a1aeeb6f54",
  "76529a70db56a0bf22bc24714b26085261b24a9ff39fde1ed48a7ed787813ca1",
  "78d28b4435e0ef740379f2a430c2a6e6c3054e82a6251d06b7b94fa5d5143460",
  "7d0f692ccc0de7a559789aabd04facb91eaaefe3e3209118e278aad9bce6ee79",
  "86bd7a3acb09216f36f590af90ac9945cd9aee74b9a738d2bbdf13f7b557d9f9",
  "8725a21ecfab4fda42acccc80746d83f8c3977524d6b4fccc39077c5054c7d78",
  "8d5922f52b8451e9b19518042a6f47b76855b0772ed35a63835512c025b37fd9",
  "92794d72dd466364ec30f4dc173b59adafc2440f76e3456714c0868db1819898",
  "946523c46d9cad52ce34b357f8ca7fc210375a471dab0b93f95ebcebf8d0c605",
  "96f4a9af05284fa2a979ceaf5d9bd201e14bab85a86ab517f0b3bab30b124b60",
  "978c0d4e9b69588b07af84a273a234012d0e56cdd96347f9d93494679be371d5",
  "98043404df3324a2029e882aa63652f0993f87cb8d3c82a414021f76fb16480b",
  "a20f3a171143bbe38ec33fb265e947aa26bc2f7aeba889ace76b86ab3cf6dc92",
  "a3a41298a9ff63037281a95892d94a2635ba26d9e50e1f65ffb67257ff06d05a",
  "a7cfd49ddb70a52922eb07dc2d35a8eaa9f2b337256160ac725f381c6b5fdd4f",
  "aa1487583d46b0ad13230a8ccea5aef0a3f2a4fcd5af7703b072952b79c98c4e",
  "addc1f55305df097c1e4ac4c068585ca9d563ca1d710cc70dd86842fa8f176d5",
  "b494ed568f192e780499c982f1545af2e30550a6fdf0738433a580934c9b8052",
  "b9f57c51b4b987cbce5aeab99754ef7414ce84b61db5b9933f57403669cb4fb1",
  "d2d4321211be84d65bfb7e4c3043a00489c7f54622af221443c48fed1065eb2b",
  "dc090d7ceda4a9889c36242ec5dbea3cbadbc46645944fb475fd9f2883b8aa9e",
  "ea024fd01fcb34215ec8887ec17862fb2e2dfc79b62a5ecff5aabd206d8791b9",
  "eacca7a7270b3af3202346067339a4d064f4844755fe2651a051c56b9382207f",
  "f09392e41a5cacb86222dbfbf39f9b31ea6e422ca6eeb63b0ad44e8e6266db29",
  "f9d35a46976f1bb0e015f996679d291bb8f548c775580094ef67868af03b4198",
  "fa6f80f41576184f2deed45338f6757841fc40f83fdfbc4204a9acf7de0c9ba8",
  "fef0b5947b62467d9943f578990b2eeff8b7d0a840f8f669898825a20aeb5f22",
  "ff6c863666d18b0c8c977fd8033298745490374ffc68ea780c68a6bdc09d850a",
];

// Two-word phrases, as [end of the first word, start of the second] digests (node test/privacy-hash.js pair).
const PAIRS = [
  ["05eed57d90eaa928349f547cb9c68dfeb61d29cc9a71de5ffcaf906cb596d347",
   "0bb08148ff0cf2c32d6f3bbc8b30d09205a454b0256e2cb2b7582b8e4566582c"],
  ["8c9f73a9a778fad1ce3a4e2522754afacff4304b04ebae79f8251a405afebf32",
   "efcf85558b455271d26f56ebab25f7d0db4bffe19c0be9299787686d006ae8c3"],
  ["c07887d673e773b056b7693f041047d77b35f7b89015254b6bf1ced2a9909e90",
   "4cb713ce0f9c5a2d42596cddae33f480da14918d7d10d09b794179774da00920"],
];

function files(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const isText = (buf) => !buf.includes(0);

test("the scan sees the repository", () => {
  const rel = files(ROOT).map((f) => path.relative(ROOT, f));
  for (const expected of ["README.md", "LICENSE", "dist/mashrabiya-card.js", "dist/mashrabiya-logic.js", "docs/KIOSK.md", "test/privacy.test.js", "test/privacy-hash.js"]) {
    assert.ok(rel.includes(expected), `scan misses ${expected}`);
  }
});

test("the digest lists are well formed: only 64-hex SHA-256 digests, no duplicates", () => {
  assert.ok(DIGESTS.length >= 43, `${DIGESTS.length} digests`);
  assert.ok(PAIRS.length >= 3, `${PAIRS.length} pairs`);
  const all = [...DIGESTS, ...PAIRS.flat()];
  for (const d of all) assert.match(d, /^[0-9a-f]{64}$/);
  for (const p of PAIRS) assert.equal(p.length, 2);
  assert.equal(new Set(DIGESTS).size, DIGESTS.length);
  assert.equal(new Set(PAIRS.map((p) => p.join())).size, PAIRS.length);
});

test("every token kind fires: a canary of each kind is caught, and only when its digest is listed", () => {
  // A guard nobody has watched fail is not known to work. These canaries are public and harmless; their
  // digests are built here and never added to the lists above, so the repository scan ignores them.
  const canaries = [
    ["sub", "canary.zq_vault_door", "the lock is Lock.Canary.ZQ_Vault_Door_2, see", "sub:canary.zq_vault_door"],
    ["sub", "10.99.", "host at http://10.99.4.7:8123/ ok", "sub:10.99."],
    ["word", "zqx", "talk to ZQX today", "word:zqx"],
    ["pre", "zqan", "Zqanthor said", "pre:zqan"],
    ["pair", "zork glim", "the AZORK GLIMMER unit", "pair:zork glim"],
  ];
  const quiet = scanner(DIGESTS, PAIRS);
  for (const [kind, token, text, want] of canaries) {
    const loud = kind === "pair" ? scanner(DIGESTS, [...PAIRS, pairDigests(token)]) : scanner([...DIGESTS, digest(kind, token)], PAIRS);
    assert.deepEqual(loud(text), [want], `${kind} canary in "${text}"`);
    assert.deepEqual(quiet(text), [], `${kind} canary fired without its digest`);
  }
  // A whole word does not fire inside a longer word, and a pair needs exactly one space.
  assert.deepEqual(scanner([digest("word", "zqx")])("azqxb zqx_1"), []);
  assert.deepEqual(scanner([], [pairDigests("zork glim")])("zork  glim zork-glim zorkglim"), []);
});

test("no file or file name contains private or house-specific details", () => {
  const scan = scanner(DIGESTS, PAIRS);
  const hits = [];
  for (const file of files(ROOT)) {
    const rel = path.relative(ROOT, file);
    for (const h of new Set(scan(rel))) hits.push(`${rel} (file name): ${h}`);
    const buf = fs.readFileSync(file);
    if (!isText(buf)) continue;
    const lines = buf.toString("utf8").split("\n");
    lines.forEach((line, i) => {
      for (const h of new Set(scan(line))) hits.push(`${rel}:${i + 1}: ${h}`);
    });
  }
  assert.deepEqual(hits, []);
});
