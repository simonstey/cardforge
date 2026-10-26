# Scryfall API — reference for CardForge

Researched 2026-10-26. Sources are primary (scryfall.com docs, Scryfall blog, WotC Fan Content Policy, MDN/WHATWG) and most claims were checked against the live API with `curl`. Header behaviour and the WebP migration are time-sensitive; re-check anything marked *(snapshot)* before relying on it.

## TL;DR for CardForge

- **No proxy needed.** `api.scryfall.com` and every `*.scryfall.io` file host send `Access-Control-Allow-Origin: *`. Plain `fetch()` from the GitHub Pages origin works.
- **Throttle yourself.** No rate-limit headers are sent. `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection` = **2 req/s**; `/cards/manifest` = 10/min; everything else = 10 req/s. A 429 locks you out for 30 s; repeated abuse gets the app banned.
- **Cache ≥ 24 h.** Use bulk files for anything high-volume.
- **Fix `loadAsJpeg` before using remote art in PDFs.** It never sets `img.crossOrigin`, so Scryfall images taint the canvas and silently vanish from exports.
- **Use the new WebP keys** (`thumb`, `grid`, `display`, `crop`, `art`). `small`, `large`, `border_crop`, `art_crop` JPEGs disappear on **2027-01-01**, `normal` is renamed `jpeg`, and PNGs can no longer be hotlinked.
- **Licensing is the real constraint.** WotC's Fan Content Policy explicitly excludes "creating counterfeit/proxy Magic: The Gathering cards", and Scryfall's ToS forbids using Scryfall "to offer counterfeit gaming materials". Booster simulation of real sets is fine; **PDF print sheets of real Scryfall card images are not covered** and should stay limited to CardForge's own custom cards.

## 1. Basics

- Base URL `https://api.scryfall.com`, HTTPS only (TLS 1.2+), UTF-8.
- **Required headers** (enforced since 2024-08-08; missing either → HTTP 400 `must contain a User-Agent and Accept header`):
  - `User-Agent`: in browser JS, **leave the browser's own UA intact**. Scripts and backends must send an app-specific UA (`MyApp/1.0`); generic library UAs (curl, node, python-requests) are not allowed, and since October 2026 Scryfall says it enforces this strictly for API and scripted image requests.
  - `Accept`: any value works, e.g. `*/*` or `application/json;q=0.9,*/*;q=0.8`. Browsers send one by default.
- `docs/api/http-concerns` says an `Origin` header matching the page is required for CORS (browsers add it automatically). In practice the servers also sent `ACAO: *` without an Origin *(snapshot, undocumented)*.

## 2. Rate limits and good citizenship

| Endpoint | Limit | Min spacing |
|---|---|---|
| `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection` | 2/s | 500 ms |
| `/cards/manifest` (added July 2026) | 10/min | 6000 ms |
| everything else on `api.scryfall.com` (`/sets`, `/cards/:id`, `/cards/:set/:number`, `/symbology`, `/catalog/*`, `/bulk-data`, autocomplete…) | 10/s | 100 ms |
| `*.scryfall.io` (images, SVGs, bulk files) | none | — |

- No `X-RateLimit-*` headers. Limits are enforced: parallel test traffic from one IP drew real 429s.
- "Receiving an HTTP 429 response will result in your access being limited for 30 seconds… It is not acceptable to ignore HTTP 429 responses." Continued overload can lead to a temporary or permanent ban.
- The docs don't say whether the four 2/s endpoints share a bucket. Assume they do.
- **Cache** downloaded data for at least 24 h. Prices update once a day; gameplay data changes rarely (weekly or per set release is enough). "If you need to rapidly look up card names, prices, or resolve a large number of card images, you must use the bulk data files."
- Server cache headers *(snapshot)*: API `Cache-Control: public, max-age=172800` (57600 seen on search); image and bulk files `max-age=31556952` (~1 year).

**Implication:** one global request queue. Space search/named/random/collection calls at ≥ 500 ms, others at ≥ 100 ms. On 429, pause the whole queue ≥ 30 s; never retry in a loop.

## 3. CORS, canvas and PDF export

Live checks from `Origin: https://example.github.io` *(snapshot)*:

- `api.scryfall.com`: `access-control-allow-origin: *`, methods `GET, POST, DELETE, OPTIONS`, allowed headers include `Accept`, `Content-Type`, `User-Agent`, `Authorization`, preflight `max-age: 300`. An `OPTIONS` preflight for `content-type` returns 200.
- `cards.scryfall.io`, `backs.scryfall.io`, `svgs.scryfall.io`, `data.scryfall.io`: `Access-Control-Allow-Origin: *`; image preflight 204 with `Access-Control-Max-Age: 2592000`, `Vary: Origin`.
- Suggested CSP: `img-src *.scryfall.io`.

