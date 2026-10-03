import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Animated,
  Dimensions,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ArrowOverlay, { ArrowTarget } from './components/ArrowOverlay';
import Board from './components/Board';
import BottomControls from './components/BottomControls';
import Header from './components/Header';
import Keyboard, { ALL_LETTER_TOKENS, computeKeyGeometry } from './components/Keyboard';
import LossFlow from './components/LossFlow';
import { GhostHint, RowData } from './components/Row';
import RulesModal from './components/RulesModal';
import { PushPageLayer, usePushPage } from './components/PushPage';
import ShopScreen from './components/ShopScreen';
import Toast from './components/Toast';
import WinFlow from './components/WinFlow';
import {
  ARROW_FLIGHT_DURATION_MS,
  ARROW_QUIVER_MS,
  ARROW_STAGGER_MS,
  ARROW_STUCK_FADE_MS,
  ICON_RELOAD_MS,
  KEY_COLOR_FADE_MS,
  MAX_GUESSES,
  REDUCED_MOTION_ARROW_STAGGER_MS,
  ROW_REVEAL_DURATION_MS,
  ROW_SHAKE_DURATION_MS,
  WORD_LENGTH,
  LetterState,
  FONT_FAMILY,
} from './constants/theme';
import { LOSS_SHAKE_DURATION_MS, WIN_FLOW_CONFIG } from './constants/winFlow';
import { evaluateGuess } from './lib/evaluateGuess';
import { guessValidity } from './lib/guessValidity';
import {
  getCoins,
  getInventory,
  getPendingLoss,
  getPendingWin,
  getPoints,
  getRound,
  getRulesSeen,
  getStreak,
  Inventory,
  PendingLoss,
  PendingWin,
  SavedRound,
  saveAtomically,
  setRound,
  setRulesSeen,
  WordBag,
} from './lib/gameStorage';
import { GamePhase, phaseFromPending } from './lib/gamePhase';
import { computeKeyStates } from './lib/keyboardStates';
import { measureWindow } from './lib/measureWindow';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import { advanceBag, currentWordTokens, loadWordBag, PLAYABLE_WORDS } from './lib/wordBag';

type SubmittedGuess = {
  tokens: string[];
  states: LetterState[];
};


// Tiles take up size + 8px each way (4px margin per side, 8px row gap).
const TILE_SPACING = 8;
const MAX_TILE_SIZE = 62;
const MIN_TILE_SIZE = 30;
const BOARD_H_MARGIN = 16;
const BOARD_V_MARGIN = 8;

// Largest tile that lets the 6x5 board fit the measured board area.
function fitTileSize(width: number, height: number) {
  const byWidth = (width - BOARD_H_MARGIN * 2) / WORD_LENGTH - TILE_SPACING;
  const byHeight = (height - BOARD_V_MARGIN * 2) / MAX_GUESSES - TILE_SPACING;
  return Math.floor(Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, byWidth, byHeight)));
}

