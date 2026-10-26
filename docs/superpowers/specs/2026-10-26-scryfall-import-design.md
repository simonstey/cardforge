# Scryfall import — design

Status: draft for approval · 2026-10-26 · branch `feat/scryfall-import`

Consolidates `docs/plan.md` (first import plan) with the verified research in `docs/scryfall-api.md`. Where they disagree, this document wins. `docs/scryfall-api.md` remains the API reference: limits, CORS, image keys, layouts and licensing quotes.

## 1. Intent

CardForge is a static React SPA on GitHub Pages. It builds card pools, simulates booster boxes and exports print sheets. Today its only pool is the built-in Star Wars: The Gathering set plus hand-made cards. The goal is to **pull real Magic: The Gathering sets from Scryfall into the same pool**, so the existing booster simulator, inspect dialog and print sheets work with them, without adding a backend.

Who it's for: the owner, for personal use. Printing imported cards is explicitly wanted (owner decision, see §4).

## 2. Goals, non-goals, anti-goals

**Goals**

- Import one or more MTG sets by set code from the Scryfall API, with a preview before anything is saved.
- Import sets from a locally downloaded Scryfall bulk file (offline path).
- Imported cards behave like any other card: set chips in the configurator, rarity pools, colour balance, inspect dialog with both faces, print sheets (scan and generated layout).
- Hold several large sets without running into the ~5 MB localStorage ceiling.
- Re-importing a set is idempotent and never overwrites cards the user edited.
- Existing SWTG flows and saved databases keep working unchanged.

**Non-goals (this branch)**

- Single-card search, decklist import, `/cards/collection` re-resolve.
- Prices, legalities, rulings, keywords.
- Accurate play/collector booster collation (bonus sheets, The List, booster-fun slots, real slot ratios). Scryfall doesn't publish these. The existing configurable slot rules stay the collation model.
- Downloading bulk files inside the app. The user picks a file they downloaded.
- Branding changes: the subtitle, `DESIGN.md` wording and print-back default text stay "Star Wars TCG".
- An "Update set" diff UI. Re-import already updates; a diff view is a follow-up.

**Anti-goals: things that would make this a failure even if it works**

- Getting rate-limited or banned. Bursting the API, ignoring 429s, or one request per card.
- Silent data loss: a quota error, a failed migration or an aborted import that leaves the database half-written.
- Breaking the SWTG experience or older saved databases.
- Tampering with real card images: cropping the artist or copyright line off full card images, colour-shifting them with sheen overlays, or adding watermarks.

## 3. Constraints

- **Static SPA, no backend.** All calls go from the browser to `api.scryfall.com` and `*.scryfall.io`. Both send `Access-Control-Allow-Origin: *` (verified 2026-10-26).
- **Scryfall API rules** (see `docs/scryfall-api.md` §1–2):
  - Keep the browser's User-Agent and send an `Accept` header.
  - Spacing: at least 500 ms between `/cards/search`, `/cards/named`, `/cards/random` and `/cards/collection` calls; at least 100 ms for other endpoints.
  - A 429 means pause for at least 30 s. Never retry in a loop.
  - Cache data for at least 24 h.
  - No rate-limit headers are sent, so the client throttles itself.
- **Image keys:** use only the WebP keys `art`, `display` and `grid`, with old keys as read-time fallbacks. `small`, `large`, `border_crop` and `art_crop` disappear on 2027-01-01; PNGs can't be hotlinked after that date.
- **Canvas/PDF:** remote images must be loaded with `crossOrigin = 'anonymous'`, otherwise `toDataURL` throws and art silently drops out of PDFs.
- **Image-use rules** (Scryfall):
  - Don't crop the artist or copyright off full card images.
  - Don't distort or colour-shift them.
  - No watermarks.
  - When showing an art crop, show the artist and copyright in the same UI.
- **Stack:** Vite 8, React 19, TypeScript 7, Tailwind 4. There's no test runner today. Run `npm run lint` (tsc) and `npm run build`.
- **Design system:** `DESIGN.md` applies: one primary button per view, `MANA`/`RARITY` maps as the only colour sources, existing `Dialog`/`Button`/`Toast` primitives, 44 px touch targets, reduced-motion support.

## 4. Decisions made with the owner