**Tainted canvas.** Drawing a cross-origin image is only "clean" if the server sends ACAO (Scryfall does) **and** the client requested CORS mode (`img.crossOrigin = 'anonymous'` set *before* `img.src`, or `fetch()` → `Blob` → `createImageBitmap`/blob URL). Otherwise `drawImage()` succeeds but `toDataURL()`, `toBlob()` and `getImageData()` throw `SecurityError`.

**CardForge today:** `src/utils/pdfGenerator.ts` `loadAsJpeg()` does `new Image(); img.src = url;` with no `crossOrigin`, then `canvas.toDataURL(...)` inside `try { … } catch { return null; }`. With Scryfall URLs the export silently drops the art. Fix: set `img.crossOrigin = 'anonymous'` before `src`. Pitfall: if the browser cached a non-CORS copy of the same URL earlier (e.g. from a plain `<img>`), the CORS load can fail. Add `crossOrigin="anonymous"` to `<img>` tags that show Scryfall art too.

## 4. Objects, endpoints, pagination

### Lists and errors

- Multi-result endpoints return `{object: "list", data: [...], has_more, next_page?, total_cards?, warnings?}`.
- Paginate by GETting `next_page` until `has_more` is false. On the last page the `next_page` **key is absent** (docs say "nullable"). `next_page` comes back with the defaults filled in.
- `/cards/search` returns **175 cards per page**, and still returns a List for a single match. **Zero matches return a 404 Error, not an empty List.**
- Error object: `{object: "error", code, status, details, type?, warnings?}`, e.g. `{object:"error", code:"bad_request", status:400, details:"The `identifiers` list must have at least 1 and no more than 75 references."}`.

### Endpoints most relevant to CardForge

| Endpoint | Use | Notes |
|---|---|---|
| `GET /sets`, `GET /sets/:code` | set picker, metadata | `/sets/neo` → `card_count` 514, `printed_size` 302, `set_type`, `released_at`, `icon_svg_uri` (svgs.scryfall.io), `search_uri`, `parent_set_code` |
| `GET /cards/search?q=…` | import a whole set or rarity bucket | 2/s, 175/page; params `unique`, `order`, `dir`, `include_extras`, `include_variations`, `include_multilingual`, `page` |
| `GET /cards/:set/:number` | single print | `/cards/neo/1` → Ancestral Katana |
| `GET /cards/:id` | by Scryfall UUID | |
| `GET /cards/named?exact=…` / `?fuzzy=…` | by name | 2/s |
| `POST /cards/collection` | re-resolve stored references | body `{"identifiers":[…]}`, 1–75 per request (76 → 400); **must** be `Content-Type: application/json` (text/plain → 400), so always preflighted (preflight succeeds); 2/s |
| `GET /cards/autocomplete?q=` | name autocomplete | returns a `catalog` object with up to 20 names |
| `GET /cards/random?q=` | random card | 2/s |
| `GET /symbology` | mana/tap symbols | 84 symbols, each with `symbol`, `svg_uri`, `english`, `mana_value`, `colors` |
| `GET /symbology/parse-mana?cost=2WW` | normalise a cost | → `{cost:"{2}{W}{W}", cmc:4, colors:["W"]}` |
| `GET /catalog/*` | name/type lists | |
| `GET /bulk-data` | bulk file URLs | see §6 |

### Search syntax useful for booster simulation

Verified live:

- `set:neo&unique=prints`: whole set, every printing (514 cards = 3 pages). The default `unique=cards` collapses prints sharing a name: `set:dom` gives 265 by default vs 280 with `unique=prints`, and `set:dom t:basic` gives 5 vs 20.
- `set:neo is:booster`: 302 cards, which equals `printed_size`: the main draft sheet only.
- `set:neo is:booster r:mythic`: 18.
- `set:neo -is:booster`: 212 cards, mostly `promo_types: ["boosterfun"]` showcase, borderless and extended-art variants, plus `promopack` cards.
- `include_extras` and `include_variations` default to false and didn't change `set:dom` counts. Tokens live under separate set codes (e.g. `tdom`).

From the syntax docs (extracted, not all tested): `r:`/`rarity:` takes `common|uncommon|rare|special|mythic|bonus` and supports comparisons (`r>=r` = rares + mythics); `cn:`/`number:` with ranges (`cn>50`); `st:` set type; `is:split|flip|transform|meld|dfc|mdfc`; inline display options `unique:prints`, `order:set|rarity|…`, `prefer:newest`, `direction:asc|desc`; `include:extras`.

**`booster` + `rarity` is not enough for real collation** (a claim saying it was got refuted 0-3). It reproduces the classic main sheet (C/U/R/M) only. Play/collector boosters also pull booster-fun variants (`booster: false` on the variant prints), bonus sheets and The List from **separate set codes** (e.g. `spg`, `big`, `otp`), foil slots, and wildcard slots. Scryfall publishes no slot or sheet ratios. CardForge's existing collation config has to supply those.

