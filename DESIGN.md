---
name: CardForge
description: A dark, quiet workbench for building Star Wars TCG booster packs, opening them, and printing sheets.
colors:
  void: "#07090e"
  well: "oklch(12.9% 0.042 264.695)"
  panel: "oklch(20.8% 0.042 265.755)"
  raised: "oklch(27.9% 0.041 260.031)"
  raised-hover: "oklch(37.2% 0.044 257.287)"
  line: "oklch(27.9% 0.041 260.031)"
  line-strong: "oklch(37.2% 0.044 257.287)"
  fg-strong: "#ffffff"
  fg: "oklch(96.8% 0.007 247.896)"
  fg-soft: "oklch(86.9% 0.022 252.894)"
  fg-muted: "oklch(70.4% 0.04 256.788)"
  accent: "oklch(78.9% 0.154 211.53)"
  accent-hover: "oklch(86.5% 0.127 207.078)"
  accent-ink: "oklch(12.9% 0.042 264.695)"
  accent-fg: "oklch(86.5% 0.127 207.078)"
  accent-soft: "oklch(30.2% 0.056 229.695)"
  accent-line: "oklch(60.9% 0.126 221.723)"
  foil: "oklch(82.8% 0.189 84.429)"
  foil-hover: "oklch(87.9% 0.169 91.605)"
  foil-ink: "oklch(27.9% 0.077 45.635)"
  rarity-c: "oklch(86.9% 0.022 252.894)"
  rarity-u: "oklch(82.8% 0.111 230.318)"
  rarity-r: "oklch(87.9% 0.169 91.605)"
  rarity-m: "oklch(75% 0.183 55.934)"
  rarity-m-soft: "oklch(26.6% 0.079 36.259)"
  rarity-m-line: "oklch(55.3% 0.195 38.402)"
  rarity-l: "oklch(84.5% 0.143 164.978)"
  rarity-t: "oklch(82.7% 0.119 306.383)"
  mana-w: "oklch(96.2% 0.059 95.617)"
  mana-u: "oklch(62.3% 0.214 259.815)"
  mana-b: "oklch(43.9% 0 none)"
  mana-r: "oklch(58.6% 0.253 17.585)"
  mana-g: "oklch(59.6% 0.145 163.225)"
  mana-multi: "oklch(82.8% 0.189 84.429)"
  mana-c: "oklch(70.5% 0.015 286.067)"
  success: "oklch(76.5% 0.177 163.223)"
  warning: "oklch(87.9% 0.169 91.605)"
  danger: "oklch(71.2% 0.194 13.428)"
  danger-soft: "oklch(27.1% 0.105 12.094)"
typography:
  wordmark:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  stat:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3333
    fontFeature: "'pnum'"
  section:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.3
  group:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.07em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4286
    fontFeature: "'tnum'"
  helper:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3333
    fontFeature: "'tnum'"
  control:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.25
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  card-name:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.2
    fontVariation: "'wdth' 87.5"
  card-cost:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
  card-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 87.5"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  card: "0.8rem"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  panel: "20px"
  section: "24px"
  gutter-lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-md:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.control}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.raised-hover}"
    textColor: "{colors.fg-strong}"
  button-ghost:
    textColor: "{colors.fg-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg-strong}"
  button-danger:
    textColor: "{colors.danger}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "32px"
  button-danger-hover:
    backgroundColor: "{colors.danger-soft}"
  button-foil:
    backgroundColor: "{colors.foil}"
    textColor: "{colors.foil-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-foil-hover:
    backgroundColor: "{colors.foil-hover}"
  chip:
    backgroundColor: "{colors.well}"
    textColor: "{colors.fg-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-fg}"
  field:
    backgroundColor: "{colors.well}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  nav-item:
    textColor: "{colors.fg-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-fg}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  stat-tile:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.3xl}"
    width: "min(100% - 2rem, 32rem)"
  toast:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    padding: "8px 8px 8px 16px"
  card-face:
    rounded: "{rounded.card}"
    padding: "6px"