| # | Decision |
|---|---|
| O1 | **Approach 1: API first, IndexedDB storage, bulk import last** (see §5). |
| O2 | **Imported cards stay printable** (scan and layout modes), for personal use. The owner was told that WotC's Fan Content Policy excludes proxies and Scryfall's ToS forbids counterfeit materials, and chose to keep printing. No print gating or warning is added. |
| O3 | **Re-import never overwrites cards the user edited** (`scryfall.userModified`). |
| O4 | **No sheen or foil overlay on real card images.** Foil and mythic cues move to the frame for Scryfall cards. |
| O5 | **Branding unchanged.** |
| O6 | **Scope = old plan Phases 1–5.** Phase 6 (update-set diff, branding) is later. |
| O7 | **Re-import syncs the set.** Cards of that set that are no longer in the result are removed, except user-edited ones. Deleted cards come back. Undo restores everything. |

## 5. Approaches considered

1. **API first, IndexedDB, bulk last (chosen).** Storage moves to IndexedDB up front, then mapper and tests, then the API import dialog, then rendering and print, then bulk file import. It holds many sets, each step can be tested on its own, and it's what `docs/plan.md` pointed at. Cost: the async storage migration touches `App.tsx` load/save; roughly 5–7 dev-days.
2. **API only on localStorage.** About 3 days. Rejected: one or two sets fill the 5 MB quota, and bulk import is out entirely.
3. **Bulk file first.** No network calls or rate limits. Rejected: the hardest code (streaming gzip in a Worker) comes first and still needs IndexedDB, so it's slower to deliver anything usable.

## 6. Design

### 6.1 Module layout

```
src/
  scryfall/
    types.ts         Scryfall Card / CardFace / Set / List / Error / ImageUris (subset; every field optional-tolerant)
    client.ts        request queue: tiered spacing, Accept header, 429 pause, paging, AbortSignal, Error-object parsing
    mapCard.ts       ScryfallCard -> Card | null (pure)
    filters.ts       include/exclude rules for an import (booster-only, tokens, paper, layouts)
    importSet.ts     orchestrates the API import -> ImportPreview
    merge.ts         syncImported: per-set sync of imported cards into the database (pure)
    bulkStream.ts    File -> lines -> objects (gzip / jsonl / legacy JSON array)
    bulkWorker.ts    Web Worker running bulkStream: pass 1 (scan sets), pass 2 (collect chosen sets)
    __fixtures__/    trimmed real Scryfall card JSON, one per layout case
  utils/
    storage.ts       tiny IndexedDB key-value wrapper + localStorage migration/fallback
  components/
    ScryfallImportDialog.tsx   tabs "Scryfall set" | "Bulk file"; preview; progress; cancel; imported-set list with remove
  (edits) types/card.ts, App.tsx, utils/boosterCollation.ts, utils/cardHelpers.ts, utils/cardArt.ts,
          utils/pdfGenerator.ts, components/ManaCost.tsx, CardItem.tsx, CardModal.tsx, CardDatabase.tsx,
          BoosterConfigurator.tsx, CardEditorDialog.tsx, PrintSheetModal.tsx
```

Data flow: `ScryfallImportDialog` → `importSet()` or the bulk worker → `mapCard()` per card → `ImportPreview` → user confirms → `App.handleMergeCards(preview)` → `setCards` → storage effect persists → the configurator's set chips update automatically through `listCardSets`.

### 6.2 Data model (`src/types/card.ts`)

All new fields are optional, so stored databases and the SWTG set stay valid.

```ts
export interface CardFace {
  name: string; type: string; text?: string; flavorText?: string; powerToughness?: string;
  cost?: string;              // NEW: MDFC/transform/split/adventure faces carry their own cost
}

export interface ScryfallImage { art?: string; full?: string; artBack?: string; fullBack?: string }

export interface Card {
  // …existing fields…
  setCode?: string;           // NEW: e.g. 'NEO' (Scryfall code, upper-cased); wins over the source-derived code
  setName?: string;           // NEW: e.g. 'Kamigawa: Neon Dynasty'
  collectorNumber?: string;   // NEW: string ('213★', 'DSC-300'); sorting/display
  scryfall?: {                // NEW: provenance + remote images
    id: string;
    oracleId?: string;
    uri?: string;             // scryfall_uri, for "View on Scryfall"
    layout?: string;
    image?: ScryfallImage;
    importedAt: string;       // ISO timestamp
    userModified?: boolean;   // set by the editor; protects the card from re-import overwrite (O3)
  };
}
```

Conventions:

