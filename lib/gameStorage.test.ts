// Every record saveAtomically writes must stay small enough for iOS to write
// it atomically: AsyncStorage keeps values of up to 1024 UTF-16 units in its
// one atomically-written manifest, and writes longer ones to their own file
// first (docs/adr/0003-economy-writes-are-atomic.md). Checked against the
// worst case each record can reach in play. The word bag is left out — the
// gap ADR 0003 accepts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_LETTER_TOKENS } from '../components/Keyboard';
import { LetterState, MAX_GUESSES, WORD_LENGTH } from '../constants/theme';
import { WIN_FLOW_CONFIG } from '../constants/winFlow';
import { PendingLoss, PendingWin, SavedRound, saveAtomically, ScoredGuess } from './gameStorage';

const IOS_ATOMIC_LIMIT = 1024; // UTF-16 units

// The longest token is ու (two characters); the longest states are
// 'present'/'correct'; the largest number JSON can hold exactly is
// MAX_SAFE_INTEGER.
const OU_WORD = Array<string>(WORD_LENGTH).fill('ու');
const LONGEST_STATES = Array<LetterState>(WORD_LENGTH).fill('present');
const BIG = Number.MAX_SAFE_INTEGER;
const fullBoard = (): ScoredGuess[] =>
  Array.from({ length: MAX_GUESSES }, () => ({ tokens: [...OU_WORD], states: [...LONGEST_STATES] }));
// Six rows of five two-unit emoji.
const FULL_EMOJI_GRID = Array(MAX_GUESSES).fill('🟨'.repeat(WORD_LENGTH)).join('\n');

const worstPendingLoss: PendingLoss = {
  wordKey: OU_WORD.join(''),
  secretWordTokens: [...OU_WORD],
  finalGuesses: fullBoard(),
  step: 'secondChance',
  retriesUsed: WIN_FLOW_CONFIG.maxLossRetries,
  pointsAtRisk: BIG,
  streakAtRisk: BIG,
  bestStreak: BIG,
  emojiGrid: FULL_EMOJI_GRID,
};

const worstPendingWin: PendingWin = {
  wordKey: OU_WORD.join(''),
  secretWordTokens: [...OU_WORD],
  guessCount: MAX_GUESSES,
  step: 'reward',
  emojiGrid: FULL_EMOJI_GRID,
  afterRetry: true,
};

const worstRound: SavedRound = {
  wordKey: OU_WORD.join(''),
  submittedGuesses: fullBoard(), // 6 submitted…
  typing: { tokens: [...OU_WORD], activeIndex: WORD_LENGTH - 1 },
  retainedGuesses: fullBoard(), // …plus 6 retained from before the retry
  hintGhosts: OU_WORD.map((letter, index) => ({ index, letter })), // every position
  paidDarts: ALL_LETTER_TOKENS.filter((t) => !OU_WORD.includes(t)), // every key not in the word
  retriesUsed: WIN_FLOW_CONFIG.maxLossRetries,
};

beforeAll(async () => {
  await AsyncStorage.clear();
  await saveAtomically({
    coins: BIG,
    points: BIG,
    streak: { current: BIG, best: BIG },
    pendingWin: worstPendingWin,
    pendingLoss: worstPendingLoss,
    round: worstRound,
    inventory: { hint: BIG, darts: BIG },
    adRewards: { day: '2026-10-03', count: BIG },
  });
});

it.each(['coins', 'points', 'streak', 'pendingWin', 'pendingLoss', 'round', 'inventory', 'adRewards'])(
  'the worst-case %s record is small enough for iOS to write atomically',
  async (key) => {
    const stored = await AsyncStorage.getItem(`wordle:${key}`);
    expect(stored).not.toBeNull();
    expect((stored as string).length).toBeLessThan(IOS_ATOMIC_LIMIT);
  },
);
