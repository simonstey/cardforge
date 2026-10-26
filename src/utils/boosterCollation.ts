import { Card, BoosterSlotConfig, BoosterPack } from '../types/card';
import { determineColors } from './cardHelpers';

export type StandardColor = 'W' | 'U' | 'B' | 'R' | 'G';
/** Partition buckets: every card falls in exactly one. */
export type ColorBucket = StandardColor | 'Multicolor' | 'Colorless';

const STANDARD_COLORS: StandardColor[] = ['W', 'U', 'B', 'R', 'G'];
export const COLOR_BUCKETS: ColorBucket[] = ['W', 'U', 'B', 'R', 'G', 'Multicolor', 'Colorless'];

export interface CollationStats {
  totalPacks: number;
  totalCards: number;
  /** Packs whose rare/mythic slot(s) produced at least one mythic. */
  mythicPacksCount: number;
  mythicRatePercent: number;
  /** Mythics produced by rare/mythic slots (equals mythicPacksCount when raresCount is 1). */
  totalMythics: number;
  /** Packs containing a foil. */
  foilPacksCount: number;
  /** Partition: each card counted once (mono W/U/B/R/G, Multicolor, Colorless). Sums to totalCards. */
  colorDistribution: Record<string, number>;
  /** Cards containing each color; a multicolor card counts under every one of its colors. */
  colorPresence: Record<StandardColor, number>;
  /** colorDistribution / totalPacks, so the values sum to the average pack size. */
  averageColorPerPack: Record<string, number>;
  /**
   * 0–100. 100 = W, U, B, R and G appear equally often; 0 = only one color appears.
   * Computed from colorPresence over playable cards (basic lands 'L' and tokens 'T' excluded) as
   * 100 · (1 − TVD / 0.8), where TVD is the total-variation distance between the observed color
   * shares and an even 20% split, i.e. the share of colored cards that would have to change color
   * to make all five equal. 0.8 is the TVD of a single-color box. No colored cards → 100.
   */
  colorBalanceScore: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandom<T>(items: T[]): T | null {
  return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
}

function pickWeighted<T>(items: T[], weight: (item: T) => number): T | null {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  if (!(total > 0)) return pickRandom(items);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1] ?? null;
}

function standardColorsOf(card: Card): StandardColor[] {
  const colors: string[] = card.colors ?? determineColors(card.cost, card.type);
  return STANDARD_COLORS.filter(col => colors.includes(col));
}

/** The single partition bucket a card belongs to. */
export function colorBucketOf(card: Card): ColorBucket {
  const std = standardColorsOf(card);
  if (std.length > 1 || (card.colors ?? []).includes('Multicolor')) return 'Multicolor';
  return std.length === 1 ? std[0] : 'Colorless';
}

const emptyBuckets = (): Record<string, number> =>
  Object.fromEntries(COLOR_BUCKETS.map(b => [b, 0])) as Record<string, number>;
const emptyPresence = (): Record<StandardColor, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0 });

// ---------------------------------------------------------------------------
// Sets (SWTG-PackGenerator let you tick which sets to draw from)
// ---------------------------------------------------------------------------

/**
 * Set code for a card: its `setCode` (imported cards), else derived from its `source`:
 * 'swtg-base-*' → 'Main', 'swtg-expansion-NN-XYZ.pdf' → 'XYZ' (TFA, RO, ...), otherwise the source
 * text itself (e.g. 'Custom Import'), or 'Custom' when there is none.
 */
export function getCardSetCode(card: Card): string {
  if (card.setCode) return card.setCode;
  const source = (card.source ?? '').trim();
  if (/swtg-base-/i.test(source)) return 'Main';
  const expansion = /swtg-expansion-\d+-([a-z0-9]+)/i.exec(source);
  if (expansion) return expansion[1].toUpperCase();
  return source || 'Custom';
}

/** Distinct set codes in first-seen order, with card counts — for building set checkboxes. */
export function listCardSets(cards: Card[]): { code: string; count: number }[] {
  const counts = new Map<string, number>();
  cards.forEach(card => {
    const code = getCardSetCode(card);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  });
  return Array.from(counts, ([code, count]) => ({ code, count }));
}

