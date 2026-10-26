import { expect, test } from 'vitest';
import { plainCost, plainRulesText } from './rulesText';

test('plainCost writes a braced cost as plain text, hybrid pips in parentheses', () => {
  expect(plainCost('{2}{W/U}')).toBe('2(W/U)');
  expect(plainCost('{X}{R}{R}')).toBe('XRR');
  expect(plainCost('{1}{G/W}{G/W}')).toBe('1(G/W)(G/W)');
  expect(plainCost('{2/W}{B/G/P}{C}{S}')).toBe('(2/W)(B/G/P)CS');
  expect(plainCost('{10}{u}')).toBe('10U');
  // Hand-made costs without braces are left alone.
  expect(plainCost('2R')).toBe('2R');
});

test('plainRulesText spells out tap and untap', () => {
  expect(plainRulesText('{T}, {Q}: Add {G}{G}.')).toBe('Tap, Untap: Add GG.');
});
