import type { ScryfallSet } from './types';

/** The fields the token-set rule reads; a `/sets` entry or a set seen in a bulk file. */
export type TokenSetCandidate = Pick<ScryfallSet, 'code' | 'name' | 'set_type' | 'parent_set_code'>;

/**
 * The token set that imports with `code` through "Include tokens", on the API and bulk paths alike:
 * the `t<code>` token set (e.g. `tneo` for `neo`) when there is one, else a token-type child of `code`
 * whose name ends in "Tokens". Other token-type children, such as substitute cards (`sneo`) or sticker
 * sheets, are never folded in as tokens; they stay sets of their own.
 */
export function tokenSetFor<S extends TokenSetCandidate>(code: string, sets: readonly S[]): S | undefined {
  const isToken = (s: S) => s.set_type === 'token';
  return (
    sets.find((s) => isToken(s) && s.code === `t${code}`) ??
    sets.find((s) => isToken(s) && s.parent_set_code === code && /\bTokens$/.test(s.name))
  );
}
