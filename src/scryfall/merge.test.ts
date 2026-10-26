import { test, expect } from 'vitest';
import type { Card } from '../types/card';
import {
  syncImported,
  removeImportedSet,
  listImportedSets,
  markUserModified,
  describeSync,
  type SyncResult,
} from './merge';

const sc = (id: string, set = 'NEO', text = 'Text', at = '2026-01-01T00:00:00Z'): Card => ({
  id: `scry:${id}`,
  name: `Card ${id}`,
  type: 'Creature',
  text,
  rarity: 'C',
  source: `scryfall:${set.toLowerCase()}`,
  setCode: set,
  setName: set === 'NEO' ? 'Kamigawa: Neon Dynasty' : 'Other Set',
  scryfall: { id, importedAt: at },
});

const zero: SyncResult = { cards: [], imported: 0, added: 0, updated: 0, unchanged: 0, protected: 0, removed: 0 };

test('first import adds every card', () => {
  const incoming = [sc('a'), sc('b'), sc('c')];
  const r = syncImported([], incoming, ['NEO']);
  expect(r.added).toBe(3);
  expect(r.imported).toBe(3);
  expect(r.cards).toEqual(incoming);
});

test('identical re-import is unchanged even with a new importedAt', () => {
  const existing = [sc('a'), sc('b'), sc('c')];
  const incoming = [sc('a', 'NEO', 'Text', 'NEW'), sc('b', 'NEO', 'Text', 'NEW'), sc('c', 'NEO', 'Text', 'NEW')];
  const r = syncImported(existing, incoming, ['NEO']);
  expect(r.unchanged).toBe(3);
  expect(r.added + r.updated + r.removed + r.protected).toBe(0);
  expect(r.cards).toEqual(existing);
});

test('equality ignores property insertion order', () => {
  const a = sc('a');
  const reordered: Card = {
    scryfall: { importedAt: 'NEW', id: 'a' },
    setName: a.setName,
    setCode: a.setCode,
    source: a.source,
    rarity: a.rarity,
    text: a.text,
    type: a.type,
    name: a.name,
    id: a.id,
  };
  const r = syncImported([a], [reordered], ['NEO']);
  expect(r.unchanged).toBe(1);
  expect(r.updated).toBe(0);
});

test('changed text updates in place', () => {
  const existing = [sc('a'), sc('b'), sc('c')];
  const r = syncImported(existing, [sc('a'), sc('b', 'NEO', 'New'), sc('c')], ['NEO']);
  expect(r.updated).toBe(1);
  expect(r.unchanged).toBe(2);
  expect(r.cards[1].text).toBe('New');
  expect(r.cards.map((c) => c.id)).toEqual(['scry:a', 'scry:b', 'scry:c']);
});

test('protected card is kept on re-import', () => {
  const edited = markUserModified(sc('a', 'NEO', 'Mine'));
  const r = syncImported([edited], [sc('a', 'NEO', 'Theirs')], ['NEO']);
  expect(r.protected).toBe(1);
  expect(r.updated).toBe(0);
  expect(r.cards).toEqual([edited]);
});

test('filter change shrinks the set', () => {
  const existing = [sc('a'), sc('b'), sc('c'), sc('d'), sc('e')];
  const r = syncImported(existing, [sc('a'), sc('b'), sc('c')], ['NEO']);
  expect(r.removed).toBe(2);
  expect(r.cards.map((c) => c.id)).toEqual(['scry:a', 'scry:b', 'scry:c']);
});

test('deleted card returns', () => {
  const r = syncImported([sc('a'), sc('c')], [sc('a'), sc('b'), sc('c')], ['NEO']);
  expect(r.added).toBe(1);
  expect(r.cards.map((c) => c.id)).toEqual(['scry:a', 'scry:c', 'scry:b']);
});

test('edited card outside the result is kept', () => {
  const edited = markUserModified(sc('z'));
  const r = syncImported([sc('a'), edited], [sc('a')], ['NEO']);
  expect(r.cards).toContainEqual(edited);
  expect(r.protected).toBe(1);
  expect(r.removed).toBe(0);
});

test('other sets, SWTG and custom cards are untouched', () => {
  const swtg: Card = { id: 'swtg-1', name: 'X', type: 'Creature', rarity: 'C', setCode: 'NEO' };
  const custom: Card = { id: 'custom-1', name: 'Y', type: 'Creature', rarity: 'C' };
  const other = sc('o', 'MOM');
  const existing = [swtg, other, custom, sc('a')];
  const r = syncImported(existing, [], ['NEO']);
  expect(r.removed).toBe(1);
  expect(r.cards).toEqual([swtg, other, custom]);
});

test('removeImportedSet removes edited cards too', () => {
  const swtg: Card = { id: 'swtg-1', name: 'X', type: 'Creature', rarity: 'C', setCode: 'NEO' };
  const other = sc('o', 'MOM');
  const r = removeImportedSet([swtg, sc('a'), markUserModified(sc('b')), other], 'NEO');
  expect(r.removed).toBe(2);
  expect(r.cards).toEqual([swtg, other]);
});

test('listImportedSets lists sets in first-seen order', () => {
  const swtg: Card = { id: 'swtg-1', name: 'X', type: 'Creature', rarity: 'C', setCode: 'NEO' };
  expect(listImportedSets([swtg, sc('o', 'MOM'), sc('a'), sc('b'), sc('p', 'MOM')])).toEqual([
    { code: 'MOM', name: 'Other Set', count: 2 },
    { code: 'NEO', name: 'Kamigawa: Neon Dynasty', count: 2 },
  ]);
});

test('markUserModified does not mutate and ignores non-Scryfall cards', () => {
  const card = sc('a');
  const marked = markUserModified(card);
  expect(marked.scryfall?.userModified).toBe(true);
  expect(card.scryfall?.userModified).toBeUndefined();
  const custom: Card = { id: 'c', name: 'Y', type: 'Creature', rarity: 'C' };
  expect(markUserModified(custom)).toBe(custom);
});

test('describeSync omits zero counts', () => {
  expect(describeSync({ ...zero, imported: 302, updated: 12, protected: 2 }, 'Kamigawa: Neon Dynasty')).toBe(
    'Imported 302 cards from Kamigawa: Neon Dynasty (12 updated, 2 kept because you edited them)',
  );
  expect(describeSync({ ...zero, imported: 5, removed: 1 }, 'NEO')).toBe('Imported 5 cards from NEO (1 removed)');
  expect(describeSync({ ...zero, imported: 5 }, 'NEO')).toBe('Imported 5 cards from NEO');
});