// ---------------------------------------------------------------------------
// Config normalisation (older saved configs lack the newer optional fields)
// ---------------------------------------------------------------------------

interface NormalizedConfig {
  commons: number;
  uncommons: number;
  rares: number;
  lands: number;
  tokens: number;
  mythicRatio: number;
  foilRate: number;
  balance: boolean;
  includedSets: string[];
}

const toCount = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const toUnit = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

function normalizeConfig(config: BoosterSlotConfig): NormalizedConfig {
  return {
    commons: toCount(config.commonsCount),
    uncommons: toCount(config.uncommonsCount),
    rares: toCount(config.raresCount),
    lands: toCount(config.basicLandCount),
    tokens: toCount(config.tokenCount),
    // 0 is a legitimate "no mythics" setting; only a missing/invalid value falls back to 0.22.
    mythicRatio: toUnit(config.mythicRatio, 0.22),
    foilRate: toUnit(config.foilRate, 0),
    balance: !!config.balanceColorsInCommons,
    includedSets: Array.isArray(config.includedSets) ? config.includedSets : [],
  };
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

interface Pools {
  commons: Card[];
  uncommons: Card[];
  rares: Card[];
  mythics: Card[];
  basics: Card[];
  tokens: Card[];
  /** Art variants per basic land name, so each basic type is equally likely however many arts it has. */
  basicVariants: Map<string, number>;
}

const basicKey = (card: Card) => card.name.trim().toLowerCase();

function buildPools(allCards: Card[], includedSets: string[]): Pools {
  // A set filter that matches nothing (e.g. a stale saved selection) falls back to all cards.
  const filtered = includedSets.length > 0 ? allCards.filter(c => includedSets.includes(getCardSetCode(c))) : allCards;
  const cards = filtered.length > 0 ? filtered : allCards;
  const ofRarity = (list: Card[], r: Card['rarity']) => list.filter(c => c.rarity === r);

  // Basic land slot = rarity 'L' only. Nonbasic lands (incl. rare/mythic ones) stay in their rarity slot.
  // If the selected sets ship no basics/tokens, borrow them from the full card list.
  let basics = ofRarity(cards, 'L');
  if (basics.length === 0) basics = ofRarity(allCards, 'L');
  let tokens = ofRarity(cards, 'T');
  if (tokens.length === 0) tokens = ofRarity(allCards, 'T');

  const basicVariants = new Map<string, number>();
  basics.forEach(b => basicVariants.set(basicKey(b), (basicVariants.get(basicKey(b)) ?? 0) + 1));

  return {
    commons: ofRarity(cards, 'C'),
    uncommons: ofRarity(cards, 'U'),
    rares: ofRarity(cards, 'R'),
    mythics: ofRarity(cards, 'M'),
    basics,
    tokens,
    basicVariants,
  };
}

// ---------------------------------------------------------------------------
// Pack assembly
// ---------------------------------------------------------------------------

interface PackState {
  cards: Card[];
  /** Copies of each card id already in this pack (shared by every slot, so no cross-slot duplicates). */
  uses: Map<string, number>;
}

function claim(state: PackState, card: Card): Card {
  state.uses.set(card.id, (state.uses.get(card.id) ?? 0) + 1);
  return card;
}

/** Uniform pick among cards not yet in the pack (optionally filtered). */
function pickFresh(pool: Card[], state: PackState, filter?: (c: Card) => boolean): Card | null {
  return pickRandom(pool.filter(c => !state.uses.has(c.id) && (!filter || filter(c))));
}

/**
 * Uniform pick among the pool's least-used cards: a fresh card while any is left, and once the pool
 * is exhausted the copies are spread evenly (the refill behaviour of SWTG-PackGenerator's pickCards).
 */
function pickLeastUsed(pool: Card[], state: PackState): Card | null {
  let min = Infinity;
  let candidates: Card[] = [];
  for (const card of pool) {
    const used = state.uses.get(card.id) ?? 0;
    if (used < min) {
      min = used;
      candidates = [card];
    } else if (used === min) {
      candidates.push(card);
    }
  }
  return pickRandom(candidates);
}

function pickRareSlot(pools: Pools, state: PackState, upgrade: boolean): Card | null {
  const { rares, mythics } = pools;
  const card = upgrade
    // Mythic slot: a fresh mythic; if every mythic is already in the pack, a fresh rare beats a duplicate.
    ? pickFresh(mythics, state) ?? pickFresh(rares, state) ?? pickLeastUsed(mythics, state) ?? pickLeastUsed(rares, state)
    // Rare slot: mythics only stand in when the pool has no rares at all (never as an exhaustion upgrade).
    : pickLeastUsed(rares, state) ?? pickLeastUsed(mythics, state);
  return card ?? pickLeastUsed(pools.uncommons, state) ?? pickLeastUsed(pools.commons, state);
}

function sampleDistinct<T>(items: T[], n: number): T[] {
  const a = [...items];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/**
 * Commons with color balancing. A valid set of commons covers min(count, colors in pool) colors and
 * has no color more than ceil(count / colors) + 1 times (anti-flood; 3 for 10 commons). Valid sets are
 * drawn uniformly by rejection sampling (about 3.5 tries for the SWTG pool), so colorless and
 * multicolor commons keep their fair share and every common is opened about equally often. Small or
 * lopsided pools fall back to a constructive pass: seed each color, then fill under the cap.
 */
function pickCommons(count: number, commons: Card[], state: PackState, balance: boolean): Card[] {
  const picked: Card[] = [];
  if (count <= 0 || commons.length === 0) return picked;

  if (!balance) {
    for (let i = 0; i < count; i++) picked.push(claim(state, pickLeastUsed(commons, state)!));
    return picked;
  }

  const colorsInPool = STANDARD_COLORS.filter(col => commons.some(c => standardColorsOf(c).includes(col)));
  const cap = Math.max(2, Math.ceil(count / Math.max(1, colorsInPool.length)) + 1);
  const colorsNeeded = Math.min(count, colorsInPool.length);

  const fresh = commons.filter(c => !state.uses.has(c.id));
  if (fresh.length >= count) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const draw = sampleDistinct(fresh, count);
      const tally = emptyPresence();
      draw.forEach(c => standardColorsOf(c).forEach(col => tally[col]++));
      const covered = colorsInPool.filter(col => tally[col] > 0).length;
      if (covered >= colorsNeeded && STANDARD_COLORS.every(col => tally[col] <= cap)) {
        return draw.map(c => claim(state, c));
      }
    }
  }

  const presence = emptyPresence();
  const fitsCap = (c: Card) => standardColorsOf(c).every(col => presence[col] < cap);
  const take = (c: Card) => {
    standardColorsOf(c).forEach(col => presence[col]++);
    picked.push(claim(state, c));
  };

  // Phase A: color coverage (a multicolor seed can cover two colors at once).
  for (const color of shuffle(colorsInPool)) {
    if (picked.length >= count) break;
    if (presence[color] > 0) continue;
    const seed = pickFresh(commons, state, c => standardColorsOf(c).includes(color) && fitsCap(c));
    if (seed) take(seed);
  }

  // Phase B: uniform fill under the cap; relax the cap, then allow duplicates only when the pool is exhausted.
  while (picked.length < count) {
    take(pickFresh(commons, state, fitsCap) ?? pickFresh(commons, state) ?? pickLeastUsed(commons, state)!);
  }
  return picked;
}

