// Canonical Armenian tokenizer: turns a plain word into the game's logical
// tokens — the same shape guesses already have (see App.tsx's `guess.tokens`).
// "ու" (ո + ւ, two codepoints) becomes one token; everything else is one
// token per letter. "և" is not part of this game's alphabet.
//
// This is for words, not for keyboard input — guesses are already built
// token-by-token by the Keyboard component. It's the seam a real dictionary
// or daily word will go through later, so every word gets tokenized the
// same way instead of being hand-split into an array by hand.

const OU_FIRST = 'ո';
const OU_SECOND = 'ւ';
const OU_TOKEN = 'ու';

// Trim + Unicode-normalize (NFC) + lowercase, so word-list data doesn't need
// to be typed in one exact form to tokenize consistently.
export function normalizeArmenianWord(word: string): string {
  return word.trim().normalize('NFC').toLowerCase();
}

export function tokenizeArmenianWord(word: string): string[] {
  const letters = Array.from(normalizeArmenianWord(word));
  const tokens: string[] = [];

  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === OU_FIRST && letters[i + 1] === OU_SECOND) {
      tokens.push(OU_TOKEN);
      i += 1; // consumed both letters of the pair
      continue;
    }
    tokens.push(letters[i]);
  }

  return tokens;
}
