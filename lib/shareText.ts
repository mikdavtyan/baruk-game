import { LetterState } from '../constants/theme';
import { GAME_SHARE_URL } from '../constants/winFlow';

function emojiFor(state: LetterState): string {
  if (state === 'correct') return '🟩';
  if (state === 'present') return '🟨';
  return '⬜'; // absent
}

// Frozen at win time (see WinFlow.tsx) so the persisted "pending win" record
// is self-contained — resuming after a reload never needs the live board.
export function buildEmojiGrid(guesses: { states: LetterState[] }[]): string {
  return guesses.map((g) => g.states.map(emojiFor).join('')).join('\n');
}

// `result` is the guess count (1-6) for a win, or the literal 'X' for a loss
// — same convention real Wordle uses for its own share text.
export function buildShareText(result: number | 'X', emojiGrid: string): string {
  return `Baruk ${result}/6\n${emojiGrid}\n${GAME_SHARE_URL}`;
}