/** Basic land: each basic *type* equally likely, then a uniformly random art variant of it. */
function pickBasicLand(pools: Pools, state: PackState): Card | null {
  if (pools.basics.length === 0) return null;
  let min = Infinity;
  for (const b of pools.basics) min = Math.min(min, state.uses.get(b.id) ?? 0);
  const candidates = pools.basics.filter(b => (state.uses.get(b.id) ?? 0) === min);
  return pickWeighted(candidates, b => 1 / (pools.basicVariants.get(basicKey(b)) ?? 1));
}

/**
 * Foil slot (ported from SWTG-PackGenerator): replaces one common; its rarity mirrors the pack's own mix
 * (commons : uncommons : rares·(1−mythicRatio) : rares·mythicRatio — the original hard-coded 10:3:1).
 * Unlike the original, the foil never duplicates a card already in the pack while fresh cards remain.
 */
function pickFoil(pools: Pools, cfg: NormalizedConfig, state: PackState): Card | null {
  const options: { pool: Card[]; weight: number }[] = [
    { pool: pools.commons, weight: cfg.commons },
    { pool: pools.uncommons, weight: cfg.uncommons },
    { pool: pools.rares, weight: cfg.rares * (1 - cfg.mythicRatio) },
    { pool: pools.mythics, weight: cfg.rares * cfg.mythicRatio },
  ].filter(o => o.pool.length > 0 && o.weight > 0);
  const chosen = pickWeighted(options, o => o.weight);
  return chosen ? pickFresh(chosen.pool, state) ?? pickLeastUsed(chosen.pool, state) : null;
}

