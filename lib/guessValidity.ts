import { WORD_LENGTH } from '../constants/theme';
import validWords from '../constants/validWords.json';
import { tokenizeArmenianWord } from './tokenizeArmenian';

export type GuessValidity = 'incomplete' | 'invalid' | 'valid';

// A guess's tokens already come from the keyboard (see components/Keyboard.tsx),
// so they're tokenized the same way dictionary words are once run through
// tokenizeArmenianWord (e.g. "ու" as a single token) — only the dictionary
// side needs tokenizing here. Joined with a separator that can't appear in a
// token, so a lookup is an exact token-sequence match, not a text match.
const TOKEN_SEPARATOR = '';
const VALID_WORD_KEYS = new Set(
  (validWords as string[]).map((word) => tokenizeArmenianWord(word).join(TOKEN_SEPARATOR)),
);

export function guessValidity(tokens: string[]): GuessValidity {
  if (tokens.length < WORD_LENGTH) return 'incomplete';
  return VALID_WORD_KEYS.has(tokens.join(TOKEN_SEPARATOR)) ? 'valid' : 'invalid';
}
