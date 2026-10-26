// Records trimmed Scryfall card JSON into src/scryfall/__fixtures__/.
// Run once: node scripts/fetch-scryfall-fixtures.mjs [name ...]  (names = only re-fetch those)
// Etiquette: sequential, >= 600 ms apart, stops on HTTP 429.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/scryfall/__fixtures__/', import.meta.url));

// Keep these lists in sync with ScryfallCard / ScryfallCardFace in src/scryfall/types.ts.
const CARD_KEYS = [
  'id', 'name', 'layout', 'set', 'set_name', 'collector_number', 'rarity',
  'oracle_id', 'scryfall_uri', 'set_type', 'lang', 'games', 'booster', 'digital',
  'image_status', 'mana_cost', 'type_line', 'oracle_text', 'flavor_text', 'power',
  'toughness', 'loyalty', 'defense', 'colors', 'artist', 'printed_name',
  'printed_text', 'printed_type_line', 'image_uris', 'card_faces',
];
const FACE_KEYS = [
  'name', 'oracle_id', 'mana_cost', 'type_line', 'oracle_text', 'flavor_text',
  'power', 'toughness', 'loyalty', 'defense', 'colors', 'artist', 'image_uris',
  'printed_name', 'printed_text', 'printed_type_line',
];

const named = (exact, set) =>
  `/cards/named?${new URLSearchParams({ exact, set }).toString()}`;

const FIXTURES = [
  ['normal', named('Lightning Bolt', 'm10'), 'normal'],
  ['split', named('Fire // Ice', 'mh2'), 'split'],
  ['flip', named('Akki Lavarunner', 'chk'), 'flip'],
  ['adventure', named('Bonecrusher Giant', 'eld'), 'adventure'],
  ['transform', named('Delver of Secrets', 'isd'), 'transform'],
  ['battle', named('Invasion of Zendikar', 'mom'), 'transform'],
  ['mdfc', named('Valakut Awakening', 'znr'), 'modal_dfc'],
  ['meld', named('Bruna, the Fading Light', 'emn'), 'meld'],
  ['saga', named('The Eldest Reborn', 'dom'), 'saga'],
  ['class', named('Wizard Class', 'afr'), 'class'],
  ['planeswalker', named('Liliana of the Veil', 'isd'), 'normal'],
  ['basic', named('Forest', 'neo'), 'normal'],
  ['snow-basic', named('Snow-Covered Forest', 'khm'), 'normal'],
  ['mono-hybrid', named('Spectral Procession', 'shm'), 'normal'],
  ['hybrid-phyrexian', named('Tamiyo, Compleated Sage', 'neo'), 'normal'],
  ['colorless', named('Thought-Knot Seer', 'ogw'), 'normal'],
  ['snow-cost', '/cards/mh1/224', 'normal'],
  ['token', '/cards/tneo/1', 'token'],
  ['dfc-token', '/cards/tfrc/13', 'double_faced_token'],
  ['emblem', '/cards/tfra/18', 'emblem'],
  ['art-series', '/cards/amh1/1', 'art_series'],
  ['reversible', '/cards/sld/1544', 'reversible_card'],
];

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

function trim(card) {
  const out = pick(card, CARD_KEYS);
  if (Array.isArray(card.card_faces)) {
    out.card_faces = card.card_faces.map((f) => pick(f, FACE_KEYS));
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = new Set(process.argv.slice(2));
const todo = FIXTURES.filter(([name]) => only.size === 0 || only.has(name));

await mkdir(OUT, { recursive: true });
let first = true;
let bad = 0;
for (const [name, path, layout] of todo) {
  if (!first) await sleep(650);
  first = false;
  console.log(`GET ${path}`);
  const res = await fetch(`https://api.scryfall.com${path}`, {
    headers: { 'User-Agent': 'CardForgeFixtures/1.0', Accept: 'application/json' },
  });
  if (res.status === 429) {
    throw new Error(`HTTP 429 on ${path}; stopping (do not retry in a loop)`);
  }
  if (!res.ok) {
    console.error(`FAIL ${name}: HTTP ${res.status}`);
    bad++;
    continue;
  }
  const card = trim(await res.json());
  await writeFile(`${OUT}${name}.json`, JSON.stringify(card, null, 2) + '\n');
  const ok = card.layout === layout;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'BAD '} ${name}: layout=${card.layout} expected=${layout}`);
}
if (bad) {
  console.error(`${bad} problem(s)`);
  process.exitCode = 1;
}
