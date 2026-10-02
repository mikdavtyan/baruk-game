import { Platform } from 'react-native';
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

// The share bonus is iOS-only: Android's share API reports `sharedAction`
// even when the sheet is dismissed, so a real share can't be confirmed there.
// See docs/adr/0002-share-bonus-ios-only.md.
export function shareBonusAvailable(): boolean {
  return Platform.OS === 'ios';
}

// `result` is the guess count (1-6) for a win, or the literal 'X' for a loss
// — same convention real Wordle uses for its own share text.
export function buildShareText(result: number | 'X', emojiGrid: string): string {
  return `Baruk ${result}/6\n${emojiGrid}\n${GAME_SHARE_URL}`;
}