---

# Design System: CardForge

## Overview

**Creative North Star: "The Collector's Light Table"**

CardForge is a dark, quiet workbench. The card art is the most saturated thing on screen. Everything else (header, panels, tables, controls) sits on a cool slate-navy ramp and recedes, the way a light table disappears under the cards laid on it. Chrome is flat and separated by tonal steps and hairline borders. Cards are the objects on the table, and they are the only things that cast shadows.

Two accents, two jobs. Hologram Cyan marks tools and data: the primary action, selected states, focus, caret, selection, and the distribution bars. Foil Gold is held back for the one authored moment, the pack-opening ceremony, where you tear the wrapper, flip the cards one by one, and a mythic gets a light sweep and confetti. The rest of the product is Operate mode: dense, legible, keyboard-friendly, with 44px touch targets on coarse pointers.

Controls are precise and quiet: small radii, hairline borders, one bright filled action. Nothing in the chrome competes with the art.

**Key Characteristics:**
- Dark only (`color-scheme: dark`), deepest surface is a near-black blue-void.
- Tonal layers for chrome, real shadows only for cards, the pack wrapper, dialogs and toasts.
- One typeface, Archivo variable. Card faces use its semi-condensed width (87.5%).
- Tabular numerals everywhere by default. Large stat values switch to proportional.
- Identity color (mana, rarity) lives in swatches, pips, frames and badges, all drawn from two lookup maps.
- Motion uses one curve, expo-out, and every movement has a reduced-motion alternative.

## Colors

A cool slate-navy ramp for chrome, one electric cyan for tools, one warm foil gold for ceremony, and a separate identity vocabulary (mana, rarity) that belongs to the cards.

### Primary
- **Hologram Cyan** (`accent`, oklch(78.9% 0.154 211.53)): fill of the primary action button, the wordmark tile, distribution bars, `::selection`, the focus ring, caret and native `accent-color`. Carries **Accent Ink** (`accent-ink`, the well color) as text, never white. Hover brightens to **Hologram Cyan Bright** (`accent-hover`).
- **Cyan Glow** (`accent-fg`): cyan text on dark, used for selected chip and nav labels, the toast Undo action, and icons in an active toggle.
- **Cyan Depth** (`accent-soft`) and **Cyan Edge** (`accent-line`): the fill and border pair for selected chips, the active nav item, the selected pack in the strip, and the tinted icon tile in panel headers.

### Secondary
- **Foil Gold** (`foil`, oklch(82.8% 0.189 84.429)): the pack-opening signature. Fills the Open pack button and the Tear open pill on the wrapper, tints the wrapper border, the card back's rings and its "CardForge" mark. Carries **Foil Ink** (`foil-ink`), a deep amber-brown. Hover goes to **Foil Bright** (`foil-hover`).

### Tertiary (identity vocabulary, cards only)
- **Rarity identity** (`rarity-c` Pale Slate, `rarity-u` Sky, `rarity-r` Gold Leaf, `rarity-m` Mythic Ember, `rarity-l` Jade, `rarity-t` Lilac): the rarity gem on each card face, rarity badges, rarity counts in the database summary, and the mythic tone of the toggle chip. All are light (75 to 88% L) so they read on every surface. Mythic also has a fill and an edge, **Ember Depth** (`rarity-m-soft`) and **Ember Edge** (`rarity-m-line`), for mythic badges, the mythic chip tone and the mythic card's shadow tint.
- **Mana identity** (`mana-w` Parchment, `mana-u` Deep Blue, `mana-b` Graphite, `mana-r` Crimson, `mana-g` Forest, `mana-multi` Gold, `mana-c` Ash): pip fills, swatch dots, and the tint of each card frame's gradient and borders.
- **Status** (`success` Emerald, `warning` Amber, `danger` Rose, `danger-soft` Rose Depth): toast icons, balance verdicts, destructive buttons, invalid field borders.

