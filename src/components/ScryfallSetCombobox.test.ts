import { expect, test } from 'vitest';
import type { ScryfallSet } from '../scryfall/types';
import { matchSets } from './ScryfallSetCombobox';

const set = (code: string, name: string): ScryfallSet => ({
  code,
  name,
  set_type: 'expansion',
  card_count: 1,
  digital: false,
  search_uri: '',
});

// Newest first, as importableSets returns them.
const SETS = [
  set('dsk', 'Duskmourn: House of Horror'),
  set('mkm', 'Murders at Karlov Manor'),
  set('neo', 'Kamigawa: Neon Dynasty'),
  set('dmu', 'Dominaria United'),
  set('dom', 'Dominaria'),
];

test('an empty query lists every set in order', () => {
  expect(matchSets(SETS, '  ')).toEqual(SETS);
});

test('matches codes and names case-insensitively', () => {
  expect(matchSets(SETS, 'NEON').map(s => s.code)).toEqual(['neo']);
  expect(matchSets(SETS, ' Neo ').map(s => s.code)).toEqual(['neo']);
});

test('ranks an exact code or name first, then code prefixes, then the rest in list order', () => {
  expect(matchSets(SETS, 'dom').map(s => s.code)).toEqual(['dom', 'dmu']);
  expect(matchSets(SETS, 'd').map(s => s.code)).toEqual(['dsk', 'dmu', 'dom', 'mkm', 'neo']);
  expect(matchSets(SETS, 'dominaria').map(s => s.code)).toEqual(['dom', 'dmu']);
});

test('no match is an empty list', () => {
  expect(matchSets(SETS, 'xyz')).toEqual([]);
});