// Picks up to `count` tokens at random from `tokens`, without repeats —
// used by the Darts power-up to choose which keys to target.
function pickRandomTokens(tokens: string[], count: number): string[] {
  const pool = [...tokens];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

// The next empty slot after `from`, wrapping around to the start of the row
// if needed — so typing always advances to somewhere useful, skipping over
// slots Hint already filled.
function nextEmptyIndex(tokens: string[], from: number): number {
  for (let i = from + 1; i < tokens.length; i++) {
    if (tokens[i] === '') return i;
  }
  for (let i = 0; i <= from; i++) {
    if (tokens[i] === '') return i;
  }
  return from; // row is full
}

// The in-progress guess: a fixed WORD_LENGTH-slot token array ('' = empty)
// rather than an append-only list, so Hint can fill any slot, not just the
// next one, while typing continues to fill in around it — plus the slot the
// next keypress will land in. Kept as one state value (not two separate
// useState calls) so it always updates atomically; see the `guess` useState
// call in App for why that matters.
type GuessInProgress = {
  tokens: string[];
  activeIndex: number;
};

function initialGuess(): GuessInProgress {
  return { tokens: Array(WORD_LENGTH).fill(''), activeIndex: 0 };
}

type Ghost = { index: number; letter: string };

const HINT_EXHAUSTED_TOAST = 'ԲՈԼՈՐ ՏԱՌԵՐՆ ԱՐԴԵՆ ԲԱՑ ԵՆ';
const DARTS_EXHAUSTED_TOAST = 'ՍԽԱԼ ՏԱՌԵՐ ԱՅԼԵՎՍ ՉԿԱՆ';
const HINT_NO_ROOM_TOAST = 'ՀՈՒՇՄԱՆ ՀԱՄԱՐ ԴԱՏԱՐԿ ՎԱՆԴԱԿ ՉԿԱ';

// Every position any of `guesses` scored correct, as a ghost of that letter.
function correctPositionGhosts(guesses: SubmittedGuess[]): Ghost[] {
  const found = new Map<number, string>();
  guesses.forEach(({ tokens, states }) =>
    states.forEach((s, i) => {
      if (s === 'correct') found.set(i, tokens[i]);
    }),
  );
  return [...found].map(([index, letter]) => ({ index, letter }));
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

function AppInner() {
  const { color, isDark, reduceMotion } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    [FONT_FAMILY]: require('./assets/fonts/GHEAGrapalat-Bold.otf'),
  });
  // The persisted shuffled word bag (lib/wordBag.ts); the current secret
  // word is its current entry. Loaded together with any pending end-of-round
  // record (handed to WinFlow / LossFlow to resume their modal), the saved
  // round and the coins/points/streak — all before the first render, so a
  // restored win or loss flow never decides with balances not loaded yet.
  // The starting phase comes from the pending records, else the saved round.
  const [wordBag, setWordBagState] = useState<WordBag | null>(null);
  const [resumed, setResumed] = useState<{ win: PendingWin | null; loss: PendingLoss | null } | null>(null);
  // The round's explicit state machine — see lib/gamePhase.ts.
  const [phase, setPhase] = useState<GamePhase>('playing');
  const secretWord = useMemo(() => (wordBag ? currentWordTokens(wordBag) : []), [wordBag]);
  // Each guess (submitted or in-progress) is an array of key-tokens rather
  // than raw characters, so a two-character key like "ու" still counts as
  // exactly one of the 5 entries in a guess.
  const [submittedGuesses, setSubmittedGuesses] = useState<SubmittedGuess[]>([]);
  // The persisted coin balance (see lib/gameStorage.ts) — the single source
  // of truth Header displays and the flows read and credit.
  const [coins, setCoinsState] = useState(0);
  // Hint/Darts items held (wordle:inventory), used before coins.
  const [inventory, setInventory] = useState<Inventory>(WIN_FLOW_CONFIG.startingInventory);
  // ՄԻԱՎՈՐՆԵՐ — the running points total (see constants/winFlow.ts's
  // WIN_FLOW_CONFIG.pointsByGuessCount); WinFlow credits it on each win.
  const [points, setPointsState] = useState(0);
  // Streak is lifted here (not owned by WinFlow) since LossFlow also reads
  // and resets the exact same persisted value.
  const [streak, setStreakState] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  // Bumped only by a genuine New Game (never by a same-word loss retry) —
  // LossFlow resets its per-round retry count whenever this changes.
  const [roundId, setRoundId] = useState(0);
  // Measured (not computed) by WinFlow — the winning row's on-screen center
  // (confetti/praise-word origin) and the header's coin pill (coin-flight
  // target), the same "measure at the moment it's needed" approach already
  // used for the bow/arrow power-up.
  const boardAreaMeasureRef = useRef<View>(null);
  const headerCoinRef = useRef<View>(null);
  // tokens + activeIndex (the slot the next keypress will land in, kept in
  // sync by typing/backspace/Hint) are one state value, updated together in
  // a single functional setState call, so two presses that land in the same
  // React batch (e.g. back-to-back taps before a render commits) each still
  // read the truly latest tokens/index instead of a stale snapshot — two
  // separate useState calls updated non-functionally could otherwise have
  // the second press's update overwrite the first's instead of building on
  // it, replacing the last tile instead of filling the next one.
  const [guess, setGuess] = useState<GuessInProgress>(initialGuess);
  // Index of the row that just triggered win/loss, so only that row animates.
  const [resultRowIndex, setResultRowIndex] = useState<number | null>(null);
  // Row index to briefly shake after a submit attempt is rejected for being
  // an unrecognized word — separate from resultRowIndex/shakeRowIndex-on-loss
  // above, since this fires mid-game, not just at game end. Cleared via its
  // own timeout once the shake animation finishes playing.
  const [invalidShakeRowIndex, setInvalidShakeRowIndex] = useState<number | null>(null);
  // The 6th row's own distinct "3 wiggles" loss shake (Part 1) — cleared via
  // its own timeout once that plays out. LossFlow reacts to the phase
  // independently and on its own timing (500ms later), so this needs no
  // coordination beyond both starting from the same event.
  const [lossShakeRowIndex, setLossShakeRowIndex] = useState<number | null>(null);
  // Remounts the board on every reset (retry, next word, new game), so old
  // tiles never animate into new ones.
  const [boardKey, setBoardKey] = useState(0);
  // "The reset board is on screen" callbacks (see resetBoard): run one frame
  // after the reset render has committed, i.e. once it has been painted.
  const boardShownCallbacksRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    const callbacks = boardShownCallbacksRef.current.splice(0);
    if (callbacks.length > 0) requestAnimationFrame(() => callbacks.forEach((cb) => cb()));
  }, [boardKey]);
  // A short message over the board (e.g. "no hint left"); `id` remounts it.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const showToast = (message: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, message }));
  // Blocks a second Hint/Darts purchase while one is being charged.
  const powerUpBusyRef = useRef(false);
  // phase 'revealing': the just-submitted row's tiles are flipping. Input is
  // locked and that row is held back from the keyboard colors until it ends.
  const isRevealing = phase === 'revealing';
  // Measured from the board area, so the board fits any screen size.
  const [tileSize, setTileSize] = useState<number | null>(null);
  // Hint doesn't type a real letter — it shows a low-opacity green "ghost"
  // in a still-empty cell, which a real keystroke there simply types over
  // (and backspace restores). Every press ADDS a ghost, so several can be
  // active at once. A hint ghost shows in every new row until it's used —
  // typed correctly at its position (see handleEnter) — and survives a
  // "try again" retry too. After a retry, `ghosts` below adds a ghost for
  // every position already found green, in every row.
  const [hintGhosts, setHintGhosts] = useState<Ghost[]>([]);
  // "Try again" (retry same word) keeps the keyboard's learned letter
  // colors instead of wiping them like a real New Game does — these are
  // guesses from *before* the retry, kept only so computeKeyStates still
  // knows about them; the board itself doesn't render them as rows anymore.
  const [retainedGuesses, setRetainedGuesses] = useState<SubmittedGuess[]>([]);
  // Tokens Darts has confirmed are not in the secret word at all. This is
  // real Wordle information (like a normal absent key) — it persists for
  // the rest of the game, not just the current guess. Also doubles as "which
  // keys should use the slow arrow-impact fade" (see Keyboard.tsx) — always
  // correct since a token only ever enters this list right as its arrow lands.
  const [dartsRevealedAbsent, setDartsRevealedAbsent] = useState<string[]>([]);
  // Every Darts target paid for this word — saved the moment it's paid, so a
  // relaunch before the arrows land still shows them eliminated.
  // dartsRevealedAbsent above follows the arrows; this follows the payments.
  const [paidDarts, setPaidDarts] = useState<string[]>([]);
  // Retries used on this word, saved with the round so a relaunch mid-retry
  // can't grant another (LossFlow starts its own count from it).
  const [retriesUsed, setRetriesUsed] = useState(0);
  // Increments each time Darts actually fires, so ArrowOverlay/BowIcon know
  // to launch a fresh volley; `origin`/`targets` are real on-screen positions
  // (window space), resolved once at fire time — see handleDarts.
  const [dartsVolley, setDartsVolley] = useState<{ id: number; origin: { x: number; y: number } | null; targets: ArrowTarget[] }>(
    { id: 0, origin: null, targets: [] },
  );
  // True from the moment Darts fires until its last arrow has fully landed,
  // quivered and faded. Blocks firing a second volley mid-flight.
  const [isDartsFiring, setIsDartsFiring] = useState(false);
  // Measured (not computed) at the moment Darts fires — see handleDarts —
  // so arrows really do start from and pass through where the bow button and
  // keyboard actually are on screen, not an assumed layout.
  const dartsButtonRef = useRef<View>(null);
  const keyboardAreaRef = useRef<View>(null);

  // The "How to play" popup (RulesModal): opened by the header's rules
  // button, and by itself on the very first launch only (see the first load).
  // It closes itself on Android's back button.
  const [rulesOpen, setRulesOpen] = useState(false);
  const handleOpenRules = () => setRulesOpen(true);
  const handleCloseRules = useCallback(() => setRulesOpen(false), []);
  // The shop page (ShopScreen), pushed in over the game (PushPage.tsx) —
  // opened by the header's coin pill, or by a power-up tap with no items and
  // too few coins.
  const shopPage = usePushPage();

  const handleBoardAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setTileSize(fitTileSize(width, height));
  };

  const isBoardFull = submittedGuesses.length >= MAX_GUESSES;
  // The real count of entered tokens, ignoring empty slots — Hint can leave
  // holes, so this (not guess.tokens.length, which is always WORD_LENGTH
  // now) is what 5-token validation actually checks.
  const enteredTokens = guess.tokens.filter((t) => t !== '');

  // Writes into the active slot, then advances to the next empty slot.
  // Functional update: tokens and activeIndex are read from `prev`, not the
  // outer closure, so this is correct even if two presses land in the same
  // React batch before a render commits.
  //
  // Guards against a full row: once all WORD_LENGTH slots are filled,
  // nextEmptyIndex has nowhere left to advance to and falls back to
  // returning the same (last) index unchanged — so without this check, any
  // further press would keep writing into that same last slot, silently
  // replacing its letter instead of being ignored. This check must happen
  // *inside* the functional updater (reading prev.tokens), not against the
  // outer `enteredTokens` closure: that closure only reflects the last
  // committed render, so two presses landing in the same batch (e.g. two
  // fast taps right as the row fills) would both see the same pre-fill
  // snapshot — the first press's update fills the row, but the second would
  // still incorrectly pass an outer-scope check and overwrite it. Reading
  // prev.tokens instead means each queued update sees the true result of
  // the one before it, exactly like the write logic below already does.
  const handleKeyPress = (letter: string) => {
    if (phase !== 'playing') return;
    if (isBoardFull) return;
    setGuess((prev) => {
      if (prev.tokens.every((t) => t !== '')) return prev; // row already full
      const tokens = [...prev.tokens];
      tokens[prev.activeIndex] = letter;
      return { tokens, activeIndex: nextEmptyIndex(tokens, prev.activeIndex) };
    });
  };

  // Clears the active slot if it has a letter; if it's already empty, steps
  // back and clears the previous slot instead — so a single press always
  // removes something. Same functional-update pattern as handleKeyPress,
  // for the same reason.
  //
  // The first branch only ever fires once the row is completely full:
  // that's the only time activeIndex is left "stuck" pointing at an
  // already-filled slot (nextEmptyIndex has nowhere left to advance to — see
  // handleKeyPress). Clearing that slot must leave activeIndex pointing at
  // it (not one further back, which is still filled) so the next keypress
  // fills the slot that was just freed instead of overwriting its neighbor
  // — the same "replaces a filled tile instead of using the empty one" bug
  // as handleKeyPress's, just reached via backspace-after-a-full-row.
  const handleBackspace = () => {
    if (phase !== 'playing') return;
    setGuess((prev) => {
      const tokens = [...prev.tokens];
      if (tokens[prev.activeIndex] !== '') {
        tokens[prev.activeIndex] = '';
        return { tokens, activeIndex: prev.activeIndex };
      }
      if (prev.activeIndex > 0) {
        const prevIndex = prev.activeIndex - 1;
        tokens[prevIndex] = '';
        return { tokens, activeIndex: prevIndex };
      }
      return prev;
    });
  };

  // Single source of truth for submitting a guess — called by the bottom
  // ԸՆԴՈՒՆԵԼ button (the only submit action; there is no keyboard Enter key).
  const handleEnter = () => {
    if (phase !== 'playing') return;
    if (isBoardFull) return;
    if (guessValidity(enteredTokens) !== 'valid') return;
    const states = evaluateGuess(guess.tokens, secretWord);
    const nextSubmitted = [...submittedGuesses, { tokens: guess.tokens, states }];
    setSubmittedGuesses(nextSubmitted);
    setGuess(initialGuess());
    // Any ghost hint whose position the player just typed correctly (with
    // or without actually using it) is confirmed for real now, so it's
    // removed. Every other active ghost — one the player ignored or typed
    // the wrong letter over — carries forward unchanged into the next row,
    // rather than disappearing or being replaced by a new random one.
    setHintGhosts((prev) => prev.filter((g) => states[g.index] !== 'correct'));
    setPhase('revealing');

    // Win/loss (and with it the row pulse/shake) is applied once the last
    // tile has finished flipping and the keyboard colors have updated.
    setTimeout(() => {
      const isWin = states.every((s) => s === 'correct');
      if (isWin) {
        // A win's whole presentation (celebration -> reward -> result) is
        // WinFlow's job; it watches the phase itself.
        setPhase('won');
        setResultRowIndex(nextSubmitted.length - 1);
      } else if (nextSubmitted.length >= MAX_GUESSES) {
        // Likewise, a loss's whole presentation (shake -> second chance or
        // straight to the result) is LossFlow's job — it also watches the
        // phase, independently, on its own 500ms delay.
        setPhase('lost-awaiting-decision');
        setResultRowIndex(nextSubmitted.length - 1);
        setLossShakeRowIndex(nextSubmitted.length - 1);
        if (!reduceMotion) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
        setTimeout(() => setLossShakeRowIndex(null), LOSS_SHAKE_DURATION_MS);
      } else {
        setPhase('playing');
      }
    }, ROW_REVEAL_DURATION_MS);
  };

  // Tapping the submit button while it reads "ԲԱՌ ՉԷ" (invalid word) clears
  // the guess so the player can immediately retype, instead of being stuck
  // looking at a red button they can't otherwise act on. Reuses the same
  // per-tile exit animation as backspace — this just clears every slot at
  // once, no separate animation code needed.
  const handleClearInvalidGuess = () => {
    if (phase !== 'playing') return;
    setInvalidShakeRowIndex(submittedGuesses.length);
    setTimeout(() => setInvalidShakeRowIndex(null), ROW_SHAKE_DURATION_MS);
    setGuess(initialGuess());
  };

  // The first load (see the wordBag/resumed state above). Placed after every
  // state it restores.
  useEffect(() => {
    Promise.all([
      loadWordBag(),
      getPendingWin(),
      getPendingLoss(),
      getRound(),
      getCoins(),
      getPoints(),
      getStreak(),
      getRulesSeen(),
      getInventory(),
    ]).then(
      ([bag, win, loss, round, savedCoins, savedPoints, savedStreak, rulesSeen, savedInventory]) => {
        setInventory(savedInventory);
        // The rules popup opens by itself on the very first launch only; the
        // flag is saved as it opens, so closing the app with it still open
        // doesn't bring it back.
        if (!rulesSeen) {
          setRulesOpen(true);
          setRulesSeen();
        }
        setCoinsState(savedCoins);
        setPointsState(savedPoints);
        setStreakState(savedStreak.current);
        setBestStreak(savedStreak.best);
        // A saved round for another word (e.g. the word list changed) is ignored.
        const restored = round && round.wordKey === currentWordTokens(bag).join('') ? round : null;
        if (restored) {
          setSubmittedGuesses(restored.submittedGuesses);
          setGuess(restored.typing);
          setRetainedGuesses(restored.retainedGuesses);
          setHintGhosts(restored.hintGhosts);
          setPaidDarts(restored.paidDarts);
          setDartsRevealedAbsent(restored.paidDarts);
          setRetriesUsed(restored.retriesUsed);
        }
        const startPhase = phaseFromPending(win, loss, restored?.submittedGuesses);
        // A result restored from the round alone replays its flow from the start.
        if (!win && !loss && startPhase !== 'playing' && restored) {
          setResultRowIndex(restored.submittedGuesses.length - 1);
        }
        setWordBagState(bag);
        setResumed({ win, loss });
        setPhase(startPhase);
      },
    );
  }, []);

  // The saved round, kept current: saved whenever any part of it changes, so a
  // relaunch puts the round back exactly where it was (see
  // docs/adr/0001-rounds-survive-relaunch.md). Changes that also move coins
  // save it with them in one atomic write instead (Hint, Darts, the retry
  // grant, a new game). Nothing is saved before the first load completes.
  const isLoaded = wordBag !== null && resumed !== null;
  const currentRound = useMemo<SavedRound>(
    () => ({
      wordKey: secretWord.join(''),
      submittedGuesses,
      typing: guess,
      retainedGuesses,
      hintGhosts,
      paidDarts,
      retriesUsed,
    }),
    [secretWord, submittedGuesses, guess, retainedGuesses, hintGhosts, paidDarts, retriesUsed],
  );
  useEffect(() => {
    if (isLoaded) setRound(currentRound);
  }, [isLoaded, currentRound]);

  // The board reset shared by the loss retry, ՀԱՋՈՐԴ ԲԱՌԸ and ՆՈՐ ԽԱՂ. It
  // runs while the round's modal still fully covers the board: `commit`
  // applies the whole reset (board and keyboard) in one render and the board
  // remounts under a new key, so no old tile ever morphs into a new one.
  // `onBoardShown` fires once that fresh board has been painted — only then
  // does the flow fade its modal and backdrop out, together. Old tiles are
  // therefore never visible, not even for one frame.
  const resetBoard = (commit: () => void, onBoardShown: () => void) => {
    boardShownCallbacksRef.current.push(onBoardShown);
    commit();
    setBoardKey((k) => k + 1);
  };

  // A genuine new round (ՀԱՋՈՐԴ ԲԱՌԸ / ՆՈՐ ԽԱՂ): the next word from the bag
  // and a fresh board, keyboard and Hint/Darts state, all in one render.
  const handleNewGame = (onBoardShown: () => void) => {
    const nextBag = wordBag ? advanceBag(wordBag, PLAYABLE_WORDS) : null;
    // The next word, and the old round and its end-of-round records gone —
    // one atomic write, so a kill can't bring the old result back on top of
    // anything already credited for it.
    saveAtomically({ ...(nextBag ? { wordBag: nextBag } : {}), round: null, pendingWin: null, pendingLoss: null });
    resetBoard(
      () => {
        if (nextBag) setWordBagState(nextBag);
        setSubmittedGuesses([]);
        setGuess(initialGuess());
        setPhase('playing');
        setResultRowIndex(null);
        setLossShakeRowIndex(null);
        setHintGhosts([]);
        setRetainedGuesses([]);
        setDartsRevealedAbsent([]);
        setPaidDarts([]);
        setRetriesUsed(0);
        setIsDartsFiring(false);
        setToast(null);
        setRoundId((n) => n + 1); // a genuine new round — LossFlow resets its retry count
      },
      onBoardShown,
    );
  };

  // A retry was just paid for (coins) or earned (ad): saved before any
  // animation, in one atomic write — the pending loss gone, the saved round
  // already the retried round (handleLossRetry below then shows exactly
  // this), and for coins the new balance. Round state isn't touched until
  // then, so the round autosave can't overwrite it with the lost board.
  const handleRetryGranted = (lostGuesses: SubmittedGuess[], coinsAfter?: number) =>
    saveAtomically({
      pendingLoss: null,
      round: {
        ...currentRound,
        submittedGuesses: [],
        typing: initialGuess(),
        retainedGuesses: [...retainedGuesses, ...lostGuesses],
        retriesUsed: retriesUsed + 1,
      },
      ...(coinsAfter === undefined ? {} : { coins: coinsAfter }),
    });

  // The loss flow's same-word retry (ad or coin, see LossFlow.tsx): board
  // clears, but — unlike a real New Game — the player doesn't lose what
  // they'd already found. The lost guesses are retained, so every position
  // they confirmed correct shows as a ghost in every row (see `ghosts`), the
  // keyboard keeps its learned colors, unused hint ghosts carry forward, and
  // bow-eliminated letters stay eliminated.
  //
  // `lostGuesses` comes from LossFlow (its frozen board), not from
  // `submittedGuesses`: after a relaunch-resume the live board is empty.
  // The keyboard keeps its colors.
  const handleLossRetry = (lostGuesses: SubmittedGuess[], onBoardShown: () => void) => {
    resetBoard(
      () => {
        setRetainedGuesses((prev) => [...prev, ...lostGuesses]);
        setRetriesUsed((n) => n + 1);
        setSubmittedGuesses([]);
        setGuess(initialGuess());
        setPhase('playing');
        setResultRowIndex(null);
        setLossShakeRowIndex(null);
        // dartsRevealedAbsent / isDartsFiring intentionally left untouched.
      },
      onBoardShown,
    );
  };

  // Keyboard colors come from submitted guesses (plus anything retained
  // across a "try again" retry, and anything Darts has confirmed is
  // absent) — fed in as extra pseudo-guesses so they all go through the
  // exact same "never downgrade" priority merge as real guesses, rather
  // than a separate parallel system. They reset automatically when a real
  // New Game clears all of them. The row still flipping is left out until
  // its whole reveal completes, then all of its keys update together.
  const keyStates = computeKeyStates([
    ...retainedGuesses,
    ...(isRevealing ? submittedGuesses.slice(0, -1) : submittedGuesses),
    ...(dartsRevealedAbsent.length > 0
      ? [{ tokens: dartsRevealedAbsent, states: dartsRevealedAbsent.map(() => 'absent' as const) }]
      : []),
  ]);

  // Shared "can the player interact right now" gate for all three bottom
  // controls (ԸՆԴՈՒՆԵԼ, Hint, Darts) — none of them act during a reveal or
  // once the game is over.
  const isGameLocked = phase !== 'playing' || isBoardFull;
  // Ghosts on the active row: after a retry (retained guesses exist), every
  // position found green in any guess of this word, plus unused hint ghosts.
  const greenPositions = correctPositionGhosts([...retainedGuesses, ...submittedGuesses]);
  const carriedGhosts = retainedGuesses.length > 0 ? greenPositions : [];
  // Each ghost knows its kind, so Tile can tell "I found this" (carried) from
  // "a Hint showed this"; where both land on one position, carried wins.
  const ghosts: GhostHint[] = [
    ...carriedGhosts.map((g) => ({ ...g, kind: 'carried' as const })),
    ...hintGhosts.filter((h) => !carriedGhosts.some((c) => c.index === h.index)).map((h) => ({ ...h, kind: 'hint' as const })),
  ];
  // Hint only ever reveals a position that's still unknown: not green in any
  // guess of this word (the board before a retry included), not already a
  // ghost — and only in an empty cell, the only place a ghost is visible.
  const knownPositions = new Set([...greenPositions, ...ghosts].map((g) => g.index));
  const unknownPositions = Array.from({ length: WORD_LENGTH }, (_, i) => i).filter((i) => !knownPositions.has(i));
  const hintTargets = unknownPositions.filter((i) => guess.tokens[i] === '');
  const hintExhausted = unknownPositions.length === 0;
  // Unknown positions remain, but every one of them has a typed letter.
  const hintNoRoom = !hintExhausted && hintTargets.length === 0;
  // Darts targets random keyboard keys that aren't in the secret word at
  // all (any key, not just ones already typed), and aren't already gray.
  const dartsCandidates = ALL_LETTER_TOKENS.filter(
    (token) => !secretWord.includes(token) && keyStates[token] !== 'absent',
  );
  const dartsExhausted = dartsCandidates.length === 0;
  // A power-up is pressable whenever the game is live. A use costs one item
  // from the inventory while any are left, else its coin price; with neither,
  // a tap opens the shop. Exhausted (nothing left to reveal) or unaffordable
  // buttons are dimmed, and a tap on an exhausted one just explains why, free.
  const { hintPrice, dartsPrice } = WIN_FLOW_CONFIG;
  const canPayHint = inventory.hint > 0 || coins >= hintPrice;
  const canPayDarts = inventory.darts > 0 || coins >= dartsPrice;
  const hintDisabled = isGameLocked;
  const dartsDisabled = isGameLocked || isDartsFiring;

  // Pays for a power-up use — one item if any are held, else its coin price —
  // and saves what it bought (into the saved round) in the same atomic write:
  // a kill can never take the item or coins without keeping the purchase, or
  // keep the purchase without paying. Saved first; the UI state follows.
  const payFor = async (item: keyof Inventory, price: number, purchase: Partial<SavedRound>) => {
    const round = { ...currentRound, ...purchase };
    if (inventory[item] > 0) {
      const next = { ...inventory, [item]: inventory[item] - 1 };
      await saveAtomically({ inventory: next, round });
      setInventory(next);
    } else {
      const next = coins - price;
      await saveAtomically({ coins: next, round });
      setCoinsState(next);
    }
  };

  // Adds a low-opacity green "ghost" of the secret word's real letter at a
  // random still-unknown position — purely visual, doesn't touch
  // `guess.tokens`, so the player can type straight over it. Adds to the
  // existing ghosts rather than replacing them. Charged only when a letter
  // is actually revealed.
  const handleHint = async () => {
    if (hintDisabled || powerUpBusyRef.current) return;
    if (hintExhausted) {
      showToast(HINT_EXHAUSTED_TOAST);
      return;
    }
    if (hintNoRoom) {
      showToast(HINT_NO_ROOM_TOAST);
      return;
    }
    if (!canPayHint) {
      shopPage.open();
      return;
    }
    powerUpBusyRef.current = true;
    const index = hintTargets[Math.floor(Math.random() * hintTargets.length)];
    const nextGhosts = [...hintGhosts, { index, letter: secretWord[index] }];
    await payFor('hint', hintPrice, { hintGhosts: nextGhosts });
    setHintGhosts(nextGhosts);
    powerUpBusyRef.current = false;
  };

  // No flight — each target just fades to eliminated/absent directly,
  // staggered — used for prefers-reduced-motion and as a safety fallback if
  // the bow button/keyboard couldn't be measured (e.g. not laid out yet).
  // Which letters get eliminated is already decided by the time this runs;
  // this only ever changes how that's shown.
  const fireWithoutFlight = (targets: string[]) => {
    targets.forEach((token, i) => {
      setTimeout(() => {
        setDartsRevealedAbsent((prev) => (prev.includes(token) ? prev : [...prev, token]));
      }, i * REDUCED_MOTION_ARROW_STAGGER_MS);
    });
    const total = (targets.length - 1) * REDUCED_MOTION_ARROW_STAGGER_MS + KEY_COLOR_FADE_MS;
    setTimeout(() => setIsDartsFiring(false), total);
  };

  // Launches up to 3 arrows at random keyboard keys that aren't in the
  // secret word. Each target's key is only actually marked absent (via the
  // real keyboard state system above) once its own arrow's flight finishes,
  // timed to match ArrowOverlay's animation — the gray never appears before
  // impact.
  const handleDarts = async () => {
    if (dartsDisabled || powerUpBusyRef.current) return;
    if (dartsExhausted) {
      showToast(DARTS_EXHAUSTED_TOAST);
      return;
    }
    if (!canPayDarts) {
      shopPage.open();
      return;
    }
    // Up to 3 letters that aren't gray yet (fewer if fewer are left) —
    // decided now; only how it's shown (measured real positions + a flight,
    // vs. an instant reduced-motion fade) differs below.
    const targets = pickRandomTokens(dartsCandidates, 3);
    setIsDartsFiring(true);
    powerUpBusyRef.current = true;
    // Every target is saved as paid now, before any arrow lands.
    const nextPaidDarts = [...new Set([...paidDarts, ...targets])];
    await payFor('darts', dartsPrice, { paidDarts: nextPaidDarts });
    setPaidDarts(nextPaidDarts);
    powerUpBusyRef.current = false;

    if (reduceMotion) {
      fireWithoutFlight(targets);
      return;
    }

    // Measured at the exact moment of firing (RN's equivalent of
    // getBoundingClientRect), not computed — so arrows really start from and
    // aim at where the bow button and keyboard actually are on screen.
    const [buttonRect, keyboardRect] = await Promise.all([
      measureWindow(dartsButtonRef),
      measureWindow(keyboardAreaRef),
    ]);
    if (!buttonRect || !keyboardRect) {
      fireWithoutFlight(targets);
      return;
    }

    const origin = { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 };
    const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
    const resolvedTargets: ArrowTarget[] = targets.flatMap((token) => {
      const g = computeKeyGeometry(token, windowWidth, windowHeight);
      return g ? [{ token, x: keyboardRect.x + g.x, y: keyboardRect.y + g.y }] : [];
    });
    if (resolvedTargets.length === 0) {
      fireWithoutFlight(targets);
      return;
    }

    setDartsVolley((v) => ({ id: v.id + 1, origin, targets: resolvedTargets }));
    resolvedTargets.forEach((t, i) => {
      const impactDelay = i * ARROW_STAGGER_MS + ARROW_FLIGHT_DURATION_MS;
      setTimeout(() => {
        setDartsRevealedAbsent((prev) => (prev.includes(t.token) ? prev : [...prev, t.token]));
      }, impactDelay);
    });
    // Unlocked once the last arrow has landed, quivered and faded, and the
    // bow's reload flourish has finished — matching BowIcon/ArrowOverlay.
    const total =
      (resolvedTargets.length - 1) * ARROW_STAGGER_MS +
      ARROW_FLIGHT_DURATION_MS +
      ARROW_QUIVER_MS +
      ARROW_STUCK_FADE_MS +
      ICON_RELOAD_MS;
    setTimeout(() => setIsDartsFiring(false), total);
  };

  // Build the 6 board rows from real state: submitted guesses (with their
  // permanently computed correct/present/absent states), the in-progress
  // row, and remaining blank rows.
  const rows: RowData[] = Array.from({ length: MAX_GUESSES }, (_, rowIndex) => {
    if (rowIndex < submittedGuesses.length) {
      const { tokens, states } = submittedGuesses[rowIndex];
      return { letters: tokens, states };
    }
    if (rowIndex === submittedGuesses.length) {
      const letters = Array.from({ length: WORD_LENGTH }, (_, i) => guess.tokens[i] ?? '');
      const states = letters.map((l) => (l ? ('filled' as const) : ('empty' as const)));
      return { letters, states };
    }
    return {
      letters: Array(WORD_LENGTH).fill(''),
      states: Array(WORD_LENGTH).fill('empty' as const),
    };
  });

  // Hint only ever applies to the row currently being typed, and only while
  // the player can actually act.
  const activeRowIndex = phase === 'playing' ? submittedGuesses.length : null;

  // Wait for the fonts so text never flashes in the system font (if loading
  // fails, render anyway with system fonts), and for the word bag.
  if ((!fontsLoaded && !fontError) || !wordBag || !resumed) return null;

  return (
    <SafeAreaProvider>
      {/* The game screen itself — never unmounted. It slides a little left
          under a pushed page (the shop), and is inert and hidden from screen
          readers while that page or the rules popup covers it. */}
      <Animated.View
        style={[styles.container, { transform: [{ translateX: shopPage.gameTranslateX }] }]}
        pointerEvents={shopPage.onTop ? 'none' : 'auto'}
        importantForAccessibility={rulesOpen || shopPage.onTop ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={rulesOpen || shopPage.onTop}
      >
      <AnimatedSafeAreaView
        style={[styles.container, { backgroundColor: color('background') }]}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <Header ref={headerCoinRef} score={points} coins={coins} onOpenRules={handleOpenRules} onOpenShop={shopPage.open} />
        <View style={styles.boardArea} onLayout={handleBoardAreaLayout} ref={boardAreaMeasureRef}>
          {tileSize !== null && (
            <Board
              key={boardKey}
              rows={rows}
              celebrateRowIndex={phase === 'won' ? resultRowIndex : null}
              shakeRowIndex={invalidShakeRowIndex}
              lossShakeRowIndex={lossShakeRowIndex}
              tileSize={tileSize}
              activeRowIndex={activeRowIndex}
              activeCellIndex={guess.activeIndex}
              ghostHints={ghosts}
            />
          )}
          {toast && <Toast key={toast.id} message={toast.message} onHidden={() => setToast(null)} />}
        </View>
        <View style={styles.keyboardArea} ref={keyboardAreaRef}>
          <Keyboard
            keyStates={keyStates}
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            dartsHitTokens={reduceMotion ? [] : dartsRevealedAbsent}
          />
        </View>
        <View style={styles.bottomArea}>
          <BottomControls
            validity={guessValidity(enteredTokens)}
            onSubmit={handleEnter}
            onClearInvalid={handleClearInvalidGuess}
            hintDisabled={hintDisabled}
            hintCount={inventory.hint}
            dartsCount={inventory.darts}
            hintDimmed={hintDisabled || hintExhausted || hintNoRoom || !canPayHint}
            onHint={handleHint}
            dartsDisabled={dartsDisabled}
            dartsDimmed={dartsDisabled || dartsExhausted || !canPayDarts}
            onDarts={handleDarts}
            dartsVolleyId={dartsVolley.id}
            dartsShotCount={dartsVolley.targets.length}
            dartsButtonRef={dartsButtonRef}
          />
        </View>
        {/* Follows the in-app theme: 'auto' would follow the system scheme,
            which app.json pins to light. */}
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </AnimatedSafeAreaView>
      </Animated.View>
      <WinFlow
        active={phase === 'won'}
        resume={resumed?.win ?? null}
        secretWordTokens={secretWord}
        submittedGuesses={submittedGuesses}
        boardAreaRef={boardAreaMeasureRef}
        headerCoinRef={headerCoinRef}
        coins={coins}
        onCoinsChange={setCoinsState}
        onNextWord={handleNewGame}
        afterRetry={retriesUsed > 0}
        points={points}
        onPointsChange={setPointsState}
        streak={streak}
        bestStreak={bestStreak}
        onStreakChange={(s) => {
          setStreakState(s.current);
          setBestStreak(s.best);
        }}
      />
      <LossFlow
        active={phase === 'lost-awaiting-decision' || phase === 'finished'}
        resume={resumed?.loss ?? null}
        onFinished={() => setPhase('finished')}
        roundId={roundId}
        finalGuesses={submittedGuesses}
        secretWordTokens={secretWord}
        headerCoinRef={headerCoinRef}
        coins={coins}
        onCoinsChange={setCoinsState}
        points={points}
        onPointsChange={setPointsState}
        streak={streak}
        bestStreak={bestStreak}
        onStreakChange={(s) => {
          setStreakState(s.current);
          setBestStreak(s.best);
        }}
        onRetry={handleLossRetry}
        onRetryGranted={handleRetryGranted}
        initialRetriesUsed={retriesUsed}
        onNewGame={handleNewGame}
      />
      {/* Fixed, full-screen overlay above everything (App.tsx measures real
          on-screen positions at fire time — see handleDarts) — sits outside
          the SafeAreaView so its coordinate space matches measureInWindow's
          window-relative one exactly, with no safe-area offset to account for. */}
      <ArrowOverlay volleyId={dartsVolley.id} origin={dartsVolley.origin} targets={dartsVolley.targets} />
      {/* Above everything, end-of-round modals included. */}
      <PushPageLayer page={shopPage}>
        <ShopScreen onBack={shopPage.close} visible={shopPage.onTop} />
      </PushPageLayer>
      <RulesModal open={rulesOpen} onClose={handleCloseRules} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Takes all space between header and keyboard; the board is centered in it.
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardArea: {
    width: '100%',
  },
  bottomArea: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
});
