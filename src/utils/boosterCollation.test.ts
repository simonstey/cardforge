import { expect, test } from 'vitest';
import { Card } from '../types/card';
import { getCardSetCode, listCardSets } from './boosterCollation';

const base: Card = { id: '1', name: 'X', type: 'Creature', rarity: 'C' };

test('getCardSetCode prefers setCode over source', () => {
  expect(getCardSetCode({ ...base, source: 'swtg-expansion-01-tfa.pdf', setCode: 'NEO' })).toBe('NEO');
  expect(getCardSetCode({ ...base, source: 'swtg-expansion-01-tfa.pdf' })).toBe('TFA');
});

test('listCardSets groups imported cards by setCode', () => {
  expect(listCardSets([{ ...base, setCode: 'TST' }, { ...base, id: '2', setCode: 'TST' }])).toEqual([{ code: 'TST', count: 2 }]);
});
