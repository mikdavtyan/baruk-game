import { LetterState } from '../constants/theme';

// Standard two-pass Wordle evaluation:
// Pass 1 marks exact-position matches (correct) and removes them from the
// pool of secret tokens still available to match.
// Pass 2 checks remaining guessed tokens against what's left in that pool,
// so a token is only marked "present" as many times as it actually
// remains in the secret word (handles duplicates correctly).
export function evaluateGuess(guess: string[], secret: string[]): LetterState[] {
  const result: LetterState[] = new Array(guess.length).fill('absent');
  const secretRemaining: (string | null)[] = [...secret];

  guess.forEach((token, i) => {
    if (token === secret[i]) {
      result[i] = 'correct';
      secretRemaining[i] = null;
    }
  });

  guess.forEach((token, i) => {
    if (result[i] === 'correct') return;
    const matchIndex = secretRemaining.indexOf(token);
    if (matchIndex !== -1) {
      result[i] = 'present';
      secretRemaining[matchIndex] = null;
    }
  });

  return result;
}
