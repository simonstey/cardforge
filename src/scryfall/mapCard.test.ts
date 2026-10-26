import { expect, test } from 'vitest';
import type { Card } from '../types/card';
import { determineColors } from '../utils/cardHelpers';
import { isDoubleSided, isTokenLike, mapCard, type MapContext } from './mapCard';
import type { ScryfallCard } from './types';
import adventure from './__fixtures__/adventure.json';
import artSeries from './__fixtures__/art-series.json';
import basic from './__fixtures__/basic.json';
import battle from './__fixtures__/battle.json';
import classCard from './__fixtures__/class.json';
import colorless from './__fixtures__/colorless.json';
import dfcToken from './__fixtures__/dfc-token.json';
import emblem from './__fixtures__/emblem.json';
import flip from './__fixtures__/flip.json';
import hybridPhyrexian from './__fixtures__/hybrid-phyrexian.json';
import mdfc from './__fixtures__/mdfc.json';
import meld from './__fixtures__/meld.json';
import monoHybrid from './__fixtures__/mono-hybrid.json';
import normal from './__fixtures__/normal.json';
import planeswalker from './__fixtures__/planeswalker.json';
import reversible from './__fixtures__/reversible.json';
import saga from './__fixtures__/saga.json';
import snowBasic from './__fixtures__/snow-basic.json';
import snowCost from './__fixtures__/snow-cost.json';
import split from './__fixtures__/split.json';
import token from './__fixtures__/token.json';
import transform from './__fixtures__/transform.json';

