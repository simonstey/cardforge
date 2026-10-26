import { expect, test } from 'vitest';
import { Card } from '../types/card';
import { getCardArt } from './cardArt';

const base: Card = { id: 'scry:1', name: 'Test', type: 'Creature', rarity: 'C' };
const scry = (image?: NonNullable<Card['scryfall']>['image']): Card['scryfall'] => ({
  id: '1',
  image,
  importedAt: '2026-01-01T00:00:00Z',
});

test('prefers customImageUrl over scryfall images', () => {
  const card = { ...base, customImageUrl: 'data:custom', scryfall: scry({ art: 'a', full: 'f' }) };
  expect(getCardArt(card)).toEqual({ src: 'data:custom' });
});

test('returns scryfall art, display scan and back scan with dimensions', () => {
  const card = { ...base, scryfall: scry({ art: 'a', full: 'f', fullBack: 'fb' }) };
  expect(getCardArt(card)).toEqual({
    src: 'a',
    width: 626,
    height: 457,
    fullSrc: 'f',
    fullWidth: 672,
    fullHeight: 936,
    fullBackSrc: 'fb',
  });
});

test('uses scryfall images for basic lands instead of manifest variants', () => {
  const card: Card = { ...base, name: 'Forest', rarity: 'L', scryfall: scry({ art: 'a', full: 'f' }) };
  expect(getCardArt(card)?.src).toBe('a');
});

test('falls back to the full image when art is missing', () => {
  const art = getCardArt({ ...base, scryfall: scry({ full: 'f' }) });
  expect(art).toEqual({ src: 'f', fullSrc: 'f', fullWidth: 672, fullHeight: 936 });
});

test('returns null for a scryfall card without images', () => {
  expect(getCardArt({ ...base, scryfall: scry() })).toBeNull();
  expect(getCardArt({ ...base, name: 'Forest', rarity: 'L', scryfall: scry({}) })).toBeNull();
});
