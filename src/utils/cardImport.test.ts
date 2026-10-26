import { describe, expect, it } from 'vitest';
import type { Card } from '../types/card';
import { determineColors } from './cardHelpers';
import { normalizeImportedCard } from './cardImport';

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
});