### Neutral
- **Void** (`void`, #07090e): the page and header background. The table under everything.
- **Well** (`well`): recessed areas: inputs, steppers, stat tiles, unselected chips, the desktop nav tray, the ceremony stage, the scrollbar track.
- **Panel** (`panel`): section panels and dialogs.
- **Raised** (`raised`) and **Raised Hover** (`raised-hover`): secondary buttons, toasts, ghost-button and row hovers.
- **Hairline** (`line`) and **Hairline Strong** (`line-strong`): panel and divider borders (`line`); control, dialog, toast borders and the scrollbar thumb (`line-strong`).
- **Paper White** (`fg-strong`), **Mist** (`fg`), **Haze** (`fg-soft`), **Dusk** (`fg-muted`): text from headings to helper copy. All four clear 4.5:1 on Panel and Raised.

### Named Rules
**The Light Table Rule.** The card art is the most saturated thing on screen. Chrome draws only from the slate ramp, Hologram Cyan and status colors; any new chrome color has to lose to the art.

**The One Bright Action Rule.** A view carries one filled Hologram Cyan button, its primary action. Everything else is secondary (Raised), ghost, or a soft cyan selection state. Selection is shown with Cyan Depth fills and Cyan Edge borders, never a second solid cyan fill.

**The Foil Is Ceremony Rule.** In the app chrome, Foil Gold appears only in pack opening: the Open pack button, the wrapper, the card back. Never use it for a generic highlight, badge or warning; warnings use `warning`.

**The Swatch Speaks Rule.** Text never wears mana colors. A color's identity comes from the swatch, pip or frame beside the text, which stays in the neutral text ramp. Rarity colors may tint short labels and counts, and only through the RARITY map.

**The Single Source Rule.** Rarity and mana presentation comes only from the `RARITY` and `MANA` maps in `src/utils/cardHelpers.ts` (label, text, badge; swatch, frame, bar). Don't compose identity styling inline from raw palette steps; add a field to the map.

## Typography

**Display Font:** Archivo (with ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Archivo
**Label/Mono Font:** Archivo (no mono; numerals are tabular instead)

**Character:** One grotesque in two widths. Normal width (100%) for the app, semi-condensed (87.5%) for card faces, so cards read like printed objects with their own type, without a second family. Loaded as a variable font (wght 400–800, wdth 87.5–100) from Google Fonts in `index.html`.

### Hierarchy
- **Wordmark** (800, 1.125rem, 1.2, -0.01em): the "CardForge" name in the header. Used once.
- **Stat** (700, 1.5rem, proportional numerals): big values in the booster stat tiles.
- **Section** (700, 1.0625rem, 1.3): panel and dialog headings ("Booster packs", "Opening pack 3").
- **Group** (700, 0.75rem, 1.3, 0.07em, uppercase): sub-group headings inside a panel, set in Haze.
- **Body** (400, 0.875rem, 1.43, tabular numerals): paragraphs, table cells, field text, md buttons, nav labels.
- **Helper** (400, 0.75rem, 1.33): captions, stat descriptions, table headers, counts.
- **Control** (600, 0.8125rem, 1.25): sm buttons, chips, pack-strip buttons.
- **Label** (600, 0.6875rem, 1.2, 0.08em, uppercase): small printed marks on card and pack objects only (the Foil tag, the card back mark, the wrapper's product line).
- **Card name** (700, 0.8125rem, 1.2, semi-condensed), **Card cost** (700, 0.75rem, 1), **Card small** (400–500, 0.6875rem, 1.4, 0.01em, semi-condensed): text on card thumbnails. The inspect dialog shows the same text at 14px.

### Named Rules
**The Tabular Default Rule.** `body` sets `font-variant-numeric: tabular-nums`, so counters, pack numbers and table columns don't shift when values change. Only the large Stat values opt out to proportional numerals.

**The 11px Floor Rule.** No text below 11px (0.6875rem). 11px is reserved for card faces and pack/card objects (`card-small`, `label`, mana pip glyphs). App chrome starts at 12px. The only exemption is the scaled paper miniature in the print-sheet preview, which is a hidden illustration of the sheet; its card names are exposed to assistive tech at full size.

**The Two Widths Rule.** Semi-condensed width (`font-stretch: semi-condensed`, 87.5%) belongs to card and pack faces. Chrome uses normal width.

## Layout

The app is a single centered column (max 80rem, `max-w-7xl`) with gutters of 16px, 24px from 640px and 32px from 1024px. The main column stacks sections 24px apart. Panels pad 20px. Inner gaps are 8px and 12px, with 16px between larger groups.

The header is sticky, 56px tall (64px from 640px), on Void with a hairline bottom border, blurred and slightly translucent from 640px up. There is a single navigation element: inline in the header as a segmented tray from 640px, docked to the bottom of the screen as a two-column tab bar below 640px (safe-area padded). Toasts sit above the bottom bar on phones and 24px from the bottom on desktop.

Card grids use one utility: two columns with 12px gaps on phones, then as many ~200px (12.5rem) columns as fit with 16px gaps from 640px. Stat tiles go from 2 to 4 columns at 1024px. In the color table, the two right-hand columns fold under the row name below 640px.

Breakpoints: 640px (sm, the main switch), 768px (md), 1024px (lg). Card faces also use a container query: below 11.5rem wide, the rules text box drops, the name wraps to two lines, and the art window grows to fill.

On coarse pointers, every button, chip, stepper button and nav item grows to a 44px minimum target.

## Elevation & Depth

Hybrid, with a strict split. Chrome is flat: depth comes from the surface steps Void → Well → Panel → Raised and from hairline borders, and panels may sit at partial opacity (Panel at 40–80%) over Void. Real offset shadows belong only to objects on the table, meaning cards and the pack wrapper, plus overlays that float above it (dialogs and toasts). Shadows are black at 50–70% alpha, because on a near-black ground a lighter shadow disappears.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)`): every card thumbnail. Mythic face-up cards tint it with Ember Depth at 50%.
- **Card lift** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.6), 0 8px 10px -6px rgb(0 0 0 / 0.6)`): card hover, together with a 4px rise.
- **Toast** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)`): the single toast.
- **Overlay** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.6)`): dialogs; the pack wrapper uses the same shape at 70%.
- **Pip** (`box-shadow: 0 1px 1px rgb(0 0 0 / 0.5)`): mana pips sitting on the card's title bar.
- **Backdrop** (`background: rgb(2 6 23 / 0.82); backdrop-filter: blur(6px)`): behind every modal dialog.