- `id = 'scry:' + scryfall.id` is the upsert key.
- `source = 'scryfall:' + set` (lower-case). This keeps `isSetCard` false, so imports survive `CARD_SET_VERSION` bumps, and it reads well in exports.
- `setCode` collisions: checked against all 1,062 Scryfall sets on 2026-10-26. None of the SWTG codes (`Main`, `TFA`, `RO`, `TLJ`, `SOLO`, `ROS`, `RBL`) is a Scryfall code.

### 6.3 Mapping (`mapCard.ts`)

Two kinds of multi-face card:

- **Double-sided**: `card_faces[0].image_uris` exists and the root has no `image_uris`. Layouts `transform` (incl. battles), `modal_dfc`, `reversible_card`, `double_faced_token`.
- **Single-image multi-face**: `card_faces` exists and the root has `image_uris`. Layouts `split`, `flip`, `adventure`, `prepare`.

Detect by the presence of images, not by a layout whitelist, so new layouts degrade gracefully.

| CardForge | Rule |
|---|---|
| `id` | `scry:${id}` |
| `name`, `cost`, `type`, `text`, `flavorText`, `artist`, `powerToughness` | For any card with `card_faces`: from `card_faces[0]`, falling back to the root. Otherwise from the root. **Never** use the combined `"{1}{R} // {1}{U}"` cost. Non-English: prefer `printed_name`/`printed_text`/`printed_type_line` when present. |
| `powerToughness` | `power/toughness` → `"P/T"`; else `loyalty`; else `defense`. Matches the existing convention (loyalty already lives here). |
| `backFace` | `card_faces[1]` for every card with ≥ 2 faces: name, type, text, flavour, P/T, `cost` = face `mana_cost`. |
| `rarity` | Layout `token`/`double_faced_token`/`emblem` → `T`; `type_line` matching `/\bBasic\b/` and `/\bLand\b/` → `L`; `common`→`C`, `uncommon`→`U`, `rare`→`R`, `mythic`→`M`, `special`/`bonus`→`R`. |
| `colors` | Root `colors`, else the union of `card_faces[].colors`. `[]` → `['Colorless']`; 1 → `[c]`; ≥ 2 → `['Multicolor', …]`. Same shape as `determineColors`, so `frameIdentity`, filters and collation keep working. |
| `setCode` / `setName` | `set.toUpperCase()` / `set_name`. Tokens take the **parent** set's code and name (passed in by the importer), so they share the set chip. |
| `collectorNumber` | `collector_number`. |
| `source` | `scryfall:${set}`. |
| `scryfall.image.art` | Face-or-root `image_uris.art`, then `art_crop`. |
| `scryfall.image.full` | `display`, then `large`, then `normal`. |
| `scryfall.image.artBack` / `fullBack` | Same keys from `card_faces[1].image_uris`, double-sided cards only. |
| `scryfall.layout`, `uri`, `oracleId` | `layout`, `scryfall_uri`, `oracle_id` (root, or face 0 for reversible cards). |

`mapCard` returns `null` for cards CardForge can't represent: `art_series`, `vanguard`, `planar`, `scheme`, and anything with neither a name nor a type line. The importer counts these as "skipped". Unknown layouts map like `normal`, plus a preview warning. Basic-land rarity uses `/\bBasic\b/` so `Basic Snow Land — Forest` maps to `L` as well.

Not mapped: prices, legalities, keywords, purchase/related URIs, `all_parts`.

### 6.4 Import filters (`filters.ts`)

Defaults, each switchable in the dialog:

- **Booster cards only** (on): keep `booster === true`. For NEO that's 302 of 514 printings, the main sheet including basics. With it off, every printing is imported (showcase, borderless, extended art, promo-pack).
- **Include tokens** (off): also fetch the token set (the `/sets` entry with `parent_set_code === code` and `set_type === 'token'`), all printings.
- Always: `games` includes `paper` when the field is present; `mapCard` doesn't return `null`; `lang` is whatever the search returns (English by default).

### 6.5 API client (`client.ts`)

