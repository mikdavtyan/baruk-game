// Data invariants for the two word lists. A violation here means a guess or
// daily word that can't be typed, can't be accepted, or has the wrong length.
import { ALL_LETTER_TOKENS } from '../components/Keyboard';
import { normalizeArmenianWord, tokenizeArmenianWord } from '../lib/tokenizeArmenian';
import { WORD_LENGTH } from './theme';
import playableWords from './playableWords.json';
import validWords from './validWords.json';

const lists = { validWords: validWords as string[], playableWords: playableWords as string[] };
const keyboard = new Set(ALL_LETTER_TOKENS);

describe.each(Object.entries(lists))('%s', (_name, words) => {
  it('stores every word already normalized (trimmed, NFC, lowercase)', () => {
    expect(words.filter((w) => w !== normalizeArmenianWord(w))).toEqual([]);
  });

  it('has only words of exactly WORD_LENGTH tokens ("ու" counts as one)', () => {
    expect(words.filter((w) => tokenizeArmenianWord(w).length !== WORD_LENGTH)).toEqual([]);
  });

  it('has only words typeable on the keyboard', () => {
    expect(words.filter((w) => tokenizeArmenianWord(w).some((t) => !keyboard.has(t)))).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(words.length).toBe(new Set(words).size);
  });
});

it('every playable (secret) word is also an accepted guess', () => {
  const valid = new Set(lists.validWords);
  expect(lists.playableWords.filter((w) => !valid.has(w))).toEqual([]);
});
