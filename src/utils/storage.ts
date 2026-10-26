import { Card } from '../types/card';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export type MigrationResult = 'migrated' | 'none' | 'kept-legacy';

export interface LoadedCards {
  /** null when nothing usable is saved. */
  cards: Card[] | null;
  /** Built-in set version the cards were saved with; 1 when absent. */
  version: number;
}

export interface CardStore {
  kind: 'indexeddb' | 'localstorage';
  load(): Promise<LoadedCards>;
  /** Rejects with the storage error (e.g. `QuotaExceededError`). */
  save(cards: Card[], version: number): Promise<void>;
  /** The cached value, or undefined when it is missing or older than `maxAgeMs`. */
  getCache<T>(key: string, maxAgeMs: number): Promise<T | undefined>;
  setCache(key: string, value: unknown): Promise<void>;
}

const DB_NAME = 'cardforge';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

const LEGACY_CARDS_KEY = 'cardforge_custom_cards_v1';
const LEGACY_VERSION_KEY = 'cardforge_card_set_version';
const CORRUPT_BACKUP_KEY = 'cardforge_custom_cards_v1_corrupt';
const CACHE_PREFIX = 'cardforge_cache_';

/** Runs one request in its own transaction and settles once the transaction has committed. */
function transact<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve(request.result);
    // A failed request aborts the transaction, as does a failed commit (e.g. QuotaExceededError).
    tx.onabort = () => reject(tx.error ?? new DOMException('The transaction was aborted', 'AbortError'));
  });
}

export function openIdbStore(factory: IDBFactory, dbName = DB_NAME): Promise<KeyValueStore> {
  return new Promise((resolve, reject) => {
    const request = factory.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        get: <T>(key: string) => transact<T | undefined>(db, 'readonly', store => store.get(key)),
        async set(key, value) {
          await transact(db, 'readwrite', store => store.put(value, key));
        },
        delete: key => transact(db, 'readwrite', store => store.delete(key)),
      });
    };
  });
}

function storageKey(key: string): string {
  if (key === 'cards') return LEGACY_CARDS_KEY;
  if (key === 'cardSetVersion') return LEGACY_VERSION_KEY;
  return CACHE_PREFIX + key;
}

/** Values are JSON, except the set version, which keeps the legacy `String(n)` format. */
export function localStorageStore(storage: Storage): KeyValueStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const raw = storage.getItem(storageKey(key));
      if (raw === null) return undefined;
      return (key === 'cardSetVersion' ? Number(raw) : JSON.parse(raw)) as T;
    },
    async set(key, value) {
      storage.setItem(storageKey(key), key === 'cardSetVersion' ? String(value) : JSON.stringify(value));
    },
    async delete(key) {
      storage.removeItem(storageKey(key));
    },
  };
}

/**
 * Copies the localStorage card database into `target`. The legacy keys are removed only after
 * the copy has been written; an unparseable database or a failed write leaves them untouched.
 */
export async function migrateLegacy(target: KeyValueStore, storage: Storage): Promise<MigrationResult> {
  const raw = storage.getItem(LEGACY_CARDS_KEY);
  if (raw === null) return 'none';
  let cards: unknown;
  try {
    cards = JSON.parse(raw);
  } catch {
    return 'kept-legacy';
  }
  if (!Array.isArray(cards)) return 'kept-legacy';
  try {
    // `cards` goes last: its presence marks the migration as done, so a half-finished copy is retried.
    await target.set('cardSetVersion', Number(storage.getItem(LEGACY_VERSION_KEY)) || 1);
    await target.set('cards', cards);
  } catch (e) {
    console.error('Failed to move the card database to IndexedDB; keeping it in localStorage', e);
    return 'kept-legacy';
  }
  storage.removeItem(LEGACY_CARDS_KEY);
  storage.removeItem(LEGACY_VERSION_KEY);
  return 'migrated';
}

/** Like the old loader, an empty or malformed database counts as nothing saved. */
async function toLoaded(kv: KeyValueStore, cards: unknown): Promise<LoadedCards> {
  if (!Array.isArray(cards) || cards.length === 0) return { cards: null, version: 1 };
  return { cards, version: Number(await kv.get('cardSetVersion')) || 1 };
}