- One module-level serial queue for the whole app.
- Spacing is measured from the previous request's start: ≥ 500 ms when the next request's path starts with `/cards/search`, `/cards/named`, `/cards/random` or `/cards/collection`; ≥ 100 ms otherwise.
- `fetch(url, { headers: { Accept: 'application/json' }, signal })`. User-Agent is never set.
- **429**: pause the whole queue for 30 s, then retry that request. After 2 retries, fail with a clear error. The UI shows "Scryfall asked us to slow down, resuming in 30 s".
- **Errors**: parse the Scryfall Error object (`details`) into the message. `/cards/search` 404 (no matches) resolves to an empty list, not an error.
- **Paging**: `fetchAll(url)` follows `next_page` while `has_more`. On the last page `next_page` is absent; treat absent and null the same.
- **Abort**: `AbortSignal` cancels the queued request and any pause in progress. Nothing is merged after an abort.
- **Set list cache**: `GET /sets` (≈ 630 KB, 1,062 sets) is cached in IndexedDB for 24 h. That's the only response cached. Imported cards live in the database, and a re-import is an explicit user action.

### 6.6 Set import flow (dialog tab 1)

*One set per run on this tab (builder's call); the bulk tab is multi-select.*

1. **Pick a set** with a searchable combobox over cached `/sets`. Filter: `digital === false` and `set_type ∈ {core, expansion, masters, draft_innovation, funny}` (206 sets today). The combobox shows code, name, release year and the `icon_svg_uri` icon. Typing an exact code that isn't in the filtered list is still allowed.
2. **Options**: Booster cards only (on), Include tokens (off).
3. **Fetch**: `/cards/search?q=e:<code>&unique=prints&order=set`, following pages. Tokens come the same way from the token set code. Progress reads "Fetched 350 of 514 cards".
4. **Preview**, computed before anything is saved:
   - counts per rarity C/U/R/M/L/T;
   - new / updated / unchanged / removed / protected (user-edited) / skipped;
   - a sample strip of ~8 thumbnails;
   - warnings for unknown layouts.
5. **Confirm** merges and closes the dialog. The toast reads "Imported 302 cards from Kamigawa: Neon Dynasty (12 updated, 2 kept because you edited them)", with Undo.
6. **Imported sets list** (in the same dialog): every `setCode` that has `scryfall` cards, with card count and a **Remove** button. Remove deletes all of that set's imported cards, edited ones included. It's an explicit action with an Undo toast, and O3 only governs re-import *(builder's call)*.

### 6.7 Merge (`merge.ts` → `syncImported`, `App.handleMergeCards`)

**Re-import syncs the set (owner decision O7).** A set's *scope* is every existing card that has `scryfall` and the imported `setCode`. Tokens count too, because they carry the parent's code.

- Pure `syncImported(existing: Card[], incoming: Card[], setCodes: string[]) → { cards, added, updated, unchanged, protected, removed }`.
- For each incoming card, upsert by `id`:
  - An existing card with `scryfall.userModified` is kept as-is and counted as **protected**.
  - A card equal to the stored one, ignoring `scryfall.importedAt`, counts as **unchanged**.
  - Otherwise the incoming card replaces the stored one at the same index (**updated**).
  - New cards are appended after existing cards (**added**).
- Cards in scope that are **not** in the incoming result are **removed**, unless they have `userModified`. Those are kept and counted as protected.
- Consequences:
  - Changing the filters (booster-only, tokens) and re-importing shrinks or grows the stored set to match.
  - Cards the user deleted come back on re-import.
  - Cards outside the scope (SWTG, custom, other sets) are never touched.
- The preview and toast show all six counts, zeros omitted.
- `App.handleMergeCards` applies the result through `setCards`; Undo restores the previous array.
- The bulk path syncs each selected set the same way.
- `CardEditorDialog` sets `scryfall.userModified = true` when saving a card that has `scryfall`.

### 6.8 Storage (`utils/storage.ts`, `App.tsx`)

- IndexedDB database `cardforge`, object store `kv`. Keys: `cards` (the whole `Card[]` as one structured-clone value), `cardSetVersion`, `scryfallSets` (`{ fetchedAt, sets }`).
- Config and sound settings stay in localStorage.
- **Load** becomes async. `App` renders a light loading state until the database is read. The initial box is generated after the load, not on mount.
- **Migration**: if IndexedDB has no `cards` but localStorage `cardforge_custom_cards_v1` exists, copy it plus the version key into IndexedDB. Remove the localStorage keys only after the IndexedDB write has committed.
- **Save**: the existing `[cards]` effect writes to IndexedDB. Writes are serialised so the last state wins. On failure (`QuotaExceededError` or any IDB error), show an error toast. In-memory state is kept as-is, so nothing is lost for the session.
- **Fallback**: if IndexedDB is unavailable, keep today's localStorage behaviour, but surface write failures as an error toast. Today `writeStorage` only does `console.error`.
- The `CARD_SET_VERSION` rebase logic is unchanged and runs on whatever was loaded.

### 6.9 Rendering

- **`getCardArt`** order: `customImageUrl` → `card.scryfall.image` → manifest. The Scryfall branch returns `src: art ?? full`, `fullSrc: full`, `fullBackSrc: fullBack`, `width/height` 626×457 for `art` and `fullWidth/fullHeight` 672×936 for `display`. It comes before the basic-land manifest branch, so imported basics use their own printing.
- **`crossOrigin="anonymous"`** on every `<img>` that can show card art (CardItem, CardModal, PrintSheetModal preview) and in `loadAsJpeg`. This keeps the HTTP cache consistent between on-screen and PDF loads. It's harmless for same-origin assets.
- **Sheen (O4)**: for cards with `scryfall`, skip the `foil-sheen` overlay on the art window. Foil and mythic cues come from the frame: the existing mythic/rare ring, plus a foil ring or border and the "Foil" badge. In the PDF the image is drawn untouched.
- **CardModal**: for `scryfall` cards, show "© Wizards of the Coast" next to the artist and a "View on Scryfall" link. Fix the existing gap where "Show other face" only appears when a full scan exists: the toggle shows whenever `backFace` exists, and text-only back faces render through `CardItem`. Show the back face's cost when turned over.
- **Set names**: `setDisplayName(code, cards)` = `SET_NAMES[code]` ?? `setName` of the first card with that `setCode` ?? `code`. It's used in `CardModal` and `BoosterConfigurator`.
- **`getCardSetCode`**: `if (card.setCode) return card.setCode;` first.
- **`ManaCost`/`ManaSymbol`**:
  - Add `{C}` (colourless), `{S}` (snow), mono-hybrid `{2/W}` (split pip: generic and colour), hybrid Phyrexian `{W/U/P}`, `{½}`, `{∞}`.
  - Only use `var(--color-mana-x)` for W/U/B/R/G and fall back to the generic pip.
  - Give the unknown long symbols in rules text (`{E}`, `{CHAOS}`, `{PW}` …) a readable generic pip, not overflowing text.
  - `symbolName` gets matching spoken names.
- **App footer**: when the database contains any `scryfall` card, add one line: "Magic: The Gathering card data and images via Scryfall. CardForge is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC."

### 6.10 Print (O2)

- No gating. "Original card scans" uses `scryfall.image.full` (`display` WebP, 672×936, ≈ 271 dpi at 63×88 mm). "Generated layout" uses `art`.
- `loadAsJpeg` sets `img.crossOrigin = 'anonymous'` before `src`. It already re-encodes to JPEG, so WebP input is fine.
- Full card images are never cropped; the `aspect` crop only applies to `art`.
- PDF back faces of double-sided cards are out of scope. Today's print flow prints fronts only, and that doesn't change.

### 6.11 JSON import/export

The existing JSON import still **replaces** the database (with Undo), but becomes lossless:

- It keeps `backFace` (including `cost`), `artKey`, `customImageUrl`, `setCode`, `setName`, `collectorNumber` and `scryfall` when they are well-formed.
- It keeps `colors` when it's a valid `CardColor[]`, else recomputes it with `determineColors`.

Export is unchanged (it already writes everything).

### 6.12 Bulk file import (dialog tab 2)

- `<input type="file" accept=".gz,.jsonl,.json">`. Handles `.jsonl.gz`, plain `.jsonl`, and the legacy JSON-array format (one card per line wrapped in `[` … `]` with trailing commas).
- Runs in a module Web Worker (`new Worker(new URL('./bulkWorker.ts', import.meta.url), { type: 'module' })`): `file.stream()` → `DecompressionStream('gzip')` if gzip (by magic bytes `1f 8b`) → `TextDecoderStream` → line splitter → `JSON.parse` per line. Malformed lines are skipped and counted.
- **Pass 1** collects only `{ set, set_name, set_type, count }` per set (card objects carry no `parent_set_code`) → set picker with multi-select.
- **Token → parent set** *(builder's call)*: use the cached `/sets` list when it is available (any earlier API use, or one `/sets` fetch if online); offline, fall back to the `t<code>` naming convention for token sets present in the file. Token sets that can't be matched are listed as their own sets.
- **Pass 2** re-reads the file and keeps only cards of the chosen sets (and their token sets if "Include tokens" is on). They go through the same `filters` → `mapCard` → preview → merge as the API path.
- Progress is reported by bytes read. Cancel terminates the worker.
- Must handle Default Cards (≈ 76 MB gzipped, ≈ 500 MB raw) without exhausting tab memory: no full-file buffering, and only chosen-set cards are kept.

### 6.13 Testing

- Add **Vitest** (dev dependency) and `npm test`. Add `fake-indexeddb` for storage tests. CI (`deploy.yml`) runs `npm test` before `npm run build`.
- **Fixtures**: a script `scripts/fetch-scryfall-fixtures.mjs` fetches named cards with an app-specific User-Agent and ≥ 500 ms spacing, trims them to the fields we read, and writes `src/scryfall/__fixtures__/*.json`. The fixtures are committed; tests never hit the network.
- Fixture cases: normal, split, flip, adventure, transform, battle, modal_dfc, meld, saga, class, planeswalker (loyalty), basic land, snow basic, token, double_faced_token, reversible_card, art_series, mono-hybrid `{2/W}`, hybrid Phyrexian, `{C}`, `{S}`, no-image (`image_status: missing`).
- **Unit tests**:
  - `mapCard`: golden tests per fixture.
  - `filters`.
  - `merge`: first import, identical re-import, changed text, protected card, filter change shrinks the set, deleted card returns, edited card outside the result kept, other sets untouched.
  - `client`: spacing tiers via fake timers, paging, 404-to-empty, 429 pause/retry/give-up, abort.
  - `bulkStream`: gzip, jsonl, legacy array, malformed line.
  - `storage`: migration, fallback, write failure.
  - `parseCost`/`symbolName` for the new symbols.
- **Manual/Playwright** (each phase's exit check):
  - Import NEO via the API.
  - Generate a NEO-only box.
  - Inspect a DFC and a split card.
  - Print one sheet in both modes and confirm art is present in the PDF.
  - Reload: the data is still there.
  - Old localStorage database: migrated.

### 6.14 Delivery phases (each ends green: `npm run lint`, `npm test`, `npm run build`, phase exit check, one commit or more)

1. **Model, storage, plumbing**:
   - Vitest set up.
   - Optional fields on the card types.
   - `storage.ts` with migration and fallback; async load in `App`.
   - `getCardSetCode`/`setDisplayName`.
   - `syncImported` + `handleMergeCards`.
   - Lossless JSON import.
   - Exit: SWTG flows unchanged; a hand-made `setCode: 'TST'` card shows as a set chip; an old localStorage DB migrates.
2. **Mapper**: types, fixtures script and fixtures, `mapCard`, `filters`, golden tests. Exit: all fixtures map; single-face `colors` equals `determineColors` shape.
3. **API import**:
   - `client.ts`, `importSet.ts`.
   - Dialog tab 1 and the imported-sets list.
   - "Import from Scryfall" secondary button in `CardDatabase`.
   - Exit: importing NEO twice → second run reports 0 new / N unchanged; a NEO-only box generates.
4. **Rendering & print**:
   - The `getCardArt` branch and `crossOrigin` everywhere.
   - Sheen rule, CardModal attribution and back-face fix, ManaCost symbols, footer notice.
   - `loadAsJpeg` fix.
   - Exit: DFC, split, adventure, planeswalker and hybrid cards look right in the grid, inspect dialog, pack opening and PDF (art present in both modes).
5. **Bulk import**: worker, stream, two-pass dialog tab 2. Exit: a real Default Cards file scans without exhausting memory; one set imports with the same preview counts as the API path.

## 7. Left to the builder

- Visual details of the import dialog, combobox, preview strip and frame-based foil cue, within `DESIGN.md`.
- Exact IndexedDB wrapper shape and write-serialisation technique.
- Whether to add `idb-keyval` (or similar) or hand-roll the ~50-line wrapper. Default: hand-roll, no new runtime dependency.
- Debouncing of database writes.
- Exact fixture card choices per case.
- Copy wording, as long as it follows the existing tone (sentence case, plain, specific numbers).

## 8. Known limitations

- When a set without basics (e.g. a masters set) is selected alone, the existing collation borrows basic lands from the whole pool, which can be SWTG basics. The user can set the land slot to 0. Collation logic stays unchanged in this branch.
- Default slot rules (10 C / 3 U / 1 R, mythic 0.22) are SWTG-tuned, not MTG-accurate; the user adjusts them in the configurator.
- Image URLs are stored, not bytes. If Scryfall removes an old image URL, a re-import refreshes it.
