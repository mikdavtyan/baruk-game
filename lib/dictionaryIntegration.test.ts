// Integration coverage for the App.tsx submit flow:
//   if (guessValidity(enteredTokens) !== 'valid') return;
//   const states = evaluateGuess(guess.tokens, secretWord);
// This exercises the real lib/wordBag + lib/guessValidity + lib/evaluateGuess
// modules together (no mocks), the same way App.tsx wires them, rather than
// re-testing each module's own already-covered internals.
import { createBag, currentWordTokens, PLAYABLE_WORDS } from './wordBag';
import { guessValidity } from './guessValidity';
import { evaluateGuess } from './evaluateGuess';
import { tokenizeArmenianWord } from './tokenizeArmenian';
import playableWords from '../constants/playableWords.json';

const SECRET_WORD = currentWordTokens(createBag(PLAYABLE_WORDS));

describe('dictionary integration (wordBag + guessValidity + evaluateGuess)', () => {
  it('a secret word from the bag is always accepted as a valid guess', () => {
    expect(guessValidity(SECRET_WORD)).toBe('valid');
  });

  it('guessing SECRET_WORD exactly evaluates every token as correct (the win condition)', () => {
    expect(evaluateGuess(SECRET_WORD, SECRET_WORD)).toEqual(
      SECRET_WORD.map(() => 'correct'),
    );
  });

  it('rejects a non-dictionary 5-token guess before it would reach evaluateGuess', () => {
    const bogus = ['ֆ', 'ֆ', 'ֆ', 'ֆ', 'ֆ'];
    expect(guessValidity(bogus)).toBe('invalid');
  });

  it('keeps "ու" as one logical token through validity + evaluation for a real word', () => {
    const ouWord = (playableWords as string[]).find((w) => tokenizeArmenianWord(w).includes('ու'));
    expect(ouWord).toBeDefined();
    const tokens = tokenizeArmenianWord(ouWord as string);

    expect(guessValidity(tokens)).toBe('valid');
    expect(evaluateGuess(tokens, tokens)).toEqual(tokens.map(() => 'correct'));
  });

  it('rejects the same word mis-split into raw characters (ո + ւ instead of the "ու" token)', () => {
    const ouWord = (playableWords as string[]).find((w) => tokenizeArmenianWord(w).includes('ու'));
    const misSplitChars = Array.from((ouWord as string).normalize('NFC'));
    expect(misSplitChars.length).toBeGreaterThan(tokenizeArmenianWord(ouWord as string).length);
    expect(guessValidity(misSplitChars)).toBe('invalid');
  });
});
