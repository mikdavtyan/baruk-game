import { createRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import HintFlightOverlay, { HintFlight } from './components/HintFlightOverlay';
import Keyboard, { ALL_LETTER_TOKENS, computeKeyGeometry } from './components/Keyboard';
import LossFlow from './components/LossFlow';
import { GhostHint, HintLanding, RowData } from './components/Row';
import EmptyPage from './components/EmptyPage';
import MenuScreen, { MENU_PAGE_TITLES, MenuPage } from './components/MenuScreen';
import ProfileModal from './components/ProfileModal';
import RulesModal from './components/RulesModal';
import { PushPageLayer, usePushPage } from './components/PushPage';
import ShopScreen from './components/ShopScreen';
import { ThemedStatusBar } from './components/ThemedSnapshot';
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
  HINT_FLIGHT_MS,
  HINT_REDUCED_FADE_MS,
  HINT_SPARKS_MS,
  WORD_LENGTH,
  LetterState,
  FONT_FAMILY,
} from './constants/theme';
import { AD_REWARD_COINS, ItemPack } from './constants/shop';
import { LOSS_SHAKE_DURATION_MS, WIN_FLOW_CONFIG } from './constants/winFlow';
import { evaluateGuess } from './lib/evaluateGuess';
import { guessValidity } from './lib/guessValidity';
import {
  AdRewards,
  getAdRewards,
  getCoins,
  getInventory,
  getPendingLoss,
  getPendingWin,
  getPoints,
  getRound,
  getProfile,
  getRulesSeen,
  getStreak,
  Inventory,
  PendingLoss,
  PendingWin,
  SavedRound,
  saveAtomically,
  setRound,
  setProfile,
  setRulesSeen,
  WordBag,
} from './lib/gameStorage';
import { GamePhase, phaseFromPending } from './lib/gamePhase';
import { DEFAULT_PROFILE, Profile } from './constants/profile';
import { normalizeProfile } from './lib/profile';
import { computeKeyStates } from './lib/keyboardStates';
import { useStableCallback } from './lib/useStableCallback';
import { triggerHintLandingHaptic } from './lib/haptics';
import { measureWindow } from './lib/measureWindow';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import { adsLeftToday, localDayKey, nextAdRewards as nextAdRewardsFor } from './lib/shop';
import { showRewardedAd } from './lib/rewardedAd';
import { advanceBag, currentWordTokens, loadWordBag, PLAYABLE_WORDS } from './lib/wordBag';

type SubmittedGuess = {
  tokens: string[];
  states: LetterState[];
};


