import { describe, expect, it } from 'vitest';
import type { BulkSetSummary } from './bulkStream';
import { bulkSetOptions, bulkTargets, collectCodes } from './bulkSets';
import type { ScryfallCard, ScryfallSet } from './types';

const sum = (code: string, name: string, setType = 'expansion', count = 1): BulkSetSummary => ({ code, name, setType, count });

const SUMMARIES = [
  sum('tneo', 'Kamigawa: Neon Dynasty Tokens', 'token', 19),
  sum('neo', 'Kamigawa: Neon Dynasty', 'expansion', 515),
  sum('sneo', 'Kamigawa: Neon Dynasty Substitute Cards', 'token', 6),
  sum('dmu', 'Dominaria United', 'expansion', 400),
  sum('l12', 'League Tokens 2012', 'token', 4),
];

describe('bulkSetOptions', () => {
  it('folds t-prefixed token sets into their parent and lists the rest by name', () => {
    const options = bulkSetOptions(SUMMARIES);
    expect(options.map(o => o.code)).toEqual(['dmu', 'neo', 'sneo', 'l12']);
    expect(options.find(o => o.code === 'neo')).toEqual({
      ...SUMMARIES[1],
      tokenCodes: ['tneo'],
      tokenCount: 19,
    });
    // Unmatched token sets stay selectable on their own.
    expect(options.find(o => o.code === 'sneo')).toMatchObject({ setType: 'token', tokenCodes: [], tokenCount: 0 });
  });

  it('folds only the token set the shared rule picks, even when the set list files more under the parent', () => {
    const known = [
      { code: 'sneo', name: 'Kamigawa: Neon Dynasty Substitute Cards', set_type: 'token', parent_set_code: 'neo' },
      { code: 'tneo', name: 'Kamigawa: Neon Dynasty Tokens', set_type: 'token', parent_set_code: 'neo' },
    ] as ScryfallSet[];
    const options = bulkSetOptions(SUMMARIES, known);
    expect(options.map(o => o.code)).toEqual(['dmu', 'neo', 'sneo', 'l12']);
    expect(options.find(o => o.code === 'neo')).toMatchObject({ tokenCodes: ['tneo'], tokenCount: 19 });
    expect(options.find(o => o.code === 'sneo')).toMatchObject({ setType: 'token', tokenCodes: [] });
  });

  it('uses the known set list for a token set named "… Tokens" without the t<code> name', () => {
    const summaries = [sum('dmu', 'Dominaria United'), sum('xdmu', 'Dominaria United Tokens', 'token', 12)];
    const known = [{ code: 'xdmu', name: 'Dominaria United Tokens', set_type: 'token', parent_set_code: 'dmu' }] as ScryfallSet[];
    expect(bulkSetOptions(summaries, known)).toEqual([{ ...summaries[0], tokenCodes: ['xdmu'], tokenCount: 12 }]);
    // Offline there is no parent code to go on, so it stays a set of its own.
    expect(bulkSetOptions(summaries).map(o => o.code)).toEqual(['dmu', 'xdmu']);
  });

  it('lists a token set whose parent is missing from the file', () => {
    const known = [{ code: 'l12', set_type: 'token', parent_set_code: 'm13' }] as ScryfallSet[];
    expect(bulkSetOptions(SUMMARIES, known).map(o => o.code)).toContain('l12');
  });

  it('never folds a token set into another folded token set', () => {
    const known = [
      { code: 'tneo', name: 'Kamigawa: Neon Dynasty Tokens', set_type: 'token', parent_set_code: 'neo' },
      { code: 'sneo', name: 'Neon Dynasty Token Tokens', set_type: 'token', parent_set_code: 'tneo' },
    ] as ScryfallSet[];
    const options = bulkSetOptions(SUMMARIES, known);
    expect(options.map(o => o.code)).toEqual(['dmu', 'neo', 'sneo', 'l12']);
    expect(options.find(o => o.code === 'neo')?.tokenCodes).toEqual(['tneo']);
  });
});

describe('collectCodes', () => {
  const options = bulkSetOptions(SUMMARIES);
  const chosen = options.filter(o => o.code === 'neo' || o.code === 'dmu');

  it('adds each set’s token sets only when tokens are included', () => {
    expect(collectCodes(chosen, false)).toEqual(['dmu', 'neo']);
    expect(collectCodes(chosen, true)).toEqual(['dmu', 'neo', 'tneo']);
  });
});

describe('bulkTargets', () => {
  const card = (set: string, collector_number: string, extra: Partial<ScryfallCard> = {}): ScryfallCard => ({
    id: `${set}-${collector_number}`,
    name: `Card ${collector_number}`,
    layout: 'normal',
    set,
    set_name: set,
    collector_number,
    rarity: 'common',
    ...extra,
  });
  const options = bulkSetOptions(SUMMARIES);
  const pick = (...codes: string[]) => options.filter(o => codes.includes(o.code));
  // Bulk files list cards in no particular order.
  const CARDS = [
    card('neo', '10'),
    card('tneo', '2'),
    card('dmu', '1'),
    card('neo', '181†', { variation: true }),
    card('neo', '2'),
    card('tneo', '1'),
    card('l12', '1'),
    card('neo', '181'),
  ];
  const ids = (cards: ScryfallCard[]) => cards.map(c => c.id);

  it('makes one target per chosen set, cards in collector-number order', () => {
    const targets = bulkTargets(pick('neo', 'dmu'), CARDS, false);
    expect(targets.map(t => [t.code, t.name])).toEqual([
      ['dmu', 'Dominaria United'],
      ['neo', 'Kamigawa: Neon Dynasty'],
    ]);
    expect(ids(targets[1].cards)).toEqual(['neo-2', 'neo-10', 'neo-181']);
    expect(targets[1].tokens).toEqual([]);
  });

  it('adds the folded token sets as tokens when they are included', () => {
    const [neo] = bulkTargets(pick('neo'), CARDS, true);
    expect(ids(neo.tokens)).toEqual(['tneo-1', 'tneo-2']);
  });

  it('leaves out variations, as the API search does by default', () => {
    const [neo] = bulkTargets(pick('neo'), CARDS, false);
    expect(ids(neo.cards)).not.toContain('neo-181†');
  });

  it('imports a token set picked on its own as tokens', () => {
    expect(bulkTargets(pick('l12'), CARDS, false)).toEqual([
      { code: 'l12', name: 'League Tokens 2012', cards: [], tokens: [CARDS[6]] },
    ]);
  });
});
