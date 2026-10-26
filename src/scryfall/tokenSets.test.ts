import { expect, test } from 'vitest';
import { tokenSetFor, type TokenSetCandidate } from './tokenSets';

const token = (code: string, name: string, parent?: string): TokenSetCandidate => ({
  code,
  name,
  set_type: 'token',
  ...(parent !== undefined && { parent_set_code: parent }),
});

const SNEO = token('sneo', 'Kamigawa: Neon Dynasty Substitute Cards', 'neo');
const TNEO = token('tneo', 'Kamigawa: Neon Dynasty Tokens', 'neo');

test('picks the t<code> token set over any other token-type child', () => {
  expect(tokenSetFor('neo', [SNEO, TNEO])).toBe(TNEO);
  // Bulk files carry no parent codes: the convention alone finds it.
  expect(tokenSetFor('neo', [token('sneo', SNEO.name), token('tneo', TNEO.name)])?.code).toBe('tneo');
});

test('falls back to a child named "… Tokens", never substitute cards or sticker sheets', () => {
  const older = token('xold', 'Old Set Tokens', 'old');
  expect(tokenSetFor('old', [SNEO, older])).toBe(older);
  expect(tokenSetFor('neo', [SNEO])).toBeUndefined();
  expect(tokenSetFor('unf', [token('sunf', 'Unfinity Sticker Sheets', 'unf')])).toBeUndefined();
  // A "Tokens" set that belongs to another set doesn't count.
  expect(tokenSetFor('neo', [token('xold', 'Old Set Tokens', 'old')])).toBeUndefined();
});

test('only token-type sets count', () => {
  const timeSpiral: TokenSetCandidate = { code: 'tsp', name: 'Time Spiral', set_type: 'expansion' };
  expect(tokenSetFor('sp', [timeSpiral])).toBeUndefined();
  expect(tokenSetFor('neo', [{ ...TNEO, set_type: 'memorabilia' }])).toBeUndefined();
});