const ctx: MapContext = { setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty', importedAt: '2026-10-26T00:00:00.000Z' };

const FIXTURES: ScryfallCard[] = [
  normal, split, flip, adventure, transform, battle, mdfc, meld, saga, classCard, planeswalker,
  basic, snowBasic, monoHybrid, hybridPhyrexian, colorless, snowCost, token, dfcToken, emblem, artSeries, reversible,
];

/** Maps a fixture and pins the whole result in the snapshot file. */
function mapped(fixture: ScryfallCard): Card {
  const card = mapCard(fixture, ctx);
  expect(card).toMatchSnapshot();
  if (!card) throw new Error(`${fixture.name} mapped to null`);
  return card;
}

const clone = (fixture: ScryfallCard): ScryfallCard => structuredClone(fixture);

test('normal: Lightning Bolt', () => {
  const card = mapped(normal);
  expect(card).toMatchObject({
    id: `scry:${normal.id}`,
    name: 'Lightning Bolt',
    cost: '{R}',
    rarity: 'C',
    source: 'scryfall:m10',
    collectorNumber: '146',
  });
  expect(card.colors).toEqual(['R']);
  const image = card.scryfall?.image ?? {};
  // The URLs carry a `?<timestamp>` query, so the extension is checked on the path.
  expect(new URL(image.art ?? 'about:blank').pathname).toMatch(/\/art\/.*\.webp$/);
  expect(image.full).toContain('/display/');
});

test('split: the left half is the front, the right half the back', () => {
  const card = mapped(split);
  expect(card).toMatchObject({ name: 'Fire', cost: '{1}{R}', backFace: { name: 'Ice', cost: '{1}{U}' } });
  expect(card.colors).toEqual(['Multicolor', 'U', 'R']);
  expect(card.scryfall?.image?.fullBack).toBeUndefined();
  expect(card.scryfall?.image?.artBack).toBeUndefined();
});

test('flip: the flipped half is the back, the image comes from the root', () => {
  const card = mapped(flip);
  expect(card.backFace?.name).toBe('Tok-Tok, Volcano Born');
  expect(card.scryfall?.image?.full).toBe(flip.image_uris.display);
  expect(card.scryfall?.image?.fullBack).toBeUndefined();
});

test('adventure: the adventure is the back, the image comes from the root', () => {
  const card = mapped(adventure);
  expect(card.backFace).toMatchObject({ name: 'Stomp', cost: '{1}{R}' });
  expect(card.scryfall?.image?.full).toBe(adventure.image_uris.display);
  expect(card.scryfall?.image?.fullBack).toBeUndefined();
});

test('transform: front and back faces with their own images', () => {
  const card = mapped(transform);
  expect(card).toMatchObject({ name: 'Delver of Secrets', cost: '{U}', powerToughness: '1/1' });
  expect(card.backFace).toMatchObject({ name: 'Insectile Aberration', powerToughness: '3/2' });
  expect(card.backFace).not.toHaveProperty('cost');
  expect(card.scryfall?.image?.art).toBe(transform.card_faces[0].image_uris.art);
  expect(card.scryfall?.image?.fullBack).toContain('/display/back/');
});

test('battle: defense goes into powerToughness', () => {
  const card = mapped(battle);
  expect(card.powerToughness).toBe(battle.card_faces[0].defense);
  expect(card.backFace).toMatchObject({ name: 'Awakened Skyclave', powerToughness: '4/4' });
});

test('mdfc: the back cost is the second face mana_cost', () => {
  const card = mapped(mdfc);
  expect(card.cost).toBe('{2}{R}');
  expect(card.backFace?.cost ?? '').toBe(mdfc.card_faces[1].mana_cost);
  expect(card.backFace).not.toHaveProperty('cost');

  const spellBack = clone(mdfc);
  spellBack.card_faces![1].mana_cost = '{3}{R}{R}';
  expect(mapCard(spellBack, ctx)?.backFace?.cost).toBe('{3}{R}{R}');
});

test.each([
  ['meld', meld],
  ['saga', saga],
  ['class', classCard],
  ['mono-hybrid', monoHybrid],
  ['hybrid-phyrexian', hybridPhyrexian],
  ['colorless', colorless],
  ['snow-cost', snowCost],
])('%s: maps as a single-face card', (_, fixture: ScryfallCard) => {
  const card = mapped(fixture);
  expect(card).toMatchObject({ name: fixture.name, cost: fixture.mana_cost, type: fixture.type_line });
  expect(card.backFace).toBeUndefined();
});

test('planeswalker: loyalty goes into powerToughness', () => {
  expect(mapped(planeswalker).powerToughness).toBe('3');
});

test.each([
  ['basic', basic],
  ['snow-basic', snowBasic],
])('%s: basic lands are rarity L and colourless', (_, fixture: ScryfallCard) => {
  const card = mapped(fixture);
  expect(card.rarity).toBe('L');
  expect(card.colors).toEqual(['Colorless']);
  expect(card).not.toHaveProperty('cost');
});

test.each([
  ['token', token],
  ['emblem', emblem],
  ['dfc-token', dfcToken],
])('%s: rarity T in the parent set', (_, fixture: ScryfallCard) => {
  const card = mapped(fixture);
  expect(card).toMatchObject({ rarity: 'T', setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty' });
  expect(card.source).toBe(`scryfall:${fixture.set}`);
});

test('a non-token layout from a token set is a token in the parent set', () => {
  // Helper and checklist cards keep their printed rarity on Scryfall; as tokens they stay out of the common slot.
  const helper = { ...clone(token), layout: 'normal', rarity: 'common' };
  expect(mapCard(helper, ctx)).toMatchObject({ rarity: 'T', setCode: 'NEO', setName: 'Kamigawa: Neon Dynasty' });
});

test('isTokenLike: token layouts, or any card from a token set', () => {
  expect(isTokenLike(token)).toBe(true);
  expect(isTokenLike(emblem)).toBe(true);
  expect(isTokenLike(dfcToken)).toBe(true);
  expect(isTokenLike({ ...clone(token), layout: 'normal' })).toBe(true);
  // A token layout printed in a main set is still a token.
  expect(isTokenLike({ ...clone(normal), layout: 'token' })).toBe(true);
  expect(isTokenLike(normal)).toBe(false);
  expect(isTokenLike({ ...clone(normal), set_type: undefined })).toBe(false);
});

test('art-series: not representable', () => {
  const card = mapCard(artSeries, ctx);
  expect(card).toMatchSnapshot();
  expect(card).toBeNull();
});

test('reversible: both sides, oracle id from face 0', () => {
  const card = mapped(reversible);
  expect(card.backFace?.name).toBe('Adrix and Nev, Twincasters');
  expect(card.scryfall?.oracleId).toBe(reversible.card_faces[0].oracle_id);
  expect(card.scryfall?.image?.fullBack).toBe(reversible.card_faces[1].image_uris.display);
});

test('single-face colors match determineColors shape', () => {
  let checked = 0;
  for (const fixture of FIXTURES.filter((f) => !f.card_faces)) {
    const card = mapCard(fixture, ctx);
    // Tokens, emblems and lands can have colours their (empty) cost doesn't show.
    if (!card || !(fixture.colors ?? []).every((c) => (card.cost ?? '').includes(c))) continue;
    expect(card.colors, fixture.name).toEqual(determineColors(card.cost, card.type));
    checked++;
  }
  expect(checked).toBeGreaterThanOrEqual(10);
});

test('maps a card with no images', () => {
  const bare = { ...clone(normal), image_status: 'missing' };
  delete bare.image_uris;
  const card = mapCard(bare, ctx);
  expect(card).toMatchObject({ name: 'Lightning Bolt', cost: '{R}' });
  expect(card?.scryfall).not.toHaveProperty('image');
});

test('falls back to the older image keys and never uses png', () => {
  const { png, normal: jpg, art_crop } = normal.image_uris;
  const old = { ...clone(normal), image_uris: { png, normal: jpg, art_crop } };
  expect(mapCard(old, ctx)?.scryfall?.image).toEqual({ art: art_crop, full: jpg });

  const pngOnly = { ...clone(normal), image_uris: { png } };
  expect(mapCard(pngOnly, ctx)?.scryfall).not.toHaveProperty('image');
});

test('never uses the combined split cost', () => {
  for (const fixture of FIXTURES) {
    const card = mapCard(fixture, ctx);
    expect(card?.cost ?? '', fixture.name).not.toContain(' // ');
    expect(card?.backFace?.cost ?? '', fixture.name).not.toContain(' // ');
  }
  // Faces without their own cost must not fall back to the combined root cost.
  const costless = clone(split);
  for (const face of costless.card_faces!) delete face.mana_cost;
  expect(mapCard(costless, ctx)).not.toHaveProperty('cost');
});

test('prefers the printed fields of non-English cards', () => {
  const german = {
    ...clone(normal),
    lang: 'de',
    printed_name: 'Blitzschlag',
    printed_type_line: 'Spontanzauber',
    printed_text: 'Der Blitzschlag fügt einem Ziel deiner Wahl 3 Schadenspunkte zu.',
  };
  expect(mapCard(german, ctx)).toMatchObject({ name: 'Blitzschlag', type: 'Spontanzauber', text: german.printed_text });

  // Rarity reads the English type line, so a German basic stays a basic.
  const wald = { ...clone(basic), lang: 'de', printed_name: 'Wald', printed_type_line: 'Standardland — Wald' };
  expect(mapCard(wald, ctx)).toMatchObject({ name: 'Wald', rarity: 'L' });
});

test('returns null for skipped layouts and cards with neither name nor type', () => {
  for (const layout of ['art_series', 'vanguard', 'planar', 'scheme']) {
    expect(mapCard({ ...clone(normal), layout }, ctx), layout).toBeNull();
  }
  const blank = { ...clone(normal), name: '' };
  delete blank.type_line;
  expect(mapCard(blank, ctx)).toBeNull();
});

test('mapped cards carry no undefined keys', () => {
  const hasUndefined = (value: unknown): boolean =>
    !!value && typeof value === 'object' && Object.values(value).some((v) => v === undefined || hasUndefined(v));
  for (const fixture of FIXTURES) expect(hasUndefined(mapCard(fixture, ctx)), fixture.name).toBe(false);
});

test('isDoubleSided: faces with their own images and no root image', () => {
  const sided = FIXTURES.filter(isDoubleSided).map((f) => f.layout);
  expect(sided.sort()).toEqual(['art_series', 'double_faced_token', 'modal_dfc', 'reversible_card', 'transform', 'transform']);
});
