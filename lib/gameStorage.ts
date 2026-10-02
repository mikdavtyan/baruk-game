import AsyncStorage from '@react-native-async-storage/async-storage';
import { LetterState } from '../constants/theme';
import { tokenizeArmenianWord } from './tokenizeArmenian';

// All the win-flow's own persisted state (coins, streak, the "pending win"
// resume record, and the once-per-word share bonus claim). Kept in one
// small module — not scattered AsyncStorage calls — so every read/write of
// each key goes through one place. None of this touches the actual game
// board's own state (submitted guesses, keyboard, etc.), which this app
// still doesn't persist across a real app kill — see WinFlow.tsx for what
// that means for "resume after close."
const KEYS = {
  coins: 'wordle:coins',
  points: 'wordle:points',
  streak: 'wordle:streak',
  pendingWin: 'wordle:pendingWin',
  pendingLoss: 'wordle:pendingLoss',
  shareClaims: 'wordle:shareClaims',
  wordBag: 'wordle:wordBag',
  round: 'wordle:round',
  rulesSeen: 'wordle:rulesSeen',
} as const;

export type Streak = { current: number; best: number };

// The shuffled secret-word bag (see lib/wordBag.ts): `order` is a shuffle of
// the playable words, `pos` the index of the current secret word in it.
export type WordBag = { order: string[]; pos: number };

export type PendingWin = {
  wordKey: string; // secret word tokens joined — also the share-claim key
  secretWordTokens: string[]; // frozen at win time, so a resume never needs the live board
  guessCount: number; // 1-6, how many guesses it took
  step: 'reward' | 'result';
  emojiGrid: string; // precomputed share text's emoji grid, frozen at win time
};

export type PendingLoss = {
  wordKey: string; // secret word tokens joined — also the share-claim key
  secretWordTokens: string[]; // frozen at loss time, so a resume never needs the live board
  finalGuesses: { tokens: string[]; states: LetterState[] }[]; // the full 6-row board that just lost — word reveal + share + peek
  step: 'secondChance' | 'lossResult';
  retriesUsed: number; // 0, 1 or 2 — see LOSS_RETRY_CONFIG below
  pointsAtRisk: number; // points value at the moment of loss, so a resume shows the same roll-down
  streakAtRisk: number;
  bestStreak: number;
  emojiGrid: string; // precomputed share text's emoji grid, frozen at loss time
};

export type ScoredGuess = { tokens: string[]; states: LetterState[] };

// The saved round (see CONTEXT.md and docs/adr/0001-rounds-survive-relaunch.md):
// everything needed to put the current round back exactly where it was after
// a relaunch. Only used while `wordKey` is still the current secret word.
export type SavedRound = {
  wordKey: string;
  submittedGuesses: ScoredGuess[];
  typing: { tokens: string[]; activeIndex: number }; // the guess being typed, '' = empty slot
  retainedGuesses: ScoredGuess[];
  hintGhosts: { index: number; letter: string }[];
  paidDarts: string[]; // every Darts target paid for, landed or not
  retriesUsed: number;
};

// Stored compactly — each guess as "<its tokens joined>|<one letter per
// state>" — so even twelve guesses stay well under the 1024 units iOS writes
// atomically (see saveAtomically). Joining is lossless: keyboard tokens
// re-tokenize to themselves.
const STATE_CODE: Partial<Record<LetterState, string>> = { correct: 'c', present: 'p', absent: 'a' };
const CODE_STATE: Record<string, LetterState> = { c: 'correct', p: 'present', a: 'absent' };
const encodeGuess = ({ tokens, states }: ScoredGuess) =>
  `${tokens.join('')}|${states.map((s) => STATE_CODE[s] ?? 'a').join('')}`;
function decodeGuess(encoded: string): ScoredGuess {
  const [word, codes] = encoded.split('|');
  return { tokens: tokenizeArmenianWord(word), states: Array.from(codes, (c) => CODE_STATE[c] ?? 'absent') };
}
type StoredRound = Omit<SavedRound, 'submittedGuesses' | 'retainedGuesses'> & {
  submittedGuesses: string[];
  retainedGuesses: string[];
};
const encodeRound = (round: SavedRound | null): StoredRound | null =>
  round && {
    ...round,
    submittedGuesses: round.submittedGuesses.map(encodeGuess),
    retainedGuesses: round.retainedGuesses.map(encodeGuess),
  };

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — losing a persistence write shouldn't crash the flow.
  }
}

