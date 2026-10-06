import { Card, BoosterSlotConfig, BoosterPack, CardColor } from '../types/card';

const STANDARD_COLORS: CardColor[] = ['W', 'U', 'B', 'R', 'G'];

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface CollationStats {
  totalPacks: number;
  totalCards: number;
  mythicPacksCount: number;
  mythicRatePercent: number;
  colorDistribution: Record<string, number>;
  averageColorPerPack: Record<string, number>;
  colorBalanceScore: number; // 0 to 100 rating of how evenly balanced colors are
}

export function generateBoosterPack(
  packNumber: number,
  allCards: Card[],
  config: BoosterSlotConfig,
  forceMythic?: boolean
): BoosterPack {
  // Pool separation by rarity
  const commons = allCards.filter(c => c.rarity === 'C');
  const uncommons = allCards.filter(c => c.rarity === 'U');
  const rares = allCards.filter(c => c.rarity === 'R');
  const mythics = allCards.filter(c => c.rarity === 'M');
  const lands = allCards.filter(c => c.rarity === 'L' || c.type.toLowerCase().includes('land'));
  const tokens = allCards.filter(c => c.rarity === 'T');

  const selectedCards: Card[] = [];
  const usedCardIds = new Set<string>();

  // Helper to pick cards uniquely
  const pickCard = (pool: Card[], predicate?: (c: Card) => boolean): Card | null => {
    let candidates = pool.filter(c => !usedCardIds.has(c.id));
    if (predicate) {
      candidates = candidates.filter(predicate);
    }
    if (candidates.length === 0) {
      // fallback to pool ignoring uniqueness if pool is exhausted
      candidates = predicate ? pool.filter(predicate) : pool;
    }
    if (candidates.length === 0) return null;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    usedCardIds.add(choice.id);
    return choice;
  };

  // 1. Rare / Mythic Slot determination
  let isMythic = forceMythic !== undefined ? forceMythic : (Math.random() < config.mythicRatio);
  if (isMythic && mythics.length === 0) {
    isMythic = false;
  }
  if (!isMythic && rares.length === 0 && mythics.length > 0) {
    isMythic = true;
  }

  for (let r = 0; r < config.raresCount; r++) {
    const rarePool = isMythic && mythics.length > 0 ? mythics : (rares.length > 0 ? rares : uncommons);
    const rareCard = pickCard(rarePool);
    if (rareCard) selectedCards.push(rareCard);
  }

  // 2. Uncommons
  for (let u = 0; u < config.uncommonsCount; u++) {
    const ucCard = pickCard(uncommons.length > 0 ? uncommons : commons);
    if (ucCard) selectedCards.push(ucCard);
  }

  // 3. Commons with Color Balancing
  const pickedCommons: Card[] = [];
  if (config.balanceColorsInCommons && commons.length > 0) {
    // Phase A: Seed at least one of each standard color if slot count allows
    const colorsPresentInPool = STANDARD_COLORS.filter(col =>
      commons.some(c => c.colors?.includes(col))
    );

    const initialColorsToSeed = colorsPresentInPool.slice(0, Math.min(config.commonsCount, colorsPresentInPool.length));
    const shuffledColors = shuffle(initialColorsToSeed);

    for (const color of shuffledColors) {
      if (pickedCommons.length >= config.commonsCount) break;
      const card = pickCard(commons, c => (c.colors || []).includes(color));
      if (card) {
        pickedCommons.push(card);
      }
    }

    // Phase B: Fill remaining commons while tracking color balance
    while (pickedCommons.length < config.commonsCount) {
      // Find the currently least represented color in picked commons
      const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      pickedCommons.forEach(c => {
        (c.colors || []).forEach(col => {
          if (colorCounts[col] !== undefined) colorCounts[col]++;
        });
      });

      // Sort available colors by lowest count
      const leastRepresented = [...colorsPresentInPool].sort((a, b) => colorCounts[a] - colorCounts[b]);
      let card: Card | null = null;

      for (const targetColor of leastRepresented) {
        card = pickCard(commons, c => (c.colors || []).includes(targetColor));
        if (card) break;
      }

      // If no card found for least represented, pick any available common
      if (!card) {
        card = pickCard(commons);
      }
      if (card) {
        pickedCommons.push(card);
      } else {
        break;
      }
    }
  } else {
    // Pure random commons
    for (let c = 0; c < config.commonsCount; c++) {
      const card = pickCard(commons);
      if (card) pickedCommons.push(card);
    }
  }

  selectedCards.push(...pickedCommons);

  // 4. Basic Land Slot
  for (let l = 0; l < config.basicLandCount; l++) {
    const landCard = pickCard(lands.length > 0 ? lands : commons);
    if (landCard) selectedCards.push(landCard);
  }

  // 5. Token Slot
  for (let t = 0; t < config.tokenCount; t++) {
    const tokenCard = pickCard(tokens.length > 0 ? tokens : commons);
    if (tokenCard) selectedCards.push(tokenCard);
  }

  // 6. Color Balancing Post-Adjustment (Swapping if severely imbalanced)
  if (config.balanceColorsInCommons && commons.length > 20) {
    adjustPackColorBalance(selectedCards, commons, usedCardIds);
  }

  // Calculate final color distribution for this pack
  const colorCounts: Record<string, number> = {
    W: 0, U: 0, B: 0, R: 0, G: 0, Multicolor: 0, Colorless: 0,
  };

  selectedCards.forEach(c => {
    const colors = c.colors && c.colors.length > 0 ? c.colors : ['Colorless'];
    if (colors.includes('Multicolor')) {
      colorCounts.Multicolor++;
    } else if (colors.includes('Colorless')) {
      colorCounts.Colorless++;
    }
    colors.forEach(col => {
      if ((STANDARD_COLORS as string[]).includes(col)) {
        colorCounts[col] = (colorCounts[col] || 0) + 1;
      }
    });
  });

  return {
    id: `pack-${packNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    packNumber,
    cards: selectedCards,
    hasMythic: isMythic,
    colorCounts,
  };
}

/**
 * Adjusts color balance by swapping commons if an available standard color has 0 representation
 * and another color has excess (> 3 in commons).
 */
function adjustPackColorBalance(cards: Card[], commonsPool: Card[], usedIds: Set<string>): void {
  const commonIndices = cards
    .map((c, idx) => ({ c, idx }))
    .filter(item => item.c.rarity === 'C');

  if (commonIndices.length < 5) return;

  const colorTally: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  commonIndices.forEach(({ c }) => {
    (c.colors || []).forEach(col => {
      if (colorTally[col] !== undefined) colorTally[col]++;
    });
  });

  const missingColors = STANDARD_COLORS.filter(col =>
    colorTally[col] === 0 && commonsPool.some(c => (c.colors || []).includes(col))
  );

  for (const missingColor of missingColors) {
    // Find a common that belongs to the most overrepresented color (> 2)
    const overrepresentedColor = STANDARD_COLORS.reduce((maxCol, col) =>
      colorTally[col] > colorTally[maxCol] ? col : maxCol, STANDARD_COLORS[0]
    );

    if (colorTally[overrepresentedColor] <= 2) break;

    const swapTarget = commonIndices.find(({ c }) =>
      (c.colors || []).includes(overrepresentedColor) && !(c.colors || []).includes('Multicolor')
    );

    if (swapTarget) {
      const replacementCandidates = commonsPool.filter(c =>
        !usedIds.has(c.id) && (c.colors || []).includes(missingColor)
      );

      if (replacementCandidates.length > 0) {
        const replacement = replacementCandidates[Math.floor(Math.random() * replacementCandidates.length)];
        usedIds.delete(cards[swapTarget.idx].id);
        usedIds.add(replacement.id);
        cards[swapTarget.idx] = replacement;
        colorTally[overrepresentedColor]--;
        colorTally[missingColor]++;
      }
    }
  }
}

/**
 * Generates a full box or array of booster packs adhering to exact ratios.
 * Ensures mythic frequency is distributed across every 4-5 packs as requested.
 */
export function generateBoosterBox(
  packCount: number,
  allCards: Card[],
  config: BoosterSlotConfig
): BoosterPack[] {
  const packs: BoosterPack[] = [];

  // Determine which packs will have mythics based on the 1 in 4-5 ratio:
  // E.g., divide into clusters of 4-5 packs and guarantee exactly 1 mythic in each cluster
  const mythicIndices = new Set<number>();
  const averageClusterSize = Math.max(3, Math.round(1 / (config.mythicRatio || 0.22))); // typically 4 or 5

  let currentStart = 0;
  while (currentStart < packCount) {
    const clusterSize = Math.min(packCount - currentStart, Math.floor(Math.random() * 2) + averageClusterSize - 1);
    if (clusterSize <= 0) break;
    const mythicOffset = Math.floor(Math.random() * clusterSize);
    mythicIndices.add(currentStart + mythicOffset);
    currentStart += clusterSize;
  }

  for (let i = 0; i < packCount; i++) {
    const forceMythic = mythicIndices.has(i);
    const pack = generateBoosterPack(i + 1, allCards, config, forceMythic);
    packs.push(pack);
  }

  return packs;
}

export function computeCollationStats(packs: BoosterPack[]): CollationStats {
  if (packs.length === 0) {
    return {
      totalPacks: 0,
      totalCards: 0,
      mythicPacksCount: 0,
      mythicRatePercent: 0,
      colorDistribution: { W: 0, U: 0, B: 0, R: 0, G: 0, Multicolor: 0, Colorless: 0 },
      averageColorPerPack: { W: 0, U: 0, B: 0, R: 0, G: 0, Multicolor: 0, Colorless: 0 },
      colorBalanceScore: 100,
    };
  }

  let totalCards = 0;
  let mythicPacks = 0;
  const colorDistribution: Record<string, number> = {
    W: 0, U: 0, B: 0, R: 0, G: 0, Multicolor: 0, Colorless: 0,
  };

  packs.forEach(pack => {
    totalCards += pack.cards.length;
    if (pack.hasMythic) mythicPacks++;
    Object.entries(pack.colorCounts).forEach(([col, count]) => {
      colorDistribution[col] = (colorDistribution[col] || 0) + count;
    });
  });

  const averageColorPerPack: Record<string, number> = {};
  Object.entries(colorDistribution).forEach(([col, count]) => {
    averageColorPerPack[col] = Number((count / packs.length).toFixed(1));
  });

  // Calculate standard deviation across W, U, B, R, G to assess balance
  const standardCounts = STANDARD_COLORS.map(col => colorDistribution[col] || 0);
  const mean = standardCounts.reduce((a, b) => a + b, 0) / 5;
  const variance = standardCounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 5;
  const stdDev = Math.sqrt(variance);

  // Score from 100 down based on coefficient of variation
  const cv = mean > 0 ? (stdDev / mean) : 0;
  const colorBalanceScore = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  return {
    totalPacks: packs.length,
    totalCards,
    mythicPacksCount: mythicPacks,
    mythicRatePercent: Number(((mythicPacks / packs.length) * 100).toFixed(1)),
    colorDistribution,
    averageColorPerPack,
    colorBalanceScore,
  };
}