### Named Rules
**The Cards Lift Rule.** If it isn't a card, the pack wrapper, a dialog or a toast, it has no shadow. Separate chrome with a surface step or a hairline instead.

## Shapes

Small, consistent radii in the chrome and a slightly rounder object scale. Chips, fields, nav items and pack-strip buttons use 8px. Buttons, icon buttons, the stepper and stat tiles use 12px. Panels and toasts use 16px, while dialogs and the ceremony stage use 24px. On phones a dialog becomes a bottom sheet with square bottom corners. Inside a card, bars and the art window use 6px and the rarity gem uses 4px.

The card face is fixed at **63:88** (a real trading card) with a 0.8rem corner and a 2px identity-tinted border. The art window keeps the SWTG frame proportion **311:226**. The pack wrapper is 5:8 with crimped foil strips (repeating amber stripes) top and bottom. Pips and swatches are circles.

Borders are 1px hairlines everywhere in chrome, and 2px only on card and wrapper edges.

**The 63:88 Rule.** A card face always renders at 63:88, at every size and in every context (grid, ceremony, inspect). Responsive behavior changes what's inside the card, never its proportion.

## Components

### Buttons
Precise and quiet: one filled accent, the rest recede.
- **Shape:** gently squared (12px radius). Two sizes: sm (32px tall, 12px side padding, Control type) and md (40px, 16px, Body type). Both grow to 44px on coarse pointers. Icon buttons are square at the same heights and use the label as `aria-label` and tooltip.
- **Primary:** Hologram Cyan fill, Accent Ink text, semibold. Hover goes to Hologram Cyan Bright.
- **Secondary (default):** Raised fill, Mist text, Hairline Strong border. Hover goes to Raised Hover with Paper White text.
- **Ghost:** no fill, Dusk text. Hover gives a Raised fill and Paper White text.
- **Danger:** Rose text, transparent border. Hover gives a Rose Depth fill and a rose border.
- **Foil:** Foil Gold fill and Foil Ink text, for pack opening only.
- **States:** color transitions take 150ms. On press the button nudges down 1px (no nudge with reduced motion). Disabled is 50% opacity with a not-allowed cursor. Focus is the global 2px cyan ring at 2px offset.