// Everything that must change together — a reward, a retry purchase, a final
// loss, a new game — is saved here in ONE multiSet, which AsyncStorage applies
// atomically (one SQLite transaction on Android; one manifest write on iOS,
// for values of up to 1024 UTF-16 units — longer ones go to their own file
// first, so keep these records small). A kill mid-save leaves all of it or
// none. See docs/adr/0003-economy-writes-are-atomic.md.
type AtomicChanges = {
  coins?: number;
  points?: number;
  streak?: Streak;
  wordBag?: WordBag;
  pendingWin?: PendingWin | null;
  pendingLoss?: PendingLoss | null;
  round?: SavedRound | null;
};
export async function saveAtomically(changes: AtomicChanges): Promise<void> {
  const entries = (Object.keys(changes) as (keyof AtomicChanges)[]).map((key): [string, string] => [
    KEYS[key],
    JSON.stringify(key === 'round' ? encodeRound(changes.round ?? null) : changes[key]),
  ]);
  try {
    await AsyncStorage.multiSet(entries);
  } catch {
    // Best-effort, like setJSON.
  }
}

export const getCoins = () => getJSON<number>(KEYS.coins, 0);
export const setCoins = (coins: number) => setJSON(KEYS.coins, coins);

// ՄԻԱՎՈՐՆԵՐ — the running points total, credited on each win (see
// constants/winFlow.ts's WIN_FLOW_CONFIG.pointsByGuessCount).
export const getPoints = () => getJSON<number>(KEYS.points, 0);
export const setPoints = (points: number) => setJSON(KEYS.points, points);

export const getStreak = () => getJSON<Streak>(KEYS.streak, { current: 0, best: 0 });
export const setStreak = (streak: Streak) => setJSON(KEYS.streak, streak);

export const getWordBag = () => getJSON<WordBag | null>(KEYS.wordBag, null);
export const setWordBag = (bag: WordBag) => setJSON(KEYS.wordBag, bag);

export const setRound = (round: SavedRound | null) => setJSON(KEYS.round, encodeRound(round));
export async function getRound(): Promise<SavedRound | null> {
  const stored = await getJSON<StoredRound | null>(KEYS.round, null);
  try {
    if (!stored || typeof stored.wordKey !== 'string') return null;
    return {
      ...stored,
      submittedGuesses: stored.submittedGuesses.map(decodeGuess),
      retainedGuesses: stored.retainedGuesses.map(decodeGuess),
    };
  } catch {
    return null; // a malformed record is ignored, like any unreadable key
  }
}

// Whether the "How to play" popup has already opened by itself. Set the
// moment it first does, so it never opens automatically again (the header's
// rules button still opens it any time).
export const getRulesSeen = () => getJSON<boolean>(KEYS.rulesSeen, false);
export const setRulesSeen = () => setJSON(KEYS.rulesSeen, true);

export const getPendingWin = () => getJSON<PendingWin | null>(KEYS.pendingWin, null);
export const setPendingWin = (pending: PendingWin | null) => setJSON(KEYS.pendingWin, pending);

export const getPendingLoss = () => getJSON<PendingLoss | null>(KEYS.pendingLoss, null);
export const setPendingLoss = (pending: PendingLoss | null) => setJSON(KEYS.pendingLoss, pending);

// The +200 share bonus is once per word, ever — a simple set of claimed
// word-keys, persisted so re-sharing (or reopening mid-share) can't farm it.
async function getShareClaims(): Promise<string[]> {
  return getJSON<string[]>(KEYS.shareClaims, []);
}
export async function hasClaimedShareBonus(wordKey: string): Promise<boolean> {
  const claims = await getShareClaims();
  return claims.includes(wordKey);
}
export async function claimShareBonus(wordKey: string): Promise<void> {
  const claims = await getShareClaims();
  if (!claims.includes(wordKey)) await setJSON(KEYS.shareClaims, [...claims, wordKey]);
}
