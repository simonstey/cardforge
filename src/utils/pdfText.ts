/**
 * Text for jsPDF's standard fonts (Helvetica and the like), which have only the WinAnsi characters:
 * Latin-1 plus the curly quotes, dashes, bullet, ellipsis and the few others jsPDF maps into 0x80–0x9F.
 * A single character outside that set makes jsPDF write the whole string as two-byte junk (a planeswalker's
 * "−3:" garbles its entire line), so `pdfSafeText` maps such characters to ASCII first.
 */

/** The WinAnsi characters outside Latin-1; jsPDF encodes each as one byte. */
const WIN_ANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** ASCII stand-ins for characters card text uses that the standard fonts lack. */
const ASCII = new Map<string, string>([
  ['\u2212', '-'], // minus sign: loyalty costs, -2/-2
  ['\u2010', '-'], // hyphen
  ['\u2011', '-'], // non-breaking hyphen
  ['\u2012', '-'], // figure dash
  ['\u2015', '-'], // horizontal bar
  ['\u2032', "'"], // prime
  ['\u2033', '"'], // double prime
  ['\u2044', '/'], // fraction slash
  ['\u2190', '<-'], // left arrow
  ['\u2192', '->'], // right arrow
  ['\u221E', 'inf'], // infinity, as in {∞}
  ['\u2605', '*'], // black star
  ['\u2606', '*'], // white star
  ['\u2002', ' '], // en space
  ['\u2003', ' '], // em space
  ['\u2007', ' '], // figure space
  ['\u2009', ' '], // thin space
  ['\u200A', ' '], // hair space
  ['\u202F', ' '], // narrow no-break space
  ['\u200B', ''], // zero-width space
  ['\u200C', ''], // zero-width non-joiner
  ['\u200D', ''], // zero-width joiner
  ['\u2060', ''], // word joiner
  ['\uFEFF', ''], // byte order mark
]);

/** Whether jsPDF's standard fonts can draw `ch`. */
function encodable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code < 0x80 || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(ch);
}

/**
 * `text` with every character the standard PDF fonts can't draw replaced: by its ASCII stand-in, else
 * without its accent (ő → o), else by "?". Characters the fonts have, curly quotes and dashes included,
 * are kept.
 */
export function pdfSafeText(text: string): string {
  let out = '';
  for (const ch of text) {
    if (encodable(ch)) {
      out += ch;
      continue;
    }
    const stand = ASCII.get(ch);
    if (stand !== undefined) {
      out += stand;
      continue;
    }
    const bare = ch.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    out += bare && [...bare].every(encodable) ? bare : '?';
  }
  return out;
}