### Chips
- **Style:** toggle buttons with `aria-pressed`, 8px radius, 1px border, Control type. Unselected: Well fill, Dusk text, Hairline border, brightening on hover.
- **State:** selected tones are *accent* (Cyan Depth and Cyan Glow with a Cyan Edge border), *mythic* (Ember Depth fill, Ember Edge border, Mythic Ember text) and *inverse* (Mist fill with Well text). The pack strip and set checkboxes use the same selected/unselected pattern.

### Cards / Containers
- **Corner Style:** panels 16px, stat tiles 12px.
- **Background:** Panel for sections (60–80% for secondary panels and empty states). Stat tiles are Well at 70% inside a panel.
- **Shadow Strategy:** none (see The Cards Lift Rule).
- **Border:** Hairline.
- **Internal Padding:** 20px for panels; 12px by 16px for stat tiles. A panel header pairs a 40px Cyan Depth icon tile with a Section heading.

### Inputs / Fields
- **Style:** Well fill, Hairline Strong border, 8px radius, 40px tall, Body type, Dusk placeholder. Labels sit above in Haze, 14px medium.
- **Focus:** the border turns Hologram Cyan, plus the global focus ring. The caret is cyan.
- **Error / Disabled:** `aria-invalid` turns the border Rose.
- **Stepper:** a Well capsule (12px radius, Hairline Strong border) holding minus and plus buttons (32px, 44px on touch) around a bold, tabular, Paper White number field. Typing is free; the value clamps on blur, and the arrow keys step.

### Navigation
- **Desktop (from 640px):** a segmented tray in the header: Well fill, hairline border, 12px radius, 4px padding. Items are 36px, 8px radius, Body semibold, with an icon and a muted count. Active: Cyan Depth fill, Cyan Glow text, Cyan Edge ring, `aria-current="page"`. Inactive: Dusk text, Raised on hover.
- **Phone:** the same element docks to the bottom as a two-column tab bar on Void at 95% with blur. Items are 48px tall with the icon stacked over a 12px label.

### Dialogs
Native `<dialog>` opened with `showModal()`, so it gets a focus trap, an inert background and Escape handling, and focus returns to the opener on close. Panel fill, Hairline Strong border, 24px radius, Overlay shadow, up to 32rem wide. The header and footer are hairline-separated bands with 24px by 16px padding, and actions sit at the end of the footer. Entry is a 200ms fade and 12px rise on expo-out; under reduced motion it only fades. Below 640px it becomes a full-width bottom sheet, up to 94dvh tall.

### Toast
A single slot, polite live region. Raised fill, 16px radius, Hairline Strong border (rose for errors), Toast shadow. It has an emerald or rose status icon, the message, an optional cyan **Undo** text action and a dismiss button. Entry is a 200ms fade and 8px rise; under reduced motion it only fades.

