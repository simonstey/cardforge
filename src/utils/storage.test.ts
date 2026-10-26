import { afterEach, expect, test, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { Card } from '../types/card';
import { KeyValueStore, localStorageStore, migrateLegacy, openCardStore, openIdbStore } from './storage';

const LEGACY_CARDS = 'cardforge_custom_cards_v1';
const LEGACY_VERSION = 'cardforge_card_set_version';
const CORRUPT_BACKUP = 'cardforge_custom_cards_v1_corrupt';

const card: Card = { id: 'c1', name: 'Test Card', type: 'Creature', rarity: 'C', text: 'Flying' };

/** In-memory `Storage`. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: key => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
}

const legacyStorage = () =>
  memoryStorage({ [LEGACY_CARDS]: JSON.stringify([card]), [LEGACY_VERSION]: '2' });

afterEach(() => {
  vi.restoreAllMocks();
});

test('round-trips cards and version through IndexedDB', async () => {
  const indexedDB = new IDBFactory();
  const localStorage = memoryStorage();
  const store = await openCardStore({ indexedDB, localStorage });
  expect(store.kind).toBe('indexeddb');
  await store.save([card], 2);
  expect(await store.load()).toEqual({ cards: [card], version: 2 });
  // Committed to the database, not held by this connection; localStorage is untouched.
  const reopened = await openCardStore({ indexedDB, localStorage });
  expect(await reopened.load()).toEqual({ cards: [card], version: 2 });
  expect(localStorage.length).toBe(0);
});

test('migrates a legacy localStorage database and removes the legacy keys', async () => {
  const indexedDB = new IDBFactory();
  const localStorage = legacyStorage();
  const store = await openCardStore({ indexedDB, localStorage });
  expect(await store.load()).toEqual({ cards: [card], version: 2 });
  expect(localStorage.getItem(LEGACY_CARDS)).toBeNull();
  expect(localStorage.getItem(LEGACY_VERSION)).toBeNull();
  const kv = await openIdbStore(indexedDB);
  expect(await kv.get('cards')).toEqual([card]);
  expect(await kv.get('cardSetVersion')).toBe(2);
  expect(await migrateLegacy(kv, localStorage)).toBe('none');
});

test('keeps legacy keys when the IndexedDB write fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const localStorage = legacyStorage();
  const failing: KeyValueStore = {
    get: async () => undefined,
    set: () => Promise.reject(new DOMException('full', 'QuotaExceededError')),
    delete: async () => {},
  };
  expect(await migrateLegacy(failing, localStorage)).toBe('kept-legacy');
  expect(localStorage.getItem(LEGACY_CARDS)).toBe(JSON.stringify([card]));
  expect(localStorage.getItem(LEGACY_VERSION)).toBe('2');
});

test('loads the legacy database when it cannot be copied to IndexedDB', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  const localStorage = legacyStorage();
  const store = await openCardStore({ indexedDB: new IDBFactory(), localStorage });
  expect(await store.load()).toEqual({ cards: [card], version: 2 });
  expect(localStorage.getItem(LEGACY_CARDS)).toBe(JSON.stringify([card]));
  expect(localStorage.getItem(LEGACY_VERSION)).toBe('2');
});

test('leaves an unparseable legacy database in place', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const indexedDB = new IDBFactory();
  const localStorage = memoryStorage({ [LEGACY_CARDS]: '{not json' });
  const store = await openCardStore({ indexedDB, localStorage });
  expect(await store.load()).toEqual({ cards: null, version: 1 });
  expect(localStorage.getItem(LEGACY_CARDS)).toBe('{not json');
  expect(await migrateLegacy(await openIdbStore(indexedDB), localStorage)).toBe('kept-legacy');
  expect(localStorage.getItem(LEGACY_CARDS)).toBe('{not json');
});

test('migrates the legacy database before a save that comes before the first load', async () => {
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  const localStorage = legacyStorage();
  const store = await openCardStore({ indexedDB: new IDBFactory(), localStorage });
  const other = { ...card, id: 'c2' };
  await store.save([other], 2);
  // The legacy copy is committed first; the save then writes the latest state over it.
  expect(put.mock.calls.map(([value, key]) => [key, value])).toEqual([
    ['cardSetVersion', 2],
    ['cards', [card]],
    ['cards', [other]],
    ['cardSetVersion', 2],
  ]);
  expect(localStorage.getItem(LEGACY_CARDS)).toBeNull();
  expect(localStorage.getItem(LEGACY_VERSION)).toBeNull();
  expect(await store.load()).toEqual({ cards: [other], version: 2 });
});

test('backs up an unparseable localStorage database before saving over it', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const localStorage = memoryStorage({ [LEGACY_CARDS]: '{not json' });
  const store = await openCardStore({ indexedDB: null, localStorage });
  expect(await store.load()).toEqual({ cards: null, version: 1 });
  expect(localStorage.getItem(CORRUPT_BACKUP)).toBe('{not json');
  await store.save([card], 2);
  expect(localStorage.getItem(CORRUPT_BACKUP)).toBe('{not json');
  expect(localStorage.getItem(LEGACY_CARDS)).toBe(JSON.stringify([card]));
  // Also when a save comes before any load.
  const unloaded = memoryStorage({ [LEGACY_CARDS]: '{not json' });
  await (await openCardStore({ indexedDB: null, localStorage: unloaded })).save([card], 2);
  expect(unloaded.getItem(CORRUPT_BACKUP)).toBe('{not json');
});

test('does not save over an unparseable database it could not back up', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const localStorage = memoryStorage({ [LEGACY_CARDS]: '{not json' });
  const setItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === CORRUPT_BACKUP) throw new DOMException('full', 'QuotaExceededError');
    setItem(key, value);
  };
  const store = await openCardStore({ indexedDB: null, localStorage });
  expect(await store.load()).toEqual({ cards: null, version: 1 });
  await expect(store.save([card], 2)).rejects.toHaveProperty('name', 'QuotaExceededError');
  expect(localStorage.getItem(LEGACY_CARDS)).toBe('{not json');
});

test('falls back to localStorage when IndexedDB is unavailable', async () => {
  const localStorage = memoryStorage();
  const store = await openCardStore({ indexedDB: null, localStorage });
  expect(store.kind).toBe('localstorage');
  await store.save([card], 2);
  expect(localStorage.getItem(LEGACY_CARDS)).toBe(JSON.stringify([card]));
  expect(localStorage.getItem(LEGACY_VERSION)).toBe('2');
  expect(await store.load()).toEqual({ cards: [card], version: 2 });
});

test('falls back to localStorage when IndexedDB fails to open', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const indexedDB = new IDBFactory();
  // A newer database version makes opening version 1 fail with a VersionError.
  await new Promise<void>(resolve => {
    const request = indexedDB.open('cardforge', 2);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
  const store = await openCardStore({ indexedDB, localStorage: memoryStorage() });
  expect(store.kind).toBe('localstorage');
});

test('save rejects with the storage error', async () => {
  const localStorage = memoryStorage();
  const setItem = localStorage.setItem;
  localStorage.setItem = () => {
    throw new DOMException('full', 'QuotaExceededError');
  };
  const store = await openCardStore({ indexedDB: null, localStorage });
  await expect(store.save([card], 2)).rejects.toHaveProperty('name', 'QuotaExceededError');
  // A failed save doesn't block the next one.
  localStorage.setItem = setItem;
  await store.save([card], 2);
  expect(await store.load()).toEqual({ cards: [card], version: 2 });
});

test('skips a save superseded by a newer pending one', async () => {
  const localStorage = memoryStorage();
  const setItem = vi.spyOn(localStorage, 'setItem');
  const store = await openCardStore({ indexedDB: null, localStorage });
  const newer = { ...card, id: 'c2' };
  await Promise.all([store.save([card], 2), store.save([card, newer], 2), store.save([newer], 2)]);
  expect(setItem.mock.calls).toEqual([
    [LEGACY_CARDS, JSON.stringify([newer])],
    [LEGACY_VERSION, '2'],
  ]);
});

test('getCache returns undefined once the entry is older than maxAgeMs', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
  const indexedDB = new IDBFactory();
  const store = await openCardStore({ indexedDB, localStorage: memoryStorage() });
  await store.setCache('scryfallSets', ['neo']);
  expect(await (await openIdbStore(indexedDB)).get('scryfallSets')).toEqual({ savedAt: 1_000, value: ['neo'] });
  now.mockReturnValue(1_500);
  expect(await store.getCache('scryfallSets', 500)).toEqual(['neo']);
  now.mockReturnValue(1_501);
  expect(await store.getCache('scryfallSets', 500)).toBeUndefined();
  expect(await store.getCache('missing', 500)).toBeUndefined();
});

test('localStorageStore maps keys onto the legacy keys and the cache prefix', async () => {
  const localStorage = memoryStorage();
  const kv = localStorageStore(localStorage);
  await kv.set('cards', [card]);
  await kv.set('cardSetVersion', 2);
  await kv.set('scryfallSets', { savedAt: 1, value: [] });
  expect(localStorage.getItem(LEGACY_CARDS)).toBe(JSON.stringify([card]));
  expect(localStorage.getItem(LEGACY_VERSION)).toBe('2');
  expect(localStorage.getItem('cardforge_cache_scryfallSets')).toBe('{"savedAt":1,"value":[]}');
  expect(await kv.get('cardSetVersion')).toBe(2);
  await kv.delete('scryfallSets');
  expect(await kv.get('scryfallSets')).toBeUndefined();
});

test('openIdbStore gets, sets and deletes values', async () => {
  const kv = await openIdbStore(new IDBFactory());
  await kv.set('k', { a: 1 });
  expect(await kv.get('k')).toEqual({ a: 1 });
  await kv.delete('k');
  expect(await kv.get('k')).toBeUndefined();
});
