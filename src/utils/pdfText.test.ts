import { jsPDF } from 'jspdf';
import { expect, test } from 'vitest';
import { pdfSafeText } from './pdfText';

/** The string jsPDF writes for `text` in its standard Helvetica font, one char per byte. */
function encoded(text: string): string {
  const pdf = new jsPDF({ compress: false });
  pdf.setFont('helvetica', 'normal');
  pdf.text(text, 10, 10);
  return /\((.*)\) Tj/.exec(pdf.output())?.[1] ?? '';
}

test('jsPDF turns a whole line into two-byte junk for one character outside its font', () => {
  // The reason for pdfSafeText: U+2212 in a loyalty ability garbles every character of the line.
  expect(encoded('−3: Draw a card.')).toContain('\u0000');
  expect(encoded('-3: Draw a card.')).toBe('-3: Draw a card.');
});

test('maps characters the standard font lacks to ASCII', () => {
  // U+2212 minus sign, as in planeswalker loyalty costs.
  expect(pdfSafeText('−3: Destroy target creature.')).toBe('-3: Destroy target creature.');
  expect(pdfSafeText('Mox Lotus costs ∞.')).toBe('Mox Lotus costs inf.');
  // Star, arrow, hyphen, non-breaking hyphen, prime, double prime.
  expect(pdfSafeText('★ → \u2010 \u2011 \u2032 \u2033')).toBe(`* -> - - ' "`);
  // Thin and narrow no-break spaces become spaces; zero-width characters go.
  expect(pdfSafeText('a\u2009b\u202Fc\u200Bd\uFEFF')).toBe('a b cd');
});

test('keeps what the standard font has: Latin-1, curly quotes, dashes, bullet, ellipsis', () => {
  const kept = '“Æther,” said Jötun — ‘Lim-Dûl’ … • – ½ × ™ é ß';
  expect(pdfSafeText(kept)).toBe(kept);
});

test('what it keeps is one byte per character in jsPDF: Latin-1 and the WinAnsi extras', () => {
  const latin1 = Array.from({ length: 0x60 }, (_, i) => String.fromCharCode(0xa0 + i)).join('');
  const extras = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  for (const kept of [latin1, extras]) {
    expect(pdfSafeText(kept)).toBe(kept);
    expect(encoded(kept)).toHaveLength(kept.length);
  }
});

test('drops accents the font lacks and marks anything else unknown', () => {
  expect(pdfSafeText('Ő ā ţ')).toBe('O a t');
  expect(pdfSafeText('日本 ł')).toBe('?? ?');
});

test('every character pdfSafeText returns encodes as one byte', () => {
  const samples = [
    '−1: Target creature gets −2/−2 until end of turn.',
    '“Nothing,” he said — ‘nothing’… ½ ∞ ★ → Ő 日本',
    'Creature — Human Wizard • Æther • 2(W/U)',
  ];
  for (const sample of samples) {
    const safe = pdfSafeText(sample);
    const bytes = encoded(safe);
    expect(bytes, sample).not.toContain('\u0000');
    // jsPDF escapes parentheses with a backslash; everything else is one byte per character.
    expect(bytes.replace(/\\([()])/g, '$1').length, sample).toBe(safe.length);
  }
});
