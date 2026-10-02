import { LetterState } from '../constants/theme';

export type KeyStates = Record<string, LetterState>;

// Higher number = stronger state. A key only ever moves up this ladder,
// so a later weaker result never downgrades an earlier stronger one.
const STATE_PRIORITY: Record<LetterState, number> = {
  empty: 0,
  filled: 0,
  // 'neutral' is display-only (the loss result's revealed-answer tiles) —
  // evaluateGuess never produces it, so a real guess can never carry it here.
  neutral: 0,
  absent: 1,
  present: 2,
  correct: 3,
};

// Derives keyboard key states from already-evaluated guesses (the output of
// evaluateGuess). Tokens are matched as whole keys, so "ու" maps to the
// single "ու" key.
export function computeKeyStates(guesses: { tokens: string[]; states: LetterState[] }[]): KeyStates {
  const keyStates: KeyStates = {};
  guesses.forEach(({ tokens, states }) => {
    tokens.forEach((token, i) => {
      const next = states[i];
      const prev = keyStates[token];
      if (!prev || STATE_PRIORITY[next] > STATE_PRIORITY[prev]) {
        keyStates[token] = next;
      }
    });
  });
  return keyStates;
}