function buildPack(packNumber: number, pools: Pools, cfg: NormalizedConfig, mythicSlots: boolean[]): BoosterPack {
  const state: PackState = { cards: [], uses: new Map() };
  const add = (card: Card | null) => {
    if (card) state.cards.push(claim(state, card));
  };

  // 1. Rare / mythic slots — each slot is upgraded on its own (as in SWTG-PackGenerator).
  let mythicCount = 0;
  for (let r = 0; r < cfg.rares; r++) {
    const card = pickRareSlot(pools, state, mythicSlots[r] ?? false);
    if (card?.rarity === 'M') mythicCount++;
    add(card);
  }

  // 2. Uncommons (commons stand in when the pool has no uncommons).
  for (let u = 0; u < cfg.uncommons; u++) {
    add(pickLeastUsed(pools.uncommons.length > 0 ? pools.uncommons : pools.commons, state));
  }

  // 3. Foil replaces one common. Drawn before the commons so the commons avoid it.
  let foil: Card | null = null;
  if (cfg.foilRate > 0 && cfg.commons > 0 && Math.random() < cfg.foilRate) {
    foil = pickFoil(pools, cfg, state);
    if (foil) claim(state, foil);
  }

  // 4. Commons (color-balanced or uniform).
  state.cards.push(...pickCommons(cfg.commons - (foil ? 1 : 0), pools.commons, state, cfg.balance));
  if (foil) state.cards.push(foil);

  // 5. Basic land slot. With no basic lands anywhere, a common keeps the pack at its configured size.
  for (let l = 0; l < cfg.lands; l++) {
    add(pickBasicLand(pools, state) ?? pickLeastUsed(pools.commons, state));
  }

  // 6. Token / ad slot. Without tokens the slot stays empty rather than adding an extra playable common.
  for (let t = 0; t < cfg.tokens; t++) {
    add(pickLeastUsed(pools.tokens, state));
  }

  const colorCounts = emptyBuckets();
  const colorPresence = emptyPresence();
  state.cards.forEach(card => {
    colorCounts[colorBucketOf(card)]++;
    standardColorsOf(card).forEach(col => colorPresence[col]++);
  });

  return {
    id: `pack-${packNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    packNumber,
    cards: state.cards,
    hasMythic: mythicCount > 0,
    colorCounts,
    colorPresence,
    mythicCount,
    foilCardIds: foil ? [foil.id] : [],
  };
}

// ---------------------------------------------------------------------------
// Mythic distribution across a box
// ---------------------------------------------------------------------------

/**
 * Which rare/mythic slots of a box (pack-major order) are upgraded to mythic.
 *
 * Stratified, print-run-like sampling: the slot sequence is cut into consecutive strata averaging 1/p
 * slots, with a random phase, and exactly one slot per stratum is upgraded, uniformly at random. Strata
 * at either end may reach past the box; a mythic landing outside is dropped. So:
 *  - every slot is mythic with probability exactly p, for any box size (a single pack included);
 *  - a box of n slots gets about n·p mythics (±1), far tighter than independent coin flips;
 *  - two mythics are never more than 2·ceil(1/p) − 1 slots apart.
 */
function assignMythicSlots(slotCount: number, p: number): boolean[] {
  const mythic = new Array<boolean>(Math.max(0, slotCount)).fill(false);
  if (slotCount <= 0 || p <= 0) return mythic;
  if (p >= 1) return mythic.fill(true);

  const phase = Math.random();
  // Stratum k = slots i with k <= i·p + phase < k + 1, i.e. [ceil((k − phase)/p), ceil((k + 1 − phase)/p) − 1].
  for (let k = 0; ; k++) {
    const lo = Math.ceil((k - phase) / p);
    if (lo >= slotCount) break;
    const hi = Math.ceil((k + 1 - phase) / p) - 1;
    if (hi < lo) continue;
    const slot = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (slot >= 0 && slot < slotCount) mythic[slot] = true;
  }
  return mythic;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a single pack. Mythic upgrades are independent per slot with probability mythicRatio;
 * `forceMythic` (legacy) overrides every rare/mythic slot. Prefer generateBoosterBox for multiple packs.
 */
export function generateBoosterPack(
  packNumber: number,
  allCards: Card[],
  config: BoosterSlotConfig,
  forceMythic?: boolean
): BoosterPack {
  const cfg = normalizeConfig(config);
  const pools = buildPools(allCards, cfg.includedSets);
  const mythicSlots = Array.from({ length: cfg.rares }, () => forceMythic ?? Math.random() < cfg.mythicRatio);
  return buildPack(packNumber, pools, cfg, mythicSlots);
}

/**
 * Generates a box of packs. Each rare/mythic slot is upgraded with probability exactly mythicRatio,
 * spread evenly across the box (see assignMythicSlots); cards never repeat within a pack unless the
 * pool is too small, in which case copies are spread evenly.
 */
export function generateBoosterBox(
  packCount: number,
  allCards: Card[],
  config: BoosterSlotConfig
): BoosterPack[] {
  const cfg = normalizeConfig(config);
  const count = toCount(packCount);
  const pools = buildPools(allCards, cfg.includedSets);
  const mythicSlots = assignMythicSlots(count * cfg.rares, cfg.mythicRatio);

  const packs: BoosterPack[] = [];
  for (let i = 0; i < count; i++) {
    packs.push(buildPack(i + 1, pools, cfg, mythicSlots.slice(i * cfg.rares, (i + 1) * cfg.rares)));
  }
  return packs;
}

export function computeCollationStats(packs: BoosterPack[]): CollationStats {
  const colorDistribution = emptyBuckets();
  const colorPresence = emptyPresence();
  const playablePresence = emptyPresence();
  let totalCards = 0;
  let mythicPacks = 0;
  let totalMythics = 0;
  let foilPacks = 0;

  packs.forEach(pack => {
    totalCards += pack.cards.length;
    if (pack.hasMythic) mythicPacks++;
    totalMythics += pack.mythicCount ?? (pack.hasMythic ? 1 : 0);
    if ((pack.foilCardIds?.length ?? 0) > 0) foilPacks++;

    pack.cards.forEach(card => {
      colorDistribution[colorBucketOf(card)]++;
      const isPlayable = card.rarity !== 'L' && card.rarity !== 'T';
      standardColorsOf(card).forEach(col => {
        colorPresence[col]++;
        if (isPlayable) playablePresence[col]++;
      });
    });
  });

  const averageColorPerPack: Record<string, number> = {};
  COLOR_BUCKETS.forEach(b => {
    averageColorPerPack[b] = packs.length > 0 ? Number((colorDistribution[b] / packs.length).toFixed(2)) : 0;
  });

  const presenceTotal = STANDARD_COLORS.reduce((sum, col) => sum + playablePresence[col], 0);
  let colorBalanceScore = 100;
  if (presenceTotal > 0) {
    const tvd = STANDARD_COLORS.reduce((sum, col) => sum + Math.abs(playablePresence[col] / presenceTotal - 0.2), 0) / 2;
    colorBalanceScore = Math.round(100 * Math.max(0, 1 - tvd / 0.8));
  }

  return {
    totalPacks: packs.length,
    totalCards,
    mythicPacksCount: mythicPacks,
    mythicRatePercent: packs.length > 0 ? Number(((mythicPacks / packs.length) * 100).toFixed(1)) : 0,
    totalMythics,
    foilPacksCount: foilPacks,
    colorDistribution,
    colorPresence,
    averageColorPerPack,
    colorBalanceScore,
  };
}