## 5. Images and card faces

### Image keys (`image_uris`)

| Old (JPEG/PNG) | Size | New (WebP) | Size | After 2027-01-01 |
|---|---|---|---|---|
| `small` | 146×204 | `thumb` | 146×204 | `small` removed |
| `normal` | 488×680 | `grid` | 488×680 | `normal` renamed `jpeg`, the only JPEG left |
| `large` | 672×936 | `display` | 672×936 | `large` removed |
| `border_crop` | 480×680 | `crop` | 480×680 | `border_crop` removed |
| `art_crop` | varies | `art` | 626×457 | `art_crop` removed |
| `png` | 744×1040 | — | — | still exists, but **no hotlinking** |

- Today's responses already carry both old and new keys, with the new ones as `.webp` on `cards.scryfall.io`. There's also `image_updated_at` plus the `/cards/manifest` endpoint for daily re-hosting syncs; Scryfall asks large apps to re-host.
- PNG: "available for you to pipe into your own image processing system… after January 1, 2027, you will not be able to hotlink to the PNG image." Whether a runtime browser `fetch()` counts as hotlinking is undefined. Default to `display` WebP (≈ 271 dpi at 63×88 mm vs ≈ 300 dpi for PNG).
- `image_status`: `missing | placeholder | lowres | highres_scan`. Some prints have no imagery at all, so always keep a placeholder fallback.
- Browsers decode WebP natively, so `loadAsJpeg` (canvas → JPEG) handles WebP input once `crossOrigin` is set.

### Layouts and faces

Branch on `layout`; never assume a root field exists.

- **Double-sided** (`transform`, `modal_dfc`, `reversible_card`, `double_faced_token`, `art_series`): the root has **no** `image_uris`, `mana_cost` or `oracle_text`. Each `card_faces[i]` carries its own `image_uris`, `mana_cost`, `oracle_text`, `type_line` etc. The root keeps the combined name `A // B` plus `color_identity`, `set`, `rarity`. `reversible_card` has no root `type_line`.
- **Single-image multi-face** (`split`, `flip`, `adventure`): `card_faces` present but `image_uris` at the root. Split cards have a combined root `mana_cost` (`{1}{R} // {1}{U}`) plus per-face costs.
- `meld` always has `all_parts`, but `all_parts` also appears on many normal cards and tokens, so it doesn't identify meld cards.
- Verified across ~114k `default_cards` with zero exceptions; 9 `art_series` prints have no imagery anywhere.
- Image lookup order: root `image_uris` → `card_faces[i].image_uris` → placeholder.

## 6. Bulk data

- `GET /bulk-data` lists the current files. URLs carry a daily timestamp (e.g. `oracle-cards-20261025210154.jsonl.gz`), so never hard-code them. Data is collected every 12–24 h.
- Format: **gzipped JSON Lines** (`.jsonl.gz`, not `.tar.gz`). The `bulk_data` objects expose `jsonl_download_uri` and `compressed_size`; older `download_uri`/`size`/`.json` tutorials are out of date.
- Types (compressed, MiB; the docs say "MB" but mean MiB), as of 2026-10-25: Oracle Cards 23.9 · Unique Artwork 36.8 · Default Cards 76.3 · All Cards 382 · Rulings 5.17 · Art Tags 12.6 · Oracle Tags 5.77.
- `data.scryfall.io` sends ACAO `*`, `Content-Type: application/gzip` with **no** `Content-Encoding`, `Content-Disposition: attachment` and `Accept-Ranges: bytes`. A browser `fetch()` works but gets raw gzip, so decompress with `DecompressionStream('gzip')` and split on newlines, ideally in a Web Worker. All Cards is impractical in a browser. For per-set import, paginated search is far lighter.

## 7. Licensing and terms

### Scryfall "Use of Scryfall Data and Images" (docs/api)

Data and images are provided free "for the primary purpose of creating additional Magic software, performing research, or creating community content".

Data rules:

- No implied Scryfall endorsement; don't use Scryfall logos.
- **No paywall.** No payments, surveys, subscriptions, ratings, joining chat servers or following channels in exchange for access. Card data must be reachable anonymously or with a free account.
- Don't use the data to create **new games**, or imply it comes from another game.
- Don't "simply repackage, republish, or proxy Scryfall data". The software must add value.

Image rules:

- Don't cover, crop or clip the copyright line or artist name.
- Don't distort, skew or stretch.
- Don't blur, sharpen, desaturate or colour-shift.
- No watermarks, stamps or logos on card images.
- Don't present images as made by anyone other than WotC, or as from another game.
- When showing `art_crop`, show the artist name and copyright elsewhere in the same UI (or the full card image).

Repeated mishandling can lead to blocked API access.

