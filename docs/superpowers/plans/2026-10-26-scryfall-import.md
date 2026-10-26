# Scryfall Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import real Magic: The Gathering sets from Scryfall (API or local bulk file) into CardForge's card pool, so they work in the booster simulator, inspect dialog and print sheets.

**Architecture:**
- A new `src/scryfall/` module covers the work from fetching to preview:
  - a rate-limited request queue;
  - a pure Scryfall→`Card` mapper with filters;
  - a pure per-set sync against the existing database;
  - a bulk-file stream reader that runs in a Worker.
- The card database moves from localStorage to IndexedDB (`src/utils/storage.ts`), with a one-time migration.
- Existing modules gain small extensions: new optional `Card` fields, a Scryfall art branch, mana-symbol coverage and attribution. Collation logic is unchanged.

**Tech Stack:** Vite 8, React 19, TypeScript 7, Tailwind 4, jsPDF; new dev dependencies are Vitest 5 and fake-indexeddb 6.

**Spec:** `docs/superpowers/specs/2026-10-26-scryfall-import-design.md` (approved). API facts are in `docs/scryfall-api.md`.

## Global Constraints

- Branch `feat/scryfall-import`. Commit after every task. Never commit `.playwright-mcp/`, `cards/` or `SWTG-BoosterPackMaker/`; stage explicit paths.
- Every task ends green: `npm run lint`, `npm test` and `npm run build` all pass.
- **No new runtime dependencies.** Dev dependencies allowed: `vitest@^5`, `fake-indexeddb@^6`.
- Browser requests never set `User-Agent`; they send `Accept: application/json`.
- Spacing is measured from the previous request's start:
  - **≥ 500 ms** before any `/cards/search`, `/cards/named`, `/cards/random` or `/cards/collection` request;
  - **≥ 100 ms** before any other `api.scryfall.com` request.
