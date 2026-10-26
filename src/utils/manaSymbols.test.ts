import { describe, expect, it } from 'vitest';
import { parseCost, symbolName, symbolShape } from './manaSymbols';

describe('symbolShape', () => {
  it('classifies the new symbols', () => {
    expect(symbolShape('2/W')).toEqual({ kind: 'mono-hybrid', generic: '2', color: 'W' });
    expect(symbolShape('W/U/P')).toEqual({ kind: 'hybrid-phyrexian', a: 'W', b: 'U' });
    expect(symbolShape('G/P')).toEqual({ kind: 'phyrexian', color: 'G' });
    expect(symbolShape('C')).toEqual({ kind: 'colorless' });
    expect(symbolShape('S')).toEqual({ kind: 'snow' });
    expect(symbolShape('½')).toEqual({ kind: 'generic', text: '½' });
    expect(symbolShape('CHAOS')).toEqual({ kind: 'other', text: 'CHAOS' });
  });

  it('keeps the existing symbols', () => {
    expect(symbolShape('w')).toEqual({ kind: 'color', color: 'W' });
    expect(symbolShape('12')).toEqual({ kind: 'generic', text: '12' });
    expect(symbolShape('W/U')).toEqual({ kind: 'hybrid', a: 'W', b: 'U' });
    expect(symbolShape('T')).toEqual({ kind: 'tap' });
    expect(symbolShape('Q')).toEqual({ kind: 'untap' });
  });
});

describe('symbolName', () => {
  it('names the new symbols', () => {
    expect(symbolName('2/W')).toBe('2 generic or white mana');
    expect(symbolName('W/U/P')).toBe('white or blue Phyrexian mana');
    expect(symbolName('S')).toBe('snow mana');
    expect(symbolName('½')).toBe('half generic mana');
    expect(symbolName('∞')).toBe('infinite generic mana');
    expect(symbolName('CHAOS')).toBe('CHAOS symbol');
  });

  it('keeps the existing names', () => {
    expect(symbolName('W/U')).toBe('white or blue mana');
    expect(symbolName('T')).toBe('tap');
    expect(symbolName('X')).toBe('X mana');
    expect(symbolName('2')).toBe('2 generic mana');
    expect(symbolName('G/P')).toBe('green Phyrexian mana');
  });
});

describe('parseCost', () => {
  it('keeps braced hybrid-Phyrexian symbols whole', () => {
    expect(parseCost('{2}{G}{G/U/P}{U}')).toEqual(['2', 'G', 'G/U/P', 'U']);
  });
});