### Scryfall Terms of Service

- They explicitly cover `api.scryfall.com`.
- "You may not use Scryfall to offer counterfeit gaming materials or instruct others on how to create them."
- "You may not place undue burden on Scryfall through the use of automated means." Sanctions: warnings, suspension, restricted future access.
- Service is as-is and may change or stop without notice, so plan for outages.
- Scryfall's FAQ: "Scryfall has no plans for proxy or printing features." That is a statement, not a prohibition.

### WotC Fan Content Policy

- Card images and mana symbols are © Wizards of the Coast; Scryfall itself operates as Fan Content under this policy.
- "Fan Content does not include the verbatim copying and reposting of Wizards' IP (e.g., … creating counterfeit/proxy Magic: The Gathering cards, etc.), regardless of whether that content is distributed for free."
- **Free**: "You can't require payments, surveys, downloads, subscriptions, or email registration". Sponsorships, ads and donations are fine as long as access isn't impeded.
- Required notice: "*[Title] is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.*"
- Don't use Wizards logos or trademarks; don't alter legal notices.
- WotC can stop or restrict use at any time.

### What this means for CardForge

- Importing real sets for browsing and booster simulation fits "additional Magic software". Keep it free, add the Fan Content notice, and credit Scryfall as the data source without implying endorsement.
- **Print-sheet PDF export of real Scryfall card images is effectively proxy creation.** The FCP excludes it and Scryfall's ToS forbids it. Gate the print export to CardForge's own custom cards, or disable it for Scryfall-sourced cards.
- `loadAsJpeg(url, aspect)` center-crops to `aspect`. Never apply that to full Scryfall card images, because it clips the artist and copyright line. Use `art` and show the attribution, or draw the full image uncropped.
- Foil or mythic sheen overlays (`mix-blend-mode: color-dodge`) on Scryfall images can count as colour-shifting. Put effects on the frame, not the image.
- Caching card JSON in IndexedDB is what Scryfall asks for (≥ 24 h). Store image **URLs**, not bytes, and let the year-long HTTP cache handle the images.

## 8. Integration checklist for a static SPA

1. Plain `fetch()` to `api.scryfall.com`. Don't set `User-Agent`; the default `Accept` is fine, or send `Accept: application/json`.
2. One request queue: ≥ 500 ms between search/named/random/collection calls, ≥ 100 ms for others. On 429, pause ≥ 30 s and surface it in the UI.
3. Import a set via `/cards/search?q=set:<code>&unique=prints` (optionally `is:booster` for the main sheet), following `next_page`. A 500-card set takes 3 requests, ≈ 1.5 s minimum. Treat 404 as "no cards".
4. Cache normalized results in IndexedDB keyed by set code, TTL ≥ 24 h. localStorage (~5 MB) holds about one set at most.
5. Images: use `grid`/`thumb` in the UI and `display` for print or zoom, with `crossOrigin="anonymous"` everywhere. Resolve root → face → placeholder; render both faces for double-sided cards.
6. Re-resolve stored cards with `POST /cards/collection` in batches of 75.
7. Mana symbols: `/symbology` (cache it; the SVGs are on `svgs.scryfall.io`) or `parse-mana`.
8. Bulk files only for offline or all-cards features, decompressed in a Web Worker.
9. Add the WotC Fan Content notice and the art attribution; keep print export off for real cards.

## Open questions

- Does a runtime browser `fetch()` of a PNG after 2027-01-01 count as hotlinking, and how will it be enforced?
- Do the four 2/s endpoints share one bucket?
- Will `ACAO: *` without an `Origin` header keep working (undocumented)?
- Exact slot and sheet ratios for play/collector boosters aren't in Scryfall, so they need another source (e.g. WotC collation articles or community collation data).

## Sources

- https://scryfall.com/docs/api (Required Headers; Use of Scryfall Data and Images)
- https://scryfall.com/docs/api/rate-limits
- https://scryfall.com/docs/api/http-concerns (CORS and CSP)
- https://scryfall.com/docs/api/lists, https://scryfall.com/docs/api/errors
- https://scryfall.com/docs/api/cards, https://scryfall.com/docs/api/cards/search, https://scryfall.com/docs/api/cards/collection
- https://scryfall.com/docs/api/sets
- https://scryfall.com/docs/api/layouts
- https://scryfall.com/docs/api/images
- https://scryfall.com/docs/api/bulk-data
- https://scryfall.com/docs/syntax
- https://scryfall.com/blog/category/api (User-Agent/Accept 2024-08-08; "New WebP images + JPEG Deprecations" 2026-10-14)
- https://scryfall.com/docs/terms
- https://scryfall.com/docs/faqs/how-do-i-print-cards-11
- https://company.wizards.com/en/legal/fancontentpolicy
- https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image, https://html.spec.whatwg.org/multipage/canvas.html
