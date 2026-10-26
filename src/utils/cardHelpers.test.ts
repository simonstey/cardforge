import { expect, test } from 'vitest';
import { Card } from '../types/card';
import { setDisplayName } from './cardHelpers';

const base: Card = { id: '1', name: 'X', type: 'Creature', rarity: 'C' };

test('setDisplayName: static name, then card setName, then code', () => {
  expect(setDisplayName('TFA')).toBe('The Force Awakens');
  expect(setDisplayName('NEO', [{ ...base, setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty' }])).toBe('Kamigawa: Neon Dynasty');
  expect(setDisplayName('XYZ', [])).toBe('XYZ');
});
