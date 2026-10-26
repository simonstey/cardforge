import { expect, test } from 'vitest';
import { Card } from '../types/card';
import { backFaceCard, editedColors, setDisplayName } from './cardHelpers';

const base: Card = { id: '1', name: 'X', type: 'Creature', rarity: 'C' };

test('setDisplayName: static name, then card setName, then code', () => {
  expect(setDisplayName('TFA')).toBe('The Force Awakens');
  expect(setDisplayName('NEO', [{ ...base, setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty' }])).toBe('Kamigawa: Neon Dynasty');
  expect(setDisplayName('XYZ', [])).toBe('XYZ');
});

test('backFaceCard shows the back face without the front face’s text, stats or cost', () => {
  const front: Card = {
    ...base,
    name: 'Delver of Secrets',
    cost: '{U}',
    text: 'At the beginning of your upkeep, look at the top card of your library.',
    flavorText: 'Front flavour.',
    powerToughness: '1/1',
    artist: 'Nils Hamm',
    colors: ['U'],
    backFace: { name: 'Insectile Aberration', type: 'Creature — Human Insect' },
  };
  expect(backFaceCard(front)).toStrictEqual({
    id: '1',
    name: 'Insectile Aberration',
    type: 'Creature — Human Insect',
    rarity: 'C',
    artist: 'Nils Hamm',
    colors: ['U'],
  });
  const withText = { ...front, backFace: { name: 'B', type: 'T', text: 'Flying', powerToughness: '3/2' } };
  expect(backFaceCard(withText)).toMatchObject({ name: 'B', text: 'Flying', powerToughness: '3/2' });
  expect(backFaceCard(withText)).not.toHaveProperty('cost');
  expect(backFaceCard(base)).toBeUndefined();
});

test('editedColors keeps a card’s colours while its cost is unchanged', () => {
  const token: Card = { ...base, type: 'Token Creature — Spirit', colors: ['W'] };
  expect(editedColors(token, '', token.type)).toEqual(['W']);
  expect(editedColors(token, '  ', token.type)).toEqual(['W']);
  // A new cost decides the colours again.
  expect(editedColors(token, '{1}{B}', token.type)).toEqual(['B']);
  const bolt: Card = { ...base, cost: '{R}', colors: ['R'] };
  expect(editedColors(bolt, '{R}', 'Instant')).toEqual(['R']);
  expect(editedColors(bolt, '{U}{R}', 'Instant')).toEqual(['Multicolor', 'U', 'R']);
  // New cards, and cards without stored colours, use the cost.
  expect(editedColors(null, '{G}', 'Creature')).toEqual(['G']);
  expect(editedColors({ ...base, cost: '{G}' }, '{G}', 'Creature')).toEqual(['G']);
});
