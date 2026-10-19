#!/usr/bin/env python3
"""Extract card artwork from the SWTG print PDFs into web-ready assets.

How to run (from the repo root):

    python scripts/extract_card_art.py            # regenerate everything
    python scripts/extract_card_art.py --report   # also print the per-card match table
    python scripts/extract_card_art.py --dry-run --report
                                # match and crop into a temp dir; the repo is not touched
    python scripts/extract_card_art.py --raw-cards other.json --out some/dir
                                # another card list; outputs under some/dir instead

Requirements: Python 3.10+, Pillow built with WebP support, and poppler's
`pdfimages` on PATH (it ships with MiKTeX / TeX Live / poppler-utils).

Inputs
  cards/*.pdf                                  print sheets; one embedded image per card
  SWTG-BoosterPackMaker/resources/SWTG - */    card renders whose FILE NAMES are the card
                                               names. Used only to identify which scan
                                               is which card, never as artwork.
  src/data/rawCards.json                       the cards the app uses (--raw-cards)

Outputs (overwritten on every run; with --out/--dry-run they go below that dir instead)
  public/cards/full/<key>.webp       full card scan (150 ppi, about 374x522)
  public/cards/art/<key>.webp        artwork only (no frame, title, type line or text box)
  public/cards/{art,full}/land-<type>-<n>.webp   every basic land variant
  src/data/cardArt.json              mapping "<source>::<name>" -> asset paths and sizes

How a scan is identified: each scan and each oracle render is shrunk to 30x42 px.
The distance between two images is the mean absolute RGB difference (0-255). Each
card is matched to the scan nearest its oracle render, one scan per card. A card
finds its oracle render by name, compared without case and punctuation, or through
ORACLE_ALIASES. Basic lands are typed by the colour of the mana symbol in the type
bar, and the result is checked against the land renders in the oracle folders. The
expansion sheets also print a few basic lands; those join the land variants unless
they repeat a printing of the basic land sheet.
"""

from __future__ import annotations

import argparse
import colorsys
import difflib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

REPO = Path(__file__).resolve().parent.parent
CARDS_DIR = REPO / "cards"
RES_DIR = REPO / "SWTG-BoosterPackMaker" / "resources"
RAW_CARDS = REPO / "src" / "data" / "rawCards.json"
OUT_ART = REPO / "public" / "cards" / "art"
OUT_FULL = REPO / "public" / "cards" / "full"
OUT_MAP = REPO / "src" / "data" / "cardArt.json"
URL_PREFIX = "cards"  # paths in cardArt.json are relative to the app base

WEBP_QUALITY = 82
CARD_SIZE = (374, 522)  # 63x88 mm at 150 ppi

# Art crop per frame template, as a PIL box (left, top, right, bottom) in pixels of
# the 150 ppi scan; right/bottom are exclusive. Each box sits a few px inside the art
# window, so no frame line or anti-aliased edge ends up in the crop. Curved windows
# get the largest clean rectangle that fits inside them.
CROPS = {
    "m15": (31, 62, 342, 288),            # regular frame (all sets)
    "m15-dfc": (35, 66, 337, 285),        # Anakin // Vader transform card (both faces)
    "planeswalker": (39, 62, 334, 295),   # base set: window with bowed sides and rounded
                                          # corners, y 54-301
    "planeswalker-short": (39, 57, 334, 286),  # TLJ to RBL: same shape, but the window
                                          # ends at y=288 (art y 53-288, x 25-348 at mid)
    "futureshifted": (90, 102, 346, 288), # starships and The Death Star: curved left
                                          # edge, cost column, swoosh at top right
    "token": (49, 114, 325, 367),         # base token without rules text: tall window,
                                          # arched at top and bottom
    "token-text": (56, 100, 318, 302),    # base token with rules text, and the emblems:
                                          # shorter window, arched at top and bottom
    "token-flat": (49, 119, 325, 416),    # TLJ, SOLO, RO and RBL tokens without rules text:
                                          # arched top (at x=49 it reaches y=115), flat
                                          # bottom; art ends at y=418 (RBL) / 422 (others)
    "token-flat-text": (49, 119, 325, 343),  # the same frame with rules text: art ends at
                                          # y=345 (RBL) / 348 (TLJ)
    "fullart-land": (49, 64, 329, 402),   # full-art basic lands: barrel-shaped window, the
                                          # mana symbol arch rises to y=405 on some frames
}
# A few scans sit a pixel or two off the template (e.g. art pasted lower, which makes
# the frame line at the top thicker). If an edge of the crop is a uniform line that
# contrasts with the art just inside it, the box is moved away from it by up to this
# many px. The box keeps its size.
MAX_NUDGE = 2
# After nudging, a frame-like line this deep inside the crop means the template does
# not fit the scan; it is reported as a problem.
FRAME_CHECK_DEPTH = 8
# Scans where that check fires on a straight line in the artwork itself (checked by
# eye), keyed like TEMPLATE_OVERRIDES; reported as notes.
FRAME_CHECK_EXEMPT = {
    "SWTG - RBL/The Monarch": "dark vertical bar in the art at x=316; the frame edge is "
                              "at x=347",
}