### Card Face (signature component)
The object the whole system serves. A 63:88 button with a 0.8rem radius and a 2px border. The frame gradient, border and title/type bar tints come from `MANA[frameIdentity(card)]`. From top to bottom: a title bar (semi-condensed card name in Paper White plus mana pips), the art window (311:226, Well behind it, swatch dots when there's no art), a type line with the rarity gem from `RARITY`, a rules or flavor text box on a black glass layer (dropped below 11.5rem wide), and a footer with the artist and a power/toughness box. Mythic cards get a 1px Mythic Ember ring and rare cards a Gold Leaf ring. Foil and mythic art carry the holographic **foil sheen** band (gold, cyan, magenta, color-dodge), which sweeps once on appearance (1.4s, expo-out) and replays on hover. Foils get a small uppercase Lilac "Foil" tag. Hover lifts the card 4px and deepens its shadow.

**Card back and flip:** indigo-to-black, with a foil-tinted double rule, a central oval and a "Reveal" cue. Flippable cards rotate in 3D (650ms, expo-out, 1100px perspective). Under reduced motion the two faces crossfade in 200ms.

### Mana Pips
Circles (16px sm, 24px md) with bold symbols. Mana colors fill the circle; white or deep amber ink sits on top for contrast. Generic costs are slate. The raw cost string is screen-reader text.

### Pack-Opening Ceremony (authored moment)
The ceremony stage is a Well panel with a 24px radius. The 5:8 foil wrapper (gold border, crimped stripes, pack art, a gold "Tear open" pill, Overlay shadow) lifts on hover. Tearing plays a 320ms crimp-fly and fade, then cards enter face down in the card grid (300ms fade and rise), and each reveal flips one card. A mythic reveal fires confetti in ember, gold, pink and white plus a chime. Space and Enter drive it from the keyboard. Under reduced motion the tear is instant, flips crossfade, the sheen doesn't sweep and confetti is off.

**The Reduced-Motion Twin Rule.** Every movement ships with a reduced-motion alternative. Flips become crossfades, rises become fades, the tear becomes instant, and the sweep and confetti are dropped. Motion is never the only signal: foil still reads from the rarity ring and the Foil tag.

### Stats and Color Distribution
Stat tiles: a Helper label in Dusk, a Stat value in Paper White, then an optional verdict in success or warning and a helper line. The distribution is a real table. Each row has a mana swatch dot next to a neutral label and a single-color inline bar in Hologram Cyan (80%, full on row hover, 4px right-rounded), on one scale shared across rows. The numbers are tabular and right-aligned.

## Do's and Don'ts

### Do:
- **Do** take every color from the semantic roles in `src/index.css` `@theme` (`bg-panel`, `text-fg-muted`, `bg-accent`), never raw palette steps in chrome.
- **Do** give each view one filled Hologram Cyan button for its primary action. Use Raised secondary or ghost buttons for everything else.
- **Do** separate chrome with surface steps (Void → Well → Panel → Raised) and 1px hairlines.
- **Do** put identity in a swatch, pip, frame or badge from the `MANA` and `RARITY` maps, next to neutral text.
- **Do** keep card faces at 63:88 and art windows at 311:226, and set card text in Archivo's semi-condensed width.
- **Do** use `ease-out-expo` (cubic-bezier(0.16, 1, 0.3, 1)) and keep the durations: 150ms for color, 200ms for overlays and card hover, 300ms for reveals, 650ms for the flip.
- **Do** ship a reduced-motion twin for every movement: a crossfade, an instant state change, or nothing (`motion-safe:` / `motion-reduce:`).
- **Do** give every control a 44px minimum target on coarse pointers.

### Don't:
- **Don't** put a shadow on chrome (panels, tiles, nav, buttons). Only cards, the pack wrapper, dialogs and toasts lift.
- **Don't** use Foil Gold outside pack opening.
- **Don't** color text with mana colors, or style rarity and mana inline outside the maps.
- **Don't** add a second filled cyan button to a view, or use solid cyan for selection.
- **Don't** set text below 11px, or use 11px outside card and pack faces.
- **Don't** let anything in the chrome out-saturate the card art.
