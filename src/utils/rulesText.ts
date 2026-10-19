/** Plain-text version of rules text for places that can't draw symbols (PDF, search): {T} -> Tap, {2}{R} -> 2R. */
export function plainRulesText(text: string): string {
  return text.replace(/\{([^}]+)\}/g, (_, s: string) => {
    const symbol = s.toUpperCase();
    if (symbol === 'T') return 'Tap';
    if (symbol === 'Q') return 'Untap';
    return symbol;
  });
}