# Which oracle folder identifies the scans of which PDF.
ORACLE_SET = {"base": "SWTG - Main", "TFA": "SWTG - TFA", "RO": "SWTG - RO",
              "TLJ": "SWTG - TLJ", "SOLO": "SWTG - SOLO", "ROS": "SWTG - ROS",
              "RBL": "SWTG - RBL"}
LAND_TYPES = ["Plains", "Island", "Swamp", "Mountain", "Forest"]

# Frames that do not follow from the source and type line, keyed by the oracle render
# that identified the card ("<oracle folder>/<file stem>"), so printed names don't matter.
# Every frame here was measured on the scans and checked by eye.
TEMPLATE_OVERRIDES = {
    "SWTG - Main/The Death Star": "futureshifted",
    "SWTG - Main/EMBLEM": "token-text",       # Emblem - Yoda, Jedi Master
    "SWTG - Main/EMBLEM1": "token-text",      # Emblem - Aurra Sing, Bane of Jedi
    "SWTG - Main/EMBLEM2": "token-text",      # Emblem - Obi-Wan Kenobi
    "SWTG - RO/Trooper": "token-flat",
    "SWTG - TLJ/Supreme Leader Snoke": "planeswalker-short",
    "SWTG - TLJ/Luke Skywalker the Last Jedi": "planeswalker-short",
    "SWTG - TLJ/Resistance Bomber": "futureshifted",
    "SWTG - TLJ/First Order Dreadnought": "futureshifted",
    "SWTG - TLJ/TIE Silencer": "futureshifted",
    "SWTG - TLJ/Trooper": "token-flat",
    "SWTG - TLJ/Porg": "token-flat-text",
    "SWTG - SOLO/Corellian Gunship": "futureshifted",
    "SWTG - SOLO/Kalevan Star Yacht": "futureshifted",
    "SWTG - SOLO/DROID": "token-flat",
    "SWTG - ROS/Rey Skywalker": "planeswalker-short",
    "SWTG - ROS/Xyston Star Destroyer": "futureshifted",
    "SWTG - RBL/Garazeb Orrelios": "planeswalker-short",
    "SWTG - RBL/The Ghost": "futureshifted",
    "SWTG - RBL/Rebel": "token-flat",
    "SWTG - RBL/Wolf Beast": "token-flat",
    "SWTG - RBL/Inquisitor": "token-flat-text",
    "SWTG - RBL/The Monarch": "token-flat-text",
}
# Sets whose every non-m15 frame is listed above: the type line is not consulted there
# (their planeswalkers and tokens use newer frames than the base set's).
FRAMES_LISTED = {"SWTG - TLJ", "SWTG - SOLO", "SWTG - ROS", "SWTG - RBL"}

# Card names that differ from the oracle file name by more than case and punctuation:
# oracle file stem -> other names (compared with norm_name). A card's type line is
# tried too, which tells the three emblems apart even if they are all named "Emblem".
ORACLE_ALIASES = {
    "EMBLEM": ["Emblem - Yoda, Jedi Master"],
    "EMBLEM1": ["Emblem - Aurra Sing, Bane of Jedi"],
    "EMBLEM2": ["Emblem - Obi-Wan Kenobi"],
}
# A land printing on an expansion sheet this close to a basic land sheet scan is the
# same printing and is not added again.
LAND_DUP_DIST = 3.0