- After a 429, pause the whole queue for **30 000 ms**. At most **2** retries per request.
- Image keys: art = `art` → `art_crop`; full = `display` → `large` → `normal`. Never `png`. Dimensions: `art` 626×457, `display` 672×936.
- Every `<img>` that can show card art, and `loadAsJpeg`, uses `crossOrigin="anonymous"`.
- Real card images (`card.scryfall`) are never cropped (the `aspect` crop applies to `art` only), never overlaid with `foil-sheen`, never watermarked.
- New `Card`/`CardFace` fields are optional, so saved databases and the SWTG set stay valid.
- Card id `scry:<scryfall id>`; source `scryfall:<set code, lower-case>`; `setCode` = Scryfall code upper-cased (tokens: the parent's).
- `DESIGN.md` rules:
  - one primary button per view;
  - colours only from `MANA`/`RARITY`;
  - use the `Dialog`/`Button`/`Toast` primitives;
  - 44 px touch targets (`pointer-coarse:min-h-11`);
  - respect reduced motion;
  - sentence-case, plain copy with specific numbers.
- Branding (subtitle, print-back text) unchanged. Imported cards remain printable (owner decision O2); no print gating.

## Review Focus

1. **Import cancelled mid-way.** If the dialog closes or Cancel is pressed during fetching or a 429 pause, no further requests are sent and nothing is merged. Pinned in Task 9 (`client`) and Task 10 (`fetchSetTarget`).
2. **Network failure on a later page.** Page 3 of 3 fails: the import reports the error, keeps no partial result, and leaves the database unchanged. Pinned in Task 10.
3. **Corrupt legacy localStorage database.** Unparseable JSON under `cardforge_custom_cards_v1` must not crash the app or be deleted; the built-in set loads. Pinned in Task 2.
4. **Typed set code with odd input.** `" NEO "` and `"Neo"` resolve to `neo`; an unknown code shows "No Scryfall set with code “xyz”." and doesn't throw an unhandled error. Pinned in Task 10.
5. **Card with no imagery** (`image_status: missing`, no `image_uris`). It imports, renders the pip placeholder, and the PDF uses the generated layout. Pinned in Task 7 (`mapCard`) and Task 12 (`getCardArt`).

---

## Phase 1 — Model, storage, plumbing

### Task 1: Vitest, CI, card model fields, set codes and names

**Files:**
- Modify: `package.json` (scripts `test`, `test:watch`; dev deps), `.github/workflows/deploy.yml` (Node 22, `npm test` before build), `src/types/card.ts`, `src/utils/boosterCollation.ts:90-96`, `src/utils/cardHelpers.ts`, `src/components/CardModal.tsx:29-32`, `src/components/BoosterConfigurator.tsx:286`
- Create: `vitest.config.ts`
- Test: `src/utils/boosterCollation.test.ts`, `src/utils/cardHelpers.test.ts`

**Interfaces:**
- Produces:
  - `CardFace.cost?: string`
  - `interface ScryfallImage { art?: string; full?: string; artBack?: string; fullBack?: string }`
  - `Card.setCode?: string`, `Card.setName?: string`, `Card.collectorNumber?: string`
  - `Card.scryfall?: { id: string; oracleId?: string; uri?: string; layout?: string; image?: ScryfallImage; importedAt: string; userModified?: boolean }`, exactly as spec §6.2
  - `setDisplayName(code: string, cards?: Card[]): string` in `cardHelpers.ts`
  - `getCardSetCode(card)` returns `card.setCode` first

- [ ] **Step 1: Install and configure Vitest.**
  - `npm i -D vitest@^5 fake-indexeddb@^6`.
  - `vitest.config.ts` with `test: { environment: 'node', include: ['src/**/*.test.ts'] }`, reusing the `@` alias from `vite.config.ts`.
  - Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
  - `deploy.yml`: `node-version: 22`, and a `Run tests` step (`npm test`) after `npm ci`. Vitest 5 needs Node ≥ 22.12.
- [ ] **Step 2: Write failing tests.**

```ts
// boosterCollation.test.ts
test('getCardSetCode prefers setCode over source', () => {
  expect(getCardSetCode({ ...base, source: 'swtg-expansion-01-tfa.pdf', setCode: 'NEO' })).toBe('NEO');
  expect(getCardSetCode({ ...base, source: 'swtg-expansion-01-tfa.pdf' })).toBe('TFA');
});
test('listCardSets groups imported cards by setCode', () => {
  expect(listCardSets([{ ...base, setCode: 'TST' }, { ...base, id: '2', setCode: 'TST' }])).toEqual([{ code: 'TST', count: 2 }]);
});
// cardHelpers.test.ts
test('setDisplayName: static name, then card setName, then code', () => {
  expect(setDisplayName('TFA')).toBe('The Force Awakens');
  expect(setDisplayName('NEO', [{ ...base, setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty' }])).toBe('Kamigawa: Neon Dynasty');
  expect(setDisplayName('XYZ', [])).toBe('XYZ');
});
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL (`setCode` is ignored; `setDisplayName` isn't defined).
- [ ] **Step 4: Implement.**
  - Add the type fields.
  - Make the first line of `getCardSetCode` `if (card.setCode) return card.setCode;`.
  - Add `setDisplayName`.
  - Replace `SET_NAMES[...] ?? code` with `setDisplayName(code, cards)` in `CardModal`. CardModal has no `cards` prop, so use `setDisplayName(setCode, [card])`.
  - Do the same in `BoosterConfigurator`, which already has `cards`.
- [ ] **Step 5: Run `npm run lint && npm test && npm run build`.** Expected: all pass.
- [ ] **Step 6: Commit** `feat: card set fields, setDisplayName, Vitest + CI test step`.

### Task 2: IndexedDB key-value store with legacy migration and fallback

**Files:**
- Create: `src/utils/storage.ts`
- Test: `src/utils/storage.test.ts`

**Interfaces:**
- Produces:
  - `interface KeyValueStore { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; delete(key: string): Promise<void> }`
  - `openIdbStore(factory: IDBFactory, dbName?: string): Promise<KeyValueStore>`: database `cardforge`, version 1, object store `kv`.
  - `localStorageStore(storage: Storage): KeyValueStore`: `cards` and `cardSetVersion` map to the legacy keys `cardforge_custom_cards_v1` and `cardforge_card_set_version`; other keys map to `cardforge_cache_<key>`. Values are JSON, except the version, which is stored as `String(n)` (matching today's format).
  - `migrateLegacy(target: KeyValueStore, storage: Storage): Promise<'migrated' | 'none' | 'kept-legacy'>`
  - `interface CardStore { kind: 'indexeddb' | 'localstorage'; load(): Promise<{ cards: Card[] | null; version: number }>; save(cards: Card[], version: number): Promise<void>; getCache<T>(key: string, maxAgeMs: number): Promise<T | undefined>; setCache(key: string, value: unknown): Promise<void> }`
  - `openCardStore(deps?: { indexedDB?: IDBFactory | null; localStorage?: Storage }): Promise<CardStore>`. Defaults are `globalThis.indexedDB` and `globalThis.localStorage`.

- [ ] **Step 1: Write failing tests.** Each test gets a fresh `new IDBFactory()` from `fake-indexeddb` and an in-memory `Storage` stub defined in the test file.
  - `'round-trips cards and version through IndexedDB'`: `save([card], 2)` then `load()` → `{ cards: [card], version: 2 }`; `kind === 'indexeddb'`.
  - `'migrates a legacy localStorage database and removes the legacy keys'`:
    - Setup: localStorage has `cardforge_custom_cards_v1 = JSON.stringify([card])` and `cardforge_card_set_version = '2'`.
    - `load()` → `{ cards: [card], version: 2 }`.
    - Afterwards both legacy keys are `null`.
  - `'keeps legacy keys when the IndexedDB write fails'`: `migrateLegacy` with a `KeyValueStore` whose `set` rejects → returns `'kept-legacy'`, and the legacy keys are still present.
  - `'leaves an unparseable legacy database in place'` (Review Focus 3): the legacy value is `'{not json'` → `load()` resolves `{ cards: null, version: 1 }` and the legacy key is unchanged.
  - `'falls back to localStorage when IndexedDB is unavailable'`: `openCardStore({ indexedDB: null, localStorage })` gives `kind === 'localstorage'`, and save then load round-trips through the legacy keys.
  - `'save rejects with the storage error'`: the stub's `setItem` throws `new DOMException('full', 'QuotaExceededError')` → `save` rejects with a `name` of `'QuotaExceededError'`.
  - `'getCache returns undefined once the entry is older than maxAgeMs'`:
    - Cache entries are stored as `{ savedAt: number, value }`.
    - Mock `Date.now` with `vi.spyOn(Date, 'now')`.
- [ ] **Step 2: Run `npm test -- storage`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `storage.ts`.**
  - Wrap IDB requests in promises.
  - `openCardStore` tries IndexedDB and runs `migrateLegacy` inside `load()` the first time. Any open failure means localStorage.
  - Serialise `save` calls: each save awaits the previous one, and a save superseded by a newer pending one is skipped.
- [ ] **Step 4: Run `npm test -- storage`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: IndexedDB card store with localStorage migration and fallback`.

### Task 3: Async database load and save in App

**Files:**
- Create: `src/utils/cardDatabase.ts`
- Modify: `src/App.tsx:21-131`
- Test: `src/utils/cardDatabase.test.ts`

**Interfaces:**
- Consumes: `openCardStore`, `CardStore` (Task 2).
- Produces:
  - `CARD_SET_VERSION = 2` and `isSetCard(card)`, both moved from `App.tsx`.
  - `resolveLoadedCards(saved: Card[] | null, version: number): { cards: Card[]; keptCustom: number | null }`: the body of today's `loadCards` minus storage access.

- [ ] **Step 1: Write failing tests.**
  - `'returns the built-in set when nothing is saved'` → `{ cards: STAR_WARS_SET.cards, keptCustom: null }`.
  - `'keeps saved cards when the version matches'`.
  - `'rebases custom and Scryfall cards onto the new set when the version is older'`:
    - Input: version 1, saved = [swtg card, custom card, `scryfall` card with `source: 'scryfall:neo'`].
    - Expected: `keptCustom === 2`, and the result contains the custom and scryfall cards plus `STAR_WARS_SET.cards`.
- [ ] **Step 2: Run `npm test -- cardDatabase`.** Expected: FAIL.
- [ ] **Step 3: Implement `cardDatabase.ts`; rewire `App`.**
  - Add `const [store, setStore] = useState<CardStore | null>(null)` and `const [cards, setCards] = useState<Card[]>([])` with a `loaded` flag.
  - On mount: `openCardStore()` → `load()` → `resolveLoadedCards` → `setCards`; set `loaded`; show the rebase toast when `keptCustom !== null`; then generate the initial box.
  - The initial box is generated only after the load. Replace the mount-only `handleGeneratePacks()` effect with one that fires once `loaded` becomes true.
  - Save effect on `[cards]`: skip while `!loaded`; call `store.save(cards, CARD_SET_VERSION)`. On rejection, show one error toast per failure streak (a ref resets on the next successful save). Copy: "Couldn’t save your card database (<error name>). Your changes stay in this tab until you reload."
  - Config and sound keep `readStorage`/`writeStorage`.
  - Until `loaded`, `<main>` renders a quiet loading line, "Loading your card database…", using `text-sm text-fg-muted`.
- [ ] **Step 4: Run `npm run lint && npm test && npm run build`.** Expected: pass.
- [ ] **Step 5: Manual check** (`npm run dev`, Playwright on :3000).
  - In DevTools, set localStorage `cardforge_custom_cards_v1` to a 2-card array and `cardforge_card_set_version` to `2`, then reload.
  - Expected: 2 cards shown, the legacy keys are gone, and IndexedDB `cardforge/kv` holds `cards`.
  - Reload again: still 2 cards.
- [ ] **Step 6: Commit** `feat: load and save the card database through IndexedDB`.

### Task 4: Per-set sync of imported cards

**Files:**
- Create: `src/scryfall/merge.ts`
- Test: `src/scryfall/merge.test.ts`

**Interfaces:**
- Produces:
  - `interface SyncResult { cards: Card[]; imported: number; added: number; updated: number; unchanged: number; protected: number; removed: number }`
  - `syncImported(existing: Card[], incoming: Card[], setCodes: string[]): SyncResult`. Rules are in spec §6.7.
    - Scope = cards with `scryfall` whose `setCode` is in `setCodes`.
    - Equality ignores `scryfall.importedAt`.
    - Updated cards keep their index; added cards are appended.
  - `removeImportedSet(cards: Card[], setCode: string): { cards: Card[]; removed: number }`: removes every card in scope, edited ones included.
  - `listImportedSets(cards: Card[]): { code: string; name: string; count: number }[]`: name from `setDisplayName`, in first-seen order.
  - `markUserModified(card: Card): Card`: returns the card unchanged when there's no `scryfall`; otherwise `scryfall.userModified = true`.
  - `describeSync(result: SyncResult, label: string): string`

- [ ] **Step 1: Write failing tests.** Helper: `sc(id, set, text?)` builds a minimal Scryfall-sourced `Card`.
  - `'first import adds every card'`: `added === 3`, `imported === 3`.
  - `'identical re-import is unchanged even with a new importedAt'`: `unchanged === 3`, `cards` is deep-equal to `existing`.
  - `'changed text updates in place'`: index preserved, `updated === 1`.
  - `'protected card is kept on re-import'`: an existing card with `userModified` and different text → the stored version is kept and `protected === 1`.
  - `'filter change shrinks the set'`: existing NEO 5 cards, incoming 3 → `removed === 2`.
  - `'deleted card returns'`: existing lacks id `scry:b`, incoming has it → `added === 1`.
  - `'edited card outside the result is kept'`: `userModified` and not incoming → still present, `protected === 1`, `removed === 0`.
  - `'other sets, SWTG and custom cards are untouched'`.
  - `'removeImportedSet removes edited cards too'`.
  - `'describeSync omits zero counts'`:

```ts
expect(describeSync({ ...zero, imported: 302, updated: 12, protected: 2 }, 'Kamigawa: Neon Dynasty'))
  .toBe('Imported 302 cards from Kamigawa: Neon Dynasty (12 updated, 2 kept because you edited them)');
expect(describeSync({ ...zero, imported: 5, removed: 1 }, 'NEO')).toBe('Imported 5 cards from NEO (1 removed)');
expect(describeSync({ ...zero, imported: 5 }, 'NEO')).toBe('Imported 5 cards from NEO');
```

- [ ] **Step 2: Run `npm test -- merge`.** Expected: FAIL.
- [ ] **Step 3: Implement `merge.ts`.** For equality, compare `JSON.stringify` with `importedAt` blanked. The mapper (Task 7) emits a stable key order. Count order in `describeSync`: updated, removed, protected.
- [ ] **Step 4: Run `npm test -- merge`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: per-set sync of imported cards`.

### Task 5: Lossless JSON import and edit protection

**Files:**
- Create: `src/utils/cardImport.ts`
- Modify: `src/components/CardDatabase.tsx:105-131` (use `normalizeImportedCard`), `src/components/CardEditorDialog.tsx:71-72` (wrap the saved card in `markUserModified`)
- Test: `src/utils/cardImport.test.ts`

**Interfaces:**
- Consumes: `markUserModified` (Task 4), `determineColors`.
- Produces: `normalizeImportedCard(item: Record<string, unknown>, index: number, now?: number): Card`.
  - Today's string coercions and defaults stay.
  - It also keeps: `backFace` (when `name` and `type` are strings; including `cost`), `artKey`, `customImageUrl`, `setCode`, `setName`, `collectorNumber` (strings), and `scryfall` (when `scryfall.id` and `scryfall.importedAt` are strings).
  - It keeps `colors` when it's a non-empty array of valid `CardColor`; otherwise `determineColors(cost, type)`.

- [ ] **Step 1: Write failing tests.**
  - `'keeps backFace with cost, artKey, customImageUrl, set fields and scryfall'`.
  - `'keeps valid colors and recomputes invalid ones'`: `['Multicolor','U','R']` is kept; `['purple']` becomes `determineColors`.
  - `'drops a malformed scryfall object'`: a `{ uri: 'x' }` without `id` → `scryfall` is undefined.
  - `'export then import round-trips a Scryfall card'`: `normalizeImportedCard(JSON.parse(JSON.stringify(card)), 0)` deep-equals `card`.
- [ ] **Step 2: Run `npm test -- cardImport`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Wire both components.
- [ ] **Step 4: Run `npm run lint && npm test && npm run build`.** Expected: pass.
- [ ] **Step 5: Commit** `fix: lossless JSON import; protect edited imported cards`.

**Phase 1 exit:**
- SWTG flows behave as before: generate a box, inspect, edit, delete with Undo, print one sheet.
- Importing a JSON file containing one `{ setCode: 'TST', … }` card shows a "TST" set chip in the configurator.

---

## Phase 2 — Mapper

### Task 6: Scryfall types and fixtures

**Files:**
- Create: `src/scryfall/types.ts`, `scripts/fetch-scryfall-fixtures.mjs`, `src/scryfall/__fixtures__/*.json`

**Interfaces:**
- Produces, in `types.ts`:
  - `ScryfallImageUris`: optional `art`, `display`, `grid`, `thumb`, `crop`, `jpeg`, `small`, `normal`, `large`, `png`, `art_crop`, `border_crop`.
  - `ScryfallCardFace`
  - `ScryfallCard`
  - `ScryfallSet`
  - `ScryfallList<T>`
  - `ScryfallErrorBody`
  - Field lists are in the reference doc and spec §6.3/§6.5. Every field except `id`, `name`, `layout`, `set`, `set_name`, `collector_number` and `rarity` is optional.

- [ ] **Step 1: Write `types.ts`.**
- [ ] **Step 2: Write the fixture script.**
  - Node 22 global `fetch`.
  - `User-Agent: CardForgeFixtures/1.0`, `Accept: application/json`.
  - Sequential requests, 600 ms apart.
  - Trim each card to the fields in `ScryfallCard`.
  - Write `src/scryfall/__fixtures__/<name>.json`.
  - Fixtures, all verified to exist on 2026-10-26:

| file | request | layout |
|---|---|---|
| `normal` | `/cards/named?exact=Lightning Bolt&set=m10` | normal |
| `split` | `/cards/named?exact=Fire // Ice&set=mh2` | split |
| `flip` | `/cards/named?exact=Akki Lavarunner&set=chk` | flip |
| `adventure` | `/cards/named?exact=Bonecrusher Giant&set=eld` | adventure |
| `transform` | `/cards/named?exact=Delver of Secrets&set=isd` | transform |
| `battle` | `/cards/named?exact=Invasion of Zendikar&set=mom` | transform |
| `mdfc` | `/cards/named?exact=Valakut Awakening&set=znr` | modal_dfc |
| `meld` | `/cards/named?exact=Bruna, the Fading Light&set=emn` | meld |
| `saga` | `/cards/named?exact=The Eldest Reborn&set=dom` | saga |
| `class` | `/cards/named?exact=Wizard Class&set=afr` | class |
| `planeswalker` | `/cards/named?exact=Liliana of the Veil&set=isd` | normal |
| `basic` | `/cards/named?exact=Forest&set=neo` | normal |
| `snow-basic` | `/cards/named?exact=Snow-Covered Forest&set=khm` | normal |
| `mono-hybrid` | `/cards/named?exact=Spectral Procession&set=shm` | normal |
| `hybrid-phyrexian` | `/cards/named?exact=Tamiyo, Compleated Sage&set=neo` | normal |
| `colorless` | `/cards/named?exact=Thought-Knot Seer&set=ogw` | normal |
| `snow-cost` | `/cards/mh1/224` (Icehide Golem, `{S}`) | normal |
| `token` | `/cards/tneo/1` | token |
| `dfc-token` | `/cards/tfrc/13` | double_faced_token |
| `emblem` | `/cards/tfra/18` | emblem |
| `art-series` | `/cards/amh1/1` | art_series |
| `reversible` | `/cards/sld/1544` | reversible_card |

- [ ] **Step 3: Run `node scripts/fetch-scryfall-fixtures.mjs`.** Expected: 22 files, and each one's `layout` matches the table.
- [ ] **Step 4: Run `npm run lint`.** Expected: pass.
- [ ] **Step 5: Commit** `test: Scryfall types and recorded card fixtures`.

### Task 7: `mapCard`

**Files:**
- Create: `src/scryfall/mapCard.ts`
- Test: `src/scryfall/mapCard.test.ts` (with `__snapshots__`)

**Interfaces:**
- Consumes: the Task 6 types, `Card`.
- Produces:
  - `interface MapContext { setCode: string; setName: string; importedAt: string }`: the caller passes the parent set's code and name for tokens.
  - `mapCard(card: ScryfallCard, ctx: MapContext): Card | null`
  - `isDoubleSided(card: ScryfallCard): boolean`: true when `card_faces?.[0]?.image_uris` exists and the root has no `image_uris`.
  - `KNOWN_LAYOUTS: ReadonlySet<string>`: normal, split, flip, transform, modal_dfc, meld, leveler, class, case, saga, adventure, mutate, prototype, battle, token, double_faced_token, emblem, augment, host, reversible_card, prepare.
  - `SKIPPED_LAYOUTS`: `art_series`, `vanguard`, `planar`, `scheme`.
- Mapping rules: spec §6.3, verbatim. Key order of the output object must be stable (Task 4 equality relies on it).

- [ ] **Step 1: Write failing tests.** One `test` per fixture, with these assertions plus `expect(card).toMatchSnapshot()`. `ctx = { setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty', importedAt: '2026-10-26T00:00:00.000Z' }`, except the token/emblem cases, which use `{ setCode: 'NEO', … }` as the parent.
  - `normal`:
    - `id === 'scry:' + fixture.id`, `name 'Lightning Bolt'`, `cost '{R}'`, `rarity 'C'`, `colors ['R']`;
    - `source 'scryfall:m10'`, `collectorNumber '146'`;
    - `scryfall.image.art` ends with `.webp` and contains `/art/`;
    - `scryfall.image.full` contains `/display/`.
  - `split`: `name 'Fire'`, `cost '{1}{R}'`, `backFace { name: 'Ice', cost: '{1}{U}' }`, `colors ['Multicolor','U','R']`. Order the colours the way `determineColors` does: W,U,B,R,G after `'Multicolor'`. `scryfall.image.fullBack` is undefined.
  - `flip`, `adventure`: `backFace` is present; `image.full` comes from the root.
  - `transform`:
    - `name 'Delver of Secrets'`, `cost '{U}'`, `powerToughness '1/1'`;
    - `backFace.name 'Insectile Aberration'`, `backFace.powerToughness '3/2'`;
    - `image.fullBack` contains `/display/back/`.
  - `battle`: `powerToughness` comes from `defense` (`'4'`), and the back is present.
  - `mdfc`: the back `cost` is the second face's `mana_cost`.
  - `planeswalker`: `powerToughness === '3'` (loyalty).
  - `basic`, `snow-basic`: `rarity 'L'`, `colors ['Colorless']`.
  - `token`, `emblem`, `dfc-token`: `rarity 'T'`, `setCode 'NEO'`, `setName 'Kamigawa: Neon Dynasty'`.
  - `art-series`: `mapCard` returns `null`.
  - `reversible`: the back is present; `oracleId` comes from face 0.
  - `'single-face colors match determineColors shape'`: for every single-face fixture, `card.colors` deep-equals `determineColors(card.cost, card.type)` whenever the cost holds every colour.
  - `'maps a card with no images'` (Review Focus 5): `normal` with `image_uris` deleted and `image_status: 'missing'` → `scryfall.image` is undefined; `name` and `cost` are intact.
  - `'never uses the combined split cost'`: no mapped card's `cost` contains `' // '`.
- [ ] **Step 2: Run `npm test -- mapCard`.** Expected: FAIL.
- [ ] **Step 3: Implement `mapCard.ts`.**
- [ ] **Step 4: Run `npm test -- mapCard`.** Expected: PASS. Review the written snapshots by eye before committing.
- [ ] **Step 5: Commit** `feat: map Scryfall cards to CardForge cards`.

### Task 8: Import filters

**Files:**
- Create: `src/scryfall/filters.ts`
- Test: `src/scryfall/filters.test.ts`

**Interfaces:**
- Produces:
  - `interface ImportOptions { boosterOnly: boolean; includeTokens: boolean }`
  - `DEFAULT_IMPORT_OPTIONS: ImportOptions = { boosterOnly: true, includeTokens: false }`
  - `shouldImport(card: ScryfallCard, opts: ImportOptions, isToken: boolean): boolean`:
    - false when `games` is present and lacks `'paper'`;
    - for main-set cards, false when `opts.boosterOnly && card.booster !== true`;
    - token-set cards ignore `boosterOnly`.

- [ ] **Step 1: Write failing tests.**
  - `'boosterOnly keeps booster cards only'`.
  - `'boosterOnly off keeps non-booster printings'`.
  - `'tokens ignore boosterOnly'`.
  - `'digital-only cards are excluded'`: `games: ['arena']` → false.
  - `'cards without a games field are kept'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: Scryfall import filters`.

**Phase 2 exit:** `npm test` is green with every fixture mapped.

---

## Phase 3 — API import

### Task 9: Rate-limited Scryfall client

**Files:**
- Create: `src/scryfall/client.ts`
- Test: `src/scryfall/client.test.ts`

**Interfaces:**
- Produces:
  - `class ScryfallApiError extends Error { status: number; code?: string }`. Its message is the Scryfall `details` field when present.
  - `type ClientStatus = { kind: 'ok' } | { kind: 'rate-limited'; resumeAt: number }`
  - `interface ClientDeps { fetch?: typeof fetch; now?: () => number; sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; onStatus?: (s: ClientStatus) => void }`
  - `spacingFor(url: string): 500 | 100`
  - `createClient(deps?: ClientDeps): ScryfallClient` with:
    - `get<T>(pathOrUrl: string, signal?: AbortSignal): Promise<T>`
    - `getAll<T>(pathOrUrl: string, signal?: AbortSignal, onPage?: (fetched: number, total?: number) => void): Promise<T[]>`
    - `setStatusListener(fn?: (s: ClientStatus) => void): void`
  - `scryfall: ScryfallClient`: the app-wide singleton, `createClient()`.
- Behaviour:
  - One serial queue.
  - Relative paths are prefixed with `https://api.scryfall.com`.
  - Headers are exactly `{ Accept: 'application/json' }`.
  - `getAll` follows `next_page` while `has_more`; it treats a 404 on `/cards/search` as `[]`.
  - Abort rejects with `DOMException` `AbortError` and cancels a pending sleep.

- [ ] **Step 1: Write failing tests.** Use an injected fake `now`/`sleep`; `sleep` advances `now` and records the durations. Use an injected `fetch` that returns queued `Response`s.
  - `'spaces /cards/search requests at least 500 ms apart'`: two `get('/cards/search?q=a')` calls → recorded sleeps sum to ≥ 500 before the 2nd request.
  - `'spaces other requests 100 ms apart'`: `/sets/neo` twice → ≥ 100.
  - `'sends Accept and no User-Agent'`: `init.headers` deep-equals `{ Accept: 'application/json' }`.
  - `'pauses 30 s after a 429 and retries'`: responses 429 then 200 → a 30 000 ms sleep is recorded, the result resolves, and `onStatus` received `rate-limited` then `ok`.
  - `'gives up after 2 retries'`: three 429s → rejects with a `ScryfallApiError` with `status 429`.
  - `'follows next_page until has_more is false'`: page 1 `{has_more:true,next_page:URL2}`, page 2 `{has_more:false}` with no `next_page` key → concatenated data; `onPage` called with `(n, total_cards)`.
  - `'returns an empty list for a 404 on /cards/search'`.
  - `'throws ScryfallApiError with details for other errors'`: a 404 from `/sets/xyz` with body `{object:'error',status:404,code:'not_found',details:'No set found'}` → message `'No set found'`.
  - `'aborting during a 429 pause rejects with AbortError and sends no further request'` (Review Focus 1).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: rate-limited Scryfall client`.

### Task 10: Set import orchestration

**Files:**
- Create: `src/scryfall/importSet.ts`
- Test: `src/scryfall/importSet.test.ts`

**Interfaces:**
- Consumes: `ScryfallClient` (Task 9), `CardStore.getCache`/`setCache` (Task 2), `mapCard`/`KNOWN_LAYOUTS` (Task 7), `shouldImport`/`ImportOptions` (Task 8), `syncImported`/`SyncResult` (Task 4).
- Produces:
  - `IMPORTABLE_SET_TYPES = ['core','expansion','masters','draft_innovation','funny']`
  - `getSetList(client, cache: Pick<CardStore,'getCache'|'setCache'>, signal?): Promise<ScryfallSet[]>`: cache key `scryfallSets`, max age `86_400_000`.
  - `importableSets(sets: ScryfallSet[]): ScryfallSet[]`: not `digital`, type in the list above, sorted by `released_at` descending.
  - `normalizeSetCode(input: string): string`: trims and lower-cases.
  - `tokenSetFor(code: string, sets: ScryfallSet[]): ScryfallSet | undefined`: matches `parent_set_code === code && set_type === 'token'`.
  - `interface ImportTarget { code: string; name: string; cards: ScryfallCard[]; tokens: ScryfallCard[] }`
  - `fetchSetTarget(input: string, opts: ImportOptions, deps: { client: ScryfallClient; sets: ScryfallSet[]; signal?: AbortSignal; onProgress?: (fetched: number, total?: number) => void }): Promise<ImportTarget>`:
    - Resolves the set from `sets`, else from `GET /sets/<code>`. On a 404, throws `ScryfallApiError` with message `No Scryfall set with code “<code>”.`
    - Fetches `/cards/search?q=e:<code>&unique=prints&order=set`.
    - Fetches the token set the same way when `opts.includeTokens`.
  - `interface ImportPreview { targets: { code: string; name: string }[]; incoming: Card[]; byRarity: Record<Rarity, number>; skipped: number; warnings: string[]; sync: SyncResult }`
  - `buildPreview(targets: ImportTarget[], opts: ImportOptions, existing: Card[], importedAt: string): ImportPreview`:
    - Pure.
    - Applies `shouldImport`, then `mapCard` with `setCode = target.code.toUpperCase()` and `setName = target.name`; tokens use the same parent context.
    - `skipped` counts `null` results.
    - Warning when unknown layouts were seen: `"<n> cards have an unfamiliar layout (<layouts>) and were imported as normal cards."`
    - `sync = syncImported(existing, incoming, targets.map(t => t.code.toUpperCase()))`.

- [ ] **Step 1: Write failing tests.** Use a stub client (a Map from URL to data or error) and fixtures from Task 6.
  - `'importableSets filters digital and non-booster set types'`.
  - `'getSetList uses the cache for 24 h'`: the second call makes no client request.
  - `'normalizes typed set codes'` (Review Focus 4): `' NEO '` → `'neo'`, and the request URL contains `e:neo`.
  - `'unknown set code gives a clear error'` (Review Focus 4): the message is `No Scryfall set with code “xyz”.`
  - `'fetches tokens from the token set when requested'`.
  - `'rejects and keeps nothing when a later page fails'` (Review Focus 2): page 2 errors → rejects; a caller-side `buildPreview` is never reached. Assert no partial target is returned.
  - `'aborting stops further requests'` (Review Focus 1).
  - `'buildPreview counts rarities, skips art series and warns on unknown layouts'`.
  - `'buildPreview assigns tokens to the parent set'`: the token's `setCode` is `'NEO'`.
  - `'buildPreview sync reports removals for a narrower re-import'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: Scryfall set import orchestration and preview`.

### Task 11: Import dialog (API tab), imported-sets list, entry point

**Files:**
- Create: `src/components/ScryfallImportDialog.tsx`
- Modify:
  - `src/components/CardDatabase.tsx`: new prop `onOpenScryfallImport: () => void`, and a secondary "Import from Scryfall" button before "Import JSON".
  - `src/App.tsx`: dialog state; `handleApplyImport`; `handleRemoveImportedSet`.

**Interfaces:**
- Consumes: Tasks 4, 8, 9 and 10. The `store` comes from App (Task 3).
- Produces: `ScryfallImportDialog` props `{ cards: Card[]; cache: Pick<CardStore,'getCache'|'setCache'>; onApply: (result: SyncResult, label: string) => void; onRemoveSet: (code: string) => void; onClose: () => void }`.
  - `App.handleApplyImport` calls `setCards(result.cards)` and shows the toast `describeSync(result, label)` with Undo, `duration: 8000`.
  - `App.handleRemoveImportedSet(code)` uses `removeImportedSet`, with toast ``Removed ${n} cards from ${setDisplayName(code, cards)}.`` and Undo.

- [ ] **Step 1: Build the dialog** (spec §6.6). Use `Dialog`, heading "Import from Scryfall".
  - **Set combobox:** an `<input role="combobox">` with a listbox over `importableSets` (code, name, release year, `icon_svg_uri` as a decorative `<img>`). Typing a code not in the list is allowed.
  - **Option checkboxes:** "Booster cards only" and "Include tokens".
  - **Buttons:** a secondary "Fetch cards" button.
  - **Fetching state:**
    - progress text "Fetched <n> of <total> cards";
    - a Cancel button that aborts;
    - the client status listener shows "Scryfall asked us to slow down, resuming in <s> s";
    - errors appear inline with `tone` error styling.
  - **Preview:**
    - rarity counts using `RARITY`;
    - the sync counts (new = `added`, plus `updated`, `unchanged`, `removed`, `protected`), zeros hidden;
    - `skipped` and the warnings;
    - a strip of up to 8 `CardItem` thumbnails.
  - **Primary "Add <n> cards"** (the dialog's single primary button) → `onApply(preview.sync, setName)` → close.
  - **Imported sets section:** from `listImportedSets(cards)`, each row shows name, count and a "Remove" danger-ghost button.
  - **Unmount** aborts any in-flight import.
- [ ] **Step 2: Wire App and CardDatabase.**
- [ ] **Step 3: Run `npm run lint && npm test && npm run build`.** Expected: pass.
- [ ] **Step 4: Manual check** (`npm run dev`, Playwright):
  1. Import `neo` with defaults: the preview shows 302 cards, and C/U/R/M/L counts add up to 302.
  2. Confirm: the toast reads "Imported 302 cards from Kamigawa: Neon Dynasty". The configurator shows a "Kamigawa: Neon Dynasty (302)" chip.
  3. Import `neo` again: everything is unchanged.
  4. Untick "Booster cards only" and import: the preview shows 514 incoming and 212 new.
  5. Tick it again and import: 212 removed.
  6. Select only NEO and generate: the packs contain only NEO cards.
  7. Remove NEO: its cards are gone. Undo: they're back.
  8. The network tab shows no two `/cards/search` requests less than 500 ms apart.
- [ ] **Step 5: Commit** `feat: Scryfall set import dialog`.

**Phase 3 exit:** steps 1–8 above pass.

---

## Phase 4 — Rendering & print

### Task 12: Scryfall art, cross-origin images, sheen rule, PDF fix

**Files:**
- Modify:
  - `src/utils/cardArt.ts:44-75`: Scryfall branch after `customImageUrl` and before the land and manifest lookups.
  - `src/components/CardItem.tsx:70-100`: `crossOrigin`; no `foil-sheen` when `card.scryfall`; for foil Scryfall cards, a frame ring `ring-2 ring-foil/70` replaces the overlay, and the "Foil" badge stays.
  - `src/components/CardModal.tsx`, `src/components/PrintSheetModal.tsx:208`: `crossOrigin`.
  - `src/utils/pdfGenerator.ts:31`: `img.crossOrigin = 'anonymous'` before `img.src`.
- Test: `src/utils/cardArt.test.ts`

**Interfaces:**
- Consumes: `Card.scryfall.image` (Task 1).
- Produces: `getCardArt` returns `{ src: art ?? full, width: 626, height: 457, fullSrc: full, fullWidth: 672, fullHeight: 936, fullBackSrc: fullBack }`. `width`/`height` are omitted when `art` is missing.

- [ ] **Step 1: Write failing tests.**
  - `'prefers customImageUrl over scryfall images'`.
  - `'returns scryfall art, display scan and back scan with dimensions'`.
  - `'uses scryfall images for basic lands instead of manifest variants'`: a card with `rarity 'L'`, name `Forest` and `scryfall.image` → `src === image.art`.
  - `'falls back to the full image when art is missing'`.
  - `'returns null for a scryfall card without images'` (Review Focus 5).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** all the file changes above. **Step 4: Run `npm run lint && npm test && npm run build`** → pass.
- [ ] **Step 5: Manual check.**
  - With NEO imported: thumbnails show art, and a mythic shows the ring but no sheen.
  - In the inspect dialog, a DFC shows its display scan and "Show other face" works.
  - Print 1 sheet in "Original card scans" mode and 1 in "Generated layout" mode. Open both PDFs: Scryfall art is present in both, and the scans aren't cropped (artist and © line visible).
- [ ] **Step 6: Commit** `feat: render and print Scryfall images`.

### Task 13: Inspect dialog attribution, back-face toggle, footer notice

**Files:**
- Modify:
  - `src/components/CardModal.tsx`
  - `src/App.tsx` footer: render the notice when `cards.some(c => c.scryfall)`.

**Interfaces:**
- Consumes: `Card.scryfall.uri`, `Card.backFace.cost` (Task 1).

- [ ] **Step 1: Implement.**
  - **Attribution:** for `card.scryfall`, the artist line reads `Illustrated by <artist> · © Wizards of the Coast`, followed by a "View on Scryfall" link (`target="_blank" rel="noreferrer"`) to `scryfall.uri`.
  - **Back-face toggle:** show the "Show other face" button whenever `card.backFace` exists. When there's no `fullSrc`, it toggles the text panel and renders `CardItem` with the back face's fields merged in.
  - **Back-face cost:** when turned over, the header shows `backFace.cost`.
  - **Footer copy** (exact):

> Magic: The Gathering card data and images via Scryfall. CardForge is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

- [ ] **Step 2: Run `npm run lint && npm run build`** → pass.
- [ ] **Step 3: Manual check.**
  - Fire // Ice shows "Show other face" and Ice's cost when turned over.
  - Valakut Awakening shows the back scan.
  - The footer notice appears only after an import and disappears after "Remove".
- [ ] **Step 4: Commit** `feat: Scryfall attribution and back-face toggle`.

### Task 14: Mana symbol coverage

**Files:**
- Modify: `src/components/ManaCost.tsx`
- Test: `src/utils/manaSymbols.test.ts`. Move the pure helpers to `src/utils/manaSymbols.ts`; `ManaCost.tsx` imports them and keeps exporting `ManaSymbol` and `ManaCost` (`RulesText`, `CardItem` and `CardModal` import from it).

**Interfaces:**
- Produces, in `src/utils/manaSymbols.ts`:
  - `parseCost` (moved, unchanged behaviour)
  - `symbolName` (moved, extended)
  - `type SymbolShape = { kind: 'color'; color: 'W'|'U'|'B'|'R'|'G' } | { kind: 'generic'; text: string } | { kind: 'hybrid'; a: string; b: string } | { kind: 'mono-hybrid'; generic: string; color: string } | { kind: 'phyrexian'; color: string } | { kind: 'hybrid-phyrexian'; a: string; b: string } | { kind: 'tap' } | { kind: 'untap' } | { kind: 'colorless' } | { kind: 'snow' } | { kind: 'other'; text: string }`
  - `symbolShape(symbol: string): SymbolShape`
  - `ManaSymbol` renders from `symbolShape`. `var(--color-mana-x)` is used only for W/U/B/R/G. `other` with text longer than 2 characters renders a generic pip showing the first letter, with the full name as its accessible label.

- [ ] **Step 1: Write failing tests.**

```ts
expect(symbolShape('2/W')).toEqual({ kind: 'mono-hybrid', generic: '2', color: 'W' });
expect(symbolShape('W/U/P')).toEqual({ kind: 'hybrid-phyrexian', a: 'W', b: 'U' });
expect(symbolShape('G/P')).toEqual({ kind: 'phyrexian', color: 'G' });
expect(symbolShape('C')).toEqual({ kind: 'colorless' });
expect(symbolShape('S')).toEqual({ kind: 'snow' });
expect(symbolShape('½')).toEqual({ kind: 'generic', text: '½' });
expect(symbolShape('CHAOS')).toEqual({ kind: 'other', text: 'CHAOS' });
expect(symbolName('2/W')).toBe('2 generic or white mana');
expect(symbolName('W/U/P')).toBe('white or blue Phyrexian mana');
expect(symbolName('S')).toBe('snow mana');
expect(symbolName('½')).toBe('half generic mana');
expect(symbolName('∞')).toBe('infinite generic mana');
expect(symbolName('CHAOS')).toBe('CHAOS symbol');
expect(symbolName('W/U')).toBe('white or blue mana');            // unchanged
expect(parseCost('{2}{G}{G/U/P}{U}')).toEqual(['2', 'G', 'G/U/P', 'U']);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run `npm run lint && npm test && npm run build`** → pass.
- [ ] **Step 5: Manual check.** Spectral Procession, Tamiyo, Thought-Knot Seer and Icehide Golem render correct pips in the grid and in the inspect dialog. To test cards outside NEO, use a JSON import of their mapped fixtures.
- [ ] **Step 6: Commit** `feat: full mana symbol coverage`.

**Phase 4 exit:** DFC, split, adventure, planeswalker and hybrid cards look right in the grid, inspect dialog, pack opening and PDF.

---

## Phase 5 — Bulk file import

### Task 15: Bulk stream reader and set scan/collect

**Files:**
- Create: `src/scryfall/bulkStream.ts`
- Test: `src/scryfall/bulkStream.test.ts`

**Interfaces:**
- Consumes: Task 6 types, `ScryfallSet`.
- Produces:
  - `readBulkStream(stream: ReadableStream<Uint8Array>, gzip: boolean, onCard: (card: unknown) => void, onBytes?: (bytes: number) => void): Promise<{ malformed: number }>`:
    - gzip → `DecompressionStream('gzip')` → `TextDecoderStream` → line splitter;
    - each line is trimmed and stripped of a leading `[`, a trailing `]` and a trailing `,`;
    - empty lines are ignored;
    - `JSON.parse` failures count as malformed.
  - `isGzip(blob: Blob): Promise<boolean>`: magic bytes `1f 8b`.
  - `interface BulkSetSummary { code: string; name: string; setType: string; count: number }`
  - `scanBulk(file: Blob, onProgress?: (read: number, total: number) => void): Promise<{ sets: BulkSetSummary[]; malformed: number }>`
  - `collectBulk(file: Blob, codes: string[], onProgress?): Promise<{ cards: ScryfallCard[]; malformed: number }>`: keeps only cards whose `set` is in `codes`.
  - `resolveTokenParents(summaries: BulkSetSummary[], known?: ScryfallSet[]): Map<string, string>`: token-set code → parent code. Uses `known` `parent_set_code` when available; otherwise `t<code>` when both sets are in `summaries`.

- [ ] **Step 1: Write failing tests.** Build inputs with `zlib.gzipSync` and `new Blob([...])`.
  - `'reads a gzipped JSONL file'`.
  - `'reads plain JSONL'`.
  - `'reads the legacy JSON array format'`.
  - `'skips and counts malformed lines'`.
  - `'handles a card split across chunk boundaries'`: a manual `ReadableStream` that emits 7-byte chunks.
  - `'scanBulk summarises sets with counts'`.
  - `'collectBulk keeps only chosen sets'`.
  - `'resolveTokenParents prefers known parent_set_code, else t-prefix'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: streaming Scryfall bulk file reader`.

### Task 16: Bulk worker and dialog tab

**Files:**
- Create: `src/scryfall/bulkWorker.ts`
- Modify: `src/components/ScryfallImportDialog.tsx` (tabs "Scryfall set" | "Bulk file")

**Interfaces:**
- Consumes: `scanBulk`, `collectBulk`, `resolveTokenParents` (Task 15); `buildPreview` (Task 10); `getSetList` (Task 10, optional and online only).
- Produces: the worker protocol.
  - `type BulkRequest = { type: 'scan'; file: File } | { type: 'collect'; file: File; codes: string[] }`
  - `type BulkResponse = { type: 'progress'; read: number; total: number } | { type: 'scanned'; sets: BulkSetSummary[]; malformed: number } | { type: 'collected'; cards: ScryfallCard[]; malformed: number } | { type: 'error'; message: string }`
  - Created with `new Worker(new URL('../scryfall/bulkWorker.ts', import.meta.url), { type: 'module' })`.

- [ ] **Step 1: Implement the worker** as a thin wrapper that posts progress at most every 1 MB.
- [ ] **Step 2: Add the dialog tab.** Use an accessible tab pattern (`role="tablist"`, arrow keys).
  - File input `accept=".gz,.jsonl,.json"` → scan with a progress bar by bytes.
  - Set list: multi-select checkboxes for main sets. Token sets are hidden; they're offered through "Include tokens" via `resolveTokenParents`, using `getSetList` when it resolves within the cache or the network, otherwise `undefined`.
  - The same options as tab 1.
  - "Read cards" → collect the chosen codes plus their token codes → group into one `ImportTarget[]` per chosen set → `buildPreview` → the same preview UI and primary button as tab 1. The label is the set name, or `"<n> sets"`.
  - Cancel terminates the worker.
- [ ] **Step 3: Run `npm run lint && npm test && npm run build`** → pass.
- [ ] **Step 4: Manual check.**
  - Download Default Cards: get the current `jsonl_download_uri` from `GET https://api.scryfall.com/bulk-data` (≈ 76 MB). Keep it outside the repo.
  - Scan: the tab stays responsive, and the Chrome task manager shows memory under 1 GB.
  - Import `neo` from the file: the preview counts equal the API path's (302 with defaults).
  - Also check a plain `.jsonl` (gunzipped) file.
- [ ] **Step 5: Commit** `feat: import sets from a Scryfall bulk file`.

**Phase 5 exit:** the Step 4 checks pass.

---

### Task 17: Final verification

- [ ] **Step 1: Run `npm ci && npm run lint && npm test && npm run build`.** Expected: all pass, from clean.
- [ ] **Step 2: Full manual regression** (Playwright, desktop 1440 and mobile 375):
  - SWTG box generation, inspect, edit, delete/Undo, JSON export→import round-trip, print (both modes).
  - NEO via the API, then a bulk-file import of one more set.
  - Reload persistence.
  - Keyboard-only run through the import dialog.
  - Reduced-motion emulation.
- [ ] **Step 3: Delete the superseded untracked `docs/plan.md` — only if the owner confirms** (it's untracked, so the deletion can't be undone).
- [ ] **Step 4:** Hand off to superpowers:finishing-a-development-branch. Merging to `main` triggers the Pages deploy, so it's the owner's call.