/**
 * localStorage mode saves over the legacy key, so a database the loader can't use is first copied
 * to a backup key (unless a backup already exists). Throws if the copy can't be written.
 */
function backUpUnusable(storage: Storage): void {
  const raw = storage.getItem(LEGACY_CARDS_KEY);
  if (raw === null || storage.getItem(CORRUPT_BACKUP_KEY) !== null) return;
  try {
    if (Array.isArray(JSON.parse(raw))) return;
  } catch {
    // Unparseable: back it up.
  }
  storage.setItem(CORRUPT_BACKUP_KEY, raw);
}

/** Read errors fall back to "nothing saved", as the old loader did. */
async function loadLegacy(legacy: KeyValueStore): Promise<LoadedCards> {
  try {
    return await toLoaded(legacy, await legacy.get('cards'));
  } catch (e) {
    console.error('Failed to load the saved card database', e);
    return { cards: null, version: 1 };
  }
}

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

/**
 * Opens the card database in IndexedDB, or in localStorage when IndexedDB is unavailable or
 * fails to open. With IndexedDB, a localStorage database is migrated before the first load or save.
 */
export async function openCardStore(
  deps: { indexedDB?: IDBFactory | null; localStorage?: Storage } = {}
): Promise<CardStore> {
  const storage = deps.localStorage ?? globalThis.localStorage;
  const factory = deps.indexedDB === undefined ? globalThis.indexedDB : deps.indexedDB;
  const legacy = localStorageStore(storage);

  const idb = factory
    ? await openIdbStore(factory).catch(e => {
        console.warn('IndexedDB is unavailable; saving the card database to localStorage', e);
        return null;
      })
    : null;
  const kv = idb ?? legacy;

  // IndexedDB: the one-time migration, decided by whether IndexedDB has `cards` yet.
  let migration: Promise<MigrationResult> | undefined;
  const migrate = (target: KeyValueStore, cards: unknown) =>
    (migration ??=
      cards === undefined ? migrateLegacy(target, storage) : Promise.resolve<MigrationResult>('none'));
  // localStorage: the one-time backup of an unusable database.
  let backup: Promise<void> | undefined;
  const backUp = () => (backup ??= (async () => backUpUnusable(storage))());
  /** Every save waits for this, so it can't land before the legacy copy or the backup. */
  const beforeSave = async () => {
    if (!idb) return backUp();
    await (migration ?? migrate(idb, await idb.get('cards')));
  };

  let latestSave = 0;
  let saveQueue: Promise<void> = Promise.resolve();

  return {
    kind: idb ? 'indexeddb' : 'localstorage',

    async load() {
      if (!idb) {
        // A failed backup blocks saves (they reject with its error), so loading can go on.
        await backUp().catch(e => console.error('Failed to back up the unreadable card database', e));
        return loadLegacy(legacy);
      }
      let cards = await idb.get('cards');
      const result = await migrate(idb, cards);
      if (cards === undefined && result === 'migrated') cards = await idb.get('cards');
      const saved = await toLoaded(idb, cards);
      // Show a database that couldn't be copied over instead of starting empty.
      return saved.cards === null && result === 'kept-legacy' ? loadLegacy(legacy) : saved;
    },

    save(cards, version) {
      const ticket = ++latestSave;
      const result = saveQueue.then(async () => {
        await beforeSave();
        if (ticket !== latestSave) return; // a newer save is queued and will write its state
        // Cards first: if only they land, the old version just makes the next load rebase them again.
        await kv.set('cards', cards);
        await kv.set('cardSetVersion', version);
      });
      saveQueue = result.catch(() => {});
      return result;
    },

    async getCache<T>(key: string, maxAgeMs: number): Promise<T | undefined> {
      const entry = await kv.get<CacheEntry<T>>(key);
      if (typeof entry?.savedAt !== 'number' || Date.now() - entry.savedAt > maxAgeMs) return undefined;
      return entry.value;
    },

    setCache: (key, value) => kv.set(key, { savedAt: Date.now(), value } satisfies CacheEntry<unknown>),
  };
}
