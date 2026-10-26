import { describe, expect, it } from 'vitest';
import { mapCard, type MapContext } from '../scryfall/mapCard';
import { syncImported } from '../scryfall/merge';
import type { ScryfallCard } from '../scryfall/types';
import type { Card } from '../types/card';
import { determineColors } from './cardHelpers';
import { normalizeImportedCard } from './cardImport';
import basic from '../scryfall/__fixtures__/basic.json';
import emblem from '../scryfall/__fixtures__/emblem.json';
import normal from '../scryfall/__fixtures__/normal.json';
import planeswalker from '../scryfall/__fixtures__/planeswalker.json';
import split from '../scryfall/__fixtures__/split.json';
import token from '../scryfall/__fixtures__/token.json';
import transform from '../scryfall/__fixtures__/transform.json';

const ctx: MapContext = { setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty', importedAt: '2026-10-26T00:00:00.000Z' };

const full: Card = {
  id: 'scry:abc',
  name: 'Delver of Secrets',
  cost: '{U}',
  type: 'Creature — Human Wizard',
  text: 'At the beginning of your upkeep, look at the top card of your library.',
  flavorText: 'Flavor.',
  powerToughness: '1/1',
  rarity: 'C',
  artist: 'Nils Hamm',
  source: 'scryfall:isd',
  colors: ['U'],
  backFace: { name: 'Insectile Aberration', type: 'Creature — Human Insect', text: 'Flying', powerToughness: '3/2', cost: '{1}{U}' },
  artKey: 'scryfall:isd::Delver of Secrets',
  customImageUrl: 'https://example.com/a.jpg',
  setCode: 'ISD',
  setName: 'Innistrad',
  collectorNumber: '51★',
  scryfall: {
    id: 'abc',
    oracleId: 'def',
    uri: 'https://scryfall.com/card/isd/51',
    layout: 'transform',
    image: { art: 'a', full: 'f', artBack: 'ab', fullBack: 'fb' },
    importedAt: '2026-10-26T00:00:00.000Z',
    userModified: true,
  },
};

describe('normalizeImportedCard', () => {
  it('keeps backFace with cost, artKey, customImageUrl, set fields and scryfall', () => {
    const out = normalizeImportedCard(JSON.parse(JSON.stringify(full)), 0);
    expect(out.backFace).toEqual(full.backFace);
    expect(out.artKey).toBe(full.artKey);
    expect(out.customImageUrl).toBe(full.customImageUrl);
    expect(out.setCode).toBe('ISD');
    expect(out.setName).toBe('Innistrad');
    expect(out.collectorNumber).toBe('51★');
    expect(out.scryfall).toEqual(full.scryfall);
  });

  it('keeps valid colors and recomputes invalid ones', () => {
    const kept = normalizeImportedCard({ name: 'A', cost: '{U}', type: 'Instant', colors: ['Multicolor', 'U', 'R'] }, 0);
    expect(kept.colors).toEqual(['Multicolor', 'U', 'R']);
    const bad = normalizeImportedCard({ name: 'A', cost: '{U}', type: 'Instant', colors: ['purple'] }, 0);
    expect(bad.colors).toEqual(determineColors('{U}', 'Instant'));
  });

  it('drops a malformed scryfall object', () => {
    expect(normalizeImportedCard({ name: 'A', scryfall: { uri: 'x' } }, 0).scryfall).toBeUndefined();
  });

  it('applies the base defaults and omits absent optional keys', () => {
    const out = normalizeImportedCard({}, 3, 1000);
    expect(out).toMatchObject({ id: 'imported-1000-3', name: 'Untitled Card', type: 'Card', rarity: 'C', source: 'Custom Import' });
    expect(Object.keys(out)).not.toContain('backFace');
    expect(Object.keys(out)).not.toContain('scryfall');
  });

  it('export then import round-trips a Scryfall card', () => {
    expect(normalizeImportedCard(JSON.parse(JSON.stringify(full)), 0)).toEqual(full);
  });

  it('round-trips a card without the optional text fields exactly, adding no empty strings', () => {
    const partial: Card = {
      id: 'scry:tok',
      name: 'Spirit',
      type: 'Token Creature — Spirit',
      rarity: 'T',
      source: 'scryfall:tneo',
      colors: ['Colorless'],
      setCode: 'NEO',
      scryfall: { id: 'tok', importedAt: '2026-10-26T00:00:00.000Z' },
    };
    expect(normalizeImportedCard(JSON.parse(JSON.stringify(partial)), 0)).toStrictEqual(partial);
    // Empty strings in the file are dropped too; the name and type keep their defaults.
    const blank = normalizeImportedCard({ id: 'x', cost: '', text: '', flavorText: '', powerToughness: '', artist: '' }, 0);
    expect(blank).toStrictEqual({ id: 'x', name: 'Untitled Card', type: 'Card', rarity: 'C', source: 'Custom Import', colors: ['Colorless'] });
  });

  it.each([
    ['normal', normal],
    ['basic land', basic],
    ['token', token],
    ['emblem', emblem],
    ['transform', transform],
    ['planeswalker', planeswalker],
    ['split', split],
  ])('a JSON export of an imported %s re-imports as unchanged', (_, fixture) => {
    const mapped = mapCard(fixture as ScryfallCard, ctx);
    if (!mapped) throw new Error('fixture mapped to null');
    const restored = normalizeImportedCard(JSON.parse(JSON.stringify(mapped)), 0);
    const sync = syncImported([restored], [mapped], [mapped.setCode ?? '']);
    expect(sync).toMatchObject({ unchanged: 1, updated: 0, added: 0, removed: 0 });
  });
});
