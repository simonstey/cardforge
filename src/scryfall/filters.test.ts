import { expect, test } from 'vitest';
import { DEFAULT_IMPORT_OPTIONS, shouldImport } from './filters';
import type { ScryfallCard } from './types';
import normal from './__fixtures__/normal.json';

const card = (over: Partial<ScryfallCard>): ScryfallCard => ({ ...(normal as ScryfallCard), ...over });

test('boosterOnly keeps booster cards only', () => {
  expect(DEFAULT_IMPORT_OPTIONS).toEqual({ boosterOnly: true, includeTokens: false });
  expect(shouldImport(card({ booster: true }), DEFAULT_IMPORT_OPTIONS, false)).toBe(true);
  expect(shouldImport(card({ booster: false }), DEFAULT_IMPORT_OPTIONS, false)).toBe(false);
  expect(shouldImport(card({ booster: undefined }), DEFAULT_IMPORT_OPTIONS, false)).toBe(false);
});

test('boosterOnly off keeps non-booster printings', () => {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, boosterOnly: false };
  expect(shouldImport(card({ booster: false }), opts, false)).toBe(true);
});

test('tokens ignore boosterOnly', () => {
  expect(shouldImport(card({ booster: false }), DEFAULT_IMPORT_OPTIONS, true)).toBe(true);
});

test('digital-only cards are excluded', () => {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, boosterOnly: false };
  expect(shouldImport(card({ games: ['arena'], booster: true }), opts, false)).toBe(false);
  expect(shouldImport(card({ games: ['arena'] }), opts, true)).toBe(false);
});

test('cards without a games field are kept', () => {
  expect(shouldImport(card({ games: undefined, booster: true }), DEFAULT_IMPORT_OPTIONS, false)).toBe(true);
});