// Tiles take up size + 8px each way (4px margin per side, 8px row gap).
// Shared constants, so memoized children see the same arrays every render.
const EMPTY_ROW: RowData = {
  letters: Array<string>(WORD_LENGTH).fill(''),
  states: Array<LetterState>(WORD_LENGTH).fill('empty'),
};
const NO_TOKENS: string[] = [];

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
  const { color, reduceMotion } = useTheme();
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
  // The shop's rewarded ads taken today (wordle:adRewards).
  const [adRewards, setAdRewards] = useState<AdRewards>({ day: '', count: 0 });
  // The latest balances, for the shop's ad: a pack bought while the ad loads
  // must not be overwritten by the ad's credit, computed from older values.
  const latestRef = useRef({ coins, inventory, adRewards });
  useLayoutEffect(() => {
    latestRef.current = { coins, inventory, adRewards };
  });
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

  // The Hint "magic flight" (HintFlightOverlay): purely visual — the hint is
  // saved at tap time. `arrivingHintIndex` keeps that ghost hidden (and
  // Submit ignored) until the light lands; `hintLanding` then makes its tile
  // breathe and the ghost scale in. Positions are measured at tap time: the
  // Hint button, and the target tile through the active row's cell refs.
  const hintButtonRef = useRef<View>(null);
  const [activeCellRefs] = useState(() => Array.from({ length: WORD_LENGTH }, () => createRef<View>()));
  const [hintFlight, setHintFlight] = useState<HintFlight | null>(null);
  const [arrivingHintIndex, setArrivingHintIndex] = useState<number | null>(null);
  const [hintLanding, setHintLanding] = useState<HintLanding | null>(null);
  // The flight's pending landing/finish timers, and an id that a board reset
  // bumps so a flight still being measured never starts afterwards.
  const hintTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintFlightIdRef = useRef(0);
  useEffect(() => {
    const timers = hintTimersRef;
    return () => timers.current.forEach(clearTimeout); // unmount: nothing lands later
  }, []);
  const keyboardAreaRef = useRef<View>(null);

  // The "How to play" popup (RulesModal): opened by the header's rules
  // button, and by itself the first time the Classic page opens (handleOpenClassic).
  // It closes itself on Android's back button.
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesOpenRef = useRef(rulesOpen);
  const handleOpenRules = () => setRulesOpen(true);
  const handleCloseRules = useCallback(() => setRulesOpen(false), []);
  // The shop page (ShopScreen), pushed in over the game (PushPage.tsx) —
  // opened by the header's coin pill, or by a power-up tap with no items and
  // too few coins.
  const shopPage = usePushPage();
  const shopOnTopRef = useRef(shopPage.onTop);
  useLayoutEffect(() => {
    rulesOpenRef.current = rulesOpen;
    shopOnTopRef.current = shopPage.onTop;
  });
  // Navigation: the app opens on the menu (MenuScreen); the game is the
  // Classic page pushed over it (`gamePage`), and the bottom bar's empty pages
  // share one more (`infoPage`, showing `infoPageKind`). The shop is pushed
  // over either. All game state lives here, so leaving the game changes nothing.
  // Android back goes to whatever covers the game first (the rules popup, the
  // shop): their handlers can register before the page's in the same commit.
  const gamePage = usePushPage({ isCovered: () => rulesOpenRef.current || shopOnTopRef.current });
  const infoPage = usePushPage();
  const [infoPageKind, setInfoPageKind] = useState<MenuPage>('wheel');
  // The local profile (wordle:profile), edited in the ՊՐՈՖԻԼ popup the menu's
  // profile opens; saved (normalized) when the popup closes.
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const handleCloseProfile = (draft: Profile) => {
    const next = normalizeProfile(draft);
    setProfileState(next);
    setProfile(next);
    setProfileOpen(false);
  };
  // The rules popup opens by itself the first time the player opens the
  // Classic page; the flag is saved as it opens, so closing the app with it
  // still open doesn't bring it back.
  const [rulesSeen, setRulesSeenState] = useState(true);
  const handleOpenClassic = () => {
    gamePage.open();
    if (!rulesSeen) {
      setRulesSeenState(true);
      setRulesOpen(true);
      setRulesSeen();
    }
  };
  const handleOpenMenuPage = (kind: MenuPage) => {
    setInfoPageKind(kind);
    infoPage.open();
  };

  // Buys an item pack in the shop: the coins and the inventory change in ONE
  // atomic write (docs/adr/0003), then the UI follows. ShopScreen only calls
  // it for a pack the player can afford.
  const handleBuyPack = async (pack: ItemPack) => {
    const { coins: balance, inventory: held } = latestRef.current;
    if (balance < pack.price) return;
    const nextCoins = balance - pack.price;
    const nextInventory = { ...held, [pack.item]: held[pack.item] + pack.quantity };
    latestRef.current = { ...latestRef.current, coins: nextCoins, inventory: nextInventory };
    await saveAtomically({ coins: nextCoins, inventory: nextInventory });
    setCoinsState(nextCoins);
    setInventory(nextInventory);
  };

  // The shop's rewarded ad: once watched, the coins and today's counter are
  // saved in ONE atomic write. At most AD_REWARDS_PER_DAY per local day.
  const handleWatchShopAd = async () => {
    if (adsLeftToday(latestRef.current.adRewards, localDayKey(new Date())) <= 0) return;
    const watched = await showRewardedAd();
    if (!watched) return;
    const { coins: balance, adRewards: taken } = latestRef.current; // read after the ad's wait
    const nextCoins = balance + AD_REWARD_COINS;
    const nextAdRewards = nextAdRewardsFor(taken, localDayKey(new Date()));
    latestRef.current = { ...latestRef.current, coins: nextCoins, adRewards: nextAdRewards };
    await saveAtomically({ coins: nextCoins, adRewards: nextAdRewards });
    setCoinsState(nextCoins);
    setAdRewards(nextAdRewards);
  };

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
    // A Hint's light is still flying to this row — the row mustn't change under it.
    if (arrivingHintIndex !== null) return;
    if (isBoardFull) return;
    if (guessValidity(enteredTokens) !== 'valid') return;
    const states = evaluateGuess(guess.tokens, secretWord);
    const nextSubmitted = [...submittedGuesses, { tokens: guess.tokens, states }];
    setSubmittedGuesses(nextSubmitted);
    setGuess(initialGuess());
    // The landed Hint's entrance belonged to this row; the next row mustn't replay it.
    setHintLanding(null);
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
      getAdRewards(),
      getProfile(),
    ]).then(
      ([bag, win, loss, round, savedCoins, savedPoints, savedStreak, rulesSeen, savedInventory, savedAdRewards, savedProfile]) => {
        setProfileState(savedProfile);
        setInventory(savedInventory);
        setAdRewards(savedAdRewards);
        setRulesSeenState(rulesSeen);
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
    cancelHintFlight(); // nothing lands on the new board
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
  // Memoized: a keystroke changes none of its inputs, so the Keyboard (memo)
  // keeps the same object and doesn't re-render.
  const keyStates = useMemo(
    () =>
      computeKeyStates([
        ...retainedGuesses,
        ...(isRevealing ? submittedGuesses.slice(0, -1) : submittedGuesses),
        ...(dartsRevealedAbsent.length > 0
          ? [{ tokens: dartsRevealedAbsent, states: dartsRevealedAbsent.map(() => 'absent' as const) }]
          : []),
      ]),
    [retainedGuesses, isRevealing, submittedGuesses, dartsRevealedAbsent],
  );

  // Shared "can the player interact right now" gate for all three bottom
  // controls (ԸՆԴՈՒՆԵԼ, Hint, Darts) — none of them act during a reveal or
  // once the game is over.
  const isGameLocked = phase !== 'playing' || isBoardFull;
  // Ghosts on the active row: after a retry (retained guesses exist), every
  // position found green in any guess of this word, plus unused hint ghosts.
  // Memoized like keyStates: the board's ghost array must keep its identity
  // across keystrokes, or every Row would re-render.
  const { greenPositions, ghosts } = useMemo(() => {
    const greens = correctPositionGhosts([...retainedGuesses, ...submittedGuesses]);
    const carriedGhosts = retainedGuesses.length > 0 ? greens : [];
    // Each ghost knows its kind, so Tile can tell "I found this" (carried) from
    // "a Hint showed this"; where both land on one position, carried wins.
    const all: GhostHint[] = [
      ...carriedGhosts.map((g) => ({ ...g, kind: 'carried' as const })),
      ...hintGhosts
        .filter((h) => !carriedGhosts.some((c) => c.index === h.index))
        .map((h) => ({ ...h, kind: 'hint' as const })),
    ];
    return { greenPositions: greens, ghosts: all };
  }, [retainedGuesses, submittedGuesses, hintGhosts]);
  // What the board shows: every ghost except a Hint whose light hasn't landed yet.
  const visibleGhosts = useMemo(
    () => ghosts.filter((g) => !(g.kind === 'hint' && g.index === arrivingHintIndex)),
    [ghosts, arrivingHintIndex],
  );
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
  // Cancels a Hint flight (a board reset): stops its timers, hides the light,
  // shows the (already saved) ghost, and frees the power-ups.
  const cancelHintFlight = () => {
    hintTimersRef.current.forEach(clearTimeout);
    hintTimersRef.current = [];
    hintFlightIdRef.current += 1;
    setHintFlight(null);
    setArrivingHintIndex(null);
    setHintLanding(null);
    powerUpBusyRef.current = false;
  };
  const afterHint = (fn: () => void, ms: number) => {
    hintTimersRef.current.push(setTimeout(fn, ms));
  };

  const handleHint = async () => {
    if (hintDisabled || powerUpBusyRef.current || isDartsFiring) return;
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
    powerUpBusyRef.current = true; // until the whole flight has played
    const flightId = ++hintFlightIdRef.current;
    const index = hintTargets[Math.floor(Math.random() * hintTargets.length)];
    const nextGhosts = [...hintGhosts, { index, letter: secretWord[index] }];
    // Saved now, in one atomic write (a crash mid-flight keeps the ghost and
    // the charge); only how it appears is animated below.
    await payFor('hint', hintPrice, { hintGhosts: nextGhosts });
    if (flightId !== hintFlightIdRef.current) return; // the board was reset meanwhile
    setHintGhosts(nextGhosts);
    setArrivingHintIndex(index); // same render: the new ghost never flashes before the light lands

    const land = () => {
      setArrivingHintIndex(null);
      setHintLanding((prev) => ({ id: (prev?.id ?? 0) + 1, index }));
      if (!reduceMotion) triggerHintLandingHaptic();
    };
    const finish = () => {
      hintTimersRef.current = [];
      setHintFlight(null);
      powerUpBusyRef.current = false;
    };

    // Reduced motion: no flight, no sparks — the ghost just fades in.
    if (reduceMotion) {
      land();
      afterHint(finish, HINT_REDUCED_FADE_MS);
      return;
    }
    const [from, to] = await Promise.all([measureWindow(hintButtonRef), measureWindow(activeCellRefs[index])]);
    if (flightId !== hintFlightIdRef.current) return;
    // Either end unmeasurable: no flight, the arrival effect in place only.
    if (!from || !to) {
      land();
      afterHint(finish, HINT_SPARKS_MS);
      return;
    }
    setHintFlight({
      id: flightId,
      origin: { x: from.x + from.width / 2, y: from.y + from.height / 2 },
      target: { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    });
    // Coupled with HintFlightOverlay: it lands after HINT_FLIGHT_MS, then
    // its sparks play for HINT_SPARKS_MS.
    afterHint(land, HINT_FLIGHT_MS);
    afterHint(finish, HINT_FLIGHT_MS + HINT_SPARKS_MS);
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
  // Submitted and blank rows keep their arrays' identity, so a keystroke
  // re-renders only the row being typed (Row and Tile are memoized).
  const rows: RowData[] = useMemo(
    () =>
      Array.from({ length: MAX_GUESSES }, (_, rowIndex) => {
        if (rowIndex < submittedGuesses.length) {
          const { tokens, states } = submittedGuesses[rowIndex];
          return { letters: tokens, states };
        }
        if (rowIndex === submittedGuesses.length) {
          const letters = Array.from({ length: WORD_LENGTH }, (_, i) => guess.tokens[i] ?? '');
          const states = letters.map((l) => (l ? ('filled' as const) : ('empty' as const)));
          return { letters, states };
        }
        return EMPTY_ROW;
      }),
    [submittedGuesses, guess.tokens],
  );

  // Hint only ever applies to the row currently being typed, and only while
  // the player can actually act.
  const activeRowIndex = phase === 'playing' ? submittedGuesses.length : null;

  // Stable identities for the memoized children (Header, Keyboard,
  // BottomControls, WinFlow, LossFlow, ShopScreen): App re-renders on every
  // keystroke, and a fresh handler would re-render each of them.
  const onKeyPress = useStableCallback(handleKeyPress);
  const onBackspace = useStableCallback(handleBackspace);
  const onSubmit = useStableCallback(handleEnter);
  const onClearInvalid = useStableCallback(handleClearInvalidGuess);
  const onHint = useStableCallback(handleHint);
  const onDarts = useStableCallback(handleDarts);
  const onOpenRules = useStableCallback(handleOpenRules);
  const onOpenClassic = useStableCallback(handleOpenClassic);
  const onOpenMenuPage = useStableCallback(handleOpenMenuPage);
  const onOpenProfile = useStableCallback(() => setProfileOpen(true));
  const onCloseProfile = useStableCallback(handleCloseProfile);
  // The Classic card's subtitle: a result waiting (a pending reward, second
  // chance or loss result — the end-of-round phases mirror those records),
  // else guesses submitted in this attempt, else nothing in progress.
  const classicSubtitle =
    phase === 'won' || phase === 'lost-awaiting-decision' || phase === 'finished'
      ? 'ՇԱՐՈՒՆԱԿԵԼ'
      : submittedGuesses.length > 0
        ? `ՇԱՐՈՒՆԱԿԵԼ · ${submittedGuesses.length}/${MAX_GUESSES}`
        : 'ԽԱՂԱԼ';
  const onBoardAreaLayout = useStableCallback(handleBoardAreaLayout);
  const onNewGame = useStableCallback(handleNewGame);
  const onLossRetry = useStableCallback(handleLossRetry);
  const onRetryGranted = useStableCallback(handleRetryGranted);
  const onBuyPack = useStableCallback(handleBuyPack);
  const onWatchShopAd = useStableCallback(handleWatchShopAd);
  const onStreakChange = useStableCallback((s: { current: number; best: number }) => {
    setStreakState(s.current);
    setBestStreak(s.best);
  });
  const onLossFinished = useStableCallback(() => setPhase('finished'));
  const adsLeft = adsLeftToday(adRewards, localDayKey(new Date()));
  // The page's content as one memoized element, so PushPageLayer (memo) sees
  // the same `children` while nothing it shows has changed.
  const shopScreen = useMemo(
    () => (
      <ShopScreen
        onBack={shopPage.close}
        visible={shopPage.onTop}
        coins={coins}
        inventory={inventory}
        adsLeft={adsLeft}
        onBuyPack={onBuyPack}
        onWatchAd={onWatchShopAd}
      />
    ),
    [shopPage.close, shopPage.onTop, coins, inventory, adsLeft, onBuyPack, onWatchShopAd],
  );

  const infoPageContent = useMemo(
    () => <EmptyPage title={MENU_PAGE_TITLES[infoPageKind]} onBack={infoPage.close} visible={infoPage.onTop} />,
    [infoPageKind, infoPage.close, infoPage.onTop],
  );

  // Wait for the fonts so text never flashes in the system font (if loading
  // fails, render anyway with system fonts), and for the word bag.
  if ((!fontsLoaded && !fontError) || !wordBag || !resumed) return null;

  return (
    <SafeAreaProvider>
      {/* Everything the shop can be pushed over (the menu and its pages): it
          slides a little left under the shop. */}
      <Animated.View style={[styles.container, { transform: [{ translateX: shopPage.gameTranslateX }] }]}>
      {/* The menu, under every page: it slides a little left under the game
          or an empty page, and is inert while one covers it. */}
      <Animated.View
        style={[styles.container, { transform: [{ translateX: gamePage.gameTranslateX }] }]}
        pointerEvents={gamePage.onTop || infoPage.onTop || shopPage.onTop ? 'none' : 'auto'}
        importantForAccessibility={gamePage.onTop || infoPage.onTop || shopPage.onTop || rulesOpen || profileOpen ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={gamePage.onTop || infoPage.onTop || shopPage.onTop || rulesOpen || profileOpen}
      >
        <Animated.View style={[styles.container, { transform: [{ translateX: infoPage.gameTranslateX }] }]}>
          <MenuScreen
            profile={profile}
            points={points}
            coins={coins}
            classicSubtitle={classicSubtitle}
            onOpenClassic={onOpenClassic}
            onOpenShop={shopPage.open}
            onOpenPage={onOpenMenuPage}
            onOpenProfile={onOpenProfile}
          />
        </Animated.View>
      </Animated.View>
      {/* The Classic game page — pre-mounted (offscreen and inert until
          opened, never unmounted), so opening it never pays for mounting the
          game, and its state and flows stay alive behind the menu. */}
      <PushPageLayer page={gamePage} preMount testID="page-game">
      {/* The game screen itself. It's inert and hidden from screen readers
          while the shop or the rules popup covers it. */}
      <View
        style={styles.container}
        pointerEvents={shopPage.onTop ? 'none' : 'auto'}
        importantForAccessibility={rulesOpen || shopPage.onTop ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={rulesOpen || shopPage.onTop}
      >
      <AnimatedSafeAreaView
        style={[styles.container, { backgroundColor: color('background') }]}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <Header
          ref={headerCoinRef}
          score={points}
          coins={coins}
          onOpenRules={onOpenRules}
          onOpenShop={shopPage.open}
          onBack={gamePage.close}
        />
        <View style={styles.boardArea} onLayout={onBoardAreaLayout} ref={boardAreaMeasureRef}>
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
              ghostHints={visibleGhosts}
              activeCellRefs={activeCellRefs}
              hintLanding={hintLanding}
            />
          )}
          {toast && <Toast key={toast.id} message={toast.message} onHidden={() => setToast(null)} />}
        </View>
        <View style={styles.keyboardArea} ref={keyboardAreaRef}>
          <Keyboard
            keyStates={keyStates}
            onKeyPress={onKeyPress}
            onBackspace={onBackspace}
            dartsHitTokens={reduceMotion ? NO_TOKENS : dartsRevealedAbsent}
          />
        </View>
        <View style={styles.bottomArea}>
          <BottomControls
            validity={guessValidity(enteredTokens)}
            onSubmit={onSubmit}
            onClearInvalid={onClearInvalid}
            hintDisabled={hintDisabled}
            hintCount={inventory.hint}
            dartsCount={inventory.darts}
            hintDimmed={hintDisabled || hintExhausted || hintNoRoom || !canPayHint}
            onHint={onHint}
            dartsDisabled={dartsDisabled}
            dartsDimmed={dartsDisabled || dartsExhausted || !canPayDarts}
            onDarts={onDarts}
            dartsVolleyId={dartsVolley.id}
            dartsShotCount={dartsVolley.targets.length}
            dartsButtonRef={dartsButtonRef}
            hintButtonRef={hintButtonRef}
          />
        </View>
      </AnimatedSafeAreaView>
      </View>
      <WinFlow
        active={phase === 'won'}
        resume={resumed?.win ?? null}
        secretWordTokens={secretWord}
        submittedGuesses={submittedGuesses}
        boardAreaRef={boardAreaMeasureRef}
        headerCoinRef={headerCoinRef}
        coins={coins}
        onCoinsChange={setCoinsState}
        onNextWord={onNewGame}
        afterRetry={retriesUsed > 0}
        points={points}
        onPointsChange={setPointsState}
        streak={streak}
        bestStreak={bestStreak}
        onStreakChange={onStreakChange}
      />
      <LossFlow
        active={phase === 'lost-awaiting-decision' || phase === 'finished'}
        resume={resumed?.loss ?? null}
        onFinished={onLossFinished}
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
        onStreakChange={onStreakChange}
        onRetry={onLossRetry}
        onRetryGranted={onRetryGranted}
        initialRetriesUsed={retriesUsed}
        onNewGame={onNewGame}
      />
      {/* Fixed, full-screen overlay above everything (App.tsx measures real
          on-screen positions at fire time — see handleDarts) — sits outside
          the SafeAreaView so its coordinate space matches measureInWindow's
          window-relative one exactly, with no safe-area offset to account for. */}
      <ArrowOverlay volleyId={dartsVolley.id} origin={dartsVolley.origin} targets={dartsVolley.targets} />
      {/* The Hint light and its sparks — the same window-coordinate overlay idea. */}
      <HintFlightOverlay flight={hintFlight} />
      </PushPageLayer>
      <PushPageLayer page={infoPage} testID="page-info">
        {infoPageContent}
      </PushPageLayer>
      </Animated.View>
      {/* Above everything, the game page and its end-of-round modals included. */}
      <PushPageLayer page={shopPage} testID="page-shop">
        {shopScreen}
      </PushPageLayer>
      <RulesModal open={rulesOpen} onClose={handleCloseRules} />
      <ProfileModal open={profileOpen} profile={profile} onClose={onCloseProfile} />
      {/* Follows the in-app theme: 'auto' would follow the system scheme,
          which app.json pins to light. */}
      <ThemedStatusBar />
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
