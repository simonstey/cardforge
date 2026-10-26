import type { Card } from '../types/card';
import { setDisplayName } from '../utils/cardHelpers';

export interface SyncResult {
  cards: Card[];
  imported: number;
  added: number;
  updated: number;
  unchanged: number;
  protected: number;
  removed: number;
}

/** A card imported from Scryfall: SWTG and custom cards have no `scryfall`. */
const isImported = (card: Card) => !!card.scryfall;

/** Canonical JSON with sorted keys, so key order never decides equality. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Card identity for sync; the import timestamp is not a content change. */
function fingerprint(card: Card): string {
  return canonical(card.scryfall ? { ...card, scryfall: { ...card.scryfall, importedAt: '' } } : card);
}

/**
 * Syncs the imported cards of `setCodes` with a fresh Scryfall result (spec 6.7):
 * upsert by id, drop in-scope cards missing from `incoming`, keep edited cards.
 */
export function syncImported(existing: Card[], incoming: Card[], setCodes: string[]): SyncResult {
  const codes = new Set(setCodes);
  const inScope = (c: Card) => isImported(c) && !!c.setCode && codes.has(c.setCode);
  const incomingById = new Map(incoming.map((c) => [c.id, c]));
  const existingIds = new Set(existing.map((c) => c.id));

  let updated = 0;
  let unchanged = 0;
  let kept = 0;
  let removed = 0;
  const cards: Card[] = [];

  for (const card of existing) {
    const next = incomingById.get(card.id);
    if (card.scryfall?.userModified && (next || inScope(card))) {
      kept++;
      cards.push(card);
    } else if (next) {
      if (fingerprint(next) === fingerprint(card)) {
        unchanged++;
        cards.push(card);
      } else {
        updated++;
        cards.push(next);
      }
    } else if (inScope(card)) {
      removed++;
    } else {
      cards.push(card);
    }
  }

  const fresh = incoming.filter((c) => !existingIds.has(c.id));
  return {
    cards: [...cards, ...fresh],
    imported: incoming.length,
    added: fresh.length,
    updated,
    unchanged,
    protected: kept,
    removed,
  };
}

/** Removes every imported card of one set, edited ones included. */
export function removeImportedSet(cards: Card[], setCode: string): { cards: Card[]; removed: number } {
  const kept = cards.filter((c) => !(isImported(c) && c.setCode === setCode));
  return { cards: kept, removed: cards.length - kept.length };
}

/** Imported sets present in the database, in first-seen order. */
export function listImportedSets(cards: Card[]): { code: string; name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of cards) {
    if (isImported(c) && c.setCode) counts.set(c.setCode, (counts.get(c.setCode) ?? 0) + 1);
  }
  return [...counts].map(([code, count]) => ({
    code,
    name: setDisplayName(code, cards.filter((c) => c.setCode === code)),
    count,
  }));
}

/** Flags an edited Scryfall card so a re-import leaves it alone. Returns a copy. */
export function markUserModified(card: Card): Card {
  if (!card.scryfall) return card;
  return { ...card, scryfall: { ...card.scryfall, userModified: true } };
}

export function describeSync(result: SyncResult, label: string): string {
  const notes = [
    result.updated && `${result.updated} updated`,
    result.removed && `${result.removed} removed`,
    result.protected && `${result.protected} kept because you edited ${result.protected === 1 ? 'it' : 'them'}`,
  ].filter(Boolean);
  const cards = `${result.imported} ${result.imported === 1 ? 'card' : 'cards'}`;
  return `Imported ${cards} from ${label}${notes.length ? ` (${notes.join(', ')})` : ''}`;
}