FEATURE_SIZE = (30, 42)
MATCH_WARN = 12.0   # a nearest distance above this is flagged
MARGIN_WARN = 8.0   # a gap between best and second best below this is flagged
# Weak matches that were checked by eye; reported as notes instead of problems.
CHECKED_WEAK_MATCHES = {
    "TUSKEN RAIDER": "the PDF has a different art version (William O'Connor, as in "
                     "rawCards) than the oracle render; title bar matches",
    "Anakin Skywalker // Darth Vader": "the PDF is a 600 ppi render of a slightly different "
                                       "card revision; same art on both faces",
    "Massiff Swarm": "rules text differs from the oracle render; same art and title",
}


# --------------------------------------------------------------------------- utils

def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def norm_name(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def source_short(source: str) -> str:
    """'swtg-base-1-commons.pdf' -> 'base-1', 'swtg-expansion-00-TFA.pdf' -> 'tfa'."""
    m = re.match(r"swtg-base-(\d+)-", source)
    if m:
        return f"base-{m.group(1)}"
    m = re.match(r"swtg-expansion-\d+-(\w+)\.pdf$", source)
    if m:
        return m.group(1).lower()
    raise ValueError(f"unexpected source name {source!r}")


def oracle_set(source: str) -> str:
    if source.startswith("swtg-base-"):
        return ORACLE_SET["base"]
    return ORACLE_SET[re.match(r"swtg-expansion-\d+-(\w+)\.pdf$", source).group(1)]


def feature(im: Image.Image) -> Image.Image:
    return im.convert("RGB").resize(FEATURE_SIZE, Image.BILINEAR)


def distance(a: Image.Image, b: Image.Image) -> float:
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3


def edge_is_line(gray: Image.Image, box, side: str) -> bool:
    """True if the outermost row/column of `box` on `side` looks like a frame line."""
    x0, y0, x1, y1 = box

    def line(depth: int) -> list[int]:
        if side == "top":
            return list(gray.crop((x0, y0 + depth, x1, y0 + depth + 1)).tobytes())
        if side == "bottom":
            return list(gray.crop((x0, y1 - 1 - depth, x1, y1 - depth)).tobytes())
        if side == "left":
            return list(gray.crop((x0 + depth, y0, x0 + depth + 1, y1)).tobytes())
        return list(gray.crop((x1 - 1 - depth, y0, x1 - depth, y1)).tobytes())

    outer, inner = line(0), line(3)
    mean_o, mean_i = sum(outer) / len(outer), sum(inner) / len(inner)
    std_o = (sum((v - mean_o) ** 2 for v in outer) / len(outer)) ** 0.5
    return std_o < 10 and abs(mean_o - mean_i) > 30


def nudge_box(im: Image.Image, box):
    """Shift `box` (same size) away from frame lines at its edges. Returns (box, (dx, dy))."""
    gray = im.convert("L")
    dx = dy = 0
    for side, step in (("top", (0, 1)), ("bottom", (0, -1)), ("left", (1, 0)), ("right", (-1, 0))):
        for _ in range(MAX_NUDGE):
            b = (box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy)
            if not edge_is_line(gray, b, side):
                break
            dx, dy = dx + step[0], dy + step[1]
    dx = max(-MAX_NUDGE, min(MAX_NUDGE, dx))
    dy = max(-MAX_NUDGE, min(MAX_NUDGE, dy))
    return (box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy), (dx, dy)


def frame_lines_inside(im: Image.Image, box) -> list[str]:
    """Sides of `box` with a frame-like line within FRAME_CHECK_DEPTH px inside it."""
    gray = im.convert("L")
    x0, y0, x1, y1 = box
    found = []
    for side in ("top", "bottom", "left", "right"):
        for d in range(FRAME_CHECK_DEPTH + 1):
            b = {"top": (x0, y0 + d, x1, y1), "bottom": (x0, y0, x1, y1 - d),
                 "left": (x0 + d, y0, x1, y1), "right": (x0, y0, x1 - d, y1)}[side]
            if edge_is_line(gray, b, side):
                found.append(f"{side} at {d} px")
                break
    return found


def save_webp(im: Image.Image, path: Path) -> None:
    im.convert("RGB").save(path, "WEBP", quality=WEBP_QUALITY, method=6)


# ---------------------------------------------------------------------- extraction

def extract_scans(pdf: Path, tmp: Path, native: bool = False) -> list[tuple[str, Image.Image]]:
    """Return [(scan_id, image)] in drawing order, one image per card face.

    scan_id is "p<page>-<image number>" as reported by `pdfimages -list`, with
    "-front"/"-back" for the two faces of a double-faced card. Unless `native` is set,
    every face is brought to the 150 ppi of most scans (see to_card_size).
    """
    out_dir = tmp / pdf.stem
    out_dir.mkdir(exist_ok=True)
    subprocess.run(["pdfimages", "-all", "-p", str(pdf), str(out_dir / "i")], check=True)
    raw = []
    for f in sorted(out_dir.iterdir()):
        _, page, num = f.stem.split("-")
        with Image.open(f) as im:
            raw.append((f"p{int(page)}-{int(num)}", im.convert("RGB")))

    scans = []
    i = 0
    while i < len(raw):
        sid, im = raw[i]
        if im.width == 375 and im.height in (173, 175):
            # Some sheets store a card as three horizontal strips (173 + 175 + 175 px).
            strips = [s for _, s in raw[i:i + 3]]
            if len({s.width for s in strips}) != 1 or [s.height for s in strips] != [173, 175, 175]:
                raise SystemExit(f"{pdf.name}: unexpected strip layout at image {sid}")
            card = Image.new("RGB", (375, 523))
            y = 0
            for s in strips:
                card.paste(s, (0, y))
                y += s.height
            scans.append((sid, card))
            i += 3
            continue
        ratio = im.width / im.height
        if 1.3 < ratio < 1.6:
            # Both faces of a double-faced card side by side.
            half = im.width // 2
            scans.append((sid + "-front", im.crop((0, 0, half, im.height))))
            scans.append((sid + "-back", im.crop((half, 0, im.width, im.height))))
        elif 0.69 < ratio < 0.74:
            scans.append((sid, im))
        else:
            raise SystemExit(f"{pdf.name}: image {sid} ({im.width}x{im.height}) is not a card")
        i += 1
    if not native:
        scans = [(sid, to_card_size(im)) for sid, im in scans]
    return scans


def to_card_size(im: Image.Image) -> Image.Image:
    """Scans at 150 ppi are kept as they are; 220 and 600 ppi renders are scaled down."""
    if abs(im.width - CARD_SIZE[0]) <= 1 and abs(im.height - CARD_SIZE[1]) <= 1:
        return im
    return im.resize(CARD_SIZE, Image.LANCZOS)


def load_oracle(pattern: str) -> list[tuple[str, str, Image.Image]]:
    """[(card name, path relative to resources, feature)] for oracle renders.

    A render that repeats an earlier one (some sets reuse a basic land) is skipped.
    """
    out = []
    for f in sorted(RES_DIR.glob(pattern)):
        if f.suffix.lower() not in (".jpg", ".png"):
            continue
        # _backs holds card backs, plus the back face of Anakin // Vader.
        if f.parent.name == "_backs" and f.stem.lower() == "back":
            continue
        with Image.open(f) as im:
            feat = feature(im)
        if any(distance(feat, o[2]) < 0.5 for o in out):
            continue
        out.append((f.stem, f.relative_to(RES_DIR).as_posix(), feat))
    return out


def title_feature(im: Image.Image) -> Image.Image:
    """The title bar (top 12% of the card), used to double-check weak matches."""
    w, h = im.size
    return im.convert("RGB").crop((0, 0, w, round(h * 0.12))).resize((120, 16), Image.BILINEAR)


# ------------------------------------------------------------------------ matching

def oracle_key(rel: str) -> str:
    """'SWTG - TLJ/mythics/Supreme Leader Snoke.jpg' -> 'SWTG - TLJ/Supreme Leader Snoke'."""
    return f"{rel.split('/')[0]}/{Path(rel).stem}"


def template_for(card: dict, oracle_rel: str | None = None) -> str:
    src, typ = card["source"], card.get("type", "")
    if oracle_rel and oracle_key(oracle_rel) in TEMPLATE_OVERRIDES:
        return TEMPLATE_OVERRIDES[oracle_key(oracle_rel)]
    if "basiclands" in src:
        return "fullart-land"
    if "vader" in src:
        return "m15-dfc"
    if oracle_rel and oracle_rel.split("/")[0] in FRAMES_LISTED:
        return "m15"
    if "tokens" in src or card.get("rarity") == "T":
        return "token-text" if card.get("text") else "token"
    if typ.startswith("Planeswalker"):
        return "planeswalker"
    if "Starship" in typ:
        return "futureshifted"
    return "m15"


def type_hint(card: dict) -> str | None:
    """Frame family the type line suggests, to double-check TEMPLATE_OVERRIDES."""
    typ = card.get("type", "")
    if not typ:
        return None
    if card.get("rarity") == "T" or typ.startswith(("Token", "Emblem")):
        return "token"
    if "Planeswalker" in typ:
        return "planeswalker"
    if "Starship" in typ:
        return "futureshifted"
    return None


def land_type(im: Image.Image) -> str:
    """Type a basic land by the mana symbol in the centre of its type bar."""
    px = im.load()
    pts = [px[x, y] for x in range(180, 195) for y in range(440, 455)]
    r, g, b = (sum(p[i] for p in pts) / len(pts) / 255 for i in range(3))
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.35:
        return "Swamp"
    if s < 0.15:
        return "Plains"
    if h < 0.08 or h > 0.92:
        return "Mountain"
    if 0.25 < h < 0.5:
        return "Forest"
    if 0.5 <= h < 0.75:
        return "Island"
    raise SystemExit(f"cannot classify basic land symbol colour hsv=({h:.2f},{s:.2f},{v:.2f})")


def best_two(feat: Image.Image, refs: list[tuple[str, str, Image.Image]]):
    ds = sorted((distance(feat, f), name, rel) for name, rel, f in refs)
    return ds[0], (ds[1] if len(ds) > 1 else (99.0, "", ""))


def match_source(cards: list[dict], scans: list[tuple[str, Image.Image]],
                 oracle: list[tuple[str, str, Image.Image]]):
    """Assign one scan to each card, nearest pairs first, never reusing a scan.

    Returns (assigned {card name: info}, unused scan ids, {duplicate scan: original},
    {card name: message} for cards with no oracle render of their name).
    """
    feats = {sid: feature(im) for sid, im in scans}
    ids = list(feats)
    # Scans that repeat an earlier scan (the common tokens are printed twice).
    dup_of = {}
    for i, a in enumerate(ids):
        for b in ids[:i]:
            if b not in dup_of and distance(feats[a], feats[b]) < 0.5:
                dup_of[a] = b
                break
    candidates = [s for s in ids if s not in dup_of]
    dist = {(s, rel): distance(feats[s], f) for s in candidates for _, rel, f in oracle}

    by_name: dict[str, list[str]] = {}
    for oname, rel, _ in oracle:
        by_name.setdefault(norm_name(oname), []).append(rel)
    alias = {norm_name(a): norm_name(stem) for stem, names in ORACLE_ALIASES.items()
             for a in names}
    wanted, unknown = {}, {}
    for card in cards:
        own = norm_name(card["name"].split("//")[0])
        # Aliases first: three emblems may share the name of the first one's render.
        keys = [alias[k] for k in (own, norm_name(card.get("type", ""))) if k in alias] + [own]
        rels = next((by_name[k] for k in keys if k in by_name), None)
        if not rels:
            close = difflib.get_close_matches(own, list(by_name), n=3, cutoff=0.6)
            hint = ", ".join(Path(by_name[k][0]).stem for k in close) or "nothing close"
            unknown[card["name"]] = (f"no oracle render named like it (closest: {hint}); "
                                     f"add it to ORACLE_ALIASES")
            continue
        # A double-faced card has its back face in _backs; identify by the front.
        wanted[card["name"]] = sorted(rels, key=lambda r: "/_backs/" in r)[0]
    claimed: dict[str, str] = {}
    for name, rel in list(wanted.items()):
        if rel in claimed:
            unknown[name] = f"same oracle render as {claimed[rel]!r} ({rel})"
            del wanted[name]
        else:
            claimed[rel] = name

    pairs = sorted((dist[(s, rel)], name, s, rel) for name, rel in wanted.items() for s in candidates)
    assigned, used = {}, set()
    for d, name, sid, rel in pairs:
        if name in assigned or sid in used:
            continue
        # Second best: the next-closest oracle render to this scan, or the next-closest
        # scan to this render, whichever is nearer.
        other_oracle = min((v for (s, r), v in dist.items() if s == sid and r != rel), default=99.0)
        other_scan = min((v for (s, r), v in dist.items() if r == rel and s != sid), default=99.0)
        second = min(other_oracle, other_scan)
        assigned[name] = {"scan": sid, "oracle": rel, "dist": d, "second": second,
                          "margin": second - d}
        used.add(sid)
    unused = [s for s in ids if s not in used]
    return assigned, unused, dup_of, unknown


# ---------------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--report", action="store_true", help="print the per-card match table")
    ap.add_argument("--raw-cards", type=Path, default=RAW_CARDS, metavar="PATH",
                    help="card list to map (default: src/data/rawCards.json)")
    ap.add_argument("--out", type=Path, metavar="DIR",
                    help="write cards/{art,full}/ and cardArt.json below DIR instead of "
                         "public/ and src/data/")
    ap.add_argument("--dry-run", action="store_true",
                    help="like --out with a new temp dir (kept, path printed at the end); "
                         "nothing in public/ or src/data/ is touched")
    args = ap.parse_args()

    if not shutil.which("pdfimages"):
        raise SystemExit("pdfimages (poppler) is required on PATH")
    out_dir = args.out
    if args.dry_run and out_dir is None:
        out_dir = Path(tempfile.mkdtemp(prefix="cardforge-art-dry-"))
    if out_dir is None:
        out_art, out_full, out_map = OUT_ART, OUT_FULL, OUT_MAP
    else:
        out_art, out_full = out_dir / "cards" / "art", out_dir / "cards" / "full"
        out_map = out_dir / "cardArt.json"

    raw_cards = json.loads(args.raw_cards.read_text(encoding="utf-8"))
    report, problems, notes = [], [], []
    by_source: dict[str, list[dict]] = {}
    for c in raw_cards:
        cards = by_source.setdefault(c["source"], [])
        if any(o["name"] == c["name"] for o in cards):
            problems.append(f"{c['source']}::{c['name']}: name used twice in this source; "
                            f"cardArt.json needs unique names per source, second one skipped")
            continue
        cards.append(c)

    for d in (out_art, out_full):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)

    mapping = {"version": 1, "cards": {}, "landVariants": {t: [] for t in LAND_TYPES}}
    keys_seen: set[str] = set()
    sizes: dict[str, tuple[int, int]] = {}

    def emit(key: str, im: Image.Image, template: str, okey: str = "") -> dict:
        if key in keys_seen:
            raise SystemExit(f"duplicate asset key {key}")
        keys_seen.add(key)
        box, shift = nudge_box(im, CROPS[template])
        if shift != (0, 0):
            notes.append(f"{key}: art crop nudged by {shift} px (frame line at the crop edge)")
        inside = frame_lines_inside(im, box)
        if inside and okey in FRAME_CHECK_EXEMPT:
            notes.append(f"{key}: line inside the crop ({', '.join(inside)}), checked by eye: "
                         f"{FRAME_CHECK_EXEMPT[okey]}")
        elif inside:
            problems.append(f"{key}: frame-like line inside the {template} crop "
                            f"({', '.join(inside)}); template or box does not fit")
        art = im.crop(box)
        save_webp(im, out_full / f"{key}.webp")
        save_webp(art, out_art / f"{key}.webp")
        sizes[key] = art.size
        return {"art": f"{URL_PREFIX}/art/{key}.webp", "full": f"{URL_PREFIX}/full/{key}.webp",
                "w": art.width, "h": art.height, "fullW": im.width, "fullH": im.height}

    title_cache: dict[str, Image.Image] = {}

    def title_of(rel: str) -> Image.Image:
        if rel not in title_cache:
            with Image.open(RES_DIR / rel) as im:
                title_cache[rel] = title_feature(im)
        return title_cache[rel]

    def check(source, name, sid, template, d, second, oracle_rel, scan=None, oracle=None,
              size=None):
        margin = second - d
        flag = "ok"
        if d > MATCH_WARN or margin < MARGIN_WARN:
            card_name = norm_name(name.split(" (back face")[0])
            checked = next((v for k, v in CHECKED_WEAK_MATCHES.items()
                            if norm_name(k) == card_name), None)
            if checked:
                notes.append(f"{source}::{name}: weak match d={d:.2f} margin={margin:.2f}, "
                             f"checked by eye: {checked}")
                report.append((source, name, sid, template, size, d, second, margin, "checked"))
                return
            flag = "CHECK"
            extra = ""
            if scan is not None and oracle:
                # Compare title bars only: holds up when the art differs between versions.
                t = title_feature(scan)
                ranked = sorted((distance(t, title_of(rel)), rel) for _, rel, _ in oracle)
                own = next(v for v, rel in ranked if rel == oracle_rel)
                rival = next(v for v, rel in ranked if rel != oracle_rel)
                extra = f"; title bar d={own:.2f} vs next {rival:.2f}"
                flag = f"CHECK title {own:.1f}/{rival:.1f}"
            problems.append(f"{source}::{name}: weak match d={d:.2f} margin={margin:.2f} "
                            f"(scan {sid}, oracle {oracle_rel}){extra}")
        report.append((source, name, sid, template, size, d, second, margin, flag))

    land_feats: list[tuple[str, Image.Image]] = []   # (asset key, feature) of land variants
    sheet_lands = []  # land printings found on expansion sheets, added after the land sheet

    with tempfile.TemporaryDirectory(prefix="cardforge-art-") as tmp_name:
        tmp = Path(tmp_name)
        oracle_cache: dict[str, list] = {}
        for source in sorted(by_source):
            cards = by_source[source]
            pdf = CARDS_DIR / source
            if not pdf.exists():
                problems.append(f"{source}: PDF missing, {len(cards)} cards without art")
                continue
            scans = extract_scans(pdf, tmp)
            scan_img = dict(scans)
            short = source_short(source)

            if "basiclands" in source:
                land_oracle = load_oracle("*/basiclands/*")
                prefix_types: dict[str, set] = {}
                counters = {t: 0 for t in LAND_TYPES}
                for sid, im in scans:
                    t = land_type(im)
                    counters[t] += 1
                    n = counters[t]
                    key = f"land-{t.lower()}-{n}"
                    entry = emit(key, im, "fullart-land")
                    mapping["landVariants"][t].append(entry["art"])
                    land_feats.append((key, feature(im)))
                    if n == 1:
                        for c in cards:
                            if c["name"] == t:
                                mapping["cards"][f"{source}::{t}"] = entry
                    # Cross-check against the oracle land renders (LA1..LE4, Swamp.jpg, ...)
                    (d1, oname, orel), (d2, _, _) = best_two(feature(im), land_oracle)
                    if d1 < MATCH_WARN:
                        prefix = re.sub(r"\d+$", "", oname)
                        prefix_types.setdefault(prefix, set()).add(t)
                        if prefix in LAND_TYPES and prefix != t:
                            problems.append(f"land scan {sid}: symbol says {t}, oracle says {prefix}")
                        label = f"{t} #{n} = {orel.split('/')[0][7:]}/{oname}"
                        check(source, label, sid, "fullart-land", d1, d2, orel,
                              size=sizes[key])
                    else:
                        notes.append(f"land scan {sid} ({t} #{n}): no oracle render, typed by symbol only")
                        report.append((source, f"{t} #{n} (no oracle)", sid, "fullart-land",
                                       sizes[key], d1, None, None, "symbol"))
                for prefix, types in prefix_types.items():
                    if len(types) > 1:
                        problems.append(f"oracle lands {prefix}*: scans typed as {sorted(types)}")
                for c in cards:
                    if f"{source}::{c['name']}" not in mapping["cards"]:
                        problems.append(f"{source}::{c['name']}: no land scan of that type")
                continue

            oset = oracle_set(source)
            if oset not in oracle_cache:
                oracle_cache[oset] = load_oracle(f"{oset}/*/*")
            oracle = oracle_cache[oset]
            assigned, unused, dup_of, unknown = match_source(cards, scans, oracle)
            for c in cards:
                name = c["name"]
                a = assigned.get(name)
                if a is None:
                    problems.append(f"{source}::{name}: no scan matched"
                                    + (f": {unknown[name]}" if name in unknown else ""))
                    continue
                template = template_for(c, a["oracle"])
                hint = type_hint(c)
                if hint and not template.startswith(hint):
                    notes.append(f"{source}::{name}: type line suggests a {hint} frame, "
                                 f"{template} is used ({oracle_key(a['oracle'])})")
                key = f"{short}-{slug(name)}"
                entry = emit(key, scan_img[a["scan"]], template, oracle_key(a["oracle"]))
                check(source, name, a["scan"], template, a["dist"], a["second"], a["oracle"],
                      scan_img[a["scan"]], oracle, size=sizes[key])
                if a["scan"].endswith("-front"):
                    back_id = a["scan"][:-len("-front")] + "-back"
                    back = emit(f"{key}-back", scan_img[back_id], template)
                    entry["artBack"], entry["fullBack"] = back["art"], back["full"]
                    (d1, oname, orel), (d2, _, _) = best_two(feature(scan_img[back_id]), oracle)
                    check(source, f"{name} (back face = {orel.split('/', 1)[1]})", back_id,
                          template, d1, d2, orel, scan_img[back_id], oracle,
                          size=sizes[f"{key}-back"])
                mapping["cards"][f"{source}::{name}"] = entry
            for sid in unused:
                if sid.endswith("-back"):
                    continue
                if sid in dup_of:
                    notes.append(f"unused scan {source} {sid}: duplicate of {dup_of[sid]}")
                    continue
                (d1, oname, orel), (d2, _, _) = best_two(feature(scan_img[sid]), oracle)
                if "/basiclands/" in orel and d1 < MATCH_WARN:
                    sheet_lands.append((source, sid, scan_img[sid], oname, orel, d1, d2))
                    continue
                notes.append(f"unused scan {source} {sid}: not in rawCards (looks like {oname!r})")

        # Basic lands printed on the expansion sheets join the variants of their type,
        # unless the basic land sheet already has the same printing.
        for source, sid, im, oname, orel, d1, d2 in sheet_lands:
            t = land_type(im)
            if oname in LAND_TYPES and oname != t:
                problems.append(f"land scan {source} {sid}: symbol says {t}, oracle says {oname}")
            feat = feature(im)
            same = min(((distance(feat, f), k) for k, f in land_feats), default=(99.0, ""))
            label = f"{t}, {orel.split('/')[0][7:]}/{oname}"
            if same[0] < LAND_DUP_DIST:
                notes.append(f"land scan {source} {sid} ({t}, {orel}): same printing as "
                             f"{same[1]} (d={same[0]:.2f}), not added again")
                report.append((source, f"{label} = {same[1]}", sid, "fullart-land", None,
                               d1, d2, d2 - d1, "duplicate"))
                continue
            key = f"land-{t.lower()}-{len(mapping['landVariants'][t]) + 1}"
            entry = emit(key, im, "fullart-land")
            mapping["landVariants"][t].append(entry["art"])
            land_feats.append((key, feat))
            check(source, f"{label} -> {key}", sid, "fullart-land", d1, d2, orel, size=sizes[key])

    mapping["cards"] = dict(sorted(mapping["cards"].items()))
    out_map.parent.mkdir(parents=True, exist_ok=True)
    out_map.write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if args.report:
        print(f"{'source':28} {'card':40} {'scan':12} {'template':17} {'crop':>7} "
              f"{'dist':>6} {'2nd':>6} {'margin':>6}")
        for src, name, sid, tpl, size, d, s, m, flag in report:
            nums = " ".join(f"{v:6.2f}" if v is not None else "     -" for v in (d, s, m))
            crop = f"{size[0]}x{size[1]}" if size else "-"
            print(f"{src:28} {name[:40]:40} {sid:12} {tpl:17} {crop:>7} {nums}  {flag}")
    files = [f for d in (out_art, out_full) for f in d.iterdir()]
    size = sum(f.stat().st_size for f in files)
    print(f"cards mapped: {len(mapping['cards'])}/{len(raw_cards)}")
    print("land variants: " + ", ".join(f"{t} {len(v)}" for t, v in mapping["landVariants"].items()))
    print(f"assets: {len(files)} files, {size / 1e6:.2f} MB")
    for line in notes:
        print("note:", line)
    for line in problems:
        print("PROBLEM:", line)
    if out_dir is not None:
        print(f"output written below {out_dir}")
    return 1 if len(mapping["cards"]) != len(raw_cards) else 0


if __name__ == "__main__":
    sys.exit(main())
