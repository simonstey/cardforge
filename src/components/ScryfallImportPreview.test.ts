import { expect, test } from 'vitest';
import { sampleEvenly } from './ScryfallImportPreview';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

test('takes evenly spaced items across the list', () => {
  expect(sampleEvenly(range(16), 8)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  expect(sampleEvenly(range(302), 8)).toEqual([0, 37, 75, 113, 151, 188, 226, 264]);
});

test('returns every item when there are fewer than asked for', () => {
  expect(sampleEvenly(range(3), 8)).toEqual([0, 1, 2]);
  expect(sampleEvenly([], 8)).toEqual([]);
});
